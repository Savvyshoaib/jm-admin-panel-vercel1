import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InteraktPill } from "@/components/whatsapp/InteraktPill";
import { LeadStatusBadge } from "@/components/whatsapp/LeadStatusBadge";
import {
  INTERAKT_CONNECTED,
  WORKER_NAME,
  type WhatsAppLead,
  type WhatsAppMsgStatus,
  type WhatsAppThreadMessage,
} from "@/data/whatsappWorkerMock";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function Ticks({ status }: { status?: WhatsAppMsgStatus }) {
  if (!status) return null;
  const Icon = status === "sent" ? Check : CheckCheck;
  return (
    <Icon
      className={cn(
        "size-3.5",
        status === "read" ? "text-primary" : "text-primary-foreground/70",
      )}
      aria-label={status}
    />
  );
}

function Bubble({
  message,
  leadName,
}: {
  message: WhatsAppThreadMessage;
  leadName: string;
}) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center px-2">
        <p className="max-w-[90%] rounded-full bg-white/6 px-3 py-1 text-center text-[11px] text-muted-foreground ring-1 ring-white/8">
          {message.body}
        </p>
      </div>
    );
  }

  const fromJoe = message.role === "joe";

  return (
    <div className={cn("flex", fromJoe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm",
          fromJoe
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-white/[0.07] text-foreground ring-1 ring-white/10",
        )}
      >
        {!fromJoe ? (
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            {leadName}
          </p>
        ) : (
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground/70">
            Joe
          </p>
        )}
        <p className="whitespace-pre-wrap">{message.body}</p>
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums",
            fromJoe
              ? "text-primary-foreground/70"
              : "text-muted-foreground",
          )}
        >
          {formatMsgTime(message.at)}
          {fromJoe ? <Ticks status={message.status} /> : null}
        </p>
      </div>
    </div>
  );
}

export function LeadChatThread({
  lead,
  messages,
  className,
  compactHeader,
}: {
  lead: WhatsAppLead;
  messages: WhatsAppThreadMessage[];
  className?: string;
  /** Hide outer chrome when nested in a sheet/drawer. */
  compactHeader?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const blocked = lead.optedOut;

  const grouped = useMemo(() => {
    const rows: Array<
      | { kind: "day"; key: string; label: string }
      | { kind: "msg"; key: string; message: WhatsAppThreadMessage }
    > = [];
    let lastDay = "";
    for (const message of messages) {
      const day = dateKey(message.at);
      if (day !== lastDay) {
        lastDay = day;
        rows.push({
          kind: "day",
          key: `day-${day}`,
          label: formatDate(message.at),
        });
      }
      rows.push({ kind: "msg", key: message.id, message });
    }
    return rows;
  }, [messages]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onSend = () => {
    if (blocked) return;
    const text = draft.trim();
    if (!text) return;
    toast.message("Reply noted (demo — WhatsApp send not wired).");
    setDraft("");
  };

  return (
    <section
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        !compactHeader &&
          "glass-panel min-h-[480px] max-h-[640px] rounded-2xl ring-1 ring-white/8",
        className,
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-start justify-between gap-3 border-b border-white/8",
          compactHeader ? "pr-12 pl-4 pt-4 pb-3" : "px-4 py-3",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MessageCircle className="size-3.5 text-primary" aria-hidden />
            <p className="label-eyebrow">WhatsApp conversation</p>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {WORKER_NAME} · {lead.phone}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {!compactHeader ? <LeadStatusBadge status={lead.status} /> : null}
          <InteraktPill connected={INTERAKT_CONNECTED} />
        </div>
      </header>

      <div
        ref={scroller}
        className="jm-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(252,193,29,0.06),transparent_55%)] px-3 py-4 sm:px-4"
      >
        {grouped.length === 0 ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-foreground">
              No messages yet
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Outreach has not started. Joe will open with the approved
              qualification message.
            </p>
          </div>
        ) : (
          grouped.map((row) =>
            row.kind === "day" ? (
              <div key={row.key} className="flex justify-center">
                <span className="rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-white/10">
                  {row.label}
                </span>
              </div>
            ) : (
              <Bubble
                key={row.key}
                message={row.message}
                leadName={lead.name}
              />
            ),
          )
        )}
      </div>

      <footer className="border-t border-white/8 bg-white/[0.02] p-3">
        {blocked ? (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive ring-1 ring-destructive/25">
            Opted out — WhatsApp replies are blocked.
          </p>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <label className="sr-only" htmlFor={`wa-reply-${lead.id}`}>
              Reply on WhatsApp
            </label>
            <textarea
              id={`wa-reply-${lead.id}`}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                lead.handoffRequested
                  ? "Handoff active — reply as the assigned rep…"
                  : "Reply as Joe…"
              }
              className="min-h-[44px] flex-1 resize-none rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none ring-1 ring-white/10 placeholder:text-muted-foreground focus-visible:ring-primary/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              disabled={!draft.trim()}
              aria-label="Send reply"
            >
              <Send className="size-4" />
            </Button>
          </form>
        )}
      </footer>
    </section>
  );
}
