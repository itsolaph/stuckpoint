/** Time helpers shared by actions and UI. No React, no I/O. */

/** Parse a timestamp as stored in SQL text columns ("2026-11-10 12:00:00.123+00") or ISO. */
export function parseDbTime(value: string): number {
  let iso = value.trim().replace(" ", "T");
  const time = iso.slice(iso.indexOf("T") + 1);
  if (/[+-]\d{2}$/.test(time)) iso += ":00";
  else if (!/(Z|[+-]\d{2}:?\d{2})$/.test(time)) iso += "Z"; // no offset means UTC
  return Date.parse(iso);
}

/** "just now", "5 minutes ago", "yesterday", "3 days ago", or a short date for older edits. */
export function relativeTime(value: string, now: number = Date.now()): string {
  const then = parseDbTime(value);
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
