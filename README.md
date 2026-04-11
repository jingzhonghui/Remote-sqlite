# RemoteSQLite

跨平台远程 SQLite 数据库管理桌面应用 - 无需下载数据库文件，即可通过 SSH 直接操作远程服务器上的 SQLite 数据库。

---

## 功能特性

### SSH 连接管理
- 支持 **密码认证**、**私钥认证**、**SSH Agent** 多种认证方式
- 支持 **跳板机（ProxyJump）** 配置
- 连接状态实时显示，自动重连机制
- 连接配置持久化保存，关闭软件后自动恢复

### 数据库浏览
- 可视化浏览远程服务器上的 SQLite 数据库
- 左侧对象树展示表、索引结构
- 实时显示表数据总数（COUNT 查询）
- 支持同时打开多个数据库

### 数据 CRUD
- 表格形式展示数据，支持分页浏览
- 新增、编辑、删除数据记录
- 删除操作二次确认，安全可靠
- 支持全文搜索和按列过滤

### SQL 编辑器
- 基于 **Monaco Editor**（VS Code 同款）
- SQL 语法高亮显示
- 支持 SQL 格式化（Beautify）
- 执行历史记录（最近 100 条）
- SQL 片段保存与复用
- 显示执行时间、影响行数

### 可视化建表
- 拖拽式设计表结构
- 支持列属性设置：类型、主键、自增、非空、唯一、默认值
- 可视化创建索引
- 实时预览生成的 DDL 语句
- 支持索引管理（查看、删除）

---

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Electron | 成熟生态、跨平台 |
| 前端框架 | React 18 + TypeScript | 组件化开发 |
| 构建工具 | Vite 5 | 快速热更新 |
| UI 框架 | Tailwind CSS | 原子化 CSS |
| 状态管理 | Zustand | 轻量级状态管理 |
| SSH 客户端 | ssh2 | 纯 JS 实现，无需 OpenSSH |
| 代码编辑器 | Monaco Editor | VS Code 同款编辑器 |
| 打包工具 | electron-builder | 多平台打包 |

---

## 系统要求

### 客户端
- Windows 10/11 (x64)
- macOS 12+ (Intel / Apple Silicon)
- Linux (Ubuntu 20.04+, Debian, CentOS 7+)

### 远程服务器
- 已安装 `sqlite3` 命令行工具，版本3.37.2及以上
- SSH 服务正常运行

---

## 快速开始

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm
pnpm install
```

### 开发模式

```bash
# 启动 Vite 开发服务器
npm run dev

# 在新终端启动 Electron 开发模式
npm run electron:dev
```

### 构建

```bash
# 构建 Web 应用
npm run build

# 打包 Electron 应用
npm run electron:build
```

### 打包特定平台

```bash
# Windows (NSIS)
npm run electron:build:win

# Linux (AppImage)
npm run electron:build:linux:appimage

# macOS (DMG)
npm run electron:build:mac
```

---

## 项目结构

```
remote-sqlite/
├── src/
│   ├── electron/                    # Electron 主进程
│   │   ├── main.ts                 # 主入口、窗口创建、IPC 处理器
│   │   ├── preload.ts              # 预加载脚本（contextBridge）
│   │   └── services/               # 服务层
│   │       ├── sshService.ts      # SSH 连接服务
│   │       └── sqliteService.ts    # SQLite 操作服务
│   │
│   ├── src/                        # 渲染进程 (React 应用)
│   │   ├── components/             # React 组件
│   │   │   └── Layout.tsx         # 应用布局组件
│   │   ├── pages/                 # 页面组件
│   │   │   ├── ConnectionPage.tsx    # SSH 连接管理
│   │   │   ├── DatabasePage.tsx      # 数据库浏览
│   │   │   ├── SqlEditorPage.tsx     # SQL 编辑器
│   │   │   └── TableDesignerPage.tsx # 可视化建表
│   │   ├── stores/                # Zustand 状态管理
│   │   │   └── useAppStore.ts    # 全局状态 store
│   │   ├── types/                 # TypeScript 类型定义
│   │   │   └── index.ts
│   │   ├── App.tsx               # React 应用入口
│   │   ├── main.tsx              # React 渲染入口
│   │   └── index.css             # 全局样式
│   │
│   ├── index.html                 # HTML 模板
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── postcss.config.js
│
├── docs/                          # 文档目录
│   ├── 产品需求文档.md
│   ├── 技术文档.md
│   └── 原型设计.html
│
└── release/                       # 打包输出目录
```

---

## 使用说明

### 新建 SSH 连接

1. 点击左侧「新建连接」按钮
2. 填写连接信息：
   - 连接名称（自定义标识）
   - 主机地址（IP 或域名）
   - 端口（默认 22）
   - 用户名
   - 认证方式（密码 / 私钥 / SSH Agent）
3. 点击「测试连接」验证连通性
4. 保存并连接

### 打开数据库

1. 连接成功后，点击「打开数据库」按钮
2. 输入远程服务器上的数据库文件路径
3. 如 `/path/to/database.db`
4. 确认后加载表结构

### 浏览数据

1. 在左侧对象树中双击表名
2. 数据将分页展示在右侧区域
3. 支持新增、编辑、删除操作

### 执行 SQL

1. 切换到「SQL 编辑器」页面
2. 输入 SQL 语句
3. 点击「执行」或使用 `Ctrl+Enter` 快捷键
4. 结果将显示在下方表格中

### 可视化建表

1. 切换到「建表向导」页面
2. 输入表名
3. 添加列并设置属性
4. 实时预览 DDL
5. 点击「执行」创建表

---

## 快捷键

| 功能 | 快捷键 |
|------|--------|
| 新建连接 | `Ctrl+N` |
| 执行 SQL | `Ctrl+Enter` |
| 格式化 SQL | `Ctrl+Shift+F` |
| 注释/取消注释 | `Ctrl+/` |
| 刷新对象树 | `F5` |
| 保存 SQL | `Ctrl+S` |

---


## 常见问题

### Q: 连接失败怎么办？
A: 请检查：
1. SSH 服务是否正常运行
2. 主机地址、端口、用户名是否正确
3. 密码/私钥是否有效
4. 服务器防火墙是否允许 SSH 连接

### Q: 提示 sqlite3 未找到？
A: 请确保远程服务器已安装 `sqlite3` 命令行工具：
```bash
# Ubuntu/Debian
sudo apt install sqlite3

# CentOS/RHEL
sudo yum install sqlite

# 验证安装
sqlite3 --version
```

### Q: 如何处理大数据量查询？
A: 应用默认使用分页加载，每次查询限制返回 100 条记录。对于大数据量，建议使用 SQL 的 `LIMIT` 和 `OFFSET` 子句进行分页查询。

---
