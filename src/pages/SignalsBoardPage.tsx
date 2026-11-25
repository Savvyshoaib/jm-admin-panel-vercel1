import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { SignalsBoard } from "@/components/admin/SignalsBoard";
import { SignalDetailSheet } from "@/components/admin/SignalDetailSheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatDateTime, titleCase } from "@/lib/format";
import {
  isNumericApiId,
  mergeSignalPatch,
  mockSignalSaveMessage,
  readAssigneeOverlay,
  readPatchOverlay,
  resolveSignalAssigneeId,
  setSignalAssignee,
  type SignalAssigneeOverlay,
  type SignalPatchOverlay,
} from "@/lib/signalBoardMock";
import type { IntentSignal, SignalStatus } from "@/models";
import { updateInvestor } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureAgents } from "@/store/slices/agentsSlice";
import { ensureInvestors, upsertInvestor } from "@/store/slices/investorsSlice";
import {
  ensureSignals,
  patchSignalThunk,
  upsertSignal,
} from "@/store/slices/signalsSlice";

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

export function SignalsBoardPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const signalsState = useAppSelector((s) => s.signals);
  const investors = useAppSelector((s) => s.investors.items);
  const agents = useAppSelector((s) => s.agents.items);

  const [search, setSearch] = useState("");
  const [strength, setStrength] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"board" | "list">("board");
  const [overlay, setOverlay] = useState<SignalAssigneeOverlay>(() =>
    readAssigneeOverlay(),
  );
  const [patchOverlay, setPatchOverlay] = useState<SignalPatchOverlay>(() =>
    readPatchOverlay(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(ensureInvestors())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
    void dispatch(ensureAgents())
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

  const investorById = useMemo(() => {
    const map = new Map(investors.map((i) => [String(i.id), i]));
    return map;
  }, [investors]);

  const agentNameById = useMemo(() => {
    const map = new Map(agents.map((a) => [String(a.id), a.name]));
    return map;
  }, [agents]);

  const investorName = (row: IntentSignal) =>
    investorById.get(String(row.investorId))?.name ??
    (row.investorId || "—");

  const assigneeIdFor = (row: IntentSignal) => {
    const inv = investorById.get(String(row.investorId));
    return resolveSignalAssigneeId(
      row.id,
      row.assignedAgentId,
      inv?.assignedAgentId ?? null,
      overlay,
    );
  };

  const assigneeNameFor = (row: IntentSignal) => {
    const id = assigneeIdFor(row);
    if (!id) return null;
    return agentNameById.get(String(id)) ?? `Agent ${id}`;
  };

  const rows = useMemo(() => {
    let items = signalsState.items.map((s) => {
      const local = patchOverlay[s.id];
      if (!local) return s;
      return {
        ...s,
        ...(local.status ? { status: local.status as IntentSignal["status"] } : {}),
        ...(local.agentNotes != null ? { agentNotes: local.agentNotes } : {}),
        ...(local.intentLevel
          ? { intentLevel: local.intentLevel as IntentSignal["intentLevel"] }
          : {}),
      };
    });
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
        const assignee = (assigneeNameFor(s) || "").toLowerCase();
        return (
          name.includes(q) ||
          assignee.includes(q) ||
          s.signalType.toLowerCase().includes(q) ||
          (s.triggeringActivity || "").toLowerCase().includes(q) ||
          String(s.investorId).toLowerCase().includes(q) ||
          titleCase(s.status).toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [
    signalsState.items,
    patchOverlay,
    user,
    dateFilter,
    search,
    investors,
    overlay,
    agents,
  ]);

  const boardRows = useMemo(
    () =>
      rows.map((s) => ({
        ...s,
        investorName: investorName(s),
        assigneeName: assigneeNameFor(s),
      })),
    [rows, investors, overlay, agents],
  );

  const selected = useMemo(
    () =>
      selectedId
        ? rows.find((s) => String(s.id) === String(selectedId)) ?? null
        : null,
    [selectedId, rows],
  );

  const patchSignal = async (
    id: string,
    patch: Partial<Pick<IntentSignal, "status" | "agentNotes" | "intentLevel">>,
    optimistic?: IntentSignal,
  ) => {
    const next = { ...(optimistic ?? { id } as IntentSignal), ...patch, id };
    dispatch(upsertSignal(next as IntentSignal));
    setPatchOverlay((prev) => mergeSignalPatch(id, patch, prev));

    // Qiko composite ids are not valid for PATCH /admin/signals/:int — demo locally.
    if (!isNumericApiId(id)) {
      return next as IntentSignal;
    }

    const updated = await dispatch(patchSignalThunk({ id, patch })).unwrap();
    dispatch(upsertSignal({ ...next, ...updated, id } as IntentSignal));
    return updated;
  };

  const handleMove = async (signalId: string, nextStatus: SignalStatus) => {
    const current = rows.find((s) => String(s.id) === String(signalId));
    if (!current || current.status === nextStatus) return;
    const prev = current;
    setMovingId(signalId);
    dispatch(upsertSignal({ ...current, status: nextStatus }));
    try {
      await patchSignal(
        signalId,
        { status: nextStatus },
        { ...current, status: nextStatus },
      );
      toast.success(
        isNumericApiId(signalId)
          ? `Moved to ${titleCase(nextStatus)}`
          : mockSignalSaveMessage(`Moved to ${titleCase(nextStatus)}`),
      );
    } catch (err) {
      dispatch(upsertSignal(prev));
      toast.error(
        typeof err === "string"
          ? err
          : err instanceof ApiError
            ? err.message
            : "Unable to update status.",
      );
    } finally {
      setMovingId(null);
    }
  };

  const handleAssignAgent = async (agentId: string | null) => {
    if (!selected) return;
    setOverlay((prev) => setSignalAssignee(selected.id, agentId, prev));

    const investorId = selected.investorId;
    if (
      investorId &&
      isNumericApiId(investorId) &&
      investorById.has(String(investorId))
    ) {
      try {
        const updated = await updateInvestor(investorId, {
          assignedAgentId: agentId,
        });
        dispatch(upsertInvestor(updated));
      } catch (err) {
        toast.message(
          err instanceof ApiError
            ? `${err.message} — assignee kept locally for demo.`
            : "Assignee saved locally for demo.",
        );
      }
    }
  };

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
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "agent",
      header: "Agent",
      cell: (r) => assigneeNameFor(r) || "—",
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
          title="Board"
          description="Kanban and list views for investor intent follow-up."
          breadcrumbs={[
            { label: "Intent Signals", href: "/signals" },
            { label: "Board" },
          ]}
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
        title="Board"
        description="Kanban and list views for investor intent follow-up."
        breadcrumbs={[
          { label: "Intent Signals", href: "/signals" },
          { label: "Board" },
        ]}
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

        <Tabs
          value={view}
          onValueChange={(v) => setView(v as "board" | "list")}
        >
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            {boardRows.length === 0 ? (
              <p className="rounded-md border border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No signals match these filters.
              </p>
            ) : (
              <SignalsBoard
                signals={boardRows}
                movingId={movingId}
                onOpen={(s) => {
                  setSelectedId(s.id);
                  setSheetOpen(true);
                }}
                onMove={(id, status) => void handleMove(id, status)}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              page={page}
              onPageChange={setPage}
              emptyTitle="No results"
              emptyDescription="Try adjusting filters or wait for new investor signals."
              onRowClick={(r) => {
                setSelectedId(r.id);
                setSheetOpen(true);
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <SignalDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        signal={selected}
        investorName={selected ? investorName(selected) : "—"}
        assigneeId={selected ? assigneeIdFor(selected) : null}
        agents={agents}
        saving={saving}
        demoPersist={selected ? !isNumericApiId(selected.id) : true}
        onSavePatch={async (patch) => {
          if (!selected) return;
          setSaving(true);
          try {
            await patchSignal(selected.id, patch, { ...selected, ...patch });
          } catch (err) {
            toast.error(
              typeof err === "string"
                ? err
                : err instanceof ApiError
                  ? err.message
                  : "Unable to update signal.",
            );
            throw err;
          } finally {
            setSaving(false);
          }
        }}
        onAssignAgent={async (agentId) => {
          setSaving(true);
          try {
            await handleAssignAgent(agentId);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
