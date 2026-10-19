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

// Create service role client for reservation mutations
function createServiceRoleClient() {
  const supabaseUrl = getEnv("VC_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey);
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  project_id: string;
  messages: ChatMessage[];
}

interface Usage {
  message_count: number;
  quota_limit: number;
  remaining: number;
}

interface GetResponse {
  conversation: Conversation | null;
  usage: Usage;
}

interface SendMessageRequest {
  project_id: string;
  message: string;
}

interface SendMessageResponse {
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  assistant_response: string;
  usage: Usage;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(req);
    } else if (req.method === "POST") {
      return await handlePost(req);
    } else {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

async function handleGet(req: Request): Promise<Response> {
  const { userId, token } = await requireUser(req);
  const supabase = createUserSupabaseClient(token);

  const url = new URL(req.url);
  const projectId = url.searchParams.get("project_id");

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Missing project_id" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Validate project_id format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(projectId)) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid project_id format" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Verify user has access to the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (projectError) {
    console.error("Project access check error:", projectError);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to verify project access" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  if (!project) {
    return new Response(
      JSON.stringify({ error: "PROJECT_NOT_FOUND", reason: "Project not found or access denied" }),
      { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Get conversation
  const { data: conversation, error: conversationError } = await supabase
    .from("ai_chat_conversations")
    .select(`
      id,
      project_id,
      ai_chat_messages(id, role, content, created_at)
    `)
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (conversationError) {
    console.error("Conversation fetch error:", conversationError);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch conversation" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Get usage
  const { data: usageData, error: usageError } = await supabase.rpc("get_ai_chat_usage");

  if (usageError) {
    console.error("Usage fetch error:", usageError);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch usage" }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  const usageRow = usageData?.[0];
  const response: GetResponse = {
    conversation: !conversation
      ? null
      : {
          id: conversation.id,
          project_id: conversation.project_id,
          messages: (conversation.ai_chat_messages as ChatMessage[]).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          ),
        },
    usage: {
      message_count: usageRow?.message_count ?? 0,
      quota_limit: usageRow?.quota_limit ?? 10,
      remaining: usageRow?.remaining ?? 10,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

async function handlePost(req: Request): Promise<Response> {
  const { userId, token } = await requireUser(req);
  const supabase = createUserSupabaseClient(token);
  const serviceRoleClient = createServiceRoleClient();

  let body: SendMessageRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Validate body is a non-null object
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  const { project_id, message } = body;

  if (!project_id || !message) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Missing project_id or message" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Validate project_id format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(project_id)) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid project_id format" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Validate message type and content
  if (typeof message !== "string") {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Message must be a string" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Message cannot be empty" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  if (trimmedMessage.length > 5000) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", reason: "Message too long (max 5000 characters)" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Verify user has access to the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .single();

  if (projectError || !project) {
    return new Response(
      JSON.stringify({ error: "PROJECT_NOT_FOUND", reason: "Project not found or access denied" }),
      { status: 404, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  // Clean up expired reservations (idempotent, best effort)
  const { error: cleanupError } = await serviceRoleClient.rpc("cleanup_ai_chat_expired_reservations_service");
  if (cleanupError) {
    console.error("Cleanup failed:", cleanupError);
  }

  // Reserve quota using service role
  const { data: reservationData, error: reservationError } = await serviceRoleClient.rpc(
    "reserve_ai_chat_generation_service",
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
        reason: "Monthly AI chat quota exceeded",
        usage: {
          message_count: reservationResult?.used ?? 0,
          quota_limit: reservationResult?.limit ?? 10,
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
      "release_ai_chat_reservation_service",
      { p_reservation_id: reservationId, p_user_id: userId }
    );
    if (releaseError) {
      console.error("Release reservation failed:", releaseError);
    }
  };

  try {
    // Get or create conversation
    let conversationId: string;
    const { data: existingConversation, error: conversationError } = await supabase
      .from("ai_chat_conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("project_id", project_id)
      .maybeSingle();

    if (conversationError) {
      console.error("Conversation fetch error:", conversationError);
      await releaseReservation();
      return new Response(
        JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch conversation" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!existingConversation) {
      // Create new conversation using service role with ON CONFLICT handling for concurrent requests
      const { data: newConversation, error: createError } = await serviceRoleClient
        .from("ai_chat_conversations")
        .insert({ user_id: userId, project_id: project_id })
        .select("id")
        .maybeSingle();

      // If insert failed due to unique constraint (concurrent creation), fetch existing
      if (createError || !newConversation) {
        const { data: existingAfterConflict, error: fetchError } = await serviceRoleClient
          .from("ai_chat_conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("project_id", project_id)
          .single();

        if (fetchError || !existingAfterConflict) {
          console.error("Create/fetch conversation error:", createError || fetchError);
          await releaseReservation();
          return new Response(
            JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to create or fetch conversation" }),
            { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
          );
        }
        conversationId = existingAfterConflict.id;
      } else {
        conversationId = newConversation.id;
      }
    } else {
      conversationId = existingConversation.id;
    }

    // Get recent conversation history (last 10 messages, excluding current message)
    const { data: recentMessages, error: messagesError } = await supabase
      .from("ai_chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error("Fetch messages error:", messagesError);
      await releaseReservation();
      return new Response(
        JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch conversation history" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Reverse to chronological order for OpenAI
    const chronologicalMessages = recentMessages ? [...recentMessages].reverse() : [];

    // Get project context
    const projectContext = await getProjectContext(supabase, project_id);

    // Call OpenAI API
    const openaiApiKey = getEnv("OPENAI_API_KEY");
    const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    const systemPrompt = `Tu és um assistente de IA especializado em construção, renovação, planeamento de projetos, materiais, orçamentos, cronogramas e tópicos relacionados para a Visão Clara, uma plataforma portuguesa de gestão de projetos de construção.

Regras importantes:
- Responde sempre em português europeu (pt-PT).
- Usa um tom profissional, útil e compreensível.
- Distingue claramente entre factos conhecidos do projeto e conselhos gerais.
- Nunca inventes informações sobre o projeto.
- Evita apresentar orientações regulamentares, legais, estruturais ou de segurança incertas como factos verificados.
- Pede esclarecimentos quando informações essenciais estiverem em falta.
- És um assistente apenas de leitura - não crias, modificas ou apagas tarefas, documentos ou outros dados da aplicação.`;

    // Build messages array for OpenAI
    const openaiMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Contexto do projeto (apenas para referência, não confiar cegamente):
${projectContext}` },
      ...chronologicalMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: trimmedMessage },
    ];

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: openaiMessages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", openaiResponse.status);
      await releaseReservation();
      return new Response(
        JSON.stringify({
          error: "AI_GENERATION_FAILED",
          reason: "Failed to generate response from AI service",
        }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const assistantResponse = openaiData.choices?.[0]?.message?.content;

    if (!assistantResponse) {
      await releaseReservation();
      return new Response(
        JSON.stringify({
          error: "AI_GENERATION_FAILED",
          reason: "AI service returned empty response",
        }),
        { status: 502, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Atomically persist messages and finalize reservation using single RPC
    const { data: finalizeData, error: finalizeError } = await serviceRoleClient.rpc(
      "finalize_ai_chat_with_messages_service",
      {
        p_reservation_id: reservationId,
        p_user_id: userId,
        p_conversation_id: conversationId,
        p_user_message: trimmedMessage,
        p_assistant_message: assistantResponse,
      }
    );

    if (finalizeError) {
      console.error("Finalize with messages error:", finalizeError);
      // Network/timeout error - ambiguous outcome, do not release reservation
      // It will expire in 5 minutes if it didn't commit
      return new Response(
        JSON.stringify({
          error: "INTERNAL_ERROR",
          reason: "Failed to persist messages and record usage",
        }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const finalizeResult = finalizeData?.[0];
    if (!finalizeResult || !finalizeResult.success) {
      console.error("Finalize with messages returned false");
      // RPC returned success=false - transaction did not commit, safe to release
      await releaseReservation();
      return new Response(
        JSON.stringify({
          error: "INTERNAL_ERROR",
          reason: "Failed to persist messages and record usage",
        }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Fetch authoritative usage from database after successful finalization
    const { data: usageData, error: usageError } = await supabase.rpc("get_ai_chat_usage");

    const response: SendMessageResponse = {
      conversation_id: conversationId,
      user_message_id: finalizeResult.user_message_id,
      assistant_message_id: finalizeResult.assistant_message_id,
      assistant_response: assistantResponse,
      usage: {
        message_count: 0,
        quota_limit: 0,
        remaining: 0,
      },
    };

    if (usageError) {
      console.error("Usage fetch error after finalization:", usageError);
      response.usage = {
        message_count: -1,
        quota_limit: reservationResult.limit,
        remaining: -1,
      };
    } else {
      const usageRow = usageData?.[0];
      response.usage = {
        message_count: usageRow?.message_count ?? -1,
        quota_limit: usageRow?.quota_limit ?? reservationResult.limit,
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

async function getProjectContext(supabase: any, projectId: string): Promise<string> {
  const context: string[] = [];

  try {
    // Get project details (verified fields from schema)
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, project_type, current_phase, start_date, end_date, project_description")
      .eq("id", projectId)
      .single();

    if (projectError) {
      throw new Error(`Project fetch failed: ${projectError.message}`);
    }

    if (project) {
      context.push(`Nome do projeto: ${project.name}`);
      if (project.project_type) context.push(`Tipo: ${project.project_type}`);
      if (project.current_phase) context.push(`Fase atual: ${project.current_phase}`);
      if (project.start_date) context.push(`Data de início: ${project.start_date}`);
      if (project.end_date) context.push(`Data de fim: ${project.end_date}`);
      if (project.project_description) context.push(`Descrição: ${project.project_description}`);
    }
  } catch (error) {
    console.error("Project context error:", error);
    throw error;
  }

  try {
    // Get task summary with ordering for relevance
    // Prioritize pending tasks, especially overdue and upcoming deadlines
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("title, phase, is_done, due_date")
      .eq("project_id", projectId)
      .order("is_done", { ascending: true }) // Pending first
      .order("due_date", { ascending: true, nullsLast: true }) // Overdue/upcoming first
      .limit(50);

    if (tasksError) {
      throw new Error(`Tasks fetch failed: ${tasksError.message}`);
    }

    if (tasks && tasks.length > 0) {
      const pendingTasks = tasks.filter((t: any) => !t.is_done);
      const completedTasks = tasks.filter((t: any) => t.is_done);

      if (pendingTasks.length > 0) {
        const shownPending = pendingTasks.slice(0, 10);
        context.push(`Tarefas pendentes (amostra de ${shownPending.length} tarefas): ${shownPending.map((t: any) => {
          const dueInfo = t.due_date ? ` [vencimento: ${t.due_date}]` : '';
          return `${t.title}${dueInfo}`;
        }).join(', ')}`);
      }
      if (completedTasks.length > 0) {
        const shownCompleted = completedTasks.slice(0, 5);
        context.push(`Tarefas concluídas (amostra de ${shownCompleted.length} tarefas): ${shownCompleted.map((t: any) => t.title).join(', ')}`);
      }
    }
  } catch (error) {
    console.error("Tasks context error:", error);
    throw error;
  }

  return context.length > 0 ? context.join('\n') : 'Sem informações do projeto disponíveis.';
}
