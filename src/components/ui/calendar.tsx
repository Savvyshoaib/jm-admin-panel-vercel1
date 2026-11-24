import * as React from "react";
import {
  addYears,
  format,
  isSameMonth,
  setMonth,
  setYear,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Past → future range so completion dates beyond this year stay selectable. */
const DEFAULT_START = new Date(2000, 0);
const DEFAULT_END = new Date(new Date().getFullYear() + 25, 11);

type CalendarView = "days" | "months" | "years";

type CalendarProps = DayPickerProps & {
  className?: string;
  classNames?: DayPickerProps["classNames"];
  showOutsideDays?: boolean;
  startMonth?: Date;
  endMonth?: Date;
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function clampMonth(date: Date, start: Date, end: Date): Date {
  const t = startOfMonth(date).getTime();
  if (t < startOfMonth(start).getTime()) return startOfMonth(start);
  if (t > startOfMonth(end).getTime()) return startOfMonth(end);
  return startOfMonth(date);
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  startMonth = DEFAULT_START,
  endMonth = DEFAULT_END,
  month: controlledMonth,
  defaultMonth,
  onMonthChange,
  ...props
}: CalendarProps) {
  const [view, setView] = React.useState<CalendarView>("days");
  const [internalMonth, setInternalMonth] = React.useState<Date>(() =>
    clampMonth(
      controlledMonth ?? defaultMonth ?? new Date(),
      startMonth,
      endMonth,
    ),
  );

  const displayMonth = clampMonth(
    controlledMonth ?? internalMonth,
    startMonth,
    endMonth,
  );

  const setDisplayMonth = (next: Date) => {
    const clamped = clampMonth(next, startMonth, endMonth);
    setInternalMonth(clamped);
    onMonthChange?.(clamped);
  };

  const startYear = startMonth.getFullYear();
  const endYear = endMonth.getFullYear();
  const decadeStart = Math.floor(displayMonth.getFullYear() / 12) * 12;

  const canPrevDecade = decadeStart > startYear;
  const canNextDecade = decadeStart + 11 < endYear;

  const navBtn = cn(
    buttonVariants({ variant: "outline" }),
    "size-7 bg-transparent p-0 opacity-70 hover:opacity-100",
  );

  const gridCell = (active: boolean) =>
    cn(
      "h-9 rounded-md text-sm font-medium transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-40",
      active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    );

  if (view === "years") {
    const years = Array.from({ length: 12 }, (_, i) => decadeStart + i).filter(
      (y) => y >= startYear && y <= endYear,
    );
    return (
      <div className={cn("w-[280px] p-3", className)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={navBtn}
            disabled={!canPrevDecade}
            aria-label="Previous years"
            onClick={() =>
              setDisplayMonth(setYear(displayMonth, decadeStart - 12))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-medium tabular-nums">
            {decadeStart} – {decadeStart + 11}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={navBtn}
            disabled={!canNextDecade}
            aria-label="Next years"
            onClick={() =>
              setDisplayMonth(setYear(displayMonth, decadeStart + 12))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {years.map((year) => {
            const active = year === displayMonth.getFullYear();
            return (
              <button
                key={year}
                type="button"
                className={gridCell(active)}
                onClick={() => {
                  setDisplayMonth(setYear(displayMonth, year));
                  setView("months");
                }}
              >
                {year}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "months") {
    return (
      <div className={cn("w-[280px] p-3", className)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={navBtn}
            disabled={displayMonth.getFullYear() <= startYear}
            aria-label="Previous year"
            onClick={() => setDisplayMonth(addYears(displayMonth, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <button
            type="button"
            className={cn(
              "rounded-md px-2 py-1 text-sm font-medium tabular-nums",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            onClick={() => setView("years")}
          >
            {displayMonth.getFullYear()}
          </button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={navBtn}
            disabled={displayMonth.getFullYear() >= endYear}
            aria-label="Next year"
            onClick={() => setDisplayMonth(addYears(displayMonth, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, monthIndex) => {
            const candidate = setMonth(
              setYear(new Date(), displayMonth.getFullYear()),
              monthIndex,
            );
            const outOfRange =
              startOfMonth(candidate) < startOfMonth(startMonth) ||
              startOfMonth(candidate) > startOfMonth(endMonth);
            const active = isSameMonth(candidate, displayMonth);
            return (
              <button
                key={label}
                type="button"
                disabled={outOfRange}
                className={gridCell(active)}
                onClick={() => {
                  setDisplayMonth(setMonth(displayMonth, monthIndex));
                  setView("days");
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="label"
      startMonth={startMonth}
      endMonth={endMonth}
      month={displayMonth}
      onMonthChange={setDisplayMonth}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "relative flex flex-col",
        month: "flex w-full flex-col gap-4",
        month_caption: "relative flex h-9 w-full items-center justify-center px-10",
        caption_label: "text-sm font-medium text-foreground",
        nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between px-1",
        button_previous: cn(navBtn, "z-10"),
        button_next: cn(navBtn, "z-10"),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-9 rounded-md text-[0.75rem] font-normal",
        week: "mt-1.5 flex w-full",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-40 aria-selected:opacity-40",
        disabled: "text-muted-foreground opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, size: _s, ...rest }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon
              className={cn("size-4", chevronClassName)}
              aria-hidden
              {...rest}
            />
          );
        },
        CaptionLabel: () => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Choose month"
              onClick={() => setView("months")}
            >
              {format(displayMonth, "MMMM")}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Choose year"
              onClick={() => setView("years")}
            >
              {format(displayMonth, "yyyy")}
            </button>
          </div>
        ),
      }}
      {...props}
    />
  );
}

export { Calendar };
