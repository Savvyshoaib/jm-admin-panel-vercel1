import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
} from "@/lib/format";
import type { UkhpiLog } from "@/models";
import { listUkhpiLogs } from "@/services/api";

function formatMaybeCurrency(value: number | null): string {
  if (value == null) return "—";
  return formatCurrency(value);
}

function formatMaybePercent(value: number | null): string {
  if (value == null) return "—";
  return formatPercent(value);
}

export function PriceHistoryPage() {
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<UkhpiLog[]>([]);
  const [status, setStatus] = useState<"loading" | "succeeded" | "failed">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const propertyIdFilter =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("propertyId")
      : null;

  const load = async () => {
    setStatus("loading");
    setError(null);
    try {
      const items = await listUkhpiLogs();
      setRows(items);
      setStatus("succeeded");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load price history.";
      setError(message);
      setStatus("failed");
      toast.error(message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((row) => {
      if (row.status.toLowerCase() === "skipped") return false;
      if (
        propertyIdFilter &&
        String(row.propertyId ?? "") !== String(propertyIdFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.propertyName.toLowerCase().includes(q) ||
        row.propertyReference.toLowerCase().includes(q) ||
        row.region.toLowerCase().includes(q) ||
        row.regionSlug.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.message.toLowerCase().includes(q) ||
        row.refMonth.toLowerCase().includes(q)
      );
    });
  }, [rows, search, propertyIdFilter]);

  const columns: Column<UkhpiLog>[] = [
    {
      key: "property",
      header: "Property",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.propertyName || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.propertyReference || r.propertyId || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "region",
      header: "Region",
      cell: (r) => r.regionSlug || r.region || "—",
      mobileHidden: true,
    },
    {
      key: "month",
      header: "Month",
      cell: (r) => r.refMonth || "—",
    },
    {
      key: "change",
      header: "Change",
      cell: (r) => formatMaybePercent(r.percentageChange),
      mobileHidden: true,
    },
    {
      key: "previous",
      header: "Previous",
      cell: (r) => formatMaybeCurrency(r.previousValue),
      mobileHidden: true,
    },
    {
      key: "new",
      header: "New value",
      cell: (r) => formatMaybeCurrency(r.newValue),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge value={r.status} />,
    },
    {
      key: "created",
      header: "Created",
      cell: (r) => formatDateTime(r.createdAt),
      mobileHidden: true,
    },
  ];

  if (status === "loading" && rows.length === 0) {
    return <LoadingBlock variant="table" />;
  }

  if (status === "failed" && rows.length === 0) {
    return (
      <div className="w-full space-y-4">
        <PageHeader
          title="Price history"
          description="UKHPI value updates applied to properties."
          breadcrumbs={[
            { label: "Properties", href: "/properties" },
            { label: "Price history" },
          ]}
        />
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          {error ?? "Unable to load price history."}
          <div className="mt-3">
            <Button variant="outline" onClick={() => void load()}>
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
        title="Price history"
        description="UKHPI value updates applied to properties."
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: "Price history" },
        ]}
        actions={
          propertyIdFilter ? (
            <Button variant="outline" asChild>
              <Link href={`/properties/${propertyIdFilter}`}>Back to property</Link>
            </Button>
          ) : null
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search property, region, status…"
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        page={page}
        onPageChange={setPage}
        pageSize={10}
        emptyTitle="No price history yet"
        emptyDescription="UKHPI update logs will appear here when values are applied."
        onRowClick={(r) => setLocation(`/properties/price-history/${r.id}`)}
      />
    </div>
  );
}
