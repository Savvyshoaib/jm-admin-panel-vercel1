import type { CSSProperties } from "react";
import logoSvg from "../../../assets/images/mews-one-logo.svg";
import { MewsOneMark } from "@/components/brand/MewsOneMark";
import { cn } from "@/lib/utils";

const EASE = "280ms cubic-bezier(0.22, 1, 0.36, 1)";

type Props = {
  /** Sidebar: icon-only when true, full wordmark when false */
  collapsed?: boolean;
  className?: string;
  /** Full logo height (expanded). Mark uses same box when collapsed. */
  height?: number | string;
};

/**
 * Mews One brand.
 * Expanded → full SVG logo. Collapsed → 4-tile mark only (no clip/jerk).
 */
export function MewsOneLogo({
  collapsed = false,
  className,
  height = "2.75rem",
}: Props) {
  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center overflow-hidden",
        className,
      )}
      style={
        {
          height: h,
          width: collapsed ? h : undefined,
          transition: `width ${EASE}`,
        } as CSSProperties
      }
    >
      <img
        src={logoSvg}
        alt={collapsed ? "" : "Mews One"}
        draggable={false}
        className="pointer-events-none h-full w-auto max-w-[14rem] select-none object-contain object-left"
        style={{
          opacity: collapsed ? 0 : 1,
          position: collapsed ? "absolute" : "relative",
          left: 0,
          top: 0,
          transition: "opacity 160ms ease",
        }}
      />
      <MewsOneMark
        className="pointer-events-none absolute left-0 top-0 text-[#fcc11d]"
        style={
          {
            width: h,
            height: h,
            opacity: collapsed ? 1 : 0,
            transition: "opacity 160ms ease",
          } as CSSProperties
        }
      />
    </span>
  );
}
