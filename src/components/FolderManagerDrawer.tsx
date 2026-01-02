// src/components/FolderManagerDrawer.tsx
import React, { useEffect, useMemo, useState } from "react";
import Drawer from "./Drawer";
import { FolderDTO, createFolder, deleteFolder, loadFolders, renameFolder } from "../lib/segmentFolders";

type Props = {
  docId: number;
  open: boolean;
  onClose: () => void;
  onChanged?: (folders: FolderDTO[]) => void;
};

export default function FolderManagerDrawer({ docId, open, onClose, onChanged }: Props) {
  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    const f = loadFolders(docId);
    setFolders(f);
  }, [open, docId]);

  const canAdd = useMemo(() => name.trim().length >= 1, [name]);

  function refresh() {
    const f = loadFolders(docId);
    setFolders(f);
    onChanged?.(f);
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Folders • Document #${docId}`} width={560}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New folder name…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f1420",
              color: "#eaeaea",
            }}
          />
          <button
            disabled={!canAdd}
            onClick={() => {
              createFolder(docId, name);
              setName("");
              refresh();
            }}
            style={{ padding: "10px 12px", opacity: canAdd ? 1 : 0.6 }}
          >
            Add
          </button>
        </div>

        {!folders.length ? (
          <div style={{ opacity: 0.75 }}>No folders yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {folders.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <input
                  defaultValue={f.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (!v || v === f.name) return;
                    renameFolder(docId, f.id, v);
                    refresh();
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#0f1420",
                    color: "#eaeaea",
                  }}
                />
                <button
                  onClick={() => {
                    const ok = window.confirm(`Delete folder "${f.name}"? (will unassign segments)`);
                    if (!ok) return;
                    deleteFolder(docId, f.id);
                    refresh();
                  }}
                  style={{ padding: "8px 10px" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
