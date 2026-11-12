import { inflateSync } from "fflate";

export type RawUpload =
  | { kind: "html"; filename: string; bytes: Uint8Array }
  | { kind: "zip"; filename: string; bytes: Uint8Array };

export type QuarantineLimits = {
  maxCompressedBytes: number;
  maxFiles: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
};

export const DEFAULT_LIMITS: QuarantineLimits = {
  maxCompressedBytes: 32 * 1024 * 1024,
  maxFiles: 200,
  maxUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 100,
};

export type IngestFailureCode =
  | "missing_index"
  | "path_traversal"
  | "absolute_path"
  | "symlink"
  | "too_many_files"
  | "archive_too_large"
  | "compression_bomb"
  | "invalid_zip"
  | "empty_archive"
  | "html_too_large"
  | "bad_html_name";

export type QuarantinedBundle = {
  files: { path: string; bytes: Uint8Array }[];
  entry: "index.html";
};

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const ZIP64_MAGIC = 0xffffffff;

const S_IFLNK = 0xa000;
const S_IFDIR = 0x4000;

type ZipEntryMeta = {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  externalAttrs: number;
  isDir: boolean;
  isSymlink: boolean;
};

export function acceptUpload(
  upload: RawUpload,
  limits: QuarantineLimits = DEFAULT_LIMITS,
): { ok: true; bundle: QuarantinedBundle } | { ok: false; code: IngestFailureCode } {
  if (upload.kind === "html") {
    return acceptHtml(upload.filename, upload.bytes, limits);
  }
  return acceptZip(upload.bytes, limits);
}

function acceptHtml(
  filename: string,
  bytes: Uint8Array,
  limits: QuarantineLimits,
): { ok: true; bundle: QuarantinedBundle } | { ok: false; code: IngestFailureCode } {
  if (!/\.html?$/i.test(filename)) {
    return { ok: false, code: "bad_html_name" };
  }
  if (bytes.length > limits.maxCompressedBytes) {
    return { ok: false, code: "html_too_large" };
  }
  return {
    ok: true,
    bundle: {
      files: [{ path: "index.html", bytes: new Uint8Array(bytes) }],
      entry: "index.html",
    },
  };
}

function readU16(d: Uint8Array, o: number): number {
  return d[o]! | (d[o + 1]! << 8);
}

function readU32(d: Uint8Array, o: number): number {
  return (
    (d[o]! | (d[o + 1]! << 8) | (d[o + 2]! << 16) | (d[o + 3]! << 24)) >>> 0
  );
}

function findEocd(data: Uint8Array): number | null {
  const min = 22;
  const start = Math.max(0, data.length - min - 65535);
  for (let i = data.length - min; i >= start; i--) {
    if (readU32(data, i) === EOCD_SIG) {
      return i;
    }
  }
  return null;
}

function pathViolation(name: string): IngestFailureCode | null {
  if (name.includes("\0")) {
    return "path_traversal";
  }
  if (name.includes("\\")) {
    return "path_traversal";
  }
  if (name.startsWith("/")) {
    return "absolute_path";
  }
  if (/^[a-zA-Z]:/.test(name)) {
    return "absolute_path";
  }
  const segments = name.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      return "path_traversal";
    }
  }
  return null;
}

function unixFileType(externalAttrs: number): number {
  return (externalAttrs >>> 16) & 0xf000;
}

function parseCentralDirectory(data: Uint8Array): ZipEntryMeta[] | "invalid_zip" {
  const eocdOff = findEocd(data);
  if (eocdOff === null || eocdOff + 22 > data.length) {
    return "invalid_zip";
  }

  if (eocdOff >= 20 && readU32(data, eocdOff - 20) === 0x07064b50) {
    return "invalid_zip";
  }

  const cdSize = readU32(data, eocdOff + 12);
  const cdOffset = readU32(data, eocdOff + 16);
  if (cdSize === ZIP64_MAGIC || cdOffset === ZIP64_MAGIC) {
    return "invalid_zip";
  }
  if (cdOffset + cdSize > data.length) {
    return "invalid_zip";
  }

  const totalEntries = readU16(data, eocdOff + 10);
  const entries: ZipEntryMeta[] = [];
  let pos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > data.length || readU32(data, pos) !== CD_SIG) {
      return "invalid_zip";
    }

    const flags = readU16(data, pos + 8);
    const method = readU16(data, pos + 10);
    const crc = readU32(data, pos + 16);
    let compressedSize = readU32(data, pos + 20);
    let uncompressedSize = readU32(data, pos + 24);
    const nameLen = readU16(data, pos + 28);
    const extraLen = readU16(data, pos + 30);
    const commentLen = readU16(data, pos + 32);
    const externalAttrs = readU32(data, pos + 38);
    const localHeaderOffset = readU32(data, pos + 42);

    if (
      compressedSize === ZIP64_MAGIC ||
      uncompressedSize === ZIP64_MAGIC ||
      localHeaderOffset === ZIP64_MAGIC
    ) {
      return "invalid_zip";
    }

    const nameStart = pos + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > data.length) {
      return "invalid_zip";
    }
    const name = new TextDecoder().decode(data.subarray(nameStart, nameEnd));

    const fileType = unixFileType(externalAttrs);
    const isDir = name.endsWith("/") || fileType === S_IFDIR;
    const isSymlink = fileType === S_IFLNK;

    entries.push({
      name,
      method,
      flags,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      externalAttrs,
      isDir,
      isSymlink,
    });

    pos = nameEnd + extraLen + commentLen;
  }

  if (pos !== cdOffset + cdSize) {
    return "invalid_zip";
  }

  return entries;
}

function readLocalFile(
  data: Uint8Array,
  offset: number,
  meta: ZipEntryMeta,
):
  | { ok: true; dataStart: number; dataEnd: number }
  | { ok: false; code: IngestFailureCode } {
  if (offset + 30 > data.length || readU32(data, offset) !== LFH_SIG) {
    return { ok: false, code: "invalid_zip" };
  }

  const flags = readU16(data, offset + 6);
  const method = readU16(data, offset + 8);
  const nameLen = readU16(data, offset + 26);
  const extraLen = readU16(data, offset + 28);
  const nameStart = offset + 30;
  const nameEnd = nameStart + nameLen;
  if (nameEnd + extraLen > data.length) {
    return { ok: false, code: "invalid_zip" };
  }

  const localName = new TextDecoder().decode(data.subarray(nameStart, nameEnd));
  if (localName !== meta.name) {
    return { ok: false, code: "invalid_zip" };
  }
  if (flags !== meta.flags || method !== meta.method) {
    return { ok: false, code: "invalid_zip" };
  }

  const dataStart = nameEnd + extraLen;
  const dataEnd = dataStart + meta.compressedSize;
  if (dataEnd > data.length) {
    return { ok: false, code: "invalid_zip" };
  }

  return { ok: true, dataStart, dataEnd };
}

function inflateEntry(
  data: Uint8Array,
  meta: ZipEntryMeta,
  limits: QuarantineLimits,
): { ok: true; bytes: Uint8Array } | { ok: false; code: IngestFailureCode } {
  const local = readLocalFile(data, meta.localHeaderOffset, meta);
  if (!local.ok) {
    return local;
  }

  const slice = data.subarray(local.dataStart, local.dataEnd);
  let bytes: Uint8Array;

  if (meta.method === 0) {
    bytes = slice;
  } else if (meta.method === 8) {
    try {
      bytes = inflateSync(slice);
    } catch {
      return { ok: false, code: "invalid_zip" };
    }
  } else {
    return { ok: false, code: "invalid_zip" };
  }

  if (bytes.length > meta.uncompressedSize || bytes.length > limits.maxUncompressedBytes) {
    return { ok: false, code: "compression_bomb" };
  }

  return { ok: true, bytes };
}

function normalizeBundlePaths(
  paths: string[],
): { ok: true; stripPrefix: string } | { ok: false; code: "missing_index" } {
  const filePaths = paths.filter((p) => p.length > 0);
  if (filePaths.includes("index.html")) {
    return { ok: true, stripPrefix: "" };
  }

  const topLevels = new Set<string>();
  for (const p of filePaths) {
    const slash = p.indexOf("/");
    if (slash === -1) {
      topLevels.add("");
    } else {
      topLevels.add(p.slice(0, slash));
    }
  }

  if (topLevels.size !== 1 || topLevels.has("")) {
    return { ok: false, code: "missing_index" };
  }

  const only = [...topLevels][0]!;
  const indexPath = `${only}/index.html`;
  if (!filePaths.includes(indexPath)) {
    return { ok: false, code: "missing_index" };
  }

  return { ok: true, stripPrefix: `${only}/` };
}

function stripPrefix(path: string, prefix: string): string {
  if (prefix === "") {
    return path;
  }
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function acceptZip(
  data: Uint8Array,
  limits: QuarantineLimits,
): { ok: true; bundle: QuarantinedBundle } | { ok: false; code: IngestFailureCode } {
  if (data.length > limits.maxCompressedBytes) {
    return { ok: false, code: "archive_too_large" };
  }

  const parsed = parseCentralDirectory(data);
  if (parsed === "invalid_zip") {
    return { ok: false, code: "invalid_zip" };
  }

  let fileCount = 0;
  let declaredTotal = 0;
  const pending: ZipEntryMeta[] = [];

  for (const entry of parsed) {
    if (entry.flags & 1) {
      return { ok: false, code: "invalid_zip" };
    }
    if (entry.isDir) {
      continue;
    }
    if (entry.isSymlink) {
      return { ok: false, code: "symlink" };
    }
    if (entry.method !== 0 && entry.method !== 8) {
      return { ok: false, code: "invalid_zip" };
    }

    const pv = pathViolation(entry.name);
    if (pv) {
      return { ok: false, code: pv };
    }

    if (entry.uncompressedSize > limits.maxUncompressedBytes) {
      return { ok: false, code: "compression_bomb" };
    }
    if (declaredTotal + entry.uncompressedSize > limits.maxUncompressedBytes) {
      return { ok: false, code: "compression_bomb" };
    }
    if (
      entry.compressedSize > 0 &&
      entry.uncompressedSize / entry.compressedSize > limits.maxCompressionRatio
    ) {
      return { ok: false, code: "compression_bomb" };
    }

    fileCount++;
    if (fileCount > limits.maxFiles) {
      return { ok: false, code: "too_many_files" };
    }

    declaredTotal += entry.uncompressedSize;
    pending.push(entry);
  }

  if (fileCount === 0) {
    return { ok: false, code: "empty_archive" };
  }

  const pathNorm = normalizeBundlePaths(pending.map((e) => e.name.replace(/\/$/, "")));
  if (!pathNorm.ok) {
    return { ok: false, code: pathNorm.code };
  }

  const files: { path: string; bytes: Uint8Array }[] = [];
  for (const entry of pending) {
    const inflated = inflateEntry(data, entry, limits);
    if (!inflated.ok) {
      return { ok: false, code: inflated.code };
    }
    const rawPath = entry.name.replace(/\/$/, "");
    const path = stripPrefix(rawPath, pathNorm.stripPrefix);
    if (path.includes("/..") || path.startsWith("..")) {
      return { ok: false, code: "path_traversal" };
    }
    files.push({ path, bytes: inflated.bytes });
  }

  const hasEntry = files.some((f) => f.path === "index.html");
  if (!hasEntry) {
    return { ok: false, code: "missing_index" };
  }

  return {
    ok: true,
    bundle: { files, entry: "index.html" },
  };
}
