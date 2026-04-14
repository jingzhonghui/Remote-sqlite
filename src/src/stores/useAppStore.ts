import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SSHConfig, Connection, ConnectionPool, DatabaseInfo, SqlHistory, TableDesign } from '../types'

export type Theme = 'dark' | 'light'

interface AppState {
  // 主题
  theme: Theme
  
  // 字体大小
  fontSize: number
  
  // SSH 连接
  savedConnections: SSHConfig[]
  connectionPool: ConnectionPool  // 连接池管理多个活跃连接
  activeConnectionId: string | null  // 当前选中的连接ID
  
  // 数据库
  databases: DatabaseInfo[]  // 所有打开的数据库
  currentDatabase: DatabaseInfo | null
  selectedTable: string | null
  
  // SQL 编辑器
  sqlHistory: SqlHistory[]
  savedQueries: { name: string; sql: string }[]
  
  // 表设计
  currentTableDesign: TableDesign | null
  
  // Actions - 连接管理
  addConnection: (config: SSHConfig) => void
  removeConnection: (id: string) => void
  updateConnection: (id: string, config: Partial<SSHConfig>) => void
  
  // Actions - 连接池
  addToPool: (connection: Connection) => void
  removeFromPool: (connectionId: string) => void
  updatePoolConnection: (connectionId: string, updates: Partial<Connection>) => void
  setActiveConnectionId: (connectionId: string | null) => void
  getActiveConnection: () => Connection | null
  
  // Actions - 数据库
  setCurrentDatabase: (database: DatabaseInfo | null) => void
  addDatabase: (database: DatabaseInfo) => void
  removeDatabase: (connectionId: string, dbPath: string) => void
  setSelectedTable: (table: string | null) => void
  
  // Actions - SQL
  addSqlHistory: (history: SqlHistory) => void
  saveQuery: (name: string, sql: string) => void
  removeSavedQuery: (name: string) => void
  setCurrentTableDesign: (design: TableDesign | null) => void
  
  // Actions - 主题
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  
  // Actions - 字体大小
  setFontSize: (size: number) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'dark',
      fontSize: 14,
      savedConnections: [],
      connectionPool: { connections: [], activeConnectionId: null },
      activeConnectionId: null,
      databases: [],
      currentDatabase: null,
      selectedTable: null,
      sqlHistory: [],
      savedQueries: [],
      currentTableDesign: null,

      // Actions - 连接管理
      addConnection: (config) =>
        set((state) => ({
          savedConnections: [...state.savedConnections, { ...config, id: config.id || `conn_${Date.now()}` }],
        })),

      removeConnection: async (id) => {
        // 如果连接在池中，先断开
        const pool = get().connectionPool
        const connInPool = pool.connections.find(c => c.configId === id)
        if (connInPool) {
          try {
            await window.electronAPI.ssh.disconnect(connInPool.id)
          } catch (e) {
            console.error('断开连接失败:', e)
          }
        }
        // 移除连接配置
        set((state) => ({
          savedConnections: state.savedConnections.filter((c) => c.id !== id),
          // 同时从连接池移除
          connectionPool: {
            ...state.connectionPool,
            connections: state.connectionPool.connections.filter(c => c.configId !== id),
            activeConnectionId: state.connectionPool.activeConnectionId === connInPool?.id 
              ? state.connectionPool.connections.find(c => c.configId !== id)?.id || null 
              : state.connectionPool.activeConnectionId,
          },
          // 移除相关数据库
          databases: state.databases.filter(db => db.connectionId !== connInPool?.id),
          // 如果当前数据库属于被删除的连接，清空
          currentDatabase: state.currentDatabase?.connectionId === connInPool?.id ? null : state.currentDatabase,
          activeConnectionId: state.activeConnectionId === connInPool?.id 
            ? pool.connections.find(c => c.configId !== id)?.id || null 
            : state.activeConnectionId,
        }))
      },

      updateConnection: (id, config) =>
        set((state) => ({
          savedConnections: state.savedConnections.map((c) =>
            c.id === id ? { ...c, ...config } : c
          ),
        })),

      // Actions - 连接池
      addToPool: (connection) =>
        set((state) => {
          const exists = state.connectionPool.connections.find(c => c.id === connection.id)
          if (exists) {
            return {
              connectionPool: {
                ...state.connectionPool,
                connections: state.connectionPool.connections.map(c =>
                  c.id === connection.id ? { ...c, ...connection } : c
                ),
              },
            }
          }
          return {
            connectionPool: {
              ...state.connectionPool,
              connections: [...state.connectionPool.connections, connection],
              activeConnectionId: state.connectionPool.activeConnectionId || connection.id,
            },
            activeConnectionId: state.activeConnectionId || connection.id,
          }
        }),

      removeFromPool: async (connectionId) => {
        try {
          await window.electronAPI.ssh.disconnect(connectionId)
        } catch (e) {
          console.error('断开连接失败:', e)
        }
        set((state) => {
          const remaining = state.connectionPool.connections.filter(c => c.id !== connectionId)
          return {
            connectionPool: {
              connections: remaining,
              activeConnectionId: state.connectionPool.activeConnectionId === connectionId
                ? remaining[0]?.id || null
                : state.connectionPool.activeConnectionId,
            },
            activeConnectionId: state.activeConnectionId === connectionId
              ? remaining[0]?.id || null
              : state.activeConnectionId,
            // 移除该连接的数据库
            databases: state.databases.filter(db => db.connectionId !== connectionId),
            currentDatabase: state.currentDatabase?.connectionId === connectionId ? null : state.currentDatabase,
          }
        })
      },

      updatePoolConnection: (connectionId, updates) =>
        set((state) => ({
          connectionPool: {
            ...state.connectionPool,
            connections: state.connectionPool.connections.map(c =>
              c.id === connectionId ? { ...c, ...updates } : c
            ),
          },
        })),

      setActiveConnectionId: (connectionId) =>
        set((state) => ({
          activeConnectionId: connectionId,
          connectionPool: {
            ...state.connectionPool,
            activeConnectionId: connectionId,
          },
        })),

      getActiveConnection: () => {
        const state = get()
        return state.connectionPool.connections.find(c => c.id === state.activeConnectionId) || null
      },

      // Actions - 数据库
      setCurrentDatabase: (database) =>
        set(() => ({
          currentDatabase: database,
        })),

      addDatabase: (database) =>
        set((state) => {
          const exists = state.databases.find(d => d.path === database.path && d.connectionId === database.connectionId)
          if (exists) {
            return {
              databases: state.databases.map(d =>
                d.path === database.path && d.connectionId === database.connectionId ? database : d
              ),
              currentDatabase: database,
            }
          }
          return {
            databases: [...state.databases, database],
            currentDatabase: database,
          }
        }),

      removeDatabase: (connectionId, dbPath) =>
        set((state) => ({
          databases: state.databases.filter(d => !(d.connectionId === connectionId && d.path === dbPath)),
          currentDatabase: state.currentDatabase?.connectionId === connectionId && state.currentDatabase?.path === dbPath
            ? null
            : state.currentDatabase,
        })),

      setSelectedTable: (table) =>
        set(() => ({
          selectedTable: table,
        })),

      addSqlHistory: (history) =>
        set((state) => ({
          sqlHistory: [history, ...state.sqlHistory.slice(0, 99)],
        })),

      saveQuery: (name, sql) =>
        set((state) => ({
          savedQueries: [...state.savedQueries.filter((q) => q.name !== name), { name, sql }],
        })),

      removeSavedQuery: (name) =>
        set((state) => ({
          savedQueries: state.savedQueries.filter((q) => q.name !== name),
        })),

      setCurrentTableDesign: (design) =>
        set(() => ({
          currentTableDesign: design,
        })),

      // Actions - 主题
      setTheme: (theme) =>
        set(() => ({
          theme,
        })),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),

      // Actions - 字体大小
      setFontSize: (size) =>
        set(() => ({
          fontSize: size,
        })),
    }),
    {
      name: 'remote-sqlite-storage',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        savedConnections: state.savedConnections,
        savedQueries: state.savedQueries,
        databases: state.databases,
        currentDatabase: state.currentDatabase,
        selectedTable: state.selectedTable,
      }),
    }
  )
)
