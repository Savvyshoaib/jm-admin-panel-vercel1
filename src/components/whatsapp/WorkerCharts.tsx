import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ChartViewMode } from "@/components/admin/DashboardChartCard";

/** Hex fills — SVG often fails to paint CSS `oklch()` / `var(--primary)`. */
const GOLD = "#FCC11D";
const GOLD_SOFT = "#FCC11D66";
const GOLD_MUTED = "#FCC11D40";
const GRID = "#ffffff14";
const TICK = "#a89f90";

function tooltipStyle() {
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
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {(["area", "bars", "line"] as const).map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "bars" ? "Bars" : id === "area" ? "Area" : "Line"}
          </button>
        );
      })}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel dash-card flex w-full min-w-0 flex-col overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{title}</h3>
          {subtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {actions}
          </div>
        ) : null}
      </div>
      <div className="w-full shrink-0">{children}</div>
    </section>
  );
}

type DualPoint = { label: string; a: number; b: number };

const CHART_H = 200;

export function DualSeriesChart({
  data,
  aLabel,
  bLabel,
  defaultView = "bars",
}: {
  data: DualPoint[];
  aLabel: string;
  bLabel: string;
  defaultView?: ChartViewMode;
}) {
  const [view, setView] = useState<ChartViewMode>(defaultView);
  const fillA = `wa-a-${useId().replace(/:/g, "")}`;
  const fillB = `wa-b-${useId().replace(/:/g, "")}`;

  const rows = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        seriesA: Number(d.a) || 0,
        seriesB: Number(d.b) || 0,
      })),
    [data],
  );

  const yMax = Math.max(
    1,
    ...rows.flatMap((r) => [r.seriesA, r.seriesB]),
  );
  const avg =
    rows.reduce((s, r) => s + r.seriesA, 0) / Math.max(1, rows.length);

  const sharedAxis = (
    <>
      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: TICK, fontSize: 10 }}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        allowDecimals={false}
        width={28}
        tick={{ fill: TICK, fontSize: 10 }}
        tickLine={false}
        axisLine={false}
        domain={[0, yMax]}
      />
      <Tooltip
        contentStyle={tooltipStyle()}
        labelStyle={{ color: "var(--card-foreground)" }}
        itemStyle={{ color: "var(--card-foreground)" }}
        formatter={(value: number | string, name: string) => [
          value,
          name === "seriesA" ? aLabel : name === "seriesB" ? bLabel : name,
        ]}
      />
      {avg > 0 ? (
        <ReferenceLine
          y={avg}
          stroke={TICK}
          strokeDasharray="4 4"
          strokeOpacity={0.7}
          label={{
            value: "Avg",
            position: "insideTopRight",
            fill: TICK,
            fontSize: 10,
          }}
        />
      ) : null}
    </>
  );

  const gradients = (
    <defs>
      <linearGradient id={fillA} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GOLD} stopOpacity={0.45} />
        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
      </linearGradient>
      <linearGradient id={fillB} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GOLD} stopOpacity={0.22} />
        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
      </linearGradient>
    </defs>
  );

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-end px-2.5 pt-2">
        <ChartModeChips value={view} onChange={setView} />
      </div>
      <div className="px-1 pb-2" style={{ height: CHART_H }}>
        <ResponsiveContainer width="100%" height={CHART_H - 8}>
          {view === "bars" ? (
            <BarChart
              data={rows}
              margin={{ top: 12, right: 10, left: 0, bottom: 2 }}
              barCategoryGap="24%"
              barGap={3}
            >
              {sharedAxis}
              <Bar
                dataKey="seriesA"
                name={aLabel}
                fill={GOLD_MUTED}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
              <Bar
                dataKey="seriesB"
                name={bLabel}
                fill={GOLD}
                radius={[4, 4, 0, 0]}
                maxBarSize={20}
                isAnimationActive={false}
              />
            </BarChart>
          ) : view === "area" ? (
            <AreaChart
              data={rows}
              margin={{ top: 12, right: 10, left: 0, bottom: 2 }}
            >
              {gradients}
              {sharedAxis}
              <Area
                type="monotone"
                dataKey="seriesA"
                name={aLabel}
                stroke={GOLD_SOFT}
                strokeWidth={1.8}
                fill={`url(#${fillB})`}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="seriesB"
                name={bLabel}
                stroke={GOLD}
                strokeWidth={2.4}
                fill={`url(#${fillA})`}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: GOLD, stroke: "#1d1d1f", strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <LineChart
              data={rows}
              margin={{ top: 12, right: 10, left: 0, bottom: 2 }}
            >
              {sharedAxis}
              <Line
                type="monotone"
                dataKey="seriesA"
                name={aLabel}
                stroke={GOLD_SOFT}
                strokeWidth={2}
                dot={{ r: 3, fill: GOLD_MUTED }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="seriesB"
                name={bLabel}
                stroke={GOLD}
                strokeWidth={2.4}
                dot={{ r: 3, fill: GOLD, stroke: "#1d1d1f", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: GOLD, stroke: "#1d1d1f", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HorizontalStatusChart({
  data,
}: {
  data: { status: string; count: number }[];
}) {
  const rows = [...data].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="w-full px-2 pb-2 pt-3" style={{ height: CHART_H + 24 }}>
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, max]}
            tick={{ fill: TICK, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="status"
            width={118}
            tick={{ fill: TICK, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            cursor={{ fill: GOLD_MUTED }}
            formatter={(value: number | string) => [value, "Leads"]}
          />
          <Bar
            dataKey="count"
            name="Leads"
            fill={GOLD}
            radius={[0, 6, 6, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarketShareChart({
  data,
}: {
  data: { market: string; pct: number; count: number }[];
}) {
  const opacities = [1, 0.72, 0.48, 0.28];

  return (
    <div className="w-full px-2 pb-2 pt-3" style={{ height: CHART_H + 24 }}>
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
          barCategoryGap="32%"
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: TICK, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="market"
            width={72}
            tick={{ fill: TICK, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle()}
            cursor={{ fill: GOLD_MUTED }}
            formatter={(_value: number | string, _n, item) => {
              const row = item?.payload as { pct: number; count: number };
              return [`${row.pct}% · ${row.count} leads`, "Share"];
            }}
          />
          <Bar
            dataKey="pct"
            name="Share"
            radius={[0, 8, 8, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={GOLD}
                fillOpacity={opacities[i] ?? 0.25}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniSpark({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const fillId = `spark-${useId().replace(/:/g, "")}`;
  const data = useMemo(
    () => values.map((count, i) => ({ label: String(i), count })),
    [values],
  );
  if (!values.some((v) => v > 0)) {
    return <div className={cn("h-8 w-full", className)} />;
  }
  return (
    <div className={cn("h-8 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke={GOLD}
            strokeWidth={1.5}
            fill={`url(#${fillId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
