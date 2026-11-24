import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Soft count-up for dashboard KPIs. */
export function AnimatedNumber({
  value,
  duration = 720,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safe);
  const [glow, setGlow] = useState(false);
  const prev = useRef(safe);
  const first = useRef(true);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(safe);
      prev.current = safe;
      return;
    }

    const from = first.current ? 0 : prev.current;
    first.current = false;
    prev.current = safe;
    setGlow(true);

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (safe - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const glowTimer = window.setTimeout(() => setGlow(false), duration + 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(glowTimer);
    };
  }, [safe, duration]);

  return (
    <span
      className={cn(
        "tabular-nums",
        glow && "animate-count-glow",
        className,
      )}
    >
      {display.toLocaleString("en-GB")}
    </span>
  );
}
