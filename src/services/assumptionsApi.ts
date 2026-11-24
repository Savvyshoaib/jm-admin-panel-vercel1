import { ApiError, apiRequest, unwrapData } from "@/lib/apiClient";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type {
  Assumption,
  AssumptionScope,
  AssumptionVersion,
} from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isScope(value: string): value is AssumptionScope {
  return (
    value === "global" ||
    value === "development" ||
    value === "property" ||
    value === "nationality" ||
    value === "residency"
  );
}

function isUnit(value: string): value is Assumption["unit"] {
  return (
    value === "%" ||
    value === "GBP" ||
    value === "years" ||
    value === "months" ||
    value === "ratio"
  );
}

export function mapAssumption(raw: Record<string, unknown>): Assumption {
  const scope = str(raw.scope, "global");
  const unit = str(raw.unit, "%");
  return {
    id: str(raw.id),
    key: str(raw.key),
    label: str(raw.label ?? raw.name ?? raw.key),
    value: num(raw.value),
    unit: isUnit(unit) ? unit : "%",
    description: str(raw.description),
    scope: isScope(scope) ? scope : "global",
    scopeRefId:
      raw.scopeRefId == null || raw.scopeRefId === ""
        ? null
        : str(raw.scopeRefId),
    effectiveDate: str(raw.effectiveDate).slice(0, 10),
    updatedAt: str(raw.updatedAt ?? raw.updated_at, new Date().toISOString()),
    updatedBy: str(raw.updatedBy ?? raw.updated_by),
    sourceNote: str(raw.sourceNote ?? raw.source_note),
    isDraftPlaceholder: Boolean(
      raw.isDraftPlaceholder ?? raw.is_draft_placeholder,
    ),
  };
}

export function mapAssumptionVersion(
  raw: Record<string, unknown>,
  assumptionIdFallback = "",
): AssumptionVersion {
  return {
    id: str(raw.id),
    assumptionId: str(
      raw.assumptionId ?? raw.assumption_id,
      assumptionIdFallback,
    ),
    previousValue: num(raw.previousValue ?? raw.previous_value),
    newValue: num(raw.newValue ?? raw.new_value ?? raw.value),
    changedAt: str(
      raw.changedAt ?? raw.changed_at ?? raw.createdAt,
      new Date().toISOString(),
    ),
    changedBy: str(
      raw.changedBy ?? raw.changed_by ?? raw.updatedBy ?? raw.userName,
    ),
    note: str(raw.note ?? raw.changeNote),
  };
}

function parseAssumptionPayload(data: unknown): Assumption | null {
  if (data == null) return null;
  const record = asRecord(data);
  const unit =
    record.id != null || record.key != null || record.label != null
      ? record
      : asRecord(record.assumption ?? record.data);
  if (!unit.id && !unit.key) return null;
  return mapAssumption(unit);
}

export async function fetchAssumptions(): Promise<{
  items: Assumption[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.assumptions.list);
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).assumptions);
  return {
    items: rows.map(mapAssumption).filter((a) => a.id),
    message: envelopeMessage(raw, "Success."),
  };
}

export async function fetchAssumptionVersions(
  assumptionId: string,
): Promise<{ items: AssumptionVersion[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.assumptions.versions(assumptionId),
  );
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(asRecord(data).items ?? asRecord(data).versions);
  return {
    items: rows
      .map((r) => mapAssumptionVersion(r, assumptionId))
      .filter((v) => v.id || v.changedAt),
    message: envelopeMessage(raw, "Success."),
  };
}

export type AssumptionPatchInput = {
  value: number;
  note?: string;
  sourceNote?: string;
  effectiveDate?: string;
};

export async function patchAssumption(
  assumptionId: string,
  patch: AssumptionPatchInput,
): Promise<{ assumption: Assumption; message: string }> {
  const body: Record<string, unknown> = {
    value: patch.value,
  };
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.sourceNote !== undefined) body.sourceNote = patch.sourceNote;
  if (patch.effectiveDate !== undefined) body.effectiveDate = patch.effectiveDate;

  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.assumptions.one(assumptionId),
    { method: "PATCH", body },
  );
  const message = envelopeMessage(raw, "Updated.");
  const fromApi = parseAssumptionPayload(unwrapData(raw));
  const assumption: Assumption = fromApi
    ? { ...fromApi, id: str(fromApi.id || assumptionId), value: fromApi.value ?? patch.value }
    : {
        id: assumptionId,
        key: "",
        label: "",
        value: patch.value,
        unit: "%",
        description: "",
        scope: "global",
        scopeRefId: null,
        effectiveDate: patch.effectiveDate ?? "",
        updatedAt: new Date().toISOString(),
        updatedBy: "",
        sourceNote: patch.sourceNote ?? "",
      };

  return { assumption, message };
}

export type CalculatorDefaultsPayload = {
  mortgageRateUk: number;
  mortgageRateNonUk: number;
  rentalGrowth: number;
  capitalGrowth: number;
  rentalYield: number;
  managementFeePctOfRent: number;
  serviceChargePctOfValue: number;
  mortgageTermYears: number;
  incomeMultiple: number;
  feesPct: number;
  sdltUkPct: number;
  sdltNonUkPct: number;
  ltvByRiskLow: number;
  ltvByRiskMedium: number;
  ltvByRiskHigh: number;
  ltvOptions: number[];
  horizonYears: number[];
  ltvLabel: string;
  horizonLabel: string;
  feesLabel: string;
};

function asNumberList(value: unknown, fallback: number[]): number[] {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return asNumberList(parsed, fallback);
    } catch {
      return fallback;
    }
  }
  if (!Array.isArray(value)) return fallback;
  const nums = value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  return nums.length ? nums : fallback;
}

export function mapCalculatorDefaults(
  raw: Record<string, unknown>,
): CalculatorDefaultsPayload {
  const nested = asRecord(raw.calculator ?? raw.settings ?? raw);
  const source = Object.keys(nested).length ? nested : raw;
  return {
    mortgageRateUk: num(source.mortgageRateUk ?? source.mortgageRate, 5.25),
    mortgageRateNonUk: num(source.mortgageRateNonUk, 6.25),
    rentalGrowth: num(source.rentalGrowth, 3),
    capitalGrowth: num(source.capitalGrowth, 4),
    rentalYield: num(source.rentalYield, 5),
    managementFeePctOfRent: num(source.managementFeePctOfRent, 10),
    serviceChargePctOfValue: num(source.serviceChargePctOfValue, 0.5),
    mortgageTermYears: num(source.mortgageTermYears, 25),
    incomeMultiple: num(source.incomeMultiple, 4.5),
    feesPct: num(source.feesPct, 1.5),
    sdltUkPct: num(source.sdltUkPct, 3),
    sdltNonUkPct: num(source.sdltNonUkPct, 5),
    ltvByRiskLow: num(source.ltvByRiskLow ?? asRecord(source.ltvByRisk).low, 55),
    ltvByRiskMedium: num(
      source.ltvByRiskMedium ?? asRecord(source.ltvByRisk).medium,
      65,
    ),
    ltvByRiskHigh: num(
      source.ltvByRiskHigh ?? asRecord(source.ltvByRisk).high,
      75,
    ),
    ltvOptions: asNumberList(source.ltvOptions, [50, 55, 60, 65, 70, 75]),
    horizonYears: asNumberList(source.horizonYears, [5, 10, 15]),
    ltvLabel: str(source.ltvLabel ?? asRecord(source.labels).ltv, "LTV"),
    horizonLabel: str(
      source.horizonLabel ?? asRecord(source.labels).horizon,
      "Horizon",
    ),
    feesLabel: str(source.feesLabel ?? asRecord(source.labels).fees, "Fees"),
  };
}

export async function fetchCalculatorDefaults(): Promise<CalculatorDefaultsPayload | null> {
  try {
    const raw = await apiRequest<unknown>(endpoints.assumptions.calculator);
    return mapCalculatorDefaults(asRecord(unwrapData(raw)));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
      return null;
    }
    throw err;
  }
}

export async function putCalculatorDefaults(
  body: CalculatorDefaultsPayload,
): Promise<CalculatorDefaultsPayload> {
  const raw = await apiRequest<unknown>(endpoints.assumptions.calculator, {
    method: "PUT",
    body,
  });
  return mapCalculatorDefaults(asRecord(unwrapData(raw)));
}

export type PropertyInsightPreset = {
  type: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  floor: string;
  numberOfUnits: number;
  totalUnits: number;
  purchasePrice: number;
  currentValue: number;
  rentalEstimate: number;
  rentalIncomeMode: "current" | "expected";
  purchaseDate: string;
  serviceCharge: number;
  groundRent: number;
  managementFee: number;
  grossYield: number;
  capitalGrowth: number;
  annualRentalGrowth: number;
  paymentPlanActive: boolean;
  paymentPlanName: string;
  paymentPlanSummary: string;
  mortgagePlanActive: boolean;
  mortgagePlanName: string;
  mortgageType: "interest_only" | "repayment";
  interestRate: number;
  termYears: number;
  deposit: number;
  reservationFee: number;
  loanAmount: number;
  monthlyPayment: number;
  ltvPct: number;
};

function asRentalMode(value: unknown): "current" | "expected" {
  return str(value) === "current" ? "current" : "expected";
}

function asMortgageType(value: unknown): "interest_only" | "repayment" {
  return str(value) === "interest_only" ? "interest_only" : "repayment";
}

export function mapPropertyInsightPreset(
  raw: Record<string, unknown>,
): PropertyInsightPreset {
  return {
    type: str(raw.type ?? raw.propertyType, "1-bed"),
    bedrooms: num(raw.bedrooms, 1),
    bathrooms: num(raw.bathrooms, 1),
    sizeSqft: num(raw.sizeSqft),
    floor: str(raw.floor),
    numberOfUnits: num(raw.numberOfUnits ?? raw.unitCount, 1) || 1,
    totalUnits: num(raw.totalUnits),
    purchasePrice: num(raw.purchasePrice),
    currentValue: num(raw.currentValue ?? raw.purchasePrice),
    rentalEstimate: num(raw.rentalEstimate ?? raw.rentalMonthly),
    rentalIncomeMode: asRentalMode(raw.rentalIncomeMode ?? raw.rentalKind),
    purchaseDate: str(raw.purchaseDate).slice(0, 10),
    serviceCharge: num(raw.serviceCharge),
    groundRent: num(raw.groundRent),
    managementFee: num(raw.managementFee),
    grossYield: num(raw.grossYield ?? raw.projectedGrossYield),
    capitalGrowth: num(raw.capitalGrowth ?? raw.projectedCapitalGrowth),
    annualRentalGrowth: num(raw.annualRentalGrowth),
    paymentPlanActive: Boolean(
      raw.paymentPlanActive ?? true,
    ),
    paymentPlanName: str(raw.paymentPlanName, "Developer payment schedule"),
    paymentPlanSummary: str(raw.paymentPlanSummary),
    mortgagePlanActive: raw.mortgagePlanActive == null
      ? true
      : Boolean(raw.mortgagePlanActive),
    mortgagePlanName: str(raw.mortgagePlanName, "Mortgage plan"),
    mortgageType: asMortgageType(raw.mortgageType),
    interestRate: num(raw.interestRate ?? raw.ratePct),
    termYears: num(raw.termYears, 25) || 25,
    deposit: num(raw.deposit),
    reservationFee: num(raw.reservationFee),
    loanAmount: num(raw.loanAmount),
    monthlyPayment: num(raw.monthlyPayment),
    ltvPct: num(raw.ltvPct),
  };
}

let insightPresetCache: PropertyInsightPreset | null | undefined;

export function invalidatePropertyInsightPreset() {
  insightPresetCache = undefined;
}

export async function fetchPropertyInsightPreset(query?: {
  propertyId?: string;
  unitIndex?: number;
  force?: boolean;
}): Promise<PropertyInsightPreset | null> {
  const useCache = !query?.propertyId && !query?.force;
  if (useCache && insightPresetCache !== undefined) return insightPresetCache;
  try {
    const raw = await apiRequest<unknown>(endpoints.assumptions.propertyInsights, {
      query: {
        propertyId: query?.propertyId,
        unitIndex: query?.unitIndex,
      },
    });
    const preset = mapPropertyInsightPreset(asRecord(unwrapData(raw)));
    if (useCache) insightPresetCache = preset;
    return preset;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
      if (useCache) insightPresetCache = null;
      return null;
    }
    throw err;
  }
}

export async function putPropertyInsightPreset(
  body: Record<string, unknown>,
): Promise<PropertyInsightPreset> {
  const raw = await apiRequest<unknown>(endpoints.assumptions.propertyInsights, {
    method: "PUT",
    body,
  });
  const preset = mapPropertyInsightPreset(asRecord(unwrapData(raw)));
  if (body.propertyId == null) insightPresetCache = preset;
  return preset;
}

export function applyInsightPresetToUnit<
  T extends {
    propertyType: string;
    bedrooms: number;
    bathrooms: number;
    sizeSqft: number;
    floor: string;
    numberOfUnits: number;
    totalUnits: number;
    purchasePrice: number;
    currentValue: number;
    rentalMonthly: number;
    rentalKind: "current" | "expected";
    purchaseDate: string;
    annualRentalGrowth: number;
    serviceCharge: number;
    groundRent: number;
    managementFee: number;
    projectedGrossYield: number;
    projectedCapitalGrowth: number;
    plans: unknown[];
  },
>(base: T, preset: PropertyInsightPreset): T {
  const plans = (
    base.plans as Array<{ kind?: string } & Record<string, unknown>>
  ).map((plan) => {
    if (plan.kind === "payment_schedule") {
      return {
        ...plan,
        active: preset.paymentPlanActive,
        closed: !preset.paymentPlanActive,
        name: preset.paymentPlanName || String(plan.name ?? ""),
        summary: preset.paymentPlanSummary || String(plan.summary ?? ""),
      };
    }
    if (plan.kind === "mortgage") {
      return {
        ...plan,
        active: preset.mortgagePlanActive,
        name: preset.mortgagePlanName || String(plan.name ?? ""),
        type: preset.mortgageType,
        ratePct: preset.interestRate,
        termYears: preset.termYears,
        deposit: preset.deposit,
        reservationFee: preset.reservationFee,
        loanAmount: preset.loanAmount,
        monthlyPayment: preset.monthlyPayment,
        ltvPct: preset.ltvPct,
      };
    }
    return plan;
  });
  return {
    ...base,
    propertyType: preset.type || base.propertyType,
    bedrooms: preset.bedrooms,
    bathrooms: preset.bathrooms,
    sizeSqft: preset.sizeSqft,
    floor: preset.floor,
    numberOfUnits: preset.numberOfUnits || 1,
    totalUnits: preset.totalUnits,
    purchasePrice: preset.purchasePrice,
    currentValue: preset.currentValue || preset.purchasePrice,
    rentalMonthly: preset.rentalEstimate,
    rentalKind: preset.rentalIncomeMode,
    purchaseDate: preset.purchaseDate,
    annualRentalGrowth: preset.annualRentalGrowth,
    serviceCharge: preset.serviceCharge,
    groundRent: preset.groundRent,
    managementFee: preset.managementFee,
    projectedGrossYield: preset.grossYield,
    projectedCapitalGrowth: preset.capitalGrowth,
    plans: plans as T["plans"],
  };
}
