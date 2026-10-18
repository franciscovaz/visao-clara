import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { requireUser } from "../_shared/auth.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
  };
}

// Normalize text for duplicate detection
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s]/g, "") // Remove special chars
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Create service role client for reservation mutations
function createServiceRoleClient() {
  const supabaseUrl = getEnv("VC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey);
}

interface Suggestion {
  title: string;
  priority: "Alta" | "Média" | "Baixa";
  reason: string;
}

interface GenerationRequest {
  project_id: string;
  phase: string;
  previously_suggested?: string[]; // Optional: titles from previous generations not yet added
}

interface GenerationResponse {
  ok: true;
  suggestions: Suggestion[];
  usage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

interface UsageResponse {
  ok: true;
  usage: {
    used: number;
    limit: number;
    remaining: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(),
    });
  }

  try {
    const auth = await requireUser(req);
    const { userId, token } = auth;

    const supabase = createUserSupabaseClient(token);

    // GET: Retrieve current month's usage
    if (req.method === "GET") {
      const url = new URL(req.url);
      const projectId = url.searchParams.get("project_id");

      if (!projectId) {
        return new Response(
          JSON.stringify({ error: "MISSING_PROJECT_ID", reason: "project_id query parameter is required" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Verify project access
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .single();

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ error: "PROJECT_NOT_FOUND", reason: "Project not found or access denied" }),
          { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Get usage from database function (now uses auth.uid() internally)
      const { data: usageData, error: usageError } = await supabase.rpc("get_ai_usage");

      if (usageError) {
        console.error("Usage fetch error:", usageError);
        return new Response(
          JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch usage" }),
          { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const usageRow = usageData?.[0];
      const response: UsageResponse = {
        ok: true,
        usage: {
          used: usageRow?.generation_count ?? 0,
          limit: usageRow?.quota_limit ?? 2,
          remaining: usageRow?.remaining ?? 2,
        },
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    // POST: Generate suggestions
    if (req.method === "POST") {
      let body: GenerationRequest;
      try {
        body = await req.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid JSON body" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const { project_id, phase, previously_suggested } = body;

      if (!project_id || typeof project_id !== "string") {
        return new Response(
          JSON.stringify({ error: "MISSING_PROJECT_ID", reason: "project_id is required" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      if (!phase || typeof phase !== "string") {
        return new Response(
          JSON.stringify({ error: "MISSING_PHASE", reason: "phase is required" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Validate phase
      const validPhases = ["planning", "design", "licensing", "construction", "finishes", "general", "done"];
      if (!validPhases.includes(phase.toLowerCase())) {
        return new Response(
          JSON.stringify({ error: "INVALID_PHASE", reason: `phase must be one of: ${validPhases.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Validate and bound previously_suggested
      if (previously_suggested) {
        if (!Array.isArray(previously_suggested)) {
          return new Response(
            JSON.stringify({ error: "INVALID_PREVIOUSLY_SUGGESTED", reason: "previously_suggested must be an array" }),
            { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }
        if (previously_suggested.length > 20) {
          return new Response(
            JSON.stringify({ error: "INVALID_PREVIOUSLY_SUGGESTED", reason: "previously_suggested can have at most 20 items" }),
            { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }
        for (const item of previously_suggested) {
          if (typeof item !== "string" || item.length > 100) {
            return new Response(
              JSON.stringify({ error: "INVALID_PREVIOUSLY_SUGGESTED", reason: "each previously_suggested item must be a string of max 100 chars" }),
              { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
            );
          }
        }
      }

      // Verify project access and get project details
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id, name, tenant_id, start_date, end_date")
        .eq("id", project_id)
        .single();

      if (projectError || !project) {
        return new Response(
          JSON.stringify({ error: "PROJECT_NOT_FOUND", reason: "Project not found or access denied" }),
          { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Get existing tasks for deduplication
      const { data: existingTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("title, phase")
        .eq("project_id", project_id)
        .eq("phase", phase.toLowerCase());

      if (tasksError) {
        console.error("Tasks fetch error:", tasksError);
        return new Response(
          JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch existing tasks" }),
          { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      // Build exclusion set with normalized titles
      const excludedTitles = new Set<string>();
      (existingTasks ?? []).forEach((t) => {
        excludedTitles.add(normalizeText(t.title));
      });
      (previously_suggested ?? []).forEach((t) => {
        excludedTitles.add(normalizeText(t));
      });

      // Create service role client for all reservation operations
      const serviceRoleClient = createServiceRoleClient();

      // Clean up expired reservations (idempotent, best effort)
      const { error: cleanupError } = await serviceRoleClient.rpc("cleanup_expired_reservations_service");
      if (cleanupError) {
        console.error("Cleanup failed:", cleanupError);
      }

      // Reserve quota using service role
      const { data: reservationData, error: reservationError } = await serviceRoleClient.rpc(
        "reserve_ai_generation_service",
        { p_user_id: userId }
      );

      if (reservationError) {
        console.error("Reservation error:", reservationError);
        return new Response(
          JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to reserve quota" }),
          { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const reservationResult = reservationData?.[0];
      if (!reservationResult || !reservationResult.success) {
        return new Response(
          JSON.stringify({
            error: "QUOTA_EXCEEDED",
            reason: "Monthly AI generation quota exceeded",
            usage: {
              used: reservationResult?.used ?? 0,
              limit: reservationResult?.limit ?? 2,
              remaining: 0,
            },
          }),
          { status: 429, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const reservationId = reservationResult.reservation_id;

      // Helper to release reservation on error
      const releaseReservation = async () => {
        const { error: releaseError } = await serviceRoleClient.rpc(
          "release_ai_reservation_service",
          { p_reservation_id: reservationId, p_user_id: userId }
        );
        if (releaseError) {
          console.error("Release reservation failed:", releaseError);
        }
      };

      try {
        // Call OpenAI API
        const openaiApiKey = getEnv("OPENAI_API_KEY");
        const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

        const existingTasksList = Array.from(excludedTitles).slice(0, 20).join(", ");

        const systemPrompt = `You are a construction project management assistant for Visão Clara, a Portuguese construction management platform.
Generate actionable checklist tasks in European Portuguese (pt-PT) for the specified project phase.

Context:
- Project name: ${project.name}
- Phase: ${phase}
- Start date: ${project.start_date ?? "N/A"}
- End date: ${project.end_date ?? "N/A"}

Existing tasks to avoid (DO NOT repeat):
${existingTasksList || "None"}

Requirements:
- Generate up to 5 unique, actionable tasks
- Each task must have: title (max 100 chars), priority ("Alta", "Média", or "Baixa"), reason (max 200 chars)
- Tasks should be specific to the construction phase
- Avoid tasks already in the existing list
- Avoid duplicate tasks within your response
- Do not invent facts about the project or make unverified regulatory claims
- Keep titles concise and actionable
- Priorities should reflect importance and urgency
- Reasons should explain why the task matters for this phase`;

        const userPrompt = `Generate 5 checklist suggestions for the ${phase} phase of this construction project.`;

        const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "checklist_suggestions",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          priority: {
                            type: "string",
                            enum: ["Alta", "Média", "Baixa"],
                          },
                          reason: { type: "string" },
                        },
                        required: ["title", "priority", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["suggestions"],
                  additionalProperties: false,
                },
              },
            },
            max_tokens: 1000,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error("OpenAI API error:", openaiResponse.status, errorText);
          await releaseReservation();
          return new Response(
            JSON.stringify({
              error: "AI_GENERATION_FAILED",
              reason: "Failed to generate suggestions from AI service",
              details: `OpenAI API returned ${openaiResponse.status}`,
            }),
            { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        const openaiData = await openaiResponse.json();
        const content = openaiData.choices?.[0]?.message?.content;

        if (!content) {
          await releaseReservation();
          return new Response(
            JSON.stringify({ error: "INVALID_AI_RESPONSE", reason: "AI service returned empty response" }),
            { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        let parsed: { suggestions: Suggestion[] };
        try {
          parsed = JSON.parse(content);
        } catch {
          await releaseReservation();
          return new Response(
            JSON.stringify({ error: "INVALID_AI_RESPONSE", reason: "Failed to parse AI response" }),
            { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
          await releaseReservation();
          return new Response(
            JSON.stringify({ error: "INVALID_AI_RESPONSE", reason: "AI response missing suggestions array" }),
            { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        // Validate and deduplicate suggestions
        const seenTitles = new Set<string>();
        const validSuggestions: Suggestion[] = [];

        for (const suggestion of parsed.suggestions) {
          if (!suggestion.title || typeof suggestion.title !== "string") continue;
          if (!suggestion.priority || !["Alta", "Média", "Baixa"].includes(suggestion.priority)) continue;
          if (!suggestion.reason || typeof suggestion.reason !== "string") continue;

          // Length validation
          if (suggestion.title.length > 100 || suggestion.reason.length > 200) continue;

          const normalizedTitle = normalizeText(suggestion.title);
          if (excludedTitles.has(normalizedTitle)) continue;
          if (seenTitles.has(normalizedTitle)) continue;

          seenTitles.add(normalizedTitle);
          validSuggestions.push({
            title: suggestion.title.trim(),
            priority: suggestion.priority,
            reason: suggestion.reason.trim(),
          });

          if (validSuggestions.length >= 5) break;
        }

        if (validSuggestions.length === 0) {
          await releaseReservation();
          return new Response(
            JSON.stringify({ error: "NO_VALID_SUGGESTIONS", reason: "AI generated no valid unique suggestions" }),
            { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        // Finalize reservation (increment usage) using service role
        const { data: finalizeData, error: finalizeError } = await serviceRoleClient.rpc(
          "finalize_ai_reservation_service",
          { p_reservation_id: reservationId, p_user_id: userId }
        );

        if (finalizeError) {
          console.error("Finalize reservation error:", finalizeError);
          return new Response(
            JSON.stringify({
              error: "INTERNAL_ERROR",
              reason: "Failed to finalize reservation and record usage",
            }),
            { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        if (finalizeData !== true) {
          console.error("Finalize reservation returned false");
          return new Response(
            JSON.stringify({
              error: "INTERNAL_ERROR",
              reason: "Failed to finalize reservation",
            }),
            { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }

        // Fetch authoritative usage from database after successful finalization
        const { data: usageData, error: usageError } = await supabase.rpc("get_ai_usage");

        const response: GenerationResponse = {
          ok: true,
          suggestions: validSuggestions,
          usage: {
            used: 0,
            limit: 0,
            remaining: 0,
          },
        };

        if (usageError) {
          console.error("Usage fetch error after finalization:", usageError);
          // Return suggestions without usage data to avoid stale values
          response.usage = {
            used: -1, // Indicates unavailable
            limit: reservationResult.limit,
            remaining: -1, // Indicates unavailable
          };
        } else {
          const usageRow = usageData?.[0];
          response.usage = {
            used: usageRow?.generation_count ?? -1,
            limit: usageRow?.quota_limit ?? reservationResult.limit,
            remaining: usageRow?.remaining ?? -1,
          };
        }

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Generation error:", error);
        await releaseReservation();
        throw error;
      }
    }

    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", reason: "Only GET and POST requests are allowed" }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-checklist-suggestions error:", err);

    if (err instanceof Error) {
      if (err.message.includes("UNAUTHORIZED") || err.message.includes("Missing authentication")) {
        return new Response(
          JSON.stringify({ error: "UNAUTHORIZED", reason: err.message }),
          { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Unexpected server error" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});
