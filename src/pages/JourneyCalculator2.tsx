import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { EmptyState } from "@/components/admin/EmptyState";
import { FormSection } from "@/components/admin/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import {
  calcQuestionToStage,
  questionsForPath,
  stageToCalcQuestion,
  type CalculationLogic,
  type CalculatorFlowRecord,
  type FlowStage,
} from "@/services/calculatorFlowsApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureCalculatorFlow,
  saveCalculatorFlow,
} from "@/store/slices/calculatorFlowSlice";
import {
  getQuestionByKey,
  isConditionalPathStep,
  mobileSequenceForPath,
  mobileStageLabel,
  nextStepLabel,
  nextStepStage,
  type CalcOption,
  type CalcPath,
  type CalcPathStep,
  type CalcQuestion,
  type CalcQuestionKey,
  type CalcStage,
} from "@/data/calculatorJourneyMock";

function StageBadge({ stage }: { stage: CalcStage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        stage === "goal" &&
          "border-primary bg-primary/15 text-primary",
        stage === "route" && "border-primary/40 text-primary",
        stage === "capital" && "border-primary/40 text-primary",
        stage === "finance" && "border-primary/40 text-primary",
      )}
    >
      {mobileStageLabel(stage)}
    </span>
  );
}

function StageSectionHeader({
  stage,
  count,
  conditionalCount = 0,
}: {
  stage: CalcStage;
  count: number;
  conditionalCount?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 pt-2">
      <StageBadge stage={stage} />
      <h3 className="text-sm font-medium text-foreground">
        {mobileStageLabel(stage)}
      </h3>
      <span className="text-xs text-muted-foreground">
        {count} on mobile
        {conditionalCount > 0
          ? ` · +${conditionalCount} only when earlier answers match`
          : " · fixed order"}
      </span>
    </div>
  );
}

function ConditionalSectionHeader() {
  return (
    <div className="rounded-sm border border-dashed border-border/80 bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium text-foreground">
        Conditional (mobile only when earlier answers match)
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Same as the app: e.g. current income only for existing investors — not
        shown on the first-time Route.
      </p>
    </div>
  );
}

function SimpleOptionRow({
  option,
  questions,
  path,
  canEdit,
  showRate,
  onChange,
}: {
  option: CalcOption;
  questions: CalcQuestion[];
  path?: CalcPath;
  canEdit: boolean;
  showRate?: boolean;
  onChange: (next: CalcOption) => void;
}) {
  const nextLabel = option.nextQuestionKey
    ? nextStepLabel(questions, option.nextQuestionKey)
    : null;
  const nextTab =
    option.nextStage ??
    (option.nextQuestionKey
      ? nextStepStage(option.nextQuestionKey, questions)
      : null);

  /** When the immediate next is conditional, show what follows if it is skipped. */
  const otherwiseLabel = (() => {
    if (!path || !option.nextQuestionKey || option.nextQuestionKey === "plan") {
      return null;
    }
    const steps = mobileSequenceForPath(path);
    const nextIdx = steps.findIndex(
      (s) => s.questionKey === option.nextQuestionKey,
    );
    if (nextIdx < 0) return null;
    const when = (steps[nextIdx]?.when ?? "").toLowerCase();
    if (!when.includes("only") && !when.includes("shown when")) return null;
    const fallback = steps[nextIdx + 1];
    if (!fallback) return null;
    return nextStepLabel(questions, fallback.questionKey);
  })();

  return (
    <li className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex gap-3">
        <span
          className="mt-2.5 size-4 shrink-0 rounded-full border border-muted-foreground/40"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            value={option.label}
            disabled={!canEdit}
            aria-label="Option"
            onChange={(e) => onChange({ ...option, label: e.target.value })}
          />
          <Input
            value={option.description ?? ""}
            disabled={!canEdit}
            placeholder="Description (optional)"
            aria-label="Option description"
            onChange={(e) =>
              onChange({
                ...option,
                description: e.target.value || undefined,
              })
            }
          />
          {showRate && (
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">
                Rate %
              </Label>
              <Input
                type="number"
                step="0.01"
                className="max-w-[8rem]"
                value={option.indicativeRate ?? ""}
                disabled={!canEdit}
                aria-label="Indicative mortgage rate"
                onChange={(e) =>
                  onChange({
                    ...option,
                    indicativeRate: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          )}
          {option.badge ? (
            <p className="text-[11px] uppercase tracking-wide text-primary">
              {option.badge}
            </p>
          ) : null}
          {nextLabel ? (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>
                Next:{" "}
                <span className="font-medium text-foreground/90">{nextLabel}</span>
                {nextTab ? (
                  <span>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-foreground/80">
                      {mobileStageLabel(nextTab)}
                    </span>{" "}
                    tab
                  </span>
                ) : null}
              </p>
              {otherwiseLabel ? (
                <p className="text-[11px]">
                  If skipped (e.g. first investment):{" "}
                  <span className="font-medium text-foreground/80">
                    {otherwiseLabel}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function JourneyQuestionCard({
  question,
  questions,
  path,
  stepIndex,
  stepTotal,
  whenLabel,
  defaultOpen,
  canEdit,
  onChange,
}: {
  question: CalcQuestion;
  questions: CalcQuestion[];
  path?: CalcPath;
  stepIndex: number;
  stepTotal: number;
  whenLabel: string;
  defaultOpen: boolean;
  canEdit: boolean;
  onChange: (next: CalcQuestion) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const options = useMemo(
    () =>
      question.options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [question.options],
  );

  const followUpOptions = useMemo(
    () =>
      question.followUp
        ? question.followUp.options
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [question.followUp],
  );

  const updateOption = (id: string, next: CalcOption) => {
    onChange({
      ...question,
      options: question.options.map((o) => (o.id === id ? next : o)),
    });
  };

  const updateFollowUpOption = (id: string, next: CalcOption) => {
    if (!question.followUp) return;
    onChange({
      ...question,
      followUp: {
        ...question.followUp,
        options: question.followUp.options.map((o) =>
          o.id === id ? next : o,
        ),
      },
    });
  };

  return (
    <article className="glass-panel rounded-2xl">
      <div className="flex items-start gap-1 px-2 py-3 sm:px-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 px-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-xs tabular-nums text-muted-foreground">
            {stepIndex}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={question.stage} />
              <span className="text-[11px] text-muted-foreground">
                Step {stepIndex} of {stepTotal}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{whenLabel}</p>
            <p className="mt-0.5 font-serif text-base leading-snug text-foreground">
              {question.title || "Untitled question"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {options.length} option{options.length === 1 ? "" : "s"}
              {question.followUp
                ? ` · + ${followUpOptions.length} residency`
                : ""}
            </p>
          </div>
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor={`q2-${question.id}`}>Question</Label>
            <Input
              id={`q2-${question.id}`}
              value={question.title}
              disabled={!canEdit}
              onChange={(e) =>
                onChange({ ...question, title: e.target.value })
              }
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Options</h3>
            <ul className="space-y-2">
              {options.map((option) => (
                <SimpleOptionRow
                  key={option.id}
                  option={option}
                  questions={questions}
                  path={path}
                  canEdit={canEdit}
                  onChange={(next) => updateOption(option.id, next)}
                />
              ))}
            </ul>
          </div>

          {question.key === "finance" && question.followUp && (
            <div className="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StageBadge stage="finance" />
                  <span className="text-xs text-muted-foreground">
                    Mortgage · same screen on mobile
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {question.followUp.title}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`q2-res-${question.id}`}>Question</Label>
                <Input
                  id={`q2-res-${question.id}`}
                  value={question.followUp.title}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...question,
                      followUp: {
                        ...question.followUp!,
                        title: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Residency options</h3>
                <ul className="space-y-2">
                  {followUpOptions.map((option) => (
                    <SimpleOptionRow
                      key={option.id}
                      option={option}
                      questions={questions}
                      canEdit={canEdit}
                      showRate
                      onChange={(next) =>
                        updateFollowUpOption(option.id, next)
                      }
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function flowToQuestions(flow: CalculatorFlowRecord): CalcQuestion[] {
  return flow.stages.map((s, i) => stageToCalcQuestion(s, i));
}

function upsertStage(stages: FlowStage[], stage: FlowStage): FlowStage[] {
  const key = stage.key;
  if (!key) return [...stages, stage];
  let found = false;
  const next = stages.map((s) => {
    if (s.key !== key) return s;
    found = true;
    return stage;
  });
  return found ? next : [...next, stage];
}

/** Keep path tab labels in sync with Goal question options (API / edits). */
function syncPathsFromGoalOptions(
  paths: CalcPath[],
  goalQuestion: CalcQuestion | undefined,
): CalcPath[] {
  if (!goalQuestion?.options?.length) return paths;
  const byValue = new Map(
    goalQuestion.options.map((o) => [o.value, o] as const),
  );
  return paths.map((p) => {
    const opt = byValue.get(p.goalValue);
    if (!opt) return p;
    return {
      ...p,
      label: opt.label || p.label,
      description: opt.description ?? p.description,
    };
  });
}

/**
 * Persist an edited question so admin UI + API stay in sync.
 * Question/option copy is shared: update `stages` and every path bucket.
 */
function applyQuestionEdit(
  flow: CalculatorFlowRecord,
  pathId: string,
  next: CalcQuestion,
): CalculatorFlowRecord {
  const stage = calcQuestionToStage(next, next.sortOrder);
  const stages = upsertStage(flow.stages, stage);

  const questionsByPath: CalculatorFlowRecord["questionsByPath"] = {
    ...flow.questionsByPath,
  };
  const pathIds = new Set([
    ...Object.keys(questionsByPath),
    ...flow.paths.map((p) => p.id),
    pathId,
  ]);
  for (const id of pathIds) {
    questionsByPath[id] = {
      ...(questionsByPath[id] ?? {}),
      [next.key]: stage,
    };
  }

  if (next.key === "goal") {
    const goal = stageToCalcQuestion(stage, 0);
    return {
      ...flow,
      stages,
      questionsByPath,
      paths: syncPathsFromGoalOptions(flow.paths, goal),
    };
  }

  return {
    ...flow,
    stages,
    questionsByPath,
  };
}

export function JourneyCalculator2Page() {
  const { can } = useAuth();
  const canEdit = can("manage_investor_journey", "investor_journey");
  const dispatch = useAppDispatch();
  const flowState = useAppSelector((s) => s.calculatorFlow);

  const [draft, setDraft] = useState<CalculatorFlowRecord | null>(null);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void dispatch(ensureCalculatorFlow())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(
          typeof err === "string" ? err : "Unable to load calculator flow.",
        );
      });
  }, [dispatch, flowState.invalidated]);

  useEffect(() => {
    if (!flowState.flow) return;
    // Don't clobber in-progress edits if a background refetch lands mid-type
    if (dirty) return;
    const cloned = structuredClone(flowState.flow);
    if (!cloned.questionsByPath) cloned.questionsByPath = {};
    const qs = flowToQuestions(cloned);
    const goal = qs.find((q) => q.key === "goal");
    const next = {
      ...cloned,
      paths: syncPathsFromGoalOptions(cloned.paths, goal),
    };
    setDraft(next);
    setSelectedPathId((prev) => prev || next.paths[0]?.id || "");
    setDirty(false);
    setHydrated(true);
  }, [flowState.flow, dirty]);

  const pathId = selectedPathId || draft?.paths[0]?.id || "";

  const questions = useMemo(
    () => (draft ? questionsForPath(draft, pathId) : []),
    [draft, pathId],
  );
  const goalQuestion = useMemo(() => {
    if (!draft) return undefined;
    return flowToQuestions(draft).find((q) => q.key === "goal");
  }, [draft]);
  const paths = useMemo(() => {
    if (!draft) return [];
    return syncPathsFromGoalOptions(draft.paths, goalQuestion);
  }, [draft, goalQuestion]);
  const path = paths.find((p) => p.id === selectedPathId) ?? paths[0];

  const defaultSteps = useMemo(
    () => (path ? mobileSequenceForPath(path) : []),
    [path],
  );

  const whenByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of defaultSteps) map.set(s.questionKey, s.when);
    return map;
  }, [defaultSteps]);

  // Sequence is locked to the product path spec — never free-reorder.
  const orderedKeys = defaultSteps.map((s) => s.questionKey);

  useEffect(() => {
    if (!path || !draft) return;
    const locked = mobileSequenceForPath(path).map((s) => s.questionKey);
    const current = draft.ordersByPath[path.id];
    if (
      current &&
      current.length === locked.length &&
      current.every((k, i) => k === locked[i])
    ) {
      return;
    }
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ordersByPath: {
          ...prev.ordersByPath,
          [path.id]: locked,
        },
      };
    });
  }, [path, draft]);

  const orderedSteps: CalcPathStep[] = useMemo(() => {
    return orderedKeys
      .map((key) => ({
        questionKey: key,
        when: whenByKey.get(key) ?? "On this path",
      }))
      .filter((s) => getQuestionByKey(questions, s.questionKey));
  }, [orderedKeys, whenByKey, questions]);

  const updateQuestion = (next: CalcQuestion) => {
    if (!pathId) return;
    setDraft((prev) => {
      if (!prev) return prev;
      return applyQuestionEdit(prev, pathId, next);
    });
    setDirty(true);
  };

  const updateLogic = (patch: Partial<CalculationLogic>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calculationLogic: { ...prev.calculationLogic, ...patch },
      };
    });
    setDirty(true);
  };

  const onSave = async () => {
    if (!canEdit || !draft) return;
    setSaving(true);
    try {
      // Always persist canonical path order with the draft
      const paths = draft.paths;
      const ordersByPath = Object.fromEntries(
        paths.map((p) => [
          p.id,
          mobileSequenceForPath(p).map((s) => s.questionKey),
        ]),
      );
      await dispatch(
        saveCalculatorFlow({ ...draft, ordersByPath }),
      ).unwrap();
      setDirty(false);
      toast.success(
        USE_MOCK_DATA ? "Calculator saved (mock mode)." : "Calculator saved.",
      );
    } catch (err) {
      toast.error(
        typeof err === "string" ? err : "Unable to save calculator flow.",
      );
    } finally {
      setSaving(false);
    }
  };

  const stageCounts = useMemo(() => {
    const always: Record<CalcStage, number> = {
      goal: 0,
      route: 0,
      capital: 0,
      finance: 0,
      plan: 0,
    };
    const conditional: Record<CalcStage, number> = {
      goal: 0,
      route: 0,
      capital: 0,
      finance: 0,
      plan: 0,
    };
    for (const step of orderedSteps) {
      const q = getQuestionByKey(questions, step.questionKey);
      if (!q) continue;
      if (isConditionalPathStep(step.when)) conditional[q.stage] += 1;
      else always[q.stage] += 1;
    }
    return { always, conditional };
  }, [orderedSteps, questions]);

  const alwaysStepTotal = useMemo(
    () =>
      orderedSteps.filter(
        (s) =>
          getQuestionByKey(questions, s.questionKey) &&
          !isConditionalPathStep(s.when),
      ).length,
    [orderedSteps, questions],
  );

  const listNodes = useMemo(() => {
    const nodes: {
      type: "header" | "conditionalHeader" | "card";
      stage?: CalcStage;
      step?: CalcPathStep;
      index?: number;
      conditional?: boolean;
    }[] = [];

    const stageOrder: CalcStage[] = ["goal", "route", "capital", "finance"];
    for (const stage of stageOrder) {
      const stageSteps = orderedSteps.filter((step) => {
        const q = getQuestionByKey(questions, step.questionKey);
        return q?.stage === stage;
      });
      if (!stageSteps.length) continue;

      const always = stageSteps.filter((s) => !isConditionalPathStep(s.when));
      const conditional = stageSteps.filter((s) =>
        isConditionalPathStep(s.when),
      );

      nodes.push({ type: "header", stage });

      for (const step of always) {
        const globalAlwaysIndex =
          orderedSteps
            .filter(
              (s) =>
                getQuestionByKey(questions, s.questionKey) &&
                !isConditionalPathStep(s.when),
            )
            .findIndex((s) => s.questionKey === step.questionKey) + 1;
        nodes.push({
          type: "card",
          step,
          index: globalAlwaysIndex,
          conditional: false,
        });
      }

      if (conditional.length) {
        nodes.push({ type: "conditionalHeader", stage });
        conditional.forEach((step, i) => {
          nodes.push({
            type: "card",
            step,
            index: i + 1,
            conditional: true,
          });
        });
      }
    }
    return nodes;
  }, [orderedSteps, questions]);

  if (flowState.status === "loading" && !hydrated) {
    return <LoadingBlock variant="form" />;
  }

  if (flowState.status === "failed" && !hydrated) {
    return (
      <EmptyState
        title="Unable to load calculator"
        description={flowState.error ?? "Please try again."}
        action={
          <Button
            type="button"
            onClick={() => {
              void dispatch(ensureCalculatorFlow({ force: true }));
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  if (!draft) {
    return <LoadingBlock variant="form" />;
  }

  const logic = draft.calculationLogic;

  return (
    <div>
      <PageHeader
        title="Calculator"
        description="Locked journey sequence — Goal → Route → Capital → Finance, per branch. Conditional steps show only when earlier answers match."
        actions={
          canEdit ? (
            <Button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6">
        <h2 className="font-serif text-lg text-foreground">Journey</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Same question order as mobile for this Goal branch. Edit any question
          or option text — Save writes it to the API. Conditional steps sit under
          each stage and only appear on mobile when earlier answers match.
        </p>
        <div
          role="tablist"
          aria-label="Goal branches"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {paths.map((p: CalcPath) => {
            const active = p.id === path?.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedPathId(p.id)}
                className={cn(
                  "rounded-sm border px-3 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {listNodes.map((node, i) => {
          if (node.type === "header" && node.stage) {
            return (
              <StageSectionHeader
                key={`hdr_${node.stage}_${i}`}
                stage={node.stage}
                count={stageCounts.always[node.stage]}
                conditionalCount={stageCounts.conditional[node.stage]}
              />
            );
          }
          if (node.type === "conditionalHeader") {
            return (
              <ConditionalSectionHeader
                key={`cond_hdr_${node.stage}_${i}`}
              />
            );
          }
          if (node.type === "card" && node.step && node.index && path) {
            const q = getQuestionByKey(
              questions,
              node.step.questionKey as CalcQuestionKey,
            );
            if (!q) return null;
            return (
              <JourneyQuestionCard
                key={`${path.id}_${node.step.questionKey}`}
                question={q}
                questions={questions}
                path={path}
                stepIndex={node.index}
                stepTotal={
                  node.conditional ? node.index : alwaysStepTotal
                }
                whenLabel={node.step.when}
                defaultOpen={
                  (!node.conditional && node.index === 1) ||
                  q.key === "finance"
                }
                canEdit={canEdit}
                onChange={updateQuestion}
              />
            );
          }
          return null;
        })}
      </div>

      <div className="mt-8">
      <FormSection
        title="Calculation logic"
        description="Rates used with this calculator flow (ltv, SDLT, yield, growth)."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["ltvPct", "LTV %"],
              ["sdltPct", "SDLT %"],
              ["yieldPct", "Yield %"],
              ["growthPct", "Growth %"],
              ["otherFees", "Other fees"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`logic-${key}`}>{label}</Label>
              <Input
                id={`logic-${key}`}
                type="number"
                step="0.01"
                value={logic[key]}
                disabled={!canEdit}
                onChange={(e) =>
                  updateLogic({ [key]: Number(e.target.value) || 0 })
                }
              />
            </div>
          ))}
        </div>
      </FormSection>
      </div>

      {canEdit && dirty && (
        <div className="sticky bottom-4 z-10 mt-6 flex justify-end">
          <Button
            type="button"
            className="shadow-lg"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
