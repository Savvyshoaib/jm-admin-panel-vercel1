import { ApiError, apiFormRequest, apiRequest, getApiBaseUrl, resolveMediaUrl, unwrapData } from "@/lib/apiClient";
import { toApiDate, toDateInputValue } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import { compareSortOrder } from "@/lib/listOrder";
import { endpoints } from "@/services/endpoints";
import {
  asRecord,
  asRecordArray,
  type ApiEnvelope,
} from "@/services/mappers";
import type {
  PaymentInstallment,
  PaymentInstallmentStatus,
  PaymentPlan,
  PropertyInventoryUnit,
  PropertyMortgagePlan,
  PropertyMortgagePlanType,
  PropertyPaymentSchedule,
  PropertyStatus,
  PropertyUnit,
  StandardPaymentPlan,
  StandardPaymentStage,
} from "@/models";

function envelopeMessage(raw: ApiEnvelope<unknown>, fallback: string): string {
  return raw.message || fallback;
}

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => str(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function mapImageEntry(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return resolveMediaUrl(value);
  if (typeof value === "object") {
    const row = asRecord(value);
    return resolveMediaUrl(
      str(row.url ?? row.path ?? row.src ?? row.full_url ?? row.original_url),
    );
  }
  return "";
}

function mapImageList(raw: unknown, fallbackImage?: unknown): string[] {
  const fromArray = Array.isArray(raw)
    ? raw.map(mapImageEntry).filter(Boolean)
    : [];
  const primary = mapImageEntry(fallbackImage);
  const list = [...fromArray];
  if (primary && !list.includes(primary)) list.unshift(primary);
  return list;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function isPropertyStatus(value: string): value is PropertyStatus {
  return [
    "draft",
    "coming_soon",
    "available",
    "reserved",
    "sold",
    "completed",
    "archived",
    "tenanted",
    "in_build",
    "vacant",
  ].includes(value);
}

function isInstallmentStatus(value: string): value is PaymentInstallmentStatus {
  return value === "paid" || value === "due" || value === "upcoming";
}

function mapStage(raw: Record<string, unknown>): StandardPaymentStage {
  return {
    label: str(raw.label),
    percent: num(raw.percent),
    trigger: str(raw.trigger),
  };
}

function mapInstallment(raw: Record<string, unknown>): PaymentInstallment {
  const status = str(raw.status, "upcoming");
  return {
    id: str(raw.id) || createClientId(),
    label: str(raw.label),
    percent: num(raw.percent),
    amount: num(raw.amount),
    dueDate: toDateInputValue(str(raw.dueDate)),
    paidAt:
      raw.paidAt == null || raw.paidAt === ""
        ? undefined
        : toDateInputValue(str(raw.paidAt)) || undefined,
    status: isInstallmentStatus(status) ? status : "upcoming",
  };
}

function mapStandardPlan(raw: unknown): StandardPaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const stages = Array.isArray(obj.stages)
    ? obj.stages.map((s) => mapStage(asRecord(s)))
    : [];
  return {
    name: str(obj.name, "Standard staged plan"),
    stages,
  };
}

function mapOwnedPlan(raw: unknown): PaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const installments = Array.isArray(obj.installments)
    ? obj.installments.map((i) => mapInstallment(asRecord(i)))
    : Array.isArray(obj.stages)
      ? []
      : [];
  return {
    name: str(obj.name, "Staged off-plan plan"),
    basisPrice: num(obj.basePrice ?? obj.basisPrice),
    installments,
  };
}

function asObjectList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map((row) => asRecord(row));
  if (value && typeof value === "object") return [asRecord(value)];
  return [];
}

function isMortgageType(value: string): value is PropertyMortgagePlanType {
  return value === "repayment" || value === "interest_only";
}

function planActiveFlag(
  raw: Record<string, unknown>,
  fallbackWhenMissing = true,
): boolean {
  const activeRaw = raw.active ?? raw.enabled ?? raw.isActive ?? raw.is_active;
  if (activeRaw === undefined || activeRaw === null) return fallbackWhenMissing;
  // Use bool() so "false" / "0" are inactive (Boolean("false") is wrongly true).
  return bool(activeRaw, fallbackWhenMissing);
}

function mapMortgagePlan(raw: Record<string, unknown>): PropertyMortgagePlan {
  const type = str(raw.type, "repayment");
  return {
    name: str(raw.name, "Mortgage plan"),
    type: isMortgageType(type) ? type : "repayment",
    deposit: num(raw.deposit),
    loanAmount: num(raw.loanAmount ?? raw.loan_amount),
    interestRate: num(raw.interestRate ?? raw.interest_rate ?? raw.ratePct),
    monthlyPayment: num(raw.monthlyPayment ?? raw.monthly_payment),
    termYears: num(raw.termYears ?? raw.term_years, 25),
    ltvPct: num(raw.ltvPct ?? raw.ltv_pct),
    reservationFee: num(raw.reservationFee ?? raw.reservation_fee),
    mortgageDate:
      raw.mortgageDate == null && raw.mortgage_date == null
        ? undefined
        : toDateInputValue(str(raw.mortgageDate ?? raw.mortgage_date)) || undefined,
    active: planActiveFlag(raw, true),
  };
}

function mapPaymentSchedule(raw: Record<string, unknown>): PropertyPaymentSchedule {
  const stages = asObjectList(raw.stages).map((s) => ({
    label: str(s.label),
    amount: num(s.amount),
    due: str(s.due ?? s.trigger ?? s.dueDate),
    date:
      s.date == null || s.date === ""
        ? undefined
        : toDateInputValue(str(s.date)) || undefined,
  }));
  const closed = bool(raw.closed, false);
  return {
    name: str(raw.name, "Developer payment schedule"),
    summary: str(raw.summary),
    stages,
    active: planActiveFlag(raw, !closed),
  };
}

function mapInventoryUnit(raw: Record<string, unknown>): PropertyInventoryUnit {
  return {
    type: str(raw.type ?? raw.propertyType, "1 Bed"),
    bedrooms: num(raw.bedrooms),
    bathrooms: num(raw.bathrooms),
    sizeSqft: num(raw.sizeSqft ?? raw.size_sqft),
    floor: str(raw.floor),
    unitCount: Math.max(0, num(raw.unitCount ?? raw.unit_count ?? raw.numberOfUnits, 1)),
    totalUnits:
      raw.totalUnits == null && raw.total_units == null
        ? undefined
        : Math.max(0, num(raw.totalUnits ?? raw.total_units)),
    availableCount:
      raw.availableCount == null && raw.available_count == null
        ? undefined
        : Math.max(0, num(raw.availableCount ?? raw.available_count)),
    images: mapImageList(raw.images),
    mortgagePlans: asObjectList(
      raw.mortgagePlans ?? raw.mortgage_plans ?? raw.mortgagePlan,
    ).map(mapMortgagePlan),
    paymentSchedules: asObjectList(
      raw.paymentSchedules ?? raw.payment_schedules ?? raw.paymentSchedule,
    ).map(mapPaymentSchedule),
    purchasePrice: raw.purchasePrice == null ? undefined : num(raw.purchasePrice),
    currentValue: raw.currentValue == null ? undefined : num(raw.currentValue),
    rentalEstimate: raw.rentalEstimate == null ? undefined : num(raw.rentalEstimate),
    rentalIncomeMode: (() => {
      const mode = str(
        raw.rentalIncomeMode ?? raw.rental_income_mode,
        "",
      ).toLowerCase();
      if (mode === "current" || mode === "actual" || mode === "income") {
        return "current" as const;
      }
      if (mode === "expected" || mode === "estimate") {
        return "expected" as const;
      }
      return undefined;
    })(),
    purchaseDate:
      raw.purchaseDate == null && raw.purchase_date == null
        ? undefined
        : toDateInputValue(str(raw.purchaseDate ?? raw.purchase_date)) || undefined,
    annualRentalGrowth:
      raw.annualRentalGrowth == null && raw.annual_rental_growth == null
        ? undefined
        : num(raw.annualRentalGrowth ?? raw.annual_rental_growth),
    costInflation:
      raw.costInflation == null && raw.cost_inflation == null
        ? undefined
        : num(raw.costInflation ?? raw.cost_inflation),
    serviceCharge: raw.serviceCharge == null ? undefined : num(raw.serviceCharge),
    groundRent: raw.groundRent == null ? undefined : num(raw.groundRent),
    managementFee: raw.managementFee == null ? undefined : num(raw.managementFee),
    projectedGrossYield:
      raw.projectedGrossYield == null && raw.grossYield == null
        ? undefined
        : num(raw.projectedGrossYield ?? raw.grossYield),
    projectedNetYield:
      raw.projectedNetYield == null ? undefined : num(raw.projectedNetYield),
    projectedCapitalGrowth:
      raw.projectedCapitalGrowth == null && raw.capitalGrowth == null
        ? undefined
        : num(raw.projectedCapitalGrowth ?? raw.capitalGrowth),
  };
}

function scheduleToStandardPlan(
  schedule: PropertyPaymentSchedule | undefined,
  purchasePrice: number,
): StandardPaymentPlan | null {
  if (!schedule) return null;
  return {
    name: schedule.name || "Developer payment schedule",
    stages: schedule.stages.map((s) => ({
      label: s.label,
      percent:
        purchasePrice > 0
          ? Math.round((s.amount / purchasePrice) * 1000) / 10
          : 0,
      trigger: s.due,
    })),
  };
}

export function mapProperty(raw: Record<string, unknown>): PropertyUnit {
  const status = str(raw.status, "draft");
  let paymentPlan = mapOwnedPlan(raw.paymentPlan);
  if (!paymentPlan && Array.isArray(raw.installments) && raw.installments.length > 0) {
    paymentPlan = {
      name: "Staged off-plan plan",
      basisPrice: num(raw.purchasePrice),
      installments: raw.installments.map((i) => mapInstallment(asRecord(i))),
    };
  }
  const ownedEnabled = bool(
    raw.ownedPaymentPlanEnabled,
    Boolean(paymentPlan?.installments.length),
  );

  const images = mapImageList(raw.images, raw.image);
  const image = images[0] ?? "";

  const exploreClosed = bool(raw.explorePaymentClosed);
  const units = asObjectList(raw.units).map(mapInventoryUnit);
  const firstUnit = units[0];
  // Units are source of truth. Preferring root-level plans resurrects stale
  // schedules after a unit saved paymentSchedules: null (inactive).
  const mortgagePlans = (() => {
    if (units.length > 0) return firstUnit?.mortgagePlans ?? [];
    return asObjectList(
      raw.mortgagePlans ?? raw.mortgage_plans ?? raw.mortgagePlan,
    ).map(mapMortgagePlan);
  })();
  const paymentSchedules = (() => {
    if (units.length > 0) return firstUnit?.paymentSchedules ?? [];
    return asObjectList(
      raw.paymentSchedules ?? raw.payment_schedules ?? raw.paymentSchedule,
    ).map(mapPaymentSchedule);
  })();
  const firstMortgage = mortgagePlans[0] ?? firstUnit?.mortgagePlans?.[0];
  const firstSchedule = paymentSchedules[0] ?? firstUnit?.paymentSchedules?.[0];
  const purchasePrice = num(raw.purchasePrice ?? firstUnit?.purchasePrice);
  const standard =
    mapStandardPlan(raw.standardPaymentPlan) ??
    (Array.isArray(raw.stages) && raw.stages.length > 0
      ? {
          name: str(raw.standardPlanName, "Standard staged plan"),
          stages: raw.stages.map((s) => mapStage(asRecord(s))),
        }
      : scheduleToStandardPlan(firstSchedule, purchasePrice));

  return {
    id: str(raw.id),
    reference: str(raw.reference),
    name: str(raw.name),
    developmentId:
      raw.developmentId == null || raw.developmentId === ""
        ? null
        : str(raw.developmentId),
    propertyType: str(raw.type || raw.propertyType || firstUnit?.type, "apartment"),
    bedrooms: num(raw.bedrooms ?? firstUnit?.bedrooms),
    bathrooms: num(raw.bathrooms ?? firstUnit?.bathrooms),
    sizeSqft: num(raw.sizeSqft ?? firstUnit?.sizeSqft),
    floor: str(raw.floor ?? firstUnit?.floor),
    purchasePrice,
    currentValue: num(raw.currentValue ?? firstUnit?.currentValue),
    reservationStatus: str(raw.reservationStatus),
    status: isPropertyStatus(status) ? status : "draft",
    completionDate: toDateInputValue(str(raw.completionDate)),
    rentalEstimate: num(raw.rentalEstimate ?? firstUnit?.rentalEstimate),
    serviceCharge: num(raw.serviceCharge ?? firstUnit?.serviceCharge),
    groundRent: num(raw.groundRent ?? firstUnit?.groundRent),
    managementFee: num(raw.managementFee ?? firstUnit?.managementFee),
    projectedGrossYield: num(
      raw.projectedGrossYield ?? raw.grossYield ?? firstUnit?.projectedGrossYield,
    ),
    projectedNetYield: num(raw.projectedNetYield ?? firstUnit?.projectedNetYield),
    projectedCapitalGrowth: num(
      raw.projectedCapitalGrowth ??
        raw.capitalGrowth ??
        firstUnit?.projectedCapitalGrowth,
    ),
    paymentPlanSummary: exploreClosed
      ? "Closed"
      : str(raw.paymentPlanSummary || firstSchedule?.summary),
    standardPaymentPlan: exploreClosed ? null : standard,
    paymentPlan: ownedEnabled
      ? paymentPlan ?? {
          name: "Staged off-plan plan",
          basisPrice: num(raw.purchasePrice),
          installments: [],
        }
      : null,
    image,
    images,
    visibleInExplore: bool(raw.visibleInExplore),
    sortOrder: num(raw.sortOrder ?? raw.sort_order, Number.MAX_SAFE_INTEGER),
    assignedInvestorId:
      raw.assignedInvestorId == null || raw.assignedInvestorId === ""
        ? null
        : str(raw.assignedInvestorId),
    city: str(raw.city),
    address: str(raw.address || raw.location),
    region: str(raw.region),
    location: str(raw.location || raw.address),
    postcode: str(raw.postcode),
    highlights: stringList(raw.highlights),
    amenities: stringList(raw.amenities),
    locationInfo: str(raw.locationInfo ?? raw.location_info),
    loanBalance: num(raw.loanBalance ?? firstMortgage?.loanAmount),
    equity: num(raw.equity),
    monthlyMortgage: num(raw.monthlyMortgage ?? firstMortgage?.monthlyPayment),
    occupancy: num(raw.occupancy),
    tenantName: raw.tenantName == null ? undefined : str(raw.tenantName),
    tenancyEnd: raw.tenancyEnd == null ? undefined : toDateInputValue(str(raw.tenancyEnd)) || undefined,
    units,
    mortgagePlans,
    paymentSchedules,
    updatedAt: str(raw.updatedAt, new Date().toISOString()),
    updatedBy: str(raw.updatedBy),
  };
}

export type PropertyWriteInput = Partial<PropertyUnit> & {
  name: string;
  /** @deprecated Prefer `imageFiles` — kept for one-file callers. */
  imageFile?: File | null;
  imageFiles?: File[];
  existingImages?: string[];
  removeImages?: string[];
  /** New files per unit index — sent as `unitImages[n]`. */
  unitImageFiles?: File[][];
};

/** Build a PropertyUnit from the form payload we just submitted. */
export function propertyFromWriteInput(
  propertyId: string,
  input: PropertyWriteInput,
): PropertyUnit {
  return {
    id: propertyId,
    reference: (input.reference ?? input.name).trim(),
    name: input.name.trim(),
    developmentId: input.developmentId ?? null,
    propertyType: input.propertyType?.trim() || "apartment",
    bedrooms: input.bedrooms ?? 0,
    bathrooms: input.bathrooms ?? 0,
    sizeSqft: input.sizeSqft ?? 0,
    floor: input.floor ?? "",
    purchasePrice: input.purchasePrice ?? 0,
    currentValue: input.currentValue ?? 0,
    reservationStatus: input.reservationStatus ?? "",
    status: input.status ?? "draft",
    completionDate: toDateInputValue(input.completionDate),
    rentalEstimate: input.rentalEstimate ?? 0,
    serviceCharge: input.serviceCharge ?? 0,
    groundRent: input.groundRent ?? 0,
    managementFee: input.managementFee ?? 0,
    projectedGrossYield: input.projectedGrossYield ?? 0,
    projectedNetYield: input.projectedNetYield ?? 0,
    projectedCapitalGrowth: input.projectedCapitalGrowth ?? 0,
    paymentPlanSummary: input.paymentPlanSummary ?? "",
    standardPaymentPlan: input.standardPaymentPlan ?? null,
    paymentPlan: input.paymentPlan ?? null,
    image: input.image ?? input.images?.[0] ?? "",
    images: input.images?.length
      ? input.images
      : input.image
        ? [input.image]
        : [],
    visibleInExplore: Boolean(input.visibleInExplore),
    sortOrder: input.sortOrder ?? Number.MAX_SAFE_INTEGER,
    assignedInvestorId: input.assignedInvestorId ?? null,
    city: input.city ?? "",
    address: input.address ?? input.location ?? "",
    region: input.region ?? "",
    location: input.location || input.address || "",
    postcode: input.postcode ?? "",
    highlights: input.highlights ?? [],
    amenities: input.amenities ?? [],
    locationInfo: input.locationInfo ?? "",
    loanBalance: input.loanBalance ?? 0,
    equity:
      input.equity ??
      Math.max(0, (input.currentValue ?? 0) - (input.loanBalance ?? 0)),
    monthlyMortgage: input.monthlyMortgage ?? 0,
    occupancy: input.occupancy ?? 0,
    tenantName: input.tenantName,
    tenancyEnd: input.tenancyEnd,
    units: input.units ?? [],
    mortgagePlans: input.mortgagePlans ?? [],
    paymentSchedules: input.paymentSchedules ?? [],
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? "",
  };
}

function parsePropertyPayload(data: unknown): PropertyUnit | null {
  if (data == null) return null;
  const record = asRecord(data);
  const unit =
    record.id != null || record.name != null || record.reference != null
      ? record
      : asRecord(record.property ?? record.data);
  if (unit.id == null && !unit.name && !unit.reference) return null;
  const mapped = mapProperty(unit);
  return mapped.id || mapped.name ? mapped : null;
}

/**
 * Prefer API entity when complete; fill gaps from the submitted form so Redux/UI
 * still reflect the save when the PUT response is thin or nested oddly.
 */
export function mergeSavedProperty(
  propertyId: string,
  input: PropertyWriteInput,
  fromApi: PropertyUnit | null,
): PropertyUnit {
  const submitted = propertyFromWriteInput(propertyId, input);
  const keepUrls = (urls: string[] | undefined) =>
    (urls ?? []).filter((u) => u && !u.startsWith("blob:"));

  if (!fromApi) {
    const images = keepUrls(submitted.images);
    return {
      ...submitted,
      images,
      image: images[0] ?? "",
    };
  }

  const apiImages = keepUrls(fromApi.images);
  const images =
    apiImages.length > 0
      ? apiImages
      : fromApi.image && !fromApi.image.startsWith("blob:")
        ? [fromApi.image]
        : keepUrls(submitted.images);

  return {
    ...submitted,
    ...fromApi,
    id: str(fromApi.id || propertyId),
    name: fromApi.name || submitted.name,
    reference: fromApi.reference || submitted.reference,
    paymentPlanSummary: fromApi.paymentPlanSummary || submitted.paymentPlanSummary,
    standardPaymentPlan:
      fromApi.standardPaymentPlan ?? submitted.standardPaymentPlan,
    paymentPlan: fromApi.paymentPlan ?? submitted.paymentPlan,
    images,
    image: images[0] ?? "",
    completionDate: fromApi.completionDate || submitted.completionDate,
    units: fromApi.units?.length ? fromApi.units : submitted.units,
    mortgagePlans: fromApi.mortgagePlans?.length
      ? fromApi.mortgagePlans
      : submitted.mortgagePlans,
    paymentSchedules: fromApi.paymentSchedules?.length
      ? fromApi.paymentSchedules
      : submitted.paymentSchedules,
    locationInfo: fromApi.locationInfo || submitted.locationInfo,
    highlights: fromApi.highlights?.length
      ? fromApi.highlights
      : submitted.highlights,
    amenities: fromApi.amenities?.length
      ? fromApi.amenities
      : submitted.amenities,
  };
}

function csvOrList(value: string[]): string {
  return value.filter(Boolean).join(", ");
}

function appendField(form: FormData, key: string, value: string | Blob | number | boolean | null | undefined) {
  if (value === undefined || value === null) return;
  form.append(key, typeof value === "string" || value instanceof Blob ? value : String(value));
}

function appendMortgagePlan(
  form: FormData,
  prefix: string,
  plan: {
    name: string;
    type: string;
    deposit: number;
    loanAmount: number;
    interestRate: number;
    monthlyPayment: number;
    termYears: number;
    ltvPct: number;
    reservationFee?: number;
    mortgageDate?: string;
    active?: boolean;
  },
) {
  appendField(form, `${prefix}[name]`, plan.name);
  appendField(form, `${prefix}[type]`, plan.type);
  appendField(form, `${prefix}[deposit]`, plan.deposit);
  appendField(form, `${prefix}[loanAmount]`, plan.loanAmount);
  appendField(form, `${prefix}[interestRate]`, plan.interestRate);
  appendField(form, `${prefix}[monthlyPayment]`, plan.monthlyPayment);
  appendField(form, `${prefix}[termYears]`, plan.termYears);
  appendField(form, `${prefix}[ltvPct]`, plan.ltvPct);
  appendField(form, `${prefix}[reservationFee]`, plan.reservationFee ?? 0);
  appendField(form, `${prefix}[mortgageDate]`, plan.mortgageDate ?? "");
  appendField(form, `${prefix}[active]`, plan.active !== false ? "true" : "false");
}

function appendPaymentSchedule(
  form: FormData,
  prefix: string,
  plan: {
    name: string;
    summary: string;
    active?: boolean;
    stages: Array<{ label: string; amount: number; due: string; date?: string }>;
  },
) {
  appendField(form, `${prefix}[name]`, plan.name);
  appendField(form, `${prefix}[summary]`, plan.summary);
  appendField(form, `${prefix}[active]`, plan.active !== false ? "true" : "false");
  plan.stages.forEach((stage, stageIndex) => {
    appendField(form, `${prefix}[stages][${stageIndex}][label]`, stage.label);
    appendField(form, `${prefix}[stages][${stageIndex}][amount]`, stage.amount);
    appendField(form, `${prefix}[stages][${stageIndex}][due]`, stage.due);
    appendField(form, `${prefix}[stages][${stageIndex}][date]`, stage.date ?? "");
  });
}

/** Multipart body matching JM Admin collection (bracket keys + unitImages[n]). */
export function buildPropertyFormData(input: PropertyWriteInput): FormData {
  const form = new FormData();
  const json = propertyWriteBody(input);

  const scalarKeys = [
    "name",
    "reference",
    "developmentId",
    "status",
    "completionDate",
    "city",
    "address",
    "postcode",
    "region",
    "location",
    "locationInfo",
    "occupancy",
    "visibleInExplore",
  ] as const;

  for (const key of scalarKeys) {
    const value = json[key];
    if (value === undefined) continue;
    if (typeof value === "boolean") {
      appendField(form, key, value ? "true" : "false");
      continue;
    }
    appendField(form, key, value == null ? "" : String(value));
  }

  appendField(form, "highlights", csvOrList(input.highlights ?? []));
  appendField(form, "amenities", csvOrList(input.amenities ?? []));
  if (input.reservationStatus) {
    appendField(form, "reservationStatus", input.reservationStatus);
  }
  if (input.removeImages?.length) {
    appendField(
      form,
      "removeImages",
      csvOrList(input.removeImages.filter((u) => u && !u.startsWith("blob:"))),
    );
  }

  const units = (json.units as Array<Record<string, unknown>>) ?? [];
  units.forEach((unit, index) => {
    appendField(form, `units[${index}][type]`, String(unit.type ?? ""));
    appendField(form, `units[${index}][bedrooms]`, String(unit.bedrooms ?? 0));
    appendField(form, `units[${index}][bathrooms]`, String(unit.bathrooms ?? 0));
    appendField(form, `units[${index}][sizeSqft]`, String(unit.sizeSqft ?? 0));
    appendField(form, `units[${index}][floor]`, String(unit.floor ?? ""));
    appendField(form, `units[${index}][unitCount]`, String(unit.unitCount ?? 1));
    appendField(form, `units[${index}][totalUnits]`, String(unit.totalUnits ?? 0));
    appendField(form, `units[${index}][purchasePrice]`, String(unit.purchasePrice ?? 0));
    appendField(form, `units[${index}][currentValue]`, String(unit.currentValue ?? 0));
    appendField(form, `units[${index}][rentalEstimate]`, String(unit.rentalEstimate ?? 0));
    appendField(
      form,
      `units[${index}][rentalIncomeMode]`,
      String(unit.rentalIncomeMode ?? "expected"),
    );
    appendField(form, `units[${index}][purchaseDate]`, String(unit.purchaseDate ?? ""));
    appendField(form, `units[${index}][annualRentalGrowth]`, String(unit.annualRentalGrowth ?? 0));
    appendField(form, `units[${index}][costInflation]`, String(unit.costInflation ?? 0));
    appendField(form, `units[${index}][serviceCharge]`, String(unit.serviceCharge ?? 0));
    appendField(form, `units[${index}][groundRent]`, String(unit.groundRent ?? 0));
    appendField(form, `units[${index}][managementFee]`, String(unit.managementFee ?? 0));
    appendField(form, `units[${index}][grossYield]`, String(unit.grossYield ?? unit.projectedGrossYield ?? 0));
    appendField(form, `units[${index}][capitalGrowth]`, String(unit.capitalGrowth ?? unit.projectedCapitalGrowth ?? 0));
    const images = Array.isArray(unit.images) ? unit.images : [];
    images.forEach((url, imageIndex) => {
      appendField(form, `units[${index}][images][${imageIndex}]`, String(url));
    });

    const nestedMortgages = unit.mortgagePlans;
    if (nestedMortgages == null || !Array.isArray(nestedMortgages) || nestedMortgages.length === 0) {
      // Clear inactive / removed mortgage plans on the API.
      appendField(form, `units[${index}][mortgagePlans]`, "");
    } else {
      nestedMortgages.forEach((plan, planIndex) => {
        appendMortgagePlan(
          form,
          `units[${index}][mortgagePlans][${planIndex}]`,
          plan as Parameters<typeof appendMortgagePlan>[2],
        );
      });
    }

    const nestedSchedules = unit.paymentSchedules;
    if (nestedSchedules == null || !Array.isArray(nestedSchedules) || nestedSchedules.length === 0) {
      appendField(form, `units[${index}][paymentSchedules]`, "");
    } else {
      nestedSchedules.forEach((plan, planIndex) => {
        appendPaymentSchedule(
          form,
          `units[${index}][paymentSchedules][${planIndex}]`,
          plan as Parameters<typeof appendPaymentSchedule>[2],
        );
      });
    }
  });

  for (const file of collectImageFiles(input)) {
    form.append("images", file);
  }
  (input.unitImageFiles ?? []).forEach((files, index) => {
    for (const file of files) {
      form.append(`unitImages[${index}]`, file);
    }
  });

  return form;
}

export async function fetchProperties(): Promise<{
  items: PropertyUnit[];
  message: string;
}> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.properties.list);
  return {
    items: asRecordArray(unwrapData(raw))
      .map(mapProperty)
      .sort(compareSortOrder),
    message: envelopeMessage(raw, "Success."),
  };
}

export type PropertySortItem = {
  id: string | number;
  sortOrder: number;
};

/** Bulk-update Explore / admin list order. Lower sortOrder appears first. */
export async function putPropertiesSort(
  items: PropertySortItem[],
): Promise<{ items: PropertyUnit[]; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(endpoints.properties.sort, {
    method: "PUT",
    body: { items },
  });
  const data = unwrapData(raw);
  const rows = Array.isArray(data)
    ? asRecordArray(data)
    : asRecordArray(
        asRecord(data).items ?? asRecord(data).properties ?? [],
      );
  return {
    items: (rows.length ? rows.map(mapProperty) : []).sort(compareSortOrder),
    message: envelopeMessage(raw, "Order saved."),
  };
}

export async function fetchProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.properties.one(propertyId),
  );
  const data = unwrapData(raw);
  if (!data) return { property: null, message: envelopeMessage(raw, "Success.") };
  return {
    property: mapProperty(asRecord(data)),
    message: envelopeMessage(raw, "Success."),
  };
}

function optionalId(value: string | null | undefined): string | number | null {
  if (value == null || value === "") return null;
  return Number(value) || value;
}

function collectImageFiles(input: PropertyWriteInput): File[] {
  if (input.imageFiles?.length) return input.imageFiles;
  if (input.imageFile) return [input.imageFile];
  return [];
}

function hasMultipartFiles(input: PropertyWriteInput): boolean {
  if (collectImageFiles(input).length > 0) return true;
  return (input.unitImageFiles ?? []).some((files) => files.length > 0);
}

/** JSON body matching JM Admin collection — financials and plans live on each unit. */
function propertyWriteBody(input: PropertyWriteInput): Record<string, unknown> {
  const units = (input.units ?? []).map((u) => ({
    type: u.type,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    sizeSqft: u.sizeSqft,
    floor: u.floor,
    unitCount: u.unitCount,
    totalUnits: u.totalUnits ?? 0,
    images: (u.images ?? []).filter((url) => url && !url.startsWith("blob:")),
    purchasePrice: u.purchasePrice ?? 0,
    currentValue: u.currentValue ?? 0,
    rentalEstimate: u.rentalEstimate ?? 0,
    rentalIncomeMode: u.rentalIncomeMode ?? "expected",
    purchaseDate: u.purchaseDate ?? "",
    annualRentalGrowth: u.annualRentalGrowth ?? 0,
    costInflation: u.costInflation ?? 0,
    serviceCharge: u.serviceCharge ?? 0,
    groundRent: u.groundRent ?? 0,
    managementFee: u.managementFee ?? 0,
    projectedGrossYield: u.projectedGrossYield ?? 0,
    projectedNetYield: u.projectedNetYield ?? 0,
    projectedCapitalGrowth: u.projectedCapitalGrowth ?? 0,
    grossYield: u.projectedGrossYield ?? 0,
    capitalGrowth: u.projectedCapitalGrowth ?? 0,
    mortgagePlans: (() => {
      if (u.mortgagePlans == null) return null;
      const plans = u.mortgagePlans
        .filter((plan) => plan.active !== false)
        .map((plan) => ({
          name: plan.name.trim() || "Mortgage plan",
          type: plan.type,
          deposit: plan.deposit,
          loanAmount: plan.loanAmount,
          interestRate: plan.interestRate,
          monthlyPayment: plan.monthlyPayment,
          termYears: plan.termYears,
          ltvPct: plan.ltvPct,
          reservationFee: plan.reservationFee ?? 0,
          mortgageDate: plan.mortgageDate ?? "",
          active: true as const,
        }));
      return plans.length > 0 ? plans : null;
    })(),
    paymentSchedules: (() => {
      if (u.paymentSchedules == null) return null;
      const plans = u.paymentSchedules
        .filter((plan) => plan.active !== false)
        .map((plan) => ({
          name: plan.name.trim() || "Developer payment schedule",
          summary: plan.summary,
          active: true as const,
          stages: plan.stages.map((s) => ({
            label: s.label,
            amount: s.amount,
            due: s.due,
            date: s.date ?? "",
          })),
        }));
      return plans.length > 0 ? plans : null;
    })(),
  }));

  const body: Record<string, unknown> = {
    name: input.name.trim(),
    reference: (input.reference ?? "").trim(),
    developmentId: optionalId(input.developmentId),
    status: input.status ?? "draft",
    completionDate: toApiDate(input.completionDate) || null,
    city: input.city ?? "",
    address: input.address ?? input.location ?? "",
    postcode: input.postcode ?? "",
    region: input.region ?? "",
    highlights: input.highlights ?? [],
    amenities: input.amenities ?? [],
    locationInfo: input.locationInfo ?? "",
    location: input.location || input.address || "",
    occupancy: input.occupancy ?? 0,
    units,
    visibleInExplore: Boolean(input.visibleInExplore),
  };
  if (input.removeImages?.length) {
    body.removeImages = input.removeImages.filter((u) => u && !u.startsWith("blob:"));
  }
  return body;
}

async function uploadPropertyImages(propertyId: string, files: File[]): Promise<void> {
  if (!files.length) return;
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }
  await apiFormRequest<ApiEnvelope<unknown>>(endpoints.properties.images(propertyId), {
    method: "POST",
    formData,
  });
}

/** Prefer stored path for DELETE body; fall back to absolute URL as-is. */
function toStoredImageRef(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "");
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return "";
  }
  const base = getApiBaseUrl();
  if (base && trimmed.startsWith(base)) {
    return trimmed.slice(base.length).replace(/^\//, "");
  }
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const { pathname } = new URL(trimmed);
      return pathname.replace(/^\//, "");
    }
  } catch {
    /* keep trimmed */
  }
  return trimmed.replace(/^\//, "");
}

/** DELETE /admin/properties/:id/images — body `{ images: string[] }`. */
export async function deletePropertyImages(
  propertyId: string,
  images: string[],
): Promise<{ message: string }> {

  const refs = [...new Set(images.map(toStoredImageRef).filter(Boolean))];

  if (!refs.length) {
    return { message: "Nothing to remove." };
  }
  const raw = await apiRequest<ApiEnvelope<unknown>>(
    endpoints.properties.images(propertyId),
    {
      method: "DELETE",
      body: { images: refs },
    },
  );
  return { message: envelopeMessage(raw, "Images deleted.") };
}


async function persistProperty(
  method: "POST" | "PUT",
  path: string,

  input: PropertyWriteInput,
  fallbackId: string,
  fallbackMessage: string,
): Promise<{ property: PropertyUnit; message: string }> {
  const useMultipart = hasMultipartFiles(input);
  const raw = useMultipart
    ? await apiFormRequest<ApiEnvelope<unknown>>(path, {
        method,
        formData: buildPropertyFormData(input),
      })
    : await apiRequest<ApiEnvelope<unknown>>(path, {
        method,
        body: propertyWriteBody(input),
      });
  const message = envelopeMessage(raw, fallbackMessage);
  const fromApi = parsePropertyPayload(unwrapData(raw));
  const propertyId = str(fromApi?.id || fallbackId);
  if (!propertyId) {
    throw new ApiError(
      message || "Save succeeded but no property id was returned.",
      0,
    );
  }

  // JSON create/update has no file fields — gallery-only files still go to /images.
  if (!useMultipart) {
    await uploadPropertyImages(propertyId, collectImageFiles(input));
  }
  if (method === "PUT" && input.removeImages?.length) {
    try {
      await deletePropertyImages(propertyId, input.removeImages);
    } catch {
      // PUT `removeImages` may already have deleted these paths.
    }
  }

  const { property: fetched } = await fetchProperty(propertyId);
  return {
    property: mergeSavedProperty(propertyId, input, fetched ?? fromApi),
    message,
  };
}

export async function postProperty(
  input: PropertyWriteInput,
): Promise<{ property: PropertyUnit; message: string }> {
  return persistProperty(
    "POST",
    endpoints.properties.create,
    input,
    str(input.id),
    "Created.",
  );
}

export async function putProperty(
  propertyId: string,
  input: PropertyWriteInput,
): Promise<{ property: PropertyUnit; message: string }> {
  return persistProperty(
    "PUT",
    endpoints.properties.one(propertyId),
    input,
    propertyId,
    "Updated.",
  );
}

async function postPropertyAction(
  path: string,
  fallbackMessage: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  const raw = await apiRequest<ApiEnvelope<unknown>>(path, { method: "POST" });
  const data = unwrapData(raw);
  if (!data) {
    return { property: null, message: envelopeMessage(raw, fallbackMessage) };
  }
  const record = asRecord(data);
  // Some actions wrap the unit: { property: {...} }
  const unit =
    record.id != null || record.name != null || record.reference != null
      ? record
      : asRecord(record.property ?? record.data);
  if (!unit.id && !unit.name && !unit.reference) {
    return { property: null, message: envelopeMessage(raw, fallbackMessage) };
  }
  return {
    property: mapProperty(unit),
    message: envelopeMessage(raw, fallbackMessage),
  };
}

export async function postPublishProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  return postPropertyAction(endpoints.properties.publish(propertyId), "Published.");
}

export async function postUnpublishProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  return postPropertyAction(endpoints.properties.unpublish(propertyId), "Unpublished.");
}

export async function postDuplicateProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  return postPropertyAction(endpoints.properties.duplicate(propertyId), "Duplicated.");
}

export async function postArchiveProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  return postPropertyAction(endpoints.properties.archive(propertyId), "Archived.");
}

export async function postUnarchiveProperty(
  propertyId: string,
): Promise<{ property: PropertyUnit | null; message: string }> {
  return postPropertyAction(endpoints.properties.unarchive(propertyId), "Unarchived.");
}
