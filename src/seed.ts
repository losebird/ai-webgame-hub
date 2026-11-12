import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { zipSync } from "fflate";
import { hashPassword } from "./auth.js";
import { createUser, insertGame, linkCounts, newId, publishedGameCount, userByHandle, type Db } from "./db.js";
import { importSeedFile } from "./links/import.js";
import { removeBundle, writeBundle } from "./play/files.js";
import { acceptUpload, type RawUpload } from "./publish/gate.js";

function zipTree(dir: string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const walk = (current: string, prefix: string) => {
    for (const name of readdirSync(current)) {
      const abs = path.join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const info = lstatSync(abs);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) walk(abs, rel);
      else files[rel] = new Uint8Array(readFileSync(abs));
    }
  };
  walk(dir, "");
  return zipSync(files);
}

function publishSample(
  db: Db,
  blobs: string,
  authorId: string,
  now: number,
  input: {
    title: string;
    summary: string;
    model: string;
    tags: string[];
    prompt: string;
    upload: RawUpload;
  },
) {
  const accepted = acceptUpload(input.upload);
  if (!accepted.ok) throw new Error(`sample ${input.title} rejected: ${accepted.code}`);
  const id = newId();
  try {
    writeBundle(blobs, id, accepted.bundle.files);
    insertGame(db, {
      id,
      authorId,
      title: input.title,
      summary: input.summary,
      model: input.model,
      promptPublic: true,
      promptBody: input.prompt,
      parentId: null,
      featured: true,
      tags: input.tags,
      now,
    });
  } catch (err) {
    removeBundle(blobs, id);
    throw err;
  }
}

export function seedIfEmpty(db: Db, opts: { repoRoot: string; blobs: string; now: number }) {
  const links = linkCounts(db);
  if (links.homepage === 0 && links.hidden === 0) {
    const result = importSeedFile(db, path.join(opts.repoRoot, "data/seed/seed-games.json"), opts.now);
    if (result.documentError || result.rejected.length) {
      const why = result.documentError ?? result.rejected.map((row) => `${row.placement}[${row.index}] ${row.reason}`).join("; ");
      throw new Error(`seed links failed: ${why}`);
    }
  }
  if (publishedGameCount(db) > 0) return;

  let author = userByHandle(db, "shelf");
  if (!author) {
    const id = createUser(db, "shelf", hashPassword(randomBytes(24).toString("base64url")), opts.now);
    if (!id) throw new Error("could not create the sample author");
    author = { id, handle: "shelf", passwordHash: "" };
  }

  const dodge = readFileSync(path.join(opts.repoRoot, "sample-games/dodge/index.html"));
  publishSample(db, opts.blobs, author.id, opts.now, {
    title: "Lantern Dodge",
    summary: "Move a lantern with the arrow keys or the pointer and avoid falling embers.",
    model: "Hand-written sample",
    tags: ["sample", "dodge"],
    prompt: "One-screen dodge game. The player is a lantern. Embers fall from the top. Arrow keys and pointer movement both move the lantern. Show the score and let the player restart after a hit.",
    upload: { kind: "html", filename: "index.html", bytes: new Uint8Array(dodge) },
  });

  const zipped = zipTree(path.join(opts.repoRoot, "sample-games/zip-bird"));
  publishSample(db, opts.blobs, author.id, opts.now + 1, {
    title: "Paper Bird",
    summary: "Flap a paper bird through gaps. Click, tap, or press Space.",
    model: "Hand-written sample",
    tags: ["sample", "flier"],
    prompt: "One-button flying game. A paper bird falls with gravity. Click or Space flaps upward. Walls with gaps scroll in. Score increases when you pass a gap. Restart after a hit.",
    upload: { kind: "zip", filename: "paper-bird.zip", bytes: zipped },
  });
}
