import { cn } from "@/lib/utils";

type SeriesKey = string;

export function SimpleBarChart({
  data,
  series,
  className,
}: {
  data: Record<string, string | number>[];
  series: { key: SeriesKey; label: string; className?: string }[];
  className?: string;
}) {
  const max = Math.max(
    1,
    ...data.flatMap((row) => series.map((s) => Number(row[s.key]) || 0)),
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-36 items-end gap-2">
        {data.map((row, i) => (
          <div
            key={String(row.label ?? i)}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-28 w-full items-end justify-center gap-0.5">
              {series.map((s) => {
                const value = Number(row[s.key]) || 0;
                const pct = Math.round((value / max) * 100);
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${value}`}
                    className={cn(
                      "w-full max-w-3 rounded-t-md bg-primary/70",
                      s.className,
                    )}
                    style={{ height: `${Math.max(4, pct)}%` }}
                  />
                );
              })}
            </div>
            <span className="truncate text-[10px] text-muted-foreground">
              {String(row.label ?? "")}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className={cn("size-2 rounded-sm bg-primary/70", s.className)}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
