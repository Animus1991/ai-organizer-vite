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
      <div className="space-y-4">
        {/* Add New Folder */}
        <div className="bg-surface-elevated border border-border rounded-lg p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New folder name…"
              className="flex-1 px-4 py-3 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
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
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                canAdd 
                  ? "bg-primary text-white hover:bg-primary-hover transform hover:translate-y-[-1px] shadow-md" 
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              }`}
              style={{ padding: "10px 12px", opacity: canAdd ? 1 : 0.6 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Folders List */}
        {!folders.length ? (
          <div className="text-center py-8 text-secondary bg-surface-elevated border border-border rounded-lg">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p>No folders yet.</p>
            <p className="text-sm mt-1">Create your first folder to organize segments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {folders.map((f) => (
              <div
                key={f.id}
                className="bg-surface-elevated border border-border rounded-lg p-4 hover:border-primary/50 transition-colors group"
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
                <div className="flex items-center gap-2 flex-1">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <input
                    defaultValue={f.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (!v || v === f.name) return;
                      renameFolder(docId, f.id, v);
                      refresh();
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-primary font-medium"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "#0f1420",
                      color: "#eaeaea",
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    const ok = window.confirm(`Delete folder "${f.name}"? (will unassign segments)`);
                    if (!ok) return;
                    deleteFolder(docId, f.id);
                    refresh();
                  }}
                  className="btn-danger p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100"
                  style={{ padding: "8px 10px" }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
