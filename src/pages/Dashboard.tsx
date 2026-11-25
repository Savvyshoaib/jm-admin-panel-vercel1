import { useEffect, useMemo, useState, Children, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/admin/AnimatedNumber";
import {
  AiInsightsPanel,
  buildDashboardInsights,
} from "@/components/admin/AiInsightsPanel";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  DashboardChartCard,
  DashboardSmartChartCard,
  GrainChipGroup,
  PeriodChipGroup,
  Sparkline,
} from "@/components/admin/DashboardChartCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import {
  agentsByEnquiry,
  bucketDates,
  compositionSeries,
  periodDelta,
  periodWindow,
  sumOwnershipValue,
  topInvestorsFromOwnership,
  type BucketGrain,
  type PeriodDays,
  type SeriesPoint,
} from "@/lib/dashboardSeries";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  titleCase,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  listActivity,
  listAgents,
  listEnquiries,
  listInvestors,
  listOwnership,
  listSignals,
} from "@/services/api";
import type {
  ActivityEvent,
  Enquiry,
  IntentSignal,
  Investor,
  InternalUser,
  PortfolioOwnership,
} from "@/models";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureDashboard } from "@/store/slices/dashboardSlice";

type AnalyticsState = {
  investors: Investor[];
  enquiries: Enquiry[];
  signals: IntentSignal[];
  activity: ActivityEvent[];
  ownership: PortfolioOwnership[];
  agents: InternalUser[];
};

const EMPTY_ANALYTICS: AnalyticsState = {
  investors: [],
  enquiries: [],
  signals: [],
  activity: [],
  ownership: [],
  agents: [],
};

type AnalyticsLoaded = {
  investors: boolean;
  enquiries: boolean;
  signals: boolean;
  ownership: boolean;
  agents: boolean;
  activity: boolean;
};

const EMPTY_LOADED: AnalyticsLoaded = {
  investors: false,
  enquiries: false,
  signals: false,
  ownership: false,
  agents: false,
  activity: false,
};

function firstName(fullName: string | undefined | null): string {
  const part = String(fullName ?? "").trim().split(/\s+/)[0];
  return part || "there";
}

function humanizeActivityText(value: string): string {
  return titleCase(
    value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function shortActivityType(type: string): string {
  const t = type.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (t.includes("calculator")) return "Calc";
  if (t.includes("screen")) return "Screen";
  if (t.includes("document")) return "Docs";
  if (t.includes("profile")) return "Profile";
  if (t.includes("propert")) return "Property";
  if (t.includes("dashboard")) return "Home";
  if (t.includes("signal")) return "Signal";
  if (t.includes("enquir")) return "Enquiry";
  const label = humanizeActivityText(type);
  const first = label.split(" ")[0];
  return first || "Event";
}

function formatActivityTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(
    "en-GB",
    sameYear
      ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      : {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
  ).format(d);
}

function formatActivityRow(
  a: ActivityEvent,
  nameById: Map<string, string>,
): { typeLabel: string; headline: string; meta: string | null; href?: string } {
  const typeLabel = shortActivityType(a.type || "Event");
  const invName = a.investorId
    ? nameById.get(String(a.investorId))
    : undefined;
  const titleRaw = (a.title || "").trim();
  const humanTitle = humanizeActivityText(titleRaw);
  const titleLooksLikeType =
    !titleRaw ||
    titleRaw.toLowerCase() === String(a.type || "").toLowerCase() ||
    humanTitle.toLowerCase() === humanizeActivityText(a.type || "").toLowerCase();

  const headline = titleLooksLikeType
    ? invName || typeLabel
    : humanTitle;

  const metaParts: string[] = [];
  if (invName && headline !== invName) metaParts.push(invName);
  if (a.propertyName) metaParts.push(a.propertyName);
  else if (a.location) metaParts.push(a.location);
  const detail = (a.detail || "").trim();
  if (
    detail &&
    detail !== "—" &&
    detail !== "-" &&
    detail !== titleRaw &&
    humanizeActivityText(detail) !== headline &&
    !metaParts.includes(detail)
  ) {
    metaParts.push(humanizeActivityText(detail));
  }

  return {
    typeLabel,
    headline,
    meta: metaParts.length ? metaParts.join(" · ") : null,
    href: a.investorId ? `/investors/${a.investorId}` : undefined,
  };
}

function deltaPct(current: number, prior: number): number | null {
  if (prior <= 0) return current > 0 ? 100 : current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

function periodHuman(period: PeriodDays): string {
  if (period === "all") return "full history";
  if (period === 7) return "7 days";
  if (period === 90) return "90 days";
  return "30 days";
}

function StatCard({
  label,
  value,
  href,
  hint,
  valueText,
  loading,
  series,
  emphasis,
}: {
  label: string;
  value?: number;
  valueText?: string;
  href: string;
  hint?: string;
  loading?: boolean;
  series?: SeriesPoint[];
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "glass-panel dash-card block w-full rounded-2xl px-3.5 py-3 hover:border-primary/35 hover:bg-white/6",
        emphasis && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="label-eyebrow text-[10px]">{label}</p>
        {emphasis ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-normal">
            Focus
          </Badge>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : valueText != null ? (
        <p className="mt-1.5 animate-fade-in font-serif text-2xl tabular-nums leading-none text-foreground sm:text-[1.75rem]">
          {valueText}
        </p>
      ) : (
        <p className="mt-1.5 font-serif text-2xl leading-none text-foreground sm:text-[1.75rem]">
          <AnimatedNumber value={value ?? 0} />
        </p>
      )}
      {hint && !loading ? (
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
      {series && series.length > 1 && !loading ? (
        <div className="mt-2 opacity-90">
          <Sparkline data={series} />
        </div>
      ) : null}
    </Link>
  );
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector((s) => s.dashboard);
  const user = useAppSelector((s) => s.auth.user);
  const stats = dashboard.data;

  const [period, setPeriod] = useState<PeriodDays>(30);
  const [grain, setGrain] = useState<BucketGrain>("weekly");
  const [analytics, setAnalytics] = useState<AnalyticsState>(EMPTY_ANALYTICS);
  const [loaded, setLoaded] = useState<AnalyticsLoaded>(EMPTY_LOADED);

  useEffect(() => {
    void dispatch(ensureDashboard())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(
          typeof err === "string" ? err : "Unable to load dashboard.",
        );
      });
  }, [dispatch, dashboard.invalidated]);

  // Period-independent lists — load once (or on invalidate), unlock each widget as its API returns.
  useEffect(() => {
    let cancelled = false;
    setLoaded((prev) => ({
      ...prev,
      investors: false,
      enquiries: false,
      signals: false,
      ownership: false,
      agents: false,
    }));

    const finish = <K extends keyof AnalyticsState & keyof AnalyticsLoaded>(
      key: K,
      value?: AnalyticsState[K],
    ) => {
      if (cancelled) return;
      if (value !== undefined) {
        setAnalytics((prev) => ({ ...prev, [key]: value }));
      }
      setLoaded((prev) => ({ ...prev, [key]: true }));
    };

    void listInvestors()
      .then((items) => finish("investors", items))
      .catch(() => finish("investors"));
    void listEnquiries()
      .then((items) => finish("enquiries", items))
      .catch(() => finish("enquiries"));
    void listSignals({ limit: 200 })
      .then((items) => finish("signals", items))
      .catch(() => finish("signals"));
    void listOwnership()
      .then((items) => finish("ownership", items))
      .catch(() => finish("ownership"));
    void listAgents()
      .then((items) => finish("agents", items))
      .catch(() => finish("agents"));

    return () => {
      cancelled = true;
    };
  }, [dashboard.invalidated]);

  // Activity is the only list that uses `since` — refetch when period changes.
  useEffect(() => {
    let cancelled = false;
    setLoaded((prev) => ({ ...prev, activity: false }));
    const win = periodWindow(period);
    const query = win.isAll
      ? { limit: 200, sort: "-occurredAt" as const }
      : {
          since: new Date(win.startMs).toISOString(),
          limit: 200,
          sort: "-occurredAt" as const,
        };

    void listActivity(query)
      .then((items) => {
        if (cancelled) return;
        setAnalytics((prev) => ({ ...prev, activity: items }));
        setLoaded((prev) => ({ ...prev, activity: true }));
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded((prev) => ({ ...prev, activity: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [period, dashboard.invalidated]);

  const window = useMemo(() => periodWindow(period), [period]);

  const investorDates = useMemo(
    () => analytics.investors.map((i) => i.createdAt),
    [analytics.investors],
  );
  const enquiryDates = useMemo(
    () => analytics.enquiries.map((e) => e.submittedAt),
    [analytics.enquiries],
  );
  const signalDates = useMemo(
    () => analytics.signals.map((s) => s.generatedAt),
    [analytics.signals],
  );
  const activityDates = useMemo(
    () => analytics.activity.map((a) => a.timestamp),
    [analytics.activity],
  );

  const investorSeries = useMemo(
    () => bucketDates(investorDates, window.startMs, window.endMs, grain),
    [investorDates, window, grain],
  );
  const enquirySeries = useMemo(
    () => bucketDates(enquiryDates, window.startMs, window.endMs, grain),
    [enquiryDates, window, grain],
  );
  const signalSeries = useMemo(
    () => bucketDates(signalDates, window.startMs, window.endMs, grain),
    [signalDates, window, grain],
  );
  const activitySeries = useMemo(
    () => bucketDates(activityDates, window.startMs, window.endMs, grain),
    [activityDates, window, grain],
  );
  const holdingsSeries = useMemo(
    () =>
      compositionSeries(
        analytics.ownership.map(
          (o) => Number(o.currentValue) || Number(o.purchaseValue) || 0,
        ),
        window.startMs,
        window.endMs,
        grain,
      ),
    [analytics.ownership, window, grain],
  );

  const investorDelta = useMemo(
    () => periodDelta(investorDates, window),
    [investorDates, window],
  );
  const enquiryDelta = useMemo(
    () => periodDelta(enquiryDates, window),
    [enquiryDates, window],
  );
  const signalDelta = useMemo(
    () => periodDelta(signalDates, window),
    [signalDates, window],
  );

  const portfolioTotal = useMemo(
    () => sumOwnershipValue(analytics.ownership),
    [analytics.ownership],
  );

  const investorsById = useMemo(() => {
    const map = new Map<
      string,
      { name: string; lastActiveAt: string | null; ownedPropertyCount: number }
    >();
    for (const inv of analytics.investors) {
      map.set(inv.id, {
        name: inv.name,
        lastActiveAt: inv.lastActiveAt,
        ownedPropertyCount: inv.ownedPropertyCount,
      });
    }
    return map;
  }, [analytics.investors]);

  const investorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of analytics.investors) map.set(String(inv.id), inv.name);
    return map;
  }, [analytics.investors]);

  const agentsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of analytics.agents) map.set(a.id, a.name);
    return map;
  }, [analytics.agents]);

  const topInvestors = useMemo(
    () => topInvestorsFromOwnership(analytics.ownership, investorsById, 5),
    [analytics.ownership, investorsById],
  );

  const agentRows = useMemo(
    () =>
      agentsByEnquiry(analytics.enquiries, agentsById, window).slice(0, 5),
    [analytics.enquiries, agentsById, window],
  );

  const activityFeed = useMemo(() => {
    const source =
      analytics.activity.length > 0
        ? analytics.activity
        : (stats?.recentActivity ?? []);
    return [...source]
      .sort(
        (a, b) =>
          Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""),
      )
      .slice(0, 6);
  }, [analytics.activity, stats?.recentActivity]);

  const highPrioritySignals = useMemo(() => {
    const fromStats = stats?.highPrioritySignals ?? [];
    if (fromStats.length > 0) return fromStats.slice(0, 4);
    return analytics.signals
      .filter((s) => String(s.intentLevel).toLowerCase() === "high")
      .slice(0, 4);
  }, [stats?.highPrioritySignals, analytics.signals]);

  const aiInsights = useMemo(() => {
    if (!stats) return [];
    return buildDashboardInsights({
      investorDeltaPct: deltaPct(investorDelta.current, investorDelta.prior),
      enquiryDeltaPct: deltaPct(enquiryDelta.current, enquiryDelta.prior),
      signalDeltaPct: deltaPct(signalDelta.current, signalDelta.prior),
      openEnquiries: stats.openEnquiries,
      highSignals: highPrioritySignals.length,
      totalInvestors: stats.totalInvestors,
      invitedUsers: stats.invitedUsers,
      holdingsTotal: portfolioTotal,
      periodLabel: periodHuman(period),
    });
  }, [
    stats,
    investorDelta,
    enquiryDelta,
    signalDelta,
    highPrioritySignals.length,
    portfolioTotal,
    period,
  ]);

  const holdingsLoading = !loaded.ownership;
  const topInvestorsLoading = !loaded.ownership || !loaded.investors;
  const agentsTableLoading = !loaded.enquiries || !loaded.agents;
  const activityLoading = !loaded.activity;

  const loading =
    !stats &&
    (dashboard.status === "idle" || dashboard.status === "loading");

  if (loading) {
    return <LoadingBlock variant="dashboard" label="Loading dashboard…" />;
  }

  if (!stats) {
    return (
      <div>
        <div className="mb-4 space-y-1">
          <h1 className="font-serif text-2xl tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {dashboard.error ?? "Unable to load dashboard."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <div className="animate-fade-up flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-[1.85rem]">
            Welcome back, {firstName(user?.name)}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Investor growth, enquiries, signals, and holdings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GrainChipGroup value={grain} onChange={setGrain} />
          <PeriodChipGroup value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="glass-panel animate-fade-up flex flex-col gap-2 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <Sparkles className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {aiInsights[0]?.title ?? "Scan the period for material changes"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {aiInsights[0]?.detail ??
                "Insights update from live CRM metrics in the selected window."}
            </p>
          </div>
        </div>
        {aiInsights[0]?.href ? (
          <Link
            href={aiInsights[0].href}
            className="shrink-0 text-[11px] font-medium text-primary hover:underline"
          >
            {aiInsights[0].actionLabel ?? "Investigate"} →
          </Link>
        ) : null}
      </div>

      <div className="animate-stagger grid w-full grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Total investors"
          value={stats.totalInvestors}
          href="/investors"
          hint={investorDelta.label}
          series={investorSeries}
          emphasis
        />
        <StatCard
          label="Open enquiries"
          value={stats.openEnquiries}
          href="/enquiries"
          hint={enquiryDelta.label}
          series={enquirySeries}
          emphasis
        />
        <StatCard
          label="Intent signals"
          value={analytics.signals.length}
          href="/signals"
          hint={signalDelta.label}
          loading={!loaded.signals}
          series={signalSeries}
          emphasis
        />
        <StatCard
          label="Holdings total"
          valueText={formatCurrency(portfolioTotal, true)}
          href="/investors"
          loading={holdingsLoading}
          series={holdingsSeries}
          emphasis
        />
      </div>

      <div className="animate-stagger grid w-full gap-3 xl:h-[450px] xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)] xl:items-stretch">
        {!loaded.investors ? (
          <DashboardChartCard
            title="Investor growth"
            subtitle={investorDelta.label}
            href="/investors"
            className="h-[450px] min-h-0"
          >
            <ChartSkeleton />
          </DashboardChartCard>
        ) : (
          <DashboardSmartChartCard
            title="Investor growth"
            subtitle={investorDelta.label}
            href="/investors"
            data={investorSeries}
            emptyMessage="No investor sign-ups in this period."
            defaultView="area"
            className="h-[450px] min-h-0"
          />
        )}
        <AiInsightsPanel
          insights={aiInsights}
          className="h-[450px] min-h-0"
        />
      </div>

      <div className="animate-stagger grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label="Total agents"
          value={analytics.agents.length}
          href="/users"
          loading={!loaded.agents}
        />
        <StatCard
          label="Active properties"
          value={stats.activeProperties}
          href="/properties"
        />
        <StatCard
          label="Developments"
          value={stats.activeDevelopments}
          href="/developments"
        />
        <StatCard
          label="Invited users"
          value={stats.invitedUsers}
          href="/investors?filter=invited"
        />
      </div>

      <div className="animate-stagger grid w-full gap-3 lg:grid-cols-3">
        {!loaded.enquiries ? (
          <DashboardChartCard
            title="Enquiries received"
            subtitle={enquiryDelta.label}
            href="/enquiries"
            className="min-h-[240px]"
          >
            <ChartSkeleton />
          </DashboardChartCard>
        ) : (
          <DashboardSmartChartCard
            title="Enquiries received"
            subtitle={enquiryDelta.label}
            href="/enquiries"
            data={enquirySeries}
            emptyMessage="No enquiries in this period."
            defaultView="area"
            className="min-h-[240px]"
          />
        )}

        {!loaded.signals ? (
          <DashboardChartCard
            title="Intent signals"
            subtitle={signalDelta.label}
            href="/signals"
            className="min-h-[240px]"
          >
            <ChartSkeleton />
          </DashboardChartCard>
        ) : (
          <DashboardSmartChartCard
            title="Intent signals"
            subtitle={signalDelta.label}
            href="/signals"
            data={signalSeries}
            emptyMessage="No intent signals in this period."
            defaultView="area"
            className="min-h-[240px]"
          />
        )}

        {activityLoading ? (
          <DashboardChartCard
            title="Platform activity"
            subtitle="Events in selected period"
            href="/activity"
            className="min-h-[240px]"
          >
            <ChartSkeleton />
          </DashboardChartCard>
        ) : (
          <DashboardSmartChartCard
            title="Platform activity"
            subtitle="Events in selected period"
            href="/activity"
            data={activitySeries}
            emptyMessage="No activity in this period."
            defaultView="area"
            className="min-h-[240px]"
          />
        )}
      </div>

      <div className="animate-stagger grid w-full gap-3 xl:grid-cols-3">
        <Panel
          title="Top investors"
          href="/investors"
          className="xl:col-span-1"
        >
          {topInvestorsLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : topInvestors.length === 0 ? (
            <Empty>No holdings to rank yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Investor</th>
                    <th className="px-3 py-1.5 font-medium">Holdings</th>
                    <th className="px-3 py-1.5 font-medium">Value</th>
                    <th className="px-3 py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topInvestors.map((row) => (
                    <tr key={row.investorId} className="hover:bg-muted/20">
                      <td className="max-w-[140px] truncate px-3 py-2 text-foreground">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.holdingsCount}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.invested
                          ? formatCurrency(row.invested, true)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/investors/${row.investorId}`}
                          className="text-[11px] text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Agents by enquiry" href="/enquiries">
          {agentsTableLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : agentRows.length === 0 ? (
            <Empty>No enquiries in this period.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">Agent</th>
                    <th className="px-3 py-1.5 font-medium">In</th>
                    <th className="px-3 py-1.5 font-medium">Done</th>
                    <th className="px-3 py-1.5 font-medium">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {agentRows.map((row) => (
                    <tr key={row.agentId} className="hover:bg-muted/20">
                      <td className="max-w-[140px] truncate px-3 py-2 text-foreground">
                        {row.agentName}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.received}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.resolved}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.pending}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Latest activity" href="/activity">
          {activityLoading && activityFeed.length === 0 ? (
            <ListSkeleton rows={5} />
          ) : activityFeed.length === 0 ? (
            <Empty>No recent activity.</Empty>
          ) : (
            <div className="divide-y divide-border">
              {activityFeed.map((a) => {
                const row = formatActivityRow(a, investorNameById);
                const body = (
                  <div
                    className={cn(
                      "grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-2.5 px-3 py-2",
                      row.meta ? "gap-y-0.5" : "",
                    )}
                  >
                    <span className="inline-flex h-5 items-center justify-center truncate rounded border border-border/80 bg-muted/30 px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {row.typeLabel}
                    </span>
                    <p className="min-w-0 truncate text-sm font-medium leading-tight text-foreground">
                      {row.headline}
                    </p>
                    <span className="row-span-2 self-center whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                      {formatActivityTime(a.timestamp)}
                    </span>
                    {row.meta ? (
                      <p className="col-start-2 min-w-0 truncate text-[11px] leading-tight text-muted-foreground">
                        {row.meta}
                      </p>
                    ) : null}
                  </div>
                );
                return row.href ? (
                  <Link
                    key={a.id}
                    href={row.href}
                    className="block transition-colors hover:bg-muted/20"
                  >
                    {body}
                  </Link>
                ) : (
                  <div key={a.id}>{body}</div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="animate-stagger grid w-full gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Section title="High-priority signals" href="/signals">
          {highPrioritySignals.map((s) => (
            <Row
              key={s.id}
              title={s.signalType}
              meta={s.triggeringActivity}
              trailing={<StatusBadge value={s.intentLevel || s.status} />}
            />
          ))}
        </Section>
        <Section title="New enquiries" href="/enquiries">
          {stats.newEnquiries.slice(0, 4).map((e) => (
            <Row
              key={e.id}
              title={e.investorName}
              meta={e.message}
              trailing={<StatusBadge value={e.priority} />}
            />
          ))}
        </Section>
        <Section title="Recent invites" href="/investors">
          {stats.recentInvites.slice(0, 4).map((i) => (
            <Row
              key={i.id}
              title={i.name}
              meta={i.email}
              trailing={<StatusBadge value={i.status} />}
            />
          ))}
        </Section>
        <Section title="HPI updates" href="/properties/price-history">
          {stats.recentPriceUpdates.slice(0, 4).map((log) => (
            <Row
              key={log.id}
              title={
                log.propertyName || log.propertyReference || "Price update"
              }
              meta={[log.regionSlug || log.region, log.refMonth]
                .filter(Boolean)
                .join(" · ")}
              trailing={
                log.percentageChange == null ? undefined : (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      log.percentageChange >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                    )}
                  >
                    {formatPercent(log.percentageChange)}
                  </span>
                )
              }
            />
          ))}
        </Section>
        <Section title="Recent documents" href="/investors">
          {stats.recentDocuments.slice(0, 4).map((d) => (
            <Row
              key={d.id}
              title={d.name}
              meta={`${d.fileType} · ${d.size}`}
              trailing={
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(d.uploadedAt)}
                </span>
              }
            />
          ))}
        </Section>
        <Section title="Recent properties" href="/properties">
          {stats.recentProperties.slice(0, 4).map((p) => (
            <Row
              key={p.id}
              title={p.name}
              meta={p.city || p.location || p.address}
              trailing={<StatusBadge value={p.status} />}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  const bars = [40, 70, 55, 90, 45, 75, 60, 85];
  return (
    <div className="absolute inset-0 flex items-end gap-2 p-3 pt-6 sm:p-4">
      {bars.map((h, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-t-md rounded-b-none"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function TableSkeleton({
  rows = 4,
  cols = 3,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex gap-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-7 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start justify-between gap-2 px-3 py-2"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14 shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
          <Skeleton className="h-3 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  href,
  children,
  className,
}: {
  title: string;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel dash-card w-full min-w-0 overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium">{title}</h2>
        <Link
          href={href}
          className="shrink-0 text-[11px] text-primary hover:underline"
        >
          View
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-5 text-xs text-muted-foreground">{children}</p>
  );
}

function Section({
  title,
  href,
  children,
  emptyMessage = "Nothing to show yet.",
}: {
  title: string;
  href: string;
  children: ReactNode;
  emptyMessage?: string;
}) {
  const hasItems = Children.count(children) > 0;

  return (
    <section className="glass-panel dash-card w-full min-w-0 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
        <h2 className="min-w-0 truncate text-sm font-medium">{title}</h2>
        <Link
          href={href}
          className="shrink-0 text-[11px] text-primary transition-colors hover:underline"
        >
          View
        </Link>
      </div>
      <div className="divide-y divide-white/6">
        {hasItems ? (
          children
        ) : (
          <p className="px-3 py-5 text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function Row({
  title,
  meta,
  trailing,
}: {
  title: string;
  meta: string;
  trailing?: ReactNode;
}) {
  const cleanMeta = meta?.trim();
  return (
    <div className="flex min-w-0 items-start justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-white/4">
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm text-foreground">{title}</p>
        {cleanMeta && cleanMeta !== "—" && cleanMeta !== "-" ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {cleanMeta}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{trailing}</div>
    </div>
  );
}
