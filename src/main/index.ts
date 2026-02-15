import { app, BrowserWindow, Notification, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc-handlers'
import { ptyManager } from './pty-manager'
import { store } from './store'
import { IPC } from '../shared/ipc-channels'
import { WindowBounds } from '../shared/types'

app.setAppUserModelId('com.klaudijo.ui')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function saveBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const maximized = mainWindow.isMaximized()
  const bounds = maximized ? store.get('windowBounds') : mainWindow.getBounds()
  store.set('windowBounds', { ...bounds, maximized })
}

function createWindow(): void {
  const saved: WindowBounds = store.get('windowBounds')

  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    ...(saved.x >= 0 && saved.y >= 0 ? { x: saved.x, y: saved.y } : {}),
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'default',
    title: 'Klaudijo UI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (saved.maximized) win.maximize()

  mainWindow = win

  // Save bounds on resize/move (debounced)
  let boundsTimer: ReturnType<typeof setTimeout> | null = null
  const debounceSaveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer)
    boundsTimer = setTimeout(saveBounds, 500)
  }
  win.on('resize', debounceSaveBounds)
  win.on('move', debounceSaveBounds)

  // Minimize to tray instead of closing
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  registerIpcHandlers(win)

  // Activity notifications
  ptyManager.setBackgroundActivityCallback((projectId, projectName) => {
    if (!win || win.isDestroyed()) return

    const isActiveProject = ptyManager.getActiveProjectId() === projectId
    if (win.isFocused() && isActiveProject) return

    const notification = new Notification({
      title: 'Klaudijo UI',
      body: `Claude responded in ${projectName}`
    })

    notification.on('click', () => {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
        win.webContents.send(IPC.SWITCH_PROJECT, projectId)
      }
    })

    notification.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPklEQVQ4T2NkYPj/n4EBCRgZGRmRuUC+kZGRiQGPBkYGBgZGfBpgakkzAJdriDcA3VXEuoZoXiA6DFBcAQCNjBARAWjVfAAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setToolTip('Klaudijo UI')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('before-quit', () => {
  isQuitting = true
  saveBounds()
})

app.on('window-all-closed', () => {
  // Don't quit - tray keeps it alive
})

app.on('activate', () => {
  mainWindow?.show()
})
