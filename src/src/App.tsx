import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import ConnectionPage from './pages/ConnectionPage'
import DatabasePage from './pages/DatabasePage'
import SqlEditorPage from './pages/SqlEditorPage'
import TableDesignerPage from './pages/TableDesignerPage'
import { useAppStore } from './stores/useAppStore'
import { DEFAULT_AI_CONFIG } from './types/ai'

type Tab = 'connection' | 'database' | 'sql' | 'designer'

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('connection')
  const theme = useAppStore((state) => state.theme)
  const fontSize = useAppStore((state) => state.fontSize)
  const initAIConfig = useAppStore((state) => state.initAIConfig)

  // 应用主题到 HTML 元素
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
  }, [theme])

  // 应用字体大小到 html 元素（rem 单位的基准）
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`
  }, [fontSize])

  // 加载 AI 配置
  useEffect(() => {
    const loadAIConfig = async () => {
      try {
        const result = await (window as any).electronAPI?.ai?.getConfig()
        if (result && result.apiKey !== undefined) {
          // 合并默认配置和加载的配置（仅初始化，不触发保存）
          initAIConfig({
            ...DEFAULT_AI_CONFIG,
            ...result,
          })
        }
      } catch (err) {
        console.log('加载 AI 配置失败:', err)
      }
    }
    loadAIConfig()
  }, [initAIConfig])

  return (
    <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
      <div className="h-full w-full" style={{ display: currentTab === 'connection' ? 'block' : 'none' }}>
        <ConnectionPage />
      </div>
      <div className="h-full w-full" style={{ display: currentTab === 'database' ? 'block' : 'none' }}>
        <DatabasePage onNavigateToDesigner={() => setCurrentTab('designer')} />
      </div>
      <div className="h-full w-full" style={{ display: currentTab === 'sql' ? 'block' : 'none' }}>
        <SqlEditorPage />
      </div>
      <div className="h-full w-full" style={{ display: currentTab === 'designer' ? 'block' : 'none' }}>
        <TableDesignerPage />
      </div>
    </Layout>
  )
}

export default App
