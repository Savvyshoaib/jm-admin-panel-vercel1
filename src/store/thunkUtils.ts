/**
 * RTK `condition: false` rejects unwrap() with ConditionError — not a real failure.
 */
export function isThunkConditionError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "ConditionError"
  );
}
