export const ROLES = ["admin", "gestor", "supervisor", "agente"] as const;

export type Role = (typeof ROLES)[number];

export interface UserScope {
  id: string | null;
  perfil: string | null;
  prefeituraId: string | null;
  regiao: string | null;
  setor: string | null;
  gestorId: string | null;
  supervisorId: string | null;
}

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  gestor: "Gestor",
  supervisor: "Supervisor",
  agente: "Agente",
};

export const normalizeRole = (perfil: string | null | undefined): Role | null => {
  if (!perfil) return null;
  if (perfil === "administrador") return "admin";
  if (perfil === "auxiliar") return "agente";
  return ROLES.includes(perfil as Role) ? (perfil as Role) : null;
};

export const isAdmin = (perfil: string | null | undefined) => normalizeRole(perfil) === "admin";
export const isGestor = (perfil: string | null | undefined) => normalizeRole(perfil) === "gestor";
export const isSupervisor = (perfil: string | null | undefined) => normalizeRole(perfil) === "supervisor";
export const isAgente = (perfil: string | null | undefined) => normalizeRole(perfil) === "agente";

export const canManageUsers = (perfil: string | null | undefined) =>
  isAdmin(perfil) || isGestor(perfil) || isSupervisor(perfil);

export const canManageMunicipalConfig = (perfil: string | null | undefined) =>
  isAdmin(perfil) || isGestor(perfil);

export const canManageEpidemiologicalWeeks = (perfil: string | null | undefined) =>
  isAdmin(perfil) || isGestor(perfil);

export const canManageMunicipalities = (perfil: string | null | undefined) =>
  isAdmin(perfil);

export const canCreateRole = (
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
) => {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(targetRole);

  if (!actor || !target) return false;
  if (actor === "admin") return target !== "admin";
  if (actor === "gestor") return target === "supervisor" || target === "agente";
  if (actor === "supervisor") return target === "agente";
  return false;
};

export const canEditRole = (
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
) => canCreateRole(actorRole, targetRole);

export const canAccessUser = (actor: UserScope, target: UserScope) => {
  const actorRole = normalizeRole(actor.perfil);
  const targetRole = normalizeRole(target.perfil);

  if (!actorRole || !targetRole) return false;
  if (actorRole === "admin") return true;

  if (actorRole === "gestor") {
    return (
      actor.prefeituraId !== null &&
      actor.prefeituraId === target.prefeituraId &&
      (targetRole === "supervisor" || targetRole === "agente")
    );
  }

  if (actorRole === "supervisor") {
    return (
      actor.prefeituraId !== null &&
      actor.prefeituraId === target.prefeituraId &&
      targetRole === "agente" &&
      (
        target.supervisorId === actor.id ||
        (
          actor.regiao !== null &&
          actor.regiao === target.regiao &&
          actor.setor !== null &&
          actor.setor === target.setor
        )
      )
    );
  }

  return actor.id === target.id;
};
