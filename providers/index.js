// Provider 适配器注册中心
const claude = require("./claude");
const opencode = require("./opencode");
const codex = require("./codex");
const aider = require("./aider");
const continueAdapter = require("./continue");
const { getApiKey } = require("./utils");

const providers = {
  claude,
  opencode,
  codex,
  aider,
  continue: continueAdapter,
};

// 根据 providerType 选择 API 测试逻辑
const testers = {
  // Anthropic 兼容 API 测试
  async anthropic(config) {
    const baseUrl = config.baseUrl || "https://api.anthropic.com";
    const apiKey = getApiKey(config);
    const sdkBase = baseUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
    const testUrl = sdkBase + "/v1/messages";
    const startTime = Date.now();

    const response = await fetch(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    const elapsed = Date.now() - startTime;
    const result = await response.json().catch(() => ({}));
    const modelValid = response.ok && (result.content || result.stop_reason || result.type === "message");

    return { response, result, elapsed, modelValid };
  },

  // OpenAI 兼容 API 测试
  async openai(config) {
    const baseUrl = config.baseUrl || "https://api.openai.com";
    const apiKey = getApiKey(config);
    const testUrl = baseUrl.replace(/\/v1\/?$/, "") + "/v1/models";
    const startTime = Date.now();

    const response = await fetch(testUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - startTime;
    const result = await response.json().catch(() => ({}));
    const modelValid = response.ok && Array.isArray(result.data);

    return { response, result, elapsed, modelValid };
  },
};

module.exports = { providers, testers };
