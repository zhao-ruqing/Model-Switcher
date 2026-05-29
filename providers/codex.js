const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite, writeJsonAtomic } = require("./utils");

const CODEX_DIR = path.join(process.env.USERPROFILE || process.env.HOME, ".codex");
const CODEX_CONFIG = path.join(CODEX_DIR, "config.toml");
const CODEX_AUTH = path.join(CODEX_DIR, "auth.json");

// 剥离 TOML 注释，跳过引号内的 #
function stripTomlComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === "#" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

// 最小化 TOML 解析器（仅支持 key=value 和 [section]）
function parseToml(text) {
  const result = {};
  let currentSection = result;
  let currentPath = [];

  for (const rawLine of text.split("\n")) {
    const line = stripTomlComment(rawLine).trim();
    if (!line) continue;

    // 匹配 [section] 或 [section.subsection]
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      const keys = sectionMatch[1].split(".").map(k => k.trim());
      currentPath = keys;
      currentSection = result;
      for (const key of keys) {
        if (!currentSection[key]) currentSection[key] = {};
        currentSection = currentSection[key];
      }
      continue;
    }

    // 匹配 key = value
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // 解析值类型
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (/^-?\d+$/.test(value)) {
      value = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      value = parseFloat(value);
    }

    currentSection[key] = value;
  }

  return result;
}

// TOML 序列化器（输出简洁格式）
function stringifyToml(obj, prefix) {
  let result = "";
  const simpleKeys = [];
  const tableKeys = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      tableKeys.push(key);
    } else {
      simpleKeys.push([key, value]);
    }
  }

  // 顶层键值对
  for (const [key, value] of simpleKeys) {
    result += `${key} = ${formatTomlValue(value)}\n`;
  }

  // 子表
  for (const key of tableKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    result += `\n[${fullKey}]\n`;
    result += stringifyToml(obj[key], fullKey);
  }

  return result;
}

function formatTomlValue(value) {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `"${value}"`;
}

function readConfig() {
  try {
    if (fs.existsSync(CODEX_CONFIG)) {
      return parseToml(fs.readFileSync(CODEX_CONFIG, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function writeConfig(data) {
  if (!fs.existsSync(CODEX_DIR)) {
    fs.mkdirSync(CODEX_DIR, { recursive: true });
  }
  atomicWrite(CODEX_CONFIG, stringifyToml(data));
}

// 写入 auth.json（Codex 读取 OPENAI_API_KEY 环境变量）
function writeAuth(apiKey) {
  if (!fs.existsSync(CODEX_DIR)) {
    fs.mkdirSync(CODEX_DIR, { recursive: true });
  }
  writeJsonAtomic(CODEX_AUTH, { OPENAI_API_KEY: apiKey });
}

// OpenAI 官方模型列表（使用 OpenAI 账号直接访问）
const OPENAI_MODELS = [
  "o3", "o3-mini", "o3-pro", "o4-mini",
  "o1", "o1-mini", "o1-pro", "o1-preview",
  "gpt-5", "gpt-5-mini", "gpt-5.4", "gpt-5.5",
  "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4",
  "gpt-3.5-turbo", "codex-mini-latest",
];

// 判断是否为 OpenAI 官方模型
function isOpenAIModel(model) {
  if (!model) return true;
  const m = model.toLowerCase().replace(/^openai\//, "");
  return OPENAI_MODELS.some(s => m === s || m.startsWith(s));
}

// 生成第三方供应商的 config.toml 内容
function generateThirdPartyConfig(providerName, baseUrl, model) {
  return [
    `model_provider = "custom"`,
    `model = "${model}"`,
    `model_reasoning_effort = "high"`,
    `disable_response_storage = true`,
    ``,
    `[model_providers.custom]`,
    `name = "${providerName}"`,
    `base_url = "${baseUrl}"`,
    `wire_api = "responses"`,
    `requires_openai_auth = false`,
  ].join("\n");
}

module.exports = {
  name: "Codex",

  switch(config) {
    if (!fs.existsSync(CODEX_DIR)) {
      fs.mkdirSync(CODEX_DIR, { recursive: true });
    }

    const key = getApiKey(config);
    const model = config.model || "gpt-4o";

    if (isOpenAIModel(model)) {
      // OpenAI 官方模型：写入 auth.json + 简单 config.toml
      if (key) writeAuth(key);
      const data = readConfig();
      data.model_provider = "openai";
      data.model = model;
      data.model_reasoning_effort = "high";
      data.disable_response_storage = true;
      // 清除自定义 provider 配置
      delete data.model_providers;
      writeConfig(data);
    } else {
      // 第三方模型：通过自定义 model_provider 代理
      if (!config.baseUrl) {
        throw new Error(`使用非 OpenAI 模型 "${model}" 时必须填写 Base URL`);
      }
      // 写入 auth.json
      if (key) writeAuth(key);
      // 直接写入 TOML 字符串，确保格式正确
      const providerName = config.name || "custom";
      atomicWrite(CODEX_CONFIG, generateThirdPartyConfig(providerName, config.baseUrl, model));
    }
  },

  verify(config) {
    try {
      const key = getApiKey(config);
      if (!fs.existsSync(CODEX_CONFIG)) {
        return { ok: false, detail: "Codex 配置文件不存在，请先切换一次配置" };
      }
      const data = readConfig();
      if (config.model) {
        const expectedModel = config.model;
        if (data.model !== expectedModel) {
          return { ok: false, detail: "Codex 配置中的模型与当前配置不一致，请重新切换" };
        }
        // 第三方模型需校验 base_url
        if (!isOpenAIModel(expectedModel)) {
          if (data.model_provider !== "custom") {
            return { ok: false, detail: "Codex 配置未使用自定义 provider，请重新切换" };
          }
          if (config.baseUrl && data.model_providers?.custom?.base_url !== config.baseUrl) {
            return { ok: false, detail: "Codex 配置中的 Base URL 与当前配置不一致，请重新切换" };
          }
        }
      }
      // 校验 auth.json 中的 API Key
      if (key) {
        if (!fs.existsSync(CODEX_AUTH)) {
          return { ok: false, detail: "Codex auth.json 不存在，请重新切换" };
        }
        try {
          const auth = JSON.parse(fs.readFileSync(CODEX_AUTH, "utf-8"));
          if (auth.OPENAI_API_KEY !== key) {
            return { ok: false, detail: "Codex auth.json 中的 API Key 与当前配置不一致，请重新切换" };
          }
        } catch {
          return { ok: false, detail: "Codex auth.json 格式错误" };
        }
      }
      return { ok: true, detail: "Codex 本地配置正常" };
    } catch (e) {
      return { ok: false, detail: "读取本地配置失败：" + e.message };
    }
  },

  getFields() {
    return [
      { id: "apiKey", label: "API Token", type: "password", required: true },
      { id: "baseUrl", label: "Base URL", type: "text" },
      { id: "model", label: "模型", type: "text", required: true },
    ];
  },
};
