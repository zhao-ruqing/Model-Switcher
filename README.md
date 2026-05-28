# Model Switcher

一个轻量级、按需启动的工具，用于快速管理和切换 Claude Code 和 OpenCode 的 API 模型配置。

## 核心特性

- **按需启动**：后台服务平时不占用资源，仅在访问管理页面时自动激活。
- **静默运行**：通过 VBS 脚本实现完全后台运行，无控制台窗口干扰。
- **多工具支持**：独立管理 Claude Code 和 OpenCode 的配置状态。
- **智能获取**：自动识别厂商并获取可用模型列表。
- **连通性测试**：一键测试 API 连通性，自动提示切换配置。

## 快速开始

1. **安装依赖**：

   ```bash
   npm install
   ```

2. **启动服务**：
   - Windows：双击 `scripts/start-silent.vbs`
   - macOS/Linux：运行 `bash scripts/start-silent.sh`

3. **设置开机自启**（可选）：
   - Windows：双击 `scripts/setup-autostart.vbs`
   - macOS/Linux：运行 `bash scripts/setup-autostart.sh`

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
│   ├── claude.js       # Claude Code 适配器
│   └── opencode.js     # OpenCode 适配器
├── scripts/            # 启动和设置脚本
│   ├── start-silent.vbs
│   ├── start-silent.sh
│   ├── setup-autostart.vbs
│   ├── setup-autostart.sh
│   └── cleanup-autostart.vbs
└── docs/               # 文档
```

## 适配工具

- **Claude Code**: 修改 `~/.claude/settings.json`
- **OpenCode**: 修改 `~/.config/opencode/opencode.jsonc`

## 安全说明

本工具的所有网络行为均在本地完成，不涉及任何外部数据传输：

- **本地 HTTP 服务**：`launcher.js`（端口 51234）和 `server.js`（端口 51235）仅监听 `127.0.0.1`，不暴露到外部网络。
- **配置文件存储**：所有 API Key 和配置以纯文本 JSON 格式存储在本地 `config.json` 中，不上传至任何服务器。
- **连通性测试**：仅在用户手动点击"测试"按钮时，向对应 Provider 的 API 端点发送轻量请求。
- **无遥测/追踪**：本工具不包含任何分析、遥测或数据收集代码。

## 许可证

MIT
