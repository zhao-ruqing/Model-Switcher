// 共享工具函数
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// 兼容旧配置：统一读取 apiKey（旧字段名 token）
function getApiKey(config) {
  return config.apiKey || config.token || "";
}

// 原子写入：写入临时文件 → rename 到目标路径
// 优先直接 rename（Unix 原子），失败则先删目标再 rename（Windows 兼容）
function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  const name = path.basename(filePath);
  const tmp = path.join(dir, `${name}.tmp.${Date.now()}.${crypto.randomBytes(4).toString("hex")}`);
  fs.writeFileSync(tmp, data, "utf-8");
  try {
    fs.renameSync(tmp, filePath);
  } catch (e) {
    if (e.code === "EEXIST" || e.code === "EPERM" || e.code === "EBUSY") {
      // Windows：目标文件存在时 rename 会失败，需先删除
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fs.renameSync(tmp, filePath);
    } else {
      // rename 失败且非常见 Windows 错误，清理临时文件后抛出
      try { fs.unlinkSync(tmp); } catch {}
      throw e;
    }
  }
}

// 原子写入 JSON 对象
function writeJsonAtomic(filePath, obj) {
  atomicWrite(filePath, JSON.stringify(obj, null, 2));
}

// 写入后校验：读取文件，对比关键字段是否一致
function verifyWrite(filePath, expectedFields) {
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, detail: "写入后文件不存在" };
    }
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    for (const [fieldPath, expectedVal] of Object.entries(expectedFields)) {
      // 支持嵌套路径如 "env.ANTHROPIC_AUTH_TOKEN"
      const parts = fieldPath.split(".");
      let actual = content;
      for (const part of parts) {
        actual = actual?.[part];
      }
      if (expectedVal && actual !== expectedVal) {
        return { ok: false, detail: `字段 ${fieldPath} 写入不一致：期望 "${expectedVal}"，实际 "${actual}"` };
      }
    }
    return { ok: true, detail: "写入校验通过" };
  } catch (e) {
    return { ok: false, detail: "写入校验失败：" + e.message };
  }
}

module.exports = { getApiKey, atomicWrite, writeJsonAtomic, verifyWrite };
