import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchableSelectOption } from "@/components/admin/SearchableSelect";

type SearchableMultiSelectProps = {
  id?: string;
  label?: string;
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /** When true, only one panel in a group stays open (pass shared openId + onOpenIdChange). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SearchableMultiSelect({
  id,
  label,
  values,
  onValuesChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results",
  disabled = false,
  className,
  open: openControlled,
  onOpenChange,
}: SearchableMultiSelectProps) {
  const reactId = useId();
  const rootId = id ?? reactId;
  const panelId = `${rootId}-panel`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const open = openControlled ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (openControlled === undefined) setUncontrolledOpen(next);
  };

  const selectedOptions = useMemo(
    () => options.filter((o) => values.includes(o.value)),
    [options, values],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""} ${o.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (event.target instanceof Node && !el.contains(event.target)) {
        onOpenChange?.(false);
        if (openControlled === undefined) setUncontrolledOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange?.(false);
        if (openControlled === undefined) setUncontrolledOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, openControlled, onOpenChange]);

  const toggle = (value: string) => {
    onValuesChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value],
    );
  };

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selected`;

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={rootId} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {values.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
              {values.length}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <Button
        id={rootId}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        className={cn(
          "glass-input h-11 w-full justify-between rounded-xl px-3.5 font-normal md:h-10",
          "border-input hover:bg-white/6",
          selectedOptions.length === 0 && "text-muted-foreground",
        )}
        onClick={() => setOpen(!open)}
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((opt) => (
            <Badge
              key={opt.value}
              variant="secondary"
              className="max-w-full gap-1 pr-1 font-normal"
            >
              <span className="truncate">{opt.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                aria-label={`Remove ${opt.label}`}
                onClick={() => toggle(opt.value)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-multiselectable
          aria-label={label ?? placeholder}
          className="overflow-hidden rounded-md border border-border bg-background shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 md:h-9"
              aria-label={searchPlaceholder}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:bg-accent focus-visible:text-accent-foreground",
                      isSelected && "bg-accent/60",
                    )}
                    onClick={() => toggle(option.value)}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                        isSelected &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                      aria-hidden
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate capitalize">
                      {option.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {values.length > 0 ? (
            <div className="border-t border-border p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full text-muted-foreground"
                onClick={() => onValuesChange([])}
              >
                Clear selection
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
