import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { UkhpiLog } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapUkhpiLog(raw: Record<string, unknown>): UkhpiLog {
  return {
    id: str(raw.id),
    propertyId:
      raw.propertyId == null && raw.property_id == null
        ? null
        : str(raw.propertyId ?? raw.property_id),
    propertyName: str(raw.propertyName ?? raw.property_name),
    propertyReference: str(raw.propertyReference ?? raw.property_reference),
    region: str(raw.region),
    regionSlug: str(raw.regionSlug ?? raw.region_slug ?? raw.region),
    refMonth: str(raw.refMonth ?? raw.ref_month),
    percentageChange: numOrNull(raw.percentageChange ?? raw.percentage_change),
    previousValue: numOrNull(raw.previousValue ?? raw.previous_value),
    newValue: numOrNull(raw.newValue ?? raw.new_value),
    averagePrice: numOrNull(raw.averagePrice ?? raw.average_price),
    housePriceIndex: numOrNull(raw.housePriceIndex ?? raw.house_price_index),
    sourceUrl: str(raw.sourceUrl ?? raw.source_url),
    status: str(raw.status, "unknown"),
    message: str(raw.message),
    createdAt: str(raw.createdAt ?? raw.created_at, new Date().toISOString()),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, new Date().toISOString()),
  };
}

export async function fetchUkhpiLogs(): Promise<{
  items: UkhpiLog[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.ukhpi.logs);
  return {
    items: asRecordArray(unwrapData(raw)).map(mapUkhpiLog),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchUkhpiLog(
  id: string,
): Promise<{ item: UkhpiLog | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.ukhpi.log(id));
  const data = unwrapData(raw);
  if (!data) return { item: null, message: envelopeMessage(raw, "Success.") };
  return {
    item: mapUkhpiLog(asRecord(data)),
    message: envelopeMessage(raw, "Success."),
  };
}
