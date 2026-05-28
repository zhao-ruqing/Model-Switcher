const fs = require("fs");
const path = require("path");

const CLAUDE_DIR = path.join(process.env.USERPROFILE, ".claude");
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, "settings.json");

function readJson(file, def = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {}
  return def;
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getApiKey(config) {
  return config.apiKey || config.token || "";
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
    if (key) s.env.ANTHROPIC_AUTH_TOKEN = key;
    if (config.baseUrl) s.env.ANTHROPIC_BASE_URL = config.baseUrl;
    if (config.model) {
      s.env.ANTHROPIC_MODEL = config.model;
      s.env.ANTHROPIC_DEFAULT_SONNET_MODEL = config.model;
      s.env.ANTHROPIC_DEFAULT_OPUS_MODEL = config.model;
    }
    if (config.haikuModel)
      s.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.haikuModel;
    writeJson(CLAUDE_SETTINGS, s);
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
      if (key && s.env.ANTHROPIC_AUTH_TOKEN !== key) {
        return { ok: false, detail: "Claude Code 配置中的 Token 与当前配置不一致，请重新切换" };
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
      { id: "baseUrl", label: "Base URL", type: "text" },
      { id: "model", label: "模型", type: "text" },
      { id: "haikuModel", label: "Haiku 模型", type: "text" },
    ];
  },
};
