# AI 配置切换器

快速切换 Claude Code / OpenCode 的模型配置。

## 安装

```bash
npm install
```

## 使用

双击 `启动服务.vbs`，浏览器自动打开 http://localhost:51234

切换左侧菜单选择 Claude Code 或 OpenCode，点击配置项的"切换"按钮即可。

## 支持的模型

- DeepSeek: `deepseek-v4-pro` / `deepseek-v4-flash`
- MiMo: `mimo-v2.5-pro`

## 配置文件

- Claude Code: `~/.claude/settings.json`
- OpenCode: `~/.opencode.json`
- 本工具配置: `config.json`（Token 已加密，已加入 `.gitignore`）
