import { useEffect, useMemo, useState } from "react";
import { Download, ListFilter, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { SearchableMultiSelect } from "@/components/admin/SearchableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { downloadStyledExcel } from "@/lib/excelExport";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Enquiry, EnquiryStatus } from "@/models";
import { deleteEnquiry, updateEnquiry } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  ensureEnquiries,
  invalidateEnquiries,
  removeEnquiryLocal,
  upsertEnquiry,
} from "@/store/slices/enquiriesSlice";

type EnquiryPriority = Enquiry["priority"];
type SubmittedFilter = "last_3" | "last_7" | "last_30" | "last_90" | "older";

const statuses: EnquiryStatus[] = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "viewing_arranged",
  "in_progress",
  "open",
  "closed",
  "converted",
  "not_interested",
];

type EnquiryListFilters = {
  types: string[];
  priorities: EnquiryPriority[];
  statuses: EnquiryStatus[];
  submitted: SubmittedFilter[];
};

const EMPTY_FILTERS: EnquiryListFilters = {
  types: [],
  priorities: [],
  statuses: [],
  submitted: [],
};

const PRIORITIES: EnquiryPriority[] = ["low", "medium", "high"];

function countActiveFilters(filters: EnquiryListFilters): number {
  return (
    filters.types.length +
    filters.priorities.length +
    filters.statuses.length +
    filters.submitted.length
  );
}

function submittedBucket(submittedAt: string): SubmittedFilter {
  const submitted = new Date(submittedAt).getTime();
  if (!Number.isFinite(submitted)) return "older";
  const days = (Date.now() - submitted) / 86_400_000;
  if (days <= 3) return "last_3";
  if (days <= 7) return "last_7";
  if (days <= 30) return "last_30";
  if (days <= 90) return "last_90";
  return "older";
}

function TruncateTip({
  text,
  className,
  lines = 1,
}: {
  text: string;
  className?: string;
  lines?: 1 | 2;
}) {
  const value = text.trim() || "—";
  const clamp =
    lines === 2 ? "line-clamp-2 whitespace-normal" : "truncate whitespace-nowrap";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("block max-w-full cursor-default", clamp, className)}>
          {value}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-sm text-left whitespace-pre-wrap break-words"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

export function EnquiriesPage() {
  const { canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const enquiriesState = useAppSelector((s) => s.enquiries);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] =
    useState<EnquiryListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<EnquiryListFilters>(EMPTY_FILTERS);

  useEffect(() => {
    void dispatch(ensureEnquiries())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load enquiries.");
      });
  }, [dispatch, enquiriesState.invalidated]);

  const rows = enquiriesState.items;
  const activeFilterCount = countActiveFilters(appliedFilters);

  const typeOptions = useMemo(() => {
    const labels = [
      ...new Set(rows.map((r) => r.type.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    return labels.map((label) => ({
      value: label,
      label: titleCase(label),
      keywords: label,
    }));
  }, [rows]);

  const priorityOptions = useMemo(
    () =>
      PRIORITIES.map((priority) => ({
        value: priority,
        label: titleCase(priority),
      })),
    [],
  );

  const statusOptions = useMemo(
    () => statuses.map((status) => ({ value: status, label: titleCase(status) })),
    [],
  );

  const submittedOptions = [
    { value: "last_3", label: "Last 3 days" },
    { value: "last_7", label: "Last 7 days" },
    { value: "last_30", label: "Last 30 days" },
    { value: "last_90", label: "Last 90 days" },
    { value: "older", label: "Older than 90 days" },
  ];

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((e) => {
      if (
        q &&
        !e.investorName.toLowerCase().includes(q) &&
        !e.message.toLowerCase().includes(q) &&
        !e.type.toLowerCase().includes(q) &&
        !e.status.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (
        appliedFilters.types.length > 0 &&
        !appliedFilters.types.includes(e.type)
      ) {
        return false;
      }
      if (
        appliedFilters.priorities.length > 0 &&
        !appliedFilters.priorities.includes(e.priority)
      ) {
        return false;
      }
      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(e.status)
      ) {
        return false;
      }
      if (appliedFilters.submitted.length > 0) {
        const bucket = submittedBucket(e.submittedAt);
        if (!appliedFilters.submitted.includes(bucket)) return false;
      }
      return true;
    });
  }, [rows, search, appliedFilters]);

  const preferredTime = (r: Enquiry): string => {
    if (!r.date && !r.time) return "—";
    const datePart = r.date ? formatDate(r.date) : "";
    const timePart = r.time ?? "";
    if (datePart && timePart) return `${datePart}, ${timePart}`;
    return datePart || timePart || "—";
  };

  const handleDownloadExcel = () => {
    if (filtered.length === 0) {
      toast.error("No enquiries to download.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    void (async () => {
      try {
        await downloadStyledExcel({
          filename: `enquiries-${stamp}.xlsx`,
          sheetName: "Enquiries",
          title: `Enquiries export · ${filtered.length} row${
            filtered.length === 1 ? "" : "s"
          } · ${stamp}`,
          columns: [
            { header: "S.No", width: 8, align: "center" },
            { header: "Investor", width: 22 },
            { header: "Type", width: 16 },
            { header: "Message", width: 40 },
            { header: "Preferred", width: 18 },
            { header: "Submitted", width: 18 },
            { header: "Priority", width: 12, align: "center" },
            { header: "Status", width: 16, align: "center" },
            { header: "Latest", width: 22 },
          ],
          rows: filtered.map((e, index) => [
            { value: index + 1, hint: "index" },
            { value: e.investorName },
            { value: e.type },
            { value: e.message },
            { value: preferredTime(e) === "—" ? "" : preferredTime(e) },
            { value: formatDateTime(e.submittedAt) },
            { value: titleCase(e.priority || ""), hint: "status" },
            { value: titleCase(e.status || ""), hint: "status" },
            { value: e.latestAction },
          ]),
        });
        toast.success(
          `Downloaded ${filtered.length} enquir${
            filtered.length === 1 ? "y" : "ies"
          }.`,
        );
      } catch {
        toast.error("Unable to download Excel file.");
      }
    })();
  };

  const columns: Column<Enquiry>[] = [
    {
      key: "investor",
      header: "Investor",
      className: "max-w-[8.5rem]",
      cell: (r) => <TruncateTip text={r.investorName} className="font-medium" />,
    },
    {
      key: "type",
      header: "Type",
      className: "max-w-[7rem]",
      cell: (r) => <TruncateTip text={r.type} />,
    },
    {
      key: "message",
      header: "Message",
      className: "max-w-[11rem]",
      cell: (r) => <TruncateTip text={r.message || "—"} lines={2} />,
    },
    {
      key: "preferredTime",
      header: "Preferred",
      className: "max-w-[7.5rem]",
      cell: (r) => <TruncateTip text={preferredTime(r)} />,
      mobileHidden: true,
    },
    {
      key: "submitted",
      header: "Submitted",
      className: "max-w-[7.5rem]",
      cell: (r) => <TruncateTip text={formatDateTime(r.submittedAt)} />,
      mobileHidden: true,
    },
    {
      key: "priority",
      header: "Priority",
      className: "w-[5.5rem]",
      cell: (r) => <StatusBadge value={r.priority} />,
    },
    {
      key: "status",
      header: "Status",
      className: "w-[6.5rem]",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "latest",
      header: "Latest",
      className: "max-w-[8rem]",
      cell: (r) => <TruncateTip text={r.latestAction || "—"} />,
      mobileHidden: true,
    },
    {
      key: "update",
      header: "Update",
      className: "w-[8.5rem]",
      cell: (r) =>
        canMutate("enquiries") ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Select
              value={r.status}
              disabled={updatingId === r.id || deleting}
              onValueChange={async (v) => {
                const status = v as EnquiryStatus;
                if (status === r.status) return;
                setUpdatingId(r.id);
                try {
                  const updated = await updateEnquiry(r.id, {
                    status,
                    latestAction: `Status → ${status}`,
                  });
                  dispatch(
                    upsertEnquiry({
                      ...r,
                      ...updated,
                      status: updated.status || status,
                      latestAction:
                        updated.latestAction || `Status → ${status}`,
                    }),
                  );
                  dispatch(invalidateEnquiries());
                  toast.success("Enquiry updated");
                } catch (err) {
                  toast.error(
                    err instanceof ApiError
                      ? err.message
                      : "Unable to update enquiry.",
                  );
                } finally {
                  setUpdatingId(null);
                }
              }}
            >
              <SelectTrigger className="h-8 w-[7.5rem] bg-background px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "w-[6.5rem]",
      cell: (r) =>
        canMutate("enquiries") ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 px-2"
                disabled={deleting && deleteTarget?.id === r.id}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                variant="destructive"
                disabled={deleting && deleteTarget?.id === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(r);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          "—"
        ),
    },
  ];

  const loading =
    (enquiriesState.status === "loading" || enquiriesState.status === "idle") &&
    enquiriesState.items.length === 0;

  if (loading) return <LoadingBlock variant="table" />;

  if (enquiriesState.status === "failed" && enquiriesState.items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Enquiries"
          description="Agent workflow for investor interest and follow-ups."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {enquiriesState.error ?? "Unable to load enquiries."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => void dispatch(ensureEnquiries({ force: true }))}
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
        title="Enquiries"
        description="Agent workflow for investor interest and follow-ups."
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search investor, message, type…"
        searchActions={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setDraftFilters(appliedFilters);
                setOpenFilterKey(null);
                setFiltersOpen(true);
              }}
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
              disabled={filtered.length === 0}
            >
              <Download className="size-4" />
              Download Excel
            </Button>
          </>
        }
      />

      {activeFilterCount > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {activeFilterCount} status filter
            {activeFilterCount === 1 ? "" : "s"} applied
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setAppliedFilters(EMPTY_FILTERS);
              setDraftFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            Clear all
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        page={page}
        onPageChange={setPage}
        emptyTitle="No enquiries"
        emptyDescription="New investor interest will appear here."
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
                id="enquiry-filter-type"
                label="Type"
                values={draftFilters.types}
                onValuesChange={(types) =>
                  setDraftFilters((prev) => ({ ...prev, types }))
                }
                options={typeOptions}
                placeholder="All types"
                searchPlaceholder="Search type…"
                emptyMessage="No types found"
                open={openFilterKey === "type"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "type" : null)
                }
              />

              <SearchableMultiSelect
                id="enquiry-filter-priority"
                label="Priority"
                values={draftFilters.priorities}
                onValuesChange={(priorities) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    priorities: priorities as EnquiryPriority[],
                  }))
                }
                options={priorityOptions}
                placeholder="All priorities"
                searchPlaceholder="Search priority…"
                open={openFilterKey === "priority"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "priority" : null)
                }
              />

              <SearchableMultiSelect
                id="enquiry-filter-status"
                label="Status"
                values={draftFilters.statuses}
                onValuesChange={(next) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    statuses: next as EnquiryStatus[],
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
                id="enquiry-filter-submitted"
                label="Date"
                values={draftFilters.submitted}
                onValuesChange={(submitted) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    submitted: submitted as SubmittedFilter[],
                  }))
                }
                options={submittedOptions}
                placeholder="Any submitted date"
                searchPlaceholder="Search…"
                open={openFilterKey === "submitted"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "submitted" : null)
                }
              />
            </div>
          </div>

          <SheetFooter className="shrink-0 border-t border-border sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDraftFilters(EMPTY_FILTERS)}
              disabled={countActiveFilters(draftFilters) === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => {
                setAppliedFilters(draftFilters);
                setPage(1);
                setOpenFilterKey(null);
                setFiltersOpen(false);
              }}
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
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (deleting) return;
          if (!open) setDeleteTarget(null);
        }}
        title="Delete enquiry?"
        description={
          deleteTarget
            ? `Enquiry from “${deleteTarget.investorName}” will be permanently deleted. This cannot be undone.`
            : "This enquiry will be permanently deleted."
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        destructive
        loading={deleting}
        onConfirm={() => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleting(true);
          void (async () => {
            try {
              await deleteEnquiry(target.id);
              dispatch(removeEnquiryLocal(target.id));
              dispatch(invalidateEnquiries());
              toast.success("Enquiry deleted");
              setDeleteTarget(null);
            } catch (err) {
              toast.error(
                err instanceof ApiError
                  ? err.message
                  : "Unable to delete enquiry.",
              );
            } finally {
              setDeleting(false);
            }
          })();
        }}
      />
    </div>
  );
}
