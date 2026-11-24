import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  actions,
  children,
  defaultOpen = true,
  collapsible = false,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** When true, section header toggles open/closed. Default off — only Property unit blocks collapse. */
  collapsible?: boolean;
  /** Controlled open state. Omit to let the section manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const contentId = useId();
  const expanded = collapsible ? open : true;
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className="glass-panel animate-fade-up w-full rounded-2xl p-4 sm:p-6">
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          expanded && "mb-5 border-b border-white/8 pb-3.5",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={toggle}
          >
            <div className="flex items-start gap-2">
              <ChevronDown
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                  !open && "-rotate-90",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <h2 className="text-[15px] font-medium tracking-tight text-foreground">
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-medium tracking-tight text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )}
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {expanded ? (
        <div
          id={contentId}
          className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 [&>*]:min-w-0"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
