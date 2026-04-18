import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc'

const isDev = !app.isPackaged

function getPortableDataPath(): string {
  const exePath = isDev
    ? path.resolve(__dirname, '../../..')
    : (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath))
  const dataDir = path.join(exePath, 'CineLibrary-Data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return dataDir
}

const dataDir = getPortableDataPath()
app.setPath('userData', dataDir)

let mainWindow: BrowserWindow | null = null

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Quit CineLibrary', accelerator: 'Alt+F4', role: 'quit' }
      ]
    },
    ...(isDev ? [{
      label: 'View',
      submenu: [
        { role: 'reload' as const, accelerator: 'Ctrl+R' },
        { role: 'forceReload' as const, accelerator: 'Ctrl+Shift+R' },
        { type: 'separator' as const },
        { role: 'toggleDevTools' as const, accelerator: 'F12' }
      ]
    }] : []),
    {
      label: 'Help',
      submenu: [
        { label: 'About CineLibrary', click: () => showAbout() }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  const iconPath = isDev
    ? path.resolve(__dirname, '../../../build/icon.ico')
    : path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'build', 'icon.ico')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'CineLibrary',
    backgroundColor: '#0a0a0c',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: false,           // custom frameless — drag region set in renderer
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// Window controls IPC (for frameless window)
ipcMain.on('win:minimize', () => mainWindow?.minimize())
ipcMain.on('win:maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('win:close',    () => mainWindow?.close())

// About dialog — callable from renderer (logo click)
function showAbout() {
  const iconPath = isDev
    ? path.resolve(__dirname, '../../../build/icon.ico')
    : path.join(path.dirname(process.execPath), 'resources', 'app.asar.unpacked', 'build', 'icon.ico')
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About CineLibrary',
    message: 'CineLibrary',
    detail: [
      'Version 1.0.0',
      '',
      'A portable movie catalog for MediaElch-scraped movie collections.',
      'Browse, search and play your movies across multiple external drives.',
      '',
      'Requires movies to be scraped with MediaElch first.',
      'https://mediaelch.github.io/mediaelch-doc/',
      '',
      'github.com/aungkokomm/CineLibrary',
      '',
      'Built with Electron · React · SQLite'
    ].join('\n'),
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    buttons: ['OK'],
    noLink: true
  })
}
ipcMain.on('app:about', () => showAbout())

app.whenReady().then(() => {
  buildMenu()
  const db = initDatabase(path.join(dataDir, 'cinelibrary.db'))
  registerIpcHandlers(db, dataDir)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export function getMainWindow() { return mainWindow }
