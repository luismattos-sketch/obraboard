import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

export type AdminContext = {
  admin: User;
  service: SupabaseClient;
};

export async function autenticarAppAdmin(
  request: Request
): Promise<AdminContext | Response> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token) {
    return Response.json({ error: "Sessão não informada." }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return Response.json(
      { error: "Administração ainda não configurada no servidor." },
      { status: 503 }
    );
  }

  const autenticacao = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: userData, error: userError } =
    await autenticacao.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data: admin, error: adminError } = await service
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    return Response.json({ error: "Acesso administrativo negado." }, { status: 403 });
  }

  return { admin: userData.user, service };
}

export function contextoEhResposta(
  contexto: AdminContext | Response
): contexto is Response {
  return contexto instanceof Response;
}
