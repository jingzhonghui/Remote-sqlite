/**
 * SQL Agent 核心实现
 * 
 * 基于 LangChain v1 的 ReAct Agent
 */

import { ChatOpenAI } from '@langchain/openai'
import { createAgent } from 'langchain'
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { SQLiteService } from '../../services/sqliteService'
import type { SSHService } from '../../services/sshService'
import type { 
  DatabaseContext, 
  StreamEvent, 
  AIConfig,
  ChatSession 
} from '../../../src/types/ai'
import { buildSystemPrompt } from '../prompts/sql-prompts'
import { createAllTools, type ToolContext } from '../tools/sql-tools'
import { classifySQLSafety } from '../utils/sql-safety'

/**
 * SQL Agent 类
 */
export class SQLAgent {
  private sqliteService: SQLiteService
  private sshService: SSHService
  private config: AIConfig
  private sessions: Map<string, ChatSession> = new Map()
  private currentSessionId: string | null = null

  constructor(
    sqliteService: SQLiteService,
    sshService: SSHService,
    config: AIConfig
  ) {
    this.sqliteService = sqliteService
    this.sshService = sshService
    this.config = config
  }

  /**
   * 更新配置
   */
  updateConfig(config: AIConfig) {
    this.config = config
  }

  /**
   * 创建 LLM 模型
   */
  private createModel() {
    return new ChatOpenAI({
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      apiKey: this.config.apiKey,
      configuration: this.config.baseUrl ? {
        baseURL: this.config.baseUrl,
      } : undefined,
    })
  }

  /**
   * 创建 Tool 上下文
   */
  private createToolContext(dbContext: DatabaseContext): ToolContext {
    return {
      sqliteService: this.sqliteService,
      sshService: this.sshService,
      dbContext,
      getConfig: () => ({
        warningThreshold: this.config.execution.warning.maxRows
      })
    }
  }

  /**
   * 流式对话
   */
  async *chatStream(
    input: string,
    dbContext: DatabaseContext,
    sessionId?: string
  ): AsyncGenerator<StreamEvent, void, unknown> {

    if (!this.config.enabled || !this.config.apiKey) {
      yield {
        type: 'error',
        message: 'AI 助手未启用或未配置 API Key'
      }
      return
    }

    try {
      // 获取或创建会话
      const session = this.getOrCreateSession(sessionId, dbContext)
      this.currentSessionId = session.id

      // 先发送一个 token 表示开始处理
      yield { type: 'token', content: '' }

      // 构建消息历史
      const messages: BaseMessage[] = [
        new SystemMessage(buildSystemPrompt(dbContext)),
        ...session.messages.slice(-this.config.context.maxHistoryMessages).map(m => {
          if (m.role === 'user') {
            return new HumanMessage(m.content)
          } else if (m.role === 'assistant') {
            return new AIMessage(m.content)
          }
          return new SystemMessage(m.content)
        }),
        new HumanMessage(input)
      ]

      // 创建模型
      const model = this.createModel()

      // 绑定工具以实现函数调用
      const toolContext = this.createToolContext(dbContext)
      const tools = createAllTools(toolContext)
      const modelWithTools = model.bindTools(tools)
      // 第一轮：模型决定是否调用工具
      let response = await modelWithTools.invoke(messages)
      messages.push(response)

      // 处理工具调用（最多 3 轮）
      let rounds = 0
      while (response.tool_calls && response.tool_calls.length > 0 && rounds < 3) {
        rounds++

        for (const toolCall of response.tool_calls) {
          yield { type: 'tool_start', tool: toolCall.name ?? 'unknown' }

          try {
            const langchainTool = tools.find(t => t.name === toolCall.name)
            if (!langchainTool) {
              throw new Error('Unknown tool: ' + toolCall.name)
            }

            const result = await langchainTool.invoke(toolCall.args)

            if (toolCall.name === 'execute_query' && result?.success) {
              yield { type: 'sql_result', result }
            } else if (toolCall.name === 'get_database_schema' && result?.success) {
              yield { type: 'sql_result', result: { schema: result.schema } }
            }

            messages.push(new ToolMessage(JSON.stringify(result), toolCall.id ?? ''))

            yield { type: 'tool_end', tool: toolCall.name, result }
          } catch (err: any) {
            const errMsg = err instanceof Error ? err.message : 'Tool execution failed'
            messages.push(new ToolMessage(JSON.stringify({ error: errMsg }), toolCall.id ?? ''))
            yield { type: 'tool_end', tool: toolCall.name ?? 'unknown', result: { error: errMsg } }
          }
        }

        response = await modelWithTools.invoke(messages)
        messages.push(response)
      }

      // Extract final text content
      let content = ''
      if (typeof response.content === 'string') {
        content = response.content
      } else if (Array.isArray(response.content)) {
        content = response.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
      } else if ((response as any).text) {
        content = (response as any).text
      }

      // 流式输出响应
      if (content) {
        const chunks = content.split('')
        for (const char of chunks) {
          yield { type: 'token', content: char }
          // 小延迟模拟流式效果
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      // 发送完成事件
      yield { type: 'complete', summary: '对话完成' }

      // 更新会话历史
      session.messages.push(
        { id: `msg_${Date.now()}_user`, role: 'user', type: 'text', content: input, timestamp: Date.now() },
        { id: `msg_${Date.now()}_ai`, role: 'assistant', type: 'text', content: content, timestamp: Date.now() }
      )
      session.updatedAt = Date.now()

    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'AI 执行失败',
        code: 'AGENT_ERROR'
      }
    }
  }

  /**
   * 单轮 SQL 生成
   */
  async generateSQL(
    description: string,
    dbContext: DatabaseContext
  ): Promise<{ sql: string; explanation: string; safety: string }> {
    const prompt = `请根据以下描述生成 SQL 语句：

描述：${description}

要求：
1. 只返回 SQL 语句本身，不要包含解释
2. 使用标准 SQLite 语法
3. 添加适当的 LIMIT 限制

SQL：`

    try {
      const model = this.createModel()
      const response = await model.invoke([
        new SystemMessage(buildSystemPrompt(dbContext)),
        new HumanMessage(prompt)
      ])

      const sql = response.content.toString().trim()
      const safety = classifySQLSafety(sql)

      return {
        sql,
        explanation: `生成的 SQL 安全级别为 ${safety}`,
        safety
      }
    } catch (error) {
      throw new Error(`SQL 生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 诊断 SQL 错误
   */
  async diagnoseError(
    sql: string,
    error: string,
    dbContext: DatabaseContext
  ): Promise<{ diagnosis: string; suggestion: string; fixedSQL?: string }> {
    const prompt = `SQL 执行出错，请诊断并提供修复建议。

SQL：
${sql}

错误信息：
${error}

请提供：
1. 错误原因（简要）
2. 修复建议
3. 修复后的 SQL（如果有）`

    try {
      const model = this.createModel()
      const response = await model.invoke([
        new SystemMessage(buildSystemPrompt(dbContext)),
        new HumanMessage(prompt)
      ])

      const content = response.content.toString()
      
      // 简单解析响应
      const lines = content.split('\n')
      const diagnosis = lines.find(l => l.includes('原因') || l.includes('错误')) || '未知错误'
      const suggestion = lines.find(l => l.includes('建议') || l.includes('修复')) || '请检查 SQL 语法'
      
      // 尝试提取修复后的 SQL
      const sqlMatch = content.match(/```sql\s*([\s\S]*?)\s*```/)
      const fixedSQL = sqlMatch ? sqlMatch[1].trim() : undefined

      return {
        diagnosis,
        suggestion,
        fixedSQL
      }
    } catch (error) {
      return {
        diagnosis: '诊断失败',
        suggestion: '请检查 SQL 语法是否正确'
      }
    }
  }

  /**
   * 获取或创建会话
   */
  private getOrCreateSession(
    sessionId: string | undefined,
    dbContext: DatabaseContext
  ): ChatSession {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!
    }

    const newSession: ChatSession = {
      id: sessionId || `session_${Date.now()}`,
      title: `会话 ${this.sessions.size + 1}`,
      messages: [],
      context: dbContext,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.sessions.set(newSession.id, newSession)
    return newSession
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ChatSession | null {
    return this.sessions.get(sessionId) || null
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  /**
   * 清空所有会话
   */
  clearSessions(): void {
    this.sessions.clear()
    this.currentSessionId = null
  }

  /**
   * 获取当前会话 ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId
  }
}

/**
 * Agent 管理器（单例）
 */
class AgentManager {
  private agent: SQLAgent | null = null

  initialize(
    sqliteService: SQLiteService,
    sshService: SSHService,
    config: AIConfig
  ): SQLAgent {
    this.agent = new SQLAgent(sqliteService, sshService, config)
    return this.agent
  }

  getAgent(): SQLAgent | null {
    return this.agent
  }

  updateConfig(config: AIConfig): void {
    if (this.agent) {
      this.agent.updateConfig(config)
    }
  }
}

export const agentManager = new AgentManager()
