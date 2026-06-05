import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Building2, Check, ChevronsUpDown, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { canManageMunicipalities } from "@/lib/access";
import { cn } from "@/lib/utils";

interface Prefeitura {
  id: string;
  nome: string | null;
  municipio: string | null;
  estado: string | null;
  logo: string | null;
  ativo: boolean | null;
  ibge_municipio_id: number | null;
}

interface IbgeMunicipioBahia {
  ibge_id: number;
  nome: string;
  uf_sigla: string;
}

const PrefeiturasManagement = () => {
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const [items, setItems] = useState<Prefeitura[]>([]);
  const [ibgeItems, setIbgeItems] = useState<IbgeMunicipioBahia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prefeitura | null>(null);
  const [saving, setSaving] = useState(false);
  const [municipioPickerOpen, setMunicipioPickerOpen] = useState(false);

  const [nome, setNome] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [logo, setLogo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [selectedIbgeMunicipioId, setSelectedIbgeMunicipioId] = useState<string>("");
  const [codigoMunicipio, setCodigoMunicipio] = useState("");

  const canManage = canManageMunicipalities(perfil);

  const fetchIbgeMunicipios = async () => {
    const { data, error } = await supabase
      .from("ibge_municipios_bahia")
      .select("ibge_id, nome, uf_sigla")
      .order("nome");

    if (error) {
      console.error(error);
      return;
    }

    setIbgeItems((data as IbgeMunicipioBahia[]) || []);
  };

  const fetchPrefeituras = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("prefeituras")
      .select("id, nome, municipio, estado, logo, ativo, ibge_municipio_id")
      .order("nome");

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar cidades");
    } else {
      setItems((data as Prefeitura[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard", { replace: true });
      return;
    }
    void fetchPrefeituras();
    void fetchIbgeMunicipios();
  }, [canManage, navigate]);

  const selectedMunicipioLabel = useMemo(() => {
    const item = ibgeItems.find((municipioIbge) => String(municipioIbge.ibge_id) === selectedIbgeMunicipioId);
    if (!item) return "Selecione um municipio";
    return `${item.ibge_id} - ${item.nome}`;
  }, [ibgeItems, selectedIbgeMunicipioId]);

  const resetForm = () => {
    setNome("");
    setMunicipio("");
    setEstado("");
    setLogo("");
    setAtivo(true);
    setSelectedIbgeMunicipioId("");
    setCodigoMunicipio("");
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (prefeitura: Prefeitura) => {
    setEditing(prefeitura);
    setNome(prefeitura.nome ?? "");
    setMunicipio(prefeitura.municipio ?? "");
    setEstado(prefeitura.estado ?? "");
    setLogo(prefeitura.logo ?? "");
    setAtivo(prefeitura.ativo ?? true);
    setSelectedIbgeMunicipioId(prefeitura.ibge_municipio_id != null ? String(prefeitura.ibge_municipio_id) : "");
    setCodigoMunicipio(prefeitura.ibge_municipio_id != null ? String(prefeitura.ibge_municipio_id) : "");
    setDialogOpen(true);
  };

  const handleIbgeMunicipioSelect = (value: string) => {
    setSelectedIbgeMunicipioId(value);
    setMunicipioPickerOpen(false);

    const municipioSelecionado = ibgeItems.find((item) => String(item.ibge_id) === value);
    if (!municipioSelecionado) return;

    setMunicipio(municipioSelecionado.nome);
    setNome(`Prefeitura Municipal de ${municipioSelecionado.nome}`);
    setEstado(municipioSelecionado.uf_sigla || "BA");
    setCodigoMunicipio(String(municipioSelecionado.ibge_id));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload = {
      id: editing?.id ?? null,
      nome,
      municipio,
      estado,
      logo: logo || null,
      ativo,
      ibge_municipio_id: selectedIbgeMunicipioId ? Number(selectedIbgeMunicipioId) : null,
    };

    const { error } = await supabase.functions.invoke("upsert-prefeitura", {
      body: payload,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar cidade");
      return;
    }

    toast.success(editing ? "Cidade atualizada" : "Cidade cadastrada");
    setDialogOpen(false);
    resetForm();
    void fetchPrefeituras();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Administracao</p>
          <h1 className="text-lg font-bold">Cidades</h1>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova
        </Button>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma cidade cadastrada.</p>
          </div>
        ) : (
          items.map((prefeitura) => (
            <div key={prefeitura.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{prefeitura.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    {prefeitura.municipio || "Sem municipio"} - {prefeitura.estado || "--"}
                  </p>
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {prefeitura.ativo ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(prefeitura)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </main>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cidade" : "Nova cidade"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Municipio da Bahia</Label>
              <Popover open={municipioPickerOpen} onOpenChange={setMunicipioPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={municipioPickerOpen}
                    className="h-12 w-full justify-between font-normal"
                  >
                    <span className="truncate">{selectedMunicipioLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter>
                    <CommandInput placeholder="Digite o codigo ou nome do municipio" />
                    <CommandList className="max-h-80 overscroll-contain">
                      <CommandEmpty>Nenhum municipio encontrado.</CommandEmpty>
                      {ibgeItems.map((municipioIbge) => {
                        const label = `${municipioIbge.ibge_id} - ${municipioIbge.nome}`;
                        return (
                          <CommandItem
                            key={municipioIbge.ibge_id}
                            value={`${municipioIbge.ibge_id} ${municipioIbge.nome}`}
                            onSelect={() => handleIbgeMunicipioSelect(String(municipioIbge.ibge_id))}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedIbgeMunicipioId === String(municipioIbge.ibge_id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Digite o inicio do codigo IBGE ou do nome do municipio para filtrar.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} required className="h-12" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Codigo do Municipio</Label>
                <Input value={codigoMunicipio} readOnly className="h-12 bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Municipio</Label>
                <Input
                  value={municipio}
                  onChange={(event) => setMunicipio(event.target.value)}
                  required
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={estado}
                  onChange={(event) => setEstado(event.target.value.toUpperCase())}
                  required
                  maxLength={2}
                  className="h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL do logo</Label>
              <Input value={logo} onChange={(event) => setLogo(event.target.value)} className="h-12" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="cidade-ativa">Cidade ativa</Label>
              <Switch id="cidade-ativa" checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <Button type="submit" className="h-12 w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar alteracoes" : "Cadastrar cidade"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default PrefeiturasManagement;
