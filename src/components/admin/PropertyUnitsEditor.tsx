import { type ReactNode } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/admin/FormField";
import { FormSection } from "@/components/admin/FormSection";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import { cn } from "@/lib/utils";

type UnitScheduleStage = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
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

export type AssumptionUnitDraft = {
  id: string;
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
  costInflation: number;
  serviceCharge: number;
  groundRent: number;
  managementFee: number;
  projectedGrossYield: number;
  projectedNetYield: number;
  projectedCapitalGrowth: number;
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

function defaultUnitPlans(): UnitPlan[] {
  return [emptyPaymentSchedulePlan(), emptyMortgagePlan()];
}

export function emptyAssumptionUnitDraft(): AssumptionUnitDraft {
  return {
    id: createClientId(),
    propertyType: "1-bed",
    bedrooms: 1,
    bathrooms: 1,
    sizeSqft: 0,
    floor: "",
    numberOfUnits: 1,
    totalUnits: 0,
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

export function unitToInsightPutBody(unit: AssumptionUnitDraft): Record<string, unknown> {
  const schedule = unit.plans.find((p) => p.kind === "payment_schedule");
  const mortgage = unit.plans.find((p) => p.kind === "mortgage");
  return {
    unitIndex: 0,
    type: unit.propertyType,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    sizeSqft: unit.sizeSqft,
    floor: unit.floor,
    numberOfUnits: unit.numberOfUnits,
    totalUnits: unit.totalUnits,
    purchasePrice: unit.purchasePrice,
    currentValue: unit.currentValue,
    rentalEstimate: unit.rentalMonthly,
    rentalIncomeMode: unit.rentalKind,
    purchaseDate: unit.purchaseDate || undefined,
    serviceCharge: unit.serviceCharge,
    groundRent: unit.groundRent,
    managementFee: unit.managementFee,
    grossYield: unit.projectedGrossYield,
    capitalGrowth: unit.projectedCapitalGrowth,
    annualRentalGrowth: unit.annualRentalGrowth,
    paymentPlanActive: schedule ? schedule.active !== false : false,
    paymentPlanName: schedule?.name ?? "Developer payment schedule",
    paymentPlanSummary:
      schedule && schedule.kind === "payment_schedule" ? schedule.summary : "",
    mortgagePlanActive: mortgage ? mortgage.active !== false : false,
    mortgagePlanName: mortgage?.name ?? "Mortgage plan",
    mortgageType:
      mortgage && mortgage.kind === "mortgage" ? mortgage.type : "repayment",
    interestRate:
      mortgage && mortgage.kind === "mortgage" ? mortgage.ratePct : 0,
    termYears:
      mortgage && mortgage.kind === "mortgage" ? mortgage.termYears : 25,
    deposit: mortgage && mortgage.kind === "mortgage" ? mortgage.deposit : 0,
    reservationFee:
      mortgage && mortgage.kind === "mortgage" ? mortgage.reservationFee : 0,
    loanAmount:
      mortgage && mortgage.kind === "mortgage" ? mortgage.loanAmount : 0,
    monthlyPayment:
      mortgage && mortgage.kind === "mortgage" ? mortgage.monthlyPayment : 0,
    ltvPct: mortgage && mortgage.kind === "mortgage" ? mortgage.ltvPct : 0,
  };
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <FormField label={label} required={required} error={error}>
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
  children: ReactNode;
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

export function PropertyUnitsEditor({
  unit,
  onUnitChange,
  canEdit,
}: {
  unit: AssumptionUnitDraft;
  onUnitChange: (unit: AssumptionUnitDraft) => void;
  canEdit: boolean;
}) {
  const patchUnit = (patch: Partial<AssumptionUnitDraft>) => {
    onUnitChange({ ...unit, ...patch });
  };

  const updateUnit = (
    updater: (current: AssumptionUnitDraft) => AssumptionUnitDraft,
  ) => {
    onUnitChange(updater(unit));
  };

  const updateUnitPlan = (
    planId: string,
    patch: Partial<UnitMortgagePlan> | Partial<UnitPaymentSchedulePlan>,
  ) => {
    updateUnit((current) => ({
      ...current,
      plans: current.plans.map((plan) =>
        plan.id === planId ? ({ ...plan, ...patch } as UnitPlan) : plan,
      ),
    }));
  };

  const unitPrice = unit.purchasePrice ?? 0;

  return (
    <FormSection
      title="Unit"
      collapsible={false}
      description="Specs, financials, and payment plans. Activate at least one plan."
    >
      <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Type" required>
                  <Input
                    disabled={!canEdit}
                    value={unit.propertyType}
                    onChange={(e) =>
                      patchUnit({ propertyType: e.target.value })
                    }
                  />
                </Field>
                <Field label="Bedrooms" required>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    disabled={!canEdit}
                    value={unit.bedrooms ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        bedrooms: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Bathrooms" required>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    disabled={!canEdit}
                    value={unit.bathrooms ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        bathrooms: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Size (sqft)">
                  <Input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={unit.sizeSqft ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        sizeSqft: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Floor" required>
                  <Input
                    disabled={!canEdit}
                    value={unit.floor}
                    onChange={(e) =>
                      patchUnit({ floor: e.target.value })
                    }
                  />
                </Field>
                <Field label="No. of units" required>
                  <Input
                    type="number"
                    min={1}
                    disabled={!canEdit}
                    value={unit.numberOfUnits ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        numberOfUnits: numberOrUndefined(e.target.value) ?? 1,
                      })
                    }
                  />
                </Field>
                <Field label="Total units">
                  <Input
                    type="number"
                    min={0}
                    disabled={!canEdit}
                    value={unit.totalUnits ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        totalUnits: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
              </div>

              <UnitSubsection title="Financials">
                <Field label="Purchase price" required>
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={unit.purchasePrice ?? ""}
                    onChange={(e) => {
                      const purchasePrice =
                        numberOrUndefined(e.target.value) ?? 0;
                      patchUnit({
                        purchasePrice,
                        currentValue: purchasePrice,
                      });
                    }}
                  />
                </Field>
                <Field label="Purchase date">
                  <DatePicker
                    disabled={!canEdit}
                    value={unit.purchaseDate}
                    onChange={(v) => patchUnit({ purchaseDate: v })}
                    placeholder="Select purchase date"
                  />
                </Field>
                <Field label="Current value">
                  <Input
                    type="number"
                    disabled
                    readOnly
                    value={unit.currentValue ?? ""}
                  />
                </Field>
                <Field label="Rental Income (monthly)">
                  <div
                    className={cn(
                      "flex h-10 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs md:h-9",
                      "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                      !canEdit && "opacity-50",
                    )}
                  >
                    <div
                      role="group"
                      aria-label="Rental type"
                      className="flex shrink-0 items-center gap-0.5 border-r border-border bg-muted/30 p-0.5"
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
                              patchUnit({ rentalKind: value })
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
                      className={cn(
                        "h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none md:text-sm",
                        "disabled:cursor-not-allowed",
                        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                      )}
                      value={unit.rentalMonthly ?? ""}
                      onChange={(e) =>
                        patchUnit({
                          rentalMonthly: numberOrUndefined(e.target.value) ?? 0,
                        })
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </div>
                </Field>
                <Field label="Service charge">
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={unit.serviceCharge ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        serviceCharge: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Ground rent">
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={unit.groundRent ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        groundRent: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Management fee">
                  <Input
                    type="number"
                    disabled={!canEdit}
                    value={unit.managementFee ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        managementFee: numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Gross yield %">
                  <Input
                    type="number"
                    step="0.1"
                    disabled={!canEdit}
                    value={unit.projectedGrossYield ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        projectedGrossYield:
                          numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Capital growth %">
                  <Input
                    type="number"
                    step="0.1"
                    disabled={!canEdit}
                    value={unit.projectedCapitalGrowth ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        projectedCapitalGrowth:
                          numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
                <Field label="Annual rental growth %">
                  <Input
                    type="number"
                    step="0.1"
                    disabled={!canEdit}
                    value={unit.annualRentalGrowth ?? ""}
                    onChange={(e) =>
                      patchUnit({
                        annualRentalGrowth:
                          numberOrUndefined(e.target.value) ?? 0,
                      })
                    }
                  />
                </Field>
              </UnitSubsection>

              <UnitSubsection
                title="Payment plans"
                description="At least one plan must stay active. Inactive plans are hidden when assigning investors."
              >
                <div className="md:col-span-2 space-y-4">
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
                          <div className="flex shrink-0 items-center gap-2">
                            <Label
                              htmlFor={`assumption-plan-active-${plan.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              {planActive ? "Active" : "Inactive"}
                            </Label>
                            <Switch
                              id={`assumption-plan-active-${plan.id}`}
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
                                updateUnitPlan(plan.id, {
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
                            <Field label="Plan name" required>
                              <Input
                                disabled={planFieldsDisabled}
                                value={plan.name}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
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
                                        updateUnitPlan(plan.id, {
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
                            <Field label="Deposit (GBP)">
                              <Input
                                type="number"
                                step="any"
                                disabled={planFieldsDisabled}
                                value={plan.deposit ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    deposit: numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Reservation fee (GBP)">
                              <Input
                                type="number"
                                step="any"
                                disabled={planFieldsDisabled}
                                value={plan.reservationFee ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    reservationFee:
                                      numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Loan amount (GBP)">
                              <Input
                                type="number"
                                step="any"
                                disabled={planFieldsDisabled}
                                value={plan.loanAmount ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    loanAmount:
                                      numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Interest rate %">
                              <Input
                                type="number"
                                step="0.01"
                                disabled={planFieldsDisabled}
                                value={plan.ratePct ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    ratePct: numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Monthly payment (GBP)">
                              <Input
                                type="number"
                                step="any"
                                disabled={planFieldsDisabled}
                                value={plan.monthlyPayment ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    monthlyPayment:
                                      numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Term (years)">
                              <Input
                                type="number"
                                disabled={planFieldsDisabled}
                                value={plan.termYears ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    termYears:
                                      numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="LTV %">
                              <Input
                                type="number"
                                step="0.1"
                                disabled={planFieldsDisabled}
                                value={plan.ltvPct ?? ""}
                                onChange={(e) =>
                                  updateUnitPlan(plan.id, {
                                    ltvPct: numberOrUndefined(e.target.value) ?? 0,
                                  })
                                }
                              />
                            </Field>
                            <Field label="Mortgage date">
                              <DatePicker
                                disabled={planFieldsDisabled}
                                value={plan.mortgageDate}
                                onChange={(v) =>
                                  updateUnitPlan(plan.id, {
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
                              <Field label="Plan name" required>
                                <Input
                                  disabled={planFieldsDisabled}
                                  value={plan.name}
                                  onChange={(e) =>
                                    updateUnitPlan(plan.id, {
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
                                    updateUnitPlan(plan.id, {
                                      summary: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. 20% deposit · 80% on completion"
                                />
                              </Field>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Payment Schedule</Label>
                                {canEdit && planActive && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      updateUnitPlan(plan.id, {
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
                                        Amount (£)
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
                                          colSpan={canEdit && planActive ? 5 : 4}
                                          className="text-muted-foreground"
                                        >
                                          No stages yet. Add a stage for your
                                          custom plan.
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
                                              value={stage.label}
                                              placeholder="e.g. Reservation Fee"
                                              onChange={(e) =>
                                                updateUnitPlan(plan.id, {
                                                  stages: plan.stages.map((s) =>
                                                    s.id === stage.id
                                                      ? {
                                                          ...s,
                                                          label: e.target.value,
                                                        }
                                                      : s,
                                                  ),
                                                })
                                              }
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              step="any"
                                              min={0}
                                              className="text-right tabular-nums"
                                              disabled={planFieldsDisabled}
                                              value={stage.amount ?? ""}
                                              onChange={(e) =>
                                                updateUnitPlan(plan.id, {
                                                  stages: plan.stages.map((s) =>
                                                    s.id === stage.id
                                                      ? {
                                                          ...s,
                                                          amount:
                                                            numberOrUndefined(
                                                              e.target.value,
                                                            ) ?? 0,
                                                        }
                                                      : s,
                                                  ),
                                                })
                                              }
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              disabled={planFieldsDisabled}
                                              value={stage.dueDate}
                                              placeholder="Now / On exchange / On completion"
                                              onChange={(e) =>
                                                updateUnitPlan(plan.id, {
                                                  stages: plan.stages.map((s) =>
                                                    s.id === stage.id
                                                      ? {
                                                          ...s,
                                                          dueDate: e.target.value,
                                                        }
                                                      : s,
                                                  ),
                                                })
                                              }
                                            />
                                          </TableCell>
                                          <TableCell className="min-w-[10rem]">
                                            <DatePicker
                                              disabled={planFieldsDisabled}
                                              value={stage.date}
                                              onChange={(v) =>
                                                updateUnitPlan(plan.id, {
                                                  stages: plan.stages.map((s) =>
                                                    s.id === stage.id
                                                      ? { ...s, date: v }
                                                      : s,
                                                  ),
                                                })
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
                                                  updateUnitPlan(plan.id, {
                                                    stages: plan.stages.filter(
                                                      (s) => s.id !== stage.id,
                                                    ),
                                                  })
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
                                  (purchase price {formatCurrency(unitPrice)}).
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
      </div>
    </FormSection>
  );
}
