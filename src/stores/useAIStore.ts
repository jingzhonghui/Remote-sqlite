/**
 * AI 助手状态管理
 * 
 * 管理 AI 对话状态、流式输出、会话历史
 */

import { create } from 'zustand'
import type { 
  ChatMessage, 
  ChatSession, 
  DatabaseContext, 
  StreamEvent,
  DangerousOperation 
} from '../types/ai'

interface StreamState {
  status: 'idle' | 'streaming' | 'tool_calling' | 'error'
  text: string
  currentTool?: string
  isTyping: boolean
}

interface AIState {
  // 会话状态
  sessions: ChatSession[]
  currentSessionId: string | null
  messages: ChatMessage[]
  
  // 流式状态
  streamState: StreamState
  
  // UI 状态
  isPanelOpen: boolean
  isGenerating: boolean
  pendingConfirmation: DangerousOperation | null
  abortStream?: () => void
  
  // Actions - 会话管理
  loadSessionsFromMain: () => Promise<void>
  createSession: (context: DatabaseContext) => string
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  clearAllSessions: () => void
  
  // Actions - 消息管理
  addUserMessage: (content: string) => void
  addAIMessage: (content: string) => string
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void
  clearMessages: () => void
  
  // Actions - 流式状态
  startStreaming: () => void
  appendStreamText: (text: string) => void
  setToolCalling: (toolName: string) => void
  endToolCalling: () => void
  endStreaming: () => void
  setStreamError: (error: string) => void
  resetStreamState: () => void
  
  // Actions - UI 状态
  setPanelOpen: (open: boolean) => void
  setPendingConfirmation: (operation: DangerousOperation | null) => void
  
  // Actions - 处理流式事件
  handleStreamEvent: (event: StreamEvent) => void
}

export const useAIStore = create<AIState>()((set, get) => ({
  // 初始状态
  sessions: [],
  currentSessionId: null,
  messages: [],
  streamState: {
    status: 'idle',
    text: '',
    isTyping: false,
  },
  isPanelOpen: false,
  isGenerating: false,
  pendingConfirmation: null,

  // Actions - 会话管理
  loadSessionsFromMain: async () => {
    try {
      const result = await (window as any).electronAPI?.ai?.getSessions()
      if (result?.success && result.sessions) {
        const loadedSessions = result.sessions
        const state = get()

        set({ sessions: loadedSessions })

        // 如果当前会话 ID 在加载的会话中，同步恢复消息
        if (state.currentSessionId) {
          const currentSession = loadedSessions.find((s: any) => s.id === state.currentSessionId)
          if (currentSession) {
            set({ messages: currentSession.messages || [] })
          }
        }
      }
    } catch (error) {
      console.error('从主进程加载会话失败:', error)
    }
  },

  createSession: (context) => {
    const newSession: ChatSession = {
      id: `session_${Date.now()}`,
      title: `会话 ${get().sessions.length + 1}`,
      messages: [],
      context,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    set((state) => ({
      sessions: [...state.sessions, newSession],
      currentSessionId: newSession.id,
      messages: [],
    }))

    // 同步到主进程以便持久化
    ;(window as any).electronAPI?.ai?.syncSession(newSession)

    return newSession.id
  },

  switchSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (session) {
      set({
        currentSessionId: sessionId,
        messages: session.messages,
      })
    }
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const newSessions = state.sessions.filter((s) => s.id !== sessionId)
      const newCurrentId =
        state.currentSessionId === sessionId
          ? newSessions[newSessions.length - 1]?.id || null
          : state.currentSessionId
      
      // 同步删除到主进程
      ;(window as any).electronAPI?.ai?.deleteSession(sessionId)

      return {
        sessions: newSessions,
        currentSessionId: newCurrentId,
        messages: newCurrentId
          ? newSessions.find((s) => s.id === newCurrentId)?.messages || []
          : [],
      }
    })
  },

  clearAllSessions: () => {
    set({
      sessions: [],
      currentSessionId: null,
      messages: [],
    })
  },

  // Actions - 消息管理
  addUserMessage: (content) => {
    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      type: 'text',
      content,
      timestamp: Date.now(),
    }
    
    set((state) => {
      const newMessages = [...state.messages, newMessage]
      // 更新当前会话的消息
      if (state.currentSessionId) {
        const session = state.sessions.find((s) => s.id === state.currentSessionId)
        if (session) {
          session.messages = newMessages
          session.updatedAt = Date.now()
        }
      }
      return { messages: newMessages }
    })
  },

  addAIMessage: (content) => {
    const messageId = `msg_${Date.now()}_ai`
    const newMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      type: 'text',
      content,
      isStreaming: true,
      timestamp: Date.now(),
    }
    
    set((state) => {
      const newMessages = [...state.messages, newMessage]
      if (state.currentSessionId) {
        const session = state.sessions.find((s) => s.id === state.currentSessionId)
        if (session) {
          session.messages = newMessages
          session.updatedAt = Date.now()
        }
      }
      return { messages: newMessages }
    })
    
    return messageId
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      const newMessages = state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      )
      if (state.currentSessionId) {
        const session = state.sessions.find((s) => s.id === state.currentSessionId)
        if (session) {
          session.messages = newMessages
        }
      }
      return { messages: newMessages }
    })
  },

  clearMessages: () => {
    set({ messages: [] })
  },

  // Actions - 流式状态
  startStreaming: () => {
    set({
      streamState: {
        status: 'streaming',
        text: '',
        isTyping: true,
      },
      isGenerating: true,
    })
  },

  appendStreamText: (text) => {
    set((state) => ({
      streamState: {
        ...state.streamState,
        text: state.streamState.text + text,
      },
    }))
  },

  setToolCalling: (toolName) => {
    set((state) => ({
      streamState: {
        ...state.streamState,
        status: 'tool_calling',
        currentTool: toolName,
      },
    }))
  },

  endToolCalling: () => {
    set((state) => ({
      streamState: {
        ...state.streamState,
        status: 'streaming',
        currentTool: undefined,
      },
    }))
  },

  endStreaming: () => {
    set((state) => ({
      streamState: {
        ...state.streamState,
        status: 'idle',
        isTyping: false,
      },
      isGenerating: false,
    }))
  },

  setStreamError: (error) => {
    set((state) => ({
      streamState: {
        ...state.streamState,
        status: 'error',
        text: error,
        isTyping: false,
      },
      isGenerating: false,
    }))
  },

  resetStreamState: () => {
    set({
      streamState: {
        status: 'idle',
        text: '',
        isTyping: false,
      },
    })
  },

  // Actions - UI 状态
  setPanelOpen: (open) => {
    set({ isPanelOpen: open })
  },

  setPendingConfirmation: (operation) => {
    set({ pendingConfirmation: operation })
  },

  // Actions - 处理流式事件
  handleStreamEvent: (event) => {
    switch (event.type) {
      case 'token': {
        // 每次操作后必须用 get() 重新获取最新状态，避免闭包陷阱
        // 如果还在 idle 状态，自动开始 streaming
        if (get().streamState.status === 'idle') {
          get().startStreaming()
        }

        const state = get()
        if (state.streamState.status === 'streaming' || state.streamState.status === 'tool_calling') {
          get().appendStreamText(event.content)

          const latestState = get()
          const currentLastMessage = latestState.messages[latestState.messages.length - 1]
          if (currentLastMessage?.role === 'assistant') {
            get().updateMessage(currentLastMessage.id, {
              content: latestState.streamState.text,
            })
          }
        }
        break
      }
        
      case 'tool_start':
        get().setToolCalling(event.tool)
        break
        
      case 'tool_end':
        get().endToolCalling()
        break
        
      case 'sql_generated': {
        const msg1 = get().messages[get().messages.length - 1]
        if (msg1?.role === 'assistant') {
          get().updateMessage(msg1.id, { type: 'sql', sql: event.sql })
        }
        break
      }

      case 'sql_result': {
        const msg2 = get().messages[get().messages.length - 1]
        if (msg2?.role === 'assistant') {
          get().updateMessage(msg2.id, { result: event.result })
        }
        break
      }

      case 'analysis': {
        const msg3 = get().messages[get().messages.length - 1]
        if (msg3?.role === 'assistant') {
          get().updateMessage(msg3.id, { type: 'analysis', analysis: event.data })
        }
        break
      }

      case 'confirmation_required':
        get().setPendingConfirmation(event.operation)
        break

      case 'complete':
        get().endStreaming()
        {
          const msg4 = get().messages[get().messages.length - 1]
          if (msg4?.role === 'assistant') {
            get().updateMessage(msg4.id, { isStreaming: false })
          }
          // 同步最新会话数据到主进程进行持久化
          const stateAfterComplete = get()
          if (stateAfterComplete.currentSessionId) {
            const session = stateAfterComplete.sessions.find(
              (s) => s.id === stateAfterComplete.currentSessionId
            )
            if (session) {
              ;(window as any).electronAPI?.ai?.syncSession(session)
            }
          }
        }
        break

      case 'error':
        get().setStreamError(event.message)
        {
          const msg5 = get().messages[get().messages.length - 1]
          if (msg5?.role === 'assistant') {
            get().updateMessage(msg5.id, {
              type: 'error',
              content: event.message,
              isStreaming: false,
            })
          }
        }
        break
    }
  },
}))
