import {
  contextoUsuarioEhResposta,
  autenticarUsuarioApi,
} from "../../../../../lib/server-supabase";
import {
  criarAssinaturaPlano,
  mercadoPagoConfigurado,
} from "../../../../../lib/mercado-pago";
import { normalizarPlano, planosAssinatura } from "../../../../../lib/planos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const contexto = await autenticarUsuarioApi(request);

  if (contextoUsuarioEhResposta(contexto)) {
    return contexto;
  }

  if (!mercadoPagoConfigurado()) {
    return Response.json(
      { error: "Mercado Pago ainda não configurado no servidor." },
      { status: 503 }
    );
  }

  const { user, service } = contexto;
  const { data: vinculo, error: vinculoError } = await service
    .from("empresa_usuarios")
    .select("empresa_id,papel")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (vinculoError || !vinculo?.empresa_id) {
    return Response.json(
      { error: "Conta da empresa não encontrada." },
      { status: 404 }
    );
  }

  const { data: empresa, error: empresaError } = await service
    .from("empresas")
    .select("id,nome,subscription_id,subscription_status")
    .eq("id", vinculo.empresa_id)
    .maybeSingle();

  if (empresaError || !empresa) {
    return Response.json(
      { error: "Dados da empresa não encontrados." },
      { status: 404 }
    );
  }

  if (
    empresa.subscription_id &&
    String(empresa.subscription_status ?? "") === "active"
  ) {
    return Response.json(
      { error: "Esta conta ja possui uma assinatura ativa." },
      { status: 409 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { plan?: string };
    const plano = normalizarPlano(body.plan);

    if (!planosAssinatura.includes(plano)) {
      return Response.json(
        { error: "Plano de assinatura inválido." },
        { status: 400 }
      );
    }

    const assinatura = await criarAssinaturaPlano({
      empresaId: String(empresa.id),
      email: user.email ?? "",
      nome: String(empresa.nome ?? "Frentia"),
      plano,
    });

    await service
      .from("empresas")
      .update({
        plan: plano,
        subscription_provider: "mercadopago",
        subscription_id: assinatura.id,
        subscription_customer_id: assinatura.payer_email ?? user.email ?? null,
        subscription_status: "trialing",
        access_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", empresa.id);

    return Response.json({
      initPoint: assinatura.init_point ?? assinatura.sandbox_init_point,
      id: assinatura.id,
    });
  } catch (error) {
    console.error(error);
    const mensagem = error instanceof Error ? error.message : "";

    if (mensagem.includes("Payer and collector cannot be the same user")) {
      return Response.json(
        {
          error:
            "O comprador não pode ser a mesma conta Mercado Pago que recebe. Entre no Frentia com outro e-mail para testar a assinatura.",
        },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Não foi possível iniciar a assinatura." },
      { status: 500 }
    );
  }
}
