import { useMemo, type CSSProperties, type ReactNode } from "react";
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
import { GripVertical } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide this column in the mobile card meta list (still shown in desktop table). */
  mobileHidden?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /**
   * When set, rows can be drag-reordered. Receives the new id order for the
   * current `rows` array (full list passed in, not only the page slice).
   */
  onReorder?: (orderedIds: string[]) => void;
  sortable?: boolean;
}

function DragHandle({
  listeners,
  attributes,
}: {
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
}) {
  return (
    <button
      type="button"
      className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
      aria-label="Drag to reorder"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

function SortableTableRow<T>({
  row,
  columns,
  rowKey,
  onRowClick,
}: {
  row: T;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const id = rowKey(row);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: isDragging ? "relative" : undefined,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={onRowClick ? "cursor-pointer" : undefined}
      onClick={() => onRowClick?.(row)}
    >
      <TableCell className="w-10 px-2" onClick={(e) => e.stopPropagation()}>
        <DragHandle listeners={listeners} attributes={attributes} />
      </TableCell>
      {columns.map((col) => (
        <TableCell
          key={col.key}
          className={cn(col.className, col.key === "actions" && "relative z-10")}
          onClick={
            col.key === "actions" ? (e) => e.stopPropagation() : undefined
          }
        >
          {col.cell(row)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function SortableMobileCard<T>({
  row,
  primaryCol,
  metaCols,
  actionCol,
  rowKey,
  onRowClick,
}: {
  row: T;
  primaryCol?: Column<T>;
  metaCols: Column<T>[];
  actionCol?: Column<T>;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const id = rowKey(row);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      onClick={() => onRowClick?.(row)}
      onKeyDown={(e) => {
        if (!onRowClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onRowClick(row);
        }
      }}
      className={cn(
        "glass-panel w-full min-w-0 rounded-2xl p-4 text-left transition-all duration-200",
        onRowClick && "cursor-pointer hover:border-primary/40 hover:bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        <DragHandle listeners={listeners} attributes={attributes} />
        <div className="min-w-0 flex-1">
          {primaryCol && (
            <div className="min-w-0 text-sm font-medium text-foreground">
              {primaryCol.cell(row)}
            </div>
          )}
          {metaCols.length > 0 && (
            <dl className="mt-3 grid grid-cols-1 gap-2.5">
              {metaCols.map((col) => (
                <div key={col.key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{col.header}</dt>
                  <dd className="mt-0.5 min-w-0 break-words text-sm text-foreground [overflow-wrap:anywhere]">
                    {col.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {actionCol && (
            <div
              className="mt-3 border-t border-border pt-3"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actionCol.cell(row)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyTitle = "No results",
  emptyDescription = "Try adjusting filters or create a new record.",
  page = 1,
  pageSize = 10,
  onPageChange,
  onReorder,
  sortable = Boolean(onReorder),
}: DataTableProps<T>) {
  const pagingEnabled = Boolean(onPageChange);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = pagingEnabled
    ? rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    : rows;
  const sliceIds = useMemo(() => slice.map(rowKey), [slice, rowKey]);

  const primaryCol = columns.find((c) => c.key !== "actions") ?? columns[0];
  const actionCol = columns.find((c) => c.key === "actions");
  const metaCols = columns.filter(
    (c) => c.key !== primaryCol?.key && c.key !== "actions" && !c.mobileHidden,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder || !sortable) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = rows.map(rowKey);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const mobileList = sortable ? (
    <SortableContext items={sliceIds} strategy={verticalListSortingStrategy}>
      {slice.map((row) => (
        <SortableMobileCard
          key={rowKey(row)}
          row={row}
          primaryCol={primaryCol}
          metaCols={metaCols}
          actionCol={actionCol}
          rowKey={rowKey}
          onRowClick={onRowClick}
        />
      ))}
    </SortableContext>
  ) : (
    slice.map((row) => (
      <div
        key={rowKey(row)}
        role={onRowClick ? "button" : undefined}
        tabIndex={onRowClick ? 0 : undefined}
        onClick={() => onRowClick?.(row)}
        onKeyDown={(e) => {
          if (!onRowClick) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRowClick(row);
          }
        }}
        className={cn(
          "glass-panel w-full min-w-0 rounded-2xl p-4 text-left transition-all duration-200",
          onRowClick && "cursor-pointer hover:border-primary/35 hover:bg-white/6",
        )}
      >
        {primaryCol && (
          <div className="min-w-0 text-sm font-medium text-foreground">
            {primaryCol.cell(row)}
          </div>
        )}
        {metaCols.length > 0 && (
          <dl className="mt-3 grid grid-cols-1 gap-2.5">
            {metaCols.map((col) => (
              <div key={col.key} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{col.header}</dt>
                <dd className="mt-0.5 min-w-0 break-words text-sm text-foreground [overflow-wrap:anywhere]">
                  {col.cell(row)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {actionCol && (
          <div
            className="mt-3 border-t border-border pt-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actionCol.cell(row)}
          </div>
        )}
      </div>
    ))
  );

  const desktopTable = (
    <div className="glass-panel hidden w-full overflow-hidden rounded-2xl md:block">
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              {sortable ? (
                <TableHead className="w-10 px-2">
                  <span className="sr-only">Reorder</span>
                </TableHead>
              ) : null}
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortable ? (
              <SortableContext
                items={sliceIds}
                strategy={verticalListSortingStrategy}
              >
                {slice.map((row) => (
                  <SortableTableRow
                    key={rowKey(row)}
                    row={row}
                    columns={columns}
                    rowKey={rowKey}
                    onRowClick={onRowClick}
                  />
                ))}
              </SortableContext>
            ) : (
              slice.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.className,
                        col.key === "actions" && "relative z-10",
                      )}
                      onClick={
                        col.key === "actions"
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const lists = (
    <>
      <div className="space-y-3 md:hidden">{mobileList}</div>
      {desktopTable}
    </>
  );

  return (
    <div className="w-full min-w-0 space-y-3">
      {sortable && onReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {lists}
        </DndContext>
      ) : (
        lists
      )}

      {pagingEnabled && rows.length > pageSize && (
        <div className="flex w-full flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {safePage} of {totalPages} · {rows.length} total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 flex-1 sm:min-h-8 sm:flex-none"
              disabled={safePage <= 1}
              onClick={() => onPageChange?.(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 flex-1 sm:min-h-8 sm:flex-none"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange?.(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
