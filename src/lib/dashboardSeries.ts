/** Client-side period bucketing for dashboard charts (existing list APIs only). */

export type PeriodDays = 7 | 30 | 90 | "all";
export type BucketGrain = "daily" | "weekly";

export type SeriesPoint = {
  key: string;
  label: string;
  count: number;
};

export type PeriodWindow = {
  startMs: number;
  endMs: number;
  priorStartMs: number;
  priorEndMs: number;
  /** True when period is all-time (no prior comparison). */
  isAll: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function periodWindow(days: PeriodDays, now = new Date()): PeriodWindow {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (days === "all") {
    return {
      startMs: 0,
      endMs: end.getTime(),
      priorStartMs: 0,
      priorEndMs: -1,
      isAll: true,
    };
  }

  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  start.setHours(0, 0, 0, 0);
  const priorEnd = new Date(start.getTime() - 1);
  priorEnd.setHours(23, 59, 59, 999);
  const priorStart = new Date(priorEnd.getTime() - (days - 1) * DAY_MS);
  priorStart.setHours(0, 0, 0, 0);
  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    priorStartMs: priorStart.getTime(),
    priorEndMs: priorEnd.getTime(),
    isAll: false,
  };
}

export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export function inRange(
  value: string | null | undefined,
  startMs: number,
  endMs: number,
): boolean {
  const t = parseTime(value);
  if (t == null) return false;
  return t >= startMs && t <= endMs;
}

export function countInWindow(
  dates: Array<string | null | undefined>,
  startMs: number,
  endMs: number,
): number {
  let n = 0;
  for (const d of dates) {
    if (inRange(d, startMs, endMs)) n += 1;
  }
  return n;
}

function startOfUtcDay(ms: number): Date {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

function weekLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Build empty daily or weekly buckets covering [startMs, endMs]. */
export function buildBuckets(
  startMs: number,
  endMs: number,
  grain: BucketGrain,
): SeriesPoint[] {
  const start = startOfUtcDay(startMs);
  const end = startOfUtcDay(endMs);
  const points: SeriesPoint[] = [];

  if (grain === "daily") {
    for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
      points.push({ key: dayKey(d), label: dayLabel(d), count: 0 });
    }
    return points;
  }

  // Weekly: bucket starts on Monday of each week that intersects the range.
  const first = new Date(start);
  const dow = first.getDay(); // 0 Sun
  const toMonday = dow === 0 ? -6 : 1 - dow;
  first.setDate(first.getDate() + toMonday);
  first.setHours(0, 0, 0, 0);

  for (let d = first; d.getTime() <= end.getTime(); d = addDays(d, 7)) {
    points.push({ key: dayKey(d), label: weekLabel(d), count: 0 });
  }
  return points;
}

function bucketKeyFor(ms: number, grain: BucketGrain): string {
  const d = startOfUtcDay(ms);
  if (grain === "daily") return dayKey(d);
  const dow = d.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + toMonday);
  return dayKey(d);
}

export function bucketDates(
  dates: Array<string | null | undefined>,
  startMs: number,
  endMs: number,
  grain: BucketGrain,
): SeriesPoint[] {
  let from = startMs;
  if (startMs <= 0) {
    let min = Infinity;
    for (const raw of dates) {
      const t = parseTime(raw);
      if (t != null && t >= 0 && t < min) min = t;
    }
    from = Number.isFinite(min)
      ? startOfUtcDay(min).getTime()
      : endMs - 89 * DAY_MS;
  }

  // Avoid huge daily series on all-time spans.
  const spanDays = Math.max(1, (endMs - from) / DAY_MS);
  const effectiveGrain: BucketGrain =
    grain === "daily" && spanDays > 90 ? "weekly" : grain;

  const points = buildBuckets(from, endMs, effectiveGrain);
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const raw of dates) {
    const t = parseTime(raw);
    if (t == null || t < from || t > endMs) continue;
    const key = bucketKeyFor(t, effectiveGrain);
    const i = index.get(key);
    if (i != null) points[i].count += 1;
  }
  return points;
}

export type PeriodDelta = {
  current: number;
  prior: number;
  /** Honest label, e.g. "3 in period · 1 prior" — not a fake % API metric. */
  label: string;
};

export function periodDelta(
  dates: Array<string | null | undefined>,
  window: PeriodWindow,
): PeriodDelta {
  const current = countInWindow(dates, window.startMs, window.endMs);
  if (window.isAll) {
    return {
      current,
      prior: 0,
      label: `${current} total`,
    };
  }
  const prior = countInWindow(dates, window.priorStartMs, window.priorEndMs);
  return {
    current,
    prior,
    label: `${current} this period · ${prior} prior`,
  };
}

export type AgentEnquiryRow = {
  agentId: string;
  agentName: string;
  received: number;
  resolved: number;
  pending: number;
};

const RESOLVED_ENQUIRY = new Set([
  "closed",
  "converted",
  "not_interested",
]);

export function isEnquiryResolved(status: string): boolean {
  return RESOLVED_ENQUIRY.has(String(status).toLowerCase());
}

export function agentsByEnquiry(
  enquiries: Array<{
    assignedAgentId: string | null;
    status: string;
    submittedAt: string;
  }>,
  agentsById: Map<string, string>,
  window: PeriodWindow,
): AgentEnquiryRow[] {
  const map = new Map<string, AgentEnquiryRow>();

  for (const e of enquiries) {
    if (!inRange(e.submittedAt, window.startMs, window.endMs)) continue;
    const agentId = e.assignedAgentId?.trim() || "";
    const key = agentId || "__unassigned__";
    let row = map.get(key);
    if (!row) {
      row = {
        agentId: key,
        agentName: agentId
          ? (agentsById.get(agentId) ?? `Agent ${agentId}`)
          : "Unassigned",
        received: 0,
        resolved: 0,
        pending: 0,
      };
      map.set(key, row);
    }
    row.received += 1;
    if (isEnquiryResolved(e.status)) row.resolved += 1;
    else row.pending += 1;
  }

  return [...map.values()].sort(
    (a, b) => b.received - a.received || a.agentName.localeCompare(b.agentName),
  );
}

export type TopInvestorRow = {
  investorId: string;
  name: string;
  holdingsCount: number;
  invested: number;
  lastActiveAt: string | null;
};

export function topInvestorsFromOwnership(
  ownership: Array<{
    investorId: string;
    currentValue: number;
    purchaseValue: number;
  }>,
  investorsById: Map<
    string,
    { name: string; lastActiveAt: string | null; ownedPropertyCount: number }
  >,
  limit = 8,
): TopInvestorRow[] {
  const agg = new Map<
    string,
    { invested: number; holdingsCount: number }
  >();

  for (const row of ownership) {
    const id = String(row.investorId);
    if (!id) continue;
    const cur = agg.get(id) ?? { invested: 0, holdingsCount: 0 };
    cur.invested += Number(row.currentValue) || Number(row.purchaseValue) || 0;
    cur.holdingsCount += 1;
    agg.set(id, cur);
  }

  const rows: TopInvestorRow[] = [];
  for (const [investorId, stats] of agg) {
    const inv = investorsById.get(investorId);
    rows.push({
      investorId,
      name: inv?.name || `Investor ${investorId}`,
      holdingsCount: stats.holdingsCount || inv?.ownedPropertyCount || 0,
      invested: stats.invested,
      lastActiveAt: inv?.lastActiveAt ?? null,
    });
  }

  // Also include investors with ownedPropertyCount but no ownership rows
  for (const [investorId, inv] of investorsById) {
    if (agg.has(investorId)) continue;
    if (!inv.ownedPropertyCount) continue;
    rows.push({
      investorId,
      name: inv.name,
      holdingsCount: inv.ownedPropertyCount,
      invested: 0,
      lastActiveAt: inv.lastActiveAt,
    });
  }

  return rows
    .sort(
      (a, b) =>
        b.invested - a.invested ||
        b.holdingsCount - a.holdingsCount ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

export function sumOwnershipValue(
  ownership: Array<{ currentValue: number; purchaseValue: number }>,
): number {
  let total = 0;
  for (const row of ownership) {
    total += Number(row.currentValue) || Number(row.purchaseValue) || 0;
  }
  return total;
}
