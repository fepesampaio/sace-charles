import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FilterMode = "se" | "mensal" | "quadrimestral" | "anual" | "personalizado";

export interface FilterState {
  mode: FilterMode;
  seIds?: string[];
  ano?: number;
  meses?: number[];
  quadrimestre?: 1 | 2 | 3;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string;    // YYYY-MM-DD
}

export interface SEItem {
  id: string;
  data_inicial: string;
  data_final: string;
  ano: number;
  semana_epidemiologica: string;
  ciclo: number | null;
}

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const pad = (s: string) => s; // already YYYY-MM-DD

export const resolveRange = (
  state: FilterState,
  ses: SEItem[]
): { start: string; end: string } | null => {
  const toISO = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (state.mode === "se" && state.seIds?.length) {
    const sel = ses.filter((s) => state.seIds!.includes(s.id));
    if (!sel.length) return null;
    const start = sel.reduce((a, s) => (s.data_inicial < a ? s.data_inicial : a), sel[0].data_inicial);
    const end = sel.reduce((a, s) => (s.data_final > a ? s.data_final : a), sel[0].data_final);
    return { start, end };
  }
  if (state.mode === "mensal" && state.ano && state.meses?.length) {
    const ms = [...state.meses].sort((a, b) => a - b);
    const mIni = ms[0];
    const mFim = ms[ms.length - 1];
    const lastDay = new Date(state.ano, mFim, 0).getDate();
    return { start: toISO(state.ano, mIni, 1), end: toISO(state.ano, mFim, lastDay) };
  }
  if (state.mode === "quadrimestral" && state.ano && state.quadrimestre) {
    const q = state.quadrimestre;
    const mIni = q === 1 ? 1 : q === 2 ? 5 : 9;
    const mFim = q === 1 ? 4 : q === 2 ? 8 : 12;
    const lastDay = new Date(state.ano, mFim, 0).getDate();
    return { start: toISO(state.ano, mIni, 1), end: toISO(state.ano, mFim, lastDay) };
  }
  if (state.mode === "anual" && state.ano) {
    return { start: toISO(state.ano, 1, 1), end: toISO(state.ano, 12, 31) };
  }
  if (state.mode === "personalizado" && state.dataInicio && state.dataFim) {
    return { start: state.dataInicio, end: state.dataFim };
  }
  return null;
};

export const filterLabel = (state: FilterState, ses: SEItem[]): string => {
  if (state.mode === "se") {
    const sel = ses.filter((s) => state.seIds?.includes(s.id));
    if (!sel.length) return "Selecionar SE";
    if (sel.length === 1) {
      const s = sel[0];
      return `${s.semana_epidemiologica} • ${format(new Date(s.data_inicial+"T00:00:00"), "dd/MM")}–${format(new Date(s.data_final+"T00:00:00"), "dd/MM")}`;
    }
    return `${sel.length} SEs selecionadas`;
  }
  if (state.mode === "mensal") {
    const ms = (state.meses || []).map((m) => MESES[m-1].slice(0,3)).join(", ");
    return `${ms} / ${state.ano}`;
  }
  if (state.mode === "quadrimestral") return `${state.quadrimestre}º Quadrimestre ${state.ano}`;
  if (state.mode === "anual") return `Ano ${state.ano}`;
  if (state.mode === "personalizado" && state.dataInicio && state.dataFim) {
    return `${format(new Date(state.dataInicio+"T00:00:00"),"dd/MM/yy")} – ${format(new Date(state.dataFim+"T00:00:00"),"dd/MM/yy")}`;
  }
  return "Filtrar período";
};

interface Props {
  prefeituraId: string;
  value: FilterState;
  onChange: (v: FilterState, ses: SEItem[]) => void;
  ses: SEItem[];
}

const DashboardFilter = ({ value, onChange, ses }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(value);

  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const anos = useMemo(() => {
    const y = new Date().getFullYear();
    const fromSes = Array.from(new Set(ses.map((s) => s.ano)));
    const set = new Set<number>([y, y-1, y+1, ...fromSes]);
    return Array.from(set).sort((a, b) => b - a);
  }, [ses]);

  const apply = () => {
    onChange(draft, ses);
    setOpen(false);
  };

  const toggleArr = <T,>(arr: T[] | undefined, v: T): T[] => {
    const a = arr || [];
    return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-12">
          <span className="flex items-center gap-2 truncate">
            <CalendarRange className="h-4 w-4 text-primary" />
            <span className="truncate text-sm">{filterLabel(value, ses)}</span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Filtrar período</SheetTitle>
        </SheetHeader>
        <Tabs
          value={draft.mode}
          onValueChange={(m) => setDraft({ mode: m as FilterMode, ano: draft.ano ?? new Date().getFullYear() })}
          className="flex-1 overflow-hidden flex flex-col mt-3"
        >
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="se">SE</TabsTrigger>
            <TabsTrigger value="mensal">Mensal</TabsTrigger>
            <TabsTrigger value="quadrimestral">Quadr.</TabsTrigger>
            <TabsTrigger value="anual">Anual</TabsTrigger>
            <TabsTrigger value="personalizado">Período</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="se" className="m-0 space-y-2">
              {ses.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma SE cadastrada.</p>}
              {ses.map((s) => {
                const checked = draft.seIds?.includes(s.id) ?? false;
                return (
                  <label key={s.id} className="flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer">
                    <Checkbox checked={checked} onCheckedChange={() => setDraft({ ...draft, mode: "se", seIds: toggleArr(draft.seIds, s.id) })} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{s.semana_epidemiologica} • {s.ano}{s.ciclo ? ` • ${s.ciclo}º ciclo` : ""}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(s.data_inicial+"T00:00:00"), "dd/MM/yyyy", { locale: ptBR })} – {format(new Date(s.data_final+"T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </label>
                );
              })}
            </TabsContent>

            <TabsContent value="mensal" className="m-0 space-y-3">
              <div>
                <Label>Ano</Label>
                <Select value={String(draft.ano ?? new Date().getFullYear())} onValueChange={(v) => setDraft({ ...draft, ano: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Meses</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {MESES.map((nome, i) => {
                    const m = i + 1;
                    const checked = draft.meses?.includes(m) ?? false;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDraft({ ...draft, meses: toggleArr(draft.meses, m) })}
                        className={`rounded-md border p-2 text-sm ${checked ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                      >
                        {nome.slice(0,3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quadrimestral" className="m-0 space-y-3">
              <div>
                <Label>Ano</Label>
                <Select value={String(draft.ano ?? new Date().getFullYear())} onValueChange={(v) => setDraft({ ...draft, ano: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quadrimestre</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[1,2,3].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setDraft({ ...draft, quadrimestre: q as 1|2|3 })}
                      className={`rounded-md border p-3 text-sm ${draft.quadrimestre === q ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                    >
                      {q}º
                      <div className="text-xs opacity-80">{q===1?"Jan–Abr":q===2?"Mai–Ago":"Set–Dez"}</div>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="anual" className="m-0 space-y-3">
              <Label>Ano</Label>
              <Select value={String(draft.ano ?? new Date().getFullYear())} onValueChange={(v) => setDraft({ ...draft, ano: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="personalizado" className="m-0 space-y-3">
              <div>
                <Label>Data inicial</Label>
                <Input type="date" value={draft.dataInicio || ""} onChange={(e) => setDraft({ ...draft, dataInicio: e.target.value })} />
              </div>
              <div>
                <Label>Data final</Label>
                <Input type="date" value={draft.dataFim || ""} onChange={(e) => setDraft({ ...draft, dataFim: e.target.value })} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        <SheetFooter className="flex-row gap-2">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1">Cancelar</Button>
          </SheetClose>
          <Button className="flex-1" onClick={apply}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default DashboardFilter;

export const loadSes = async (prefeituraId: string): Promise<SEItem[]> => {
  const { data, error } = await supabase
    .from("semanas_epidemiologicas")
    .select("id, data_inicial, data_final, ano, semana_epidemiologica, ciclo")
    .eq("prefeitura_id", prefeituraId)
    .order("data_inicial", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data as SEItem[]) || [];
};

export const initialFilter = (ses: SEItem[]): FilterState => {
  const today = new Date().toISOString().split("T")[0];
  const cur = ses.filter((s) => s.data_inicial <= today && today <= s.data_final);
  if (cur.length) return { mode: "se", seIds: cur.map((s) => s.id) };
  return { mode: "anual", ano: new Date().getFullYear() };
};