import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IntentSignal, SignalStatus } from "@/models";

export type BoardColumnId =
  | "new"
  | "contact_planned"
  | "contacted"
  | "qualified"
  | "dismissed"
  | "converted";

export const BOARD_COLUMNS: Array<{
  id: BoardColumnId;
  label: string;
  statuses: SignalStatus[];
}> = [
  { id: "new", label: "New", statuses: ["new", "open", "viewed"] },
  {
    id: "contact_planned",
    label: "Contact planned",
    statuses: ["contact_planned"],
  },
  { id: "contacted", label: "Contacted", statuses: ["contacted"] },
  { id: "qualified", label: "Qualified", statuses: ["qualified"] },
  { id: "dismissed", label: "Dismissed", statuses: ["dismissed"] },
  { id: "converted", label: "Converted", statuses: ["converted"] },
];

export function columnIdForStatus(status: string): BoardColumnId {
  const s = String(status || "new").toLowerCase();
  for (const col of BOARD_COLUMNS) {
    if (col.statuses.includes(s as SignalStatus)) return col.id;
  }
  return "new";
}

/** Canonical status written when dropping into a column. */
export function statusForColumn(columnId: BoardColumnId): SignalStatus {
  switch (columnId) {
    case "new":
      return "new";
    case "contact_planned":
      return "contact_planned";
    case "contacted":
      return "contacted";
    case "qualified":
      return "qualified";
    case "dismissed":
      return "dismissed";
    case "converted":
      return "converted";
  }
}

type BoardSignal = IntentSignal & {
  investorName: string;
  assigneeName: string | null;
};

export function SignalsBoard({
  signals,
  onOpen,
  onMove,
  movingId,
}: {
  signals: BoardSignal[];
  onOpen: (signal: IntentSignal) => void;
  onMove: (signalId: string, nextStatus: SignalStatus) => void;
  movingId?: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const suppressClickRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<BoardColumnId, BoardSignal[]> = {
      new: [],
      contact_planned: [],
      contacted: [],
      qualified: [],
      dismissed: [],
      converted: [],
    };
    for (const s of signals) {
      map[columnIdForStatus(s.status)].push(s);
    }
    return map;
  }, [signals]);

  const activeSignal = activeId
    ? signals.find((s) => String(s.id) === String(activeId))
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    suppressClickRef.current = true;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 80);

    const signalId = String(event.active.id);
    const overId = event.over?.id != null ? String(event.over.id) : null;
    if (!overId) return;

    let targetColumn = BOARD_COLUMNS.find((c) => c.id === overId)?.id;
    if (!targetColumn) {
      const overSignal = signals.find((s) => String(s.id) === overId);
      if (overSignal) targetColumn = columnIdForStatus(overSignal.status);
    }
    if (!targetColumn) return;

    const signal = signals.find((s) => String(s.id) === signalId);
    if (!signal) return;
    const nextStatus = statusForColumn(targetColumn);
    if (columnIdForStatus(signal.status) === targetColumn) return;
    onMove(signalId, nextStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
        {BOARD_COLUMNS.map((col) => (
          <BoardColumn
            key={col.id}
            column={col}
            items={byColumn[col.id]}
            onOpen={(sig) => {
              if (suppressClickRef.current) return;
              onOpen(sig);
            }}
            movingId={movingId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeSignal ? (
          <SignalCard
            signal={activeSignal}
            onOpen={() => undefined}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  items,
  onOpen,
  movingId,
}: {
  column: (typeof BOARD_COLUMNS)[number];
  items: BoardSignal[];
  onOpen: (signal: IntentSignal) => void;
  movingId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[260px] shrink-0 flex-col rounded-md border border-border bg-card/20",
        isOver && "border-primary/50 bg-card/40",
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="text-sm font-medium text-foreground">{column.label}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </header>
      <div className="flex max-h-[min(70vh,720px)] flex-col gap-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Drop signals here
          </p>
        ) : (
          items.map((s) => (
            <DraggableSignalCard
              key={s.id}
              signal={s}
              onOpen={onOpen}
              disabled={movingId === s.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableSignalCard({
  signal,
  onOpen,
  disabled,
}: {
  signal: BoardSignal;
  onOpen: (signal: IntentSignal) => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: signal.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
      }}
      className={cn(disabled && "pointer-events-none opacity-60")}
      {...listeners}
      {...attributes}
    >
      <SignalCard signal={signal} onOpen={onOpen} />
    </div>
  );
}

function SignalCard({
  signal,
  onOpen,
  dragging,
}: {
  signal: BoardSignal;
  onOpen: (signal: IntentSignal) => void;
  dragging?: boolean;
}) {
  const high =
    String(signal.intentLevel).toLowerCase() === "high" ||
    String(signal.intentLevel).toLowerCase() === "urgent";

  return (
    <button
      type="button"
      onClick={() => onOpen(signal)}
      className={cn(
        "w-full rounded-md border border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-card",
        high && "border-l-2 border-l-primary",
        dragging && "shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {signal.investorName}
        </p>
        <StatusBadge value={signal.intentLevel} />
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-foreground/90">
        {signal.signalType || "Signal"}
      </p>
      {signal.triggeringActivity ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
          {signal.triggeringActivity}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {signal.assigneeName
            ? titleCase(signal.assigneeName)
            : "Unassigned"}
        </span>
        <span className="shrink-0 tabular-nums">
          {formatDateTime(signal.generatedAt)}
        </span>
      </div>
    </button>
  );
}
