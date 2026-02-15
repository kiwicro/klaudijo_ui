import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { PinnedFile, McpServer } from '../shared/types'

console.log('[preload] Loading preload script...')

const api = {
  // PTY
  ptyCreate: (projectId: string, cwd: string, projectName?: string) =>
    ipcRenderer.invoke(IPC.PTY_CREATE, projectId, cwd, projectName),
  ptyDestroy: (projectId: string) =>
    ipcRenderer.invoke(IPC.PTY_DESTROY, projectId),
  ptyInput: (projectId: string, data: string) =>
    ipcRenderer.send(IPC.PTY_INPUT, projectId, data),
  ptyResize: (projectId: string, cols: number, rows: number) =>
    ipcRenderer.send(IPC.PTY_RESIZE, projectId, cols, rows),
  ptyGetBuffer: (projectId: string): Promise<string> =>
    ipcRenderer.invoke(IPC.PTY_GET_BUFFER, projectId),
  ptyRestart: (projectId: string, cwd: string) =>
    ipcRenderer.invoke(IPC.PTY_RESTART, projectId, cwd),
  onPtyData: (callback: (projectId: string, data: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, projectId: string, data: string) =>
      callback(projectId, data)
    ipcRenderer.on(IPC.PTY_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, handler)
  },
  onPtyExit: (callback: (projectId: string, exitCode: number) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, projectId: string, exitCode: number) =>
      callback(projectId, exitCode)
    ipcRenderer.on(IPC.PTY_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, handler)
  },

  // Files
  listDir: (dirPath: string) => ipcRenderer.invoke(IPC.FILES_LIST_DIR, dirPath),
  openInEditor: (filePath: string) => ipcRenderer.invoke(IPC.FILES_OPEN_IN_EDITOR, filePath),
  showInExplorer: (filePath: string) => ipcRenderer.invoke(IPC.FILES_SHOW_IN_EXPLORER, filePath),

  discoverClaudeMdFiles: (projectPath: string): Promise<PinnedFile[]> =>
    ipcRenderer.invoke(IPC.FILES_DISCOVER_CLAUDE_MD, projectPath),
  detectProjects: (parentDir: string): Promise<{ name: string; path: string }[]> =>
    ipcRenderer.invoke(IPC.FILES_DETECT_PROJECTS, parentDir),
  gitBranch: (projectPath: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.GIT_BRANCH, projectPath),
  gitBranches: (projectPath: string): Promise<{ current: string | null; branches: string[] }> =>
    ipcRenderer.invoke(IPC.GIT_BRANCHES, projectPath),
  gitWatch: (projectId: string, projectPath: string) =>
    ipcRenderer.send(IPC.GIT_WATCH, projectId, projectPath),
  onGitBranchesChanged: (callback: (projectId: string, info: { current: string | null; branches: string[] }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, projectId: string, info: { current: string | null; branches: string[] }) =>
      callback(projectId, info)
    ipcRenderer.on(IPC.GIT_BRANCHES_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.GIT_BRANCHES_CHANGED, handler)
  },

  // Dialogs
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_SELECT_DIRECTORY),
  selectFiles: (projectPath: string): Promise<PinnedFile[]> =>
    ipcRenderer.invoke(IPC.DIALOG_SELECT_FILES, projectPath),

  // Store
  storeGet: (key: string) => ipcRenderer.invoke(IPC.STORE_GET, key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke(IPC.STORE_SET, key, value),

  // App events
  onSwitchProject: (callback: (projectId: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, projectId: string) => callback(projectId)
    ipcRenderer.on(IPC.SWITCH_PROJECT, handler)
    return () => ipcRenderer.removeListener(IPC.SWITCH_PROJECT, handler)
  },

  // Window
  setTitle: (title: string) => ipcRenderer.send(IPC.SET_TITLE, title),

  // Clipboard
  clipboardWrite: (text: string) => ipcRenderer.invoke(IPC.CLIPBOARD_WRITE, text),

  // MCP
  getMcpServers: (projectPath: string): Promise<McpServer[]> =>
    ipcRenderer.invoke(IPC.MCP_LIST, projectPath)
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
console.log('[preload] API exposed to renderer')
