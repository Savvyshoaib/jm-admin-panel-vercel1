import { Link } from "wouter";
import {
  CalendarDays,
  CheckCircle2,
  HandHelping,
  MessageCircle,
  Percent,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { LeadStatusBadge } from "@/components/whatsapp/LeadStatusBadge";
import { MetricCard } from "@/components/whatsapp/MetricCard";
import {
  ChartCard,
  DualSeriesChart,
  HorizontalStatusChart,
  MarketShareChart,
} from "@/components/whatsapp/WorkerCharts";
import {
  INTERAKT_CONNECTED,
  WORKER_NAME,
  engagementSeries,
  getLeadById,
  leadsNeedingAttention,
  marketInterest,
  metricSparks,
  overviewMetrics,
  pipelineByStatus,
  recentActivity,
  upcomingWebinars,
  whatsappActivitySeries,
} from "@/data/whatsappWorkerMock";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const metricIcons = {
  total: Users,
  new: UserPlus,
  contacted: MessageCircle,
  active: MessageCircle,
  response: Percent,
  no_response: Percent,
  high_intent: Sparkles,
  handoffs: HandHelping,
  bookings: CheckCircle2,
  webinars: CalendarDays,
} as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export function WhatsAppOverviewPage() {
  const attention = leadsNeedingAttention();
  const webinars = upcomingWebinars().slice(0, 10);
  const bestNext = getLeadById("lead-priya");
  const relevantLeadCount = new Set(
    webinars.flatMap((w) => w.relevantLeadIds),
  ).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{WORKER_NAME}</p>
            <InteraktPill connected={INTERAKT_CONNECTED} />
          </div>
          <p className="text-xs text-muted-foreground">{todayLabel()}</p>
          <h1 className="font-serif text-3xl font-medium tracking-tight">
            {greeting()}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {attention.length} leads need attention ·{" "}
            {overviewMetrics.find((m) => m.key === "high_intent")?.value} high
            intent · {overviewMetrics.find((m) => m.key === "handoffs")?.value}{" "}
            handoffs · {webinars.length} upcoming webinars.
          </p>
        </div>
        <div className="rounded-xl bg-white/4 px-3 py-2 text-sm ring-1 ring-white/8">
          <p className="font-medium">{WORKER_NAME}</p>
          <p className="text-xs text-muted-foreground">
            {overviewMetrics[0]?.value} leads · Joseph Mews
          </p>
        </div>
      </div>

      <section aria-label="Agent performance" className="space-y-3">
        <p className="label-eyebrow">Insights · Agent performance</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {overviewMetrics.map((m) => {
            const Icon = metricIcons[m.key as keyof typeof metricIcons];
            return (
              <MetricCard
                key={m.key}
                label={m.label}
                value={m.value}
                hint={m.hint}
                tone={m.tone}
                icon={Icon}
                spark={metricSparks[m.key]}
              />
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label="Decisions waiting"
          className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8"
        >
          <div>
            <p className="label-eyebrow">Decisions waiting on you</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {attention.length}
              </span>{" "}
              leads need a human decision. High intent and handoffs first.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/leads?filter=high_intent">
                3 High intent
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/leads?filter=handoff">1 Handoffs</Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/leads?filter=active">1 Active chats</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label="Best next move"
          className="glass-panel space-y-3 rounded-2xl p-5 ring-1 ring-primary/25"
        >
          <p className="label-eyebrow">Today&apos;s best next move</p>
          {bestNext ? (
            <>
              <h2 className="font-serif text-xl font-medium">{bestNext.name}</h2>
              <p className="text-sm text-muted-foreground">
                {bestNext.conversationSummary}
              </p>
              <p className="text-xs text-muted-foreground">
                {bestNext.assignedRep} · {bestNext.status} ·{" "}
                {bestNext.interest} interest
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" className="rounded-xl" asChild>
                  <Link href={`/whatsapp/leads/${bestNext.id}`}>Open profile</Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl">
                  Accept
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl">
                  Skip
                </Button>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Lead engagement"
          subtitle="71% response rate · 7 contacted"
        >
          <DualSeriesChart
            data={engagementSeries.map((d) => ({
              label: d.label,
              a: d.contacted,
              b: d.responses,
            }))}
            aLabel="Contacted"
            bLabel="Responses"
            defaultView="area"
          />
        </ChartCard>

        <ChartCard
          title="Pipeline by status"
          subtitle={`${pipelineByStatus.reduce((s, r) => s + r.count, 0)} in pipeline`}
        >
          <HorizontalStatusChart
            data={pipelineByStatus.map((r) => ({
              status: r.status,
              count: r.count,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="WhatsApp activity"
          subtitle="42 responses · 16 high intent · 7d"
        >
          <DualSeriesChart
            data={whatsappActivitySeries.map((d) => ({
              label: d.label,
              a: d.responses,
              b: d.highIntent,
            }))}
            aLabel="Responses"
            bLabel="High intent"
            defaultView="bars"
          />
        </ChartCard>

        <ChartCard
          title="Market interest"
          subtitle="48% lean UK · 88 leads"
        >
          <MarketShareChart data={marketInterest} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-label="Upcoming webinars"
          className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-medium">
                Upcoming relevant webinars
              </h2>
              <p className="text-sm text-muted-foreground">
                Showing {webinars.length} · {relevantLeadCount} relevant leads
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/webinars">Open webinars</Link>
            </Button>
          </div>
          <ul className="divide-y divide-white/8">
            {webinars.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/whatsapp/webinars/${w.id}`}
                  className={cn(
                    "flex flex-col gap-0.5 py-3 transition-colors hover:text-primary sm:flex-row sm:items-center sm:justify-between",
                  )}
                >
                  <span className="text-sm font-medium">{w.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.market} · {w.scheduledAt.slice(0, 10)} ·{" "}
                    {w.relevantLeadIds.length} relevant · {w.outreachMode}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-label="Recent lead activity"
          className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8"
        >
          <div>
            <h2 className="font-serif text-lg font-medium">Recently captured</h2>
            <p className="text-sm text-muted-foreground">
              Live activity from Joe conversations
            </p>
          </div>
          <ul className="space-y-3">
            {recentActivity.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/whatsapp/leads/${a.leadId}`}
                  className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-white/4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {a.initials}
                  </span>
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium">{a.leadName}</span>
                    <span className="block text-xs text-muted-foreground line-clamp-2">
                      {a.summary}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDateTime(a.at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        aria-label="Leads that need attention"
        className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-medium">
              Leads that need attention
            </h2>
            <p className="text-sm text-muted-foreground">
              Human handoff and high intent — status, rep, and conversation
              summary.
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/whatsapp/leads">Open leads</Link>
          </Button>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {attention.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/whatsapp/leads/${lead.id}`}
                className="flex flex-col gap-2 rounded-xl bg-white/4 p-4 ring-1 ring-white/8 transition-colors hover:bg-white/6"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{lead.name}</span>
                  <LeadStatusBadge status={lead.status} />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {lead.conversationSummary}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lead.assignedRep}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
