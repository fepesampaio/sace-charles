import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IbgeMunicipio = {
  id: number;
  nome: string;
  microrregiao?: {
    id?: number;
    nome?: string;
    mesorregiao?: {
      id?: number;
      nome?: string;
      UF?: {
        id?: number;
        sigla?: string;
        nome?: string;
        regiao?: {
          id?: number;
          sigla?: string;
          nome?: string;
        };
      };
    };
  };
  ["regiao-imediata"]?: {
    id?: number;
    nome?: string;
    ["regiao-intermediaria"]?: {
      id?: number;
      nome?: string;
    };
  };
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

    const ibgeResponse = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/29/municipios"
    );

    if (!ibgeResponse.ok) {
      throw new Error(`IBGE API error: ${ibgeResponse.status}`);
    }

    const municipios = (await ibgeResponse.json()) as IbgeMunicipio[];
    const payload = municipios.map((municipio) => ({
      ibge_id: municipio.id,
      nome: municipio.nome,
      uf_id: municipio.microrregiao?.mesorregiao?.UF?.id ?? 29,
      uf_sigla: municipio.microrregiao?.mesorregiao?.UF?.sigla ?? "BA",
      uf_nome: municipio.microrregiao?.mesorregiao?.UF?.nome ?? "Bahia",
      regiao_id: municipio.microrregiao?.mesorregiao?.UF?.regiao?.id ?? null,
      regiao_sigla: municipio.microrregiao?.mesorregiao?.UF?.regiao?.sigla ?? null,
      regiao_nome: municipio.microrregiao?.mesorregiao?.UF?.regiao?.nome ?? null,
      mesorregiao_id: municipio.microrregiao?.mesorregiao?.id ?? null,
      mesorregiao_nome: municipio.microrregiao?.mesorregiao?.nome ?? null,
      microrregiao_id: municipio.microrregiao?.id ?? null,
      microrregiao_nome: municipio.microrregiao?.nome ?? null,
      regiao_intermediaria_id:
        municipio["regiao-imediata"]?.["regiao-intermediaria"]?.id ?? null,
      regiao_intermediaria_nome:
        municipio["regiao-imediata"]?.["regiao-intermediaria"]?.nome ?? null,
      regiao_imediata_id: municipio["regiao-imediata"]?.id ?? null,
      regiao_imediata_nome: municipio["regiao-imediata"]?.nome ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await adminClient
      .from("ibge_municipios_bahia")
      .upsert(payload, { onConflict: "ibge_id" });

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: payload.length,
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
