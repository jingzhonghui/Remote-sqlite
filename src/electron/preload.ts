import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH 连接
  ssh: {
    testConnection: (config: SSHConfig) => ipcRenderer.invoke('ssh:test-connection', config),
    connect: (config: SSHConfig) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    listConnections: () => ipcRenderer.invoke('ssh:list-connections'),
  },
  // SQLite 操作
  sqlite: {
    execute: (connectionId: string, dbPath: string, sql: string) => ipcRenderer.invoke('sqlite:execute', connectionId, dbPath, sql),
    query: (connectionId: string, dbPath: string, sql: string) => ipcRenderer.invoke('sqlite:query', connectionId, dbPath, sql),
    getTables: (connectionId: string, dbPath: string) => ipcRenderer.invoke('sqlite:get-tables', connectionId, dbPath),
    getTableInfo: (connectionId: string, dbPath: string, tableName: string) => 
      ipcRenderer.invoke('sqlite:get-table-info', connectionId, dbPath, tableName),
    getIndexes: (connectionId: string, dbPath: string, tableName: string) => 
      ipcRenderer.invoke('sqlite:get-indexes', connectionId, dbPath, tableName),
  },
})

// 类型定义
interface SSHConfig {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey' | 'agent'
  password?: string
  privateKey?: string
  passphrase?: string
  useAgent?: boolean
  jumpHost?: SSHConfig
}

declare global {
  interface Window {
    electronAPI: {
      ssh: {
        testConnection: (config: SSHConfig) => Promise<{ success: boolean; message: string }>
        connect: (config: SSHConfig) => Promise<{ success: boolean; connectionId: string; message: string }>
        disconnect: (connectionId: string) => Promise<{ success: boolean }>
        listConnections: () => Promise<Array<{ id: string; name: string; host: string; status: string }>>
      }
      sqlite: {
        execute: (connectionId: string, dbPath: string, sql: string) => Promise<{ success: boolean; affectedRows?: number; message?: string }>
        query: (connectionId: string, dbPath: string, sql: string) => Promise<{ success: boolean; columns: string[]; rows: any[]; message?: string }>
        getTables: (connectionId: string, dbPath: string) => Promise<{ success: boolean; tables: string[]; message?: string }>
        getTableInfo: (connectionId: string, dbPath: string, tableName: string) => Promise<{ success: boolean; columns: any[]; message?: string }>
        getIndexes: (connectionId: string, dbPath: string, tableName: string) => Promise<{ success: boolean; indexes: any[]; message?: string }>
      }
    }
  }
}
