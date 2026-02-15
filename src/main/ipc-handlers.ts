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

export function registerIpcHandlers(win: BrowserWindow): void {
  ptyManager.setWindow(win)
  gitWatcher.setWindow(win)

  // PTY handlers
  ipcMain.handle(IPC.PTY_CREATE, (_e, projectId: string, cwd: string, projectName?: string) => {
    ptyManager.create(projectId, cwd, projectName)
    ptyManager.activate(projectId)
  })

  ipcMain.handle(IPC.PTY_DESTROY, (_e, projectId: string) => {
    ptyManager.destroy(projectId)
  })

  ipcMain.on(IPC.PTY_INPUT, (_e, projectId: string, data: string) => {
    ptyManager.input(projectId, data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_e, projectId: string, cols: number, rows: number) => {
    ptyManager.resize(projectId, cols, rows)
  })

  ipcMain.handle(IPC.PTY_GET_BUFFER, (_e, projectId: string) => {
    return ptyManager.getBuffer(projectId)
  })

  ipcMain.handle(IPC.PTY_RESTART, (_e, projectId: string, cwd: string) => {
    ptyManager.restart(projectId, cwd)
  })

  // File handlers
  ipcMain.handle(IPC.FILES_LIST_DIR, (_e, dirPath: string) => {
    return listDirectory(dirPath)
  })

  ipcMain.handle(IPC.FILES_OPEN_IN_EDITOR, (_e, filePath: string) => {
    openInEditor(filePath)
  })

  ipcMain.handle(IPC.FILES_SHOW_IN_EXPLORER, (_e, filePath: string) => {
    showInExplorer(filePath)
  })

  ipcMain.handle(IPC.FILES_DISCOVER_CLAUDE_MD, (_e, projectPath: string) => {
    return discoverClaudeMdFiles(projectPath)
  })

  ipcMain.handle(IPC.FILES_DETECT_PROJECTS, (_e, parentDir: string) => {
    return detectProjects(parentDir)
  })

  // Git
  ipcMain.handle(IPC.GIT_BRANCH, (_e, projectPath: string): Promise<string | null> => {
    return new Promise((resolve) => {
      execFile('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath }, (err, stdout) => {
        if (err) return resolve(null)
        resolve(stdout.trim() || null)
      })
    })
  })

  ipcMain.handle(IPC.GIT_BRANCHES, (_e, projectPath: string) => {
    return gitWatcher.getBranches(projectPath)
  })

  ipcMain.on(IPC.GIT_WATCH, (_e, projectId: string, projectPath: string) => {
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

  // Store handlers
  ipcMain.handle(IPC.STORE_GET, (_e, key: string) => {
    return store.get(key)
  })

  ipcMain.handle(IPC.STORE_SET, (_e, key: string, value: unknown) => {
    store.set(key, value)
  })

  // Window
  ipcMain.on(IPC.SET_TITLE, (_e, title: string) => {
    win.setTitle(title)
  })

  // Clipboard
  ipcMain.handle(IPC.CLIPBOARD_WRITE, (_e, text: string) => {
    clipboard.writeText(text)
  })

  // MCP
  ipcMain.handle(IPC.MCP_LIST, (_e, projectPath: string): McpServer[] => {
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
