import { cn } from "@/lib/utils";

export function InteraktPill({
  connected = true,
  className,
}: {
  connected?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        connected
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400"
          : "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-emerald-500" : "bg-muted-foreground",
        )}
      />
      {connected ? "Interakt connected" : "Interakt offline"}
    </span>
  );
}
