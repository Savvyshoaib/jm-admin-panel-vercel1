import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { PendingUploadFile } from "@/components/admin/MultiFileDropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaImage } from "@/components/admin/MediaImage";
import { ReelVideoCard } from "@/components/admin/ReelVideoCard";
import { VideoJsPlayer } from "@/components/admin/VideoJsPlayer";
import {
  displayImageUrl,
  getConfiguredApiOrigin,
  resolveMediaUrl,
} from "@/lib/apiClient";
import { ensurePlaybackWorker } from "@/lib/playableVideo";
import { cn } from "@/lib/utils";
import type { ContentMediaAsset, ContentStatus } from "@/models";
import { resolveContentMediaUrl } from "@/services/contentApi";

type PreviewItem = {
  id: string;
  src: string;
  name: string;
  displayName: string;
  fileType: string;
  pending?: boolean;
};

type LightboxKind = "image";

/** Top-level file URL. A new tab is not covered by the admin page content policy. */
function directFileUrl(src: string): string {
  if (!src) return "";
  if (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    /^https?:\/\//i.test(src)
  ) {
    return src;
  }
  if (src.startsWith("/")) {
    const origin = getConfiguredApiOrigin();
    return origin ? `${origin}${src}` : src;
  }
  return src;
}

function mediaSrc(asset: ContentMediaAsset): string {
  const raw = asset.url || resolveContentMediaUrl(asset.path) || asset.path;
  return resolveMediaUrl(raw);
}

function displayNameFrom(name: string): string {
  const raw = name.trim();
  if (!raw) return "Untitled";
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return raw;
  return raw.slice(0, dot);
}

function fileTypeFrom(name: string, fileType?: string): string {
  if (fileType) return fileType.toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function DocBadge({ fileType }: { fileType: string }) {
  const t = fileType.toLowerCase();
  if (t === "pdf") {
    return (
      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-red-500/35 bg-red-500/10 text-[10px] font-semibold tracking-wide text-red-400">
        <FileText className="mb-0.5 size-3.5" />
        PDF
      </div>
    );
  }
  if (t === "doc" || t === "docx" || t === "rtf") {
    return (
      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-sky-500/35 bg-sky-500/10 text-[10px] font-semibold tracking-wide text-sky-400">
        <FileText className="mb-0.5 size-3.5" />
        DOC
      </div>
    );
  }
  if (t === "xls" || t === "xlsx" || t === "csv") {
    return (
      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-[10px] font-semibold tracking-wide text-emerald-400">
        <FileSpreadsheet className="mb-0.5 size-3.5" />
        XLS
      </div>
    );
  }
  if (t === "ppt" || t === "pptx") {
    return (
      <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md border border-orange-500/35 bg-orange-500/10 text-[10px] font-semibold tracking-wide text-orange-400">
        <FileText className="mb-0.5 size-3.5" />
        PPT
      </div>
    );
  }
  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-background/50 text-muted-foreground">
      <FileText className="size-4" />
    </div>
  );
}

function buildImageItems(
  saved: ContentMediaAsset[],
  pending: PendingUploadFile[],
): PreviewItem[] {
  return [
    ...saved.map((asset, index) => ({
      id: asset.path || asset.url || `saved-${index}`,
      src: displayImageUrl(mediaSrc(asset)),
      name: asset.name,
      displayName: displayNameFrom(asset.name),
      fileType: fileTypeFrom(asset.name, asset.fileType),
    })),
    ...pending.map((item) => ({
      id: item.id,
      src: item.previewUrl || "",
      name: item.file.name,
      displayName: displayNameFrom(item.file.name),
      fileType: fileTypeFrom(item.file.name),
      pending: true,
    })),
  ].filter((item) => Boolean(item.src));
}

function buildVideoItems(
  saved: ContentMediaAsset[],
  pending: PendingUploadFile[],
  blobUrls: Map<string, string>,
): PreviewItem[] {
  return [
    ...saved.map((asset, index) => ({
      id: asset.path || asset.url || `saved-${index}`,
      src: mediaSrc(asset),
      name: asset.name,
      displayName: displayNameFrom(asset.name),
      fileType: fileTypeFrom(asset.name, asset.fileType) || "mp4",
    })),
    ...pending.map((item) => ({
      id: item.id,
      src: blobUrls.get(item.id) || "",
      name: item.file.name,
      displayName: displayNameFrom(item.file.name),
      fileType: fileTypeFrom(item.file.name) || "mp4",
      pending: true,
    })),
  ].filter((item) => Boolean(item.src));
}

function buildDocItems(
  saved: ContentMediaAsset[],
  pending: PendingUploadFile[],
  blobUrls: Map<string, string>,
): PreviewItem[] {
  return [
    ...saved.map((asset, index) => ({
      id: asset.path || asset.url || `saved-${index}`,
      src: mediaSrc(asset),
      name: asset.name,
      displayName: displayNameFrom(asset.name),
      fileType: fileTypeFrom(asset.name, asset.fileType),
    })),
    ...pending.map((item) => ({
      id: item.id,
      src: blobUrls.get(item.id) || "",
      name: item.file.name,
      displayName: displayNameFrom(item.file.name),
      fileType: fileTypeFrom(item.file.name),
      pending: true,
    })),
  ].filter((item) => Boolean(item.src));
}

export function ContentInvestorPreview({
  title,
  body,
  contentKey,
  area,
  status,
  propertyName,
  documents,
  images,
  videos,
  pendingDocs,
  pendingImages,
  pendingVideos,
}: {
  title: string;
  body: string;
  contentKey: string;
  area: string;
  status: ContentStatus;
  propertyName?: string | null;
  documents: ContentMediaAsset[];
  images: ContentMediaAsset[];
  videos: ContentMediaAsset[];
  pendingDocs: PendingUploadFile[];
  pendingImages: PendingUploadFile[];
  pendingVideos: PendingUploadFile[];
}) {
  const blobUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of [...pendingDocs, ...pendingVideos]) {
      map.set(item.id, URL.createObjectURL(item.file));
    }
    return map;
  }, [pendingDocs, pendingVideos]);

  useEffect(() => {
    return () => {
      for (const url of blobUrls.values()) URL.revokeObjectURL(url);
    };
  }, [blobUrls]);

  useEffect(() => {
    void ensurePlaybackWorker().catch(() => {
      /* Video cards still try; local proxy does not need the worker. */
    });
  }, []);

  const imageItems = useMemo(
    () => buildImageItems(images, pendingImages),
    [images, pendingImages],
  );
  const videoItems = useMemo(
    () => buildVideoItems(videos, pendingVideos, blobUrls),
    [videos, pendingVideos, blobUrls],
  );
  const docItems = useMemo(
    () => buildDocItems(documents, pendingDocs, blobUrls),
    [documents, pendingDocs, blobUrls],
  );

  const [lightbox, setLightbox] = useState<{
    kind: LightboxKind;
    index: number;
  } | null>(null);
  const [activeVideo, setActiveVideo] = useState<PreviewItem | null>(null);

  const lightboxItems = lightbox?.kind === "image" ? imageItems : [];
  const active = lightbox ? lightboxItems[lightbox.index] : null;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((prev) =>
          prev && lightboxItems.length
            ? {
                ...prev,
                index:
                  (prev.index - 1 + lightboxItems.length) %
                  lightboxItems.length,
              }
            : prev,
        );
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((prev) =>
          prev && lightboxItems.length
            ? { ...prev, index: (prev.index + 1) % lightboxItems.length }
            : prev,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, lightboxItems.length]);

  const openAt = (kind: LightboxKind, index: number) => {
    setLightbox({ kind, index });
  };

  const step = (dir: -1 | 1) => {
    if (!lightbox || lightboxItems.length === 0) return;
    setLightbox({
      ...lightbox,
      index:
        (lightbox.index + dir + lightboxItems.length) % lightboxItems.length,
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-card via-card to-background shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="relative overflow-hidden border-b border-border/70 px-5 py-5 sm:px-7 sm:py-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% -10%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 55%)",
          }}
        />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Investor preview
            </p>
            <p className="text-[11px] text-muted-foreground">
              Images open full · videos play in-app · documents open in a new tab
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {propertyName?.trim() ? (
              <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                {propertyName.trim()}
              </span>
            ) : null}
            <span className="rounded-full border border-border/80 bg-background/50 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {contentKey.trim() || "key"}
            </span>
            <span className="rounded-full border border-border/80 bg-background/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {area.trim() || "general"}
            </span>
            <StatusBadge value={status} />
          </div>
          <div className="space-y-2 pt-1">
            <h3 className="max-w-3xl font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
              {title.trim() || "Untitled"}
            </h3>
            <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {body.trim() || "No body copy yet."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-7">
        {imageItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Gallery
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {imageItems.length} image{imageItems.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Scroll · click to expand
              </p>
            </div>
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
              {imageItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openAt("image", index)}
                  className={cn(
                    "group relative aspect-[4/3] w-[min(78vw,17.5rem)] shrink-0 snap-start overflow-hidden rounded-lg border border-border/80 bg-muted/20 text-left transition",
                    "hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <MediaImage
                    src={item.src}
                    alt={item.displayName}
                    wrapperClassName="absolute inset-0 size-full"
                    className="transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" />
                  <span className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-white">
                      {item.displayName}
                    </span>
                    <Expand className="size-3.5 shrink-0 text-white/90" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {videoItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Media
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {videoItems.length} video{videoItems.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Tap a video to play
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {videoItems.map((item) => (
                <li key={item.id}>
                  <ReelVideoCard
                    src={item.src}
                    title={item.displayName}
                    fileType={item.fileType}
                    onOpen={() => setActiveVideo(item)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {docItems.length > 0 ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Documents
              </p>
              <p className="mt-1 text-sm text-foreground">
                Opens in a new tab
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {docItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={directFileUrl(item.src)}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-border/80 bg-background/35 px-3 py-3 text-left transition",
                      "hover:border-primary/40 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <DocBadge fileType={item.fileType} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">
                        {item.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(item.fileType || "file").toUpperCase()} · Opens in a
                        new tab
                      </p>
                    </div>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {imageItems.length + videoItems.length + docItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No media attached yet. Upload images, documents, or videos to see
            them here.
          </p>
        ) : null}
      </div>

      <Dialog
        open={Boolean(lightbox && active)}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[80]"
          className={cn(
            "z-[80]",
            "flex max-h-none min-h-0 flex-col gap-0 overflow-hidden border-border/80 bg-background p-0",
            "top-0 left-0 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none",
            "sm:top-[50%] sm:left-[50%] sm:h-auto sm:max-h-[min(92dvh,52rem)] sm:w-full sm:max-w-4xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg",
          )}
        >
          <DialogHeader className="flex flex-col gap-2 border-b border-border/70 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="truncate text-base">
                {active?.displayName || "Preview"}
              </DialogTitle>
              <DialogDescription className="truncate text-xs">
                {active
                  ? `${(active.fileType || lightbox?.kind || "").toUpperCase()}${
                      lightboxItems.length > 1
                        ? ` · ${lightbox!.index + 1} of ${lightboxItems.length}`
                        : ""
                    }`
                  : "Media preview"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              {lightboxItems.length > 1 ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Previous"
                    onClick={() => step(-1)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Next"
                    onClick={() => step(1)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              ) : null}
              {active?.src ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  asChild
                >
                  <a
                    href={active.src}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open in new tab"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Close"
                onClick={() => setLightbox(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col bg-black/40">
            {lightbox?.kind === "image" && active ? (
              <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-5">
                <MediaImage
                  src={active.src}
                  alt={active.displayName}
                  wrapperClassName="flex max-h-full max-w-full items-center justify-center"
                  className="!size-auto max-h-[min(80dvh,40rem)] max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>

          {lightboxItems.length > 1 ? (
            <div className="flex justify-center gap-1.5 border-t border-border/70 px-4 py-3">
              {lightboxItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Go to item ${index + 1}`}
                  className={cn(
                    "size-1.5 rounded-full transition",
                    index === lightbox?.index
                      ? "bg-primary"
                      : "bg-muted-foreground/35 hover:bg-muted-foreground/60",
                  )}
                  onClick={() =>
                    setLightbox((prev) =>
                      prev ? { ...prev, index } : prev,
                    )
                  }
                />
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(activeVideo)}
        onOpenChange={(open) => {
          if (!open) setActiveVideo(null);
        }}
      >
        <DialogContent
          overlayClassName="z-[80]"
          className="z-[80] flex max-h-[calc(100dvh-1rem)] w-[min(64rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-border/80 bg-background p-0 sm:max-w-[min(64rem,calc(100vw-1rem))]"
        >
          <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 text-left">
            <div className="min-w-0 space-y-0.5 pr-8">
              <DialogTitle className="line-clamp-2 text-base leading-snug">
                {activeVideo?.displayName || "Video"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {(activeVideo?.fileType || "video").toUpperCase()}
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center bg-black p-2 sm:p-3">
            {activeVideo ? (
              <VideoJsPlayer
                key={activeVideo.id}
                src={activeVideo.src}
                title={activeVideo.displayName}
                fileType={activeVideo.fileType}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
