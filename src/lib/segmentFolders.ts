// src/lib/segmentFolders.ts
export type FolderDTO = {
  id: string;
  name: string;
  createdAt: number;
  contents: string[]; // Array of duplicated chunk IDs
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
    
    // Migration: add contents property to folders that don't have it
    const migrated = arr.map((folder: any) => {
      if (!folder.contents) {
        return { ...folder, contents: [] };
      }
      return folder;
    });
    
    // Save migrated data back to localStorage
    if (JSON.stringify(arr) !== JSON.stringify(migrated)) {
      localStorage.setItem(keyFolders(docId), JSON.stringify(migrated));
    }
    
    return Array.isArray(migrated) ? (migrated as FolderDTO[]) : [];
  } catch {
    return [];
  }
}

export function saveFolders(docId: number, folders: FolderDTO[]) {
  localStorage.setItem(keyFolders(docId), JSON.stringify(folders));
}

export function createFolder(docId: number, name: string): FolderDTO {
  const folders = loadFolders(docId);
  const f: FolderDTO = { id: uid(), name: name.trim(), createdAt: Date.now(), contents: [] };
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
  const previousFolderId = map[k];
  
  if (!folderId) {
    // Remove from folder
    delete map[k];
    saveFolderMap(docId, map);
    
    // Also remove from folder contents if it was a duplicated chunk
    if (previousFolderId) {
      // This would need the duplicated chunk ID, which we don't track here
      // For now, just update the folder map
    }
  } else {
    // Add to folder
    map[k] = folderId;
    saveFolderMap(docId, map);
  }
}

export function getSegmentFolderId(docId: number, segId: number): string | null {
  const map = loadFolderMap(docId);
  return map[String(segId)] ?? null;
}

// Add a duplicated chunk to a folder
export function addChunkToFolder(docId: number, folderId: string, chunkId: string) {
  const folders = loadFolders(docId);
  const updatedFolders = folders.map(folder => {
    if (folder.id === folderId) {
      return {
        ...folder,
        contents: [...folder.contents, chunkId]
      };
    }
    return folder;
  });
  saveFolders(docId, updatedFolders);
}

// Remove a duplicated chunk from a folder
export function removeChunkFromFolder(docId: number, folderId: string, chunkId: string) {
  const folders = loadFolders(docId);
  const updatedFolders = folders.map(folder => {
    if (folder.id === folderId) {
      return {
        ...folder,
        contents: folder.contents.filter(id => id !== chunkId)
      };
    }
    return folder;
  });
  saveFolders(docId, updatedFolders);
}
