# 在启动文件夹创建快捷方式：开机自启 launcher.js（无需管理员）
$scriptDir = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
    Write-Host "未找到 Node.js，请先安装" -ForegroundColor Red
    exit 1
}

$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "Model-Switcher.lnk"
$launcherPath = Join-Path $scriptDir "launcher.js"

# 创建快捷方式
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $nodePath
$shortcut.Arguments = "`"$launcherPath`""
$shortcut.WorkingDirectory = $scriptDir
$shortcut.WindowStyle = 7  # 最小化（隐藏窗口）
$shortcut.Description = "Model Switcher 按需启动网关"
$shortcut.Save()

Write-Host "快捷方式已创建：$shortcutPath" -ForegroundColor Green
Write-Host "launcher.js 将在每次登录时自动启动" -ForegroundColor Green
