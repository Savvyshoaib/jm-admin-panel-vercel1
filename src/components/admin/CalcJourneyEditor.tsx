import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  CornerDownRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createBlankQuestion,
  createLinkedOption,
  createStarterOptions,
  getQuestionByKey,
  nextStepLabel,
  nextStepStage,
  stageForQuestionKey,
  type CalcOption,
  type CalcPath,
  type CalcQuestion,
  type CalcQuestionKey,
  type CalcStage,
} from "@/data/calculatorJourneyMock";

const MAX_NEST_DEPTH = 5;

const STAGE_LABEL: Record<CalcStage | "plan", string> = {
  goal: "Goal",
  route: "Route",
  capital: "Capital",
  finance: "Finance",
  plan: "Plan",
};

type JourneyHandlers = {
  onChangeQuestion: (next: CalcQuestion) => void;
  onUpsertQuestion: (next: CalcQuestion) => void;
  onJumpStage?: (stage: CalcStage) => void;
  onOpenPath?: (pathId: string, stage?: CalcStage) => void;
  paths: CalcPath[];
};

function StageChip({
  stage,
  onClick,
}: {
  stage: CalcStage | "plan";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        onClick && "hover:border-primary/40 hover:text-foreground",
      )}
    >
      {STAGE_LABEL[stage]}
    </button>
  );
}

function NextStepBadge({
  questions,
  next,
  onJump,
}: {
  questions: CalcQuestion[];
  next?: CalcQuestionKey | "plan" | null;
  onJump?: (stage: CalcStage) => void;
}) {
  const label = nextStepLabel(questions, next);
  const stage = nextStepStage(next, questions);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <CornerDownRight className="size-3.5 shrink-0 text-primary" />
      <span className="font-medium text-foreground/80">Next:</span>
      <span className="font-medium text-foreground">{label}</span>
      {stage && stage !== "plan" && (
        <>
          <span>·</span>
          <StageChip
            stage={stage}
            onClick={onJump ? () => onJump(stage) : undefined}
          />
          <span>tab</span>
        </>
      )}
      {stage === "plan" && (
        <>
          <span>·</span>
          <StageChip stage="plan" />
          <span>tab</span>
        </>
      )}
    </div>
  );
}

function defaultNextStage(from: CalcStage): CalcStage {
  if (from === "goal") return "route";
  if (from === "route") return "capital";
  if (from === "capital") return "finance";
  return "finance";
}

function NextQuestionPicker({
  option,
  parentStage,
  questions,
  canEdit,
  excludeKeys,
  onLinkExisting,
  onCreateNext,
  onClear,
  onLinkPlan,
}: {
  option: CalcOption;
  parentStage: CalcStage;
  questions: CalcQuestion[];
  canEdit: boolean;
  excludeKeys: Set<string>;
  onLinkExisting: (key: CalcQuestionKey) => void;
  onCreateNext: () => void;
  onClear: () => void;
  onLinkPlan: () => void;
}) {
  const value =
    option.nextQuestionKey === "plan"
      ? "plan"
      : option.nextQuestionKey
        ? option.nextQuestionKey
        : "__continue__";

  const byStage = useMemo(() => {
    const groups: Record<CalcStage, CalcQuestion[]> = {
      goal: [],
      route: [],
      capital: [],
      finance: [],
      plan: [],
    };
    for (const q of questions) {
      if (excludeKeys.has(q.key)) continue;
      groups[q.stage].push(q);
    }
    return groups;
  }, [questions, excludeKeys]);

  return (
    <div className="space-y-1.5">
      <Label>What opens next?</Label>
      <p className="text-xs text-muted-foreground">
        Choose an existing question, jump to Plan, or create a new question
        with answer options under this choice.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={value}
          disabled={!canEdit}
          onValueChange={(v) => {
            if (v === "__continue__") onClear();
            else if (v === "plan") onLinkPlan();
            else if (v === "__create__") onCreateNext();
            else onLinkExisting(v);
          }}
        >
          <SelectTrigger className="w-full sm:max-w-md">
            <SelectValue placeholder="Select next step" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__continue__">Continues on this path</SelectItem>
            <SelectItem value="plan">Your Investment Plan</SelectItem>
            <SelectItem value="__create__">
              + Create new question under this option
            </SelectItem>
            {(
              ["goal", "route", "capital", "finance"] as CalcStage[]
            ).map((stage) =>
              byStage[stage].length === 0 ? null : (
                <SelectGroup key={stage}>
                  <SelectLabel>{STAGE_LABEL[stage]}</SelectLabel>
                  {byStage[stage].map((q) => (
                    <SelectItem key={q.key} value={q.key}>
                      {q.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ),
            )}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCreateNext}
          >
            <Plus className="size-3.5" />
            New question
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        New questions default to the{" "}
        <span className="text-foreground">
          {STAGE_LABEL[defaultNextStage(parentStage)]}
        </span>{" "}
        tab (same as mobile).
      </p>
    </div>
  );
}

function NestedNextQuestion({
  option,
  questions,
  canEdit,
  depth,
  parentKey,
  visited,
  handlers,
}: {
  option: CalcOption;
  questions: CalcQuestion[];
  canEdit: boolean;
  depth: number;
  parentKey: string;
  visited: Set<string>;
  handlers: JourneyHandlers;
}) {
  const nextKey = option.nextQuestionKey;
  if (!nextKey || nextKey === "plan") {
    if (nextKey === "plan") {
      return (
        <div className="mt-3 rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          This option finishes the journey and opens{" "}
          <span className="font-medium text-foreground">Plan</span>.
        </div>
      );
    }
    return (
      <div className="mt-3 rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
        No next question linked yet. Use{" "}
        <span className="font-medium text-foreground">What opens next?</span>{" "}
        above to attach or create one — its answer options will appear here.
      </div>
    );
  }

  const nextQ = getQuestionByKey(questions, nextKey);
  if (!nextQ) {
    return (
      <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        Linked question “{nextKey}” is missing. Create a new question or pick
        another target.
      </div>
    );
  }

  if (visited.has(nextQ.key) || depth >= MAX_NEST_DEPTH) {
    return (
      <div className="mt-3 rounded-md border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
        Next: {nextQ.title}{" "}
        <StageChip
          stage={nextQ.stage}
          onClick={
            handlers.onJumpStage
              ? () => handlers.onJumpStage?.(nextQ.stage)
              : undefined
          }
        />
      </div>
    );
  }

  const path = handlers.paths.find(
    (p) => p.entryQuestionKey === nextQ.key || p.goalValue === option.value,
  );
  const nextVisited = new Set(visited);
  nextVisited.add(parentKey);
  nextVisited.add(nextQ.key);

  return (
    <div className="mt-3 space-y-2 rounded-md border border-primary/25 bg-primary/5 p-3">
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-primary">
        <CornerDownRight className="size-3.5" />
        Opens next · Option → Question → Answer options
        <StageChip
          stage={nextQ.stage}
          onClick={
            handlers.onJumpStage
              ? () => handlers.onJumpStage?.(nextQ.stage)
              : undefined
          }
        />
      </p>
      <QuestionEditor
        question={nextQ}
        questions={questions}
        canEdit={canEdit}
        defaultExpanded
        depth={depth + 1}
        visited={nextVisited}
        whenLabel={`After “${option.label || "this option"}”`}
        handlers={handlers}
      />
      {path && handlers.onOpenPath && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => handlers.onOpenPath?.(path.id, "route")}
        >
          View full {path.label} route
          <ArrowRight className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

function SortableOptionRow({
  option,
  question,
  questions,
  canEdit,
  expanded,
  depth,
  visited,
  onToggle,
  onChange,
  onRemove,
  handlers,
}: {
  option: CalcOption;
  question: CalcQuestion;
  questions: CalcQuestion[];
  canEdit: boolean;
  expanded: boolean;
  depth: number;
  visited: Set<string>;
  onToggle: () => void;
  onChange: (next: CalcOption) => void;
  onRemove: () => void;
  handlers: JourneyHandlers;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const excludeKeys = useMemo(() => {
    const s = new Set(visited);
    s.add(question.key);
    return s;
  }, [visited, question.key]);

  const createNextUnderOption = () => {
    const blank = createBlankQuestion(defaultNextStage(question.stage), {
      title: `Follow-up after “${option.label || "option"}”`,
      caption: "Next step",
    });
    handlers.onUpsertQuestion(blank);
    onChange({ ...option, nextQuestionKey: blank.key });
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border border-border bg-background/50",
        expanded && "border-primary/30",
      )}
    >
      <div className="flex gap-2 p-3">
        {canEdit && (
          <button
            type="button"
            className="mt-1 cursor-grab touch-none rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            aria-label={`Drag to reorder ${option.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {option.label || "Untitled option"}
                  {option.badge ? (
                    <Badge variant="secondary" className="ml-2 align-middle">
                      {option.badge}
                    </Badge>
                  ) : null}
                </p>
                {option.description ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                ) : null}
                <NextStepBadge
                  questions={questions}
                  next={option.nextQuestionKey}
                  onJump={handlers.onJumpStage}
                />
              </div>
              <ChevronDown
                className={cn(
                  "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                  !expanded && "-rotate-90",
                )}
              />
            </div>
          </button>

          {expanded && (
            <div className="mt-3 space-y-4 border-t border-border pt-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Option label</Label>
                  <Input
                    value={option.label}
                    disabled={!canEdit}
                    onChange={(e) =>
                      onChange({ ...option, label: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Badge (optional)</Label>
                  <Input
                    value={option.badge ?? ""}
                    disabled={!canEdit}
                    placeholder="SUGGESTED"
                    onChange={(e) =>
                      onChange({
                        ...option,
                        badge: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={option.description ?? ""}
                  disabled={!canEdit}
                  onChange={(e) =>
                    onChange({
                      ...option,
                      description: e.target.value || undefined,
                    })
                  }
                />
              </div>

              <NextQuestionPicker
                option={option}
                parentStage={question.stage}
                questions={questions}
                canEdit={canEdit}
                excludeKeys={excludeKeys}
                onClear={() =>
                  onChange({ ...option, nextQuestionKey: undefined })
                }
                onLinkPlan={() =>
                  onChange({ ...option, nextQuestionKey: "plan" })
                }
                onLinkExisting={(key) =>
                  onChange({ ...option, nextQuestionKey: key })
                }
                onCreateNext={createNextUnderOption}
              />

              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Show in app</p>
                  <p className="text-xs text-muted-foreground">
                    Hidden options are skipped on mobile.
                  </p>
                </div>
                <Switch
                  checked={option.active}
                  disabled={!canEdit}
                  onCheckedChange={(on) =>
                    onChange({ ...option, active: on })
                  }
                />
              </div>

              {canEdit && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={onRemove}
                  >
                    <Trash2 className="size-3.5" />
                    Remove option
                  </Button>
                </div>
              )}

              <NestedNextQuestion
                option={option}
                questions={questions}
                canEdit={canEdit}
                depth={depth}
                parentKey={question.key}
                visited={visited}
                handlers={handlers}
              />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function QuestionEditor({
  question,
  questions,
  canEdit,
  whenLabel,
  stepIndex,
  stepTotal,
  defaultExpanded,
  depth = 0,
  visited,
  handlers,
}: {
  question: CalcQuestion;
  questions: CalcQuestion[];
  canEdit: boolean;
  whenLabel?: string;
  stepIndex?: number;
  stepTotal?: number;
  defaultExpanded?: boolean;
  depth?: number;
  visited?: Set<string>;
  handlers: JourneyHandlers;
}) {
  const [open, setOpen] = useState(defaultExpanded ?? false);
  const [openOptionId, setOpenOptionId] = useState<string | null>(null);
  const activeVisited = visited ?? new Set<string>([question.key]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const orderedOptions = useMemo(
    () =>
      question.options
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [question.options],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedOptions.findIndex((o) => o.id === active.id);
    const newIndex = orderedOptions.findIndex((o) => o.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const moved = arrayMove(orderedOptions, oldIndex, newIndex).map(
      (o, i) => ({ ...o, sortOrder: i + 1 }),
    );
    handlers.onChangeQuestion({ ...question, options: moved });
  };

  const updateOption = (id: string, next: CalcOption) => {
    handlers.onChangeQuestion({
      ...question,
      options: question.options.map((o) => (o.id === id ? next : o)),
    });
  };

  /** Add option + auto-create linked next question with starter answers. */
  const addOptionWithBranch = () => {
    const nextQ = createBlankQuestion(defaultNextStage(question.stage), {
      title: "New question",
      caption: "Next step",
    });
    const option = createLinkedOption(
      `New option ${question.options.length + 1}`,
      question.options.length + 1,
      nextQ,
    );
    handlers.onUpsertQuestion(nextQ);
    handlers.onChangeQuestion({
      ...question,
      options: [...question.options, option],
    });
    setOpen(true);
    setOpenOptionId(option.id);
  };

  const removeOption = (id: string) => {
    handlers.onChangeQuestion({
      ...question,
      options: question.options.filter((o) => o.id !== id),
    });
  };

  return (
    <article className="glass-panel rounded-2xl">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {typeof stepIndex === "number" && (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm border border-border text-xs tabular-nums text-muted-foreground">
            {stepIndex}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StageChip stage={question.stage} />
            {whenLabel && (
              <span className="text-[11px] text-muted-foreground">
                {whenLabel}
              </span>
            )}
            {typeof stepTotal === "number" && typeof stepIndex === "number" && (
              <span className="text-[11px] text-muted-foreground">
                Step {stepIndex} of {stepTotal}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-primary">
            {question.caption}
          </p>
          <p className="mt-0.5 font-serif text-base leading-snug text-foreground">
            {question.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {orderedOptions.length} answer option
            {orderedOptions.length === 1 ? "" : "s"}
            {!question.active ? " · Hidden" : ""}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 py-4">
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Progress caption</Label>
              <Input
                value={question.caption}
                disabled={!canEdit}
                onChange={(e) =>
                  handlers.onChangeQuestion({
                    ...question,
                    caption: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea
                value={question.title}
                disabled={!canEdit}
                rows={2}
                onChange={(e) =>
                  handlers.onChangeQuestion({
                    ...question,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Helper text</Label>
              <Textarea
                value={question.helper}
                disabled={!canEdit}
                rows={2}
                onChange={(e) =>
                  handlers.onChangeQuestion({
                    ...question,
                    helper: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instruction</Label>
              <Input
                value={question.instruction}
                disabled={!canEdit}
                onChange={(e) =>
                  handlers.onChangeQuestion({
                    ...question,
                    instruction: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Show in app</p>
                <p className="text-xs text-muted-foreground">
                  Hidden questions are skipped in the journey.
                </p>
              </div>
              <Switch
                checked={question.active}
                disabled={!canEdit}
                onCheckedChange={(on) =>
                  handlers.onChangeQuestion({ ...question, active: on })
                }
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">Answer options</h3>
                <p className="text-xs text-muted-foreground">
                  Adding an option also creates its next question and starter
                  answers — expand to manage the full branch.
                </p>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addOptionWithBranch}
                >
                  <Plus className="size-3.5" />
                  Add option
                </Button>
              )}
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={orderedOptions.map((o) => o.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {orderedOptions.map((option) => (
                    <SortableOptionRow
                      key={option.id}
                      option={option}
                      question={question}
                      questions={questions}
                      canEdit={canEdit}
                      expanded={openOptionId === option.id}
                      depth={depth}
                      visited={activeVisited}
                      onToggle={() =>
                        setOpenOptionId((cur) =>
                          cur === option.id ? null : option.id,
                        )
                      }
                      onChange={(next) => updateOption(option.id, next)}
                      onRemove={() => removeOption(option.id)}
                      handlers={handlers}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>

            {orderedOptions.length === 0 && (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No answer options yet.
                </p>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3"
                    onClick={addOptionWithBranch}
                  >
                    <Plus className="size-3.5" />
                    Add option with next question
                  </Button>
                )}
              </div>
            )}
          </div>

          {question.followUp && (
            <div className="rounded-md border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-medium">Same-screen follow-up</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Shown under the main question on mobile (e.g. residency).
              </p>
              <p className="font-serif text-sm">{question.followUp.title}</p>
              <ul className="mt-2 space-y-1">
                {question.followUp.options
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                      {o.label}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function PathFlow({
  path,
  questions,
  canEdit,
  steps,
  stage,
  handlers,
  onAddStep,
}: {
  path: CalcPath;
  questions: CalcQuestion[];
  canEdit: boolean;
  steps: CalcPath["routeSteps"] | CalcPath["capitalSteps"];
  stage: "route" | "capital";
  handlers: JourneyHandlers;
  onAddStep: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-dashed border-border bg-muted/10 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Branch
        </p>
        <p className="mt-0.5 font-serif text-base text-foreground">
          {path.label}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{path.description}</p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Opens with</span>
          <ArrowRight className="size-3" />
          <span className="text-foreground">
            {getQuestionByKey(questions, path.entryQuestionKey)?.title}
          </span>
          <StageChip
            stage={stageForQuestionKey(path.entryQuestionKey, questions)}
            onClick={
              handlers.onJumpStage
                ? () =>
                    handlers.onJumpStage?.(
                      stageForQuestionKey(path.entryQuestionKey, questions),
                    )
                : undefined
            }
          />
        </p>
      </div>

      {steps.map((step, i) => {
        const q = getQuestionByKey(questions, step.questionKey);
        if (!q) return null;
        return (
          <div key={`${path.id}_${step.questionKey}_${i}`} className="relative">
            {i > 0 && (
              <div
                className="absolute -top-3 left-7 flex h-3 w-px bg-border"
                aria-hidden
              />
            )}
            <QuestionEditor
              question={q}
              questions={questions}
              canEdit={canEdit}
              whenLabel={step.when}
              stepIndex={i + 1}
              stepTotal={steps.length}
              defaultExpanded={i === 0}
              handlers={handlers}
            />
          </div>
        );
      })}

      {canEdit && (
        <Button type="button" variant="outline" size="sm" onClick={onAddStep}>
          <Plus className="size-3.5" />
          Add {stage === "route" ? "Route" : "Capital"} question to this branch
        </Button>
      )}
    </div>
  );
}

/** Goal tab: root question with nested next-question under each option. */
export function GoalBranchEditor({
  questions,
  canEdit,
  paths,
  onChangeQuestion,
  onUpsertQuestion,
  onJumpStage,
  onOpenPath,
}: {
  questions: CalcQuestion[];
  canEdit: boolean;
  paths: CalcPath[];
  onChangeQuestion: (next: CalcQuestion) => void;
  onUpsertQuestion: (next: CalcQuestion) => void;
  onJumpStage: (stage: CalcStage) => void;
  onOpenPath: (pathId: string, stage?: CalcStage) => void;
}) {
  const goal = getQuestionByKey(questions, "goal");
  if (!goal) return null;

  const handlers: JourneyHandlers = {
    onChangeQuestion,
    onUpsertQuestion,
    onJumpStage,
    onOpenPath,
    paths,
  };

  return (
    <div className="space-y-4">
      {/* <p className="text-sm text-muted-foreground">
        Hierarchy:{" "}
        <span className="text-foreground">
          Tab → Option → Next question → Answer options → Next…
        </span>{" "}
        Add an option to auto-create its next question with starter answers —
        same structure as{" "}
        <a
          href="https://joseph-mews-mobile-app.onrender.com/calculator"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          the mobile calculator
        </a>
        .
      </p> */}

      <QuestionEditor
        question={goal}
        questions={questions}
        canEdit={canEdit}
        defaultExpanded
        handlers={handlers}
      />
    </div>
  );
}

export function PathStageEditor({
  stage,
  questions,
  paths,
  canEdit,
  selectedPathId,
  onSelectPath,
  onChangeQuestion,
  onUpsertQuestion,
  onChangePaths,
  onJumpStage,
}: {
  stage: "route" | "capital" | "finance";
  questions: CalcQuestion[];
  paths: CalcPath[];
  canEdit: boolean;
  selectedPathId: string;
  onSelectPath: (id: string) => void;
  onChangeQuestion: (next: CalcQuestion) => void;
  onUpsertQuestion: (next: CalcQuestion) => void;
  onChangePaths: (next: CalcPath[]) => void;
  onJumpStage: (stage: CalcStage) => void;
}) {
  const path = paths.find((p) => p.id === selectedPathId) ?? paths[0];

  const handlers: JourneyHandlers = {
    onChangeQuestion,
    onUpsertQuestion,
    onJumpStage,
    paths,
  };

  if (stage === "finance") {
    const finance = getQuestionByKey(questions, "finance");
    if (!finance) return null;
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Finance is shared across all goal branches. After purchase preference
          (+ residency), the journey opens the Plan result.
        </p>
        <QuestionEditor
          question={finance}
          questions={questions}
          canEdit={canEdit}
          defaultExpanded
          whenLabel="After Capital on every path"
          handlers={handlers}
        />
      </div>
    );
  }

  const steps = stage === "route" ? path.routeSteps : path.capitalSteps;

  const addStep = () => {
    const blank = createBlankQuestion(stage, {
      title: `New ${stage} question`,
      caption: "New step",
    });
    // Ensure starter options exist (createBlankQuestion already does)
    if (blank.options.length === 0) {
      blank.options = createStarterOptions(3);
    }
    onUpsertQuestion(blank);
    onChangePaths(
      paths.map((p) => {
        if (p.id !== path.id) return p;
        const step = {
          questionKey: blank.key,
          when: "Added in admin",
        };
        return stage === "route"
          ? { ...p, routeSteps: [...p.routeSteps, step] }
          : { ...p, capitalSteps: [...p.capitalSteps, step] };
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {stage === "route"
            ? "Pick a Goal branch to see — and extend — the Route questions for that option."
            : "Capital steps for the selected Goal branch (Unsure skips contributions)."}
        </p>
        <div
          role="tablist"
          aria-label="Goal branches"
          className="flex flex-wrap gap-1.5"
        >
          {paths.map((p) => {
            const active = p.id === path.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectPath(p.id)}
                className={cn(
                  "rounded-sm border px-3 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <PathFlow
        path={path}
        questions={questions}
        canEdit={canEdit}
        steps={steps}
        stage={stage}
        handlers={handlers}
        onAddStep={addStep}
      />

      {stage === "capital" && path.goalValue === "unsure" && (
        <p className="rounded-md border border-border bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
          On the <span className="text-foreground">Not sure yet</span> branch,
          Capital goes straight to{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onJumpStage("finance")}
          >
            Finance
          </button>{" "}
          — contributions are skipped (same as mobile).
        </p>
      )}
    </div>
  );
}
