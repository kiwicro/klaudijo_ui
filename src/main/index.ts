import { app, BrowserWindow, Notification, Tray, Menu, nativeImage, session } from 'electron'
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
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false
    }
  })

  if (saved.maximized) win.maximize()

  mainWindow = win

  // Security: restrict navigation to app URLs only
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL || ''
    if (!url.startsWith('file://') && (!devUrl || !url.startsWith(devUrl))) {
      event.preventDefault()
    }
  })

  // Security: deny all new window creation
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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
  // In dev: resources/ is at project root. In production: it's in app.getAppPath()/resources/ or process.resourcesPath
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
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
  // Security: Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    const connectSrc = devUrl ? `'self' ${devUrl} ws://localhost:*` : "'self'"
    const scriptSrc = devUrl ? `'self' 'unsafe-inline'` : "'self'"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src ${connectSrc}`
        ]
      }
    })
  })

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
