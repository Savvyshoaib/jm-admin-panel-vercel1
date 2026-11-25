/**
 * Master switch for FE mock mode.
 * `VITE_USE_MOCK_DATA=true` → local JSON + localStorage mocks (no live HTTP).
 * `VITE_USE_MOCK_DATA=false` (or unset) → real API paths only.
 */
function envFlagTrue(value: unknown): boolean {
  if (value == null || value === "") return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export const USE_MOCK_DATA = envFlagTrue(import.meta.env.VITE_USE_MOCK_DATA);

/** @deprecated Alias — prefer USE_MOCK_DATA */
export const USE_MOCK_INVENTORY = USE_MOCK_DATA;
