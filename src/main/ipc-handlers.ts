import { ipcMain, dialog, clipboard, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { execFile } from 'child_process'
import { IPC } from '../shared/ipc-channels'
import { McpServer } from '../shared/types'
import { ptyManager } from './pty-manager'
import { store } from './store'
import { listDirectory, openInEditor, showInExplorer, discoverClaudeMdFiles, detectProjects } from './file-service'
import { gitWatcher } from './git-watcher'

// Validate that a path is an existing directory
function assertDirectory(dirPath: unknown): asserts dirPath is string {
  if (typeof dirPath !== 'string') throw new Error('Invalid path: expected string')
  try {
    if (!fs.statSync(dirPath).isDirectory()) throw new Error('Not a directory')
  } catch {
    throw new Error(`Invalid directory: ${dirPath}`)
  }
}

function assertString(val: unknown, name: string): asserts val is string {
  if (typeof val !== 'string') throw new Error(`Invalid ${name}: expected string`)
}

function assertNumber(val: unknown, name: string): asserts val is number {
  if (typeof val !== 'number' || !Number.isFinite(val)) throw new Error(`Invalid ${name}: expected number`)
}

// Allowed store keys
const ALLOWED_STORE_KEYS = new Set(['projects', 'pinnedFiles', 'panelWidths', 'windowBounds'])

export function registerIpcHandlers(win: BrowserWindow): void {
  ptyManager.setWindow(win)
  gitWatcher.setWindow(win)

  // PTY handlers
  ipcMain.handle(IPC.PTY_CREATE, (_e, projectId: unknown, cwd: unknown, projectName?: unknown) => {
    assertString(projectId, 'projectId')
    assertDirectory(cwd)
    if (projectName !== undefined) assertString(projectName, 'projectName')
    ptyManager.create(projectId, cwd, projectName as string | undefined)
    ptyManager.activate(projectId)
  })

  ipcMain.handle(IPC.PTY_DESTROY, (_e, projectId: unknown) => {
    assertString(projectId, 'projectId')
    ptyManager.destroy(projectId)
  })

  ipcMain.on(IPC.PTY_INPUT, (_e, projectId: unknown, data: unknown) => {
    if (typeof projectId !== 'string' || typeof data !== 'string') return
    ptyManager.input(projectId, data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_e, projectId: unknown, cols: unknown, rows: unknown) => {
    if (typeof projectId !== 'string') return
    if (typeof cols !== 'number' || typeof rows !== 'number') return
    ptyManager.resize(projectId, cols, rows)
  })

  ipcMain.handle(IPC.PTY_GET_BUFFER, (_e, projectId: unknown) => {
    assertString(projectId, 'projectId')
    return ptyManager.getBuffer(projectId)
  })

  ipcMain.handle(IPC.PTY_RESTART, (_e, projectId: unknown, cwd: unknown) => {
    assertString(projectId, 'projectId')
    assertDirectory(cwd)
    ptyManager.restart(projectId, cwd)
  })

  // File handlers
  ipcMain.handle(IPC.FILES_LIST_DIR, (_e, dirPath: unknown) => {
    assertDirectory(dirPath)
    return listDirectory(dirPath)
  })

  ipcMain.handle(IPC.FILES_OPEN_IN_EDITOR, (_e, filePath: unknown) => {
    assertString(filePath, 'filePath')
    openInEditor(filePath)
  })

  ipcMain.handle(IPC.FILES_SHOW_IN_EXPLORER, (_e, filePath: unknown) => {
    assertString(filePath, 'filePath')
    showInExplorer(filePath)
  })

  ipcMain.handle(IPC.FILES_DISCOVER_CLAUDE_MD, (_e, projectPath: unknown) => {
    assertDirectory(projectPath)
    return discoverClaudeMdFiles(projectPath)
  })

  ipcMain.handle(IPC.FILES_DETECT_PROJECTS, (_e, parentDir: unknown) => {
    assertDirectory(parentDir)
    return detectProjects(parentDir)
  })

  // Git
  ipcMain.handle(IPC.GIT_BRANCH, (_e, projectPath: unknown): Promise<string | null> => {
    assertDirectory(projectPath)
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath }, (err, stdout) => {
        if (err) return resolve(null)
        resolve(stdout.trim() || null)
      })
    })
  })

  ipcMain.handle(IPC.GIT_BRANCHES, (_e, projectPath: unknown) => {
    assertDirectory(projectPath)
    return gitWatcher.getBranches(projectPath)
  })

  ipcMain.on(IPC.GIT_WATCH, (_e, projectId: unknown, projectPath: unknown) => {
    if (typeof projectId !== 'string' || typeof projectPath !== 'string') return
    try { assertDirectory(projectPath) } catch { return }
    gitWatcher.watch(projectId, projectPath)
  })

  // Dialog handlers
  ipcMain.handle(IPC.DIALOG_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_SELECT_FILES, async (_e, projectPath: string) => {
    const result = await dialog.showOpenDialog(win, {
      defaultPath: projectPath,
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled) return []
    return result.filePaths.map((fp) => ({
      absolutePath: fp,
      relativePath: path.relative(projectPath, fp),
      name: path.basename(fp)
    }))
  })

  // Store handlers (allowlisted keys only)
  ipcMain.handle(IPC.STORE_GET, (_e, key: unknown) => {
    assertString(key, 'key')
    if (!ALLOWED_STORE_KEYS.has(key)) return undefined
    return store.get(key as keyof import('../shared/types').StoreData)
  })

  ipcMain.handle(IPC.STORE_SET, (_e, key: unknown, value: unknown) => {
    assertString(key, 'key')
    if (!ALLOWED_STORE_KEYS.has(key)) return
    store.set(key as keyof import('../shared/types').StoreData, value as never)
  })

  // Window
  ipcMain.on(IPC.SET_TITLE, (_e, title: string) => {
    win.setTitle(title)
  })

  // Clipboard
  ipcMain.handle(IPC.CLIPBOARD_WRITE, (_e, text: unknown) => {
    assertString(text, 'text')
    clipboard.writeText(text)
  })

  // MCP
  ipcMain.handle(IPC.MCP_LIST, (_e, projectPath: unknown): McpServer[] => {
    assertDirectory(projectPath)
    const servers: McpServer[] = []
    const seen = new Set<string>()

    // 1. Project-level .mcp.json
    try {
      const mcpPath = path.join(projectPath, '.mcp.json')
      const raw = fs.readFileSync(mcpPath, 'utf-8')
      const data = JSON.parse(raw)
      const mcpServers = data.mcpServers || {}
      for (const name of Object.keys(mcpServers)) {
        seen.add(name)
        servers.push({ name, type: 'project' })
      }
    } catch {
      // no .mcp.json or invalid
    }

    // 2. Claude project settings (~/.claude/projects/<encoded-path>/settings.json)
    try {
      // Encode path: replace \ and / with --, replace : with -
      const encoded = projectPath
        .replace(/[\\/]/g, '--')
        .replace(/:/g, '-')
      const settingsPath = path.join(
        os.homedir(),
        '.claude',
        'projects',
        encoded,
        'settings.json'
      )
      const raw = fs.readFileSync(settingsPath, 'utf-8')
      const data = JSON.parse(raw)
      const mcpServers = data.mcpServers || {}
      for (const name of Object.keys(mcpServers)) {
        if (!seen.has(name)) {
          servers.push({ name, type: 'user' })
        }
      }
    } catch {
      // no settings.json or invalid
    }

    return servers
  })
}
