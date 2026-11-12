import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

function assertInside(base: string, dest: string) {
  const relative = path.relative(base, dest);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("refusing to write outside the game folder");
  }
}

export function writeBundle(root: string, gameId: string, files: { path: string; bytes: Uint8Array }[]) {
  if (!/^[A-Za-z0-9_-]+$/.test(gameId)) {
    throw new Error("bad game id");
  }
  const base = path.resolve(root, gameId);
  mkdirSync(base, { recursive: true });
  for (const file of files) {
    if (file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..")) {
      rmSync(base, { recursive: true, force: true });
      throw new Error("refusing to write outside the game folder");
    }
    const dest = path.resolve(base, file.path);
    assertInside(base, dest);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, file.bytes);
  }
}

export function readBundle(root: string, gameId: string): Map<string, Uint8Array> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(gameId)) return null;
  const base = path.resolve(root, gameId);
  if (!statOrNull(base)?.isDirectory()) return null;
  const out = new Map<string, Uint8Array>();
  walk(base, base, out);
  return out;
}

function statOrNull(file: string) {
  try {
    return lstatSync(file);
  } catch {
    return null;
  }
}

function walk(base: string, current: string, out: Map<string, Uint8Array>) {
  for (const name of readdirSync(current)) {
    const abs = path.join(current, name);
    const info = lstatSync(abs);
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      walk(base, abs, out);
      continue;
    }
    const relative = path.relative(base, abs).split(path.sep).join("/");
    if (relative.startsWith("..") || relative.includes("/../")) continue;
    out.set(relative, new Uint8Array(readFileSync(abs)));
  }
}

export function removeBundle(root: string, gameId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(gameId)) return;
  rmSync(path.resolve(root, gameId), { recursive: true, force: true });
}
