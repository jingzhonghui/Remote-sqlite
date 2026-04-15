/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    ssh: {
      testConnection: (config: SSHConfig) => Promise<{ success: boolean; message: string }>
      connect: (config: SSHConfig) => Promise<{ success: boolean; connectionId: string; message: string }>
      disconnect: (connectionId: string) => Promise<{ success: boolean }>
      listConnections: () => Promise<Array<{ id: string; name: string; host: string; status: string }>>
      listDirectory: (connectionId: string, dirPath: string) => Promise<{
        success: boolean
        path: string
        parent: string | null
        items: Array<{
          name: string
          type: 'file' | 'directory' | 'link'
          size: number
          modified: string
          isDbFile: boolean
        }>
        message?: string
      }>
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
