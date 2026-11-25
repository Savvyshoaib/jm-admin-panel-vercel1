import { useEffect, useId, useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Kanban,
  Radar,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { AnimatedNumber } from "@/components/admin/AnimatedNumber";
import { Sparkline } from "@/components/admin/DashboardChartCard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/dashboardSeries";
import type { IntentLevel, IntentSignal, SignalStatus } from "@/models";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureInvestors } from "@/store/slices/investorsSlice";
import { ensureSignals } from "@/store/slices/signalsSlice";
import {
  BOARD_COLUMNS,
  columnIdForStatus,
  type BoardColumnId,
} from "@/components/admin/SignalsBoard";
import {
  readAssigneeOverlay,
  resolveSignalAssigneeId,
} from "@/lib/signalBoardMock";

/** Brand-safe gold scale (primary + cream/white alphas only). */
const GOLD = {
  solid: "var(--primary)",
  bright: "color-mix(in oklab, var(--primary) 92%, white)",
  mid: "color-mix(in oklab, var(--primary) 70%, transparent)",
  soft: "color-mix(in oklab, var(--primary) 45%, transparent)",
  mute: "color-mix(in oklab, var(--foreground) 28%, transparent)",
  track: "color-mix(in oklab, var(--foreground) 10%, transparent)",
} as const;

const INTENT_FILL: Record<IntentLevel, string> = {
  urgent: "color-mix(in oklab, var(--primary) 100%, white 8%)",
  high: "var(--primary)",
  medium: "color-mix(in oklab, var(--primary) 55%, var(--foreground))",
  low: "color-mix(in oklab, var(--foreground) 32%, transparent)",
};

const STAGE_FILL: Record<BoardColumnId, string> = {
  new: "var(--primary)",
  contact_planned: "color-mix(in oklab, var(--primary) 82%, white)",
  contacted: "color-mix(in oklab, var(--primary) 62%, var(--foreground))",
  qualified: "color-mix(in oklab, var(--primary) 48%, white)",
  dismissed: "color-mix(in oklab, var(--foreground) 30%, transparent)",
  converted: "color-mix(in oklab, var(--primary) 90%, white 15%)",
};

const MOCK_FUNNEL_WEIGHTS: Record<BoardColumnId, number> = {
  new: 0.38,
  contact_planned: 0.18,
  contacted: 0.16,
  qualified: 0.12,
  dismissed: 0.08,
  converted: 0.08,
};

const MOCK_WEEKLY_TREND = [
  { week: "W1", signals: 18, contacted: 6, converted: 1 },
  { week: "W2", signals: 22, contacted: 9, converted: 2 },
  { week: "W3", signals: 15, contacted: 7, converted: 1 },
  { week: "W4", signals: 28, contacted: 12, converted: 3 },
  { week: "W5", signals: 24, contacted: 11, converted: 2 },
  { week: "W6", signals: 31, contacted: 14, converted: 4 },
];

const MOCK_TYPES = [
  { name: "Property views", count: 42 },
  { name: "Calculator runs", count: 28 },
  { name: "Document downloads", count: 19 },
  { name: "Saved shortlist", count: 16 },
  { name: "Repeat visits", count: 14 },
];

const MOCK_AGING = [
  { bucket: "0–3d", count: 36 },
  { bucket: "4–7d", count: 33 },
  { bucket: "8–30d", count: 48 },
  { bucket: "30d+", count: 47 },
];

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

function daysAgo(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
}

function distributeCounts(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const keys = Object.keys(weights);
  const raw = keys.map((k) => ({
    k,
    v: Math.round(total * (weights[k] ?? 0)),
  }));
  let sum = raw.reduce((a, x) => a + x.v, 0);
  if (sum === 0 && total > 0) {
    raw[0]!.v = total;
    sum = total;
  }
  let diff = total - sum;
  let i = 0;
  while (diff !== 0 && raw.length) {
    const idx = i % raw.length;
    if (diff > 0) {
      raw[idx]!.v += 1;
      diff -= 1;
    } else if (raw[idx]!.v > 0) {
      raw[idx]!.v -= 1;
      diff += 1;
    } else {
      i += 1;
      continue;
    }
    i += 1;
  }
  return Object.fromEntries(raw.map((x) => [x.k, x.v]));
}

function toSpark(values: number[]): SeriesPoint[] {
  return values.map((count, i) => ({
    key: `p${i + 1}`,
    label: `P${i + 1}`,
    count,
  }));
}

function ChartCard({
  title,
  subtitle,
  badge,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel dash-card flex w-full min-w-0 flex-col overflow-hidden rounded-2xl",
        "min-h-[280px]",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-white/8 px-3.5 py-2.5">
        <div className="min-w-0 space-y-0.5">
          <h2 className="font-serif text-[15px] font-medium tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge ? (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20">
              {badge}
            </span>
          ) : null}
          {actions}
        </div>
      </div>
      <div className={cn("relative min-h-0 w-full flex-1", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  hint,
  delta,
  spark,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  delta?: string;
  spark: SeriesPoint[];
  icon: typeof Radar;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass-panel dash-card rounded-2xl px-3.5 py-3 transition-colors hover:border-primary/30",
        emphasis && "ring-1 ring-primary/25",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-eyebrow text-[10px] tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <Icon
          className={cn(
            "size-4 shrink-0",
            emphasis ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-serif text-[1.75rem] leading-none tracking-tight text-foreground">
          <AnimatedNumber value={value} />
          {suffix ? (
            <span className="ml-0.5 text-base text-muted-foreground">
              {suffix}
            </span>
          ) : null}
        </p>
        {delta ? (
          <span className="mb-0.5 rounded-md bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <div className="mt-2 opacity-95">
        <Sparkline data={spark} />
      </div>
    </div>
  );
}

/** Advanced ring: track + rounded segments + centre KPI. */
function AdvancedDonut({
  data,
  centerValue,
  centerLabel,
  height = 210,
}: {
  data: Array<{ name: string; value: number; fill: string }>;
  centerValue: string;
  centerLabel: string;
  height?: number;
}) {
  const track = [{ name: "track", value: 1 }];
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="relative h-full w-full" style={{ minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <PieChart>
          <Pie
            data={track}
            dataKey="value"
            innerRadius="62%"
            outerRadius="84%"
            fill={GOLD.track}
            stroke="none"
            isAnimationActive={false}
          />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="84%"
            paddingAngle={3}
            cornerRadius={6}
            stroke="none"
            isAnimationActive
            animationDuration={800}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={chartTooltipStyle()}
            labelStyle={{ color: "var(--card-foreground)" }}
            itemStyle={{ color: "var(--card-foreground)" }}
            formatter={(value: number | string, name: string) => {
              const n = Number(value) || 0;
              return [`${n} · ${Math.round((n / total) * 100)}%`, name];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-serif text-2xl leading-none text-foreground">
          {centerValue}
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {centerLabel}
        </p>
      </div>
    </div>
  );
}

/** Radial score gauge — coverage / response style. */
function AdvancedRadial({
  percent,
  label,
  sublabel,
}: {
  percent: number;
  label: string;
  sublabel: string;
}) {
  const gid = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, percent));
  const data = [{ name: label, value: clamped, fill: `url(#${gid})` }];

  return (
    <div className="relative mx-auto h-[200px] w-full max-w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="68%"
          outerRadius="100%"
          barSize={14}
          data={data}
          startAngle={220}
          endAngle={-40}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            background={{ fill: GOLD.track }}
            dataKey="value"
            cornerRadius={10}
            isAnimationActive
            animationDuration={900}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
        <p className="font-serif text-3xl leading-none text-foreground">
          {clamped}
          <span className="text-lg text-muted-foreground">%</span>
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sublabel}</p>
      </div>
    </div>
  );
}

function LegendList({
  items,
}: {
  items: Array<{ name: string; value: number; fill: string }>;
}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <ul className="w-full space-y-2.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-foreground/85">
            <span
              className="size-2.5 shrink-0 rounded-full ring-2 ring-white/10"
              style={{ background: item.fill }}
            />
            <span className="truncate">{item.name}</span>
          </span>
          <span className="shrink-0 tabular-nums text-[12px] text-foreground">
            {item.value}
            <span className="ml-1 text-muted-foreground">
              {Math.round((item.value / total) * 100)}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SignalsPage() {
  const dispatch = useAppDispatch();
  const signalsState = useAppSelector((s) => s.signals);
  const investors = useAppSelector((s) => s.investors.items);
  const barGradId = useId().replace(/:/g, "");
  const areaGradId = useId().replace(/:/g, "");
  const contactGradId = useId().replace(/:/g, "");

  useEffect(() => {
    void dispatch(ensureInvestors())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
    void dispatch(ensureSignals({ limit: 200 }))
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
  }, [dispatch]);

  const signals = signalsState.items;
  const loading = signalsState.status === "loading" && signals.length === 0;

  const stats = useMemo(() => {
    const overlay = readAssigneeOverlay();
    const byIntent: Record<IntentLevel, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    const byColumnLive: Record<string, number> = {};
    for (const col of BOARD_COLUMNS) byColumnLive[col.id] = 0;

    const typeCounts = new Map<string, number>();
    const agingLive = { d3: 0, d7: 0, d30: 0, older: 0 };
    let last7 = 0;
    let last30 = 0;
    let contacted = 0;
    let converted = 0;
    let openLike = 0;
    let assigned = 0;

    for (const s of signals) {
      const level = (s.intentLevel || "low") as IntentLevel;
      if (level in byIntent) byIntent[level] += 1;
      const col = columnIdForStatus(s.status);
      byColumnLive[col] = (byColumnLive[col] ?? 0) + 1;

      const typeKey =
        (s.signalType || s.triggeringActivity || "Other").trim() || "Other";
      typeCounts.set(typeKey, (typeCounts.get(typeKey) ?? 0) + 1);

      const d = daysAgo(s.generatedAt);
      if (d <= 3) agingLive.d3 += 1;
      else if (d <= 7) agingLive.d7 += 1;
      else if (d <= 30) agingLive.d30 += 1;
      else agingLive.older += 1;

      if (d <= 7) last7 += 1;
      if (d <= 30) last30 += 1;

      const st = String(s.status || "").toLowerCase() as SignalStatus;
      if (st === "contacted" || st === "contact_planned") contacted += 1;
      if (st === "converted") converted += 1;
      if (
        st === "new" ||
        st === "open" ||
        st === "viewed" ||
        st === "contact_planned"
      ) {
        openLike += 1;
      }

      const inv = investors.find((i) => String(i.id) === String(s.investorId));
      const agentId = resolveSignalAssigneeId(
        s.id,
        s.assignedAgentId,
        inv?.assignedAgentId,
        overlay,
      );
      if (agentId) assigned += 1;
    }

    const liveStageHits = BOARD_COLUMNS.filter(
      (c) => (byColumnLive[c.id] ?? 0) > 0,
    ).length;
    const funnelIsSparse = liveStageHits < 3;
    const total = Math.max(signals.length, 1);
    const mockStages = distributeCounts(
      signals.length || 164,
      MOCK_FUNNEL_WEIGHTS,
    );
    const funnel = BOARD_COLUMNS.map((col) => ({
      id: col.id,
      name: col.label,
      short:
        col.id === "contact_planned"
          ? "Planned"
          : col.id === "contacted"
            ? "Contact"
            : titleCase(col.id),
      count: funnelIsSparse
        ? (mockStages[col.id] ?? 0)
        : (byColumnLive[col.id] ?? 0),
      fill: STAGE_FILL[col.id],
    }));

    const intentPie = (["urgent", "high", "medium", "low"] as IntentLevel[])
      .filter((level) => byIntent[level] > 0 || level !== "urgent")
      .map((level) => ({
        name: titleCase(level),
        value: byIntent[level],
        fill: INTENT_FILL[level],
      }));

    const liveWeekly = buildLiveWeekly(signals);
    const liveWeeklySparse =
      liveWeekly.filter((w) => w.signals > 0).length < 3;
    const weekly = liveWeeklySparse ? MOCK_WEEKLY_TREND : liveWeekly;
    const weeklyAvg =
      weekly.reduce((s, w) => s + w.signals, 0) / Math.max(weekly.length, 1);

    const typeRowsLive = [...typeCounts.entries()]
      .map(([name, count]) => ({ name: titleCase(name), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const typeRows =
      typeRowsLive.length >= 3
        ? typeRowsLive
        : MOCK_TYPES.map((t) => ({
            ...t,
            count: Math.max(
              4,
              Math.round((t.count / 119) * Math.max(signals.length, 120)),
            ),
          }));

    const agingLiveRows = [
      { bucket: "0–3d", count: agingLive.d3, fill: GOLD.solid },
      { bucket: "4–7d", count: agingLive.d7, fill: GOLD.bright },
      { bucket: "8–30d", count: agingLive.d30, fill: GOLD.mid },
      { bucket: "30d+", count: agingLive.older, fill: GOLD.mute },
    ];
    const agingSparse = agingLiveRows.filter((r) => r.count > 0).length < 3;
    const aging = agingSparse
      ? MOCK_AGING.map((r, i) => ({
          bucket: r.bucket,
          count: Math.max(
            2,
            Math.round((r.count / 164) * Math.max(signals.length, 164)),
          ),
          fill: [GOLD.solid, GOLD.bright, GOLD.mid, GOLD.mute][i]!,
        }))
      : agingLiveRows;

    const investorName = (id: string) => {
      const inv = investors.find((i) => String(i.id) === String(id));
      return inv?.name || inv?.email || id || "—";
    };

    const hot = [...signals]
      .filter((s) => s.intentLevel === "high" || s.intentLevel === "urgent")
      .sort(
        (a, b) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
      )
      .slice(0, 7)
      .map((s) => ({
        ...s,
        investorName: investorName(s.investorId),
      }));

    const demoContacted = funnelIsSparse
      ? (mockStages.contacted ?? 0) + (mockStages.contact_planned ?? 0)
      : contacted;
    const demoConverted = funnelIsSparse
      ? (mockStages.converted ?? 0)
      : converted;
    const responseRate = Math.round(
      ((demoContacted + demoConverted) / total) * 100,
    );

    const coverageAssigned = funnelIsSparse
      ? Math.round(signals.length * 0.58)
      : assigned;
    const coverageUnassigned = Math.max(0, signals.length - coverageAssigned);
    const coveragePct =
      signals.length > 0
        ? Math.round((coverageAssigned / signals.length) * 100)
        : 58;

    return {
      total: signals.length,
      last7,
      last30,
      openLike,
      converted: demoConverted,
      responseRate,
      funnel,
      funnelIsSparse,
      intentPie,
      weekly,
      weeklyAvg,
      weeklyIsMock: liveWeeklySparse,
      typeRows,
      typeIsMock: typeRowsLive.length < 3,
      aging,
      agingIsMock: agingSparse,
      hot,
      assigned: coverageAssigned,
      unassigned: coverageUnassigned,
      coveragePct,
      highShare:
        signals.length > 0
          ? Math.round(
              ((byIntent.high + byIntent.urgent) / signals.length) * 100,
            )
          : 0,
      sparkActive: toSpark(weekly.map((w) => w.signals)),
      sparkNew: toSpark([12, 15, 11, 18, 16, last7 || 22]),
      sparkConverted: toSpark(weekly.map((w) => w.converted)),
      sparkResponse: toSpark(
        weekly.map((w) =>
          w.signals ? Math.round((w.contacted / w.signals) * 100) : 0,
        ),
      ),
    };
  }, [signals, investors]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Intent Signals"
          description="Pipeline health and engagement strength across investor signals."
          breadcrumbs={[
            { label: "Intent Signals" },
            { label: "Dashboard" },
          ]}
        />
        <LoadingBlock label="Loading intent signals…" />
      </div>
    );
  }

  const tick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intent Signals"
        description="Ops view of investor intent — live counts where available, demo fills for empty stages and trends."
        breadcrumbs={[
          { label: "Intent Signals", href: "/signals" },
          { label: "Dashboard" },
        ]}
        actions={
          <Button asChild className="gap-2">
            <Link href="/signals/board">
              <Kanban className="size-4" />
              Open board
              <ArrowRight className="size-3.5 opacity-70" />
            </Link>
          </Button>
        }
      />

      <div className="animate-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active signals"
          value={stats.total}
          hint={`${stats.openLike} still in early stages`}
          delta={`${stats.highShare}% high+`}
          spark={stats.sparkActive}
          icon={Radar}
          emphasis
        />
        <MetricCard
          label="New · 7 days"
          value={stats.last7}
          hint={`${stats.last30} in the last 30 days`}
          delta="+12% vs prior"
          spark={stats.sparkNew}
          icon={Sparkles}
        />
        <MetricCard
          label="Converted"
          value={stats.converted}
          hint={
            stats.funnelIsSparse
              ? "Demo stage mix until board statuses diversify"
              : "Moved to converted on the board"
          }
          spark={stats.sparkConverted}
          icon={TrendingUp}
        />
        <MetricCard
          label="Response rate"
          value={stats.responseRate}
          suffix="%"
          hint="Contact planned / contacted / converted"
          spark={stats.sparkResponse}
          icon={Users}
        />
      </div>

      <div className="animate-stagger grid gap-3 lg:grid-cols-5">
        <ChartCard
          title="Pipeline by stage"
          subtitle="Board funnel across follow-up stages"
          badge={stats.funnelIsSparse ? "Demo fill" : "Live"}
          className="lg:col-span-3 min-h-[320px]"
          bodyClassName="p-3 sm:p-4"
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={stats.funnel}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="22%"
            >
              <defs>
                <linearGradient id={barGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
                  <stop
                    offset="100%"
                    stopColor="var(--primary)"
                    stopOpacity={0.35}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.65}
              />
              <XAxis
                dataKey="short"
                tick={tick}
                axisLine={false}
                tickLine={false}
                interval={0}
                height={36}
              />
              <YAxis
                allowDecimals={false}
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                cursor={{
                  fill: "color-mix(in oklab, var(--primary) 10%, transparent)",
                }}
                contentStyle={chartTooltipStyle()}
                labelStyle={{ color: "var(--card-foreground)" }}
                formatter={(value: number | string, _n, item) => [
                  value,
                  String(
                    (item?.payload as { name?: string } | undefined)?.name ??
                      "Count",
                  ),
                ]}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 3, 3]}
                maxBarSize={40}
                isAnimationActive
                animationDuration={750}
              >
                {stats.funnel.map((entry) => (
                  <Cell key={entry.id} fill={entry.fill} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Intent strength"
          subtitle="Urgency mix across the book"
          badge="Live"
          className="lg:col-span-2 min-h-[320px]"
          bodyClassName="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4"
        >
          <div className="min-h-[200px] flex-1">
            <AdvancedDonut
              data={stats.intentPie}
              centerValue={String(stats.total)}
              centerLabel="Signals"
            />
          </div>
          <div className="w-full shrink-0 sm:w-[148px]">
            <LegendList items={stats.intentPie} />
          </div>
        </ChartCard>
      </div>

      <div className="animate-stagger grid gap-3 lg:grid-cols-5">
        <ChartCard
          title="Weekly signal flow"
          subtitle="Created vs contacted over six weeks"
          badge={stats.weeklyIsMock ? "Demo trend" : "Live"}
          className="lg:col-span-3 min-h-[320px]"
          bodyClassName="p-3 sm:p-4"
        >
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={stats.weekly}
              margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                  <stop
                    offset="55%"
                    stopColor="var(--primary)"
                    stopOpacity={0.12}
                  />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={contactGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--primary) 55%, var(--foreground))"
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="100%"
                    stopColor="color-mix(in oklab, var(--primary) 55%, var(--foreground))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.65}
              />
              <XAxis
                dataKey="week"
                tick={tick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={chartTooltipStyle()}
                labelStyle={{ color: "var(--card-foreground)" }}
                itemStyle={{ color: "var(--card-foreground)" }}
                cursor={{
                  stroke: "var(--primary)",
                  strokeOpacity: 0.4,
                  strokeDasharray: "4 4",
                }}
              />
              {stats.weeklyAvg > 0 ? (
                <ReferenceLine
                  y={stats.weeklyAvg}
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
              <Area
                type="monotone"
                dataKey="signals"
                name="Signals"
                stroke="var(--primary)"
                strokeWidth={2.25}
                fill={`url(#${areaGradId})`}
                activeDot={{
                  r: 4.5,
                  fill: "var(--primary)",
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
                isAnimationActive
                animationDuration={850}
              />
              <Area
                type="monotone"
                dataKey="contacted"
                name="Contacted"
                stroke="color-mix(in oklab, var(--primary) 55%, var(--foreground))"
                strokeWidth={1.85}
                fill={`url(#${contactGradId})`}
                isAnimationActive
                animationDuration={850}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Hot signals"
          subtitle="High / urgent · newest first"
          actions={
            <Link
              href="/signals/board"
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Board
            </Link>
          }
          className="lg:col-span-2 min-h-[320px]"
          bodyClassName="min-h-0"
        >
          <ul className="jm-scroll h-full divide-y divide-white/6 overflow-y-auto">
            {stats.hot.length === 0 ? (
              <li className="px-3.5 py-10 text-center text-xs text-muted-foreground">
                No high-intent signals yet — open the board for demo follow-up.
              </li>
            ) : (
              stats.hot.map((s) => (
                <li key={s.id} className="px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {s.investorName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.signalType || s.triggeringActivity || "Signal"}
                      </p>
                    </div>
                    <StatusBadge value={s.status} />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground/90">
                    {formatDateTime(s.generatedAt)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </ChartCard>
      </div>

      <div className="animate-stagger grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Signal types"
          subtitle="What triggered the intent"
          badge={stats.typeIsMock ? "Demo mix" : "Live"}
          bodyClassName="p-3 sm:p-4"
        >
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart
              data={stats.typeRows}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                horizontal={false}
                strokeOpacity={0.55}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={tick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tick={{ ...tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={chartTooltipStyle()}
                cursor={{
                  fill: "color-mix(in oklab, var(--primary) 8%, transparent)",
                }}
              />
              <Bar
                dataKey="count"
                radius={[0, 8, 8, 0]}
                maxBarSize={16}
                fill="var(--primary)"
                fillOpacity={0.9}
                isAnimationActive
                animationDuration={700}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Signal aging"
          subtitle="How long signals have been open"
          badge={stats.agingIsMock ? "Demo mix" : "Live"}
          bodyClassName="p-3 sm:p-4"
        >
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart
              data={stats.aging}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.65}
              />
              <XAxis
                dataKey="bucket"
                tick={tick}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={tick}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip contentStyle={chartTooltipStyle()} />
              <Bar
                dataKey="count"
                radius={[8, 8, 3, 3]}
                maxBarSize={42}
                isAnimationActive
                animationDuration={750}
              >
                {stats.aging.map((row) => (
                  <Cell key={row.bucket} fill={row.fill} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Owner coverage"
          subtitle="Assigned agents vs open queue"
          badge="Ops"
          bodyClassName="flex flex-col items-center justify-center gap-3 p-3 sm:p-4"
        >
          <AdvancedRadial
            percent={stats.coveragePct}
            label="Covered"
            sublabel={`${stats.assigned} assigned · ${stats.unassigned} open`}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function buildLiveWeekly(signals: IntentSignal[]) {
  const now = Date.now();
  const weekMs = 7 * 86_400_000;
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    return {
      week: `W${i + 1}`,
      start: now - (offset + 1) * weekMs,
      end: now - offset * weekMs,
      signals: 0,
      contacted: 0,
      converted: 0,
    };
  });

  for (const s of signals) {
    const t = new Date(s.generatedAt).getTime();
    if (!Number.isFinite(t)) continue;
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (!b) continue;
    b.signals += 1;
    const st = String(s.status || "").toLowerCase();
    if (st === "contacted" || st === "contact_planned") b.contacted += 1;
    if (st === "converted") b.converted += 1;
  }

  return buckets.map(({ week, signals: sig, contacted, converted }) => ({
    week,
    signals: sig,
    contacted,
    converted,
  }));
}
