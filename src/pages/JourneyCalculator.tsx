import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  GoalBranchEditor,
  PathStageEditor,
} from "@/components/admin/CalcJourneyEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  CALC_DISCLAIMER,
  CALC_PATHS,
  CALC_PLAN_BLOCKS,
  CALC_QUESTIONS,
  CALC_STAGES,
  type CalcPath,
  type CalcPlanBlock,
  type CalcQuestion,
  type CalcStage,
} from "@/data/calculatorJourneyMock";

function PlanEditor({
  blocks,
  disclaimer,
  canEdit,
  onBlocksChange,
  onDisclaimerChange,
}: {
  blocks: CalcPlanBlock[];
  disclaimer: string;
  canEdit: boolean;
  onBlocksChange: (next: CalcPlanBlock[]) => void;
  onDisclaimerChange: (value: string) => void;
}) {
  const update = (id: string, patch: Partial<CalcPlanBlock>) => {
    onBlocksChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-lg text-foreground">Your Investment Plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Final mobile result screen after Goal → Route → Capital → Finance.
        </p>
      </div>

      <div className="space-y-3">
        {blocks
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((block, i) => (
            <div
              key={block.id}
              className={cn(
                "glass-panel rounded-2xl p-4",
                !block.enabled && "opacity-60",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Block title</Label>
                    <Input
                      value={block.title}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(block.id, { title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>What it shows</Label>
                    <Textarea
                      value={block.description}
                      disabled={!canEdit}
                      rows={2}
                      onChange={(e) =>
                        update(block.id, { description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fed by (previous steps)</Label>
                    <Input
                      value={block.fedBy}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(block.id, { fedBy: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:pt-6">
                  <Switch
                    checked={block.enabled}
                    disabled={!canEdit}
                    aria-label={`Enable ${block.title}`}
                    onCheckedChange={(on) =>
                      update(block.id, { enabled: on })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {block.enabled ? "On" : "Off"}
                  </span>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <Label htmlFor="calc-disclaimer">Disclaimer</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown under every calculator step on mobile, including Plan.
        </p>
        <Textarea
          id="calc-disclaimer"
          className="mt-3"
          value={disclaimer}
          disabled={!canEdit}
          rows={3}
          onChange={(e) => onDisclaimerChange(e.target.value)}
        />
      </div>
    </div>
  );
}

export function JourneyCalculatorPage() {
  const { can } = useAuth();
  const canEdit = can("manage_investor_journey", "investor_journey");

  const [stage, setStage] = useState<CalcStage>("goal");
  const [questions, setQuestions] = useState(CALC_QUESTIONS);
  const [paths, setPaths] = useState(CALC_PATHS);
  const [planBlocks, setPlanBlocks] = useState(CALC_PLAN_BLOCKS);
  const [disclaimer, setDisclaimer] = useState(CALC_DISCLAIMER);
  const [dirty, setDirty] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState(CALC_PATHS[0].id);

  const markDirty = () => setDirty(true);

  const updateQuestion = (next: CalcQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === next.id ? next : q)));
    markDirty();
  };

  const upsertQuestion = (next: CalcQuestion) => {
    setQuestions((prev) => {
      const idx = prev.findIndex(
        (q) => q.id === next.id || q.key === next.key,
      );
      if (idx < 0) return [...prev, next];
      return prev.map((q, i) => (i === idx ? next : q));
    });
    markDirty();
  };

  const jumpStage = (next: CalcStage) => {
    setStage(next);
  };

  const stageMeta = useMemo(
    () => CALC_STAGES.find((s) => s.key === stage),
    [stage],
  );

  const onSave = () => {
    setDirty(false);
    toast.success("Calculator saved locally (UI only — not persisted to API yet).");
  };

  const pathCounts = useMemo(() => {
    const path = paths.find((p) => p.id === selectedPathId) ?? paths[0];
    return {
      route: path.routeSteps.length,
      capital: path.capitalSteps.length,
    };
  }, [selectedPathId, paths]);

  return (
    <div>
      <PageHeader
        title="Calculator-old"
        description="Manage the Mews One calculator journey in the same branching order as mobile: Goal → Route → Capital → Finance → Plan."
        actions={
          canEdit ? (
            <Button type="button" disabled={!dirty} onClick={onSave}>
              {dirty ? "Save changes" : "Saved"}
            </Button>
          ) : undefined
        }
      />

      <div
        role="tablist"
        aria-label="Calculator stages"
        className="mb-6 flex gap-0 overflow-x-auto border-b border-border"
      >
        {CALC_STAGES.map((s) => {
          const active = stage === s.key;
          const count =
            s.key === "plan"
              ? planBlocks.filter((b) => b.enabled).length
              : s.key === "goal"
                ? questions.find((q) => q.key === "goal")?.options.length ?? 0
                : s.key === "route"
                  ? pathCounts.route
                  : s.key === "capital"
                    ? pathCounts.capital
                    : 1;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStage(s.key)}
              className={cn(
                "relative shrink-0 px-4 py-3 text-sm transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-medium">{s.label}</span>
              <span className="ml-1.5 text-xs opacity-60">{count}</span>
              {active && (
                <span
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {stage !== "plan" && (
        <div className="mb-4">
          <h2 className="font-serif text-lg text-foreground">
            {stageMeta?.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {stageMeta?.description}
          </p>
        </div>
      )}

      {stage === "goal" && (
        <GoalBranchEditor
          questions={questions}
          canEdit={canEdit}
          paths={paths}
          onChangeQuestion={updateQuestion}
          onUpsertQuestion={upsertQuestion}
          onJumpStage={jumpStage}
          onOpenPath={(pathId, nextStage = "route") => {
            setSelectedPathId(pathId);
            jumpStage(nextStage);
          }}
        />
      )}

      {(stage === "route" || stage === "capital" || stage === "finance") && (
        <PathStageEditor
          stage={stage}
          questions={questions}
          paths={paths}
          canEdit={canEdit}
          selectedPathId={selectedPathId}
          onSelectPath={setSelectedPathId}
          onChangeQuestion={updateQuestion}
          onUpsertQuestion={upsertQuestion}
          onChangePaths={(next: CalcPath[]) => {
            setPaths(next);
            markDirty();
          }}
          onJumpStage={jumpStage}
        />
      )}

      {stage === "plan" && (
        <PlanEditor
          blocks={planBlocks}
          disclaimer={disclaimer}
          canEdit={canEdit}
          onBlocksChange={(next) => {
            setPlanBlocks(next);
            markDirty();
          }}
          onDisclaimerChange={(value) => {
            setDisclaimer(value);
            markDirty();
          }}
        />
      )}

      {stage !== "plan" && (
        <div className="mt-8 glass-panel rounded-2xl p-4">
          <Label htmlFor="stage-disclaimer">Disclaimer</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Shared footer under every step (also editable on Plan).
          </p>
          <Textarea
            id="stage-disclaimer"
            className="mt-3"
            value={disclaimer}
            disabled={!canEdit}
            rows={3}
            onChange={(e) => {
              setDisclaimer(e.target.value);
              markDirty();
            }}
          />
        </div>
      )}

      {canEdit && dirty && (
        <div className="sticky bottom-4 z-10 mt-6 flex justify-end">
          <Button type="button" className="shadow-lg" onClick={onSave}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
