function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function parseUrlEncoded(body: Uint8Array): Record<string, string> {
  const params = new URLSearchParams(decodeUtf8(body));
  const fields: Record<string, string> = {};
  for (const [key, value] of params) fields[key] = value;
  return fields;
}

export type FormFile = { filename: string; data: Uint8Array };

export function parseMultipart(
  body: Uint8Array,
  contentType: string,
): { fields: Record<string, string>; files: Record<string, FormFile> } | null {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) return null;
  const separator = new TextEncoder().encode(`--${boundary}`);
  const crlf = new TextEncoder().encode("\r\n");
  const headerEndMarker = new TextEncoder().encode("\r\n\r\n");
  const fields: Record<string, string> = {};
  const files: Record<string, FormFile> = {};
  let cursor = indexOf(body, separator);
  if (cursor < 0) return null;
  while (cursor >= 0) {
    cursor += separator.length;
    if (body[cursor] === 0x2d && body[cursor + 1] === 0x2d) break;
    if (body[cursor] === 0x0d && body[cursor + 1] === 0x0a) cursor += 2;
    const headerEnd = indexOf(body, headerEndMarker, cursor);
    if (headerEnd < 0) break;
    const header = decodeUtf8(body.subarray(cursor, headerEnd));
    const dataStart = headerEnd + 4;
    const next = indexOf(body, separator, dataStart);
    if (next < 0) break;
    let dataEnd = next;
    if (dataEnd >= 2 && body[dataEnd - 2] === 0x0d && body[dataEnd - 1] === 0x0a) dataEnd -= 2;
    const data = body.subarray(dataStart, dataEnd);
    const name = /name="([^"]*)"/.exec(header)?.[1];
    const filename = /filename="([^"]*)"/.exec(header)?.[1];
    if (name) {
      if (filename !== undefined) files[name] = { filename, data: Uint8Array.from(data) };
      else fields[name] = decodeUtf8(data);
    }
    cursor = next;
    void crlf;
  }
  return { fields, files };
}
