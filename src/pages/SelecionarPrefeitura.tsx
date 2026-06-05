import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Building2, Loader2, Shield, Bug } from "lucide-react";
import { toast } from "sonner";

interface Prefeitura {
  id: string;
  nome: string;
  municipio: string;
  estado: string;
  logo: string | null;
}

const SelecionarPrefeitura = () => {
  const navigate = useNavigate();
  const { setPrefeituraId } = useAuth();
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefeituras = async () => {
      const { data, error } = await supabase
        .from("prefeituras")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) {
        toast.error("Erro ao carregar prefeituras");
        console.error(error);
      } else {
        setPrefeituras(data || []);
      }
      setLoading(false);
    };
    fetchPrefeituras();
  }, []);

  const handleSelect = (id: string) => {
    setPrefeituraId(id);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-9 w-9 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-accent flex items-center justify-center">
              <Bug className="h-3 w-3 text-accent-foreground" />
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground tracking-tight">ACE Digital</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Combate às Endemias</p>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-lg font-semibold">Selecionar Prefeitura</h1>
          <p className="text-sm text-muted-foreground">Escolha sua unidade de trabalho</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : prefeituras.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground text-sm">
              Nenhuma prefeitura cadastrada ainda.
            </p>
            <p className="text-xs text-muted-foreground">
              Crie as tabelas no Supabase e insira os dados de seed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {prefeituras.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className="flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left transition-colors active:bg-muted"
              >
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.nome}
                    className="h-12 w-12 rounded-lg object-contain bg-muted p-1"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.municipio} – {p.estado}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelecionarPrefeitura;
