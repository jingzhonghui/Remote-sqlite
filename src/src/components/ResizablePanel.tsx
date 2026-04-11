import { useState, useRef, useCallback, useEffect } from 'react'

interface SplitterProps {
  direction: 'horizontal' | 'vertical'
  children: [React.ReactNode, React.ReactNode]
  defaultSize?: number
  minSize?: number
  maxSize?: number
}

export function Splitter({
  direction,
  children,
  defaultSize,
  minSize = 100,
  maxSize,
}: SplitterProps) {
  const [size, setSize] = useState(defaultSize ?? 300)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    let newSize: number

    if (direction === 'horizontal') {
      newSize = e.clientX - rect.left
    } else {
      newSize = e.clientY - rect.top
    }

    // Apply min/max constraints
    const containerSize = direction === 'horizontal' ? rect.width : rect.height
    const maxAllowed = maxSize ?? containerSize - minSize - 10
    newSize = Math.max(minSize, Math.min(maxAllowed, newSize))

    setSize(newSize)
  }, [isDragging, direction, minSize, maxSize])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp, direction])

  const isHorizontal = direction === 'horizontal'
  const firstStyle = isHorizontal
    ? { width: size, minWidth: size, maxWidth: size, flexShrink: 0 }
    : { height: size, minHeight: size, maxHeight: size, flexShrink: 0 }

  return (
    <div 
      ref={containerRef} 
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} h-full w-full`}
    >
      <div style={firstStyle}>
        {children[0]}
      </div>
      
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 ${
          isHorizontal 
            ? 'w-1 cursor-col-resize hover:bg-accent/50' 
            : 'h-1 cursor-row-resize hover:bg-accent/50'
        } ${isDragging ? 'bg-accent' : 'bg-border'}`}
      />
      
      <div className="flex-1 min-w-0 min-h-0">
        {children[1]}
      </div>
    </div>
  )
}
