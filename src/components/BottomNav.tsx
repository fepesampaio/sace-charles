import { Home, MapPin, Plus, ClipboardList, LogOut, Users, Lock, CalendarRange } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { canManageEpidemiologicalWeeks, canManageUsers } from "@/lib/access";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, perfil } = useAuth();

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/resumo", label: "Visitas", icon: ClipboardList },
    { path: "/nova-visita", label: "Nova", icon: Plus, highlight: true },
    { path: "/mapa", label: "Mapa", icon: MapPin },
    ...(canManageUsers(perfil) ? [{ path: "/usuarios", label: "Usuarios", icon: Users }] : []),
    ...(canManageEpidemiologicalWeeks(perfil)
      ? [{ path: "/semanas-epidemiologicas", label: "SE", icon: CalendarRange }]
      : []),
    { path: "/alterar-senha", label: "Senha", icon: Lock },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-lg items-stretch">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const isHighlight = "highlight" in item && item.highlight;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors duration-100 ${
                isHighlight
                  ? "text-primary font-semibold"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-100 ${
                  isHighlight
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-primary/10"
                      : ""
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-muted-foreground transition-colors duration-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg">
            <LogOut className="h-5 w-5" />
          </div>
          <span className="text-[11px] font-medium">Sair</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
