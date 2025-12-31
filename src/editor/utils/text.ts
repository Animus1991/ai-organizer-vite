export function normalizePlainText(input: string): string {
  let s = (input ?? "").replace(/\r\n/g, "\n").replace(/\u00A0/g, " ");
  // trim trailing spaces per line
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  // collapse 3+ newlines into 2 (paragraph separation)
  s = s.replace(/\n{3,}/g, "\n\n");

  // collapse weird spaced lines
  s = s.replace(/[ \t]{2,}/g, " ");

  return s.trim();
}

/**
 * Plain text -> HTML that looks Word-like:
 * - paragraphs split by blank lines
 * - single newline inside paragraph becomes <br>
 */
export function plainTextToHtml(text: string): string {
  const t = (text ?? "").replace(/\r\n/g, "\n");
  if (!t.trim()) return "<p></p>";

  const escape = (x: string) =>
    x
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const paras = t.split(/\n\s*\n/g);
  const html = paras
    .map((p) => {
      const lines = p.split("\n").map((l) => escape(l));
      return `<p>${lines.join("<br />")}</p>`;
    })
    .join("");

  return html || "<p></p>";
}
