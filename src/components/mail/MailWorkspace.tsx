import { useState, type ReactNode } from "react";
import { MailShell } from "@/components/mail/MailShell";
import { ComposePanel } from "@/components/mail/ComposePanel";

/** Shared shell + compose for all /mail routes. */
export function MailWorkspace({ children }: { children: ReactNode }) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [expandSignal, setExpandSignal] = useState(0);

  return (
    <>
      <MailShell
        onCompose={() => {
          setComposeOpen(true);
          setExpandSignal((n) => n + 1);
        }}
      >
        {children}
      </MailShell>
      <ComposePanel
        open={composeOpen}
        onOpenChange={setComposeOpen}
        expandSignal={expandSignal}
      />
    </>
  );
}
