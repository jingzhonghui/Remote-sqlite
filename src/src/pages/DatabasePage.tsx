import { useState } from 'react'
import { 
  Database, Table, Search, RefreshCw, Plus, Trash2, Edit3, 
  ChevronRight, ChevronDown, FileSpreadsheet, Filter, Download, Loader2, AlertCircle,
  WifiOff, Server, X, FolderOpen
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Splitter } from '../components/ResizablePanel'

export default function DatabasePage() {
  const { 
    connectionPool, 
    activeConnectionId, 
    databases,
    currentDatabase, 
    selectedTable, 
    setSelectedTable,
    setCurrentDatabase,
    addDatabase,
    removeDatabase,
  } = useAppStore()
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [tableData, setTableData] = useState<{ columns: string[]; rows: any[]; totalCount?: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRow, setEditingRow] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set()) // 选中的行索引
  const [exporting, setExporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  
  // 打开数据库弹窗状态
  const [showOpenDbModal, setShowOpenDbModal] = useState(false)
  const [dbPath, setDbPath] = useState('')
  const [loadingTables, setLoadingTables] = useState(false)
  const [dbPathError, setDbPathError] = useState('')
  
  // 获取当前活动连接
  const activeConnection = connectionPool.connections.find(c => c.id === activeConnectionId)
  
  // 过滤当前连接的数据库
  const currentConnectionDatabases = databases.filter(db => db.connectionId === activeConnectionId)

  // 加载表数据
  const loadTableData = async (tableName: string) => {
    if (!activeConnection || !currentDatabase) return
    setLoading(true)
    
    try {
      // 查询数据（限制1000条）
      const sql = `SELECT * FROM "${tableName}" LIMIT 1000`
      const result = await window.electronAPI.sqlite.query(activeConnection.id, currentDatabase.path, sql)
      
      if (result.success) {
        // 查询总行数
        let totalCount = result.rows.length
        try {
          const countResult = await window.electronAPI.sqlite.query(
            activeConnection.id, 
            currentDatabase.path, 
            `SELECT COUNT(*) as cnt FROM "${tableName}"`
          )
          if (countResult.success && countResult.rows.length > 0) {
            totalCount = Number(countResult.rows[0].cnt) || result.rows.length
          }
        } catch (e) {
          console.error('获取总行数失败:', e)
        }
        
        setTableData({
          columns: result.columns,
          rows: result.rows,
          totalCount,
        })
      } else {
        setTableData({ columns: [], rows: [] })
        console.error('查询失败:', result.message)
      }
    } catch (error) {
      console.error('加载表数据失败:', error)
      setTableData({ columns: [], rows: [] })
    } finally {
      setLoading(false)
    }
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName)
    setSelectedRows(new Set()) // 切换表格时清空勾选
    loadTableData(tableName)
  }

  // 加载数据库 - 通过弹窗输入路径
  const loadDatabase = async () => {
    if (!activeConnection) {
      setDbPathError('SSH连接已断开，请重新连接')
      return
    }

    if (!dbPath.trim()) {
      setDbPathError('请输入数据库路径')
      return
    }

    setLoadingTables(true)
    setDbPathError('')
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      setLoadingTables(false)
      setDbPathError('请求超时，请检查网络连接或数据库路径')
    }, 30000)
    
    try {
      // 尝试获取表列表来验证数据库路径是否有效
      const result = await window.electronAPI.sqlite.getTables(activeConnection.id, dbPath.trim())
      
      clearTimeout(timeoutId)
      
      if (result.success) {
        const dbName = dbPath.split('/').pop() || dbPath
        const newDb = {
          path: dbPath.trim(),
          name: dbName,
          tables: result.tables.map(name => ({
            name,
            columns: [],
            indexes: [],
            rowCount: undefined,
          })),
          connectionId: activeConnection.id,
        }
        addDatabase(newDb)
        // 清空已选中的表
        setSelectedTable(null)
        setTableData(null)
        // 关闭弹窗并清空输入
        setShowOpenDbModal(false)
        setDbPath('')
      } else {
        setDbPathError(result.message || '无法访问该数据库')
      }
    } catch (error) {
      clearTimeout(timeoutId)
      setDbPathError(error instanceof Error ? error.message : '加载数据库失败，请检查SSH连接')
    } finally {
      setLoadingTables(false)
    }
  }

  // 打开弹窗时清空之前的输入和错误
  const openDbModal = () => {
    setDbPath('')
    setDbPathError('')
    setShowOpenDbModal(true)
  }

  // 刷新数据库
  const refreshDatabase = async () => {
    if (!activeConnection || !currentDatabase) return
    await loadDatabaseWithPath(currentDatabase.path)
    // 刷新后清空勾选
    setSelectedRows(new Set())
    // 如果当前有选中的表，也刷新表数据
    if (selectedTable) {
      await loadTableData(selectedTable)
    }
  }

  // 根据路径加载数据库
  const loadDatabaseWithPath = async (path: string) => {
    if (!activeConnection) {
      setDbPathError('SSH连接已断开，请重新连接')
      return
    }
    
    setLoadingTables(true)
    setDbPathError('')
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      setLoadingTables(false)
      setDbPathError('请求超时，请检查网络连接')
    }, 30000)
    
    try {
      const result = await window.electronAPI.sqlite.getTables(activeConnection.id, path)
      
      clearTimeout(timeoutId)
      
      if (result.success) {
        const dbName = path.split('/').pop() || path
        const newDb = {
          path,
          name: dbName,
          tables: result.tables.map(name => ({
            name,
            columns: [],
            indexes: [],
            rowCount: undefined,
          })),
          connectionId: activeConnection.id,
        }
        addDatabase(newDb)
      } else {
        setDbPathError(result.message || '无法访问该数据库')
      }
    } catch (error) {
      clearTimeout(timeoutId)
      setDbPathError(error instanceof Error ? error.message : '加载数据库失败，请检查SSH连接')
    } finally {
      setLoadingTables(false)
    }
  }

  const handleDeleteRow = async (row: any) => {
    if (!activeConnection || !currentDatabase || !selectedTable) return
    
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) return
    
    try {
      // 获取主键列名（优先使用 id 或 tableName_id）
      const primaryKeyCol = tableData?.columns.find(col => 
        col === 'id' || col === `${selectedTable}_id` || col.endsWith('_id')
      ) || tableData?.columns[0]
      
      if (!primaryKeyCol) {
        alert('无法确定主键列，请手动指定删除条件')
        return
      }
      
      const sql = `DELETE FROM "${selectedTable}" WHERE "${primaryKeyCol}" = ${formatValueForSQL(row[primaryKeyCol])}`
      
      const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
      
      if (result.success) {
        // 刷新数据并清空勾选
        await loadTableData(selectedTable)
        setSelectedRows(new Set())
      } else {
        alert(`删除失败: ${result.message}`)
      }
    } catch (error) {
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 切换行选中状态
  const toggleRowSelection = (index: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedRows(newSelected)
  }

  // 切换全选状态
  const toggleSelectAll = () => {
    if (!tableData) return
    if (selectedRows.size === tableData.rows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(tableData.rows.map((_, i) => i)))
    }
  }

  // 批量删除选中的行
  const handleBatchDelete = async () => {
    if (!activeConnection || !currentDatabase || !selectedTable || selectedRows.size === 0) return
    
    const count = selectedRows.size
    if (!confirm(`确定要删除选中的 ${count} 条记录吗？此操作不可撤销。`)) return
    
    try {
      // 获取主键列名
      const primaryKeyCol = tableData?.columns.find(col => 
        col === 'id' || col === `${selectedTable}_id` || col.endsWith('_id')
      ) || tableData?.columns[0]
      
      if (!primaryKeyCol) {
        alert('无法确定主键列')
        return
      }
      
      // 获取要删除的行数据
      const rowsToDelete = tableData?.rows.filter((_, i) => selectedRows.has(i)) || []
      let failedMessages: string[] = []
      
      for (const row of rowsToDelete) {
        const sql = `DELETE FROM "${selectedTable}" WHERE "${primaryKeyCol}" = ${formatValueForSQL(row[primaryKeyCol])}`
        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
        if (!result.success && result.message) {
          failedMessages.push(result.message)
        }
      }
      
      // 刷新数据并清空勾选
      await loadTableData(selectedTable)
      setSelectedRows(new Set())
      
      // 只有失败时才弹出错误提示
      if (failedMessages.length > 0) {
        alert(`部分删除失败：\n${failedMessages.slice(0, 3).join('\n')}${failedMessages.length > 3 ? `\n...还有 ${failedMessages.length - 3} 个错误` : ''}`)
      }
    } catch (error) {
      alert(`删除失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 导出数据
  const handleExport = async () => {
    if (!tableData || tableData.rows.length === 0) {
      alert('没有可导出的数据')
      return
    }
    setShowExportModal(true)
  }

  // 执行导出
  const executeExport = () => {
    if (!tableData) return
    
    setExporting(true)
    
    try {
      const rows = selectedRows.size > 0 
        ? tableData.rows.filter((_, i) => selectedRows.has(i))
        : tableData.rows
      
      let content: string
      let filename: string
      let mimeType: string
      
      if (exportFormat === 'csv') {
        // 生成 CSV
        const headers = tableData.columns.join(',')
        const csvRows = rows.map(row => 
          tableData.columns.map(col => {
            const val = row[col]
            if (val === null || val === undefined) return ''
            const str = String(val)
            // 转义引号和换行
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }).join(',')
        )
        content = [headers, ...csvRows].join('\n')
        filename = `${selectedTable || 'export'}_${Date.now()}.csv`
        mimeType = 'text/csv'
      } else {
        // 生成 JSON
        content = JSON.stringify(rows, null, 2)
        filename = `${selectedTable || 'export'}_${Date.now()}.json`
        mimeType = 'application/json'
      }
      
      // 创建下载
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      setShowExportModal(false)
      alert(`导出成功！共 ${rows.length} 条记录已保存为 ${filename}`)
    } catch (error) {
      alert(`导出失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setExporting(false)
    }
  }

  // 加载表数据时清空选择（通过 useEffect 监听 tableData 变化）
  // 注意：loadTableData 已经在内部处理清空勾选逻辑
  
  // 格式化值为 SQL 格式
  const formatValueForSQL = (value: any): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number') return String(value)
    return `'${String(value).replace(/'/g, "''")}'`
  }
  
  // 保存记录（新增或编辑）
  const handleSaveRow = async () => {
    if (!activeConnection || !currentDatabase || !selectedTable) return
    
    try {
      if (editingRow) {
        // 编辑模式：执行 UPDATE
        const primaryKeyCol = tableData?.columns.find(col => 
          col === 'id' || col === `${selectedTable}_id` || col.endsWith('_id')
        ) || tableData?.columns[0]
        
        if (!primaryKeyCol) {
          alert('无法确定主键列')
          return
        }
        
        const setClauses = Object.keys(editFormData)
          .filter(col => col !== primaryKeyCol)
          .map(col => `"${col}" = ${formatValueForSQL(editFormData[col])}`)
          .join(', ')
        
        const sql = `UPDATE "${selectedTable}" SET ${setClauses} WHERE "${primaryKeyCol}" = ${formatValueForSQL(editingRow[primaryKeyCol])}`
        
        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
        
        if (result.success) {
          // 刷新表数据
          await loadTableData(selectedTable)
          setShowAddModal(false)
          setEditingRow(null)
          alert('更新成功')
        } else {
          alert(`更新失败: ${result.message}`)
        }
      } else {
        // 新增模式：执行 INSERT
        const columns = Object.keys(editFormData)
        const values = columns.map(col => formatValueForSQL(editFormData[col])).join(', ')
        
        const sql = `INSERT INTO "${selectedTable}" ("${columns.join('", "')}") VALUES (${values})`
        
        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
        
        if (result.success) {
          // 刷新表数据
          await loadTableData(selectedTable)
          setShowAddModal(false)
          setEditingRow(null)
          alert('新增成功')
        } else {
          alert(`新增失败: ${result.message}`)
        }
      }
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
  
  // 打开编辑模态框
  const openEditModal = (row: any) => {
    setEditingRow(row)
    setEditFormData(row ? { ...row } : {})
    // 初始化空值
    tableData?.columns.forEach(col => {
      if (editFormData[col] === undefined) {
        setEditFormData(prev => ({ ...prev, [col]: '' }))
      }
    })
  }
  
  // 打开新增模态框
  const openAddModal = () => {
    setEditingRow(null)
    const initialData: Record<string, any> = {}
    tableData?.columns.forEach(col => {
      initialData[col] = ''
    })
    setEditFormData(initialData)
  }

  if (!activeConnection) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <WifiOff className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">未连接到任何服务器</p>
        <p className="text-xs mt-2">请先前往"连接管理"页面建立连接</p>
        
        {connectionPool.connections.length > 0 && (
          <div className="mt-4 p-3 bg-panel rounded-lg border border-border">
            <p className="text-[10px] text-text-muted mb-2">可用连接:</p>
            <div className="flex gap-2">
              {connectionPool.connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => useAppStore.getState().setActiveConnectionId(conn.id)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-hover rounded text-xs hover:bg-hover/80"
                >
                  <Server className="w-3 h-3 text-success" />
                  {conn.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <Splitter direction="horizontal" defaultSize={224} minSize={150}>
      <aside className="h-full bg-sidebar border-r border-border flex flex-col">
          {/* 连接状态栏 */}
          <div className="h-10 flex items-center px-3 border-b border-border justify-between">
            <span className="text-xs font-medium text-text-muted">对象浏览器</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-success truncate max-w-[80px]">{activeConnection?.name}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-2">
            {/* 打开数据库按钮 */}
            <div className="mb-3 px-2">
              <button
                onClick={openDbModal}
                disabled={!activeConnection}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderOpen className="w-4 h-4" />
                打开数据库
              </button>
            </div>

            {/* 数据库列表标题 */}
            {currentConnectionDatabases.length > 0 && (
              <div className="px-2 mb-1">
                <span className="text-[10px] text-text-muted">已打开的数据库</span>
              </div>
            )}

            {/* 所有已打开的数据库 */}
            {currentConnectionDatabases.map((db) => (
              <div key={`${db.connectionId}:${db.path}`} className="mb-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setCurrentDatabase(db)
                      // 自动展开数据库节点
                      if (!expandedNodes.has(`${db.connectionId}:${db.path}`)) {
                        toggleNode(`${db.connectionId}:${db.path}`)
                      }
                    }}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-xs ${
                      currentDatabase?.path === db.path && currentDatabase?.connectionId === db.connectionId
                        ? 'bg-selected text-accent'
                        : 'hover:bg-hover text-text-dim'
                    }`}
                  >
                    <Database className="w-4 h-4 text-accent" />
                    <span className="truncate" title={db.path}>{db.name}</span>
                  </button>
                  <button
                    onClick={() => removeDatabase(db.connectionId, db.path)}
                    className="p-1 text-text-muted hover:text-error hover:bg-hover rounded"
                    title="关闭数据库"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 当前选中的数据库才显示表列表 */}
                {currentDatabase?.path === db.path && currentDatabase?.connectionId === db.connectionId && (
                  <div className="ml-4 mt-1">
                    {/* Tables */}
                    <div className="mb-1">
                      <button
                        onClick={() => toggleNode('tables')}
                        className="flex items-center gap-1.5 w-full px-2 py-1 rounded hover:bg-hover text-xs"
                      >
                        {expandedNodes.has('tables') ? (
                          <ChevronDown className="w-3 h-3 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-muted" />
                        )}
                        <Table className="w-3.5 h-3.5 text-info" />
                        <span className="text-text-dim">表</span>
                        <span className="text-text-muted ml-auto">{db.tables.length || 0}</span>
                      </button>

                      {expandedNodes.has('tables') && (
                        <div className="ml-4">
                          {db.tables.length === 0 ? (
                            <div className="px-2 py-2 text-[10px] text-text-muted italic">
                              数据库中没有表
                            </div>
                          ) : (
                            db.tables.map((table) => (
                              <button
                                key={table.name}
                                onClick={() => handleTableClick(table.name)}
                                className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs ${
                                  selectedTable === table.name
                                    ? 'bg-selected text-accent'
                                    : 'hover:bg-hover text-text-dim'
                                }`}
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span className="truncate">{table.name}</span>
                                {table.rowCount !== undefined && (
                                  <span className="text-text-muted ml-auto text-[10px]">
                                    ~{table.rowCount.toLocaleString()}
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 空状态提示 */}
            {currentConnectionDatabases.length === 0 && (
              <div className="px-2 py-4 text-center text-[10px] text-text-muted">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>点击上方按钮打开数据库</p>
              </div>
            )}
          </div>
        </aside>
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Toolbar */}
        <div className="h-10 bg-toolbar-bg border-b border-border flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={openAddModal}
              disabled={!selectedTable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded-xl text-xs font-medium transition-all neu-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              新增行
            </button>
            <button 
              onClick={handleBatchDelete}
              disabled={selectedRows.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-error rounded-xl text-xs font-medium round-btn hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除 {selectedRows.size > 0 && `(${selectedRows.size})`}
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button 
              onClick={refreshDatabase}
              disabled={!currentDatabase || loadingTables}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium round-btn text-text-muted hover:text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTables ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button 
              onClick={handleExport}
              disabled={!tableData || tableData.rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium round-btn text-text-muted hover:text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              导出
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索数据..."
                className="w-48 pl-8 pr-3 py-1 text-xs"
              />
            </div>
            <button className="p-1.5 hover:bg-hover rounded">
              <Filter className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto">
          {!currentDatabase ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Database className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">请先在左侧点击"打开数据库"按钮</p>
              <button
                onClick={openDbModal}
                className="mt-3 flex items-center gap-2 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary"
              >
                <FolderOpen className="w-4 h-4" />
                打开数据库
              </button>
            </div>
          ) : !selectedTable ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Table className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">选择一个表以查看数据</p>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : tableData ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-8">
                    <input 
                      type="checkbox" 
                      className="rounded cursor-pointer accent-accent"
                      checked={selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {tableData.columns.map((col) => (
                    <th key={col} className="whitespace-nowrap">{col}</th>
                  ))}
                  <th className="w-20">操作</th>
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, idx) => (
                  <tr 
                    key={row.id || idx} 
                    className={`group transition-all ${selectedRows.has(idx) ? 'bg-selected/50' : ''}`}
                  >
                    <td className="text-center">
                      <input 
                        type="checkbox" 
                        className="rounded cursor-pointer accent-accent"
                        checked={selectedRows.has(idx)}
                        onChange={() => toggleRowSelection(idx)}
                      />
                    </td>
                    {tableData.columns.map((col) => (
                      <td key={col} className="whitespace-nowrap">
                        {row[col] === null ? (
                          <span className="text-text-muted italic">NULL</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                    <td>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(row)}
                          className="p-1.5 rounded-xl round-btn hover:scale-110 transition-all"
                          title="编辑"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-info" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRow(row)}
                          className="p-1.5 rounded-xl round-btn hover:scale-110 transition-all"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {/* Pagination */}
        {selectedTable && (
          <div className="h-9 bg-toolbar-bg border-t border-border flex items-center justify-between px-3 text-xs">
            <span className="text-text-muted">
              {tableData ? `共 ${tableData.totalCount?.toLocaleString() ?? tableData.rows.length} 条` : '加载中...'}
            </span>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 bg-hover rounded hover:bg-hover/80 disabled:opacity-50" disabled>
                上一页
              </button>
              <span className="text-text-muted">第 1 页</span>
              <button className="px-2 py-1 bg-hover rounded hover:bg-hover/80">
                下一页
              </button>
            </div>
          </div>
        )}
      </main>
    </Splitter>

    {/* Add/Edit Modal */}
    {(showAddModal || editingRow) && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-panel border border-border rounded-lg w-[500px] max-h-[80vh] overflow-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium">
              {editingRow ? '编辑记录' : '新增记录'}
            </h2>
          </div>
          
          <div className="p-4 space-y-3">
            {tableData?.columns.map((col) => (
              <div key={col}>
                <label className="block text-xs text-text-muted mb-1">{col}</label>
                <input
                  type="text"
                  value={editFormData[col] ?? ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, [col]: e.target.value }))}
                  className="w-full"
                  placeholder={col === 'id' ? '自动生成' : ''}
                  disabled={col === 'id' && !!editingRow}
                />
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => { setShowAddModal(false); setEditingRow(null) }}
              className="px-4 py-2 text-xs text-text-muted hover:text-text"
            >
              取消
            </button>
            <button
              onClick={handleSaveRow}
              className="px-4 py-2 bg-accent text-white rounded text-xs hover:bg-accent/90"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 打开数据库 Modal */}
    {showOpenDbModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-panel border border-border rounded-lg w-[480px]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium">打开数据库</h2>
            <button
              onClick={() => setShowOpenDbModal(false)}
              className="p-1 hover:bg-hover rounded"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">数据库路径</label>
              <input
                type="text"
                value={dbPath}
                onChange={(e) => { setDbPath(e.target.value); setDbPathError('') }}
                onKeyDown={(e) => e.key === 'Enter' && loadDatabase()}
                placeholder="/path/to/database.db"
                className="w-full"
                autoFocus
              />
              {dbPathError && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-error">
                  <AlertCircle className="w-3 h-3" />
                  <span>{dbPathError}</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted">
              请输入远程服务器上的 SQLite 数据库文件路径，例如：/home/user/data/myapp.db
            </p>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => setShowOpenDbModal(false)}
              className="px-4 py-2 text-xs text-text-muted hover:text-text"
            >
              取消
            </button>
            <button
              onClick={loadDatabase}
              disabled={loadingTables || !dbPath.trim()}
              className="px-4 py-2 bg-accent text-white rounded text-xs hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingTables && <Loader2 className="w-3 h-3 animate-spin" />}
              确定
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 导出格式选择 Modal */}
    {showExportModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-panel border border-border rounded-lg w-[400px]">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-medium">导出数据</h2>
            <button
              onClick={() => setShowExportModal(false)}
              className="p-1 hover:bg-hover rounded"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-text-muted mb-3">
                选择导出格式（{selectedRows.size > 0 ? `已选中 ${selectedRows.size} 条记录` : '将导出所有数据'}）
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-medium transition-all ${
                    exportFormat === 'csv'
                      ? 'neu-inset text-accent'
                      : 'round-btn text-text-muted hover:text-accent'
                  }`}
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto mb-1" />
                  CSV 格式
                </button>
                <button
                  onClick={() => setExportFormat('json')}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-medium transition-all ${
                    exportFormat === 'json'
                      ? 'neu-inset text-accent'
                      : 'round-btn text-text-muted hover:text-accent'
                  }`}
                >
                  <Database className="w-5 h-5 mx-auto mb-1" />
                  JSON 格式
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 text-xs text-text-muted hover:text-text round-btn"
            >
              取消
            </button>
            <button
              onClick={executeExport}
              disabled={exporting}
              className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-medium transition-all neu-btn-primary disabled:opacity-50 flex items-center gap-2"
            >
              {exporting && <Loader2 className="w-3 h-3 animate-spin" />}
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
