/**
 * SQL Agent 核心实现
 *
 * 基于 LangChain v1 的 createAgent ReAct Agent
 * 使用官方推荐的 agent 抽象替代手动工具调用循环
 */

import { ChatOpenAI } from '@langchain/openai'
import { createAgent } from 'langchain'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { StreamEvent as LCStreamEvent } from '@langchain/core/tracers/log_stream'
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
 *
 * 使用 LangChain 官方推荐的 createAgent 方式：
 * - 自动管理工具调用循环（无需手动编写 while 循环）
 * - 内置递归限制和错误恢复
 * - 支持真正的 LLM token 流式输出
 * - 支持中间件扩展
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
   * 创建 Agent 实例
   *
   * 使用 LangChain 官方推荐的 createAgent 替代手动工具调用循环。
   * Agent 内部自动处理：
   * - 模型推理 → 工具选择 → 工具执行 → 结果反馈 → 再次推理 的完整循环
   * - 递归限制（默认防止无限循环）
   * - 并行工具调用
   * - 错误恢复
   */
  private createAgentInstance(dbContext: DatabaseContext) {
    const toolContext = this.createToolContext(dbContext)
    const tools = createAllTools(toolContext)
    const model = this.createModel()

    return createAgent({
      model: model as any,
      tools: tools as any,
      // prompt 不传，因为我们在 streamEvents 的 messages 中已包含 SystemMessage
    })
  }

  /**
   * 构建对话消息历史
   */
  private buildMessages(input: string, session: ChatSession, dbContext: DatabaseContext): BaseMessage[] {
    return [
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
  }

  /**
   * 将 LangChain StreamEvent 映射为应用内部的 StreamEvent
   */
  private *mapLangChainEventToAppEvent(event: LCStreamEvent): Generator<StreamEvent, void, unknown> {
    // LLM token 流式输出 —— 真正的实时 token，非事后拆分
    // streamEvents v1 在 LangGraph 中可能使用 "on_llm_stream" 而非 "on_chat_model_stream"
    if (event.event === 'on_chat_model_stream' || event.event === 'on_llm_stream') {
      const chunk = event.data?.chunk as any
      if (chunk) {
        let token = ''

        // 方式1：AIMessageChunk 直接有 content 字段
        if (typeof chunk.content === 'string') {
          token = chunk.content
        } else if (chunk.content && Array.isArray(chunk.content)) {
          token = chunk.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join('')
        }
        // 方式2：原始 chunk 格式，text 字段
        if (!token && chunk.text) {
          token = chunk.text
        }
        // 方式3：消息序列化格式：message.kwargs.content
        if (!token && chunk.message?.kwargs?.content) {
          token = chunk.message.kwargs.content
        }
        // 方式4：DeepSeek 推理内容（在 additional_kwargs.reasoning_content 中）
        if (!token && chunk.message?.kwargs?.additional_kwargs?.reasoning_content) {
          token = chunk.message.kwargs.additional_kwargs.reasoning_content
        }

        if (token) {
          yield { type: 'token', content: token }
        }
      }
      return
    }

    // 工具调用开始
    if (event.event === 'on_tool_start') {
      yield {
        type: 'tool_start',
        tool: event.name,
        params: event.data?.input
      }
      return
    }

    // 工具调用结束
    if (event.event === 'on_tool_end') {
      const result = event.data?.output

      // 特殊处理：将查询结果和 schema 结果映射为 sql_result 事件，供前端展示
      if (event.name === 'execute_query' && result?.success) {
        yield { type: 'sql_result', result }
      } else if (event.name === 'get_database_schema' && result?.success) {
        yield { type: 'sql_result', result: { success: true, schema: result.schema } }
      }

      yield {
        type: 'tool_end',
        tool: event.name,
        result
      }
      return
    }

    // Agent/Chain 执行出错
    if (event.event === 'on_chain_end' && event.data?.error) {
      yield {
        type: 'error',
        message: String(event.data.error),
        code: 'AGENT_ERROR'
      }
      return
    }
  }

  /**
   * 流式对话
   *
   * 使用 createAgent + streamEvents 实现真正的流式输出：
   * - LLM token 实时流式传输（不再是事后逐字符拆分）
   * - 工具调用事件实时推送
   * - Agent 内部自动管理工具调用循环
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
      // 发送开始标记
      yield { type: 'token', content: '' }

      // 创建 Agent（内部自动绑定工具）
      const agent = this.createAgentInstance(dbContext)

      // 构建消息历史
      const messages = this.buildMessages(input, session, dbContext)

      // 使用 streamEvents 获取真正的流式事件
      let stream: any
      try {
        stream = agent.streamEvents(
          { messages },
          { version: 'v1' }
        )
      } catch (e) {
        yield { type: 'error', message: 'streamEvents 调用失败: ' + (e instanceof Error ? e.message : String(e)), code: 'STREAM_ERROR' }
        return
      }

      let fullContent = ''

      try {
        for await (const event of stream) {
          const appEvents = Array.from(this.mapLangChainEventToAppEvent(event as LCStreamEvent))

          for (const appEvent of appEvents) {
            if (appEvent.type === 'token') {
              fullContent += appEvent.content
            }
            yield appEvent
          }
        }
      } catch (loopErr) {
        yield { type: 'error', message: '流读取失败: ' + (loopErr instanceof Error ? loopErr.message : String(loopErr)), code: 'LOOP_ERROR' }
        return
      }

      // 发送完成事件
      yield { type: 'complete', summary: '对话完成' }

      // 更新会话历史
      session.messages.push(
        { id: `msg_${Date.now()}_user`, role: 'user', type: 'text', content: input, timestamp: Date.now() },
        { id: `msg_${Date.now()}_ai`, role: 'assistant', type: 'text', content: fullContent, timestamp: Date.now() }
      )
      session.updatedAt = Date.now()

    } catch (error) {
      console.error('[DEBUG chatStream] ERROR:', error)
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : 'AI 执行失败',
        code: 'AGENT_ERROR'
      }
    }
  }

  /**
   * 单轮 SQL 生成
   *
   * 纯 LLM 调用，无需工具，保持简单直接
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
   *
   * 纯 LLM 调用，无需工具
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
