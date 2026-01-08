/**
 * Utility functions for DocumentWorkspace
 */

/**
 * Format a date string to a readable format, or return "—" if invalid/null
 */
export function fmt(dt?: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

/**
 * Preview text: convert to single line and truncate to 120 characters
 */
export function preview120(s: string): string {
  const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

/**
 * Convert HTML string to plain text
 */
export function htmlToPlainText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body?.textContent ?? "").replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
}

/**
 * Get a badge emoji for parse status
 */
export function badge(parseStatus?: string): string {
  if (parseStatus === "ok") return "✅ ok";
  if (parseStatus === "failed") return "⛔ failed";
  if (parseStatus === "pending") return "⛳ pending";
  return parseStatus ? `• ${parseStatus}` : "—";
}

