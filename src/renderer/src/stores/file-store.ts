import { create } from 'zustand'
import { PinnedFile } from '../../../shared/types'

interface FileStore {
  pinnedFiles: Record<string, PinnedFile[]>
  loaded: boolean

  load: () => Promise<void>
  addFiles: (projectId: string, files: PinnedFile[]) => Promise<void>
  removeFile: (projectId: string, absolutePath: string) => Promise<void>
  getFiles: (projectId: string) => PinnedFile[]
  autoPopulateClaudeMd: (projectId: string, projectPath: string) => Promise<void>
}

const api = window.api
const discoveredProjects = new Set<string>()

export const useFileStore = create<FileStore>((set, get) => ({
  pinnedFiles: {},
  loaded: false,

  load: async () => {
    if (!api) { set({ loaded: true }); return }
    const pinnedFiles =
      ((await api.storeGet('pinnedFiles')) as Record<string, PinnedFile[]>) ?? {}
    set({ pinnedFiles, loaded: true })
  },

  addFiles: async (projectId, files) => {
    const current = get().pinnedFiles[projectId] ?? []
    const existingPaths = new Set(current.map((f) => f.absolutePath))
    const newFiles = files.filter((f) => !existingPaths.has(f.absolutePath))
    const updated = { ...get().pinnedFiles, [projectId]: [...current, ...newFiles] }
    set({ pinnedFiles: updated })
    await api?.storeSet('pinnedFiles', updated)
  },

  removeFile: async (projectId, absolutePath) => {
    const current = get().pinnedFiles[projectId] ?? []
    const filtered = current.filter((f) => f.absolutePath !== absolutePath)
    const updated = { ...get().pinnedFiles, [projectId]: filtered }
    set({ pinnedFiles: updated })
    await api?.storeSet('pinnedFiles', updated)
  },

  getFiles: (projectId) => {
    return get().pinnedFiles[projectId] ?? []
  },

  autoPopulateClaudeMd: async (projectId, projectPath) => {
    if (!api) return
    if (discoveredProjects.has(projectId)) return
    discoveredProjects.add(projectId)

    try {
      const claudeFiles = await api.discoverClaudeMdFiles(projectPath)
      if (claudeFiles.length === 0) return

      const current = get().pinnedFiles[projectId] ?? []
      const existingPaths = new Set(current.map((f) => f.absolutePath))
      const newFiles = claudeFiles.filter((f) => !existingPaths.has(f.absolutePath))
      if (newFiles.length === 0) return

      const updated = { ...get().pinnedFiles, [projectId]: [...current, ...newFiles] }
      set({ pinnedFiles: updated })
      await api.storeSet('pinnedFiles', updated)
    } catch (err) {
      console.error('[file-store] autoPopulateClaudeMd error:', err)
      discoveredProjects.delete(projectId)
    }
  }
}))
