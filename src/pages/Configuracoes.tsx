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

  useEffect(() => {
    if (!canManage) {
      navigate("/dashboard", { replace: true });
      return;
    }
    const load = async () => {
      if (!prefeituraId) return;
      const { data, error } = await supabase
        .from("configuracoes_prefeitura")
        .select("se_obrigatoria")
        .eq("prefeitura_id", prefeituraId)
        .maybeSingle();
      if (error) console.error(error);
      setSeObrigatoria(!!data?.se_obrigatoria);
      setLoading(false);
    };
    load();
  }, [prefeituraId, canManage, navigate]);

  const handleSave = async () => {
    if (!prefeituraId || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("configuracoes_prefeitura")
      .upsert({
        prefeitura_id: prefeituraId,
        se_obrigatoria: seObrigatoria,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground active:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Configurações</h1>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <Label className="text-base font-semibold">
              No cadastro de Visita, é obrigatório informar a SE (Semana Epidemiológica)?
            </Label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={seObrigatoria === true}
                  onCheckedChange={(v) => v && setSeObrigatoria(true)}
                />
                <span className="text-sm font-medium">SIM</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={seObrigatoria === false}
                  onCheckedChange={(v) => v && setSeObrigatoria(false)}
                />
                <span className="text-sm font-medium">NÃO</span>
              </label>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full h-12 gap-2">
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
