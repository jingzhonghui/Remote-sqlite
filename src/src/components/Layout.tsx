import { useState } from 'react'
import { Database, Link2, FileCode, Table2, Settings } from 'lucide-react'
import SettingsPanel from './SettingsPanel'

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

export default function Layout({ children, currentTab, onTabChange }: LayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="flex h-screen bg-bg text-text">
        {/* Sidebar */}
        <aside className="w-16 flex flex-col py-4 px-2" style={{ backgroundColor: 'var(--sidebar)' }}>
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

          {/* Settings */}
          <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
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

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-4">
          <div className="h-full neu-card p-4">
            {children}
          </div>
        </main>
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
