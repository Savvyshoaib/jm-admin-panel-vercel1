import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/format";
import type { ActivityEvent } from "@/models";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureActivity,
  ensureAudit,
} from "@/store/slices/activitySlice";
import { ensureInvestors } from "@/store/slices/investorsSlice";

/** Turn audit previous/new payloads into readable text (JSON objects → key: value). */
function formatAuditValue(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        if (entries.length === 0) return "—";
        return entries
          .map(([k, v]) => `${k}: ${v == null || v === "" ? "—" : String(v)}`)
          .join(" · ");
      }
      if (Array.isArray(parsed)) {
        return parsed.length
          ? parsed.map((v) => (v == null ? "—" : String(v))).join(", ")
          : "—";
      }
    } catch {
      /* plain string that looked like JSON */
    }
  }
  return value;
}

export function ActivityPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const activityState = useAppSelector((s) => s.activityLog.activity);
  const auditState = useAppSelector((s) => s.activityLog.audit);
  const investors = useAppSelector((s) => s.investors.items);
  const [tab, setTab] = useState("investor");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    void dispatch(ensureInvestors())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
  }, [dispatch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void dispatch(
        ensureActivity({
          q: search.trim() || undefined,
          category: category === "all" ? undefined : category,
          sort: "-occurredAt",
          limit: 50,
        }),
      )
        .unwrap()
        .catch((err: unknown) => {
          if (isThunkConditionError(err)) return;
          toast.error(typeof err === "string" ? err : "Unable to load activity.");
        });
    }, 250);
    return () => window.clearTimeout(t);
  }, [dispatch, activityState.invalidated, search, category]);

  useEffect(() => {
    if (tab !== "audit" || user?.role !== "super_admin") return;
    void dispatch(ensureAudit())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load audit log.");
      });
  }, [dispatch, tab, user?.role, auditState.invalidated]);

  const activityRows = useMemo(() => {
    const acts = activityState.items;
    if (user?.role === "agent") {
      const scoped = new Set(user.assignedInvestorIds.map(String));
      return acts.filter((a) => scoped.has(String(a.investorId)));
    }
    return acts;
  }, [activityState.items, user]);

  const investorName = (row: ActivityEvent) =>
    investors.find((i) => String(i.id) === String(row.investorId))?.name ??
    (row.investorId || "—");

  const activityLoading =
    (activityState.status === "loading" || activityState.status === "idle") &&
    activityState.items.length === 0;

  if (activityLoading) return <LoadingBlock variant="table" />;

  if (activityState.status === "failed" && activityState.items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Activity Log"
          description="Investor behaviour vs internal admin audit trail."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {activityState.error ?? "Unable to load activity."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() =>
                void dispatch(
                  ensureActivity({
                    force: true,
                    q: search.trim() || undefined,
                    category: category === "all" ? undefined : category,
                    sort: "-occurredAt",
                    limit: 50,
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
        title="Activity Log"
        description="Investor behaviour vs internal admin audit trail."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="investor">Investor activity</TabsTrigger>
          <TabsTrigger value="audit" disabled={user?.role !== "super_admin"}>
            Admin audit
          </TabsTrigger>
        </TabsList>
        <TabsContent value="investor" className="mt-4 space-y-4">
          <FilterBar search={search} onSearchChange={setSearch}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="screen">Screen</SelectItem>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="calculator">Calculator</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </FilterBar>
          <DataTable
            columns={[
              {
                key: "investor",
                header: "Investor",
                cell: (r) => investorName(r),
              },
              { key: "title", header: "Event", cell: (r) => r.title },
              {
                key: "detail",
                header: "Detail",
                cell: (r) => r.detail || "—",
              },
              {
                key: "type",
                header: "Type",
                cell: (r) => <StatusBadge value={r.type} />,
              },
              {
                key: "time",
                header: "When",
                cell: (r) => formatDateTime(r.timestamp),
              },
            ]}
            rows={activityRows}
            rowKey={(r) => r.id}
            pageSize={12}
            emptyTitle="No investor activity"
            emptyDescription="Activity events from the API will appear here."
          />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          {user?.role !== "super_admin" ? (
            <p className="text-sm text-muted-foreground">
              Audit log is Super Admin only.
            </p>
          ) : auditState.status === "loading" &&
            auditState.items.length === 0 ? (
            <LoadingBlock variant="table" />
          ) : auditState.status === "failed" &&
            auditState.items.length === 0 ? (
            <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
              {auditState.error ?? "Unable to load audit log."}
              <div className="mt-3">
                <Button
                  variant="outline"
                  onClick={() => void dispatch(ensureAudit({ force: true }))}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "user", header: "User", cell: (r) => r.userName },
                { key: "action", header: "Action", cell: (r) => r.action },
                {
                  key: "entity",
                  header: "Entity",
                  cell: (r) => `${r.entityType} · ${r.entityId}`,
                },
                {
                  key: "prev",
                  header: "Previous",
                  className: "max-w-[16rem] whitespace-normal break-words",
                  cell: (r) => formatAuditValue(r.previousValue),
                },
                {
                  key: "next",
                  header: "New",
                  className: "max-w-[16rem] whitespace-normal break-words",
                  cell: (r) => formatAuditValue(r.newValue),
                },
                {
                  key: "time",
                  header: "When",
                  cell: (r) => formatDateTime(r.timestamp),
                },
                {
                  key: "ip",
                  header: "IP",
                  cell: (r) => r.ip ?? "—",
                  mobileHidden: true,
                },
              ]}
              rows={auditState.items}
              rowKey={(r) => r.id}
              pageSize={12}
              emptyTitle="No audit records"
              emptyDescription="Admin audit events from the API will appear here."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
