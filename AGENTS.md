# AGENTS.md - RemoteSQLite

## 项目概述

跨平台桌面应用，通过 SSH 直接操作远程服务器上的 SQLite 数据库，无需下载数据库文件。

**技术栈**: Electron 28 + React 18 + TypeScript + Vite 5 + Tailwind CSS + Zustand + ssh2 + Monaco Editor

## 目录结构

```
remote-sqlite/
├── src/                          # 源码根目录
│   ├── electron/                 # Electron 主进程
│   │   ├── main.ts              # 主入口、窗口创建、IPC 处理器
│   │   ├── preload.ts           # 预加载脚本（contextBridge）
│   │   └── services/            # SSH/SQLite 服务层
│   ├── src/                     # 渲染进程 (React)
│   │   ├── components/          # React 组件
│   │   ├── pages/               # 页面组件
│   │   │   ├── ConnectionPage.tsx
│   │   │   ├── DatabasePage.tsx
│   │   │   ├── SqlEditorPage.tsx
│   │   │   └── TableDesignerPage.tsx
│   │   ├── stores/              # Zustand 状态管理
│   │   └── types/               # TypeScript 类型定义
│   ├── package.json
│   └── vite.config.ts
└── docs/                         # 文档目录
```

## 开发命令

**所有命令都在 `src/` 目录下执行：**

```bash
cd src

# 开发模式（启动 Vite + Electron）
npm run dev

# 仅构建 Web 部分
npm run build

# Electron 开发模式（先 build 再启动 Electron）
npm run electron:dev

# 打包 Electron 应用
npm run electron:build

# 平台特定打包
npm run electron:build:win      # Windows zip
npm run electron:build:win:all  # Windows nsis + zip
npm run electron:build:linux    # Linux AppImage + deb + rpm
```

## 关键配置

### Vite 配置 (`vite.config.ts`)

- 使用 `vite-plugin-electron/simple` 简化配置
- **preload 脚本输出**: 由于 `package.json` 设置了 `"type": "module"`，preload 构建为 `.mjs` 格式
- **主进程入口**: `electron/main.ts` → `dist-electron/main.js`
- **preload 入口**: `electron/preload.ts` → `dist-electron/preload.mjs`

### Electron 主进程 (`electron/main.ts`)

- 使用 ESM 模块，需手动创建 `__dirname`:
  ```typescript
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  ```
- **preload 路径**: `path.join(__dirname, 'preload.mjs')`（注意是 .mjs 不是 .cjs）
- 必须启用 `contextIsolation: true`，禁用 `nodeIntegration: false`

### 原生模块处理

`ssh2` 依赖原生 C++ 模块，已在 `vite.config.ts` 中 external:
```typescript
external: ['ssh2', 'cpu-features', 'nan']
```

## 架构要点

### IPC 通信

- **preload.ts** 使用 `contextBridge.exposeInMainWorld('electronAPI', {...})` 暴露 API
- **main.ts** 使用 `ipcMain.handle()` 注册处理器
- **渲染进程**通过 `window.electronAPI` 访问主进程功能

### 状态管理

- 使用 Zustand + persist 中间件
- 持久化存储键名: `remote-sqlite-storage`
- 持久化字段: `savedConnections`, `savedQueries`

### 远程命令执行流程

```
GUI → window.electronAPI.sqlite.query() → IPC → main.ts → SQLiteService → SSHService.execCommand() → 远程 sqlite3 -json "SQL"
```

## 发布流程

GitHub Actions 工作流 (`.github/workflows/release.yml`):
- 触发条件: 推送 `v*.*.*` 标签
- 构建平台: Windows (exe/zip), Linux (AppImage/deb/rpm)
- Node 版本: 24.14.1
- 版本号从 tag 自动提取并写入 package.json

## 常见陷阱

1. **preload 路径错误**: 必须使用 `preload.mjs`，不是 `preload.cjs` 或 `preload.js`
2. **开发模式端口**: Vite 默认使用 5173，如被占用会自动切换到 5174
3. **工作目录**: 所有 npm 命令必须在 `src/` 目录下执行
4. **原生模块**: 不要尝试打包 ssh2 等原生模块，保持 external 配置

## 文档参考

- `docs/技术文档.md` - 详细技术架构和 API 规范
- `docs/产品需求文档.md` - 功能需求清单
- `README.md` - 用户级使用说明
