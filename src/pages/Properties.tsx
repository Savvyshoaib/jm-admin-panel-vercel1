import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Download, ListFilter, MoreHorizontal, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { SearchableMultiSelect } from "@/components/admin/SearchableMultiSelect";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { formatCurrency, titleCase } from "@/lib/format";
import { downloadStyledExcel } from "@/lib/excelExport";
import { mergeVisibleOrder, toSortItems } from "@/lib/listOrder";
import type { PropertyStatus, PropertyUnit } from "@/models";
import {
  archiveProperty,
  duplicateProperty,
  publishProperty,
  sortProperties,
  unarchiveProperty,
  unpublishProperty,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureProperties,
  invalidateProperties,
  replaceProperties,
  upsertProperty,
} from "@/store/slices/propertiesSlice";
import { ensureDevelopments } from "@/store/slices/developmentsSlice";

const PROPERTY_STATUSES: PropertyStatus[] = [
  "draft",
  "coming_soon",
  "available",
  "reserved",
  "sold",
  "completed",
  "archived",
  "tenanted",
  "in_build",
  "vacant",
];

type ExploreFilter = "visible" | "hidden";
type ActionFilter = "publish" | "unpublish" | "archive" | "unarchive";
type UpdatedFilter = "last_3" | "last_7" | "last_30" | "last_90" | "older";

type PropertyListFilters = {
  explore: ExploreFilter[];
  statuses: PropertyStatus[];
  developmentIds: string[];
  actions: ActionFilter[];
  updated: UpdatedFilter[];
};

const EMPTY_FILTERS: PropertyListFilters = {
  explore: [],
  statuses: [],
  developmentIds: [],
  actions: [],
  updated: [],
};

/** Sentinel for properties with no linked development. */
const NO_DEVELOPMENT_FILTER = "__none__";

function countActiveFilters(filters: PropertyListFilters): number {
  return (
    filters.explore.length +
    filters.statuses.length +
    filters.developmentIds.length +
    filters.actions.length +
    filters.updated.length
  );
}

function updatedBucket(updatedAt: string): UpdatedFilter {
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated)) return "older";
  const days = (Date.now() - updated) / 86_400_000;
  if (days <= 3) return "last_3";
  if (days <= 7) return "last_7";
  if (days <= 30) return "last_30";
  if (days <= 90) return "last_90";
  return "older";
}

function matchesActionFilter(property: PropertyUnit, action: ActionFilter): boolean {
  switch (action) {
    case "publish":
      return !property.visibleInExplore;
    case "unpublish":
      return property.visibleInExplore;
    case "archive":
      return property.status !== "archived";
    case "unarchive":
      return property.status === "archived";
  }
}

export function PropertiesPage() {
  const { can } = useAuth();
  const canPublish = can("publish", "properties");
  const canManageContent =
    can("manage_content", "content") || can("publish", "content");
  const canViewContent = can("view", "content") || canManageContent;
  const dispatch = useAppDispatch();
  const [, setLocation] = useLocation();
  const propertiesState = useAppSelector((s) => s.properties);
  const developmentsState = useAppSelector((s) => s.developments);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] =
    useState<PropertyListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<PropertyListFilters>(EMPTY_FILTERS);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);

  const applyPropertyUpdate = async (saved: PropertyUnit) => {
    dispatch(upsertProperty(saved));
    dispatch(invalidateProperties());
    try {
      await dispatch(ensureProperties({ force: true })).unwrap();
    } catch (err: unknown) {
      if (!isThunkConditionError(err)) {
        /* list refresh failed; upsert still holds the action result */
      }
    }
    dispatch(upsertProperty(saved));
  };

  useEffect(() => {
    void dispatch(ensureProperties({ force: propertiesState.invalidated }))
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load properties.");
      });
    void dispatch(ensureDevelopments())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
      });
  }, [dispatch, propertiesState.invalidated]);

  const rows = propertiesState.items;
  const devs = developmentsState.items;
  const devsLoading =
    developmentsState.status === "loading" && developmentsState.items.length === 0;

  const developmentOptions = useMemo(() => {
    const fromList = [...devs].sort((a, b) => a.name.localeCompare(b.name));
    const knownIds = new Set(fromList.map((d) => d.id));
    const orphans = rows
      .map((p) => p.developmentId)
      .filter((id): id is string => id != null && id !== "" && !knownIds.has(id));
    const uniqueOrphans = [...new Set(orphans)];
    return [
      { id: NO_DEVELOPMENT_FILTER, label: "None" },
      ...fromList.map((d) => ({ id: d.id, label: d.name })),
      ...uniqueOrphans.map((id) => ({ id, label: `Development ${id}` })),
    ];
  }, [devs, rows]);

  const activeFilterCount = countActiveFilters(appliedFilters);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((p) => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.reference.toLowerCase().includes(q) &&
        !p.city.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (appliedFilters.explore.length > 0) {
        const exploreKey: ExploreFilter = p.visibleInExplore ? "visible" : "hidden";
        if (!appliedFilters.explore.includes(exploreKey)) return false;
      }

      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(p.status)
      ) {
        return false;
      }

      if (appliedFilters.developmentIds.length > 0) {
        const developmentId = p.developmentId;
        const hasNoDevelopment = developmentId == null || developmentId === "";
        const matchesNone =
          appliedFilters.developmentIds.includes(NO_DEVELOPMENT_FILTER) &&
          hasNoDevelopment;
        const matchesDev =
          !hasNoDevelopment &&
          appliedFilters.developmentIds.includes(developmentId as string);
        if (!matchesNone && !matchesDev) return false;
      }

      if (appliedFilters.actions.length > 0) {
        const matches = appliedFilters.actions.some((action) =>
          matchesActionFilter(p, action),
        );
        if (!matches) return false;
      }

      if (appliedFilters.updated.length > 0) {
        const bucket = updatedBucket(p.updatedAt);
        if (!appliedFilters.updated.includes(bucket)) return false;
      }

      return true;
    });
  }, [rows, search, appliedFilters]);

  const orderedFiltered = filtered;

  const handleReorder = (visibleOrderedIds: string[]) => {
    if (reorderBusy) return;
    const baseIds = rows.map((p) => p.id);
    const nextIds = mergeVisibleOrder(baseIds, visibleOrderedIds);
    const byId = new Map(rows.map((p) => [String(p.id), p]));
    const optimistic = nextIds
      .map((id, index) => {
        const item = byId.get(String(id));
        return item ? { ...item, sortOrder: index + 1 } : null;
      })
      .filter((item): item is PropertyUnit => item != null);
    dispatch(replaceProperties(optimistic));
    setReorderBusy(true);
    void (async () => {
      try {
        const next = await sortProperties(toSortItems(nextIds));
        dispatch(replaceProperties(next.length ? next : optimistic));
        toast.success("Property order saved.");
      } catch (err) {
        dispatch(replaceProperties(rows));
        toast.error(
          err instanceof ApiError ? err.message : "Unable to save property order.",
        );
      } finally {
        setReorderBusy(false);
      }
    })();
  };

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setOpenFilterKey(null);
    setFiltersOpen(true);
  };

  const applyDraftFilters = () => {
    setAppliedFilters(draftFilters);
    setPage(1);
    setOpenFilterKey(null);
    setFiltersOpen(false);
  };

  const clearDraftFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
  };

  const clearAppliedFilters = () => {
    setAppliedFilters(EMPTY_FILTERS);
    setDraftFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handleDownloadExcel = () => {
    if (orderedFiltered.length === 0) {
      toast.error("No properties to download.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    void (async () => {
      try {
        await downloadStyledExcel({
          filename: `properties-${stamp}.xlsx`,
          sheetName: "Properties",
          title: `Properties export · ${orderedFiltered.length} row${
            orderedFiltered.length === 1 ? "" : "s"
          } · ${stamp}`,
          columns: [
            { header: "S.No", width: 8, align: "center" },
            { header: "Property", width: 28 },
            { header: "Reference", width: 22 },
            { header: "Development", width: 26 },
            { header: "Type", width: 22 },
            {
              header: "Purchase",
              width: 14,
              numFmt: '"£"#,##0',
              align: "right",
            },
            { header: "Status", width: 14, align: "center" },
            { header: "Explore", width: 12, align: "center" },
          ],
          rows: orderedFiltered.map((p, index) => [
            { value: index + 1, hint: "index" },
            { value: p.name },
            { value: p.reference },
            {
              value: devs.find((d) => d.id === p.developmentId)?.name ?? "",
            },
            { value: p.propertyType },
            { value: p.purchasePrice, hint: "currency" },
            { value: titleCase(p.status), hint: "status" },
            {
              value: p.visibleInExplore ? "Visible" : "Hidden",
              hint: "explore",
            },
          ]),
        });
        toast.success(
          `Downloaded ${orderedFiltered.length} propert${
            orderedFiltered.length === 1 ? "y" : "ies"
          }.`,
        );
      } catch {
        toast.error("Unable to download Excel file.");
      }
    })();
  };

  const exploreOptions = [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
  ];

  const statusOptions = PROPERTY_STATUSES.map((status) => ({
    value: status,
    label: titleCase(status),
  }));

  const developmentSelectOptions = developmentOptions.map((dev) => ({
    value: dev.id,
    label: dev.label,
    keywords: dev.id,
  }));

  const actionOptions = [
    { value: "publish", label: "Can publish" },
    { value: "unpublish", label: "Can unpublish" },
    { value: "archive", label: "Can archive" },
    { value: "unarchive", label: "Can unarchive" },
  ];

  const updatedOptions = [
    { value: "last_3", label: "Last 3 days" },
    { value: "last_7", label: "Last 7 days" },
    { value: "last_30", label: "Last 30 days" },
    { value: "last_90", label: "Last 90 days" },
    { value: "older", label: "Older than 90 days" },
  ];

  const columns: Column<PropertyUnit>[] = [
    { key: "name", header: "Property", cell: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "ref",
      header: "Reference",
      cell: (r) => <span className="font-mono text-xs">{r.reference}</span>,
      mobileHidden: true,
    },
    {
      key: "dev",
      header: "Development",
      cell: (r) => devs.find((d) => d.id === r.developmentId)?.name ?? "—",
      mobileHidden: true,
    },
    { key: "type", header: "Type", cell: (r) => r.propertyType, mobileHidden: true },
    {
      key: "price",
      header: "Purchase",
      cell: (r) => formatCurrency(r.purchasePrice),
      className: "tabular-nums",
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "visibility",
      header: "Explore",
      cell: (r) => (r.visibleInExplore ? "Visible" : "Hidden"),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => {
        const showPropertyActions = canPublish;
        const showContentActions = canViewContent;
        if (!showPropertyActions && !showContentActions) return "—";

        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 w-full gap-2 sm:min-h-8 sm:w-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-44 bg-background"
            >
              {canManageContent ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(
                      `/content/new?propertyId=${encodeURIComponent(r.id)}`,
                    );
                  }}
                >
                  Add Content
                </DropdownMenuItem>
              ) : null}
              {canViewContent ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(
                      `/content?propertyId=${encodeURIComponent(r.id)}`,
                    );
                  }}
                >
                  View Content
                </DropdownMenuItem>
              ) : null}
              {showContentActions && showPropertyActions ? (
                <DropdownMenuSeparator />
              ) : null}
              {showPropertyActions ? (
                <>
                  {r.visibleInExplore ? (
                    <DropdownMenuItem
                      disabled={actionBusyId === r.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActionBusyId(r.id);
                        try {
                          const saved = await unpublishProperty(r.id);
                          await applyPropertyUpdate(saved);
                          toast.success("Unpublished from Explore");
                        } catch (err) {
                          toast.error(
                            err instanceof ApiError
                              ? err.message
                              : "Unable to unpublish property.",
                          );
                        } finally {
                          setActionBusyId(null);
                        }
                      }}
                    >
                      Unpublish
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={actionBusyId === r.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActionBusyId(r.id);
                        try {
                          const saved = await publishProperty(r.id);
                          await applyPropertyUpdate(saved);
                          toast.success("Published to Explore");
                        } catch (err) {
                          toast.error(
                            err instanceof ApiError
                              ? err.message
                              : "Unable to publish property.",
                          );
                        } finally {
                          setActionBusyId(null);
                        }
                      }}
                    >
                      Publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    disabled={actionBusyId === r.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setActionBusyId(r.id);
                      try {
                        const copy = await duplicateProperty(r.id);
                        await applyPropertyUpdate(copy);
                        toast.success("Property duplicated");
                        setLocation(`/properties/${copy.id}`);
                      } catch (err) {
                        toast.error(
                          err instanceof ApiError
                            ? err.message
                            : "Unable to duplicate property.",
                        );
                      } finally {
                        setActionBusyId(null);
                      }
                    }}
                  >
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {r.status === "archived" ? (
                    <DropdownMenuItem
                      disabled={actionBusyId === r.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActionBusyId(r.id);
                        try {
                          const saved = await unarchiveProperty(r.id);
                          await applyPropertyUpdate(saved);
                          toast.success("Property unarchived");
                        } catch (err) {
                          toast.error(
                            err instanceof ApiError
                              ? err.message
                              : "Unable to unarchive.",
                          );
                        } finally {
                          setActionBusyId(null);
                        }
                      }}
                    >
                      Unarchive
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={actionBusyId === r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchiveId(r.id);
                      }}
                    >
                      Archive
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const loading =
    ((propertiesState.status === "loading" || propertiesState.status === "idle") &&
      propertiesState.items.length === 0) ||
    devsLoading;

  if (loading) return <LoadingBlock variant="table" />;

  if (propertiesState.status === "failed" && propertiesState.items.length === 0) {
    return (
      <div className="w-full space-y-4">
        <PageHeader title="Properties" description="Inventory units across developments." />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {propertiesState.error ?? "Unable to load properties."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => void dispatch(ensureProperties({ force: true }))}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Properties"
        description="Inventory units across developments."
        actions={
          can("create", "properties") ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/properties/new">Add property</Link>
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, reference, city…"
        searchActions={
          <>
            <Button
              type="button"
              variant={reorderMode ? "default" : "outline"}
              className="gap-2"
              disabled={reorderBusy}
              onClick={() => setReorderMode((open) => !open)}
            >
              <GripVertical className="size-4" />
              {reorderBusy
                ? "Saving order…"
                : reorderMode
                  ? "Done reordering"
                  : "Reorder"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openFilters}
              disabled={reorderMode}
              aria-label={
                activeFilterCount > 0
                  ? `Filters, ${activeFilterCount} applied`
                  : "Open filters"
              }
            >
              <ListFilter className="size-4" />
              Filters
              {activeFilterCount > 0 ? (
                <Badge variant="default" className="h-5 min-w-5 px-1.5 tabular-nums">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleDownloadExcel}
              disabled={reorderMode || orderedFiltered.length === 0}
            >
              <Download className="size-4" />
              Download Excel
            </Button>
          </>
        }
      />

      {reorderMode ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Drag rows to set order. All {orderedFiltered.length} matching properties
          are shown here — pagination is paused until you click Done reordering.
        </p>
      ) : activeFilterCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} applied
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={clearAppliedFilters}
          >
            Clear all
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={orderedFiltered}
        rowKey={(r) => r.id}
        onRowClick={
          reorderMode ? undefined : (r) => setLocation(`/properties/${r.id}`)
        }
        page={page}
        onPageChange={reorderMode ? undefined : setPage}
        pageSize={10}
        sortable={reorderMode && !reorderBusy}
        onReorder={reorderMode && !reorderBusy ? handleReorder : undefined}
      />

      <Sheet
        open={filtersOpen}
        onOpenChange={(open) => {
          setFiltersOpen(open);
          if (open) {
            setDraftFilters(appliedFilters);
            setOpenFilterKey(null);
          } else {
            setOpenFilterKey(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border pr-12">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Use search inside each dropdown. Select multiple values per group.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-5">
              <SearchableMultiSelect
                id="property-filter-explore"
                label="Explore"
                values={draftFilters.explore}
                onValuesChange={(explore) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    explore: explore as ExploreFilter[],
                  }))
                }
                options={exploreOptions}
                placeholder="All explore visibility"
                searchPlaceholder="Search explore…"
                open={openFilterKey === "explore"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "explore" : null)
                }
              />

              <SearchableMultiSelect
                id="property-filter-status"
                label="Status"
                values={draftFilters.statuses}
                onValuesChange={(statuses) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    statuses: statuses as PropertyStatus[],
                  }))
                }
                options={statusOptions}
                placeholder="All statuses"
                searchPlaceholder="Search status…"
                open={openFilterKey === "status"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "status" : null)
                }
              />

              <SearchableMultiSelect
                id="property-filter-development"
                label="Development"
                values={draftFilters.developmentIds}
                onValuesChange={(developmentIds) =>
                  setDraftFilters((prev) => ({ ...prev, developmentIds }))
                }
                options={developmentSelectOptions}
                placeholder="All developments"
                searchPlaceholder="Search development…"
                emptyMessage="No developments found"
                open={openFilterKey === "development"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "development" : null)
                }
              />

              <SearchableMultiSelect
                id="property-filter-actions"
                label="Actions"
                values={draftFilters.actions}
                onValuesChange={(actions) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    actions: actions as ActionFilter[],
                  }))
                }
                options={actionOptions}
                placeholder="All actions"
                searchPlaceholder="Search actions…"
                open={openFilterKey === "actions"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "actions" : null)
                }
              />

              <SearchableMultiSelect
                id="property-filter-updated"
                label="Updated"
                values={draftFilters.updated}
                onValuesChange={(updated) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    updated: updated as UpdatedFilter[],
                  }))
                }
                options={updatedOptions}
                placeholder="Any update date"
                searchPlaceholder="Search…"
                open={openFilterKey === "updated"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "updated" : null)
                }
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t border-border bg-background sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={clearDraftFilters}
              disabled={countActiveFilters(draftFilters) === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={applyDraftFilters}
            >
              Apply
              {countActiveFilters(draftFilters) > 0
                ? ` (${countActiveFilters(draftFilters)})`
                : ""}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={archiveId != null}
        onOpenChange={(open) => {
          if (!open) setArchiveId(null);
        }}
        title="Archive property?"
        description="Archived properties are hidden from Explore. You can restore later by editing status."
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveId) return;
          const id = archiveId;
          setActionBusyId(id);
          try {
            const saved = await archiveProperty(id);
            await applyPropertyUpdate(saved);
            toast.success("Property archived");
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : "Unable to archive.");
          } finally {
            setActionBusyId(null);
            setArchiveId(null);
          }
        }}
      />
    </div>
  );
}
