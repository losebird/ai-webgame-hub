export function parseUrlEncoded(body: Buffer): Record<string, string> {
  const params = new URLSearchParams(body.toString("utf8"));
  const fields: Record<string, string> = {};
  for (const [key, value] of params) fields[key] = value;
  return fields;
}

export function parseMultipart(
  body: Buffer,
  contentType: string,
): { fields: Record<string, string>; files: Record<string, { filename: string; data: Buffer }> } | null {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) return null;
  const separator = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  const files: Record<string, { filename: string; data: Buffer }> = {};
  let cursor = body.indexOf(separator);
  if (cursor < 0) return null;
  while (cursor >= 0) {
    cursor += separator.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;
    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    if (headerEnd < 0) break;
    const header = body.subarray(cursor, headerEnd).toString("utf8");
    const dataStart = headerEnd + 4;
    const next = body.indexOf(separator, dataStart);
    if (next < 0) break;
    let dataEnd = next;
    if (body.subarray(dataEnd - 2, dataEnd).toString() === "\r\n") dataEnd -= 2;
    const data = body.subarray(dataStart, dataEnd);
    const name = /name="([^"]*)"/.exec(header)?.[1];
    const filename = /filename="([^"]*)"/.exec(header)?.[1];
    if (name) {
      if (filename !== undefined) files[name] = { filename, data: Buffer.from(data) };
      else fields[name] = data.toString("utf8");
    }
    cursor = next;
  }
  return { fields, files };
}
