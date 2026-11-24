/**
 * PUT default calculator flow with mobile-doc orders + option nextQuestionKey/nextStage.
 */
const fs = require("fs");
const path = require("path");

const STAGE_BY_KEY = {
  goal: "goal",
  unsurePriority: "goal",
  experience: "route",
  incomeTarget: "route",
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

const ORDERS = {
  path_income: [
    "goal",
    "experience",
    "incomeTarget",
    "incomeTimeframe",
    "currentIncome",
    "capital",
    "contributions",
    "finance",
  ],
  path_wealth: [
    "goal",
    "experience",
    "growthPriority",
    "wealthHorizon",
    "wealthTarget",
    "currentPortfolioValue",
    "capital",
    "contributions",
    "finance",
  ],
  path_portfolio: [
    "goal",
    "portfolioSize",
    "portfolioObjective",
    "currentPortfolioValue",
    "portfolioIncome",
    "capital",
    "contributions",
    "finance",
  ],
  path_retirement: [
    "goal",
    "experience",
    "retirementWindow",
    "retirementOutcome",
    "retirementIncomeTarget",
    "retirementValueTarget",
    "currentIncome",
    "currentPortfolioValue",
    "capital",
    "contributions",
    "finance",
  ],
  path_family: [
    "goal",
    "experience",
    "familyMilestone",
    "familyWhen",
    "familyOutcome",
    "familyValueTarget",
    "familyIncomeTarget",
    "currentIncome",
    "currentPortfolioValue",
    "capital",
    "contributions",
    "finance",
  ],
  path_unsure: ["goal", "unsurePriority", "experience", "capital", "finance"],
};

function stageFor(key) {
  if (key === "plan") return "plan";
  return STAGE_BY_KEY[key] || "route";
}

function nextOf(key) {
  return { nextKey: key, nextQuestionKey: key, nextStage: stageFor(key) };
}

const GOAL_NEXT = {
  income: nextOf("experience"),
  wealth: nextOf("experience"),
  portfolio: nextOf("portfolioSize"),
  retirement: nextOf("experience"),
  family: nextOf("experience"),
  unsure: nextOf("unsurePriority"),
};

const RETIREMENT_OUTCOME_NEXT = {
  income: nextOf("retirementIncomeTarget"),
  value: nextOf("retirementValueTarget"),
  both: nextOf("retirementIncomeTarget"),
  legacy: nextOf("retirementValueTarget"),
  not_sure: nextOf("retirementIncomeTarget"),
};

const FAMILY_OUTCOME_NEXT = {
  value: nextOf("familyValueTarget"),
  income: nextOf("familyIncomeTarget"),
  ownership: nextOf("familyValueTarget"),
  balanced: nextOf("familyValueTarget"),
  not_sure: nextOf("familyValueTarget"),
};

const FINANCE_NEXT = {
  mortgage: nextOf("finance"),
  cash: nextOf("plan"),
  both: nextOf("finance"),
  recommend: nextOf("plan"),
};

function resolveOptionNext(pathId, questionKey, optionValue) {
  if (questionKey === "goal") {
    return GOAL_NEXT[optionValue] || nextOf("experience");
  }
  if (questionKey === "unsurePriority") return nextOf("experience");
  if (questionKey === "retirementOutcome") {
    return (
      RETIREMENT_OUTCOME_NEXT[optionValue] || nextOf("retirementIncomeTarget")
    );
  }
  if (questionKey === "familyOutcome") {
    return FAMILY_OUTCOME_NEXT[optionValue] || nextOf("familyValueTarget");
  }
  if (questionKey === "portfolioSize") return nextOf("portfolioObjective");
  if (questionKey === "portfolioObjective") return nextOf("currentPortfolioValue");
  if (questionKey === "finance") {
    return FINANCE_NEXT[optionValue] || nextOf("plan");
  }

  switch (pathId) {
    case "path_unsure":
      if (questionKey === "experience") return nextOf("capital");
      if (questionKey === "capital") return nextOf("finance");
      break;
    case "path_income":
      if (questionKey === "experience") return nextOf("incomeTarget");
      if (questionKey === "incomeTarget") return nextOf("incomeTimeframe");
      // First-time / home-only → capital; existing investors insert currentIncome at runtime.
      if (questionKey === "incomeTimeframe") return nextOf("capital");
      if (questionKey === "currentIncome") return nextOf("capital");
      if (questionKey === "capital") return nextOf("contributions");
      if (questionKey === "contributions") return nextOf("finance");
      break;
    case "path_wealth":
      if (questionKey === "experience") return nextOf("growthPriority");
      if (questionKey === "growthPriority") return nextOf("wealthHorizon");
      if (questionKey === "wealthHorizon") return nextOf("wealthTarget");
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

function resolveSharedOptionNext(questionKey, optionValue) {
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

function nextInOrder(order, key) {
  const i = order.indexOf(key);
  if (i < 0) return undefined;
  if (i >= order.length - 1) return "plan";
  return order[i + 1];
}

function fillOptions(questionKey, options, order, pathId, textByKey) {
  const linear = nextInOrder(order, questionKey);
  const toHuman = (key) => {
    if (!key) return null;
    if (key === "plan") return "Your Investment Plan";
    return (textByKey && textByKey[key]) || key;
  };
  return (options || []).map((o) => {
    const routed = pathId
      ? resolveOptionNext(pathId, questionKey, o.value || "")
      : resolveSharedOptionNext(questionKey, o.value || "");
    const machine = routed
      ? routed.nextKey || routed.nextQuestionKey
      : linear || (o.nextKey && /^[a-z]/.test(o.nextKey) ? o.nextKey : null) ||
        (o.nextQuestionKey && /^[a-z][a-zA-Z0-9_]*$/.test(o.nextQuestionKey)
          ? o.nextQuestionKey
          : null);
    if (!machine) {
      return { ...o, nextQuestionKey: null, nextKey: null, nextStage: null };
    }
    return {
      ...o,
      nextKey: machine,
      nextQuestionKey: toHuman(machine),
      nextStage: stageFor(machine),
    };
  });
}

function fillStage(stage, order, pathId, textByKey) {
  const key = stage.key || "";
  return {
    ...stage,
    question:
      typeof stage.question === "string"
        ? stage.question.replace(/\s+(ff|ccc|dsd)\s*$/i, "").trim()
        : stage.question,
    options: fillOptions(key, stage.options, order, pathId, textByKey),
  };
}

async function main() {
  const login = await fetch("https://jm-backend.qiko.ai/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "shoaib@qiko.ai",
      password: "Admin123@",
    }),
  });
  const lj = await login.json();
  const token = lj.data?.token || lj.token;
  if (!token) {
    console.error("login failed", lj);
    process.exit(1);
  }

  const get = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const gj = await get.json();
  const data = gj.data || gj;

  // Build key → full question text from stages catalogue
  const textByKey = { plan: "Your Investment Plan" };
  for (const s of data.stages || []) {
    if (s.key && s.question) {
      textByKey[s.key] = String(s.question)
        .replace(/\s+(ff|ccc|dsd)\s*$/i, "")
        .trim();
    }
  }

  // Restore known clean goal labels (undo typos like "incomed")
  const CLEAN_GOAL = {
    o_goal_income: "Generate passive income",
    o_goal_wealth: "Build long-term wealth",
    o_goal_portfolio: "Grow an existing portfolio",
    o_goal_retirement: "Plan for retirement",
    o_goal_family: "Invest for my family / future",
    o_goal_unsure: "Not sure yet",
  };

  data.stages = (data.stages || []).map((s) => {
    const filled = fillStage(s, ORDERS.path_income, null, textByKey);
    if (filled.key === "goal") {
      filled.options = (filled.options || []).map((o) => ({
        ...o,
        label: CLEAN_GOAL[o.id] || o.label,
      }));
    }
    if (filled.key === "experience" && typeof filled.question === "string") {
      filled.question = filled.question.replace(/\s+dsd\s*$/i, "").trim();
    }
    return filled;
  });

  const byKey = Object.fromEntries(
    (data.stages || []).filter((s) => s.key).map((s) => [s.key, s]),
  );
  const existingQbp =
    data.calculationLogic?.adminJourney?.questionsByPath ||
    data.questionsByPath ||
    {};

  const questionsByPath = {};
  for (const [pathId, order] of Object.entries(ORDERS)) {
    const pathQs = {};
    for (const key of order) {
      const base = existingQbp[pathId]?.[key] || byKey[key];
      if (!base) continue;
      const filled = fillStage(
        JSON.parse(JSON.stringify(base)),
        order,
        pathId,
        textByKey,
      );
      if (filled.key === "goal") {
        filled.options = (filled.options || []).map((o) => ({
          ...o,
          label: CLEAN_GOAL[o.id] || o.label,
        }));
      }
      if (filled.key === "experience" && typeof filled.question === "string") {
        filled.question = filled.question.replace(/\s+dsd\s*$/i, "").trim();
      }
      pathQs[key] = filled;
    }
    questionsByPath[pathId] = pathQs;
  }

  data.ordersByPath = { ...ORDERS };
  data.questionsByPath = questionsByPath;
  if (!data.calculationLogic) data.calculationLogic = {};
  if (!data.calculationLogic.adminJourney) {
    data.calculationLogic.adminJourney = {};
  }
  data.calculationLogic.adminJourney.ordersByPath = { ...ORDERS };
  data.calculationLogic.adminJourney.questionsByPath = questionsByPath;
  data.calculationLogic.adminJourney.paths = data.calculationLogic.adminJourney.paths || data.paths;

  // Sync path labels from clean goal options
  if (Array.isArray(data.calculationLogic.adminJourney.paths)) {
    const goalOpts = byKey.goal?.options || [];
    data.calculationLogic.adminJourney.paths = data.calculationLogic.adminJourney.paths.map((p) => {
      const match = goalOpts.find((o) => o.value === p.goalValue);
      return {
        ...p,
        label: match?.label || p.label,
        entryQuestionKey:
          ({
            income: "experience",
            wealth: "experience",
            portfolio: "portfolioSize",
            retirement: "experience",
            family: "experience",
            unsure: "unsurePriority",
          })[p.goalValue] || p.entryQuestionKey,
      };
    });
  }

  if (Array.isArray(data.paths)) {
    data.paths = data.calculationLogic.adminJourney.paths || data.paths;
  }

  const put = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
  const putText = await put.text();
  console.log("PUT", put.status, putText.slice(0, 200));
  if (!put.ok) process.exit(1);

  const get2 = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const g2 = await get2.json();
  fs.writeFileSync(
    path.join(__dirname, "_calc_default_api.json"),
    JSON.stringify(g2, null, 2),
  );
  const d2 = g2.data || g2;
  const goal = d2.stages?.find((s) => s.key === "goal");
  const tf = d2.stages?.find((s) => s.key === "incomeTimeframe");
  console.log("goal income next", {
    nextKey: goal?.options?.[0]?.nextKey,
    nextQuestionKey: goal?.options?.[0]?.nextQuestionKey,
    nextStage: goal?.options?.[0]?.nextStage,
  });
  console.log("timeframe next", {
    nextKey: tf?.options?.[0]?.nextKey,
    nextQuestionKey: tf?.options?.[0]?.nextQuestionKey,
    nextStage: tf?.options?.[0]?.nextStage,
  });
  console.log("capital next", {
    nextKey: d2.stages?.find((s) => s.key === "capital")?.options?.[0]?.nextKey,
    nextQuestionKey: d2.stages?.find((s) => s.key === "capital")?.options?.[0]
      ?.nextQuestionKey,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
