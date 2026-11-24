/** Local list order helpers + shared sortOrder compare. */

export function compareSortOrder(
  a: { id: string; sortOrder?: number },
  b: { id: string; sortOrder?: number },
): number {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return String(a.id).localeCompare(String(b.id));
}

/** Prefer numeric ids in sort payloads when the string is a plain integer. */
export function toSortId(id: string): string | number {
  const trimmed = String(id).trim();
  const n = Number(trimmed);
  return Number.isInteger(n) && String(n) === trimmed ? n : trimmed;
}

export function toSortItems(orderedIds: string[]): {
  id: string | number;
  sortOrder: number;
}[] {
  return orderedIds.map((id, index) => ({
    id: toSortId(id),
    sortOrder: index + 1,
  }));
}

export function readListOrder(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function writeListOrder(storageKey: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    /* quota / private mode */
  }
}

/** Apply a saved id order; unknown ids keep their relative place at the end. */
export function applyListOrder<T>(
  items: T[],
  orderIds: string[],
  getId: (item: T) => string,
): T[] {
  if (!items.length || !orderIds.length) return items;
  const map = new Map(items.map((item) => [getId(item), item]));
  const ordered: T[] = [];
  for (const id of orderIds) {
    const item = map.get(id);
    if (!item) continue;
    ordered.push(item);
    map.delete(id);
  }
  for (const item of items) {
    if (map.has(getId(item))) ordered.push(item);
  }
  return ordered;
}

/**
 * After reordering a visible (possibly filtered) subset, merge that subset
 * back into the full saved order.
 */
export function mergeVisibleOrder(
  savedIds: string[],
  visibleOrderedIds: string[],
): string[] {
  if (!visibleOrderedIds.length) return savedIds;
  if (!savedIds.length) return visibleOrderedIds;

  const visible = new Set(visibleOrderedIds);
  const withoutVisible = savedIds.filter((id) => !visible.has(id));
  const firstVisibleAt = savedIds.findIndex((id) => visible.has(id));
  const insertAt =
    firstVisibleAt < 0
      ? withoutVisible.length
      : savedIds
          .slice(0, firstVisibleAt)
          .filter((id) => !visible.has(id)).length;

  const next = [...withoutVisible];
  next.splice(insertAt, 0, ...visibleOrderedIds);

  for (const id of visibleOrderedIds) {
    if (!next.includes(id)) next.push(id);
  }
  return next;
}
