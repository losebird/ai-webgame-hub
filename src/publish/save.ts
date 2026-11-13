import { getGame, insertGame, newId, type Db } from "../db.js";
import { removeBundle, writeBundle } from "../play/files.js";
import { acceptUpload, DEFAULT_LIMITS, type QuarantineLimits } from "./gate.js";
import { parseTags } from "../text.js";
import type { BlobStore } from "../store.js";

export type PublishInput = {
  authorId: string;
  title: string;
  summary: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  model: string;
  tags: string;
  promptBody: string;
  promptPublic: boolean;
  parentId: string | null;
  filename: string;
  bytes: Uint8Array;
  now: number;
};

export async function publishUpload(
  db: Db,
  blobs: BlobStore,
  input: PublishInput,
  limits: QuarantineLimits = DEFAULT_LIMITS,
): Promise<{ ok: true; id: string } | { ok: false; code: string }> {
  const title = input.title.trim();
  const summary = input.summary.trim();
  const model = input.model.trim();
  if (!title || title.length > 120) return { ok: false, code: "bad_title" };
  if (!summary || summary.length > 2000) return { ok: false, code: "bad_summary" };
  if (!model || model.length > 80) return { ok: false, code: "bad_model" };
  const promptBody = input.promptBody.slice(0, 20000);
  const parentId = input.parentId && input.parentId.trim() ? input.parentId.trim() : null;
  if (parentId) {
    const parent = await getGame(db, parentId);
    if (!parent || !parent.promptPublic) return { ok: false, code: "bad_parent" };
  }

  const lower = input.filename.toLowerCase();
  const kind = lower.endsWith(".zip") ? "zip" : lower.endsWith(".html") || lower.endsWith(".htm") ? "html" : null;
  if (!kind) return { ok: false, code: "bad_html_name" };

  const accepted = acceptUpload({ kind, filename: input.filename, bytes: input.bytes }, limits);
  if (!accepted.ok) return { ok: false, code: accepted.code };

  const id = newId();
  try {
    await writeBundle(blobs, id, accepted.bundle.files);
    await insertGame(db, {
      id,
      authorId: input.authorId,
      title,
      summary,
      titleEn: input.titleEn.trim().slice(0, 120),
      titleZh: input.titleZh.trim().slice(0, 120),
      summaryEn: input.summaryEn.trim().slice(0, 2000),
      summaryZh: input.summaryZh.trim().slice(0, 2000),
      model,
      promptPublic: input.promptPublic,
      promptBody,
      parentId,
      featured: false,
      tags: parseTags(input.tags),
      now: input.now,
    });
  } catch (err) {
    await removeBundle(blobs, id);
    throw err;
  }
  return { ok: true, id };
}
