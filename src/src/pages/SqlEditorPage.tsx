import { useState, useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { 
  Play, Save, Clock, History, ChevronRight, Table2, 
  CheckCircle, XCircle, Trash2, Database, AlertTriangle
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Splitter } from '../components/ResizablePanel'

const MIN_EDITOR_FONT_SIZE = 8
const MAX_EDITOR_FONT_SIZE = 32

export default function SqlEditorPage() {
  const { 
    sqlHistory, 
    savedQueries, 
    addSqlHistory, 
    saveQuery, 
    removeSavedQuery,
    getActiveConnection,
    currentDatabase,
    theme,
    fontSize,
    setFontSize,
  } = useAppStore()
  
  const activeConnection = getActiveConnection()
  const [sql, setSql] = useState('SELECT * FROM sqlite_master LIMIT 10;')
  const [result, setResult] = useState<{ columns: string[]; rows: any[]; executionTime: number; rowCount?: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSidebar, setActiveSidebar] = useState<'history' | 'saved'>('history')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [queryName, setQueryName] = useState('')
  const [editorLoaded, setEditorLoaded] = useState(false)
  const [editorLoadError, setEditorLoadError] = useState(false)
  const [editorFontSize, setEditorFontSize] = useState(fontSize)
  const editorRef = useRef<any>(null)

  // Monaco Editor 加载超时检测
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!editorLoaded && !editorLoadError) {
        console.warn('Monaco Editor 加载超时，切换到降级模式')
        setEditorLoadError(true)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [editorLoaded, editorLoadError])

  // Ctrl+= 放大 / Ctrl+- 缩小 编辑器字体
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        const newSize = Math.min(MAX_EDITOR_FONT_SIZE, editorFontSize + 1)
        if (newSize !== editorFontSize) {
          setEditorFontSize(newSize)
          setFontSize(newSize)
          if (editorRef.current) editorRef.current.updateOptions({ fontSize: newSize })
        }
      } else if (e.key === '-') {
        e.preventDefault()
        const newSize = Math.max(MIN_EDITOR_FONT_SIZE, editorFontSize - 1)
        if (newSize !== editorFontSize) {
          setEditorFontSize(newSize)
          setFontSize(newSize)
          if (editorRef.current) editorRef.current.updateOptions({ fontSize: newSize })
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editorFontSize, setFontSize])

  const handleExecute = async () => {
    if (!activeConnection || !currentDatabase || !sql.trim()) return
    
    setLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      // 真正执行 SQL
      const execResult = await window.electronAPI.sqlite.query(
        activeConnection.id, 
        currentDatabase.path, 
        sql.trim()
      )
      
      if (execResult.success) {
        setResult({
          columns: execResult.columns,
          rows: execResult.rows,
          executionTime: Date.now() - startTime,
          rowCount: execResult.rows.length,
        })
      } else {
        throw new Error(execResult.message || 'SQL 执行失败')
      }

      addSqlHistory({
        id: `hist_${Date.now()}`,
        sql: sql.trim(),
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        success: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行失败')
      setResult(null)
      addSqlHistory({
        id: `hist_${Date.now()}`,
        sql: sql.trim(),
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        success: false,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuery = () => {
    if (queryName.trim()) {
      saveQuery(queryName.trim(), sql)
      setShowSaveDialog(false)
      setQueryName('')
    }
  }

  const loadQuery = (savedSql: string) => {
    setSql(savedSql)
  }

  const formatSql = () => {
    // 简单的 SQL 格式化
    const formatted = sql
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\(\s*/g, ' (')
      .replace(/\s*\)\s*/g, ') ')
      .replace(/\s*;\s*/g, ';')
      .trim()
    setSql(formatted)
  }

  if (!activeConnection || !currentDatabase) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <Database className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">
          {!activeConnection ? '未连接到任何服务器' : '请先打开一个数据库'}
        </p>
        <p className="text-xs mt-2">
          {!activeConnection ? '请先前往"连接管理"页面建立连接' : '请在数据选项卡中打开数据库'}
        </p>
      </div>
    )
  }

  return (
    <>
    <Splitter direction="horizontal" defaultSize={224} minSize={150}>
      {/* Left Sidebar */}
      <aside className="h-full bg-sidebar border-r border-border flex flex-col">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveSidebar('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs ${
              activeSidebar === 'history' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            历史记录
          </button>
          <button
            onClick={() => setActiveSidebar('saved')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs ${
              activeSidebar === 'saved' ? 'text-accent border-b-2 border-accent' : 'text-text-muted'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            已保存
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {activeSidebar === 'history' ? (
            <div className="space-y-1">
              {sqlHistory.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">暂无历史记录</p>
              ) : (
                sqlHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadQuery(item.sql)}
                    className="w-full text-left p-2 rounded hover:bg-hover group"
                  >
                    <div className="flex items-start gap-2">
                      {item.success ? (
                        <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-dim truncate">{item.sql.slice(0, 50)}...</p>
                        <p className="text-[10px] text-text-muted mt-1">
                          {item.executionTime}ms · {item.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {savedQueries.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">暂无保存的查询</p>
              ) : (
                savedQueries.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-2 p-2 rounded hover:bg-hover group"
                  >
                    <button
                      onClick={() => loadQuery(item.sql)}
                      className="flex-1 text-left"
                    >
                      <p className="text-xs text-text-dim truncate">{item.name}</p>
                    </button>
                    <button
                      onClick={() => removeSavedQuery(item.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-hover rounded"
                    >
                      <Trash2 className="w-3 h-3 text-error" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>
      
      {/* Main Content with vertical splitter for editor/result */}
      <Splitter direction="vertical" defaultSize={300} minSize={100}>
        {/* Editor Panel */}
        <div className="flex flex-col h-full rounded-xl overflow-hidden">
          {/* Toolbar */}
          <div className="h-10 bg-toolbar-bg border-b border-border flex items-center justify-between px-3 flex-shrink-0 rounded-t-xl">
            <div className="flex items-center gap-2">
              <button
                onClick={handleExecute}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                执行 (Ctrl+Enter)
              </button>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn hover:scale-[1.02]"
              >
                <Save className="w-3.5 h-3.5" />
                保存
              </button>
              <button
                onClick={formatSql}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn hover:scale-[1.02]"
              >
                格式化
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span>{currentDatabase.name}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-accent">{sql.trim().split(/\s+/)[0]}</span>
              <span className="ml-2 px-1.5 py-0.5 bg-panel rounded text-[10px] text-text-dim" title="Ctrl+= 放大 / Ctrl+- 缩小">
                字号: {editorFontSize}px
              </span>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0">
            {editorLoadError ? (
              // 降级方案：当 Monaco Editor 加载失败时使用 textarea
              <div className="h-full flex flex-col">
                <div className="bg-warning/10 border-b border-warning/20 px-3 py-1.5 flex items-center gap-2 text-xs text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>代码编辑器加载失败，已切换到兼容模式</span>
                </div>
                <textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  className="flex-1 w-full bg-panel text-text p-4 font-mono resize-none focus:outline-none"
                  style={{ 
                    lineHeight: '1.5',
                    tabSize: 2,
                    fontSize: `${editorFontSize}px`,
                  }}
                  spellCheck={false}
                  placeholder="在此输入 SQL 语句..."
                />
              </div>
            ) : (
              <Editor
                height="100%"
                defaultLanguage="sql"
                value={sql}
                onChange={(value) => setSql(value || '')}
                onMount={(editor) => { 
                  editorRef.current = editor 
                  setEditorLoaded(true)
                  setEditorLoadError(false)
                }}
                loading={
                  <div className="h-full flex items-center justify-center text-text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      <span className="text-xs">正在加载编辑器...</span>
                    </div>
                  </div>
                }
                options={{
                  minimap: { enabled: false },
                  fontSize: editorFontSize,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  automaticLayout: true,
                  theme: theme === 'dark' ? 'vs-dark' : 'vs',
                  padding: { top: 8 },
                }}
              />
            )}
          </div>
        </div>
        
        {/* Result Panel */}
        <div className="h-full border-t border-border flex flex-col bg-panel">
          <div className="h-8 flex items-center px-3 border-b border-border bg-toolbar-bg flex-shrink-0">
            <span className="text-xs font-medium">查询结果</span>
            {result && (
              <span className="text-xs text-text-muted ml-4">
                {result.rowCount ?? result.rows.length} 行 · {result.executionTime}ms
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="p-4 text-error text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            ) : result ? (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col} className="whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr key={idx}>
                      {result.columns.map((col) => (
                        <td key={col} className="whitespace-nowrap">
                          {row[col] === null ? (
                            <span className="text-text-muted italic">NULL</span>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <Table2 className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">执行 SQL 查看结果</p>
              </div>
            )}
          </div>
        </div>
      </Splitter>
    </Splitter>

    {/* Save Dialog */}
    {showSaveDialog && (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-panel rounded-xl w-80" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium">保存查询</h2>
          </div>
          <div className="p-4">
            <label className="block text-xs text-text-muted mb-1">查询名称</label>
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="例如: 活跃用户查询"
              className="w-full"
              autoFocus
            />
          </div>
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 text-xs font-medium transition-all neu-btn"
            >
              取消
            </button>
            <button
              onClick={handleSaveQuery}
              disabled={!queryName.trim()}
              className="px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
