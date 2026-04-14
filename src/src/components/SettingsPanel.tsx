import { X, Sun, Moon, Minus, Plus } from 'lucide-react'
import { useAppStore, type Theme } from '../stores/useAppStore'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { theme, setTheme, fontSize, setFontSize } = useAppStore()

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative neu-card w-[420px] max-h-[85vh] overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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

        {/* Content */}
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
                      ? 'bg-accent text-white shadow-lg'
                      : 'bg-panel'
                  }`}>
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
                    <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-accent shadow-lg" />
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
                  <p className="text-sm text-text-muted">版本 1.0.0</p>
                </div>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">
                远程 SQLite 数据库管理工具，通过 SSH 连接直接操作远程数据库，无需下载文件。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
