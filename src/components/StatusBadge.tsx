import { Badge } from "@/components/ui/badge";

type Status = "pendente" | "visitado" | "fechada" | "foco";

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "status-pending" },
  visitado: { label: "Visitado", className: "status-visited" },
  fechada: { label: "Casa Fechada", className: "status-closed" },
  foco: { label: "Foco Encontrado", className: "status-alert" },
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
export type { Status };
