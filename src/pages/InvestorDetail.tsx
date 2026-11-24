import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { FormSection } from "@/components/admin/FormSection";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { createClientId } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime, titleCase } from "@/lib/format";
import { COUNTRIES, NATIONALITIES } from "@/lib/locations";
import type {
  ActivityEvent,
  DocumentAsset,
  IntentSignal,
  Investor,
  Note,
  AssignPropertyInput,
  PortfolioAssignPlanType,
  PortfolioInsightCard,
  PortfolioOwnership,
  PropertyInventoryUnit,
  PropertyUnit,
} from "@/models";
import {
  addNote,
  assignPropertyToInvestor,
  generatePortfolioInsights,
  getInvestor,
  getInvestorEngagement,
  getProperty,
  listDocuments,
  listNotes,
  listOwnership,
  listProperties,
  removeDocument,
  removePropertyFromInvestor,
  removeUnitsFromInvestor,
  sortInvestorRecommendedProperties,
  updateInvestor,
  uploadInvestorDocument,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureAgents } from "@/store/slices/agentsSlice";
import { invalidateInvestors, upsertInvestor } from "@/store/slices/investorsSlice";
import {
  ensureProperties,
  invalidateProperties,
  upsertProperty,
} from "@/store/slices/propertiesSlice";

type PlanApplyMode = "same" | "custom";
type AssignFlowStep = 1 | 2 | 3;

type MortgageDraft = {
  name: string;
  deposit: number;
  loanAmount: number;
  ratePct: number;
  monthlyPayment: number;
  termYears: number;
  ltvPct: number;
  type: "repayment" | "interest_only";
  reservationFee: number;
  mortgageDate: string;
};

type ScheduleStageDraft = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  date: string;
};

type ScheduleDraft = {
  name: string;
  summary: string;
  stages: ScheduleStageDraft[];
};

function planTypeLabel(plan: PortfolioAssignPlanType | null | undefined): string {
  if (plan === "mortgage") return "Mortgage";
  if (plan === "payment_schedule") return "Payment schedule";
  if (plan === "cash") return "Cash (no plan)";
  return "—";
}

function planColumnLabel(row: PortfolioOwnership): string {
  const base = planTypeLabel(row.assignedPlanType);
  if (base === "—" || row.assignedPlanType === "cash") return base;
  return row.assignedPlanVariant === "custom" ? `${base} (custom)` : base;
}

type PortfolioUnitRow = PortfolioOwnership & {
  rowId: string;
  unitLabel: string;
  unitQuantity: number;
  unitIndex: number | null;
};

function expandPortfolioRows(items: PortfolioOwnership[]): PortfolioUnitRow[] {
  const rows: PortfolioUnitRow[] = [];
  for (const holding of items) {
    const units = (holding.units ?? []).filter((u) => u.quantity > 0);
    if (units.length === 0) {
      rows.push({
        ...holding,
        rowId: holding.id,
        unitLabel: "",
        unitQuantity: holding.assignedUnitCount ?? 0,
        unitIndex: null,
      });
      continue;
    }
    const totalQty = units.reduce((sum, u) => sum + u.quantity, 0) || 1;
    units.forEach((unit) => {
      const purchase = (unit.purchasePrice || 0) * unit.quantity;
      const current =
        (unit.currentValue || unit.purchasePrice || 0) * unit.quantity;
      const rent = (unit.rentalEstimate || 0) * unit.quantity;
      const share = unit.quantity / totalQty;
      const mortgage = holding.mortgageBalance * share;
      const label = unit.floor.trim()
        ? `${unit.type} · Floor ${unit.floor}`
        : unit.type;
      rows.push({
        ...holding,
        rowId: `${holding.id}:${unit.unitIndex}`,
        unitLabel: label,
        unitQuantity: unit.quantity,
        unitIndex: unit.unitIndex,
        purchaseValue: purchase,
        currentValue: current,
        monthlyRent: rent,
        mortgageBalance: mortgage,
        equity: Math.max(0, current - mortgage),
        netCashFlow: holding.netCashFlow * share,
        assignedUnitCount: unit.quantity,
      });
    });
  }
  return rows;
}

function isAssignPlanActive(plan: { active?: boolean }): boolean {
  return plan.active !== false;
}

/** When inventory units exist, only that unit’s plans count — never fall back to stale property-root plans. */
function resolveAssignPlans(property: PropertyUnit, unitIndex = 0) {
  const units = property.units;
  if (units && units.length > 0) {
    const unit = units[unitIndex] ?? units[0];
    return {
      schedules: unit?.paymentSchedules ?? [],
      mortgages: unit?.mortgagePlans ?? [],
    };
  }
  return {
    schedules: property.paymentSchedules ?? [],
    mortgages: property.mortgagePlans ?? [],
  };
}

function getAssignPlanOptions(
  property: PropertyUnit,
  unitIndex = 0,
): Array<{
  value: PortfolioAssignPlanType;
  label: string;
  description: string;
}> {
  const options: Array<{
    value: PortfolioAssignPlanType;
    label: string;
    description: string;
  }> = [];

  const { schedules, mortgages } = resolveAssignPlans(property, unitIndex);
  const activeSchedules = schedules.filter(isAssignPlanActive);
  const activeMortgages = mortgages.filter(isAssignPlanActive);

  if (activeSchedules.length > 0) {
    const plan = activeSchedules[0];
    options.push({
      value: "payment_schedule",
      label: plan.name || "Developer payment schedule",
      description:
        plan.summary?.trim() || "Staged cash payments through completion",
    });
  }

  if (activeMortgages.length > 0) {
    const plan = activeMortgages[0];
    const mortgageBits = [
      plan.loanAmount > 0
        ? `Loan ${formatCurrency(plan.loanAmount)} per unit`
        : null,
      plan.monthlyPayment > 0
        ? `${formatCurrency(plan.monthlyPayment)}/mo per unit`
        : null,
    ].filter(Boolean);
    options.push({
      value: "mortgage",
      label: plan.name || "Mortgage",
      description:
        mortgageBits.length > 0
          ? mortgageBits.join(" · ")
          : "Use the property’s mortgage plan",
    });
  }

  // Always available.
  options.push({
    value: "cash",
    label: "Continue without any plan",
    description: "No mortgage or staged schedule — treat as direct cash payments.",
  });

  return options;
}

function scaleMoney(value: number, quantity: number): number {
  const qty = Math.max(1, quantity);
  return Math.round((Number(value) || 0) * qty * 100) / 100;
}

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mortgageDraftFromProperty(
  property: PropertyUnit,
  unitIndex = 0,
  quantity = 1,
): MortgageDraft {
  const unit = property.units?.[unitIndex];
  const { mortgages: plans } = resolveAssignPlans(property, unitIndex);
  const plan = plans.find(isAssignPlanActive) ?? null;
  const price = unit?.purchasePrice ?? property.purchasePrice ?? 0;
  const loan = plan?.loanAmount ?? property.loanBalance ?? 0;
  const deposit = plan?.deposit ?? Math.max(0, price - loan);
  return {
    name: plan?.name || "Mortgage plan",
    deposit: scaleMoney(deposit, quantity),
    loanAmount: scaleMoney(loan, quantity),
    ratePct: plan?.interestRate ?? 0,
    monthlyPayment: scaleMoney(
      plan?.monthlyPayment ?? property.monthlyMortgage ?? 0,
      quantity,
    ),
    termYears: plan?.termYears ?? 25,
    ltvPct:
      plan?.ltvPct ??
      (price > 0 ? Math.round((loan / price) * 1000) / 10 : 0),
    type: plan?.type ?? "repayment",
    reservationFee: scaleMoney(plan?.reservationFee ?? 0, quantity),
    mortgageDate: plan?.mortgageDate ?? "",
  };
}

function scheduleDraftFromProperty(
  property: PropertyUnit,
  unitIndex = 0,
  quantity = 1,
): ScheduleDraft {
  const { schedules } = resolveAssignPlans(property, unitIndex);
  // Only active schedules — never revive inactive or property-root leftovers.
  const schedule = schedules.find(isAssignPlanActive) ?? null;
  const stagesFromSchedule = schedule?.stages.map((s) => ({
    id: createClientId(),
    label: s.label,
    amount: scaleMoney(s.amount, quantity),
    dueDate: s.due,
    date: s.date ?? "",
  }));
  const stages = stagesFromSchedule ?? [];
  return {
    name: schedule?.name || "Developer payment schedule",
    summary: schedule?.summary || "",
    stages: stages.length
      ? stages
      : [{ id: createClientId(), label: "", amount: 0, dueDate: "", date: "" }],
  };
}

function AssignField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type AssignUnitRow = {
  id: string;
  unitIndex: number;
  label: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  floor: string;
  sizeSqft: number;
  purchasePrice: number;
  available: number;
  selected: boolean;
  assignCount: number;
};

function remainingAssignableUnits(property: PropertyUnit): number {
  const units = property.units ?? [];
  if (!units.length) return 1;
  return units.reduce(
    (sum, unit) =>
      sum + Math.max(0, unit.availableCount ?? unit.unitCount ?? 0),
    0,
  );
}

function inventoryUnitLabel(unit: PropertyInventoryUnit): string {
  const type = unit.type || "Unit";
  const floor = unit.floor?.trim();
  return floor ? `${type} · Floor ${floor}` : type;
}

function unitRowsFromProperty(property: PropertyUnit): AssignUnitRow[] {
  const inventory = property.units ?? [];
  if (inventory.length > 0) {
    const firstAvailable = inventory.findIndex(
      (unit) => (unit.availableCount ?? unit.unitCount ?? 0) > 0,
    );
    return inventory.map((unit, index) => {
      const available = Math.max(
        0,
        unit.availableCount ?? unit.unitCount ?? 0,
      );
      const selected = index === firstAvailable && available > 0;
      return {
        id: `${property.id}-unit-${index}`,
        unitIndex: index,
        label: inventoryUnitLabel(unit),
        propertyType: unit.type || "1-bed",
        bedrooms: unit.bedrooms ?? 0,
        bathrooms: unit.bathrooms ?? 0,
        floor: unit.floor ?? "",
        sizeSqft: unit.sizeSqft ?? 0,
        purchasePrice: unit.purchasePrice ?? property.purchasePrice ?? 0,
        available,
        selected,
        assignCount: selected ? 1 : 0,
      };
    });
  }

  const type = property.propertyType || "Unit";
  const floor = property.floor?.trim();
  return [
    {
      id: `prop-unit-${property.id}`,
      unitIndex: 0,
      label: floor ? `${type} · Floor ${floor}` : type,
      propertyType: property.propertyType || "1-bed",
      bedrooms: property.bedrooms ?? 1,
      bathrooms: property.bathrooms ?? 1,
      floor: property.floor ?? "",
      sizeSqft: property.sizeSqft ?? 0,
      purchasePrice: property.purchasePrice ?? 0,
      available: 1,
      selected: true,
      assignCount: 1,
    },
  ];
}

function quantityError(unit: AssignUnitRow): string | null {
  if (!unit.selected) return null;
  if (!Number.isFinite(unit.assignCount) || unit.assignCount < 1) {
    return "Enter a quantity of at least 1.";
  }
  if (unit.available < 1) {
    return "This unit type has no remaining availability.";
  }
  if (unit.assignCount > unit.available) {
    return `Quantity cannot exceed ${unit.available} available.`;
  }
  return null;
}

function defaultAssignPlanType(
  property: PropertyUnit,
  unitIndex = 0,
): PortfolioAssignPlanType {
  const options = getAssignPlanOptions(property, unitIndex);
  const preferred =
    options.find((o) => o.value === "payment_schedule") ??
    options.find((o) => o.value === "mortgage") ??
    options[0];
  return preferred?.value ?? "cash";
}

function AssignInventoryUnitRow({
  unit,
  assigning,
  onSelect,
  onQuantityChange,
}: {
  unit: AssignUnitRow;
  assigning: boolean;
  onSelect: () => void;
  onQuantityChange: (assignCount: number) => void;
}) {
  const error = quantityError(unit);
  const qtyId = `assign-qty-${unit.id}`;
  const errorId = `${qtyId}-error`;
  const radioId = `assign-unit-${unit.id}`;
  const details = [
    `${unit.bedrooms} bed`,
    `${unit.bathrooms} bath`,
    unit.sizeSqft > 0 ? `${unit.sizeSqft} sqft` : null,
    formatCurrency(unit.purchasePrice),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-3",
        unit.selected ? "border-primary bg-primary/10" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          id={radioId}
          type="radio"
          name="assign-unit"
          className="mt-1 size-4 accent-primary"
          checked={unit.selected}
          disabled={assigning || unit.available < 1}
          onChange={() => onSelect()}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <label htmlFor={radioId} className="block cursor-pointer">
            <p className="text-sm font-medium text-foreground">{unit.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {details}
              {details ? " · " : ""}
              {unit.available} available
            </p>
          </label>
          {unit.selected ? (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor={qtyId}>Quantity</Label>
              <Input
                id={qtyId}
                type="number"
                inputMode="numeric"
                min={1}
                max={unit.available}
                disabled={assigning}
                value={unit.assignCount || ""}
                aria-invalid={!!error}
                aria-describedby={error ? errorId : undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    onQuantityChange(0);
                    return;
                  }
                  const next = Number(raw);
                  onQuantityChange(Number.isFinite(next) ? next : 0);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Assigned {Math.max(0, unit.assignCount)} of {unit.available}{" "}
                available
              </p>
              {error ? (
                <p id={errorId} className="text-xs text-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InvestorDetailPage() {
  const params = useParams<{ id: string }>();
  const searchString = typeof window !== "undefined" ? window.location.search : "";
  const initialTab =
    new URLSearchParams(searchString).get("tab") === "portfolio" ? "portfolio" : "overview";
  const { user, canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const agents = useAppSelector((s) => s.agents.items);
  const cachedProperties = useAppSelector((s) => s.properties.items);
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [ownership, setOwnership] = useState<PortfolioOwnership[]>([]);
  const [properties, setProperties] = useState<PropertyUnit[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [signals, setSignals] = useState<IntentSignal[]>([]);
  const [insightCards, setInsightCards] = useState<PortfolioInsightCard[]>([]);
  const [documents, setDocuments] = useState<DocumentAsset[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [noteKind, setNoteKind] = useState<Note["kind"]>("follow_up");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docVisibility, setDocVisibility] =
    useState<DocumentAsset["visibility"]>("both");
  const [docCategory, setDocCategory] = useState("others");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentAsset | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [assignFlowOpen, setAssignFlowOpen] = useState(false);
  const [assignStep, setAssignStep] = useState<AssignFlowStep>(1);
  const [selectedPlanType, setSelectedPlanType] =
    useState<PortfolioAssignPlanType | "">("");
  const [planApplyMode, setPlanApplyMode] = useState<PlanApplyMode | "">("");
  const [customMortgage, setCustomMortgage] = useState<MortgageDraft | null>(null);
  const [customSchedule, setCustomSchedule] = useState<ScheduleDraft | null>(null);
  const [assignUnits, setAssignUnits] = useState<AssignUnitRow[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [removingRowId, setRemovingRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncPortfolioCaches = (
    nextInvestor: Investor,
    nextOwnership: PortfolioOwnership[],
    nextProperties: PropertyUnit[],
  ) => {
    setInvestor(nextInvestor);
    setOwnership(nextOwnership);
    setProperties(nextProperties);
    dispatch(upsertInvestor(nextInvestor));
    dispatch(invalidateInvestors());
    for (const p of nextProperties) dispatch(upsertProperty(p));
    dispatch(invalidateProperties());
  };

  const handleDeleteDocument = async () => {
    const target = deleteDocTarget;
    if (!target) return;
    setDeletingDoc(true);
    try {
      await removeDocument(target.id);
      setDocuments((prev) => prev.filter((d) => d.id !== target.id));
      toast.success("Document deleted");
      setDeleteDocTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete document.");
    } finally {
      setDeletingDoc(false);
    }
  };

  const reloadNotes = async (investorId: string) => {
    setNotesLoading(true);
    try {
      const items = await listNotes(investorId);
      setNotes(items);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to load notes.");
    } finally {
      setNotesLoading(false);
    }
  };

  const load = async () => {
    if (!params.id) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    setInsightCards([]);
    try {
      const inv = await getInvestor(params.id);
      setInvestor(inv ?? null);
      if (inv) dispatch(upsertInvestor(inv));

      const propsPromise = dispatch(ensureProperties({ force: true }))
        .unwrap()
        .catch(async (err: unknown) => {
          if (isThunkConditionError(err)) return cachedProperties;
          // Fall back to direct list if Redux condition/race blocks.
          try {
            return await listProperties();
          } catch {
            throw err;
          }
        });

      const settled = await Promise.allSettled([
        listOwnership(params.id),
        propsPromise,
        getInvestorEngagement(params.id),
        listDocuments({ investorId: params.id }),
        listNotes(params.id),
      ]);

      const value = <T,>(i: number, fallback: T): T =>
        settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

      const props = value(1, [] as PropertyUnit[]);
      setProperties(props);

      // Portfolio = GET /admin/ownership only. Do not synthesize from properties list.
      const holdings = value(0, [] as PortfolioOwnership[]);
      setOwnership(holdings);

      const engagement = value(2, {
        investorRef: params.id,
        screens: [],
        properties: [],
        calculatorSteps: [],
        totalEvents: 0,
        recent: [] as ActivityEvent[],
        signals: [] as IntentSignal[],
        insufficientActivity: true,
        reason: null,
        activityEventCount: 0,
      });
      setActivity(engagement.recent);
      setSignals(engagement.signals);
      setDocuments(value(3, [] as DocumentAsset[]));
      if (settled[4].status === "fulfilled") {
        setNotes((settled[4] as PromiseFulfilledResult<Note[]>).value);
      } else {
        setNotes([]);
        const reason = (settled[4] as PromiseRejectedResult).reason;
        toast.error(
          reason instanceof ApiError ? reason.message : "Unable to load notes.",
        );
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load investor.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    void dispatch(ensureAgents())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load agents.");
      });
  }, [params.id, dispatch]);

  if (loading) return <LoadingBlock variant="detail" />;
  if (loadError && !investor) {
    return (
      <div className="space-y-4">
        <PageHeader title="Investor" description={loadError} />
        <Button variant="outline" onClick={() => { setLoading(true); load(); }}>
          Retry
        </Button>
      </div>
    );
  }
  if (!investor) {
    return (
      <PageHeader title="Investor not found" description="This investor record does not exist." />
    );
  }

  const availableProperties = properties.filter(
    (p) => remainingAssignableUnits(p) > 0,
  );
  const propertyPendingAssign = properties.find((p) => p.id === selectedPropertyId);
  const selectedAssignUnit = assignUnits.find((u) => u.selected);
  const assignPlanOptions = propertyPendingAssign
    ? getAssignPlanOptions(
        propertyPendingAssign,
        selectedAssignUnit?.unitIndex ?? 0,
      )
    : [];

  const resetAssignDialogState = () => {
    setSelectedPlanType("");
    setPlanApplyMode("");
    setCustomMortgage(null);
    setCustomSchedule(null);
    setAssignUnits([]);
    setUnitsLoading(false);
    setSelectedPropertyId("");
    setAssignStep(1);
  };

  const cancelAssignFlow = () => {
    if (assigning) return;
    resetAssignDialogState();
    setAssignFlowOpen(false);
  };

  const applyDefaultPlan = (property: PropertyUnit, rows?: AssignUnitRow[]) => {
    const list = rows ?? unitRowsFromProperty(property);
    const selected = list.find((u) => u.selected);
    const unitIndex = selected?.unitIndex ?? 0;
    seedPlanDrafts(
      property,
      Math.max(1, selected?.assignCount || 1),
      unitIndex,
    );
    const nextType = defaultAssignPlanType(property, unitIndex);
    setSelectedPlanType(nextType);
    setPlanApplyMode(nextType === "cash" ? "" : "same");
  };

  const seedAssignUnits = (property: PropertyUnit): AssignUnitRow[] => {
    const rows = unitRowsFromProperty(property);
    setAssignUnits(rows);
    return rows;
  };

  const loadPropertyForAssign = async (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const listed = properties.find((p) => p.id === propertyId);
    if (listed) {
      const rows = seedAssignUnits(listed);
      applyDefaultPlan(listed, rows);
    } else {
      setAssignUnits([]);
    }
    setUnitsLoading(true);
    try {
      const full = await getProperty(propertyId);
      if (!full) return;
      dispatch(upsertProperty(full));
      setProperties((prev) => {
        const exists = prev.some((p) => p.id === full.id);
        return exists
          ? prev.map((p) => (p.id === full.id ? full : p))
          : [...prev, full];
      });
      const rows = seedAssignUnits(full);
      applyDefaultPlan(full, rows);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Unable to load units for this property.",
      );
    } finally {
      setUnitsLoading(false);
    }
  };

  const startAssignFlow = () => {
    resetAssignDialogState();
    setAssignFlowOpen(true);
  };

  const seedPlanDrafts = (
    property: PropertyUnit,
    quantity = 1,
    unitIndex = 0,
  ) => {
    setCustomMortgage(mortgageDraftFromProperty(property, unitIndex, quantity));
    setCustomSchedule(scheduleDraftFromProperty(property, unitIndex, quantity));
  };

  const refreshPlanDraftsFromSelection = (property: PropertyUnit) => {
    const selected = assignUnits.find((u) => u.selected);
    seedPlanDrafts(
      property,
      Math.max(1, selected?.assignCount || 1),
      selected?.unitIndex ?? 0,
    );
  };

  const selectPlanType = (value: PortfolioAssignPlanType) => {
    setSelectedPlanType(value);
    setPlanApplyMode("same");
    if (value !== "cash" && propertyPendingAssign) {
      refreshPlanDraftsFromSelection(propertyPendingAssign);
    }
  };

  const selectedAssignUnits = assignUnits.filter((u) => u.selected);
  const totalAssignUnits = selectedAssignUnits.reduce(
    (sum, u) => sum + (u.assignCount || 0),
    0,
  );
  const unitsStepInvalid =
    !selectedPropertyId ||
    unitsLoading ||
    selectedAssignUnits.length < 1 ||
    selectedAssignUnits.some((u) => quantityError(u) != null);

  const selectAssignUnit = (unitId: string) => {
    setAssignUnits((prev) => {
      const next = prev.map((u) => {
        const selected = u.id === unitId;
        return {
          ...u,
          selected,
          assignCount: selected ? (u.assignCount > 0 ? u.assignCount : 1) : 0,
        };
      });
      if (propertyPendingAssign) {
        applyDefaultPlan(propertyPendingAssign, next);
      }
      return next;
    });
  };

  const setAssignUnitQuantity = (unitId: string, assignCount: number) => {
    setAssignUnits((prev) =>
      prev.map((u) => (u.id === unitId ? { ...u, assignCount } : u)),
    );
  };

  const confirmAssignToPortfolio = async () => {
    if (!selectedPropertyId || !selectedPlanType) return;
    const isCash = selectedPlanType === "cash";
    if (!isCash && !planApplyMode) return;
    if (selectedAssignUnits.length < 1 || selectedAssignUnits.some((u) => quantityError(u))) {
      toast.error("Select a unit and enter a valid quantity.");
      return;
    }
    const selected = selectedAssignUnits[0];
    const isCustom = !isCash && planApplyMode === "custom";
    const scaledDefault = !isCustom && selected.assignCount > 1;
    const planMode = isCash || (!isCustom && !scaledDefault) ? "default" : "custom";
    const payload: AssignPropertyInput = {
      propertyId: selectedPropertyId,
      units: [
        {
          unitIndex: selected.unitIndex,
          quantity: selected.assignCount,
        },
      ],
      planType: selectedPlanType,
      planMode,
    };
    if (selectedPlanType === "mortgage" && customMortgage) {
      payload.mortgagePlan = {
        name: customMortgage.name.trim() || "Mortgage plan",
        type: customMortgage.type,
        deposit: customMortgage.deposit ?? 0,
        loanAmount: customMortgage.loanAmount ?? 0,
        interestRate: customMortgage.ratePct ?? 0,
        monthlyPayment: customMortgage.monthlyPayment ?? 0,
        termYears: customMortgage.termYears ?? 0,
        ltvPct: customMortgage.ltvPct ?? 0,
        reservationFee: customMortgage.reservationFee ?? 0,
        mortgageDate: customMortgage.mortgageDate || undefined,
      };
    }
    if (selectedPlanType === "payment_schedule" && customSchedule) {
      payload.paymentSchedule = {
        name: customSchedule.name.trim() || "Developer payment schedule",
        summary: customSchedule.summary,
        stages: customSchedule.stages.map((s) => ({
          label: s.label,
          amount: Number(s.amount) || 0,
          due: s.dueDate,
          date: s.date || undefined,
        })),
      };
    }
    setAssigning(true);
    try {
      const row = await assignPropertyToInvestor(investor.id, payload);
      const prop = properties.find((p) => p.id === selectedPropertyId);
      let mortgageBalance =
        selectedPlanType === "mortgage" ? (prop?.loanBalance ?? 0) : 0;
      let equity =
        selectedPlanType === "mortgage"
          ? (prop?.equity ??
            Math.max(0, (prop?.currentValue ?? 0) - (prop?.loanBalance ?? 0)))
          : (prop?.currentValue ?? row.currentValue);

      if (isCustom && selectedPlanType === "mortgage" && customMortgage && prop) {
        mortgageBalance = customMortgage.loanAmount ?? 0;
        equity = Math.max(0, prop.currentValue - (customMortgage.loanAmount ?? 0));
      }

      const unitsPurchase = selectedAssignUnits.reduce(
        (sum, u) => sum + (u.purchasePrice || 0) * (u.assignCount || 0),
        0,
      );

      const enriched: PortfolioOwnership = {
        ...row,
        purchaseValue:
          unitsPurchase || row.purchaseValue || prop?.purchasePrice || 0,
        currentValue: row.currentValue || prop?.currentValue || unitsPurchase || 0,
        mortgageBalance,
        equity,
        monthlyRent: row.monthlyRent || prop?.rentalEstimate || 0,
        assignedPlanType: selectedPlanType,
        assignedPlanVariant: isCash ? "default" : isCustom ? "custom" : "default",
        assignedUnitCount: totalAssignUnits,
        units: row.units ?? [],
      };
      let nextProp = properties.find((p) => p.id === selectedPropertyId) ?? prop;
      try {
        const fresh = await getProperty(selectedPropertyId);
        if (fresh) nextProp = fresh;
      } catch {
        if (prop) {
          nextProp = {
            ...prop,
            units: (prop.units ?? []).map((unit, index) => {
              const taken = payload.units
                ?.filter((u) => u.unitIndex === index)
                .reduce((sum, u) => sum + u.quantity, 0) ?? 0;
              const available = Math.max(
                0,
                (unit.availableCount ?? unit.unitCount ?? 0) - taken,
              );
              return { ...unit, availableCount: available };
            }),
          };
        }
      }

      const nextProperties = nextProp
        ? properties.map((p) => (p.id === selectedPropertyId ? nextProp : p))
        : properties;

      try {
        const holdings = await listOwnership(investor.id);
        const nextInvestor: Investor = {
          ...investor,
          ownedPropertyCount: new Set(holdings.map((o) => String(o.propertyId)))
            .size,
        };
        syncPortfolioCaches(nextInvestor, holdings, nextProperties);
        void generatePortfolioInsights({
          investorId: investor.id,
          investorName: investor.name,
          investorFirstName: investor.firstName,
          investorLastName: investor.lastName,
          holdings,
          properties: nextProperties,
        }).then(setInsightCards);
      } catch {
        const nextOwnership = [
          ...ownership.filter((o) => String(o.id) !== String(enriched.id)),
          { ...enriched, units: enriched.units ?? [] },
        ];
        const nextInvestor: Investor = {
          ...investor,
          ownedPropertyCount: new Set(nextOwnership.map((o) => String(o.propertyId)))
            .size,
        };
        syncPortfolioCaches(nextInvestor, nextOwnership, nextProperties);
        void generatePortfolioInsights({
          investorId: investor.id,
          investorName: investor.name,
          investorFirstName: investor.firstName,
          investorLastName: investor.lastName,
          holdings: nextOwnership,
          properties: nextProperties,
        }).then(setInsightCards);
      }
      setSelectedPropertyId("");
      resetAssignDialogState();
      setAssignFlowOpen(false);
      toast.success(
        isCash
          ? `Assigned ${totalAssignUnits} unit${totalAssignUnits === 1 ? "" : "s"} with direct cash payments`
          : isCustom
            ? `Assigned ${totalAssignUnits} unit${totalAssignUnits === 1 ? "" : "s"} with custom ${planTypeLabel(selectedPlanType).toLowerCase()}`
            : `Assigned ${totalAssignUnits} unit${totalAssignUnits === 1 ? "" : "s"} with ${planTypeLabel(selectedPlanType).toLowerCase()} plan`,
      );
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to assign property",
      );
    } finally {
      setAssigning(false);
    }
  };

  const portfolioRows = expandPortfolioRows(ownership);
  const portfolioColumns: Column<PortfolioUnitRow>[] = [
    {
      key: "property",
      header: "Property",
      cell: (r) => {
        const name =
          r.propertyName ||
          properties.find((p) => p.id === r.propertyId)?.name ||
          r.propertyId;
        return (
          <div className="min-w-0">
            <Link
              href={`/properties/${r.propertyId}`}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {name}
            </Link>
            {r.unitLabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{r.unitLabel}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => planColumnLabel(r),
    },
    {
      key: "units",
      header: "Units",
      cell: (r) =>
        r.unitQuantity > 0 ? String(r.unitQuantity) : "—",
    },
    { key: "purchase", header: "Purchase", cell: (r) => formatCurrency(r.purchaseValue) },
    { key: "value", header: "Current value", cell: (r) => formatCurrency(r.currentValue) },
    { key: "mortgage", header: "Mortgage", cell: (r) => formatCurrency(r.mortgageBalance) },
    { key: "equity", header: "Equity", cell: (r) => formatCurrency(r.equity) },
    { key: "rent", header: "Rent", cell: (r) => formatCurrency(r.monthlyRent) },
    { key: "ncf", header: "Net cash flow", cell: (r) => formatCurrency(r.netCashFlow) },
    {
      key: "actions",
      header: "Actions",
      cell: (r) =>
        canMutate("investors") ? (
          <Button
            size="sm"
            variant="outline"
            disabled={removingRowId === r.rowId}
            onClick={async (e) => {
              e.stopPropagation();
              setRemovingRowId(r.rowId);
              try {
                if (r.unitIndex == null) {
                await removePropertyFromInvestor(investor.id, r.propertyId);
                } else {
                  await removeUnitsFromInvestor(investor.id, r.propertyId, [
                    { unitIndex: r.unitIndex },
                  ]);
                }
                let nextOwnership: PortfolioOwnership[] = ownership;
                try {
                  nextOwnership = await listOwnership(investor.id);
                } catch {
                  if (r.unitIndex == null) {
                    nextOwnership = ownership.filter(
                      (o) => o.propertyId !== r.propertyId,
                    );
                  } else {
                    nextOwnership = ownership.flatMap((o) => {
                      if (o.propertyId !== r.propertyId) return [o];
                      const nextUnits = (o.units ?? []).filter(
                        (u) => u.unitIndex !== r.unitIndex,
                      );
                      if (nextUnits.length === 0) return [];
                      return [
                        {
                          ...o,
                          units: nextUnits,
                          assignedUnitCount: nextUnits.reduce(
                            (sum, u) => sum + u.quantity,
                            0,
                          ),
                        },
                      ];
                    });
                  }
                }
                let nextProperties = properties;
                try {
                  const fresh = await getProperty(r.propertyId);
                  if (fresh) {
                    nextProperties = properties.map((p) =>
                      p.id === r.propertyId ? fresh : p,
                    );
                  }
                } catch {
                  nextProperties = properties;
                }
                const nextInvestor: Investor = {
                  ...investor,
                  ownedPropertyCount: new Set(
                    nextOwnership.map((o) => String(o.propertyId)),
                  ).size,
                };
                syncPortfolioCaches(nextInvestor, nextOwnership, nextProperties);
                toast.success(
                  r.unitIndex == null
                    ? "Property removed from portfolio"
                    : "Unit type removed from portfolio",
                );
              } catch (err) {
                toast.error(
                  err instanceof ApiError ? err.message : "Failed to remove from portfolio",
                );
              } finally {
                setRemovingRowId(null);
              }
            }}
          >
            {removingRowId === r.rowId ? "Removing…" : "Remove"}
          </Button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="min-w-0 w-full">
      <PageHeader
        title={investor.name}
        description={investor.email}
        breadcrumbs={[
          { label: "Investors", href: "/investors" },
          { label: investor.name },
        ]}
      />

      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="signals">Intent Signals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <InvestorProfileSection
            investor={investor}
            canEdit={canMutate("investors")}
            onUpdated={setInvestor}
          />

          <RecommendedPropertiesSection
            investor={investor}
            properties={properties}
            canEdit={canMutate("investors")}
            onUpdated={setInvestor}
          />

          {canMutate("investors") && (
            <FormSection title="Assignment">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="agent">Assigned agent</Label>
                <Select
                  value={investor.assignedAgentId ?? "none"}
                  onValueChange={async (v) => {
                    try {
                      const updated = await updateInvestor(investor.id, {
                        assignedAgentId: v === "none" ? null : v,
                      });
                      setInvestor(updated);
                      dispatch(upsertInvestor(updated));
                      dispatch(invalidateInvestors());
                      toast.success("Agent assignment updated");
                    } catch (err) {
                      toast.error(
                        err instanceof ApiError ? err.message : "Unable to update agent.",
                      );
                    }
                  }}
                >
                  <SelectTrigger id="agent"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormSection>
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-4">
          {canMutate("investors") && (
            <FormSection
              title="Assign to portfolio"
              description={
                assignFlowOpen
                  ? propertyPendingAssign
                    ? `Assigning ${propertyPendingAssign.name} to ${investor.name} · step ${assignStep} of 3`
                    : `Select a property and units for ${investor.name} · step ${assignStep} of 3`
                  : "Assign remaining units from a property. The same property can be assigned to this or other investors until inventory is gone."
              }
              actions={
                assignFlowOpen ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={assigning}
                    onClick={cancelAssignFlow}
                  >
                    Cancel
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-5 md:col-span-2">
                {!assignFlowOpen ? (
                  <div>
                    <Button
                      className="min-h-10"
                      disabled={assigning || availableProperties.length === 0}
                      onClick={startAssignFlow}
                    >
                      Assign to portfolio
                    </Button>
                      {availableProperties.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No properties have remaining units to assign.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div
                      className="flex flex-wrap gap-2"
                      role="list"
                      aria-label="Assignment steps"
                    >
                      {(
                        [
                          [1, "Units"],
                          [2, "Payment plan"],
                          [3, "Review"],
                        ] as const
                      ).map(([step, label]) => {
                        const active = assignStep === step;
                        const done = assignStep > step;
                        return (
                          <div
                            key={step}
                            role="listitem"
                            className={cn(
                              "rounded-md border px-3 py-1.5 text-xs font-medium",
                              active
                                ? "border-primary bg-primary/10 text-foreground"
                                : done
                                  ? "border-border bg-muted/30 text-muted-foreground"
                                  : "border-border text-muted-foreground",
                            )}
                          >
                            {step}. {label}
                          </div>
                        );
                      })}
                    </div>

                    {assignStep === 1 ? (
                <section className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="assign-property">Property</Label>
                      <SearchableSelect
                        id="assign-property"
                        value={selectedPropertyId || undefined}
                        onValueChange={(id) => void loadPropertyForAssign(id)}
                        disabled={assigning || unitsLoading}
                        placeholder="Choose a property…"
                        searchPlaceholder="Search properties…"
                        emptyMessage={
                          availableProperties.length === 0
                            ? "No properties with remaining units"
                            : "No matching properties"
                        }
                        options={availableProperties.map((p) => ({
                          value: p.id,
                          label: `${p.name} · ${remainingAssignableUnits(p)} available`,
                          keywords: `${p.reference ?? ""} ${p.city ?? ""} ${p.address ?? ""}`,
                        }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="assign-investor">Investor</Label>
                      <Input
                        id="assign-investor"
                        readOnly
                        value={`${investor.name} · ${investor.email}`}
                        className="bg-muted/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        This assignment is for the current investor. Create or
                        invite investors from the Investors list.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-foreground">Units</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Select one unit type from this property, then set a
                      quantity that does not exceed availability.
                    </p>
                  </div>

                  {!selectedPropertyId ? (
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      Select a property to see its available units.
                    </div>
                  ) : unitsLoading ? (
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      Loading units…
                    </div>
                  ) : assignUnits.length === 0 ? (
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                      This property has no units configured.
                    </div>
                  ) : (
                    <div
                      className="space-y-2"
                      role="radiogroup"
                      aria-label="Unit type"
                    >
                      {assignUnits.map((unit) => (
                        <AssignInventoryUnitRow
                          key={unit.id}
                          unit={unit}
                          assigning={assigning}
                          onSelect={() => selectAssignUnit(unit.id)}
                          onQuantityChange={(count) =>
                            setAssignUnitQuantity(unit.id, count)
                          }
                        />
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Total units to assign:{" "}
                        <span className="font-medium text-foreground tabular-nums">
                          {totalAssignUnits}
                        </span>
                      </p>
                    </div>
                  )}
                </section>
                    ) : null}

                    {assignStep === 2 ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Payment plan
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Defaults to this property’s plan, multiplied by the unit
                      quantity you selected. Custom only changes this investor’s
                      holding — the property catalog is unchanged.
                    </p>
                  </div>

                {assignPlanOptions.length === 0 ? (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    <p>
                      This property has no mortgage or developer payment schedule configured.
                    </p>
                    {selectedPropertyId ? (
                      <Button variant="link" className="mt-2 h-auto px-0" asChild>
                        <Link href={`/properties/${selectedPropertyId}`}>
                          Edit property plans
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div
                      className="space-y-2"
                      role="radiogroup"
                      aria-label="Payment plan"
                    >
                      {assignPlanOptions.map((option) => {
                        const selected = selectedPlanType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={assigning}
                            onClick={() => selectPlanType(option.value)}
                            className={cn(
                              "w-full rounded-md border px-3 py-3 text-left transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              selected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <div className="text-sm font-medium text-foreground">
                              {option.label}
                            </div>
                            {option.description ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {option.description}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {selectedPlanType === "cash" ? (
                      <p className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        No mortgage or developer payment schedule will be attached.
                        This holding is treated as direct cash payments.
                      </p>
                    ) : null}

                    {selectedPlanType && selectedPlanType !== "cash" ? (
                      <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-sm font-medium text-foreground">
                          How should this plan apply?
                        </p>
                        <div
                          className="grid gap-2 sm:grid-cols-2"
                          role="radiogroup"
                          aria-label="Plan apply mode"
                        >
                          {(
                            [
                              {
                                value: "same" as const,
                                label: "Keep it same",
                                description:
                                  selectedPlanType === "mortgage"
                                    ? `Use the property mortgage × ${Math.max(1, totalAssignUnits)} unit${totalAssignUnits === 1 ? "" : "s"}.`
                                    : `Use the property payment schedule × ${Math.max(1, totalAssignUnits)} unit${totalAssignUnits === 1 ? "" : "s"}.`,
                              },
                              {
                                value: "custom" as const,
                                label:
                                  selectedPlanType === "mortgage"
                                    ? "Custom mortgage"
                                    : "Custom standard plan",
                                description:
                                  selectedPlanType === "mortgage"
                                    ? "Edit mortgage details for this investor only."
                                    : "Edit the payment schedule for this investor only.",
                              },
                            ] as const
                          ).map((mode) => {
                            const selected = planApplyMode === mode.value;
                            return (
                              <button
                                key={mode.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={assigning}
                                onClick={() => {
                                  setPlanApplyMode(mode.value);
                                  if (propertyPendingAssign) {
                                    refreshPlanDraftsFromSelection(
                                      propertyPendingAssign,
                                    );
                                  }
                                }}
                                className={cn(
                                  "rounded-md border px-3 py-3 text-left transition-colors",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  selected
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted/40",
                                )}
                              >
                                <div className="text-sm font-medium">{mode.label}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {mode.description}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {planApplyMode === "same" ? (
                          <div className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-3">
                            <p className="text-xs text-muted-foreground">
                              Property default scaled for{" "}
                              <span className="font-medium text-foreground">
                                {Math.max(1, totalAssignUnits)} unit
                                {totalAssignUnits === 1 ? "" : "s"}
                              </span>
                              . The property catalog plan is not changed.
                            </p>
                            {selectedPlanType === "mortgage" && customMortgage ? (
                              <p className="text-sm text-foreground">
                                Loan {formatCurrency(customMortgage.loanAmount ?? 0)} ·{" "}
                                Deposit {formatCurrency(customMortgage.deposit ?? 0)} ·{" "}
                                {formatCurrency(customMortgage.monthlyPayment ?? 0)}/mo
                              </p>
                            ) : null}
                            {selectedPlanType === "payment_schedule" &&
                            customSchedule ? (
                              <ul className="space-y-1 text-sm text-foreground">
                                {customSchedule.stages.map((stage) => (
                                  <li
                                    key={stage.id}
                                    className="flex justify-between gap-3"
                                  >
                                    <span>{stage.label || "Stage"}</span>
                                    <span className="tabular-nums">
                                      {formatCurrency(stage.amount)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}

                        {planApplyMode === "custom" &&
                        selectedPlanType === "mortgage" &&
                        customMortgage ? (
                          <div className="space-y-3 rounded-md border border-border p-3">
                            <p className="text-sm font-medium">Custom mortgage</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <AssignField label="Plan name" className="sm:col-span-2">
                                <Input
                                  disabled={assigning}
                                  value={customMortgage.name}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Type" className="sm:col-span-2">
                                <div
                                  className="inline-flex h-9 w-full max-w-xs items-center gap-0.5 rounded-md border border-input bg-background p-0.5"
                                  role="group"
                                  aria-label="Mortgage type"
                                >
                                  {(
                                    [
                                      ["repayment", "Repayment"],
                                      ["interest_only", "Interest only"],
                                    ] as const
                                  ).map(([value, label]) => {
                                    const selected = customMortgage.type === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        disabled={assigning}
                                        aria-pressed={selected}
                                        className={cn(
                                          "h-8 flex-1 rounded-sm px-2 text-sm transition-colors outline-none",
                                          "focus-visible:ring-2 focus-visible:ring-ring",
                                          "disabled:cursor-not-allowed disabled:opacity-50",
                                          selected
                                            ? "bg-primary text-primary-foreground font-medium"
                                            : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                                        )}
                                        onClick={() =>
                                          setCustomMortgage({
                                            ...customMortgage,
                                            type: value,
                                          })
                                        }
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </AssignField>
                              <AssignField label="Deposit (GBP)">
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={assigning}
                                  value={customMortgage.deposit ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      deposit: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Reservation fee (GBP)">
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={assigning}
                                  value={customMortgage.reservationFee ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      reservationFee: numberOrUndefined(
                                        e.target.value,
                                      ) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Loan amount (GBP)">
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={assigning}
                                  value={customMortgage.loanAmount ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      loanAmount: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Interest rate %">
                                <Input
                                  type="number"
                                  step="0.01"
                                  disabled={assigning}
                                  value={customMortgage.ratePct ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      ratePct: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Monthly payment (GBP)">
                                <Input
                                  type="number"
                                  step="any"
                                  disabled={assigning}
                                  value={customMortgage.monthlyPayment ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      monthlyPayment: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Term (years)">
                                <Input
                                  type="number"
                                  disabled={assigning}
                                  value={customMortgage.termYears ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      termYears: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="LTV %">
                                <Input
                                  type="number"
                                  step="0.1"
                                  disabled={assigning}
                                  value={customMortgage.ltvPct ?? ""}
                                  onChange={(e) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      ltvPct: numberOrUndefined(e.target.value) as number,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Mortgage date">
                                <DatePicker
                                  disabled={assigning}
                                  value={customMortgage.mortgageDate}
                                  onChange={(v) =>
                                    setCustomMortgage({
                                      ...customMortgage,
                                      mortgageDate: v,
                                    })
                                  }
                                  placeholder="Select mortgage date"
                                />
                              </AssignField>
                            </div>
                          </div>
                        ) : null}

                        {planApplyMode === "custom" &&
                        selectedPlanType === "payment_schedule" &&
                        customSchedule ? (
                          <div className="space-y-3 rounded-md border border-border p-3">
                            <p className="text-sm font-medium">Custom standard plan</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <AssignField label="Plan name">
                                <Input
                                  disabled={assigning}
                                  value={customSchedule.name}
                                  onChange={(e) =>
                                    setCustomSchedule({
                                      ...customSchedule,
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </AssignField>
                              <AssignField label="Payment plan summary">
                                <Input
                                  disabled={assigning}
                                  value={customSchedule.summary}
                                  onChange={(e) =>
                                    setCustomSchedule({
                                      ...customSchedule,
                                      summary: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. 20% deposit · 80% on completion"
                                />
                              </AssignField>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">
                                  Payment schedule
                                </Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={assigning}
                                  onClick={() =>
                                    setCustomSchedule({
                                      ...customSchedule,
                                      stages: [
                                        ...customSchedule.stages,
                                        {
                                          id: createClientId(),
                                          label: "",
                                          amount: 0,
                                          dueDate: "",
                                          date: "",
                                        },
                                      ],
                                    })
                                  }
                                >
                                  Add stage
                  </Button>
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
                                      <TableHead className="w-20" />
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {customSchedule.stages.length === 0 ? (
                                      <TableRow>
                                        <TableCell
                                          colSpan={5}
                                          className="text-muted-foreground"
                                        >
                                          No stages yet.
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      customSchedule.stages.map((stage, stageIndex) => (
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
                                              disabled={assigning}
                                              value={stage.label}
                                              placeholder="e.g. Reservation Fee"
                                              onChange={(e) =>
                                                setCustomSchedule({
                                                  ...customSchedule,
                                                  stages: customSchedule.stages.map(
                                                    (s) =>
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
                                              className="text-right tabular-nums"
                                              disabled={assigning}
                                              value={stage.amount ?? ""}
                                              onChange={(e) =>
                                                setCustomSchedule({
                                                  ...customSchedule,
                                                  stages: customSchedule.stages.map(
                                                    (s) =>
                                                      s.id === stage.id
                                                        ? {
                                                            ...s,
                                                            amount: numberOrUndefined(
                                                              e.target.value,
                                                            ) as number,
                                                          }
                                                        : s,
                                                  ),
                                                })
                                              }
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              disabled={assigning}
                                              value={stage.dueDate}
                                              placeholder="Now / On exchange"
                                              onChange={(e) =>
                                                setCustomSchedule({
                                                  ...customSchedule,
                                                  stages: customSchedule.stages.map(
                                                    (s) =>
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
                                              disabled={assigning}
                                              value={stage.date}
                                              onChange={(v) =>
                                                setCustomSchedule({
                                                  ...customSchedule,
                                                  stages: customSchedule.stages.map(
                                                    (s) =>
                                                      s.id === stage.id
                                                        ? { ...s, date: v }
                                                        : s,
                                                  ),
                                                })
                                              }
                                              placeholder="Select date"
                                            />
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              disabled={assigning}
                                              onClick={() =>
                                                setCustomSchedule({
                                                  ...customSchedule,
                                                  stages: customSchedule.stages.filter(
                                                    (s) => s.id !== stage.id,
                                                  ),
                                                })
                                              }
                                            >
                                              Remove
                  </Button>
                                          </TableCell>
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
                                          customSchedule.stages.reduce(
                                            (sum, s) =>
                                              sum + (Number(s.amount) || 0),
                                            0,
                                          ),
                                        )}
                                      </TableCell>
                                      <TableCell />
                                      <TableCell />
                                      <TableCell />
                                    </TableRow>
                                  </TableFooter>
                                </Table>
                </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
                </section>
                    ) : null}

                    {assignStep === 3 ? (
                      <section className="space-y-3">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">
                            Review
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Confirm investor, units, and plan before assigning.
                          </p>
                        </div>
                        <div className="rounded-md border border-border divide-y divide-border">
                          <div className="flex items-start justify-between gap-3 px-3 py-3">
                            <span className="text-xs text-muted-foreground">Investor</span>
                            <span className="text-sm text-right font-medium">
                              {investor.name}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3 px-3 py-3">
                            <span className="text-xs text-muted-foreground">Property</span>
                            <span className="text-sm text-right font-medium">
                              {propertyPendingAssign?.name ?? "—"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3 px-3 py-3">
                            <span className="text-xs text-muted-foreground">Units</span>
                            <span className="text-sm text-right tabular-nums">
                              {totalAssignUnits}
                              {selectedAssignUnits
                                .filter((u) => u.assignCount > 0)
                                .map(
                                  (u) =>
                                    ` · ${u.assignCount}× ${u.label}`,
                                )
                                .join("")}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3 px-3 py-3">
                            <span className="text-xs text-muted-foreground">Plan</span>
                            <span className="text-sm text-right font-medium">
                              {!selectedPlanType
                                ? "—"
                                : selectedPlanType === "cash"
                                  ? "Cash (no plan)"
                                  : planApplyMode === "custom"
                                    ? `${planTypeLabel(selectedPlanType)} (custom)`
                                    : planTypeLabel(selectedPlanType)}
                            </span>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={assigning}
                        onClick={() => {
                          if (assignStep === 1) cancelAssignFlow();
                          else setAssignStep((s) => (s - 1) as AssignFlowStep);
                        }}
                      >
                        {assignStep === 1 ? "Cancel" : "Back"}
                      </Button>
                      {assignStep < 3 ? (
                        <Button
                          type="button"
                          disabled={
                            assigning ||
                            (assignStep === 1 && unitsStepInvalid) ||
                            (assignStep === 2 &&
                              (!selectedPlanType ||
                                (selectedPlanType !== "cash" && !planApplyMode) ||
                                assignPlanOptions.length === 0))
                          }
                          onClick={() => {
                            if (assignStep === 1 && propertyPendingAssign) {
                              refreshPlanDraftsFromSelection(propertyPendingAssign);
                            }
                            setAssignStep((s) => (s + 1) as AssignFlowStep);
                          }}
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled={
                            assigning ||
                            unitsStepInvalid ||
                            !selectedPlanType ||
                            (selectedPlanType !== "cash" && !planApplyMode) ||
                            assignPlanOptions.length === 0
                          }
                          onClick={() => void confirmAssignToPortfolio()}
                        >
                          {assigning ? "Assigning…" : "Confirm & assign"}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </FormSection>
          )}
          {insightCards.length > 0 && (
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              {insightCards.map((card) => (
                <div
                  key={`${card.category}-${card.metric}-${card.headline}`}
                  className="glass-panel rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {card.category}
                    </p>
                    {card.trend ? <StatusBadge value={card.trend} /> : null}
                  </div>
                  <p className="mt-2 text-sm font-medium">{card.headline}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.evidence}</p>
                  {card.metric ? (
                    <p className="mt-2 text-xs text-muted-foreground">{card.metric}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <DataTable
            columns={portfolioColumns}
            rows={portfolioRows}
            rowKey={(r) => r.rowId}
            emptyTitle="No portfolio holdings"
            emptyDescription="Assign properties to this investor to populate portfolio metrics."
          />
        </TabsContent>

        <TabsContent value="activity">
          <DataTable
            columns={[
              { key: "title", header: "Event", cell: (r) => r.title },
              { key: "detail", header: "Detail", cell: (r) => r.detail || "—" },
              { key: "type", header: "Category", cell: (r) => <StatusBadge value={r.type} /> },
              { key: "time", header: "When", cell: (r) => formatDateTime(r.timestamp) },
            ]}
            rows={activity}
            rowKey={(r) => r.id}
            emptyTitle="No activity yet"
          />
        </TabsContent>

        <TabsContent value="signals">
          <DataTable
            columns={[
              { key: "type", header: "Signal", cell: (r) => r.signalType },
              {
                key: "evidence",
                header: "Evidence",
                cell: (r) => r.triggeringActivity || "—",
              },
              {
                key: "strength",
                header: "Strength",
                cell: (r) => <StatusBadge value={r.intentLevel} />,
              },
              { key: "date", header: "Generated", cell: (r) => formatDateTime(r.generatedAt) },
            ]}
            rows={signals}
            rowKey={(r) => r.id}
            emptyTitle="No signals"
          />
          <div className="mt-3">
            <Button variant="outline" asChild>
              <Link href="/signals">Open signals workspace</Link>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {canMutate("investors") && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <Label htmlFor="doc-file">Upload document</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    disabled={uploadingDoc}
                    aria-invalid={!!docError}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setDocFile(file);
                      setDocError(null);
                      if (file && !docName.trim()) setDocName(file.name);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="doc-name">Display name</Label>
                  <Input
                    id="doc-name"
                    placeholder="Document file name.pdf"
                    value={docName}
                    disabled={uploadingDoc}
                    onChange={(e) => setDocName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select
                    value={docCategory}
                    onValueChange={setDocCategory}
                    disabled={uploadingDoc}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contracts">Contracts</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="mortgage">Mortgage</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Visibility</Label>
                  <Select
                    value={docVisibility}
                    onValueChange={(v) =>
                      setDocVisibility(v as DocumentAsset["visibility"])
                    }
                    disabled={uploadingDoc}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="investor">Investor</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {docError && (
                <p className="text-xs text-error" role="alert">
                  {docError}
                </p>
              )}
              <Button
                disabled={uploadingDoc}
                onClick={async () => {
                  if (!docFile) {
                    setDocError("Select a file to upload.");
                    return;
                  }
                  setUploadingDoc(true);
                  setDocError(null);
                  try {
                    const { document: uploaded, message } = await uploadInvestorDocument(
                      investor.id,
                      {
                        file: docFile,
                        name: docName.trim() || docFile.name,
                        visibility: docVisibility,
                        category: docCategory,
                      },
                    );
                    setDocuments((prev) => [
                      uploaded,
                      ...prev.filter((d) => d.id !== uploaded.id),
                    ]);
                    setDocName("");
                    setDocFile(null);
                    setDocCategory("others");
                    setDocVisibility("both");
                    const input = window.document.getElementById(
                      "doc-file",
                    ) as HTMLInputElement | null;
                    if (input) input.value = "";
                    toast.success(message || "Document uploaded");
                    const fresh = await listDocuments({ investorId: investor.id });
                    setDocuments(fresh);
                  } catch (err) {
                    toast.error(
                      err instanceof ApiError
                        ? err.message
                        : "Unable to upload document.",
                    );
                  } finally {
                    setUploadingDoc(false);
                  }
                }}
              >
                {uploadingDoc ? "Uploading…" : "Upload"}
              </Button>
            </div>
          )}
          <DataTable
            columns={[
              {
                key: "name",
                header: "File",
                cell: (r) =>
                  r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.name}
                    </a>
                  ) : (
                    r.name
                  ),
              },
              { key: "cat", header: "Category", cell: (r) => r.category },
              {
                key: "vis",
                header: "Visibility",
                cell: (r) => <StatusBadge value={r.visibility} />,
              },
              { key: "type", header: "Type", cell: (r) => r.fileType },
              { key: "size", header: "Size", cell: (r) => r.size },
              {
                key: "up",
                header: "Uploaded",
                cell: (r) => formatDate(r.uploadedAt),
              },
              {
                key: "exp",
                header: "Expiry",
                cell: (r) => formatDate(r.expiryDate),
              },
              { key: "ver", header: "Version", cell: (r) => `v${r.version}` },
              { key: "dl", header: "Downloads", cell: (r) => r.downloadCount },
              ...(canMutate("investors")
                ? [
                    {
                      key: "actions",
                      header: "",
                      cell: (r: DocumentAsset) => (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-error"
                          aria-label={`Delete ${r.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDocTarget(r);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={documents}
            rowKey={(r) => r.id}
            emptyTitle="No documents for this investor"
            emptyDescription="Upload a file here to attach it to this investor profile."
          />
          <ConfirmDialog
            open={!!deleteDocTarget}
            onOpenChange={(open) => {
              if (!open) setDeleteDocTarget(null);
            }}
            title="Delete document?"
            description={
              deleteDocTarget
                ? `“${deleteDocTarget.name}” will be permanently removed from this investor.`
                : ""
            }
            confirmLabel={deletingDoc ? "Deleting…" : "Delete"}
            destructive
            loading={deletingDoc}
            onConfirm={() => void handleDeleteDocument()}
          />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          {canMutate("investors") && (
            <div className="rounded-md border border-border p-4 space-y-3">
              <Label htmlFor="note">Add note</Label>
              <Textarea
                id="note"
                value={noteBody}
                onChange={(e) => {
                  setNoteBody(e.target.value);
                  if (noteError) setNoteError(null);
                }}
                placeholder="Internal or follow-up note…"
                aria-invalid={!!noteError}
                disabled={savingNote}
              />
              {noteError && (
                <p className="text-xs text-error" role="alert">
                  {noteError}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="space-y-1 sm:w-48">
                  <Label htmlFor="note-kind" className="text-xs text-muted-foreground">
                    Kind
                  </Label>
                  <Select
                    value={noteKind}
                    onValueChange={(v) => setNoteKind(v as Note["kind"])}
                    disabled={savingNote}
                  >
                    <SelectTrigger id="note-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow up</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="sm:mt-5"
                  disabled={savingNote || !user}
                  onClick={async () => {
                    if (!user) return;
                    const body = noteBody.trim();
                    if (body.length < 3) {
                      setNoteError("Note must be at least 3 characters.");
                      return;
                    }
                    setSavingNote(true);
                    setNoteError(null);
                    try {
                      const { note, message } = await addNote({
                        investorId: investor.id,
                        body,
                        kind: noteKind,
                      });
                      setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
                      setNoteBody("");
                      toast.success(message || "Note added");
                      void reloadNotes(investor.id);
                    } catch (err) {
                      toast.error(
                        err instanceof ApiError ? err.message : "Unable to add note.",
                      );
                    } finally {
                      setSavingNote(false);
                    }
                  }}
                >
                  {savingNote ? "Saving…" : "Save note"}
                </Button>
              </div>
            </div>
          )}
          {notesLoading && notes.length === 0 ? (
            <LoadingBlock variant="table" />
          ) : (
            <DataTable
              columns={[
                { key: "body", header: "Note", cell: (r) => r.body },
                { key: "kind", header: "Kind", cell: (r) => <StatusBadge value={r.kind} /> },
                { key: "author", header: "Author", cell: (r) => r.authorName || "—" },
                { key: "at", header: "When", cell: (r) => formatDateTime(r.createdAt) },
              ]}
              rows={notes}
              rowKey={(r) => r.id}
              emptyTitle="No notes"
              emptyDescription="Save a note above to keep a record on this investor."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ProfileDraft = {
  name: string;
  email: string;
  phone: string;
  country: string;
  nationality: string;
  residencyStatus: Investor["residencyStatus"];
  accountStatus: Investor["accountStatus"];
  buyingPower: number | undefined;
  riskAppetite: Investor["riskAppetite"];
};

function profileDraftFromInvestor(investor: Investor): ProfileDraft {
  return {
    name: investor.name,
    email: investor.email,
    phone: investor.phone ?? "",
    country: investor.country,
    nationality: investor.nationality,
    residencyStatus: investor.residencyStatus,
    accountStatus: investor.accountStatus,
    buyingPower: investor.buyingPower,
    riskAppetite: investor.riskAppetite,
  };
}

function profileDraftDirty(a: ProfileDraft, b: ProfileDraft): boolean {
  return (
    a.name !== b.name ||
    a.email !== b.email ||
    a.phone !== b.phone ||
    a.country !== b.country ||
    a.nationality !== b.nationality ||
    a.residencyStatus !== b.residencyStatus ||
    a.accountStatus !== b.accountStatus ||
    a.buyingPower !== b.buyingPower ||
    a.riskAppetite !== b.riskAppetite
  );
}

function validateProfileDraft(draft: ProfileDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = draft.name.trim();
  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  if (name.length > 120) errors.name = "Name is too long.";
  const email = draft.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  const phone = draft.phone.trim();
  if (phone && !/^[+]?[\d\s().-]{7,}$/.test(phone)) {
    errors.phone = "Enter a valid phone number.";
  }
  if (!draft.country.trim()) errors.country = "Country is required.";
  if (!draft.nationality.trim()) errors.nationality = "Nationality is required.";
  if (
    draft.buyingPower == null ||
    !Number.isFinite(draft.buyingPower) ||
    draft.buyingPower < 0
  ) {
    errors.buyingPower = "Enter a valid buying power amount.";
  } else if (draft.buyingPower > 1_000_000_000) {
    errors.buyingPower = "Buying power is too large.";
  }
  return errors;
}

function ProfileFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-error" role="alert">
      {message}
    </p>
  );
}

function SortableRecommendedRow({
  property,
  index,
  sortable,
  editing,
  onRemove,
}: {
  property: PropertyUnit;
  index: number;
  sortable: boolean;
  editing: boolean;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id, disabled: !sortable });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-muted/40" : undefined}>
      <TableCell className="w-10 px-2">
        {sortable ? (
          <button
            type="button"
            className="inline-flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Reorder ${property.name}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="inline-block size-8" aria-hidden />
        )}
      </TableCell>
      <TableCell className="w-14 tabular-nums text-muted-foreground">
        {index + 1}
      </TableCell>
      <TableCell className="min-w-0 font-medium">
        <Link
          href={`/properties/${property.id}`}
          className="truncate hover:underline"
          onClick={(e) => {
            if (isDragging) e.preventDefault();
          }}
        >
          {property.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {property.reference || "—"}
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {property.city || "—"}
      </TableCell>
      {editing ? (
        <TableCell className="w-12 text-right">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${property.name}`}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function RecommendedPropertiesSection({
  investor,
  properties,
  canEdit,
  onUpdated,
}: {
  investor: Investor;
  properties: PropertyUnit[];
  canEdit: boolean;
  onUpdated: (investor: Investor) => void;
}) {
  const dispatch = useAppDispatch();
  const current = investor.recommendedPropertyIds ?? [];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [draft, setDraft] = useState<string[]>(current);
  const [addValue, setAddValue] = useState("");

  useEffect(() => {
    if (!editing) {
      setDraft(investor.recommendedPropertyIds ?? []);
      setAddValue("");
    }
  }, [investor, editing]);

  const orderedIds = editing ? draft : current;

  const recommended = orderedIds
    .map((id) => properties.find((p) => p.id === id))
    .filter((p): p is PropertyUnit => !!p);

  const addOptions = useMemo(
    () =>
      properties
        .filter((p) => !orderedIds.includes(p.id))
        .map((p) => ({
          value: p.id,
          label: p.name,
          keywords: `${p.reference ?? ""} ${p.city ?? ""} ${p.address ?? ""}`,
        })),
    [properties, orderedIds],
  );

  const dirty =
    draft.length !== current.length ||
    draft.some((id, index) => id !== current[index]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const applyUpdated = (updated: Investor, successMessage: string) => {
    onUpdated(updated);
    dispatch(upsertInvestor(updated));
    dispatch(invalidateInvestors());
    toast.success(successMessage);
  };

  /** Full list replace via PATCH investor (`recommendedProperties`). */
  const persistIds = async (ids: string[], successMessage: string) => {
    setSaving(true);
    try {
      const updated = await updateInvestor(investor.id, {
        recommendedPropertyIds: ids,
      });
      applyUpdated(updated, successMessage);
      setEditing(false);
      setAddValue("");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Unable to save recommended properties.",
      );
    } finally {
      setSaving(false);
      setReordering(false);
    }
  };

  /** Display-order only via PUT …/recommended-properties/sort */
  const persistSort = async (ids: string[]) => {
    setReordering(true);
    try {
      const updated = await sortInvestorRecommendedProperties(investor.id, ids);
      applyUpdated(updated, "Recommendation order updated");
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Unable to save recommendation order.",
      );
    } finally {
      setReordering(false);
    }
  };

  const save = () => void persistIds(draft, "Recommended properties updated");

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canEdit || reordering || saving) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = editing ? draft : current;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    if (editing) {
      setDraft(next);
      return;
    }
    void persistSort(next);
  };

  const removeFromDraft = (id: string) => {
    setDraft((prev) => prev.filter((item) => item !== id));
  };

  const addProperty = (id: string) => {
    if (!id || draft.includes(id)) return;
    setDraft((prev) => [...prev, id]);
    setAddValue("");
  };

  const sortable = canEdit && !saving && !reordering;

  return (
    <FormSection
      title="Recommended properties"
      description={
        canEdit
          ? "Shown to the investor on their Explore page. Drag rows to set display order."
          : "Shown to the investor on their Explore page."
      }
      actions={
        canEdit ? (
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                {dirty ? (
                  <Button type="button" size="sm" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraft(current);
                    setAddValue("");
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={reordering}
              >
                Edit
              </Button>
            )}
          </div>
        ) : null
      }
    >
      <div className="space-y-3 md:col-span-2">
        {recommended.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommended properties.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={recommended.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 px-2" />
                      <TableHead className="w-14">S.No</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="hidden sm:table-cell">City</TableHead>
                      {editing ? (
                        <TableHead className="w-12 text-right">
                          <span className="sr-only">Remove</span>
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recommended.map((p, index) => (
                      <SortableRecommendedRow
                        key={p.id}
                        property={p}
                        index={index}
                        sortable={sortable}
                        editing={editing}
                        onRemove={() => removeFromDraft(p.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {editing ? (
          <div className="space-y-1.5">
            <Label htmlFor="investor-recommended-add">Add property</Label>
            <SearchableSelect
              id="investor-recommended-add"
              value={addValue}
              onValueChange={addProperty}
              options={addOptions}
              placeholder={
                addOptions.length === 0
                  ? "All properties already selected"
                  : "Search and add a property…"
              }
              searchPlaceholder="Search properties…"
              emptyMessage="No properties found"
              disabled={saving || addOptions.length === 0}
            />
          </div>
        ) : null}
      </div>
    </FormSection>
  );
}

function InvestorProfileSection({
  investor,
  canEdit,
  onUpdated,
}: {
  investor: Investor;
  canEdit: boolean;
  onUpdated: (investor: Investor) => void;
}) {
  const dispatch = useAppDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => profileDraftFromInvestor(investor));
  const [baseline, setBaseline] = useState(() => profileDraftFromInvestor(investor));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      const next = profileDraftFromInvestor(investor);
      setDraft(next);
      setBaseline(next);
      setErrors({});
    }
  }, [investor, editing]);

  const dirty = useMemo(() => profileDraftDirty(draft, baseline), [draft, baseline]);

  const patchDraft = (patch: Partial<ProfileDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const startEdit = () => {
    const next = profileDraftFromInvestor(investor);
    setDraft(next);
    setBaseline(next);
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    const next = profileDraftFromInvestor(investor);
    setDraft(next);
    setBaseline(next);
    setErrors({});
    setEditing(false);
  };

  const saveProfile = async () => {
    const validationErrors = validateProfileDraft(draft);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateInvestor(investor.id, {
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        country: draft.country,
        nationality: draft.nationality,
        residencyStatus: draft.residencyStatus,
        accountStatus: draft.accountStatus,
        buyingPower: draft.buyingPower ?? 0,
        riskAppetite: draft.riskAppetite,
      });
      onUpdated(updated);
      dispatch(upsertInvestor(updated));
      dispatch(invalidateInvestors());
      toast.success("Investor profile updated");
      setEditing(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to save profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSection
      title="Profile"
      description="Contact and investment preference fields."
      actions={
        canEdit ? (
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                {dirty ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void saveProfile()}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={startEdit}>
                Edit
              </Button>
            )}
          </div>
        ) : null
      }
    >
      {editing ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={draft.name}
              aria-invalid={!!errors.name}
              disabled={saving}
              onChange={(e) => patchDraft({ name: e.target.value })}
            />
            <ProfileFieldError message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={draft.email}
              aria-invalid={!!errors.email}
              disabled={saving}
              onChange={(e) => patchDraft({ email: e.target.value })}
            />
            <ProfileFieldError message={errors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={draft.phone}
              aria-invalid={!!errors.phone}
              disabled={saving}
              onChange={(e) => patchDraft({ phone: e.target.value })}
            />
            <ProfileFieldError message={errors.phone} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Select
              value={draft.country}
              disabled={saving}
              onValueChange={(value) => patchDraft({ country: value })}
            >
              <SelectTrigger className="w-full" aria-invalid={!!errors.country}>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProfileFieldError message={errors.country} />
          </div>
          <div className="space-y-2">
            <Label>Nationality</Label>
            <Select
              value={draft.nationality}
              disabled={saving}
              onValueChange={(value) => patchDraft({ nationality: value })}
            >
              <SelectTrigger className="w-full" aria-invalid={!!errors.nationality}>
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map((nationality) => (
                  <SelectItem key={nationality} value={nationality}>
                    {nationality}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProfileFieldError message={errors.nationality} />
          </div>
          <div className="space-y-2">
            <Label>Residency</Label>
            <Select
              value={draft.residencyStatus}
              disabled={saving}
              onValueChange={(value) =>
                patchDraft({ residencyStatus: value as Investor["residencyStatus"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uk_resident">UK resident</SelectItem>
                <SelectItem value="non_uk_resident">Non-UK resident</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Onboarding" value={titleCase(investor.onboardingStatus)} />
          <div className="space-y-2">
            <Label>Account status</Label>
            <Select
              value={draft.accountStatus}
              disabled={saving}
              onValueChange={(value) =>
                patchDraft({ accountStatus: value as Investor["accountStatus"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-buying-power">Buying power</Label>
            <Input
              id="profile-buying-power"
              type="number"
              min={0}
              step={1000}
              value={draft.buyingPower ?? ""}
              aria-invalid={!!errors.buyingPower}
              disabled={saving}
              onChange={(e) =>
                patchDraft({ buyingPower: numberOrUndefined(e.target.value) })
              }
            />
            <ProfileFieldError message={errors.buyingPower} />
          </div>
          <div className="space-y-2">
            <Label>Risk appetite</Label>
            <Select
              value={draft.riskAppetite}
              disabled={saving}
              onValueChange={(value) =>
                patchDraft({ riskAppetite: value as Investor["riskAppetite"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cautious">Cautious</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <Field label="Name" value={investor.name} />
          <Field label="Email" value={investor.email} />
          <Field label="Phone" value={investor.phone} />
          <Field label="Country" value={investor.country} />
          <Field label="Nationality" value={investor.nationality} />
          <Field label="Residency" value={titleCase(investor.residencyStatus)} />
          <Field label="Onboarding" value={titleCase(investor.onboardingStatus)} />
          <Field label="Account status" value={titleCase(investor.accountStatus)} />
          <Field label="Buying power" value={formatCurrency(investor.buyingPower)} />
          <Field label="Risk appetite" value={titleCase(investor.riskAppetite)} />
        </>
      )}
    </FormSection>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}
