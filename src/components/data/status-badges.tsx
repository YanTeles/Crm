import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

const OUTCOME: Record<Enums<"lead_outcome">, { label: string; className: string }> = {
  open: { label: "Em aberto", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  won: { label: "Ganho", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  lost: { label: "Perdido", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

export function OutcomeBadge({ outcome, archived }: { outcome: Enums<"lead_outcome">; archived?: boolean }) {
  if (archived) return <Badge variant="outline">Arquivado</Badge>;
  const o = OUTCOME[outcome];
  return <Badge className={cn("border-transparent", o.className)}>{o.label}</Badge>;
}

const SALE: Record<Enums<"sale_status">, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  completed: { label: "Concluída", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground line-through" },
};

export function SaleStatusBadge({ status }: { status: Enums<"sale_status"> }) {
  const s = SALE[status];
  return <Badge className={cn("border-transparent", s.className)}>{s.label}</Badge>;
}

export function TaskStatusBadge({ status, overdue }: { status: Enums<"task_status">; overdue: boolean }) {
  if (status === "done")
    return (
      <Badge className="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        Concluída
      </Badge>
    );
  if (overdue)
    return (
      <Badge className="border-transparent bg-rose-500/10 text-rose-700 dark:text-rose-300">Atrasada</Badge>
    );
  return <Badge variant="outline">Pendente</Badge>;
}
