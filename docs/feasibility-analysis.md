# Model-Switcher 扩展可行性分析

## 一、现有架构分析

### 1.1 核心设计模式

项目采用**适配器模式**，每个工具（Claude Code / OpenCode）有独立的适配器：

```
providers/
├── index.js      # 适配器注册中心 + API 测试器
├── claude.js     # Claude Code 适配器
└── opencode.js   # OpenCode 适配器
```

每个适配器必须实现三个方法：

| 方法 | 作用 |
|------|------|
| `switch(config)` | 将配置写入工具的本地配置文件 |
| `verify(config)` | 验证本地配置是否与当前配置一致 |
| `getFields()` | 返回该工具需要的表单字段定义 |

### 1.2 配置存储结构

```json
{
  "configs": [
    {
      "id": "1779876824796",
      "name": "DeepSeek",
      "type": "claude",           // 工具类型
      "providerType": "anthropic", // API 兼容类型
      "apiKey": "sk-xxx",
      "baseUrl": "https://...",
      "model": "deepseek-v4-pro",
      "haikuModel": "deepseek-v4-flash",
      "extraBody": null
    }
  ],
  "activeClaudeId": "xxx",
  "activeOpencodeId": "xxx"
}
```

### 1.3 API 测试机制

支持两种 API 兼容类型：
- `anthropic`：测试 `/v1/messages` 端点
- `openai`：测试 `/v1/models` 端点

---

## 二、扩展目标工具分析

### 2.1 Codex (OpenAI Codex CLI)

**工具简介**：OpenAI 官方的 CLI 编程助手

**配置方式**：
- 配置文件：`~/.codex/config.json` 或环境变量
- 关键配置：`OPENAI_API_KEY`、`OPENAI_BASE_URL`

**可行性**：✅ **高**
- 配置结构简单，与 OpenAI API 兼容
- 只需读写一个 JSON 文件或设置环境变量
- API 测试器已有 `openai` 类型支持

**实现复杂度**：低

**适配器示例**：
```javascript
// providers/codex.js
const CODUS_CONFIG = path.join(process.env.USERPROFILE, ".codex", "config.json");

module.exports = {
  name: "Codex",
  switch(config) {
    // 写入 ~/.codex/config.json
  },
  verify(config) {
    // 验证配置一致性
  },
  getFields() {
    return [
      { id: "apiKey", label: "API Key", type: "password", required: true },
      { id: "baseUrl", label: "Base URL", type: "text" },
      { id: "model", label: "模型", type: "text" },
    ];
  }
};
```

---

### 2.2 Cursor

**工具简介**：AI 增强的代码编辑器（基于 VS Code）

**配置方式**：
- 配置文件：`~/.cursor/config.json` 或 `%APPDATA%\Cursor\User\settings.json`
- 支持自定义 API 端点和模型

**可行性**：⚠️ **中等**

**挑战**：
1. Cursor 是 GUI 编辑器，配置方式与 CLI 工具不同
2. 需要研究其配置文件格式和 API Key 存储位置
3. 可能需要通过 VS Code 的 `settings.json` 格式配置
4. 某些功能可能需要 Cursor 重启才能生效

**实现复杂度**：中等

**需要调研**：
- Cursor 的配置文件路径和格式
- 是否支持通过配置文件切换 API 端点
- 模型配置的具体字段名

---

### 2.3 Cline (VS Code 扩展)

**工具简介**：VS Code 中的 AI 编程助手扩展

**配置方式**：
- 配置文件：VS Code 的 `settings.json` 或扩展自己的存储
- 支持多种 API Provider（Anthropic、OpenAI、Google 等）

**可行性**：⚠️ **中等**

**挑战**：
1. 配置存储在 VS Code 的全局状态或 settings.json 中
2. 需要了解 VS Code 扩展的配置读写机制
3. 可能需要通过 VS Code API 或直接修改 JSON 文件

**实现复杂度**：中等

---

### 2.4 Aider

**工具简介**：终端中的 AI 编程助手

**配置方式**：
- 配置文件：`~/.aider.conf.yml` 或命令行参数
- 支持环境变量：`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等

**可行性**：✅ **高**

**优势**：
1. 配置文件格式简单（YAML）
2. 支持环境变量，切换方便
3. API 兼容性好（支持 Anthropic、OpenAI 等）

**实现复杂度**：低

**适配器示例**：
```javascript
// providers/aider.js
const AIDER_CONFIG = path.join(process.env.USERPROFILE, ".aider.conf.yml");

module.exports = {
  name: "Aider",
  switch(config) {
    // 写入 YAML 配置或设置环境变量
  },
  verify(config) {
    // 验证配置
  },
  getFields() {
    return [
      { id: "apiKey", label: "API Key", type: "password", required: true },
      { id: "providerType", label: "Provider", type: "select", options: ["anthropic", "openai"] },
      { id: "baseUrl", label: "Base URL", type: "text" },
      { id: "model", label: "模型", type: "text" },
    ];
  }
};
```

---

### 2.5 Continue

**工具简介**：VS Code / JetBrains 的 AI 编程助手

**配置方式**：
- 配置文件：`~/.continue/config.json`
- 支持多种模型 Provider

**可行性**：✅ **高**

**优势**：
1. 配置文件格式清晰（JSON）
2. 支持自定义 API 端点
3. 文档完善

**实现复杂度**：低

---

### 2.6 Windsurf (Codeium)

**工具简介**：AI 驱动的代码编辑器

**配置方式**：
- 配置文件：`~/.codeium/windsurf/config.json` 或类似路径
- 支持自定义模型配置

**可行性**：⚠️ **中等**

**挑战**：
1. 配置文件路径和格式需要调研
2. 可能需要 GUI 操作才能切换
3. API 兼容性不确定

**实现复杂度**：中等

---

### 2.7 GitHub Copilot CLI

**工具简介**：GitHub 的 AI 编程助手 CLI 版本

**配置方式**：
- 通过 `gh copilot` 命令配置
- 配置存储在 GitHub CLI 的配置目录

**可行性**：❌ **低**

**挑战**：
1. 主要依赖 GitHub 账号认证，不支持自定义 API 端点
2. 配置方式不透明
3. 不适合 Model-Switcher 的使用场景

---

## 三、扩展优先级建议

| 优先级 | 工具 | 可行性 | 理由 |
|--------|------|--------|------|
| P0 | Codex | ✅ 高 | OpenAI 官方 CLI，配置简单 |
| P0 | Aider | ✅ 高 | 流行的 CLI 工具，配置清晰 |
| P1 | Continue | ✅ 高 | 多 IDE 支持，配置规范 |
| P2 | Cursor | ⚠️ 中 | GUI 工具，需要更多调研 |
| P2 | Cline | ⚠️ 中 | VS Code 扩展，配置复杂 |
| P3 | Windsurf | ⚠️ 中 | 较新工具，文档较少 |
| P4 | Copilot CLI | ❌ 低 | 不支持自定义 API |

---

## 四、技术实现方案

### 4.1 代码结构变更

```
providers/
├── index.js        # 适配器注册中心
├── claude.js       # Claude Code
├── opencode.js     # OpenCode
├── codex.js        # [新增] Codex
├── aider.js        # [新增] Aider
├── continue.js     # [新增] Continue
└── cursor.js       # [新增] Cursor (可选)
```

### 4.2 配置存储扩展

需要在 `config.json` 中添加新的 `activeXxxId` 字段：

```json
{
  "configs": [...],
  "activeClaudeId": "xxx",
  "activeOpencodeId": "xxx",
  "activeCodexId": "xxx",      // 新增
  "activeAiderId": "xxx",      // 新增
  "activeContinueId": "xxx"    // 新增
}
```

### 4.3 前端 UI 变更

1. **侧边栏导航**：添加新工具的导航项
2. **配置表单**：根据工具类型动态显示/隐藏字段
3. **配置向导**：扩展工具选择步骤

### 4.4 API 测试器扩展

当前支持 `anthropic` 和 `openai` 两种 API 类型，基本覆盖主流场景。如需支持新的 API 格式，可在 `testers` 对象中添加。

---

## 五、工作量估算

| 工具 | 开发时间 | 测试时间 | 总计 |
|------|----------|----------|------|
| Codex | 2 小时 | 1 小时 | 3 小时 |
| Aider | 2 小时 | 1 小时 | 3 小时 |
| Continue | 3 小时 | 1 小时 | 4 小时 |
| Cursor | 4 小时 | 2 小时 | 6 小时 |
| Cline | 4 小时 | 2 小时 | 6 小时 |

---

## 六、建议的实施路径

### 第一阶段：CLI 工具扩展（1-2 天）
1. 实现 Codex 适配器
2. 实现 Aider 适配器
3. 更新前端 UI 支持新工具

### 第二阶段：IDE 工具扩展（3-5 天）
1. 调研 Cursor / Cline 的配置机制
2. 实现 Continue 适配器
3. 实现 Cursor 或 Cline 适配器（根据调研结果）

### 第三阶段：优化完善（持续）
1. 添加更多工具支持
2. 优化配置向导
3. 添加批量切换功能

---

## 七、结论

Model-Switcher 的适配器架构设计良好，扩展新工具的成本较低。建议优先扩展 CLI 工具（Codex、Aider），因为它们的配置方式与现有工具类似，实现简单且用户需求明确。IDE 工具（Cursor、Cline）需要更多调研，但技术上是可行的。
