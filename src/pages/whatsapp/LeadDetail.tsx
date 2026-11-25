import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Copy,
  HandHelping,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { LeadStatusBadge } from "@/components/whatsapp/LeadStatusBadge";
import {
  INTERAKT_CONNECTED,
  getLeadById,
  leadInitials,
  type InterestLevel,
  type WhatsAppLead,
} from "@/data/whatsappWorkerMock";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Could not copy ${label.toLowerCase()}`),
  );
}

function recommendedAction(lead: WhatsAppLead): {
  title: string;
  detail: string;
  cta: string;
} {
  if (lead.optedOut) {
    return {
      title: "Do not message on WhatsApp",
      detail: "This lead opted out. Keep the record for CRM only.",
      cta: "Open lead pool",
    };
  }
  if (lead.handoffRequested || lead.status === "Human Handoff") {
    return {
      title: "Accept the handoff",
      detail: "Automation is paused. A human needs to pick this conversation up.",
      cta: "Accept handoff",
    };
  }
  if (lead.status === "High Intent" || lead.readiness === "Ready Now") {
    return {
      title: "Push toward consultation",
      detail: `Interest is ${lead.interest.toLowerCase()} and readiness is ${lead.readiness.toLowerCase()}. Share ${lead.assignedRep}'s booking path.`,
      cta: "Follow up now",
    };
  }
  if (lead.status === "Not Contacted" || lead.status === "New") {
    return {
      title: "Start qualification",
      detail: "No outreach yet. Send the approved opener and skip questions already known.",
      cta: "Mark contacted",
    };
  }
  if (lead.status === "No Response") {
    return {
      title: "Nurture, don't chase",
      detail: "No reply after the first opener. Keep on a light cadence until they re-engage.",
      cta: "Move to nurture",
    };
  }
  return {
    title: "Continue qualification",
    detail: lead.conversationSummary,
    cta: "Follow up",
  };
}

function interestTone(level: InterestLevel) {
  if (level === "High") return "text-primary";
  if (level === "Low") return "text-muted-foreground";
  return "text-foreground";
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium text-foreground">{value || "—"}</div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function CopyRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/8">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            className="block truncate text-sm font-medium text-foreground hover:text-primary"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{value}</p>
        )}
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0 rounded-lg"
        aria-label={`Copy ${label}`}
        onClick={() => copyText(label, value)}
      >
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}

export function WhatsAppLeadDetailPage() {
  const params = useParams<{ id: string }>();
  const lead = params.id ? getLeadById(params.id) : undefined;

  if (!lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="This lead is not in the demo pool."
        action={
          <Button asChild className="rounded-xl">
            <Link href="/whatsapp/leads">Back to leads</Link>
          </Button>
        }
      />
    );
  }

  const action = recommendedAction(lead);
  const budget =
    lead.budget != null ? formatCurrency(lead.budget) : "Budget TBC";
  const paused = lead.handoffRequested || lead.optedOut;

  const onPrimary = () => {
    if (lead.optedOut) return;
    if (lead.handoffRequested || lead.status === "Human Handoff") {
      toast.success("Handoff accepted (demo — no API call).");
      return;
    }
    toast.success("Follow-up noted (demo — no API call).");
  };

  return (
    <div className="space-y-5">
      <nav
        className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        aria-label="Breadcrumb"
      >
        <Link href="/whatsapp" className="hover:text-foreground">
          WhatsApp
        </Link>
        <span className="opacity-40" aria-hidden>
          /
        </span>
        <Link href="/whatsapp/leads" className="hover:text-foreground">
          Leads
        </Link>
        <span className="opacity-40" aria-hidden>
          /
        </span>
        <span className="text-foreground/80">{lead.name}</span>
      </nav>

      <section className="glass-panel overflow-hidden rounded-2xl ring-1 ring-white/8">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-serif text-lg font-medium text-primary ring-1 ring-primary/25">
              {leadInitials(lead.name)}
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-[1.75rem]">
                  {lead.name}
                </h1>
                <LeadStatusBadge status={lead.status} />
                <InteraktPill connected={INTERAKT_CONNECTED} />
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {lead.conversationSummary}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10">
                  {lead.market}
                </span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10">
                  {budget}
                </span>
                <span
                  className={cn(
                    "rounded-lg bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10",
                    interestTone(lead.interest),
                  )}
                >
                  {lead.interest} interest
                </span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10">
                  {lead.readiness}
                </span>
                {lead.whatsappConsent ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] text-primary ring-1 ring-primary/20">
                    <ShieldCheck className="size-3" />
                    WhatsApp eligible
                  </span>
                ) : (
                  <span className="rounded-lg bg-destructive/15 px-2 py-1 text-[11px] text-destructive ring-1 ring-destructive/25">
                    No WhatsApp consent
                  </span>
                )}
                {lead.optedOut ? (
                  <span className="rounded-lg bg-destructive/15 px-2 py-1 text-[11px] text-destructive ring-1 ring-destructive/25">
                    Opted out
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/leads">
                <ArrowLeft className="size-3.5" />
                Back to leads
              </Link>
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              disabled={lead.optedOut}
              onClick={onPrimary}
            >
              {paused && !lead.optedOut ? (
                <HandHelping className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              {action.cta}
            </Button>
          </div>
        </div>

        <div className="grid gap-px border-t border-white/8 bg-white/5 sm:grid-cols-3">
          <div className="bg-background/40 px-5 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Assigned rep
            </p>
            <p className="mt-0.5 text-sm font-medium">{lead.assignedRep}</p>
          </div>
          <div className="bg-background/40 px-5 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Source
            </p>
            <p className="mt-0.5 truncate text-sm font-medium">{lead.source}</p>
          </div>
          <div className="bg-background/40 px-5 py-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Last response
            </p>
            <p className="mt-0.5 text-sm font-medium">
              {lead.lastResponseAt
                ? formatDateTime(lead.lastResponseAt)
                : "No reply yet"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          <section className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-eyebrow">Qualification</p>
                <p className="mt-1 text-sm text-muted-foreground">{lead.stage}</p>
              </div>
              <p className="font-serif text-2xl tabular-nums text-primary">
                {lead.qualificationPct}%
              </p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white/8"
              role="progressbar"
              aria-valuenow={lead.qualificationPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Qualification progress"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${Math.min(100, lead.qualificationPct)}%` }}
              />
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Market" value={lead.market} />
              <Field label="Budget" value={budget} />
              <Field label="Funding" value={lead.funding} />
              <Field label="Timeline" value={lead.timeline} />
              <Field
                label="Locations"
                value={
                  lead.preferredLocations.length ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" aria-hidden />
                      {lead.preferredLocations.map((loc) => (
                        <span
                          key={loc}
                          className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs ring-1 ring-white/10"
                        >
                          {loc}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Outreach" value={lead.outreachNote} />
            </dl>
          </section>

          <section className="glass-panel space-y-3 rounded-2xl p-5 ring-1 ring-white/8">
            <p className="label-eyebrow">Evidence Joe is using</p>
            <p className="text-sm leading-relaxed text-foreground">
              {lead.profileNotes}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {lead.conversationSummary}
            </p>
          </section>

          <section className="glass-panel space-y-3 rounded-2xl p-5 ring-1 ring-white/8">
            <p className="label-eyebrow">Contact</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <CopyRow
                icon={Mail}
                label="Email"
                value={lead.email}
                href={`mailto:${lead.email}`}
              />
              <CopyRow
                icon={Phone}
                label="WhatsApp / mobile"
                value={lead.phone}
                href={`tel:${lead.phone}`}
              />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section
            className={cn(
              "glass-panel space-y-3 rounded-2xl p-5 ring-1",
              paused ? "ring-destructive/30" : "ring-primary/25",
            )}
          >
            <p className="label-eyebrow">Recommended next move</p>
            <h2 className="font-serif text-xl font-medium">{action.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {action.detail}
            </p>
            <Button
              className="w-full rounded-xl"
              disabled={lead.optedOut}
              onClick={onPrimary}
            >
              {action.cta}
              <ArrowRight className="size-3.5" />
            </Button>
            {lead.optedOut ? (
              <Button variant="outline" className="w-full rounded-xl" asChild>
                <Link href="/whatsapp/leads">Return to lead pool</Link>
              </Button>
            ) : null}
          </section>

          <section className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8">
            <p className="label-eyebrow">Conversation</p>
            <div className="flex items-center justify-between gap-2">
              <LeadStatusBadge status={lead.status} />
              <span className="text-xs text-muted-foreground">
                {lead.handoffRequested ? "Automation paused" : "Joe handling"}
              </span>
            </div>
            <ol className="space-y-3">
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <MessageCircle className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Last response</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.lastResponseAt
                      ? formatDateTime(lead.lastResponseAt)
                      : "Awaiting first reply"}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/6 text-muted-foreground">
                  <CalendarClock className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Last contacted</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.lastContactedAt
                      ? formatDateTime(lead.lastContactedAt)
                      : "Not contacted"}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/6 text-muted-foreground">
                  <HandHelping className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Human handoff</p>
                  <p className="text-xs text-muted-foreground">
                    {lead.handoffRequested
                      ? "Requested — Joe will not auto-reply"
                      : "Not requested"}
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section className="glass-panel grid grid-cols-2 gap-3 rounded-2xl p-5 ring-1 ring-white/8">
            <Field
              label="Consent"
              value={lead.whatsappConsent ? "Yes" : "No"}
              hint="WhatsApp eligibility"
            />
            <Field
              label="Opt-out"
              value={lead.optedOut ? "Yes" : "No"}
              hint="Blocks outbound"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
