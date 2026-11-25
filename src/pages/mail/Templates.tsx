import { useMemo, useState } from "react";
import { FileStack, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailWorkspace } from "@/components/mail/MailWorkspace";
import { mailTemplates, type MailTemplate } from "@/data/mailingMock";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const categories = ["All", "Onboarding", "Investor", "Property", "Ops"] as const;

export function MailTemplatesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState<(typeof categories)[number]>("All");
  const [selectedId, setSelectedId] = useState(mailTemplates[0]?.id ?? null);

  const rows = useMemo(() => {
    let list = [...mailTemplates];
    if (category !== "All") {
      list = list.filter((t) => t.category === category);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        [t.name, t.subject, t.category, t.body].join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [query, category]);

  const selected: MailTemplate | null =
    rows.find((t) => t.id === selectedId) ?? rows[0] ?? null;

  return (
    <MailWorkspace>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileStack className="size-4 text-primary" />
              <h1 className="text-base font-medium text-foreground">Templates</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Reusable investor and ops emails for invites, KYC, and updates.
            </p>
          </div>
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => toast.message("New template (UI mock — API later)")}
          >
            <Plus className="size-4" />
            New template
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                  category === c
                    ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 w-full overflow-y-auto border-b border-border/70 p-3 lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-96">
            <div className="space-y-2">
              {rows.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No templates match.
                </p>
              ) : (
                rows.map((t) => {
                  const active = t.id === selected?.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full rounded-2xl border px-3.5 py-3 text-left transition-all",
                        active
                          ? "border-primary/30 bg-card ring-1 ring-primary/20"
                          : "border-transparent hover:border-border/70 hover:bg-card/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="shrink-0 rounded-sm font-normal"
                        >
                          {t.category}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {t.subject}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Used {t.usageCount}× · Updated {formatDate(t.updatedAt)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {selected ? (
              <div className="mx-auto max-w-2xl space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-xl font-medium tracking-tight text-foreground">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.subject}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        toast.message("Edit template (UI mock — API later)")
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      onClick={() =>
                        toast.success("Opened in compose (UI mock)")
                      }
                    >
                      Use template
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/80 bg-card/40 p-5 ring-1 ring-white/5">
                  <p className="label-eyebrow mb-3">Preview</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                    {selected.body}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a template.</p>
            )}
          </div>
        </div>
      </div>
    </MailWorkspace>
  );
}
