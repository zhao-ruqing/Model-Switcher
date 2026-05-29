# 阶段八：可靠性增强 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 借鉴 cc-switch 的配置安全网设计，为 Model-Switcher 引入原子写入、自动备份、配置校验等可靠性增强，保持轻量定位。

**架构：** 在 `providers/utils.js` 中集中封装原子写入和写入校验工具函数，所有适配器和 server.js 统一调用。备份逻辑集中在 server.js 的写入操作前触发。不引入任何新依赖。

**技术栈：** Node.js fs 模块（renameSync + writeFileSync + copyFileSync）

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `providers/utils.js` | 共享工具函数（getApiKey、atomicWrite、verifyWrite） | 修改 |
| `server.js` | API 服务（backupFile、env-check 端点、替换 writeJson） | 修改 |
| `providers/claude.js` | Claude Code 适配器（补全 env 变量、使用 atomicWrite） | 修改 |
| `providers/opencode.js` | OpenCode 适配器（使用 atomicWrite） | 修改 |
| `providers/codex.js` | Codex 适配器（使用 atomicWrite） | 修改 |
| `providers/aider.js` | Aider 适配器（使用 atomicWrite） | 修改 |
| `providers/continue.js` | Continue 适配器（使用 atomicWrite） | 修改 |
| `presets.json` | Provider 预设数据（新增字段和预设） | 修改 |
| `index.html` | 前端 UI（Claude 配置补全字段、env 冲突警告） | 修改 |

---

## 任务 1：原子写入（providers/utils.js + 所有适配器 + server.js）

**依赖：** 无（基础任务，后续所有任务依赖此任务）

**文件：**
- 修改：`providers/utils.js:1-7`
- 修改：`server.js:50-52`
- 修改：`providers/claude.js:15-17`
- 修改：`providers/opencode.js:15-17`
- 修改：`providers/codex.js:118-123`
- 修改：`providers/aider.js:90-92`
- 修改：`providers/continue.js:17-19`

- [ ] **步骤 1：在 utils.js 中封装 atomicWrite 和 writeJsonAtomic**

在 `providers/utils.js` 的 `getApiKey` 函数之后，添加以下代码：

```javascript
// 共享工具函数
const fs = require("fs");
const path = require("path");

// 兼容旧配置：统一读取 apiKey（旧字段名 token）
function getApiKey(config) {
  return config.apiKey || config.token || "";
}

// 原子写入：写入临时文件 → rename 到目标路径
// Windows 上 rename 目标存在会失败，需先删除
function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  const tmp = path.join(dir, `${name}.tmp.${Date.now()}`);
  fs.writeFileSync(tmp, data, "utf-8");
  if (process.platform === "win32" && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  fs.renameSync(tmp, filePath);
}

// 原子写入 JSON 对象
function writeJsonAtomic(filePath, obj) {
  atomicWrite(filePath, JSON.stringify(obj, null, 2));
}

module.exports = { getApiKey, atomicWrite, writeJsonAtomic };
```

- [ ] **步骤 2：替换 server.js 中的 writeJson 函数**

将 `server.js` 第 50-52 行的 `writeJson` 函数替换为导入原子写入版本：

```javascript
// 删除旧的 writeJson 函数定义：
// function writeJson(file, data) {
//   fs.writeFileSync(file, JSON.stringify(data, null, 2));
// }

// 在文件顶部 require 区域，修改 utils 导入：
const { getApiKey, writeJsonAtomic } = require("./providers/utils");

// 将所有 writeJson(CONFIG_FILE, data) 调用替换为 writeJsonAtomic(CONFIG_FILE, data)
```

具体替换位置（`server.js` 中所有 `writeJson(` 调用）：
- 第 66 行：`writeJson(CONFIG_FILE, DEFAULT_CONFIG);` → `writeJsonAtomic(CONFIG_FILE, DEFAULT_CONFIG);`
- 第 87 行：`writeJson(CONFIG_FILE, data);` → `writeJsonAtomic(CONFIG_FILE, data);`
- 第 106 行：`writeJson(CONFIG_FILE, data);` → `writeJsonAtomic(CONFIG_FILE, data);`
- 第 121 行：`writeJson(CONFIG_FILE, data);` → `writeJsonAtomic(CONFIG_FILE, data);`
- 第 159 行：`writeJson(CONFIG_FILE, imported);` → `writeJsonAtomic(CONFIG_FILE, imported);`
- 第 283 行：`writeJson(CONFIG_FILE, data);` → `writeJsonAtomic(CONFIG_FILE, data);`

- [ ] **步骤 3：替换 providers/claude.js 中的 writeJson 函数**

删除第 15-17 行的本地 `writeJson`，导入 `atomicWrite`：

```javascript
const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

// 删除旧的 writeJson 定义

// switch 方法中第 38 行替换：
// 旧：writeJson(CLAUDE_SETTINGS, s);
// 新：atomicWrite(CLAUDE_SETTINGS, JSON.stringify(s, null, 2));
```

- [ ] **步骤 4：替换 providers/opencode.js 中的 writeJson 函数**

删除第 15-17 行的本地 `writeJson`，导入 `atomicWrite`：

```javascript
const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

// 删除旧的 writeJson 定义

// switch 方法中第 85 行替换：
// 旧：writeJson(OPENCODE_SETTINGS, s);
// 新：atomicWrite(OPENCODE_SETTINGS, JSON.stringify(s, null, 2));
```

- [ ] **步骤 5：替换 providers/codex.js 中的写入函数**

修改 `writeConfig` 和 `writeAuth` 函数，使用 `atomicWrite`：

```javascript
const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

// writeConfig 函数（第 118-123 行）替换为：
function writeConfig(data) {
  if (!fs.existsSync(CODEX_DIR)) {
    fs.mkdirSync(CODEX_DIR, { recursive: true });
  }
  atomicWrite(CODEX_CONFIG, stringifyToml(data));
}

// writeAuth 函数（第 126-131 行）替换为：
function writeAuth(apiKey) {
  if (!fs.existsSync(CODEX_DIR)) {
    fs.mkdirSync(CODEX_DIR, { recursive: true });
  }
  atomicWrite(CODEX_AUTH, JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2));
}

// switch 方法中第 197 行的直接 fs.writeFileSync 也替换：
// 旧：fs.writeFileSync(CODEX_CONFIG, generateThirdPartyConfig(...));
// 新：atomicWrite(CODEX_CONFIG, generateThirdPartyConfig(...));
```

- [ ] **步骤 6：替换 providers/aider.js 中的 writeConfig 函数**

```javascript
const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

// writeConfig 函数（第 90-92 行）替换为：
function writeConfig(data) {
  atomicWrite(AIDER_CONFIG, stringifyYaml(data));
}
```

- [ ] **步骤 7：替换 providers/continue.js 中的 writeJson 函数**

```javascript
const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

// 删除旧的 writeJson 定义

// switch 方法中第 61 行替换：
// 旧：writeJson(CONTINUE_CONFIG, data);
// 新：atomicWrite(CONTINUE_CONFIG, JSON.stringify(data, null, 2));
```

- [ ] **步骤 8：手动验证**

运行 `node server.js`，访问浏览器，执行以下操作确认无报错：
1. 添加一个新配置
2. 编辑一个配置
3. 删除一个配置
4. 切换一个配置
5. 导入/导出配置

---

## 任务 2：配置文件自动备份（server.js）

**依赖：** 任务 1（原子写入）

**文件：**
- 修改：`server.js:1-10`（新增 backupFile 函数）
- 修改：`server.js` 的 import、switch、delete 端点

- [ ] **步骤 1：在 server.js 中添加 backupFile 函数**

在 `server.js` 的 `writeJsonAtomic` 导入之后，添加：

```javascript
const BACKUP_DIR = path.join(__dirname, "backups");
const MAX_BACKUPS = 10;

// 备份 config.json，轮转保留最近 10 份
function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(BACKUP_DIR, `backup-${ts}.json`);
  fs.copyFileSync(filePath, backupPath);
  // 轮转清理：按修改时间排序，删除最旧的
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);
  while (files.length > MAX_BACKUPS) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift().name));
  }
}
```

- [ ] **步骤 2：在关键操作前调用 backupFile**

在以下三个端点的 `writeJsonAtomic` 调用之前添加 `backupFile(CONFIG_FILE)`：

1. **POST /api/import**（导入配置，约第 159 行）：
```javascript
backupFile(CONFIG_FILE);
writeJsonAtomic(CONFIG_FILE, imported);
```

2. **POST /api/switch/:id**（切换配置，约第 283 行）：
```javascript
backupFile(CONFIG_FILE);
writeJsonAtomic(CONFIG_FILE, data);
```

3. **DELETE /api/configs/:id**（删除配置，约第 121 行）：
```javascript
backupFile(CONFIG_FILE);
writeJsonAtomic(CONFIG_FILE, data);
```

- [ ] **步骤 3：手动验证**

运行 `node server.js`，执行切换、删除、导入操作，检查 `backups/` 目录下是否有备份文件生成，且不超过 10 份。

---

## 任务 3：Claude Code 配置项补全（providers/claude.js + index.html）

**依赖：** 任务 1（原子写入）

**文件：**
- 修改：`providers/claude.js:22-39`（switch 方法）
- 修改：`providers/claude.js:41-64`（verify 方法）
- 修改：`providers/claude.js:66-73`（getFields 方法）
- 修改：`index.html`（编辑弹窗新增字段）

- [ ] **步骤 1：扩展 claude.js switch 方法，支持 ANTHROPIC_API_KEY 和 API_TIMEOUT_MS**

修改 `providers/claude.js` 的 `switch` 方法：

```javascript
switch(config) {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  }
  const s = readJson(CLAUDE_SETTINGS);
  if (!s.env) s.env = {};
  const key = getApiKey(config);

  // 支持两种认证方式：apiKeyField 指示用哪种
  if (config.apiKeyField === "ANTHROPIC_API_KEY") {
    if (key) s.env.ANTHROPIC_API_KEY = key;
    delete s.env.ANTHROPIC_AUTH_TOKEN;
  } else {
    if (key) s.env.ANTHROPIC_AUTH_TOKEN = key;
    delete s.env.ANTHROPIC_API_KEY;
  }

  if (config.baseUrl) s.env.ANTHROPIC_BASE_URL = config.baseUrl;
  if (config.model) {
    s.env.ANTHROPIC_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
  }
  if (config.haikuModel)
    s.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.haikuModel;

  // 新增：超时设置（第三方 API 可能需要更长超时）
  if (config.apiTimeoutMs) {
    s.env.API_TIMEOUT_MS = String(config.apiTimeoutMs);
  } else {
    delete s.env.API_TIMEOUT_MS;
  }

  // 新增：禁用非必要流量（减少第三方 API 调用）
  if (config.disableNonessentialTraffic) {
    s.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  } else {
    delete s.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
  }

  atomicWrite(CLAUDE_SETTINGS, JSON.stringify(s, null, 2));
},
```

- [ ] **步骤 2：扩展 claude.js verify 方法，校验新增字段**

```javascript
verify(config) {
  try {
    if (!fs.existsSync(CLAUDE_SETTINGS)) {
      return { ok: false, detail: "Claude Code 配置文件不存在，请先切换一次配置" };
    }
    const s = readJson(CLAUDE_SETTINGS);
    if (!s.env) {
      return { ok: false, detail: "Claude Code 配置中缺少 env 字段，请先切换一次配置" };
    }
    const key = getApiKey(config);
    // 根据 apiKeyField 检查对应的认证字段
    const authField = config.apiKeyField === "ANTHROPIC_API_KEY" ? "ANTHROPIC_API_KEY" : "ANTHROPIC_AUTH_TOKEN";
    if (key && s.env[authField] !== key) {
      return { ok: false, detail: `Claude Code 配置中的 ${authField} 与当前配置不一致，请重新切换` };
    }
    if (config.baseUrl && s.env.ANTHROPIC_BASE_URL !== config.baseUrl) {
      return { ok: false, detail: "Claude Code 配置中的 Base URL 与当前配置不一致，请重新切换" };
    }
    if (config.model && s.env.ANTHROPIC_MODEL !== config.model) {
      return { ok: false, detail: "Claude Code 配置中的模型与当前配置不一致，请重新切换" };
    }
    return { ok: true, detail: "Claude Code 本地配置正常" };
  } catch (e) {
    return { ok: false, detail: "读取本地配置失败：" + e.message };
  }
},
```

- [ ] **步骤 3：扩展 claude.js getFields 方法，新增可选字段**

```javascript
getFields() {
  return [
    { id: "apiKey", label: "API Token", type: "password", required: true },
    { id: "apiKeyField", label: "认证方式", type: "select", options: ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"] },
    { id: "baseUrl", label: "Base URL", type: "text" },
    { id: "model", label: "模型", type: "text" },
    { id: "haikuModel", label: "Haiku 模型", type: "text" },
    { id: "apiTimeoutMs", label: "超时 (ms)", type: "text" },
  ];
},
```

- [ ] **步骤 4：在 index.html 编辑弹窗中新增字段**

在编辑弹窗的 `editHaikuGroup` 之后、`editExtraBodyGroup` 之前，添加：

```html
<div class="form-group" id="editApiKeyFieldGroup" style="display: none">
  <label>认证方式</label>
  <div class="input-with-btn">
    <input type="text" id="editApiKeyField" value="ANTHROPIC_AUTH_TOKEN" />
  </div>
  <div class="hint">大多数 Provider 用 ANTHROPIC_AUTH_TOKEN，少数用 ANTHROPIC_API_KEY</div>
</div>
<div class="form-group" id="editApiTimeoutGroup" style="display: none">
  <label>超时 (ms)</label>
  <div class="input-with-btn">
    <input type="text" id="editApiTimeoutMs" placeholder="可选，如 3000000" />
  </div>
</div>
```

同步在 `editConfig` 函数中加载这些字段，在 `saveEdit` 函数中提交这些字段，在 `switchTool` 中控制显示/隐藏。

- [ ] **步骤 5：手动验证**

运行 `node server.js`，为 Claude Code 添加一个使用 `ANTHROPIC_API_KEY` 的配置（如 Gemini Native），切换后检查 `~/.claude/settings.json` 中是否正确写入了 `ANTHROPIC_API_KEY` 而非 `ANTHROPIC_AUTH_TOKEN`。

---

## 任务 4：Provider 预设数据丰富化（presets.json）

**依赖：** 无（纯数据变更）

**文件：**
- 修改：`presets.json`

- [ ] **步骤 1：扩展 presets.json 的 providers 字段，新增 category 和 apiKeyUrl**

将 `presets.json` 的 `providers` 部分扩展为：

```json
{
  "providers": {
    "deepseek": { "providerType": "openai", "icon": "sparkles", "category": "cn_official", "apiKeyUrl": "https://platform.deepseek.com/api_keys" },
    "mimo": { "providerType": "openai", "icon": "cpu", "category": "cn_official", "apiKeyUrl": "https://mimo.xiaomi.com/settings/api-keys" },
    "openai": { "providerType": "openai", "icon": "globe", "category": "official", "apiKeyUrl": "https://platform.openai.com/api-keys" },
    "gemini": { "providerType": "anthropic", "icon": "gem", "category": "official", "apiKeyUrl": "https://aistudio.google.com/apikey" },
    "glm": { "providerType": "anthropic", "icon": "brain", "category": "cn_official", "apiKeyUrl": "https://open.bigmodel.cn/usercenter/apikeys" },
    "kimi": { "providerType": "anthropic", "icon": "moon", "category": "cn_official", "apiKeyUrl": "https://platform.moonshot.cn/console/api-keys" },
    "mistral": { "providerType": "anthropic", "icon": "wind", "category": "official", "apiKeyUrl": "https://console.mistral.ai/api-keys/" },
    "groq": { "providerType": "openai", "icon": "zap", "category": "official", "apiKeyUrl": "https://console.groq.com/keys" },
    "volcengine": { "providerType": "anthropic", "icon": "flame", "category": "cn_official", "apiKeyUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" },
    "bailian": { "providerType": "anthropic", "icon": "cloud", "category": "cn_official", "apiKeyUrl": "https://bailian.console.aliyun.com/" },
    "minimax": { "providerType": "anthropic", "icon": "boxes", "category": "cn_official", "apiKeyUrl": "https://platform.minimaxi.com/user-center/basic-information/interface-key" },
    "stepfun": { "providerType": "anthropic", "icon": "footprints", "category": "cn_official", "apiKeyUrl": "https://platform.stepfun.com/docs/guide/create_api_key" },
    "modelscope": { "providerType": "anthropic", "icon": "atom", "category": "cn_official", "apiKeyUrl": "https://modelscope.cn/my/myaccesstoken" },
    "qianfan": { "providerType": "anthropic", "icon": "search", "category": "cn_official", "apiKeyUrl": "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application" },
    "longcat": { "providerType": "anthropic", "icon": "cat", "category": "third_party", "apiKeyUrl": "https://longcat.chat/settings/api-keys" },
    "shengsuanyun": { "providerType": "anthropic", "icon": "server", "category": "third_party", "apiKeyUrl": "https://shengsuanyun.com/dashboard" }
  }
}
```

- [ ] **步骤 2：扩展 presets.json 的 urls 字段，新增 Claude Code 专用预设 URL**

在 `urls.claude` 中新增：

```json
{
  "urls": {
    "claude": {
      "deepseek": "https://api.deepseek.com/anthropic",
      "mimo": "https://token-plan-sgp.xiaomimimo.com/anthropic",
      "openai": "https://api.openai.com/v1",
      "gemini": "https://generativelanguage.googleapis.com/v1beta",
      "glm": "https://open.bigmodel.cn/api/paas/v4",
      "kimi": "https://api.moonshot.cn/v1",
      "mistral": "https://api.mistral.ai/v1",
      "groq": "https://api.groq.com/openai/v1",
      "volcengine": "https://ark.cn-beijing.volces.com/api/coding",
      "bailian": "https://dashscope.aliyuncs.com/apps/anthropic",
      "minimax": "https://api.minimaxi.com/anthropic",
      "stepfun": "https://api.stepfun.com/step_plan",
      "modelscope": "https://api-inference.modelscope.cn",
      "qianfan": "https://qianfan.baidubce.com/anthropic/coding",
      "longcat": "https://api.longcat.chat/anthropic",
      "shengsuanyun": "https://router.shengsuanyun.com/api"
    }
  }
}
```

- [ ] **步骤 3：扩展 presets.json 的 models 字段，新增预设模型**

在 `models` 中新增：

```json
{
  "models": {
    "...existing...",
    "volcengine": { "main": "ark-code-latest", "haiku": "ark-code-latest" },
    "bailian": { "main": "qwen-max", "haiku": "qwen-turbo" },
    "minimax": { "main": "MiniMax-M2.7", "haiku": "MiniMax-M2.7" },
    "stepfun": { "main": "step-3.5-flash-2603", "haiku": "step-3.5-flash-2603" },
    "modelscope": { "main": "ZhipuAI/GLM-5", "haiku": "ZhipuAI/GLM-5" },
    "qianfan": { "main": "qianfan-code-latest", "haiku": "qianfan-code-latest" },
    "longcat": { "main": "LongCat-Flash-Chat", "haiku": "LongCat-Flash-Chat" },
    "shengsuanyun": { "main": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001" }
  }
}
```

- [ ] **步骤 4：同步更新 index.html 中的 BUILTIN_PRESETS**

在 `index.html` 的 `BUILTIN_PRESETS` 对象中同步新增的 providers、urls、models 数据（与 presets.json 保持一致），确保 API 不可用时前端仍有降级数据。

- [ ] **步骤 5：手动验证**

运行 `node server.js`，打开配置向导，确认新增的 Provider（火山、百炼、MiniMax 等）出现在选择列表中，选择后 URL 和模型能正确填充。

---

## 任务 5：环境变量冲突检测（server.js + index.html）

**依赖：** 无（独立功能）

**文件：**
- 修改：`server.js`（新增 `/api/env-check` 端点）
- 修改：`index.html`（切换前调用 env-check，显示警告）

- [ ] **步骤 1：在 server.js 中新增 GET /api/env-check 端点**

在 `/api/presets` 端点之后添加：

```javascript
// 检查系统环境变量中是否有冲突的 ANTHROPIC_* 配置
app.get("/api/env-check", (req, res) => {
  const conflicts = [];
  const envVars = [
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  ];
  for (const varName of envVars) {
    const val = process.env[varName];
    if (val) {
      // 脱敏：API Key 类变量只显示前 8 位
      const isKey = varName.includes("KEY") || varName.includes("TOKEN");
      const displayVal = isKey ? val.slice(0, 8) + "***" : val;
      conflicts.push({ name: varName, value: displayVal });
    }
  }
  res.json({ hasConflicts: conflicts.length > 0, conflicts });
});
```

- [ ] **步骤 2：在 index.html 的 switchConfig 函数中添加冲突检测**

修改 `switchConfig` 函数，在切换前先调用 env-check：

```javascript
async function switchConfig(id) {
  try {
    // 检查环境变量冲突
    const envRes = await fetch("/api/env-check");
    const envData = await envRes.json();
    if (envData.hasConflicts) {
      const conflictList = envData.conflicts.map(c => `${c.name}=${c.value}`).join("\n");
      const shouldContinue = await showConfirmDialog(
        "检测到环境变量冲突",
        `系统环境变量中存在以下 ANTHROPIC_* 配置，可能会覆盖 settings.json 中的设置：\n\n${conflictList}\n\n是否仍要切换？`,
        "继续切换",
        "取消"
      );
      if (!shouldContinue) return;
    }

    const res = await fetch(`/api/switch/${id}`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast("切换成功");
      if (currentTool === "claude") activeClaudeId = id;
      else if (currentTool === "opencode") activeOpencodeId = id;
      else if (currentTool === "codex") activeCodexId = id;
      else if (currentTool === "aider") activeAiderId = id;
      else if (currentTool === "continue") activeContinueId = id;
      render();
    }
  } catch (e) {
    showToast("失败", false);
  }
}
```

- [ ] **步骤 3：手动验证**

设置一个系统环境变量 `ANTHROPIC_BASE_URL=https://test.example.com`，然后尝试切换 Claude Code 配置，确认页面弹出冲突警告对话框。

---

## 任务 6：配置写入后校验（providers/utils.js + 所有适配器）

**依赖：** 任务 1（原子写入）

**文件：**
- 修改：`providers/utils.js`（新增 verifyWrite 函数）
- 修改：`providers/claude.js`（switch 末尾调用 verifyWrite）
- 修改：`providers/opencode.js`（switch 末尾调用 verifyWrite）
- 修改：`providers/continue.js`（switch 末尾调用 verifyWrite）

- [ ] **步骤 1：在 utils.js 中封装 verifyWrite 函数**

```javascript
// 写入后校验：读取文件，对比关键字段是否一致
// 返回 { ok: boolean, detail: string }
function verifyWrite(filePath, expectedFields) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, detail: "写入后文件不存在" };
    }
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const [fieldPath, expectedVal] of Object.entries(expectedFields)) {
      // 支持嵌套路径如 "env.ANTHROPIC_AUTH_TOKEN"
      const parts = fieldPath.split(".");
      let actual = content;
      for (const part of parts) {
        actual = actual?.[part];
      }
      if (expectedVal && actual !== expectedVal) {
        return { ok: false, detail: `字段 ${fieldPath} 写入不一致：期望 "${expectedVal}"，实际 "${actual}"` };
      }
    }
    return { ok: true, detail: "写入校验通过" };
  } catch (e) {
    return { ok: false, detail: "写入校验失败：" + e.message };
  }
}
```

导出更新：`module.exports = { getApiKey, atomicWrite, writeJsonAtomic, verifyWrite };`

- [ ] **步骤 2：在 claude.js switch 末尾添加写入校验**

```javascript
// switch 方法末尾，在 atomicWrite 之后添加：
const { verifyWrite } = require("./utils");

// ... switch 方法最后：
atomicWrite(CLAUDE_SETTINGS, JSON.stringify(s, null, 2));

// 写入后校验
const authField = config.apiKeyField === "ANTHROPIC_API_KEY" ? "ANTHROPIC_API_KEY" : "ANTHROPIC_AUTH_TOKEN";
const check = verifyWrite(CLAUDE_SETTINGS, {
  [`env.${authField}`]: key || undefined,
  "env.ANTHROPIC_BASE_URL": config.baseUrl || undefined,
  "env.ANTHROPIC_MODEL": config.model || undefined,
});
if (!check.ok) {
  throw new Error("配置写入校验失败：" + check.detail);
}
```

- [ ] **步骤 3：在 opencode.js switch 末尾添加写入校验**

```javascript
// switch 方法末尾：
atomicWrite(OPENCODE_SETTINGS, JSON.stringify(s, null, 2));

const { verifyWrite } = require("./utils");
const check = verifyWrite(OPENCODE_SETTINGS, {
  [`provider.${providerKey}.options.apiKey`]: getApiKey(config) || undefined,
  "model": `${providerKey}/${modelId}`,
});
if (!check.ok) {
  throw new Error("配置写入校验失败：" + check.detail);
}
```

- [ ] **步骤 4：在 continue.js switch 末尾添加写入校验**

```javascript
// switch 方法末尾：
atomicWrite(CONTINUE_CONFIG, JSON.stringify(data, null, 2));

const { verifyWrite } = require("./utils");
const check = verifyWrite(CONTINUE_CONFIG, {
  "models.0.provider": provider,
  "models.0.model": config.model || undefined,
});
if (!check.ok) {
  throw new Error("配置写入校验失败：" + check.detail);
}
```

- [ ] **步骤 5：手动验证**

运行 `node server.js`，切换 Claude Code 配置，确认无报错。故意在 verifyWrite 中设置一个错误的期望值，确认会抛出校验失败错误。

---

## 执行顺序

```
任务 1（原子写入）→ 任务 2（自动备份）
                 → 任务 3（Claude 配置补全）
                 → 任务 6（写入校验）

任务 4（预设丰富化）→ 独立，随时可做
任务 5（环境变量检测）→ 独立，随时可做
```

推荐执行顺序：1 → 2 → 3 → 4 → 5 → 6

每个任务完成后运行 `node server.js` 进行功能验证，确认无回归后再进入下一个任务。
