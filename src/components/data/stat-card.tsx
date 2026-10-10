import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>{label}</span>
          {Icon ? <Icon className="size-4" aria-hidden /> : null}
        </div>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular-nums",
            tone === "success" && "text-emerald-700 dark:text-emerald-400",
            tone === "danger" && "text-rose-700 dark:text-rose-400",
          )}
        >
          {value}
        </p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
