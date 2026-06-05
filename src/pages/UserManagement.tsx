import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Pencil, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  canAccessUser,
  canCreateRole,
  canEditRole,
  canManageUsers,
  isAdmin,
  isGestor,
  isSupervisor,
  roleLabels,
  type Role,
  type UserScope,
} from "@/lib/access";

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
  perfil: string | null;
  ativo: boolean | null;
  prefeituraid: string | null;
  regiao: string | null;
  setor: string | null;
  gestor_id: string | null;
  supervisor_id: string | null;
}

interface Prefeitura {
  id: string;
  nome: string | null;
  municipio: string | null;
}

interface UserAuditIssue {
  type: "missing_email" | "missing_in_auth" | "id_mismatch";
  id: string;
  auth_id?: string;
  email: string | null;
  nome: string | null;
  perfil: string | null;
}

const normalizeUsuario = (usuario: any): Usuario => ({
  id: usuario.id,
  nome: usuario.nome ?? null,
  email: usuario.email ?? null,
  perfil: usuario.perfil ?? null,
  ativo: usuario.ativo ?? null,
  prefeituraid: usuario.prefeituraid ?? null,
  regiao: usuario.regiao ?? null,
  setor: usuario.setor ?? null,
  gestor_id: usuario.gestor_id ?? null,
  supervisor_id: usuario.supervisor_id ?? null,
});

const UserManagement = () => {
  const { perfil, prefeituraId, userProfile } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [auditIssues, setAuditIssues] = useState<UserAuditIssue[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("agente");
  const [senha, setSenha] = useState("");
  const [selectedPrefeituraId, setSelectedPrefeituraId] = useState<string>("");
  const [regiao, setRegiao] = useState("");
  const [setor, setSetor] = useState("");
  const [gestorId, setGestorId] = useState<string>("none");
  const [supervisorId, setSupervisorId] = useState<string>("none");

  const actorScope: UserScope = {
    id: userProfile?.id ?? null,
    perfil,
    prefeituraId,
    regiao: userProfile?.regiao ?? null,
    setor: userProfile?.setor ?? null,
    gestorId: userProfile?.gestorId ?? null,
    supervisorId: userProfile?.supervisorId ?? null,
  };

  const canManage = canManageUsers(perfil);

  const fetchData = async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let advancedUsersQuery = supabase
      .from("usuarios")
      .select("id, nome, email, perfil, ativo, prefeituraid, regiao, setor, gestor_id, supervisor_id");

    if (!isAdmin(perfil) && prefeituraId) {
      advancedUsersQuery = advancedUsersQuery.eq("prefeituraid", prefeituraId);
    }

    const [advancedUsersResult, prefeiturasResult] = await Promise.all([
      advancedUsersQuery.order("nome"),
      supabase.from("prefeituras").select("id, nome, municipio").order("nome"),
    ]);

    if (!advancedUsersResult.error) {
      setUsuarios(((advancedUsersResult.data as Usuario[]) || []).map(normalizeUsuario));
    } else {
      let fallbackUsersQuery = supabase
        .from("usuarios")
        .select("id, nome, email, perfil, ativo, prefeituraid");

      if (!isAdmin(perfil) && prefeituraId) {
        fallbackUsersQuery = fallbackUsersQuery.eq("prefeituraid", prefeituraId);
      }

      const fallbackUsersResult = await fallbackUsersQuery.order("nome");

      if (fallbackUsersResult.error) {
        console.error(fallbackUsersResult.error);
        toast.error("Erro ao carregar usuarios");
      } else {
        setUsuarios(((fallbackUsersResult.data as Usuario[]) || []).map(normalizeUsuario));
      }
    }

    if (prefeiturasResult.error) {
      console.error(prefeiturasResult.error);
    } else {
      setPrefeituras((prefeiturasResult.data as Prefeitura[]) || []);
    }

    setLoading(false);
  };

  const fetchAudit = async () => {
    if (!isAdmin(perfil)) {
      setAuditIssues([]);
      return;
    }

    const { data, error } = await supabase.functions.invoke("audit-users");

    if (error) {
      console.error(error);
      setAuditIssues([]);
      return;
    }

    setAuditIssues(((data?.issues ?? []) as UserAuditIssue[]) || []);
  };

  useEffect(() => {
    void fetchData();
    void fetchAudit();
  }, [prefeituraId, perfil, userProfile?.id]);

  const visibleUsers = useMemo(
    () =>
      usuarios.filter((usuario) =>
        canAccessUser(actorScope, {
          id: usuario.id,
          perfil: usuario.perfil,
          prefeituraId: usuario.prefeituraid,
          regiao: usuario.regiao,
          setor: usuario.setor,
          gestorId: usuario.gestor_id,
          supervisorId: usuario.supervisor_id,
        })
      ),
    [actorScope, usuarios]
  );

  const availableRoles = useMemo(
    () =>
      (["gestor", "supervisor", "agente"] as Role[]).filter((role) => canCreateRole(perfil, role)),
    [perfil]
  );

  const gestores = useMemo(
    () =>
      usuarios.filter(
        (usuario) =>
          usuario.perfil === "gestor" &&
          (selectedPrefeituraId ? usuario.prefeituraid === selectedPrefeituraId : true)
      ),
    [selectedPrefeituraId, usuarios]
  );

  const supervisores = useMemo(
    () =>
      usuarios.filter(
        (usuario) =>
          usuario.perfil === "supervisor" &&
          (selectedPrefeituraId ? usuario.prefeituraid === selectedPrefeituraId : true) &&
          (gestorId !== "none" ? usuario.gestor_id === gestorId : true)
      ),
    [gestorId, selectedPrefeituraId, usuarios]
  );

  const resetForm = () => {
    setNome("");
    setEmail("");
    setSelectedRole(availableRoles[0] ?? "agente");
    setSenha("");
    setSelectedPrefeituraId(prefeituraId ?? "");
    setRegiao("");
    setSetor("");
    setGestorId("none");
    setSupervisorId("none");
    setEditingUser(null);
  };

  const applyRoleDefaults = (role: Role) => {
    if (isGestor(perfil)) {
      setSelectedPrefeituraId(prefeituraId ?? "");
      setGestorId(userProfile?.id ?? "none");
      if (role === "supervisor") {
        setSupervisorId("none");
      }
    }

    if (isSupervisor(perfil)) {
      setSelectedPrefeituraId(prefeituraId ?? "");
      setGestorId(userProfile?.gestorId ?? "none");
      setSupervisorId(userProfile?.id ?? "none");
      setRegiao(userProfile?.regiao ?? "");
      setSetor(userProfile?.setor ?? "");
    }
  };

  const openEdit = (usuario: Usuario) => {
    if (!canEditRole(perfil, usuario.perfil)) return;

    setEditingUser(usuario);
    setNome(usuario.nome ?? "");
    setEmail(usuario.email ?? "");
    setSelectedRole((usuario.perfil as Role) ?? "agente");
    setSenha("");
    setSelectedPrefeituraId(usuario.prefeituraid ?? prefeituraId ?? "");
    setRegiao(usuario.regiao ?? "");
    setSetor(usuario.setor ?? "");
    setGestorId(usuario.gestor_id ?? "none");
    setSupervisorId(usuario.supervisor_id ?? "none");
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    applyRoleDefaults(availableRoles[0] ?? "agente");
    setDialogOpen(true);
  };

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    if (role === "gestor") {
      setGestorId("none");
      setSupervisorId("none");
    }
    if (role === "supervisor") {
      setSupervisorId("none");
    }
    applyRoleDefaults(role);
  };

  const resolvedPrefeituraId = isAdmin(perfil) ? selectedPrefeituraId : prefeituraId ?? "";
  const resolvedGestorId =
    selectedRole === "gestor"
      ? "none"
      : isGestor(perfil)
        ? userProfile?.id ?? "none"
        : isSupervisor(perfil)
          ? userProfile?.gestorId ?? "none"
          : gestorId;
  const resolvedSupervisorId =
    selectedRole === "agente"
      ? isSupervisor(perfil)
        ? userProfile?.id ?? "none"
        : supervisorId
      : "none";
  const resolvedRegiao = isSupervisor(perfil) ? userProfile?.regiao ?? "" : regiao;
  const resolvedSetor = isSupervisor(perfil) ? userProfile?.setor ?? "" : setor;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resolvedPrefeituraId) {
      toast.error("Prefeitura invalida");
      return;
    }
    if (!editingUser && (!senha || senha.length < 6)) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSaving(true);

    try {
      if (editingUser) {
        const { error } = await supabase
          .from("usuarios")
          .update({
            nome,
            perfil: selectedRole,
            prefeituraid: resolvedPrefeituraId || null,
            regiao: null,
            setor: null,
            gestor_id: selectedRole === "gestor" ? null : resolvedGestorId === "none" ? null : resolvedGestorId,
            supervisor_id:
              selectedRole === "agente" && resolvedSupervisorId !== "none" ? resolvedSupervisorId : null,
          })
          .eq("id", editingUser.id);

        if (error) throw error;
        toast.success("Usuario atualizado com sucesso");
      } else {
        const { error: createError } = await supabase.functions.invoke("create-user", {
          body: {
            email,
            password: senha,
            nome,
            perfil: selectedRole,
            prefeituraid: resolvedPrefeituraId,
          },
        });

        if (createError) throw createError;

        const { data: createdUser, error: createdUserError } = await supabase
          .from("usuarios")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (createdUserError || !createdUser) {
          throw createdUserError ?? new Error("Usuario criado, mas nao localizado para completar o cadastro");
        }

        const { error: updateError } = await supabase
          .from("usuarios")
          .update({
            regiao: null,
            setor: null,
            gestor_id: selectedRole === "gestor" ? null : resolvedGestorId === "none" ? null : resolvedGestorId,
            supervisor_id:
              selectedRole === "agente" && resolvedSupervisorId !== "none" ? resolvedSupervisorId : null,
          })
          .eq("id", createdUser.id);

        if (updateError) throw updateError;
        toast.success("Usuario criado com sucesso");
      }

      setDialogOpen(false);
      resetForm();
      void fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar usuario");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (usuario: Usuario) => {
    if (usuario.id === userProfile?.id) {
      toast.error("Nao e possivel alterar o proprio status");
      return;
    }
    if (usuario.perfil === "admin") {
      toast.error("Nao e possivel alterar o status de outro admin");
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .update({ ativo: !usuario.ativo })
      .eq("id", usuario.id);

    if (error) {
      toast.error("Erro ao alterar status");
    } else {
      toast.success(usuario.ativo ? "Usuario desativado" : "Usuario ativado");
      void fetchData();
    }
  };

  const prefeituraLabel = (id: string | null) =>
    prefeituras.find((prefeitura) => prefeitura.id === id)?.nome || "Sem prefeitura";

  if (!canManage) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <main className="mx-auto max-w-lg p-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Voce nao tem permissao para gerenciar usuarios.
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Gerenciamento</p>
          <h1 className="text-lg font-bold">Usuarios</h1>
        </div>
        {availableRoles.length > 0 && (
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Novo
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-4">
        {isAdmin(perfil) && auditIssues.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-semibold text-destructive">Usuarios com problema de login</p>
            <div className="mt-3 space-y-2">
              {auditIssues.map((issue) => (
                <div key={`${issue.type}-${issue.id}`} className="rounded-lg border border-destructive/20 bg-background p-3">
                  <p className="text-sm font-medium">{issue.nome || issue.email || issue.id}</p>
                  <p className="text-xs text-muted-foreground">{issue.email || "Sem e-mail"}</p>
                  <p className="mt-1 text-xs text-destructive">
                    {issue.type === "missing_in_auth" && "Sem conta correspondente no Auth. Recriar usuario."}
                    {issue.type === "id_mismatch" && "ID divergente entre Auth e usuarios. Corrigir ou recriar usuario."}
                    {issue.type === "missing_email" && "Usuario sem e-mail em public.usuarios."}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum usuario disponivel neste escopo.</p>
          </div>
        ) : (
          visibleUsers.map((usuario) => (
            <div
              key={usuario.id}
              className={`rounded-xl border border-border bg-card p-4 ${
                usuario.ativo === false ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold">{usuario.nome || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{usuario.email || "Sem e-mail"}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-wider">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {roleLabels[(usuario.perfil as Role) ?? "agente"] || usuario.perfil}
                    </span>
                    {isAdmin(perfil) && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        {prefeituraLabel(usuario.prefeituraid)}
                      </span>
                    )}
                    {usuario.regiao && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Regiao {usuario.regiao}
                      </span>
                    )}
                    {usuario.setor && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                        Setor {usuario.setor}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEditRole(perfil, usuario.perfil) && (
                    <Button variant="ghost" size="icon" onClick={() => openEdit(usuario)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={usuario.ativo ? "text-destructive" : "text-primary"}
                    onClick={() => toggleAtivo(usuario)}
                  >
                    {usuario.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden px-0">
          <DialogHeader className="px-6 text-center">
            <DialogTitle>{editingUser ? "Editar usuario" : "Novo usuario"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSave}
            className="mx-auto flex max-h-[calc(90vh-5rem)] w-full max-w-md flex-col gap-4 overflow-y-auto px-6 pb-1"
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={!!editingUser}
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select value={selectedRole} onValueChange={(value: Role) => handleRoleChange(value)}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles
                    .filter((role) => !editingUser || canEditRole(perfil, role))
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {isAdmin(perfil) && (
              <div className="space-y-2">
                <Label>Prefeitura</Label>
                <Select value={selectedPrefeituraId} onValueChange={setSelectedPrefeituraId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione a prefeitura" />
                  </SelectTrigger>
                  <SelectContent>
                    {prefeituras.map((prefeitura) => (
                      <SelectItem key={prefeitura.id} value={prefeitura.id}>
                        {prefeitura.nome || prefeitura.municipio || prefeitura.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(selectedRole === "supervisor" || selectedRole === "agente") && !isGestor(perfil) && !isSupervisor(perfil) && (
              <div className="space-y-2">
                <Label>Gestor responsável</Label>
                <Select value={gestorId} onValueChange={setGestorId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione um gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem gestor</SelectItem>
                    {gestores.map((gestor) => (
                      <SelectItem key={gestor.id} value={gestor.id}>
                        {gestor.nome || gestor.email || gestor.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedRole === "agente" && !isSupervisor(perfil) && (
              <div className="space-y-2">
                <Label>Supervisor responsável</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione um supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem supervisor</SelectItem>
                    {supervisores.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.nome || supervisor.email || supervisor.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editingUser && (
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimo 6 caracteres"
                  className="h-12"
                />
              </div>
            )}
            <Button type="submit" className="h-12 w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingUser ? "Salvar alteracoes" : "Cadastrar usuário"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default UserManagement;
