/**
 * Deterministic plan maths for Calculator admin preview.
 * Mirrors mobile: Safe Capital from band lower bound; mortgage buying power ≈ deposit ÷ (1 − LTV).
 */

export type FinanceRoute = "mortgage" | "cash" | "both" | "recommend";

export type CapitalBandRule = {
  optionLabel: string;
  /** Hard eligibility (Safe Capital) in GBP */
  safeCapital: number;
  planningCapital: number;
};

/** Match mobile capital option labels → Safe Capital used for affordability. */
export const CAPITAL_BAND_RULES: CapitalBandRule[] = [
  {
    optionLabel: "Less than £10k",
    safeCapital: 0,
    planningCapital: 5_000,
  },
  {
    optionLabel: "£10k–£25k",
    safeCapital: 10_000,
    planningCapital: 17_500,
  },
  {
    optionLabel: "£25k–£50k",
    safeCapital: 25_000,
    planningCapital: 37_500,
  },
  {
    optionLabel: "£50k–£100k",
    safeCapital: 50_000,
    planningCapital: 75_000,
  },
  {
    optionLabel: "£100k–£250k",
    safeCapital: 100_000,
    planningCapital: 175_000,
  },
  {
    optionLabel: "£250k+",
    safeCapital: 250_000,
    planningCapital: 250_000,
  },
];

export function resolveCapitalBand(label: string): CapitalBandRule {
  const exact = CAPITAL_BAND_RULES.find((r) => r.optionLabel === label);
  if (exact) return exact;
  // Fuzzy fallback if labels are edited slightly
  const lower = label.toLowerCase();
  if (lower.includes("less than") || lower.includes("<")) {
    return CAPITAL_BAND_RULES[0];
  }
  const match = CAPITAL_BAND_RULES.find((r) =>
    lower.includes(r.optionLabel.replace("£", "").slice(0, 4).toLowerCase()),
  );
  return match ?? CAPITAL_BAND_RULES[0];
}

export function resolveFinanceRoute(label: string): FinanceRoute {
  const t = label.toLowerCase();
  if (t.includes("mortgage")) return "mortgage";
  if (t.includes("cash")) return "cash";
  if (t.includes("both")) return "both";
  if (t.includes("recommend")) return "recommend";
  return "recommend";
}

export type SuggestedRoute = {
  key: string;
  label: string;
  blurb: string;
};

export function suggestedRouteForGoal(goalLabel: string): SuggestedRoute {
  const t = goalLabel.toLowerCase();
  if (t.includes("passive") || t.includes("income")) {
    return {
      key: "income",
      label: "Income-led",
      blurb: "Prioritise net income and yield within your buying power.",
    };
  }
  if (t.includes("wealth") || t.includes("long-term")) {
    return {
      key: "growth",
      label: "Growth-led",
      blurb: "Prioritise projected capital growth over your selected horizon.",
    };
  }
  if (t.includes("retirement")) {
    return {
      key: "retirement",
      label: "Retirement-led",
      blurb: "Balance income and growth toward your retirement window.",
    };
  }
  if (t.includes("portfolio")) {
    return {
      key: "portfolio",
      label: "Portfolio-led",
      blurb: "Optimise the next acquisition for your stated portfolio objective.",
    };
  }
  if (t.includes("family") || t.includes("legacy") || t.includes("future")) {
    return {
      key: "legacy",
      label: "Long-horizon",
      blurb: "Build toward a future milestone with growth and resilience.",
    };
  }
  return {
    key: "balanced",
    label: "Balanced",
    blurb: "Balances income, growth and affordability until you choose a clearer goal.",
  };
}

export type BuyingPowerResult = {
  safeCapital: number;
  planningCapital: number;
  financeRoute: FinanceRoute;
  ltvPct: number;
  deposit: number;
  loan: number | null;
  buyingPower: number;
  financeLabel: string;
  financeNote: string;
  belowMatchFloor: boolean;
};

/**
 * Illustrative buying power (admin preview).
 * Cash: buying power ≈ Safe Capital.
 * Mortgage / recommend / both: base budget = Safe Capital ÷ (1 − LTV).
 */
export function computeBuyingPower(input: {
  capitalLabel: string;
  financeLabel: string;
  ltvPct?: number;
}): BuyingPowerResult {
  const band = resolveCapitalBand(input.capitalLabel);
  const route = resolveFinanceRoute(input.financeLabel);
  const ltvPct = input.ltvPct ?? 65;
  const deposit = band.safeCapital;
  const belowMatchFloor = deposit <= 0;

  if (route === "cash") {
    return {
      safeCapital: band.safeCapital,
      planningCapital: band.planningCapital,
      financeRoute: route,
      ltvPct: 0,
      deposit,
      loan: null,
      buyingPower: deposit,
      financeLabel: "Cash",
      financeNote: "Cash purchase — no financing",
      belowMatchFloor,
    };
  }

  const ltv = Math.min(Math.max(ltvPct, 0), 95) / 100;
  const buyingPower =
    deposit > 0 && ltv < 1 ? Math.round(deposit / (1 - ltv)) : 0;
  const loan = buyingPower > 0 ? buyingPower - deposit : null;

  const financeLabel =
    route === "mortgage"
      ? "Mortgage"
      : route === "both"
        ? "Mortgage & cash"
        : "Recommended";

  return {
    safeCapital: band.safeCapital,
    planningCapital: band.planningCapital,
    financeRoute: route,
    ltvPct,
    deposit,
    loan,
    buyingPower,
    financeLabel,
    financeNote:
      route === "mortgage"
        ? `Illustrative at ${ltvPct}% LTV`
        : route === "both"
          ? `Comparing routes · mortgage shown at ${ltvPct}% LTV`
          : `Recommended route · illustrative at ${ltvPct}% LTV`,
    belowMatchFloor,
  };
}

export function formatGbp(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function buildGoalHeadline(input: {
  goalLabel: string;
  targetLabel?: string;
  horizonLabel?: string;
}): string {
  const goal = input.goalLabel || "Your property goal";
  const target = input.targetLabel?.trim();
  const horizon = input.horizonLabel?.trim();

  if (goal.toLowerCase().includes("wealth") && target && horizon) {
    return `Build long-term property wealth toward ${target} over ${horizon.replace(/^Within\s+/i, "").replace(/\+$/, "+ years")}`.replace(
      /over (\d+)–(\d+) years/,
      "over $2 years",
    );
  }
  if (goal.toLowerCase().includes("passive") || goal.toLowerCase().includes("income")) {
    const parts = [goal];
    if (target) parts.push(`aiming for ${target}`);
    if (horizon) parts.push(`within ${horizon.replace(/^Within\s+/i, "")}`);
    return parts.join(" · ");
  }
  if (target && horizon) return `${goal} · ${target} · ${horizon}`;
  if (target) return `${goal} · ${target}`;
  return goal;
}
