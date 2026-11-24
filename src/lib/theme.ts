export const THEME_STORAGE_KEY = "jm-admin-theme";

export const THEME_IDS = [
  "mews",
  "investor",
  "classic",
  "mayfair",
  "harbour",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_META: Record<
  ThemeId,
  { label: string; description: string; swatch: string }
> = {
  mews: {
    label: "Mews One",
    description: "Exact investor app colours",
    swatch: "oklch(74% 0.075 75)",
  },
  investor: {
    label: "Investor Glass",
    description: "App palette with frosted glass admin chrome",
    swatch: "oklch(74% 0.075 75)",
  },
  classic: {
    label: "Classic",
    description: "Brand gold on charcoal",
    swatch: "#FCC11D",
  },
  mayfair: {
    label: "Mayfair",
    description: "Warm bronze glass — luxury estate feel",
    swatch: "oklch(72% 0.09 65)",
  },
  harbour: {
    label: "Harbour",
    description: "Cool slate + soft gold — waterfront ops",
    swatch: "oklch(76% 0.05 95)",
  },
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}

export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    // Noir removed — map old preference to Mayfair.
    if (stored === "noir") return "mayfair";
    if (isThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "mews";
}

export function applyThemeToDocument(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.add("dark");
}
