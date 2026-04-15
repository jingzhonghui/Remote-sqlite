import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface ContextMenuProps {
  isOpen: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ isOpen, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // ESC 键关闭菜单
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // 计算菜单位置，防止超出视口
  const menuWidth = 180
  const menuHeight = items.length * 36 + 8 // 每项高度 + 内边距
  
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  let adjustedX = x
  let adjustedY = y
  
  if (x + menuWidth > viewportWidth) {
    adjustedX = x - menuWidth
  }
  if (y + menuHeight > viewportHeight) {
    adjustedY = y - menuHeight
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-panel border border-border rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          disabled={item.disabled}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
            item.disabled
              ? 'opacity-50 cursor-not-allowed'
              : item.danger
              ? 'text-error hover:bg-error/10'
              : 'text-text hover:bg-hover'
          }`}
        >
          {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
          <span className="flex-1">{item.label}</span>
        </button>
      ))}
    </div>
  )
}