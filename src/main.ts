import { createApp, listen } from "./http/server.js";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const app = createApp({
  dataDir: process.env.DATA_DIR ?? "data",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  repoRoot: process.cwd(),
});

const server = await listen(app, port, host);
const address = server.address();
const shown = typeof address === "object" && address ? address.port : port;
console.log(`Ace Shelf listening on http://${host}:${shown}`);
