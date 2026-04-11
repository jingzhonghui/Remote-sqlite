# WSL 环境设置指南

## 安装系统依赖

在 WSL 中运行 Electron 需要安装以下库：

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libxtst6 \
  libxrandr2 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxi6 \
  libglib2.0-0 \
  libgdk-pixbuf2.0-0

# 如果需要构建原生模块
sudo apt-get install -y build-essential python3
```

## 安装项目依赖

```bash
cd /mnt/c/Users/jzh/Desktop/data/aicode/remote-sqlite/src

# 使用 pnpm
pnpm install

# 或使用 npm
npm install
```

## 开发模式运行

```bash
# 只启动 Vite 开发服务器（浏览器预览）
pnpm run dev

# 启动 Electron（需要 X Server，如 VcXsrv）
pnpm run electron:dev
```

## WSL 中显示 Electron 窗口

1. 安装 VcXsrv (Windows X Server)
2. 启动 VcXsrv，选择 "Multiple windows" 和 "Disable access control"
3. 在 WSL 中设置 DISPLAY 环境变量：

```bash
# 添加到 ~/.bashrc 或 ~/.zshrc
export DISPLAY=$(cat /etc/resolv.conf | grep nameserver | awk '{print $2}'):0
export LIBGL_ALWAYS_INDIRECT=1
```

## 常见问题

### 1. `libnss3.so` 错误
安装 libnss3：
```bash
sudo apt-get install -y libnss3
```

### 2. `cpu-features` 原生模块错误
ssh2 的 cpu-features 是可选依赖，可以忽略此错误。如果问题严重，可以尝试：
```bash
pnpm rebuild ssh2
```

### 3. 白屏或无法加载页面
检查 preload 脚本是否正确构建到 `dist-electron/preload.cjs`

### 4. 热重载不工作
这是已知问题，修改主进程代码后需要手动重启 Electron
