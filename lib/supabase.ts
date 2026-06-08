import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

const cookieStorage = {
  getItem(key: string) {
    if (typeof document === "undefined") {
      return null;
    }

    const prefixo = `${encodeURIComponent(key)}=`;
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(prefixo));

    return cookie ? decodeURIComponent(cookie.slice(prefixo.length)) : null;
  },
  setItem(key: string, value: string) {
    if (typeof document === "undefined") {
      return;
    }

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(
      value
    )}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  },
  removeItem(key: string) {
    if (typeof document === "undefined") {
      return;
    }

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${encodeURIComponent(
      key
    )}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: cookieStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function criarSupabaseCampo(publicToken: string) {
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        "x-campo-token": publicToken,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
