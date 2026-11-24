/**
 * Admin Calculator Flows API — updated JM Backend shape:
 * GET  `/admin/calculator-flows`
 * GET  `/admin/calculator-flows/default`
 * PUT  `/admin/calculator-flows/default`
 *
 * Payload: `{ stages[], calculationLogic, paths?, ordersByPath?, … }`
 * Mock when `VITE_USE_MOCK_DATA=true`.
 */

import { ApiError, apiRequest, unwrapData } from "@/lib/apiClient";
import { asRecord, asRecordArray, type ApiEnvelope } from "@/services/mappers";
import { endpoints } from "@/services/endpoints";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import {
  CALC_PATHS,
  CALC_QUESTIONS,
  applyPathNextKeysToOptions,
  defaultNextForSharedQuestion,
  mobileSequenceForPath,
  withNextStage,
  type CalcOption,
  type CalcPath,
  type CalcQuestion,
  type CalcStage,
} from "@/data/calculatorJourneyMock";
import { resolveSharedOptionNext } from "@/lib/calculatorMobileRouting";

/** True when value looks like a machine question key (not a full sentence). */
function looksLikeQuestionKey(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v === "plan") return true;
  return /^[a-z][a-zA-Z0-9_]*$/.test(v);
}

/**
 * Backend sometimes stores snake_case / alternate stage keys.
 * Admin + path orders use camelCase catalogue keys — normalize on read.
 */
const QUESTION_KEY_ALIASES: Record<string, string> = {
  priority: "unsurePriority",
  unsure_priority: "unsurePriority",
  income_target: "incomeTarget",
  timeframe: "incomeTimeframe",
  income_timeframe: "incomeTimeframe",
  current_income: "currentIncome",
  growth_priority: "growthPriority",
  horizon: "wealthHorizon",
  wealth_horizon: "wealthHorizon",
  value_target: "wealthTarget",
  wealth_target: "wealthTarget",
  current_value: "currentPortfolioValue",
  current_portfolio_value: "currentPortfolioValue",
  retirement_window: "retirementWindow",
  retirement_outcome: "retirementOutcome",
  retirement_income_target: "retirementIncomeTarget",
  retirement_income_then_value: "retirementIncomeTarget",
  retirement_value_target: "retirementValueTarget",
  portfolio_size: "portfolioSize",
  portfolio_objective: "portfolioObjective",
  portfolio_income: "portfolioIncome",
  family_milestone: "familyMilestone",
  family_timing: "familyWhen",
  family_when: "familyWhen",
  family_outcome: "familyOutcome",
  family_value_target: "familyValueTarget",
  family_income_target: "familyIncomeTarget",
};

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Map any API key variant → canonical camelCase journey key. */
export function normalizeQuestionKey(
  key: string | null | undefined,
): string | undefined {
  if (!key) return undefined;
  const raw = key.trim();
  if (!raw) return undefined;
  if (raw === "plan") return "plan";
  const lower = raw.toLowerCase();
  if (QUESTION_KEY_ALIASES[lower]) return QUESTION_KEY_ALIASES[lower];
  if (QUESTION_KEY_ALIASES[raw]) return QUESTION_KEY_ALIASES[raw];
  // Already a known catalogue key
  if (CALC_QUESTIONS.some((q) => q.key === raw) || raw === "goal") return raw;
  const camel = snakeToCamelKey(raw);
  if (CALC_QUESTIONS.some((q) => q.key === camel) || camel === "goal") {
    return camel;
  }
  return raw;
}

/** Full question text for a machine key (API `nextQuestionKey` display value). */
export function questionTextForKey(
  key: string | null | undefined,
  stages?: FlowStage[],
): string | null {
  if (!key) return null;
  const canon = normalizeQuestionKey(key) ?? key;
  if (canon === "plan") return "Your Investment Plan";
  const fromStages = stages?.find(
    (s) =>
      s.key === canon ||
      normalizeQuestionKey(s.key) === canon,
  )?.question?.trim();
  if (fromStages) {
    const cat = CALC_QUESTIONS.find((q) => q.key === canon);
    if (cat && shouldUseCatalogueQuestion(fromStages, cat)) {
      return cat.title.trim();
    }
    return fromStages;
  }
  const fromCatalogue = CALC_QUESTIONS.find((q) => q.key === canon)?.title?.trim();
  if (fromCatalogue) return fromCatalogue;
  return canon;
}

/** Resolve machine key from API option (nextKey preferred, else key-shaped nextQuestionKey, else title match). */
function resolveMachineNextKey(
  row: Record<string, unknown>,
  stages?: FlowStage[],
): string | undefined {
  const fromNextKey = str(row.nextKey ?? row.next_key);
  if (fromNextKey && looksLikeQuestionKey(fromNextKey)) {
    return normalizeQuestionKey(fromNextKey) ?? fromNextKey;
  }

  const raw = str(row.nextQuestionKey ?? row.next_question_key);
  if (!raw) return undefined;
  if (looksLikeQuestionKey(raw)) {
    return normalizeQuestionKey(raw) ?? raw;
  }

  // Full question text → find matching stage / catalogue key
  const normalized = raw.trim().toLowerCase();
  if (normalized === "your investment plan") return "plan";
  const stageHit = stages?.find(
    (s) => s.question?.trim().toLowerCase() === normalized,
  );
  if (stageHit?.key) {
    return normalizeQuestionKey(stageHit.key) ?? stageHit.key;
  }
  const catHit = CALC_QUESTIONS.find(
    (q) => q.title.trim().toLowerCase() === normalized,
  );
  if (catHit) return catHit.key;
  return undefined;
}

/**
 * Prior bug wrote `String(index+1)` into title/description (bare "1") and
 * appended "1" onto labels like "£5,000+1" / rates like "5.491".
 */
function scrubCorruptTrailingOne(value: string): string {
  if (!value) return value;
  const trimmed = value.trim();
  // Bare step index mistakenly stored as copy ("1", "2", …)
  if (/^\d+$/.test(trimmed)) return "";
  // Trailing "1" after letter, digit, ?, or + (e.g. "...?1", "£5001", "£5,000+1")
  return value.replace(/([A-Za-z?\d+])1$/u, "$1");
}

function cleanCaption(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  if (!v || /^\d+$/.test(v)) return "";
  return scrubCorruptTrailingOne(v);
}

/** Option description: treat blank / numeric junk as empty string. */
function cleanDescription(value: string | undefined | null): string {
  return scrubCorruptTrailingOne((value ?? "").trim());
}

/** Machine value key — keep pure digits ("5","10"); only strip junk trailing 1. */
function cleanOptionValue(value: string | undefined | null): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (/^\d+$/.test(v)) return v;
  return v.replace(/([A-Za-z?\d+])1$/u, "$1");
}

function findCatalogueOption(optionId: string): CalcOption | undefined {
  for (const q of CALC_QUESTIONS) {
    const hit =
      q.options.find((o) => o.id === optionId) ??
      q.followUp?.options.find((o) => o.id === optionId);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Rates corrupted by string-append "1" (5.49 → 5.491, 4.5 → 4.51).
 * Prefer catalogue rate when option id is known; else strip decimal+trailing 1.
 */
function scrubIndicativeRate(
  rate: number | undefined,
  optionId?: string,
): number | undefined {
  if (optionId) {
    const cat = findCatalogueOption(optionId)?.indicativeRate;
    if (cat != null && Number.isFinite(cat)) {
      if (rate == null || !Number.isFinite(rate)) return cat;
      if (rate === cat) return cat;
      if (String(rate) === `${cat}1`) return cat;
    }
  }
  if (rate == null || !Number.isFinite(rate)) return rate;
  const s = String(rate);
  const m = /^(\d+\.\d+)1$/.exec(s);
  if (!m) return rate;
  const cleaned = Number(m[1]);
  return Number.isFinite(cleaned) ? cleaned : rate;
}

/** Prefer catalogue label when stored label is catalogue + junk ("…1", "…1 ff"). */
function cleanOptionLabel(label: string, optionId?: string): string {
  const v = scrubCorruptTrailingOne(label);
  if (!optionId) return v;
  const hit = findCatalogueOption(optionId);
  if (!hit) return v;
  if (v === hit.label) return hit.label;
  if (v.startsWith(`${hit.label}1`)) return hit.label;
  return v;
}

export type FlowStageOption = {
  id: string;
  label: string;
  description: string;
  /** Journey extras (preserved on round-trip when backend allows) */
  value?: string;
  badge?: string;
  indicativeRate?: number;
  sortOrder?: number;
  active?: boolean;
  /**
   * Human-readable next question text in API payloads
   * (e.g. "How much capital do you have available…").
   * Internally we also accept legacy machine keys here when `nextKey` is absent.
   */
  nextQuestionKey?: string | null;
  /**
   * Machine key for routing (experience, capital, plan, …).
   * Mobile / admin logic should prefer this over parsing nextQuestionKey.
   */
  nextKey?: string | null;
  /** Mobile tab for nextQuestionKey: goal | route | capital | finance | plan */
  nextStage?: CalcStage | null;
};

export type FlowStageFollowUp = {
  title: string;
  helper?: string;
  instruction?: string;
  options: FlowStageOption[];
};

export type FlowStage = {
  id: string;
  type: string;
  /** Display / step title from API (often "1", "2", …) */
  title: string;
  question: string;
  /** Aliases some backends persist instead of `question` */
  label?: string;
  prompt?: string;
  options: FlowStageOption[];
  /** Journey metadata */
  key?: string;
  stage?: CalcStage;
  caption?: string;
  helper?: string;
  instruction?: string;
  when?: string;
  sortOrder?: number;
  active?: boolean;
  followUp?: FlowStageFollowUp;
};

export type CalculationLogic = {
  ltvPct: number;
  sdltPct: number;
  yieldPct: number;
  growthPct: number;
  otherFees: number;
  /**
   * Nested admin journey payload — survives backends that only persist
   * `calculationLogic` as a JSON blob (paths / per-tab question overrides).
   */
  adminJourney?: {
    paths?: CalcPath[];
    ordersByPath?: Record<string, string[]>;
    questionsByPath?: Record<string, Record<string, FlowStage>>;
  };
};

export type CalculatorFlowRecord = {
  id: string | number;
  title: string;
  slug: string;
  description: string;
  status: string;
  isDefault: boolean;
  stages: FlowStage[];
  calculationLogic: CalculationLogic;
  /** Goal branches — stored for mobile journey admin */
  paths: CalcPath[];
  /** Per-path question order overrides */
  ordersByPath: Record<string, string[]>;
  /**
   * Per-path question/option copy overrides.
   * Shared `stages` stay the defaults; edits on a branch live here so
   * repeating questions (e.g. experience) stay unique per tab.
   */
  questionsByPath: Record<string, Record<string, FlowStage>>;
  updatedAt?: string;
  updatedBy?: string;
  /** Preserve unknown top-level keys for round-trip */
  extra: Record<string, unknown>;
};

const KNOWN_KEYS = new Set([
  "id",
  "title",
  "slug",
  "description",
  "status",
  "isDefault",
  "is_default",
  "stages",
  "calculationLogic",
  "calculation_logic",
  "paths",
  "ordersByPath",
  "orders_by_path",
  "questionsByPath",
  "questions_by_path",
  "updatedAt",
  "updated_at",
  "updatedBy",
  "updated_by",
]);

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return fallback;
}

function mapOption(raw: unknown, index: number): FlowStageOption {
  const row = asRecord(raw);
  const rate = row.indicativeRate ?? row.indicative_rate;
  const stageRaw = row.nextStage ?? row.next_stage ?? row.route;
  const id = str(row.id ?? `opt_${index + 1}`, `opt_${index + 1}`);
  const parsedRate = rate == null || rate === "" ? undefined : num(rate);
  // Prefer nextKey; accept legacy key-shaped nextQuestionKey; reverse-map full text.
  const machineKey = resolveMachineNextKey(row);
  const parsedStage = str(stageRaw).toLowerCase();
  const nextStageFromApi =
    parsedStage === "goal" ||
    parsedStage === "route" ||
    parsedStage === "capital" ||
    parsedStage === "finance" ||
    parsedStage === "plan"
      ? (parsedStage as CalcStage)
      : undefined;
  return withNextStage({
    id,
    label: cleanOptionLabel(str(row.label ?? row.title ?? row.name), id),
    description: cleanDescription(str(row.description ?? row.hint ?? "")),
    value: cleanOptionValue(str(row.value)) || undefined,
    badge: str(row.badge) || undefined,
    indicativeRate: scrubIndicativeRate(parsedRate, id),
    sortOrder: row.sortOrder == null && row.sort_order == null
      ? index
      : num(row.sortOrder ?? row.sort_order, index),
    active: row.active == null ? true : bool(row.active, true),
    nextQuestionKey: machineKey,
    nextKey: machineKey,
    nextStage: nextStageFromApi ?? null,
  });
}

function mapFollowUp(raw: unknown): FlowStageFollowUp | undefined {
  const row = asRecord(raw);
  if (!Object.keys(row).length) return undefined;
  return {
    title: scrubCorruptTrailingOne(str(row.title ?? row.question)),
    helper: str(row.helper) || undefined,
    instruction: str(row.instruction) || undefined,
    options: asRecordArray(row.options).map((o, i) => mapOption(o, i)),
  };
}

function mapStage(raw: unknown, index: number): FlowStage {
  const row = asRecord(raw);
  const stageRaw = str(row.stage ?? row.category ?? row.group).toLowerCase();
  const stage =
    stageRaw === "goal" ||
    stageRaw === "route" ||
    stageRaw === "capital" ||
    stageRaw === "finance" ||
    stageRaw === "plan"
      ? (stageRaw as CalcStage)
      : undefined;

  const caption = cleanCaption(str(row.caption) || undefined);
  const titleRaw = cleanCaption(str(row.title) || undefined);
  const rawKey = str(row.key) || undefined;
  const key = rawKey ? normalizeQuestionKey(rawKey) ?? rawKey : undefined;

  return {
    id: str(row.id ?? `stage_${index + 1}`, `stage_${index + 1}`),
    type: str(row.type ?? "single", "single"),
    // Never persist bare step numbers ("1") as the stage title
    title: titleRaw || caption || key || str(row.title ?? "", ""),
    question: scrubCorruptTrailingOne(
      str(row.question ?? row.label ?? row.prompt),
    ),
    options: asRecordArray(row.options).map((o, i) => mapOption(o, i)),
    key,
    stage,
    caption: caption || undefined,
    helper: str(row.helper) || undefined,
    instruction: str(row.instruction) || undefined,
    when: str(row.when) || undefined,
    sortOrder:
      row.sortOrder == null && row.sort_order == null
        ? index
        : num(row.sortOrder ?? row.sort_order, index),
    active: row.active == null ? true : bool(row.active, true),
    followUp: mapFollowUp(row.followUp ?? row.follow_up),
  };
}

function mapCalculationLogic(raw: unknown): CalculationLogic {
  const row = asRecord(raw);
  const adminRaw = asRecord(row.adminJourney ?? row.admin_journey);
  let adminJourney: CalculationLogic["adminJourney"];
  if (Object.keys(adminRaw).length) {
    const paths = asRecordArray(adminRaw.paths)
      .map((p, i) => mapPath(p, i))
      .filter((p): p is CalcPath => Boolean(p));
    const ordersRaw = asRecord(
      adminRaw.ordersByPath ?? adminRaw.orders_by_path,
    );
    const ordersByPath: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(ordersRaw)) {
      if (Array.isArray(v)) ordersByPath[k] = v.map((x) => String(x));
    }
    adminJourney = {
      paths: paths.length ? paths : undefined,
      ordersByPath: Object.keys(ordersByPath).length
        ? ordersByPath
        : undefined,
      questionsByPath: mapQuestionsByPath(
        adminRaw.questionsByPath ?? adminRaw.questions_by_path,
      ),
    };
  }
  return {
    ltvPct: num(row.ltvPct ?? row.ltv_pct, 75),
    sdltPct: num(row.sdltPct ?? row.sdlt_pct, 5),
    yieldPct: num(row.yieldPct ?? row.yield_pct, 5),
    growthPct: num(row.growthPct ?? row.growth_pct, 4),
    otherFees: num(row.otherFees ?? row.other_fees, 0),
    adminJourney,
  };
}

function mapPath(raw: unknown, index: number): CalcPath | null {
  const row = asRecord(raw);
  if (!Object.keys(row).length) return null;
  const routeSteps = asRecordArray(row.routeSteps ?? row.route_steps).map(
    (s) => ({
      questionKey: str(s.questionKey ?? s.question_key),
      when: str(s.when ?? "Always on this path"),
    }),
  );
  const capitalSteps = asRecordArray(
    row.capitalSteps ?? row.capital_steps,
  ).map((s) => ({
    questionKey: str(s.questionKey ?? s.question_key),
    when: str(s.when ?? "Always"),
  }));
  return {
    id: str(row.id ?? `path_${index + 1}`, `path_${index + 1}`),
    goalValue: str(row.goalValue ?? row.goal_value),
    label: str(row.label ?? row.title ?? row.name),
    description: str(row.description),
    entryQuestionKey: str(
      row.entryQuestionKey ?? row.entry_question_key ?? routeSteps[0]?.questionKey,
    ),
    routeSteps,
    capitalSteps,
    includesFinance: bool(row.includesFinance ?? row.includes_finance, true),
  };
}

function defaultOrders(paths: CalcPath[]): Record<string, string[]> {
  const orders: Record<string, string[]> = {};
  for (const p of paths) {
    orders[p.id] = mobileSequenceForPath(p).map((s) => s.questionKey);
  }
  return orders;
}

/**
 * Product sequence is owned by CALC_PATHS. API path rows may be thin or
 * reordered — always rebuild structure from the catalogue and only borrow
 * labels / descriptions when they match a known goalValue.
 */
export function canonicalPaths(apiPaths?: CalcPath[]): CalcPath[] {
  const byGoal = new Map(
    (apiPaths ?? []).map((p) => [p.goalValue, p] as const),
  );
  return CALC_PATHS.map((canon) => {
    const fromApi = byGoal.get(canon.goalValue);
    return {
      ...structuredClone(canon),
      label: fromApi?.label?.trim() || canon.label,
      description: fromApi?.description?.trim() || canon.description,
    };
  });
}

/** Strip accidental edit junk (" ff", " ccc") from question copy. Save/load only. */
function cleanQuestionText(value: string): string {
  return scrubCorruptTrailingOne(value)
    .replace(/\s+(ff|ccc)\s*$/i, "")
    .trim();
}

/**
 * Fill every option's nextQuestionKey for a stage within one path order.
 * Do not scrub/trim copy here — this runs on every keystroke via questionsForPath.
 */
function withPathOptionNextKeys(
  stage: FlowStage,
  pathOrder: string[],
  pathId: string,
): FlowStage {
  const key = stage.key ?? "";
  return {
    ...stage,
    options: applyPathNextKeysToOptions(key, stage.options, pathOrder, pathId),
  };
}

/** Shared stages: every option gets nextQuestionKey + nextStage from mobile routing. */
function withSharedOptionNextKeys(
  stage: FlowStage,
  paths: CalcPath[],
): FlowStage {
  const key = stage.key ?? "";
  const linear = defaultNextForSharedQuestion(key, paths);
  return {
    ...stage,
    // Preserve question copy (incl. spaces); scrub only on API map/save helpers
    options: stage.options.map((o) => {
      const routed = resolveSharedOptionNext(key, o.value ?? "");
      if (routed) {
        return {
          ...o,
          nextQuestionKey: routed.nextQuestionKey,
          nextStage: routed.nextStage,
        };
      }
      const next = o.nextQuestionKey || linear;
      if (next == null) return { ...o, nextStage: null };
      return withNextStage({ ...o, nextQuestionKey: next });
    }),
  };
}

/**
 * Full questionsByPath for every Goal branch — each option has nextQuestionKey
 * matching that path's mobile order (capital → finance on unsure, etc.).
 */
export function buildCompleteQuestionsByPath(
  stages: FlowStage[],
  paths: CalcPath[],
  existing?: Record<string, Record<string, FlowStage>>,
): Record<string, Record<string, FlowStage>> {
  const byKey = new Map(
    stages.filter((s) => s.key).map((s) => [s.key as string, s]),
  );
  const out: Record<string, Record<string, FlowStage>> = {};

  for (const path of paths) {
    const order = mobileSequenceForPath(path).map((s) => s.questionKey);
    const pathQs: Record<string, FlowStage> = {};
    for (const key of order) {
      // Shared catalogue (`stages`) wins for question/option copy.
      const base = byKey.get(key) ?? existing?.[path.id]?.[key];
      if (!base) continue;
      pathQs[key] = withPathOptionNextKeys(
        structuredClone(base),
        order,
        path.id,
      );
    }
    out[path.id] = pathQs;
  }
  return out;
}

/** True when payload already carries mobile Goal/Route journey metadata. */
export function hasJourneyShape(flow: CalculatorFlowRecord): boolean {
  if (flow.paths.length > 0) return true;
  return flow.stages.some(
    (s) =>
      Boolean(s.key) &&
      (s.stage === "goal" ||
        s.stage === "route" ||
        s.stage === "capital" ||
        s.stage === "finance"),
  );
}

export function optionToCalc(option: FlowStageOption, index: number): CalcOption {
  return withNextStage({
    id: option.id,
    value: cleanOptionValue(option.value ?? option.id) || option.id,
    label: cleanOptionLabel(option.label, option.id),
    description: cleanDescription(option.description) || undefined,
    badge: option.badge,
    indicativeRate: scrubIndicativeRate(option.indicativeRate, option.id),
    sortOrder: option.sortOrder ?? index,
    active: option.active ?? true,
    nextQuestionKey: option.nextQuestionKey,
    nextStage: option.nextStage,
  });
}

export function stageToCalcQuestion(stage: FlowStage, index: number): CalcQuestion {
  const caption = cleanCaption(stage.caption ?? stage.title);
  return {
    id: stage.id,
    key: stage.key ?? stage.id,
    stage: stage.stage ?? "route",
    caption,
    title: scrubCorruptTrailingOne(stage.question),
    helper: stage.helper ?? "",
    instruction: stage.instruction ?? "",
    options: stage.options.map((o, i) => optionToCalc(o, i)),
    followUp: stage.followUp
      ? {
          title: scrubCorruptTrailingOne(stage.followUp.title),
          helper: stage.followUp.helper ?? "",
          instruction: stage.followUp.instruction ?? "",
          options: stage.followUp.options.map((o, i) => optionToCalc(o, i)),
        }
      : undefined,
    sortOrder: stage.sortOrder ?? index,
    active: stage.active ?? true,
  };
}

export function calcOptionToStage(option: CalcOption): FlowStageOption {
  const key = option.nextQuestionKey ?? undefined;
  return withNextStage({
    id: option.id,
    // Keep spaces while typing — scrub junk only, do not trim
    label: scrubCorruptTrailingOne(option.label),
    description: scrubCorruptTrailingOne(option.description ?? ""),
    value: cleanOptionValue(option.value) || undefined,
    badge: option.badge,
    indicativeRate: scrubIndicativeRate(option.indicativeRate, option.id),
    sortOrder: option.sortOrder,
    active: option.active,
    nextQuestionKey: key,
    nextKey: key ?? null,
    nextStage: option.nextStage,
  });
}

export function calcQuestionToStage(
  question: CalcQuestion,
  _index: number,
): FlowStage {
  const caption = cleanCaption(question.caption);
  return {
    id: question.id,
    type: "single",
    // Short label only — never fall back to step index ("1"), that polluted PUT bodies
    title: caption || question.key || "",
    question: scrubCorruptTrailingOne(question.title),
    options: question.options
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(calcOptionToStage),
    key: question.key,
    stage: question.stage,
    caption: caption || undefined,
    helper: question.helper,
    instruction: question.instruction,
    sortOrder: question.sortOrder,
    active: question.active,
    followUp: question.followUp
      ? {
          title: scrubCorruptTrailingOne(question.followUp.title),
          helper: question.followUp.helper,
          instruction: question.followUp.instruction,
          options: question.followUp.options
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(calcOptionToStage),
        }
      : undefined,
  };
}

/** Build journey-shaped stages + paths from local mobile mock. */
export function buildJourneySeed(logic?: CalculationLogic): {
  stages: FlowStage[];
  paths: CalcPath[];
  ordersByPath: Record<string, string[]>;
  questionsByPath: Record<string, Record<string, FlowStage>>;
  calculationLogic: CalculationLogic;
} {
  const paths = structuredClone(CALC_PATHS);
  return {
    stages: CALC_QUESTIONS.map((q, i) => calcQuestionToStage(q, i)),
    paths,
    ordersByPath: defaultOrders(paths),
    questionsByPath: {},
    calculationLogic: logic ?? {
      ltvPct: 75,
      sdltPct: 5,
      yieldPct: 5,
      growthPct: 4,
      otherFees: 0,
    },
  };
}

function mapQuestionsByPath(
  raw: unknown,
): Record<string, Record<string, FlowStage>> {
  const root = asRecord(raw);
  const out: Record<string, Record<string, FlowStage>> = {};
  for (const [pathId, value] of Object.entries(root)) {
    const byKey = asRecord(value);
    const mapped: Record<string, FlowStage> = {};
    let i = 0;
    for (const [questionKey, stageRaw] of Object.entries(byKey)) {
      const stage = mapStage(stageRaw, i);
      const canon =
        normalizeQuestionKey(questionKey) ??
        normalizeQuestionKey(stage.key) ??
        questionKey;
      mapped[canon] = { ...stage, key: canon };
      i += 1;
    }
    if (Object.keys(mapped).length) out[pathId] = mapped;
  }
  return out;
}

/**
 * Resolve the question catalogue for one Goal branch.
 * Shared `stages` hold question/option copy (mobile + admin edits). Path
 * buckets only fill missing keys; nextQuestionKey is re-stamped per path.
 */
export function questionsForPath(
  flow: CalculatorFlowRecord,
  pathId: string | undefined,
): CalcQuestion[] {
  const byKey = new Map<string, CalcQuestion>();

  // 1) Product catalogue defaults (guarantees every journey key exists)
  for (const q of CALC_QUESTIONS) {
    byKey.set(q.key, structuredClone(q));
  }

  // 2) Per-path overrides first (legacy / gap fill only)
  if (pathId) {
    const overrides = flow.questionsByPath[pathId];
    if (overrides) {
      let i = 0;
      for (const [rawKey, stage] of Object.entries(overrides)) {
        const key = normalizeQuestionKey(rawKey) ?? rawKey;
        byKey.set(key, {
          ...stageToCalcQuestion({ ...stage, key }, i),
          key,
        });
        i += 1;
      }
    }
  }

  // 3) Shared stages win for question + option text
  flow.stages.forEach((s, i) => {
    const q = stageToCalcQuestion(s, i);
    const key = normalizeQuestionKey(q.key) ?? q.key;
    if (!key) return;
    byKey.set(key, { ...q, key });
  });

  // 4) Re-stamp path-specific next keys from mobile routing
  if (pathId) {
    const path = flow.paths.find((p) => p.id === pathId);
    if (path) {
      const order = mobileSequenceForPath(path).map((s) => s.questionKey);
      for (const key of order) {
        const q = byKey.get(key);
        if (!q) continue;
        const stamped = withPathOptionNextKeys(
          calcQuestionToStage(q, q.sortOrder),
          order,
          pathId,
        );
        byKey.set(key, {
          ...stageToCalcQuestion(stamped, q.sortOrder),
          key,
        });
      }
    }
  }

  // Stable order: catalogue order, then any extras
  const catalogueKeys = new Set(CALC_QUESTIONS.map((q) => q.key));
  const ordered: CalcQuestion[] = CALC_QUESTIONS.map(
    (q) => byKey.get(q.key)!,
  ).filter(Boolean);
  for (const [key, q] of byKey) {
    if (!catalogueKeys.has(key)) ordered.push(q);
  }
  return ordered;
}

/** Captions + legacy API labels that are not full mobile questions (`calculatorJourneyMock.ts`). */
const CATALOGUE_SHORT_LABELS: Set<string> = (() => {
  const set = new Set<string>([
    "monthly property income target",
    "how soon?",
    "capital available",
    "add more capital over time?",
    "purchase preference",
    "existing property income",
    "monthly income aim",
    "when you want to reach it",
    "funds for the next investment",
    "future funding",
    "how you prefer to purchase",
    "current property income",
    "where you are today",
    "number currently owned",
    "next investment should improve",
    "current portfolio value",
    "how many you own today",
    "what the next purchase should improve",
    "growth priority",
    "wealth horizon",
    "wealth target",
    "comfortable investing for",
    "target property wealth",
    "how wealth should grow",
    "how long you will invest",
    "property-wealth aim",
    "retirement window",
    "retirement outcome",
    "family milestone",
    "family when",
    "family outcome",
    "when you are planning for",
    "what property should provide",
    "retirement income aim",
    "portfolio value aim",
    "current rental income",
    "what this is mainly for",
    "when it should start serving the goal",
    "what matters most then",
    "future value aim",
    "future income aim",
  ]);
  for (const q of CALC_QUESTIONS) {
    if (q.caption?.trim()) set.add(q.caption.trim().toLowerCase());
  }
  return set;
})();

/**
 * Restore mobile catalogue only for empty / known-stale captions.
 * Any other saved prompt (admin PUT edit) is kept as-is.
 */
function shouldUseCatalogueQuestion(
  apiQuestion: string,
  cat: CalcQuestion,
): boolean {
  const api = (apiQuestion ?? "").trim();
  const full = cat.title.trim();
  if (!full) return !api;
  if (!api) return true;
  if (api === full) return false;
  const low = api.toLowerCase();
  if (CATALOGUE_SHORT_LABELS.has(low)) return true;
  if (cat.caption && low === cat.caption.trim().toLowerCase()) return true;
  return false;
}

function isStaleQuestionCopy(
  apiQuestion: string,
  catalogueQuestion: string,
): boolean {
  const cat = CALC_QUESTIONS.find(
    (q) => q.title.trim() === catalogueQuestion.trim(),
  );
  if (cat) return shouldUseCatalogueQuestion(apiQuestion, cat);
  const a = (apiQuestion ?? "").trim();
  const c = catalogueQuestion.trim();
  if (!c) return false;
  if (!a) return true;
  if (a === c) return false;
  return CATALOGUE_SHORT_LABELS.has(a.toLowerCase());
}

function mergeOptionsPreferCatalogue(
  catalogue: FlowStageOption[],
  api: FlowStageOption[] | undefined,
): FlowStageOption[] {
  if (!api?.length) return catalogue.map((o) => structuredClone(o));
  // Incomplete option sets (e.g. experience missing home_only) → full mobile set
  if (catalogue.length > api.length) {
    return catalogue.map((cat) => {
      const hit =
        api.find((o) => o.value === cat.value) ??
        api.find((o) => o.id === cat.id) ??
        api.find((o) => o.label === cat.label);
      if (!hit) return structuredClone(cat);
      return {
        ...structuredClone(cat),
        id: hit.id || cat.id,
        // Keep admin-edited labels when present
        label: hit.label?.trim() ? hit.label : cat.label,
        description: hit.description?.trim()
          ? hit.description
          : cat.description,
        badge: hit.badge ?? cat.badge,
        indicativeRate: hit.indicativeRate ?? cat.indicativeRate,
        active: hit.active ?? cat.active,
      };
    });
  }
  // Same size (or API has extras): prefer API labels (admin edits)
  return api.map((hit, i) => {
    const cat =
      catalogue.find((o) => o.value === hit.value) ??
      catalogue.find((o) => o.id === hit.id) ??
      catalogue[i];
    if (!cat) return structuredClone(hit);
    const label = hit.label?.trim() ? hit.label : cat.label;
    const description = hit.description?.trim()
      ? hit.description
      : cat.description;
    return {
      ...structuredClone(cat),
      ...structuredClone(hit),
      label: cleanOptionLabel(label, cat.id),
      description: cleanDescription(description),
      value: cleanOptionValue(hit.value ?? cat.value) || cat.value,
      badge: hit.badge ?? cat.badge,
      indicativeRate: hit.indicativeRate ?? cat.indicativeRate,
    };
  });
}

function mergeFollowUpPreferCatalogue(
  catalogue: FlowStageFollowUp | undefined,
  api: FlowStageFollowUp | undefined,
): FlowStageFollowUp | undefined {
  if (!catalogue) return api;
  if (!api) return structuredClone(catalogue);
  const useCatTitle = isStaleQuestionCopy(api.title, catalogue.title);
  return {
    title: useCatTitle ? catalogue.title : scrubCorruptTrailingOne(api.title),
    helper: useCatTitle ? catalogue.helper : api.helper || catalogue.helper,
    instruction: useCatTitle
      ? catalogue.instruction
      : api.instruction || catalogue.instruction,
    options: mergeOptionsPreferCatalogue(catalogue.options, api.options),
  };
}

/**
 * Ensure stages include every catalogue question and restore known-bad short
 * captions / incomplete option sets from the mobile catalogue.
 */
/** PUT: keep draft copy; only add catalogue questions the API omitted. */
function fillMissingStagesFromCatalogue(stages: FlowStage[]): FlowStage[] {
  const byKey = new Map<string, FlowStage>();
  for (const s of stages) {
    const key = normalizeQuestionKey(s.key) ?? s.key;
    if (!key) continue;
    byKey.set(key, { ...s, key });
  }
  return CALC_QUESTIONS.map((q) => {
    const api = byKey.get(q.key);
    if (api) return api;
    return calcQuestionToStage(q, q.sortOrder);
  });
}

function mergeStagesWithCatalogue(
  stages: FlowStage[],
  questionsByPath?: Record<string, Record<string, FlowStage>>,
): FlowStage[] {
  const byKey = new Map<string, FlowStage>();
  for (const s of stages) {
    const key = normalizeQuestionKey(s.key) ?? s.key;
    if (!key) continue;
    const known =
      key === "goal" ||
      key === "plan" ||
      CALC_QUESTIONS.some((q) => q.key === key);
    if (!known) continue;
    byKey.set(key, { ...s, key });
  }
  if (questionsByPath) {
    for (const bucket of Object.values(questionsByPath)) {
      for (const [rawKey, stage] of Object.entries(bucket)) {
        const key = normalizeQuestionKey(rawKey) ?? rawKey;
        if (!key || byKey.has(key)) continue;
        byKey.set(key, { ...stage, key });
      }
    }
    // Prefer a saved custom prompt from any path bucket over a stale stage
    for (const q of CALC_QUESTIONS) {
      const current = byKey.get(q.key);
      if (current && !shouldUseCatalogueQuestion(current.question, q)) continue;
      for (const bucket of Object.values(questionsByPath)) {
        const hit = bucket[q.key];
        if (hit && !shouldUseCatalogueQuestion(hit.question, q)) {
          byKey.set(q.key, { ...hit, key: q.key });
          break;
        }
      }
    }
  }

  return CALC_QUESTIONS.map((q) => {
    const catStage = calcQuestionToStage(q, q.sortOrder);
    const api = byKey.get(q.key);
    if (!api) return catStage;

    const useCat = shouldUseCatalogueQuestion(api.question, q);

    return {
      ...catStage,
      id: api.id || catStage.id,
      stage: catStage.stage,
      caption: catStage.caption,
      title: catStage.title || catStage.caption || catStage.key || "",
      question: useCat
        ? q.title
        : scrubCorruptTrailingOne(api.question),
      helper: useCat ? q.helper : api.helper || q.helper,
      instruction: useCat ? q.instruction : api.instruction || q.instruction,
      options: useCat
        ? mergeOptionsPreferCatalogue(catStage.options, undefined)
        : mergeOptionsPreferCatalogue(catStage.options, api.options),
      followUp: useCat
        ? mergeFollowUpPreferCatalogue(catStage.followUp, undefined)
        : mergeFollowUpPreferCatalogue(catStage.followUp, api.followUp),
      sortOrder: catStage.sortOrder,
      active: api.active ?? catStage.active,
      when: api.when,
    };
  });
}

/**
 * Ensure UI always has Goal/Route/Capital/Finance data.
 * Flat buying `stages` from API are kept in `extra.apiStages` until journey is saved.
 */
export function ensureJourneyOnFlow(
  flow: CalculatorFlowRecord,
): CalculatorFlowRecord {
  if (hasJourneyShape(flow)) {
    const paths = canonicalPaths(flow.paths);
    const orders = defaultOrders(paths);
    const stages = mergeStagesWithCatalogue(
      flow.stages.map((s) => withSharedOptionNextKeys(s, paths)),
      flow.questionsByPath,
    );
    const goalStage = stages.find(
      (s) => s.key === "goal" || s.stage === "goal",
    );
    const syncedPaths = goalStage
      ? paths.map((p) => {
          const match = goalStage.options.find(
            (o) => o.value === p.goalValue,
          );
          if (!match?.label) return p;
          return {
            ...p,
            label: match.label,
            description: match.description || p.description,
          };
        })
      : paths;
    return {
      ...flow,
      stages,
      paths: syncedPaths,
      ordersByPath: orders,
      questionsByPath: buildCompleteQuestionsByPath(
        stages,
        syncedPaths,
        flow.questionsByPath,
      ),
    };
  }

  const seed = buildJourneySeed(flow.calculationLogic);
  return {
    ...flow,
    stages: seed.stages,
    paths: seed.paths,
    ordersByPath: seed.ordersByPath,
    questionsByPath: seed.questionsByPath,
    calculationLogic: seed.calculationLogic,
    extra: {
      ...flow.extra,
      apiStages: flow.stages,
    },
  };
}

export function mapCalculatorFlow(raw: unknown): CalculatorFlowRecord {
  const data = asRecord(unwrapData(raw) ?? raw);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!KNOWN_KEYS.has(k)) extra[k] = v;
  }

  const stages = asRecordArray(data.stages).map((s, i) => mapStage(s, i));
  const calculationLogic = mapCalculationLogic(
    data.calculationLogic ?? data.calculation_logic,
  );
  const nested = calculationLogic.adminJourney;

  const pathsFromTop = asRecordArray(data.paths)
    .map((p, i) => mapPath(p, i))
    .filter((p): p is CalcPath => Boolean(p));
  const paths =
    pathsFromTop.length > 0 ? pathsFromTop : (nested?.paths ?? []);

  const ordersRaw = asRecord(data.ordersByPath ?? data.orders_by_path);
  const ordersByPath: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(ordersRaw)) {
    if (Array.isArray(v)) {
      ordersByPath[k] = v.map((x) => String(x));
    }
  }
  const resolvedOrders =
    Object.keys(ordersByPath).length > 0
      ? ordersByPath
      : (nested?.ordersByPath ?? {});

  const questionsByPathTop = mapQuestionsByPath(
    data.questionsByPath ?? data.questions_by_path,
  );
  const questionsByPathNested = nested?.questionsByPath ?? {};
  const questionsByPath: Record<string, Record<string, FlowStage>> = {
    ...questionsByPathNested,
  };
  for (const [pathId, bucket] of Object.entries(questionsByPathTop)) {
    questionsByPath[pathId] = {
      ...(questionsByPath[pathId] ?? {}),
      ...bucket,
    };
  }

  return {
    id: data.id == null ? "default" : (data.id as string | number),
    title: str(data.title ?? "Calculator", "Calculator"),
    slug: str(data.slug ?? "calculator", "calculator"),
    description: str(data.description),
    status: str(data.status ?? "published", "published"),
    isDefault: bool(data.isDefault ?? data.is_default, true),
    stages,
    calculationLogic,
    paths,
    ordersByPath: resolvedOrders,
    questionsByPath,
    updatedAt: str(data.updatedAt ?? data.updated_at) || undefined,
    updatedBy: str(data.updatedBy ?? data.updated_by) || undefined,
    extra,
  };
}

/** Pack journey fields into calculationLogic so backends that only store that blob keep them. */
function withAdminJourney(
  flow: CalculatorFlowRecord,
): CalculationLogic {
  const { adminJourney: _drop, ...rates } = flow.calculationLogic;
  void _drop;
  const paths = canonicalPaths(flow.paths);
  const ordersByPath = defaultOrders(paths);
  const questionsByPath = buildCompleteQuestionsByPath(
    flow.stages,
    paths,
    flow.questionsByPath,
  );
  return {
    ...rates,
    adminJourney: {
      paths,
      ordersByPath,
      questionsByPath,
    },
  };
}

/**
 * Prefer the journey we just PUT. APIs often echo stale stages / questionsByPath.
 */
export function mergeSavedFlow(
  sent: CalculatorFlowRecord,
  received: CalculatorFlowRecord,
): CalculatorFlowRecord {
  const stages = sent.stages.length > 0 ? sent.stages : received.stages;
  const questionsByPath =
    Object.keys(sent.questionsByPath ?? {}).length > 0
      ? sent.questionsByPath
      : received.questionsByPath;
  const paths = sent.paths.length > 0 ? sent.paths : received.paths;
  const ordersByPath =
    Object.keys(sent.ordersByPath ?? {}).length > 0
      ? sent.ordersByPath
      : received.ordersByPath;
  return ensureJourneyOnFlow({
    ...received,
    title: received.title || sent.title,
    slug: received.slug || sent.slug,
    description: received.description || sent.description,
    status: received.status || sent.status,
    isDefault: received.isDefault,
    id: received.id ?? sent.id,
    stages,
    paths,
    ordersByPath,
    questionsByPath,
    calculationLogic: {
      ...received.calculationLogic,
      ...sent.calculationLogic,
      adminJourney: {
        paths,
        ordersByPath,
        questionsByPath,
      },
    },
  });
}

/**
 * API write shape: `nextQuestionKey` = full question text (human-readable),
 * `nextKey` = machine key for mobile routing.
 */
function optionToApiPayload(
  option: FlowStageOption,
  stages: FlowStage[],
): FlowStageOption {
  const machine =
    (option.nextKey && looksLikeQuestionKey(option.nextKey)
      ? option.nextKey
      : undefined) ??
    (option.nextQuestionKey && looksLikeQuestionKey(option.nextQuestionKey)
      ? option.nextQuestionKey
      : undefined) ??
    null;
  const stamped = withNextStage({
    ...option,
    nextKey: machine,
    nextQuestionKey: machine
      ? questionTextForKey(machine, stages) ?? machine
      : null,
  });
  return stamped;
}

function stageToApiPayload(stage: FlowStage, stages: FlowStage[]): FlowStage {
  const question = cleanQuestionText(stage.question);
  return {
    ...stage,
    // Backend GET reads question ?? label ?? prompt
    question,
    label: question,
    prompt: question,
    title: cleanCaption(stage.title) || stage.caption || stage.title,
    options: stage.options.map((o) => optionToApiPayload(o, stages)),
    followUp: stage.followUp
      ? {
          ...stage.followUp,
          title: cleanQuestionText(stage.followUp.title),
          options: stage.followUp.options.map((o) =>
            optionToApiPayload(o, stages),
          ),
        }
      : undefined,
  };
}

function questionsByPathToApiPayload(
  qbp: Record<string, Record<string, FlowStage>>,
  stages: FlowStage[],
): Record<string, Record<string, FlowStage>> {
  const out: Record<string, Record<string, FlowStage>> = {};
  for (const [pathId, pathQs] of Object.entries(qbp)) {
    out[pathId] = {};
    for (const [key, stage] of Object.entries(pathQs)) {
      out[pathId][key] = stageToApiPayload(stage, stages);
    }
  }
  return out;
}

export function calculatorFlowToApiBody(
  flow: CalculatorFlowRecord,
): Record<string, unknown> {
  const { apiStages: _discard, ...restExtra } = flow.extra;
  void _discard;
  const paths = canonicalPaths(flow.paths);
  const ordersByPath = defaultOrders(paths);
  // Persist draft question/option copy — do not replace with catalogue
  const stagesInternal = fillMissingStagesFromCatalogue(
    flow.stages
      .map((s, i) => mapStage(s, i))
      .map((s) => withSharedOptionNextKeys(s, paths)),
  );
  const questionsByPathInternal = buildCompleteQuestionsByPath(
    stagesInternal,
    paths,
    flow.questionsByPath,
  );
  // API: nextQuestionKey = full question text; nextKey = machine key
  const stages = stagesInternal.map((s) =>
    stageToApiPayload(s, stagesInternal),
  );
  const questionsByPath = questionsByPathToApiPayload(
    questionsByPathInternal,
    stagesInternal,
  );
  const scrubbed: CalculatorFlowRecord = {
    ...flow,
    stages: stagesInternal,
    paths,
    ordersByPath,
    questionsByPath: questionsByPathInternal,
  };
  const calculationLogic = withAdminJourney({
    ...scrubbed,
    stages,
    questionsByPath,
  });
  const adminJourney = {
    paths,
    ordersByPath,
    questionsByPath,
  };
  return {
    ...restExtra,
    id: flow.id,
    title: flow.title,
    slug: flow.slug,
    description: flow.description,
    status: flow.status,
    isDefault: flow.isDefault,
    stages,
    calculationLogic: {
      ...calculationLogic,
      adminJourney,
    },
    paths,
    ordersByPath,
    questionsByPath,
  };
}

export function mockCalculatorFlow(): CalculatorFlowRecord {
  const seed = buildJourneySeed();
  return {
    id: "mock-default",
    title: "Calculator",
    slug: "calculator",
    description:
      "Mobile journey sequence — Goal → Route → Capital → Finance, per branch.",
    status: "published",
    isDefault: true,
    stages: seed.stages,
    calculationLogic: seed.calculationLogic,
    paths: seed.paths,
    ordersByPath: seed.ordersByPath,
    questionsByPath: seed.questionsByPath,
    updatedAt: new Date().toISOString(),
    updatedBy: "Mock",
    extra: {},
  };
}

function delay<T>(value: T, ms = 160): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms);
  });
}

export async function fetchCalculatorFlows(): Promise<CalculatorFlowRecord[]> {
  if (USE_MOCK_DATA) {
    return delay([mockCalculatorFlow()]);
  }
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.calculatorFlows.list,
  );
  const data = unwrapData(raw);
  if (Array.isArray(data)) {
    return data.map((item) => ensureJourneyOnFlow(mapCalculatorFlow(item)));
  }
  const nested = asRecordArray(asRecord(data).items);
  if (nested.length) {
    return nested.map((item) => ensureJourneyOnFlow(mapCalculatorFlow(item)));
  }
  const one = asRecord(data);
  return Object.keys(one).length
    ? [ensureJourneyOnFlow(mapCalculatorFlow(one))]
    : [];
}

export async function fetchDefaultCalculatorFlow(): Promise<CalculatorFlowRecord> {
  if (USE_MOCK_DATA) {
    return delay(mockCalculatorFlow());
  }
  try {
    const raw = await apiRequest<ApiEnvelope<unknown>>(
      endpoints.calculatorFlows.default,
    );
    return ensureJourneyOnFlow(mapCalculatorFlow(raw));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      const list = await fetchCalculatorFlows();
      if (list[0]) return list[0];
    }
    throw err;
  }
}

function flowIdForPut(flow: CalculatorFlowRecord): string | number | null {
  if (flow.id == null) return null;
  const id = flow.id;
  if (String(id) === "default" || String(id) === "mock-default") return null;
  return id;
}

function sentFromBody(
  flow: CalculatorFlowRecord,
  body: Record<string, unknown>,
): CalculatorFlowRecord {
  return {
    ...flow,
    stages: (body.stages as FlowStage[]) ?? flow.stages,
    paths: (body.paths as CalcPath[]) ?? flow.paths,
    ordersByPath:
      (body.ordersByPath as Record<string, string[]>) ?? flow.ordersByPath,
    questionsByPath:
      (body.questionsByPath as CalculatorFlowRecord["questionsByPath"]) ??
      flow.questionsByPath,
  };
}

/** GET default after PUT so list + default stay in sync with what we wrote. */
async function refetchDefaultAfterPut(
  sent: CalculatorFlowRecord,
  putEcho: unknown,
): Promise<CalculatorFlowRecord> {
  try {
    const raw = await apiRequest<ApiEnvelope<unknown>>(
      endpoints.calculatorFlows.default,
    );
    return mergeSavedFlow(sent, mapCalculatorFlow(raw));
  } catch {
    return mergeSavedFlow(sent, mapCalculatorFlow(putEcho));
  }
}

export async function putDefaultCalculatorFlow(
  flow: CalculatorFlowRecord,
): Promise<CalculatorFlowRecord> {
  if (USE_MOCK_DATA) {
    return delay({ ...flow, isDefault: true });
  }
  const body = calculatorFlowToApiBody(flow);
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.calculatorFlows.default,
    { method: "PUT", body },
  );
  const oneId = flowIdForPut(flow);
  if (oneId != null) {
    try {
      await apiRequest<ApiEnvelope<unknown>>(
        endpoints.calculatorFlows.one(oneId),
        { method: "PUT", body },
      );
    } catch {
      // Default PUT is the source of truth for the admin page
    }
  }
  return refetchDefaultAfterPut(sentFromBody(flow, body), raw);
}

export async function putCalculatorFlow(
  flowId: string | number,
  flow: CalculatorFlowRecord,
): Promise<CalculatorFlowRecord> {
  if (USE_MOCK_DATA) {
    return delay({ ...flow, id: flowId });
  }
  const body = calculatorFlowToApiBody(flow);
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.calculatorFlows.one(flowId),
    { method: "PUT", body },
  );
  try {
    await apiRequest<ApiEnvelope<unknown>>(
      endpoints.calculatorFlows.default,
      { method: "PUT", body },
    );
  } catch {
    // Keep the by-id write even if default PUT is unavailable
  }
  return refetchDefaultAfterPut(
    sentFromBody({ ...flow, id: flowId }, body),
    raw,
  );
}
