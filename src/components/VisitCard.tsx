import { MapPin, ChevronRight } from "lucide-react";
import StatusBadge, { type Status } from "./StatusBadge";

export interface Visit {
  id: string;
  address: string;
  number: string;
  neighborhood: string;
  status: Status;
  time?: string;
}

interface VisitCardProps {
  visit: Visit;
  onClick?: () => void;
}

const VisitCard = ({ visit, onClick }: VisitCardProps) => {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors duration-100 active:bg-muted"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <MapPin className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">
          {visit.address}, {visit.number}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {visit.neighborhood}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={visit.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
};

export default VisitCard;
