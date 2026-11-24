import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Shared form field chrome used across admin create/edit screens. */
export function FormField({
  label,
  required,
  error,
  hint,
  labelEnd,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  labelEnd?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("form-field group/field space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Label className="text-[13px] font-medium tracking-wide text-foreground/90">
            {label}
            {required ? (
              <span className="ml-0.5 text-primary" aria-hidden>
                *
              </span>
            ) : null}
          </Label>
          {hint ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
        {labelEnd ? <div className="shrink-0">{labelEnd}</div> : null}
      </div>
      <div className="form-control">{children}</div>
      {error ? (
        <p
          className="animate-fade-in text-xs text-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
