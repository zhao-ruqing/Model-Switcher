const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 51235;

const CLAUDE_DIR = path.join(process.env.USERPROFILE, ".claude");
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, "settings.json");
const OPENCODE_DIR = path.join(process.env.USERPROFILE, ".config", "opencode");
const OPENCODE_SETTINGS = path.join(OPENCODE_DIR, "opencode.jsonc");
const CONFIG_FILE = path.join(__dirname, "config.json");

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function readJson(file, def = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {}
  return def;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(CLAUDE_DIR)) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
}

if (!fs.existsSync(CONFIG_FILE)) {
  writeJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
}

app.get("/api/configs", (req, res) => {
  const data = readJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
  res.json(data);
});

app.post("/api/configs", (req, res) => {
  const data = readJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
  const config = {
    id: Date.now().toString(),
    name: req.body.name || "未命名",
    type: req.body.type || "claude",
    providerType: req.body.providerType || "anthropic",
    token: req.body.token || "",
    baseUrl: req.body.baseUrl || "",
    model: req.body.model || "",
    haikuModel: req.body.haikuModel || "",
  };
  data.configs.push(config);
  writeJson(CONFIG_FILE, data);
  res.json({
    success: true,
    config: config,
  });
});

app.put("/api/configs/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
  const index = data.configs.findIndex((c) => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "不存在" });

  const updates = { ...req.body };

  data.configs[index] = { ...data.configs[index], ...updates };
  writeJson(CONFIG_FILE, data);
  res.json({
    success: true,
    config: data.configs[index],
  });
});

app.delete("/api/configs/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
  data.configs = data.configs.filter((c) => c.id !== req.params.id);
  if (data.activeClaudeId === req.params.id) data.activeClaudeId = null;
  if (data.activeOpencodeId === req.params.id) data.activeOpencodeId = null;
  writeJson(CONFIG_FILE, data);
  res.json({ success: true });
});

function switchClaude(config) {
  const s = readJson(CLAUDE_SETTINGS);
  if (!s.env) s.env = {};
  if (config.token) s.env.ANTHROPIC_AUTH_TOKEN = config.token;
  if (config.baseUrl) s.env.ANTHROPIC_BASE_URL = config.baseUrl;
  if (config.model) {
    s.env.ANTHROPIC_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
    s.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
  }
  if (config.haikuModel)
    s.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.haikuModel;
  writeJson(CLAUDE_SETTINGS, s);
}

function switchOpencode(config) {
  if (!fs.existsSync(OPENCODE_DIR)) {
    fs.mkdirSync(OPENCODE_DIR, { recursive: true });
  }

  const s = readJson(OPENCODE_SETTINGS, {
    $schema: "https://opencode.ai/config.json",
    provider: {},
    model: "",
  });

  const providerKey =
    config.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "default";
  const modelId = config.model || "default-model";

  let npmPkg = "@ai-sdk/anthropic";
  if (config.providerType === "openai") {
    npmPkg = "@ai-sdk/openai-compatible";
  }

  // 确保 provider 对象存在
  if (!s.provider) s.provider = {};

  // 更新或创建指定的 provider
  s.provider[providerKey] = {
    npm: npmPkg,
    name: config.name,
    options: {
      baseURL: config.baseUrl || "",
      apiKey: config.token || "",
    },
    models: {},
  };

  // 为该模型添加基础配置
  s.provider[providerKey].models[modelId] = {
    name: modelId,
    limit: {
      context: 1048576,
      output: 131072,
    },
    modalities: {
      input: ["text"],
      output: ["text"],
    },
  };

  // 设置当前激活的模型路径
  s.model = `${providerKey}/${modelId}`;

  writeJson(OPENCODE_SETTINGS, s);
}

app.post("/api/switch/:id", (req, res) => {
  const data = readJson(CONFIG_FILE, {
    configs: [],
    activeClaudeId: null,
    activeOpencodeId: null,
  });
  const config = data.configs.find((c) => c.id === req.params.id);
  if (!config) return res.status(404).json({ error: "不存在" });

  try {
    if (config.type === "opencode") {
      switchOpencode(config);
      data.activeOpencodeId = config.id;
    } else {
      switchClaude(config);
      data.activeClaudeId = config.id;
    }
    writeJson(CONFIG_FILE, data);
    res.json({ success: true, config: config });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
