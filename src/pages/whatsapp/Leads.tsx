import { useMemo, useState } from "react";
import { useLocation } from "wouter";
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
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { LeadStatusBadge } from "@/components/whatsapp/LeadStatusBadge";
import { MetricCard } from "@/components/whatsapp/MetricCard";
import {
  INTERAKT_CONNECTED,
  WORKER_NAME,
  leadInitials,
  type InterestLevel,
  type LeadStatus,
  type MarketFocus,
  whatsappLeads,
} from "@/data/whatsappWorkerMock";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type QuickFilter =
  | "all"
  | "high_intent"
  | "active"
  | "handoff"
  | "no_response"
  | "not_contacted"
  | "high_interest";

function readQuickFromSearch(): QuickFilter {
  try {
    const q = new URLSearchParams(window.location.search).get("filter");
    if (
      q === "high_intent" ||
      q === "active" ||
      q === "handoff" ||
      q === "no_response" ||
      q === "not_contacted" ||
      q === "high_interest"
    ) {
      return q;
    }
  } catch {
    /* ignore */
  }
  return "all";
}

const quickFilters: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high_intent", label: "High intent" },
  { key: "active", label: "Active" },
  { key: "handoff", label: "Handoff" },
  { key: "no_response", label: "No response" },
  { key: "not_contacted", label: "Not contacted" },
];

function matchesQuick(status: LeadStatus, quick: QuickFilter): boolean {
  switch (quick) {
    case "high_intent":
      return status === "High Intent";
    case "active":
      return status === "Active Conversation";
    case "handoff":
      return status === "Human Handoff";
    case "no_response":
      return status === "No Response";
    case "not_contacted":
      return status === "Not Contacted" || status === "New";
    case "high_interest":
      return true;
    default:
      return true;
  }
}

export function WhatsAppLeadsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>(readQuickFromSearch);
  const [interest, setInterest] = useState<string>("all");
  const [market, setMarket] = useState<string>("all");
  const [rep, setRep] = useState<string>("all");

  const highInterestCount = whatsappLeads.filter((l) => l.interest === "High").length;
  const handoffCount = whatsappLeads.filter((l) => l.status === "Human Handoff").length;

  const reps = useMemo(
    () => [...new Set(whatsappLeads.map((l) => l.assignedRep))].sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return whatsappLeads.filter((lead) => {
      if (quick === "high_interest" && lead.interest !== "High") return false;
      if (!matchesQuick(lead.status, quick)) return false;
      if (interest !== "all" && lead.interest !== interest) return false;
      if (market !== "all" && lead.market !== market) return false;
      if (rep !== "all" && lead.assignedRep !== rep) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.source.toLowerCase().includes(q) ||
        lead.assignedRep.toLowerCase().includes(q)
      );
    });
  }, [search, quick, interest, market, rep]);

  const setQuickFilter = (key: QuickFilter) => {
    setQuick(key);
    const url = key === "all" ? "/whatsapp/leads" : `/whatsapp/leads?filter=${key}`;
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Search and filter the pool, then open a profile for qualification and handoff context."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{WORKER_NAME}</span>
            <InteraktPill connected={INTERAKT_CONNECTED} />
          </div>
        }
      />

      <section aria-label="Lead pool" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="In pool" value={whatsappLeads.length} hint="All leads" />
        <MetricCard label="Showing" value={filtered.length} hint="Current filters" />
        <MetricCard
          label="High interest"
          value={highInterestCount}
          hint="Click to filter"
          tone="up"
          onClick={() => setQuickFilter("high_interest")}
        />
        <MetricCard
          label="Need human"
          value={handoffCount}
          hint="Handoffs"
          tone="down"
          onClick={() => setQuickFilter("handoff")}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        {quickFilters.map((f) => {
          const count =
            f.key === "all"
              ? undefined
              : whatsappLeads.filter((l) => matchesQuick(l.status, f.key)).length;
          return (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={quick === f.key ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setQuickFilter(f.key)}
            >
              {f.label}
              {count !== undefined ? (
                <span className="ml-1 opacity-70">{count}</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Name, phone, email, source…"
      >
        <Select value={interest} onValueChange={setInterest}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Interest">
            <SelectValue placeholder="Interest" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All interest</SelectItem>
            {(["High", "Medium", "Low", "Unknown"] as InterestLevel[]).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={market} onValueChange={setMarket}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Market">
            <SelectValue placeholder="Market" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All market</SelectItem>
            {(["UK", "UAE", "UK + UAE", "Undecided"] as MarketFocus[]).map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rep} onValueChange={setRep}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Assigned rep">
            <SelectValue placeholder="Assigned rep" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assigned rep</SelectItem>
            {reps.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No leads match"
          description="Try clearing filters or widening the search."
          action={
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setSearch("");
                setQuickFilter("all");
                setInterest("all");
                setMarket("all");
                setRep("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => setLocation(`/whatsapp/leads/${lead.id}`)}
                className={cn(
                  "glass-panel flex w-full flex-col gap-3 rounded-2xl p-4 text-left ring-1 ring-white/8 transition-colors hover:bg-white/6 sm:flex-row sm:items-start sm:justify-between",
                )}
              >
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {leadInitials(lead.name)}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{lead.name}</span>
                      <LeadStatusBadge status={lead.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone} · {lead.market}
                      {lead.budget != null
                        ? ` · ${formatCurrency(lead.budget)}`
                        : " · Budget TBC"}{" "}
                      · {lead.interest} interest
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {lead.conversationSummary}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 space-y-1 text-xs text-muted-foreground sm:text-right">
                  <p>{lead.assignedRep}</p>
                  <p>{lead.source}</p>
                  <p>
                    {lead.lastResponseAt
                      ? formatDateTime(lead.lastResponseAt)
                      : "No response yet"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
