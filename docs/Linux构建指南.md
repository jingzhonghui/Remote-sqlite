# Linux 桌面应用打包指南

## 支持的打包格式

| 格式 | 说明 | 适用场景 |
|------|------|----------|
| **AppImage** | 单文件可执行，无需安装 | 通用，推荐 |
| **deb** | Debian/Ubuntu 安装包 | Debian 系发行版 |
| **rpm** | RedHat/Fedora 安装包 | RedHat 系发行版 |
| **tar.gz** | 压缩包 | 手动部署 |

## 打包步骤

### 1. 确保在 Linux 环境

在 WSL 或 Linux 虚拟机中执行：

```bash
# 确认系统
uname -a
# 应该显示 Linux
```

### 2. 安装依赖

```bash
# 进入项目目录
cd ./src

# 安装 Node 依赖 (使用 npm)
npm install

# 安装 Linux 打包所需的系统依赖 (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libgtk-3-0 \
  libgbm1 \
  libasound2 \
  icnsutils \
  graphicsmagick \
  xz-utils

# 对于 RPM 打包，还需要
sudo apt-get install -y rpm
```

### 3. 执行打包

```bash
# 打包所有 Linux 格式
npm run electron:build:linux

# 或只打包特定格式
npm run electron:build:linux:appimage   # 仅 AppImage
npm run electron:build:linux:deb        # 仅 deb
npm run electron:build:linux:rpm        # 仅 rpm
```

### 4. 输出位置

打包完成后，安装包位于：

```
src/release/

## 常见问题

### 1. 打包时提示缺少依赖

```bash
# Ubuntu/Debian
sudo apt-get install -y build-essential python3 libffi-dev

# 如果涉及原生模块编译
sudo apt-get install -y libssh2-1-dev openssl libssl-dev
```

### 2. AppImage 运行时缺少库

```bash
# 安装 FUSE（AppImage 需要）
sudo apt-get install -y libfuse2

# 或使用 --no-sandbox 参数运行（不推荐长期使用）
./RemoteSQLite-x.x.x.AppImage --no-sandbox
```

### 3. WSL 中打包后无法在纯 Linux 运行

确保 `ssh2` 的原生模块正确打包：

```bash
# 检查 node_modules 中的原生模块
ls -la node_modules/cpu-features/build/Release/

# 重新编译（如果需要）
npm rebuild
```

### 4. 图标不显示

创建图标目录并添加图标：

```bash
mkdir -p build
# 放置 512x512 的 png 图标为 build/icon.png
# 放置 512x512 的 ico 图标为 build/icon.ico
# 放置 icon.icns 为 build/icon.icns (macOS)
```

## 自定义配置

修改 `package.json` 中的 `build` 字段：

```json
{
  "build": {
    "productName": "你的应用名",
    "appId": "com.yourcompany.app",
    "linux": {
      "category": "Development",
      "maintainer": "your-email@example.com",
      "vendor": "Your Company"
    }
  }
}
```

## CI/CD 自动打包

### GitHub Actions 示例

```yaml
# .github/workflows/build.yml
name: Build Linux App

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run electron:build:linux
      - uses: actions/upload-artifact@v3
        with:
          name: linux-builds
          path: release/
```
