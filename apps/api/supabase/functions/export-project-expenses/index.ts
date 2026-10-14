import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";
import { requireUser } from "../_shared/auth.ts";
import { createUserSupabaseClient } from "../_shared/supabase.ts";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-jwt, apikey",
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

  // Validate request method
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", reason: "Only POST requests are allowed" }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  try {
    // Authenticate user
    const auth = await requireUser(req);
    const { userId, token } = auth;

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const projectId = body.project_id as string;

    // Validate projectId
    if (!projectId || typeof projectId !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_REQUEST", reason: "Missing or invalid project_id" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user token for RLS
    const supabase = createUserSupabaseClient(token);

    // Check user's plan (export is a Pro feature)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Unable to verify user plan" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (profile.plan === "free") {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Expense export requires Pro plan" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to the project by trying to fetch it
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, tenant_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return new Response(
        JSON.stringify({ error: "FORBIDDEN", reason: "Project not found or access denied" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Fetch expenses for the project (RLS will ensure tenant access)
    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select(`
        id,
        title,
        description,
        amount_cents,
        currency,
        category,
        expense_date,
        supplier_name,
        warranty_expires_at,
        created_at
      `)
      .eq("project_id", projectId)
      .order("expense_date", { ascending: false, nullsFirst: false });

    if (expensesError) {
      console.error("Expenses fetch error:", expensesError);
      return new Response(
        JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch expenses" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Despesas");

    // Define columns
    worksheet.columns = [
      { header: "Descrição", key: "description", width: 30 },
      { header: "Fornecedor", key: "supplier", width: 25 },
      { header: "Categoria", key: "category", width: 20 },
      { header: "Data", key: "date", width: 15 },
      { header: "Garantia até", key: "warranty", width: 15 },
      { header: "Valor (€)", key: "amount", width: 15 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Format date function (timezone-safe)
    const formatDate = (date: string | null): string => {
      if (!date) return "";
      const [year, month, day] = date.split("T")[0].split("-");
      return `${day}/${month}/${year}`;
    };

    // Add expense rows
    const expensesList = expenses || [];
    let totalAmount = 0;

    for (const expense of expensesList) {
      const amountEuros = expense.amount_cents / 100;
      totalAmount += amountEuros;

      worksheet.addRow({
        description: expense.description || expense.title || "",
        supplier: expense.supplier_name || "",
        category: expense.category || "",
        date: formatDate(expense.expense_date),
        warranty: formatDate(expense.warranty_expires_at),
        amount: amountEuros,
      });
    }

    // Add total row if there are expenses
    if (expensesList.length > 0) {
      const totalRow = worksheet.addRow({
        description: "TOTAL",
        supplier: "",
        category: "",
        date: "",
        warranty: "",
        amount: totalAmount,
      });

      totalRow.font = { bold: true };
      totalRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }

    // Format amount column as currency
    const amountColumn = worksheet.getColumn("amount");
    amountColumn.numFmt = "€#,##0.00";

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return Excel file
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="despesas-${projectId}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("export-project-expenses error:", err);
    if (err instanceof Response) return err;

    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Unexpected server error" }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  }
});
