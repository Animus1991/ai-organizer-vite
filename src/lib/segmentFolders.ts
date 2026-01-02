// src/lib/segmentFolders.ts
export type FolderDTO = {
  id: string;
  name: string;
  createdAt: number;
};

function keyFolders(docId: number) {
  return `aiorg_seg_folders_doc_${docId}`;
}

function keyMap(docId: number) {
  return `aiorg_seg_folder_map_doc_${docId}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

export function loadFolders(docId: number): FolderDTO[] {
  try {
    const raw = localStorage.getItem(keyFolders(docId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as FolderDTO[]) : [];
  } catch {
    return [];
  }
}

export function saveFolders(docId: number, folders: FolderDTO[]) {
  localStorage.setItem(keyFolders(docId), JSON.stringify(folders));
}

export function createFolder(docId: number, name: string): FolderDTO {
  const folders = loadFolders(docId);
  const f: FolderDTO = { id: uid(), name: name.trim(), createdAt: Date.now() };
  const next = [f, ...folders];
  saveFolders(docId, next);
  return f;
}

export function renameFolder(docId: number, folderId: string, name: string) {
  const folders = loadFolders(docId).map((f) => (f.id === folderId ? { ...f, name: name.trim() } : f));
  saveFolders(docId, folders);
}

export function deleteFolder(docId: number, folderId: string) {
  const folders = loadFolders(docId).filter((f) => f.id !== folderId);
  saveFolders(docId, folders);

  // also unassign segments
  const map = loadFolderMap(docId);
  for (const k of Object.keys(map)) {
    if (map[k] === folderId) delete map[k];
  }
  saveFolderMap(docId, map);
}

export function loadFolderMap(docId: number): Record<string, string> {
  try {
    const raw = localStorage.getItem(keyMap(docId));
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveFolderMap(docId: number, map: Record<string, string>) {
  localStorage.setItem(keyMap(docId), JSON.stringify(map));
}

export function setSegmentFolder(docId: number, segId: number, folderId: string | null) {
  const map = loadFolderMap(docId);
  const k = String(segId);
  if (!folderId) delete map[k];
  else map[k] = folderId;
  saveFolderMap(docId, map);
}

export function getSegmentFolderId(docId: number, segId: number): string | null {
  const map = loadFolderMap(docId);
  return map[String(segId)] ?? null;
}
