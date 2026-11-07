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

/**
 * Service-role client. Only for writes that RLS and table grants intentionally keep away
 * from users (document_files storage state), and only after the caller's access to the
 * row has been verified through createUserSupabaseClient.
 */
export function createServiceSupabaseClient() {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(Deno.env.get("VC_SUPABASE_URL")!, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
