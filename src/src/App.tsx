import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import ConnectionPage from './pages/ConnectionPage'
import DatabasePage from './pages/DatabasePage'
import SqlEditorPage from './pages/SqlEditorPage'
import TableDesignerPage from './pages/TableDesignerPage'
import { useAppStore } from './stores/useAppStore'

type Tab = 'connection' | 'database' | 'sql' | 'designer'

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('connection')
  const theme = useAppStore((state) => state.theme)
  const fontSize = useAppStore((state) => state.fontSize)

  // 应用主题到 HTML 元素
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
  }, [theme])

  // 应用字体大小
  useEffect(() => {
    document.body.style.fontSize = `${fontSize}px`
  }, [fontSize])

  return (
    <Layout currentTab={currentTab} onTabChange={setCurrentTab}>
      <div className="h-full w-full" style={{ display: currentTab === 'connection' ? 'block' : 'none' }}>
        <ConnectionPage />
      </div>
      <div className="h-full w-full" style={{ display: currentTab === 'database' ? 'block' : 'none' }}>
        <DatabasePage />
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
