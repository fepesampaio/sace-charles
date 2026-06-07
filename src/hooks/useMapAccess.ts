import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, isAgente, isGestor, isSupervisor } from "@/lib/access";

export const useMapAccess = (perfil: string | null | undefined, prefeituraId: string | null | undefined) => {
  const [loading, setLoading] = useState(true);
  const [canAccessMap, setCanAccessMap] = useState(false);

  useEffect(() => {
    const loadAccess = async () => {
      if (isAdmin(perfil) || isGestor(perfil)) {
        setCanAccessMap(true);
        setLoading(false);
        return;
      }

      if (isAgente(perfil) || !isSupervisor(perfil) || !prefeituraId) {
        setCanAccessMap(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("configuracoes_prefeitura")
        .select("exibir_mapa_supervisor")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      if (error) {
        setCanAccessMap(false);
      } else {
        setCanAccessMap(!!data?.exibir_mapa_supervisor);
      }

      setLoading(false);
    };

    void loadAccess();
  }, [perfil, prefeituraId]);

  return { canAccessMap, mapAccessLoading: loading };
};
