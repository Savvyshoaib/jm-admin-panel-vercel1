/**
 * One-shot: scrub trailing-"1" corruption from default calculator flow JSON,
 * then caller can PUT the cleaned body.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const mock = fs.readFileSync(
  path.join(root, "src/data/calculatorJourneyMock.ts"),
  "utf8",
);

const catalogue = {};
const re =
  /opt\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*\d+(?:\s*,\s*\{([^}]*)\})?/g;
let m;
while ((m = re.exec(mock))) {
  const id = m[1];
  const value = m[2];
  const label = m[3];
  const extra = m[4] || "";
  const rateM = /indicativeRate:\s*([0-9.]+)/.exec(extra);
  catalogue[id] = {
    value,
    label,
    indicativeRate: rateM ? Number(rateM[1]) : undefined,
  };
}

function scrubTrailingOne(v) {
  if (v == null) return v;
  const s = String(v);
  const t = s.trim();
  if (/^\d+$/.test(t)) return "";
  return s.replace(/([A-Za-z?\d+])1$/u, "$1");
}

function cleanDesc(v) {
  return scrubTrailingOne((v ?? "").toString().trim());
}

function cleanLabel(label, id) {
  let v = scrubTrailingOne(label ?? "");
  const hit = catalogue[id];
  if (hit) {
    if (v === hit.label) return hit.label;
    if (v.startsWith(`${hit.label}1`)) return hit.label;
  }
  return v;
}

function cleanValue(value, id) {
  let v = (value ?? "").toString().trim();
  // Legitimate machine values can be pure digits ("5", "10", "15")
  if (/^\d+$/.test(v)) return v;
  v = v.replace(/([A-Za-z?\d+])1$/u, "$1");
  const hit = catalogue[id];
  if (hit && (v === `${hit.value}1` || v.startsWith(`${hit.value}1`))) {
    return hit.value;
  }
  return v;
}

function cleanRate(rate, id) {
  const hit = catalogue[id];
  if (hit && hit.indicativeRate != null) {
    if (rate == null) return hit.indicativeRate;
    if (String(rate) === `${hit.indicativeRate}1`) return hit.indicativeRate;
    if (rate === hit.indicativeRate) return hit.indicativeRate;
  }
  if (rate == null || !Number.isFinite(Number(rate))) return rate;
  const s = String(rate);
  const mm = /^(\d+\.\d+)1$/.exec(s);
  if (!mm) return Number(rate);
  return Number(mm[1]);
}

let dirty = 0;
const samples = [];

function scrubOption(o) {
  if (!o || typeof o !== "object") return o;
  const before = JSON.stringify({
    l: o.label,
    v: o.value,
    d: o.description,
    r: o.indicativeRate,
  });
  o.label = cleanLabel(o.label, o.id);
  o.value = cleanValue(o.value, o.id);
  o.description = cleanDesc(o.description);
  if (o.indicativeRate != null) {
    o.indicativeRate = cleanRate(o.indicativeRate, o.id);
  }
  const after = JSON.stringify({
    l: o.label,
    v: o.value,
    d: o.description,
    r: o.indicativeRate,
  });
  if (before !== after) {
    dirty += 1;
    if (samples.length < 20) {
      samples.push({
        id: o.id,
        before: JSON.parse(before),
        after: JSON.parse(after),
      });
    }
  }
  return o;
}

function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item);
    return;
  }
  if (Array.isArray(node.options)) {
    node.options = node.options.map(scrubOption);
  }
  if (node.followUp) walk(node.followUp);
  if (typeof node.question === "string") {
    const q = scrubTrailingOne(node.question);
    if (q !== node.question) {
      dirty += 1;
      node.question = q;
    }
  }
  if (typeof node.title === "string" && /^\d+$/.test(node.title.trim())) {
    dirty += 1;
    node.title = node.caption || node.key || "";
  }
  for (const k of Object.keys(node)) {
    if (k === "options") continue;
    walk(node[k]);
  }
}

let text = fs.readFileSync(
  path.join(root, "scripts/_calc_default_api.json"),
  "utf8",
);
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
const envelope = JSON.parse(text);
const data = envelope.data || envelope;
walk(data);
fs.writeFileSync(
  path.join(root, "scripts/_calc_default_clean.json"),
  JSON.stringify(data, null, 2),
);
console.log("catalogue", Object.keys(catalogue).length);
console.log("dirtyFixes", dirty);
console.log(JSON.stringify(samples, null, 2));
