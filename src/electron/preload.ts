import { contextBridge, ipcRenderer } from 'electron'
import type { DatabaseContext, AIConfig, StreamEvent, ChatSession } from '../src/types/ai'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // SSH 连接
  ssh: {
    testConnection: (config: SSHConfig) => ipcRenderer.invoke('ssh:test-connection', config),
    connect: (config: SSHConfig) => ipcRenderer.invoke('ssh:connect', config),
    disconnect: (connectionId: string) => ipcRenderer.invoke('ssh:disconnect', connectionId),
    listConnections: () => ipcRenderer.invoke('ssh:list-connections'),
    listDirectory: (connectionId: string, dirPath: string) => ipcRenderer.invoke('ssh:list-directory', connectionId, dirPath),
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
  // AI 助手
  ai: {
    getConfig: () => ipcRenderer.invoke('ai:get-config'),
    setConfig: (config: Partial<AIConfig>) => ipcRenderer.invoke('ai:set-config', config),
    
    chatStream: (
      params: { input: string; context: DatabaseContext; sessionId?: string },
      callbacks: {
        onStart?: (streamId: string) => void
        onChunk?: (streamId: string, chunk: StreamEvent) => void
        onError?: (streamId: string, error: string) => void
      }
    ) => {
      const { input, context, sessionId } = params
      
      // 监听流式事件
      const handleStart = (_: any, data: { streamId: string }) => {
        callbacks.onStart?.(data.streamId)
      }
      
      const handleChunk = (_: any, data: { streamId: string; chunk: StreamEvent }) => {
        callbacks.onChunk?.(data.streamId, data.chunk)
      }
      
      const handleError = (_: any, data: { streamId: string; error: string }) => {
        callbacks.onError?.(data.streamId, data.error)
        cleanup()
      }
      
      ipcRenderer.on('ai:stream-start', handleStart)
      ipcRenderer.on('ai:stream-chunk', handleChunk)
      ipcRenderer.on('ai:stream-error', handleError)
      
      // 启动流式对话
      ipcRenderer.send('ai:chat-stream', { input, context, sessionId })
      
      // 清理函数
      const cleanup = () => {
        ipcRenderer.removeListener('ai:stream-start', handleStart)
        ipcRenderer.removeListener('ai:stream-chunk', handleChunk)
        ipcRenderer.removeListener('ai:stream-error', handleError)
      }
      
      // 返回中止函数
      return () => {
        ipcRenderer.send('ai:abort-stream', sessionId)
        cleanup()
      }
    },
    
    generateSQL: (params: { description: string; context: DatabaseContext }) => 
      ipcRenderer.invoke('ai:generate-sql', params),
    
    diagnoseError: (params: { sql: string; error: string; context: DatabaseContext }) => 
      ipcRenderer.invoke('ai:diagnose-error', params),
    
    getSessions: () => ipcRenderer.invoke('ai:get-sessions'),
    getSession: (sessionId: string) => ipcRenderer.invoke('ai:get-session', sessionId),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('ai:delete-session', sessionId),
    clearSessions: () => ipcRenderer.invoke('ai:clear-sessions'),

    // 弹出窗口
    openPopoutWindow: () => ipcRenderer.invoke('ai:open-popout'),
    closePopoutWindow: () => ipcRenderer.invoke('ai:close-popout'),
    onPopoutClosed: (callback: () => void) => {
      ipcRenderer.on('ai:popout-closed', callback)
      return () => ipcRenderer.removeListener('ai:popout-closed', callback)
    },
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
      ai: {
        getConfig: () => Promise<AIConfig>
        setConfig: (config: Partial<AIConfig>) => Promise<{ success: boolean; message?: string }>
        chatStream: (
          params: { input: string; context: DatabaseContext; sessionId?: string },
          callbacks: {
            onStart?: (streamId: string) => void
            onChunk?: (streamId: string, chunk: StreamEvent) => void
            onError?: (streamId: string, error: string) => void
          }
        ) => () => void
        generateSQL: (params: { description: string; context: DatabaseContext }) => Promise<{ success: boolean; sql?: string; explanation?: string; safety?: string; message?: string }>
        diagnoseError: (params: { sql: string; error: string; context: DatabaseContext }) => Promise<{ success: boolean; diagnosis?: string; suggestion?: string; fixedSQL?: string; message?: string }>
        getSessions: () => Promise<{ success: boolean; sessions?: ChatSession[]; message?: string }>
        getSession: (sessionId: string) => Promise<{ success: boolean; session?: ChatSession | null; message?: string }>
        deleteSession: (sessionId: string) => Promise<{ success: boolean; message?: string }>
        clearSessions: () => Promise<{ success: boolean; message?: string }>
        openPopoutWindow: () => Promise<{ success: boolean }>
        closePopoutWindow: () => Promise<{ success: boolean }>
        onPopoutClosed: (callback: () => void) => () => void
      }
    }
  }
}
