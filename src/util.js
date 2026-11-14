/* 密码哈希与通用工具。演示凭据算法是 sha256("jiwan:" + pass)，不是正式环境方案。 */
const enc = new TextEncoder();

export async function hashPass(pass) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode("jiwan:" + String(pass || "")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* 常量时间比较。长度不同时仍会扫完较长一侧，避免按长度提前返回。 */
export function timingSafeEqual(a, b) {
  const ba = enc.encode(String(a ?? ""));
  const bb = enc.encode(String(b ?? ""));
  const len = Math.max(ba.length, bb.length, 1);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (i < ba.length ? ba[i] : 0) ^ (i < bb.length ? bb[i] : 0);
  }
  return diff === 0;
}

export function slug(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .slice(0, 24) || "u";
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const DUMMY_PASS_HASH = "0".repeat(64);
