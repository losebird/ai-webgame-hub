import { readFileSync } from "node:fs";
import type { Db } from "../db.js";
import { upsertExternalLink } from "../db.js";
import { parseSeed, type LinkRejection } from "./validate.js";

export type ImportResult = {
  imported: number;
  homepage: number;
  hidden: number;
  rejected: LinkRejection[];
  documentError: string | null;
};

export function importSeedText(db: Db, text: string, now = Date.now()): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { imported: 0, homepage: 0, hidden: 0, rejected: [], documentError: "invalid JSON" };
  }
  const parsed = parseSeed(raw);
  if (parsed.documentError) {
    return { imported: 0, homepage: 0, hidden: 0, rejected: [], documentError: parsed.documentError };
  }
  const order = new Map<string, number>();
  for (const link of parsed.accepted) {
    const sortOrder = order.get(link.placement) ?? 0;
    order.set(link.placement, sortOrder + 1);
    upsertExternalLink(db, {
      title: link.title,
      authorHandle: link.author_handle,
      postUrl: link.post_url,
      playUrl: link.play_url,
      summary: link.summary,
      model: link.model,
      licenseStatus: link.license_status,
      engagementJson: JSON.stringify(link.engagement),
      playUrlSourcePost: link.play_url_source_post,
      placement: link.placement,
      sortOrder,
      now,
    });
  }
  const homepage = parsed.accepted.filter((link) => link.placement === "homepage").length;
  return {
    imported: parsed.accepted.length,
    homepage,
    hidden: parsed.accepted.length - homepage,
    rejected: parsed.rejected,
    documentError: null,
  };
}

export function importSeedFile(db: Db, file: string, now = Date.now()): ImportResult {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return { imported: 0, homepage: 0, hidden: 0, rejected: [], documentError: `cannot read ${file}` };
  }
  return importSeedText(db, text, now);
}
