import { Link } from "wouter";
import {
  ArrowRight,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AiInsightKind = "anomaly" | "trend" | "opportunity" | "watch";

export type AiInsight = {
  id: string;
  kind: AiInsightKind;
  title: string;
  detail: string;
  confidence: number;
  href?: string;
  actionLabel?: string;
  metric?: string;
};

const kindMeta: Record<
  AiInsightKind,
  { label: string; icon: typeof Sparkles; className: string }
> = {
  anomaly: {
    label: "Anomaly",
    icon: TriangleAlert,
    className: "border-error/30 bg-error/10 text-error",
  },
  trend: {
    label: "Trend",
    icon: TrendingUp,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  opportunity: {
    label: "Opportunity",
    icon: Lightbulb,
    className: "border-primary/25 bg-gold-soft text-primary",
  },
  watch: {
    label: "Watch",
    icon: TrendingDown,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

export function AiInsightsPanel({
  insights,
  className,
  title = "AI insights",
  subtitle = "What changed, why it matters, what to do next",
}: {
  insights: AiInsight[];
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section
      className={cn(
        "glass-panel dash-card flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25">
              <Sparkles className="size-3" />
            </span>
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 font-normal">
          {insights.length} live
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
        {insights.length === 0 ? (
          <div className="flex h-full min-h-[80px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
            No material changes in this period yet.
          </div>
        ) : (
          insights.map((insight, index) => {
            const meta = kindMeta[insight.kind];
            const Icon = meta.icon;
            return (
              <article
                key={insight.id}
                className="animate-fade-up rounded-xl border border-white/8 bg-white/[0.03] p-2.5 transition-colors hover:bg-white/[0.055]"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                        meta.className,
                      )}
                    >
                      <Icon className="size-3" />
                      {meta.label}
                    </span>
                    {insight.metric ? (
                      <span className="truncate text-[10px] text-muted-foreground">
                        {insight.metric}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(insight.confidence * 100)}% conf.
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-medium leading-snug text-foreground">
                  {insight.title}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {insight.detail}
                </p>
                {insight.href ? (
                  <div className="mt-1.5">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px] text-primary"
                    >
                      <Link href={insight.href}>
                        {insight.actionLabel ?? "Investigate"}
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

/** Build operator insights from live dashboard metrics — no invented API data. */
export function buildDashboardInsights(input: {
  investorDeltaPct: number | null;
  enquiryDeltaPct: number | null;
  signalDeltaPct: number | null;
  openEnquiries: number;
  highSignals: number;
  totalInvestors: number;
  invitedUsers: number;
  holdingsTotal: number;
  periodLabel: string;
}): AiInsight[] {
  const insights: AiInsight[] = [];
  const {
    investorDeltaPct,
    enquiryDeltaPct,
    signalDeltaPct,
    openEnquiries,
    highSignals,
    totalInvestors,
    invitedUsers,
    holdingsTotal,
    periodLabel,
  } = input;

  if (investorDeltaPct != null && investorDeltaPct >= 15) {
    insights.push({
      id: "inv-up",
      kind: "trend",
      title: `Investor sign-ups up ${Math.round(investorDeltaPct)}%`,
      detail: `New investor creation accelerated versus the prior ${periodLabel}. Review which agents and channels drove the lift.`,
      confidence: 0.82,
      href: "/investors",
      actionLabel: "Review investors",
      metric: "Investors",
    });
  } else if (investorDeltaPct != null && investorDeltaPct <= -15) {
    insights.push({
      id: "inv-down",
      kind: "anomaly",
      title: `Investor growth slowed ${Math.abs(Math.round(investorDeltaPct))}%`,
      detail: `Sign-ups are softer than the previous ${periodLabel}. Check invite conversion and agent follow-up queues.`,
      confidence: 0.78,
      href: "/investors?filter=invited",
      actionLabel: "Check invites",
      metric: "Investors",
    });
  }

  if (enquiryDeltaPct != null && enquiryDeltaPct >= 20) {
    insights.push({
      id: "enq-up",
      kind: "opportunity",
      title: `Enquiry volume rising (${Math.round(enquiryDeltaPct)}%)`,
      detail: `Inbound interest is up. Prioritise open enquiries before SLA slip and assign agents where needed.`,
      confidence: 0.8,
      href: "/enquiries",
      actionLabel: "Triage enquiries",
      metric: "Enquiries",
    });
  } else if (openEnquiries >= 8) {
    insights.push({
      id: "enq-open",
      kind: "watch",
      title: `${openEnquiries} open enquiries need attention`,
      detail: "A growing open queue can hide high-intent investors. Clear aging items first.",
      confidence: 0.74,
      href: "/enquiries",
      actionLabel: "Open queue",
      metric: "Enquiries",
    });
  }

  if (highSignals >= 3) {
    insights.push({
      id: "sig-high",
      kind: "opportunity",
      title: `${highSignals} high-intent signals ready`,
      detail: "Behavioural intent is clustering. Convert with a personalised follow-up while interest is warm.",
      confidence: 0.86,
      href: "/signals",
      actionLabel: "View signals",
      metric: "Signals",
    });
  } else if (signalDeltaPct != null && signalDeltaPct <= -25) {
    insights.push({
      id: "sig-down",
      kind: "watch",
      title: "Intent signal volume cooled",
      detail: `Signals are quieter than the prior ${periodLabel}. Cross-check content engagement and calculator usage.`,
      confidence: 0.7,
      href: "/signals",
      actionLabel: "Inspect signals",
      metric: "Signals",
    });
  }

  if (invitedUsers > 0 && totalInvestors > 0) {
    const inviteShare = invitedUsers / Math.max(totalInvestors, 1);
    if (inviteShare >= 0.25) {
      insights.push({
        id: "invite-share",
        kind: "trend",
        title: "Invite pipeline is a large share of CRM",
        detail: `${invitedUsers} invited users sit in the book. Push acceptance nudges to improve activation.`,
        confidence: 0.76,
        href: "/investors?filter=invited",
        actionLabel: "Nudge invites",
        metric: "Invites",
      });
    }
  }

  if (holdingsTotal > 0) {
    insights.push({
      id: "holdings",
      kind: "trend",
      title: "Holdings value is tracking",
      detail: "Portfolio ownership totals are available for investor ranking and agent conversations.",
      confidence: 0.68,
      href: "/investors",
      actionLabel: "Top investors",
      metric: "Holdings",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady",
      kind: "watch",
      title: "Ops look steady this period",
      detail: "No sharp swings detected across investors, enquiries, or signals. Keep scanning high-intent queues.",
      confidence: 0.6,
      href: "/activity",
      actionLabel: "Activity log",
      metric: "Overview",
    });
  }

  return insights.slice(0, 5);
}
