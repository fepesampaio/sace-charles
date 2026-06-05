import { useEffect, useMemo, useState } from "react";
import { ClipboardList, CheckCircle2, AlertTriangle, Home, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/StatCard";
import VisitCard, { type Visit } from "@/components/VisitCard";
import BottomNav from "@/components/BottomNav";
import DashboardFilter, {
  type FilterState,
  type SEItem,
  initialFilter,
  loadSes,
  resolveRange,
} from "@/components/DashboardFilter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isAdmin, isGestor, isSupervisor, normalizeRole } from "@/lib/access";

interface ScopedUserRow {
  id: string;
  nome: string | null;
  perfil: string | null;
  prefeituraid: string | null;
  regiao: string | null;
  setor: string | null;
  gestor_id: string | null;
  supervisor_id: string | null;
}

interface PrefeituraOption {
  id: string;
  nome: string | null;
  municipio: string | null;
}

interface VisitRow {
  id: string;
  datahora: string | null;
  resultado: string | null;
  focos: number | null;
  prefeituraid: string | null;
  agenteid: string | null;
  imoveis: {
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    risco: string | null;
  } | null;
}

const Summary = () => {
  const { user, prefeituraId, perfil, userProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [ses, setSes] = useState<SEItem[]>([]);
  const [filter, setFilter] = useState<FilterState | null>(null);
  const [cityOptions, setCityOptions] = useState<PrefeituraOption[]>([]);
  const [selectedPrefeituraId, setSelectedPrefeituraId] = useState<string>(prefeituraId ?? "all");
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [accessibleRows, setAccessibleRows] = useState<ScopedUserRow[]>([]);

  useEffect(() => {
    const loadCityOptions = async () => {
      if (!user) {
        setCityOptions([]);
        return;
      }

      if (isAdmin(perfil)) {
        const { data, error } = await supabase
          .from("prefeituras")
          .select("id, nome, municipio")
          .order("municipio");

        if (error) {
          console.error("Error loading city options:", error);
          setCityOptions([]);
          return;
        }

        setCityOptions((data as PrefeituraOption[]) || []);
        return;
      }

      if (!prefeituraId) {
        setCityOptions([]);
        return;
      }

      const { data, error } = await supabase
        .from("prefeituras")
        .select("id, nome, municipio")
        .eq("id", prefeituraId)
        .order("municipio");

      if (error) {
        console.error("Error loading city options:", error);
        setCityOptions([]);
        return;
      }

      setCityOptions((data as PrefeituraOption[]) || []);
    };

    void loadCityOptions();
  }, [perfil, prefeituraId, user]);

  useEffect(() => {
    if (!isAdmin(perfil) && prefeituraId) {
      setSelectedPrefeituraId(prefeituraId);
      return;
    }

    if (isAdmin(perfil) && !selectedPrefeituraId) {
      setSelectedPrefeituraId("all");
    }
  }, [perfil, prefeituraId, selectedPrefeituraId]);

  useEffect(() => {
    const targetPrefeituraId =
      isAdmin(perfil) && selectedPrefeituraId !== "all" ? selectedPrefeituraId : prefeituraId;

    if (!targetPrefeituraId) {
      setSes([]);
      setFilter({ mode: "anual", ano: new Date().getFullYear() });
      return;
    }

    void loadSes(targetPrefeituraId).then((items) => {
      setSes(items);
      setFilter((current) => current ?? initialFilter(items));
    });
  }, [perfil, prefeituraId, selectedPrefeituraId]);

  useEffect(() => {
    const loadScope = async () => {
      if (!user || !userProfile) {
        setAccessibleRows([]);
        return;
      }

      let query = supabase
        .from("usuarios")
        .select("id, nome, perfil, prefeituraid, regiao, setor, gestor_id, supervisor_id");

      if (!isAdmin(perfil) && prefeituraId) {
        query = query.eq("prefeituraid", prefeituraId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.error("Error loading user scope:", error);
        setAccessibleRows([]);
        return;
      }

      const rows = (data as ScopedUserRow[]) ?? [];
      setAccessibleRows(rows);

      if (isAdmin(perfil)) {
        return;
      }
    };

    void loadScope();
  }, [perfil, prefeituraId, user, userProfile]);

  const targetRows = useMemo(() => {
    if (!isAdmin(perfil) || selectedPrefeituraId === "all") {
      return accessibleRows;
    }

    return accessibleRows.filter((row) => row.prefeituraid === selectedPrefeituraId);
  }, [accessibleRows, perfil, selectedPrefeituraId]);

  const regionOptions = useMemo(
    () =>
      [...new Set(targetRows.map((row) => row.regiao).filter((value): value is string => Boolean(value)))]
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [targetRows]
  );

  useEffect(() => {
    if (selectedRegion !== "all" && !regionOptions.includes(selectedRegion)) {
      setSelectedRegion("all");
    }
  }, [regionOptions, selectedRegion]);

  useEffect(() => {
    const fetchVisits = async () => {
      if (!user || !userProfile || !filter) {
        setLoading(false);
        return;
      }

      let scopedAgentIds: string[] = [];

      if (normalizeRole(perfil) === "agente") {
        scopedAgentIds = [user.id];
      } else if (isAdmin(perfil)) {
        scopedAgentIds = targetRows
          .filter(
            (row) =>
              normalizeRole(row.perfil) === "agente" &&
              (selectedRegion === "all" || row.regiao === selectedRegion)
          )
          .map((row) => row.id);
      } else if (isGestor(perfil)) {
        const supervisorIds = targetRows
          .filter((row) => normalizeRole(row.perfil) === "supervisor" && row.gestor_id === user.id)
          .map((row) => row.id);

        scopedAgentIds = targetRows
          .filter(
            (row) =>
              normalizeRole(row.perfil) === "agente" &&
              (row.gestor_id === user.id ||
                (row.supervisor_id ? supervisorIds.includes(row.supervisor_id) : false)) &&
              (selectedRegion === "all" || row.regiao === selectedRegion)
          )
          .map((row) => row.id);
      } else if (isSupervisor(perfil)) {
        scopedAgentIds = targetRows
          .filter(
            (row) =>
              normalizeRole(row.perfil) === "agente" &&
              (row.supervisor_id === user.id ||
                (userProfile.regiao !== null &&
                  row.regiao === userProfile.regiao &&
                  userProfile.setor !== null &&
                  row.setor === userProfile.setor)) &&
              (selectedRegion === "all" || row.regiao === selectedRegion)
          )
          .map((row) => row.id);
      }

      if (scopedAgentIds.length === 0) {
        setVisits([]);
        setLoading(false);
        return;
      }

      const range = resolveRange(filter, ses);
      if (!range) {
        setVisits([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      let query = supabase
        .from("visitas")
        .select(`
          id,
          datahora,
          resultado,
          focos,
          prefeituraid,
          agenteid,
          imoveis (
            logradouro,
            numero,
            bairro,
            risco
          )
        `)
        .in("agenteid", scopedAgentIds)
        .gte("datahora", `${range.start}T00:00:00`)
        .lte("datahora", `${range.end}T23:59:59`)
        .order("datahora", { ascending: false });

      if (!isAdmin(perfil) && prefeituraId) {
        query = query.eq("prefeituraid", prefeituraId);
      } else if (selectedPrefeituraId !== "all") {
        query = query.eq("prefeituraid", selectedPrefeituraId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching visits:", error);
        setVisits([]);
        setLoading(false);
        return;
      }

      const municipalityById = new Map(
        cityOptions.map((city) => [city.id, city.municipio || city.nome || "Sem cidade"])
      );
      const regionByAgentId = new Map(targetRows.map((row) => [row.id, row.regiao || "Sem regiao"]));

      const mapped: Visit[] = ((data as VisitRow[]) || []).map((visit) => {
        const cityLabel = visit.prefeituraid ? municipalityById.get(visit.prefeituraid) : null;
        const regionLabel = visit.agenteid ? regionByAgentId.get(visit.agenteid) : null;
        const detailSuffix = [visit.imoveis?.bairro, cityLabel, regionLabel].filter(Boolean).join(" • ");

        return {
          id: visit.id,
          address: visit.imoveis?.logradouro || "Sem endereco",
          number: visit.imoveis?.numero || "S/N",
          neighborhood: detailSuffix || "Sem detalhes",
          status:
            (visit.focos ?? 0) > 0
              ? "foco"
              : visit.resultado === "concluida"
                ? "visitado"
                : visit.resultado === "fechada"
                  ? "fechada"
                  : "pendente",
          time: visit.datahora
            ? new Date(visit.datahora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
        };
      });

      setVisits(mapped);
      setLoading(false);
    };

    void fetchVisits();
  }, [
    cityOptions,
    filter,
    perfil,
    prefeituraId,
    selectedPrefeituraId,
    selectedRegion,
    ses,
    targetRows,
    user,
    userProfile,
  ]);

  const stats = useMemo(
    () => ({
      total: visits.length,
      visitadas: visits.filter((visit) => visit.status === "visitado").length,
      focos: visits.filter((visit) => visit.status === "foco").length,
      pendentes: visits.filter((visit) => visit.status === "pendente").length,
    }),
    [visits]
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-card px-4 py-3">
        <h1 className="text-lg font-bold">Visitas</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-4">
        {isAdmin(perfil) && (
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Select value={selectedPrefeituraId} onValueChange={setSelectedPrefeituraId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as cidades</SelectItem>
                {cityOptions.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.municipio || city.nome || "Sem cidade"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {regionOptions.length > 0 && (
          <div className="space-y-2">
            <Label>Regiao</Label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione a regiao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as regioes</SelectItem>
                {regionOptions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {filter && (
          <DashboardFilter
            prefeituraId={
              isAdmin(perfil) && selectedPrefeituraId !== "all"
                ? selectedPrefeituraId
                : prefeituraId ?? ""
            }
            value={filter}
            ses={ses}
            onChange={(value) => setFilter(value)}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total de Visitas" value={stats.total} icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard
            label="Concluidas"
            value={stats.visitadas}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
          />
          <StatCard
            label="Pendentes"
            value={stats.pendentes}
            icon={<Home className="h-5 w-5" />}
            variant="warning"
          />
          <StatCard
            label="Focos"
            value={stats.focos}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="destructive"
          />
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Lista de Visitas
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visits.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma visita encontrada para os filtros atuais.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  onClick={normalizeRole(perfil) === "agente" ? () => navigate(`/visitas/${visit.id}/editar`) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

export default Summary;
