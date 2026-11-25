import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/dashboardSeries";

export type ChartViewMode = "area" | "bars" | "line";
export type ChartSeriesMode = "period" | "cumulative";

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
        "min-h-[210px]",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-1.5">
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
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {actions}
          {href ? (
            <Link
              href={href}
              className="px-1 text-[11px] text-primary transition-colors hover:underline"
            >
              View
            </Link>
          ) : null}
        </div>
      </div>
      <div className="relative min-h-0 w-full flex-1">{children}</div>
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function chartTooltipStyle() {
  return {
    background: "var(--popover)",
    border: "1px solid var(--glass-border)",
    borderRadius: 12,
    fontSize: 12,
    backdropFilter: "blur(16px)",
    boxShadow: "var(--glass-shadow-sm)",
  } as const;
}

function ChartModeChips({
  value,
  onChange,
}: {
  value: ChartViewMode;
  onChange: (mode: ChartViewMode) => void;
}) {
  const options: Array<{ id: ChartViewMode; label: string }> = [
    { id: "area", label: "Area" },
    { id: "bars", label: "Bars" },
    { id: "line", label: "Line" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
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

/** Per-bucket count vs running total — labels kept plain for ops users. */
function SeriesModeChips({
  value,
  onChange,
}: {
  value: ChartSeriesMode;
  onChange: (mode: ChartSeriesMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      <button
        type="button"
        title="Count in each day or week bucket"
        onClick={() => onChange("period")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
          value === "period"
            ? "bg-white/10 text-foreground ring-1 ring-primary/30"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Each
      </button>
      <button
        type="button"
        title="Running total across the selected period"
        onClick={() => onChange("cumulative")}
        className={cn(
          "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
          value === "cumulative"
            ? "bg-white/10 text-foreground ring-1 ring-primary/30"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Running
      </button>
    </div>
  );
}

function toChartData(data: SeriesPoint[], series: ChartSeriesMode) {
  if (series === "period") {
    return data.map((p) => ({ ...p, value: Number(p.count) || 0 }));
  }
  let running = 0;
  return data.map((p) => {
    running += Number(p.count) || 0;
    return { ...p, value: running };
  });
}

function AdvancedChartBody({
  data,
  view,
  series,
  emptyMessage,
}: {
  data: SeriesPoint[];
  view: ChartViewMode;
  series: ChartSeriesMode;
  emptyMessage: string;
}) {
  const fillId = useId().replace(/:/g, "");
  const chartData = useMemo(() => toChartData(data, series), [data, series]);
  const hasData = useMemo(
    () => data.some((p) => (Number(p.count) || 0) > 0),
    [data],
  );
  const avg = useMemo(() => {
    if (!chartData.length || !hasData) return 0;
    return chartData.reduce((s, p) => s + p.value, 0) / chartData.length;
  }, [chartData, hasData]);

  if (!hasData) {
    return <ChartEmpty message={emptyMessage} />;
  }

  const valueName = series === "cumulative" ? "Running total" : "Count";

  return (
    <div className="chart-enter absolute inset-0 p-2 sm:p-2.5">
      <ResponsiveContainer width="100%" height="100%" minHeight={160}>
        <ComposedChart
          data={chartData}
          margin={{ top: 12, right: 8, left: 0, bottom: 2 }}
          barCategoryGap="18%"
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
              <stop offset="55%" stopColor="var(--primary)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
            strokeOpacity={0.65}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={32}
            domain={[0, (dataMax: number) => Math.max(1, dataMax)]}
          />
          <Tooltip
            cursor={
              view === "bars"
                ? { fill: "color-mix(in oklab, var(--primary) 10%, transparent)" }
                : {
                    stroke: "var(--primary)",
                    strokeOpacity: 0.4,
                    strokeDasharray: "4 4",
                  }
            }
            contentStyle={chartTooltipStyle()}
            labelStyle={{ color: "var(--card-foreground)" }}
            itemStyle={{ color: "var(--card-foreground)" }}
            formatter={(value: number | string) => [value, valueName]}
            animationDuration={140}
          />
          {avg > 0 ? (
            <ReferenceLine
              y={avg}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              label={{
                value: "Avg",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 10,
              }}
            />
          ) : null}

          {view === "bars" ? (
            <Bar
              dataKey="value"
              name={valueName}
              fill="var(--primary)"
              fillOpacity={0.85}
              radius={[5, 5, 2, 2]}
              maxBarSize={36}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          ) : null}

          {view === "area" ? (
            <Area
              type="monotone"
              dataKey="value"
              name={valueName}
              stroke="var(--primary)"
              strokeWidth={2.25}
              fill={`url(#${fillId})`}
              isAnimationActive
              animationDuration={850}
              animationEasing="ease-out"
              activeDot={{
                r: 4.5,
                fill: "var(--primary)",
                stroke: "var(--background)",
                strokeWidth: 2,
              }}
            />
          ) : null}

          {view === "line" ? (
            <Line
              type="monotone"
              dataKey="value"
              name={valueName}
              stroke="var(--primary)"
              strokeWidth={2.4}
              dot={{
                r: 2.5,
                fill: "var(--primary)",
                stroke: "var(--background)",
                strokeWidth: 1.5,
              }}
              activeDot={{
                r: 5,
                fill: "var(--primary)",
                stroke: "var(--background)",
                strokeWidth: 2,
              }}
              isAnimationActive
              animationDuration={850}
              animationEasing="ease-out"
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartFilterActions({
  view,
  onViewChange,
  series,
  onSeriesChange,
}: {
  view: ChartViewMode;
  onViewChange: (mode: ChartViewMode) => void;
  series: ChartSeriesMode;
  onSeriesChange: (mode: ChartSeriesMode) => void;
}) {
  return (
    <>
      <SeriesModeChips value={series} onChange={onSeriesChange} />
      <ChartModeChips value={view} onChange={onViewChange} />
    </>
  );
}

/** Chart body only — pair with ChartFilterActions in the card header. */
export function DashboardSmartChart({
  data,
  emptyMessage = "No data in this period.",
  view = "area",
  series = "period",
}: {
  data: SeriesPoint[];
  emptyMessage?: string;
  view?: ChartViewMode;
  series?: ChartSeriesMode;
}) {
  return (
    <AdvancedChartBody
      data={data}
      view={view}
      series={series}
      emptyMessage={emptyMessage}
    />
  );
}

/** Self-contained chart card with header filters + visible plot by default. */
export function DashboardSmartChartCard({
  title,
  subtitle,
  href,
  data,
  emptyMessage = "No data in this period.",
  defaultView = "area",
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  data: SeriesPoint[];
  emptyMessage?: string;
  defaultView?: ChartViewMode;
  className?: string;
}) {
  const [view, setView] = useState<ChartViewMode>(defaultView);
  const [series, setSeries] = useState<ChartSeriesMode>("period");

  return (
    <DashboardChartCard
      title={title}
      subtitle={subtitle}
      href={href}
      className={className}
      actions={
        <ChartFilterActions
          view={view}
          onViewChange={setView}
          series={series}
          onSeriesChange={setSeries}
        />
      }
    >
      <DashboardSmartChart
        data={data}
        emptyMessage={emptyMessage}
        view={view}
        series={series}
      />
    </DashboardChartCard>
  );
}

export function DashboardBarChart({
  data,
  emptyMessage = "No data in this period.",
}: {
  data: SeriesPoint[];
  emptyMessage?: string;
  height?: number;
}) {
  return (
    <DashboardSmartChart
      data={data}
      emptyMessage={emptyMessage}
      view="bars"
    />
  );
}

export function DashboardAreaChart({
  data,
  emptyMessage = "No data in this period.",
}: {
  data: SeriesPoint[];
  emptyMessage?: string;
  height?: number;
}) {
  return (
    <DashboardSmartChart
      data={data}
      emptyMessage={emptyMessage}
      view="area"
    />
  );
}

export function Sparkline({
  data,
  className,
}: {
  data: SeriesPoint[];
  className?: string;
}) {
  const fillId = useId().replace(/:/g, "");
  if (data.every((p) => p.count === 0)) {
    return <div className={cn("h-9 w-full", className)} />;
  }
  return (
    <div className={cn("h-9 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--primary)"
            strokeWidth={1.5}
            fill={`url(#${fillId})`}
            isAnimationActive
            animationDuration={700}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
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
