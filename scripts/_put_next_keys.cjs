/**
 * Fill nextQuestionKey on every option (path order + branching), then PUT.
 */
const fs = require("fs");
const path = require("path");

const BRANCHING = new Set(["goal", "retirementOutcome", "familyOutcome"]);

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

function cleanQ(s) {
  if (typeof s !== "string") return s;
  return s.replace(/\s+(ff|ccc)\s*$/i, "").trim();
}

function fillOptions(questionKey, options, order) {
  const linear = nextInOrder(order, questionKey);
  const keep = BRANCHING.has(questionKey);
  return (options || []).map((o) => {
    if (keep && o.nextQuestionKey) return o;
    const next = linear ?? o.nextQuestionKey;
    return next == null ? o : { ...o, nextQuestionKey: next };
  });
}

function fillStage(stage, order) {
  const key = stage.key || "";
  const out = {
    ...stage,
    question: cleanQ(stage.question),
    options: fillOptions(key, stage.options, order),
  };
  if (out.followUp?.options) {
    out.followUp = { ...out.followUp, options: [...out.followUp.options] };
  }
  return out;
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

  // Shared stages — income-path default next
  data.stages = (data.stages || []).map((s) => {
    const key = s.key || "";
    const linear = sharedNext(key);
    const keep = BRANCHING.has(key);
    return {
      ...s,
      question: cleanQ(s.question),
      options: (s.options || []).map((o) => {
        if (keep && o.nextQuestionKey) return o;
        const next = o.nextQuestionKey || linear;
        return next == null ? o : { ...o, nextQuestionKey: next };
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
      const base =
        existingQbp[pathId]?.[key] || byKey[key];
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
  const putText = await put.text();
  console.log("PUT", put.status, putText.slice(0, 180));
  if (!put.ok) process.exit(1);

  const get2 = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const g2 = await get2.json();
  const d2 = g2.data || g2;
  fs.writeFileSync(
    path.join(__dirname, "_calc_default_api.json"),
    JSON.stringify(g2, null, 2),
  );

  let missing = 0;
  let total = 0;
  function check(opts, ctx) {
    for (const o of opts || []) {
      total += 1;
      if (!o.nextQuestionKey) {
        missing += 1;
        if (missing <= 12) console.log("MISSING", ctx, o.id, o.label);
      }
    }
  }
  for (const s of d2.stages || []) {
    check(s.options, "stages." + s.key);
  }
  const qbp = d2.calculationLogic?.adminJourney?.questionsByPath || {};
  console.log(
    "unsure capital next:",
    qbp.path_unsure?.capital?.options?.[0]?.nextQuestionKey,
  );
  console.log(
    "wealth experience next:",
    qbp.path_wealth?.experience?.options?.[0]?.nextQuestionKey,
  );
  console.log(
    "income experience next:",
    qbp.path_income?.experience?.options?.[0]?.nextQuestionKey,
  );
  console.log(
    "goal question:",
    d2.stages.find((s) => s.key === "goal")?.question,
  );
  console.log("options total", total, "missing next", missing);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
