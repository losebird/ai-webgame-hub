import { zipSync } from "fflate";
import { hashPassword, newId } from "./crypto-util.js";
import {
  createUser,
  insertGame,
  linkCounts,
  publishedGameCount,
  userByHandle,
  type Db,
} from "./db.js";
import { importSeedText } from "./links/import.js";
import { removeBundle, writeBundle } from "./play/files.js";
import { acceptUpload, type RawUpload } from "./publish/gate.js";
import type { BlobStore } from "./store.js";

export type SeedAssets = {
  seedJson: string;
  dodgeHtml: Uint8Array;
  birdFiles: { path: string; bytes: Uint8Array }[];
};

async function publishSample(
  db: Db,
  blobs: BlobStore,
  authorId: string,
  now: number,
  input: {
    title: string;
    titleEn: string;
    titleZh: string;
    summary: string;
    summaryEn: string;
    summaryZh: string;
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
    await writeBundle(blobs, id, accepted.bundle.files);
    await insertGame(db, {
      id,
      authorId,
      title: input.title,
      summary: input.summary,
      titleEn: input.titleEn,
      titleZh: input.titleZh,
      summaryEn: input.summaryEn,
      summaryZh: input.summaryZh,
      model: input.model,
      promptPublic: true,
      promptBody: input.prompt,
      parentId: null,
      featured: true,
      tags: input.tags,
      now,
    });
  } catch (err) {
    await removeBundle(blobs, id);
    throw err;
  }
}

export async function seedIfEmpty(db: Db, blobs: BlobStore, assets: SeedAssets, now: number): Promise<void> {
  const links = await linkCounts(db);
  if (links.homepage === 0 && links.hidden === 0) {
    const result = await importSeedText(db, assets.seedJson, now);
    if (result.documentError || result.rejected.length) {
      const why = result.documentError ?? result.rejected.map((row) => `${row.placement}[${row.index}] ${row.reason}`).join("; ");
      throw new Error(`seed links failed: ${why}`);
    }
  }
  if (await publishedGameCount(db) > 0) return;

  let author = await userByHandle(db, "shelf");
  if (!author) {
    const password = bytesToPassword();
    const id = await createUser(db, "shelf", await hashPassword(password), now);
    if (!id) throw new Error("could not create the sample author");
    author = { id, handle: "shelf", passwordHash: "" };
  }

  await publishSample(db, blobs, author.id, now, {
    title: "Lantern Dodge",
    titleEn: "Lantern Dodge",
    titleZh: "灯笼躲闪",
    summary: "Move a lantern with the arrow keys or the pointer and avoid falling embers.",
    summaryEn: "Move a lantern with the arrow keys or the pointer and avoid falling embers.",
    summaryZh: "用方向键或指针移动灯笼，躲开落下的火星。",
    model: "Hand-written sample",
    tags: ["sample", "dodge"],
    prompt: "One-screen dodge game. The player is a lantern. Embers fall from the top. Arrow keys and pointer movement both move the lantern. Show the score and let the player restart after a hit.",
    upload: { kind: "html", filename: "index.html", bytes: assets.dodgeHtml },
  });

  const bird: Record<string, Uint8Array> = {};
  for (const file of assets.birdFiles) bird[file.path] = file.bytes;
  const zipped = zipSync(bird);
  await publishSample(db, blobs, author.id, now + 1, {
    title: "Paper Bird",
    titleEn: "Paper Bird",
    titleZh: "纸鸟",
    summary: "Flap a paper bird through gaps. Click, tap, or press Space.",
    summaryEn: "Flap a paper bird through gaps. Click, tap, or press Space.",
    summaryZh: "让纸鸟穿过空隙。点击、轻触或按空格。",
    model: "Hand-written sample",
    tags: ["sample", "flier"],
    prompt: "One-button flying game. A paper bird falls with gravity. Click or Space flaps upward. Walls with gaps scroll in. Score increases when you pass a gap. Restart after a hit.",
    upload: { kind: "zip", filename: "paper-bird.zip", bytes: zipped },
  });
}

function bytesToPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function birdZipFromFiles(files: { path: string; bytes: Uint8Array }[]): Uint8Array {
  const map: Record<string, Uint8Array> = {};
  for (const file of files) map[file.path] = file.bytes;
  return zipSync(map);
}
