import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarPlus, Pencil, Trash2, Loader2, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { getISOWeek, isValid, parseISO } from "date-fns";
import { canManageEpidemiologicalWeeks, isAdmin } from "@/lib/access";

interface SE {
  id: string;
  data_inicial: string;
  data_final: string;
  ano: number;
  semana_epidemiologica: string;
  ciclo: number | null;
}

interface PrefeituraOption {
  id: string;
  nome: string | null;
  municipio: string | null;
}

const formatSE = (d: string) => {
  const date = parseISO(d);

  if (!isValid(date)) {
    return null;
  }

  return {
    ano: date.getFullYear(),
    se: `SE${String(getISOWeek(date)).padStart(2, "0")}`,
  };
};

const SemanasEpidemiologicas = () => {
  const { prefeituraId, user, perfil } = useAuth();
  const userIsAdmin = isAdmin(perfil);
  const canManage = canManageEpidemiologicalWeeks(perfil);

  const [items, setItems] = useState<SE[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SE | null>(null);
  const [saving, setSaving] = useState(false);
  const [prefeituras, setPrefeituras] = useState<PrefeituraOption[]>([]);
  const [selectedPrefeituraId, setSelectedPrefeituraId] = useState<string>(prefeituraId ?? "");

  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [ciclo, setCiclo] = useState<string>("");

  const calc = useMemo(() => (dataInicial ? formatSE(dataInicial) : null), [dataInicial]);
  const effectivePrefeituraId = userIsAdmin ? selectedPrefeituraId : prefeituraId ?? "";

  useEffect(() => {
    if (!userIsAdmin) {
      setSelectedPrefeituraId(prefeituraId ?? "");
    }
  }, [prefeituraId, userIsAdmin]);

  useEffect(() => {
    const loadPrefeituras = async () => {
      if (!userIsAdmin) {
        setPrefeituras([]);
        return;
      }

      const { data, error } = await supabase
        .from("prefeituras")
        .select("id, nome, municipio")
        .order("municipio");

      if (error) {
        console.error(error);
        setPrefeituras([]);
        return;
      }

      setPrefeituras((data as PrefeituraOption[]) || []);
    };

    void loadPrefeituras();
  }, [userIsAdmin]);

  const fetchItems = async () => {
    if (!effectivePrefeituraId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("semanas_epidemiologicas")
      .select("id, data_inicial, data_final, ano, semana_epidemiologica, ciclo")
      .eq("prefeitura_id", effectivePrefeituraId)
      .order("data_inicial", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar semanas epidemiológicas");
    } else {
      setItems((data as SE[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [effectivePrefeituraId]);

  const resetForm = () => {
    setDataInicial("");
    setDataFinal("");
    setCiclo("");
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (s: SE) => {
    setEditing(s);
    setDataInicial(s.data_inicial);
    setDataFinal(s.data_final);
    setCiclo(s.ciclo != null ? String(s.ciclo) : "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicial || !dataFinal) return;
    if (!effectivePrefeituraId) {
      toast.error("Selecione a cidade");
      return;
    }
    if (dataFinal < dataInicial) {
      toast.error("A data final deve ser maior ou igual à data inicial");
      return;
    }

    setSaving(true);
    try {
      const formatted = formatSE(dataInicial);
      if (!formatted) {
        toast.error("Data inicial invalida");
        return;
      }

      const { ano, se } = formatted;
      const cicloNum = ciclo.trim() === "" ? null : parseInt(ciclo, 10);

      if (editing) {
        const { error } = await supabase
          .from("semanas_epidemiologicas")
          .update({
            data_inicial: dataInicial,
            data_final: dataFinal,
            ano,
            semana_epidemiologica: se,
            ciclo: cicloNum,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Semana epidemiológica atualizada!");
      } else {
        const { error } = await supabase.from("semanas_epidemiologicas").insert({
          prefeitura_id: effectivePrefeituraId,
          data_inicial: dataInicial,
          data_final: dataFinal,
          ano,
          semana_epidemiologica: se,
          ciclo: cicloNum,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Semana epidemiológica cadastrada!");
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: SE) => {
    if (!confirm(`Excluir ${s.semana_epidemiologica}/${s.ano}?`)) return;
    const { error } = await supabase.from("semanas_epidemiologicas").delete().eq("id", s.id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Excluída");
      fetchItems();
    }
  };

  const formatDate = (d: string) => {
    const date = parseISO(d);
    return isValid(date) ? date.toLocaleDateString("pt-BR") : d;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Cadastros</p>
          <h1 className="text-lg font-bold">Semanas Epidemiológicas</h1>
        </div>
        {canManage && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            Nova
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-lg p-4 space-y-3">
        {userIsAdmin && (
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Select value={selectedPrefeituraId} onValueChange={setSelectedPrefeituraId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                {prefeituras.map((prefeitura) => (
                  <SelectItem key={prefeitura.id} value={prefeitura.id}>
                    {prefeitura.municipio || prefeitura.nome || prefeitura.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <CalendarRange className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma semana epidemiológica cadastrada.</p>
          </div>
        ) : (
          items.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-primary">{s.semana_epidemiologica}</span>
                  <span className="text-sm text-muted-foreground">/ {s.ano}</span>
                  {s.ciclo != null && (
                    <span className="ml-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      Ciclo {s.ciclo}º
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(s.data_inicial)} → {formatDate(s.data_final)}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {userIsAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(s)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Semana Epidemiológica" : "Nova Semana Epidemiológica"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input value={calc?.ano ?? ""} readOnly disabled className="h-12 bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Semana</Label>
                <Input value={calc?.se ?? ""} readOnly disabled className="h-12 bg-muted" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ciclo (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={ciclo}
                  onChange={(e) => setCiclo(e.target.value)}
                  placeholder="Ex: 6"
                  className="h-12"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {ciclo.trim() ? `${ciclo}º` : "—"}
                </span>
              </div>
            </div>
            <Button type="submit" className="w-full h-12" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default SemanasEpidemiologicas;
