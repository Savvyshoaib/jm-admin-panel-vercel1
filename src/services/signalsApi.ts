import { apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type { IntentLevel, IntentSignal, SignalRule, SignalStatus } from "@/models";

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

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function isIntentLevel(value: string): value is IntentLevel {
  return ["low", "medium", "high", "urgent"].includes(value);
}

function isSignalStatus(value: string): value is SignalStatus {
  return [
    "new",
    "open",
    "viewed",
    "contact_planned",
    "contacted",
    "qualified",
    "dismissed",
    "converted",
  ].includes(value);
}

export function mapSignal(raw: Record<string, unknown>): IntentSignal {
  const intent = str(
    raw.strength ?? raw.intentLevel ?? raw.intent_level,
    "medium",
  ).toLowerCase();
  const status = str(raw.status, "new");
  const investorId = str(
    raw.investorRef ?? raw.investor_ref ?? raw.investorId ?? raw.investor_id,
  );
  const signalType = str(raw.signal ?? raw.signalType ?? raw.type, "signal");
  const triggeringActivity = str(
    raw.evidence ??
      raw.triggeringActivity ??
      raw.trigger ??
      raw.summary ??
      raw.detail,
  );
  const generatedAt = str(
    raw.generatedAt ?? raw.generated_at ?? raw.createdAt,
    new Date().toISOString(),
  );
  const id =
    str(raw.id) ||
    [investorId, generatedAt, signalType].filter(Boolean).join(":");
  return {
    id,
    investorId,
    assignedAgentId:
      raw.assignedAgentId == null || raw.assignedAgentId === ""
        ? null
        : str(raw.assignedAgentId),
    signalType,
    triggeringActivity,
    propertyId:
      raw.propertyId == null || raw.propertyId === ""
        ? null
        : str(raw.propertyId),
    developmentId:
      raw.developmentId == null || raw.developmentId === ""
        ? null
        : str(raw.developmentId),
    intentLevel: isIntentLevel(intent) ? intent : "medium",
    generatedAt,
    summary:
      raw.summary == null || raw.summary === "" ? null : str(raw.summary),
    suggestedNextAction: str(raw.suggestedNextAction ?? raw.suggestedAction),
    status: isSignalStatus(status) ? status : "new",
    agentNotes: str(raw.agentNotes),
    ruleId: raw.ruleId == null || raw.ruleId === "" ? null : str(raw.ruleId),
    category:
      raw.category == null || raw.category === "" ? null : str(raw.category),
  };
}

export function mapSignalRule(raw: Record<string, unknown>): SignalRule {
  const intent = str(raw.intentLevel ?? raw.intent_level, "medium");
  return {
    id: str(raw.id),
    name: str(raw.name ?? raw.title, "Signal rule"),
    description: str(raw.description),
    eventType: str(raw.eventType ?? raw.event_type ?? raw.type),
    threshold: num(raw.threshold),
    windowDays: num(raw.windowDays ?? raw.window_days),
    intentLevel: isIntentLevel(intent) ? intent : "medium",
    enabled: bool(raw.enabled, true),
    suggestedAction: str(raw.suggestedAction ?? raw.suggested_action),
  };
}

export type SignalListQuery = {
  q?: string;
  strength?: string;
  investorRef?: string;
  limit?: number;
  offset?: number;
};

export async function fetchSignals(): Promise<{
  items: IntentSignal[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.signals.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).signals);
  return {
    items: rows.map(mapSignal).filter((s) => s.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function patchSignal(
  signalId: string,
  patch: Partial<Pick<IntentSignal, "status" | "agentNotes" | "intentLevel">>,
): Promise<{ signal: IntentSignal; message: string }> {
  const body: Record<string, unknown> = {};
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.agentNotes !== undefined) body.agentNotes = patch.agentNotes;
  if (patch.intentLevel !== undefined) body.intentLevel = patch.intentLevel;

  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.signals.one(signalId),
    { method: "PATCH", body },
  );
  const record = asRecord(unwrapData(raw));
  const unit =
    record.id != null || record.status != null
      ? record
      : asRecord(record.signal ?? record.data);
  const mapped = mapSignal(unit);
  return {
    signal: mapped.id ? mapped : { ...mapped, id: signalId, ...patch },
    message: envelopeMessage(raw, "Updated."),
  };
}

export async function fetchSignalRules(): Promise<{
  items: SignalRule[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.signals.rules);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).rules);
  return {
    items: rows.map(mapSignalRule).filter((r) => r.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function patchSignalRule(
  ruleId: string,
  patch: Partial<Pick<SignalRule, "enabled" | "threshold" | "windowDays">>,
): Promise<{ rule: SignalRule; message: string }> {
  const body: Record<string, unknown> = {};
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.threshold !== undefined) body.threshold = patch.threshold;
  if (patch.windowDays !== undefined) body.windowDays = patch.windowDays;

  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.signals.rule(ruleId),
    { method: "PATCH", body },
  );
  const record = asRecord(unwrapData(raw));
  const unit =
    record.id != null || record.name != null
      ? record
      : asRecord(record.rule ?? record.data);
  const mapped = mapSignalRule(unit);
  return {
    rule: mapped.id ? mapped : { ...mapped, id: ruleId, ...patch },
    message: envelopeMessage(raw, "Updated."),
  };
}
