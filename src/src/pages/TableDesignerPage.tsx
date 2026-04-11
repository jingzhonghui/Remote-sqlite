import { useState } from 'react'
import { 
  Plus, Trash2, ArrowUp, ArrowDown, Key, Lock, 
  Hash, Type, ToggleLeft, Binary, Save, Copy 
} from 'lucide-react'
import type { ColumnDefinition, ForeignKeyDefinition, IndexDefinition } from '../types'

const DATA_TYPES = [
  'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC',
  'VARCHAR', 'CHAR', 'BOOLEAN', 'DATE', 'DATETIME',
  'DECIMAL', 'FLOAT', 'DOUBLE', 'SMALLINT', 'BIGINT'
]

export default function TableDesignerPage() {
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    {
      id: 'col_1',
      name: 'id',
      type: 'INTEGER',
      nullable: false,
      isPrimaryKey: true,
      isAutoIncrement: true,
      isUnique: false,
    },
  ])
  const [foreignKeys] = useState<ForeignKeyDefinition[]>([])
  const [indexes, setIndexes] = useState<IndexDefinition[]>([])
  const [activeTab, setActiveTab] = useState<'columns' | 'indexes' | 'ddl'>('columns')

  const addColumn = () => {
    const newColumn: ColumnDefinition = {
      id: `col_${Date.now()}`,
      name: '',
      type: 'TEXT',
      nullable: true,
      isPrimaryKey: false,
      isAutoIncrement: false,
      isUnique: false,
    }
    setColumns([...columns, newColumn])
  }

  const removeColumn = (id: string) => {
    setColumns(columns.filter((c) => c.id !== id))
  }

  const updateColumn = (id: string, updates: Partial<ColumnDefinition>) => {
    setColumns(columns.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const moveColumn = (id: string, direction: 'up' | 'down') => {
    const idx = columns.findIndex((c) => c.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === columns.length - 1) return

    const newColumns = [...columns]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newColumns[idx], newColumns[targetIdx]] = [newColumns[targetIdx], newColumns[idx]]
    setColumns(newColumns)
  }

  const generateDDL = (): string => {
    if (!tableName || columns.length === 0) return ''

    const colDefs = columns.map((col) => {
      let def = `  ${col.name} ${col.type}`
      if (col.isPrimaryKey) def += ' PRIMARY KEY'
      if (col.isAutoIncrement) def += ' AUTOINCREMENT'
      if (col.isUnique && !col.isPrimaryKey) def += ' UNIQUE'
      if (!col.nullable) def += ' NOT NULL'
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
      return def
    })

    const fkDefs = foreignKeys.map((fk) => {
      return `  FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn})`
    })

    return `CREATE TABLE ${tableName} (\n${[...colDefs, ...fkDefs].join(',\n')}\n);`
  }

  const copyDDL = () => {
    navigator.clipboard.writeText(generateDDL())
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-12 bg-toolbar-bg border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">可视化建表</h1>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="输入表名"
            className="w-48 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn">
            <Copy className="w-3.5 h-3.5" />
            复制 SQL
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary">
            <Save className="w-3.5 h-3.5" />
            执行建表
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border bg-toolbar-bg">
        {[
          { key: 'columns', label: '列定义', icon: Type },
          { key: 'indexes', label: '索引', icon: Hash },
          { key: 'ddl', label: 'DDL 预览', icon: Binary },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs ${
              activeTab === tab.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'columns' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">共 {columns.length} 列</span>
              <button
                onClick={addColumn}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                添加列
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
                          <button
                            onClick={() => moveColumn(col.id, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 hover:bg-hover rounded disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveColumn(col.id, 'down')}
                            disabled={idx === columns.length - 1}
                            className="p-0.5 hover:bg-hover rounded disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                          className="w-full bg-transparent border-0 p-0 focus:ring-0"
                          placeholder="列名"
                        />
                      </td>
                      <td>
                        <select
                          value={col.type}
                          onChange={(e) => updateColumn(col.id, { type: e.target.value })}
                          className="w-full bg-transparent border-0 p-0 text-xs"
                        >
                          {DATA_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={col.length || ''}
                          onChange={(e) => updateColumn(col.id, { length: parseInt(e.target.value) || undefined })}
                          className="w-full bg-transparent border-0 p-0 text-center"
                          placeholder="-"
                        />
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => updateColumn(col.id, { isPrimaryKey: !col.isPrimaryKey })}
                          className={`p-1 rounded ${col.isPrimaryKey ? 'text-accent' : 'text-text-muted'}`}
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => updateColumn(col.id, { isAutoIncrement: !col.isAutoIncrement })}
                          className={`p-1 rounded ${col.isAutoIncrement ? 'text-accent2' : 'text-text-muted'}`}
                          disabled={!col.isPrimaryKey}
                        >
                          <Hash className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => updateColumn(col.id, { nullable: !col.nullable })}
                          className={`p-1 rounded ${!col.nullable ? 'text-warning' : 'text-text-muted'}`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => updateColumn(col.id, { isUnique: !col.isUnique })}
                          className={`p-1 rounded ${col.isUnique ? 'text-success' : 'text-text-muted'}`}
                        >
                          <ToggleLeft className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={col.defaultValue || ''}
                          onChange={(e) => updateColumn(col.id, { defaultValue: e.target.value })}
                          className="w-full bg-transparent border-0 p-0"
                          placeholder="NULL"
                        />
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() => removeColumn(col.id)}
                          className="p-1.5 hover:bg-hover rounded text-error"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'indexes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">索引定义</span>
              <button
                onClick={() => setIndexes([...indexes, { id: `idx_${Date.now()}`, name: '', columns: [], unique: false }])}
                className="flex items-center gap-1.5 px-4 py-2 text-white text-xs font-medium transition-all neu-btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                添加索引
              </button>
            </div>

            <div className="space-y-2">
              {indexes.map((idx) => (
                <div key={idx.id} className="bg-panel border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={idx.name}
                      onChange={(e) => {
                        const updated = indexes.map((i) =>
                          i.id === idx.id ? { ...i, name: e.target.value } : i
                        )
                        setIndexes(updated)
                      }}
                      placeholder="索引名"
                      className="w-48"
                    />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={idx.unique}
                        onChange={(e) => {
                          const updated = indexes.map((i) =>
                            i.id === idx.id ? { ...i, unique: e.target.checked } : i
                          )
                          setIndexes(updated)
                        }}
                      />
                      唯一
                    </label>
                    <button
                      onClick={() => setIndexes(indexes.filter((i) => i.id !== idx.id))}
                      className="ml-auto p-1.5 hover:bg-hover rounded text-error"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {indexes.length === 0 && (
                <p className="text-xs text-text-muted text-center py-8">暂无索引定义</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ddl' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-muted">生成的 DDL 语句</span>
              <button
                onClick={copyDDL}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all neu-btn"
              >
                <Copy className="w-3.5 h-3.5" />
                复制
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
