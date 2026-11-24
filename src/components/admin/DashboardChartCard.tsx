import { useId, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/dashboardSeries";

export function DashboardChartCard({
  title,
  href,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  href?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel dash-card flex w-full min-w-0 flex-col overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {href ? (
            <Link
              href={href}
              className="text-[11px] text-primary transition-colors hover:underline"
            >
              View
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex-1 p-2 sm:p-3">{children}</div>
    </section>
  );
}

export function DashboardBarChart({
  data,
  emptyMessage = "No data in this period.",
  height = 168,
}: {
  data: SeriesPoint[];
  emptyMessage?: string;
  height?: number;
}) {
  const fillId = useId().replace(/:/g, "");
  const total = data.reduce((sum, p) => sum + p.count, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center px-3 text-center text-xs text-muted-foreground"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="chart-enter w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: -14, bottom: 2 }}
          barCategoryGap="28%"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.42} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
            strokeOpacity={0.7}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--primary) 8%, transparent)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--glass-border)",
              borderRadius: 12,
              fontSize: 12,
              backdropFilter: "blur(16px)",
              boxShadow: "var(--glass-shadow-sm)",
            }}
            labelStyle={{ color: "var(--card-foreground)" }}
            itemStyle={{ color: "var(--card-foreground)" }}
            formatter={(value: number | string) => [value, "Count"]}
            animationDuration={180}
          />
          <Bar
            dataKey="count"
            fill={`url(#${fillId})`}
            radius={[6, 6, 2, 2]}
            maxBarSize={28}
            isAnimationActive
            animationBegin={40}
            animationDuration={750}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PeriodChipGroup({
  value,
  onChange,
}: {
  value: 7 | 30 | 90 | "all";
  onChange: (days: 7 | 30 | 90 | "all") => void;
}) {
  const options: Array<{ days: 7 | 30 | 90 | "all"; label: string }> = [
    { days: 7, label: "7d" },
    { days: 30, label: "30d" },
    { days: 90, label: "90d" },
    { days: "all", label: "All" },
  ];
  return (
    <div className="glass inline-flex rounded-xl p-0.5">
      {options.map((opt) => {
        const active = value === opt.days;
        return (
          <button
            key={String(opt.days)}
            type="button"
            data-active={active}
            onClick={() => onChange(opt.days)}
            className={cn(
              "dash-chip rounded-lg px-2.5 py-1 text-xs font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function GrainChipGroup({
  value,
  onChange,
}: {
  value: "daily" | "weekly";
  onChange: (grain: "daily" | "weekly") => void;
}) {
  return (
    <div className="glass inline-flex rounded-xl p-0.5">
      {(["daily", "weekly"] as const).map((grain) => {
        const active = value === grain;
        return (
          <button
            key={grain}
            type="button"
            data-active={active}
            onClick={() => onChange(grain)}
            className={cn(
              "dash-chip rounded-lg px-2 py-1 text-[11px] font-medium capitalize",
              active
                ? "bg-primary/15 text-foreground ring-1 ring-primary/25"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {grain}
          </button>
        );
      })}
    </div>
  );
}
