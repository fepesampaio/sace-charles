import { useEffect, useMemo, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { isAdmin, isGestor, isSupervisor, normalizeRole } from "@/lib/access";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "leaflet/dist/leaflet.css";

interface Imovel {
  id: string;
  logradouro: string;
  numero: string;
  bairro: string;
  risco: string;
  latitude: number | null;
  longitude: number | null;
}

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

interface VisitPointRow {
  imovelid: string | null;
  prefeituraid: string | null;
  focos: number | null;
}

type MapMode = "points" | "heat";

const riskMeta: Record<string, { label: string; color: string; fill: string }> = {
  baixo: { label: "Baixo", color: "#15803d", fill: "#22c55e" },
  medio: { label: "Medio", color: "#b45309", fill: "#f59e0b" },
  alto: { label: "Alto", color: "#b91c1c", fill: "#ef4444" },
  fechado: { label: "Fechado", color: "#475569", fill: "#94a3b8" },
};

const FALLBACK_CENTER: [number, number] = [-12.9714, -38.5014];

const MapViewport = ({ points, selected }: { points: Imovel[]; selected: Imovel | null }) => {
  const map = useMap();

  useEffect(() => {
    if (selected?.latitude && selected?.longitude) {
      map.flyTo([selected.latitude, selected.longitude], 17, { duration: 0.75 });
      return;
    }

    if (points.length === 0) {
      map.setView(FALLBACK_CENTER, 12);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].latitude!, points[0].longitude!], 16);
      return;
    }

    map.fitBounds(
      points.map((point) => [point.latitude!, point.longitude!] as [number, number]),
      { padding: [32, 32] }
    );
  }, [map, points, selected]);

  return null;
};

const HeatMapLayer = ({ points }: { points: [number, number, number][] }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    const heatLayer = (L as typeof L & {
      heatLayer: (
        latlngs: [number, number, number][],
        options?: {
          radius?: number;
          blur?: number;
          maxZoom?: number;
          minOpacity?: number;
          gradient?: Record<number, string>;
        }
      ) => L.Layer;
    }).heatLayer(points, {
      radius: 30,
      blur: 22,
      maxZoom: 17,
      minOpacity: 0.35,
      gradient: {
        0.15: "#22c55e",
        0.45: "#f59e0b",
        0.8: "#ef4444",
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

const MapPage = () => {
  const { user, perfil, prefeituraId, userProfile } = useAuth();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [visitPoints, setVisitPoints] = useState<VisitPointRow[]>([]);
  const [cityOptions, setCityOptions] = useState<PrefeituraOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Imovel | null>(null);
  const [selectedPrefeituraId, setSelectedPrefeituraId] = useState<string>(prefeituraId ?? "all");
  const [mapMode, setMapMode] = useState<MapMode>("points");

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
    const fetchImoveis = async () => {
      if (!user || !userProfile) {
        setImoveis([]);
        setVisitPoints([]);
        setCityOptions([]);
        setLoading(false);
        return;
      }

      let usersQuery = supabase
        .from("usuarios")
        .select("id, perfil, prefeituraid, regiao, setor, gestor_id, supervisor_id");

      if (!isAdmin(perfil) && prefeituraId) {
        usersQuery = usersQuery.eq("prefeituraid", prefeituraId);
      }

      const { data: usersData, error: usersError } = await usersQuery;
      if (usersError || !usersData) {
        console.error(usersError);
        setImoveis([]);
        setVisitPoints([]);
        setLoading(false);
        return;
      }

      const rows = (usersData as ScopedUserRow[]) ?? [];
      let scopedAgentIds: string[] = [];

      if (normalizeRole(perfil) === "agente") {
        scopedAgentIds = [user.id];
      } else if (isAdmin(perfil)) {
        scopedAgentIds = rows
          .filter((row) => normalizeRole(row.perfil) === "agente")
          .map((row) => row.id);
      } else if (isGestor(perfil)) {
        const supervisorIds = rows
          .filter((row) => normalizeRole(row.perfil) === "supervisor" && row.gestor_id === user.id)
          .map((row) => row.id);
        scopedAgentIds = rows
          .filter(
            (row) =>
              normalizeRole(row.perfil) === "agente" &&
              (row.gestor_id === user.id || (row.supervisor_id ? supervisorIds.includes(row.supervisor_id) : false))
          )
          .map((row) => row.id);
      } else if (isSupervisor(perfil)) {
        scopedAgentIds = rows
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
          .map((row) => row.id);
      }

      if (scopedAgentIds.length === 0) {
        setImoveis([]);
        setVisitPoints([]);
        setCityOptions([]);
        setLoading(false);
        return;
      }

      let visitsQuery = supabase
        .from("visitas")
        .select("imovelid, prefeituraid, focos")
        .in("agenteid", scopedAgentIds);

      if (!isAdmin(perfil) && prefeituraId) {
        visitsQuery = visitsQuery.eq("prefeituraid", prefeituraId);
      }

      const { data: visitsData, error: visitsError } = await visitsQuery;
      if (visitsError || !visitsData) {
        console.error(visitsError);
        setImoveis([]);
        setVisitPoints([]);
        setCityOptions([]);
        setLoading(false);
        return;
      }

      const scopedVisits = (visitsData as VisitPointRow[]) ?? [];
      const prefeituraIds = [...new Set(scopedVisits.map((visit) => visit.prefeituraid).filter(Boolean))];

      if (prefeituraIds.length > 0) {
        const { data: prefeiturasData, error: prefeiturasError } = await supabase
          .from("prefeituras")
          .select("id, nome, municipio")
          .in("id", prefeituraIds)
          .order("municipio");

        if (prefeiturasError) {
          console.error(prefeiturasError);
          setCityOptions([]);
        } else {
          setCityOptions((prefeiturasData as PrefeituraOption[]) || []);
        }
      } else {
        setCityOptions([]);
      }

      let effectivePrefeituraId = selectedPrefeituraId;

      if (!isAdmin(perfil) && prefeituraId) {
        effectivePrefeituraId = prefeituraId;
      } else if (
        effectivePrefeituraId !== "all" &&
        effectivePrefeituraId &&
        !prefeituraIds.includes(effectivePrefeituraId)
      ) {
        effectivePrefeituraId = "all";
      }

      if (effectivePrefeituraId !== selectedPrefeituraId) {
        setSelectedPrefeituraId(effectivePrefeituraId);
      }

      const filteredVisits =
        effectivePrefeituraId && effectivePrefeituraId !== "all"
          ? scopedVisits.filter((visit) => visit.prefeituraid === effectivePrefeituraId)
          : scopedVisits;

      setVisitPoints(filteredVisits);

      const imovelIds = [...new Set(filteredVisits.map((visit) => visit.imovelid).filter(Boolean))];
      if (imovelIds.length === 0) {
        setImoveis([]);
        setVisitPoints([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("imoveis")
        .select("id, logradouro, numero, bairro, risco, latitude, longitude")
        .in("id", imovelIds);

      if (!error) {
        setImoveis((data as Imovel[]) || []);
      } else {
        console.error(error);
        setImoveis([]);
        setVisitPoints([]);
      }

      setLoading(false);
    };

    void fetchImoveis();
  }, [perfil, prefeituraId, selectedPrefeituraId, user, userProfile]);

  const withCoords = useMemo(
    () =>
      imoveis.filter(
        (item): item is Imovel & { latitude: number; longitude: number } =>
          item.latitude !== null && item.longitude !== null
      ),
    [imoveis]
  );

  const stats = useMemo(
    () => ({
      total: withCoords.length,
      alto: withCoords.filter((item) => item.risco === "alto").length,
      medio: withCoords.filter((item) => item.risco === "medio").length,
      baixo: withCoords.filter((item) => item.risco === "baixo").length,
    }),
    [withCoords]
  );

  const heatPoints = useMemo(() => {
    const weightsByImovel = new Map<string, number>();

    for (const visit of visitPoints) {
      if (!visit.imovelid) continue;
      const currentWeight = weightsByImovel.get(visit.imovelid) ?? 0;
      const visitWeight = Math.max(1, Number(visit.focos ?? 0) + 1);
      weightsByImovel.set(visit.imovelid, currentWeight + visitWeight);
    }

    const weightedPoints: [number, number, number][] = [];

    for (const imovel of withCoords) {
      const riskWeight = imovel.risco === "alto" ? 3 : imovel.risco === "medio" ? 2 : 1;
      const weight = (weightsByImovel.get(imovel.id) ?? 1) + riskWeight;
      weightedPoints.push([imovel.latitude, imovel.longitude, weight]);
    }

    return weightedPoints;
  }, [visitPoints, withCoords]);

  const cityFilterDisabled = !isAdmin(perfil) || cityOptions.length <= 1;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-card px-4 py-3">
        <h1 className="text-lg font-bold">Mapa de Risco</h1>
        <p className="text-xs text-muted-foreground">{withCoords.length} localizacoes disponiveis</p>
        {cityOptions.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="max-w-sm flex-1 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Cidade</p>
              <Select value={selectedPrefeituraId} onValueChange={setSelectedPrefeituraId} disabled={cityFilterDisabled}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue placeholder="Selecione a cidade" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin(perfil) && cityOptions.length > 1 && (
                    <SelectItem value="all">Todas as cidades</SelectItem>
                  )}
                  {cityOptions.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.municipio || city.nome || "Sem cidade"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Visualizacao</p>
              <div className="inline-flex rounded-xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setMapMode("points")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    mapMode === "points" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  Pontos
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode("heat")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    mapMode === "heat" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  Calor
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : withCoords.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Nenhuma visita com coordenadas</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Salve visitas com geolocalizacao para exibir os pontos de risco no mapa.
          </p>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pontos</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Alto risco</p>
              <p className="mt-1 text-2xl font-bold text-destructive">{stats.alto}</p>
            </div>
            <div className="rounded-xl border border-warning/20 bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Medio risco</p>
              <p className="mt-1 text-2xl font-bold text-warning">{stats.medio}</p>
            </div>
            <div className="rounded-xl border border-success/20 bg-card p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Baixo risco</p>
              <p className="mt-1 text-2xl font-bold text-success">{stats.baixo}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <MapContainer
                center={withCoords[0] ? [withCoords[0].latitude, withCoords[0].longitude] : FALLBACK_CENTER}
                zoom={15}
                scrollWheelZoom
                className="h-[58vh] min-h-[420px] w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapViewport points={withCoords} selected={selected} />
                {mapMode === "heat" ? (
                  <HeatMapLayer points={heatPoints} />
                ) : (
                  withCoords.map((imovel) => {
                    const meta = riskMeta[imovel.risco] ?? riskMeta.fechado;
                    return (
                      <CircleMarker
                        key={imovel.id}
                        center={[imovel.latitude, imovel.longitude]}
                        radius={selected?.id === imovel.id ? 13 : 10}
                        pathOptions={{
                          color: meta.color,
                          fillColor: meta.fill,
                          fillOpacity: 0.85,
                          weight: selected?.id === imovel.id ? 4 : 2,
                        }}
                        eventHandlers={{
                          click: () => setSelected(imovel),
                        }}
                      >
                        <Popup>
                          <div className="space-y-1">
                            <p className="font-semibold">
                              {imovel.logradouro}, {imovel.numero}
                            </p>
                            <p className="text-xs text-slate-600">{imovel.bairro}</p>
                            <p className="text-xs">
                              Risco: <span className="font-semibold">{meta.label}</span>
                            </p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    );
                  })
                )}
              </MapContainer>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {mapMode === "heat" ? "Intensidade" : "Legenda"}
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  {mapMode === "heat" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-[#22c55e]" />
                        <span>Baixa concentracao</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-[#f59e0b]" />
                        <span>Media concentracao</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-[#ef4444]" />
                        <span>Alta concentracao</span>
                      </div>
                    </>
                  ) : (
                    Object.entries(riskMeta).map(([key, meta]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: meta.fill, border: `2px solid ${meta.color}` }}
                        />
                        <span>{meta.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-2">
                <div className="max-h-[340px] space-y-2 overflow-auto">
                  {withCoords.map((imovel) => {
                    const meta = riskMeta[imovel.risco] ?? riskMeta.fechado;
                    const active = selected?.id === imovel.id;

                    return (
                      <button
                        key={imovel.id}
                        onClick={() => setSelected(imovel)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-card hover:bg-muted"
                        }`}
                      >
                        <span
                          className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.fill, border: `2px solid ${meta.color}` }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {imovel.logradouro}, {imovel.numero}
                          </p>
                          <p className="text-xs text-muted-foreground">{imovel.bairro}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {imovel.latitude.toFixed(5)}, {imovel.longitude.toFixed(5)}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <BottomNav />
    </div>
  );
};

export default MapPage;
