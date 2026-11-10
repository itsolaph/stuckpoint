/** The padlock shackle arc: the brand mark and the top edge of every lock tile. */
export function ShackleArc({
  width = 32,
  height = 19,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  const r = width / 2 - 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={`M2 ${height} V${r + 1.5} a${r} ${r} 0 0 1 ${r * 2} 0 V${height}`}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wordmark glyph: a shackle sitting on a small lock body. */
export function ShackleMark() {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" aria-hidden="true">
      <path
        d="M4.5 11 V7.25 a4.5 4.5 0 0 1 9 0 V11"
        stroke="#2B59D9"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="1" y="10" width="16" height="11" rx="3" fill="#0F1011" />
    </svg>
  );
}
