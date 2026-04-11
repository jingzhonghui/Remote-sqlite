import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { SSHService } from './services/sshService'
import { SQLiteService } from './services/sqliteService'

// ESM 中 __dirname 不可用，需要手动创建
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
const sshService = new SSHService()
const sqliteService = new SQLiteService(sshService)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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
}

// 移除默认菜单栏
Menu.setApplicationMenu(null)

app.whenReady().then(() => {
  createWindow()
  setupIPC()

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
