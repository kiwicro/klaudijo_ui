export interface Project {
  id: string
  name: string
  path: string
  createdAt: number
}

export interface PinnedFile {
  absolutePath: string
  relativePath: string
  name: string
}

export type PtyStatus = 'running' | 'exited' | 'idle'

export interface ProjectState {
  status: PtyStatus
  exitCode?: number
}

export interface McpServer {
  name: string
  type: 'project' | 'user'
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface StoreData {
  projects: Project[]
  pinnedFiles: Record<string, PinnedFile[]> // projectId -> files
  panelWidths: { left: number; right: number }
  windowBounds: WindowBounds
}
