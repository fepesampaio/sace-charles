import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { normalizeRole, type Role } from "@/lib/access";

interface UserProfile {
  id: string;
  perfil: Role | null;
  prefeituraId: string | null;
  regiao: string | null;
  setor: string | null;
  gestorId: string | null;
  supervisorId: string | null;
  nome: string | null;
  email: string | null;
  ativo: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  prefeituraId: string | null;
  setPrefeituraId: (id: string | null) => void;
  perfil: string | null;
  setPerfil: (perfil: string | null) => void;
  userProfile: UserProfile | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [prefeituraId, setPrefeituraId] = useState<string | null>(
    () => sessionStorage.getItem("prefeituraId")
  );
  const [perfil, setPerfil] = useState<string | null>(
    () => sessionStorage.getItem("perfil")
  );
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const mapUserProfile = (data: any): UserProfile => ({
      id: data.id,
      nome: data.nome ?? null,
      email: data.email ?? null,
      ativo: data.ativo ?? null,
      perfil: normalizeRole(data.perfil),
      prefeituraId: data.prefeituraid ?? null,
      regiao: data.regiao ?? null,
      setor: data.setor ?? null,
      gestorId: data.gestor_id ?? null,
      supervisorId: data.supervisor_id ?? null,
    });

    const syncUsuarioContext = async (currentUser: User | null) => {
      if (!currentUser) {
        setPrefeituraId(null);
        setPerfil(null);
        setUserProfile(null);
        return;
      }

      const advancedResult = await supabase
        .from("usuarios")
        .select("id, nome, email, ativo, prefeituraid, perfil, regiao, setor, gestor_id, supervisor_id")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!advancedResult.error && advancedResult.data) {
        setPrefeituraId(advancedResult.data.prefeituraid ?? null);
        setPerfil(normalizeRole(advancedResult.data.perfil));
        setUserProfile(mapUserProfile(advancedResult.data));
        return;
      }

      const fallbackResult = await supabase
        .from("usuarios")
        .select("id, nome, email, ativo, prefeituraid, perfil")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (fallbackResult.error || !fallbackResult.data) return;

      setPrefeituraId(fallbackResult.data.prefeituraid ?? null);
      setPerfil(normalizeRole(fallbackResult.data.perfil));
      setUserProfile(mapUserProfile(fallbackResult.data));
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        void syncUsuarioContext(session?.user ?? null).finally(() => {
          setLoading(false);
        });
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      void syncUsuarioContext(session?.user ?? null).finally(() => {
        setLoading(false);
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (prefeituraId) {
      sessionStorage.setItem("prefeituraId", prefeituraId);
    } else {
      sessionStorage.removeItem("prefeituraId");
    }
  }, [prefeituraId]);

  useEffect(() => {
    if (perfil) {
      sessionStorage.setItem("perfil", perfil);
    } else {
      sessionStorage.removeItem("perfil");
    }
  }, [perfil]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setPrefeituraId(null);
    setPerfil(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        prefeituraId,
        setPrefeituraId,
        perfil,
        setPerfil,
        userProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
