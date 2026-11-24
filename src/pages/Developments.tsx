import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Download, GripVertical, ListFilter } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { SearchableMultiSelect } from "@/components/admin/SearchableMultiSelect";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
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
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatPercent, titleCase } from "@/lib/format";
import { ApiError } from "@/lib/apiClient";
import { downloadStyledExcel } from "@/lib/excelExport";
import { mergeVisibleOrder, toSortItems } from "@/lib/listOrder";
import type { Development, DevelopmentStatus } from "@/models";
import { sortDevelopments } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureDevelopments,
  replaceDevelopments,
} from "@/store/slices/developmentsSlice";

const DEVELOPMENT_STATUSES: DevelopmentStatus[] = [
  "draft",
  "coming_soon",
  "available",
  "sold_out",
  "completed",
  "archived",
];

type ExploreFilter = "visible" | "hidden";
type FeaturedFilter = "featured" | "not_featured";
type UpdatedFilter = "last_3" | "last_7" | "last_30" | "last_90" | "older";

type DevelopmentListFilters = {
  explore: ExploreFilter[];
  statuses: DevelopmentStatus[];
  developers: string[];
  cities: string[];
  featured: FeaturedFilter[];
  updated: UpdatedFilter[];
};

const EMPTY_FILTERS: DevelopmentListFilters = {
  explore: [],
  statuses: [],
  developers: [],
  cities: [],
  featured: [],
  updated: [],
};

/** Sentinel for empty developer / city values. */
const NONE_FILTER = "__none__";

function countActiveFilters(filters: DevelopmentListFilters): number {
  return (
    filters.explore.length +
    filters.statuses.length +
    filters.developers.length +
    filters.cities.length +
    filters.featured.length +
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

function uniqueSortedLabels(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function matchesNoneOrValue(
  selected: string[],
  raw: string | null | undefined,
): boolean {
  const value = (raw ?? "").trim();
  const hasNone = !value;
  const matchesNone = selected.includes(NONE_FILTER) && hasNone;
  const matchesValue = !hasNone && selected.includes(value);
  return matchesNone || matchesValue;
}

export function DevelopmentsPage() {
  const { can } = useAuth();
  const canEdit = can("create", "developments");
  const dispatch = useAppDispatch();
  const developmentsState = useAppSelector((s) => s.developments);
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] =
    useState<DevelopmentListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<DevelopmentListFilters>(EMPTY_FILTERS);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);

  useEffect(() => {
    void dispatch(ensureDevelopments())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(
          typeof err === "string" ? err : "Unable to load developments.",
        );
      });
  }, [dispatch, developmentsState.invalidated]);

  const rows = developmentsState.items;

  const developerOptions = useMemo(() => {
    const labels = uniqueSortedLabels(rows.map((d) => d.developer));
    return [
      { value: NONE_FILTER, label: "None" },
      ...labels.map((label) => ({ value: label, label })),
    ];
  }, [rows]);

  const cityOptions = useMemo(() => {
    const labels = uniqueSortedLabels(rows.map((d) => d.city));
    return [
      { value: NONE_FILTER, label: "None" },
      ...labels.map((label) => ({ value: label, label })),
    ];
  }, [rows]);

  const activeFilterCount = countActiveFilters(appliedFilters);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((d) => {
      if (
        q &&
        !d.name.toLowerCase().includes(q) &&
        !d.city.toLowerCase().includes(q) &&
        !d.developer.toLowerCase().includes(q) &&
        !d.reference.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (appliedFilters.explore.length > 0) {
        const exploreKey: ExploreFilter = d.visibleInExplore ? "visible" : "hidden";
        if (!appliedFilters.explore.includes(exploreKey)) return false;
      }

      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(d.status)
      ) {
        return false;
      }

      if (
        appliedFilters.developers.length > 0 &&
        !matchesNoneOrValue(appliedFilters.developers, d.developer)
      ) {
        return false;
      }

      if (
        appliedFilters.cities.length > 0 &&
        !matchesNoneOrValue(appliedFilters.cities, d.city)
      ) {
        return false;
      }

      if (appliedFilters.featured.length > 0) {
        const key: FeaturedFilter = d.featured ? "featured" : "not_featured";
        if (!appliedFilters.featured.includes(key)) return false;
      }

      if (appliedFilters.updated.length > 0) {
        const bucket = updatedBucket(d.updatedAt);
        if (!appliedFilters.updated.includes(bucket)) return false;
      }

      return true;
    });
  }, [rows, search, appliedFilters]);

  const orderedFiltered = filtered;

  const handleReorder = (visibleOrderedIds: string[]) => {
    if (reorderBusy) return;
    const baseIds = rows.map((d) => d.id);
    const nextIds = mergeVisibleOrder(baseIds, visibleOrderedIds);
    const byId = new Map(rows.map((d) => [String(d.id), d]));
    const optimistic = nextIds
      .map((id, index) => {
        const item = byId.get(String(id));
        return item ? { ...item, sortOrder: index + 1 } : null;
      })
      .filter((item): item is Development => item != null);
    dispatch(replaceDevelopments(optimistic));
    setReorderBusy(true);
    void (async () => {
      try {
        const next = await sortDevelopments(toSortItems(nextIds));
        dispatch(replaceDevelopments(next.length ? next : optimistic));
        toast.success("Development order saved.");
      } catch (err) {
        dispatch(replaceDevelopments(rows));
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Unable to save development order.",
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

  const exploreOptions = [
    { value: "visible", label: "Visible" },
    { value: "hidden", label: "Hidden" },
  ];

  const statusOptions = DEVELOPMENT_STATUSES.map((status) => ({
    value: status,
    label: titleCase(status),
  }));

  const featuredOptions = [
    { value: "featured", label: "Featured" },
    { value: "not_featured", label: "Not featured" },
  ];

  const updatedOptions = [
    { value: "last_3", label: "Last 3 days" },
    { value: "last_7", label: "Last 7 days" },
    { value: "last_30", label: "Last 30 days" },
    { value: "last_90", label: "Last 90 days" },
    { value: "older", label: "Older than 90 days" },
  ];

  const handleDownloadExcel = () => {
    if (orderedFiltered.length === 0) {
      toast.error("No developments to download.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    void (async () => {
      try {
        await downloadStyledExcel({
          filename: `developments-${stamp}.xlsx`,
          sheetName: "Developments",
          title: `Developments export · ${orderedFiltered.length} row${
            orderedFiltered.length === 1 ? "" : "s"
          } · ${stamp}`,
          columns: [
            { header: "S.No", width: 8, align: "center" },
            { header: "Development", width: 28 },
            { header: "Reference", width: 20 },
            { header: "Developer", width: 22 },
            { header: "City", width: 28 },
            {
              header: "From",
              width: 14,
              numFmt: '"£"#,##0',
              align: "right",
            },
            { header: "Yield", width: 10, align: "right" },
            { header: "Status", width: 14, align: "center" },
            { header: "Explore", width: 12, align: "center" },
            { header: "Availability", width: 14, align: "center" },
          ],
          rows: orderedFiltered.map((d, index) => [
            { value: index + 1, hint: "index" },
            { value: d.name },
            { value: d.reference },
            { value: d.developer },
            {
              value: [d.city, d.region].filter(Boolean).join(", "),
            },
            { value: d.startingPrice, hint: "currency" },
            { value: formatPercent(d.expectedRentalYield) },
            { value: titleCase(d.status), hint: "status" },
            {
              value: d.visibleInExplore ? "Visible" : "Hidden",
              hint: "explore",
            },
            { value: `${d.availableUnits}/${d.totalUnits}` },
          ]),
        });
        toast.success(
          `Downloaded ${orderedFiltered.length} development${
            orderedFiltered.length === 1 ? "" : "s"
          }.`,
        );
      } catch {
        toast.error("Unable to download Excel file.");
      }
    })();
  };

  const columns: Column<Development>[] = [
    { key: "name", header: "Development", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "ref", header: "Reference", cell: (r) => <span className="font-mono text-xs">{r.reference}</span> },
    { key: "developer", header: "Developer", cell: (r) => r.developer || "—" },
    { key: "city", header: "City", cell: (r) => `${r.city}, ${r.region}` },
    { key: "price", header: "From", cell: (r) => formatCurrency(r.startingPrice), className: "tabular-nums" },
    { key: "yield", header: "Yield", cell: (r) => formatPercent(r.expectedRentalYield) },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    { key: "explore", header: "Explore", cell: (r) => (r.visibleInExplore ? "Visible" : "Hidden") },
    { key: "units", header: "Availability", cell: (r) => `${r.availableUnits}/${r.totalUnits}` },
  ];

  if (developmentsState.status === "loading" && rows.length === 0) {
    return <LoadingBlock variant="table" />;
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Developments"
        description="Manage developments shown in the investor Explore marketplace."
        actions={
          canEdit ? (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/developments/new">Add development</Link>
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
        searchPlaceholder="Search name, developer, city…"
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
          Drag rows to set order. All {orderedFiltered.length} matching developments
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
          reorderMode ? undefined : (r) => setLocation(`/developments/${r.id}`)
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
                id="development-filter-explore"
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
                id="development-filter-status"
                label="Status"
                values={draftFilters.statuses}
                onValuesChange={(statuses) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    statuses: statuses as DevelopmentStatus[],
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
                id="development-filter-developer"
                label="Developer"
                values={draftFilters.developers}
                onValuesChange={(developers) =>
                  setDraftFilters((prev) => ({ ...prev, developers }))
                }
                options={developerOptions}
                placeholder="All developers"
                searchPlaceholder="Search developer…"
                emptyMessage="No developers found"
                open={openFilterKey === "developer"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "developer" : null)
                }
              />

              <SearchableMultiSelect
                id="development-filter-city"
                label="City"
                values={draftFilters.cities}
                onValuesChange={(cities) =>
                  setDraftFilters((prev) => ({ ...prev, cities }))
                }
                options={cityOptions}
                placeholder="All cities"
                searchPlaceholder="Search city…"
                emptyMessage="No cities found"
                open={openFilterKey === "city"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "city" : null)
                }
              />

              <SearchableMultiSelect
                id="development-filter-featured"
                label="Featured"
                values={draftFilters.featured}
                onValuesChange={(featured) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    featured: featured as FeaturedFilter[],
                  }))
                }
                options={featuredOptions}
                placeholder="All featured states"
                searchPlaceholder="Search featured…"
                open={openFilterKey === "featured"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "featured" : null)
                }
              />

              <SearchableMultiSelect
                id="development-filter-updated"
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
    </div>
  );
}
