import { useMemo, useState } from "react";
import { Megaphone, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailWorkspace } from "@/components/mail/MailWorkspace";
import {
  getTemplateName,
  mailCampaigns,
  type MailCampaign,
  type MailCampaignStatus,
} from "@/data/mailingMock";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusTone: Record<MailCampaignStatus, string> = {
  Draft: "border-border bg-muted/60 text-muted-foreground",
  Scheduled: "border-primary/35 bg-gold-soft text-primary",
  Sending: "border-primary/40 bg-primary/10 text-foreground",
  Sent: "border-border bg-foreground/10 text-foreground",
  Paused: "border-destructive/30 bg-destructive/10 text-destructive",
};

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function CampaignCard({
  campaign,
  active,
  onSelect,
}: {
  campaign: MailCampaign;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border px-3.5 py-3.5 text-left transition-all",
        active
          ? "border-primary/30 bg-card ring-1 ring-primary/20"
          : "border-transparent hover:border-border/70 hover:bg-card/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {campaign.name}
        </p>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-sm font-normal",
            statusTone[campaign.status],
          )}
        >
          {campaign.status}
        </Badge>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {campaign.subject}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {campaign.audienceLabel}
      </p>
    </button>
  );
}

export function MailCampaignsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | MailCampaignStatus>("all");
  const [selectedId, setSelectedId] = useState(mailCampaigns[0]?.id ?? null);

  const rows = useMemo(() => {
    let list = [...mailCampaigns];
    if (status !== "all") list = list.filter((c) => c.status === status);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        [c.name, c.subject, c.audienceLabel, c.status]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [query, status]);

  const selected: MailCampaign | null =
    rows.find((c) => c.id === selectedId) ?? rows[0] ?? null;

  return (
    <MailWorkspace>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" />
              <h1 className="text-base font-medium text-foreground">Campaigns</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Schedule and track bulk investor emails from the admin dashboard.
            </p>
          </div>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => toast.message("New campaign (UI mock — API later)")}
          >
            <Plus className="size-4" />
            New campaign
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns…"
              className="rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              ["all", "Draft", "Scheduled", "Sending", "Sent", "Paused"] as const
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                  status === s
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 w-full overflow-y-auto border-b border-border/70 p-3 lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-96">
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No campaigns match.
                </p>
              ) : (
                rows.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    active={c.id === selected?.id}
                    onSelect={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {selected ? (
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-sm font-normal",
                        statusTone[selected.status],
                      )}
                    >
                      {selected.status}
                    </Badge>
                    <h2 className="text-xl font-medium tracking-tight text-foreground">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.subject}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        toast.message("Edit campaign (UI mock — API later)")
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={() =>
                        toast.success(
                          selected.status === "Draft"
                            ? "Campaign scheduled (UI mock)"
                            : "Campaign action queued (UI mock)",
                        )
                      }
                    >
                      {selected.status === "Draft" ? "Schedule" : "View report"}
                    </Button>
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
                    <dt className="text-xs text-muted-foreground">Audience</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {selected.audienceLabel}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
                    <dt className="text-xs text-muted-foreground">Template</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {getTemplateName(selected.templateId)}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
                    <dt className="text-xs text-muted-foreground">Scheduled</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {selected.scheduledAt
                        ? formatDateTime(selected.scheduledAt)
                        : "—"}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-card/40 p-4">
                    <dt className="text-xs text-muted-foreground">Sent</dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {selected.sentAt
                        ? formatDateTime(selected.sentAt)
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="rounded-2xl border border-border/80 bg-card/40 p-5">
                  <p className="label-eyebrow mb-4">Delivery</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {(
                      [
                        ["Recipients", selected.stats.recipients, null],
                        [
                          "Delivered",
                          selected.stats.delivered,
                          pct(
                            selected.stats.delivered,
                            selected.stats.recipients,
                          ),
                        ],
                        [
                          "Opened",
                          selected.stats.opened,
                          pct(
                            selected.stats.opened,
                            selected.stats.delivered || selected.stats.recipients,
                          ),
                        ],
                        [
                          "Clicked",
                          selected.stats.clicked,
                          pct(
                            selected.stats.clicked,
                            selected.stats.opened || selected.stats.delivered,
                          ),
                        ],
                      ] as const
                    ).map(([label, value, rate]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-lg font-medium text-foreground">
                          {value}
                        </p>
                        {rate ? (
                          <p className="text-[11px] text-primary">{rate}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a campaign.</p>
            )}
          </div>
        </div>
      </div>
    </MailWorkspace>
  );
}
