import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { FormSection } from "@/components/admin/FormSection";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import type { PaymentSchedule, PaymentMilestoneStatus } from "@/models";
import { savePayment } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureInvestors } from "@/store/slices/investorsSlice";
import { ensureProperties } from "@/store/slices/propertiesSlice";
import {
  ensurePayments,
  invalidatePayments,
  upsertPayment,
} from "@/store/slices/paymentsSlice";

function scheduleMetrics(schedule: PaymentSchedule) {
  const paid = schedule.milestones
    .filter((m) => m.status === "paid")
    .reduce((sum, m) => {
      const amount =
        m.percentOrAmount === "amount"
          ? m.value
          : (schedule.totalPurchaseAmount * m.value) / 100;
      return sum + amount;
    }, 0);
  const overdue = schedule.milestones
    .filter((m) => m.status === "overdue")
    .reduce((sum, m) => {
      const amount =
        m.percentOrAmount === "amount"
          ? m.value
          : (schedule.totalPurchaseAmount * m.value) / 100;
      return sum + amount;
    }, 0);
  const remaining = Math.max(schedule.totalPurchaseAmount - paid, 0);
  const next = schedule.milestones.find(
    (m) => m.status === "due" || m.status === "upcoming",
  );
  const progress = schedule.totalPurchaseAmount
    ? Math.round((paid / schedule.totalPurchaseAmount) * 100)
    : 0;
  return { paid, overdue, remaining, next, progress };
}

export function PaymentsPage() {
  const { canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const paymentsState = useAppSelector((s) => s.payments);
  const investorsState = useAppSelector((s) => s.investors);
  const propertiesState = useAppSelector((s) => s.properties);
  const [selected, setSelected] = useState<PaymentSchedule | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(ensurePayments())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load payments.");
      });
  }, [dispatch, paymentsState.invalidated]);

  useEffect(() => {
    void dispatch(ensureInvestors());
    void dispatch(ensureProperties());
  }, [dispatch]);

  const rows = paymentsState.items;
  const investors = investorsState.items;
  const properties = propertiesState.items;

  const columns: Column<PaymentSchedule>[] = useMemo(
    () => [
      {
        key: "investor",
        header: "Investor",
        cell: (r) =>
          investors.find((i) => i.id === r.investorId)?.name ?? r.investorId,
      },
      {
        key: "property",
        header: "Property",
        cell: (r) =>
          properties.find((p) => p.id === r.propertyId)?.name ?? r.propertyId,
      },
      {
        key: "total",
        header: "Total",
        cell: (r) => formatCurrency(r.totalPurchaseAmount),
        className: "tabular-nums",
      },
      {
        key: "paid",
        header: "Paid",
        cell: (r) => formatCurrency(scheduleMetrics(r).paid),
        className: "tabular-nums",
      },
      {
        key: "remaining",
        header: "Remaining",
        cell: (r) => formatCurrency(scheduleMetrics(r).remaining),
        className: "tabular-nums",
      },
      {
        key: "next",
        header: "Next due",
        cell: (r) => formatDate(scheduleMetrics(r).next?.dueDate),
      },
      {
        key: "progress",
        header: "Progress",
        cell: (r) => `${scheduleMetrics(r).progress}%`,
      },
    ],
    [investors, properties],
  );

  const refreshAfterSave = async (saved: PaymentSchedule) => {
    dispatch(upsertPayment(saved));
    dispatch(invalidatePayments());
    try {
      await dispatch(ensurePayments({ force: true })).unwrap();
    } catch (err: unknown) {
      if (!isThunkConditionError(err)) {
        /* list refresh failed; upsert still holds saved row */
      }
    }
    setSelected(saved);
  };

  const createSchedule = async () => {
    const investor = investors[0];
    const property =
      properties.find((p) => p.status === "available") ?? properties[0];
    if (!investor || !property) {
      toast.error("Need at least one investor and property");
      return;
    }
    const schedule: PaymentSchedule = {
      id: "",
      investorId: investor.id,
      propertyId: property.id,
      totalPurchaseAmount: property.purchasePrice || 250000,
      notes: "New schedule",
      updatedAt: new Date().toISOString(),
      milestones: [
        {
          id: createClientId(),
          label: "Reservation",
          percentOrAmount: "amount",
          value: 5000,
          dueDate: new Date().toISOString().slice(0, 10),
          status: "upcoming",
          paidDate: null,
          reference: null,
          notes: "",
        },
        {
          id: createClientId(),
          label: "Exchange 10%",
          percentOrAmount: "percent",
          value: 10,
          dueDate: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
          status: "upcoming",
          paidDate: null,
          reference: null,
          notes: "",
        },
      ],
    };
    setCreating(true);
    try {
      const saved = await savePayment(schedule);
      await refreshAfterSave(saved);
      toast.success("Payment schedule created");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to create schedule.",
      );
    } finally {
      setCreating(false);
    }
  };

  const updateMilestoneStatus = async (
    milestoneId: string,
    status: PaymentMilestoneStatus,
  ) => {
    if (!selected) return;
    const next: PaymentSchedule = {
      ...selected,
      milestones: selected.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              status,
              paidDate:
                status === "paid"
                  ? new Date().toISOString().slice(0, 10)
                  : m.paidDate,
            }
          : m,
      ),
    };
    setUpdatingId(milestoneId);
    try {
      const saved = await savePayment(next);
      await refreshAfterSave(saved);
      toast.success("Milestone updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to update milestone.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const loading =
    paymentsState.status === "idle" ||
    (paymentsState.status === "loading" && rows.length === 0);

  if (loading) return <LoadingBlock variant="table" />;

  // Keep selected in sync with store after list refresh
  const selectedLive =
    selected &&
    (rows.find((r) => String(r.id) === String(selected.id)) ?? selected);

  const metrics = selectedLive ? scheduleMetrics(selectedLive) : null;

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Off-plan payment schedules assigned to investors and properties."
        actions={
          canMutate("payments") ? (
            <Button onClick={() => void createSchedule()} disabled={creating}>
              {creating ? "Creating…" : "Create schedule"}
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={setSelected}
        emptyTitle="No payment schedules"
      />

      {selectedLive && metrics && (
        <div className="mt-6 space-y-4">
          <FormSection title="Schedule detail">
            <div>
              <p className="text-xs text-muted-foreground">Amount paid</p>
              <p className="text-lg tabular-nums">
                {formatCurrency(metrics.paid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-lg tabular-nums">
                {formatCurrency(metrics.remaining)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-lg tabular-nums">
                {formatCurrency(metrics.overdue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Next payment</p>
              <p className="text-lg">{formatDate(metrics.next?.dueDate)}</p>
            </div>
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Progress {metrics.progress}%
              </p>
              <Progress value={metrics.progress} />
            </div>
          </FormSection>

          <DataTable
            columns={[
              { key: "label", header: "Milestone", cell: (r) => r.label },
              {
                key: "value",
                header: "Amount",
                cell: (r) =>
                  r.percentOrAmount === "percent"
                    ? `${r.value}%`
                    : formatCurrency(r.value),
              },
              { key: "due", header: "Due", cell: (r) => formatDate(r.dueDate) },
              {
                key: "status",
                header: "Status",
                cell: (r) => <StatusBadge value={r.status} />,
              },
              {
                key: "update",
                header: "Update",
                cell: (r) =>
                  canMutate("payments") ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={r.status}
                        disabled={updatingId === r.id}
                        onValueChange={(v) =>
                          void updateMilestoneStatus(
                            r.id,
                            v as PaymentMilestoneStatus,
                          )
                        }
                      >
                        <SelectTrigger className="w-full min-w-[120px] sm:w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["upcoming", "due", "paid", "overdue"].map((s) => (
                            <SelectItem key={s} value={s}>
                              {titleCase(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    "—"
                  ),
              },
            ]}
            rows={selectedLive.milestones}
            rowKey={(r) => r.id}
          />
        </div>
      )}
    </div>
  );
}
