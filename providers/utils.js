// 共享工具函数
// 兼容旧配置：统一读取 apiKey（旧字段名 token）
function getApiKey(config) {
  return config.apiKey || config.token || "";
}

module.exports = { getApiKey };
