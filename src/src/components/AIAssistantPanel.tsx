/**
 * AI 助手面板组件
 * 
 * 右侧可折叠侧边栏式设计
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Bot, 
  Send, 
  Loader2, 
  Sparkles,
  Database,
  MessageSquare,
  Trash2,
  Plus,
  AlertCircle,
  PanelRightClose
} from 'lucide-react'
import { useAIStore } from '../stores/useAIStore'
import { useAppStore } from '../stores/useAppStore'
import type { DatabaseContext } from '../types/ai'
import { ChatMessage } from './ai/ChatMessage'
import { ConfirmationDialog } from './ai/ConfirmationDialog'

interface AIAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIAssistantPanel({ isOpen: _isOpen, onClose }: AIAssistantPanelProps) {
  const [input, setInput] = useState('')
  const [showSessions, setShowSessions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const {
    sessions,
    currentSessionId,
    messages,
    streamState,
    isGenerating,
    pendingConfirmation,
    createSession,
    switchSession,
    deleteSession,
    addUserMessage,
    addAIMessage,
    handleStreamEvent,
    setPendingConfirmation,
  } = useAIStore()
  
  const {
    activeConnectionId,
    currentDatabase,
    getActiveConnection,
  } = useAppStore()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamState.text])

  // 获取当前数据库上下文
  const getDatabaseContext = useCallback((): DatabaseContext | null => {
    const connection = getActiveConnection()
    if (!connection || !currentDatabase) return null
    
    return {
      connectionId: activeConnectionId || '',
      host: connection.host,
      port: connection.port,
      username: connection.username,
      dbPath: currentDatabase.path,
      dbName: currentDatabase.name,
      currentTable: undefined,
    }
  }, [activeConnectionId, currentDatabase, getActiveConnection])

  // 发送消息
  const handleSend = async () => {
    if (!input.trim() || isGenerating) return
    
    const context = getDatabaseContext()
    if (!context) {
      alert('请先连接数据库并打开一个数据库文件')
      return
    }
    
    const userContent = input.trim()
    setInput('')
    
    // 添加用户消息
    addUserMessage(userContent)
    
    // 创建 AI 消息占位
    const aiMessageId = addAIMessage('')
    
    // 确保有会话
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = createSession(context)
    }
    
    try {
      // 开始流式接收
      const aiAPI = (window as any).electronAPI?.ai
      if (!aiAPI) {
        throw new Error('AI API 未初始化')
      }
      
      const abortFn = aiAPI.chatStream(
        { input: userContent, context, sessionId },
        {
          onStart: () => {
            useAIStore.getState().startStreaming()
          },
          onChunk: (_streamId: string, chunk: any) => {
            handleStreamEvent(chunk)
          },
          onError: (_streamId: string, error: string) => {
            console.error('AI 流式错误:', error)
            useAIStore.getState().setStreamError(error)
          },
        }
      )
      
      // 存储中止函数
      useAIStore.setState({ abortStream: abortFn })
    } catch (error) {
      console.error('发送消息失败:', error)
      useAIStore.getState().updateMessage(aiMessageId, {
        content: '发送失败，请重试',
        type: 'error',
        isStreaming: false,
      })
    }
  }

  // 处理输入框回车
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 处理快捷操作
  const handleQuickAction = (action: string) => {
    const context = getDatabaseContext()
    if (!context) {
      alert('请先连接数据库并打开一个数据库文件')
      return
    }
    
    const prompts: Record<string, string> = {
      'schema': '请分析当前数据库的结构，列出所有表及其关系',
      'sample': '请查询每个表的前5条样本数据',
      'stats': '请统计每个表的行数和大小',
      'optimize': '请分析数据库性能，提供优化建议',
    }
    
    setInput(prompts[action] || '')
    inputRef.current?.focus()
  }

  // 创建新会话
  const handleNewSession = () => {
    const context = getDatabaseContext()
    if (context) {
      createSession(context)
    }
  }

  const hasDatabase = !!currentDatabase

  return (
    <div className="h-full w-full bg-panel flex flex-col border-l border-border"
      style={{ 
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text">AI 助手</h2>
            <p className="text-xs text-text-muted">
              {hasDatabase ? (
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  {currentDatabase?.name}
                </span>
              ) : (
                '未连接数据库'
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 会话管理按钮 */}
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="p-2 rounded-lg hover:bg-hover text-text-muted hover:text-text transition-colors"
            title="管理会话"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          
          {/* 折叠按钮 */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-hover text-text-muted hover:text-text transition-colors"
            title="折叠侧边栏"
          >
            <PanelRightClose className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 会话列表面板 */}
      {showSessions && (
        <div className="border-b border-border bg-panel/50">
          <div className="p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-text-dim">会话历史</span>
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors"
            >
              <Plus className="w-3 h-3" />
              新会话
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="px-3 py-2 text-xs text-text-muted">暂无会话</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => {
                    switchSession(session.id)
                    setShowSessions(false)
                  }}
                  className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-hover transition-colors ${
                    session.id === currentSessionId ? 'bg-accent/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{session.title}</p>
                    <p className="text-xs text-text-muted">
                      {new Date(session.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 快捷操作栏 */}
      <div className="p-3 border-b border-border">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { key: 'schema', label: '📊 分析结构', desc: '分析数据库结构' },
            { key: 'sample', label: '📝 查看样本', desc: '查看样本数据' },
            { key: 'stats', label: '📈 统计数据', desc: '统计表数据' },
            { key: 'optimize', label: '⚡ 优化建议', desc: '性能优化' },
          ].map((action) => (
            <button
              key={action.key}
              onClick={() => handleQuickAction(action.key)}
              disabled={!hasDatabase || isGenerating}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-panel neu-btn text-xs text-text hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title={action.desc}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-medium text-text mb-2">AI 数据库助手</h3>
            <p className="text-sm text-text-muted max-w-xs">
              我可以帮您：
              <br />• 生成和执行 SQL 查询
              <br />• 分析数据库结构
              <br />• 数据分析和可视化
              <br />• SQL 错误诊断
            </p>
            {!hasDatabase && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-500 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                请先连接数据库并打开一个数据库文件
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLast={index === messages.length - 1}
                streamState={index === messages.length - 1 ? streamState : undefined}
              />
            ))}
            {/* 流式状态指示器 */}
            {streamState.status === 'tool_calling' && (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在{streamState.currentTool === 'get_database_schema' ? '获取数据库结构' : 
                  streamState.currentTool === 'execute_query' ? '执行查询' : 
                  streamState.currentTool === 'analyze_data' ? '分析数据' : '处理中'}...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasDatabase ? "输入您的问题或需求..." : "请先连接数据库"}
              disabled={!hasDatabase || isGenerating}
              className="w-full px-4 py-3 pr-12 bg-panel neu-inset rounded-xl text-sm text-text placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50"
              rows={input.split('\n').length > 3 ? 4 : 2}
            />
            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || !hasDatabase || isGenerating}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>          
        <p className="mt-2 text-xs text-text-muted text-center">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>

      {/* 确认对话框 */}
      {pendingConfirmation && (
        <ConfirmationDialog
          operation={pendingConfirmation}
          onConfirm={() => {
            // TODO: 执行确认后的操作
            setPendingConfirmation(null)
          }}
          onCancel={() => setPendingConfirmation(null)}
        />
      )}
    </div>
  )
}
