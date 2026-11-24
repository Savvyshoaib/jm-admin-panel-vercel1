/**
 * Mobile calculator option routing — mirrors the Goal → Route → Capital → Finance → Plan
 * flow documented for joseph-mews-mobile-app (five tabs).
 *
 * `nextQuestionKey` = next question key (or "plan").
 * `nextStage` = mobile tab: goal | route | capital | finance | plan.
 *
 * Where the next screen depends on an earlier answer (e.g. experience), options share
 * the next key that appears in that path’s order; the app skips conditionals at runtime.
 */

export type CalcNextTarget = string;
export type CalcStage = "goal" | "route" | "capital" | "finance" | "plan";

export type OptionNext = {
  nextQuestionKey: CalcNextTarget;
  nextStage: CalcStage;
};

const STAGE_BY_KEY: Record<string, CalcStage> = {
  goal: "goal",
  unsurePriority: "goal",
  experience: "route",
  incomeTimeframe: "route",
  currentIncome: "route",
  growthPriority: "route",
  wealthHorizon: "route",
  wealthTarget: "route",
  currentPortfolioValue: "route",
  retirementWindow: "route",
  retirementOutcome: "route",
  retirementIncomeTarget: "route",
  retirementValueTarget: "route",
  portfolioSize: "route",
  portfolioObjective: "route",
  portfolioIncome: "route",
  familyMilestone: "route",
  familyWhen: "route",
  familyOutcome: "route",
  familyValueTarget: "route",
  familyIncomeTarget: "route",
  capital: "capital",
  contributions: "capital",
  finance: "finance",
  plan: "plan",
};

export function stageForNextKey(key: string): CalcStage {
  if (key === "plan") return "plan";
  return STAGE_BY_KEY[key] ?? "route";
}

function nextOf(key: CalcNextTarget): OptionNext {
  return {
    nextQuestionKey: key,
    nextStage: stageForNextKey(String(key)),
  };
}

/** Goal tab — each answer opens a different branch. */
const GOAL_NEXT: Record<string, OptionNext> = {
  income: nextOf("experience"),
  wealth: nextOf("experience"),
  portfolio: nextOf("portfolioSize"),
  retirement: nextOf("experience"),
  family: nextOf("experience"),
  unsure: nextOf("unsurePriority"),
};

const RETIREMENT_OUTCOME_NEXT: Record<string, OptionNext> = {
  income: nextOf("retirementIncomeTarget"),
  value: nextOf("retirementValueTarget"),
  both: nextOf("retirementIncomeTarget"),
  legacy: nextOf("retirementValueTarget"),
  not_sure: nextOf("retirementIncomeTarget"),
};

const FAMILY_OUTCOME_NEXT: Record<string, OptionNext> = {
  value: nextOf("familyValueTarget"),
  income: nextOf("familyIncomeTarget"),
  ownership: nextOf("familyValueTarget"),
  balanced: nextOf("familyValueTarget"),
  not_sure: nextOf("familyValueTarget"),
};

/** Finance: Mortgage / Show me both stay for residency; Cash / Recommend → Plan. */
const FINANCE_NEXT: Record<string, OptionNext> = {
  mortgage: nextOf("finance"),
  cash: nextOf("plan"),
  both: nextOf("finance"),
  recommend: nextOf("plan"),
};

/**
 * Immediate next after answering `questionKey` with `optionValue` on `pathId`.
 */
export function resolveOptionNext(
  pathId: string,
  questionKey: string,
  optionValue: string,
): OptionNext | undefined {
  if (questionKey === "goal") {
    return GOAL_NEXT[optionValue] ?? nextOf("experience");
  }

  if (questionKey === "unsurePriority") {
    return nextOf("experience");
  }

  if (questionKey === "retirementOutcome") {
    return (
      RETIREMENT_OUTCOME_NEXT[optionValue] ?? nextOf("retirementIncomeTarget")
    );
  }

  if (questionKey === "familyOutcome") {
    return FAMILY_OUTCOME_NEXT[optionValue] ?? nextOf("familyValueTarget");
  }

  if (questionKey === "portfolioSize") {
    return nextOf("portfolioObjective");
  }

  if (questionKey === "portfolioObjective") {
    return nextOf("currentPortfolioValue");
  }

  if (questionKey === "finance") {
    return FINANCE_NEXT[optionValue] ?? nextOf("plan");
  }

  switch (pathId) {
    case "path_unsure":
      if (questionKey === "experience") return nextOf("capital");
      if (questionKey === "capital") return nextOf("finance");
      break;

    case "path_income":
      if (questionKey === "experience") return nextOf("incomeTimeframe");
      // First-time / home-only skip currentIncome (mobile r3). Existing
      // investors insert currentIncome at runtime before capital.
      if (questionKey === "incomeTimeframe") return nextOf("capital");
      if (questionKey === "currentIncome") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;

    case "path_wealth":
      if (questionKey === "experience") return nextOf("growthPriority");
      if (questionKey === "growthPriority") return nextOf("wealthHorizon");
      if (questionKey === "wealthHorizon") return nextOf("wealthTarget");
      // First-time skips currentPortfolioValue; existing investors insert it.
      if (questionKey === "wealthTarget") return nextOf("capital");
      if (questionKey === "currentPortfolioValue") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;

    case "path_portfolio":
      if (questionKey === "currentPortfolioValue") return nextOf("capital");
      if (questionKey === "portfolioIncome") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;

    case "path_retirement":
      if (questionKey === "experience") return nextOf("retirementWindow");
      if (questionKey === "retirementWindow") return nextOf("retirementOutcome");
      if (questionKey === "retirementIncomeTarget") {
        return nextOf("retirementValueTarget");
      }
      if (questionKey === "retirementValueTarget") return nextOf("currentIncome");
      if (questionKey === "currentIncome") return nextOf("currentPortfolioValue");
      if (questionKey === "currentPortfolioValue") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;

    case "path_family":
      if (questionKey === "experience") return nextOf("familyMilestone");
      if (questionKey === "familyMilestone") return nextOf("familyWhen");
      if (questionKey === "familyWhen") return nextOf("familyOutcome");
      if (questionKey === "familyValueTarget") return nextOf("familyIncomeTarget");
      if (questionKey === "familyIncomeTarget") return nextOf("currentIncome");
      if (questionKey === "currentIncome") return nextOf("currentPortfolioValue");
      if (questionKey === "currentPortfolioValue") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;

    default:
      break;
  }

  if (questionKey === "capital") return nextOf("contributions");
  if (questionKey === "contributions") return nextOf("finance");

  return undefined;
}

/** Shared stages catalogue defaults (goal branches + income-led neighbours). */
export function resolveSharedOptionNext(
  questionKey: string,
  optionValue: string,
): OptionNext | undefined {
  if (questionKey === "goal") return GOAL_NEXT[optionValue];
  if (questionKey === "unsurePriority") return nextOf("experience");
  if (questionKey === "retirementOutcome") {
    return RETIREMENT_OUTCOME_NEXT[optionValue];
  }
  if (questionKey === "familyOutcome") {
    return FAMILY_OUTCOME_NEXT[optionValue];
  }
  if (questionKey === "portfolioSize") return nextOf("portfolioObjective");
  if (questionKey === "portfolioObjective") return nextOf("currentPortfolioValue");
  if (questionKey === "finance") return FINANCE_NEXT[optionValue];
  return resolveOptionNext("path_income", questionKey, optionValue);
}
