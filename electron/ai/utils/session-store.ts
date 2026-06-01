/**
 * 会话持久化存储模块
 *
 * 使用 electron-store 将 AI 对话会话保存到本地磁盘，
 * 确保应用重启后会话可恢复。
 * 会话数据不包含敏感信息（API Key 等），因此不做加密存储。
 */

import Store from 'electron-store'
import type { ChatSession } from '../../../src/types/ai'

/** 存储文件名 */
const STORE_NAME = 'ai-sessions'

/** 最大保留会话数（防止存储文件无限增长） */
const MAX_SESSIONS = 50

/** 存储结构 */
interface StoredData {
  sessions: ChatSession[]
}

const store = new Store<StoredData>({
  name: STORE_NAME,
  encryptionKey: 'remote-sqlite-ai-sessions-v1',
})

/**
 * 从磁盘加载所有会话
 */
export function loadSessions(): Map<string, ChatSession> {
  try {
    const sessions = store.get('sessions', [])
    const map = new Map<string, ChatSession>()
    for (const s of sessions) {
      map.set(s.id, s)
    }
    return map
  } catch (error) {
    console.error('加载会话失败:', error)
    return new Map()
  }
}

/**
 * 将会话列表保存到磁盘
 *
 * @param sessions - 当前内存中的所有会话
 * @param maxSessions - 可选，覆盖最大保留数
 */
export function saveSessions(
  sessions: Map<string, ChatSession>,
  maxSessions: number = MAX_SESSIONS
): void {
  try {
    const sessionArray = Array.from(sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxSessions)

    store.set('sessions', sessionArray)
  } catch (error) {
    console.error('保存会话失败:', error)
  }
}

/**
 * 清空磁盘上的所有会话
 */
export function clearStoredSessions(): void {
  try {
    store.set('sessions', [])
  } catch (error) {
    console.error('清空存储的会话失败:', error)
  }
}