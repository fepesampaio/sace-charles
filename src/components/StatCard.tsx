interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive";
}

const variantClasses = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

const StatCard = ({ label, value, icon, variant = "default" }: StatCardProps) => {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${variantClasses[variant]}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
};

export default StatCard;
