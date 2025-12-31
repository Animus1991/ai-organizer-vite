#!/usr/bin/env python3
"""
Smoke flow for AI Organizer API:
- login
- upload
- get document
- segment (qa)
- list segments + meta
- create manual segment (first N chars)
- patch manual segment (rename + resize + content override)

Usage:
  python scripts/smoke_flow.py --base http://127.0.0.1:8000/api --email test@test.com --password 1234 --file ./samples/a.docx
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests


@dataclass
class Tokens:
    access_token: str
    refresh_token: str


def die(msg: str, code: int = 1):
    print(f"[smoke] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def req_json(res: requests.Response) -> Any:
    try:
        return res.json()
    except Exception:
        return {"_raw": res.text}


def login(base: str, email: str, password: str) -> Tokens:
    url = f"{base}/auth/login"
    data = {"username": email, "password": password}
    res = requests.post(
        url,
        data=data,
        headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
        timeout=60,
    )
    if not res.ok:
        die(f"login failed {res.status_code}: {res.text[:400]}")
    j = req_json(res)
    if not j.get("access_token") or not j.get("refresh_token"):
        die(f"login response missing tokens: {j}")
    return Tokens(access_token=j["access_token"], refresh_token=j["refresh_token"])


def auth_headers(tok: Tokens) -> Dict[str, str]:
    return {"Authorization": f"Bearer {tok.access_token}", "Accept": "application/json"}


def upload(base: str, tok: Tokens, file_path: str) -> Dict[str, Any]:
    url = f"{base}/upload"
    if not os.path.exists(file_path):
        die(f"file not found: {file_path}")

    with open(file_path, "rb") as f:
        files = {"file": (os.path.basename(file_path), f)}
        res = requests.post(url, headers={"Authorization": f"Bearer {tok.access_token}"}, files=files, timeout=120)

    if not res.ok:
        die(f"upload failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def get_document(base: str, tok: Tokens, document_id: int) -> Dict[str, Any]:
    url = f"{base}/documents/{document_id}"
    res = requests.get(url, headers=auth_headers(tok), timeout=60)
    if not res.ok:
        die(f"get_document failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def segment(base: str, tok: Tokens, document_id: int, mode: str = "qa") -> Dict[str, Any]:
    url = f"{base}/documents/{document_id}/segment"
    res = requests.post(url, headers=auth_headers(tok), params={"mode": mode}, timeout=120)
    if not res.ok:
        die(f"segment failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def list_segments(base: str, tok: Tokens, document_id: int, mode: str = "qa") -> Dict[str, Any]:
    url = f"{base}/documents/{document_id}/segments"
    res = requests.get(url, headers=auth_headers(tok), params={"mode": mode}, timeout=60)
    if not res.ok:
        die(f"list_segments failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def create_manual(base: str, tok: Tokens, document_id: int, mode: str, start: int, end: int, title: str) -> Dict[str, Any]:
    url = f"{base}/documents/{document_id}/segments/manual"
    payload = {"mode": mode, "start": start, "end": end, "title": title}
    res = requests.post(url, headers={**auth_headers(tok), "Content-Type": "application/json"}, json=payload, timeout=60)
    if not res.ok:
        die(f"create_manual failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def patch_segment(base: str, tok: Tokens, segment_id: int, patch: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{base}/segments/{segment_id}"
    res = requests.patch(url, headers={**auth_headers(tok), "Content-Type": "application/json"}, json=patch, timeout=60)
    if not res.ok:
        die(f"patch_segment failed {res.status_code}: {res.text[:400]}")
    return req_json(res)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8000/api")
    ap.add_argument("--email", required=True)
    ap.add_argument("--password", required=True)
    ap.add_argument("--file", required=True)
    ap.add_argument("--mode", default="qa", choices=["qa", "paragraphs"])
    args = ap.parse_args()

    print("[smoke] login...")
    tok = login(args.base, args.email, args.password)

    print("[smoke] upload...")
    up = upload(args.base, tok, args.file)
    print("[smoke] upload resp:", json.dumps(up, ensure_ascii=False, indent=2))

    doc_id = int(up.get("documentId") or up.get("document_id") or 0)
    if not doc_id:
        die(f"upload response did not include documentId: {up}")

    print("[smoke] get document...")
    doc = get_document(args.base, tok, doc_id)
    print("[smoke] document parse_status:", doc.get("parse_status"), "len(text)=", len(doc.get("text") or ""))

    if doc.get("parse_status") != "ok":
        die(f"document parse_status != ok: {doc.get('parse_status')} (parse_error={doc.get('parse_error')})")

    print("[smoke] segment...")
    seg_res = segment(args.base, tok, doc_id, args.mode)
    print("[smoke] segment resp:", seg_res)

    print("[smoke] list segments...")
    ls = list_segments(args.base, tok, doc_id, args.mode)
    items = ls.get("items") or []
    meta = ls.get("meta") or {}
    print("[smoke] meta:", meta)
    print("[smoke] items:", len(items))

    text = doc.get("text") or ""
    if len(text) < 50:
        die("document too short for manual chunk smoke test")

    print("[smoke] create manual chunk...")
    created = create_manual(args.base, tok, doc_id, args.mode, 0, min(200, len(text)), "Manual Smoke #1")
    print("[smoke] created:", created)

    sid = int(created.get("id") or 0)
    if not sid:
        die("manual create did not return id")

    print("[smoke] patch manual chunk (resize + rename)...")
    patched = patch_segment(args.base, tok, sid, {"title": "Manual Smoke #1 (edited)", "start": 0, "end": min(400, len(text))})
    print("[smoke] patched:", patched)

    print("[smoke] patch manual chunk (content override)...")
    patched2 = patch_segment(args.base, tok, sid, {"content": patched.get("content", "") + "\n\n[smoke] extra line"})
    print("[smoke] patched2:", patched2)

    print("[smoke] ✅ DONE")


if __name__ == "__main__":
    main()
