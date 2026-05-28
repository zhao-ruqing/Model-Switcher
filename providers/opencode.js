const fs = require("fs");
const path = require("path");

const OPENCODE_DIR = path.join(process.env.USERPROFILE, ".config", "opencode");
const OPENCODE_SETTINGS = path.join(OPENCODE_DIR, "opencode.jsonc");

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
  name: "OpenCode",

  switch(config) {
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

    if (!s.provider) s.provider = {};

    // Anthropic SDK 会在 baseURL 后直接拼 /messages，需确保 URL 以 /v1 结尾
    let baseURL = config.baseUrl || "";
    if (config.providerType === "anthropic" && baseURL && !baseURL.endsWith("/v1")) {
      baseURL = baseURL.replace(/\/+$/, "") + "/v1";
    }

    s.provider[providerKey] = {
      npm: npmPkg,
      name: config.name,
      options: {
        baseURL,
        apiKey: getApiKey(config),
      },
      models: {},
    };

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

    if (config.extraBody) {
      try {
        s.provider[providerKey].models[modelId].extraBody =
          typeof config.extraBody === "string"
            ? JSON.parse(config.extraBody)
            : config.extraBody;
      } catch (e) {
        console.error("解析 extraBody 失败:", e);
      }
    }

    s.model = `${providerKey}/${modelId}`;

    writeJson(OPENCODE_SETTINGS, s);
  },

  verify(config) {
    try {
      if (!fs.existsSync(OPENCODE_SETTINGS)) {
        return { ok: false, detail: "OpenCode 配置文件不存在，请先切换一次配置" };
      }
      const s = readJson(OPENCODE_SETTINGS);
      const providerKey = config.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "default";
      const modelId = config.model || "default-model";
      const provider = s.provider?.[providerKey];
      if (!provider) {
        return { ok: false, detail: `OpenCode 配置中未找到 provider "${providerKey}"，请先切换一次配置` };
      }
      if (provider.options?.apiKey !== getApiKey(config)) {
        return { ok: false, detail: "OpenCode 配置中的 API Key 与当前配置不一致，请重新切换" };
      }
      let expectedBase = config.baseUrl || "";
      if (config.providerType === "anthropic" && expectedBase && !expectedBase.endsWith("/v1")) {
        expectedBase = expectedBase.replace(/\/+$/, "") + "/v1";
      }
      if (provider.options?.baseURL !== expectedBase) {
        return { ok: false, detail: "OpenCode 配置中的 Base URL 与当前配置不一致，请重新切换" };
      }
      if (!s.model || s.model !== `${providerKey}/${modelId}`) {
        return { ok: false, detail: "OpenCode 配置中的激活模型与当前配置不一致，请重新切换" };
      }
      return { ok: true, detail: "OpenCode 本地配置正常" };
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
      { id: "extraBody", label: "Extra Body (JSON)", type: "text" },
    ];
  },
};
