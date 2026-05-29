const fs = require("fs");
const path = require("path");
const { getApiKey, atomicWrite } = require("./utils");

const AIDER_CONFIG = path.join(
  process.env.USERPROFILE || process.env.HOME,
  ".aider.conf.yml"
);

// 剥离 YAML 注释，跳过引号内的 #
function stripYamlComment(line) {
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

// 最小化 YAML 解析器（仅支持简单 key: value 对）
function parseYaml(text) {
  const result = {};
  for (const rawLine of text.split("\n")) {
    const line = stripYamlComment(rawLine).trim();
    if (!line) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();
    // 解析值类型
    if (value === "" || value === "null" || value === "~") {
      value = null;
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (/^-?\d+$/.test(value)) {
      value = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      value = parseFloat(value);
    } else if ((value.startsWith('"') && value.endsWith('"')) ||
               (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

// YAML 序列化器（输出简洁 key: value 格式）
function stringifyYaml(obj) {
  let result = "";
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result += `${key}:\n`;
    } else if (typeof value === "string") {
      // 含特殊字符时加引号
      if (/[:#{}[\],&*?|>!%@`]/.test(value) || value.trim() !== value) {
        // 转义字符串内的反斜杠和双引号
        const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        result += `${key}: "${escaped}"\n`;
      } else {
        result += `${key}: ${value}\n`;
      }
    } else if (typeof value === "boolean") {
      result += `${key}: ${value}\n`;
    } else if (typeof value === "number") {
      result += `${key}: ${value}\n`;
    } else {
      result += `${key}: ${value}\n`;
    }
  }
  return result;
}

function readConfig() {
  try {
    if (fs.existsSync(AIDER_CONFIG)) {
      return parseYaml(fs.readFileSync(AIDER_CONFIG, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function writeConfig(data) {
  atomicWrite(AIDER_CONFIG, stringifyYaml(data));
}

module.exports = {
  name: "Aider",

  switch(config) {
    const data = readConfig();
    const key = getApiKey(config);
    const providerType = config.providerType || "anthropic";

    // 更新模型
    if (config.model) {
      data.model = config.model;
    }

    // 根据 providerType 写入对应的 API Key 和 Base URL
    if (providerType === "anthropic") {
      if (key) data["anthropic-api-key"] = key;
      if (config.baseUrl) data["anthropic-api-base"] = config.baseUrl;
      // 清除 openai 配置
      delete data["openai-api-key"];
      delete data["openai-api-base"];
    } else {
      if (key) data["openai-api-key"] = key;
      if (config.baseUrl) data["openai-api-base"] = config.baseUrl;
      // 清除 anthropic 配置
      delete data["anthropic-api-key"];
      delete data["anthropic-api-base"];
    }

    writeConfig(data);
  },

  verify(config) {
    try {
      if (!fs.existsSync(AIDER_CONFIG)) {
        return { ok: false, detail: "Aider 配置文件不存在，请先切换一次配置" };
      }
      const data = readConfig();
      const key = getApiKey(config);
      const providerType = config.providerType || "anthropic";

      if (config.model && data.model !== config.model) {
        return { ok: false, detail: "Aider 配置中的模型与当前配置不一致，请重新切换" };
      }

      if (providerType === "anthropic") {
        if (key && data["anthropic-api-key"] !== key) {
          return { ok: false, detail: "Aider 配置中的 Anthropic API Key 不一致，请重新切换" };
        }
        if (config.baseUrl && data["anthropic-api-base"] !== config.baseUrl) {
          return { ok: false, detail: "Aider 配置中的 Anthropic API Base 不一致，请重新切换" };
        }
      } else {
        if (key && data["openai-api-key"] !== key) {
          return { ok: false, detail: "Aider 配置中的 OpenAI API Key 不一致，请重新切换" };
        }
        if (config.baseUrl && data["openai-api-base"] !== config.baseUrl) {
          return { ok: false, detail: "Aider 配置中的 OpenAI API Base 不一致，请重新切换" };
        }
      }

      return { ok: true, detail: "Aider 本地配置正常" };
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
