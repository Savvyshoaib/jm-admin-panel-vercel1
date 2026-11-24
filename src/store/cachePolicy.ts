/**
 * Shared helpers for Redux resource slices.
 *
 * Policy: no TTL / stale-while-revalidate cache. Every `ensure*` call hits the
 * network (except in-flight dedupe while a request is already loading).
 * Redux still holds the latest fetched items for UI rendering only.
 *
 * Auth session (token + user) stays in localStorage for login persistence —
 * that is not API response caching.
 */

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

export type CachedListState<T> = {
  items: T[];
  status: LoadStatus;
  error: string | null;
  /** Epoch ms of last successful fetch (debug / UX only — not used to skip network). */
  fetchedAt: number | null;
  /** Legacy flag; kept for invalidate* callers. Does not gate fetches. */
  invalidated: boolean;
};

export function emptyCachedList<T>(): CachedListState<T> {
  return {
    items: [],
    status: "idle",
    error: null,
    fetchedAt: null,
    invalidated: true,
  };
}

/** @deprecated Unused — kept so existing imports compile. Fetches are never TTL-skipped. */
export const DEFAULT_LIST_TTL_MS = 0;
/** @deprecated Unused — kept so existing imports compile. */
export const SHORT_TTL_MS = 0;
/** @deprecated Unused — kept so existing imports compile. */
export const LONG_TTL_MS = 0;

/** Always false — no response TTL cache in this app. */
export function isCacheFresh(
  _fetchedAt?: number | null,
  _ttlMs?: number,
  _invalidated?: boolean,
): boolean {
  return false;
}

/** Always false — every ensure* should hit the network (unless in-flight). */
export function shouldSkipFetch(
  _state: Pick<CachedListState<unknown>, "fetchedAt" | "invalidated" | "status">,
  _ttlMs: number,
  opts?: { force?: boolean },
): boolean {
  if (opts?.force) return false;
  return false;
}

/** True when another ensure* request is already in flight (dedupe dispatches). */
export function isFetchInFlight(
  state: Pick<CachedListState<unknown>, "status">,
): boolean {
  return state.status === "loading";
}
