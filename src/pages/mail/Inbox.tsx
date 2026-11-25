import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Calendar,
  Forward,
  Reply,
  ReplyAll,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailWorkspace } from "@/components/mail/MailWorkspace";
import {
  messagesForFolder,
  type MailFolder,
  type MailMessage,
} from "@/data/mailingMock";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(d);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

function MailListItem({
  message,
  active,
  onSelect,
}: {
  message: MailMessage;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full min-w-0 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200",
        active
          ? "border-primary/30 bg-card shadow-[0_8px_24px_rgba(0,0,0,0.18)] ring-1 ring-primary/20"
          : "border-transparent bg-transparent hover:border-border/70 hover:bg-card/50",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            message.unread
              ? "bg-primary/20 text-primary ring-1 ring-primary/30"
              : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {initials(message.fromName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "min-w-0 truncate text-sm",
                message.unread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/90",
              )}
            >
              {message.fromName}
            </p>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {shortWhen(message.sentAt)}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 truncate text-sm",
              message.unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {message.subject}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {message.preview}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {message.unread ? (
              <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />
            ) : null}
            {message.important || message.starred ? (
              <Star className="size-3.5 fill-primary text-primary" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}

function MailDetail({ message }: { message: MailMessage | null }) {
  if (!message) {
    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-foreground">Select a message</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Choose an email from the list to read it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => toast.message("Reply (UI mock)")}
        >
          <Reply className="size-3.5" />
          Reply
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => toast.message("Reply all (UI mock)")}
        >
          <ReplyAll className="size-3.5" />
          Reply all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => toast.message("Forward (UI mock)")}
        >
          <Forward className="size-3.5" />
          Forward
        </Button>
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-xl"
          aria-label="Star"
          onClick={() => toast.message("Star toggled (UI mock)")}
        >
          <Star
            className={cn(
              "size-3.5",
              message.starred && "fill-primary text-primary",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-xl"
          aria-label="Archive"
          onClick={() => toast.message("Archived (UI mock)")}
        >
          <Archive className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-xl"
          aria-label="Delete"
          onClick={() => toast.message("Moved to deleted (UI mock)")}
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-xl"
          aria-label="Schedule"
          onClick={() => toast.message("Calendar (UI mock)")}
        >
          <Calendar className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-1 ring-primary/25">
            {initials(message.fromName)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
                {message.subject}
              </h2>
              {message.important ? (
                <Badge
                  variant="outline"
                  className="rounded-sm border-primary/35 bg-gold-soft font-normal text-primary"
                >
                  Important
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-foreground">
              <span className="font-medium">{message.fromName}</span>{" "}
              <span className="text-muted-foreground">&lt;{message.fromEmail}&gt;</span>
            </p>
            <p className="text-xs text-muted-foreground">
              To {message.to.join(", ")}
              {message.cc.length > 0 ? ` · Cc ${message.cc.join(", ")}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(message.sentAt)}
            </p>
          </div>
        </div>

        <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {message.body}
        </div>
      </div>
    </div>
  );
}

export function MailInboxPage({ folder = "inbox" }: { folder?: MailFolder }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = messagesForFolder(folder);
    if (filter === "read") list = list.filter((m) => !m.unread);
    if (filter === "unread") list = list.filter((m) => m.unread);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        [m.fromName, m.fromEmail, m.subject, m.preview, m.body]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [folder, filter, query]);

  useEffect(() => {
    setQuery("");
    setFilter("all");
    const first = messagesForFolder(folder)[0];
    setSelectedId(first?.id ?? null);
  }, [folder]);

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const title =
    folder === "inbox"
      ? "Inbox"
      : folder.charAt(0).toUpperCase() + folder.slice(1);

  return (
    <MailWorkspace>
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        {/* Message list */}
        <section className="flex w-full min-h-0 flex-col border-b border-border/70 lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-[24rem]">
          <div className="space-y-3 border-b border-border/60 px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-base font-medium text-foreground">{title}</h1>
              <span className="text-xs text-muted-foreground">
                {rows.length} message{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mail…"
                className="rounded-xl pl-9"
                aria-label="Search mail"
              />
            </div>
            <div className="flex gap-1 rounded-xl bg-muted/40 p-1 ring-1 ring-border/60">
              {(["all", "unread", "read"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                    filter === key
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 sm:p-2.5">
            {rows.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                No messages in this view.
              </div>
            ) : (
              rows.map((m) => (
                <MailListItem
                  key={m.id}
                  message={m}
                  active={m.id === selectedId}
                  onSelect={() => setSelectedId(m.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Detail */}
        <section className="min-h-0 min-w-0 flex-1 bg-card/20">
          <MailDetail message={selected} />
        </section>
      </div>
    </MailWorkspace>
  );
}
