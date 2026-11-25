import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { EmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { MetricCard } from "@/components/whatsapp/MetricCard";
import {
  INTERAKT_CONNECTED,
  WORKER_NAME,
  mockParseLeadSheet,
  type UploadHistoryItem,
  uploadHistorySeed,
} from "@/data/whatsappWorkerMock";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function WhatsAppDataPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<UploadHistoryItem[]>(uploadHistorySeed);
  const [lastSummary, setLastSummary] = useState<UploadHistoryItem | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const ok =
      /\.(csv|xlsx|xls)$/i.test(file.name) ||
      file.type.includes("sheet") ||
      file.type.includes("csv");
    if (!ok) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx).");
      return;
    }

    const parsed = mockParseLeadSheet(file);
    const item: UploadHistoryItem = {
      id: `up-${Date.now()}`,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "You",
      ...parsed,
    };
    setLastSummary(item);
    setHistory((prev) => [item, ...prev]);
    toast.success(`Imported ${item.rowsNew} new rows from ${file.name}`);
  };

  const columns: Column<UploadHistoryItem>[] = [
    {
      key: "file",
      header: "File",
      cell: (row) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <FileSpreadsheet className="size-3.5 text-primary" aria-hidden />
          {row.fileName}
        </span>
      ),
    },
    {
      key: "uploaded",
      header: "Uploaded",
      cell: (row) => formatDateTime(row.uploadedAt),
    },
    {
      key: "by",
      header: "By",
      cell: (row) => row.uploadedBy,
    },
    {
      key: "total",
      header: "Rows",
      cell: (row) => (
        <span className="tabular-nums">{row.rowsTotal}</span>
      ),
    },
    {
      key: "new",
      header: "New",
      cell: (row) => (
        <span className="tabular-nums">{row.rowsNew}</span>
      ),
    },
    {
      key: "dup",
      header: "Duplicates",
      cell: (row) => (
        <span className="tabular-nums">{row.rowsDuplicate}</span>
      ),
    },
    {
      key: "invalid",
      header: "Invalid",
      cell: (row) => (
        <span className="tabular-nums">{row.rowsInvalid}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge value={row.status.toLowerCase()} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data"
        description="Upload lead sheets and review validation history for the WhatsApp worker pool."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{WORKER_NAME}</span>
            <InteraktPill connected={INTERAKT_CONNECTED} />
          </div>
        }
      />

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "glass-panel flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-dashed px-6 py-12 text-center ring-1 ring-white/8 transition-colors",
          dragging && "bg-primary/8 ring-primary/40",
        )}
      >
        <Upload className="size-8 text-primary" aria-hidden />
        <div>
          <p className="font-medium">Drop a lead sheet here, or click to browse</p>
          <p className="mt-1 text-sm text-muted-foreground">
            CSV or Excel (.csv, .xlsx) — client-side mock validation only
          </p>
        </div>
        <Button type="button" size="sm" className="rounded-xl pointer-events-none">
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {lastSummary ? (
        <section className="space-y-3" aria-label="Import summary">
          <p className="label-eyebrow">Latest import summary</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="File" value={lastSummary.fileName} hint="Uploaded just now" />
            <MetricCard label="Total rows" value={lastSummary.rowsTotal} />
            <MetricCard
              label="New"
              value={lastSummary.rowsNew}
              tone="up"
              hint="Added to pool"
            />
            <MetricCard
              label="Duplicates"
              value={lastSummary.rowsDuplicate}
              hint="Skipped"
            />
            <MetricCard
              label="Invalid"
              value={lastSummary.rowsInvalid}
              tone={lastSummary.rowsInvalid > 0 ? "down" : "neutral"}
              hint={lastSummary.status}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-serif text-lg font-medium">Upload history</h2>
          <p className="text-sm text-muted-foreground">
            Validation outcomes for recent lead sheet imports.
          </p>
        </div>
        {history.length === 0 ? (
          <EmptyState
            title="No uploads yet"
            description="Upload a CSV or Excel lead sheet to see history here."
          />
        ) : (
          <div className="glass-panel overflow-hidden rounded-2xl ring-1 ring-white/8">
            <DataTable
              columns={columns}
              rows={history}
              rowKey={(r) => r.id}
              emptyTitle="No uploads yet"
            />
          </div>
        )}
      </section>
    </div>
  );
}
