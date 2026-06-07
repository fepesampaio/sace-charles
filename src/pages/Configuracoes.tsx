import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { canManageMunicipalConfig } from "@/lib/access";

const Configuracoes = () => {
  const navigate = useNavigate();
  const { prefeituraId, perfil, user } = useAuth();
  const canManage = canManageMunicipalConfig(perfil);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seObrigatoria, setSeObrigatoria] = useState(false);
  const [exibirMapaSupervisor, setExibirMapaSupervisor] = useState(false);

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const load = async () => {
      if (!prefeituraId) return;

      const advancedResult = await supabase
        .from("configuracoes_prefeitura")
        .select("se_obrigatoria, exibir_mapa_supervisor")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      if (!advancedResult.error) {
        setSeObrigatoria(!!advancedResult.data?.se_obrigatoria);
        setExibirMapaSupervisor(!!advancedResult.data?.exibir_mapa_supervisor);
        setLoading(false);
        return;
      }

      const fallbackResult = await supabase
        .from("configuracoes_prefeitura")
        .select("se_obrigatoria")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();

      if (fallbackResult.error) {
        console.error(fallbackResult.error);
      } else {
        setSeObrigatoria(!!fallbackResult.data?.se_obrigatoria);
      }

      setExibirMapaSupervisor(false);
      setLoading(false);
    };

    void load();
  }, [canManage, navigate, prefeituraId]);

  const handleSave = async () => {
    if (!prefeituraId || !user) return;

    setSaving(true);
    const { error } = await supabase
      .from("configuracoes_prefeitura")
      .upsert({
        prefeitura_id: prefeituraId,
        se_obrigatoria: seObrigatoria,
        exibir_mapa_supervisor: exibirMapaSupervisor,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar configuracao");
      return;
    }

    toast.success("Configuracao salva");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground active:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Configuracoes</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <section className="space-y-6 rounded-lg border border-border bg-card p-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                No cadastro de visita, e obrigatorio informar a SE?
              </Label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={seObrigatoria === true}
                  onCheckedChange={(v) => v && setSeObrigatoria(true)}
                />
                <span className="text-sm font-medium">SIM</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={seObrigatoria === false}
                  onCheckedChange={(v) => v && setSeObrigatoria(false)}
                />
                <span className="text-sm font-medium">NAO</span>
              </label>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <Label className="text-base font-semibold">
                Supervisores deste municipio podem visualizar o mapa?
              </Label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={exibirMapaSupervisor === true}
                  onCheckedChange={(v) => v && setExibirMapaSupervisor(true)}
                />
                <span className="text-sm font-medium">SIM</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={exibirMapaSupervisor === false}
                  onCheckedChange={(v) => v && setExibirMapaSupervisor(false)}
                />
                <span className="text-sm font-medium">NAO</span>
              </label>
            </div>

            <Button onClick={handleSave} disabled={saving} className="h-12 w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Configuracoes;
