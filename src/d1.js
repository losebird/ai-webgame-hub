/* D1 异步适配：给 src/api.js 提供 all / get / run。 */

export function createD1(database) {
  function stmt(text, params) {
    let s = database.prepare(text);
    if (params.length) s = s.bind(...params.map((v) => (v === undefined ? null : v)));
    return s;
  }
  return {
    async all(text, ...p) {
      const out = await stmt(text, p).all();
      return out.results || [];
    },
    async get(text, ...p) {
      const row = await stmt(text, p).first();
      return row ?? null;
    },
    async run(text, ...p) {
      return stmt(text, p).run();
    },
    async exec(text) {
      return database.exec(text);
    }
  };
}

export const API_FIRST = new Set([
  "health", "home", "games", "rankings", "search", "posts", "comments",
  "reports", "auth", "me", "logout", "users", "workshop", "plays", "notifs", "admin"
]);

export function isApiPath(pathname) {
  const first = String(pathname || "").replace(/^\/+/, "").split("/")[0];
  return API_FIRST.has(first);
}

export function hasFileExtension(pathname) {
  const last = String(pathname || "").split("/").pop() || "";
  return /\.[a-z0-9]{1,8}$/i.test(last);
}
