export type LinkPlacement = "homepage" | "alternate";

export type AcceptedLink = {
  title: string;
  author_handle: string;
  post_url: string;
  play_url: string;
  summary: string;
  model: string;
  license_status: string;
  engagement: unknown;
  play_url_source_post: string | null;
  placement: LinkPlacement;
};

export type LinkRejection = {
  index: number;
  placement: string;
  title: string;
  reason: string;
};

export type SeedParse = {
  accepted: AcceptedLink[];
  rejected: LinkRejection[];
  documentError: string | null;
};

const REQUIRED = [
  "title",
  "author_handle",
  "post_url",
  "play_url",
  "summary",
  "model",
  "license_status",
  "engagement",
] as const;

function isHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function presentString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.trim() === "") return null;
  return value;
}

function checkRow(row: unknown, index: number, placement: LinkPlacement): { ok: AcceptedLink } | { reason: string; title: string } {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { reason: "entry is not an object", title: "" };
  }
  const record = row as Record<string, unknown>;
  const missing: string[] = [];
  const strings: Partial<Record<(typeof REQUIRED)[number], string>> = {};
  for (const key of REQUIRED) {
    if (key === "engagement") continue;
    const value = presentString(record[key]);
    if (value === null) missing.push(key);
    else strings[key] = value;
  }
  const engagement = record.engagement;
  const engagementOk =
    (typeof engagement === "string" && engagement.trim() !== "") ||
    (engagement !== null && typeof engagement === "object" && !Array.isArray(engagement));
  if (!engagementOk) missing.push("engagement");
  if (missing.length) {
    return {
      reason: `missing ${missing.join(", ")}`,
      title: typeof record.title === "string" ? record.title : "",
    };
  }
  const badUrls: string[] = [];
  if (!isHttps(strings.post_url!)) badUrls.push("post_url");
  if (!isHttps(strings.play_url!)) badUrls.push("play_url");
  let source: string | null = null;
  if ("play_url_source_post" in record && record.play_url_source_post != null) {
    const sourceValue = presentString(record.play_url_source_post);
    if (sourceValue === null || !isHttps(sourceValue)) badUrls.push("play_url_source_post");
    else source = sourceValue;
  }
  if (badUrls.length) {
    return {
      reason: `not https: ${badUrls.join(", ")}`,
      title: strings.title ?? "",
    };
  }
  return {
    ok: {
      title: strings.title!,
      author_handle: strings.author_handle!,
      post_url: strings.post_url!,
      play_url: strings.play_url!,
      summary: strings.summary!,
      model: strings.model!,
      license_status: strings.license_status!,
      engagement,
      play_url_source_post: source,
      placement,
    },
  };
}

export function parseSeed(raw: unknown): SeedParse {
  const groups: { placement: LinkPlacement; rows: unknown[] }[] = [];
  if (Array.isArray(raw)) {
    groups.push({ placement: "homepage", rows: raw });
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (!Array.isArray(record.homepage)) {
      return {
        accepted: [],
        rejected: [],
        documentError: "seed must be an array, or an object with a homepage array",
      };
    }
    groups.push({ placement: "homepage", rows: record.homepage });
    if (record.alternates !== undefined) {
      if (!Array.isArray(record.alternates)) {
        return {
          accepted: [],
          rejected: [],
          documentError: "alternates must be an array",
        };
      }
      groups.push({ placement: "alternate", rows: record.alternates });
    }
  } else {
    return {
      accepted: [],
      rejected: [],
      documentError: "seed must be an array, or an object with a homepage array",
    };
  }

  const accepted: AcceptedLink[] = [];
  const rejected: LinkRejection[] = [];
  for (const group of groups) {
    group.rows.forEach((row, index) => {
      const result = checkRow(row, index, group.placement);
      if ("ok" in result) accepted.push(result.ok);
      else {
        rejected.push({
          index,
          placement: group.placement,
          title: result.title,
          reason: result.reason,
        });
      }
    });
  }
  return { accepted, rejected, documentError: null };
}
