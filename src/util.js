/* 密码哈希：每用户独立盐 + PBKDF2-SHA256（Web Crypto）。
   格式 pbkdf2$sha256$<iters>$<salt_hex>$<dk_hex>。
   旧方案 sha256("jiwan:" + pass) 不再验证通过，登录时也不升级旧哈希。
   迭代次数在「明显强于单次 SHA-256」与免费套餐约 10ms CPU 之间取舍，见 REPORT-cf.md。
   不要加仓库内 pepper，也不要把验证绑死在 wrangler secret 上。 */
const enc = new TextEncoder();

export const MIN_PASS_LENGTH = 10;
export const PASS_ITERS = 10000;
export const PASS_MAX_ITERS = 20000;
export const PASS_SALT_BYTES = 16;
export const PASS_DK_BYTES = 32;

export function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex) {
  const h = String(hex || "");
  if (!h || h.length % 2) return null;
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function parsePassHash(stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 5) return null;
  if (parts[0] !== "pbkdf2" || parts[1] !== "sha256") return null;
  const iters = Number(parts[2]);
  if (!Number.isInteger(iters) || iters < 1 || iters > PASS_MAX_ITERS) return null;
  const salt = fromHex(parts[3]);
  const dk = fromHex(parts[4]);
  if (!salt || !dk || salt.length !== PASS_SALT_BYTES || dk.length !== PASS_DK_BYTES) return null;
  return { iters, salt, dk };
}

async function derive(pass, salt, iters) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(pass || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: iters },
    key,
    PASS_DK_BYTES * 8
  );
  return new Uint8Array(bits);
}

export function formatPassHash(iters, salt, dk) {
  return "pbkdf2$sha256$" + iters + "$" + toHex(salt) + "$" + toHex(dk);
}

export async function hashPass(pass, opts) {
  const iters = opts && opts.iters != null ? opts.iters : PASS_ITERS;
  const salt = opts && opts.salt ? new Uint8Array(opts.salt) : crypto.getRandomValues(new Uint8Array(PASS_SALT_BYTES));
  const dk = await derive(pass, salt, iters);
  return formatPassHash(iters, salt, dk);
}

const DUMMY_SALT = new Uint8Array(PASS_SALT_BYTES);
export const DUMMY_PASS_HASH = formatPassHash(PASS_ITERS, DUMMY_SALT, new Uint8Array(PASS_DK_BYTES));

export async function verifyPass(pass, stored) {
  const parsed = parsePassHash(stored);
  const iters = parsed ? parsed.iters : PASS_ITERS;
  const salt = parsed ? parsed.salt : DUMMY_SALT;
  const dk = await derive(pass, salt, iters);
  const fresh = formatPassHash(iters, salt, dk);
  const target = parsed ? formatPassHash(parsed.iters, parsed.salt, parsed.dk) : DUMMY_PASS_HASH;
  const ok = timingSafeEqual(fresh, target);
  return !!(parsed && ok);
}

export async function unusablePassHash() {
  return hashPass(randomToken(32));
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
  return toHex(a);
}
