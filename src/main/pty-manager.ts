import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc-channels'
import { PtyStatus } from '../shared/types'

const MAX_BUFFER_SIZE = 1024 * 1024 // 1MB rolling buffer
const NOTIFY_DEBOUNCE_MS = 3000

interface PtySession {
  process: pty.IPty
  buffer: string
  status: PtyStatus
  exitCode?: number
  activeProjectId: string | null
  projectName: string
  notifyTimer: ReturnType<typeof setTimeout> | null
}

export type BackgroundActivityCallback = (projectId: string, projectName: string) => void

class PtyManager {
  private sessions = new Map<string, PtySession>()
  private activeProjectId: string | null = null
  private window: BrowserWindow | null = null
  private onBackgroundActivity: BackgroundActivityCallback | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  setBackgroundActivityCallback(cb: BackgroundActivityCallback): void {
    this.onBackgroundActivity = cb
  }

  create(projectId: string, cwd: string, projectName?: string): void {
    if (this.sessions.has(projectId)) return

    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
    const args = process.platform === 'win32' ? ['/c', 'claude'] : ['-c', 'claude']

    const proc = pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: { ...process.env } as Record<string, string>
    })

    const session: PtySession = {
      process: proc,
      buffer: '',
      status: 'running',
      activeProjectId: projectId,
      projectName: projectName || cwd.split(/[\\/]/).pop() || cwd,
      notifyTimer: null
    }

    proc.onData((data: string) => {
      // Always append to buffer
      session.buffer += data
      if (session.buffer.length > MAX_BUFFER_SIZE) {
        session.buffer = session.buffer.slice(-MAX_BUFFER_SIZE)
      }

      // Only send to renderer if this is the active project
      if (this.activeProjectId === projectId && this.window) {
        this.window.webContents.send(IPC.PTY_DATA, projectId, data)
      }

      // Activity notification (debounced)
      if (this.onBackgroundActivity) {
        if (session.notifyTimer) clearTimeout(session.notifyTimer)
        session.notifyTimer = setTimeout(() => {
          session.notifyTimer = null
          if (this.onBackgroundActivity) {
            this.onBackgroundActivity(projectId, session.projectName)
          }
        }, NOTIFY_DEBOUNCE_MS)
      }
    })

    proc.onExit(({ exitCode }) => {
      session.status = 'exited'
      session.exitCode = exitCode
      if (session.notifyTimer) {
        clearTimeout(session.notifyTimer)
        session.notifyTimer = null
      }
      if (this.window) {
        this.window.webContents.send(IPC.PTY_EXIT, projectId, exitCode)
      }
    })

    this.sessions.set(projectId, session)
  }

  destroy(projectId: string): void {
    const session = this.sessions.get(projectId)
    if (!session) return

    if (session.notifyTimer) clearTimeout(session.notifyTimer)
    if (session.status === 'running') {
      session.process.kill()
    }
    this.sessions.delete(projectId)

    if (this.activeProjectId === projectId) {
      this.activeProjectId = null
    }
  }

  input(projectId: string, data: string): void {
    const session = this.sessions.get(projectId)
    if (!session || session.status !== 'running') return
    session.process.write(data)
  }

  resize(projectId: string, cols: number, rows: number): void {
    const session = this.sessions.get(projectId)
    if (!session || session.status !== 'running') return
    session.process.resize(cols, rows)
  }

  getBuffer(projectId: string): string {
    return this.sessions.get(projectId)?.buffer ?? ''
  }

  getStatus(projectId: string): PtyStatus {
    return this.sessions.get(projectId)?.status ?? 'idle'
  }

  activate(projectId: string): void {
    this.activeProjectId = projectId
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId
  }

  restart(projectId: string, cwd: string): void {
    const name = this.sessions.get(projectId)?.projectName
    this.destroy(projectId)
    this.create(projectId, cwd, name)
    this.activate(projectId)
  }

  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroy(id)
    }
  }
}

export const ptyManager = new PtyManager()
