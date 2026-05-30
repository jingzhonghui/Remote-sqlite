import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { SSHService } from './services/sshService'
import { SQLiteService } from './services/sqliteService'
import { initializeAI, registerAIIPC } from './ai'

// 为 LangChain 提供全局 crypto 对象
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = crypto
}

// ESM 中 __dirname 不可用，需要手动创建
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let popoutWindow: BrowserWindow | null = null
const sshService = new SSHService()
const sqliteService = new SQLiteService(sshService)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  })

  // 加载应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC 处理器
function setupIPC() {
  // SSH 连接管理
  ipcMain.handle('ssh:test-connection', async (_, config) => {
    return sshService.testConnection(config)
  })

  ipcMain.handle('ssh:connect', async (_, config) => {
    return sshService.connect(config)
  })

  ipcMain.handle('ssh:disconnect', async (_, connectionId) => {
    return sshService.disconnect(connectionId)
  })

  ipcMain.handle('ssh:list-connections', async () => {
    return sshService.listConnections()
  })

  // SQLite 操作
  ipcMain.handle('sqlite:execute', async (_, connectionId, dbPath, sql) => {
    return sqliteService.execute(connectionId, dbPath, sql)
  })

  ipcMain.handle('sqlite:query', async (_, connectionId, dbPath, sql) => {
    return sqliteService.query(connectionId, dbPath, sql)
  })

  ipcMain.handle('sqlite:get-tables', async (_, connectionId, dbPath) => {
    return sqliteService.getTables(connectionId, dbPath)
  })

  ipcMain.handle('sqlite:get-table-info', async (_, connectionId, dbPath, tableName) => {
    return sqliteService.getTableInfo(connectionId, dbPath, tableName)
  })

  ipcMain.handle('sqlite:get-indexes', async (_, connectionId, dbPath, tableName) => {
    return sqliteService.getIndexes(connectionId, dbPath, tableName)
  })

  // 远程文件浏览
  ipcMain.handle('ssh:list-directory', async (_, connectionId, dirPath) => {
    return sshService.listDirectory(connectionId, dirPath)
  })

  // AI 助手 IPC
  registerAIIPC()

  // AI 弹出窗口
  ipcMain.handle('ai:open-popout', async () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.focus()
      return { success: true }
    }

    const url = process.env.VITE_DEV_SERVER_URL
      ? process.env.VITE_DEV_SERVER_URL + '#/popout/ai'
      : `file://${path.join(__dirname, '../dist/index.html').replace(/\\/g, '/')}#/popout/ai`

    popoutWindow = new BrowserWindow({
      width: 520,
      height: 700,
      minWidth: 380,
      minHeight: 500,
      title: 'AI 助手',
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    })

    popoutWindow.loadURL(url)

    popoutWindow.once('ready-to-show', () => {
      popoutWindow?.show()
    })

    popoutWindow.on('closed', () => {
      popoutWindow = null
      // 通知主窗口 AI 面板已还原
      mainWindow?.webContents.send('ai:popout-closed')
    })

    return { success: true }
  })

  ipcMain.handle('ai:close-popout', async () => {
    if (popoutWindow && !popoutWindow.isDestroyed()) {
      popoutWindow.close()
    }
    return { success: true }
  })
}

// 移除默认菜单栏
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()
  setupIPC()
  
  // 初始化 AI 模块
  initializeAI(sqliteService, sshService)

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

// 清理资源
app.on('before-quit', async () => {
  await sshService.disconnectAll()
})
