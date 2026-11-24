import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/format";
import type { IntentSignal } from "@/models";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureInvestors } from "@/store/slices/investorsSlice";
import { ensureSignals } from "@/store/slices/signalsSlice";

type DateFilter = "all" | "last_3" | "last_7" | "last_30" | "last_90" | "older";

function matchesDateFilter(generatedAt: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(generated)) return filter === "older";
  const days = (Date.now() - generated) / 86_400_000;
  if (filter === "last_3") return days <= 3;
  if (filter === "last_7") return days <= 7;
  if (filter === "last_30") return days <= 30;
  if (filter === "last_90") return days <= 90;
  return days > 90;
}

export function SignalsPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const signalsState = useAppSelector((s) => s.signals);
  const investors = useAppSelector((s) => s.investors.items);
  const [search, setSearch] = useState("");
  const [strength, setStrength] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void dispatch(ensureInvestors())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
  }, [dispatch]);

  useEffect(() => {
    void dispatch(
      ensureSignals({
        strength: strength === "all" ? undefined : strength,
        limit: 200,
      }),
    )
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load signals.");
      });
  }, [dispatch, strength, signalsState.invalidated]);

  const investorName = (row: IntentSignal) =>
    investors.find((i) => String(i.id) === String(row.investorId))?.name ??
    (row.investorId || "—");

  const rows = useMemo(() => {
    let items = signalsState.items;
    if (user?.role === "agent") {
      const scoped = new Set(user.assignedInvestorIds.map(String));
      items = items.filter((s) => scoped.has(String(s.investorId)));
    }
    if (dateFilter !== "all") {
      items = items.filter((s) => matchesDateFilter(s.generatedAt, dateFilter));
    }
    const q = search.toLowerCase().trim();
    if (q) {
      items = items.filter((s) => {
        const name = investorName(s).toLowerCase();
        return (
          name.includes(q) ||
          s.signalType.toLowerCase().includes(q) ||
          (s.triggeringActivity || "").toLowerCase().includes(q) ||
          String(s.investorId).toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [signalsState.items, user, dateFilter, search, investors]);

  const columns: Column<IntentSignal>[] = [
    {
      key: "investor",
      header: "Investor",
      cell: (r) => investorName(r),
    },
    { key: "type", header: "Signal", cell: (r) => r.signalType },
    {
      key: "evidence",
      header: "Evidence",
      cell: (r) => r.triggeringActivity || "—",
    },
    {
      key: "strength",
      header: "Strength",
      cell: (r) => <StatusBadge value={r.intentLevel} />,
    },
    {
      key: "date",
      header: "Generated",
      cell: (r) => formatDateTime(r.generatedAt),
    },
  ];

  const signalsLoading =
    (signalsState.status === "loading" || signalsState.status === "idle") &&
    signalsState.items.length === 0;

  if (signalsLoading) return <LoadingBlock variant="table" />;

  if (signalsState.status === "failed" && signalsState.items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Intent Signals"
          description="Sales signals from investor activity."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {signalsState.error ?? "Unable to load signals."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() =>
                void dispatch(
                  ensureSignals({
                    force: true,
                    strength: strength === "all" ? undefined : strength,
                    limit: 200,
                  }),
                )
              }
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Intent Signals"
        description="Sales signals from investor activity."
      />
      <div className="space-y-4">
        <FilterBar
          search={search}
          searchPlaceholder="Search by investor name, signal, evidence…"
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
        >
          <Select
            value={strength}
            onValueChange={(v) => {
              setStrength(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Strength" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All strengths</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateFilter}
            onValueChange={(v) => {
              setDateFilter(v as DateFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any date</SelectItem>
              <SelectItem value="last_3">Last 3 days</SelectItem>
              <SelectItem value="last_7">Last 7 days</SelectItem>
              <SelectItem value="last_30">Last 30 days</SelectItem>
              <SelectItem value="last_90">Last 90 days</SelectItem>
              <SelectItem value="older">Older than 90 days</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          page={page}
          onPageChange={setPage}
          emptyTitle="No results"
          emptyDescription="Try adjusting filters or wait for new investor signals."
        />
      </div>
    </div>
  );
}
