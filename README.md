# Model Switcher

一个轻量级、按需启动的工具，用于快速管理和切换 AI 编程工具的 API 模型配置。支持 Claude Code、OpenCode、Codex、Aider、Continue 等工具，目标覆盖 Gemini CLI、OpenClaw、Hermes Agent。

> **开发者注意**：开始编码前请先阅读 `docs/Development-Progress-Document.md`，了解项目设计哲学、已完成阶段和当前开发计划。

## 核心特性

- **按需启动**：后台服务平时不占用资源，仅在访问管理页面时自动激活。
- **静默运行**：通过 VBS 脚本实现完全后台运行，无控制台窗口干扰。
- **多工具支持**：统一管理多个 AI 编程工具的 Provider 配置，插件式适配器架构易于扩展。
- **连通性测试**：一键测试 API 连通性，自动提示切换配置。
- **配置安全**：原子写入 + 自动备份 + 写入校验（开发中），杜绝配置损坏。

## 快速开始

1. **安装依赖**：

   ```bash
   npm install
   ```

2. **设置开机自启**（仅需一次，在项目目录下运行）：
   - Windows：`scripts\setup-autostart.ps1`（右键 → 使用 PowerShell 运行，或在 PowerShell 中直接输入路径）
   - macOS/Linux：`bash scripts/setup-autostart.sh`

3. **使用**：
   - 设置自启后，launcher.js 会在登录时自动后台运行
   - 直接在浏览器访问 [http://localhost:51234](http://localhost:51234) 即可
   - 也可手动运行 `node launcher.js`，会自动转为后台进程

4. **管理配置**：
   在浏览器访问 [http://localhost:51234](http://localhost:51234)

## 目录结构

```
Model-Switcher/
├── server.js           # 配置管理 API 服务
├── launcher.js         # 代理网关，按需拉起后台进程
├── index.html          # 管理界面 UI
├── config.json         # 用户配置（已 gitignore）
├── presets.json        # 预设 URL 和厂商配置
├── package.json        # 项目依赖
├── providers/          # 工具适配器
│   ├── index.js        # 适配器注册中心
│   ├── utils.js        # 共享工具函数
│   ├── claude.js       # Claude Code 适配器
│   ├── opencode.js     # OpenCode 适配器
│   ├── codex.js        # Codex 适配器
│   ├── aider.js        # Aider 适配器
│   └── continue.js     # Continue 适配器
├── scripts/            # 启动和设置脚本
│   ├── setup-autostart.ps1  # Windows 任务计划自启（推荐）
│   ├── setup-autostart.vbs
│   ├── setup-autostart.sh
│   ├── start-silent.vbs
│   ├── start-silent.sh
│   └── cleanup-autostart.vbs
└── docs/               # 文档
```

## 适配工具

**已支持：**

| 工具 | 配置文件 | 格式 |
|------|----------|------|
| Claude Code | `~/.claude/settings.json` | JSON |
| OpenCode | `~/.config/opencode/opencode.jsonc` | JSONC |
| Codex | `~/.codex/config.toml` | TOML |
| Aider | `~/.aider.conf.yml` | YAML |
| Continue | `~/.continue/config.json` | JSON |

**计划支持：** Gemini CLI、OpenClaw、Hermes Agent

## 安全说明

本工具的所有网络行为均在本地完成，不涉及任何外部数据传输：

- **本地 HTTP 服务**：`launcher.js`（端口 51234）和 `server.js`（端口 51235）仅监听 `127.0.0.1`，不暴露到外部网络。
- **配置文件存储**：所有 API Key 和配置以纯文本 JSON 格式存储在本地 `config.json` 中，不上传至任何服务器。
- **连通性测试**：仅在用户手动点击"测试"按钮时，向对应 Provider 的 API 端点发送轻量请求。
- **无遥测/追踪**：本工具不包含任何分析、遥测或数据收集代码。

## 许可证

MIT
