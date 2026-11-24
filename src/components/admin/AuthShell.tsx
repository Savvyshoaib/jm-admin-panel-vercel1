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
    <div className="admin-ambient relative flex min-h-dvh items-center justify-center overflow-x-clip px-4 py-10">
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 animate-fade-up">
        <img
          src={logoMewsOne}
          alt="Mews One — by Joseph Mews Property"
          className="h-18 w-auto max-w-[16rem] object-contain sm:h-23"
        />

        <div className="glass-strong w-full rounded-2xl p-8">
          <h1 className="font-serif text-3xl text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
