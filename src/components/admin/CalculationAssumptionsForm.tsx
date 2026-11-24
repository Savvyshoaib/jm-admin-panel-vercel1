import type { CalculatorDefaultsPayload } from "@/services/assumptionsApi";
import { FormField } from "@/components/admin/FormField";
import { FormSection } from "@/components/admin/FormSection";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CalculationAssumptions = {
  mortgageRateUk: number;
  mortgageRateNonUk: number;
  rentalGrowth: number;
  capitalGrowth: number;
  rentalYield: number;
  managementFeePctOfRent: number;
  serviceChargePctOfValue: number;
  mortgageTermYears: number;
  incomeMultiple: number;
  sdltUkPct: number;
  sdltNonUkPct: number;
  feesPct: number;
  ltvByRisk: { low: number; medium: number; high: number };
  ltvOptions: number[];
  horizonYears: number[];
  labels: {
    ltv: string;
    horizon: string;
    fees: string;
  };
};

export const LTV_CHIP_OPTIONS = [50, 55, 60, 65, 70, 75];
export const HORIZON_CHIP_OPTIONS = [5, 10, 15];

export function emptyCalculationAssumptions(): CalculationAssumptions {
  return {
    mortgageRateUk: 5.25,
    mortgageRateNonUk: 6.25,
    rentalGrowth: 3,
    capitalGrowth: 4,
    rentalYield: 5,
    managementFeePctOfRent: 10,
    serviceChargePctOfValue: 0.5,
    mortgageTermYears: 25,
    incomeMultiple: 4.5,
    sdltUkPct: 3,
    sdltNonUkPct: 5,
    feesPct: 1.5,
    ltvByRisk: { low: 55, medium: 65, high: 75 },
    ltvOptions: [...LTV_CHIP_OPTIONS],
    horizonYears: [...HORIZON_CHIP_OPTIONS],
    labels: {
      ltv: "LTV",
      horizon: "Horizon",
      fees: "Fees",
    },
  };
}

export function calculatorFromApi(
  payload: CalculatorDefaultsPayload,
): CalculationAssumptions {
  return {
    mortgageRateUk: payload.mortgageRateUk,
    mortgageRateNonUk: payload.mortgageRateNonUk,
    rentalGrowth: payload.rentalGrowth,
    capitalGrowth: payload.capitalGrowth,
    rentalYield: payload.rentalYield,
    managementFeePctOfRent: payload.managementFeePctOfRent,
    serviceChargePctOfValue: payload.serviceChargePctOfValue,
    mortgageTermYears: payload.mortgageTermYears,
    incomeMultiple: payload.incomeMultiple,
    sdltUkPct: payload.sdltUkPct,
    sdltNonUkPct: payload.sdltNonUkPct,
    feesPct: payload.feesPct,
    ltvByRisk: {
      low: payload.ltvByRiskLow,
      medium: payload.ltvByRiskMedium,
      high: payload.ltvByRiskHigh,
    },
    ltvOptions: payload.ltvOptions.length
      ? payload.ltvOptions
      : [...LTV_CHIP_OPTIONS],
    horizonYears: payload.horizonYears.length
      ? payload.horizonYears
      : [...HORIZON_CHIP_OPTIONS],
    labels: {
      ltv: payload.ltvLabel || "LTV",
      horizon: payload.horizonLabel || "Horizon",
      fees: payload.feesLabel || "Fees",
    },
  };
}

export function calculatorToApi(
  value: CalculationAssumptions,
): CalculatorDefaultsPayload {
  return {
    mortgageRateUk: value.mortgageRateUk,
    mortgageRateNonUk: value.mortgageRateNonUk,
    rentalGrowth: value.rentalGrowth,
    capitalGrowth: value.capitalGrowth,
    rentalYield: value.rentalYield,
    managementFeePctOfRent: value.managementFeePctOfRent,
    serviceChargePctOfValue: value.serviceChargePctOfValue,
    mortgageTermYears: value.mortgageTermYears,
    incomeMultiple: value.incomeMultiple,
    feesPct: value.feesPct,
    sdltUkPct: value.sdltUkPct,
    sdltNonUkPct: value.sdltNonUkPct,
    ltvByRiskLow: value.ltvByRisk.low,
    ltvByRiskMedium: value.ltvByRisk.medium,
    ltvByRiskHigh: value.ltvByRisk.high,
    ltvOptions: value.ltvOptions,
    horizonYears: value.horizonYears,
    ltvLabel: value.labels.ltv,
    horizonLabel: value.labels.horizon,
    feesLabel: value.labels.fees,
  };
}

function numberOrZero(value: string): number {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <FormField label={label} hint={hint}>
      {children}
    </FormField>
  );
}

function ChipToggle({
  options,
  value,
  onChange,
  suffix,
  disabled,
}: {
  options: number[];
  value: number[];
  onChange: (next: number[]) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {options.map((n) => {
        const selected = value.includes(n);
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "h-8 min-w-10 rounded-sm px-2.5 text-sm tabular-nums transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-primary text-primary-foreground font-medium"
                : "border border-border bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
            onClick={() => {
              onChange(
                selected
                  ? value.filter((v) => v !== n)
                  : [...value, n].sort((a, b) => a - b),
              );
            }}
          >
            {n}
            {suffix ?? ""}
          </button>
        );
      })}
    </div>
  );
}

export function CalculationAssumptionsForm({
  value,
  onChange,
  canEdit,
}: {
  value: CalculationAssumptions;
  onChange: (next: CalculationAssumptions) => void;
  canEdit: boolean;
}) {
  const patch = (partial: Partial<CalculationAssumptions>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <div className="space-y-4">
      <FormSection
        title="Rates & growth"
        description="Default percentages used when a property unit does not supply its own figures."
      >
        <Field label="UK resident mortgage rate %" hint="mortgageRateUk">
          <Input
            type="number"
            step="0.01"
            disabled={!canEdit}
            value={value.mortgageRateUk}
            onChange={(e) =>
              patch({ mortgageRateUk: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Non-UK mortgage rate %" hint="mortgageRateNonUk">
          <Input
            type="number"
            step="0.01"
            disabled={!canEdit}
            value={value.mortgageRateNonUk}
            onChange={(e) =>
              patch({ mortgageRateNonUk: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Annual rental growth %" hint="rentalGrowth">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.rentalGrowth}
            onChange={(e) =>
              patch({ rentalGrowth: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Annual capital growth %" hint="capitalGrowth">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.capitalGrowth}
            onChange={(e) =>
              patch({ capitalGrowth: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field
          label="Gross yield %"
          hint="rentalYield — used when rent is missing"
        >
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.rentalYield}
            onChange={(e) =>
              patch({ rentalYield: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Management fee % of rent" hint="managementFeePctOfRent">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.managementFeePctOfRent}
            onChange={(e) =>
              patch({ managementFeePctOfRent: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field
          label="Service charge % of value / year"
          hint="serviceChargePctOfValue"
        >
          <Input
            type="number"
            step="0.01"
            disabled={!canEdit}
            value={value.serviceChargePctOfValue}
            onChange={(e) =>
              patch({ serviceChargePctOfValue: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Mortgage term (years)" hint="mortgageTermYears">
          <Input
            type="number"
            min={1}
            disabled={!canEdit}
            value={value.mortgageTermYears}
            onChange={(e) =>
              patch({ mortgageTermYears: numberOrZero(e.target.value) })
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="Affordability & purchase costs"
        description="Indicative multiples, SDLT, and fees for calculator outputs."
      >
        <Field label="Income multiple" hint="incomeMultiple">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.incomeMultiple}
            onChange={(e) =>
              patch({ incomeMultiple: numberOrZero(e.target.value) })
            }
          />
        </Field>
        <Field label="Indicative fees %" hint="feesPct">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.feesPct}
            onChange={(e) => patch({ feesPct: numberOrZero(e.target.value) })}
          />
        </Field>
        <Field label="SDLT UK %" hint="sdltUkPct">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.sdltUkPct}
            onChange={(e) => patch({ sdltUkPct: numberOrZero(e.target.value) })}
          />
        </Field>
        <Field label="SDLT non-UK %" hint="sdltNonUkPct">
          <Input
            type="number"
            step="0.1"
            disabled={!canEdit}
            value={value.sdltNonUkPct}
            onChange={(e) =>
              patch({ sdltNonUkPct: numberOrZero(e.target.value) })
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="LTV by risk"
        description="Default loan-to-value % for low, medium, and high risk appetite."
      >
        <Field label="Low %" hint="ltvByRisk.low">
          <Input
            type="number"
            disabled={!canEdit}
            value={value.ltvByRisk.low}
            onChange={(e) =>
              patch({
                ltvByRisk: {
                  ...value.ltvByRisk,
                  low: numberOrZero(e.target.value),
                },
              })
            }
          />
        </Field>
        <Field label="Medium %" hint="ltvByRisk.medium">
          <Input
            type="number"
            disabled={!canEdit}
            value={value.ltvByRisk.medium}
            onChange={(e) =>
              patch({
                ltvByRisk: {
                  ...value.ltvByRisk,
                  medium: numberOrZero(e.target.value),
                },
              })
            }
          />
        </Field>
        <Field label="High %" hint="ltvByRisk.high">
          <Input
            type="number"
            disabled={!canEdit}
            value={value.ltvByRisk.high}
            onChange={(e) =>
              patch({
                ltvByRisk: {
                  ...value.ltvByRisk,
                  high: numberOrZero(e.target.value),
                },
              })
            }
          />
        </Field>
      </FormSection>

      <FormSection
        title="Calculator chips"
        description="Values offered in the investor calculator UI."
      >
        <div className="md:col-span-2 space-y-2">
          <Field label="LTV options" hint="ltvOptions">
            <ChipToggle
              options={LTV_CHIP_OPTIONS}
              value={value.ltvOptions}
              disabled={!canEdit}
              suffix="%"
              onChange={(ltvOptions) => patch({ ltvOptions })}
            />
          </Field>
        </div>
        <div className="md:col-span-2 space-y-2">
          <Field label="Horizon years" hint="horizonYears">
            <ChipToggle
              options={HORIZON_CHIP_OPTIONS}
              value={value.horizonYears}
              disabled={!canEdit}
              onChange={(horizonYears) => patch({ horizonYears })}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Labels"
        description="Display strings for the assumptions UI."
      >
        <Field label="LTV label">
          <Input
            disabled={!canEdit}
            value={value.labels.ltv}
            onChange={(e) =>
              patch({ labels: { ...value.labels, ltv: e.target.value } })
            }
          />
        </Field>
        <Field label="Horizon label">
          <Input
            disabled={!canEdit}
            value={value.labels.horizon}
            onChange={(e) =>
              patch({ labels: { ...value.labels, horizon: e.target.value } })
            }
          />
        </Field>
        <Field label="Fees label">
          <Input
            disabled={!canEdit}
            value={value.labels.fees}
            onChange={(e) =>
              patch({ labels: { ...value.labels, fees: e.target.value } })
            }
          />
        </Field>
      </FormSection>
    </div>
  );
}
