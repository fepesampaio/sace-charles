import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : null;

    let query = adminClient
      .from("prefeituras")
      .select("id, nome, municipio, estado, logo, ativo, ibge_municipio_id")
      .order("municipio");

    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ items: data ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
