const fs = require("fs");
const path = require("path");
const { getApiKey } = require("./utils");

const CODEX_DIR = path.join(process.env.USERPROFILE || process.env.HOME, ".codex");
const CODEX_CONFIG = path.join(CODEX_DIR, "config.toml");

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
  fs.writeFileSync(CODEX_CONFIG, stringifyToml(data));
}

module.exports = {
  name: "Codex",

  switch(config) {
    const data = readConfig();
    // 更新模型配置
    if (config.model) {
      data.model = config.model;
    }
    writeConfig(data);
  },

  verify(config) {
    try {
      if (!fs.existsSync(CODEX_CONFIG)) {
        return { ok: false, detail: "Codex 配置文件不存在，请先切换一次配置" };
      }
      const data = readConfig();
      if (config.model && data.model !== config.model) {
        return { ok: false, detail: "Codex 配置中的模型与当前配置不一致，请重新切换" };
      }
      return { ok: true, detail: "Codex 本地配置正常" };
    } catch (e) {
      return { ok: false, detail: "读取本地配置失败：" + e.message };
    }
  },

  getFields() {
    return [
      // Codex 通过环境变量读取凭据，此处仅保留模型字段
      { id: "model", label: "模型", type: "text" },
    ];
  },
};
