# RemoteSQLite Windows 打包脚本
# 使用方法: .\scripts\build-windows.ps1

param(
    [switch]$Clean,
    [switch]$SkipRebuild,
    [string]$Target = "nsis"
)

$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green "[✓] $args" }
function Write-Info { Write-ColorOutput Cyan "[*] $args" }
function Write-Warning { Write-ColorOutput Yellow "[!] $args" }
function Write-Error { Write-ColorOutput Red "[✗] $args" }

# 检查是否在项目根目录
if (-not (Test-Path "package.json")) {
    Write-Error "请在项目根目录 (src/) 运行此脚本"
    exit 1
}

Write-Info "=== Building RemoteSQLite for Windows ==="
Write-Info "Target: $Target"

# 检查必要工具
Write-Info "Checking prerequisites..."

try {
    $nodeVersion = node --version
    Write-Success "Node.js: $nodeVersion"
} catch {
    Write-Error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

try {
    $npmVersion = npm --version
    Write-Success "npm: $npmVersion"
} catch {
    Write-Error "npm not found"
    exit 1
}

# 清理旧构建
if ($Clean -or -not $SkipRebuild) {
    Write-Info "Cleaning old builds..."
    Remove-Item -Recurse -Force dist, dist-electron, release -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force node_modules/.vite -ErrorAction SilentlyContinue
    Write-Success "Clean completed"
}

# 安装依赖
if (-not $SkipRebuild) {
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed"
        exit 1
    }
    Write-Success "Dependencies installed"

    # 重建原生模块
    Write-Info "Rebuilding native modules..."
    npx electron-rebuild
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "electron-rebuild failed, trying npm rebuild..."
        npm rebuild
    }
    Write-Success "Native modules rebuilt"
}

# 构建应用
Write-Info "Building application..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}
Write-Success "Application built"

# 复制必要依赖到构建目录
Write-Info "Copying dependencies..."
New-Item -ItemType Directory -Force -Path dist-electron/node_modules | Out-Null

$dependencies = @(
    "ssh2",
    "asn1",
    "bcrypt-pbkdf",
    "safer-buffer",
    "tweetnacl",
    "cpu-features",
    "nan",
    "buildcheck"
)

foreach ($dep in $dependencies) {
    $source = "node_modules/$dep"
    $dest = "dist-electron/node_modules/$dep"
    if (Test-Path $source) {
        Copy-Item -Recurse -Force $source $dest -ErrorAction SilentlyContinue
        Write-Success "Copied $dep"
    } else {
        Write-Warning "Dependency not found: $dep"
    }
}

# 检查并创建图标目录
if (-not (Test-Path "build")) {
    Write-Info "Creating build directory..."
    New-Item -ItemType Directory -Force -Path build | Out-Null
}

# 检查图标文件
if (-not (Test-Path "build/icon.ico")) {
    Write-Warning "Icon file not found: build/icon.ico"
    Write-Info "Please add an icon file (256x256 or larger) to build/icon.ico"
    Write-Info "You can convert PNG to ICO using: https://icoconvert.com/"
}

# 打包
Write-Info "Packaging for Windows ($Target)..."
npx electron-builder --win $Target

if ($LASTEXITCODE -ne 0) {
    Write-Error "Packaging failed"
    exit 1
}

Write-Success "=== Build completed ==="
Write-Info "Output location: release/"

# 列出输出文件
if (Test-Path "release") {
    Write-Info "Generated files:"
    Get-ChildItem release -File | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Success "  $($_.Name) ($size MB)"
    }
}

Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Test the installer: .\release\RemoteSQLite Setup *.exe"
Write-Info "2. Verify the portable version (if built): .\release\RemoteSQLite *.exe"
Write-Info "3. Check the unpacked version: .\release\win-unpacked\RemoteSQLite.exe"
