import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, CalendarClock, Rocket } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/EmptyState";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AudiencePreview } from "@/components/whatsapp/AudiencePreview";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import {
  ChartCard,
  DualSeriesChart,
} from "@/components/whatsapp/WorkerCharts";
import {
  CampaignStatusBadge,
  LeadStatusBadge,
} from "@/components/whatsapp/LeadStatusBadge";
import { MetricCard } from "@/components/whatsapp/MetricCard";
import {
  INTERAKT_CONNECTED,
  getWebinarById,
  type CampaignStatus,
  whatsappLeads,
} from "@/data/whatsappWorkerMock";
import { formatDateTime } from "@/lib/format";

export function WhatsAppWebinarNewPage() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [market, setMarket] = useState("UK");
  const [mode, setMode] = useState("Manual");
  const [description, setDescription] = useState("");

  const suggested = useMemo(
    () => [
      `Market focus: ${market}`,
      "Interest: High or Medium",
      "WhatsApp consent: yes",
      "Status not Opted Out",
    ],
    [market],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="New webinar campaign"
        description="Draft a campaign, review smart audience matching, then schedule outreach."
        breadcrumbs={[
          { label: "WhatsApp", href: "/whatsapp" },
          { label: "Webinars", href: "/whatsapp/webinars" },
          { label: "New" },
        ]}
        actions={
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <Link href="/whatsapp/webinars">
              <ArrowLeft className="size-3.5" />
              Cancel
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8">
          <div className="space-y-2">
            <Label htmlFor="web-title">Title</Label>
            <Input
              id="web-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Manchester Yield Briefing"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Market</Label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UK">UK</SelectItem>
                  <SelectItem value="UAE">UAE</SelectItem>
                  <SelectItem value="UK + UAE">UK + UAE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Outreach mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Automatic">Automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="web-desc">Description</Label>
            <Textarea
              id="web-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What this session covers…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-xl"
              onClick={() => {
                toast.success("Draft saved (demo — no API call).");
                setLocation("/whatsapp/webinars");
              }}
            >
              Save draft
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                toast.success("Campaign scheduled (demo — no API call).")
              }
            >
              <CalendarClock className="size-3.5" />
              Schedule
            </Button>
          </div>
        </section>

        <div className="space-y-4">
          <section className="glass-panel space-y-3 rounded-2xl p-5 ring-1 ring-white/8">
            <p className="label-eyebrow">Smart audience matching</p>
            <p className="text-sm text-muted-foreground">
              Suggested criteria from campaign details:
            </p>
            <ul className="space-y-2">
              {suggested.map((c) => (
                <li
                  key={c}
                  className="rounded-xl bg-white/4 px-3 py-2 text-sm ring-1 ring-white/8"
                >
                  {c}
                </li>
              ))}
            </ul>
          </section>
          <AudiencePreview
            data={{
              total: whatsappLeads.length,
              matching: 5,
              whatsappEligible: 4,
              excludedNoConsent: 0,
              optedOut: 1,
              finalAudience: 4,
            }}
            viewLeadsHref="/whatsapp/leads"
          />
        </div>
      </div>
    </div>
  );
}

export function WhatsAppWebinarDetailPage() {
  const params = useParams<{ id: string }>();
  const webinar = params.id ? getWebinarById(params.id) : undefined;

  if (!webinar) {
    return (
      <EmptyState
        title="Webinar not found"
        description="This campaign is not in the demo set."
        action={
          <Button asChild className="rounded-xl">
            <Link href="/whatsapp/webinars">Back to webinars</Link>
          </Button>
        }
      />
    );
  }

  const relevantLeads = whatsappLeads.filter((l) =>
    webinar.relevantLeadIds.includes(l.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={webinar.title}
        description={webinar.description}
        breadcrumbs={[
          { label: "WhatsApp", href: "/whatsapp" },
          { label: "Webinars", href: "/whatsapp/webinars" },
          { label: webinar.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InteraktPill connected={INTERAKT_CONNECTED} />
            <CampaignStatusBadge status={webinar.status} />
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href="/whatsapp/webinars">
                <ArrowLeft className="size-3.5" />
                Back
              </Link>
            </Button>
            {webinar.status === "Draft" || webinar.status === "Scheduled" ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() =>
                    toast.success("Campaign scheduled (demo — no API call).")
                  }
                >
                  <CalendarClock className="size-3.5" />
                  Schedule
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() =>
                    toast.success("Outreach launched (demo — no API call).")
                  }
                >
                  <Rocket className="size-3.5" />
                  Launch
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <span>{webinar.market}</span>
        <span>{formatDateTime(webinar.scheduledAt)} · {webinar.timezone}</span>
        <span>Outreach: {webinar.outreachMode}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Invited"
          value={webinar.engagement.invited}
          spark={[12, 20, 28, 36, 42, webinar.engagement.invited]}
        />
        <MetricCard
          label="Opened"
          value={webinar.engagement.opened}
          spark={[4, 9, 14, 19, 24, webinar.engagement.opened]}
        />
        <MetricCard
          label="Replied"
          value={webinar.engagement.replied}
          spark={[1, 4, 7, 11, 14, webinar.engagement.replied]}
        />
        <MetricCard
          label="Registered"
          value={webinar.engagement.registered}
          spark={[0, 2, 4, 7, 9, webinar.engagement.registered]}
        />
        <MetricCard
          label="Attended"
          value={webinar.engagement.attended}
          spark={[0, 0, 0, 0, 0, webinar.engagement.attended]}
        />
      </div>

      <ChartCard
        className="min-h-[240px]"
        title="Funnel"
        subtitle="Invited → opened → replied → registered"
      >
        <DualSeriesChart
          data={[
            { label: "Invited", a: webinar.engagement.invited, b: webinar.engagement.opened },
            { label: "Opened", a: webinar.engagement.opened, b: webinar.engagement.replied },
            { label: "Replied", a: webinar.engagement.replied, b: webinar.engagement.registered },
            { label: "Registered", a: webinar.engagement.registered, b: webinar.engagement.attended },
          ]}
          aLabel="Stage"
          bLabel="Next stage"
          defaultView="area"
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel space-y-3 rounded-2xl p-5 ring-1 ring-white/8">
          <p className="label-eyebrow">Smart audience matching</p>
          <p className="text-sm text-muted-foreground">
            Suggested criteria from webinar details:
          </p>
          <ul className="space-y-2">
            {webinar.suggestedCriteria.map((c) => (
              <li
                key={c}
                className="rounded-xl bg-white/4 px-3 py-2 text-sm ring-1 ring-white/8"
              >
                {c}
              </li>
            ))}
          </ul>
          <p className="pt-2 text-xs text-muted-foreground">
            Lifecycle:{" "}
            {(
              [
                "Draft",
                "Scheduled",
                "Active",
                "Completed",
                "Cancelled",
              ] as CampaignStatus[]
            ).join(" → ")}
          </p>
        </section>

        <AudiencePreview
          data={webinar.audience}
          viewLeadsHref="/whatsapp/leads"
        />
      </div>

      <section className="glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8">
        <div>
          <h2 className="font-serif text-lg font-medium">Relevant leads</h2>
          <p className="text-sm text-muted-foreground">
            {relevantLeads.length} matched to this campaign
          </p>
        </div>
        {relevantLeads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching leads yet.</p>
        ) : (
          <ul className="divide-y divide-white/8">
            {relevantLeads.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/whatsapp/leads/${lead.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {lead.name}
                  </Link>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {lead.conversationSummary}
                  </p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
