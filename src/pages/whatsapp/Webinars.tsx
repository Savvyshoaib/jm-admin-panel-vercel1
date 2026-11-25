import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CampaignStatusBadge,
} from "@/components/whatsapp/LeadStatusBadge";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { MiniSpark } from "@/components/whatsapp/WorkerCharts";
import {
  INTERAKT_CONNECTED,
  WORKER_NAME,
  type CampaignStatus,
  whatsappWebinars,
} from "@/data/whatsappWorkerMock";
import { formatDateTime } from "@/lib/format";

export function WhatsAppWebinarsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return whatsappWebinars.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (mode !== "all" && w.outreachMode !== mode) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.market.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
      );
    });
  }, [search, status, mode]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webinars"
        description="Relevance, outreach mode, engagement, and audience matching for campaign outreach."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InteraktPill connected={INTERAKT_CONNECTED} />
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => {
                toast.message("Create webinar (demo)", {
                  description: "Opening draft form — mock only.",
                });
                setLocation("/whatsapp/webinars/new");
              }}
            >
              <Plus className="size-3.5" />
              Add webinar
            </Button>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground">{WORKER_NAME}</p>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search webinars…"
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(
              [
                "Draft",
                "Scheduled",
                "Active",
                "Completed",
                "Cancelled",
              ] as CampaignStatus[]
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Outreach mode">
            <SelectValue placeholder="Outreach" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="Manual">Manual</SelectItem>
            <SelectItem value="Automatic">Automatic</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No webinars match"
          description="Adjust filters or create a new webinar campaign."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((w) => (
            <li key={w.id}>
              <Link
                href={`/whatsapp/webinars/${w.id}`}
                className="glass-panel flex h-full flex-col gap-3 rounded-2xl p-5 ring-1 ring-white/8 transition-colors hover:bg-white/6"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-serif text-lg font-medium">{w.title}</h2>
                  <CampaignStatusBadge status={w.status} />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {w.description}
                </p>
                <div className="mt-auto space-y-2">
                  <MiniSpark
                    values={[
                      w.engagement.invited,
                      w.engagement.opened,
                      w.engagement.replied,
                      w.engagement.registered,
                      Math.max(w.engagement.attended, 1),
                    ]}
                  />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{w.market}</span>
                    <span>{formatDateTime(w.scheduledAt)}</span>
                    <span>{w.outreachMode}</span>
                    <span>{w.relevantLeadIds.length} relevant</span>
                    <span>
                      {w.engagement.registered} registered ·{" "}
                      {w.engagement.replied} replied
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
