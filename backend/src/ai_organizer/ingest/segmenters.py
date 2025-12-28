from __future__ import annotations
import re
from typing import List, Dict, Any, Tuple

ROLE_RE = re.compile(r"^(USER|ASSISTANT|SYSTEM|TOOL|UNKNOWN):\s*$", re.MULTILINE)

def _trim_span(text: str, start: int, end: int) -> Tuple[int, int]:
    # trims whitespace but keeps correct indices
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end

def segment_qa(text: str) -> List[Dict[str, Any]]:
    """
    Βρίσκει blocks τύπου USER:/ASSISTANT: κ.λπ. και επιστρέφει segments με:
    - content (συνθετικό USER+ASSISTANT ή block)
    - start/end (ΑΚΡΙΒΕΙΣ δείκτες στο original text για highlight)
    """
    matches = list(ROLE_RE.finditer(text))
    if len(matches) < 2:
        return segment_paragraphs(text)

    blocks = []
    for i, m in enumerate(matches):
        role = m.group(1).lower()

        block_start = m.start()  # include the "USER:" line
        block_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)

        content_start_raw = m.end()
        content_end_raw = block_end

        cstart, cend = _trim_span(text, content_start_raw, content_end_raw)
        content = text[cstart:cend]

        blocks.append({
            "role": role,
            "content": content,
            "block_start": block_start,
            "block_end": block_end,
            "content_start": cstart,
            "content_end": cend,
        })

    segments: List[Dict[str, Any]] = []
    order = 0
    i = 0

    while i < len(blocks):
        b = blocks[i]

        # Pair USER -> ASSISTANT into one Q/A segment
        if b["role"] == "user" and i + 1 < len(blocks) and blocks[i + 1]["role"] == "assistant":
            a = blocks[i + 1]

            # Synthetic content (nice for reading), but span maps to original text
            seg_content = f"USER:\n{b['content']}\n\nASSISTANT:\n{a['content']}".strip()

            segments.append({
                "title": f"Q/A #{order + 1}",
                "content": seg_content,
                # highlight the whole region in original text covering USER block + ASSISTANT block
                "start": int(b["block_start"]),
                "end": int(a["block_end"]),
            })
            order += 1
            i += 2
            continue

        # Non-paired block
        role = b["role"]
        seg_content = f"{role.upper()}:\n{b['content']}".strip()

        segments.append({
            "title": f"Block #{order + 1} ({role})",
            "content": seg_content,
            "start": int(b["block_start"]),
            "end": int(b["block_end"]),
        })
        order += 1
        i += 1

    return segments


PARA_RE = re.compile(r"\S[\s\S]*?(?=\n\s*\n+|\Z)")

def segment_paragraphs(text: str, max_chars: int = 2500) -> List[Dict[str, Any]]:
    """
    Paragraph chunking με ΑΚΡΙΒΗ start/end.
    Επιστρέφει chunks ως substring του original text (όχι stitched text).
    """
    paras = [(m.start(), m.end()) for m in PARA_RE.finditer(text)]
    if not paras:
        trimmed = text.strip()
        if not trimmed:
            return []
        # single chunk covering all
        s = text.find(trimmed)
        e = s + len(trimmed)
        return [{"title": "Chunk #1", "content": trimmed, "start": s, "end": e}]

    segs: List[Dict[str, Any]] = []
    group_start = None
    group_end = None

    for (ps, pe) in paras:
        if group_start is None:
            group_start, group_end = ps, pe
            continue

        # if adding this paragraph stays within max_chars
        if (pe - group_start) <= max_chars:
            group_end = pe
        else:
            s, e = _trim_span(text, group_start, group_end)
            segs.append({
                "title": f"Chunk #{len(segs) + 1}",
                "content": text[s:e],
                "start": s,
                "end": e,
            })
            group_start, group_end = ps, pe

    if group_start is not None and group_end is not None:
        s, e = _trim_span(text, group_start, group_end)
        segs.append({
            "title": f"Chunk #{len(segs) + 1}",
            "content": text[s:e],
            "start": s,
            "end": e,
        })

    return segs
