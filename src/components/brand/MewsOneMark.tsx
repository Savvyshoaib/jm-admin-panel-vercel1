import type { CSSProperties } from "react";

/** Mews One brand mark — 4-tile icon (gold via currentColor). */
export function MewsOneMark({
  className,
  title = "Mews One",
  style,
}: {
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Top-left */}
      <rect x="1" y="1" width="28" height="28" rx="8" />
      {/* Top-right — concave toward center (bottom-left of tile) */}
      <path d="M35 1h20c4.4 0 8 3.6 8 8v12.5c0 2.1-.8 4.1-2.3 5.6L48.1 39.7A8 8 0 0 1 42.4 42H35c-4.4 0-8-3.6-8-8V9c0-4.4 3.6-8 8-8Z" />
      {/* Bottom-left — concave toward center (top-right of tile) */}
      <path d="M9 35h12.5c2.1 0 4.1.8 5.6 2.3l12.6 12.6A8 8 0 0 1 42 55.2V55c0 4.4-3.6 8-8 8H9c-4.4 0-8-3.6-8-8V43c0-4.4 3.6-8 8-8Z" />
      {/* Bottom-right */}
      <rect x="35" y="35" width="28" height="28" rx="8" />
    </svg>
  );
}
