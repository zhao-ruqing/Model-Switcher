# 阶段十 + 阶段十一 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现 MCP 服务器统一管理（仅 Claude Code）和 UI/UX 增强（搜索过滤、批量测试、键盘快捷键、状态概览）

**架构：** 后端在 server.js 新增 MCP API 端点，claude.js 适配器新增 MCP 读写方法；前端在 index.html 新增 MCP 管理页面、搜索框、批量测试、快捷键和状态圆点。config.json 数据模型扩展 lastTestStatus/lastTestTime/lastTestElapsed 三个字段。

**技术栈：** Node.js + Express + 原生 HTML/CSS/JS + Lucide Icons

---

## 文件结构

| 文件 | 职责 | 变更类型 |
|------|------|----------|
| `providers/claude.js` | Claude Code 适配器，新增 MCP 配置读写方法 | 修改 |
| `server.js` | API 服务，新增 MCP CRUD 端点、测试端点写入状态、编辑端点重置状态 | 修改 |
| `index.html` | 前端 UI，新增 MCP 管理页面、搜索框、批量测试、快捷键、状态圆点 | 修改 |

---

## 任务 1：Claude 适配器新增 MCP 方法

**文件：**
- 修改：`providers/claude.js:15-108`

- [ ] **步骤 1：在 claude.js 的 module.exports 中新增 getMcpConfig 方法**

在 `getFields()` 方法之后，添加 `getMcpConfig()` 方法：

```javascript
  getMcpConfig() {
    const s = readJson(CLAUDE_SETTINGS);
    return s.mcpServers || {};
  },
```

- [ ] **步骤 2：在 claude.js 的 module.exports 中新增 writeMcpConfig 方法**

紧接 `getMcpConfig()` 之后，添加 `writeMcpConfig(mcpServers)` 方法：

```javascript
  writeMcpConfig(mcpServers) {
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }
    const s = readJson(CLAUDE_SETTINGS);
    s.mcpServers = mcpServers;
    writeJsonAtomic(CLAUDE_SETTINGS, s);

    // 写入后校验
    const check = verifyWrite(CLAUDE_SETTINGS, {});
    if (!check.ok) {
      throw new Error("MCP 配置写入校验失败：" + check.detail);
    }
  },
```

- [ ] **步骤 3：验证代码语法正确**

运行：`node -e "const c = require('./providers/claude'); console.log(typeof c.getMcpConfig, typeof c.writeMcpConfig)"`
预期输出：`function function`

- [ ] **步骤 4：Commit**

```bash
git add providers/claude.js
git commit -m "feat(claude): 新增 getMcpConfig/writeMcpConfig 方法"
```

---

## 任务 2：Server.js 新增 MCP API 端点

**文件：**
- 修改：`server.js:210-218`（在 `/api/fields/:tool` 端点之后插入）

- [ ] **步骤 1：新增 GET /api/mcp/:tool 端点**

在 `app.get("/api/fields/:tool", ...)` 之后，添加：

```javascript
// MCP 服务器管理：读取指定工具的 MCP 配置
app.get("/api/mcp/:tool", (req, res) => {
  const adapter = providers[req.params.tool];
  if (!adapter) return res.status(404).json({ error: "不支持的工具类型" });
  if (!adapter.getMcpConfig) return res.status(501).json({ error: "该工具暂不支持 MCP 管理" });
  try {
    const mcpServers = adapter.getMcpConfig();
    res.json({ mcpServers });
  } catch (e) {
    res.status(500).json({ error: "读取 MCP 配置失败：" + e.message });
  }
});
```

- [ ] **步骤 2：新增 POST /api/mcp/:tool 端点（添加 MCP 服务器）**

紧接上一个端点之后：

```javascript
// MCP 服务器管理：添加 MCP 服务器
app.post("/api/mcp/:tool", (req, res) => {
  const adapter = providers[req.params.tool];
  if (!adapter) return res.status(404).json({ error: "不支持的工具类型" });
  if (!adapter.getMcpConfig || !adapter.writeMcpConfig) {
    return res.status(501).json({ error: "该工具暂不支持 MCP 管理" });
  }
  const { name, command, args, env } = req.body;
  if (!name || !command) return res.status(400).json({ error: "名称和命令为必填项" });
  try {
    const mcpServers = adapter.getMcpConfig();
    if (mcpServers[name]) return res.status(409).json({ error: `MCP 服务器 "${name}" 已存在` });
    const entry = { command };
    if (args && args.length > 0) entry.args = args;
    if (env && Object.keys(env).length > 0) entry.env = env;
    mcpServers[name] = entry;
    adapter.writeMcpConfig(mcpServers);
    res.json({ success: true, mcpServers });
  } catch (e) {
    res.status(500).json({ error: "添加 MCP 服务器失败：" + e.message });
  }
});
```

- [ ] **步骤 3：新增 PUT /api/mcp/:tool/:name 端点（编辑 MCP 服务器）**

```javascript
// MCP 服务器管理：编辑 MCP 服务器
app.put("/api/mcp/:tool/:name", (req, res) => {
  const adapter = providers[req.params.tool];
  if (!adapter) return res.status(404).json({ error: "不支持的工具类型" });
  if (!adapter.getMcpConfig || !adapter.writeMcpConfig) {
    return res.status(501).json({ error: "该工具暂不支持 MCP 管理" });
  }
  const { name } = req.params;
  const { command, args, env } = req.body;
  if (!command) return res.status(400).json({ error: "命令为必填项" });
  try {
    const mcpServers = adapter.getMcpConfig();
    if (!mcpServers[name]) return res.status(404).json({ error: `MCP 服务器 "${name}" 不存在` });
    const entry = { command };
    if (args && args.length > 0) entry.args = args;
    if (env && Object.keys(env).length > 0) entry.env = env;
    mcpServers[name] = entry;
    adapter.writeMcpConfig(mcpServers);
    res.json({ success: true, mcpServers });
  } catch (e) {
    res.status(500).json({ error: "编辑 MCP 服务器失败：" + e.message });
  }
});
```

- [ ] **步骤 4：新增 DELETE /api/mcp/:tool/:name 端点（删除 MCP 服务器）**

```javascript
// MCP 服务器管理：删除 MCP 服务器
app.delete("/api/mcp/:tool/:name", (req, res) => {
  const adapter = providers[req.params.tool];
  if (!adapter) return res.status(404).json({ error: "不支持的工具类型" });
  if (!adapter.getMcpConfig || !adapter.writeMcpConfig) {
    return res.status(501).json({ error: "该工具暂不支持 MCP 管理" });
  }
  const { name } = req.params;
  try {
    const mcpServers = adapter.getMcpConfig();
    if (!mcpServers[name]) return res.status(404).json({ error: `MCP 服务器 "${name}" 不存在` });
    delete mcpServers[name];
    adapter.writeMcpConfig(mcpServers);
    res.json({ success: true, mcpServers });
  } catch (e) {
    res.status(500).json({ error: "删除 MCP 服务器失败：" + e.message });
  }
});
```

- [ ] **步骤 5：Server.js 测试端点写入状态（POST /api/test/:id）**

在 `server.js` 的 `app.post("/api/test/:id", ...)` 处理函数中，在 `res.json(testResult)` 之前，添加状态持久化逻辑。找到这段代码（约第 402 行）：

```javascript
    res.json(testResult);
```

在其之前插入：

```javascript
    // 持久化测试结果到 config.json
    const testStatus = testResult.success || testResult.apiOk ? "ok" : "fail";
    const configIndex = data.configs.findIndex((c) => c.id === req.params.id);
    if (configIndex !== -1) {
      data.configs[configIndex].lastTestStatus = testStatus;
      data.configs[configIndex].lastTestTime = new Date().toISOString();
      data.configs[configIndex].lastTestElapsed = testResult.elapsed || 0;
      writeJsonAtomic(CONFIG_FILE, data);
    }
```

- [ ] **步骤 6：Server.js 编辑端点重置状态（PUT /api/configs/:id）**

在 `server.js` 的 `app.put("/api/configs/:id", ...)` 中，找到 `data.configs[index] = { ...data.configs[index], ...updates };`（约第 121 行），在其之后插入：

```javascript
    // 编辑配置后重置测试状态
    data.configs[index].lastTestStatus = null;
    data.configs[index].lastTestTime = null;
    data.configs[index].lastTestElapsed = null;
```

- [ ] **步骤 7：验证服务启动正常**

运行：`node -e "require('./server')"` 然后 Ctrl+C
预期：无报错，服务正常启动

- [ ] **步骤 8：Commit**

```bash
git add server.js
git commit -m "feat(server): 新增 MCP CRUD 端点，测试状态持久化，编辑重置状态"
```

---

## 任务 3：前端 - MCP 管理页面

**文件：**
- 修改：`index.html`（CSS、HTML、JS 三部分）

- [ ] **步骤 1：侧边栏新增 MCP 管理导航项**

在 `index.html` 的侧边栏 `<div class="nav">` 中，在 Continue 导航项之后添加：

```html
          <div
            class="nav-item"
            onclick="switchTool('mcp')"
            id="nav-mcp"
          >
            <i data-lucide="puzzle" style="margin-right: 6px"></i>MCP 管理
          </div>
```

- [ ] **步骤 2：新增 MCP 管理页面 HTML 结构**

在 `index.html` 的 `<div class="content-body">` 中，在"添加配置"卡片之后，添加 MCP 管理页面（默认隐藏）：

```html
          <!-- MCP 管理页面（默认隐藏） -->
          <div id="mcpPage" style="display: none">
            <div class="card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px">
                <div class="card-title" style="margin-bottom: 0">MCP 服务器</div>
                <button class="btn-sm btn-switch" onclick="openMcpModal()" style="padding: 6px 12px; font-size: 12px">
                  <i data-lucide="plus" class="icon-sm"></i> 添加
                </button>
              </div>
              <div class="config-list" id="mcpList"></div>
            </div>
          </div>
```

- [ ] **步骤 3：新增 MCP 添加/编辑弹窗 HTML**

在 `index.html` 的 `</body>` 之前（wizardModal 之后），添加 MCP 弹窗：

```html
    <!-- MCP 添加/编辑弹窗 -->
    <div class="modal" id="mcpModal">
      <div class="modal-box" style="width: 450px">
        <div class="modal-title" style="display: flex; justify-content: space-between; align-items: center">
          <span id="mcpModalTitle">添加 MCP 服务器</span>
          <button onclick="closeMcpModal()" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; border-radius: 4px; display: flex; align-items: center">
            <i data-lucide="x"></i>
          </button>
        </div>
        <input type="hidden" id="mcpEditName" value="" />
        <div class="form-group">
          <label>名称</label>
          <div class="input-with-btn">
            <input type="text" id="mcpName" placeholder="如 filesystem, github" />
          </div>
        </div>
        <div class="form-group">
          <label>命令</label>
          <div class="input-with-btn">
            <input type="text" id="mcpCommand" placeholder="npx / node / python" />
          </div>
        </div>
        <div class="form-group">
          <label>参数（每行一个）</label>
          <div class="input-with-btn">
            <textarea id="mcpArgs" rows="3" placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/dir" style="width: 100%; padding: 7px 9px; border: 1px solid var(--input-border); border-radius: 5px; font-size: 13px; color: var(--text-primary); background: var(--input-bg); resize: vertical; font-family: inherit"></textarea>
          </div>
        </div>
        <div class="form-group">
          <label>环境变量（JSON 格式，可选）</label>
          <div class="input-with-btn">
            <textarea id="mcpEnv" rows="2" placeholder='{"KEY": "value"}' style="width: 100%; padding: 7px 9px; border: 1px solid var(--input-border); border-radius: 5px; font-size: 13px; color: var(--text-primary); background: var(--input-bg); resize: vertical; font-family: inherit"></textarea>
          </div>
        </div>
        <div class="form-group">
          <label>或粘贴 JSON 直接导入</label>
          <div class="input-with-btn">
            <textarea id="mcpJsonImport" rows="3" placeholder='{"command": "npx", "args": ["-y", "package-name"]}' style="width: 100%; padding: 7px 9px; border: 1px solid var(--input-border); border-radius: 5px; font-size: 13px; color: var(--text-primary); background: var(--input-bg); resize: vertical; font-family: monospace" oninput="parseMcpJson(this.value)"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" onclick="closeMcpModal()">取消</button>
          <button class="btn-confirm" onclick="saveMcp()">保存</button>
        </div>
      </div>
    </div>
```

- [ ] **步骤 4：新增 MCP 相关 CSS 样式**

在 `index.html` 的 `<style>` 标签内（`.dialog-actions` 样式之后），添加：

```css
      /* MCP 卡片样式 */
      .mcp-card {
        display: flex;
        align-items: flex-start;
        padding: 10px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
      }
      .mcp-card:hover {
        border-color: var(--border-hover);
        background: var(--bg-hover);
      }
      .mcp-card .mcp-info {
        flex: 1;
        min-width: 0;
      }
      .mcp-card .mcp-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .mcp-card .mcp-detail {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mcp-card .mcp-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
        margin-left: 10px;
      }
```

- [ ] **步骤 5：新增 MCP JavaScript 逻辑**

在 `index.html` 的 `<script>` 标签内，`toggleTheme` 函数之后，添加 MCP 管理逻辑：

```javascript
      // ========== MCP 管理 ==========
      let mcpServers = {};

      // 加载 MCP 配置
      async function loadMcp() {
        try {
          const res = await fetch("/api/mcp/claude");
          const data = await res.json();
          mcpServers = data.mcpServers || {};
          renderMcp();
        } catch (e) {
          mcpServers = {};
          renderMcp();
        }
      }

      // 渲染 MCP 卡片列表
      function renderMcp() {
        const list = document.getElementById("mcpList");
        if (!list) return;
        const entries = Object.entries(mcpServers);
        if (entries.length === 0) {
          list.innerHTML = '<div class="empty">暂无 MCP 服务器，点击"添加"开始</div>';
          return;
        }
        list.innerHTML = entries.map(([name, config]) => {
          const argsSummary = (config.args || []).slice(0, 3).join(" ");
          const argsHint = (config.args || []).length > 3 ? "..." : "";
          const envCount = config.env ? Object.keys(config.env).length : 0;
          return `
            <div class="mcp-card">
              <div class="icon"><i data-lucide="puzzle"></i></div>
              <div class="mcp-info">
                <div class="mcp-name">${escapeHtml(name)}</div>
                <div class="mcp-detail">${escapeHtml(config.command)} ${escapeHtml(argsSummary)}${argsHint}${envCount > 0 ? " · " + envCount + " 个环境变量" : ""}</div>
              </div>
              <div class="mcp-actions">
                <button class="btn-sm btn-edit" onclick="editMcp('${name.replace(/'/g, "\\'")}')"><i data-lucide="pencil" class="icon-sm"></i></button>
                <button class="btn-sm btn-del" onclick="deleteMcp('${name.replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="icon-sm"></i></button>
              </div>
            </div>
          `;
        }).join("");
        lucide.createIcons();
      }

      // 打开 MCP 添加弹窗
      function openMcpModal(editName) {
        document.getElementById("mcpModalTitle").textContent = editName ? "编辑 MCP 服务器" : "添加 MCP 服务器";
        document.getElementById("mcpEditName").value = editName || "";
        document.getElementById("mcpName").value = editName || "";
        document.getElementById("mcpName").disabled = !!editName;
        if (editName && mcpServers[editName]) {
          const s = mcpServers[editName];
          document.getElementById("mcpCommand").value = s.command || "";
          document.getElementById("mcpArgs").value = (s.args || []).join("\n");
          document.getElementById("mcpEnv").value = s.env ? JSON.stringify(s.env, null, 2) : "";
        } else {
          document.getElementById("mcpCommand").value = "";
          document.getElementById("mcpArgs").value = "";
          document.getElementById("mcpEnv").value = "";
        }
        document.getElementById("mcpJsonImport").value = "";
        document.getElementById("mcpModal").classList.add("show");
        lucide.createIcons();
      }

      // 关闭 MCP 弹窗
      function closeMcpModal() {
        document.getElementById("mcpModal").classList.remove("show");
      }

      // 编辑 MCP 服务器
      function editMcp(name) {
        openMcpModal(name);
      }

      // 删除 MCP 服务器
      async function deleteMcp(name) {
        if (!confirm(`确定删除 MCP 服务器 "${name}"？`)) return;
        try {
          const res = await fetch(`/api/mcp/claude/${encodeURIComponent(name)}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) {
            showToast("已删除");
            mcpServers = data.mcpServers;
            renderMcp();
          } else {
            showToast(data.error || "删除失败", false);
          }
        } catch (e) {
          showToast("删除失败", false);
        }
      }

      // 保存 MCP 服务器
      async function saveMcp() {
        const editName = document.getElementById("mcpEditName").value;
        const name = document.getElementById("mcpName").value.trim();
        const command = document.getElementById("mcpCommand").value.trim();
        if (!name) return showToast("请输入名称", false);
        if (!command) return showToast("请输入命令", false);

        // 解析参数
        const argsText = document.getElementById("mcpArgs").value.trim();
        const args = argsText ? argsText.split("\n").map(s => s.trim()).filter(Boolean) : [];

        // 解析环境变量
        let env = {};
        const envText = document.getElementById("mcpEnv").value.trim();
        if (envText) {
          try {
            env = JSON.parse(envText);
            if (typeof env !== "object" || Array.isArray(env)) throw new Error();
          } catch {
            return showToast("环境变量格式错误，请使用 JSON 格式", false);
          }
        }

        try {
          const isEdit = !!editName;
          const url = isEdit
            ? `/api/mcp/claude/${encodeURIComponent(editName)}`
            : "/api/mcp/claude";
          const method = isEdit ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, command, args, env }),
          });
          const data = await res.json();
          if (data.success) {
            showToast(isEdit ? "已更新" : "已添加");
            closeMcpModal();
            mcpServers = data.mcpServers;
            renderMcp();
          } else {
            showToast(data.error || "保存失败", false);
          }
        } catch (e) {
          showToast("保存失败", false);
        }
      }

      // 粘贴 JSON 自动填充
      function parseMcpJson(text) {
        if (!text.trim()) return;
        try {
          const obj = JSON.parse(text);
          if (obj.command) document.getElementById("mcpCommand").value = obj.command;
          if (obj.args) document.getElementById("mcpArgs").value = (obj.args || []).join("\n");
          if (obj.env) document.getElementById("mcpEnv").value = JSON.stringify(obj.env, null, 2);
        } catch {}
      }
```

- [ ] **步骤 6：修改 switchTool 函数支持 MCP 页面切换**

在 `index.html` 的 `switchTool` 函数中，找到以下代码：

```javascript
      function switchTool(tool) {
        currentTool = tool;
        document.getElementById("toolTitle").textContent =
          TOOL_NAMES[tool] || tool;
        document
          .querySelectorAll(".nav-item")
          .forEach((el) => el.classList.remove("active"));
        document.getElementById("nav-" + tool).classList.add("active");
        // 根据工具类型显示/隐藏表单字段
        document.getElementById("providerGroup").style.display =
          MULTI_PROVIDER_TOOLS.includes(tool) ? "block" : "none";
        document.getElementById("haikuGroup").style.display =
          tool === "claude" ? "block" : "none";
        document.getElementById("extraBodyGroup").style.display =
          tool === "opencode" ? "block" : "none";
        clearForm();
        updateDrops();
        render();
      }
```

替换为：

```javascript
      function switchTool(tool) {
        currentTool = tool;
        document.getElementById("toolTitle").textContent =
          TOOL_NAMES[tool] || tool;
        document
          .querySelectorAll(".nav-item")
          .forEach((el) => el.classList.remove("active"));
        document.getElementById("nav-" + tool).classList.add("active");

        // MCP 管理页面与 Provider 配置页面互斥显示
        const isMcp = tool === "mcp";
        document.querySelector(".content-body .card").style.display = isMcp ? "none" : "block";
        document.querySelectorAll(".content-body .card")[1].style.display = isMcp ? "none" : "block";
        document.getElementById("mcpPage").style.display = isMcp ? "block" : "none";

        if (!isMcp) {
          // 根据工具类型显示/隐藏表单字段
          document.getElementById("providerGroup").style.display =
            MULTI_PROVIDER_TOOLS.includes(tool) ? "block" : "none";
          document.getElementById("haikuGroup").style.display =
            tool === "claude" ? "block" : "none";
          document.getElementById("extraBodyGroup").style.display =
            tool === "opencode" ? "block" : "none";
          clearForm();
          updateDrops();
          render();
        } else {
          loadMcp();
        }
      }
```

- [ ] **步骤 7：在 TOOL_NAMES 中添加 MCP 映射**

在 `index.html` 的 `TOOL_NAMES` 常量中添加：

```javascript
      const TOOL_NAMES = {
        claude: "Claude Code",
        opencode: "OpenCode",
        codex: "Codex",
        aider: "Aider",
        continue: "Continue",
        mcp: "MCP 管理",
      };
```

- [ ] **步骤 8：验证页面正常加载**

运行：`node server.js`，访问 `http://localhost:51234`，点击侧边栏"MCP 管理"，确认页面正常切换。

- [ ] **步骤 9：Commit**

```bash
git add index.html
git commit -m "feat(ui): 新增 MCP 管理页面，支持查看/添加/编辑/删除 MCP 服务器"
```

---

## 任务 4：前端 - Provider 搜索过滤

**文件：**
- 修改：`index.html`

- [ ] **步骤 1：新增搜索框 HTML**

在 `index.html` 的配置列表卡片中，`<div class="config-list" id="configList">` 之前添加搜索框：

```html
            <div style="margin-bottom: 10px">
              <div class="input-with-btn">
                <input type="text" id="configSearch" placeholder="搜索配置..." oninput="onSearchConfig(this.value)" />
                <button class="btn-drop" onclick="document.getElementById('configSearch').value=''; onSearchConfig('')" style="font-size: 12px">
                  <i data-lucide="x" class="icon-sm"></i>
                </button>
              </div>
            </div>
```

- [ ] **步骤 2：新增搜索过滤 JavaScript 逻辑**

在 `index.html` 的 `<script>` 标签中，`render()` 函数之前，添加搜索状态和防抖逻辑：

```javascript
      let searchQuery = "";
      let _searchTimer = null;

      function onSearchConfig(query) {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => {
          searchQuery = query.toLowerCase();
          render();
        }, 200);
      }
```

- [ ] **步骤 3：修改 render 函数支持搜索过滤**

在 `render()` 函数中，找到：

```javascript
        const filtered = configs.filter((c) => c.type === currentTool);
```

替换为：

```javascript
        const filtered = configs.filter((c) => {
          if (c.type !== currentTool) return false;
          if (searchQuery) {
            return (c.name || "").toLowerCase().includes(searchQuery) ||
                   (c.model || "").toLowerCase().includes(searchQuery) ||
                   (c.baseUrl || "").toLowerCase().includes(searchQuery);
          }
          return true;
        });
```

- [ ] **步骤 4：修改 render 函数空结果提示**

在 `render()` 函数中，找到 `if (!filtered.length)` 块，替换为：

```javascript
        if (!filtered.length) {
          list.innerHTML = searchQuery
            ? '<div class="empty">未找到匹配的配置</div>'
            : '<div class="empty">暂无配置</div>';
          return;
        }
```

- [ ] **步骤 5：切换工具时清空搜索**

在 `switchTool()` 函数中（MCP 判断之前），添加：

```javascript
        // 切换工具时清空搜索
        searchQuery = "";
        const searchInput = document.getElementById("configSearch");
        if (searchInput) searchInput.value = "";
```

- [ ] **步骤 6：Commit**

```bash
git add index.html
git commit -m "feat(ui): 新增配置搜索过滤，支持按名称/模型/Base URL 实时过滤"
```

---

## 任务 5：前端 - 批量连通性测试

**文件：**
- 修改：`index.html`

- [ ] **步骤 1：新增"全部测试"按钮 HTML**

在 `index.html` 的 `content-header` 中，`<h3>` 标签之后添加：

```html
          <button id="testAllBtn" class="btn-sm btn-test" onclick="testAllConfigs()" style="position: absolute; right: 24px; top: 50%; transform: translateY(-50%); padding: 6px 12px; font-size: 12px">
            <i data-lucide="plug" class="icon-sm" style="margin-right: 4px"></i> 全部测试
          </button>
```

同时给 `content-header` 添加 `position: relative` 样式（通过内联或 CSS 类）：

在 `content-header` 的 HTML 中添加 style：

```html
        <div class="content-header" style="position: relative">
```

- [ ] **步骤 2：新增批量测试 JavaScript 逻辑**

在 `index.html` 的 `<script>` 标签中，`testConfig` 函数之后，添加：

```javascript
      // 批量测试当前工具下所有配置
      async function testAllConfigs() {
        const btn = document.getElementById("testAllBtn");
        const filtered = configs.filter((c) => c.type === currentTool);
        if (filtered.length === 0) return showToast("当前工具下无配置", false);

        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="icon-sm" style="animation: spin 1s linear infinite; margin-right: 4px"></i> 测试中...';
        lucide.createIcons();

        let passCount = 0;
        let failCount = 0;

        // 并行测试所有配置
        const promises = filtered.map(async (c) => {
          try {
            const res = await fetch(`/api/test/${c.id}`, { method: "POST" });
            const data = await res.json();
            if (data.success || data.apiOk) {
              passCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }
        });

        await Promise.all(promises);

        showToast(`${passCount}/${filtered.length} 通过`);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="plug" class="icon-sm" style="margin-right: 4px"></i> 全部测试';
        lucide.createIcons();

        // 重新加载配置以更新状态
        await loadConfigs();
      }
```

- [ ] **步骤 3：MCP 页面时隐藏"全部测试"按钮**

在 `switchTool()` 函数中，MCP 页面切换逻辑处，添加：

```javascript
        // MCP 页面隐藏"全部测试"按钮
        document.getElementById("testAllBtn").style.display = isMcp ? "none" : "";
```

- [ ] **步骤 4：Commit**

```bash
git add index.html
git commit -m "feat(ui): 新增批量连通性测试，支持一键并行测试所有配置"
```

---

## 任务 6：前端 - 键盘快捷键

**文件：**
- 修改：`index.html`

- [ ] **步骤 1：新增键盘快捷键 JavaScript 逻辑**

在 `index.html` 的 `<script>` 标签中，主题初始化 IIFE 之后，添加：

```javascript
      // ========== 键盘快捷键 ==========
      document.addEventListener("keydown", (e) => {
        const isMod = e.metaKey || e.ctrlKey; // Cmd(Mac) 或 Ctrl(Windows/Linux)

        // Ctrl+K / Cmd+K：聚焦搜索框
        if (isMod && e.key === "k") {
          e.preventDefault();
          const searchInput = document.getElementById("configSearch");
          if (searchInput) searchInput.focus();
          return;
        }

        // Ctrl+N / Cmd+N：打开配置向导
        if (isMod && e.key === "n") {
          e.preventDefault();
          openWizard();
          return;
        }

        // Escape：关闭弹窗（优先级：wizardModal > editModal > mcpModal）
        if (e.key === "Escape") {
          if (document.getElementById("wizardModal").classList.contains("show")) {
            closeWizard();
          } else if (document.getElementById("editModal").classList.contains("show")) {
            closeModal();
          } else if (document.getElementById("mcpModal").classList.contains("show")) {
            closeMcpModal();
          }
          return;
        }
      });
```

- [ ] **步骤 2：Commit**

```bash
git add index.html
git commit -m "feat(ui): 新增键盘快捷键 Ctrl+K 搜索、Ctrl+N 向导、Escape 关闭弹窗"
```

---

## 任务 7：前端 - Provider 状态概览

**文件：**
- 修改：`index.html`

- [ ] **步骤 1：在 render 函数中添加状态圆点**

在 `render()` 函数的卡片模板中，找到：

```javascript
            <div class="icon"><i data-lucide="${iconName}"></i></div>
            <div class="info">
              <div class="name">${escapeHtml(c.name)}</div>
```

替换为：

```javascript
            <div class="icon"><i data-lucide="${iconName}"></i></div>
            <div class="info">
              <div class="name">
                <span class="status-dot status-${c.lastTestStatus || 'unknown'}" title="${c.lastTestStatus ? (c.lastTestStatus === 'ok' ? '连接正常' : '连接失败') : '未测试'}${c.lastTestTime ? ' · ' + formatTestTime(c.lastTestTime) : ''}${c.lastTestElapsed ? ' · ' + c.lastTestElapsed + 'ms' : ''}" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle"></span>${escapeHtml(c.name)}</div>
```

- [ ] **步骤 2：新增状态圆点 CSS 样式**

在 `index.html` 的 `<style>` 标签中，MCP 卡片样式之后添加：

```css
      /* 状态圆点 */
      .status-ok { background: var(--success-color); }
      .status-fail { background: #e74c3c; }
      .status-unknown { background: #f0ad4e; }
```

- [ ] **步骤 3：新增 formatTestTime 工具函数**

在 `index.html` 的 `<script>` 标签中，`escapeHtml` 函数之后添加：

```javascript
      // 格式化测试时间为相对时间
      function formatTestTime(isoStr) {
        if (!isoStr) return "";
        const diff = Date.now() - new Date(isoStr).getTime();
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return seconds + " 秒前";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return minutes + " 分钟前";
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + " 小时前";
        return Math.floor(hours / 24) + " 天前";
      }
```

- [ ] **步骤 4：在 content-header 中添加统计摘要**

在 `index.html` 的 `content-header` 中，"全部测试"按钮之前（或旁边），添加统计摘要 span：

```html
          <span id="statusSummary" style="position: absolute; right: 130px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-muted)"></span>
```

- [ ] **步骤 5：render 函数中更新统计摘要**

在 `render()` 函数末尾（`lucide.createIcons()` 之后），添加：

```javascript
        // 更新状态统计摘要
        const summary = document.getElementById("statusSummary");
        if (summary && currentTool !== "mcp") {
          const total = filtered.length;
          const okCount = filtered.filter(c => c.lastTestStatus === "ok").length;
          summary.textContent = total > 0 ? `${okCount}/${total} 通过` : "";
        } else if (summary) {
          summary.textContent = "";
        }
```

- [ ] **步骤 6：Commit**

```bash
git add index.html
git commit -m "feat(ui): 新增 Provider 状态概览，卡片显示连接状态圆点和统计摘要"
```

---

## 任务 8：全量集成测试 + 最终 Commit

- [ ] **步骤 1：启动服务并全量测试**

运行：`node server.js`

手动验证清单：
1. 侧边栏显示"MCP 管理"导航项
2. 点击"MCP 管理"，页面切换为 MCP 管理面板
3. 在 MCP 面板添加一个 MCP 服务器（名称、命令、参数）
4. 编辑刚添加的 MCP 服务器
5. 删除该 MCP 服务器
6. 切换回 Claude Code 页面
7. 配置列表顶部出现搜索框
8. 输入关键词，列表实时过滤
9. 清空搜索框，列表恢复
10. content-header 显示"全部测试"按钮和统计摘要
11. 点击"全部测试"，所有卡片开始 loading
12. 测试完成后卡片显示绿色/红色状态圆点
13. 鼠标悬停圆点显示 tooltip
14. 编辑某个配置后，其状态圆点变为黄色（未测试）
15. Ctrl+K 聚焦搜索框
16. Ctrl+N 打开配置向导
17. 按 Escape 关闭弹窗
18. 暗黑/明亮主题下样式正常

- [ ] **步骤 2：更新开发进度文档**

在 `docs/Development-Progress-Document.md` 中：
- 将 10.1、10.2、11.1、11.2、11.3、11.4 状态从"待开发"改为"已结束"
- 更新进度跟踪表对应行

- [ ] **步骤 3：编写开发日志**

在 `docs/Progress-Log/` 下新建 `2026-05-29-HH-MM-阶段十十一MCP管理与UI增强.md`，按标准三段结构编写。

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "feat: 完成阶段十MCP管理和阶段十一UI/UX增强"
```
