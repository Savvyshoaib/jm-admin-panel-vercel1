import type { ReactNode } from "react";
import logoMewsOne from "../../../assets/images/mews-one-logo.png";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-[color:var(--foreground)]/8 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_20%,var(--background)_70%)]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 animate-fade-up">
        <img
          src={logoMewsOne}
          alt="Mews One — by Joseph Mews Property"
          className="h-18 w-auto max-w-[16rem] object-contain sm:h-23"
        />

        <div className="glass-strong w-full rounded-2xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <p className="label-eyebrow text-primary/90">Welcome back</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
