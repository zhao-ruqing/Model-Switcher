#!/usr/bin/env bash
# 开机自启配置脚本（macOS 用 launchd，Linux 用 systemd）

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="model-switcher"

case "$(uname -s)" in
  Darwin)
    # macOS：生成 LaunchAgent plist
    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_PATH="$PLIST_DIR/com.$APP_NAME.plist"
    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.$APP_NAME</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string>$SCRIPT_DIR/launcher.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$SCRIPT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>/dev/null</string>
  <key>StandardErrorPath</key>
  <string>/dev/null</string>
</dict>
</plist>
PLIST

    # 加载并注册
    launchctl unload "$PLIST_PATH" 2>/dev/null
    launchctl load "$PLIST_PATH"
    echo "macOS 开机自启已配置：$PLIST_PATH"
    ;;

  Linux)
    # Linux：生成 systemd user unit
    UNIT_DIR="$HOME/.config/systemd/user"
    UNIT_PATH="$UNIT_DIR/$APP_NAME.service"
    mkdir -p "$UNIT_DIR"

    cat > "$UNIT_PATH" << UNIT
[Unit]
Description=Model Switcher Config Manager
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(command -v node) $SCRIPT_DIR/launcher.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT

    # 注册并启用
    systemctl --user daemon-reload
    systemctl --user enable "$APP_NAME.service"
    echo "Linux 开机自启已配置：$UNIT_PATH"
    echo "手动启动：systemctl --user start $APP_NAME.service"
    ;;

  *)
    echo "不支持的平台：$(uname -s)" >&2
    echo "请手动配置开机自启" >&2
    exit 1
    ;;
esac
