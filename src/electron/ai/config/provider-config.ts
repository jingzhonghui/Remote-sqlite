/**
 * AI 配置管理模块
 * 
 * 负责 AI 配置的存储和加密管理
 * API Key 使用 Electron safeStorage 加密存储
 */

import { safeStorage } from 'electron'
import Store from 'electron-store'
import type { AIConfig } from '../../../src/types/ai'
import { DEFAULT_AI_CONFIG } from '../../../src/types/ai'

// 创建加密存储实例
const aiStore = new Store<{
  encryptedApiKey: string
  config: Omit<AIConfig, 'apiKey'>
}>({
  name: 'ai-config',
  encryptionKey: 'remote-sqlite-ai-config', // 简单的加密密钥
})

/**
 * 获取 AI 配置
 */
export function getAIConfig(): AIConfig {
  const config = aiStore.get('config') || {}
  const encryptedApiKey = aiStore.get('encryptedApiKey') || ''
  
  let apiKey = ''
  if (encryptedApiKey && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedApiKey, 'base64')
      apiKey = safeStorage.decryptString(buffer)
    } catch (e) {
      console.error('解密 API Key 失败:', e)
      apiKey = ''
    }
  }
  
  return {
    ...DEFAULT_AI_CONFIG,
    ...config,
    apiKey,
  }
}

/**
 * 设置 AI 配置
 */
export function setAIConfig(config: Partial<AIConfig>): void {
  // 如果有 API Key，加密存储
  if (config.apiKey !== undefined) {
    if (config.apiKey && safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(config.apiKey)
        aiStore.set('encryptedApiKey', encrypted.toString('base64'))
      } catch (e) {
        console.error('加密 API Key 失败:', e)
      }
    } else if (config.apiKey === '') {
      // 清空 API Key
      aiStore.set('encryptedApiKey', '')
    }
  }
  
  // 存储其他配置（不含 apiKey）
  const { apiKey, ...restConfig } = config
  const currentConfig = aiStore.get('config') || {}
  aiStore.set('config', { ...currentConfig, ...restConfig })
}

/**
 * 重置 AI 配置
 */
export function resetAIConfig(): void {
  aiStore.set('encryptedApiKey', '')
  aiStore.set('config', {})
}

/**
 * 检查 AI 是否已配置且可用
 */
export function isAIEnabled(): boolean {
  const config = getAIConfig()
  return config.enabled && config.apiKey.length > 0 && config.model.length > 0
}
