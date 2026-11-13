import type { IngestFailureCode } from "./publish/gate.js";
import { t, type Locale } from "./i18n/index.js";

export function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const INGEST_KEYS: Record<IngestFailureCode | "no_file" | "bad_title" | "bad_summary" | "bad_model" | "bad_parent" | "login" | "bad_shot" | "too_many_shots", keyof typeof import("./i18n/en.js").en> = {
  missing_index: "missingIndex",
  path_traversal: "pathTraversal",
  absolute_path: "absolutePath",
  symlink: "symlink",
  too_many_files: "tooManyFiles",
  archive_too_large: "archiveTooLarge",
  compression_bomb: "compressionBomb",
  invalid_zip: "invalidZip",
  empty_archive: "emptyArchive",
  html_too_large: "htmlTooLarge",
  bad_html_name: "badHtmlName",
  not_html: "notHtml",
  no_file: "noFile",
  bad_title: "badTitle",
  bad_summary: "badSummary",
  bad_model: "badModel",
  bad_parent: "badParent",
  login: "loginNeeded",
  bad_shot: "badShot",
  too_many_shots: "tooManyShots",
};

export function ingestText(locale: Locale, code: string): string {
  const key = INGEST_KEYS[code as keyof typeof INGEST_KEYS];
  if (key) return t(locale, key);
  return t(locale, "uploadRejected");
}

export function offsiteLabel(locale: Locale, engagementJson: string): string {
  let value: unknown;
  try {
    value = JSON.parse(engagementJson);
  } catch {
    return t(locale, "offsiteGeneric");
  }
  if (typeof value === "string") {
    return t(locale, "offsiteWithText", { value });
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const likes = (value as { likes?: unknown }).likes;
    if (typeof likes === "number") {
      return t(locale, "offsiteLikes", { asOf: t(locale, "asOf"), likes });
    }
  }
  return t(locale, "offsiteUnlisted");
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
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("//")) {
    return "/";
  }
  if (!/^\/[A-Za-z0-9/_\-.?=&%]*$/.test(raw)) return "/";
  return raw;
}
