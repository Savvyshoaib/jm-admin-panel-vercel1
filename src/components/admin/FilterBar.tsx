import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  searchActions,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Controls placed immediately to the right of the search field (e.g. Filters). */
  searchActions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full max-w-xl items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label="Search"
          />
        </div>
        {searchActions ? (
          <div className="flex shrink-0 items-center gap-2">{searchActions}</div>
        ) : null}
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}
