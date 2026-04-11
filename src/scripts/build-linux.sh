#!/bin/bash
set -e

echo "=== Building RemoteSQLite for Linux ==="

# 清理旧构建
rm -rf dist dist-electron release node_modules/.vite

# 使用 npm 重新安装依赖（扁平结构，更容易打包）
if [ -d "node_modules" ]; then
    echo "Removing existing node_modules..."
    rm -rf node_modules
fi

echo "Installing dependencies with npm..."
npm install

# 重建原生模块
echo "Rebuilding native modules..."
npx electron-rebuild

# 构建应用
echo "Building application..."
npm run build

# 复制必要依赖到构建目录
echo "Copying dependencies..."
mkdir -p dist-electron/node_modules

# 复制 ssh2 及其所有依赖
cp -r node_modules/ssh2 dist-electron/node_modules/
cp -r node_modules/asn1 dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/bcrypt-pbkdf dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/safer-buffer dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/tweetnacl dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/cpu-features dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/nan dist-electron/node_modules/ 2>/dev/null || true
cp -r node_modules/buildcheck dist-electron/node_modules/ 2>/dev/null || true

# 打包
echo "Packaging..."
npx electron-builder --linux AppImage

echo "=== Build complete ==="
echo "Output: release/RemoteSQLite-1.0.0.AppImage"
