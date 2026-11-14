'use strict';
/* 在 Node 里加载 assets/jiwan-catalog.js，复用它作为唯一数据源（GAMES/POSTS/AUTHORS + 筛选排序函数）。
   目录脚本原本是浏览器脚本，这里给一个最小 DOM/存储替身，只求它能安全求值。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CATALOG_PATH = path.join(__dirname, '..', 'assets', 'jiwan-catalog.js');

function fakeEl() {
  const noop = () => {};
  return {
    style: {}, dataset: {}, innerHTML: '', outerHTML: '', textContent: '', value: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, removeAttribute: noop,
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    insertAdjacentHTML: noop, querySelector: () => null, querySelectorAll: () => [],
    focus: noop, click: noop, closest: () => null
  };
}

function loadCatalog(file) {
  const target = file || CATALOG_PATH;
  const code = fs.readFileSync(target, 'utf8');
  const noop = () => {};
  const store = new Map();
  const sandbox = {
    console,
    document: {
      documentElement: {}, body: fakeEl(),
      addEventListener: noop, removeEventListener: noop,
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: fakeEl, createTextNode: fakeEl
    },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    navigator: { language: 'zh-CN', languages: ['zh-CN'] },
    location: { href: 'http://127.0.0.1/index.html', search: '', hash: '', pathname: '/index.html', origin: 'http://127.0.0.1' },
    history: { replaceState: noop, pushState: noop },
    setTimeout, clearTimeout, setInterval, clearInterval,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    alert: noop
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  /* 顶层 const 不会挂到 sandbox 上，迁移要拿英文/拼音表，末尾补一段显式导出 */
  const tail = "\n;(function(){try{globalThis.__EN = (typeof GAME_EN !== 'undefined') ? GAME_EN : null;globalThis.__PY = (typeof GAME_PINYIN !== 'undefined') ? GAME_PINYIN : null;}catch(e){}})();";
  vm.runInContext(code + tail, sandbox, { filename: 'jiwan-catalog.js' });

  const J = sandbox.JIWAN;
  if (!J || !Array.isArray(J.GAMES)) throw new Error('catalog: window.JIWAN.GAMES 未导出');
  Object.defineProperty(J, '__sandbox', { value: sandbox, enumerable: false });
  Object.defineProperty(J, '__en', { value: sandbox.__EN || {}, enumerable: false });
  Object.defineProperty(J, '__py', { value: sandbox.__PY || {}, enumerable: false });
  return J;
}

module.exports = { loadCatalog, CATALOG_PATH };
