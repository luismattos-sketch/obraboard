import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://vrcdcvoqimxrjoqbuqwg.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
