import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandMark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
        <ChartNoAxesColumnIncreasing className="size-4" aria-hidden />
      </span>
      {compact ? <span className="sr-only">{APP_NAME}</span> : <span>{APP_NAME}</span>}
    </span>
  );
}
