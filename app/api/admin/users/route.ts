import {
  autenticarAppAdmin,
  contextoEhResposta,
} from "../../../../lib/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Linha = Record<string, unknown>;

export async function GET(request: Request) {
  const contexto = await autenticarAppAdmin(request);

  if (contextoEhResposta(contexto)) {
    return contexto;
  }

  const { service } = contexto;
  const { data: authData, error: authError } =
    await service.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (authError) {
    return Response.json({ error: authError.message }, { status: 500 });
  }

  const [
    profilesResult,
    membershipsResult,
    accountsResult,
    bannedResult,
    obrasResult,
    turnosResult,
    atividadesResult,
    restricoesResult,
    rdosResult,
    auditResult,
  ] = await Promise.all([
    service.from("profiles").select("id,email,name,created_at"),
    service.from("empresa_usuarios").select("empresa_id,user_id,papel,created_at"),
    service
      .from("empresas")
      .select(
        "id,owner_id,nome,plan,subscription_status,access_status,trial_started_at,trial_ends_at,subscription_provider,subscription_customer_id,subscription_id,current_period_end,manual_block_reason,created_at,updated_at"
      ),
    service.from("banned_emails").select("email,reason,is_active,created_at,updated_at"),
    service.from("obras").select("empresa_id"),
    service.from("turnos").select("empresa_id"),
    service.from("atividades").select("empresa_id"),
    service.from("restricoes_historico").select("empresa_id"),
    service.from("rdos").select("empresa_id"),
    service
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const erro = [
    profilesResult.error,
    membershipsResult.error,
    accountsResult.error,
    bannedResult.error,
    obrasResult.error,
    turnosResult.error,
    atividadesResult.error,
    restricoesResult.error,
    rdosResult.error,
    auditResult.error,
  ].find(Boolean);

  if (erro) {
    return Response.json({ error: erro.message }, { status: 500 });
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as Linha[]).map((item) => [String(item.id), item])
  );
  const memberships = new Map(
    ((membershipsResult.data ?? []) as Linha[]).map((item) => [
      String(item.user_id),
      item,
    ])
  );
  const accounts = new Map(
    ((accountsResult.data ?? []) as Linha[]).map((item) => [String(item.id), item])
  );
  const banned = new Map(
    ((bannedResult.data ?? []) as Linha[])
      .filter((item) => item.is_active)
      .map((item) => [String(item.email).toLowerCase(), item])
  );
  const contagens = {
    obras: contarPorEmpresa((obrasResult.data ?? []) as Linha[]),
    turnos: contarPorEmpresa((turnosResult.data ?? []) as Linha[]),
    atividades: contarPorEmpresa((atividadesResult.data ?? []) as Linha[]),
    restricoes: contarPorEmpresa((restricoesResult.data ?? []) as Linha[]),
    rdos: contarPorEmpresa((rdosResult.data ?? []) as Linha[]),
  };
  const usuariosPorId = new Map(
    authData.users.map((usuario) => [usuario.id, usuario.email ?? ""])
  );

  const users = authData.users.map((usuario) => {
    const profile = profiles.get(usuario.id);
    const membership = memberships.get(usuario.id);
    const accountId = membership ? String(membership.empresa_id) : null;
    const account = accountId ? accounts.get(accountId) : null;
    const ownerId = account?.owner_id ? String(account.owner_id) : null;
    const email = usuario.email ?? String(profile?.email ?? "");
    const ban = banned.get(email.toLowerCase());

    return {
      userId: usuario.id,
      accountId,
      ownerId,
      ownerEmail: ownerId ? usuariosPorId.get(ownerId) ?? null : null,
      isAccountOwner: ownerId === usuario.id,
      name:
        String(profile?.name ?? "") ||
        String(usuario.user_metadata?.name ?? ""),
      email,
      createdAt: usuario.created_at,
      lastSignInAt: usuario.last_sign_in_at ?? null,
      emailConfirmedAt: usuario.email_confirmed_at ?? null,
      role: membership?.papel ?? null,
      accountName: account?.nome ?? null,
      accessStatus: ban ? "banned" : account?.access_status ?? "deleted",
      subscriptionStatus: account?.subscription_status ?? "inactive",
      plan: account?.plan ?? "free",
      manualBlockReason: account?.manual_block_reason ?? null,
      trialStartedAt: account?.trial_started_at ?? null,
      trialEndsAt: account?.trial_ends_at ?? null,
      currentPeriodEnd: account?.current_period_end ?? null,
      bannedReason: ban?.reason ?? null,
      counts: {
        obras: quantidade(contagens.obras, accountId),
        turnos: quantidade(contagens.turnos, accountId),
        atividades: quantidade(contagens.atividades, accountId),
        restricoes: quantidade(contagens.restricoes, accountId),
        rdos: quantidade(contagens.rdos, accountId),
      },
    };
  });

  const auditLogs = ((auditResult.data ?? []) as Linha[]).map((log) => ({
    ...log,
    adminEmail: usuariosPorId.get(String(log.admin_user_id)) ?? "",
    targetEmail: usuariosPorId.get(String(log.target_user_id)) ?? "",
  }));

  return Response.json({ users, auditLogs });
}

export async function POST(request: Request) {
  const contexto = await autenticarAppAdmin(request);

  if (contextoEhResposta(contexto)) {
    return contexto;
  }

  const body = (await request.json()) as {
    action?: string;
    userId?: string;
    accountId?: string;
    email?: string;
    reason?: string;
    confirmationEmail?: string;
    newOwnerEmail?: string;
    plan?: string;
    subscriptionStatus?: string;
  };
  const action = body.action ?? "";
  const userId = body.userId ?? "";
  const accountId = body.accountId ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const reason = body.reason?.trim() || null;

  if (!action || !userId || !accountId || !email) {
    return Response.json({ error: "Dados administrativos incompletos." }, { status: 400 });
  }

  if (email === "luismattos@gmail.com" && !["billing", "owner"].includes(action)) {
    return Response.json(
      { error: "A conta proprietÃ¡ria nÃ£o pode ser bloqueada ou removida." },
      { status: 400 }
    );
  }

  const { admin, service } = contexto;

  try {
    if (["active", "suspended", "cancelled"].includes(action)) {
      const { error } = await service.rpc("admin_alterar_conta", {
        p_admin_user_id: admin.id,
        p_account_id: accountId,
        p_target_user_id: userId,
        p_access_status: action,
        p_plan: null,
        p_subscription_status: null,
        p_reason: reason,
      });
      if (error) throw error;
    } else if (action === "ban") {
      const { error } = await service.rpc("admin_banir_email", {
        p_admin_user_id: admin.id,
        p_target_user_id: userId,
        p_account_id: accountId,
        p_email: email,
        p_reason: reason,
      });
      if (error) throw error;
    } else if (action === "unban") {
      const { error } = await service.rpc("admin_remover_banimento", {
        p_admin_user_id: admin.id,
        p_target_user_id: userId,
        p_account_id: accountId,
        p_email: email,
        p_reason: reason,
      });
      if (error) throw error;
    } else if (action === "billing") {
      const { error } = await service.rpc("admin_alterar_conta", {
        p_admin_user_id: admin.id,
        p_account_id: accountId,
        p_target_user_id: userId,
        p_access_status: null,
        p_plan: body.plan ?? null,
        p_subscription_status: body.subscriptionStatus ?? null,
        p_reason: reason,
      });
      if (error) throw error;
    } else if (action === "owner") {
      const newOwnerEmail = body.newOwnerEmail?.trim().toLowerCase() ?? "";
      if (!newOwnerEmail) {
        return Response.json(
          { error: "Informe o e-mail do novo dono da conta." },
          { status: 400 }
        );
      }

      const { data: authData, error: authError } =
        await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (authError) throw authError;

      const newOwner = authData.users.find(
        (usuario) => usuario.email?.trim().toLowerCase() === newOwnerEmail
      );
      if (!newOwner?.email) {
        return Response.json(
          {
            error:
              "Novo dono nÃƒÂ£o encontrado. O e-mail precisa ter cadastro/login no Frentia.",
          },
          { status: 404 }
        );
      }

      const { data: account, error: accountError } = await service
        .from("empresas")
        .select("id,owner_id,nome")
        .eq("id", accountId)
        .single();
      if (accountError) throw accountError;

      const previousOwnerId = account?.owner_id ? String(account.owner_id) : null;
      const previousOwnerEmail =
        previousOwnerId && previousOwnerId !== newOwner.id
          ? authData.users.find((usuario) => usuario.id === previousOwnerId)
              ?.email ?? null
          : null;
      const newOwnerName =
        String(newOwner.user_metadata?.name ?? "").trim() ||
        newOwner.email.split("@")[0];

      const { error: profileError } = await service.from("profiles").upsert(
        {
          id: newOwner.id,
          email: newOwner.email,
          name: newOwnerName,
        },
        { onConflict: "id" }
      );
      if (profileError) throw profileError;

      if (previousOwnerId && previousOwnerId !== newOwner.id) {
        const { error: oldMembershipError } = await service
          .from("empresa_usuarios")
          .update({ papel: "usuario" })
          .eq("empresa_id", accountId)
          .eq("user_id", previousOwnerId);
        if (oldMembershipError) throw oldMembershipError;
      }

      const { error: membershipError } = await service
        .from("empresa_usuarios")
        .upsert(
          { empresa_id: accountId, user_id: newOwner.id, papel: "owner" },
          { onConflict: "empresa_id,user_id" }
        );
      if (membershipError) throw membershipError;

      const { error: ownerError } = await service
        .from("empresas")
        .update({ owner_id: newOwner.id })
        .eq("id", accountId);
      if (ownerError) throw ownerError;

      await atualizarDonoNoCadastroBase({
        service,
        accountId,
        newOwner: {
          email: newOwner.email,
          name: newOwnerName,
        },
        previousOwnerEmail,
      });

      const { error: auditError } = await service.rpc(
        "admin_registrar_auditoria",
        {
          p_admin_user_id: admin.id,
          p_target_user_id: newOwner.id,
          p_target_account_id: accountId,
          p_action: "owner_changed",
          p_reason: reason,
          p_metadata: {
            previous_owner_id: previousOwnerId,
            new_owner_email: newOwner.email,
            account_name: account?.nome ?? null,
          },
        }
      );
      if (auditError) throw auditError;
    } else if (action === "delete") {
      if (body.confirmationEmail?.trim().toLowerCase() !== email) {
        return Response.json(
          { error: "Digite exatamente o e-mail da conta para confirmar." },
          { status: 400 }
        );
      }

      const { data: accountToDelete, error: accountLookupError } = await service
        .from("empresas")
        .select("id,owner_id")
        .eq("id", accountId)
        .maybeSingle();
      if (accountLookupError) throw accountLookupError;

      const isOwner = String(accountToDelete?.owner_id ?? "") === userId;

      if (isOwner) {
        const { error: pendingError } = await service.rpc("admin_alterar_conta", {
          p_admin_user_id: admin.id,
          p_account_id: accountId,
          p_target_user_id: userId,
          p_access_status: "deleted_pending",
          p_plan: null,
          p_subscription_status: null,
          p_reason: reason ?? "Exclusao solicitada pelo administrador.",
        });
        if (pendingError) throw pendingError;
      } else {
        const { error: membershipDeleteError } = await service
          .from("empresa_usuarios")
          .delete()
          .eq("empresa_id", accountId)
          .eq("user_id", userId);
        if (membershipDeleteError) throw membershipDeleteError;

        const { error: inviteDeleteError } = await service
          .from("empresa_convites_acesso")
          .update({
            active: false,
            accepted_user_id: null,
            accepted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("empresa_id", accountId)
          .eq("accepted_user_id", userId);
        if (inviteDeleteError) throw inviteDeleteError;
      }

      const { error: authDeleteError } =
        await service.auth.admin.deleteUser(userId, false);

      if (authDeleteError) {
        return Response.json(
          {
            error:
              "O acesso foi atualizado, mas o usuario do Auth nao pode ser removido.",
          },
          { status: 500 }
        );
      }

      if (isOwner) {
        const { error: accountDeleteError } = await service
          .from("empresas")
          .delete()
          .eq("id", accountId);
        if (accountDeleteError) throw accountDeleteError;
      }

      const { error: auditError } = await service.rpc(
        "admin_registrar_auditoria",
        {
          p_admin_user_id: admin.id,
          p_target_user_id: userId,
          p_target_account_id: accountId,
          p_action: isOwner ? "account_deleted" : "child_user_deleted",
          p_reason: reason,
          p_metadata: { email, is_owner: isOwner },
        }
      );
      if (auditError) throw auditError;
    } else {
      return Response.json({ error: "AÃ§Ã£o administrativa invÃ¡lida." }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : (error as { message?: string } | null)?.message ??
          "Falha na operaÃ§Ã£o administrativa.";
    return Response.json({ error: mensagem }, { status: 500 });
  }
}

function contarPorEmpresa(linhas: Linha[]) {
  return linhas.reduce<Map<string, number>>((mapa, linha) => {
    const empresaId = String(linha.empresa_id ?? "");
    if (empresaId) {
      mapa.set(empresaId, (mapa.get(empresaId) ?? 0) + 1);
    }
    return mapa;
  }, new Map());
}

function quantidade(mapa: Map<string, number>, accountId: string | null) {
  return accountId ? mapa.get(accountId) ?? 0 : 0;
}

async function atualizarDonoNoCadastroBase({
  service,
  accountId,
  newOwner,
  previousOwnerEmail,
}: {
  service: SupabaseClient;
  accountId: string;
  newOwner: { email: string; name: string };
  previousOwnerEmail: string | null;
}) {
  const cadastroId = `${accountId}:default`;
  const { data, error } = await service
    .from("cadastro_base")
    .select("id,dados")
    .eq("id", cadastroId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return;

  const dadosAtualizados = atualizarDonoNosDados(
    data.dados,
    newOwner,
    previousOwnerEmail
  );

  const { error: updateError } = await service
    .from("cadastro_base")
    .update({ dados: dadosAtualizados })
    .eq("id", cadastroId);

  if (updateError) throw updateError;
}

function atualizarDonoNosDados(
  dados: unknown,
  newOwner: { email: string; name: string },
  previousOwnerEmail: string | null
) {
  const cadastro = ehObjeto(dados) ? { ...dados } : {};
  cadastro.usuarios = atualizarListaUsuariosOwner(
    cadastro.usuarios,
    newOwner,
    previousOwnerEmail
  );

  if (ehObjeto(cadastro.dadosPorObra)) {
    cadastro.dadosPorObra = Object.fromEntries(
      Object.entries(cadastro.dadosPorObra).map(([obraId, dadosObra]) => {
        const obra = ehObjeto(dadosObra) ? { ...dadosObra } : {};
        obra.usuarios = atualizarListaUsuariosOwner(
          obra.usuarios,
          newOwner,
          previousOwnerEmail
        );
        return [obraId, obra];
      })
    );
  }

  return cadastro;
}

function atualizarListaUsuariosOwner(
  usuarios: unknown,
  newOwner: { email: string; name: string },
  previousOwnerEmail: string | null
) {
  const novoEmail = newOwner.email.trim().toLowerCase();
  const antigoEmail = previousOwnerEmail?.trim().toLowerCase() ?? "";
  const novoAdministrador = {
    id: -1,
    nome: newOwner.name || newOwner.email.split("@")[0],
    funcao: "Administrador",
    email: newOwner.email,
    nivelAcesso: "Administrador",
    protegido: true,
    origem: "owner",
  };

  const lista = Array.isArray(usuarios) ? usuarios : [];
  const restantes = lista
    .map((usuario) => {
      if (!ehObjeto(usuario)) return usuario;

      const email = String(usuario.email ?? "").trim().toLowerCase();
      const ehNovoDono = email === novoEmail;
      const ehAntigoDono = antigoEmail && email === antigoEmail;
      const ehOwnerProtegido =
        usuario.origem === "owner" ||
        (usuario.protegido === true &&
          usuario.nivelAcesso === "Administrador");

      if (ehNovoDono) return null;
      if (ehAntigoDono || ehOwnerProtegido) {
        return {
          ...usuario,
          nivelAcesso: "Usuario",
          protegido: false,
          origem: undefined,
        };
      }

      return usuario;
    })
    .filter(Boolean);

  return [novoAdministrador, ...restantes];
}

function ehObjeto(valor: unknown): valor is Linha {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}
