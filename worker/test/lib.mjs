import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const assert_ = assert;
let pass = 0;
const fails = [];

export function resetResults() {
  pass = 0;
  fails.length = 0;
}
export function results() {
  return { pass, fails: fails.slice() };
}

export async function check(name, fn) {
  try {
    await fn();
    pass += 1;
    console.log("  ok  " + name);
  } catch (err) {
    fails.push({ name, err });
    console.log("  FAIL " + name + " :: " + (err && err.message));
  }
}

function parseSetCookie(list, jar) {
  for (const raw of list || []) {
    const kv = raw.split(";")[0];
    const i = kv.indexOf("=");
    if (i < 0) continue;
    const name = kv.slice(0, i).trim();
    const value = kv.slice(i + 1).trim();
    if (!value) delete jar[name];
    else jar[name] = value;
  }
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ");
}

export function createClient(base, origin) {
  const jar = Object.create(null);
  const site = origin || base;
  let primed = false;

  async function prime() {
    if (primed) return;
    primed = true;
    const res = await fetch(base + "/health", { headers: { Origin: site } });
    parseSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : [], jar);
  }

  async function call(method, path, body) {
    await prime();
    const headers = { Origin: site };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (jar.jiwan_csrf) headers["X-CSRF-Token"] = jar.jiwan_csrf;
    }
    if (cookieHeader(jar)) headers.Cookie = cookieHeader(jar);
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    parseSetCookie(res.headers.getSetCookie ? res.headers.getSetCookie() : [], jar);
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data, headers: res.headers, jar };
  }

  call.jar = jar;
  call.prime = prime;
  return call;
}

export function findD1File(persistDir) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(sqlite|db)$/i.test(name) && !name.includes("-shm") && !name.includes("-wal")) out.push(p);
    }
  }
  walk(persistDir);
  for (const f of out) {
    try {
      const db = new DatabaseSync(f, { readOnly: true });
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='games'").get();
      db.close();
      if (row) return f;
    } catch (e) { /* not a usable db */ }
  }
  return out[0] || "";
}

export function openQuery(persistDir) {
  const file = findD1File(persistDir);
  if (!file) throw new Error("local D1 sqlite not found under " + persistDir);
  const db = new DatabaseSync(file, { readOnly: true });
  return {
    file,
    get(sql, ...p) { return db.prepare(sql).get(...p) || null; },
    all(sql, ...p) { return db.prepare(sql).all(...p); },
    close() { db.close(); }
  };
}

export function summarize() {
  const total = pass + fails.length;
  console.log("\n" + (fails.length ? "FAILED " + fails.length + " / " + total : "ALL PASS " + pass));
  if (fails.length) {
    fails.forEach((f) => console.log("\n--- " + f.name + "\n" + (f.err && f.err.stack)));
  }
  return { pass, fail: fails.length, total, names: fails.map((f) => f.name) };
}
