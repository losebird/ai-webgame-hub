export type RuntimeConfig = {
  siteName: string;
  siteOrigin: string;
  gameOrigin: string;
  adminToken: string;
  ipSalt: string;
};

export function runtimeConfig(env: Record<string, string | undefined>): RuntimeConfig {
  return {
    siteName: env.SITE_NAME || "WebGame",
    siteOrigin: (env.SITE_ORIGIN || "http://127.0.0.1:8787").replace(/\/$/, ""),
    gameOrigin: (env.GAME_ORIGIN || "http://127.0.0.1:8788").replace(/\/$/, ""),
    adminToken: env.ADMIN_TOKEN || "",
    ipSalt: env.IP_SALT || "local-dev-salt",
  };
}
