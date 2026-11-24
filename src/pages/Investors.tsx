import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { Download, ListFilter, MoreHorizontal } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { downloadStyledExcel } from "@/lib/excelExport";
import { formatDate, titleCase } from "@/lib/format";
import type { AccountStatus, Investor } from "@/models";
import { deleteInvestor } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import { ensureAgents } from "@/store/slices/agentsSlice";
import {
  ensureInvestors,
  invalidateInvestors,
  removeInvestorLocal,
} from "@/store/slices/investorsSlice";

type RecommendedFilter = "has_recommended" | "none_recommended";
type SignupFilter = "last_3" | "last_7" | "last_30" | "last_90" | "older";

type InvestorListFilters = {
  countries: string[];
  nationalities: string[];
  /** Exact ownedPropertyCount values as strings, e.g. "0", "1", "3". */
  owned: string[];
  recommended: RecommendedFilter[];
  statuses: AccountStatus[];
  signup: SignupFilter[];
};

const EMPTY_FILTERS: InvestorListFilters = {
  countries: [],
  nationalities: [],
  owned: [],
  recommended: [],
  statuses: [],
  signup: [],
};

const ACCOUNT_STATUSES: AccountStatus[] = ["active", "inactive", "pending"];

function countActiveFilters(filters: InvestorListFilters): number {
  return (
    filters.countries.length +
    filters.nationalities.length +
    filters.owned.length +
    filters.recommended.length +
    filters.statuses.length +
    filters.signup.length
  );
}

function uniqueSortedLabels(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function signupBucket(createdAt: string): SignupFilter {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "older";
  const days = (Date.now() - created) / 86_400_000;
  if (days <= 3) return "last_3";
  if (days <= 7) return "last_7";
  if (days <= 30) return "last_30";
  if (days <= 90) return "last_90";
  return "older";
}

export function InvestorsPage() {
  const { user, canMutate } = useAuth();
  const dispatch = useAppDispatch();
  const searchParams = useSearch();
  const [, setLocation] = useLocation();
  const investorsState = useAppSelector((s) => s.investors);
  const agentsState = useAppSelector((s) => s.agents);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Investor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] =
    useState<InvestorListFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] =
    useState<InvestorListFilters>(EMPTY_FILTERS);

  const urlFilter = new URLSearchParams(searchParams).get("filter");

  useEffect(() => {
    if (!user) return;
    void dispatch(ensureInvestors())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(
          typeof err === "string" ? err : "Unable to load investors.",
        );
      });
    void dispatch(ensureAgents())
      .unwrap()
      .catch((err: unknown) => {
        if (isThunkConditionError(err)) return;
        toast.error(typeof err === "string" ? err : "Unable to load agents.");
      });
  }, [user, dispatch]);

  const agents = useMemo(
    () => agentsState.items.map((u) => ({ id: u.id, name: u.name })),
    [agentsState.items],
  );

  const rows = investorsState.items;
  const activeFilterCount = countActiveFilters(appliedFilters);

  const countryOptions = useMemo(
    () =>
      uniqueSortedLabels(rows.map((r) => r.country)).map((label) => ({
        value: label,
        label,
      })),
    [rows],
  );

  const nationalityOptions = useMemo(
    () =>
      uniqueSortedLabels(rows.map((r) => r.nationality)).map((label) => ({
        value: label,
        label,
      })),
    [rows],
  );

  const statusOptions = useMemo(
    () =>
      ACCOUNT_STATUSES.map((status) => ({
        value: status,
        label: titleCase(status),
      })),
    [],
  );

  const ownedOptions = useMemo(() => {
    const byCount = new Map<number, number>();
    for (const inv of rows) {
      const count = Math.max(0, Math.floor(Number(inv.ownedPropertyCount) || 0));
      byCount.set(count, (byCount.get(count) ?? 0) + 1);
    }
    return [...byCount.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([count, investors]) => ({
        value: String(count),
        label: `${count} ${count === 1 ? "property" : "properties"} · ${investors} investor${
          investors === 1 ? "" : "s"
        }`,
        keywords: `${count} owned portfolio`,
      }));
  }, [rows]);

  const recommendedOptions = [
    { value: "has_recommended", label: "Has recommended properties" },
    { value: "none_recommended", label: "No recommended properties" },
  ];

  const signupOptions = [
    { value: "last_3", label: "Last 3 days" },
    { value: "last_7", label: "Last 7 days" },
    { value: "last_30", label: "Last 30 days" },
    { value: "last_90", label: "Last 90 days" },
    { value: "older", label: "Older than 90 days" },
  ];

  const filtered = useMemo(() => {
    return rows.filter((inv) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.name.toLowerCase().includes(q) ||
        inv.email.toLowerCase().includes(q) ||
        inv.nationality.toLowerCase().includes(q) ||
        inv.country.toLowerCase().includes(q);
      const matchesAgent =
        agentFilter === "all" || inv.assignedAgentId === agentFilter;

      if (urlFilter === "pending_invite") {
        if (inv.invitationStatus !== "sent") return false;
      } else if (urlFilter === "invited") {
        if (inv.invitationStatus == null || inv.invitationStatus === "revoked") {
          return false;
        }
      }

      if (
        appliedFilters.countries.length > 0 &&
        !appliedFilters.countries.includes(inv.country)
      ) {
        return false;
      }

      if (
        appliedFilters.nationalities.length > 0 &&
        !appliedFilters.nationalities.includes(inv.nationality)
      ) {
        return false;
      }

      if (appliedFilters.owned.length > 0) {
        const count = String(
          Math.max(0, Math.floor(Number(inv.ownedPropertyCount) || 0)),
        );
        if (!appliedFilters.owned.includes(count)) return false;
      }

      if (appliedFilters.recommended.length > 0) {
        const hasRecommended = (inv.recommendedPropertyIds?.length ?? 0) > 0;
        const key: RecommendedFilter = hasRecommended
          ? "has_recommended"
          : "none_recommended";
        if (!appliedFilters.recommended.includes(key)) return false;
      }

      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(inv.accountStatus)
      ) {
        return false;
      }

      if (appliedFilters.signup.length > 0) {
        const bucket = signupBucket(inv.createdAt);
        if (!appliedFilters.signup.includes(bucket)) return false;
      }

      return matchesSearch && matchesAgent;
    });
  }, [rows, search, agentFilter, appliedFilters, urlFilter]);

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
    if (filtered.length === 0) {
      toast.error("No investors to download.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    void (async () => {
      try {
        await downloadStyledExcel({
          filename: `investors-${stamp}.xlsx`,
          sheetName: "Investors",
          title: `Investors export · ${filtered.length} row${
            filtered.length === 1 ? "" : "s"
          } · ${stamp}`,
          columns: [
            { header: "S.No", width: 8, align: "center" },
            { header: "Investor", width: 24 },
            { header: "Email", width: 28 },
            { header: "Phone", width: 16 },
            { header: "Country", width: 16 },
            { header: "Nationality", width: 16 },
            { header: "Residency", width: 14, align: "center" },
            { header: "Agent", width: 18 },
            { header: "Account", width: 12, align: "center" },
            { header: "Invitation", width: 12, align: "center" },
            { header: "Properties", width: 12, align: "center" },
            { header: "Last active", width: 14 },
            { header: "Date added", width: 14 },
          ],
          rows: filtered.map((inv, index) => [
            { value: index + 1, hint: "index" },
            { value: inv.name },
            { value: inv.email },
            { value: inv.phone },
            { value: inv.country },
            { value: inv.nationality },
            {
              value: titleCase(inv.residencyStatus || ""),
              hint: "status",
            },
            {
              value:
                agents.find((a) => a.id === inv.assignedAgentId)?.name ?? "",
            },
            {
              value: titleCase(inv.accountStatus || ""),
              hint: "status",
            },
            {
              value: titleCase(inv.invitationStatus ?? "none"),
              hint: "status",
            },
            { value: inv.ownedPropertyCount },
            { value: formatDate(inv.lastActiveAt) },
            { value: formatDate(inv.createdAt) },
          ]),
        });
        toast.success(
          `Downloaded ${filtered.length} investor${
            filtered.length === 1 ? "" : "s"
          }.`,
        );
      } catch {
        toast.error("Unable to download Excel file.");
      }
    })();
  };

  const columns: Column<Investor>[] = [
    { key: "name", header: "Investor", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "email", header: "Email", cell: (r) => r.email },
    { key: "phone", header: "Phone", cell: (r) => r.phone || "—", mobileHidden: true },
    { key: "country", header: "Country", cell: (r) => r.country, mobileHidden: true },
    { key: "nationality", header: "Nationality", cell: (r) => r.nationality, mobileHidden: true },
    {
      key: "residency",
      header: "Residency",
      cell: (r) => <StatusBadge value={r.residencyStatus} />,
      mobileHidden: true,
    },
    {
      key: "agent",
      header: "Agent",
      cell: (r) => agents.find((a) => a.id === r.assignedAgentId)?.name ?? "—",
      mobileHidden: true,
    },
    { key: "account", header: "Account", cell: (r) => <StatusBadge value={r.accountStatus} /> },
    {
      key: "invite",
      header: "Invitation",
      cell: (r) => <StatusBadge value={r.invitationStatus ?? "none"} />,
    },
    {
      key: "owned",
      header: "Properties",
      cell: (r) => r.ownedPropertyCount,
      className: "tabular-nums",
    },
    {
      key: "active",
      header: "Last active",
      cell: (r) => formatDate(r.lastActiveAt),
      mobileHidden: true,
    },
    {
      key: "added",
      header: "Date added",
      cell: (r) => formatDate(r.createdAt),
      mobileHidden: true,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) =>
        canMutate("investors") ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 gap-1 sm:min-h-8"
                disabled={deleting && deleteTarget?.id === r.id}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/investors/${r.id}?tab=portfolio`);
                }}
              >
                Add property
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

  const investorsLoading =
    (investorsState.status === "loading" || investorsState.status === "idle") &&
    investorsState.items.length === 0;
  const agentsLoading =
    (agentsState.status === "loading" || agentsState.status === "idle") &&
    agentsState.items.length === 0;

  if (investorsLoading || agentsLoading) return <LoadingBlock variant="table" />;

  if (investorsState.status === "failed" && investorsState.items.length === 0) {
    return (
      <div className="w-full space-y-4">
        <PageHeader
          title="Investors"
          description="Searchable investor CRM with invitation and account visibility."
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {investorsState.error ?? "Unable to load investors."}
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => {
                void dispatch(ensureInvestors({ force: true }));
              }}
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
        title="Investors"
        description="Searchable investor CRM with invitation and account visibility."
        actions={
          canMutate("investors") ? (
            <>
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/investors/new">Add investor</Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/investors/invite">Invite investor</Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search name, email, nationality…"
        searchActions={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={openFilters}
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
      >
        <Select
          value={agentFilter}
          onValueChange={(v) => {
            setAgentFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {activeFilterCount > 0 ? (
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
        rows={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => setLocation(`/investors/${r.id}`)}
        page={page}
        onPageChange={setPage}
        pageSize={8}
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
                id="investor-filter-country"
                label="Country"
                values={draftFilters.countries}
                onValuesChange={(countries) =>
                  setDraftFilters((prev) => ({ ...prev, countries }))
                }
                options={countryOptions}
                placeholder="All countries"
                searchPlaceholder="Search country…"
                emptyMessage="No countries found"
                open={openFilterKey === "country"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "country" : null)
                }
              />

              <SearchableMultiSelect
                id="investor-filter-nationality"
                label="Nationality"
                values={draftFilters.nationalities}
                onValuesChange={(nationalities) =>
                  setDraftFilters((prev) => ({ ...prev, nationalities }))
                }
                options={nationalityOptions}
                placeholder="All nationalities"
                searchPlaceholder="Search nationality…"
                emptyMessage="No nationalities found"
                open={openFilterKey === "nationality"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "nationality" : null)
                }
              />

              <SearchableMultiSelect
                id="investor-filter-owned"
                label="Properties Owned"
                values={draftFilters.owned}
                onValuesChange={(owned) =>
                  setDraftFilters((prev) => ({ ...prev, owned }))
                }
                options={ownedOptions}
                placeholder="Any count"
                searchPlaceholder="Search count…"
                emptyMessage="No ownership counts found"
                open={openFilterKey === "owned"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "owned" : null)
                }
              />

              <SearchableMultiSelect
                id="investor-filter-recommended"
                label="Recommended Properties"
                values={draftFilters.recommended}
                onValuesChange={(recommended) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    recommended: recommended as RecommendedFilter[],
                  }))
                }
                options={recommendedOptions}
                placeholder="Any recommendation status"
                searchPlaceholder="Search…"
                open={openFilterKey === "recommended"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "recommended" : null)
                }
              />

              <SearchableMultiSelect
                id="investor-filter-status"
                label="Status"
                values={draftFilters.statuses}
                onValuesChange={(statuses) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    statuses: statuses as AccountStatus[],
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
                id="investor-filter-signup"
                label="Latest Signup"
                values={draftFilters.signup}
                onValuesChange={(signup) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    signup: signup as SignupFilter[],
                  }))
                }
                options={signupOptions}
                placeholder="Any signup date"
                searchPlaceholder="Search…"
                open={openFilterKey === "signup"}
                onOpenChange={(open) =>
                  setOpenFilterKey(open ? "signup" : null)
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
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (deleting) return;
          if (!open) setDeleteTarget(null);
        }}
        title="Delete investor?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be permanently deleted. This cannot be undone.`
            : "This investor will be permanently deleted."
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
              await deleteInvestor(target.id);
              dispatch(removeInvestorLocal(target.id));
              dispatch(invalidateInvestors());
              toast.success("Investor deleted");
              setDeleteTarget(null);
            } catch (err) {
              toast.error(
                err instanceof ApiError ? err.message : "Unable to delete investor.",
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
