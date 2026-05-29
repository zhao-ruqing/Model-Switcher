const fs = require("fs");
const path = require("path");
const { getApiKey, writeJsonAtomic, verifyWrite } = require("./utils");

const CLAUDE_DIR = path.join(process.env.USERPROFILE, ".claude");
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, "settings.json");

function readJson(file, def = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {}
  return def;
}

module.exports = {
  name: "Claude Code",

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

    // 超时设置（第三方 API 可能需要更长超时）
    if (config.apiTimeoutMs) {
      s.env.API_TIMEOUT_MS = String(config.apiTimeoutMs);
    } else {
      delete s.env.API_TIMEOUT_MS;
    }

    // 禁用非必要流量（减少第三方 API 调用）
    if (config.disableNonessentialTraffic) {
      s.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
    } else {
      delete s.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC;
    }

    writeJsonAtomic(CLAUDE_SETTINGS, s);

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
  },

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

  getMcpConfig() {
    const s = readJson(CLAUDE_SETTINGS);
    return s.mcpServers || {};
  },

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
};
