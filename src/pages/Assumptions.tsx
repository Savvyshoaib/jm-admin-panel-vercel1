import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import {
  calculatorFromApi,
  calculatorToApi,
  emptyCalculationAssumptions,
  CalculationAssumptionsForm,
} from "@/components/admin/CalculationAssumptionsForm";
import {
  emptyAssumptionUnitDraft,
  PropertyUnitsEditor,
  unitToInsightPutBody,
} from "@/components/admin/PropertyUnitsEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import {
  applyInsightPresetToUnit,
  getCalculatorDefaults,
  getPropertyInsightPreset,
  saveCalculatorDefaults,
  savePropertyInsightPreset,
} from "@/services/api";

export function AssumptionsPage() {
  const { can } = useAuth();
  const canEdit = can("manage_assumptions", "assumptions");
  const [unit, setUnit] = useState(() => emptyAssumptionUnitDraft());
  const [calculations, setCalculations] = useState(emptyCalculationAssumptions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.allSettled([
      getPropertyInsightPreset(),
      getCalculatorDefaults(),
    ]).then(([insight, calc]) => {
      if (cancelled) return;
      if (insight.status === "fulfilled" && insight.value) {
        setUnit((current) => applyInsightPresetToUnit(current, insight.value!));
      } else if (insight.status === "rejected") {
        toast.error(
          insight.reason instanceof ApiError
            ? insight.reason.message
            : "Unable to load property insight presets.",
        );
      }
      if (calc.status === "fulfilled" && calc.value) {
        setCalculations(calculatorFromApi(calc.value));
      } else if (calc.status === "rejected") {
        toast.error(
          calc.reason instanceof ApiError
            ? calc.reason.message
            : "Unable to load calculator defaults.",
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        savePropertyInsightPreset(unitToInsightPutBody(unit)),
        saveCalculatorDefaults(calculatorToApi(calculations)),
      ]);
      toast.success("Assumptions saved.");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Unable to save assumptions.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock variant="form" label="Loading assumptions…" />;

  return (
    <div>
      <PageHeader
        title="Calculations & Assumptions"
        description="Presets used when creating a property or adding a unit."
      />
      <Tabs defaultValue="property">
        <TabsList>
          <TabsTrigger value="property">Property insights</TabsTrigger>
          <TabsTrigger value="calculations">Calculations</TabsTrigger>
        </TabsList>
        <TabsContent value="property" className="mt-4">
          <PropertyUnitsEditor
            unit={unit}
            onUnitChange={setUnit}
            canEdit={canEdit}
          />
        </TabsContent>
        <TabsContent value="calculations" className="mt-4">
          <CalculationAssumptionsForm
            value={calculations}
            onChange={setCalculations}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
      {canEdit && (
        <div className="mt-4 flex gap-2">
          <Button type="button" disabled={saving} onClick={() => void onSave()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
