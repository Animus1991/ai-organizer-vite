from pathlib import Path

root = Path(__file__).resolve().parents[2]  # .../AI_ORGANIZER_VITE
raw = root / "data" / "raw_md"
raw.mkdir(parents=True, exist_ok=True)

p = raw / "demo_note.md"
p.write_text(
    "# Demo Document\n\n---\n\nΑυτό είναι demo κείμενο για search.\n\nΛέξεις: entropy, value, theory.\n",
    encoding="utf-8",
)
print("Wrote:", p)
