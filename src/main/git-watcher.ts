import { execFile } from 'child_process'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IPC } from '../shared/ipc-channels'

export interface GitBranchInfo {
  current: string | null
  branches: string[]
}

class GitWatcher {
  private watchers = new Map<string, fs.FSWatcher[]>()
  private win: BrowserWindow | null = null
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  getBranches(projectPath: string): Promise<GitBranchInfo> {
    return new Promise((resolve) => {
      execFile(
        'git',
        ['branch', '--no-color'],
        { cwd: projectPath },
        (err, stdout) => {
          if (err) return resolve({ current: null, branches: [] })
          const lines = stdout.split('\n').filter((l) => l.trim())
          let current: string | null = null
          const branches: string[] = []
          for (const line of lines) {
            const name = line.replace(/^\*?\s+/, '').trim()
            if (!name) continue
            branches.push(name)
            if (line.startsWith('*')) current = name
          }
          resolve({ current, branches })
        }
      )
    })
  }

  watch(projectId: string, projectPath: string): void {
    this.unwatch(projectId)

    const gitDir = path.join(projectPath, '.git')
    if (!fs.existsSync(gitDir)) return

    const fsWatchers: fs.FSWatcher[] = []

    const notify = (): void => {
      const existing = this.debounceTimers.get(projectId)
      if (existing) clearTimeout(existing)
      this.debounceTimers.set(
        projectId,
        setTimeout(async () => {
          this.debounceTimers.delete(projectId)
          const info = await this.getBranches(projectPath)
          if (this.win && !this.win.isDestroyed()) {
            this.win.webContents.send(IPC.GIT_BRANCHES_CHANGED, projectId, info)
          }
        }, 300)
      )
    }

    // Watch .git/HEAD for branch switches
    const headPath = path.join(gitDir, 'HEAD')
    try {
      const w = fs.watch(headPath, notify)
      w.on('error', () => {})
      fsWatchers.push(w)
    } catch {}

    // Watch .git/refs/heads/ for branch create/delete
    const refsPath = path.join(gitDir, 'refs', 'heads')
    try {
      if (fs.existsSync(refsPath)) {
        const w = fs.watch(refsPath, { recursive: true }, notify)
        w.on('error', () => {})
        fsWatchers.push(w)
      }
    } catch {}

    // Watch .git/packed-refs for packed branch changes
    const packedRefsPath = path.join(gitDir, 'packed-refs')
    try {
      if (fs.existsSync(packedRefsPath)) {
        const w = fs.watch(packedRefsPath, notify)
        w.on('error', () => {})
        fsWatchers.push(w)
      }
    } catch {}

    this.watchers.set(projectId, fsWatchers)
  }

  unwatch(projectId: string): void {
    const existing = this.watchers.get(projectId)
    if (existing) {
      for (const w of existing) {
        try { w.close() } catch {}
      }
      this.watchers.delete(projectId)
    }
    const timer = this.debounceTimers.get(projectId)
    if (timer) {
      clearTimeout(timer)
      this.debounceTimers.delete(projectId)
    }
  }

  unwatchAll(): void {
    for (const id of this.watchers.keys()) {
      this.unwatch(id)
    }
  }
}

export const gitWatcher = new GitWatcher()
