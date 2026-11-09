import {
  consultarAssinaturaMercadoPago,
  verificarAssinaturaWebhookMercadoPago,
} from "../../../../../lib/mercado-pago";
import { normalizarPlano } from "../../../../../lib/planos";
import { criarServiceClient } from "../../../../../lib/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MercadoPagoWebhook = {
  type?: string;
  topic?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

export async function POST(request: Request) {
  const body = await request.text();

  if (!verificarAssinaturaWebhookMercadoPago(request, body)) {
    return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const service = criarServiceClient();

  if (!service) {
    return Response.json(
      { error: "Servidor ainda não configurado para cobrança." },
      { status: 503 }
    );
  }

  let evento: MercadoPagoWebhook;
  try {
    evento = JSON.parse(body) as MercadoPagoWebhook;
  } catch {
    return Response.json({ ok: true });
  }

  const tipo = evento.type ?? evento.topic ?? "";
  const id = evento.data?.id === undefined ? "" : String(evento.data.id);

  if (!id || !tipo.includes("preapproval")) {
    return Response.json({ ok: true });
  }

  try {
    const assinatura = await consultarAssinaturaMercadoPago(id);
    const [empresaId = "", planoAssinado = "premium"] = String(
      assinatura.external_reference ?? ""
    ).split(":");

    if (!empresaId) {
      return Response.json({ ok: true });
    }

    const { subscriptionStatus, accessStatus } = mapearStatusAssinatura(
      assinatura.status
    );

    await service
      .from("empresas")
      .update({
        plan: normalizarPlano(planoAssinado),
        subscription_provider: "mercadopago",
        subscription_id: assinatura.id,
        subscription_customer_id: assinatura.payer_email ?? null,
        subscription_status: subscriptionStatus,
        access_status: accessStatus,
        current_period_end: assinatura.next_payment_date ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", empresaId);

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Erro ao processar webhook." }, { status: 500 });
  }
}

function mapearStatusAssinatura(status: string | undefined) {
  switch (status) {
    case "authorized":
      return { subscriptionStatus: "active", accessStatus: "active" };
    case "pending":
      return { subscriptionStatus: "trialing", accessStatus: "active" };
    case "paused":
      return { subscriptionStatus: "past_due", accessStatus: "suspended" };
    case "cancelled":
      return { subscriptionStatus: "cancelled", accessStatus: "cancelled" };
    default:
      return { subscriptionStatus: "past_due", accessStatus: "suspended" };
  }
}
