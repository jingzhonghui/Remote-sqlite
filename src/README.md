# RemoteSQLite

跨平台远程 SQLite 数据库管理桌面应用

## 功能特性

- **SSH 连接管理**: 支持密码、私钥、SSH Agent 多种认证方式
- **数据库浏览**: 可视化浏览表结构、索引、数据
- **数据 CRUD**: 增删改查数据，支持分页和搜索
- **SQL 编辑器**: 语法高亮、自动补全、历史记录、查询保存
- **可视化建表**: 拖拽式设计表结构，实时生成 DDL

## 技术栈

- **框架**: Electron + React + TypeScript
- **构建工具**: Vite
- **UI**: Tailwind CSS
- **状态管理**: Zustand
- **代码编辑器**: Monaco Editor
- **SSH 连接**: ssh2

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包 Electron 应用
npm run electron:build
```

## 项目结构

```
src/
├── electron/          # Electron 主进程
│   ├── main.ts       # 主入口
│   ├── preload.ts    # 预加载脚本
│   └── services/     # 服务层
│       ├── sshService.ts
│       └── sqliteService.ts
├── src/              # 渲染进程 (React)
│   ├── components/   # 组件
│   ├── pages/        # 页面
│   ├── stores/       # 状态管理
│   ├── types/        # 类型定义
│   └── utils/        # 工具函数
├── docs/             # 文档
│   ├── PRD.md        # 需求文档
│   └── prototype.html # 原型图
```

## 跨平台支持

- Windows (NSIS 安装包)
- macOS (DMG 安装包)
- Linux (AppImage)
