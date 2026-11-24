const fs = require("fs");
const path = require("path");

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
  if (!token) throw new Error("no token: " + JSON.stringify(lj).slice(0, 200));

  let payload = fs.readFileSync(
    path.join(__dirname, "_calc_default_clean.json"),
    "utf8",
  );
  if (payload.charCodeAt(0) === 0xfeff) payload = payload.slice(1);
  JSON.parse(payload);

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
  console.log("PUT", put.status, putText.slice(0, 400));
  if (!put.ok) process.exit(1);

  const get = await fetch(
    "https://jm-backend.qiko.ai/admin/calculator-flows/default",
    { headers: { Authorization: "Bearer " + token } },
  );
  const gj = await get.json();
  const d = gj.data || gj;
  fs.writeFileSync(
    path.join(__dirname, "_calc_default_api.json"),
    JSON.stringify(gj, null, 2),
  );

  const exp = d.stages.find((s) => s.key === "experience");
  console.log("exp first:", exp?.options?.[0]?.label);
  console.log(
    "rates:",
    d.stages.find((s) => s.key === "finance")?.followUp?.options?.map(
      (o) => o.indicativeRate,
    ),
  );
  const blob = JSON.stringify(d);
  const plusOnes = (blob.match(/\+1"/g) || []).length;
  console.log("+1 quote count", plusOnes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
