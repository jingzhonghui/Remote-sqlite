/**
 * 聊天消息组件
 *
 * 渲染不同类型的消息：文本、SQL、结果、分析、错误
 */

import { useState } from 'react'
import {
  User,
  Bot,
  Copy,
  Check,
  Play,
  FileEdit,
  AlertCircle,
  Terminal,
  BarChart3,
  Table2
} from 'lucide-react'
import type { ChatMessage } from '../../types/ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/atom-one-dark.css'

interface StreamState {
  status: 'idle' | 'streaming' | 'tool_calling' | 'error'
  text: string
  currentTool?: string
  isTyping: boolean
}
import { SAFETY_CONFIG } from '../../types/ai'

interface ChatMessageProps {
  message: ChatMessage
  isLast?: boolean
  streamState?: StreamState
}

export function ChatMessage({ message, isLast, streamState }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isStreaming = isLast && message.isStreaming
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
        isUser
          ? 'bg-accent text-white'
          : 'bg-accent/10 text-accent'
      }`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      
      {/* 消息内容 */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block text-left ${
          isUser 
            ? 'bg-accent text-white px-4 py-2 rounded-2xl rounded-tr-sm' 
            : ''
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="space-y-2">
              {/* 根据消息类型渲染不同内容 */}
              {message.type === 'text' && (
                <TextMessage 
                  content={message.content} 
                  isStreaming={isStreaming}
                  streamText={streamState?.text}
                />
              )}
              
              {message.type === 'sql' && message.sql && (
                <SQLMessage sql={message.sql} content={message.content} />
              )}
              
              {message.type === 'result' && message.result && (
                <ResultMessage result={message.result} />
              )}
              
              {message.type === 'analysis' && message.analysis && (
                <AnalysisMessage analysis={message.analysis} />
              )}
              
              {message.type === 'error' && (
                <ErrorMessage content={message.content} />
              )}
            </div>
          )}
        </div>
        
        {/* 时间戳 */}
        <p className="text-[10px] text-text-muted mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  )
}

/**
 * 文本消息（支持 Markdown 渲染）
 */
function TextMessage({
  content,
  isStreaming,
  streamText
}: {
  content: string
  isStreaming?: boolean
  streamText?: string
}) {
  const displayText = isStreaming ? streamText || content : content

  return (
    <div className="text-sm text-text markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            const codeStr = String(children).replace(/\n$/, '')

            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-code text-accent text-xs font-mono" {...props}>
                  {children}
                </code>
              )
            }

            return (
              <CodeBlock
                code={codeStr}
                language={match ? match[1] : ''}
              />
            )
          },
          pre({ children }) {
            return <>{children}</>
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mb-2 mt-3 text-text">{children}</h1>
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mb-2 mt-3 text-text">{children}</h2>
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mb-1 mt-2 text-text">{children}</h3>
          },
          strong({ children }) {
            return <strong className="font-semibold text-text">{children}</strong>
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-2 rounded-xl border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return <thead className="bg-panel">{children}</thead>
          },
          th({ children }) {
            return <th className="px-3 py-2 text-left text-xs font-medium text-text-dim border-b border-border">{children}</th>
          },
          td({ children }) {
            return <td className="px-3 py-2 text-text text-xs border-b border-border">{children}</td>
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent pl-3 py-1 mb-2 text-text-muted italic">
                {children}
              </blockquote>
            )
          },
          hr() {
            return <hr className="my-3 border-border" />
          },
        }}
      >
        {displayText}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-accent ml-1 animate-pulse" />
      )}
    </div>
  )
}

/**
 * 代码块组件
 */
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isSQL = language === 'sql' || language === ''

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-2 bg-code">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-text-muted" />
          <span className="text-xs text-text-muted">{language || 'code'}</span>
          {isSQL && (
            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs">
              SQL
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-hover text-text-muted hover:text-text transition-colors"
          title="复制"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-code/50">
        <code className="text-sm text-text font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}


/**
 * SQL 消息（带代码块和操作按钮）
 */
function SQLMessage({ sql, content }: { sql: string; content: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleExecute = () => {
    // TODO: 执行 SQL
    console.log('执行 SQL:', sql)
  }
  
  const handleEdit = () => {
    // TODO: 在编辑器中打开
    console.log('编辑 SQL:', sql)
  }
  
  return (
    <div className="space-y-2">
      {/* 说明文本 */}
      {content && (
        <p className="text-sm text-text">{content}</p>
      )}
      
      {/* SQL 代码块 */}
      <div className="bg-code rounded-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 bg-border/30">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">SQL</span>
            <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs">
              {SAFETY_CONFIG.safe.label}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-hover text-text-muted hover:text-text transition-colors"
            title="复制"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        
        {/* 代码 */}
        <div className="p-3 overflow-x-auto">
          <code className="text-sm text-text font-mono whitespace-pre">
            {sql}
          </code>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex gap-2 px-3 py-2 bg-border/30">
          <button
            onClick={handleExecute}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs hover:bg-accent/90 transition-colors"
          >
            <Play className="w-3 h-3" />
            执行
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-panel text-text text-xs hover:bg-hover transition-colors"
          >
            <FileEdit className="w-3 h-3" />
            在编辑器中打开
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 查询结果消息
 */
function ResultMessage({ result }: { result: any }) {
  if (!result.success) {
    return (
      <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>执行失败</span>
        </div>
        {result.message && (
          <p className="mt-1 text-xs">{result.message}</p>
        )}
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      {/* 结果摘要 */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Table2 className="w-4 h-4" />
        <span>查询成功</span>
        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs">
          {result.rowCount} 行
        </span>
      </div>
      
      {/* 结果表格 */}
      {result.columns && result.rows && result.rows.length > 0 && (
        <div className="overflow-x-auto max-h-60 rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel sticky top-0">
              <tr>
                {result.columns.map((col: string) => (
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
              {result.rows.slice(0, 10).map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-hover/50">
                  {result.columns.map((col: string) => (
                    <td 
                      key={col}
                      className="px-3 py-2 text-text text-xs truncate max-w-[150px]"
                    >
                      {String(row[col] ?? 'NULL')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 10 && (
            <div className="px-3 py-2 text-center text-xs text-text-muted border-t border-border">
              还有 {result.rows.length - 10} 行...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 数据分析消息
 */
function AnalysisMessage({ analysis }: { analysis: any }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-text">
        <BarChart3 className="w-4 h-4 text-accent" />
        <span className="font-medium">数据分析结果</span>
        <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs">
          {analysis.type}
        </span>
      </div>
      
      {/* 分析摘要 */}
      {analysis.summary && (
        <p className="text-sm text-text">{analysis.summary}</p>
      )}
      
      {/* 统计信息 */}
      {analysis.statistics && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(analysis.statistics).slice(0, 4).map(([key, value]) => (
            <div key={key} className="p-2 rounded-lg bg-panel neu-inset">
              <p className="text-xs text-text-muted capitalize">{key}</p>
              <p className="text-sm text-text font-medium">{String(value)}</p>
            </div>
          ))}
        </div>
      )}
      
      {/* 洞察 */}
      {analysis.insights && analysis.insights.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-text-dim font-medium">关键洞察：</p>
          <ul className="space-y-1">
            {analysis.insights.slice(0, 3).map((insight: string, idx: number) => (
              <li key={idx} className="text-sm text-text flex items-start gap-2">
                <span className="text-accent">•</span>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * 错误消息
 */
function ErrorMessage({ content }: { content: string }) {
  return (
    <div className="p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">出错了</p>
          <p className="text-xs mt-1 text-red-400">{content}</p>
        </div>
      </div>
    </div>
  )
}
