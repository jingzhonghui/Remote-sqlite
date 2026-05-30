import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

// 配置 Monaco Editor 使用本地资源，避免 CDN 加载失败
// 这在离线环境或网络受限的 Linux 系统中尤为重要
loader.config({ monaco })
loader.init().catch((err) => {
  console.error('Monaco Editor 初始化失败:', err)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
