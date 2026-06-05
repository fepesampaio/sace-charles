import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeRole = (value: string | null | undefined) => {
  if (!value) return null;
  if (value === "administrador") return "admin";
  if (value === "auxiliar") return "agente";
  return value;
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
      data: { user: callerUser },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerData } = await adminClient
      .from("usuarios")
      .select("perfil")
      .eq("id", callerUser.id)
      .single();

    if (normalizeRole(callerData?.perfil) !== "admin") {
      return new Response(JSON.stringify({ error: "Sem permissao" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: usuariosData, error: usuariosError } = await adminClient
      .from("usuarios")
      .select("id, nome, email, perfil, prefeituraid, ativo")
      .order("nome");

    if (usuariosError) {
      throw usuariosError;
    }

    const authUsers: Array<{ id: string; email: string | null }> = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      const users = data.users ?? [];
      authUsers.push(...users.map((user) => ({ id: user.id, email: user.email ?? null })));

      if (users.length < perPage) {
        break;
      }

      page += 1;
    }

    const authByEmail = new Map(
      authUsers
        .filter((user) => user.email)
        .map((user) => [user.email!.trim().toLowerCase(), user])
    );

    const usuarioIssues = (usuariosData ?? []).flatMap((usuario) => {
      const normalizedEmail = usuario.email?.trim().toLowerCase();

      if (!normalizedEmail) {
        return [
          {
            type: "missing_email",
            id: usuario.id,
            email: usuario.email,
            nome: usuario.nome,
            perfil: usuario.perfil,
          },
        ];
      }

      const authUser = authByEmail.get(normalizedEmail);

      if (!authUser) {
        return [
          {
            type: "missing_in_auth",
            id: usuario.id,
            email: usuario.email,
            nome: usuario.nome,
            perfil: usuario.perfil,
          },
        ];
      }

      if (authUser.id !== usuario.id) {
        return [
          {
            type: "id_mismatch",
            id: usuario.id,
            auth_id: authUser.id,
            email: usuario.email,
            nome: usuario.nome,
            perfil: usuario.perfil,
          },
        ];
      }

      return [];
    });

    return new Response(
      JSON.stringify({
        issues: usuarioIssues,
        total_usuarios: usuariosData?.length ?? 0,
        total_auth_users: authUsers.length,
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
