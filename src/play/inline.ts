export function localAssetPath(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }
  if (trimmed.includes("://") || trimmed.startsWith("//") || trimmed.startsWith("\\")) return null;
  const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? "";
  const parts: string[] = [];
  for (const segment of noQuery.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    parts.push(segment);
  }
  if (!parts.length) return null;
  return parts.join("/");
}

function mimeFor(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

function textOf(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function inlineBundle(files: Map<string, Uint8Array>): string {
  const index = files.get("index.html");
  if (!index) throw new Error("missing index.html");
  let html = textOf(index).replace(/<base\b[^>]*>/gi, "");

  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (full, pre: string, _q: string, src: string, post: string) => {
    const local = localAssetPath(src);
    if (!local) return full;
    const file = files.get(local);
    if (!file) return full;
    const attrs = `${pre} ${post}`.replace(/\ssrc\s*=\s*(["'])[^"']+\1/gi, "");
    const body = textOf(file).replaceAll("</script", "<\\/script");
    return `<script${attrs}>${body}</script>`;
  });

  html = html.replace(/<link\b([^>]*)>/gi, (full, attrs: string) => {
    if (!/\brel\s*=\s*(["'])stylesheet\1/i.test(attrs)) return full;
    const href = /\bhref\s*=\s*(["'])([^"']+)\1/i.exec(attrs);
    if (!href) return full;
    const local = localAssetPath(href[2] ?? "");
    if (!local) return full;
    const file = files.get(local);
    if (!file) return full;
    const body = textOf(file).replaceAll("</style", "<\\/style");
    return `<style>${body}</style>`;
  });

  html = html.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (full, pre: string, quote: string, src: string) => {
    const local = localAssetPath(src);
    if (!local) return full;
    const file = files.get(local);
    if (!file) return full;
    const b64 = Buffer.from(file).toString("base64");
    return `${pre}${quote}data:${mimeFor(local)};base64,${b64}${quote}`;
  });

  return html;
}
