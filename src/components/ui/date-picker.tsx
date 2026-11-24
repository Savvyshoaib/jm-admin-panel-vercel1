import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toDateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";

const API_DATE = "yyyy-MM-dd";
const DISPLAY_DATE = "dd MMM yyyy";

function parseApiDate(value: string | null | undefined): Date | undefined {
  const normalized = toDateInputValue(value);
  if (!normalized) return undefined;
  const parsed = parse(normalized, API_DATE, new Date());
  return isValid(parsed) ? parsed : undefined;
}

type DatePickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  allowClear?: boolean;
};

function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Pick a date",
  className,
  id,
  allowClear = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseApiDate(value);
  const [month, setMonth] = React.useState<Date>(
    () => selected ?? new Date(),
  );

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  React.useEffect(() => {
    if (open) setMonth(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on open
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            "glass-input h-11 w-full justify-start gap-2.5 rounded-xl px-3.5 py-2.5 text-left font-normal md:h-10 md:text-sm",
            "border-input hover:bg-white/6",
            "data-[empty=true]:text-muted-foreground/70",
            "focus-visible:border-ring focus-visible:ring-0",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-primary/80" />
          <span className="truncate">
            {selected ? format(selected, DISPLAY_DATE) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="glass-strong w-auto rounded-2xl p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          key={open ? "open" : "closed"}
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            if (!date) {
              if (allowClear) onChange("");
              return;
            }
            onChange(format(date, API_DATE));
            setMonth(date);
            setOpen(false);
          }}
        />
        {allowClear && selected ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full text-muted-foreground"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
