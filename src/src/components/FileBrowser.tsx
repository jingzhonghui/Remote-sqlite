import { useState, useEffect, useCallback } from 'react'
import { 
  Folder, File, ChevronRight, ChevronLeft, Home, 
  RefreshCw, X, Check, FileSpreadsheet, FolderOpen,
  AlertCircle, Loader2
} from 'lucide-react'

interface FileBrowserProps {
  isOpen: boolean
  connectionId: string
  initialPath?: string
  onSelect: (path: string) => void
  onClose: () => void
}

interface FileItem {
  name: string
  type: 'file' | 'directory' | 'link'
  size: number
  modified: string
  isDbFile: boolean
}

interface DirectoryResult {
  success: boolean
  path: string
  parent: string | null
  items: FileItem[]
  message?: string
}

export default function FileBrowser({ isOpen, connectionId, initialPath = '~', onSelect, onClose }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null)
  const [pathHistory, setPathHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const loadDirectory = useCallback(async (path: string) => {
    if (!connectionId) return
    
    setLoading(true)
    setError('')
    setSelectedItem(null)

    try {
      const result: DirectoryResult = await window.electronAPI.ssh.listDirectory(connectionId, path)
      
      if (result.success) {
        setCurrentPath(result.path)
        setItems(result.items)
      } else {
        setError(result.message || '无法加载目录')
        setItems([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载目录失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  // 初始加载
  useEffect(() => {
    if (isOpen && connectionId) {
      loadDirectory(initialPath)
      setPathHistory([initialPath])
      setHistoryIndex(0)
    }
  }, [isOpen, connectionId, initialPath, loadDirectory])

  const navigateTo = (path: string) => {
    // 添加到历史记录
    const newHistory = pathHistory.slice(0, historyIndex + 1)
    newHistory.push(path)
    setPathHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    loadDirectory(path)
  }

  const navigateBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      loadDirectory(pathHistory[newIndex])
    }
  }

  const navigateForward = () => {
    if (historyIndex < pathHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      loadDirectory(pathHistory[newIndex])
    }
  }

  const navigateUp = () => {
    if (currentPath === '~' || currentPath === '/') return
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/'
    navigateTo(parent)
  }

  const navigateHome = () => {
    navigateTo('~')
  }

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      const newPath = currentPath === '~' 
        ? `~/${item.name}`
        : `${currentPath}/${item.name}`
      navigateTo(newPath)
    } else {
      setSelectedItem(item)
    }
  }

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === 'directory') {
      const newPath = currentPath === '~' 
        ? `~/${item.name}`
        : `${currentPath}/${item.name}`
      navigateTo(newPath)
    } else if (item.isDbFile) {
      const fullPath = currentPath === '~' 
        ? `~/${item.name}`
        : `${currentPath}/${item.name}`
      onSelect(fullPath)
    }
  }

  const handleSelect = () => {
    if (selectedItem?.isDbFile) {
      const fullPath = currentPath === '~' 
        ? `~/${selectedItem.name}`
        : `${currentPath}/${selectedItem.name}`
      onSelect(fullPath)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.25)' }}
        onClick={onClose}
      />
      
      {/* Browser Panel */}
      <div 
        className="relative w-[700px] h-[500px] flex flex-col overflow-hidden bg-panel rounded-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text">选择数据库文件</h2>
            <p className="text-xs text-text-muted mt-1">浏览远程服务器上的 SQLite 数据库文件</p>
          </div>
          <button
            onClick={onClose}
            className="round-btn p-2 text-text-muted hover:text-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-toolbar-bg/50">
          <button
            onClick={navigateBack}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="后退"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={navigateForward}
            disabled={historyIndex >= pathHistory.length - 1}
            className="p-1.5 rounded hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="前进"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={navigateUp}
            disabled={currentPath === '~' || currentPath === '/'}
            className="p-1.5 rounded hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
            title="上级目录"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={navigateHome}
            className="p-1.5 rounded hover:bg-hover"
            title="主目录"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            className="p-1.5 rounded hover:bg-hover disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex-1 mx-2">
            <div className="neu-inset px-3 py-1.5 rounded text-xs text-text-dim truncate">
              {currentPath}
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto p-2">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs">加载中...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-error">
              <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-xs">{error}</p>
              <button
                onClick={() => loadDirectory(currentPath)}
                className="mt-3 px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/90"
              >
                重试
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <Folder className="w-12 h-12 mb-2 opacity-30" />
              <p className="text-xs">空目录</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.name}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    selectedItem?.name === item.name
                      ? 'bg-accent/20 border border-accent/30'
                      : 'hover:bg-hover border border-transparent'
                  } ${item.isDbFile ? 'bg-success/5' : ''}`}
                >
                  {item.type === 'directory' ? (
                    <Folder className="w-5 h-5 text-warning flex-shrink-0" />
                  ) : item.isDbFile ? (
                    <FileSpreadsheet className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <File className="w-5 h-5 text-text-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm truncate ${item.isDbFile ? 'text-success font-medium' : 'text-text'}`}>
                      {item.name}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {item.type === 'directory' ? '文件夹' : formatSize(item.size)}
                    </div>
                  </div>
                  <div className="text-[10px] text-text-muted flex-shrink-0">
                    {item.modified}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-toolbar-bg/30">
          <div className="text-xs text-text-muted">
            {selectedItem ? (
              selectedItem.isDbFile ? (
                <span className="text-success">已选择: {selectedItem.name}</span>
              ) : (
                <span className="text-warning">请选择 .db/.sqlite/.sqlite3 文件</span>
              )
            ) : (
              '单击选择文件，双击打开文件夹'
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-text-muted hover:text-text rounded-lg hover:bg-hover transition-all"
            >
              取消
            </button>
            <button
              onClick={handleSelect}
              disabled={!selectedItem?.isDbFile}
              className="px-4 py-2 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              选择此文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}