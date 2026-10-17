import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { jwtVerify } from "https://esm.sh/jose@5.1.0";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(),
    });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", reason: "Only GET requests are allowed" }),
      { status: 405, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const projectId = url.searchParams.get("project_id");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "MISSING_TOKEN", reason: "Export token is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: "MISSING_PROJECT_ID", reason: "project_id is required" }),
        { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const exportJwtSecret = getEnv("EXPORT_JWT_SECRET");

    const { payload } = await jwtVerify(token, new TextEncoder().encode(exportJwtSecret), {
      issuer: "visao-clara-edge",
      audience: "visao-clara-worker",
    });

    if (payload.scope !== "full_export" && payload.scope !== "expenses_export") {
      return new Response(
        JSON.stringify({ error: "INVALID_SCOPE", reason: "Invalid token scope" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    if (payload.project_id !== projectId) {
      return new Response(
        JSON.stringify({ error: "PROJECT_MISMATCH", reason: "Token project_id does not match request" }),
        { status: 403, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = getEnv("VC_SUPABASE_URL");
    const supabaseServiceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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
      .eq("tenant_id", payload.tenant_id)
      .order("expense_date", { ascending: false, nullsFirst: false });

    if (expensesError) {
      console.error("Expenses fetch error:", expensesError);
      return new Response(
        JSON.stringify({ error: "INTERNAL_ERROR", reason: "Failed to fetch expenses" }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Despesas");

    worksheet.columns = [
      { header: "Descrição", key: "description", width: 30 },
      { header: "Fornecedor", key: "supplier", width: 25 },
      { header: "Categoria", key: "category", width: 20 },
      { header: "Data", key: "date", width: 15 },
      { header: "Garantia até", key: "warranty", width: 15 },
      { header: "Valor (€)", key: "amount", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    const formatDate = (date: string | null): string => {
      if (!date) return "";
      const [year, month, day] = date.split("T")[0].split("-");
      return `${day}/${month}/${year}`;
    };

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

    const amountColumn = worksheet.getColumn("amount");
    amountColumn.numFmt = "€#,##0.00";

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err) {
    console.error("get-project-expenses-xlsx error:", err);

    if (err instanceof Error) {
      if (err.message.includes("JWT") || err.message.includes("token")) {
        return new Response(
          JSON.stringify({ error: "INVALID_TOKEN", reason: err.message }),
          { status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", reason: "Unexpected server error" }),
      {
        status: 500,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      },
    );
  }
});
