import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/admin/AnimatedNumber";
import { MiniSpark } from "@/components/whatsapp/WorkerCharts";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  onClick,
  className,
  spark,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "up" | "down" | "neutral";
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  spark?: number[];
}) {
  const Comp = onClick ? "button" : "div";
  const numeric = typeof value === "number";
  const percent =
    typeof value === "string" && value.trim().endsWith("%")
      ? Number.parseFloat(value)
      : null;

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "glass-panel dash-card relative flex flex-col gap-1 rounded-2xl px-3.5 py-3 text-left ring-1 ring-white/8 transition-colors",
        onClick &&
          "hover:border-primary/35 hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-eyebrow text-[10px]">{label}</p>
        {Icon ? (
          <Icon className="size-3.5 shrink-0 text-primary/80" aria-hidden />
        ) : null}
      </div>
      {numeric ? (
        <p className="mt-0.5 font-serif text-2xl leading-none text-foreground sm:text-[1.65rem]">
          <AnimatedNumber value={value} />
        </p>
      ) : percent != null && Number.isFinite(percent) ? (
        <p className="mt-0.5 font-serif text-2xl tabular-nums leading-none text-foreground sm:text-[1.65rem]">
          <AnimatedNumber value={percent} />
          <span className="text-lg">%</span>
        </p>
      ) : (
        <p className="mt-0.5 animate-fade-in font-serif text-2xl tabular-nums leading-none text-foreground sm:text-[1.65rem]">
          {value}
        </p>
      )}
      {hint ? (
        <p
          className={cn(
            "truncate text-[10px]",
            tone === "up" && "text-emerald-600 dark:text-emerald-400",
            tone === "down" && "text-destructive",
            tone === "neutral" && "text-muted-foreground",
          )}
        >
          {tone === "up" ? "↑ " : tone === "down" ? "↓ " : ""}
          {hint}
        </p>
      ) : null}
      {spark && spark.length > 1 ? (
        <div className="mt-1 opacity-90">
          <MiniSpark values={spark} />
        </div>
      ) : null}
    </Comp>
  );
}
