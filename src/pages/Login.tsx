import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { setPrefeituraId, setPerfil } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      // Load app context for the authenticated user.
      const { data: usuario, error: userError } = await supabase
        .from("usuarios")
        .select("perfil, prefeituraid")
        .eq("email", email)
        .maybeSingle();

      if (userError || !usuario) {
        console.error("Error fetching perfil:", userError);
        await supabase.auth.signOut();
        toast.error("❌ Usuário não encontrado no sistema");
        return;
      }

      setPerfil(usuario.perfil);
      setPrefeituraId(usuario.prefeituraid ?? null);
      navigate(`/dashboard?perfil=${usuario.perfil}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
            <Shield className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">ACE Digital</h1>
          <p className="text-sm text-muted-foreground">Faça login para continuar</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agente@prefeitura.gov.br"
              className="h-12 text-base"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 text-base"
              required
              minLength={6}
            />
          </div>

          <Button type="submit" size="lg" className="w-full h-12 text-base font-semibold" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
