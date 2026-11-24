import { Film, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Same row layout as document cards. Click opens the in-app player.
 */
export function ReelVideoCard({
  title,
  fileType,
  onOpen,
}: {
  src: string;
  title: string;
  fileType?: string;
  onOpen: () => void;
}) {
  const type = (fileType || "video").toUpperCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border/80 bg-background/35 px-3 py-3 text-left transition",
        "hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={`Play ${title}`}
    >
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/10 text-[10px] font-semibold tracking-wide text-sky-400">
        <Film className="mb-0.5 size-3.5" aria-hidden />
        {type}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {type} · Tap to play
        </span>
      </span>
      <Play className="size-4 shrink-0 fill-current text-muted-foreground" aria-hidden />
    </button>
  );
}
