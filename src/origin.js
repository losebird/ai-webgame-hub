/* 允许的 Origin：本请求的站点 origin、正式域名 jiwan.space / www 与 https://*.jiwan.space。
   本地开发靠 same-origin（例如 http://127.0.0.1:8787）。伪造 Origin 一律拒绝。 */
const OFFICIAL_HOST = "jiwan.space";

export function isOfficialHttpsOrigin(origin) {
  let u;
  try { u = new URL(origin); } catch (e) { return false; }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port && u.port !== "443") return false;
  const host = u.hostname.toLowerCase();
  if (host === OFFICIAL_HOST || host === "www." + OFFICIAL_HOST) return true;
  const suffix = "." + OFFICIAL_HOST;
  return host.endsWith(suffix) && host.length > suffix.length && !host.startsWith(".") && !host.includes("..");
}

export function isAllowedOrigin(origin, siteOrigin) {
  if (!origin) return false;
  if (origin === siteOrigin) return true;
  return isOfficialHttpsOrigin(origin);
}
