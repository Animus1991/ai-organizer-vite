// src/test/lib/segmentFolders.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadFolders, createFolder, deleteFolder } from '../../lib/segmentFolders'
import * as api from '../../lib/api'
import * as migrateToDatabase from '../../lib/migrateToDatabase'

// Mock the API module
vi.mock('../../lib/api', () => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(), // This is apiCreateFolder in segmentFolders
  deleteFolder: vi.fn(), // This is apiDeleteFolder in segmentFolders
  getFolder: vi.fn(),
}))

// Mock migration
vi.mock('../../lib/migrateToDatabase', () => ({
  migrateDocumentToDatabase: vi.fn(),
}))

describe('Folder Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('loadFolders', () => {
    it('should load folders from API', async () => {
      const mockFolders = [
        { id: 1, name: 'Folder 1', createdAt: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'Folder 2', createdAt: '2024-01-02T00:00:00Z' }
      ]

      vi.mocked(api.listFolders).mockResolvedValue(mockFolders as any)
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)

      const result = await loadFolders(1)

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[0].name).toBe('Folder 1')
      expect(result[1].id).toBe('2')
      expect(result[1].name).toBe('Folder 2')
    })

    it('should handle API errors gracefully with localStorage fallback', async () => {
      vi.mocked(api.listFolders).mockRejectedValue(new Error('API Error'))
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)
      
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Set up localStorage fallback
      const fallbackFolders = [{ id: '1', name: 'Fallback Folder', createdAt: Date.now(), contents: [] }]
      localStorage.setItem('aiorg_seg_folders_doc_1', JSON.stringify(fallbackFolders))

      const result = await loadFolders(1)

      // Should return fallback from localStorage
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
      expect(result[0].name).toBe('Fallback Folder')

      consoleSpy.mockRestore()
    })
  })

  describe('createFolder', () => {
    it('should create a folder via API', async () => {
      const mockFolder = { id: 1, name: 'New Folder', createdAt: '2024-01-01T00:00:00Z' }
      vi.mocked(api.createFolder).mockResolvedValue(mockFolder as any)
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)

      const result = await createFolder(1, 'New Folder')

      expect(api.createFolder).toHaveBeenCalledWith(1, 'New Folder')
      // createFolder returns the folder with id as string
      expect(String(result.id)).toBe('1')
      expect(result.name).toBe('New Folder')
    })

    it('should throw error if API fails', async () => {
      vi.mocked(api.createFolder).mockRejectedValue(new Error('API Error'))
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)
      
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(createFolder(1, 'New Folder')).rejects.toThrow()

      consoleSpy.mockRestore()
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder via API', async () => {
      vi.mocked(api.deleteFolder).mockResolvedValue(undefined)
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)

      await deleteFolder(1, '1')

      expect(api.deleteFolder).toHaveBeenCalledWith(1)
    })

    it('should throw error if API fails', async () => {
      vi.mocked(api.deleteFolder).mockRejectedValue(new Error('API Error'))
      vi.mocked(migrateToDatabase.migrateDocumentToDatabase).mockResolvedValue(undefined)
      
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(deleteFolder(1, '1')).rejects.toThrow()

      consoleSpy.mockRestore()
    })
  })
})
