import { Link } from "wouter";
import type { AudiencePreview as AudiencePreviewData } from "@/data/whatsappWorkerMock";
import { cn } from "@/lib/utils";

const rows: {
  key: keyof AudiencePreviewData;
  label: string;
  emphasize?: boolean;
}[] = [
  { key: "total", label: "Total" },
  { key: "matching", label: "Matching" },
  { key: "whatsappEligible", label: "WhatsApp Eligible" },
  { key: "excludedNoConsent", label: "Excluded no consent" },
  { key: "optedOut", label: "Opted out" },
  { key: "finalAudience", label: "Final audience", emphasize: true },
];

export function AudiencePreview({
  data,
  viewLeadsHref,
  className,
}: {
  data: AudiencePreviewData;
  viewLeadsHref?: string;
  className?: string;
}) {
  return (
    <div className={cn("glass-panel space-y-4 rounded-2xl p-5 ring-1 ring-white/8", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-eyebrow">Audience preview</p>
          <h3 className="mt-1 font-serif text-lg font-medium">Smart match summary</h3>
        </div>
        {viewLeadsHref ? (
          <Link
            href={viewLeadsHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            View leads
          </Link>
        ) : null}
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "rounded-xl bg-white/4 px-3 py-2.5 ring-1 ring-white/8",
              row.emphasize && "ring-primary/30 bg-primary/8",
            )}
          >
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd
              className={cn(
                "mt-0.5 text-lg font-medium tabular-nums",
                row.emphasize && "text-primary",
              )}
            >
              {data[row.key]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
