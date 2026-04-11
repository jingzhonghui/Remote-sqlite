import { useState } from 'react'
import { Plus, Edit2, Trash2, Play, CheckCircle, XCircle, Loader2, Server, Key, Shield, Link, Unlink, Wifi, Circle, Database } from 'lucide-react'
import { useAppStore } from '../stores/useAppStore'
import type { SSHConfig } from '../types'

export default function ConnectionPage() {
  const { 
    savedConnections, 
    addConnection, 
    removeConnection, 
    connectionPool,
    activeConnectionId,
    addToPool,
    removeFromPool,
    setActiveConnectionId,
    currentDatabase,
    databases,
    removeDatabase,
    setCurrentDatabase,
  } = useAppStore()
  
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
  const [connectResult, setConnectResult] = useState<{ id: string; success: boolean; message: string } | null>(null)

  const [formData, setFormData] = useState<SSHConfig>({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: '',
    passphrase: '',
  })

  // 获取连接状态
  const getConnectionStatus = (configId: string) => {
    const conn = connectionPool.connections.find(c => c.configId === configId)
    return conn?.status || 'disconnected'
  }
  
  // 检查连接是否已激活
  const isConnected = (configId: string) => {
    return connectionPool.connections.some(c => c.configId === configId && c.status === 'connected')
  }
  
  // 获取连接的数据库
  const getConnectionDatabases = (configId: string) => {
    const conn = connectionPool.connections.find(c => c.configId === configId)
    if (!conn) return []
    return databases.filter(db => db.connectionId === conn.id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      const store = useAppStore.getState()
      store.updateConnection(editingId, formData)
    } else {
      addConnection({ ...formData, id: `conn_${Date.now()}` })
    }
    setShowForm(false)
    setEditingId(null)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: 22,
      username: '',
      authType: 'password',
      password: '',
      privateKey: '',
      passphrase: '',
    })
  }

  const handleEdit = (conn: SSHConfig) => {
    setFormData(conn)
    setEditingId(conn.id || null)
    setShowForm(true)
  }

  const handleTest = async (conn: SSHConfig) => {
    if (!conn.id) return
    setTestingId(conn.id)
    setTestResult(null)

    try {
      const result = await window.electronAPI.ssh.testConnection(conn)
      setTestResult({ id: conn.id, success: result.success, message: result.message })
    } catch (error) {
      setTestResult({ 
        id: conn.id, 
        success: false, 
        message: error instanceof Error ? error.message : '测试失败' 
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleConnect = async (conn: SSHConfig) => {
    if (!conn.id) return
    
    setConnectingId(conn.id)
    setConnectResult(null)
    
    try {
      const result = await window.electronAPI.ssh.connect(conn)
      if (result.success) {
        const newConnection = {
          id: result.connectionId,
          configId: conn.id,
          name: conn.name,
          host: conn.host,
          port: conn.port,
          username: conn.username,
          status: 'connected' as const,
          connectedAt: new Date(),
        }
        addToPool(newConnection)
        
        // 自动恢复之前打开的数据库
        const savedDbs = useAppStore.getState().databases.filter(db => db.connectionId === result.connectionId)
        for (const db of savedDbs) {
          try {
            const tablesResult = await window.electronAPI.sqlite.getTables(result.connectionId, db.path)
            if (tablesResult.success) {
              useAppStore.getState().addDatabase({
                ...db,
                tables: tablesResult.tables.map(name => ({
                  name,
                  columns: [],
                  indexes: [],
                  rowCount: undefined,
                })),
              })
            }
          } catch (e) {
            console.error(`恢复数据库 ${db.path} 失败:`, e)
          }
        }
        
        // 如果有之前选中的数据库，恢复选中状态
        const prevDb = savedDbs.find(db => db.path === useAppStore.getState().currentDatabase?.path)
        if (prevDb) {
          useAppStore.getState().setCurrentDatabase(prevDb)
        }
        
        setConnectResult({ id: conn.id, success: true, message: '连接成功！' + (savedDbs.length > 0 ? ` 已恢复 ${savedDbs.length} 个数据库。` : '') })
      } else {
        setConnectResult({ id: conn.id, success: false, message: result.message || '连接失败' })
      }
    } catch (error) {
      console.error('连接失败:', error)
      setConnectResult({ id: conn.id, success: false, message: error instanceof Error ? error.message : '连接失败' })
    } finally {
      setConnectingId(null)
    }
  }

  // 断开连接
  const handleDisconnect = async (conn: SSHConfig) => {
    if (!conn.id) return
    
    // 找到池中的连接
    const poolConn = connectionPool.connections.find(c => c.configId === conn.id)
    if (!poolConn) return
    
    try {
      await removeFromPool(poolConn.id)
      setConnectResult({ id: conn.id, success: true, message: '已断开连接' })
    } catch (error) {
      console.error('断开连接失败:', error)
      setConnectResult({ id: conn.id, success: false, message: '断开连接失败' })
    }
  }
  
  // 删除连接（包含断开）
  const handleDelete = async (conn: SSHConfig) => {
    if (!conn.id) return
    
    const poolConn = connectionPool.connections.find(c => c.configId === conn.id)
    if (poolConn) {
      if (!confirm('该连接处于活跃状态，确定要删除吗？将同时断开连接。')) return
    } else {
      if (!confirm('确定要删除该连接配置吗？')) return
    }
    
    await removeConnection(conn.id)
  }
  
  // 切换活动连接
  const handleSetActive = (conn: SSHConfig) => {
    const poolConn = connectionPool.connections.find(c => c.configId === conn.id)
    if (poolConn) {
      setActiveConnectionId(poolConn.id)
    }
  }
  
  // 选择数据库
  const handleSelectDatabase = (db: typeof databases[0]) => {
    setCurrentDatabase(db)
    // 同时切换到对应的连接
    setActiveConnectionId(db.connectionId)
  }
  
  // 关闭数据库
  const handleCloseDatabase = (connId: string, dbPath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeDatabase(connId, dbPath)
  }

  // 状态指示灯组件
  const StatusIndicator = ({ status }: { status: string }) => {
    if (status === 'connected') {
      return (
        <div className="flex items-center gap-1 text-success">
          <Circle className="w-2 h-2 fill-success" />
          <span className="text-[10px]">已连接</span>
        </div>
      )
    }
    if (status === 'connecting') {
      return (
        <div className="flex items-center gap-1 text-warning">
          <Circle className="w-2 h-2 fill-warning animate-pulse" />
          <span className="text-[10px]">连接中</span>
        </div>
      )
    }
    if (status === 'error') {
      return (
        <div className="flex items-center gap-1 text-error">
          <Circle className="w-2 h-2 fill-error" />
          <span className="text-[10px]">错误</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-text-muted">
        <Circle className="w-2 h-2 fill-current opacity-30" />
        <span className="text-[10px]">未连接</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-12 bg-toolbar-bg border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium">连接管理</h1>
          {connectionPool.connections.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-success/10 rounded-full">
              <Wifi className="w-3 h-3 text-success" />
              <span className="text-[10px] text-success">{connectionPool.connections.length} 个活跃连接</span>
            </div>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); resetForm() }}
          className="flex items-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-medium neu-btn-primary"
        >
          <Plus className="w-4 h-4" />
          新建连接
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {/* 已打开的数据库快捷栏 */}
        {databases.length > 0 && (
          <div className="mb-4 p-3 bg-panel rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                已打开的数据库
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {databases.map((db) => {
                const isActive = currentDatabase?.path === db.path && currentDatabase?.connectionId === db.connectionId
                return (
                  <button
                    key={`${db.connectionId}-${db.path}`}
                    onClick={() => handleSelectDatabase(db)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isActive 
                        ? 'neu-btn-primary text-white' 
                        : 'round-btn text-text hover:text-accent'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span className="max-w-[120px] truncate">{db.name}</span>
                    <button
                      onClick={(e) => handleCloseDatabase(db.connectionId, db.path, e)}
                      className="ml-1 p-0.5 rounded hover:text-error transition-colors"
                    >
                      ×
                    </button>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 连接池视图 */}
        {connectionPool.connections.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5" />
              活跃连接池
            </h3>
            <div className="flex gap-3 flex-wrap">
              {connectionPool.connections.map((conn) => {
                return (
                  <div
                    key={conn.id}
                    onClick={() => setActiveConnectionId(conn.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
                      activeConnectionId === conn.id
                        ? 'neu-inset'
                        : 'neu-btn hover:scale-[1.02]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/20">
                      <Server className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{conn.name}</div>
                      <div className="text-xs text-text-muted">{conn.host}:{conn.port}</div>
                    </div>
                    {activeConnectionId === conn.id && (
                      <div className="ml-2 w-2.5 h-2.5 rounded-full bg-success shadow-lg animate-pulse" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 连接列表 */}
        {savedConnections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted">
            <Server className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无保存的连接</p>
            <p className="text-xs mt-1">点击右上角按钮添加新连接</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedConnections.map((conn) => {
              const status = getConnectionStatus(conn.id!)
              const connected = isConnected(conn.id!)
              const isActive = activeConnectionId && connectionPool.connections.find(c => c.id === activeConnectionId)?.configId === conn.id
              const isConnecting = connectingId === conn.id
              const connDatabases = getConnectionDatabases(conn.id!)
              
              return (
                <div
                  key={conn.id}
                  className={`rounded-2xl p-5 transition-all ${
                    isActive 
                      ? 'neu-inset' 
                      : connected
                        ? 'neu-card'
                        : 'neu-card hover:scale-[1.01]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${connected ? 'bg-success/20' : 'bg-accent/10'}`}>
                        <Server className={`w-4 h-4 ${connected ? 'text-success' : 'text-accent'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{conn.name}</h3>
                        <StatusIndicator status={status} />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(conn)}
                        className="p-2 text-text-muted hover:text-accent rounded-xl round-btn"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(conn)}
                        className="p-2 text-text-muted hover:text-error rounded-xl round-btn"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-text-dim mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14">主机:</span>
                      <span>{conn.host}:{conn.port}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14">用户:</span>
                      <span>{conn.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted w-14">认证:</span>
                      <span className="flex items-center gap-1">
                        {conn.authType === 'password' && <Key className="w-3 h-3" />}
                        {conn.authType === 'privateKey' && <Shield className="w-3 h-3" />}
                        {conn.authType === 'password' && '密码'}
                        {conn.authType === 'privateKey' && '私钥'}
                        {conn.authType === 'agent' && 'SSH Agent'}
                      </span>
                    </div>
                  </div>

                  {/* 连接的数据库列表 */}
                  {connDatabases.length > 0 && (
                    <div className="mb-3 p-2 bg-hover rounded">
                      <div className="text-[10px] text-text-muted mb-1">已打开的数据库:</div>
                      <div className="flex flex-wrap gap-1">
                        {connDatabases.map((db) => (
                          <span 
                            key={db.path}
                            className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded flex items-center gap-1"
                          >
                            <Database className="w-2.5 h-2.5" />
                            {db.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 测试结果提示 */}
                  {testResult?.id === conn.id && testResult && (
                    <div className={`mb-2 p-2 rounded text-xs flex items-center gap-1.5 ${
                      testResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                      {testResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {testResult.message}
                    </div>
                  )}

                  {/* 连接结果提示 */}
                  {connectResult?.id === conn.id && connectResult && (
                    <div className={`mb-2 p-2 rounded text-xs flex items-center gap-1.5 ${
                      connectResult.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                      {connectResult.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {connectResult.message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTest(conn)}
                      disabled={testingId === conn.id || isConnecting}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-text rounded-xl text-xs font-medium round-btn hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {testingId === conn.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {testingId === conn.id ? '测试中...' : '测试'}
                    </button>
                    
                    {connected ? (
                      <>
                        <button
                          onClick={() => handleSetActive(conn)}
                          className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                            isActive 
                              ? 'neu-inset text-success' 
                              : 'round-btn text-info hover:text-success'
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {isActive ? '当前' : '激活'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(conn)}
                          className="flex-1 px-3 py-2 text-error rounded-xl text-xs font-medium round-btn hover:scale-[1.02] flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Unlink className="w-4 h-4" />
                          断开
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(conn)}
                        disabled={isConnecting}
                        className="flex-1 px-3 py-2 text-white rounded-xl text-xs font-medium neu-btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link className="w-4 h-4" />
                        )}
                        {isConnecting ? '连接中...' : '连接'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="neu-card w-[480px] max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="text-lg font-semibold">{editingId ? '编辑连接' : '新建连接'}</h2>
              <p className="text-xs text-text-muted mt-1">配置 SSH 连接信息</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">连接名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如: 生产服务器"
                  className="w-full"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-text-muted mb-1">主机地址</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">端口</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full"
                    min={1}
                    max={65535}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1">用户名</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="root"
                  className="w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-text-dim mb-2 font-medium">认证方式</label>
                <div className="flex gap-2">
                  {(['password', 'privateKey', 'agent'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, authType: type })}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                        formData.authType === type
                          ? 'neu-inset text-accent'
                          : 'round-btn text-text-muted hover:text-accent'
                      }`}
                    >
                      {type === 'password' && '密码'}
                      {type === 'privateKey' && '私钥'}
                      {type === 'agent' && 'SSH Agent'}
                    </button>
                  ))}
                </div>
              </div>

              {formData.authType === 'password' && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">密码</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full"
                  />
                </div>
              )}

              {formData.authType === 'privateKey' && (
                <>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">私钥内容</label>
                    <textarea
                      value={formData.privateKey}
                      onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className="w-full h-24 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">私钥密码（可选）</label>
                    <input
                      type="password"
                      value={formData.passphrase}
                      onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-medium text-text-muted rounded-xl round-btn hover:text-text"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white rounded-xl text-xs font-medium neu-btn-primary"
                >
                  {editingId ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
