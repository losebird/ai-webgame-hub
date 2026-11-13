import assert from "node:assert/strict";
import { test } from "node:test";
import { zipSync, strToU8 } from "fflate";
import {
  acceptUpload,
  DEFAULT_LIMITS,
  type QuarantineLimits,
  type RawUpload,
} from "./gate.js";

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Minimal stored entry zip whose central-directory metadata is fully controlled. */
function craftStoredZip(
  entries: {
    name: string;
    data: Uint8Array;
    declaredUncompressed?: number;
    externalAttrs?: number;
  }[],
): Uint8Array {
  const locals: Uint8Array[] = [];
  const cds: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = strToU8(e.name);
    const data = e.data;
    const comp = data.length;
    const uncomp = e.declaredUncompressed ?? comp;
    const ext = e.externalAttrs ?? 0;

    const lfh = concat(
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(comp),
      u32(uncomp),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    );
    locals.push(lfh);

    const cd = concat(
      u32(0x02014b50),
      u16(0x031e),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(comp),
      u32(uncomp),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(ext),
      u32(offset),
      nameBytes,
    );
    cds.push(cd);
    offset += lfh.length;
  }

  const cdBlob = concat(...cds);
  const localBlob = concat(...locals);
  const cdOffset = localBlob.length;
  const eocd = concat(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(cdBlob.length),
    u32(cdOffset),
    u16(0),
  );

  return concat(localBlob, cdBlob, eocd);
}

const tinyLimits: QuarantineLimits = {
  maxCompressedBytes: DEFAULT_LIMITS.maxCompressedBytes,
  maxFiles: 3,
  maxUncompressedBytes: 1024,
  maxCompressionRatio: 100,
};

test("single html accepted as index.html", () => {
  const html = strToU8("<!doctype html><title>x</title>");
  const r = acceptUpload({ kind: "html", filename: "game.HTML", bytes: html });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.bundle.entry, "index.html");
    assert.equal(r.bundle.files.length, 1);
    assert.equal(r.bundle.files[0]!.path, "index.html");
    assert.deepEqual(r.bundle.files[0]!.bytes, html);
  }
});

test("zip with root index.html accepted", () => {
  const zip = zipSync({ "index.html": strToU8("<html></html>") });
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.bundle.files[0]!.path, "index.html");
  }
});

test("zip with one folder containing index.html plus js/app.js", () => {
  const zip = zipSync({
    "game/index.html": strToU8("<html></html>"),
    "game/js/app.js": strToU8("console.log(1)"),
  });
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, true);
  if (r.ok) {
    const paths = r.bundle.files.map((f) => f.path).sort();
    assert.deepEqual(paths, ["index.html", "js/app.js"]);
  }
});

test("root index.html plus nested css and js is accepted", () => {
  const zip = zipSync({
    "index.html": strToU8("<html></html>"),
    "css/game.css": strToU8("body{}"),
    "js/game.js": strToU8("console.log(1)"),
  });
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, true);
  if (r.ok) {
    const paths = r.bundle.files.map((f) => f.path).sort();
    assert.deepEqual(paths, ["css/game.css", "index.html", "js/game.js"]);
  }
});

test("missing index.html", () => {
  const zip = zipSync({ "readme.txt": strToU8("hi") });
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "missing_index");
});

test("two different top-level folders and no root index.html", () => {
  const zip = zipSync({
    "a/index.html": strToU8("<html></html>"),
    "b/x.txt": strToU8("x"),
  });
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "missing_index");
});

test("entry named ../x → path_traversal", () => {
  const zip = craftStoredZip([
    { name: "../x", data: strToU8("x") },
    { name: "index.html", data: strToU8("<html></html>") },
  ]);
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "path_traversal");
});

test("entry named /etc/passwd → absolute_path", () => {
  const zip = craftStoredZip([
    { name: "/etc/passwd", data: strToU8("root") },
    { name: "index.html", data: strToU8("<html></html>") },
  ]);
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "absolute_path");
});

test("symlink entry", () => {
  const zip = craftStoredZip([
    {
      name: "link",
      data: strToU8("index.html"),
      externalAttrs: 0xa000 << 16,
    },
    { name: "index.html", data: strToU8("<html></html>") },
  ]);
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "symlink");
});

test("declared uncompressed size over the cap → compression_bomb", () => {
  const zip = craftStoredZip([
    {
      name: "index.html",
      data: strToU8("x"),
      declaredUncompressed: 50 * 1024 * 1024,
    },
  ]);
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip }, tinyLimits);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "compression_bomb");
});

test("too many files", () => {
  const files: Record<string, Uint8Array> = { "index.html": strToU8("<html></html>") };
  for (let i = 0; i < 5; i++) {
    files[`f${i}.txt`] = strToU8("a");
  }
  const zip = zipSync(files);
  const r = acceptUpload({ kind: "zip", filename: "a.zip", bytes: zip }, tinyLimits);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "too_many_files");
});

test("renamed zip uploaded as html is not_html", () => {
  const zip = zipSync({ "index.html": strToU8("<html></html>") });
  const r = acceptUpload({ kind: "html", filename: "game.html", bytes: zip });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "not_html");
});

test("bad html filename", () => {
  const r = acceptUpload({
    kind: "html",
    filename: "game.txt",
    bytes: strToU8("<html></html>"),
  } satisfies RawUpload);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "bad_html_name");
});

test("oversized html", () => {
  const limits: QuarantineLimits = {
    ...DEFAULT_LIMITS,
    maxCompressedBytes: 8,
  };
  const r = acceptUpload(
    {
      kind: "html",
      filename: "index.html",
      bytes: strToU8("0123456789"),
    },
    limits,
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "html_too_large");
});
