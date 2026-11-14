#!/usr/bin/env node
/* 启动两份本地 wrangler dev（seed 测语义，jiwan 测主路径与数据），跑完全部测试并写出证据。 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import net from 'node:net';
import { injectTestPasswords } from './lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function reservePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close((err) => err ? reject(err) : resolve(port));
    });
    srv.on('error', reject);
  });
}
const evidence = path.join(root, 'evidence-cf');
fs.mkdirSync(evidence, { recursive: true });

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });
  if (r.status && !opts.allowFail) {
    const err = (r.stderr || r.stdout || '') + `\nexit ${r.status}`;
    throw new Error((cmd + ' ' + args.join(' ')).trim() + '\n' + err);
  }
  return r;
}

function waitHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (res.ok || res.status === 500) return resolve(true);
      } catch (e) { /* not up */ }
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for ' + url));
      setTimeout(tick, 300);
    };
    tick();
  });
}

function startWrangler(port, persist, inspectorPort) {
  const logFile = path.join(os.tmpdir(), `jiwan-wrangler-${port}.log`);
  const fd = fs.openSync(logFile, 'w');
  const child = spawn('npx', [
    'wrangler', 'dev', '--local',
    '--ip', '127.0.0.1',
    '--port', String(port),
    '--inspector-port', String(inspectorPort),
    '--live-reload', 'false',
    '--persist-to', persist
  ], {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', fd, fd],
    detached: true
  });
  child.logFile = logFile;
  child.persist = persist;
  child.port = port;
  child.unref();
  return child;
}

function stop(child) {
  if (!child || !child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch (e) {
    try { child.kill('SIGTERM'); } catch (e2) {}
  }
}

function sha256(file) {
  const buf = fs.readFileSync(file);
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  const seedPort = Number(process.env.JIWAN_SEED_PORT || 0) || await reservePort();
  const jiwanPort = Number(process.env.JIWAN_JIWAN_PORT || 0) || await reservePort();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'jiwan-cf-'));
  const seedPersist = path.join(work, 'seed');
  const jiwanPersist = path.join(work, 'jiwan');
  fs.mkdirSync(seedPersist);
  fs.mkdirSync(jiwanPersist);

  console.log('workspace', work);
  sh(process.execPath, [path.join(root, 'scripts/dump-sql.mjs')], { stdio: 'inherit' });
  sh(process.execPath, [path.join(root, 'scripts/import-local-d1.mjs'), 'seed', '--persist-to', seedPersist], { stdio: 'inherit' });
  sh(process.execPath, [path.join(root, 'scripts/import-local-d1.mjs'), 'jiwan', '--persist-to', jiwanPersist], { stdio: 'inherit' });
  const seedInjected = injectTestPasswords(seedPersist);
  const jiwanInjected = injectTestPasswords(jiwanPersist);
  console.log('injected test passwords', 'seed', seedInjected.users, 'jiwan', jiwanInjected.users);

  const unitLog = [];
  let exitCode = 0;
  let current = null;

  function runTest(file, env, title) {
    console.log('\n======== ' + title + ' ========');
    const r = sh(process.execPath, [path.join(root, 'worker/test', file)], {
      stdio: 'pipe',
      env: { ...process.env, ...env },
      allowFail: true
    });
    const text = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(text);
    unitLog.push('======== ' + title + ' ========', text.trim(), '');
    if (r.status) exitCode = 1;
    return r;
  }

  async function boot(port, persist, label) {
    const inspectorPort = await reservePort();
    const child = startWrangler(port, persist, inspectorPort);
    current = child;
    const base = `http://127.0.0.1:${port}`;
    const started = Date.now();
    console.log('waiting for', label, 'wrangler on', port, 'inspector', inspectorPort);
    while (Date.now() - started < 60000) {
      const log = fs.existsSync(child.logFile) ? fs.readFileSync(child.logFile, 'utf8') : '';
      if (/Address already in use|✘/.test(log) && !/ready/i.test(log)) {
        throw new Error(label + ' wrangler failed:\n' + log);
      }
      try {
        await waitHttp(base + '/health', 2000);
        console.log('ready', label, base);
        return { child, base };
      } catch (e) {
        if (Date.now() - started > 58000) throw e;
      }
    }
    throw new Error(label + ' wrangler did not become ready');
  }

  try {
    const seed = await boot(seedPort, seedPersist, 'seed');
    runTest('smoke.mjs', { JIWAN_TEST_BASE: seed.base, JIWAN_PERSIST: seedPersist }, 'smoke (seed)');
    runTest('client-test.mjs', { JIWAN_TEST_BASE: seed.base }, 'client (seed, empty BASE)');
    runTest('extra.mjs', { JIWAN_TEST_BASE: seed.base }, 'security (seed)');
    stop(seed.child);
    current = null;
    await new Promise((r) => setTimeout(r, 800));

    const jiwan = await boot(jiwanPort, jiwanPersist, 'jiwan');
    runTest('extra.mjs', { JIWAN_TEST_BASE: jiwan.base, JIWAN_PERSIST: jiwanPersist, JIWAN_TEST_MODE: 'jiwan' }, 'data (jiwan)');
    runTest('journey.mjs', {
      JIWAN_TEST_BASE: jiwan.base,
      JIWAN_TIMING_FILE: path.join(evidence, 'timings.json')
    }, 'journey + timings (jiwan)');
    stop(jiwan.child);
    current = null;
  } finally {
    if (current) stop(current);
    await new Promise((r) => setTimeout(r, 500));
  }

  const envTxt = [
    'node: ' + process.version,
    'wrangler: ' + (sh('npx', ['wrangler', '--version'], { encoding: 'utf8', allowFail: true }).stdout || '').trim(),
    'os: ' + os.type() + ' ' + os.release() + ' ' + os.arch(),
    'platform: ' + os.platform(),
    'note: 本环境是 Linux 验收机，不是 macOS。用户本机若是 macOS，请在 README 的环境一节对照。',
    'date: ' + new Date().toISOString()
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(evidence, 'env.txt'), envTxt);
  fs.writeFileSync(path.join(evidence, 'unit-tests.txt'), unitLog.join('\n') + '\n');
  const journey = unitLog.join('\n');
  fs.writeFileSync(path.join(evidence, 'main-path.txt'), journey.split('======== journey')[1] ? '======== journey' + journey.split('======== journey')[1] : journey);

  const files = fs.readdirSync(evidence).map((n) => path.join(evidence, n)).filter((f) => fs.statSync(f).isFile());
  const sums = files.filter((f) => path.basename(f) !== 'SHA256SUMS').sort()
    .map((f) => `${sha256(f)}  ${path.basename(f)}`).join('\n') + '\n';
  fs.writeFileSync(path.join(evidence, 'SHA256SUMS'), sums);

  console.log('\n证据已写入', evidence);
  console.log(sums);
  if (exitCode) process.exit(exitCode);
}

main().catch((e) => { console.error(e); process.exit(1); });
