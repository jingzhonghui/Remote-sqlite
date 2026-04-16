import { useState, useRef, useEffect, useCallback } from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    
    const rect = triggerRef.current.getBoundingClientRect()
    // 显示在单元格下方，偏移一点距离
    const top = rect.bottom + window.scrollY + 8
    const left = rect.left + window.scrollX + rect.width / 2
    
    setPosition({ top, left })
  }, [])

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, 200) // 延迟显示，避免快速移动时闪烁
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (visible && tooltipRef.current) {
      // 水平居中 tooltip
      const tooltipWidth = tooltipRef.current.offsetWidth
      setPosition(prev => ({
        ...prev,
        left: prev.left - tooltipWidth / 2,
      }))
    }
  }, [visible])

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block w-full h-full cursor-default select-none ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
      </div>
      {visible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1.5 text-xs text-left border border-border rounded-lg max-w-[400px] break-all whitespace-pre-wrap pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            backgroundColor: 'var(--tooltip-bg)',
            color: 'var(--text)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          {content}
        </div>
      )}
    </>
  )
}
