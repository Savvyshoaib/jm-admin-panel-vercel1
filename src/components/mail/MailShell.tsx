import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  FileStack,
  Inbox,
  Mail,
  Megaphone,
  Plus,
  Send,
  Star,
  Trash2,
  FilePenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  folderUnreadCount,
  type MailFolder,
} from "@/data/mailingMock";

const folderItems: {
  folder: MailFolder;
  href: string;
  label: string;
  icon: typeof Inbox;
}[] = [
  { folder: "inbox", href: "/mail", label: "Inbox", icon: Inbox },
  { folder: "important", href: "/mail/important", label: "Important", icon: Star },
  { folder: "sent", href: "/mail/sent", label: "Sent", icon: Send },
  { folder: "drafts", href: "/mail/drafts", label: "Drafts", icon: FilePenLine },
  { folder: "trash", href: "/mail/trash", label: "Deleted", icon: Trash2 },
];

const libraryItems = [
  { href: "/mail/templates", label: "Templates", icon: FileStack },
  { href: "/mail/campaigns", label: "Campaigns", icon: Megaphone },
];

export function MailShell({
  children,
  onCompose,
}: {
  children: ReactNode;
  onCompose?: () => void;
}) {
  const [pathname] = useLocation();

  return (
    <div className="-mx-4 -mb-6 -mt-6 flex min-h-[calc(100dvh-5.25rem)] flex-col overflow-hidden sm:-mx-6 lg:-mx-8 lg:-mb-8 lg:-mt-8 lg:min-h-[calc(100dvh-5.5rem)] lg:flex-row">
      {/* Mail secondary nav */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border/80 bg-card/35 lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">Mail</p>
              <p className="truncate text-[11px] text-muted-foreground">
                Templates & campaigns
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            className="size-8 shrink-0 rounded-xl"
            aria-label="Compose email"
            onClick={onCompose}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible lg:px-2.5 lg:py-3">
          <p className="hidden px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:block">
            Mailbox
          </p>
          {folderItems.map((item) => {
            const active =
              item.href === "/mail"
                ? pathname === "/mail"
                : pathname === item.href;
            const unread = folderUnreadCount(item.folder);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "opacity-80",
                  )}
                />
                <span className="truncate">{item.label}</span>
                {unread > 0 ? (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {unread}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="my-1 hidden h-px bg-border/70 lg:block" />
          <p className="hidden px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:block">
            Library
          </p>
          {libraryItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/12 text-foreground ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "opacity-80",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}
