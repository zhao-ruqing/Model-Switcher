#!/usr/bin/env bash
# 静默后台启动 launcher.js（macOS/Linux 通用）

# 切换到项目根目录（scripts 的上一级），launcher.js 位于根目录
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR" || exit 1

# 检测 node 是否可用
if ! command -v node &>/dev/null; then
  echo "错误：未找到 node，请先安装 Node.js" >&2
  exit 1
fi

# 后台启动 launcher.js，输出重定向到日志文件
nohup node launcher.js > /dev/null 2>&1 &

# 等待服务就绪（最多 10 秒）
for i in $(seq 1 20); do
  sleep 0.5
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:51234 2>/dev/null | grep -qE "^[23]"; then
    exit 0
  fi
done

echo "警告：服务启动超时，请手动检查" >&2
exit 0
