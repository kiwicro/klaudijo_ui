import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { Project, PtyStatus } from '../../../shared/types'

interface ProjectStore {
  projects: Project[]
  activeProjectId: string | null
  statuses: Record<string, PtyStatus>
  loaded: boolean

  load: () => Promise<void>
  addProject: (name: string, path: string) => Promise<Project>
  removeProject: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  setStatus: (id: string, status: PtyStatus) => void
  reorderProjects: (fromIndex: number, toIndex: number) => Promise<void>
}

const api = window.api

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  statuses: {},
  loaded: false,

  load: async () => {
    if (!api) { set({ loaded: true }); return }
    const projects = ((await api.storeGet('projects')) as Project[]) ?? []
    set({ projects, loaded: true })
  },

  addProject: async (name, path) => {
    const project: Project = { id: uuid(), name, path, createdAt: Date.now() }
    const projects = [...get().projects, project]
    set({ projects })
    await api?.storeSet('projects', projects)
    return project
  },

  removeProject: async (id) => {
    const projects = get().projects.filter((p) => p.id !== id)
    const activeProjectId = get().activeProjectId === id ? null : get().activeProjectId
    set({ projects, activeProjectId })
    await api?.storeSet('projects', projects)
    await api?.ptyDestroy(id)
  },

  setActive: (id) => set({ activeProjectId: id }),

  setStatus: (id, status) =>
    set((s) => ({ statuses: { ...s.statuses, [id]: status } })),

  reorderProjects: async (fromIndex, toIndex) => {
    const projects = [...get().projects]
    const [moved] = projects.splice(fromIndex, 1)
    projects.splice(toIndex, 0, moved)
    set({ projects })
    await api?.storeSet('projects', projects)
  }
}))
