/**
 * Calculator journey mock — mirrors live mobile flow:
 * https://joseph-mews-mobile-app.onrender.com/calculator
 *
 * Branching follows mobile `r3(answers)` sequencing:
 * Goal → (path-specific Route questions) → Capital → Finance → Plan
 */

import {
  resolveOptionNext,
  resolveSharedOptionNext,
} from "@/lib/calculatorMobileRouting";

export type CalcStage = "goal" | "route" | "capital" | "finance" | "plan";

/** Built-in keys from mobile + any admin-created custom keys. */
export type CalcQuestionKey = string;

export type CalcNextTarget = CalcQuestionKey | "plan";

export type CalcOption = {
  id: string;
  value: string;
  label: string;
  description?: string;
  badge?: string;
  /** Indicative mortgage rate % — used on Finance residency options */
  indicativeRate?: number;
  sortOrder: number;
  active: boolean;
  /**
   * Immediate next question key after this option (same journey).
   * `"plan"` jumps to the Plan result; omit/undefined = continues linearly on path.
   */
  nextQuestionKey?: CalcNextTarget | null;
  /**
   * Mobile tab for that next step: goal | route | capital | finance | plan.
   */
  nextStage?: CalcStage | null;
};

export type CalcQuestion = {
  id: string;
  key: CalcQuestionKey;
  stage: CalcStage;
  /** Mobile caption, e.g. "Monthly income aim" */
  caption: string;
  title: string;
  helper: string;
  instruction: string;
  options: CalcOption[];
  /** Nested same-screen follow-up (Finance residency) */
  followUp?: {
    title: string;
    helper: string;
    instruction: string;
    options: CalcOption[];
  };
  sortOrder: number;
  active: boolean;
};

export type CalcPathStep = {
  questionKey: CalcQuestionKey;
  /** When this step appears on the path */
  when: string;
};

/** One goal branch = the route investors take after picking a Goal option. */
export type CalcPath = {
  id: string;
  goalValue: string;
  label: string;
  description: string;
  /** First question after choosing this goal */
  entryQuestionKey: CalcQuestionKey;
  /** Ordered Route-stage steps (excludes Goal / Capital / Finance / Plan) */
  routeSteps: CalcPathStep[];
  /** Capital steps for this path */
  capitalSteps: CalcPathStep[];
  /** Whether Finance stage is shown */
  includesFinance: boolean;
};

export type CalcPlanBlock = {
  id: string;
  title: string;
  description: string;
  fedBy: string;
  enabled: boolean;
  sortOrder: number;
};

export const CALC_STAGES: {
  key: CalcStage;
  label: string;
  description: string;
}[] = [
  {
    key: "goal",
    label: "Goal",
    description: "Entry question — each option opens a different journey branch.",
  },
  {
    key: "route",
    label: "Route",
    description: "Goal-specific questions (experience, targets, portfolio, family…).",
  },
  {
    key: "capital",
    label: "Capital",
    description: "Available funds and (on most paths) future contributions.",
  },
  {
    key: "finance",
    label: "Finance",
    description: "Purchase preference and residency for mortgage assumptions.",
  },
  {
    key: "plan",
    label: "Plan",
    description: "Your Investment Plan — result screen after answers are complete.",
  },
];

function opt(
  id: string,
  value: string,
  label: string,
  sortOrder: number,
  extra: Partial<CalcOption> = {},
): CalcOption {
  return {
    id,
    value,
    label,
    sortOrder,
    active: true,
    ...extra,
  };
}

/** Full question catalogue (shared across paths). */
export const CALC_QUESTIONS: CalcQuestion[] = [
  {
    id: "q_goal",
    key: "goal",
    stage: "goal",
    caption: "What property should achieve",
    title: "What are you looking to achieve through property?",
    helper:
      "We'll shape the questions and the plan around this. You don't need to pick a persona label.",
    instruction: "Tap an answer to continue.",
    sortOrder: 1,
    active: true,
    options: [
      opt("o_goal_income", "income", "Generate passive income", 1, {
        description: "Regular rental income from property",
        nextQuestionKey: "experience",
      }),
      opt("o_goal_wealth", "wealth", "Build long-term wealth", 2, {
        description: "Grow asset value over time",
        nextQuestionKey: "experience",
      }),
      opt("o_goal_portfolio", "portfolio", "Grow an existing portfolio", 3, {
        description: "Improve what you already own",
        nextQuestionKey: "portfolioSize",
      }),
      opt("o_goal_retirement", "retirement", "Plan for retirement", 4, {
        description: "Income or value at a future date",
        nextQuestionKey: "experience",
      }),
      opt("o_goal_family", "family", "Invest for my family / future", 5, {
        description: "A milestone, children or legacy",
        nextQuestionKey: "experience",
      }),
      opt("o_goal_unsure", "unsure", "Not sure yet", 6, {
        description: "We'll suggest a balanced starting route",
        nextQuestionKey: "unsurePriority",
      }),
    ],
  },
  {
    id: "q_unsure",
    key: "unsurePriority",
    stage: "goal",
    caption: "What matters most right now",
    title: "What matters most to you right now?",
    helper:
      "We'll suggest a starting route from this. You can change it before viewing recommendations.",
    instruction: "Tap an answer to continue.",
    sortOrder: 2,
    active: true,
    options: [
      opt("o_unsure_income", "income", "Creating regular income", 1, {
        nextQuestionKey: "experience",
      }),
      opt("o_unsure_growth", "growth", "Growing money over time", 2, {
        nextQuestionKey: "experience",
      }),
      opt("o_unsure_portfolio", "portfolio", "Building a property portfolio", 3, {
        nextQuestionKey: "experience",
      }),
      opt("o_unsure_future", "future", "Planning for the future", 4, {
        nextQuestionKey: "experience",
      }),
      opt("o_unsure_options", "options", "Keeping my options open", 5, {
        nextQuestionKey: "experience",
      }),
      opt("o_unsure_still", "still_unsure", "I am still not sure", 6, {
        nextQuestionKey: "experience",
      }),
    ],
  },
  {
    id: "q_experience",
    key: "experience",
    stage: "route",
    caption: "Where you are today",
    title: "What is your property investment experience?",
    helper:
      "This changes whether we ask about an existing portfolio, and how much we explain along the way.",
    instruction: "Tap an answer to continue.",
    sortOrder: 1,
    active: true,
    options: [
      opt("o_exp_first", "first", "This is my first investment", 1, {
        description: "We'll keep terms simple and recommend a route",
      }),
      opt(
        "o_exp_home",
        "home_only",
        "I own my home but no investment property",
        2,
      ),
      opt("o_exp_12", "owns_1_2", "I own 1–2 investment properties", 3),
      opt("o_exp_3", "owns_3_plus", "I own 3+ investment properties", 4),
    ],
  },
  {
    id: "q_income_tf",
    key: "incomeTimeframe",
    stage: "route",
    caption: "When you want to reach it",
    title: "How soon would you like to reach this level?",
    helper: "This sets the horizon we use for the plan.",
    instruction: "Tap an answer to continue.",
    sortOrder: 2,
    active: true,
    options: [
      opt("o_inc_tf1", "within_5", "Within 5 years", 1),
      opt("o_inc_tf2", "5_10", "5–10 years", 2),
      opt("o_inc_tf3", "10_15", "10–15 years", 3),
      opt("o_inc_tf4", "15_20", "15+ years", 4),
      opt("o_inc_tf5", "flexible", "Flexible", 5),
    ],
  },
  {
    id: "q_current_income",
    key: "currentIncome",
    stage: "route",
    caption: "Current property income",
    title: "Do you already receive income from investment property?",
    helper: "Only used to show the remaining gap to your goal.",
    instruction: "Tap an answer to continue.",
    sortOrder: 3,
    active: true,
    options: [
      opt("o_cur_inc1", "none", "No", 1),
      opt("o_cur_inc2", "up_to_500", "Up to £500/month", 2),
      opt("o_cur_inc3", "500_1000", "£500–£1,000/month", 3),
      opt("o_cur_inc4", "1000_2000", "£1,000–£2,000/month", 4),
      opt("o_cur_inc5", "2000_plus", "£2,000+/month", 5),
    ],
  },
  {
    id: "q_growth",
    key: "growthPriority",
    stage: "route",
    caption: "How wealth should grow",
    title: "What matters most in the way your property wealth grows?",
    helper: "This decides whether we lean toward growth, income, or a blend.",
    instruction: "Tap an answer to continue.",
    sortOrder: 5,
    active: true,
    options: [
      opt("o_gr1", "steady", "Steady long-term growth", 1),
      opt("o_gr2", "maximise", "Maximise long-term growth", 2),
      opt("o_gr3", "balanced", "Balance growth and income", 3),
      opt("o_gr4", "portfolio", "Build a multi-property portfolio", 4),
      opt("o_gr5", "not_sure", "Not sure yet", 5),
    ],
  },
  {
    id: "q_wealth_h",
    key: "wealthHorizon",
    stage: "route",
    caption: "How long you will invest",
    title: "How long are you comfortable investing for?",
    helper: "We'll project the plan to the nearest supported horizon.",
    instruction: "Tap an answer to continue.",
    sortOrder: 6,
    active: true,
    options: [
      opt("o_wh1", "5", "5 years", 1),
      opt("o_wh2", "10", "10 years", 2),
      opt("o_wh3", "15", "15 years", 3),
      opt("o_wh4", "15_plus", "15+ years", 4),
    ],
  },
  {
    id: "q_wealth_t",
    key: "wealthTarget",
    stage: "route",
    caption: "Property-wealth aim",
    title: "Do you have a target level of property wealth in mind?",
    helper: "Optional. Used to show contribution toward the goal, not eligibility.",
    instruction: "Tap an answer to continue.",
    sortOrder: 7,
    active: true,
    options: [
      opt("o_wt1", "under_250k", "Under £250k", 1),
      opt("o_wt2", "250_500k", "£250k–£500k", 2),
      opt("o_wt3", "500k_1m", "£500k–£1m", 3),
      opt("o_wt4", "1m_2m", "£1m–£2m", 4),
      opt("o_wt5", "2m_plus", "£2m+", 5),
      opt("o_wt6", "no_target", "No fixed target", 6),
    ],
  },
  {
    id: "q_port_val",
    key: "currentPortfolioValue",
    stage: "route",
    caption: "Current portfolio value",
    title:
      "What is the approximate value of your current investment-property portfolio?",
    helper: "An estimate is enough — we use the band, not an exact figure.",
    instruction: "Tap an answer to continue.",
    sortOrder: 8,
    active: true,
    options: [
      opt("o_pv1", "under_250k", "Under £250k", 1),
      opt("o_pv2", "250_500k", "£250k–£500k", 2),
      opt("o_pv3", "500k_1m", "£500k–£1m", 3),
      opt("o_pv4", "1m_2m", "£1m–£2m", 4),
      opt("o_pv5", "2m_plus", "£2m+", 5),
      opt("o_pv6", "not_sure", "Not sure yet", 6),
    ],
  },
  {
    id: "q_ret_win",
    key: "retirementWindow",
    stage: "route",
    caption: "When you are planning for",
    title: "When are you planning for retirement?",
    helper: "The plan is built around this window.",
    instruction: "Tap an answer to continue.",
    sortOrder: 9,
    active: true,
    options: [
      opt("o_rw1", "within_5", "Within 5 years", 1),
      opt("o_rw2", "5_10", "5–10 years", 2),
      opt("o_rw3", "10_15", "10–20 years", 3),
      opt("o_rw4", "20_plus", "20+ years", 4),
    ],
  },
  {
    id: "q_ret_out",
    key: "retirementOutcome",
    stage: "route",
    caption: "What property should provide",
    title: "What would you most want property to provide at retirement?",
    helper: "This chooses whether we optimise for income, value, or both.",
    instruction: "Tap an answer to continue.",
    sortOrder: 10,
    active: true,
    options: [
      opt("o_ro1", "income", "Regular monthly income", 1, {
        nextQuestionKey: "retirementIncomeTarget",
      }),
      opt("o_ro2", "value", "A valuable property portfolio", 2, {
        nextQuestionKey: "retirementValueTarget",
      }),
      opt("o_ro3", "both", "Both income and growth", 3, {
        nextQuestionKey: "retirementIncomeTarget",
      }),
      opt("o_ro4", "legacy", "An asset to pass on", 4, {
        nextQuestionKey: "retirementValueTarget",
      }),
      opt("o_ro5", "not_sure", "Not sure yet", 5, {
        nextQuestionKey: "retirementIncomeTarget",
      }),
    ],
  },
  {
    id: "q_ret_inc",
    key: "retirementIncomeTarget",
    stage: "route",
    caption: "Retirement income aim",
    title: "What level of monthly income would you like property to provide?",
    helper: "We'll show how far the next property could contribute.",
    instruction: "Tap an answer to continue.",
    sortOrder: 11,
    active: true,
    options: [
      opt("o_ri1", "up_to_500", "Up to £500", 1),
      opt("o_ri2", "500_1000", "£500–£1,000", 2),
      opt("o_ri3", "1000_2000", "£1,000–£2,000", 3),
      opt("o_ri4", "2000_5000", "£2,000–£5,000", 4),
      opt("o_ri5", "5000_plus", "£5,000+", 5),
      opt("o_ri6", "not_sure", "Not sure yet", 6),
    ],
  },
  {
    id: "q_ret_val",
    key: "retirementValueTarget",
    stage: "route",
    caption: "Retirement portfolio aim",
    title: "What level of portfolio value would you like to work towards?",
    helper: "Used for progress, not to stretch affordability.",
    instruction: "Tap an answer to continue.",
    sortOrder: 12,
    active: true,
    options: [
      opt("o_rv1", "under_250k", "Under £250k", 1),
      opt("o_rv2", "250_500k", "£250k–£500k", 2),
      opt("o_rv3", "500k_1m", "£500k–£1m", 3),
      opt("o_rv4", "1m_2m", "£1m–£2m", 4),
      opt("o_rv5", "2m_plus", "£2m+", 5),
      opt("o_rv6", "not_sure", "Not sure yet", 6),
    ],
  },
  {
    id: "q_port_size",
    key: "portfolioSize",
    stage: "route",
    caption: "How many you own today",
    title: "How many investment properties do you currently own?",
    helper: "The next purchase is framed as an addition to this portfolio.",
    instruction: "Tap an answer to continue.",
    sortOrder: 13,
    active: true,
    options: [
      opt("o_ps1", "1_2", "1–2 properties", 1, {
        nextQuestionKey: "portfolioObjective",
      }),
      opt("o_ps2", "3_5", "3–5 properties", 2, {
        nextQuestionKey: "portfolioObjective",
      }),
      opt("o_ps3", "6_plus", "6+ properties", 3, {
        nextQuestionKey: "portfolioObjective",
      }),
    ],
  },
  {
    id: "q_port_obj",
    key: "portfolioObjective",
    stage: "route",
    caption: "What the next purchase should improve",
    title: "What should your next investment improve most?",
    helper: "We'll recommend the best next acquisition for this objective.",
    instruction: "Tap an answer to continue.",
    sortOrder: 14,
    active: true,
    options: [
      opt("o_po1", "income", "Increase rental income", 1, {
        nextQuestionKey: "currentPortfolioValue",
      }),
      opt("o_po2", "growth", "Increase long-term growth", 2, {
        nextQuestionKey: "currentPortfolioValue",
      }),
      opt("o_po3", "diversify", "Diversify my portfolio", 3, {
        nextQuestionKey: "currentPortfolioValue",
      }),
      opt("o_po4", "scale", "Grow the number of properties", 4, {
        nextQuestionKey: "currentPortfolioValue",
      }),
      opt("o_po5", "balanced", "Balance income and growth", 5, {
        nextQuestionKey: "currentPortfolioValue",
      }),
      opt("o_po6", "not_sure", "Not sure yet", 6, {
        nextQuestionKey: "currentPortfolioValue",
      }),
    ],
  },
  {
    id: "q_port_inc",
    key: "portfolioIncome",
    stage: "route",
    caption: "Current rental income",
    title:
      "What level of monthly rental income does the portfolio currently produce?",
    helper: "Skip this if you'd rather not use it in the plan.",
    instruction: "Tap an answer to continue.",
    sortOrder: 15,
    active: true,
    options: [
      opt("o_pi1", "up_to_500", "Under £500", 1),
      opt("o_pi2", "500_1000", "£500–£1,000", 2),
      opt("o_pi3", "1000_2000", "£1,000–£2,000", 3),
      opt("o_pi4", "2000_plus", "£2,000–£5,000", 4),
      opt("o_pi5", "prefer_not", "Prefer not to use this", 5),
    ],
  },
  {
    id: "q_fam_ms",
    key: "familyMilestone",
    stage: "route",
    caption: "Who or what this is for",
    title: "What is this investment mainly for?",
    helper: "We'll describe the plan in terms of this milestone.",
    instruction: "Tap an answer to continue.",
    sortOrder: 16,
    active: true,
    options: [
      opt("o_fm1", "children", "Children", 1),
      opt("o_fm2", "security", "Family security", 2),
      opt("o_fm3", "legacy", "Legacy", 3),
      opt("o_fm4", "lump_sum", "A future lump sum", 4),
    ],
  },
  {
    id: "q_fam_when",
    key: "familyWhen",
    stage: "route",
    caption: "When it should start serving the goal",
    title: "When do you expect this investment to start serving that goal?",
    helper: "This sets the long-horizon view in the plan.",
    instruction: "Tap an answer to continue.",
    sortOrder: 17,
    active: true,
    options: [
      opt("o_fw1", "within_5", "Within 5 years", 1),
      opt("o_fw2", "5_10", "5–10 years", 2),
      opt("o_fw3", "10_15", "10–15 years", 3),
      opt("o_fw4", "15_20", "15–20 years", 4),
      opt("o_fw5", "20_plus", "20+ years", 5),
    ],
  },
  {
    id: "q_fam_out",
    key: "familyOutcome",
    stage: "route",
    caption: "What matters most at that point",
    title: "What matters most at that point?",
    helper: "We'll rank properties around this outcome.",
    instruction: "Tap an answer to continue.",
    sortOrder: 18,
    active: true,
    options: [
      opt("o_fo1", "value", "A lump-sum asset value", 1, {
        nextQuestionKey: "familyValueTarget",
      }),
      opt("o_fo2", "income", "Ongoing monthly income", 2, {
        nextQuestionKey: "familyIncomeTarget",
      }),
      opt("o_fo3", "ownership", "Owning a long-term property asset", 3, {
        nextQuestionKey: "familyValueTarget",
      }),
      opt("o_fo4", "balanced", "A mix of income and value", 4, {
        nextQuestionKey: "familyValueTarget",
      }),
      opt("o_fo5", "not_sure", "Not sure yet", 5, {
        nextQuestionKey: "familyValueTarget",
      }),
    ],
  },
  {
    id: "q_fam_val",
    key: "familyValueTarget",
    stage: "route",
    caption: "Future value aim",
    title: "What level of value would you like to work towards?",
    helper: "Indicative only — shown as progress toward the milestone.",
    instruction: "Tap an answer to continue.",
    sortOrder: 19,
    active: true,
    options: [
      opt("o_fv1", "under_250k", "Under £250k", 1),
      opt("o_fv2", "250_500k", "£250k–£500k", 2),
      opt("o_fv3", "500k_1m", "£500k–£1m", 3),
      opt("o_fv4", "1m_2m", "£1m–£2m", 4),
      opt("o_fv5", "2m_plus", "£2m+", 5),
      opt("o_fv6", "not_sure", "Not sure yet", 6),
    ],
  },
  {
    id: "q_fam_inc",
    key: "familyIncomeTarget",
    stage: "route",
    caption: "Future income aim",
    title:
      "What level of monthly income would you like the portfolio to provide?",
    helper: "Indicative only — shown as progress toward the milestone.",
    instruction: "Tap an answer to continue.",
    sortOrder: 20,
    active: true,
    options: [
      opt("o_fi1", "up_to_500", "Up to £500", 1),
      opt("o_fi2", "500_1000", "£500–£1,000", 2),
      opt("o_fi3", "1000_2000", "£1,000–£2,000", 3),
      opt("o_fi4", "2000_5000", "£2,000–£5,000", 4),
      opt("o_fi5", "5000_plus", "£5,000+", 5),
      opt("o_fi6", "not_sure", "Not sure yet", 6),
    ],
  },
  {
    id: "q_capital",
    key: "capital",
    stage: "capital",
    caption: "Funds for the next investment",
    title: "How much capital do you have available for your next investment?",
    helper:
      "This is the cash you can put toward a deposit or a cash purchase. You can change it later.",
    instruction: "Tap an answer to continue.",
    sortOrder: 1,
    active: true,
    options: [
      opt("o_cap1", "under_10k", "Less than £10k", 1, {
        description: "Below the usual match floor — we'll show the funding gap",
        nextQuestionKey: "contributions",
      }),
      opt("o_cap2", "10_25k", "£10k–£25k", 2, {
        description: "Affordability uses £10k",
        nextQuestionKey: "contributions",
      }),
      opt("o_cap3", "25_50k", "£25k–£50k", 3, {
        description: "Affordability uses £25k",
        nextQuestionKey: "contributions",
      }),
      opt("o_cap4", "50_100k", "£50k–£100k", 4, {
        description: "Affordability uses £50k",
        nextQuestionKey: "contributions",
      }),
      opt("o_cap5", "100_250k", "£100k–£250k", 5, {
        description: "Affordability uses £100k",
        nextQuestionKey: "contributions",
      }),
      opt("o_cap6", "250k_plus", "£250k+", 6, {
        description: "Affordability uses £250k",
        nextQuestionKey: "contributions",
      }),
    ],
  },
  {
    id: "q_contrib",
    key: "contributions",
    stage: "capital",
    caption: "Future funding",
    title: "Could you add more capital over time?",
    helper:
      "Future contributions shape the longer route. They do not increase today's buying power.",
    instruction: "Tap an answer to continue.",
    sortOrder: 2,
    active: true,
    options: [
      opt("o_co1", "none", "No", 1, { nextQuestionKey: "finance" }),
      opt("o_co2", "up_to_500", "Up to £500/month", 2, {
        nextQuestionKey: "finance",
      }),
      opt("o_co3", "500_1000", "£500–£1,000/month", 3, {
        nextQuestionKey: "finance",
      }),
      opt("o_co4", "1000_2500", "£1,000–£2,500/month", 4, {
        nextQuestionKey: "finance",
      }),
      opt("o_co5", "2500_plus", "£2,500+/month", 5, {
        nextQuestionKey: "finance",
      }),
      opt("o_co6", "staged", "At specific stages only", 6, {
        nextQuestionKey: "finance",
      }),
    ],
  },
  {
    id: "q_finance",
    key: "finance",
    stage: "finance",
    caption: "How you prefer to purchase",
    title: "How would you prefer to purchase?",
    helper:
      "A mortgage uses your capital as a deposit so you can consider a higher-value property. Cash means buying without a loan. If you're unsure, we can recommend a route.",
    instruction: "Tap an answer to continue.",
    sortOrder: 1,
    active: true,
    options: [
      opt("o_fin1", "mortgage", "Mortgage", 1, {
        description: "Use a loan to increase buying power",
        nextQuestionKey: "finance",
        nextStage: "finance",
      }),
      opt("o_fin2", "cash", "Cash", 2, {
        description: "Purchase without financing",
        nextQuestionKey: "plan",
        nextStage: "plan",
      }),
      opt("o_fin3", "both", "Show me both", 3, {
        description: "Compare mortgage and cash on the same capital",
        nextQuestionKey: "finance",
        nextStage: "finance",
      }),
      opt("o_fin4", "recommend", "Recommend for me", 4, {
        description: "We'll pick the stronger purchase route",
        badge: "SUGGESTED",
        nextQuestionKey: "plan",
        nextStage: "plan",
      }),
    ],
    followUp: {
      title: "Where are you currently resident?",
      helper:
        "Residency sets your illustrative mortgage rate and SDLT treatment. You can change this later under Adjust assumptions. Shown on mobile when purchase is Mortgage or Show me both.",
      instruction: "Select residency to continue.",
      options: [
        opt("o_res1", "GCC", "GCC", 1, { indicativeRate: 5.4 }),
        opt("o_res2", "UK", "UK", 2, { indicativeRate: 4.5 }),
        opt("o_res3", "APAC", "APAC", 3, { indicativeRate: 5.49 }),
        opt("o_res4", "EU", "Mainland Europe", 4, { indicativeRate: 5.49 }),
        opt("o_res5", "Africa", "Africa", 5, { indicativeRate: 5.99 }),
      ],
    },
  },
];

/**
 * Goal → Route → Capital branches — exact product sequence.
 * Conditional Route steps appear only when earlier answers match.
 * Plan / returns / projection are result screens (not in this list).
 */
export const CALC_PATHS: CalcPath[] = [
  {
    id: "path_income",
    goalValue: "income",
    label: "Generate passive income",
    description: "Regular rental income from property",
    entryQuestionKey: "experience",
    routeSteps: [
      { questionKey: "experience", when: "Always after this goal" },
      { questionKey: "incomeTimeframe", when: "Always on this path" },
      {
        questionKey: "currentIncome",
        when: 'Only if experience is "1–2" or "3+ investment properties"',
      },
    ],
    capitalSteps: [
      { questionKey: "capital", when: "Always" },
      { questionKey: "contributions", when: "Always on this path" },
    ],
    includesFinance: true,
  },
  {
    id: "path_wealth",
    goalValue: "wealth",
    label: "Build long-term wealth",
    description: "Grow asset value over time",
    entryQuestionKey: "experience",
    routeSteps: [
      { questionKey: "experience", when: "Always after this goal" },
      { questionKey: "growthPriority", when: "Always on this path" },
      { questionKey: "wealthHorizon", when: "Always on this path" },
      { questionKey: "wealthTarget", when: "Always on this path" },
      {
        questionKey: "currentPortfolioValue",
        when: 'Only if experience is "1–2" or "3+"',
      },
    ],
    capitalSteps: [
      { questionKey: "capital", when: "Always" },
      { questionKey: "contributions", when: "Always on this path" },
    ],
    includesFinance: true,
  },
  {
    id: "path_portfolio",
    goalValue: "portfolio",
    label: "Grow an existing portfolio",
    description: "Improve what you already own",
    entryQuestionKey: "portfolioSize",
    routeSteps: [
      { questionKey: "portfolioSize", when: "Always after this goal (skips experience)" },
      { questionKey: "portfolioObjective", when: "Always on this path" },
      { questionKey: "currentPortfolioValue", when: "Always on this path" },
      {
        questionKey: "portfolioIncome",
        when: 'Only if objective is "Increase rental income," "Balance income and growth," or "Not sure yet"',
      },
    ],
    capitalSteps: [
      { questionKey: "capital", when: "Always" },
      { questionKey: "contributions", when: "Always on this path" },
    ],
    includesFinance: true,
  },
  {
    id: "path_retirement",
    goalValue: "retirement",
    label: "Plan for retirement",
    description: "Income or value at a future date",
    entryQuestionKey: "experience",
    routeSteps: [
      { questionKey: "experience", when: "Always after this goal" },
      { questionKey: "retirementWindow", when: "Always on this path" },
      { questionKey: "retirementOutcome", when: "Always on this path" },
      {
        questionKey: "retirementIncomeTarget",
        when: 'Shown when outcome is "Regular monthly income," "Both income and growth," or "Not sure yet"',
      },
      {
        questionKey: "retirementValueTarget",
        when: 'Shown when outcome is "A valuable property portfolio," "Both income and growth," "An asset to pass on," or "Not sure yet"',
      },
      {
        questionKey: "currentIncome",
        when: "Existing investor (1–2 or 3+) and only if income-target was shown",
      },
      {
        questionKey: "currentPortfolioValue",
        when: "Existing investor and only if value-target was shown",
      },
    ],
    capitalSteps: [
      { questionKey: "capital", when: "Always" },
      { questionKey: "contributions", when: "Always on this path" },
    ],
    includesFinance: true,
  },
  {
    id: "path_family",
    goalValue: "family",
    label: "Invest for my family / future",
    description: "A milestone, children or legacy",
    entryQuestionKey: "experience",
    routeSteps: [
      { questionKey: "experience", when: "Always after this goal" },
      { questionKey: "familyMilestone", when: "Always on this path" },
      { questionKey: "familyWhen", when: "Always on this path" },
      { questionKey: "familyOutcome", when: "Always on this path" },
      {
        questionKey: "familyValueTarget",
        when: 'Shown when outcome is "A lump-sum asset value," "Owning a long-term property asset," "A mix of income and value," or "Not sure yet"',
      },
      {
        questionKey: "familyIncomeTarget",
        when: 'Shown when outcome is "Ongoing monthly income," "A mix of income and value," or "Not sure yet"',
      },
      {
        questionKey: "currentIncome",
        when: "Existing investor (1–2 or 3+) and only if income-target was shown",
      },
      {
        questionKey: "currentPortfolioValue",
        when: "Existing investor and only if value-target was shown",
      },
    ],
    capitalSteps: [
      { questionKey: "capital", when: "Always" },
      { questionKey: "contributions", when: "Always on this path" },
    ],
    includesFinance: true,
  },
  {
    id: "path_unsure",
    goalValue: "unsure",
    label: "Not sure yet",
    description: "We'll suggest a balanced starting route",
    entryQuestionKey: "unsurePriority",
    routeSteps: [
      { questionKey: "experience", when: "After priority question on Goal" },
    ],
    capitalSteps: [
      {
        questionKey: "capital",
        when: "Always — then Finance (no contributions on this path)",
      },
    ],
    includesFinance: true,
  },
];

export const CALC_PLAN_BLOCKS: CalcPlanBlock[] = [
  {
    id: "cp1",
    title: "Your goal",
    description: "Outcome selected at Goal — same language as the journey.",
    fedBy: "Goal",
    enabled: true,
    sortOrder: 1,
  },
  {
    id: "cp2",
    title: "Where you are today",
    description: "Experience, capital available, and finance / residency.",
    fedBy: "Route · Experience + Capital + Finance",
    enabled: true,
    sortOrder: 2,
  },
  {
    id: "cp3",
    title: "Your suggested route",
    description: "Strategy explanation derived from the selected goal path.",
    fedBy: "Goal + Route answers",
    enabled: true,
    sortOrder: 3,
  },
  {
    id: "cp4",
    title: "Your buying power",
    description: "Affordability from capital band + purchase preference.",
    fedBy: "Capital + Finance",
    enabled: true,
    sortOrder: 4,
  },
  {
    id: "cp5",
    title: "Recommended next property",
    description: "Best next step in the plan.",
    fedBy: "All answers → recommendation",
    enabled: true,
    sortOrder: 5,
  },
  {
    id: "cp6",
    title: "Why this fits",
    description: "Up to three reasons tied to goal, affordability and timeline.",
    fedBy: "Goal weighting + property scores",
    enabled: true,
    sortOrder: 6,
  },
  {
    id: "cp7",
    title: "Progress towards the goal",
    description: "Contribution toward the selected income / value target.",
    fedBy: "Route targets + property metrics",
    enabled: true,
    sortOrder: 7,
  },
  {
    id: "cp8",
    title: "Next milestone",
    description: "What would likely come next after this purchase.",
    fedBy: "Goal + future funding",
    enabled: true,
    sortOrder: 8,
  },
  {
    id: "cp9",
    title: "Adjust assumptions",
    description: "Change finance, capital, timeframe or goal without restarting.",
    fedBy: "All prior steps",
    enabled: true,
    sortOrder: 9,
  },
];

export const CALC_DISCLAIMER =
  "Projections are estimates based on current assumptions and are for illustrative purposes only. Selected bands are shown as ranges; calculations remain indicative. SDLT and fees are not a quote.";

export function getQuestionByKey(
  questions: CalcQuestion[],
  key: CalcQuestionKey,
): CalcQuestion | undefined {
  return questions.find((q) => q.key === key);
}

/** Mobile stage tab label for a question key (Goal / Route / Capital / Finance). */
export function mobileStageLabel(stage: CalcStage): string {
  if (stage === "route") return "Route";
  if (stage === "goal") return "Goal";
  if (stage === "capital") return "Capital";
  if (stage === "finance") return "Finance";
  return "Plan";
}

/** True when a path step is only shown for some earlier answers (mobile r3). */
export function isConditionalPathStep(when: string): boolean {
  const w = when.toLowerCase();
  return (
    w.includes("only if") ||
    w.includes("shown when") ||
    w.includes("existing investor") ||
    (w.includes("only") && w.includes("if"))
  );
}

/**
 * Exact mobile question sequence for a Goal branch (before Plan).
 * Mirrors `r3(answers)` including conditional Route steps.
 */
export function mobileSequenceForPath(path: CalcPath): CalcPathStep[] {
  const steps: CalcPathStep[] = [
    { questionKey: "goal", when: "Goal · entry question" },
  ];

  if (path.goalValue === "unsure") {
    steps.push({
      questionKey: "unsurePriority",
      when: "Goal · after Not sure yet",
    });
  }

  for (const step of path.routeSteps) {
    steps.push({
      ...step,
      when: step.when.startsWith("Route")
        ? step.when
        : `Route · ${step.when}`,
    });
  }

  for (const step of path.capitalSteps) {
    steps.push({
      ...step,
      when: step.when.startsWith("Capital")
        ? step.when
        : `Capital · ${step.when}`,
    });
  }

  if (path.includesFinance) {
    steps.push({
      questionKey: "finance",
      when: "Finance · purchase + residency (mortgage / both)",
    });
  }

  return steps;
}

/**
 * Options on these questions carry their own branch targets
 * (not the linear next step in `ordersByPath`).
 */
const BRANCHING_QUESTION_KEYS = new Set([
  "goal",
  "retirementOutcome",
  "familyOutcome",
]);

/** Next question key after `questionKey` in a path order (last → plan). */
export function nextKeyInOrder(
  order: string[],
  questionKey: string,
): CalcNextTarget | undefined {
  const i = order.indexOf(questionKey);
  if (i < 0) return undefined;
  if (i >= order.length - 1) return "plan";
  return order[i + 1];
}

const BUILTIN_STAGE: Record<string, CalcStage> = {
  goal: "goal",
  unsurePriority: "goal",
  capital: "capital",
  contributions: "capital",
  finance: "finance",
  plan: "plan",
};

export function stageForQuestionKey(
  key: CalcQuestionKey,
  questions?: CalcQuestion[],
): CalcStage {
  if (key === "plan") return "plan";
  const fromList = questions
    ? getQuestionByKey(questions, key)?.stage
    : undefined;
  if (fromList) return fromList;
  if (BUILTIN_STAGE[key]) return BUILTIN_STAGE[key];
  // Catalogue lookup without a passed list
  const fromCatalogue = CALC_QUESTIONS.find((q) => q.key === key)?.stage;
  if (fromCatalogue) return fromCatalogue;
  return "route";
}

/**
 * Pair nextQuestionKey with the mobile tab (goal / route / capital / finance / plan).
 */
export function withNextStage<
  T extends {
    nextQuestionKey?: CalcNextTarget | null;
    nextStage?: CalcStage | null;
  },
>(option: T): T {
  const next = option.nextQuestionKey;
  if (!next) return { ...option, nextStage: null };
  return { ...option, nextStage: stageForQuestionKey(String(next)) };
}

/**
 * Ensure every option has `nextQuestionKey` + `nextStage` for this path.
 * Uses mobile routing table (doc); falls back to path order.
 */
export function applyPathNextKeysToOptions<
  T extends {
    value?: string;
    nextQuestionKey?: CalcNextTarget | null;
    nextStage?: CalcStage | null;
  },
>(
  questionKey: string,
  options: T[],
  pathOrder: string[],
  pathId?: string,
): T[] {
  const linear = nextKeyInOrder(pathOrder, questionKey);
  return options.map((o) => {
    const routed = pathId
      ? resolveOptionNext(pathId, questionKey, o.value ?? "")
      : resolveSharedOptionNext(questionKey, o.value ?? "");
    const next =
      routed?.nextQuestionKey ?? linear ?? o.nextQuestionKey ?? undefined;
    if (next == null) return { ...o, nextStage: null };
    if (routed) {
      return {
        ...o,
        nextQuestionKey: routed.nextQuestionKey,
        nextStage: routed.nextStage,
      };
    }
    return withNextStage({ ...o, nextQuestionKey: next });
  });
}

/**
 * Shared `stages` default next when paths disagree (e.g. experience).
 * Prefer income path, else first path that contains the question.
 */
export function defaultNextForSharedQuestion(
  questionKey: string,
  paths: CalcPath[] = CALC_PATHS,
): CalcNextTarget | undefined {
  if (BRANCHING_QUESTION_KEYS.has(questionKey)) return undefined;
  const preferred =
    paths.find((p) => p.goalValue === "income") ?? paths[0];
  const candidates = preferred ? [preferred, ...paths] : paths;
  for (const path of candidates) {
    const order = mobileSequenceForPath(path).map((s) => s.questionKey);
    const next = nextKeyInOrder(order, questionKey);
    if (next) return next;
  }
  return undefined;
}

export function nextStepLabel(
  questions: CalcQuestion[],
  next: CalcQuestionKey | "plan" | null | undefined,
): string {
  if (!next) return "Continues on this path";
  if (next === "plan") return "Your Investment Plan";
  const fromPath = getQuestionByKey(questions, next);
  // Prefer full question prompt (matches mobile / API nextQuestionKey text)
  if (fromPath?.title?.trim()) return fromPath.title.trim();
  const fromCatalogue = CALC_QUESTIONS.find((q) => q.key === next);
  if (fromCatalogue?.title?.trim()) return fromCatalogue.title.trim();
  return next;
}

export function nextStepStage(
  next: CalcQuestionKey | "plan" | null | undefined,
  questions?: CalcQuestion[],
): CalcStage | "plan" | null {
  if (!next) return null;
  if (next === "plan") return "plan";
  return stageForQuestionKey(next, questions);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Starter answer options so a new question mirrors mobile card lists. */
export function createStarterOptions(count = 3): CalcOption[] {
  return Array.from({ length: count }, (_, i) =>
    opt(uid("opt"), `option_${i + 1}`, `Option ${i + 1}`, i + 1),
  );
}

/** Blank question with starter options — used when linking a new branch. */
export function createBlankQuestion(
  stage: CalcStage,
  patch: Partial<Pick<CalcQuestion, "title" | "caption" | "helper">> = {},
): CalcQuestion {
  const key = uid("custom");
  return {
    id: uid("q"),
    key,
    stage,
    caption: patch.caption ?? "New step",
    title: patch.title ?? "New question",
    helper: patch.helper ?? "We'll use this answer in the plan.",
    instruction: "Tap an answer to continue.",
    options: createStarterOptions(3),
    sortOrder: Date.now(),
    active: true,
  };
}

/** New option that already opens a fresh next question (full hierarchy). */
export function createLinkedOption(
  label: string,
  sortOrder: number,
  nextQuestion: CalcQuestion,
): CalcOption {
  return withNextStage(
    opt(uid("opt"), uid("val"), label, sortOrder, {
      nextQuestionKey: nextQuestion.key,
    }),
  );
}

