import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormSection } from "@/components/admin/FormSection";
import { LoadingBlock } from "@/components/admin/LoadingBlock";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
} from "@/lib/format";
import type { UkhpiLog } from "@/models";
import { getUkhpiLog } from "@/services/api";

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function formatMaybeCurrency(value: number | null): string {
  if (value == null) return "—";
  return formatCurrency(value);
}

function formatMaybePercent(value: number | null): string {
  if (value == null) return "—";
  return formatPercent(value);
}

export function PriceHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [item, setItem] = useState<UkhpiLog | null>(null);
  const [status, setStatus] = useState<"loading" | "succeeded" | "failed">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setStatus("loading");
    setError(null);
    try {
      const log = await getUkhpiLog(id);
      if (!log) {
        setItem(null);
        setError("Price history entry not found.");
        setStatus("failed");
        return;
      }
      setItem(log);
      setStatus("succeeded");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to load price history detail.";
      setError(message);
      setStatus("failed");
      toast.error(message);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  if (status === "loading") return <LoadingBlock />;

  if (status === "failed" || !item) {
    return (
      <div className="w-full space-y-4">
        <PageHeader
          title="Price history detail"
          description={error ?? "Unable to load this log entry."}
          breadcrumbs={[
            { label: "Properties", href: "/properties" },
            { label: "Price history", href: "/properties/price-history" },
            { label: "Detail" },
          ]}
          actions={
            <Button variant="outline" asChild>
              <Link href="/properties/price-history">Back to list</Link>
            </Button>
          }
        />
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const backHref = item.propertyId
    ? `/properties/price-history?propertyId=${encodeURIComponent(item.propertyId)}`
    : "/properties/price-history";

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={item.propertyName || `Log #${item.id}`}
        description={item.message || "UKHPI price history entry."}
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: "Price history", href: backHref },
          { label: `Log #${item.id}` },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {item.propertyId ? (
              <Button variant="outline" asChild>
                <Link href={`/properties/${item.propertyId}`}>Open property</Link>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={backHref}>Back to list</Link>
            </Button>
          </div>
        }
      />

      <FormSection title="Summary" collapsible={false}>
        <DetailItem label="Status">
          <StatusBadge value={item.status} />
        </DetailItem>
        <DetailItem label="Reference month">
          {item.refMonth || "—"}
        </DetailItem>
        <DetailItem label="Percentage change">
          {formatMaybePercent(item.percentageChange)}
        </DetailItem>
        <DetailItem label="Created">
          {formatDateTime(item.createdAt)}
        </DetailItem>
      </FormSection>

      <FormSection title="Property" collapsible={false}>
        <DetailItem label="Name">{item.propertyName || "—"}</DetailItem>
        <DetailItem label="Reference">
          {item.propertyReference || "—"}
        </DetailItem>
        <DetailItem label="Property ID">{item.propertyId || "—"}</DetailItem>
        <DetailItem label="Region">{item.region || "—"}</DetailItem>
        <DetailItem label="Region slug">
          {item.regionSlug || "—"}
        </DetailItem>
      </FormSection>

      <FormSection title="Values" collapsible={false}>
        <DetailItem label="Previous value">
          {formatMaybeCurrency(item.previousValue)}
        </DetailItem>
        <DetailItem label="New value">
          {formatMaybeCurrency(item.newValue)}
        </DetailItem>
        <DetailItem label="Average price">
          {formatMaybeCurrency(item.averagePrice)}
        </DetailItem>
        <DetailItem label="House price index">
          {item.housePriceIndex == null ? "—" : String(item.housePriceIndex)}
        </DetailItem>
      </FormSection>

      <FormSection title="Source" collapsible={false}>
        <DetailItem label="Message">
          <p className="whitespace-pre-wrap">{item.message || "—"}</p>
        </DetailItem>
        <DetailItem label="Source">
          {item.sourceUrl ? "Landregistry" : "—"}
        </DetailItem>
        <DetailItem label="Updated">
          {formatDateTime(item.updatedAt)}
        </DetailItem>
      </FormSection>
    </div>
  );
}
