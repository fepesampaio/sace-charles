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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));

    const { data: usuarioRow, error: usuarioError } = await adminClient
      .from("usuarios")
      .select("id, email, perfil, prefeituraid")
      .eq("id", user.id)
      .maybeSingle();

    if (usuarioError) {
      throw usuarioError;
    }

    const { data: usuarioByEmail, error: usuarioByEmailError } = await adminClient
      .from("usuarios")
      .select("id, email, perfil, prefeituraid")
      .eq("email", user.email ?? "")
      .maybeSingle();

    if (usuarioByEmailError) {
      throw usuarioByEmailError;
    }

    return new Response(
      JSON.stringify({
        auth_uid: user.id,
        auth_email: user.email ?? null,
        usuario: usuarioRow ?? null,
        usuario_by_email: usuarioByEmail ?? null,
        target_prefeitura_id: body.prefeitura_id ?? null,
        can_insert_guess:
          !!(usuarioRow ?? usuarioByEmail) &&
          (
            (usuarioRow ?? usuarioByEmail).perfil === "admin" ||
            (usuarioRow ?? usuarioByEmail).perfil === "administrador" ||
            (
              (usuarioRow ?? usuarioByEmail).perfil === "gestor" &&
              (usuarioRow ?? usuarioByEmail).prefeituraid === (body.prefeitura_id ?? null)
            )
          ),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
