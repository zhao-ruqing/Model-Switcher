const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { providers, testers } = require("./providers");

const app = express();
const PORT = 51235;

const CONFIG_FILE = path.join(__dirname, "config.json");
const PRESETS_FILE = path.join(__dirname, "presets.json");

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 兼容旧配置：统一读取 apiKey（旧字段名 token）
const { getApiKey } = require("./providers/utils");

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 深合并：仅对非数组对象递归，数组和原始值直接覆盖
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key]) &&
      target[key] !== null && typeof target[key] === "object" && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function readJson(file, def = {}) {
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return deepMerge(def, data);
    }
  } catch (e) {}
  return def;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 默认配置结构，记录各工具的当前激活配置 ID
const DEFAULT_CONFIG = {
  configs: [],
  activeClaudeId: null,
  activeOpencodeId: null,
  activeCodexId: null,
  activeAiderId: null,
  activeContinueId: null,
};

if (!fs.existsSync(CONFIG_FILE)) {
  writeJson(CONFIG_FILE, DEFAULT_CONFIG);
}

app.get("/api/configs", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  res.json(data);
});

app.post("/api/configs", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  const config = {
    id: Date.now().toString(),
    name: req.body.name || "未命名",
    type: req.body.type || "claude",
    providerType: req.body.providerType || "anthropic",
    apiKey: req.body.apiKey || req.body.token || "",
    baseUrl: req.body.baseUrl || "",
    model: req.body.model || "",
    haikuModel: req.body.haikuModel || "",
    extraBody: req.body.extraBody || null,
  };
  data.configs.push(config);
  writeJson(CONFIG_FILE, data);
  res.json({
    success: true,
    config: config,
  });
});

app.put("/api/configs/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  const index = data.configs.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "不存在" });

  const updates = { ...req.body };
  // 兼容前端传 token 字段，统一存储为 apiKey
  if (updates.token && !updates.apiKey) {
    updates.apiKey = updates.token;
    delete updates.token;
  }
  data.configs[index] = { ...data.configs[index], ...updates };
  writeJson(CONFIG_FILE, data);
  res.json({
    success: true,
    config: data.configs[index],
  });
});

app.delete("/api/configs/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  data.configs = data.configs.filter((c) => c.id !== req.params.id);
  if (data.activeClaudeId === req.params.id) data.activeClaudeId = null;
  if (data.activeOpencodeId === req.params.id) data.activeOpencodeId = null;
  if (data.activeCodexId === req.params.id) data.activeCodexId = null;
  if (data.activeAiderId === req.params.id) data.activeAiderId = null;
  if (data.activeContinueId === req.params.id) data.activeContinueId = null;
  writeJson(CONFIG_FILE, data);
  res.json({ success: true });
});

// 导出配置
app.get("/api/export", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=model-switcher-config.json");
  res.json(data);
});

// 导入配置
app.post("/api/import", (req, res) => {
  try {
    const imported = req.body;
    if (!imported || !Array.isArray(imported.configs)) {
      return res.status(400).json({ error: "无效的配置文件格式" });
    }
    // 验证每个配置的基本结构，并兼容旧字段名
    for (const config of imported.configs) {
      if (!config.id || !config.name || !config.type) {
        return res.status(400).json({ error: "配置缺少必要字段" });
      }
      // 旧配置用 token，统一迁移为 apiKey
      if (config.token && !config.apiKey) {
        config.apiKey = config.token;
        delete config.token;
      }
    }
    // 验证 activeId 是否在 configs 中存在
    const configIds = new Set(imported.configs.map((c) => c.id));
    const activeIdFields = ["activeClaudeId", "activeOpencodeId", "activeCodexId", "activeAiderId", "activeContinueId"];
    for (const field of activeIdFields) {
      if (imported[field] && !configIds.has(imported[field])) {
        imported[field] = null;
      }
    }
    writeJson(CONFIG_FILE, imported);
    res.json({ success: true, count: imported.configs.length });
  } catch (e) {
    res.status(400).json({ error: "导入失败：" + e.message });
  }
});

// 返回 Provider 预设数据
app.get("/api/presets", (req, res) => {
  const presets = readJson(PRESETS_FILE, {});
  res.json(presets);
});

// 返回指定工具的表单字段定义
app.get("/api/fields/:tool", (req, res) => {
  const adapter = providers[req.params.tool];
  if (!adapter) return res.status(404).json({ error: "不支持的工具类型" });
  res.json({ fields: adapter.getFields() });
});

// OpenRouter 模型名称到搜索前缀的映射
const OPENROUTER_PREFIX = {
  deepseek: "deepseek/",
  mimo: "xiaomi/",
  openai: "openai/",
  gemini: "google/",
  glm: "z-ai/",
  kimi: "moonshotai/",
  mistral: "mistralai/",
  groq: "meta-llama/",
};

// 从 OpenRouter 获取指定厂商的模型列表
async function fetchModelsFromOpenRouter(providerName) {
  const prefix = OPENROUTER_PREFIX[providerName.toLowerCase()] || providerName.toLowerCase() + "/";
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json().catch(() => ({ data: [] }));
  return (data.data || [])
    .filter(m => m.id && m.id.toLowerCase().startsWith(prefix))
    .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
    .slice(0, 10)
    .map(m => {
      // 去掉厂商前缀，得到 Provider API 实际使用的模型 ID
      const modelId = m.id.includes("/") ? m.id.split("/").slice(1).join("/") : m.id;
      return { id: modelId, name: m.name || modelId, openrouterId: m.id };
    });
}

// 从 Provider API 获取可用模型列表
app.post("/api/fetch-models", async (req, res) => {
  const { baseUrl, apiKey, providerType, providerName } = req.body;

  // 优先从 OpenRouter 获取
  if (providerName) {
    try {
      const models = await fetchModelsFromOpenRouter(providerName);
      if (models.length > 0) {
        return res.json({ models, source: "openrouter" });
      }
    } catch {
      // OpenRouter 失败，继续尝试 Provider 自身 API
    }
  }

  // 降级：尝试 Provider 自身的 /v1/models 端点
  if (!baseUrl || !apiKey) {
    return res.json({ error: "无法获取模型列表，请手动输入模型名称", models: [] });
  }

  const base = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  const isOpenAI = providerType === "openai";
  const candidateUrls = isOpenAI
    ? [base + "/v1/models"]
    : [base + "/v1/models", base.replace(/\/anthropic$/, "") + "/v1/models"];
  const headers = isOpenAI
    ? { "Authorization": `Bearer ${apiKey}` }
    : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };

  for (const modelsUrl of candidateUrls) {
    try {
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const raw = data.data || data.models || [];
        if (raw.length > 0) {
          const models = raw.map(m => ({ id: m.id, name: m.id })).sort((a, b) => a.id.localeCompare(b.id));
          return res.json({ models, source: "provider" });
        }
      } else if (response.status === 401 || response.status === 403) {
        return res.json({ error: "API Key 无效", models: [] });
      }
    } catch {
      // 继续尝试下一个
    }
  }

  res.json({ error: "无法获取模型列表，请手动输入模型名称", models: [] });
});

app.post("/api/switch/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  const config = data.configs.find((c) => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "不存在" });

  const adapter = providers[config.type];
  if (!adapter) return res.status(400).json({ error: "不支持的工具类型" });

  try {
    adapter.switch(config);
    // 根据工具类型设置对应的激活 ID
    const activeKey = `active${config.type.charAt(0).toUpperCase() + config.type.slice(1)}Id`;
    if (activeKey in data) {
      data[activeKey] = config.id;
    } else {
      data.activeClaudeId = config.id;
    }
    writeJson(CONFIG_FILE, data);
    res.json({ success: true, config: config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 测试 API Key 连通性（新版本：分离 API 连通性和本地配置状态）
app.post("/api/test/:id", async (req, res) => {
  const data = readJson(CONFIG_FILE, DEFAULT_CONFIG);
  const config = data.configs.find((c) => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "不存在" });

  // 通过适配器验证本地配置
  const adapter = providers[config.type];
  const localCheck = adapter ? adapter.verify(config) : { ok: false, detail: "不支持的工具类型" };

  // 根据 Base URL 或 providerType 选择测试器
  // URL 含 /anthropic 路径的使用 Anthropic 测试器
  const effectiveType = (config.baseUrl && config.baseUrl.includes("/anthropic"))
    ? "anthropic"
    : config.providerType;
  const tester = testers[effectiveType];
  if (!tester) {
    return res.json({ success: false, message: `不支持的 Provider 类型: ${config.providerType}` });
  }

  try {
    const { response, result, elapsed, modelValid } = await tester(config);

    // 构建详细的测试结果
    const testResult = {
      elapsed,
      apiOk: false,
      localOk: localCheck.ok,
      localDetail: localCheck.detail,
      needSwitch: !localCheck.ok,
    };

    if (response.ok && modelValid) {
      testResult.apiOk = true;
      testResult.success = true;
      testResult.status = 200;
      testResult.message = localCheck.ok
        ? `连接成功，Key 有效；${localCheck.detail}`
        : `API 连接成功，但本地配置未切换`;
    } else if (response.ok && !modelValid) {
      const reason = result.error?.message || result.message || "模型可能不存在或 API 格式不兼容";
      testResult.success = false;
      testResult.status = 200;
      testResult.message = reason;
    } else if (response.status === 401 || response.status === 403) {
      const reason = result.error?.message || result.message || "认证失败";
      testResult.success = false;
      testResult.status = response.status;
      testResult.message = `Key 无效：${reason}`;
    } else if (response.status === 400) {
      const reason = result.error?.message || result.message || "请求格式错误";
      testResult.success = false;
      testResult.status = 400;
      testResult.message = `请求错误：${reason}`;
    } else if (response.status === 404) {
      testResult.success = false;
      testResult.status = 404;
      testResult.message = `API 端点不存在，请检查 Base URL`;
    } else if (response.status === 429) {
      testResult.apiOk = true;
      testResult.success = localCheck.ok;
      testResult.status = 429;
      testResult.message = `Key 有效，但触发频率限制`;
    } else {
      const reason = result.error?.message || result.message || `HTTP ${response.status}`;
      testResult.success = false;
      testResult.status = response.status;
      testResult.message = reason;
    }

    res.json(testResult);
  } catch (e) {
    const testResult = {
      elapsed: 0,
      apiOk: false,
      localOk: localCheck.ok,
      localDetail: localCheck.detail,
      needSwitch: !localCheck.ok,
    };

    if (e.name === "TimeoutError" || e.name === "AbortError") {
      testResult.success = false;
      testResult.message = `连接超时，请检查网络或 Base URL`;
    } else if (e.cause?.code === "ENOTFOUND") {
      testResult.success = false;
      testResult.message = `域名无法解析，请检查 Base URL`;
    } else if (e.cause?.code === "ECONNREFUSED") {
      testResult.success = false;
      testResult.message = `连接被拒绝，请检查 Base URL`;
    } else {
      testResult.success = false;
      testResult.message = `连接失败：${e.message}`;
    }

    res.json(testResult);
  }
});

const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`端口 ${PORT} 已被占用，可能已有服务在运行`);
    process.exit(0);
  }
});
