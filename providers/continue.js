const fs = require("fs");
const path = require("path");
const { getApiKey, writeJsonAtomic, verifyWrite } = require("./utils");

const CONTINUE_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".continue"
);
const CONTINUE_CONFIG = path.join(CONTINUE_DIR, "config.json");

function readJson(file, def = {}) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {}
  return def;
}

// 根据 providerType 映射 Continue 的 provider 名称
function getContinueProvider(providerType) {
  if (providerType === "anthropic") return "anthropic";
  return "openai";
}

module.exports = {
  name: "Continue",

  switch(config) {
    if (!fs.existsSync(CONTINUE_DIR)) {
      fs.mkdirSync(CONTINUE_DIR, { recursive: true });
    }

    const data = readJson(CONTINUE_CONFIG, {});
    if (!Array.isArray(data.models)) {
      data.models = [];
    }

    const key = getApiKey(config);
    const provider = getContinueProvider(config.providerType);
    const baseUrl = config.baseUrl || "";

    // 构建模型配置
    const modelEntry = {
      title: config.model || "Custom Model",
      provider,
      model: config.model || "",
    };
    if (baseUrl) modelEntry.apiBase = baseUrl;
    if (key) modelEntry.apiKey = key;

    // 仅操作第一个模型条目（Continue 通常只有一个主模型）
    if (data.models.length > 0) {
      data.models[0] = modelEntry;
    } else {
      data.models.push(modelEntry);
    }

    writeJsonAtomic(CONTINUE_CONFIG, data);

    // 写入后校验
    const check = verifyWrite(CONTINUE_CONFIG, {
      "models.0.provider": provider,
      "models.0.model": config.model || undefined,
    });
    if (!check.ok) {
      throw new Error("配置写入校验失败：" + check.detail);
    }
  },

  verify(config) {
    try {
      if (!fs.existsSync(CONTINUE_CONFIG)) {
        return { ok: false, detail: "Continue 配置文件不存在，请先切换一次配置" };
      }
      const data = readJson(CONTINUE_CONFIG, {});
      if (!data.models || data.models.length === 0) {
        return { ok: false, detail: "Continue 配置中无模型条目，请先切换一次配置" };
      }

      const m = data.models[0];
      const key = getApiKey(config);
      const provider = getContinueProvider(config.providerType);

      if (m.provider !== provider) {
        return { ok: false, detail: `Continue 配置中的 Provider 为 ${m.provider}，期望 ${provider}` };
      }
      if (config.model && m.model !== config.model) {
        return { ok: false, detail: "Continue 配置中的模型与当前配置不一致，请重新切换" };
      }
      if (key && m.apiKey !== key) {
        return { ok: false, detail: "Continue 配置中的 API Key 与当前配置不一致，请重新切换" };
      }
      if (config.baseUrl && m.apiBase !== config.baseUrl) {
        return { ok: false, detail: "Continue 配置中的 API Base URL 与当前配置不一致，请重新切换" };
      }

      return { ok: true, detail: "Continue 本地配置正常" };
    } catch (e) {
      return { ok: false, detail: "读取本地配置失败：" + e.message };
    }
  },

  getFields() {
    return [
      { id: "apiKey", label: "API Token", type: "password", required: true },
      { id: "providerType", label: "Provider", type: "select", options: ["anthropic", "openai"] },
      { id: "baseUrl", label: "Base URL", type: "text" },
      { id: "model", label: "模型", type: "text" },
    ];
  },
};
