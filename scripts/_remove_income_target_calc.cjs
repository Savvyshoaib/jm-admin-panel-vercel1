/**
 * Remove "What level of monthly property income are you aiming for?"
 * from the default calculator flow and rewire next pointers to its successor.
 */
const fs = require("fs");
const path = require("path");

const base = process.env.CALC_API_BASE || "https://jm-backend.qiko.ai";
const REMOVE_KEY = "incomeTarget";
const REMOVE_ID = "income_target";
const REMOVE_Q =
  "What level of monthly property income are you aiming for?";

async function main() {
  const login = await fetch(base + "/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "shoaib@qiko.ai",
      password: "Admin123@",
    }),
  });
  const lj = await login.json();
  const token = lj.data?.token || lj.token;
  if (!token) throw new Error("login failed: " + JSON.stringify(lj).slice(0, 200));

  const get = await fetch(base + "/admin/calculator-flows/default", {
    headers: { Authorization: "Bearer " + token },
  });
  const gj = await get.json();
  fs.writeFileSync(
    path.join(__dirname, "_calc_before_remove_income.json"),
    JSON.stringify(gj, null, 2),
  );
  const d = structuredClone(gj.data || gj);

  const target = (d.stages || []).find(
    (s) =>
      s.key === REMOVE_KEY ||
      s.id === REMOVE_ID ||
      String(s.question || "") === REMOVE_Q,
  );
  if (!target) throw new Error("target stage not found");

  const successorKeyRaw =
    target.options?.find((o) => o.nextKey)?.nextKey ||
    target.options?.find((o) => o.nextQuestionKey)?.nextQuestionKey ||
    "incomeTimeframe";
  const successorStage = (d.stages || []).find(
    (s) =>
      s.key === successorKeyRaw ||
      s.question === successorKeyRaw ||
      s.id === successorKeyRaw,
  );
  const successorQuestion =
    successorStage?.question ||
    successorStage?.label ||
    "How soon would you like to reach this level?";
  const successorNextKey = successorStage?.key || "incomeTimeframe";

  console.log("Rewire to", { successorNextKey, successorQuestion });

  function rewrite(value) {
    if (value === REMOVE_KEY || value === REMOVE_ID) return successorNextKey;
    if (value === REMOVE_Q) return successorQuestion;
    return value;
  }

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") {
        if (
          k === "nextKey" ||
          k === "nextQuestionKey" ||
          k === "questionKey" ||
          k === "entryQuestionKey"
        ) {
          obj[k] = rewrite(v);
        }
      } else {
        walk(v);
      }
    }
  }

  d.stages = (d.stages || []).filter(
    (s) =>
      !(
        s.key === REMOVE_KEY ||
        s.id === REMOVE_ID ||
        String(s.question || "") === REMOVE_Q
      ),
  );

  const aj = d.calculationLogic?.adminJourney;
  if (aj?.paths) {
    for (const p of aj.paths) {
      if (Array.isArray(p.routeSteps)) {
        p.routeSteps = p.routeSteps.filter(
          (s) => s.questionKey !== REMOVE_KEY && s.questionKey !== REMOVE_ID,
        );
      }
    }
  }
  if (aj?.questionsByPath) {
    for (const pathId of Object.keys(aj.questionsByPath)) {
      const bag = aj.questionsByPath[pathId];
      if (bag && typeof bag === "object") {
        delete bag[REMOVE_KEY];
        delete bag[REMOVE_ID];
      }
    }
  }

  walk(d);

  (d.stages || []).forEach((s, i) => {
    if (typeof s.sortOrder === "number") s.sortOrder = i;
  });

  console.log(
    "remaining question text?",
    JSON.stringify(d).includes(REMOVE_Q),
    "remaining key?",
    JSON.stringify(d).includes('"incomeTarget"') ||
      JSON.stringify(d).includes('"income_target"'),
  );

  const put = await fetch(base + "/admin/calculator-flows/default", {
    method: "PUT",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(d),
  });
  const putText = await put.text();
  console.log("PUT", put.status, putText.slice(0, 400));
  if (!put.ok) {
    fs.writeFileSync(
      path.join(__dirname, "_calc_remove_income_failed_body.json"),
      JSON.stringify(d, null, 2),
    );
    process.exit(1);
  }

  const verify = await fetch(base + "/admin/calculator-flows/default", {
    headers: { Authorization: "Bearer " + token },
  });
  const vj = await verify.json();
  fs.writeFileSync(
    path.join(__dirname, "_calc_after_remove_income.json"),
    JSON.stringify(vj, null, 2),
  );
  const vd = vj.data || vj;
  const hits = (vd.stages || []).filter(
    (s) =>
      s.key === REMOVE_KEY ||
      String(s.question || "").includes(
        "monthly property income are you aiming",
      ),
  );
  console.log(
    "verify stages",
    (vd.stages || []).length,
    "hits",
    hits.length,
    "blob has question?",
    JSON.stringify(vd).includes(REMOVE_Q),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
