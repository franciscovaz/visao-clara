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

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");

  // Create client with Authorization header passed through
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate auth by calling getUser()
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ msg: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { user: data.user, supabase };
}
