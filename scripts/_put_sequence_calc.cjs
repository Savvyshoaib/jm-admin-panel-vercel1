/**
 * PUT default calculator flow with canonical path sequence (ordersByPath + paths).
 */
const fs = require("fs");
const path = require("path");

const EXPECTED = {
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
  if (!token) throw new Error("no token");

  const get = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const gj = await get.json();
  const data = gj.data || gj;

  // Lock orders + path step lists from product spec
  data.ordersByPath = { ...EXPECTED };
  if (!data.calculationLogic) data.calculationLogic = {};
  if (!data.calculationLogic.adminJourney) {
    data.calculationLogic.adminJourney = {};
  }
  data.calculationLogic.adminJourney.ordersByPath = { ...EXPECTED };

  // Rebuild paths route/capital steps in canonical order if present
  const pathMeta = {
    path_income: {
      goalValue: "income",
      label: "Generate passive income",
      description: "Regular rental income from property",
      entryQuestionKey: "experience",
      routeSteps: [
        { questionKey: "experience", when: "Always after this goal" },
        { questionKey: "incomeTarget", when: "Always on this path" },
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
    path_wealth: {
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
    path_portfolio: {
      goalValue: "portfolio",
      label: "Grow an existing portfolio",
      description: "Improve what you already own",
      entryQuestionKey: "portfolioSize",
      routeSteps: [
        {
          questionKey: "portfolioSize",
          when: "Always after this goal (skips experience)",
        },
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
    path_retirement: {
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
    path_family: {
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
    path_unsure: {
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
  };

  data.paths = Object.entries(pathMeta).map(([id, meta]) => ({
    id,
    ...meta,
  }));
  data.calculationLogic.adminJourney.paths = data.paths;

  const payload = JSON.stringify(data);
  const put = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: payload,
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
  const d2 = g2.data || g2;
  fs.writeFileSync(
    path.join(__dirname, "_calc_default_api.json"),
    JSON.stringify(g2, null, 2),
  );

  const orders =
    d2.ordersByPath ||
    d2.calculationLogic?.adminJourney?.ordersByPath ||
    {};
  for (const [id, expected] of Object.entries(EXPECTED)) {
    const got = orders[id] || [];
    const ok =
      got.length === expected.length &&
      expected.every((k, i) => got[i] === k);
    console.log(id, ok ? "OK" : "MISMATCH", JSON.stringify(got));
  }
  const unsure = orders.path_unsure || [];
  console.log(
    "unsure has contributions?",
    unsure.includes("contributions"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
