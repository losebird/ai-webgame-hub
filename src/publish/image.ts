export type ImageInfo = {
  contentType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
};

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 4096;

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const size = u16be(bytes, i + 2);
    if (size < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 7 >= bytes.length) return null;
      return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
    }
    i += 2 + size;
  }
  return null;
}

function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const webp = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const kind = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  if (kind === "VP8X" && bytes.length >= 30) {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { width, height };
  }
  if (kind === "VP8 " && bytes.length >= 30) {
    return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  }
  if (kind === "VP8L" && bytes.length >= 25) {
    const bits = u32le(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
  const png = pngSize(bytes);
  if (png) return finish("image/png", png);
  const jpeg = jpegSize(bytes);
  if (jpeg) return finish("image/jpeg", jpeg);
  const webp = webpSize(bytes);
  if (webp) return finish("image/webp", webp);
  return null;
}

function finish(contentType: ImageInfo["contentType"], size: { width: number; height: number }): ImageInfo | null {
  if (size.width < 1 || size.height < 1 || size.width > MAX_EDGE || size.height > MAX_EDGE) return null;
  return { contentType, width: size.width, height: size.height };
}
