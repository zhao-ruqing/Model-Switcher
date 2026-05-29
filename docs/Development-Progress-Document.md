# Model-Switcher 开发进度文档

## 设计哲学

Model-Switcher 遵循四大核心原则：

1. **轻量极简** — 纯 Node.js Web 服务，零框架依赖，按需启动不常驻内存
2. **用户无感** — 开机自启、静默运行，浏览器打开即用，操作直觉化
3. **便携切换** — 一键切换 Provider 配置，适配器架构统一管理多工具
4. **完全本地安全** — 所有数据本地存储，无遥测/追踪/外部传输，API Key 不离开本机

## 最终开发目标

将 Model-Switcher 打造为**本地 AI 编程工具的配置管理中枢**：

- 统一管理 8 个 AI 编程工具的 Provider 配置（已完成 5 个）：
  - ✅ Claude Code、OpenCode、Codex、Aider、Continue
  - ⬜ Gemini CLI、OpenClaw、Hermes Agent
- 统一管理 MCP 服务器配置，跨工具一键同步
- 配置安全网：原子写入 + 自动备份 + 写入校验，杜绝配置损坏
- 丰富的 Provider 预设库，覆盖国内外主流 API 服务商
- 高效 UI：搜索过滤、批量测试、状态概览、键盘快捷键
- 配置可追溯：历史浏览、一键恢复、预设分享

> 参考来源：cc-switch 源码分析详见 `docs/reference-cc-switch.md`。
> 所有借鉴功能均保持轻量定位，不引入 SQLite/桌面框架等重型依赖。

**开发状态说明**：`未开始` → `待开发` → `进行中` → `已结束`

---

## AI 编码日志（务必执行）

**每次有代码变更的开发会话结束后，必须在 `docs/Progress-Log/` 下新建 `YYYY-MM-DD-HH-MM-当次修改简短总结.md`（北京时间，精确到分）。**

内容按以下三段结构严格编排，不写长段落，不用表格，不用代码块，全文中文，技术名词保留英文原词：

1. **已开发功能总结** — 用 5-8 条要点，概括项目目前已完成的全部核心功能模块。每条一行，动宾结构，不列具体文件或代码行。
2. **本次开发进度** — 仅记录本轮会话中实际完成的代码变更。包含：新增了什么、修改了什么、删除了什么、修复了什么。若涉及关键决策（如选型、架构调整），单独注明原因。
3. **下一步计划** — 列出接下来待做的具体任务，每条以动词开头，按优先级排序。已明确的方案直接写；暂未敲定的标注"待确认"。

---

## 已完成阶段总览

### 阶段一：零风险打磨 ✅

安全审计说明（README 安全章节）、Provider 预设模板扩展（Gemini/GPT/GLM/KIMI 等）、暗黑/明亮主题切换（CSS 变量 + localStorage 记忆）。

### 阶段二：功能增强 ✅

配置导入/导出（加密可选）、API Key 连通性测试、工具配置向导（分步引导）。

### 阶段三：跨平台支持 ✅

macOS launchd / Linux systemd 启动脚本、launcher.js 跨平台检测逻辑（windowsHide / detached + unref）。

### 阶段四：架构重构 ✅

token → apiKey 字段统一、插件式 ProviderAdapter 接口（switch/verify/getFields）、Provider 预设抽取到 presets.json 动态加载。

### 阶段五：CLI 工具扩展 ✅

新增 Codex 适配器（`providers/codex.js`，TOML 格式）、Aider 适配器（`providers/aider.js`，YAML 格式，支持 Anthropic/OpenAI 双 API）。

### 阶段六：IDE 工具扩展 ✅

新增 Continue 适配器（`providers/continue.js`，JSON 格式，支持 Anthropic/OpenAI 双 Provider）。

### 阶段七：启动体验优化 ✅

launcher.js 自守护化（TTY 检测 + 后台子进程 + EADDRINUSE 优雅退出）、Windows 开机自启脚本、第三方 API 测试逻辑修复。

---

## 阶段八：可靠性增强（借鉴 cc-switch）

目标：引入 cc-switch 的配置安全网设计，以最小改动提升可靠性，保持轻量定位（不引入 SQLite/桌面框架）。

> 全部方案来源于 cc-switch 源码分析，详见 `docs/reference-cc-switch.md`。

### 8.1 配置文件原子写入

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `src-tauri/src/config.rs` → `atomic_write()`
- **范围**：`server.js`、`providers/utils.js`、全部 5 个适配器
- **内容**：
  - 封装 `atomicWrite(filePath, data)` 工具函数：写入临时文件 → rename（优先原子）→ 失败时先删目标再 rename（Windows 兼容）
  - 临时文件名使用 `Date.now()` + `crypto.randomBytes` 保证唯一性
  - 封装 `writeJsonAtomic(filePath, obj)` 便捷函数
  - 替换 server.js 和全部适配器中所有 `writeJson` / `fs.writeFileSync` 调用
  - 清除各适配器中的本地 `writeJson` 冗余函数
- **改动量**：约 25 行工具函数 + 10 处替换
- **验收标准**：所有配置写入经过原子写入；模拟断电场景不发生配置损坏

### 8.2 配置文件自动备份

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `src-tauri/src/services/config.rs` → `ConfigService::create_backup()`
- **范围**：`server.js` 新增 `backupFile()` 函数
- **内容**：
  - 在导入配置、切换 Provider、删除配置操作前自动备份 `config.json`
  - 备份文件命名 `backup-YYYY-MM-DDTHH-mm-ss.json`，存入 `backups/` 目录
  - 轮转保留最近 10 份（按 mtime 排序，删最旧的）
- **改动量**：约 25 行工具函数 + 3 处调用
- **验收标准**：每次关键操作前有备份文件生成；备份数量不超过 10 份

### 8.3 Claude Code 配置项补全

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `src/config/claudeProviderPresets.ts` → `settingsConfig.env` 结构
- **范围**：`providers/claude.js`、`presets.json`
- **内容**：
  - `claude.js` 适配器新增写入字段：`ANTHROPIC_API_KEY`（与 `ANTHROPIC_AUTH_TOKEN` 二选一）、`API_TIMEOUT_MS`、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
  - 前端表单增加可选字段：API Key 字段类型（Token vs API Key）、超时设置
  - `presets.json` 的 Provider 定义新增 `apiKeyField` 字段，指示用哪种认证方式
- **改动量**：约 20 行适配器 + 20 行前端 + 预设数据
- **验收标准**：Gemini Native、PatewayAI 等使用 `ANTHROPIC_API_KEY` 的 Provider 可正确切换

### 8.4 Provider 预设数据丰富化

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `src/config/claudeProviderPresets.ts` 预设字段设计
- **范围**：`presets.json`
- **内容**：
  - 新增预设字段：`apiKeyUrl`（获取 API Key 的链接）、`category`（official/cn_official/third_party）、`websiteUrl`（官网地址）
  - 新增预设 Provider：火山 Agentplan、豆包 Seed、百炼、MiniMax、StepFun、魔搭、百度千帆、Longcat
  - 补齐现有预设的完整 Claude Code env 配置（含 DEFAULT_SONNET/OPUS/HAIKU_MODEL）
- **改动量**：约 80 行 JSON 数据
- **验收标准**：presets.json 预设数从 8 增至 16+，每个预设含完整配置

### 8.5 环境变量冲突检测（简化版）

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `src-tauri/src/services/env_checker.rs`
- **范围**：`server.js` 新增 `GET /api/env-check` 端点
- **内容**：
  - 检查 `process.env` 中的 `ANTHROPIC_*` 变量，返回冲突列表
  - 前端在切换 Provider 前调用，如有系统级 ANTHROPIC 变量则警告用户（会覆盖 settings.json 的配置）
  - 不实现注册表扫描（Windows）和 Shell 配置文件解析（Unix），保持轻量
- **改动量**：约 30 行后端 + 15 行前端
- **验收标准**：当系统设置了 `ANTHROPIC_BASE_URL` 环境变量时，页面提示冲突警告

### 8.6 配置写入后校验增强

- **状态**：✅ 已结束
- **借鉴来源**：cc-switch `atomic_write` + `write_json_file` 完整性保障
- **范围**：`providers/claude.js`、`providers/opencode.js`、`providers/codex.js`、`providers/aider.js`、`providers/continue.js`
- **内容**：
  - 各适配器 `switch()` 方法写入后立即重新读取文件，对比关键字段是否一致
  - 不一致时自动回滚（从备份恢复或重新写入）
  - util.js 新增 `verifyWrite(filePath, expectedFields)` 共享函数
- **改动量**：约 20 行工具函数 + 各适配器各加 3 行
- **验收标准**：写入后校验通过，配置不一致时自动修复

---

## 阶段九：文档完善

### 9.1 开发者文档 & Provider 开发指南

- **状态**：未开始
- **前置条件**：阶段五/六适配器稳定后才有实质内容可写
- **内容**：
  - 适配器开发指南（如何添加新工具支持）
  - API 测试器扩展说明
  - presets.json 配置说明

---

## 阶段十：MCP 服务器管理（借鉴 cc-switch）

目标：借鉴 cc-switch 的统一 MCP 管理面板，让 Model-Switcher 成为 MCP 服务器的配置中枢。各 CLI 工具的 MCP 配置格式不同，适配器模式已就绪，可统一管理。

> 借鉴来源：cc-switch `src-tauri/src/services/mcp.rs`、`src/components/mcp/`，详见 `docs/reference-cc-switch.md`。

### 10.1 MCP 服务器统一管理

- **状态**：待开发
- **可行性**：✅ 高（本质是配置文件 JSON 读写，适配器架构已就绪）
- **借鉴来源**：cc-switch `McpService` + `UnifiedMcpPanel.tsx`
- **范围**：`server.js` 新增 MCP API 端点 + `index.html` 新增 MCP 管理面板 + 各适配器新增 `getMcpConfig()` / `writeMcpConfig()` 方法
- **内容**：
  - 各适配器实现 MCP 配置读写：Claude Code 读写 `settings.json` 的 `mcpServers`、Codex 读写 `~/.codex/` 目录、OpenCode 读写 `opencode.jsonc` 等
  - 前端新增 MCP 服务器卡片列表：名称、命令、参数、启用状态
  - 支持添加、编辑、删除 MCP 服务器条目
  - 支持逐工具启用/禁用（复选框控制同步到哪些 CLI 工具）
  - JSON 导入：粘贴 MCP 配置 JSON 直接导入
- **改动量**：约 80 行后端 + 各适配器各加 20 行 + 150 行前端
- **验收标准**：添加 MCP 服务器后可一键同步到多个 CLI 工具的配置文件

### 10.2 MCP 配置双向同步

- **状态**：待开发
- **借鉴来源**：cc-switch `McpService` 双向同步机制
- **范围**：各适配器 MCP 方法
- **内容**：
  - 从 CLI 工具的 Live 配置文件中读取已有 MCP 服务器，展示在管理面板中
  - 在面板中修改后自动回写到对应配置文件
  - 切换 Provider 时保留 MCP 配置不被覆盖
- **改动量**：各适配器各加 10 行同步逻辑
- **验收标准**：手动编辑配置文件后刷新面板可见；面板修改后配置文件同步更新

---

## 阶段十一：UI/UX 增强（借鉴 cc-switch）

目标：借鉴 cc-switch 的前端交互设计，提升配置管理效率。随着预设数量增长（16+）和适配工具增多（6+），搜索过滤和批量操作成为刚需。

### 11.1 Provider 搜索过滤

- **状态**：待开发
- **借鉴来源**：cc-switch `ProviderList.tsx` 搜索框 + Tab 过滤
- **范围**：`index.html`
- **内容**：
  - Provider 列表顶部新增搜索框，按名称实时过滤
  - 新增分类 Tab 切换：全部 / CLI 工具（Claude Code、Codex、Aider…） / IDE 工具（Continue…）
  - 空结果时显示友好提示
- **改动量**：约 30 行 JS + 15 行 CSS
- **验收标准**：输入关键词即时过滤；Tab 切换仅显示对应类别

### 11.2 批量连通性测试

- **状态**：待开发
- **借鉴来源**：cc-switch `SpeedtestService` 并行端点测速
- **范围**：`server.js` + `index.html`
- **内容**：
  - 新增 `POST /api/test-all` 端点：并行测试所有已配置 Provider 的连通性
  - 前端新增"全部测试"按钮，进度条显示测试进度
  - 结果以列表展示：Provider 名称、状态（成功/失败）、响应时间
  - 支持按状态排序（失败的排前面）
- **改动量**：约 25 行后端 + 40 行前端
- **验收标准**：点击"全部测试"后并行检测所有配置，结果清晰展示

### 11.3 键盘快捷键

- **状态**：待开发
- **借鉴来源**：cc-switch 应用内键盘交互（Escape 关闭、Ctrl+F 搜索）
- **范围**：`index.html`
- **内容**：
  - `Ctrl+K` / `Cmd+K`：聚焦搜索框
  - `Escape`：关闭当前弹窗/对话框
  - `Ctrl+N` / `Cmd+N`：打开添加配置向导
- **改动量**：约 15 行 JS
- **验收标准**：快捷键在页面内可正常使用，不影响浏览器默认行为

### 11.4 Provider 状态概览

- **状态**：待开发
- **借鉴来源**：cc-switch `ProviderHealthBadge.tsx` 健康状态指示器
- **范围**：`index.html`
- **内容**：
  - Provider 卡片新增状态圆点：绿色（上次测试通过）、黄色（未测试/过期）、红色（上次测试失败）
  - Hover 显示 tooltip：最后测试时间、响应时间
  - 首页顶部新增统计摘要：配置总数、上次测试通过数、待测试数
- **改动量**：约 20 行前端
- **验收标准**：Provider 卡片直观显示连接状态，首页有全局概览

---

## 阶段十二：配置历史与预设分享（借鉴 cc-switch）

目标：借鉴 cc-switch 的配置安全网和预设生态，提供配置变更可追溯性和社区共享能力。

### 12.1 配置历史浏览器

- **状态**：待开发
- **借鉴来源**：cc-switch `ConfigService::create_backup()` + 备份轮转机制
- **前置条件**：8.2 配置文件自动备份完成后
- **范围**：`server.js` 新增 API + `index.html` 新增面板
- **内容**：
  - `GET /api/backups`：列出 `backups/` 目录下的所有备份文件（时间戳、大小）
  - `GET /api/backups/:id`：读取指定备份文件内容
  - `POST /api/backups/:id/restore`：从指定备份恢复配置
  - 前端新增"配置历史"面板：时间线视图展示备份列表，点击可预览差异，一键恢复
- **改动量**：约 40 行后端 + 60 行前端
- **验收标准**：可浏览历史备份、预览内容、一键恢复到任意版本

### 12.2 预设配置分享

- **状态**：待开发
- **借鉴来源**：cc-switch Deep Link 导入机制（`ccswitch://` 协议）
- **范围**：`server.js` + `index.html`
- **内容**：
  - 导出：将当前 Provider 配置导出为 JSON 片段（脱敏 API Key）
  - 导入：粘贴 JSON 片段或 URL 直接添加为新 Provider 配置
  - 预设库：支持从远程 URL 加载社区预设列表（可选，默认关闭）
- **改动量**：约 30 行后端 + 40 行前端
- **验收标准**：导出的 JSON 可被其他用户导入；URL 导入正常工作

---

## 阶段十三：CLI 工具扩展（借鉴 cc-switch）

目标：补齐 cc-switch 已支持但 Model-Switcher 尚未覆盖的 CLI 工具，完成"8 工具统一管理"的最终目标。适配器架构已就绪，每个适配器为独立文件，实现成本低。

### 13.1 Gemini CLI 适配器

- **状态**：待开发
- **可行性**：✅ 高（Google 官方 CLI，配置清晰）
- **借鉴来源**：cc-switch `src-tauri/src/config/gemini_config.rs`
- **范围**：新增 `providers/gemini.js` + 更新 `providers/index.js` + 前端导航
- **内容**：
  - 实现 `switch/verify/getFields` 三个方法
  - 配置文件路径：`~/.gemini/.env`（API Key + Base URL）+ `~/.gemini/settings.json`
  - 写入字段：`GEMINI_API_KEY`、`GOOGLE_GEMINI_BASE_URL`
  - 支持 Gemini API 连通性测试
- **改动量**：约 100 行新适配器 + 10 行注册 + 30 行前端
- **验收标准**：可添加、切换、测试 Gemini CLI 配置

### 13.2 OpenClaw 适配器

- **状态**：待开发
- **可行性**：✅ 高（TOML/YAML 配置，结构清晰）
- **借鉴来源**：cc-switch `src-tauri/src/config/openclaw_config.rs`
- **范围**：新增 `providers/openclaw.js` + 更新 `providers/index.js` + 前端导航
- **内容**：
  - 实现 `switch/verify/getFields` 三个方法
  - 配置文件路径：`~/.openclaw/config.toml`（TOML 格式）
  - 累加式管理 Provider 配置
- **改动量**：约 100 行新适配器 + 10 行注册 + 30 行前端
- **验收标准**：可添加、切换、测试 OpenClaw 配置

### 13.3 Hermes Agent 适配器

- **状态**：待开发
- **可行性**：✅ 高（YAML 配置，custom_providers 数组结构清晰）
- **借鉴来源**：cc-switch `src-tauri/src/config/hermes_config.rs`
- **范围**：新增 `providers/hermes.js` + 更新 `providers/index.js` + 前端导航
- **内容**：
  - 实现 `switch/verify/getFields` 三个方法
  - 配置文件路径：`~/.hermes/config.yaml`（YAML 格式）
  - 通过 `custom_providers` 数组管理多个 Provider，支持 `model.default` / `model.provider` / `model.base_url` 三级配置
- **改动量**：约 110 行新适配器 + 10 行注册 + 30 行前端
- **验收标准**：可添加、切换、测试 Hermes Agent 配置

---

## 阶段十四：工具函数与 UI 细节增强（借鉴 cc-switch）

目标：借鉴 cc-switch 的工程细节，提升配置文件质量和 UI 交互体验。均为独立小功能，可逐个实施。

### 14.1 JSON 确定性输出

- **状态**：待开发
- **借鉴来源**：cc-switch `src-tauri/src/proxy/json_canonical.rs` → `sort_json_keys()`
- **范围**：`providers/utils.js`、各适配器
- **内容**：
  - 封装 `sortJsonKeys(obj)` 工具函数：递归排序 JSON 对象所有 key（数组保持原序）
  - 所有配置文件写入前经过排序，确保输出确定性
  - 用途：git diff 友好、避免无意义的配置变更、便于配置对比
- **改动量**：约 15 行工具函数 + 各写入点调用
- **验收标准**：相同配置多次写入，文件内容完全一致（字节级）

### 14.2 配置变更前后对比

- **状态**：待开发
- **借鉴来源**：cc-switch 配置变更的双向同步检查机制
- **范围**：`server.js` + `index.html`
- **内容**：
  - 切换 Provider 前读取当前配置，切换后读取新配置，生成差异摘要
  - 前端在切换完成后展示"变更预览"：哪些字段被修改、修改前后的值
  - 可选：切换前弹出确认对话框，显示即将变更的内容
- **改动量**：约 30 行后端 + 25 行前端
- **验收标准**：切换后页面展示变更了哪些字段及具体差异

### 14.3 预设分类标签展示

- **状态**：待开发
- **借鉴来源**：cc-switch `ProviderPreset.category` 字段（official / cn_official / third_party）
- **范围**：`index.html`、`presets.json`
- **内容**：
  - `presets.json` 中已有 `category` 字段（8.4 新增），前端卡片展示对应标签
  - 标签样式：official（蓝色）、cn_official（绿色）、third_party（灰色）
  - 向导网格中按分类分组展示，官方源排在前面
- **改动量**：约 15 行 CSS + 10 行 JS
- **验收标准**：Provider 卡片和向导中显示分类标签

### 14.4 Provider 卡片拖拽排序

- **状态**：待开发
- **借鉴来源**：cc-switch `@dnd-kit/sortable` 拖拽排序 + `sort_index` 持久化
- **范围**：`index.html`
- **内容**：
  - 引入 SortableJS（CDN 加载，零 npm 依赖），Provider 列表支持拖拽排序
  - 排序结果持久化到 config.json 的 `sortIndex` 字段
  - 支持键盘辅助排序（上下箭头）
- **改动量**：约 20 行 JS（SortableJS CDN + 初始化 + 持久化）
- **验收标准**：拖拽 Provider 卡片可调整顺序，刷新后顺序保持

## 进度跟踪

| 阶段                       | 状态      | 开始日期   | 完成日期   | 备注            |
| -------------------------- | --------- | ---------- | ---------- | --------------- |
| 一 零风险打磨              | ✅ 已结束 | 2026-05-28 | 2026-05-28 |                 |
| 二 功能增强                | ✅ 已结束 | 2026-05-28 | 2026-05-28 |                 |
| 三 跨平台支持              | ✅ 已结束 | 2026-05-28 | 2026-05-28 |                 |
| 四 架构重构                | ✅ 已结束 | 2026-05-28 | 2026-05-28 |                 |
| 五 CLI 工具扩展            | ✅ 已结束 | 2026-05-28 | 2026-05-28 | Codex + Aider   |
| 六 IDE 工具扩展            | ✅ 已结束 | 2026-05-28 | 2026-05-28 | Continue        |
| 七 启动体验优化            | ✅ 已结束 | 2026-05-29 | 2026-05-29 |                 |
| 8.1 配置文件原子写入       | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 借鉴 cc-switch  |
| 8.2 配置文件自动备份       | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 借鉴 cc-switch  |
| 8.3 Claude Code 配置项补全 | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 借鉴 cc-switch  |
| 8.4 Provider 预设丰富化    | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 16 个预设       |
| 8.5 环境变量冲突检测       | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 简化版          |
| 8.6 配置写入后校验         | ✅ 已结束 | 2026-05-29 | 2026-05-29 | 借鉴 cc-switch  |
| 9.1 开发者文档             | ⬜ 未开始 | -          | -          |                 |
| 10.1 MCP 服务器统一管理    | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 10.2 MCP 配置双向同步      | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 11.1 Provider 搜索过滤     | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 11.2 批量连通性测试        | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 11.3 键盘快捷键            | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 11.4 Provider 状态概览     | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 12.1 配置历史浏览器        | ⬜ 待开发 | -          | -          | 依赖 8.2        |
| 12.2 预设配置分享          | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 13.1 Gemini CLI 适配器     | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 13.2 OpenClaw 适配器       | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 13.3 Hermes Agent 适配器   | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 14.1 JSON 确定性输出       | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 14.2 配置变更前后对比      | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 14.3 预设分类标签展示      | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
| 14.4 Provider 卡片拖拽排序 | ⬜ 待开发 | -          | -          | 借鉴 cc-switch  |
