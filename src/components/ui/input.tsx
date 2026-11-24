import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, onWheel, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground",
        "glass-input border-input h-11 w-full min-w-0 max-w-full rounded-xl border px-3.5 py-2.5 text-base outline-none",
        "file:inline-flex file:h-7 file:max-w-[55%] file:truncate file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:h-10 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-0",
        "aria-invalid:border-error aria-invalid:ring-error/25 dark:aria-invalid:ring-error/35",
        type === "number" &&
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className,
      )}
      {...props}
      onWheel={(e) => {
        if (type === "number") {
          e.currentTarget.blur();
        }
        onWheel?.(e);
      }}
    />
  );
}

export { Input };
