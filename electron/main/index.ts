import { app, BrowserWindow, Menu, nativeTheme } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { registerIpcHandlers } from './ipc-handlers'
import { getWindowState, saveWindowState } from './store'

let mainWindow

function createWindow(): void {
  const persistedWindow = getWindowState()
  const devIconPath = join(app.getAppPath(), 'build', 'icon.png')
  const windowIcon = fs.existsSync(devIconPath) ? devIconPath : undefined

  mainWindow = new BrowserWindow({
    width: persistedWindow.width || 1280,
    height: persistedWindow.height || 800,
    x: persistedWindow.x,
    y: persistedWindow.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    icon: windowIcon,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f0f0f' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  // Register all IPC handlers
  registerIpcHandlers(mainWindow)

  // Graceful show after ready-to-show
  mainWindow.once('ready-to-show', () => {
    if (persistedWindow.maximized) {
      mainWindow!.maximize()
    }
    mainWindow!.show()
  })

  // Load app
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const persistCurrentWindowState = () => {
    if (!mainWindow) return
    const isMax = mainWindow.isMaximized()
    const bounds = isMax ? mainWindow.getNormalBounds() : mainWindow.getBounds()
    saveWindowState({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: isMax
    })
  }

  mainWindow.on('resize', persistCurrentWindowState)
  mainWindow.on('move', persistCurrentWindowState)
  mainWindow.on('maximize', persistCurrentWindowState)
  mainWindow.on('unmaximize', persistCurrentWindowState)
  mainWindow.on('close', persistCurrentWindowState)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Remove default Electron menu
  Menu.setApplicationMenu(null)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: prevent new window creation
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})
