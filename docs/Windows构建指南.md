# RemoteSQLite Windows 打包说明

> **适用版本**: v1.0.0  
> **更新日期**: 2026-04-11  
> **适用平台**: Windows 10/11 (x64)

---

## 目录

1. [环境要求](#1-环境要求)
2. [前置准备](#2-前置准备)
3. [打包方式](#3-打包方式)
4. [打包配置](#4-打包配置)
5. [常见问题](#5-常见问题)
6. [发布检查清单](#6-发布检查清单)

---

## 1. 环境要求

### 1.1 必需软件

| 软件 | 版本 | 用途 | 下载地址 |
|------|------|------|----------|
| Node.js | 18.x 或 20.x | 运行环境和构建工具 | https://nodejs.org/ |
| Python | 3.10+ | 原生模块编译依赖 | https://www.python.org/ |
| Visual Studio Build Tools | 2022 | C++ 编译工具 | https://visualstudio.microsoft.com/downloads/ |
| Git | 最新版 | 版本控制 | https://git-scm.com/ |

### 1.2 Visual Studio Build Tools 必需组件

安装时需勾选以下工作负载：

- **使用 C++ 的桌面开发**
- **MSVC v143 - VS 2022 C++ x64/x86 生成工具**
- **Windows 10/11 SDK**

或者使用命令行安装：

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows10SDK.19041"
```

---

## 2. 前置准备

### 2.1 克隆项目

```powershell
git clone <repository-url>
cd remote-sqlite/src
```

### 2.2 安装依赖

```powershell
# 使用 npm 安装依赖
npm install

# 或者使用 yarn
yarn install

# 或者使用 pnpm
pnpm install
```

### 2.3 配置环境变量（如需要）

确保以下工具在系统 PATH 中：

```powershell
# 检查 Node.js
node --version  # v18.x 或 v20.x

# 检查 Python
python --version  # 3.10+

# 检查 npm
npm --version
```

---

## 3. 打包方式

### 3.1 方式一：使用脚本打包（推荐）

```powershell
# 进入项目目录
cd remote-sqlite/src

# 运行 Windows 打包脚本
.\scripts\build-windows.ps1
```

### 3.2 方式二：使用 npm 命令

```powershell
# 构建 Windows 安装包（NSIS）
npm run electron:build:win

# 或者构建所有 Windows 格式
npm run electron:build:win:all
```

### 3.3 方式三：手动分步打包

```powershell
# 1. 清理旧构建
Remove-Item -Recurse -Force dist, dist-electron, release -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue

# 2. 重新安装依赖
npm install

# 3. 重建原生模块
npx electron-rebuild

# 4. 构建应用
npm run build

# 5. 复制依赖到构建目录
New-Item -ItemType Directory -Force -Path dist-electron/node_modules
Copy-Item -Recurse node_modules/ssh2 dist-electron/node_modules/
Copy-Item -Recurse node_modules/asn1 dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/bcrypt-pbkdf dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/safer-buffer dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/tweetnacl dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/cpu-features dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/nan dist-electron/node_modules/ -ErrorAction SilentlyContinue
Copy-Item -Recurse node_modules/buildcheck dist-electron/node_modules/ -ErrorAction SilentlyContinue

# 6. 打包
npx electron-builder --win
```

---

## 4. 打包配置

### 4.1 package.json 中的 Windows 配置

```json
{
  "build": {
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "ia32"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        },
        {
          "target": "zip",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico",
      "publisherName": "Your Company Name",
      "verifyUpdateCodeSignature": false,
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "RemoteSQLite",
      "include": "build/installer.nsh",
      "license": "LICENSE.txt"
    }
  }
}
```

### 4.2 支持的输出格式

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| `nsis` | Windows 安装程序 (.exe) | 正式分发，支持安装/卸载 |
| `portable` | 便携版 (.exe) | 无需安装，直接运行 |
| `zip` | 压缩包 (.zip) | 手动解压使用 |
| `msi` | Windows Installer (.msi) | 企业部署 |

---

## 5. 常见问题

### 5.1 原生模块编译失败

**错误信息**：
```
gyp ERR! find VS
gyp ERR! configure error
gyp ERR! stack Error: Could not find any Visual Studio installation to use
```

**解决方案**：

1. 安装 Visual Studio Build Tools（见 1.2 节）
2. 设置 npm 使用本地 Python：
   ```powershell
   npm config set python python3.exe
   ```
3. 重新构建：
   ```powershell
   npm rebuild
   npx electron-rebuild
   ```

### 5.2 找不到 icon.ico

**错误信息**：
```
Error: icon directory doesn't contain icons
```

**解决方案**：

创建 `build` 目录并添加图标文件：

```powershell
New-Item -ItemType Directory -Force -Path build

# 需要准备以下图标文件：
# - build/icon.ico (256x256 或更大，Windows 安装包)
# - build/icon.png (512x512，AppImage 等格式)
```

可以使用在线工具将 PNG 转换为 ICO：
- https://convertio.co/png-ico/
- https://icoconvert.com/

### 5.3 打包后应用无法启动

**排查步骤**：

1. 检查 `release/win-unpacked` 目录下的可执行文件是否能直接运行
2. 在命令行运行查看错误信息：
   ```powershell
   .\release\win-unpacked\RemoteSQLite.exe
   ```
3. 检查是否缺少依赖文件，特别是 `node_modules/ssh2` 相关文件

### 5.4 杀毒软件误报

由于应用包含 SSH 连接功能，可能被部分杀毒软件误报。

**解决方案**：
- 对安装包进行代码签名（需要购买证书）
- 向杀毒软件厂商提交误报申诉
- 在发布说明中告知用户添加信任

### 5.5 打包过程中内存不足

**错误信息**：
```
JavaScript heap out of memory
```

**解决方案**：

```powershell
# 增加 Node.js 内存限制
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run electron:build:win
```

---

## 6. 发布检查清单

在发布 Windows 版本前，请确认以下事项：

- [ ] 应用在开发模式正常运行 (`npm run electron:dev`)
- [ ] 安装包可以正常安装
- [ ] 安装后的应用可以正常启动
- [ ] SSH 连接功能正常
- [ ] 数据库查询功能正常
- [ ] 卸载程序可以正常卸载
- [ ] 在干净的 Windows 环境（虚拟机）测试通过
- [ ] 图标显示正常
- [ ] 版本号正确

---

## 附录

### A. 完整的 Windows 打包脚本

见 `scripts/build-windows.ps1`

### B. 相关文档

- [Electron Builder 官方文档](https://www.electron.build/)
- [Windows 应用打包指南](https://www.electron.build/configuration/win)
- [NSIS 配置文档](https://www.electron.build/configuration/nsis)

---

*文档结束*
