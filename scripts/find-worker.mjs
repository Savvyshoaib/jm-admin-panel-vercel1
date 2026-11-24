import fs from "node:fs";

const s = fs.readFileSync("dist/assets/index-CzUqkbyQ.js", "utf8");
for (const q of ["pdf.worker", "worker.min", "workerSrc", ".mjs", "rsCePomN"]) {
  console.log(q, s.includes(q));
}
const i = s.indexOf("rsCePomN");
console.log(i >= 0 ? s.slice(i - 80, i + 40) : "hash missing");
