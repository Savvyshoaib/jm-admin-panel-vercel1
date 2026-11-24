import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground/70 glass-input border-input",
        "flex field-sizing-content min-h-20 w-full rounded-xl border px-3.5 py-2.5 text-base outline-none md:text-sm",
        "focus-visible:border-ring focus-visible:ring-0",
        "aria-invalid:border-error aria-invalid:ring-error/25 dark:aria-invalid:ring-error/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
