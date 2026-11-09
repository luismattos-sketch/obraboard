import { criarServiceClient } from "../../../../lib/server-supabase";

export const dynamic = "force-dynamic";

type ConviteAcesso = {
  id: string;
  empresa_id: string;
  email: string;
  nome: string;
  funcao: string;
  nivel_acesso: string;
  accepted_user_id: string | null;
};

export async function POST(request: Request) {
  const service = criarServiceClient();

  if (!service) {
    return Response.json(
      { error: "Servidor ainda nÃ£o configurado para ativar acessos." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || password.length < 6) {
    return Response.json(
      { error: "Informe e-mail e senha com pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const { data: convite, error: conviteError } = await service
    .from("empresa_convites_acesso")
    .select("id,empresa_id,email,nome,funcao,nivel_acesso,accepted_user_id")
    .ilike("email", email)
    .eq("active", true)
    .in("nivel_acesso", ["Planejador", "Visitante"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (conviteError) {
    return Response.json({ error: conviteError.message }, { status: 500 });
  }

  const conviteAtivo = convite as ConviteAcesso | null;

  if (!conviteAtivo) {
    return Response.json(
      { error: "Este e-mail nÃ£o possui convite ativo no Frentia." },
      { status: 404 }
    );
  }

  if (conviteAtivo.accepted_user_id) {
    return Response.json(
      { error: "Este acesso jÃ¡ foi ativado. Entre com a senha cadastrada." },
      { status: 409 }
    );
  }

  const { data: usuarios, error: usuariosError } =
    await service.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (usuariosError) {
    return Response.json({ error: usuariosError.message }, { status: 500 });
  }

  const usuarioExistente = usuarios.users.find(
    (usuario) => usuario.email?.trim().toLowerCase() === email
  );

  if (usuarioExistente) {
    return Response.json(
      { error: "Este e-mail jÃ¡ tem cadastro. Entre com a senha existente." },
      { status: 409 }
    );
  }

  const { data: novoUsuario, error: criarError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: conviteAtivo.nome,
        nome: conviteAtivo.nome,
        funcao: conviteAtivo.funcao,
        nivelAcesso: conviteAtivo.nivel_acesso,
      },
    });

  if (criarError || !novoUsuario.user) {
    return Response.json(
      { error: criarError?.message ?? "NÃ£o foi possÃ­vel ativar o acesso." },
      { status: 500 }
    );
  }

  const { error: vinculoError } = await service
    .from("empresa_usuarios")
    .upsert(
      {
        empresa_id: conviteAtivo.empresa_id,
        user_id: novoUsuario.user.id,
        papel:
          conviteAtivo.nivel_acesso === "Planejador"
            ? "planejador"
            : "visitante",
      },
      { onConflict: "empresa_id,user_id" }
    );

  if (vinculoError) {
    return Response.json({ error: vinculoError.message }, { status: 500 });
  }

  const { error: aceitarError } = await service
    .from("empresa_convites_acesso")
    .update({
      accepted_user_id: novoUsuario.user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conviteAtivo.id);

  if (aceitarError) {
    return Response.json({ error: aceitarError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
