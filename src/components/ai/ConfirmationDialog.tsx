/**
 * 危险操作确认对话框
 * 
 * 用于确认高风险 SQL 操作
 */

import { useState } from 'react'
import { 
  AlertTriangle, 
  X, 
  Eye, 
  Database,
  Trash2,
  AlertCircle,
  Check
} from 'lucide-react'
import type { DangerousOperation } from '../../types/ai'
import { SAFETY_CONFIG } from '../../types/ai'

interface ConfirmationDialogProps {
  operation: DangerousOperation
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({ 
  operation, 
  onConfirm, 
  onCancel 
}: ConfirmationDialogProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  
  const safety = SAFETY_CONFIG[operation.level]
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="relative w-[520px] max-h-[80vh] bg-panel rounded-2xl overflow-hidden"
        style={{ 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ 
                backgroundColor: `${safety.color}20`,
                color: safety.color 
              }}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-text">{operation.title}</h2>
              <p className="text-sm text-text-muted mt-1">
                此操作可能会对数据库造成不可逆的影响，请仔细确认。
              </p>
            </div>
            
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-hover text-text-muted hover:text-text transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[50vh]">
          {/* 安全级别标签 */}
          <div className="flex items-center gap-2">
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: `${safety.color}20`,
                color: safety.color 
              }}
            >
              {safety.icon} {safety.label}级别操作
            </span>
            
            {operation.impact.isDestructive && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-500">
                <Trash2 className="w-3 h-3 inline mr-1" />
                破坏性操作
              </span>
            )}
          </div>

          {/* SQL 预览 */}
          <div className="bg-code rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-border/30">
              <span className="text-xs text-text-muted font-medium">将要执行的 SQL</span>
              <span className="text-xs text-text-dim">{operation.operation.length} 字符</span>
            </div>
            <div className="p-3 overflow-x-auto">
              <code className="text-sm text-text font-mono whitespace-pre">
                {operation.operation}
              </code>
            </div>
          </div>

          {/* 影响信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-panel neu-inset">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <Database className="w-4 h-4" />
                <span className="text-xs">影响行数</span>
              </div>
              <p className="text-2xl font-semibold text-text">
                {operation.impact.affectedRows.toLocaleString()}
              </p>
            </div>
            
            <div className="p-3 rounded-xl bg-panel neu-inset">
              <div className="flex items-center gap-2 text-text-muted mb-1">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">受影响表</span>
              </div>
              <p className="text-2xl font-semibold text-text">
                {operation.impact.affectedTables.length || 1}
              </p>
            </div>
          </div>

          {/* 数据预览 */}
          {operation.preview && operation.preview.rows.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? '隐藏' : '显示'}受影响的数据预览
                <span className="text-text-muted">（前 {operation.preview.rows.length} 行）</span>
              </button>
              
              {showPreview && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-panel">
                      <tr>
                        {operation.preview.columns.map((col) => (
                          <th 
                            key={col}
                            className="px-3 py-2 text-left text-xs font-medium text-text-dim border-b border-border"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {operation.preview.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-hover/50">
                          {operation.preview!.columns.map((col) => (
                            <td 
                              key={col}
                              className="px-3 py-2 text-text text-xs truncate max-w-[120px]"
                            >
                              {String(row[col] ?? 'NULL')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 警告提示 */}
          <div className="p-4 rounded-xl bg-yellow-500/10 text-yellow-500 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">操作警告</p>
                <ul className="text-xs space-y-1 text-yellow-400">
                  <li>• 此操作将永久修改数据库中的数据</li>
                  <li>• 执行后无法通过撤销恢复</li>
                  <li>• 建议在执行前备份重要数据</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 二次确认 */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-hover/50 transition-colors">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="w-5 h-5 rounded border-border bg-panel text-accent focus:ring-accent mt-0.5"
            />
            <span className="text-sm text-text">
              我已了解此操作的风险，确认要执行这个<strong>{safety.label}</strong>级别的操作。
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-text hover:bg-hover transition-colors"
          >
            取消
          </button>
          
          <button
            onClick={onConfirm}
            disabled={!isConfirmed}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: safety.color,
              boxShadow: `0 4px 12px ${safety.color}40`
            }}
          >
            <Check className="w-4 h-4" />
            确认执行
          </button>
        </div>
      </div>
    </div>
  )
}
