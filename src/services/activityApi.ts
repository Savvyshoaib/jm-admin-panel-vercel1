import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { ActivityEvent, AuditRecord } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

export function mapActivity(raw: Record<string, unknown>): ActivityEvent {
  const nestedInvestor =
    raw.investor && typeof raw.investor === "object"
      ? (raw.investor as Record<string, unknown>)
      : null;
  const investorId = str(
    raw.investorRef ??
      raw.investor_ref ??
      raw.investorId ??
      raw.investor_id ??
      nestedInvestor?.id,
  );
  const type = str(raw.category ?? raw.type ?? raw.eventType, "event");
  const title = str(raw.label ?? raw.title ?? raw.name ?? raw.type, "Activity");
  const propertyName =
    raw.propertyName == null || raw.propertyName === ""
      ? null
      : str(raw.propertyName);
  const location =
    raw.location == null || raw.location === "" ? null : str(raw.location);
  const postcode =
    raw.postcode == null || raw.postcode === "" ? null : str(raw.postcode);
  const timestamp = str(
    raw.occurredAt ?? raw.timestamp ?? raw.createdAt,
    new Date().toISOString(),
  );
  const detailFromPlace = [propertyName, location, postcode]
    .filter(Boolean)
    .join(" · ");
  const id =
    str(raw.id) ||
    [investorId, timestamp, type, title, propertyName ?? ""].join(":");
  return {
    id,
    investorId,
    type,
    title,
    detail:
      detailFromPlace ||
      str(raw.detail ?? raw.description ?? raw.message ?? raw.body),
    propertyId:
      raw.propertyId == null || raw.propertyId === ""
        ? null
        : str(raw.propertyId),
    developmentId:
      raw.developmentId == null || raw.developmentId === ""
        ? null
        : str(raw.developmentId),
    timestamp,
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? (raw.metadata as Record<string, string | number>)
        : undefined,
    propertyName,
    location,
    postcode,
  };
}

export function mapAudit(raw: Record<string, unknown>): AuditRecord {
  const nestedUser =
    raw.user && typeof raw.user === "object"
      ? (raw.user as Record<string, unknown>)
      : null;
  const prev = raw.previousValue ?? raw.oldValue ?? raw.before;
  const next = raw.newValue ?? raw.after;
  return {
    id: str(raw.id),
    userId: str(raw.userId ?? raw.user_id ?? nestedUser?.id),
    userName: str(
      raw.userName ?? nestedUser?.name ?? raw.adminName,
      "Unknown",
    ),
    action: str(raw.action ?? raw.event),
    entityType: str(raw.entityType ?? raw.entity_type ?? raw.resourceType),
    entityId: str(raw.entityId ?? raw.entity_id ?? raw.resourceId),
    previousValue:
      prev == null || prev === ""
        ? null
        : typeof prev === "string"
          ? prev
          : JSON.stringify(prev),
    newValue:
      next == null || next === ""
        ? null
        : typeof next === "string"
          ? next
          : JSON.stringify(next),
    timestamp: str(
      raw.timestamp ?? raw.createdAt ?? raw.occurredAt,
      new Date().toISOString(),
    ),
    ip: raw.ip == null || raw.ip === "" ? null : str(raw.ip),
  };
}

export type ActivityListQuery = {
  investorId?: string;
  investorRef?: string;
  q?: string;
  category?: string;
  sort?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
};

export async function fetchActivity(investorId?: string): Promise<{
  items: ActivityEvent[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.activity.list, {
    query: investorId ? { investorId } : undefined,
  });
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).activity);
  return {
    items: rows.map(mapActivity).filter((a) => a.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchAudit(): Promise<{
  items: AuditRecord[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.activity.audit);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).audit);
  return {
    items: rows.map(mapAudit).filter((a) => a.id),
    message: envelopeMessage(raw, "Success."),
  };
}
