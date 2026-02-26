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

export async function requireUser(req: Request): Promise<{ userId: string; token: string; email?: string }> {
  // Read user JWT from x-user-jwt header first (case-insensitive), fallback to Authorization Bearer
  let token = req.headers.get("x-user-jwt") || req.headers.get("X-User-Jwt");
  
  if (!token) {
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      throw new Response(
        JSON.stringify({ 
          error: "UNAUTHORIZED", 
          reason: "Missing authentication token",
          details: "Either x-user-jwt header or Authorization: Bearer <token> required"
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    token = authorizationHeader.replace("Bearer ", "").trim();
  }

  const supabaseUrl = getEnv("VC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("VC_SUPABASE_ANON_KEY");

  // Validate JWT using anon client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Response(
      JSON.stringify({ 
        error: "UNAUTHORIZED", 
        reason: "Invalid or expired token",
        details: error?.message || "Token validation failed"
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return {
    userId: data.user.id,
    token,
    email: data.user.email
  };
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

  // Get JWT from x-user-jwt header first, fallback to Authorization Bearer
  let jwt = req.headers.get("x-user-jwt");
  let authHeader = "";
  
  if (jwt) {
    authHeader = `Bearer ${jwt}`;
  } else {
    const authorizationHeader = req.headers.get("Authorization");
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ msg: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    jwt = authorizationHeader.replace("Bearer ", "").trim();
    authHeader = authorizationHeader;
  }

  const supabaseUrl = getEnv("VC_SUPABASE_URL");
  const supabaseAnonKey = getEnv("VC_SUPABASE_ANON_KEY");

  // Validate JWT using anon client
  const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
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
