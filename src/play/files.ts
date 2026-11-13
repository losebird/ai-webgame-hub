import type { BlobStore } from "../store.js";

function validGameId(gameId: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(gameId);
}

function validRelPath(rel: string): boolean {
  if (!rel || rel.startsWith("/") || rel.includes("\\") || rel.includes("\0")) return false;
  const parts = rel.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}

export async function writeBundle(
  blobs: BlobStore,
  gameId: string,
  files: { path: string; bytes: Uint8Array }[],
): Promise<void> {
  if (!validGameId(gameId)) throw new Error("bad game id");
  try {
    for (const file of files) {
      if (!validRelPath(file.path)) throw new Error("refusing to write outside the game folder");
      await blobs.put(`games/${gameId}/${file.path}`, file.bytes);
    }
  } catch (err) {
    await blobs.deletePrefix(`games/${gameId}/`);
    throw err;
  }
}

export async function readBundle(blobs: BlobStore, gameId: string): Promise<Map<string, Uint8Array> | null> {
  if (!validGameId(gameId)) return null;
  const prefix = `games/${gameId}/`;
  const keys = await blobs.list(prefix);
  if (!keys.length) return null;
  const out = new Map<string, Uint8Array>();
  for (const key of keys) {
    const rel = key.slice(prefix.length);
    if (!validRelPath(rel)) continue;
    const bytes = await blobs.get(key);
    if (bytes) out.set(rel, bytes);
  }
  return out.size ? out : null;
}

export async function removeBundle(blobs: BlobStore, gameId: string): Promise<number> {
  if (!validGameId(gameId)) return 0;
  const games = await blobs.deletePrefix(`games/${gameId}/`);
  const shots = await blobs.deletePrefix(`shots/${gameId}/`);
  return games + shots;
}

export async function writeShot(
  blobs: BlobStore,
  gameId: string,
  shotId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  if (!validGameId(gameId) || !validGameId(shotId)) throw new Error("bad id");
  await blobs.put(`shots/${gameId}/${shotId}`, bytes, contentType);
}

export async function readShot(blobs: BlobStore, gameId: string, shotId: string): Promise<Uint8Array | null> {
  if (!validGameId(gameId) || !validGameId(shotId)) return null;
  return blobs.get(`shots/${gameId}/${shotId}`);
}
