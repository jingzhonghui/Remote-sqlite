import { useState, useEffect } from 'react'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Key, Lock,
  Hash, Type, ToggleLeft, Binary, Save, Copy,
  X, Eye, Loader2, Database, Table2, FileSpreadsheet, AlertCircle
} from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import type { ColumnDefinition, ForeignKeyDefinition, IndexDefinition } from '../types'

const DATA_TYPES = [
  'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC',
  'VARCHAR', 'CHAR', 'BOOLEAN', 'DATE', 'DATETIME',
  'DECIMAL', 'FLOAT', 'DOUBLE', 'SMALLINT', 'BIGINT'
]

function TableStructureViewer({ tableName }: { tableName: string }) {
  const getActiveConnection = useAppStore(s => s.getActiveConnection)
  const currentDatabase = useAppStore(s => s.currentDatabase)
  const [columns, setColumns] = useState<any[]>([])
  const [indexes, setIndexes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const conn = getActiveConnection()
    if (!conn || !currentDatabase) {
      setError('未连接数据库')
      setLoading(false)
      return
    }
    Promise.all([
      window.electronAPI.sqlite.getTableInfo(conn.id, currentDatabase.path, tableName),
      window.electronAPI.sqlite.getIndexes(conn.id, currentDatabase.path, tableName),
    ]).then(([infoRes, idxRes]) => {
      if (infoRes.success) {
        setColumns(infoRes.columns)
        setIndexes(idxRes.success ? idxRes.indexes : [])
      } else {
        setError(infoRes.message || '获取表结构失败')
      }
      setLoading(false)
    }).catch(e => {
      setError(e instanceof Error ? e.message : '未知错误')
      setLoading(false)
    })
  }, [tableName, getActiveConnection, currentDatabase])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <AlertCircle className="w-4 h-4 mr-2" />{error}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-dim mb-3 flex items-center gap-2">
          <Table2 className="w-4 h-4" />
          列定义 ({columns.length})
        </h3>
        <div className="bg-panel border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-header-bg">
                <th className="px-3 py-2 text-left">名称</th>
                <th className="px-3 py-2 text-left">类型</th>
                <th className="px-3 py-2 text-center">非空</th>
                <th className="px-3 py-2 text-center">主键</th>
                <th className="px-3 py-2 text-left">默认值</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr key={col.cid} className="border-t border-border hover:bg-hover">
                  <td className="px-3 py-2 font-medium">{col.name}</td>
                  <td className="px-3 py-2 text-text-dim">{col.type}</td>
                  <td className="px-3 py-2 text-center">
                    {col.notnull ? <span className="text-success">✓</span> : <span className="text-text-muted">-</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {col.pk ? <span className="text-accent font-bold">PK</span> : <span className="text-text-muted">-</span>}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {col.dflt_value !== null ? col.dflt_value : <span className="italic">NULL</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {indexes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-dim mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            索引 ({indexes.length})
          </h3>
          <div className="bg-panel border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-header-bg">
                  <th className="px-3 py-2 text-left">索引名</th>
                  <th className="px-3 py-2 text-center">唯一</th>
                  <th className="px-3 py-2 text-left">列</th>
                </tr>
              </thead>
              <tbody>
                {indexes.map((idx: any, i: number) => (
                  <tr key={i} className="border-t border-border hover:bg-hover">
                    <td className="px-3 py-2 font-medium">{idx.name}</td>
                    <td className="px-3 py-2 text-center">
                      {idx.unique ? <span className="text-success">✓</span> : <span className="text-text-muted">-</span>}
                    </td>
                    <td className="px-3 py-2 text-text-dim">{idx.columns?.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function TableCreateEditor() {
  const getActiveConnection = useAppStore(s => s.getActiveConnection)
  const currentDatabase = useAppStore(s => s.currentDatabase)
  const addDatabase = useAppStore(s => s.addDatabase)
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { id: 'col_1', name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isAutoIncrement: true, isUnique: false },
  ])
  const [foreignKeys] = useState<ForeignKeyDefinition[]>([])
  const [indexes, setIndexes] = useState<IndexDefinition[]>([])
  const [activeSubTab, setActiveSubTab] = useState<'columns' | 'indexes' | 'ddl'>('columns')
  const [executing, setExecuting] = useState(false)

  const addColumn = () => {
    setColumns([...columns, {
      id: `col_${Date.now()}`, name: '', type: 'TEXT',
      nullable: true, isPrimaryKey: false, isAutoIncrement: false, isUnique: false,
    }])
  }

  const removeColumn = (id: string) => setColumns(columns.filter(c => c.id !== id))

  const updateColumn = (id: string, updates: Partial<ColumnDefinition>) => {
    setColumns(columns.map(c => c.id === id ? { ...c, ...updates } : c))
  }

  const moveColumn = (id: string, direction: 'up' | 'down') => {
    const idx = columns.findIndex(c => c.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === columns.length - 1) return
    const arr = [...columns]
    const t = direction === 'up' ? idx - 1 : idx + 1
    ;[arr[idx], arr[t]] = [arr[t], arr[idx]]
    setColumns(arr)
  }

  const generateDDL = (): string => {
    if (!tableName || columns.length === 0) return ''
    const colDefs = columns.map(col => {
      let d = `  ${col.name} ${col.type}`
      if (col.isPrimaryKey) d += ' PRIMARY KEY'
      if (col.isAutoIncrement) d += ' AUTOINCREMENT'
      if (col.isUnique && !col.isPrimaryKey) d += ' UNIQUE'
      if (!col.nullable) d += ' NOT NULL'
      if (col.defaultValue) d += ` DEFAULT ${col.defaultValue}`
      return d
    })
    const fkDefs = foreignKeys.map(fk => `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn})`)
    return `CREATE TABLE ${tableName} (\n${[...colDefs, ...fkDefs].join(',\n')}\n);`
  }

  const handleExecute = async () => {
    const conn = getActiveConnection()
    if (!conn || !currentDatabase || !tableName.trim()) return
    const ddl = generateDDL()
    if (!ddl) return
    setExecuting(true)
    try {
      const result = await window.electronAPI.sqlite.execute(conn.id, currentDatabase.path, ddl)
      if (result.success) {
        alert(`表 "${tableName}" 创建成功`)
        // 刷新数据库表列表
        try {
          const tablesResult = await window.electronAPI.sqlite.getTables(conn.id, currentDatabase.path)
          if (tablesResult.success) {
            const dbName = currentDatabase.path.split('/').pop() || currentDatabase.path
            addDatabase({
              path: currentDatabase.path,
              name: dbName,
              tables: tablesResult.tables.map(name => ({ name, columns: [], indexes: [], rowCount: undefined })),
              connectionId: conn.id,
            })
          }
        } catch (e) {
          console.error('刷新数据库表列表失败:', e)
        }
      } else {
        alert(`创建失败: ${result.message}`)
      }
    } catch (e) {
      alert(`创建失败: ${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-toolbar-bg">
        <input
          type="text"
          value={tableName}
          onChange={e => setTableName(e.target.value)}
          placeholder="输入表名"
          className="w-48 text-sm"
        />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => navigator.clipboard.writeText(generateDDL())} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn">
            <Copy className="w-3.5 h-3.5" />复制 SQL
          </button>
          <button onClick={handleExecute} disabled={executing || !tableName.trim()} className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary disabled:opacity-50">
            {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            执行建表
          </button>
        </div>
      </div>

      <div className="flex border-b border-border bg-toolbar-bg">
        {[
          { key: 'columns' as const, label: '列定义', icon: Type },
          { key: 'indexes' as const, label: '索引', icon: Hash },
          { key: 'ddl' as const, label: 'DDL 预览', icon: Binary },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs ${activeSubTab === tab.key ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text'}`}
          >
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeSubTab === 'columns' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">共 {columns.length} 列</span>
              <button onClick={addColumn} className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary">
                <Plus className="w-3.5 h-3.5" />添加列
              </button>
            </div>
            <div className="bg-panel border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-header-bg">
                    <th className="w-8"></th>
                    <th className="text-left">列名</th>
                    <th className="text-left w-28">类型</th>
                    <th className="text-center w-20">长度</th>
                    <th className="text-center w-16">PK</th>
                    <th className="text-center w-16">AI</th>
                    <th className="text-center w-16">NN</th>
                    <th className="text-center w-16">UQ</th>
                    <th className="text-left w-32">默认值</th>
                    <th className="text-center w-20">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col, idx) => (
                    <tr key={col.id} className="border-t border-border">
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <button onClick={() => moveColumn(col.id, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-hover rounded disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                          <button onClick={() => moveColumn(col.id, 'down')} disabled={idx === columns.length - 1} className="p-0.5 hover:bg-hover rounded disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                        </div>
                      </td>
                      <td><input type="text" value={col.name} onChange={e => updateColumn(col.id, { name: e.target.value })} className="w-full bg-transparent border-0 p-0 focus:ring-0" placeholder="列名" /></td>
                      <td>
                        <select value={col.type} onChange={e => updateColumn(col.id, { type: e.target.value })} className="w-full bg-transparent border-0 p-0 text-xs">
                          {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={col.length || ''} onChange={e => updateColumn(col.id, { length: parseInt(e.target.value) || undefined })} className="w-full bg-transparent border-0 p-0 text-center" placeholder="-" /></td>
                      <td className="text-center"><button onClick={() => updateColumn(col.id, { isPrimaryKey: !col.isPrimaryKey })} className={`p-1 rounded ${col.isPrimaryKey ? 'text-accent' : 'text-text-muted'}`}><Key className="w-3.5 h-3.5" /></button></td>
                      <td className="text-center"><button onClick={() => updateColumn(col.id, { isAutoIncrement: !col.isAutoIncrement })} className={`p-1 rounded ${col.isAutoIncrement ? 'text-accent2' : 'text-text-muted'}`} disabled={!col.isPrimaryKey}><Hash className="w-3.5 h-3.5" /></button></td>
                      <td className="text-center"><button onClick={() => updateColumn(col.id, { nullable: !col.nullable })} className={`p-1 rounded ${!col.nullable ? 'text-warning' : 'text-text-muted'}`}><Lock className="w-3.5 h-3.5" /></button></td>
                      <td className="text-center"><button onClick={() => updateColumn(col.id, { isUnique: !col.isUnique })} className={`p-1 rounded ${col.isUnique ? 'text-success' : 'text-text-muted'}`}><ToggleLeft className="w-3.5 h-3.5" /></button></td>
                      <td><input type="text" value={col.defaultValue || ''} onChange={e => updateColumn(col.id, { defaultValue: e.target.value })} className="w-full bg-transparent border-0 p-0" placeholder="NULL" /></td>
                      <td className="text-center"><button onClick={() => removeColumn(col.id)} className="p-1.5 hover:bg-hover rounded text-error"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {activeSubTab === 'indexes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">索引定义</span>
              <button onClick={() => setIndexes([...indexes, { id: `idx_${Date.now()}`, name: '', columns: [], unique: false }])} className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary">
                <Plus className="w-3.5 h-3.5" />添加索引
              </button>
            </div>
            <div className="space-y-2">
              {indexes.map(idx => (
                <div key={idx.id} className="bg-panel border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <input type="text" value={idx.name} onChange={e => setIndexes(indexes.map(i => i.id === idx.id ? { ...i, name: e.target.value } : i))} placeholder="索引名" className="w-48" />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={idx.unique} onChange={e => setIndexes(indexes.map(i => i.id === idx.id ? { ...i, unique: e.target.checked } : i))} />唯一
                    </label>
                    <button onClick={() => setIndexes(indexes.filter(i => i.id !== idx.id))} className="ml-auto p-1.5 hover:bg-hover rounded text-error"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
              {indexes.length === 0 && <p className="text-xs text-text-muted text-center py-8">暂无索引定义</p>}
            </div>
          </div>
        )}
        {activeSubTab === 'ddl' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">生成的 DDL 语句</span>
              <button onClick={() => navigator.clipboard.writeText(generateDDL())} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn">
                <Copy className="w-3.5 h-3.5" />复制
              </button>
            </div>
            <pre className="bg-panel border border-border rounded-lg p-4 font-mono text-xs text-text-dim overflow-auto">
              {generateDDL() || '-- 请输入表名并添加列定义'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TableDesignerPage() {
  const {
    designerTabs,
    activeDesignerTabId,
    removeDesignerTab,
    setActiveDesignerTabId,
    addDesignerTab,
    currentDatabase,
    connectionPool,
    activeConnectionId,
  } = useAppStore()

  const activeConnection = connectionPool.connections.find(c => c.id === activeConnectionId)
  const activeTab = designerTabs.find(t => t.id === activeDesignerTabId)

  const handleNewTable = () => {
    addDesignerTab({
      id: `create_${Date.now()}`,
      mode: 'create',
      title: '新建表',
    })
  }

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    removeDesignerTab(tabId)
  }

  if (!activeConnection) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <Database className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">未连接到任何服务器</p>
        <p className="text-xs mt-2">请先前往"连接管理"页面建立连接</p>
      </div>
    )
  }

  if (!currentDatabase) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <Database className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">请先打开一个数据库</p>
        <p className="text-xs mt-2">请在数据选项卡中打开数据库</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="h-10 bg-toolbar-bg border-b border-border rounded-t-xl flex items-center overflow-x-auto">
        {designerTabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveDesignerTabId(tab.id)}
            className={`flex items-center gap-2 px-4 h-full cursor-pointer border-r border-border text-xs whitespace-nowrap ${
              activeDesignerTabId === tab.id
                ? 'bg-panel text-accent border-b-2 border-b-accent'
                : 'text-text-muted hover:bg-hover hover:text-text'
            }`}
          >
            {tab.mode === 'view' ? <Eye className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{tab.title}</span>
            <button onClick={e => handleCloseTab(tab.id, e)} className="p-0.5 hover:bg-hover rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          onClick={handleNewTable}
          className="flex items-center gap-1 px-3 h-full text-text-muted hover:text-accent text-xs"
          title="新建表"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab ? (
          activeTab.mode === 'view' && activeTab.tableName ? (
            <TableStructureViewer key={activeTab.id} tableName={activeTab.tableName} />
          ) : (
            <TableCreateEditor key={activeTab.id} />
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <Table2 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">可视化表设计器</p>
            <p className="text-xs mt-2">点击右侧 "+" 新建表，或在数据页右键表名查看结构</p>
            <button
              onClick={handleNewTable}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary"
            >
              <Plus className="w-4 h-4" />新建表
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
