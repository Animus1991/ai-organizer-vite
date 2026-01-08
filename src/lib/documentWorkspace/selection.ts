/**
 * Selection utilities for DocumentWorkspace
 */

export type SelInfo = { start: number; end: number; text: string };

/**
 * Split document text by a range (before, mid, after)
 */
export function splitDocByRange(docText: string, start: number, end: number): {
  before: string;
  mid: string;
  after: string;
} {
  if (!docText) return { before: "", mid: "", after: "" };
  if (start < 0 || end <= start || end > docText.length) {
    return { before: docText, mid: "", after: "" };
  }
  return {
    before: docText.slice(0, start),
    mid: docText.slice(start, end),
    after: docText.slice(end),
  };
}

/**
 * Compute selection info from a <pre> element and document text
 */
export function computeSelectionFromPre(pre: HTMLPreElement, docText: string): SelInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!pre.contains(range.startContainer) || !pre.contains(range.endContainer)) {
    return null;
  }

  const r1 = document.createRange();
  r1.setStart(pre, 0);
  r1.setEnd(range.startContainer, range.startOffset);
  const a = r1.toString().length;

  const r2 = document.createRange();
  r2.setStart(pre, 0);
  r2.setEnd(range.endContainer, range.endOffset);
  const b = r2.toString().length;

  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (end <= start) return null;

  return { start, end, text: docText.slice(start, end) };
}

