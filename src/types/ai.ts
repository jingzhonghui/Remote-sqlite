/**
 * AI 助手类型定义
 * 
 * 包含所有 AI 相关的类型、接口和枚举定义
 */

// ==================== 基础类型 ====================

/** SQL 安全级别 */
export type SafetyLevel = 'safe' | 'warning' | 'dangerous'

/** AI 提供商类型 */
export type AIProvider = 'openai' | 'openai-compatible'

/** 流式事件类型 */
export type StreamEventType =
  | 'token'
  | 'tool_start'
  | 'tool_end'
  | 'sql_generated'
  | 'sql_executing'
  | 'sql_result'
  | 'analysis'
  | 'confirmation_required'
  | 'complete'
  | 'error'

/** 分析类型 */
export type AnalysisType = 'trend' | 'distribution' | 'correlation' | 'anomaly'

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息类型 */
export type MessageType =
  | 'text'
  | 'sql'
  | 'result'
  | 'analysis'
  | 'chart'
  | 'confirmation'
  | 'system'
  | 'error'

// ==================== 配置类型 ====================

/** AI 执行策略配置 */
export interface ExecutionPolicy {
  safe: {
    autoExecute: boolean
    showConfirmation: boolean
  }
  warning: {
    autoExecute: boolean
    showConfirmation: boolean
    maxRows: number
  }
  dangerous: {
    autoExecute: boolean
    showConfirmation: boolean
    requireDoubleConfirm: boolean
  }
}

/** AI 配置接口 */
export interface AIConfig {
  // 基础配置
  enabled: boolean
  provider: AIProvider
  apiKey: string
  baseUrl?: string
  model: string

  // 生成参数
  temperature: number
  maxTokens: number

  // 执行配置
  execution: ExecutionPolicy

  // 分析配置
  analysis: {
    autoAnalyze: boolean
    maxAnalysisRows: number
    generateVisualization: boolean
  }

  // 上下文配置
  context: {
    maxHistoryMessages: number
    cacheSchema: boolean
    schemaCacheTTL: number
  }
}

/** AI 配置（不含敏感信息，用于显示） */
export interface AIConfigDisplay {
  enabled: boolean
  provider: AIProvider
  baseUrl?: string
  model: string
  temperature: number
  maxTokens: number
  execution: ExecutionPolicy
  analysis: {
    autoAnalyze: boolean
    maxAnalysisRows: number
    generateVisualization: boolean
  }
  context: {
    maxHistoryMessages: number
    cacheSchema: boolean
    schemaCacheTTL: number
  }
}

// ==================== 数据库上下文 ====================

/** 数据库表信息 */
export interface TableInfo {
  name: string
  columns: ColumnInfo[]
  indexes?: IndexInfo[]
}

/** 列信息 */
export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: any
  pk: number
}

/** 索引信息 */
export interface IndexInfo {
  name: string
  unique: number
  origin: string
  partial: number
  columns: string[]
}

/** 数据库结构 */
export interface DatabaseSchema {
  tables: TableInfo[]
  views: { name: string; sql: string }[]
  indexes: IndexInfo[]
  fetchedAt: number
}

/** 数据库上下文 */
export interface DatabaseContext {
  connectionId: string
  host: string
  port: number
  username: string
  dbPath: string
  dbName: string
  currentTable?: string
  currentSQL?: string
  lastResult?: QueryResult
  lastError?: SQLError
  schemaCache?: DatabaseSchema
}

/** 查询结果 */
export interface QueryResult {
  success: boolean
  columns: string[]
  rows: any[]
  rowCount: number
  executionTime?: number
  message?: string
}

/** SQL 错误 */
export interface SQLError {
  message: string
  code?: string
  line?: number
  column?: number
}

// ==================== 流式事件 ====================

/** 基础流式事件 */
export interface BaseStreamEvent {
  type: StreamEventType
}

/** Token 事件 */
export interface TokenEvent extends BaseStreamEvent {
  type: 'token'
  content: string
}

/** Tool 开始事件 */
export interface ToolStartEvent extends BaseStreamEvent {
  type: 'tool_start'
  tool: string
  params?: any
}

/** Tool 结束事件 */
export interface ToolEndEvent extends BaseStreamEvent {
  type: 'tool_end'
  tool: string
  result: any
}

/** SQL 生成事件 */
export interface SQLGeneratedEvent extends BaseStreamEvent {
  type: 'sql_generated'
  sql: string
  safety: SafetyLevel
}

/** SQL 执行中事件 */
export interface SQLExecutingEvent extends BaseStreamEvent {
  type: 'sql_executing'
  sql: string
}

/** SQL 结果事件 */
export interface SQLResultEvent extends BaseStreamEvent {
  type: 'sql_result'
  /** 查询结果或 schema 结果等 */
  result: any
}

/** 分析数据事件 */
export interface AnalysisEvent extends BaseStreamEvent {
  type: 'analysis'
  data: AnalysisData
}

/** 需要确认事件 */
export interface ConfirmationRequiredEvent extends BaseStreamEvent {
  type: 'confirmation_required'
  operation: DangerousOperation
}

/** 完成事件 */
export interface CompleteEvent extends BaseStreamEvent {
  type: 'complete'
  summary?: string
}

/** 错误事件 */
export interface ErrorEvent extends BaseStreamEvent {
  type: 'error'
  message: string
  code?: string
}

/** 流式事件联合类型 */
export type StreamEvent =
  | TokenEvent
  | ToolStartEvent
  | ToolEndEvent
  | SQLGeneratedEvent
  | SQLExecutingEvent
  | SQLResultEvent
  | AnalysisEvent
  | ConfirmationRequiredEvent
  | CompleteEvent
  | ErrorEvent

// ==================== 操作与结果 ====================

/** 危险操作 */
export interface DangerousOperation {
  title: string
  operation: string
  level: 'warning' | 'dangerous'
  impact: {
    affectedRows: number
    affectedTables: string[]
    isDestructive: boolean
  }
  preview?: {
    columns: string[]
    rows: any[]
  }
}

/** 影响预估 */
export interface ImpactEstimate {
  level: SafetyLevel
  affectedRows?: number
  canAutoExecute: boolean
}

/** 分析数据 */
export interface AnalysisData {
  statistics: Record<string, any>
  insights: string[]
  visualization?: {
    type: 'bar' | 'line' | 'pie'
    data: any
  }
}

/** SQL 生成结果 */
export interface SQLGenerationResult {
  sql: string
  explanation: string
  safety: SafetyLevel
}

/** 诊断结果 */
export interface DiagnosisResult {
  error: string
  diagnosis: string
  suggestion: string
  fixedSQL?: string
}

// ==================== 对话消息 ====================

/** 对话消息 */
export interface ChatMessage {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  sql?: string
  result?: QueryResult
  analysis?: AnalysisData
  confirmation?: DangerousOperation
  isStreaming?: boolean
  timestamp: number
}

/** 对话会话 */
export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  context: DatabaseContext
  createdAt: number
  updatedAt: number
}

// ==================== Tool 参数 ====================

/** 获取数据库结构参数 */
export interface GetDatabaseSchemaParams {
  includeSampleData?: boolean
}

/** 获取表信息参数 */
export interface GetTableInfoParams {
  tableName: string
  includeStatistics?: boolean
}

/** 执行查询参数 */
export interface ExecuteQueryParams {
  sql: string
  limit?: number
}

/** 执行 DML 参数 */
export interface ExecuteDMLParams {
  sql: string
  requireConfirmation?: boolean
}

/** 数据分析参数 */
export interface AnalyzeDataParams {
  query: string
  analysisType: AnalysisType
  dimensions?: string[]
}

/** 生成并执行参数 */
export interface GenerateAndExecuteParams {
  goal: string
  context?: {
    tableHint?: string
    timeRange?: { start: string; end: string }
  }
}

// ==================== Agent 接口 ====================

/** SQL Agent 接口 */
export interface SQLAgent {
  chatStream(
    input: string,
    context: DatabaseContext
  ): AsyncGenerator<StreamEvent, void, unknown>

  generateSQL(
    description: string,
    context: DatabaseContext
  ): Promise<SQLGenerationResult>

  analyzeAndExecute(
    goal: string,
    context: DatabaseContext
  ): Promise<AnalysisData>

  diagnoseError(
    error: SQLError,
    context: DatabaseContext
  ): Promise<DiagnosisResult>
}

// ==================== IPC 接口 ====================

/** AI IPC API */
export interface AIIPCAPI {
  chatStream(
    params: {
      input: string
      context: DatabaseContext
      sessionId?: string
    },
    onChunk: (event: StreamEvent) => void
  ): () => void

  confirmExecution(executionId: string): Promise<{ success: boolean; result?: QueryResult; error?: string }>
  cancelExecution(executionId: string): Promise<void>

  getConfig(): Promise<AIConfig>
  setConfig(config: Partial<AIConfig>): Promise<void>

  getSessions(): Promise<ChatSession[]>
  getSession(sessionId: string): Promise<ChatSession | null>
  createSession(context: DatabaseContext): Promise<ChatSession>
  deleteSession(sessionId: string): Promise<void>
  clearSessions(): Promise<void>
}

// ==================== 常量 ====================

/** 默认 AI 配置 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4096,
  execution: {
    safe: {
      autoExecute: true,
      showConfirmation: false,
    },
    warning: {
      autoExecute: true,
      showConfirmation: false,
      maxRows: 1000,
    },
    dangerous: {
      autoExecute: false,
      showConfirmation: true,
      requireDoubleConfirm: true,
    },
  },
  analysis: {
    autoAnalyze: true,
    maxAnalysisRows: 10000,
    generateVisualization: true,
  },
  context: {
    maxHistoryMessages: 20,
    cacheSchema: true,
    schemaCacheTTL: 300,
  },
}

/** 安全级别配置 */
export const SAFETY_CONFIG: Record<SafetyLevel, { label: string; color: string; icon: string }> = {
  safe: { label: '安全', color: '#10b981', icon: '🟢' },
  warning: { label: '警告', color: '#f59e0b', icon: '🟡' },
  dangerous: { label: '危险', color: '#ef4444', icon: '🔴' },
}
