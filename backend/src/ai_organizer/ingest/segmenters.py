from __future__ import annotations
import re
from typing import List, Dict, Any

def segment_qa(text: str) -> List[Dict[str, Any]]:
    """
    Πολύ πρακτικό MVP: βρίσκει blocks τύπου USER:/ASSISTANT: και τα κάνει ζευγάρια.
    Αν δεν βρει τέτοια, κάνει paragraph chunks.
    """
    # blocks like "USER:\n....\nASSISTANT:\n...."
    pattern = re.compile(r"^(USER|ASSISTANT|SYSTEM|TOOL|UNKNOWN):\s*$", re.MULTILINE)
    matches = list(pattern.finditer(text))

    if len(matches) < 2:
        return segment_paragraphs(text)

    blocks = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        role = m.group(1).lower()
        content = text[start:end].strip()
        blocks.append((role, content))

    segments = []
    order = 0
    i = 0
    while i < len(blocks):
        role, content = blocks[i]
        if role == "user" and i + 1 < len(blocks) and blocks[i + 1][0] == "assistant":
            q = content
            a = blocks[i + 1][1]
            segments.append({
                "title": f"Q/A #{order+1}",
                "content": f"USER:\n{q}\n\nASSISTANT:\n{a}".strip()
            })
            order += 1
            i += 2
        else:
            segments.append({
                "title": f"Block #{order+1} ({role})",
                "content": f"{role.upper()}:\n{content}".strip()
            })
            order += 1
            i += 1

    return segments

def segment_paragraphs(text: str, max_chars: int = 2500) -> List[Dict[str, Any]]:
    paras = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    segs = []
    buff = ""
    for p in paras:
        if len(buff) + len(p) + 2 <= max_chars:
            buff = (buff + "\n\n" + p).strip()
        else:
            if buff:
                segs.append({"title": f"Chunk #{len(segs)+1}", "content": buff})
            buff = p
    if buff:
        segs.append({"title": f"Chunk #{len(segs)+1}", "content": buff})
    return segs
