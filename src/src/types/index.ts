// SSH 连接配置
export interface SSHConfig {
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

// 连接状态
export interface Connection {
  id: string
  configId: string  // 关联的配置ID
  name: string
  host: string
  port: number
  username: string
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  connectedAt?: Date
  errorMessage?: string
  lastDatabase?: string  // 最后使用的数据库路径
}

// 连接池 - 管理所有活跃连接
export interface ConnectionPool {
  connections: Connection[]
  activeConnectionId: string | null  // 当前选中的连接
}

// 数据库信息
export interface DatabaseInfo {
  path: string
  name: string
  size?: number
  tables: TableInfo[]
  connectionId: string  // 关联的连接ID
}

// 表信息
export interface TableInfo {
  name: string
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  rowCount?: number
}

// 列信息
export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

// 索引信息
export interface IndexInfo {
  name: string
  unique: number
  origin: string
  partial: number
  columns: string[]
}

// 查询结果
export interface QueryResult {
  columns: string[]
  rows: any[]
  executionTime?: number
  affectedRows?: number
}

// SQL 历史记录
export interface SqlHistory {
  id: string
  sql: string
  timestamp: Date
  executionTime: number
  success: boolean
}

// 建表列定义
export interface ColumnDefinition {
  id: string
  name: string
  type: string
  length?: number
  nullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  isUnique: boolean
}

// 外键定义
export interface ForeignKeyDefinition {
  id: string
  column: string
  refTable: string
  refColumn: string
  onDelete?: string
  onUpdate?: string
}

// 表设计
export interface TableDesign {
  name: string
  columns: ColumnDefinition[]
  foreignKeys: ForeignKeyDefinition[]
  indexes: IndexDefinition[]
}

// 索引定义
export interface IndexDefinition {
  id: string
  name: string
  columns: string[]
  unique: boolean
}
