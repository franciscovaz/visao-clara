import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export interface AuthResult {
  user: { id: string; email?: string };
  supabase: ReturnType<typeof createClient>;
}

export async function getUserOrThrow(req: Request): Promise<AuthResult | Response> {
  // Check apikey header exists
  const apiKey = req.headers.get("apikey");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ msg: "Missing apikey" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ msg: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const jwt = authHeader.replace("Bearer ", "").trim();

  const supabaseUrl = getEnv("VC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("VC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = getEnv("VC_SUPABASE_SERVICE_ROLE_KEY");

  // Validate JWT using service role client
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ msg: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create RLS client with ANON key + Authorization header
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user: data.user, supabase };
}
