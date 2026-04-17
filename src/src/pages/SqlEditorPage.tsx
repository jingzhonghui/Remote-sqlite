import { useState, useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { 
  Play, Save, Clock, History, ChevronRight, Table2, 
  CheckCircle, XCircle, Trash2, Database, AlertTriangle, Copy, Check
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Splitter } from '../components/ResizablePanel'
import { Tooltip } from '../components/Tooltip'

type SortDirection = 'asc' | 'desc' | null

// SQL 关键字列表
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
  'TABLE', 'INDEX', 'VIEW', 'TRIGGER', 'ALTER', 'ADD', 'COLUMN', 'VALUES',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'EXISTS',
  'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'GROUP', 'HAVING',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'ON',
  'AS', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT', 'WITH',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'WHILE', 'FOR',
  'PRAGMA', 'ATTACH', 'DETACH', 'VACUUM', 'ANALYZE', 'REINDEX',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'SAVEPOINT', 'RELEASE'
]

// SQLite 函数列表
const SQLITE_FUNCTIONS = [
  'ABS', 'AVG', 'COUNT', 'MAX', 'MIN', 'SUM', 'TOTAL',
  'LENGTH', 'LOWER', 'UPPER', 'SUBSTR', 'TRIM', 'REPLACE',
  'ROUND', 'RANDOM', 'COALESCE', 'IFNULL', 'NULLIF',
  'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
  'CHANGES', 'LAST_INSERT_ROWID', 'SQLITE_VERSION',
  'GLOB', 'LIKE', 'INSTR', 'PRINTF', 'QUOTE',
  'HEX', 'UNICODE', 'SOUNDEX'
]

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
  const monacoRef = useRef<typeof monaco | null>(null)

  // 查询结果表格相关状态
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  
  // 数据库 schema 缓存，用于智能提示
  const [dbSchema, setDbSchema] = useState<{
    tables: string[]
    columns: Record<string, string[]>
  }>({ tables: [], columns: {} })
  // 使用 ref 保存最新 schema，确保 Monaco 提示回调能获取最新数据
  const dbSchemaRef = useRef(dbSchema)
  useEffect(() => {
    dbSchemaRef.current = dbSchema
  }, [dbSchema])

  // 加载数据库 schema（表名和列名）用于智能提示
  const loadDatabaseSchema = useCallback(async () => {
    if (!activeConnection || !currentDatabase) return
    try {
      // 获取所有表名
      const tablesResult = await window.electronAPI.sqlite.getTables(activeConnection.id, currentDatabase.path)
      if (!tablesResult.success) return
      
      const tables = tablesResult.tables
      const columns: Record<string, string[]> = {}
      
      // 获取每个表的列信息
      for (const tableName of tables.slice(0, 20)) { // 限制前20个表避免过多请求
        try {
          const infoResult = await window.electronAPI.sqlite.getTableInfo(activeConnection.id, currentDatabase.path, tableName)
          if (infoResult.success) {
            columns[tableName] = infoResult.columns.map((c: any) => c.name)
          }
        } catch (e) {
          console.warn(`获取表 ${tableName} 列信息失败:`, e)
        }
      }
      
      setDbSchema({ tables, columns })
    } catch (e) {
      console.error('加载数据库 schema 失败:', e)
    }
  }, [activeConnection, currentDatabase])

  // 当数据库变化时重新加载 schema
  useEffect(() => {
    if (activeConnection && currentDatabase) {
      loadDatabaseSchema()
    }
  }, [activeConnection, currentDatabase, loadDatabaseSchema])

  // Monaco Editor 加载超时检测
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!editorLoaded && !editorLoadError) {
        console.warn('Monaco Editor 加载超时，切换到降级模式')
        setEditorLoadError(true)
      }
    }, 15000) // 增加超时时间到 15 秒
    return () => clearTimeout(timer)
  }, [editorLoaded, editorLoadError])

  // 设置 SQL 智能提示
  const setupSqlCompletion = useCallback((monacoInstance: typeof monaco) => {
    // 注册 SQL 自动完成提供程序
    const disposable = monacoInstance.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', ' ', '('],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        // 获取当前行内容以判断上下文
        const lineContent = model.getLineContent(position.lineNumber)
        const textBeforeCursor = lineContent.substring(0, position.column - 1).toUpperCase()

        const suggestions: monaco.languages.CompletionItem[] = []
        
        // 使用 ref 获取最新的 schema 数据
        const currentSchema = dbSchemaRef.current

        // 检测是否在表名上下文中（FROM, JOIN, INTO, UPDATE, TABLE, DROP, ALTER等）
        const isTableContext = /\b(FROM|JOIN|INTO|UPDATE|TABLE|DROP|ALTER|DELETE\s+FROM|INSERT\s+INTO)\b/i.test(textBeforeCursor)

        // 检测是否在列名上下文中（SELECT, WHERE, SET, ORDER, GROUP, BY, AND, OR, HAVING等）
        const isColumnContext = /\b(SELECT|WHERE|SET|ORDER|GROUP|BY|AND|OR|HAVING|ON|SET|VALUES)\b/i.test(textBeforeCursor)

        // 1. 表名提示 - 在表名上下文中优先提示
        if (isTableContext && currentSchema.tables.length > 0) {
          currentSchema.tables.forEach(tableName => {
            suggestions.push({
              label: tableName,
              kind: monacoInstance.languages.CompletionItemKind.Class,
              insertText: tableName,
              detail: '数据库表',
              sortText: '0', // 表名上下文中优先排序
              range
            })
          })
        }

        // 2. 列名提示 - 在列名上下文中提示
        if (isColumnContext) {
          // 收集所有列名
          const allColumns = new Set<string>()
          Object.values(currentSchema.columns).forEach(cols => {
            cols.forEach(col => allColumns.add(col))
          })

          allColumns.forEach(colName => {
            suggestions.push({
              label: colName,
              kind: monacoInstance.languages.CompletionItemKind.Field,
              insertText: colName,
              detail: '列',
              sortText: '1',
              range
            })
          })

          // 表名.列名 格式
          Object.entries(currentSchema.columns).forEach(([tableName, cols]) => {
            cols.forEach(colName => {
              suggestions.push({
                label: `${tableName}.${colName}`,
                kind: monacoInstance.languages.CompletionItemKind.Field,
                insertText: `${tableName}.${colName}`,
                detail: `${tableName} 表的列`,
                sortText: '1',
                range
              })
            })
          })
        }

        // 3. SQL 关键字提示 - 始终提供
        SQL_KEYWORDS.forEach(keyword => {
          suggestions.push({
            label: keyword,
            kind: monacoInstance.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            detail: '关键字',
            sortText: '3',
            range
          })
        })

        // 4. SQLite 函数提示 - 始终提供
        SQLITE_FUNCTIONS.forEach(func => {
          suggestions.push({
            label: func,
            kind: monacoInstance.languages.CompletionItemKind.Function,
            insertText: `${func}()`,
            insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: 'SQLite 函数',
            sortText: '3',
            range
          })
        })

        return { suggestions }
      }
    })

    return disposable
  }, [])

  // Ctrl+= 放大 / Ctrl+- 缩小 编辑器字体（仅影响编辑器，不影响全局）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setEditorFontSize(prev => {
          const newSize = Math.min(MAX_EDITOR_FONT_SIZE, prev + 1)
          if (editorRef.current) editorRef.current.updateOptions({ fontSize: newSize })
          return newSize
        })
      } else if (e.key === '-') {
        e.preventDefault()
        setEditorFontSize(prev => {
          const newSize = Math.max(MIN_EDITOR_FONT_SIZE, prev - 1)
          if (editorRef.current) editorRef.current.updateOptions({ fontSize: newSize })
          return newSize
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 获取要执行的 SQL：优先使用选中的文本，否则使用全部
  const getExecutableSql = (): string => {
    if (!editorRef.current) return sql.trim()
    
    const selection = editorRef.current.getSelection()
    if (!selection || selection.isEmpty()) {
      return sql.trim()
    }
    
    const selectedText = editorRef.current.getModel().getValueInRange(selection)
    return selectedText.trim() || sql.trim()
  }

  const handleExecute = async () => {
    if (!activeConnection || !currentDatabase) return
    
    const executableSql = getExecutableSql()
    if (!executableSql) return
    
    setLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      // 真正执行 SQL
      const execResult = await window.electronAPI.sqlite.query(
        activeConnection.id, 
        currentDatabase.path, 
        executableSql
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
        sql: executableSql,
        timestamp: new Date(),
        executionTime: Date.now() - startTime,
        success: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行失败')
      setResult(null)
      addSqlHistory({
        id: `hist_${Date.now()}`,
        sql: executableSql,
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

  // ========== 结果表格相关函数 ==========

  // 获取列宽
  const getColumnWidth = (column: string) => columnWidths[column] || 150

  // 列宽拖动开始
  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = columnWidths[column] || 150
    setResizing({ column, startX: e.clientX, startWidth: currentWidth })
  }, [columnWidths])

  // 列宽拖动中
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return
    const diff = e.clientX - resizing.startX
    const newWidth = Math.max(60, resizing.startWidth + diff)
    setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }))
  }, [resizing])

  // 列宽拖动结束
  const handleResizeEnd = useCallback(() => {
    setResizing(null)
  }, [])

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizing, handleResizeMove, handleResizeEnd])

  // 双击表头排序
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // 切换排序方向: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortDirection(null)
        setSortColumn(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // 获取排序后的数据
  const getSortedData = () => {
    if (!result || !sortColumn || !sortDirection) return result

    const sortedRows = [...result.rows].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      // 处理 null 值
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      // 数字比较
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // 字符串比较
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return { ...result, rows: sortedRows }
  }

  // 复制单元格数据
  const copyCell = (value: any, cellKey: string) => {
    const text = value === null ? 'NULL' : String(value)
    navigator.clipboard.writeText(text)
    setCopiedCell(cellKey)
    setTimeout(() => setCopiedCell(null), 1500)
  }

  // 获取显示的数据（排序后）
  const displayResult = getSortedData()

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
                onMount={(editor, monacoInstance) => {
                  editorRef.current = editor
                  monacoRef.current = monacoInstance
                  setEditorLoaded(true)
                  setEditorLoadError(false)

                  // 配置编辑器以增强 SQL 支持
                  monacoInstance.languages.setLanguageConfiguration('sql', {
                    wordPattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
                    indentationRules: {
                      increaseIndentPattern: /\b(BEGIN|CASE|CREATE|INSERT|UPDATE|DELETE|SELECT)\b/i,
                      decreaseIndentPattern: /\b(END|COMMIT|ROLLBACK)\b/i
                    }
                  })

                  // 设置 SQL 智能提示
                  const disposable = setupSqlCompletion(monacoInstance)

                  // 清理函数
                  editor.onDidDispose(() => {
                    disposable?.dispose()
                  })
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
                {displayResult?.rows.length ?? 0} 行 · {result.executionTime}ms
                {sortColumn && sortDirection && (
                  <span className="ml-2 text-accent">
                    · 排序: {sortColumn} {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto mx-1 my-1 rounded-xl">
            {error ? (
              <div className="p-4 text-error text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            ) : displayResult ? (
              <table className="w-full text-xs table-fixed">
                <colgroup>
                  {displayResult.columns.map((col) => (
                    <col key={col} style={{ width: getColumnWidth(col), minWidth: '60px' }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr>
                    {displayResult.columns.map((col) => {
                      const isSorted = sortColumn === col
                      return (
                        <th key={col} className="relative">
                          <div
                            className="flex items-center gap-1 cursor-pointer select-none"
                            onDoubleClick={() => handleSort(col)}
                          >
                            <span className="block truncate">{col}</span>
                            {isSorted && sortDirection && (
                              <span className="text-accent flex-shrink-0">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                            {!isSorted && (
                              <span className="text-text-muted/30 flex-shrink-0 text-[8px]">⇅</span>
                            )}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 active:bg-accent transition-colors"
                            onMouseDown={(e) => handleResizeStart(e, col)}
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displayResult.rows.map((row, idx) => (
                    <tr key={idx} className="group transition-all hover:bg-hover/50">
                      {displayResult.columns.map((col) => {
                        const cellValue = row[col]
                        const tooltipContent = cellValue === null ? 'NULL' : String(cellValue)
                        const cellKey = `${idx}-${col}-${String(cellValue)}`
                        const isCopied = copiedCell === cellKey

                        return (
                          <td key={col} className="truncate max-w-[300px] relative group/cell">
                            <Tooltip content={tooltipContent}>
                              <div className="flex items-center pr-6">
                                {cellValue === null ? (
                                  <span className="text-text-muted italic">NULL</span>
                                ) : (
                                  <span className="truncate">{String(cellValue)}</span>
                                )}
                              </div>
                            </Tooltip>
                            <button
                              onClick={() => copyCell(cellValue, cellKey)}
                              className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${
                                isCopied ? 'text-success opacity-100' : 'text-warning opacity-0 group-hover/cell:opacity-100 hover:bg-hover'
                              }`}
                              title="复制"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        )
                      })}
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
