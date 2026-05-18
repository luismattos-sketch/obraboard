import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vrcdcvoqimxrjoqbuqwg.supabase.co";

const supabaseKey = "sb_publishable_ru7tPPV-3Bv9-v-KfPV2VA_pevNGJav";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);