import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, Film, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { prepareVideoForUpload } from "@/lib/compressVideo";
import { cn } from "@/lib/utils";

export type PendingUploadFile = {
  id: string;
  file: File;
  previewUrl?: string;
  /** Video over 100 MB is compressed before it can be uploaded. */
  status?: "compressing" | "ready" | "error";
  note?: string;
};

type CompressJob = {
  progress: number;
  message: string;
};

type UploadKind = "docs" | "images" | "videos";

const KIND_CONFIG: Record<
  UploadKind,
  {
    accept: string;
    hint: string;
    emptyLabel: string;
    Icon: typeof FileText;
  }
> = {
  docs: {
    accept: ".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.csv",
    hint: "PDF, Word, Excel, PowerPoint, TXT, CSV",
    emptyLabel: "Drop documents here, or click to browse",
    Icon: FileText,
  },
  images: {
    accept: "image/png,image/jpeg,image/jpg,image/webp,image/gif",
    hint: "PNG, JPG, WEBP, GIF",
    emptyLabel: "Drop images here, or click to browse",
    Icon: ImageIcon,
  },
  videos: {
    accept: "video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi",
    hint: "MP4, MOV, WEBM, AVI · saved as H.264 MP4",
    emptyLabel: "Drop videos here, or click to browse",
    Icon: Film,
  },
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesKind(file: File, kind: UploadKind): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (kind === "images") {
    return type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
  }
  if (kind === "videos") {
    return type.startsWith("video/") || /\.(mp4|webm|mov|avi)$/i.test(name);
  }
  return (
    type.includes("pdf") ||
    type.includes("word") ||
    type.includes("sheet") ||
    type.includes("presentation") ||
    type.includes("text") ||
    type.includes("csv") ||
    /\.(pdf|docx?|xlsx?|pptx?|txt|rtf|csv)$/i.test(name)
  );
}

function createPending(file: File, kind: UploadKind): PendingUploadFile {
  const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`;
  const previewUrl =
    kind === "images" && file.type.startsWith("image/")
      ? URL.createObjectURL(file)
      : undefined;
  return { id, file, previewUrl };
}

export function revokePendingUploads(files: PendingUploadFile[]) {
  for (const item of files) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}

type MultiFileDropzoneProps = {
  kind: UploadKind;
  label: string;
  files: PendingUploadFile[];
  onChange: (files: PendingUploadFile[]) => void;
  disabled?: boolean;
  className?: string;
};

export function MultiFileDropzone({
  kind,
  label,
  files,
  onChange,
  disabled = false,
  className,
}: MultiFileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<Record<string, CompressJob>>({});
  const filesRef = useRef(files);
  const onChangeRef = useRef(onChange);
  const running = useRef<Map<string, AbortController>>(new Map());
  filesRef.current = files;
  onChangeRef.current = onChange;
  const config = KIND_CONFIG[kind];
  const Icon = config.Icon;

  const compressKey =
    kind === "videos"
      ? files
          .filter((item) => item.status === "compressing")
          .map((item) => item.id)
          .join("\n")
      : "";

  useEffect(() => {
    const jobsRef = running.current;
    return () => {
      for (const controller of jobsRef.values()) controller.abort();
      jobsRef.clear();
    };
  }, []);

  useEffect(() => {
    const ids = new Set(compressKey ? compressKey.split("\n") : []);
    for (const [id, controller] of running.current) {
      if (!ids.has(id)) {
        controller.abort();
        running.current.delete(id);
      }
    }

    for (const id of ids) {
      if (running.current.has(id)) continue;
      const item = filesRef.current.find((file) => file.id === id);
      if (!item) continue;
      const controller = new AbortController();
      running.current.set(id, controller);
      void (async () => {
        try {
          const compressed = await prepareVideoForUpload(item.file, {
            signal: controller.signal,
            onProgress: (percent) => {
              setJobs((prev) => ({
                ...prev,
                [id]: {
                  progress: percent,
                  message: prev[id]?.message ?? "Compressing to under 100 MB…",
                },
              }));
            },
            onStatus: (message) => {
              setJobs((prev) => ({
                ...prev,
                [id]: { progress: prev[id]?.progress ?? 0, message },
              }));
            },
          });
          if (controller.signal.aborted) return;
          onChangeRef.current(
            filesRef.current.map((file) =>
              file.id === id
                ? {
                    ...file,
                    file: compressed,
                    status: "ready",
                    note: compressed === item.file ? undefined : "MP4 for every browser",
                  }
                : file,
            ),
          );
          setJobs((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (error) {
          if (
            controller.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            return;
          }
          const message =
            error instanceof Error ? error.message : "Couldn't compress this video.";
          setJobs((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
          onChangeRef.current(
            filesRef.current.map((file) =>
              file.id === id ? { ...file, status: "error", note: message } : file,
            ),
          );
        } finally {
          running.current.delete(id);
        }
      })();
    }
  }, [compressKey]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).filter((f) => matchesKind(f, kind));
      if (incoming.length === 0) return;
      const next = [...files];
      for (const file of incoming) {
        const duplicate = next.some(
          (p) =>
            p.file.name === file.name &&
            p.file.size === file.size &&
            p.file.lastModified === file.lastModified,
        );
        if (duplicate) continue;
        const pending = createPending(file, kind);
        if (kind === "videos") {
          pending.status = "compressing";
          pending.note = "Checking video…";
        }
        next.push(pending);
      }
      onChange(next);
    },
    [files, kind, onChange],
  );

  const removeFile = (id: string) => {
    running.current.get(id)?.abort();
    running.current.delete(id);
    setJobs((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const target = files.find((f) => f.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    onChange(files.filter((f) => f.id !== id));
  };

  return (
    <div className={cn("space-y-2 md:col-span-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {files.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {files.length} file{files.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          if (disabled) return;
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors",
          "border-border bg-card/20 hover:border-primary/40 hover:bg-card/35",
          dragging && "border-primary bg-primary/5",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground">
          {dragging ? <Upload className="size-5" /> : <Icon className="size-5" />}
        </div>
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            {dragging ? "Drop files to add them" : config.emptyLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Multiple files supported · {config.hint}
            {kind === "videos" ? " · Plays on iPhone, Android, and every browser" : ""}
          </p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={config.accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.some((item) => item.status === "compressing") ? (
        <p className="text-xs text-muted-foreground" role="status">
          Preparing the video so it plays on every phone. Keep this page open. Save stays off until it finishes.
        </p>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((item) => {
            const job = jobs[item.id];
            const compressing = item.status === "compressing";
            const failed = item.status === "error";
            return (
            <li
              key={item.id}
              className="rounded-md border border-border bg-card/30 px-3 py-2"
            >
              <div className="flex items-center gap-3">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-10 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-background/50 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{item.file.name}</p>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    failed && "text-error",
                  )}
                  role={compressing ? "status" : undefined}
                >
                  {compressing ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
                      {formatBytes(item.file.size)} · {job?.message ?? item.note}{" "}
                      {job?.progress ?? 0}%
                    </span>
                  ) : failed ? (
                    item.note
                  ) : (
                    <>
                      {formatBytes(item.file.size)}
                      {item.note ? ` · ${item.note}` : ""}
                    </>
                  )}
                </p>
              </div>
              {!disabled ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(item.id);
                  }}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
              </div>
              {compressing ? (
                <Progress
                  value={job?.progress ?? 0}
                  className="mt-2 h-1"
                  aria-label={`Compressing ${item.file.name}`}
                />
              ) : null}
            </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
