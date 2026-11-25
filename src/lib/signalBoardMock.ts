/**
 * Mock helpers for Intent Signals CRM board.
 * Qiko signal ids are often non-integer; Laravel PATCH /admin/signals/:id expects int.
 * Until backend supports Qiko ids, board edits persist locally for demo UX.
 */

const ASSIGNEE_KEY = "jm-signal-assignee-overlay";
const PATCH_KEY = "jm-signal-patch-overlay";

export type SignalAssigneeOverlay = Record<string, string>;

export type SignalPatchOverlay = Record<
  string,
  Partial<{
    status: string;
    agentNotes: string;
    intentLevel: string;
  }>
>;

/** True when id can be used in Laravel integer path params. */
export function isNumericApiId(value: string | number | null | undefined): boolean {
  return /^-?\d+$/.test(String(value ?? "").trim());
}

export function readAssigneeOverlay(): SignalAssigneeOverlay {
  try {
    const raw = localStorage.getItem(ASSIGNEE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: SignalAssigneeOverlay = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function writeAssigneeOverlay(map: SignalAssigneeOverlay): void {
  try {
    localStorage.setItem(ASSIGNEE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function setSignalAssignee(
  signalId: string,
  agentId: string | null,
  current: SignalAssigneeOverlay,
): SignalAssigneeOverlay {
  const next = { ...current };
  if (!agentId) delete next[signalId];
  else next[signalId] = agentId;
  writeAssigneeOverlay(next);
  return next;
}

export function readPatchOverlay(): SignalPatchOverlay {
  try {
    const raw = localStorage.getItem(PATCH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SignalPatchOverlay;
  } catch {
    return {};
  }
}

export function writePatchOverlay(map: SignalPatchOverlay): void {
  try {
    localStorage.setItem(PATCH_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function mergeSignalPatch(
  signalId: string,
  patch: SignalPatchOverlay[string],
  current: SignalPatchOverlay,
): SignalPatchOverlay {
  const next = {
    ...current,
    [signalId]: { ...current[signalId], ...patch },
  };
  writePatchOverlay(next);
  return next;
}

/** Resolve display assignee: overlay → signal.assignedAgentId → investor.assignedAgentId */
export function resolveSignalAssigneeId(
  signalId: string,
  signalAssignedAgentId: string | null | undefined,
  investorAssignedAgentId: string | null | undefined,
  overlay: SignalAssigneeOverlay,
): string | null {
  return (
    overlay[signalId] ||
    signalAssignedAgentId ||
    investorAssignedAgentId ||
    null
  );
}

export function mockAssignNotifyMessage(agentName: string): string {
  return `Notification sent to ${agentName} (CC Johnny) — mock until email API exists`;
}

export function mockSignalSaveMessage(action: string): string {
  return `${action} (demo — Qiko signal id is not a numeric API id yet)`;
}
