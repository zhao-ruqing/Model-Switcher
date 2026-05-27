# AI 配置切换器

一个轻量级、按需启动的工具，用于快速管理和切换 Claude Code 和 OpenCode 的 API 模型配置。

## 核心特性

- **按需启动**：后台服务平时不占用资源，仅在访问管理页面时自动激活。
- **静默运行**：通过 VBS 脚本实现完全后台运行，无控制台窗口干扰。
- **多工具支持**：独立管理 Claude Code 和 OpenCode 的配置状态。
- **明文存储**：配置以纯文本 JSON 格式存储，方便手动查阅或备份。

## 快速开始

1. **安装依赖**：
   ```bash
   npm install
   ```
2. **设置开机自启**（推荐）：
   双击运行 `setup-autostart.vbs`，这会在你的 Windows 启动文件夹中创建一个静默运行的快捷方式。
3. **启动服务**：
   双击 `start-silent.vbs` 即可在后台启动管理界面。
4. **管理配置**：
   在浏览器访问 [http://localhost:51234](http://localhost:51234)。

## 适配工具

- **Claude Code**: 修改 `~/.claude/settings.json`
- **OpenCode**: 修改 `~/.config/opencode/opencode.jsonc` (支持最新的嵌套 Provider 格式)

## 目录结构

- `launcher.js`: 代理网关，负责按需拉起/关闭后台进程。
- `server.js`: 配置管理 API 服务。
- `index.html`: 管理界面 UI。
- `config.json`: 存储你的模型配置列表（已在 `.gitignore` 中）。
- `TODO.md`: 项目后续的拓展与改进计划。

## 许可证

MIT
