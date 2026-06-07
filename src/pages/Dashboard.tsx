import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Home,
  Loader2,
  Menu,
  MapPin,
  Plus,
  Users,
  CalendarRange,
  Settings,
  Lock,
  LogOut,
  Building2,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/StatCard";
import { type Visit } from "@/components/VisitCard";
import BottomNav from "@/components/BottomNav";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import DashboardFilter, { type FilterState, type SEItem, loadSes, initialFilter, resolveRange } from "@/components/DashboardFilter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  canManageEpidemiologicalWeeks,
  canManageMunicipalConfig,
  canManageMunicipalities,
  canManageUsers,
  isAdmin,
  isGestor,
  isSupervisor,
  normalizeRole,
} from "@/lib/access";

interface ScopedUserRow {
  id: string;
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

const Dashboard = () => {
  const { user, prefeituraId, perfil, userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [ses, setSes] = useState<SEItem[]>([]);
  const [filter, setFilter] = useState<FilterState | null>(null);
  const [scopedAgentIds, setScopedAgentIds] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<PrefeituraOption[]>([]);
  const [selectedPrefeituraId, setSelectedPrefeituraId] = useState<string>(prefeituraId ?? "all");

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const dashboardTitle = useMemo(() => {
    if (isAdmin(perfil)) return "Painel Administrativo";
    if (isGestor(perfil)) return "Painel do Gestor";
    if (isSupervisor(perfil)) return "Painel do Supervisor";
    return "Painel do Agente";
  }, [perfil]);

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
      setFilter(null);
      return;
    }

    void loadSes(targetPrefeituraId).then((items) => {
      setSes(items);
      setFilter((current) => current ?? initialFilter(items));
    });
  }, [perfil, prefeituraId, selectedPrefeituraId]);

  useEffect(() => {
    const loadScopedAgents = async () => {
      if (!user || !userProfile) {
        setScopedAgentIds([]);
        return;
      }

      if (normalizeRole(perfil) === "agente") {
        setScopedAgentIds([user.id]);
        return;
      }

      let query = supabase
        .from("usuarios")
        .select("id, perfil, prefeituraid, regiao, setor, gestor_id, supervisor_id");

      if (!isAdmin(perfil) && prefeituraId) {
        query = query.eq("prefeituraid", prefeituraId);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.error("Error loading scoped agents:", error);
        setScopedAgentIds([]);
        return;
      }

      const rows = (data as ScopedUserRow[]) ?? [];

      if (isAdmin(perfil)) {
        setScopedAgentIds(
          rows
            .filter(
              (row) =>
                normalizeRole(row.perfil) === "agente" &&
                (selectedPrefeituraId === "all" || row.prefeituraid === selectedPrefeituraId)
            )
            .map((row) => row.id)
        );
        return;
      }

      if (isGestor(perfil)) {
        setScopedAgentIds(
          rows
            .filter(
              (row) =>
                normalizeRole(row.perfil) === "agente"
            )
            .map((row) => row.id)
        );
        return;
      }

      if (isSupervisor(perfil)) {
        setScopedAgentIds(
          rows
            .filter(
              (row) =>
                normalizeRole(row.perfil) === "agente" &&
                (
                  row.supervisor_id === user.id ||
                  (
                    userProfile.regiao !== null &&
                    row.regiao === userProfile.regiao &&
                    userProfile.setor !== null &&
                    row.setor === userProfile.setor
                  )
                )
            )
            .map((row) => row.id)
        );
        return;
      }

      setScopedAgentIds([]);
    };

    void loadScopedAgents();
  }, [prefeituraId, perfil, selectedPrefeituraId, user, userProfile]);

  useEffect(() => {
    const fetchVisits = async () => {
      if (!user || !filter) return;
      if (scopedAgentIds.length === 0) {
        setVisits([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const range = resolveRange(filter, ses);
      if (!range) {
        setVisits([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from("visitas")
        .select(`
          id,
          datahora,
          resultado,
          focos,
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
      } else {
        const mapped: Visit[] = (data || []).map((visit: any) => ({
          id: visit.id,
          address: visit.imoveis?.logradouro || "Sem endereco",
          number: visit.imoveis?.numero || "S/N",
          neighborhood: visit.imoveis?.bairro || "",
          status:
            visit.focos > 0
              ? "foco"
              : visit.resultado === "concluida"
                ? "visitado"
                : visit.resultado === "fechada"
                  ? "fechada"
                  : "pendente",
          time: visit.datahora
            ? new Date(visit.datahora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : undefined,
        }));
        setVisits(mapped);
      }

      setLoading(false);
    };

    void fetchVisits();
  }, [filter, perfil, prefeituraId, scopedAgentIds, selectedPrefeituraId, ses, user]);

  const pending = visits.filter((visit) => visit.status === "pendente").length;
  const visited = visits.filter((visit) => visit.status === "visitado").length;
  const focos = visits.filter((visit) => visit.status === "foco").length;
  const completionRate = visits.length > 0 ? Math.round((visited / visits.length) * 100) : 0;
  const focusRate = visits.length > 0 ? Math.round((focos / visits.length) * 100) : 0;

  const menuItems = [
    { label: "Painel", icon: ClipboardList, path: "/dashboard" },
    { label: "Nova Visita", icon: Plus, path: "/nova-visita" },
    { label: "Mapa", icon: MapPin, path: "/mapa" },
    ...(canManageUsers(perfil) ? [{ label: "Usuarios", icon: Users, path: "/usuarios" }] : []),
    ...(canManageEpidemiologicalWeeks(perfil)
      ? [{ label: "Semanas Epidemiologicas", icon: CalendarRange, path: "/semanas-epidemiologicas" }]
      : []),
    ...(canManageMunicipalConfig(perfil) ? [{ label: "Configuracoes", icon: Settings, path: "/configuracoes" }] : []),
    ...(canManageMunicipalities(perfil) ? [{ label: "Cidades", icon: Building2, path: "/prefeituras" }] : []),
    { label: "Alterar Senha", icon: Lock, path: "/alterar-senha" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Sheet>
          <SheetTrigger asChild>
            <button
              aria-label="Abrir menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground active:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border px-4 py-4">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SheetClose asChild key={item.path}>
                    <button
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      {item.label}
                    </button>
                  </SheetClose>
                );
              })}
              <SheetClose asChild>
                <button
                  onClick={async () => {
                    await signOut();
                    navigate("/login", { replace: true });
                  }}
                  className="mt-2 flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex-1">
          <p className="text-xs font-medium capitalize text-muted-foreground">{today}</p>
          <h1 className="text-lg font-bold">{dashboardTitle}</h1>
        </div>
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
          <StatCard label="Total de Visitas" value={visits.length} icon={<ClipboardList className="h-5 w-5" />} />
          <StatCard label="Concluidas" value={visited} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" />
          <StatCard label="Pendentes" value={pending} icon={<Home className="h-5 w-5" />} variant="warning" />
          <StatCard label="Focos" value={focos} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumo do Periodo
                </h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Taxa de conclusao</p>
                  <p className="mt-1 text-2xl font-bold">{completionRate}%</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Taxa de focos</p>
                  <p className="mt-1 text-2xl font-bold">{focusRate}%</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  {visits.length === 0
                    ? "Nao ha visitas no periodo selecionado."
                    : `${visits.length} visitas encontradas no periodo filtrado.`}
                </p>
                <p>
                  {visited} concluidas, {pending} pendentes e {focos} com foco registrado.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Proximo Passo
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Use a tela de Visitas para consultar a listagem detalhada e abrir cada registro.
              </p>
              <button
                onClick={() => navigate("/resumo")}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Abrir Visitas
              </button>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
