import type { IngestFailureCode } from "./publish/gate.js";

export function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const INGEST_TEXT: Record<IngestFailureCode | "no_file" | "bad_title" | "bad_summary" | "bad_model" | "bad_parent" | "login", string> = {
  missing_index: "This zip has no index.html at the root or inside a single top folder. Nothing was saved.",
  path_traversal: "This zip contains a path that escapes its folder. Nothing was saved.",
  absolute_path: "This zip contains an absolute path. Nothing was saved.",
  symlink: "This zip contains a symlink. Nothing was saved.",
  too_many_files: "This zip has too many files. Nothing was saved.",
  archive_too_large: "This zip is over the 32 MB limit. Nothing was saved.",
  compression_bomb: "This zip expands too far for its size. Nothing was saved.",
  invalid_zip: "This file is not a zip we can read. Nothing was saved.",
  empty_archive: "This zip is empty. Nothing was saved.",
  html_too_large: "This HTML file is over the 32 MB limit. Nothing was saved.",
  bad_html_name: "Upload a .html file or a .zip file.",
  no_file: "Choose a file to upload.",
  bad_title: "Add a title.",
  bad_summary: "Add a short summary.",
  bad_model: "Name the model you used.",
  bad_parent: "The game you are remixing is not available.",
  login: "Log in before uploading.",
};

export function ingestText(code: string): string {
  if (code in INGEST_TEXT) {
    return INGEST_TEXT[code as keyof typeof INGEST_TEXT];
  }
  return "The upload was rejected. Nothing was saved.";
}

const OFFSITE_AS_OF = "截至 2026-11-13 03:00 CST";

export function offsiteLabel(engagementJson: string): string {
  let value: unknown;
  try {
    value = JSON.parse(engagementJson);
  } catch {
    return "站外记录（不是本站游玩数）";
  }
  if (typeof value === "string") {
    return `站外记录（不是本站游玩数） · ${value}`;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const likes = (value as { likes?: unknown }).likes;
    if (typeof likes === "number") {
      return `${OFFSITE_AS_OF} · 站外赞 ${likes}（不是本站游玩数）`;
    }
  }
  return "站外互动未单列（不是本站游玩数）";
}

export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().toLowerCase().replaceAll(/\s+/g, "-");
    if (!/^[a-z0-9-]{1,24}$/.test(tag)) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length === 8) break;
  }
  return out;
}

export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/";
  }
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(raw)) return "/";
  return raw;
}
