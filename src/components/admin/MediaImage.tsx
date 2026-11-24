import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { displayImageUrl } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type MediaImageProps = {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  emptyLabel?: string;
  failedLabel?: string;
};

export function MediaImage({
  src,
  alt,
  className,
  wrapperClassName,
  emptyLabel = "No preview",
  failedLabel = "Image unavailable",
}: MediaImageProps) {
  const displaySrc = displayImageUrl(src);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    displaySrc ? "loading" : "error",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setStatus(displaySrc ? "loading" : "error");
  }, [displaySrc, attempt]);

  if (!displaySrc || status === "error") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted/30 px-2 text-center",
          wrapperClassName,
        )}
      >
        <ImageOff className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">
          {!displaySrc ? emptyLabel : failedLabel}
        </p>
        {displaySrc ? (
          <button
            type="button"
            className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/40">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-[11px] text-muted-foreground">Loading…</p>
        </div>
      ) : null}
      <img
        key={`${displaySrc}:${attempt}`}
        src={displaySrc}
        alt={alt}
        className={cn(
          "size-full object-cover transition-opacity",
          status === "ready" ? "opacity-100" : "opacity-0",
          className,
        )}
        loading="eager"
        decoding="async"
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}
