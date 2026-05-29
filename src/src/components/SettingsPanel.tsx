import { X, Sun, Moon, Minus, Plus, Bot, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useAppStore, type Theme } from '../stores/useAppStore'
import type { AIProvider } from '../types/ai'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { theme, setTheme, fontSize, setFontSize, aiConfig, setAIConfig } = useAppStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>('general')

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
    { value: 'dark', label: '深色模式', icon: <Moon className="w-6 h-6" />, desc: '经典暗色，护眼舒适' },
    { value: 'light', label: '浅色模式', icon: <Sun className="w-6 h-6" />, desc: '明亮清新，简约现代' },
  ]

  const fontSizeOptions = [
    { value: 12, label: '小' },
    { value: 14, label: '默认' },
    { value: 16, label: '中' },
    { value: 18, label: '大' },
  ]

  const providerOptions: { value: AIProvider; label: string }[] = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'openai-compatible', label: 'OpenAI 兼容 API' },
  ]

  const modelOptions: Record<AIProvider, string[]> = {
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    'openai-compatible': ['自定义'],
  }

  // const handleSaveAIConfig = () => {
  //   // 保存 AI 配置到后端
  //   if (window.electronAPI?.ai?.setConfig) {
  //     window.electronAPI.ai.setConfig(aiConfig)
  //   }
  // }

  const isAIValid = aiConfig.enabled && aiConfig.apiKey.length > 0 && aiConfig.model.length > 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className="relative w-[480px] max-h-[85vh] overflow-hidden bg-panel rounded-2xl flex flex-col"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-semibold text-text">设置</h2>
            <p className="text-sm text-text-muted mt-1">个性化配置</p>
          </div>
          <button
            onClick={onClose}
            className="round-btn p-2 text-text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pb-4">
          <div className="flex gap-2 p-1 neu-inset rounded-xl">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              通用
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'ai'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <Bot className="w-4 h-4" />
              AI 助手
              {isAIValid && (
                <span className="w-2 h-2 rounded-full bg-green-400" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* 主题设置 */}
              <div>
                <h3 className="text-sm font-medium text-text-dim mb-4 uppercase tracking-wider">外观</h3>
                <div className="grid grid-cols-2 gap-4">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={`relative p-4 rounded-2xl transition-all duration-300 ${
                        theme === option.value
                          ? 'neu-inset'
                          : 'neu-btn hover:scale-[1.02]'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-all ${
                        theme === option.value
                          ? 'bg-accent text-white'
                          : 'bg-panel'
                      }`}
                      style={theme === option.value ? { boxShadow: '0 2px 8px rgba(124, 106, 247, 0.4)' } : {}}>
                        {option.icon}
                      </div>
                      
                      {/* Text */}
                      <div className="text-left">
                        <div className={`font-medium ${
                          theme === option.value ? 'text-accent' : 'text-text'
                        }`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-text-muted mt-1">
                          {option.desc}
                        </div>
                      </div>
                      
                      {/* Selected indicator */}
                      {theme === option.value && (
                        <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-accent" style={{ boxShadow: '0 1px 4px rgba(124, 106, 247, 0.5)' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 字体大小设置 */}
              <div>
                <h3 className="text-sm font-medium text-text-dim mb-4 uppercase tracking-wider">字体大小</h3>
                <div className="neu-inset p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                      disabled={fontSize <= 10}
                      className="round-btn p-2 text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    
                    <div className="flex-1 flex items-center justify-center gap-4">
                      {fontSizeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFontSize(option.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            fontSize === option.value
                              ? 'bg-accent text-white'
                              : 'text-text-muted hover:bg-hover'
                          }`}
                        >
                          {option.label}
                          <span className="ml-1 text-[10px] opacity-70">({option.value}px)</span>
                        </button>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                      disabled={fontSize >= 24}
                      className="round-btn p-2 text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <span className="text-text-muted text-xs">当前字体大小: </span>
                    <span className="text-accent font-medium">{fontSize}px</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border opacity-30" />

              {/* 关于 */}
              <div>
                <h3 className="text-sm font-medium text-text-dim mb-4 uppercase tracking-wider">关于</h3>
                <div className="neu-inset p-4 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-lg">
                      R
                    </div>
                    <div>
                      <p className="font-semibold text-text">RemoteSQLite</p>
                      <p className="text-sm text-text-muted">版本 0.6.0</p>
                    </div>
                  </div>
                  <p className="text-sm text-text-muted leading-relaxed">
                    远程 SQLite 数据库管理工具，通过 SSH 连接直接操作远程数据库，无需下载文件。
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI 启用开关 */}
              <div className="neu-inset p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      aiConfig.enabled ? 'bg-accent text-white' : 'bg-panel text-text-muted'
                    }`}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-text">启用 AI 助手</p>
                      <p className="text-xs text-text-muted">智能 SQL 生成与数据分析</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setAIConfig({ enabled: !aiConfig.enabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${
                      aiConfig.enabled ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      aiConfig.enabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>

              {aiConfig.enabled && (
                <>
                  {/* Provider 配置 */}
                  <div>
                    <h3 className="text-sm font-medium text-text-dim mb-4 uppercase tracking-wider">AI 提供商</h3>
                    <div className="space-y-4">
                      {/* Provider 选择 */}
                      <div>
                        <label className="text-xs text-text-muted mb-2 block">提供商</label>
                        <div className="grid grid-cols-2 gap-2">
                          {providerOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => setAIConfig({ provider: option.value })}
                              className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                aiConfig.provider === option.value
                                  ? 'bg-accent text-white'
                                  : 'neu-btn text-text'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* API Key */}
                      <div>
                        <label className="text-xs text-text-muted mb-2 block">API Key</label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={aiConfig.apiKey}
                            onChange={(e) => setAIConfig({ apiKey: e.target.value })}
                            placeholder="sk-..."
                            className="w-full px-4 py-2.5 bg-panel neu-inset rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 pr-10"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                          API Key 将加密存储在本地
                        </p>
                      </div>

                      {/* Base URL (仅兼容 API 显示) */}
                      {aiConfig.provider === 'openai-compatible' && (
                        <div>
                          <label className="text-xs text-text-muted mb-2 block">Base URL</label>
                          <input
                            type="text"
                            value={aiConfig.baseUrl || ''}
                            onChange={(e) => setAIConfig({ baseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1"
                            className="w-full px-4 py-2.5 bg-panel neu-inset rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      )}

                      {/* Model 选择 */}
                      <div>
                        <label className="text-xs text-text-muted mb-2 block">模型</label>
                        {aiConfig.provider === 'openai' ? (
                          <div className="grid grid-cols-1 gap-2">
                            {modelOptions['openai'].map((model) => (
                              <button
                                key={model}
                                onClick={() => setAIConfig({ model })}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all text-left ${
                                  aiConfig.model === model
                                    ? 'bg-accent text-white'
                                    : 'neu-btn text-text'
                                }`}
                              >
                                {model}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={aiConfig.model}
                            onChange={(e) => setAIConfig({ model: e.target.value })}
                            placeholder="输入模型名称"
                            className="w-full px-4 py-2.5 bg-panel neu-inset rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border opacity-30" />

                  {/* 执行设置 */}
                  <div>
                    <h3 className="text-sm font-medium text-text-dim mb-4 uppercase tracking-wider">执行设置</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiConfig.execution.safe.autoExecute}
                          onChange={(e) =>
                            setAIConfig({
                              execution: {
                                ...aiConfig.execution,
                                safe: {
                                  ...aiConfig.execution.safe,
                                  autoExecute: e.target.checked,
                                },
                              },
                            })
                          }
                          className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text">自动执行 SAFE 级别查询 (SELECT)</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiConfig.execution.warning.autoExecute}
                          onChange={(e) =>
                            setAIConfig({
                              execution: {
                                ...aiConfig.execution,
                                warning: {
                                  ...aiConfig.execution.warning,
                                  autoExecute: e.target.checked,
                                },
                              },
                            })
                          }
                          className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text">自动执行 WARNING 级别查询 (INSERT/UPDATE/DELETE)</span>
                      </label>

                      <div className="flex items-center gap-3 pl-7">
                        <span className="text-sm text-text-muted">影响行数超过</span>
                        <input
                          type="number"
                          value={aiConfig.execution.warning.maxRows}
                          onChange={(e) =>
                            setAIConfig({
                              execution: {
                                ...aiConfig.execution,
                                warning: {
                                  ...aiConfig.execution.warning,
                                  maxRows: parseInt(e.target.value) || 1000,
                                },
                              },
                            })
                          }
                          className="w-20 px-2 py-1 bg-panel neu-inset rounded-lg text-sm text-text text-center"
                        />
                        <span className="text-sm text-text-muted">时要求确认</span>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiConfig.execution.dangerous.requireDoubleConfirm}
                          onChange={(e) =>
                            setAIConfig({
                              execution: {
                                ...aiConfig.execution,
                                dangerous: {
                                  ...aiConfig.execution.dangerous,
                                  requireDoubleConfirm: e.target.checked,
                                },
                              },
                            })
                          }
                          className="w-4 h-4 rounded border-border bg-panel text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-text">危险操作需要二次确认 (DROP/ALTER/无 WHERE 删除)</span>
                      </label>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border opacity-30" />

                  {/* 状态提示 */}
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    isAIValid ? 'bg-green-500/10' : 'bg-yellow-500/10'
                  }`}>
                    {isAIValid ? (
                      <>
                        <Check className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-green-500">AI 助手已就绪</p>
                          <p className="text-xs text-text-muted">可以开始使用 AI 功能</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium text-yellow-500">配置不完整</p>
                          <p className="text-xs text-text-muted">请填写 API Key 和选择模型</p>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
