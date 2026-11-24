import { apiRequest, unwrapData } from "@/lib/apiClient";
import { toApiDate } from "@/lib/format";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type {
  PaymentMilestone,
  PaymentMilestoneStatus,
  PaymentSchedule,
} from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isMilestoneStatus(value: string): value is PaymentMilestoneStatus {
  return (
    value === "upcoming" ||
    value === "due" ||
    value === "paid" ||
    value === "overdue"
  );
}

/** Server ids are numeric; nanoid client temps must not be sent on write. */
function isServerId(id: string | undefined | null): boolean {
  return !!id && /^\d+$/.test(id);
}

export function mapMilestone(raw: Record<string, unknown>): PaymentMilestone {
  const status = str(raw.status, "upcoming");
  const mode = str(raw.percentOrAmount ?? raw.mode, "percent");
  return {
    id: str(raw.id),
    label: str(raw.label),
    percentOrAmount: mode === "amount" ? "amount" : "percent",
    value: num(raw.value),
    dueDate: toApiDate(str(raw.dueDate)) || str(raw.dueDate).slice(0, 10),
    status: isMilestoneStatus(status) ? status : "upcoming",
    paidDate:
      raw.paidDate == null || raw.paidDate === ""
        ? null
        : toApiDate(str(raw.paidDate)) || str(raw.paidDate).slice(0, 10),
    reference:
      raw.reference == null || raw.reference === "" ? null : str(raw.reference),
    notes: str(raw.notes),
  };
}

export function mapPayment(raw: Record<string, unknown>): PaymentSchedule {
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.map((m) => mapMilestone(asRecord(m)))
    : [];
  return {
    id: str(raw.id),
    investorId: str(raw.investorId ?? raw.investor_id),
    propertyId: str(raw.propertyId ?? raw.property_id),
    totalPurchaseAmount: num(
      raw.totalPurchaseAmount ?? raw.total_purchase_amount ?? raw.total,
    ),
    milestones,
    notes: str(raw.notes),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, new Date().toISOString()),
  };
}

function parsePaymentPayload(data: unknown): PaymentSchedule | null {
  if (data == null) return null;
  const record = asRecord(data);
  const unit =
    record.id != null || record.investorId != null || record.propertyId != null
      ? record
      : asRecord(record.payment ?? record.schedule ?? record.data);
  if (!unit.id && !unit.investorId && !unit.propertyId) return null;
  return mapPayment(unit);
}

function milestoneBody(m: PaymentMilestone, includeId: boolean) {
  const row: Record<string, unknown> = {
    label: m.label,
    percentOrAmount: m.percentOrAmount,
    value: m.value,
    dueDate: toApiDate(m.dueDate) || m.dueDate,
    status: m.status,
  };
  if (includeId && isServerId(m.id)) {
    row.id = Number(m.id);
  }
  if (m.paidDate) row.paidDate = toApiDate(m.paidDate) || m.paidDate;
  if (m.reference) row.reference = m.reference;
  if (m.notes) row.notes = m.notes;
  return row;
}

function scheduleWriteBody(input: PaymentSchedule, isCreate: boolean) {
  return {
    investorId: Number(input.investorId) || input.investorId,
    propertyId: Number(input.propertyId) || input.propertyId,
    totalPurchaseAmount: input.totalPurchaseAmount,
    notes: input.notes ?? "",
    milestones: input.milestones.map((m) => milestoneBody(m, !isCreate)),
  };
}

export async function fetchPayments(): Promise<{
  items: PaymentSchedule[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.payments.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).payments);
  return {
    items: rows.map(mapPayment).filter((p) => p.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function postPayment(
  input: PaymentSchedule,
): Promise<{ payment: PaymentSchedule; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.payments.create, {
    method: "POST",
    body: scheduleWriteBody(input, true),
  });
  const message = envelopeMessage(raw, "Created.");
  const fromApi = parsePaymentPayload(unwrapData(raw));
  const payment =
    fromApi ??
    ({
      ...input,
      id: input.id || "",
      updatedAt: new Date().toISOString(),
    } satisfies PaymentSchedule);
  return { payment, message };
}

export async function putPayment(
  paymentId: string,
  input: PaymentSchedule,
): Promise<{ payment: PaymentSchedule; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.payments.one(paymentId),
    {
      method: "PUT",
      body: {
        notes: input.notes ?? "",
        milestones: input.milestones.map((m) => milestoneBody(m, true)),
      },
    },
  );
  const message = envelopeMessage(raw, "Updated.");
  const fromApi = parsePaymentPayload(unwrapData(raw));
  const payment: PaymentSchedule = fromApi
    ? { ...fromApi, id: str(fromApi.id || paymentId) }
    : {
        ...input,
        id: paymentId,
        updatedAt: new Date().toISOString(),
      };
  return { payment, message };
}
