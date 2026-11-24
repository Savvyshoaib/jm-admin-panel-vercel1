/**
 * Stamp nextQuestionKey + nextStage on every option, then PUT default flow.
 */
const fs = require("fs");
const path = require("path");

const BRANCHING = new Set(["goal", "retirementOutcome", "familyOutcome"]);

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
  path_unsure: [
    "goal",
    "unsurePriority",
    "experience",
    "capital",
    "finance",
  ],
};

function nextInOrder(order, key) {
  const i = order.indexOf(key);
  if (i < 0) return undefined;
  if (i >= order.length - 1) return "plan";
  return order[i + 1];
}

function stageFor(key) {
  return STAGE_BY_KEY[key] || "route";
}

function withNext(o, nextKey) {
  if (!nextKey) return { ...o, nextQuestionKey: null, nextStage: null };
  return {
    ...o,
    nextQuestionKey: nextKey,
    nextStage: stageFor(nextKey),
  };
}

function fillOptions(questionKey, options, order) {
  const linear = nextInOrder(order, questionKey);
  const keep = BRANCHING.has(questionKey);
  return (options || []).map((o) => {
    let next = o.nextQuestionKey;
    if (!(keep && next)) next = linear || next;
    return withNext(o, next);
  });
}

function fillStage(stage, order) {
  const key = stage.key || "";
  return {
    ...stage,
    question:
      typeof stage.question === "string"
        ? stage.question.replace(/\s+(ff|ccc)\s*$/i, "").trim()
        : stage.question,
    options: fillOptions(key, stage.options, order),
  };
}

function sharedNext(key) {
  if (BRANCHING.has(key)) return undefined;
  for (const order of Object.values(ORDERS)) {
    const n = nextInOrder(order, key);
    if (n) return n;
  }
  return undefined;
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

  const get = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const gj = await get.json();
  const data = gj.data || gj;

  data.stages = (data.stages || []).map((s) => {
    const key = s.key || "";
    const linear = sharedNext(key);
    const keep = BRANCHING.has(key);
    return {
      ...s,
      question:
        typeof s.question === "string"
          ? s.question.replace(/\s+(ff|ccc)\s*$/i, "").trim()
          : s.question,
      options: (s.options || []).map((o) => {
        let next = o.nextQuestionKey;
        if (!(keep && next)) next = next || linear;
        return withNext(o, next);
      }),
    };
  });

  const byKey = Object.fromEntries(
    data.stages.filter((s) => s.key).map((s) => [s.key, s]),
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
      pathQs[key] = fillStage(JSON.parse(JSON.stringify(base)), order);
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
  console.log("PUT", put.status, (await put.text()).slice(0, 160));
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
  const sample = d2.stages
    .find((s) => s.key === "contributions")
    ?.options?.find((o) => o.id === "o_co5");
  console.log("sample o_co5", sample);
  const unsureCap = d2.calculationLogic?.adminJourney?.questionsByPath
    ?.path_unsure?.capital?.options?.[0];
  console.log("unsure capital", {
    nextQuestionKey: unsureCap?.nextQuestionKey,
    nextStage: unsureCap?.nextStage,
  });

  let missing = 0;
  let total = 0;
  function walk(opts) {
    for (const o of opts || []) {
      total += 1;
      if (!o.nextQuestionKey || !o.nextStage) missing += 1;
    }
  }
  for (const s of d2.stages || []) walk(s.options);
  console.log("stages options", total, "missing key or stage", missing);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
