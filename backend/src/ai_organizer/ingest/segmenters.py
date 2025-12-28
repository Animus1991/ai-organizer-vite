from __future__ import annotations
import re
from typing import List, Dict, Any, Tuple

ROLE_RE = re.compile(
    r"""^(?P<prefix>\s*[-*•]?\s*)  # optional bullet
        (?P<role>USER|ASSISTANT|SYSTEM|TOOL|UNKNOWN|USER|ASSISTANT|SYSTEM|TOOL|
                 User|Assistant|System|Tool|
                 ΧΡΗΣΤΗΣ|ΒΟΗΘΟΣ|Χρήστης|Βοηθός|Σύστημα|Εργαλείο)
        \s*:\s*(?P<inline>.*)$
    """,
    re.IGNORECASE | re.MULTILINE | re.VERBOSE,
)

def _norm_role(role: str) -> str:
    r = role.strip().lower()
    greek_map = {
        "χρήστης": "user",
        "χρηστης": "user",
        "βοηθός": "assistant",
        "βοηθος": "assistant",
        "σύστημα": "system",
        "συστημα": "system",
        "εργαλείο": "tool",
        "εργαλειο": "tool",
    }
    if r in greek_map:
        return greek_map[r]
    if r in {"user", "assistant", "system", "tool", "unknown"}:
        return r
    return r

def segment_qa(text: str) -> List[Dict[str, Any]]:
    """
    QA segmentation με markers, αλλά:
    - πιάνει και "User: ..." στην ίδια γραμμή
    - είναι case-insensitive
    - επιστρέφει start/end πάνω στο original text
    """
    matches = list(ROLE_RE.finditer(text))
    if len(matches) < 2:
        return segment_paragraphs(text)

    # blocks: (role, block_start, block_end)
    blocks: List[Tuple[str, int, int]] = []
    for i, m in enumerate(matches):
        role = _norm_role(m.group("role"))
        block_start = m.start()  # από την αρχή του "ROLE:"
        block_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks.append((role, block_start, block_end))

    segments: List[Dict[str, Any]] = []
    order = 0
    i = 0
    while i < len(blocks):
        role, s0, e0 = blocks[i]

        # user + assistant => ένα ενιαίο Q/A segment
        if role == "user" and i + 1 < len(blocks) and blocks[i + 1][0] == "assistant":
            _, s1, e1 = blocks[i + 1]
            start = s0
            end = e1
            content = text[start:end].strip()
            segments.append({
                "title": f"Q/A #{order+1}",
                "content": content,
                "start": start,
                "end": end,
            })
            order += 1
            i += 2
            continue

        # αλλιώς ένα single-role block
        content = text[s0:e0].strip()
        segments.append({
            "title": f"Block #{order+1} ({role})",
            "content": content,
            "start": s0,
            "end": e0,
        })
        order += 1
        i += 1

    return segments

def segment_paragraphs(text: str, max_chars: int = 2500) -> List[Dict[str, Any]]:
    paras = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    segs: List[Dict[str, Any]] = []
    buff = ""
    buff_start = 0
    cursor = 0

    for p in paras:
        # βρες span του paragraph στο original, όσο γίνεται “ακολουθιακά”
        p_start = text.find(p, cursor)
        if p_start < 0:
            p_start = cursor
        p_end = p_start + len(p)
        cursor = max(cursor, p_end)

        if not buff:
            buff = p
            buff_start = p_start
        elif len(buff) + len(p) + 2 <= max_chars:
            buff = (buff + "\n\n" + p).strip()
        else:
            segs.append({"title": f"Chunk #{len(segs)+1}", "content": buff, "start": buff_start, "end": p_start})
            buff = p
            buff_start = p_start

    if buff:
        segs.append({"title": f"Chunk #{len(segs)+1}", "content": buff, "start": buff_start, "end": cursor})

    return segs
