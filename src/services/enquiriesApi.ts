import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { Enquiry, EnquiryStatus } from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function isEnquiryStatus(value: string): value is EnquiryStatus {
  return [
    "new",
    "assigned",
    "contacted",
    "qualified",
    "viewing_arranged",
    "in_progress",
    "open",
    "closed",
    "converted",
    "not_interested",
  ].includes(value);
}

function isPriority(value: string): value is Enquiry["priority"] {
  return value === "low" || value === "medium" || value === "high";
}

export function mapEnquiry(raw: Record<string, unknown>): Enquiry {
  const nestedInvestor =
    raw.investor && typeof raw.investor === "object"
      ? (raw.investor as Record<string, unknown>)
      : null;
  const status = str(raw.status, "new");
  const priority = str(raw.priority, "medium");

  return {
    id: str(raw.id),
    investorId:
      raw.investorId == null || raw.investorId === ""
        ? nestedInvestor?.id == null
          ? null
          : str(nestedInvestor.id)
        : str(raw.investorId),
    investorName: str(
      raw.investorName ?? nestedInvestor?.name ?? raw.name,
      "Unknown",
    ),
    propertyId:
      raw.propertyId == null || raw.propertyId === "" ? null : str(raw.propertyId),
    developmentId:
      raw.developmentId == null || raw.developmentId === ""
        ? null
        : str(raw.developmentId),
    type: str(raw.type, "general"),
    message: str(raw.message ?? raw.body ?? raw.notes),
    submittedAt: str(
      raw.submittedAt ?? raw.createdAt,
      new Date().toISOString(),
    ),
    assignedAgentId:
      raw.assignedAgentId == null || raw.assignedAgentId === ""
        ? null
        : str(raw.assignedAgentId),
    status: isEnquiryStatus(status) ? status : "new",
    priority: isPriority(priority) ? priority : "medium",
    latestAction: str(raw.latestAction),
    followUpDate:
      raw.followUpDate == null || raw.followUpDate === ""
        ? null
        : str(raw.followUpDate).slice(0, 10),
    date:
      raw.date == null || raw.date === "" ? null : str(raw.date).slice(0, 10),
    time: raw.time == null || raw.time === "" ? null : str(raw.time).slice(0, 5),
    linkedSignalId:
      raw.linkedSignalId == null || raw.linkedSignalId === ""
        ? null
        : str(raw.linkedSignalId),
    outcome: raw.outcome == null || raw.outcome === "" ? null : str(raw.outcome),
  };
}

export async function fetchEnquiries(): Promise<{
  items: Enquiry[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.enquiries.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).enquiries);
  return {
    items: rows.map(mapEnquiry).filter((e) => e.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export type EnquiryPatchInput = {
  status?: EnquiryStatus;
  priority?: Enquiry["priority"];
  assignedAgentId?: string | null;
  followUpDate?: string | null;
  latestAction?: string;
  outcome?: string | null;
};

export async function deleteEnquiryRequest(
  enquiryId: string,
): Promise<{ message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.enquiries.one(enquiryId),
    { method: "DELETE" },
  );
  return { message: envelopeMessage(raw, "Enquiry deleted.") };
}

export async function patchEnquiry(
  enquiryId: string,
  patch: EnquiryPatchInput,
): Promise<{ enquiry: Enquiry; message: string }> {
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.priority !== undefined) body.priority = patch.priority;
  if (patch.assignedAgentId !== undefined) {
    body.assignedAgentId =
      patch.assignedAgentId == null
        ? null
        : Number(patch.assignedAgentId) || patch.assignedAgentId;
  }
  if (patch.followUpDate !== undefined) body.followUpDate = patch.followUpDate;
  if (patch.latestAction !== undefined) body.latestAction = patch.latestAction;
  if (patch.outcome !== undefined) body.outcome = patch.outcome;

  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.enquiries.one(enquiryId),
    { method: "PATCH", body },
  );
  const data = unwrapData(raw);
  const record = asRecord(data);
  const unit =
    record.id != null || record.status != null
      ? record
      : asRecord(record.enquiry ?? record.data);

  let enquiry = mapEnquiry(unit);
  if (!enquiry.id) {
    enquiry = { ...enquiry, id: enquiryId, ...patch } as Enquiry;
  } else if (patch.status && enquiry.status !== patch.status) {
    enquiry = { ...enquiry, status: patch.status };
  }

  return {
    enquiry: { ...enquiry, id: enquiry.id || enquiryId },
    message: envelopeMessage(raw, "Updated."),
  };
}
