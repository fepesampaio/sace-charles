import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Splash from "./pages/Splash";
import Login from "./pages/Login";
import SelecionarPrefeitura from "./pages/SelecionarPrefeitura";
import Dashboard from "./pages/Dashboard";
import NewVisit from "./pages/NewVisit";
import MapPage from "./pages/MapPage";
import Summary from "./pages/Summary";
import UserManagement from "./pages/UserManagement";
import SemanasEpidemiologicas from "./pages/SemanasEpidemiologicas";
import Configuracoes from "./pages/Configuracoes";
import ChangePassword from "./pages/ChangePassword";
import PrefeiturasManagement from "./pages/PrefeiturasManagement";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();
const Router = window.location.hostname.endsWith("github.io") ? HashRouter : BrowserRouter;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/selecionar-prefeitura" element={<SelecionarPrefeitura />} />
            <Route path="/splash" element={<Splash />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
              path="/nova-visita"
              element={<ProtectedRoute><NewVisit /></ProtectedRoute>}
            />
            <Route
              path="/visitas/:visitId/editar"
              element={<ProtectedRoute><NewVisit /></ProtectedRoute>}
            />
            <Route
              path="/mapa"
              element={<ProtectedRoute><MapPage /></ProtectedRoute>}
            />
            <Route
              path="/resumo"
              element={<ProtectedRoute><Summary /></ProtectedRoute>}
            />
            <Route
              path="/usuarios"
              element={<ProtectedRoute><UserManagement /></ProtectedRoute>}
            />
            <Route
              path="/semanas-epidemiologicas"
              element={<ProtectedRoute><SemanasEpidemiologicas /></ProtectedRoute>}
            />
            <Route
              path="/configuracoes"
              element={<ProtectedRoute><Configuracoes /></ProtectedRoute>}
            />
            <Route
              path="/alterar-senha"
              element={<ProtectedRoute><ChangePassword /></ProtectedRoute>}
            />
            <Route
              path="/prefeituras"
              element={<ProtectedRoute><PrefeiturasManagement /></ProtectedRoute>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
