import "server-only";

import crypto from "node:crypto";

import { obterAppUrl } from "./app-url";
import { obterPlano, type PlanoCodigo } from "./planos";

const MERCADO_PAGO_API = "https://api.mercadopago.com";

export type MercadoPagoPreapproval = {
  id: string;
  status?: string;
  init_point?: string;
  sandbox_init_point?: string;
  payer_email?: string;
  external_reference?: string;
  next_payment_date?: string | null;
  auto_recurring?: {
    transaction_amount?: number;
    currency_id?: string;
    frequency?: number;
    frequency_type?: string;
  };
};

export function mercadoPagoConfigurado() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

export async function criarAssinaturaPlano(params: {
  empresaId: string;
  email: string;
  nome: string;
  plano: PlanoCodigo;
}) {
  const accessToken = obterAccessToken();
  const appUrl = obterAppUrl();
  const plano = obterPlano(params.plano);
  const response = await fetch(`${MERCADO_PAGO_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `Frentia ${plano.nome}`,
      external_reference: `${params.empresaId}:${plano.codigo}`,
      payer_email: params.email,
      back_url: `${appUrl}/assinatura?retorno=mercadopago`,
      notification_url: `${appUrl}/api/billing/mercadopago/webhook`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plano.preco,
        currency_id: "BRL",
      },
      status: "pending",
    }),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Mercado Pago recusou a assinatura: ${erro}`);
  }

  return (await response.json()) as MercadoPagoPreapproval;
}

export async function consultarAssinaturaMercadoPago(id: string) {
  const accessToken = obterAccessToken();
  const response = await fetch(
    `${MERCADO_PAGO_API}/preapproval/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Não foi possível consultar assinatura: ${erro}`);
  }

  return (await response.json()) as MercadoPagoPreapproval;
}

export function verificarAssinaturaWebhookMercadoPago(request: Request, body: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(
    signature.split(",").map((parte) => {
      const [chave, valor] = parte.split("=");
      return [chave?.trim(), valor?.trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;

  if (!ts || !v1 || !requestId) {
    return false;
  }

  let dataId = "";
  try {
    const evento = JSON.parse(body) as { data?: { id?: string | number } };
    dataId = evento.data?.id === undefined ? "" : String(evento.data.id);
  } catch {
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  if (hash.length !== v1.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(v1));
}

function obterAccessToken() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  return accessToken;
}
