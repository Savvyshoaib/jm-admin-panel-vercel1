import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormField } from "@/components/admin/FormField";
import { FormSection } from "@/components/admin/FormSection";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatCurrency, titleCase } from "@/lib/format";
import {
  summarizeStandardPlan,
} from "@/lib/paymentPlan";
import { createClientId } from "@/lib/ids";
import { MediaImage } from "@/components/admin/MediaImage";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn, formatCsvList, parseCsvList } from "@/lib/utils";
import type {
  Development,
  PaymentPlan,
  PropertyInventoryUnit,
  PropertyMortgagePlan,
  PropertyPaymentSchedule,
  PropertyStatus,
  PropertyUnit,
  StandardPaymentPlan,
  StandardPaymentStage,
} from "@/models";
import {
  applyInsightPresetToUnit,
  assignPropertyToInvestor,
  getDevelopment,
  getProperty,
  getPropertyInsightPreset,
  removePropertyImages,
  saveProperty,
  syncDevelopmentFromProperty,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { upsertProperty } from "@/store/slices/propertiesSlice";
import {
  ensureDevelopments,
  upsertDevelopment,
} from "@/store/slices/developmentsSlice";
import { ensureRegions } from "@/store/slices/regionsSlice";
import { invalidateInvestors } from "@/store/slices/investorsSlice";
import { ensureContent } from "@/store/slices/contentSlice";
import { isThunkConditionError } from "@/store/thunkUtils";

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type UnitScheduleStage = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  /** Calendar date for custom schedule stages (YYYY-MM-DD). */
  date: string;
};

type UnitMortgagePlan = {
  id: string;
  kind: "mortgage";
  name: string;
  deposit: number;
  loanAmount: number;
  ratePct: number;
  monthlyPayment: number;
  termYears: number;
  ltvPct: number;
  type: "interest_only" | "repayment";
  reservationFee: number;
  mortgageDate: string;
  active: boolean;
};

type UnitPaymentSchedulePlan = {
  id: string;
  kind: "payment_schedule";
  name: string;
  summary: string;
  closed: boolean;
  active: boolean;
  stages: UnitScheduleStage[];
};

type UnitPlan = UnitMortgagePlan | UnitPaymentSchedulePlan;

/** UI draft for one inventory unit. Nested financials + plans live here. */
type UnitDraft = {
  id: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  floor: string;
  /** How many units of this type — API `unitCount`. */
  numberOfUnits: number;
  /** Total units for this inventory row — API `totalUnits`. */
  totalUnits: number;
  images: string[];
  pendingImages: PendingImage[];
  purchasePrice: number;
  currentValue: number;
  /** Shared monthly rental amount — API `rentalEstimate`. */
  rentalMonthly: number;
  /** API `rentalIncomeMode`: current | expected. */
  rentalKind: "current" | "expected";
  purchaseDate: string;
  annualRentalGrowth: number;
  costInflation: number;
  serviceCharge: number;
  groundRent: number;
  managementFee: number;
  projectedGrossYield: number;
  projectedNetYield: number;
  projectedCapitalGrowth: number;
  /** Mortgage and/or developer payment schedules for this unit (UI). */
  plans: UnitPlan[];
};

function emptyMortgagePlan(): UnitMortgagePlan {
  return {
    id: createClientId(),
    kind: "mortgage",
    name: "Mortgage plan",
    deposit: 0,
    loanAmount: 0,
    ratePct: 0,
    monthlyPayment: 0,
    termYears: 25,
    ltvPct: 0,
    type: "repayment",
    reservationFee: 0,
    mortgageDate: "",
    // New property / blank unit: schedule starts inactive; mortgage on until user chooses schedule.
    active: true,
  };
}

function emptyScheduleStage(): UnitScheduleStage {
  return {
    id: createClientId(),
    label: "",
    amount: 0,
    dueDate: "",
    date: "",
  };
}

function emptyPaymentSchedulePlan(): UnitPaymentSchedulePlan {
  return {
    id: createClientId(),
    kind: "payment_schedule",
    name: "Developer payment schedule",
    summary: "",
    closed: true,
    active: false,
    stages: [],
  };
}

/** New units: mortgage active; payment schedule available but without default stages. */
function defaultUnitPlans(): UnitPlan[] {
  return [emptyPaymentSchedulePlan(), emptyMortgagePlan()];
}

function ensureBothPlans(plans: UnitPlan[]): UnitPlan[] {
  const next = [...plans];
  // Missing from API (sent as null) → show inactive placeholder, not a new active plan.
  if (!next.some((p) => p.kind === "payment_schedule")) {
    next.unshift({ ...emptyPaymentSchedulePlan(), active: false, closed: true });
  }
  if (!next.some((p) => p.kind === "mortgage")) {
    next.push({ ...emptyMortgagePlan(), active: false });
  }
  return next;
}

function plansFromProperty(p: Partial<PropertyUnit>): UnitPlan[] {
  const plans: UnitPlan[] = [];
  const schedules =
    p.paymentSchedules?.length
      ? p.paymentSchedules
      : [];
  if (schedules.length) {
    for (const schedule of schedules) {
      plans.push({
        id: createClientId(),
        kind: "payment_schedule",
        name: schedule.name || "Developer payment schedule",
        summary: schedule.summary ?? "",
        closed: schedule.active === false,
        active: schedule.active !== false,
        stages: schedule.stages.length
          ? schedule.stages.map((s) => ({
              id: createClientId(),
              label: s.label,
              amount: s.amount,
              dueDate: s.due,
              date: s.date ?? "",
            }))
          : [emptyScheduleStage()],
      });
    }
  }
  // Empty / null paymentSchedules → inactive placeholder via ensureBothPlans.
  // Do not revive legacy standardPaymentPlan as an active assignable schedule.

  const mortgages = p.mortgagePlans?.length ? p.mortgagePlans : [];
  if (mortgages.length) {
    for (const mortgage of mortgages) {
      plans.push({
        id: createClientId(),
        kind: "mortgage",
        name: mortgage.name || "Mortgage plan",
        deposit: mortgage.deposit,
        loanAmount: mortgage.loanAmount,
        ratePct: mortgage.interestRate,
        monthlyPayment: mortgage.monthlyPayment,
        termYears: mortgage.termYears || 25,
        ltvPct: mortgage.ltvPct,
        type: mortgage.type,
        reservationFee: mortgage.reservationFee ?? 0,
        mortgageDate: mortgage.mortgageDate ?? "",
        active: mortgage.active !== false,
      });
    }
  } else if ((p.monthlyMortgage ?? 0) > 0 || (p.loanBalance ?? 0) > 0) {
    const price = p.purchasePrice ?? 0;
    const loan = p.loanBalance ?? 0;
    plans.push({
      id: createClientId(),
      kind: "mortgage",
      name: "Mortgage plan",
      deposit: Math.max(0, price - loan),
      loanAmount: loan,
      ratePct: 0,
      monthlyPayment: p.monthlyMortgage ?? 0,
      termYears: 25,
      ltvPct: price > 0 ? Math.round((loan / price) * 1000) / 10 : 0,
      type: "repayment",
      reservationFee: 0,
      mortgageDate: "",
      active: true,
    });
  }

  return ensureBothPlans(plans);
}

function schedulePlanToApi(plan: UnitPaymentSchedulePlan | undefined, purchasePrice: number): {
  paymentPlanSummary: string;
  standardPaymentPlan: StandardPaymentPlan | null;
} {
  if (!plan) {
    return { paymentPlanSummary: "", standardPaymentPlan: null };
  }
  const stages: StandardPaymentStage[] = plan.stages.map((s) => ({
    label: s.label,
    percent:
      purchasePrice > 0
        ? Math.round((s.amount / purchasePrice) * 1000) / 10
        : 0,
    trigger: s.dueDate,
  }));
  const standard: StandardPaymentPlan = {
    name: plan.name || "Developer payment schedule",
    stages,
  };
  return {
    paymentPlanSummary:
      plan.summary.trim() || summarizeStandardPlan(standard),
    standardPaymentPlan: standard,
  };
}

function emptyUnitDraft(): UnitDraft {
  return {
    id: createClientId(),
    propertyType: "1-bed",
    bedrooms: 1,
    bathrooms: 1,
    sizeSqft: 0,
    floor: "",
    numberOfUnits: 1,
    totalUnits: 0,
    images: [],
    pendingImages: [],
    purchasePrice: 0,
    currentValue: 0,
    rentalMonthly: 0,
    rentalKind: "expected",
    purchaseDate: "",
    annualRentalGrowth: 0,
    costInflation: 0,
    serviceCharge: 0,
    groundRent: 0,
    managementFee: 0,
    projectedGrossYield: 0,
    projectedNetYield: 0,
    projectedCapitalGrowth: 0,
    plans: defaultUnitPlans(),
  };
}

function unitFromProperty(p: Partial<PropertyUnit>): UnitDraft {
  return {
    id: createClientId(),
    propertyType: p.propertyType ?? "1-bed",
    bedrooms: p.bedrooms ?? 1,
    bathrooms: p.bathrooms ?? 1,
    sizeSqft: p.sizeSqft ?? 0,
    floor: p.floor ?? "",
    numberOfUnits: 1,
    totalUnits: 0,
    images:
      p.images && p.images.length > 0
        ? p.images
        : p.image
          ? [p.image]
          : [],
    pendingImages: [],
    purchasePrice: p.purchasePrice ?? 0,
    currentValue: p.currentValue ?? 0,
    rentalMonthly: p.rentalEstimate ?? 0,
    rentalKind: "expected",
    purchaseDate: "",
    annualRentalGrowth: 0,
    costInflation: 0,
    serviceCharge: p.serviceCharge ?? 0,
    groundRent: p.groundRent ?? 0,
    managementFee: p.managementFee ?? 0,
    projectedGrossYield: p.projectedGrossYield ?? 0,
    projectedNetYield: p.projectedNetYield ?? 0,
    projectedCapitalGrowth: p.projectedCapitalGrowth ?? 0,
    plans: plansFromProperty(p),
  };
}

function sliceEven<T>(items: T[], index: number, count: number): T[] | null {
  if (count < 1 || items.length === 0 || items.length % count !== 0) return null;
  const size = items.length / count;
  return items.slice(index * size, index * size + size);
}

function plansForInventoryUnit(
  unit: PropertyInventoryUnit,
  p: Partial<PropertyUnit>,
  index: number,
  unitCount: number,
): UnitPlan[] {
  if ((unit.mortgagePlans?.length ?? 0) > 0 || (unit.paymentSchedules?.length ?? 0) > 0) {
    return plansFromProperty({
      mortgagePlans: unit.mortgagePlans ?? [],
      paymentSchedules: unit.paymentSchedules ?? [],
      purchasePrice: unit.purchasePrice ?? (index === 0 ? p.purchasePrice : 0),
    });
  }
  const schedules = p.paymentSchedules ?? [];
  const mortgages = p.mortgagePlans ?? [];
  const slicedSchedules = sliceEven(schedules, index, unitCount);
  const slicedMortgages = sliceEven(mortgages, index, unitCount);
  if (slicedSchedules || slicedMortgages) {
    return plansFromProperty({
      paymentSchedules: slicedSchedules ?? (index === 0 ? schedules : []),
      mortgagePlans: slicedMortgages ?? (index === 0 ? mortgages : []),
      purchasePrice: unit.purchasePrice ?? (index === 0 ? p.purchasePrice : 0),
    });
  }
  if (index === 0) return plansFromProperty(p);
  return defaultUnitPlans();
}

function unitsFromProperty(p: Partial<PropertyUnit>): UnitDraft[] {
  if (p.units && p.units.length > 0) {
    const unitCount = p.units.length;
    return p.units.map((unit, index) => {
      const gallery =
        unit.images && unit.images.length > 0
          ? unit.images
          : index === 0
            ? p.images && p.images.length > 0
              ? p.images
              : p.image
                ? [p.image]
                : []
            : [];
      const financial = (key: keyof PropertyInventoryUnit) => {
        const fromUnit = unit[key];
        if (typeof fromUnit === "number") return fromUnit;
        if (index !== 0) return 0;
        const fromProperty = p[key as keyof PropertyUnit];
        return typeof fromProperty === "number" ? fromProperty : 0;
      };
      return {
        ...emptyUnitDraft(),
        propertyType: unit.type || "1-bed",
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        sizeSqft: unit.sizeSqft,
        floor: unit.floor,
        numberOfUnits: unit.unitCount || 1,
        totalUnits: unit.totalUnits ?? 0,
        images: gallery,
        pendingImages: [],
        purchasePrice: financial("purchasePrice"),
        currentValue: financial("currentValue"),
        rentalMonthly: financial("rentalEstimate"),
        rentalKind:
          unit.rentalIncomeMode === "current" ? "current" : "expected",
        purchaseDate:
          typeof unit.purchaseDate === "string" ? unit.purchaseDate : "",
        annualRentalGrowth: financial("annualRentalGrowth"),
        costInflation: 0,
        serviceCharge: financial("serviceCharge"),
        groundRent: financial("groundRent"),
        managementFee: financial("managementFee"),
        projectedGrossYield: financial("projectedGrossYield"),
        projectedNetYield: financial("projectedNetYield"),
        projectedCapitalGrowth: financial("projectedCapitalGrowth"),
        plans: plansForInventoryUnit(unit, p, index, unitCount),
      };
    });
  }
  return [unitFromProperty(p)];
}

function inventoryUnitsFromDrafts(units: UnitDraft[]): PropertyInventoryUnit[] {
  return units.map((u) => ({
    type: u.propertyType,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    sizeSqft: u.sizeSqft,
    floor: u.floor,
    unitCount: Math.max(1, u.numberOfUnits || 1),
    totalUnits: Math.max(0, u.totalUnits || 0),
    images: (u.images ?? []).filter((url) => url && !url.startsWith("blob:")),
    purchasePrice: u.purchasePrice,
    currentValue: u.currentValue,
    rentalEstimate: u.rentalMonthly,
    rentalIncomeMode: u.rentalKind,
    purchaseDate: u.purchaseDate || undefined,
    annualRentalGrowth: u.annualRentalGrowth,
    costInflation: 0,
    serviceCharge: u.serviceCharge,
    groundRent: u.groundRent,
    managementFee: u.managementFee,
    projectedGrossYield: u.projectedGrossYield,
    projectedNetYield: u.projectedNetYield,
    projectedCapitalGrowth: u.projectedCapitalGrowth,
    mortgagePlans: mortgagePlansFromDrafts([u]),
    paymentSchedules: paymentSchedulesFromDrafts([u]),
  }));
}

function mortgagePlansFromDrafts(
  units: UnitDraft[],
): PropertyMortgagePlan[] | null {
  const plans = units.flatMap((u) =>
    u.plans
      .filter(
        (p): p is UnitMortgagePlan =>
          p.kind === "mortgage" && p.active !== false,
      )
      .map((p) => ({
        name: p.name.trim() || "Mortgage plan",
        type: p.type,
        deposit: p.deposit,
        loanAmount: p.loanAmount,
        interestRate: p.ratePct,
        monthlyPayment: p.monthlyPayment,
        termYears: p.termYears,
        ltvPct: p.ltvPct,
        reservationFee: p.reservationFee,
        mortgageDate: p.mortgageDate || undefined,
        active: true,
      })),
  );
  return plans.length > 0 ? plans : null;
}

function paymentSchedulesFromDrafts(
  units: UnitDraft[],
): PropertyPaymentSchedule[] | null {
  const plans = units.flatMap((u) =>
    u.plans
      .filter(
        (p): p is UnitPaymentSchedulePlan =>
          p.kind === "payment_schedule" && p.active !== false,
      )
      .map((p) => ({
        name: p.name.trim() || "Developer payment schedule",
        summary: p.summary,
        active: true,
        stages: p.stages.map((s) => ({
          label: s.label,
          amount: s.amount,
          due: s.dueDate,
          date: s.date || undefined,
        })),
      })),
  );
  return plans.length > 0 ? plans : null;
}

function revokePending(images: PendingImage[]) {
  for (const item of images) URL.revokeObjectURL(item.previewUrl);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function developmentGallery(d: Development): string[] {
  const urls = d.images?.length ? d.images : d.image ? [d.image] : [];
  return urls.filter((u) => u && !u.startsWith("blob:"));
}

/** Field-keyed errors for inline display. First value is used in the toast. */
function collectPropertyErrors(
  form: Partial<PropertyUnit>,
  units: UnitDraft[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name?.trim() ?? "";
  if (name.length < 2) {
    errors.name = "Name is required (at least 2 characters).";
  } else if (name.length > 120) {
    errors.name = "Name must be 120 characters or fewer.";
  }
  if ((form.reference ?? "").trim().length > 60) {
    errors.reference = "Reference must be 60 characters or fewer.";
  }
  if (!form.status) {
    errors.status = "Status is required.";
  }
  if (!(form.city ?? "").trim()) {
    errors.city = "City is required.";
  }
  if (!(form.address ?? "").trim()) {
    errors.address = "Address is required.";
  }
  if (
    form.occupancy != null &&
    (!isFiniteNumber(form.occupancy) ||
      form.occupancy < 0 ||
      form.occupancy > 100)
  ) {
    errors.occupancy = "Occupancy must be between 0 and 100.";
  }
  if (!units.length) {
    errors.units = "Add at least one unit.";
    return errors;
  }

  for (const [index, unit] of units.entries()) {
    const label = `Unit ${index + 1}`;
    const u = (key: string) => `unit:${unit.id}:${key}`;
    if (!unit.propertyType.trim()) {
      errors[u("type")] = `${label}: type is required (e.g. 1-bed).`;
    }
    if (!isFiniteNumber(unit.bedrooms) || unit.bedrooms < 0 || unit.bedrooms > 20) {
      errors[u("bedrooms")] = `${label}: bedrooms must be between 0 and 20.`;
    }
    if (!isFiniteNumber(unit.bathrooms) || unit.bathrooms < 0 || unit.bathrooms > 20) {
      errors[u("bathrooms")] = `${label}: bathrooms must be between 0 and 20.`;
    }
    if (!isFiniteNumber(unit.sizeSqft) || unit.sizeSqft < 0) {
      errors[u("sizeSqft")] = `${label}: size cannot be negative.`;
    }
    if (!unit.floor.trim()) {
      errors[u("floor")] = `${label}: floor is required.`;
    }
    if (!Number.isInteger(unit.numberOfUnits) || unit.numberOfUnits < 1) {
      errors[u("count")] = `${label}: no. of units must be a whole number of at least 1.`;
    }
    if (!Number.isInteger(unit.totalUnits) || unit.totalUnits < 0) {
      errors[u("totalUnits")] =
        `${label}: total units must be a whole number of at least 0.`;
    }
    // Formula inputs (PROPERTY-FINANCIALS-FORMULAS): must be > 0 — never divide/project on zero.
    if (!isFiniteNumber(unit.purchasePrice) || unit.purchasePrice <= 0) {
      errors[u("purchasePrice")] = `${label}: purchase price must be greater than 0.`;
    }
    if (!unit.purchaseDate?.trim()) {
      errors[u("purchaseDate")] = `${label}: purchase date is required.`;
    }
    if (!isFiniteNumber(unit.currentValue) || unit.currentValue <= 0) {
      errors[u("currentValue")] = `${label}: current value must be greater than 0.`;
    }
    if (!isFiniteNumber(unit.rentalMonthly) || unit.rentalMonthly <= 0) {
      errors[u("rentalMonthly")] =
        `${label}: rental income (monthly) must be greater than 0.`;
    }
    // Cost line-items can be £0 (no charge); only block negatives.
    if (!isFiniteNumber(unit.serviceCharge) || unit.serviceCharge < 0) {
      errors[u("serviceCharge")] = `${label}: service charge cannot be negative.`;
    }
    if (!isFiniteNumber(unit.groundRent) || unit.groundRent < 0) {
      errors[u("groundRent")] = `${label}: ground rent cannot be negative.`;
    }
    if (!isFiniteNumber(unit.managementFee) || unit.managementFee < 0) {
      errors[u("managementFee")] = `${label}: management fee cannot be negative.`;
    }
    // Gross yield % on the form is marketing/display — not a live formula input.
    if (
      !isFiniteNumber(unit.projectedGrossYield) ||
      unit.projectedGrossYield < 0 ||
      unit.projectedGrossYield > 100
    ) {
      errors[u("grossYield")] = `${label}: gross yield must be between 0 and 100.`;
    }
    if (
      !isFiniteNumber(unit.projectedCapitalGrowth) ||
      unit.projectedCapitalGrowth <= 0 ||
      unit.projectedCapitalGrowth > 100
    ) {
      errors[u("capitalGrowth")] =
        `${label}: capital growth % must be greater than 0 and at most 100.`;
    }
    if (
      !isFiniteNumber(unit.annualRentalGrowth) ||
      unit.annualRentalGrowth <= 0 ||
      unit.annualRentalGrowth > 100
    ) {
      errors[u("annualRentalGrowth")] =
        `${label}: annual rental growth % must be greater than 0 and at most 100.`;
    }
    if (
      !isFiniteNumber(unit.costInflation) ||
      unit.costInflation < 0 ||
      unit.costInflation > 100
    ) {
      errors[u("costInflation")] =
        `${label}: cost inflation must be between 0 and 100.`;
    }

    const activePlans = unit.plans.filter((p) => p.active !== false);
    if (!activePlans.length) {
      errors[u("plans")] =
        `${label}: activate at least one payment schedule or mortgage plan.`;
    }

    for (const plan of unit.plans) {
      if (plan.active === false) continue;
      const p = (key: string) => `plan:${plan.id}:${key}`;
      if (!plan.name.trim()) {
        errors[p("name")] = `${label}: plan name is required.`;
      }
      if (plan.kind === "payment_schedule") {
        if (!plan.stages.length) {
          errors[p("stages")] = `${label}: add at least one payment stage.`;
        }
        for (const stage of plan.stages) {
          const s = (key: string) => `stage:${stage.id}:${key}`;
          if (!stage.label.trim()) {
            errors[s("label")] = `${label}: each stage needs a payment label.`;
          }
          if (!isFiniteNumber(stage.amount) || stage.amount <= 0) {
            errors[s("amount")] =
              `${label}: stage amount must be greater than 0.`;
          }
          if (!stage.dueDate.trim()) {
            errors[s("due")] = `${label}: each stage needs a due date (e.g. Now).`;
          }
        }
      }
      if (plan.kind === "mortgage") {
        if (!isFiniteNumber(plan.deposit) || plan.deposit < 0) {
          errors[p("deposit")] = `${label}: deposit cannot be negative.`;
        }
        if (!isFiniteNumber(plan.loanAmount) || plan.loanAmount <= 0) {
          errors[p("loan")] = `${label}: loan amount must be greater than 0.`;
        }
        if (
          !isFiniteNumber(plan.ratePct) ||
          plan.ratePct <= 0 ||
          plan.ratePct > 100
        ) {
          errors[p("rate")] =
            `${label}: interest rate must be greater than 0 and at most 100.`;
        }
        if (!isFiniteNumber(plan.monthlyPayment) || plan.monthlyPayment <= 0) {
          errors[p("monthly")] =
            `${label}: monthly payment must be greater than 0.`;
        }
        if (
          !Number.isInteger(plan.termYears) ||
          plan.termYears < 1 ||
          plan.termYears > 50
        ) {
          errors[p("term")] = `${label}: term must be a whole number between 1 and 50.`;
        }
        if (!isFiniteNumber(plan.ltvPct) || plan.ltvPct < 0 || plan.ltvPct > 100) {
          errors[p("ltv")] = `${label}: LTV must be between 0 and 100.`;
        }
        if (!isFiniteNumber(plan.reservationFee) || plan.reservationFee < 0) {
          errors[p("reservationFee")] =
            `${label}: reservation fee cannot be negative.`;
        }
      }
    }
  }

  if (form.paymentPlan) {
    if (!form.paymentPlan.name.trim()) {
      errors.ownedPlan = "Owned payment plan needs a name.";
    }
    if (form.paymentPlan.installments.some((i) => !i.label.trim())) {
      errors.ownedPlan = "Each installment needs a label.";
    }
  }

  return errors;
}

const empty: Partial<PropertyUnit> = {
  name: "",
  reference: "",
  status: "draft",
  city: "",
  address: "",
  region: "",
  location: "",
  postcode: "",
  highlights: [],
  amenities: [],
  locationInfo: "",
  occupancy: 0,
  paymentPlan: null,
  visibleInExplore: false,
  completionDate: "",
  image: "",
  images: [],
};

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";
const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isAllowedImageFile(file: File): boolean {
  if (IMAGE_MIME.has(file.type)) return true;
  // Some browsers leave type empty — fall back to extension.
  if (!file.type && IMAGE_EXT.test(file.name)) return true;
  return false;
}

function PropertyImageThumb({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  return (
    <MediaImage
      src={src}
      alt={alt}
      wrapperClassName="aspect-[4/3] w-full"
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

function Field({
  label,
  required,
  error,
  labelEnd,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  labelEnd?: ReactNode;
  children: React.ReactNode;
}) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
      labelEnd={labelEnd}
    >
      {children}
    </FormField>
  );
}

function UnitSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-subsection space-y-3.5 rounded-2xl p-3.5 sm:p-4">
      <div className="min-w-0 border-b border-white/8 pb-2.5">
        <h4 className="text-[13px] font-medium tracking-wide text-foreground">
          {title}
        </h4>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function UnitBlock({
  title,
  subtitle,
  actions,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-border/80 bg-muted/15 px-4 py-3">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-start gap-2">
            <ChevronDown
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                !open && "-rotate-90",
              )}
              aria-hidden
            />
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-foreground">{title}</h3>
              {subtitle ? (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
        </button>
        {actions ? (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
      {open ? (
        <div id={contentId} className="space-y-4 p-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function propertyPatchFromDevelopment(
  d: Development,
): Partial<PropertyUnit> {
  const contentImages = developmentGallery(d);
  return {
    developmentId: d.id,
    city: d.city || "",
    address: d.address || "",
    region: d.region || "",
    location: d.address || "",
    postcode: d.postcode || "",
    locationInfo: d.locationInfo || "",
    highlights: [...(d.highlights ?? [])],
    amenities: [...(d.amenities ?? [])],
    images: contentImages,
    image: contentImages[0] ?? "",
    completionDate: d.completionDate || "",
  };
}

export function PropertyFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new" || !params.id;
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const investorIdFromQuery = searchParams?.get("investorId") ?? null;
  const developmentIdFromQuery = searchParams?.get("developmentId") ?? null;
  const { can } = useAuth();
  const canEdit = can("edit", "properties") || can("create", "properties");
  const canManageContent =
    can("manage_content", "content") || can("publish", "content");
  const canViewContent = can("view", "content") || canManageContent;
  const dispatch = useAppDispatch();
  const regions = useAppSelector((s) => s.regions.items);
  const regionsStatus = useAppSelector((s) => s.regions.status);
  const regionOptions = useMemo(
    () =>
      regions.map((r) => ({
        value: r.value,
        label: r.label,
        keywords: r.value,
      })),
    [regions],
  );
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<Partial<PropertyUnit>>({
    ...empty,
    assignedInvestorId: investorIdFromQuery,
    developmentId: isNew ? developmentIdFromQuery : null,
  });

  const resolvedRegionValue = useMemo(() => {
    const stored = (form.region ?? "").trim();
    if (!stored) return "";
    if (regions.some((r) => r.value === stored)) return stored;
    const byLabel = regions.find(
      (r) => r.label.toLowerCase() === stored.toLowerCase(),
    );
    return byLabel?.value ?? stored;
  }, [form.region, regions]);
  const [units, setUnits] = useState<UnitDraft[]>([emptyUnitDraft()]);
  /** Client ids of units added in this session — mirror purchase → current value. */
  const [freshUnitIds, setFreshUnitIds] = useState<Set<string>>(() => new Set());
  const shouldMirrorCurrentValue = (unitId: string) =>
    isNew || freshUnitIds.has(unitId);
  const [contentPendingImages, setContentPendingImages] = useState<
    PendingImage[]
  >([]);
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [originalUnitImages, setOriginalUnitImages] = useState<string[]>([]);
  const [removingImageKey, setRemovingImageKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingDevelopment, setLoadingDevelopment] = useState(false);
  const [highlightsText, setHighlightsText] = useState("");
  const [amenitiesText, setAmenitiesText] = useState("");
  const [locationInfoText, setLocationInfoText] = useState("");

  const developmentsState = useAppSelector((s) => s.developments);
  const contentItems = useAppSelector((s) => s.content.items);
  const propertyContentCount = useMemo(() => {
    const propertyId = form.id ?? params.id;
    if (!propertyId || isNew) return 0;
    return contentItems.filter(
      (c) => c.propertyId && String(c.propertyId) === String(propertyId),
    ).length;
  }, [contentItems, form.id, params.id, isNew]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const developmentPrefillKey = useRef<string | null>(null);
  const applyDevelopmentSeq = useRef(0);
  const insightPrefillKey = useRef<string | null>(null);

  const clearError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyDevelopment = async (developmentId: string | null) => {
    const seq = ++applyDevelopmentSeq.current;
    setContentPendingImages((prev) => {
      revokePending(prev);
      return [];
    });
    if (!developmentId) {
      setForm((f) => ({
        ...f,
        developmentId: null,
        city: "",
        address: "",
        region: "",
        location: "",
        postcode: "",
        locationInfo: "",
        highlights: [],
        amenities: [],
        images: [],
        image: "",
        completionDate: "",
      }));
      setHighlightsText("");
      setAmenitiesText("");
      setLocationInfoText("");
      setOriginalImages([]);
      setOriginalUnitImages([]);
      return;
    }

    setLoadingDevelopment(true);
    try {
      let d: Development | null | undefined = null;
      try {
        d = await getDevelopment(developmentId);
      } catch {
        /* list fallback below */
      }
      if (!d) {
        d = developmentsState.items.find((x) => x.id === developmentId);
      }
      if (seq !== applyDevelopmentSeq.current) return;
      if (!d) {
        setForm((f) => ({ ...f, developmentId }));
        toast.error("Unable to load that development.");
        return;
      }
      dispatch(upsertDevelopment(d));
      const patch = propertyPatchFromDevelopment(d);
      setForm((f) => ({ ...f, ...patch }));
      setHighlightsText(formatCsvList(patch.highlights));
      setAmenitiesText(formatCsvList(patch.amenities));
      setLocationInfoText(patch.locationInfo ?? "");
      setOriginalImages(patch.images ?? []);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.city;
        delete next.address;
        delete next.postcode;
        return next;
      });
    } finally {
      if (seq === applyDevelopmentSeq.current) setLoadingDevelopment(false);
    }
  };

  useEffect(() => {
    void dispatch(ensureRegions()).catch(() => undefined);
    void dispatch(ensureDevelopments())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
    void dispatch(ensureContent())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
    if (!isNew && params.id) {
      setLoading(true);
      setLoadError(null);
      getProperty(params.id)
        .then(async (loaded) => {
          if (!loaded) {
            setLoadError("Property not found.");
            return;
          }
          let p = loaded;
          let images =
            p.images?.length > 0 ? p.images : p.image ? [p.image] : [];
          if (p.developmentId) {
            try {
              const d = await getDevelopment(p.developmentId);
              if (d) {
                dispatch(upsertDevelopment(d));
                if (images.length === 0) {
                  images = developmentGallery(d);
                }
                if (!p.locationInfo) {
                  p = { ...p, locationInfo: d.locationInfo || "" };
                }
                if (!(p.highlights?.length) && d.highlights?.length) {
                  p = { ...p, highlights: [...d.highlights] };
                }
                if (!(p.amenities?.length) && d.amenities?.length) {
                  p = { ...p, amenities: [...d.amenities] };
                }
              }
            } catch {
              /* list fallback is enough for the dropdown */
            }
          }
          setForm({
            ...p,
            address: p.address || p.location || "",
            region: p.region || "",
            highlights: p.highlights ?? [],
            amenities: p.amenities ?? [],
            locationInfo: p.locationInfo ?? "",
            images,
            image: images[0] ?? "",
          });
          setHighlightsText(formatCsvList(p.highlights));
          setAmenitiesText(formatCsvList(p.amenities));
          setLocationInfoText(p.locationInfo ?? "");
          setOriginalImages(images.filter((u) => u && !u.startsWith("blob:")));
          setContentPendingImages((prev) => {
            revokePending(prev);
            return [];
          });
          const loadedUnits = unitsFromProperty(p);
          setUnits((prev) => {
            for (const u of prev) revokePending(u.pendingImages);
            return loadedUnits;
          });
          setOriginalUnitImages(
            loadedUnits.flatMap((u) =>
              (u.images ?? []).filter((url) => url && !url.startsWith("blob:")),
            ),
          );
        })
        .catch((err) => {
          setLoadError(err instanceof ApiError ? err.message : "Unable to load property.");
        })
        .finally(() => setLoading(false));
    }
  }, [dispatch, isNew, params.id]);

  useEffect(() => {
    if (!isNew) return;
    const key = "new";
    if (insightPrefillKey.current === key) return;
    insightPrefillKey.current = key;
    void getPropertyInsightPreset()
      .then((preset) => {
        if (!preset) return;
        setUnits((prev) => {
          if (prev.length !== 1) return prev;
          const current = prev[0];
          const untouched =
            current.purchasePrice === 0 &&
            current.floor === "" &&
            (current.propertyType === "1-bed" || !current.propertyType);
          if (!untouched) return prev;
          for (const u of prev) revokePending(u.pendingImages);
          const next = applyInsightPresetToUnit(emptyUnitDraft(), preset);
          setFreshUnitIds(new Set([next.id]));
          return [next];
        });
      })
      .catch(() => {
        /* keep blank unit; user can still edit */
      });
  }, [isNew]);

  useEffect(() => {
    if (!isNew || !developmentIdFromQuery) return;
    if (developmentPrefillKey.current === developmentIdFromQuery) return;
    developmentPrefillKey.current = developmentIdFromQuery;
    void applyDevelopment(developmentIdFromQuery);
  }, [isNew, developmentIdFromQuery]);

  const devs = developmentsState.items;

  if (loading) return <LoadingBlock variant="form" />;

  if (loadError && !isNew) {
    return (
      <div className="space-y-4">
        <PageHeader title="Property" description={loadError} />
        <Button variant="outline" onClick={() => setLocation("/properties")}>
          Back to properties
        </Button>
      </div>
    );
  }

  const set = <K extends keyof PropertyUnit>(key: K, value: PropertyUnit[K]) => {
    clearError(String(key));
    setForm((f) => ({ ...f, [key]: value }));
  };

  const patchUnit = (unitId: string, patch: Partial<UnitDraft>) => {
    setFieldErrors((prev) => {
      const prefix = `unit:${unitId}:`;
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) delete next[key];
      }
      return next;
    });
    setUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, ...patch } : u)),
    );
  };

  const updateUnit = (
    unitId: string,
    updater: (unit: UnitDraft) => UnitDraft,
  ) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? updater(u) : u)));
  };

  const addUnit = () => {
    void getPropertyInsightPreset()
      .then((preset) => {
        const draft = preset
          ? applyInsightPresetToUnit(emptyUnitDraft(), preset)
          : emptyUnitDraft();
        setFreshUnitIds((prev) => new Set(prev).add(draft.id));
        setUnits((prev) => [...prev, draft]);
      })
      .catch(() => {
        const draft = emptyUnitDraft();
        setFreshUnitIds((prev) => new Set(prev).add(draft.id));
        setUnits((prev) => [...prev, draft]);
      });
  };

  const removeUnit = (unitId: string) => {
    setFreshUnitIds((prev) => {
      if (!prev.has(unitId)) return prev;
      const next = new Set(prev);
      next.delete(unitId);
      return next;
    });
    setUnits((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev.find((u) => u.id === unitId);
      if (target) revokePending(target.pendingImages);
      return prev.filter((u) => u.id !== unitId);
    });
  };

  const updateUnitPlan = (
    unitId: string,
    planId: string,
    patch: Partial<UnitMortgagePlan> | Partial<UnitPaymentSchedulePlan>,
  ) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`plan:${planId}:`) || key.startsWith("stage:")) {
          delete next[key];
        }
      }
      delete next[`unit:${unitId}:plans`];
      return next;
    });
    updateUnit(unitId, (u) => ({
      ...u,
      plans: u.plans.map((plan) =>
        plan.id === planId ? ({ ...plan, ...patch } as UnitPlan) : plan,
      ),
    }));
  };

  return (
    <div>
      <PageHeader
        title={isNew ? "Add property" : form.name || "Edit property"}
        description="Property identity and location at the top; inventory units carry specs, media, financials, and payment plans."
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: isNew ? "New" : form.reference || "Edit" },
        ]}
        actions={
          !isNew && (form.id || params.id) && canViewContent ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setLocation(
                  `/content?propertyId=${encodeURIComponent(
                    String(form.id ?? params.id),
                  )}`,
                )
              }
            >
              {propertyContentCount > 0
                ? `Contents (${propertyContentCount})`
                : "Contents"}
            </Button>
          ) : undefined
        }
      />

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!canEdit) return;
          const primary = units[0];
          if (!primary) {
            toast.error("Add at least one unit.");
            return;
          }
          const errors = collectPropertyErrors(form, units);
          setFieldErrors(errors);
          if (Object.keys(errors).length) {
            toast.error(Object.values(errors)[0]);
            return;
          }
          setSaving(true);
          try {
            const contentKeep = (form.images ?? []).filter(
              (u) => u && !u.startsWith("blob:"),
            );
            const unitKeep = units.flatMap((u) =>
              (u.images ?? []).filter((url) => url && !url.startsWith("blob:")),
            );
            const removeImages = [
              ...new Set([
                ...originalImages.filter((u) => !contentKeep.includes(u)),
                ...originalUnitImages.filter((u) => !unitKeep.includes(u)),
              ]),
            ];
            const sharedHighlights = parseCsvList(highlightsText);
            const sharedAmenities = parseCsvList(amenitiesText);
            const sharedLocationInfo = locationInfoText;
            const saved = await saveProperty({
              ...form,
              id: isNew ? form.id : (form.id ?? params.id),
              name: form.name!.trim(),
              reference: form.reference?.trim() || form.name!.trim(),
              assignedInvestorId: form.assignedInvestorId ?? investorIdFromQuery,
              address: form.address ?? "",
              region: resolvedRegionValue || form.region || "",
              location: form.address || form.location || "",
              city: form.city ?? "",
              postcode: form.postcode ?? "",
              locationInfo: sharedLocationInfo,
              highlights: sharedHighlights,
              amenities: sharedAmenities,
              occupancy: form.occupancy ?? 0,
              propertyType: primary.propertyType,
              bedrooms: primary.bedrooms,
              bathrooms: primary.bathrooms,
              sizeSqft: primary.sizeSqft,
              floor: primary.floor,
              purchasePrice: primary.purchasePrice,
              currentValue: shouldMirrorCurrentValue(primary.id)
                ? (primary.purchasePrice ?? 0)
                : primary.currentValue,
              rentalEstimate: primary.rentalMonthly,
              serviceCharge: primary.serviceCharge,
              groundRent: primary.groundRent,
              managementFee: primary.managementFee,
              projectedGrossYield: primary.projectedGrossYield,
              projectedNetYield: primary.projectedNetYield,
              projectedCapitalGrowth: primary.projectedCapitalGrowth,
              units: inventoryUnitsFromDrafts(
                units.map((u) =>
                  shouldMirrorCurrentValue(u.id)
                    ? { ...u, currentValue: u.purchasePrice ?? 0 }
                    : u,
                ),
              ),
              mortgagePlans: mortgagePlansFromDrafts(units) ?? undefined,
              paymentSchedules: paymentSchedulesFromDrafts(units) ?? undefined,
              ...schedulePlanToApi(
                primary.plans.find(
                  (p): p is UnitPaymentSchedulePlan =>
                    p.kind === "payment_schedule" && p.active !== false,
                ),
                primary.purchasePrice ?? 0,
              ),
              paymentPlan: form.paymentPlan ?? null,
              monthlyMortgage:
                primary.plans.find(
                  (p): p is UnitMortgagePlan =>
                    p.kind === "mortgage" && p.active !== false,
                )?.monthlyPayment ?? 0,
              loanBalance:
                primary.plans.find(
                  (p): p is UnitMortgagePlan =>
                    p.kind === "mortgage" && p.active !== false,
                )?.loanAmount ?? 0,
              imageFiles: form.developmentId
                ? []
                : contentPendingImages.map((p) => p.file),
              unitImageFiles: units.map((u) =>
                u.pendingImages.map((pending) => pending.file),
              ),
              existingImages: contentKeep,
              removeImages,
              image: contentKeep[0] ?? "",
              images: contentKeep,
              equity: (() => {
                const loan =
                  primary.plans.find(
                    (p): p is UnitMortgagePlan => p.kind === "mortgage",
                  )?.loanAmount ?? form.loanBalance ?? 0;
                return Math.max(0, (primary.currentValue ?? 0) - loan);
              })(),
            });
            if (form.developmentId) {
              try {
                const synced = await syncDevelopmentFromProperty(
                  String(form.developmentId),
                  {
                    address: form.address ?? "",
                    city: form.city ?? "",
                    region: resolvedRegionValue || form.region || "",
                    postcode: form.postcode ?? "",
                    locationInfo: sharedLocationInfo,
                    highlights: sharedHighlights,
                    amenities: sharedAmenities,
                    completionDate: form.completionDate ?? "",
                  },
                );
                dispatch(upsertDevelopment(synced));
              } catch (err) {
                toast.error(
                  err instanceof ApiError
                    ? `Property saved, but the development was not updated: ${err.message}`
                    : "Property saved, but the development was not updated.",
                );
              }
            }
            setContentPendingImages((prev) => {
              revokePending(prev);
              return [];
            });
            setUnits((prev) => {
              for (const u of prev) revokePending(u.pendingImages);
              return unitsFromProperty(saved);
            });
            // Trust save response — upsert Redux; no follow-up GET spam.
            const next = {
              ...saved,
              address: form.address || saved.address || saved.location || "",
              region: form.region || saved.region || "",
              city: form.city || saved.city || "",
              postcode: form.postcode || saved.postcode || "",
              highlights: sharedHighlights,
              amenities: sharedAmenities,
              locationInfo: sharedLocationInfo,
              completionDate: form.completionDate || saved.completionDate || "",
              images:
                saved.images?.length > 0
                  ? saved.images
                  : saved.image
                    ? [saved.image]
                    : [],
              image: saved.images?.[0] ?? saved.image ?? "",
            };
            setForm(next);
            setHighlightsText(formatCsvList(next.highlights));
            setAmenitiesText(formatCsvList(next.amenities));
            setLocationInfoText(next.locationInfo ?? "");
            setOriginalImages(
              next.images.filter((u) => u && !u.startsWith("blob:")),
            );
            setOriginalUnitImages(
              (saved.units ?? []).flatMap((u) =>
                (u.images ?? []).filter((url) => url && !url.startsWith("blob:")),
              ),
            );
            dispatch(upsertProperty(next));
            if (isNew && (investorIdFromQuery || form.assignedInvestorId)) {
              const investorId = (investorIdFromQuery || form.assignedInvestorId)!;
              try {
                await assignPropertyToInvestor(investorId, {
                  propertyId: next.id,
                  units: [{ unitIndex: 0, quantity: 1 }],
                  planType: "cash",
                  planMode: "default",
                });
                const assigned = { ...next, assignedInvestorId: investorId };
                setForm(assigned);
                dispatch(upsertProperty(assigned));
                dispatch(invalidateInvestors());
              } catch {
                /* already assigned via property field */
              }
              toast.success("Property created and assigned to investor");
              setLocation(`/investors/${investorId}?tab=portfolio`);
            } else {
              toast.success(isNew ? "Property created" : "Property updated");
              if (isNew || String(params.id) !== String(next.id)) {
                setLocation(`/properties/${next.id}`);
              }
            }
          } catch (err) {
            toast.error(
              err instanceof ApiError ? err.message : "Unable to save property.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <FormSection title="Identity" collapsible={false}>
          <Field label="Name" required error={fieldErrors.name}>
            <Input
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.name}
              value={form.name ?? ""}
              onChange={(e) => {
                clearError("name");
                set("name", e.target.value);
              }}
            />
          </Field>
          <Field label="Reference" error={fieldErrors.reference}>
            <Input
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.reference}
              value={form.reference ?? ""}
              onChange={(e) => set("reference", e.target.value)}
            />
          </Field>
          <Field label="Development">
            <Select
              value={form.developmentId ?? "none"}
              onValueChange={(v) =>
                void applyDevelopment(v === "none" ? null : v)
              }
              disabled={!canEdit || loadingDevelopment}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDevelopment ? "Loading development…" : "Select"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {devs.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" required error={fieldErrors.status}>
            <Select
              value={form.status ?? "draft"}
              onValueChange={(v) => set("status", v as PropertyStatus)}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["draft", "coming_soon", "available", "reserved", "sold", "completed", "archived", "tenanted", "in_build", "vacant"].map((s) => (
                  <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Completion date">
            <DatePicker
              disabled={!canEdit}
              value={form.completionDate}
              onChange={(v) => set("completionDate", v)}
              placeholder="Select completion date"
            />
          </Field>
          <Field label="Occupancy %" error={fieldErrors.occupancy}>
            <Input
              type="number"
              min={0}
              max={100}
              step="any"
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.occupancy}
              value={form.occupancy ?? ""}
              onChange={(e) => {
                clearError("occupancy");
                setForm((f) => ({
                  ...f,
                  occupancy: numberOrUndefined(e.target.value),
                }));
              }}
            />
          </Field>
        </FormSection>

        <FormSection
          title="Location"
          collapsible={false}
          description={
            form.developmentId
              ? "Filled from the selected development. Choose None to clear and enter details manually."
              : "Enter location details manually, or select a development to fill these automatically."
          }
        >
          <Field label="City" required error={fieldErrors.city}>
            <Input
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.city}
              value={form.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
          <Field label="Address" required error={fieldErrors.address}>
            <Input
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.address}
              value={form.address ?? ""}
              onChange={(e) => {
                const address = e.target.value;
                clearError("address");
                setForm((f) => ({ ...f, address, location: address }));
              }}
            />
          </Field>
          <Field label="Postcode" error={fieldErrors.postcode}>
            <Input
              disabled={!canEdit}
              aria-invalid={!!fieldErrors.postcode}
              value={form.postcode ?? ""}
              onChange={(e) => set("postcode", e.target.value)}
            />
          </Field>
          <Field label="Region">
            <SearchableSelect
              disabled={!canEdit || regionsStatus === "loading"}
              value={resolvedRegionValue || undefined}
              onValueChange={(value) => set("region", value)}
              options={regionOptions}
              placeholder={
                regionsStatus === "loading"
                  ? "Loading regions…"
                  : regionsStatus === "failed"
                    ? "Unable to load regions"
                    : "Select region…"
              }
              searchPlaceholder="Search regions…"
              emptyMessage="No matching regions"
            />
          </Field>
        </FormSection>

        <FormSection
          title="Content"
          collapsible={false}
          description={
            form.developmentId
              ? "Copied from the selected development. Development images are shown here when they exist; this property does not upload a separate gallery while a development is selected."
              : "Enter content manually, or select a development to fill these automatically."
          }
        >
          <div className="space-y-2 md:col-span-2">
            <Label>Highlights (comma-separated)</Label>
            <Textarea
              disabled={!canEdit}
              value={highlightsText}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setHighlightsText(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Amenities (comma-separated)</Label>
            <Textarea
              disabled={!canEdit}
              value={amenitiesText}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => setAmenitiesText(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Location information</Label>
            <Textarea
              disabled={!canEdit}
              value={locationInfoText}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const value = e.target.value;
                setLocationInfoText(value);
                set("locationInfo", value);
              }}
            />
          </div>
          <div className="md:col-span-2 space-y-4">
            {(() => {
              const gallery = [
                ...(form.images ?? [])
                  .filter((url) => url && !url.startsWith("blob:"))
                  .map((url) => ({
                    key: `ex-${url}`,
                    url,
                    kind: "existing" as const,
                  })),
                ...contentPendingImages.map((p) => ({
                  key: p.id,
                  url: p.previewUrl,
                  kind: "pending" as const,
                  id: p.id,
                })),
              ];
              if (gallery.length === 0) return null;
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {gallery.map((item) => (
                    <div
                      key={item.key}
                      className="group relative overflow-hidden rounded-xl border border-white/12 bg-white/4"
                    >
                      <PropertyImageThumb
                        src={item.url}
                        alt={form.name || "Property"}
                      />
                      {canEdit && (
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="absolute right-2 top-2 size-8 bg-background/90"
                          aria-label="Remove image"
                          disabled={removingImageKey === item.key}
                          onClick={async () => {
                            if (item.kind === "pending") {
                              setContentPendingImages((prev) => {
                                const target = prev.find((p) => p.id === item.id);
                                if (target) URL.revokeObjectURL(target.previewUrl);
                                return prev.filter((p) => p.id !== item.id);
                              });
                              toast.message("Image removed");
                              return;
                            }

                            const propertyId = form.id ?? params.id;
                            if (!propertyId || isNew) {
                              const next = (form.images ?? []).filter(
                                (u) => u !== item.url,
                              );
                              setForm((f) => ({
                                ...f,
                                images: next,
                                image: next[0] ?? "",
                              }));
                              toast.message("Image removed");
                              return;
                            }

                            setRemovingImageKey(item.key);
                            try {
                              await removePropertyImages(String(propertyId), [
                                item.url,
                              ]);
                              const next = (form.images ?? []).filter(
                                (u) => u !== item.url,
                              );
                              const updated = {
                                ...form,
                                images: next,
                                image: next[0] ?? "",
                              } as PropertyUnit;
                              setForm(updated);
                              setOriginalImages((prev) =>
                                prev.filter((u) => u !== item.url),
                              );
                              if (updated.id) dispatch(upsertProperty(updated));
                              toast.success("Image deleted");
                            } catch (err) {
                              toast.error(
                                err instanceof ApiError
                                  ? err.message
                                  : "Failed to delete image",
                              );
                            } finally {
                              setRemovingImageKey(null);
                            }
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </FormSection>

        <FormSection
          title="Units"
          collapsible={false}
          description="Each unit has specs, images, financials, and payment plans. Activate at least one plan per unit."
          actions={
            canEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={addUnit}>
                Add New
              </Button>
            ) : undefined
          }
        >
          <div className="md:col-span-2 space-y-4">
            {fieldErrors.units ? (
              <p className="text-xs text-error" role="alert">
                {fieldErrors.units}
              </p>
            ) : null}
            {units.map((unit, index) => {
              const unitPrice = unit.purchasePrice ?? 0;
              const gallery = [
                ...unit.images.map((url) => ({
                  key: `ex-${url}`,
                  url,
                  kind: "existing" as const,
                })),
                ...unit.pendingImages.map((p) => ({
                  key: p.id,
                  url: p.previewUrl,
                  kind: "pending" as const,
                  id: p.id,
                })),
              ];

              return (
                <UnitBlock
                  key={unit.id}
                  title={`Unit ${index + 1}`}
                  subtitle={
                    index === 0
                      ? "Primary unit — saved with this property"
                      : "Draft only until multi-unit save is available"
                  }
                  actions={
                    canEdit && units.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUnit(unit.id)}
                      >
                        Remove
                      </Button>
                    ) : undefined
                  }
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="Type"
                      required
                      error={fieldErrors[`unit:${unit.id}:type`]}
                    >
                      <Input
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:type`]}
                        value={unit.propertyType}
                        onChange={(e) =>
                          patchUnit(unit.id, { propertyType: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label="Bedrooms"
                      required
                      error={fieldErrors[`unit:${unit.id}:bedrooms`]}
                    >
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:bedrooms`]}
                        value={unit.bedrooms ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            bedrooms: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Bathrooms"
                      required
                      error={fieldErrors[`unit:${unit.id}:bathrooms`]}
                    >
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:bathrooms`]}
                        value={unit.bathrooms ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            bathrooms: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Size (sqft)"
                      error={fieldErrors[`unit:${unit.id}:sizeSqft`]}
                    >
                      <Input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:sizeSqft`]}
                        value={unit.sizeSqft ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            sizeSqft: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Floor"
                      required
                      error={fieldErrors[`unit:${unit.id}:floor`]}
                    >
                      <Input
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:floor`]}
                        value={unit.floor}
                        onChange={(e) =>
                          patchUnit(unit.id, { floor: e.target.value })
                        }
                      />
                    </Field>
                    <Field
                      label="No. of units"
                      required
                      error={fieldErrors[`unit:${unit.id}:count`]}
                    >
                      <Input
                        type="number"
                        min={1}
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:count`]}
                        value={unit.numberOfUnits ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            numberOfUnits: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Total units"
                      error={fieldErrors[`unit:${unit.id}:totalUnits`]}
                    >
                      <Input
                        type="number"
                        min={0}
                        disabled={!canEdit}
                        aria-invalid={!!fieldErrors[`unit:${unit.id}:totalUnits`]}
                        value={unit.totalUnits ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            totalUnits: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </div>

                  <UnitSubsection
                    title="Images"
                    description="Upload one or more unit images (PNG, JPG, WEBP, GIF — max 5 MB each)."
                  >
                    <div className="md:col-span-2 space-y-4">
                      {gallery.length === 0 ? (
                        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border bg-card/20 text-sm text-muted-foreground">
                          No images selected
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {gallery.map((item) => (
                            <div
                              key={item.key}
                              className="group relative overflow-hidden rounded-xl border border-white/12 bg-white/4"
                            >
                              <PropertyImageThumb
                                src={item.url}
                                alt={`${form.name || "Property"} unit ${index + 1}`}
                              />
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="absolute right-2 top-2 size-8 bg-background/90"
                                  aria-label="Remove image"
                                  disabled={removingImageKey === item.key}
                                  onClick={async () => {
                                    if (item.kind === "pending") {
                                      updateUnit(unit.id, (u) => {
                                        const target = u.pendingImages.find(
                                          (p) => p.id === item.id,
                                        );
                                        if (target) {
                                          URL.revokeObjectURL(target.previewUrl);
                                        }
                                        return {
                                          ...u,
                                          pendingImages: u.pendingImages.filter(
                                            (p) => p.id !== item.id,
                                          ),
                                        };
                                      });
                                      toast.message("Image removed");
                                      return;
                                    }

                                    const propertyId = form.id ?? params.id;
                                    if (!propertyId || isNew) {
                                      const next = unit.images.filter(
                                        (u) => u !== item.url,
                                      );
                                      patchUnit(unit.id, { images: next });
                                      toast.message("Image removed");
                                      return;
                                    }

                                    setRemovingImageKey(item.key);
                                    try {
                                      await removePropertyImages(
                                        String(propertyId),
                                        [item.url],
                                      );
                                      const next = unit.images.filter(
                                        (u) => u !== item.url,
                                      );
                                      patchUnit(unit.id, { images: next });
                                      setOriginalUnitImages((prev) =>
                                        prev.filter((u) => u !== item.url),
                                      );
                                      toast.success("Image deleted");
                                    } catch (err) {
                                      toast.error(
                                        err instanceof ApiError
                                          ? err.message
                                          : "Failed to delete image",
                                      );
                                    } finally {
                                      setRemovingImageKey(null);
                                    }
                                  }}
                                >
                                  <X className="size-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor={`unit-image-upload-${unit.id}`}>
                          Upload images
                        </Label>
                        <Input
                          id={`unit-image-upload-${unit.id}`}
                          type="file"
                          accept={IMAGE_ACCEPT}
                          multiple
                          disabled={!canEdit}
                          onChange={(e) => {
                            const list = Array.from(e.target.files ?? []);
                            e.target.value = "";
                            if (!list.length) return;

                            const accepted: PendingImage[] = [];
                            let rejected = 0;
                            let oversized = 0;

                            for (const file of list) {
                              if (!isAllowedImageFile(file)) {
                                rejected += 1;
                                continue;
                              }
                              if (file.size > MAX_IMAGE_BYTES) {
                                oversized += 1;
                                continue;
                              }
                              accepted.push({
                                id: createClientId(),
                                file,
                                previewUrl: URL.createObjectURL(file),
                              });
                            }

                            if (rejected) {
                              toast.error(
                                "Only image files are allowed (PNG, JPG, WEBP, GIF).",
                              );
                            }
                            if (oversized) {
                              toast.error("Each image must be under 5 MB.");
                            }
                            if (accepted.length) {
                              updateUnit(unit.id, (u) => ({
                                ...u,
                                pendingImages: [
                                  ...u.pendingImages,
                                  ...accepted,
                                ],
                              }));
                              toast.success(
                                accepted.length === 1
                                  ? "Image ready to upload"
                                  : `${accepted.length} images ready to upload`,
                              );
                            }
                          }}
                        />
                      </div>
                    </div>
                  </UnitSubsection>

                  {fieldErrors[`unit:${unit.id}:schedule`] ||
                  fieldErrors[`unit:${unit.id}:mortgage`] ? (
                    <p className="text-xs text-error" role="alert">
                      {fieldErrors[`unit:${unit.id}:schedule`] ||
                        fieldErrors[`unit:${unit.id}:mortgage`]}
                    </p>
                  ) : null}
                  <UnitSubsection title="Financials">
                    <Field
                      label="Purchase price"
                      required
                      error={fieldErrors[`unit:${unit.id}:purchasePrice`]}
                    >
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={unit.purchasePrice ?? ""}
                        onChange={(e) => {
                          const purchasePrice = numberOrUndefined(e.target.value);
                          patchUnit(unit.id, {
                            purchasePrice,
                            ...(shouldMirrorCurrentValue(unit.id)
                              ? { currentValue: purchasePrice }
                              : {}),
                          });
                        }}
                      />
                    </Field>
                    <Field
                      label="Purchase date"
                      required
                      error={fieldErrors[`unit:${unit.id}:purchaseDate`]}
                    >
                      <DatePicker
                        disabled={!canEdit}
                        value={unit.purchaseDate}
                        onChange={(v) =>
                          patchUnit(unit.id, { purchaseDate: v })
                        }
                        placeholder="Select purchase date"
                      />
                    </Field>
                    <Field
                      label="Current value"
                      required
                      error={fieldErrors[`unit:${unit.id}:currentValue`]}
                      labelEnd={
                        <Link
                          href={
                            isNew || !params.id
                              ? "/properties/price-history"
                              : `/properties/price-history?propertyId=${encodeURIComponent(params.id)}`
                          }
                          className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
                        >
                          Price history
                        </Link>
                      }
                    >
                      <Input
                        type="number"
                        disabled
                        readOnly
                        value={unit.currentValue ?? ""}
                      />
                    </Field>
                    <Field
                      label="Rental Income (monthly)"
                      required
                      error={fieldErrors[`unit:${unit.id}:rentalMonthly`]}
                    >
                      <div
                        className={cn(
                          "glass-input flex h-11 w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-input md:h-10",
                          "focus-within:border-ring",
                          fieldErrors[`unit:${unit.id}:rentalMonthly`] &&
                            "border-error",
                          !canEdit && "opacity-50",
                        )}
                      >
                        <div
                          role="group"
                          aria-label="Rental type"
                          className="flex shrink-0 items-center gap-0.5 border-r border-white/10 bg-white/4 p-0.5"
                        >
                          {(
                            [
                              ["current", "Current"],
                              ["expected", "Expected"],
                            ] as const
                          ).map(([value, label]) => {
                            const selected = unit.rentalKind === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                disabled={!canEdit}
                                aria-pressed={selected}
                                className={cn(
                                  "h-full rounded-sm px-2 text-xs transition-colors outline-none",
                                  "focus-visible:ring-2 focus-visible:ring-ring",
                                  "disabled:cursor-not-allowed",
                                  selected
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                )}
                                onClick={() =>
                                  patchUnit(unit.id, { rentalKind: value })
                                }
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="number"
                          disabled={!canEdit}
                          aria-label="Rental Income (monthly)"
                          aria-invalid={
                            !!fieldErrors[`unit:${unit.id}:rentalMonthly`]
                          }
                          className={cn(
                            "h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm",
                            "disabled:cursor-not-allowed",
                            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          )}
                          value={unit.rentalMonthly ?? ""}
                          onChange={(e) =>
                            patchUnit(unit.id, {
                              rentalMonthly: numberOrUndefined(e.target.value),
                            })
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </div>
                    </Field>
                    <Field
                      label="Service charge"
                      error={fieldErrors[`unit:${unit.id}:serviceCharge`]}
                    >
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={unit.serviceCharge ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            serviceCharge: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Ground rent"
                      error={fieldErrors[`unit:${unit.id}:groundRent`]}
                    >
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={unit.groundRent ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            groundRent: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Management fee"
                      error={fieldErrors[`unit:${unit.id}:managementFee`]}
                    >
                      <Input
                        type="number"
                        disabled={!canEdit}
                        value={unit.managementFee ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            managementFee: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Gross yield %"
                      error={fieldErrors[`unit:${unit.id}:grossYield`]}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!canEdit}
                        value={unit.projectedGrossYield ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            projectedGrossYield: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Capital growth %"
                      required
                      error={fieldErrors[`unit:${unit.id}:capitalGrowth`]}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!canEdit}
                        value={unit.projectedCapitalGrowth ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            projectedCapitalGrowth: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                    <Field
                      label="Annual rental growth %"
                      required
                      error={fieldErrors[`unit:${unit.id}:annualRentalGrowth`]}
                    >
                      <Input
                        type="number"
                        step="0.1"
                        disabled={!canEdit}
                        value={unit.annualRentalGrowth ?? ""}
                        onChange={(e) =>
                          patchUnit(unit.id, {
                            annualRentalGrowth: numberOrUndefined(e.target.value),
                          })
                        }
                      />
                    </Field>
                  </UnitSubsection>

                  <UnitSubsection
                    title="Payment plans"
                    description="At least one plan must stay active. Inactive plans are saved as null and hidden when assigning investors."
                  >
                    <div className="md:col-span-2 space-y-4">
                      {fieldErrors[`unit:${unit.id}:plans`] ? (
                        <p className="text-xs text-error" role="alert">
                          {fieldErrors[`unit:${unit.id}:plans`]}
                        </p>
                      ) : null}

                      {unit.plans.map((plan) => {
                        const planActive = plan.active !== false;
                        const activePlanCount = unit.plans.filter(
                          (p) => p.active !== false,
                        ).length;
                        const isSoleActive = planActive && activePlanCount <= 1;
                        const planFieldsDisabled = !canEdit || !planActive;

                        return (
                        <div
                          key={plan.id}
                          className={cn(
                            "space-y-4 rounded-md border border-border bg-background/50 p-4",
                            !planActive && "opacity-70",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {plan.kind === "mortgage"
                                  ? "Mortgage plan"
                                  : "Payment schedule"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {plan.kind === "mortgage"
                                  ? "Rate, deposit, reservation fee, monthly payment, and loan terms."
                                  : "Custom developer staged cash plan (Payment Stage · Amount · Due · Date)."}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Label
                                htmlFor={`plan-active-${plan.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                {planActive ? "Active" : "Inactive"}
                              </Label>
                              <Switch
                                id={`plan-active-${plan.id}`}
                                checked={planActive}
                                disabled={!canEdit}
                                title={
                                  isSoleActive
                                    ? "At least one plan must stay active"
                                    : undefined
                                }
                                onCheckedChange={(checked) => {
                                  if (!checked && isSoleActive) {
                                    toast.error(
                                      "At least one payment plan must stay active.",
                                    );
                                    return;
                                  }
                                  updateUnitPlan(unit.id, plan.id, {
                                    active: checked,
                                    ...(plan.kind === "payment_schedule"
                                      ? { closed: !checked }
                                      : {}),
                                  });
                                }}
                              />
                            </div>
                          </div>

                          {plan.kind === "mortgage" ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <Field
                                label="Plan name"
                                required
                                error={fieldErrors[`plan:${plan.id}:name`]}
                              >
                                <Input
                                  disabled={planFieldsDisabled}
                                  value={plan.name}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </Field>
                              <Field label="Type">
                                <div
                                  role="group"
                                  aria-label="Mortgage type"
                                  className="grid grid-cols-2 gap-1 rounded-md border border-border bg-input/20 p-1"
                                >
                                  {(
                                    [
                                      ["repayment", "Repayment"],
                                      ["interest_only", "Interest only"],
                                    ] as const
                                  ).map(([value, label]) => {
                                    const selected = plan.type === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        disabled={planFieldsDisabled}
                                        aria-pressed={selected}
                                        className={cn(
                                          "h-8 rounded-sm px-2 text-sm transition-colors outline-none",
                                          "focus-visible:ring-2 focus-visible:ring-ring",
                                          "disabled:cursor-not-allowed disabled:opacity-50",
                                          selected
                                            ? "bg-primary text-primary-foreground font-medium"
                                            : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                                        )}
                                        onClick={() =>
                                          updateUnitPlan(unit.id, plan.id, {
                                            type: value,
                                          })
                                        }
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </Field>
                              <Field
                                label="Deposit (GBP)"
                                error={fieldErrors[`plan:${plan.id}:deposit`]}
                              >
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={planFieldsDisabled}
                                  value={plan.deposit ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      deposit: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="Reservation fee (GBP)"
                                error={fieldErrors[`plan:${plan.id}:reservationFee`]}
                              >
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={planFieldsDisabled}
                                  value={plan.reservationFee ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      reservationFee: numberOrUndefined(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="Loan amount (GBP)"
                                required
                                error={fieldErrors[`plan:${plan.id}:loan`]}
                              >
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={planFieldsDisabled}
                                  value={plan.loanAmount ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      loanAmount: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="Interest rate %"
                                required
                                error={fieldErrors[`plan:${plan.id}:rate`]}
                              >
                                <Input
                                  type="number"
                                  step="0.01"
                                  disabled={planFieldsDisabled}
                                  value={plan.ratePct ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      ratePct: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="Monthly payment (GBP)"
                                required
                                error={fieldErrors[`plan:${plan.id}:monthly`]}
                              >
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={planFieldsDisabled}
                                  value={plan.monthlyPayment ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      monthlyPayment: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="Term (years)"
                                required
                                error={fieldErrors[`plan:${plan.id}:term`]}
                              >
                                <Input
                                  type="number"
                                  disabled={planFieldsDisabled}
                                  value={plan.termYears ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      termYears: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field
                                label="LTV %"
                                error={fieldErrors[`plan:${plan.id}:ltv`]}
                              >
                                <Input
                                  type="number"
                                  step="0.1"
                                  disabled={planFieldsDisabled}
                                  value={plan.ltvPct ?? ""}
                                  onChange={(e) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      ltvPct: numberOrUndefined(e.target.value),
                                    })
                                  }
                                />
                              </Field>
                              <Field label="Mortgage date">
                                <DatePicker
                                  disabled={planFieldsDisabled}
                                  value={plan.mortgageDate}
                                  onChange={(v) =>
                                    updateUnitPlan(unit.id, plan.id, {
                                      mortgageDate: v,
                                    })
                                  }
                                  placeholder="Select mortgage date"
                                />
                              </Field>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field
                                label="Plan name"
                                required
                                error={fieldErrors[`plan:${plan.id}:name`]}
                              >
                                  <Input
                                    disabled={planFieldsDisabled}
                                    value={plan.name}
                                    onChange={(e) =>
                                      updateUnitPlan(unit.id, plan.id, {
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field label="Payment plan summary">
                                  <Input
                                    disabled={planFieldsDisabled}
                                    value={plan.summary}
                                    onChange={(e) =>
                                      updateUnitPlan(unit.id, plan.id, {
                                        summary: e.target.value,
                                      })
                                    }
                                    placeholder="e.g. 20% deposit · 80% on completion"
                                  />
                                </Field>
                              </div>

                              <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <Label>Payment Schedule</Label>
                                      {fieldErrors[`plan:${plan.id}:stages`] ? (
                                        <p className="text-xs text-error" role="alert">
                                          {fieldErrors[`plan:${plan.id}:stages`]}
                                        </p>
                                      ) : null}
                                    </div>
                                    {canEdit && planActive && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          updateUnitPlan(unit.id, plan.id, {
                                            stages: [
                                              ...plan.stages,
                                              emptyScheduleStage(),
                                            ],
                                          })
                                        }
                                      >
                                        Add stage
                                      </Button>
                                    )}
                                  </div>

                                  <div className="overflow-hidden rounded-md border border-border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-primary/15 hover:bg-primary/15">
                                          <TableHead>Payment Stage</TableHead>
                                          <TableHead className="text-right">
                                            Amount (£) *
                                          </TableHead>
                                          <TableHead>Due</TableHead>
                                          <TableHead>Date</TableHead>
                                          {canEdit && planActive ? (
                                            <TableHead className="w-20" />
                                          ) : null}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {plan.stages.length === 0 ? (
                                          <TableRow>
                                            <TableCell
                                              colSpan={
                                                canEdit && planActive ? 5 : 4
                                              }
                                              className="text-muted-foreground"
                                            >
                                              No stages yet. Add a stage for your custom plan.
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          plan.stages.map((stage, stageIndex) => (
                                            <TableRow
                                              key={stage.id}
                                              className={
                                                stageIndex % 2 === 1
                                                  ? "bg-muted/20"
                                                  : undefined
                                              }
                                            >
                                              <TableCell>
                                                <Input
                                                  disabled={planFieldsDisabled}
                                                  aria-invalid={
                                                    !!fieldErrors[
                                                      `stage:${stage.id}:label`
                                                    ]
                                                  }
                                                  value={stage.label}
                                                  placeholder="e.g. Reservation Fee"
                                                  onChange={(e) =>
                                                    updateUnitPlan(
                                                      unit.id,
                                                      plan.id,
                                                      {
                                                        stages: plan.stages.map(
                                                          (s) =>
                                                            s.id === stage.id
                                                              ? {
                                                                  ...s,
                                                                  label:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              : s,
                                                        ),
                                                      },
                                                    )
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Input
                                                  type="number"
                                                  step="any"
                                                  min={0.01}
                                                  className="text-right tabular-nums"
                                                  disabled={planFieldsDisabled}
                                                  aria-invalid={
                                                    !!fieldErrors[
                                                      `stage:${stage.id}:amount`
                                                    ]
                                                  }
                                                  value={stage.amount ?? ""}
                                                  onChange={(e) =>
                                                    updateUnitPlan(
                                                      unit.id,
                                                      plan.id,
                                                      {
                                                        stages: plan.stages.map(
                                                          (s) =>
                                                            s.id === stage.id
                                                              ? {
                                                                  ...s,
                                                                  amount:
                                                                    numberOrUndefined(
                                                                      e.target.value,
                                                                    ) as number,
                                                                }
                                                              : s,
                                                        ),
                                                      },
                                                    )
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Input
                                                  disabled={planFieldsDisabled}
                                                  aria-invalid={
                                                    !!fieldErrors[
                                                      `stage:${stage.id}:due`
                                                    ]
                                                  }
                                                  value={stage.dueDate}
                                                  placeholder="Now / On exchange / On completion"
                                                  onChange={(e) =>
                                                    updateUnitPlan(
                                                      unit.id,
                                                      plan.id,
                                                      {
                                                        stages: plan.stages.map(
                                                          (s) =>
                                                            s.id === stage.id
                                                              ? {
                                                                  ...s,
                                                                  dueDate:
                                                                    e.target
                                                                      .value,
                                                                }
                                                              : s,
                                                        ),
                                                      },
                                                    )
                                                  }
                                                />
                                              </TableCell>
                                              <TableCell className="min-w-[10rem]">
                                                <DatePicker
                                                  disabled={planFieldsDisabled}
                                                  value={stage.date}
                                                  onChange={(v) =>
                                                    updateUnitPlan(
                                                      unit.id,
                                                      plan.id,
                                                      {
                                                        stages: plan.stages.map(
                                                          (s) =>
                                                            s.id === stage.id
                                                              ? {
                                                                  ...s,
                                                                  date: v,
                                                                }
                                                              : s,
                                                        ),
                                                      },
                                                    )
                                                  }
                                                  placeholder="Select date"
                                                />
                                              </TableCell>
                                              {canEdit && planActive ? (
                                                <TableCell className="text-right">
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      updateUnitPlan(
                                                        unit.id,
                                                        plan.id,
                                                        {
                                                          stages:
                                                            plan.stages.filter(
                                                              (s) =>
                                                                s.id !==
                                                                stage.id,
                                                            ),
                                                        },
                                                      )
                                                    }
                                                  >
                                                    Remove
                                                  </Button>
                                                </TableCell>
                                              ) : null}
                                            </TableRow>
                                          ))
                                        )}
                                      </TableBody>
                                      <TableFooter>
                                        <TableRow>
                                          <TableCell className="font-medium">
                                            Total Cash Required
                                          </TableCell>
                                          <TableCell className="text-right font-medium tabular-nums">
                                            {formatCurrency(
                                              plan.stages.reduce(
                                                (sum, s) =>
                                                  sum + (Number(s.amount) || 0),
                                                0,
                                              ),
                                            )}
                                          </TableCell>
                                          <TableCell />
                                          <TableCell />
                                          {canEdit && planActive ? (
                                            <TableCell />
                                          ) : null}
                                        </TableRow>
                                      </TableFooter>
                                    </Table>
                                  </div>
                                  {unitPrice > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Amounts are cash figures for this unit
                                      (purchase price{" "}
                                      {formatCurrency(unitPrice)}). On save,
                                      stages map to the marketplace plan using
                                      percent of purchase price.
                                    </p>
                                  )}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </UnitSubsection>
                </UnitBlock>
              );
            })}
          </div>
        </FormSection>

        <FormSection title="Visibility" collapsible={false}>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              checked={!!form.visibleInExplore}
              disabled={!canEdit}
              onCheckedChange={(v) => set("visibleInExplore", v)}
              id="visible"
            />
            <Label htmlFor="visible">Visible in Explore</Label>
          </div>
        </FormSection>

        {canEdit && (
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save property"}</Button>
            <Button type="button" variant="outline" onClick={() => setLocation("/properties")}>Cancel</Button>
          </div>
        )}
      </form>
    </div>
  );
}
