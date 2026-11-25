import { useEffect, useRef, useState } from "react";
import {
  Bold,
  ChevronDown,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  MoreHorizontal,
  Paperclip,
  Smile,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { mailTemplates } from "@/data/mailingMock";
import { cn } from "@/lib/utils";

type Attachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ToolbarBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-foreground/80 transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-white/10 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Bottom-right compose — solid vibrant panel, mini rich text, attachments. */
export function ComposePanel({
  open,
  onOpenChange,
  expandSignal = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandSignal?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [minimized, setMinimized] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [templateId, setTemplateId] = useState("none");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [entered, setEntered] = useState(false);
  const [fmt, setFmt] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setMinimized(false);
      setExpanded(false);
      return;
    }
    setMinimized(false);
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || expandSignal <= 0) return;
    setMinimized(false);
    setEntered(true);
  }, [expandSignal, open]);

  const syncFormat = () => {
    try {
      setFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch {
      /* ignore */
    }
  };

  const runCmd = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    syncFormat();
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (id === "none") return;
    const tpl = mailTemplates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(tpl.subject);
    if (editorRef.current) {
      editorRef.current.innerText = tpl.body;
    }
  };

  const reset = () => {
    setTo("");
    setCc("");
    setShowCc(false);
    setSubject("");
    setTemplateId("none");
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
    setMinimized(false);
    setExpanded(false);
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const close = () => {
    setEntered(false);
    window.setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 200);
  };

  const bodyText = () =>
    editorRef.current?.innerText?.trim() ?? "";

  const handleSend = () => {
    if (!to.trim() || !subject.trim()) {
      toast.error("Add a recipient and subject first.");
      return;
    }
    if (!bodyText() && attachments.length === 0) {
      toast.error("Write a message or attach a file.");
      return;
    }
    toast.success("Email queued (UI mock — API coming later).");
    close();
  };

  const addFiles = (files: FileList | null, asImage: boolean) => {
    if (!files?.length) return;
    const next: Attachment[] = [];
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      if (asImage && !isImage) {
        toast.error(`${file.name} is not an image.`);
        return;
      }
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      next.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl,
      });
      if (isImage && asImage && editorRef.current && previewUrl) {
        editorRef.current.focus();
        document.execCommand(
          "insertHTML",
          false,
          `<img src="${previewUrl}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`,
        );
      }
    });
    if (next.length) {
      setAttachments((prev) => [...prev, ...next]);
      toast.message(
        next.length === 1
          ? `Attached ${next[0]!.name}`
          : `Attached ${next.length} files`,
      );
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const insertLink = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    runCmd("createLink", url);
  };

  if (!open) return null;

  const title = subject.trim() || "New message";

  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-[70] flex max-w-full flex-col sm:right-5",
        "origin-bottom transition-all duration-300 ease-out",
        expanded
          ? "sm:bottom-4 sm:w-[min(40rem,calc(100vw-2.5rem))]"
          : "sm:bottom-0 sm:w-[28rem]",
        entered
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-10 opacity-0",
      )}
      role="dialog"
      aria-label="Compose email"
      aria-modal="false"
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden border border-[#3a3a3c]",
          "bg-[#1d1d1f] text-[#f5f5f7]",
          "shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
          expanded ? "rounded-2xl" : "rounded-t-2xl sm:rounded-t-2xl",
          minimized
            ? "h-auto"
            : expanded
              ? "h-[min(36rem,82dvh)]"
              : "h-[min(32rem,78dvh)]",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center gap-2 bg-[#252528] px-3.5 py-2.5",
            minimized && "cursor-pointer",
          )}
          onClick={() => {
            if (minimized) setMinimized(false);
          }}
          onKeyDown={(e) => {
            if (!minimized) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMinimized(false);
            }
          }}
          role={minimized ? "button" : undefined}
          tabIndex={minimized ? 0 : undefined}
        >
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
            {minimized ? title : "New message"}
          </p>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-[#a1a1a6] hover:bg-white/10 hover:text-white"
            aria-label={minimized ? "Expand compose" : "Minimize"}
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((v) => !v);
            }}
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-[#a1a1a6] hover:bg-white/10 hover:text-white"
            aria-label={expanded ? "Shrink compose" : "Maximize compose"}
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(false);
              setExpanded((v) => !v);
            }}
          >
            {expanded ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-[#a1a1a6] hover:bg-white/10 hover:text-white"
            aria-label="Close compose"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            <X className="size-3.5" />
          </button>
        </div>

        {!minimized ? (
          <>
            {/* Recipients */}
            <div className="flex items-center gap-2 border-b border-[#3a3a3c] px-3.5">
              <span className="shrink-0 text-[13px] text-[#8e8e93]">To</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Recipients"
                className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f5f7] outline-none placeholder:text-[#636366]"
                autoComplete="off"
              />
              <button
                type="button"
                className="shrink-0 text-[12px] font-medium text-primary hover:underline"
                onClick={() => setShowCc((v) => !v)}
              >
                Cc
              </button>
            </div>
            {showCc ? (
              <div className="flex items-center gap-2 border-b border-[#3a3a3c] px-3.5">
                <span className="shrink-0 text-[13px] text-[#8e8e93]">Cc</span>
                <input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Cc"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f5f7] outline-none placeholder:text-[#636366]"
                  autoComplete="off"
                />
              </div>
            ) : null}

            {/* Subject */}
            <div className="flex items-center gap-2 border-b border-[#3a3a3c] px-3.5">
              <span className="shrink-0 text-[13px] text-[#8e8e93]">
                Subject
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-[#f5f5f7] outline-none placeholder:text-[#636366]"
              />
            </div>

            {/* Mini rich editor */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-[#3a3a3c] bg-[#222225] px-2 py-1.5">
                <ToolbarBtn
                  label="Bold"
                  active={fmt.bold}
                  onClick={() => runCmd("bold")}
                >
                  <Bold className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Italic"
                  active={fmt.italic}
                  onClick={() => runCmd("italic")}
                >
                  <Italic className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Underline"
                  active={fmt.underline}
                  onClick={() => runCmd("underline")}
                >
                  <Underline className="size-3.5" />
                </ToolbarBtn>
                <span className="mx-1 h-4 w-px bg-[#3a3a3c]" />
                <ToolbarBtn
                  label="Bullet list"
                  onClick={() => runCmd("insertUnorderedList")}
                >
                  <List className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Numbered list"
                  onClick={() => runCmd("insertOrderedList")}
                >
                  <ListOrdered className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn label="Insert link" onClick={insertLink}>
                  <Link2 className="size-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Insert image"
                  onClick={() => imageRef.current?.click()}
                >
                  <ImagePlus className="size-3.5" />
                </ToolbarBtn>
              </div>

              <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline
                aria-label="Message body"
                data-placeholder="Write your message…"
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto px-3.5 py-3 text-[14px] leading-relaxed text-[#f5f5f7] outline-none",
                  "[&:empty:before]:pointer-events-none [&:empty:before]:text-[#636366] [&:empty:before]:content-[attr(data-placeholder)]",
                  "[&_a]:text-primary [&_a]:underline",
                  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
                  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
                )}
                onInput={syncFormat}
                onKeyUp={syncFormat}
                onMouseUp={syncFormat}
                suppressContentEditableWarning
              />

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 border-t border-[#3a3a3c] px-3 py-2.5">
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex max-w-full items-center gap-2 rounded-xl border border-[#3a3a3c] bg-[#2c2c2e] px-2 py-1.5"
                    >
                      {a.previewUrl ? (
                        <img
                          src={a.previewUrl}
                          alt=""
                          className="size-8 rounded-md object-cover"
                        />
                      ) : (
                        <Paperclip className="size-3.5 shrink-0 text-primary" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium">
                          {a.name}
                        </p>
                        <p className="text-[10px] text-[#8e8e93]">
                          {formatBytes(a.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ml-1 inline-flex size-6 items-center justify-center rounded-md text-[#8e8e93] hover:bg-white/10 hover:text-white"
                        aria-label={`Remove ${a.name}`}
                        onClick={() => removeAttachment(a.id)}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1.5 border-t border-[#3a3a3c] bg-[#252528] px-2.5 py-2">
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-xl text-[#a1a1a6] hover:bg-white/10 hover:text-white"
                aria-label="Discard"
                onClick={() => {
                  toast.message("Draft discarded");
                  close();
                }}
              >
                <Trash2 className="size-4" />
              </button>

              <div className="flex-1" />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-xl text-[#a1a1a6] hover:bg-white/10 hover:text-white"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[80] w-48">
                  <DropdownMenuItem
                    onClick={() => toast.message("Draft saved (UI mock)")}
                  >
                    Save draft
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => applyTemplate("none")}>
                    Blank message
                  </DropdownMenuItem>
                  {mailTemplates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => applyTemplate(t.id)}
                    >
                      Template: {t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-xl text-[#a1a1a6] hover:bg-white/10 hover:text-white"
                aria-label="Insert emoji"
                onClick={() => {
                  editorRef.current?.focus();
                  document.execCommand("insertText", false, "🙂");
                }}
              >
                <Smile className="size-4" />
              </button>

              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-xl text-[#a1a1a6] hover:bg-white/10 hover:text-white"
                aria-label="Attach file"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </button>

              <div className="ml-1 flex overflow-hidden rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgba(252,193,29,0.35)]">
                <button
                  type="button"
                  className="px-4 py-2 text-[13px] font-semibold"
                  onClick={handleSend}
                >
                  Send
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="border-l border-primary-foreground/20 px-2 py-2 hover:bg-black/10"
                      aria-label="Send options"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[80]">
                    <DropdownMenuItem
                      onClick={() =>
                        toast.message("Schedule send (UI mock — API later)")
                      }
                    >
                      Schedule send
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSend}>
                      Send now
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                addFiles(e.target.files, false);
                e.target.value = "";
              }}
            />
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              className="hidden"
              multiple
              onChange={(e) => {
                addFiles(e.target.files, true);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>

      {/* Quiet template hint when using one */}
      {!minimized && templateId !== "none" ? (
        <p className="sr-only">
          Template applied:{" "}
          {mailTemplates.find((t) => t.id === templateId)?.name}
        </p>
      ) : null}
    </div>
  );
}
