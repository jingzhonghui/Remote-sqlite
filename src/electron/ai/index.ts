/**
 * AI 模块入口
 * 
 * 负责初始化 AI 功能、注册 IPC 处理器、管理 Agent 生命周期
 */

import { ipcMain, type IpcMainEvent } from 'electron'
import type { SQLiteService } from '../services/sqliteService'
import type { SSHService } from '../services/sshService'
import { SQLAgent, agentManager } from './agents/sql-agent'
import { getAIConfig, setAIConfig, isAIEnabled } from './config/provider-config'
import type { 
  AIConfig, 
  DatabaseContext, 
  StreamEvent,
  ChatSession 
} from '../../src/types/ai'

// LangChain 模块是 ESM，需要动态导入
let langchainModules: any = null

async function loadLangchainModules() {
  if (!langchainModules) {
    langchainModules = await import('langchain')
  }
  return langchainModules
}

// 活跃的流式连接
const activeStreams = new Map<string, AbortController>()

/**
 * 初始化 AI 模块
 */
export function initializeAI(
  sqliteService: SQLiteService,
  sshService: SSHService
): void {
  // 加载配置并初始化 Agent
  const config = getAIConfig()
  agentManager.initialize(sqliteService, sshService, config)
  
  console.log('AI 模块初始化完成，状态:', isAIEnabled() ? '已启用' : '未启用')
}

/**
 * 注册 IPC 处理器
 */
export function registerAIIPC(): void {
  // 获取 AI 配置
  ipcMain.handle('ai:get-config', async () => {
    return getAIConfig()
  })

  // 设置 AI 配置
  ipcMain.handle('ai:set-config', async (_, config: Partial<AIConfig>) => {
    try {
      setAIConfig(config)
      
      // 更新 Agent 配置
      const fullConfig = getAIConfig()
      agentManager.updateConfig(fullConfig)
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '配置保存失败' 
      }
    }
  })

  // 流式对话
  ipcMain.on('ai:chat-stream', async (event, params: {
    input: string
    context: DatabaseContext
    sessionId?: string
  }) => {
    const { input, context, sessionId } = params
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('[AI Debug IPC] Received chat-stream request, streamId:', streamId)

    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        console.log('[AI Debug IPC] Agent not initialized')
        event.reply('ai:stream-error', {
          streamId,
          error: 'AI Agent 未初始化'
        })
        return
      }

      const config = getAIConfig()
      console.log('[AI Debug IPC] AI enabled:', config.enabled, 'Has API key:', !!config.apiKey)
      if (!config.enabled || !config.apiKey) {
        event.reply('ai:stream-error', {
          streamId,
          error: 'AI 助手未启用或未配置 API Key'
        })
        return
      }

      // 创建中止控制器
      const abortController = new AbortController()
      activeStreams.set(streamId, abortController)

      // 发送开始事件
      console.log('[AI Debug IPC] Sending stream-start')
      event.reply('ai:stream-start', { streamId })

      // 执行流式对话
      console.log('[AI Debug IPC] Starting chatStream generator')
      const stream = agent.chatStream(input, context, sessionId)
      let chunkCount = 0

      for await (const chunk of stream) {
        chunkCount++
        console.log(`[AI Debug IPC] Chunk ${chunkCount}:`, chunk.type)

        // 检查是否已中止
        if (abortController.signal.aborted) {
          console.log('[AI Debug IPC] Stream aborted')
          break
        }

        event.reply('ai:stream-chunk', {
          streamId,
          chunk
        })

        // 如果是完成或错误事件，清理资源
        if (chunk.type === 'complete' || chunk.type === 'error') {
          console.log('[AI Debug IPC] Stream ended with type:', chunk.type)
          activeStreams.delete(streamId)
        }
      }
      console.log('[AI Debug IPC] Total chunks sent:', chunkCount)
    } catch (error) {
      console.error('[AI Debug IPC] AI 流式对话错误:', error)
      event.reply('ai:stream-error', {
        streamId,
        error: error instanceof Error ? error.message : '流式对话失败'
      })
      activeStreams.delete(streamId)
    }
  })

  // 中止流式对话
  ipcMain.on('ai:abort-stream', async (_, streamId: string) => {
    const controller = activeStreams.get(streamId)
    if (controller) {
      controller.abort()
      activeStreams.delete(streamId)
    }
  })

  // 生成 SQL
  ipcMain.handle('ai:generate-sql', async (_, params: {
    description: string
    context: DatabaseContext
  }) => {
    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        return { success: false, message: 'AI Agent 未初始化' }
      }

      const result = await agent.generateSQL(params.description, params.context)
      return { success: true, ...result }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'SQL 生成失败'
      }
    }
  })

  // 诊断 SQL 错误
  ipcMain.handle('ai:diagnose-error', async (_, params: {
    sql: string
    error: string
    context: DatabaseContext
  }) => {
    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        return { success: false, message: 'AI Agent 未初始化' }
      }

      const result = await agent.diagnoseError(params.sql, params.error, params.context)
      return { success: true, ...result }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '诊断失败'
      }
    }
  })

  // 获取会话列表
  ipcMain.handle('ai:get-sessions', async () => {
    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        return { success: true, sessions: [] }
      }

      const sessions = agent.getAllSessions()
      return { success: true, sessions }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '获取会话失败'
      }
    }
  })

  // 获取单个会话
  ipcMain.handle('ai:get-session', async (_, sessionId: string) => {
    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        return { success: false, message: 'AI Agent 未初始化' }
      }

      const session = agent.getSession(sessionId)
      return { success: true, session }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '获取会话失败'
      }
    }
  })

  // 删除会话
  ipcMain.handle('ai:delete-session', async (_, sessionId: string) => {
    try {
      const agent = agentManager.getAgent()
      if (!agent) {
        return { success: false, message: 'AI Agent 未初始化' }
      }

      const deleted = agent.deleteSession(sessionId)
      return { success: deleted }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '删除会话失败'
      }
    }
  })

  // 清空所有会话
  ipcMain.handle('ai:clear-sessions', async () => {
    try {
      const agent = agentManager.getAgent()
      if (agent) {
        agent.clearSessions()
      }
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '清空会话失败'
      }
    }
  })

  // 确认执行危险操作
  ipcMain.handle('ai:confirm-execution', async (_, params: {
    executionId: string
    sql: string
    context: DatabaseContext
  }) => {
    try {
      // 这里需要实现确认后的执行逻辑
      // 暂时返回成功
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : '执行失败'
      }
    }
  })

  console.log('AI IPC 处理器注册完成')
}

/**
 * 获取 Agent 实例
 */
export function getAgent(): SQLAgent | null {
  return agentManager.getAgent()
}

/**
 * 检查 AI 是否已启用
 */
export function checkAIEnabled(): boolean {
  return isAIEnabled()
}
