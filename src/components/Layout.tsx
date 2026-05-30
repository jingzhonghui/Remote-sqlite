import { useState, useRef, useCallback, useEffect } from 'react'
import { Database, Link2, FileCode, Table2, Settings, Bot } from 'lucide-react'
import SettingsPanel from './SettingsPanel'
import AIAssistantPanel from './AIAssistantPanel'
import { useAIStore } from '../stores/useAIStore'
import { useAppStore } from '../stores/useAppStore'

interface LayoutProps {
  children: React.ReactNode
  currentTab: string
  onTabChange: (tab: any) => void
}

const navItems = [
  { key: 'connection', path: '/', icon: Link2, label: '连接管理' },
  { key: 'database', path: '/database', icon: Database, label: '数据浏览' },
  { key: 'sql', path: '/sql', icon: FileCode, label: 'SQL 编辑器' },
  { key: 'designer', path: '/designer', icon: Table2, label: '可视化建表' },
]

// 默认宽度和限制
const DEFAULT_AI_WIDTH = 480
const MIN_AI_WIDTH = 320
const MAX_AI_WIDTH = 800

export default function Layout({ children, currentTab, onTabChange }: LayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isPanelOpen, setPanelOpen } = useAIStore()
  const aiEnabled = useAppStore((state) => state.aiConfig.enabled)
  const [aiWidth, setAiWidth] = useState(DEFAULT_AI_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // 处理拖动开始
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  // 处理拖动
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      if (newWidth >= MIN_AI_WIDTH && newWidth <= MAX_AI_WIDTH) {
        setAiWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return (
    <>
      <div className="flex h-screen bg-bg text-text overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-16 flex flex-col py-4 px-2 flex-shrink-0" style={{ backgroundColor: 'var(--sidebar)' }}>
          {/* Logo */}
          <div className="mb-4 flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--panel)', boxShadow: 'var(--neu-shadow-sm)' }}>
              <Database className="w-6 h-6" style={{ color: 'var(--accent)' }} />
            </div>
          </div>
          
          {/* Nav Items */}
          <nav className="flex-1 space-y-3">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                className={`w-full flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                  currentTab === item.key
                    ? 'neu-inset text-accent' 
                    : 'round-btn text-text-muted hover:text-text'
                }`}
                title={item.label}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] mt-1.5 font-medium">{item.label.slice(0, 2)}</span>
              </button>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            {/* AI 助手按钮 - 放在设置按钮上方 */}
            <button
              onClick={() => aiEnabled && setPanelOpen(!isPanelOpen)}
              disabled={!aiEnabled}
              className={`w-full flex flex-col items-center justify-center py-3 rounded-xl transition-all duration-200 ${
                !aiEnabled
                  ? 'opacity-40 cursor-not-allowed'
                  : isPanelOpen
                    ? 'bg-accent/15 text-accent cursor-pointer'
                    : 'text-text-muted hover:bg-hover hover:text-accent cursor-pointer'
              }`}
              title={!aiEnabled ? '请先在设置中启用 AI 助手' : isPanelOpen ? '收起 AI 助手' : '展开 AI 助手'}
            >
              <Bot className="w-5 h-5" />
              <span className="text-[10px] mt-1.5 font-medium">
                {isPanelOpen ? '收起' : 'AI助手'}
              </span>
            </button>
            
            {/* 设置按钮 */}
            <button 
              onClick={() => setSettingsOpen(true)}
              className="w-full flex flex-col items-center justify-center py-3 rounded-xl round-btn text-text-muted hover:text-text"
              title="设置"
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1.5 font-medium">设置</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <main className={`flex-1 overflow-hidden p-1.5 transition-all duration-300`}>
            <div className="h-full neu-card p-1">
              {children}
            </div>
          </main>

          {/* AI Assistant Sidebar - 右侧可折叠 */}
          <div 
            className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden relative ${
              isPanelOpen ? 'opacity-100' : 'w-0 opacity-0'
            }`}
            style={{ width: isPanelOpen ? aiWidth : 0 }}
          >
            <AIAssistantPanel isOpen={isPanelOpen} onClose={() => setPanelOpen(false)} />
            
            {/* 拖动调整宽度的手柄 */}
            {isPanelOpen && (
              <div
                ref={resizeRef}
                onMouseDown={handleResizeStart}
                className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors ${
                  isResizing ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
                style={{
                  backgroundColor: isResizing ? 'var(--accent)' : 'transparent',
                }}
                title="拖动调整宽度"
              />
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
