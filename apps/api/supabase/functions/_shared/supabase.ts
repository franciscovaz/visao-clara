import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

export function createUserSupabaseClient(token: string) {
  return createClient(
    Deno.env.get("VC_SUPABASE_URL")!,
    Deno.env.get("VC_SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
