import { useState, useCallback, useEffect } from 'react'
import { 
  Database, Table, Search, RefreshCw, Plus, Trash2, Edit3, Copy, Check,
  ChevronRight, ChevronDown, FileSpreadsheet, Download, Loader2, AlertCircle,
  WifiOff, Server, X, FolderOpen, Filter, FolderTree
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import { Splitter } from '../components/ResizablePanel'
import { Tooltip } from '../components/Tooltip'
import FileBrowser from '../components/FileBrowser'

// 定义排序状态
type SortDirection = 'asc' | 'desc' | null

// 定义筛选条件
interface FilterCondition {
  column: string
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'isNull' | 'isNotNull'
  value: string
}

// 定义打开的表标签页类型
interface TableTab {
  id: string
  tableName: string
  data: {
    columns: string[]
    rows: any[]
    totalCount?: number
  } | null
  loading: boolean
  selectedRows: Set<string>
  columnWidths: Record<string, number>
  sortColumn: string | null
  sortDirection: SortDirection
  // 搜索和筛选
  globalSearch: string
  columnFilters: FilterCondition[]
}

function getRowKey(row: any, columns: string[]): string {
  const pkCol = columns.find(col =>
    col === 'id' || col === '_id' || col.endsWith('_id')
  ) || columns[0]
  const val = row[pkCol]
  return val !== undefined && val !== null ? String(val) : JSON.stringify(row)
}

export default function DatabasePage() {
  const { 
    connectionPool, 
    activeConnectionId, 
    databases,
    currentDatabase, 
    setSelectedTable,
    setCurrentDatabase,
    addDatabase,
    removeDatabase,
  } = useAppStore()
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRow, setEditingRow] = useState<any>(null)
  const [editFormData, setEditFormData] = useState<Record<string, any>>({})
  const [exporting, setExporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [saving, setSaving] = useState(false)
  
  // 打开数据库弹窗状态
  const [showOpenDbModal, setShowOpenDbModal] = useState(false)
  const [dbPath, setDbPath] = useState('')
  const [loadingTables, setLoadingTables] = useState(false)
  const [dbPathError, setDbPathError] = useState('')
  
  // 文件浏览器状态
  const [showFileBrowser, setShowFileBrowser] = useState(false)

  // 多标签页状态
  const [openTabs, setOpenTabs] = useState<TableTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // 获取当前活动连接
  const activeConnection = connectionPool.connections.find(c => c.id === activeConnectionId)
  
  // 过滤当前连接的数据库
  const currentConnectionDatabases = databases.filter(db => db.connectionId === activeConnectionId)

  // 获取当前活动的标签页
  const activeTab = openTabs.find(tab => tab.id === activeTabId)
  const tableData = activeTab?.data || null
  const selectedRows = activeTab?.selectedRows || new Set()

  // 加载表数据
  const loadTableData = async (tableName: string, tabId: string) => {
    if (!activeConnection || !currentDatabase) return
    
    // 更新标签页加载状态
    setOpenTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, loading: true } : tab
    ))
    
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
        
        // 更新标签页数据
        setOpenTabs(prev => prev.map(tab => 
          tab.id === tabId ? { 
            ...tab, 
            loading: false,
            data: {
              columns: result.columns,
              rows: result.rows,
              totalCount,
            }
          } : tab
        ))
      } else {
        setOpenTabs(prev => prev.map(tab => 
          tab.id === tabId ? { ...tab, loading: false, data: { columns: [], rows: [] } } : tab
        ))
        console.error('查询失败:', result.message)
      }
    } catch (error) {
      console.error('加载表数据失败:', error)
      setOpenTabs(prev => prev.map(tab => 
        tab.id === tabId ? { ...tab, loading: false, data: { columns: [], rows: [] } } : tab
      ))
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

  // 双击打开表
  const handleTableDoubleClick = (tableName: string) => {
    // 检查是否已存在该表的标签页
    const existingTab = openTabs.find(tab => tab.tableName === tableName)
    if (existingTab) {
      setActiveTabId(existingTab.id)
    } else {
      // 创建新标签页
      const newTab: TableTab = {
        id: `${currentDatabase?.path}:${tableName}:${Date.now()}`,
        tableName,
        data: null,
        loading: true,
        selectedRows: new Set(),
        columnWidths: {},
        sortColumn: null,
        sortDirection: null,
        globalSearch: '',
        columnFilters: [],
      }
      setOpenTabs(prev => [...prev, newTab])
      setActiveTabId(newTab.id)
      loadTableData(tableName, newTab.id)
    }
    setSelectedTable(tableName)
  }

  // 关闭标签页
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId)
      // 如果关闭的是当前活动标签页，切换到另一个
      if (activeTabId === tabId) {
        const closedIndex = prev.findIndex(tab => tab.id === tabId)
        const newActiveTab = newTabs[closedIndex] || newTabs[closedIndex - 1] || null
        setActiveTabId(newActiveTab?.id || null)
        if (newActiveTab) {
          setSelectedTable(newActiveTab.tableName)
        } else {
          setSelectedTable(null)
        }
      }
      return newTabs
    })
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
        // 清空已打开的标签页
        setOpenTabs([])
        setActiveTabId(null)
        setSelectedTable(null)
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

  // 刷新当前标签页
  const refreshCurrentTab = async () => {
    if (!activeTab || !currentDatabase) return
    await loadTableData(activeTab.tableName, activeTab.id)
  }

  // 刷新数据库
  const refreshDatabase = async () => {
    if (!activeConnection || !currentDatabase) return
    await loadDatabaseWithPath(currentDatabase.path)
    // 刷新后重新加载当前标签页数据
    if (activeTab) {
      await loadTableData(activeTab.tableName, activeTab.id)
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

  // 删除行
  const handleDeleteRow = async (row: any) => {
    if (!activeConnection || !currentDatabase || !activeTab) return
    
    if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) return
    
    try {
      // 获取主键列名（优先使用 id 或 tableName_id）
      const primaryKeyCol = tableData?.columns.find(col => 
        col === 'id' || col === `${activeTab.tableName}_id` || col.endsWith('_id')
      ) || tableData?.columns[0]
      
      if (!primaryKeyCol) {
        alert('无法确定主键列，请手动指定删除条件')
        return
      }
      
      const sql = `DELETE FROM "${activeTab.tableName}" WHERE "${primaryKeyCol}" = ${formatValueForSQL(row[primaryKeyCol])}`
      
      const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
      
      if (result.success) {
        // 从选中状态中移除被删除的行
        const deletedRowKey = getRowKey(row, tableData?.columns || [])
        setOpenTabs(prev => prev.map(tab =>
          tab.id === activeTabId
            ? { ...tab, selectedRows: new Set([...tab.selectedRows].filter(k => k !== deletedRowKey)) }
            : tab
        ))
        // 刷新数据
        await loadTableData(activeTab.tableName, activeTab.id)
      } else {
        alert(`删除失败: ${result.message}`)
      }
    } catch (error) {
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 切换行选中状态
  const toggleRowSelection = (rowKey: string) => {
    if (!activeTab) return
    setOpenTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const newSelected = new Set(tab.selectedRows)
        if (newSelected.has(rowKey)) {
          newSelected.delete(rowKey)
        } else {
          newSelected.add(rowKey)
        }
        return { ...tab, selectedRows: newSelected }
      }
      return tab
    }))
  }

  // 切换全选状态
  const toggleSelectAll = () => {
    if (!sortedFilteredTableData || !activeTab) return
    setOpenTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const filteredKeys = new Set(
          sortedFilteredTableData.rows.map(row => getRowKey(row, sortedFilteredTableData.columns))
        )
        const allFilteredSelected = filteredKeys.size > 0 && [...filteredKeys].every(k => tab.selectedRows.has(k))
        if (allFilteredSelected) {
          const newSelected = new Set(tab.selectedRows)
          filteredKeys.forEach(k => newSelected.delete(k))
          return { ...tab, selectedRows: newSelected }
        } else {
          const newSelected = new Set(tab.selectedRows)
          filteredKeys.forEach(k => newSelected.add(k))
          return { ...tab, selectedRows: newSelected }
        }
      }
      return tab
    }))
  }

  // 批量删除选中的行
  const handleBatchDelete = async () => {
    if (!activeConnection || !currentDatabase || !activeTab || selectedRows.size === 0) return
    
    const count = selectedRows.size
    if (!confirm(`确定要删除选中的 ${count} 条记录吗？此操作不可撤销。`)) return
    
    try {
      // 获取主键列名
      const primaryKeyCol = tableData?.columns.find(col => 
        col === 'id' || col === `${activeTab.tableName}_id` || col.endsWith('_id')
      ) || tableData?.columns[0]
      
      if (!primaryKeyCol) {
        alert('无法确定主键列')
        return
      }
      
      // 获取要删除的行数据
      const rowsToDelete = tableData?.rows.filter(row => selectedRows.has(getRowKey(row, tableData.columns))) || []
      let failedMessages: string[] = []
      
      for (const row of rowsToDelete) {
        const sql = `DELETE FROM "${activeTab.tableName}" WHERE "${primaryKeyCol}" = ${formatValueForSQL(row[primaryKeyCol])}`
        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)
        if (!result.success && result.message) {
          failedMessages.push(result.message)
        }
      }
      
      // 清空所有选中
      setOpenTabs(prev => prev.map(tab =>
        tab.id === activeTabId ? { ...tab, selectedRows: new Set() } : tab
      ))
      // 刷新数据
      await loadTableData(activeTab.tableName, activeTab.id)

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
    if (!tableData || !activeTab) return
    
    setExporting(true)
    
    try {
      const rows = selectedRows.size > 0 
        ? tableData.rows.filter(row => selectedRows.has(getRowKey(row, tableData.columns)))
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
        filename = `${activeTab.tableName || 'export'}_${Date.now()}.csv`
        mimeType = 'text/csv'
      } else {
        // 生成 JSON
        content = JSON.stringify(rows, null, 2)
        filename = `${activeTab.tableName || 'export'}_${Date.now()}.json`
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
  
  // 格式化值为 SQL 格式
  const formatValueForSQL = (value: any): string => {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number') return String(value)
    return `'${String(value).replace(/'/g, "''")}'`
  }
  
  // 保存记录（新增或编辑）
  const handleSaveRow = async () => {
    if (!activeConnection || !currentDatabase || !activeTab || saving) return

    setSaving(true)
    try {
      if (editingRow) {
        // 编辑模式：执行 UPDATE
        const primaryKeyCol = tableData?.columns.find(col =>
          col === 'id' || col === `${activeTab.tableName}_id` || col.endsWith('_id')
        ) || tableData?.columns[0]

        if (!primaryKeyCol) {
          alert('无法确定主键列')
          setSaving(false)
          return
        }

        const setClauses = Object.keys(editFormData)
          .filter(col => col !== primaryKeyCol)
          .map(col => `"${col}" = ${formatValueForSQL(editFormData[col])}`)
          .join(', ')

        const sql = `UPDATE "${activeTab.tableName}" SET ${setClauses} WHERE "${primaryKeyCol}" = ${formatValueForSQL(editingRow[primaryKeyCol])}`

        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)

        if (result.success) {
          // 刷新表数据
          await loadTableData(activeTab.tableName, activeTab.id)
          setShowAddModal(false)
          setEditingRow(null)
          alert('更新成功')
        } else {
          alert(`更新失败: ${result.message}`)
        }
      } else {
        // 新增模式：执行 INSERT
        // 过滤掉主键列（id）和空值字段
        const primaryKeyCol = tableData?.columns.find(col =>
          col === 'id' || col === `${activeTab.tableName}_id` || col.endsWith('_id')
        )

        const entries = Object.entries(editFormData)
          .filter(([col, val]) => col !== primaryKeyCol && val !== '' && val !== undefined && val !== null)

        const columns = entries.map(([col]) => col)
        const values = entries.map(([, val]) => formatValueForSQL(val)).join(', ')

        if (columns.length === 0) {
          alert('请至少填写一个字段')
          setSaving(false)
          return
        }

        const sql = `INSERT INTO "${activeTab.tableName}" ("${columns.join('", "')}") VALUES (${values})`

        const result = await window.electronAPI.sqlite.execute(activeConnection.id, currentDatabase.path, sql)

        if (result.success) {
          // 刷新表数据
          await loadTableData(activeTab.tableName, activeTab.id)
          setShowAddModal(false)
          setEditingRow(null)
          alert('新增成功')
        } else {
          alert(`新增失败: ${result.message}`)
        }
      }
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }
  
  // 打开编辑模态框
  const openEditModal = (row: any) => {
    const initialData: Record<string, any> = row ? { ...row } : {}
    // 初始化空值（确保所有列都有对应的键）
    tableData?.columns.forEach(col => {
      if (initialData[col] === undefined) {
        initialData[col] = ''
      }
    })
    setEditingRow(row)
    setEditFormData(initialData)
  }
  
  // 打开新增模态框
  const openAddModal = () => {
    setEditingRow(null)
    const initialData: Record<string, any> = {}
    tableData?.columns.forEach(col => {
      initialData[col] = ''
    })
    setEditFormData(initialData)
    setShowAddModal(true)
  }

  // 列宽拖动相关
  const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!activeTab) return
    const currentWidth = activeTab.columnWidths[column] || 150
    setResizing({ column, startX: e.clientX, startWidth: currentWidth })
  }, [activeTab])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing || !activeTab) return
    const diff = e.clientX - resizing.startX
    const newWidth = Math.max(60, resizing.startWidth + diff)
    setOpenTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          columnWidths: { ...tab.columnWidths, [resizing.column]: newWidth }
        }
      }
      return tab
    }))
  }, [resizing, activeTab, activeTabId])

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

  // 获取列宽
  const getColumnWidth = (column: string) => activeTab?.columnWidths[column] || 150

  // 复制单元格数据
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  
  // 筛选器状态
  // 筛选面板状态
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterColumn, setFilterColumn] = useState('')
  const [filterOperator, setFilterOperator] = useState<FilterCondition['operator']>('contains')
  const [filterValue, setFilterValue] = useState('')
  
  const copyCell = (value: any, cellKey: string) => {
    const text = value === null ? 'NULL' : String(value)
    navigator.clipboard.writeText(text)
    setCopiedCell(cellKey)
    setTimeout(() => setCopiedCell(null), 1500)
  }

  // 全局搜索处理
  const handleGlobalSearch = (value: string) => {
    if (!activeTabId) return
    setSearchTerm(value)
    setOpenTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, globalSearch: value } : tab
    ))
  }


  // 清除搜索
  const clearSearch = () => {
    handleGlobalSearch('')
  }

  // 删除筛选
  const removeColumnFilter = (index: number) => {
    if (!activeTabId) return
    setOpenTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, columnFilters: tab.columnFilters.filter((_, i) => i !== index) }
        : tab
    ))
  }

  // 清除所有筛选
  const clearAllFilters = () => {
    if (!activeTabId) return
    setOpenTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, globalSearch: '', columnFilters: [] }
        : tab
    ))
    setSearchTerm('')
  }

  // 筛选操作符映射
  const operatorLabels: Record<FilterCondition['operator'], string> = {
    contains: '包含',
    equals: '等于',
    startsWith: '开头是',
    endsWith: '结尾是',
    greaterThan: '大于',
    lessThan: '小于',
    isNull: '为空',
    isNotNull: '不为空',
  }

  // 判断单行是否满足筛选条件
  const rowMatchesFilter = (row: any, filter: FilterCondition): boolean => {
    const cellValue = row[filter.column]
    const filterValue = filter.value

    switch (filter.operator) {
      case 'contains':
        return cellValue !== null && String(cellValue).toLowerCase().includes(filterValue.toLowerCase())
      case 'equals':
        if (cellValue === null) return filterValue === '' || filterValue.toLowerCase() === 'null'
        return String(cellValue).toLowerCase() === filterValue.toLowerCase()
      case 'startsWith':
        return cellValue !== null && String(cellValue).toLowerCase().startsWith(filterValue.toLowerCase())
      case 'endsWith':
        return cellValue !== null && String(cellValue).toLowerCase().endsWith(filterValue.toLowerCase())
      case 'greaterThan':
        if (cellValue === null) return false
        const numVal = Number(cellValue)
        const numFilter = Number(filterValue)
        if (!isNaN(numVal) && !isNaN(numFilter)) return numVal > numFilter
        return String(cellValue) > filterValue
      case 'lessThan':
        if (cellValue === null) return false
        const numVal2 = Number(cellValue)
        const numFilter2 = Number(filterValue)
        if (!isNaN(numVal2) && !isNaN(numFilter2)) return numVal2 < numFilter2
        return String(cellValue) < filterValue
      case 'isNull':
        return cellValue === null
      case 'isNotNull':
        return cellValue !== null
      default:
        return true
    }
  }

  // 获取筛选后的数据
  const getFilteredData = () => {
    if (!tableData || !activeTab) return tableData
    
    let filteredRows = [...tableData.rows]
    
    // 应用全局搜索
    if (activeTab.globalSearch.trim()) {
      const search = activeTab.globalSearch.toLowerCase()
      filteredRows = filteredRows.filter(row =>
        tableData.columns.some(col => {
          const val = row[col]
          return val !== null && String(val).toLowerCase().includes(search)
        })
      )
    }
    
    // 应用列筛选
    for (const filter of activeTab.columnFilters) {
      filteredRows = filteredRows.filter(row => rowMatchesFilter(row, filter))
    }
    
    return { ...tableData, rows: filteredRows }
  }

  const filteredTableData = getFilteredData()

  // 双击表头排序
  const handleSort = (column: string) => {
    if (!activeTabId) return
    setOpenTabs(prev => prev.map(tab => {
      if (tab.id !== activeTabId) return tab
      
      // 排序逻辑：asc -> desc -> null
      let newDirection: SortDirection = null
      if (tab.sortColumn === column) {
        if (tab.sortDirection === 'asc') {
          newDirection = 'desc'
        } else if (tab.sortDirection === 'desc') {
          newDirection = null
        } else {
          newDirection = 'asc'
        }
      } else {
        newDirection = 'asc'
      }
      
      return {
        ...tab,
        sortColumn: newDirection ? column : null,
        sortDirection: newDirection,
      }
    }))
  }

  // 获取排序后的数据（筛选+排序）
  const getSortedFilteredData = () => {
    if (!filteredTableData || !activeTab) return filteredTableData
    if (!activeTab.sortColumn || !activeTab.sortDirection) return filteredTableData
    
    const { sortColumn, sortDirection } = activeTab
    const sortedRows = [...filteredTableData.rows].sort((a, b) => {
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
      const aStr = String(aVal)
      const bStr = String(bVal)
      const cmp = aStr.localeCompare(bStr)
      return sortDirection === 'asc' ? cmp : -cmp
    })
    
    return { ...filteredTableData, rows: sortedRows }
  }

  // 排序后的数据（基于筛选后的数据）
  const sortedFilteredTableData = getSortedFilteredData()

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
      <aside className="h-full bg-sidebar border-r border-border rounded-xl flex flex-col overflow-hidden">
          {/* 连接状态栏 */}
          <div className="h-10 flex items-center px-3 border-b border-border rounded-t-xl justify-between">
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
                    onDoubleClick={() => {
                      setCurrentDatabase(db)
                      // 自动展开数据库节点
                      if (!expandedNodes.has(`${db.connectionId}:${db.path}`)) {
                        toggleNode(`${db.connectionId}:${db.path}`)
                      }
                    }}
                    onClick={() => {
                      setCurrentDatabase(db)
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
                                onDoubleClick={() => handleTableDoubleClick(table.name)}
                                onClick={() => setSelectedTable(table.name)}
                                className={`flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs ${
                                  openTabs.some(tab => tab.tableName === table.name)
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
        {/* Tab 标签栏 */}
        {openTabs.length > 0 && (
          <div className="h-10 bg-toolbar-bg border-b border-border rounded-t-xl flex items-center overflow-x-auto">
            {openTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id)
                  setSelectedTable(tab.tableName)
                }}
                className={`flex items-center gap-2 px-4 h-full cursor-pointer border-r border-border text-xs whitespace-nowrap ${
                  activeTabId === tab.id
                    ? 'bg-panel text-accent border-b-2 border-b-accent'
                    : 'text-text-muted hover:bg-hover hover:text-text'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{tab.tableName}</span>
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="p-0.5 hover:bg-hover rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="h-10 bg-toolbar-bg border-b border-border rounded-xl flex items-center justify-between px-3 mx-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={openAddModal}
              disabled={!activeTab}
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
              onClick={refreshCurrentTab}
              disabled={!activeTab || loadingTables}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium round-btn text-text-muted hover:text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="刷新当前表数据"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTables ? 'animate-spin' : ''}`} />
              刷新表
            </button>
            <button 
              onClick={refreshDatabase}
              disabled={!currentDatabase || loadingTables}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium round-btn text-text-muted hover:text-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="刷新数据库结构（重新加载表列表）"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTables ? 'animate-spin' : ''}`} />
              刷新库
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
            {/* 搜索框 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleGlobalSearch(e.target.value)}
                placeholder="搜索数据..."
                className="w-48 pl-8 pr-8 py-1 text-xs rounded-xl"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* 筛选按钮 */}
            <Tooltip content={showFilterPanel || activeTab?.columnFilters.length ? '收起筛选' : '添加筛选'}>
              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`relative p-1.5 rounded border transition-all ${
                  showFilterPanel || activeTab?.columnFilters.length
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-hover border-border text-text-muted hover:text-text hover:border-text-muted'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {activeTab && activeTab.columnFilters.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-accent text-white text-[10px] rounded-full min-w-[16px] text-center leading-none">
                    {activeTab.columnFilters.length}
                  </span>
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto mx-1 my-1 rounded-xl">
          {!currentDatabase ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Database className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">请先在左侧双击数据库打开</p>
              <button
                onClick={openDbModal}
                className="mt-3 flex items-center gap-2 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary"
              >
                <FolderOpen className="w-4 h-4" />
                打开数据库
              </button>
            </div>
          ) : openTabs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Table className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">双击左侧表名称打开数据</p>
            </div>
          ) : activeTab?.loading ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : sortedFilteredTableData ? (
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col className="w-8 min-w-[32px]" />
                {sortedFilteredTableData.columns.map((col) => (
                  <col key={col} style={{ width: getColumnWidth(col), minWidth: '60px' }} />
                ))}
                <col className="w-20 min-w-[80px]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="w-8 min-w-[32px]">
                    <input 
                      type="checkbox" 
                      className="rounded cursor-pointer accent-accent"
                      checked={sortedFilteredTableData.rows.length > 0 && sortedFilteredTableData.rows.every(row => selectedRows.has(getRowKey(row, sortedFilteredTableData.columns)))}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {sortedFilteredTableData.columns.map((col) => {
                    const isSorted = activeTab?.sortColumn === col
                    const sortDir = activeTab?.sortDirection
                    return (
                      <th key={col} className="relative">
                        <div 
                          className="flex items-center gap-1 cursor-pointer select-none"
                          onDoubleClick={() => handleSort(col)}
                        >
                          <span className="block truncate">{col}</span>
                          {isSorted && sortDir && (
                            <span className="text-accent flex-shrink-0">
                              {sortDir === 'asc' ? '↑' : '↓'}
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
                  <th className="w-20 min-w-[80px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredTableData?.rows.map((row, idx) => {
                  const rowKey = getRowKey(row, sortedFilteredTableData.columns)
                  return (
                  <tr
                    key={rowKey}
                    className={`group transition-all ${selectedRows.has(rowKey) ? 'bg-selected/50' : ''}`}
                  >
                    <td className="text-center min-w-[32px]">
                      <input
                        type="checkbox"
                        className="rounded cursor-pointer accent-accent"
                        checked={selectedRows.has(rowKey)}
                        onChange={() => toggleRowSelection(rowKey)}
                      />
                    </td>
                    {sortedFilteredTableData?.columns.map((col) => {
                      const cellValue = row[col]
                      const displayValue = cellValue === null ? (
                        <span className="text-text-muted italic">NULL</span>
                      ) : (
                        String(cellValue)
                      )
                      const tooltipContent = cellValue === null ? 'NULL' : String(cellValue)
                      const cellKey = `${idx}-${col}-${String(cellValue)}`
                      const isCopied = copiedCell === cellKey
                      
                      return (
                        <td key={col} className="truncate max-w-[300px] relative group/cell">
                          <div className="flex items-center pr-6">
                            <Tooltip content={tooltipContent}>
                              {displayValue}
                            </Tooltip>
                          </div>
                          <button
                            onClick={() => copyCell(cellValue, cellKey)}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-all ${isCopied ? 'text-success opacity-100' : 'text-warning opacity-0 group-hover/cell:opacity-100 hover:bg-hover'}`}
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
                )}
              )}
              </tbody>
            </table>


          ) : null}
        </div>

        {/* 筛选工具栏 - 仅在有筛选条件或点击筛选按钮后显示 */}
        {activeTab && sortedFilteredTableData && (showFilterPanel || activeTab.columnFilters.length > 0) && (
          <div className="bg-toolbar-bg border-t border-border rounded-b-xl px-3 py-2 mx-1">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 筛选条件标签 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeTab.columnFilters.map((filter, idx) => (
                  <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-info/20 rounded text-xs">
                    <span className="text-accent font-medium">{filter.column}</span>
                    <span className="text-text-muted">{operatorLabels[filter.operator]}</span>
                    {filter.operator !== 'isNull' && filter.operator !== 'isNotNull' && (
                      <span className="text-info">"{filter.value}"</span>
                    )}
                    <button
                      onClick={() => removeColumnFilter(idx)}
                      className="ml-1 hover:text-error"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 快速添加筛选 - 仅在点击筛选按钮后显示 */}
              {showFilterPanel && activeTab.columnFilters.length < 5 && (
                <div className="flex items-center gap-1">
                  <select
                    value={filterColumn}
                    onChange={(e) => setFilterColumn(e.target.value)}
                    className="px-2 py-1 text-xs bg-hover rounded border border-border"
                    disabled={!activeTab}
                  >
                    {tableData?.columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <select
                    value={filterOperator}
                    onChange={(e) => setFilterOperator(e.target.value as FilterCondition['operator'])}
                    className="px-2 py-1 text-xs bg-hover rounded border border-border"
                  >
                    <option value="contains">包含</option>
                    <option value="equals">等于</option>
                    <option value="startsWith">开头是</option>
                    <option value="endsWith">结尾是</option>
                    <option value="greaterThan">大于</option>
                    <option value="lessThan">小于</option>
                    <option value="isNull">为空</option>
                    <option value="isNotNull">不为空</option>
                  </select>
                  {!['isNull', 'isNotNull'].includes(filterOperator) && (
                    <input
                      type="text"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      placeholder="值"
                      className="w-24 px-2 py-1 text-xs bg-hover rounded border border-border"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filterValue.trim()) {
                          // 直接添加筛选
                          const newFilter: FilterCondition = {
                            column: filterColumn,
                            operator: filterOperator,
                            value: filterValue.trim(),
                          }
                          setOpenTabs(prev => prev.map(tab =>
                            tab.id === activeTabId
                              ? { ...tab, columnFilters: [...tab.columnFilters, newFilter] }
                              : tab
                          ))
                          setFilterValue('')
                        }
                      }}
                    />
                  )}
                  <button
                    onClick={() => {
                      if (!['isNull', 'isNotNull'].includes(filterOperator) && !filterValue.trim()) return
                      const newFilter: FilterCondition = {
                        column: filterColumn,
                        operator: filterOperator,
                        value: filterOperator === 'isNull' || filterOperator === 'isNotNull' ? '' : filterValue.trim(),
                      }
                      setOpenTabs(prev => prev.map(tab =>
                        tab.id === activeTabId
                          ? { ...tab, columnFilters: [...tab.columnFilters, newFilter] }
                          : tab
                      ))
                      if (!['isNull', 'isNotNull'].includes(filterOperator)) {
                        setFilterValue('')
                      }
                    }}
                    disabled={!activeTab || (!['isNull', 'isNotNull'].includes(filterOperator) && !filterValue.trim())}
                    className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + 添加
                  </button>
                </div>
              )}

              {/* 清除所有按钮 */}
              {activeTab.columnFilters.length > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="px-2 py-1 text-xs text-error hover:text-error/80"
                >
                  清除全部
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {activeTab && (
          <div className="h-9 bg-toolbar-bg border-t border-border rounded-b-xl flex items-center justify-between px-3 mx-1 mb-1 text-xs">
            <span className="text-text-muted">
              {filteredTableData ? (
                <>
                  {filteredTableData.rows.length !== tableData?.rows.length ? (
                    <>
                      <span className="text-info">{filteredTableData.rows.length.toLocaleString()}</span>
                      <span className="mx-1">/</span>
                      <span>{tableData?.totalCount?.toLocaleString() ?? tableData?.rows.length} 条</span>
                    </>
                  ) : (
                    <>共 {tableData?.totalCount?.toLocaleString() ?? tableData?.rows.length} 条</>
                  )}
                </>
              ) : '加载中...'}
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
            {tableData?.columns
              // 新增模式下隐藏主键列（id 列）
              .filter(col => editingRow || !(col === 'id' || col === `${activeTab?.tableName}_id` || col.endsWith('_id')))
              .map((col) => (
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
              disabled={saving}
              className="px-4 py-2 bg-accent text-white rounded text-xs hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {saving ? '保存中...' : '保存'}
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dbPath}
                  onChange={(e) => { setDbPath(e.target.value); setDbPathError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && loadDatabase()}
                  placeholder="/path/to/database.db 或点击浏览选择"
                  className="flex-1"
                  autoFocus
                />
                <button
                  onClick={() => setShowFileBrowser(true)}
                  disabled={!activeConnection}
                  className="px-3 py-2 bg-hover hover:bg-hover/80 rounded text-xs font-medium text-text-dim hover:text-text transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="浏览远程文件"
                >
                  <FolderTree className="w-4 h-4" />
                  浏览
                </button>
              </div>
              {dbPathError && (
                <div className="flex items-center gap-1 mt-1.5 text-xs text-error">
                  <AlertCircle className="w-3 h-3" />
                  <span>{dbPathError}</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-text-muted">
              请输入远程服务器上的 SQLite 数据库文件路径，例如：/home/user/data/myapp.db，或点击"浏览"按钮选择文件
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

    {/* 文件浏览器 */}
    <FileBrowser
      isOpen={showFileBrowser}
      connectionId={activeConnectionId || ''}
      onSelect={(path) => {
        setDbPath(path)
        setShowFileBrowser(false)
      }}
      onClose={() => setShowFileBrowser(false)}
    />

    </>
  )
}
