import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Bug } from "lucide-react";

const Splash = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      if (!loading) {
        if (user) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary">
      <div className={`flex flex-col items-center gap-4 transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
        <div className="relative">
          <div className="h-24 w-24 rounded-3xl bg-primary-foreground/20 flex items-center justify-center backdrop-blur-sm">
            <Shield className="h-14 w-14 text-primary-foreground" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-accent flex items-center justify-center">
            <Bug className="h-4 w-4 text-accent-foreground" />
          </div>
        </div>
        <div className="text-center mt-2">
          <h1 className="text-2xl font-bold text-primary-foreground tracking-tight">ACE Digital</h1>
          <p className="text-sm text-primary-foreground/70 mt-1">Combate às Endemias</p>
        </div>
        <div className="mt-8 flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary-foreground/40 animate-pulse" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-primary-foreground/40 animate-pulse" style={{ animationDelay: "200ms" }} />
          <span className="h-2 w-2 rounded-full bg-primary-foreground/40 animate-pulse" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    </div>
  );
};

export default Splash;
