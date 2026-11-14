/* 即玩 API 客户端：所有数据都来自后端（server/），本地只缓存会话与几个同步集合。
   没有 JIWAN_API_BASE 时会直接报错，不再有本地 mock —— 数据只有 SQLite 一份。 */
(function (J) {
  if (!J) return;

  const BASE = (typeof window.JIWAN_API_BASE === 'string' && window.JIWAN_API_BASE)
    || (function () { try { return localStorage.getItem('jiwan-api-base') || ''; } catch (e) { return ''; } })();

  const K = {
    session: 'jiwan-session',
    likes: 'jiwan-likes',
    favs: 'jiwan-favs',
    follows: 'jiwan-follows',
    unread: 'jiwan-unread'
  };

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  /* 旧版本可能把集合存成对象（{id:true}）或字符串，这里统一成数组，坏数据直接丢弃 */
  function idSet(key) {
    const v = load(key, []);
    if (Array.isArray(v)) return new Set(v.map(String));
    if (v && typeof v === 'object') return new Set(Object.keys(v).map(String));
    return new Set();
  }
  function saveSet(key, set) { save(key, [...set]); }

  function safeNext(raw) {
    if (typeof J.resolveNext === 'function') return J.resolveNext(raw);
    if (!raw) return 'index.html';
    try { raw = decodeURIComponent(raw); } catch (e) {}
    if (/^https?:/i.test(raw) || raw.startsWith('//') || raw.includes('..')) return 'index.html';
    if (!/^[a-z0-9._-]+\.html([?#].*)?$/i.test(raw)) return 'index.html';
    return raw;
  }
  function currentPage() {
    if (typeof J.currentPage === 'function') return J.currentPage();
    return (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash;
  }
  function takeReturn() {
    if (typeof J.takeReturn === 'function') return J.takeReturn();
    return '';
  }

  function session() { return load(K.session, null); }
  function meSync() { return session(); }
  function setSession(u) {
    if (!u) { try { localStorage.removeItem(K.session); } catch (e) {} return null; }
    const row = {
      id: u.id, name: u.name, handle: u.handle || u.id, bio: u.bio || '',
      game: u.game || '', avatar: u.avatar || '', role: u.role || ''
    };
    save(K.session, row);
    return row;
  }
  function isReviewer(u) {
    if (!u) return false;
    return u.role === 'reviewer' || u.id === 'lincheng';
  }

  const likes = () => idSet(K.likes);
  const favs = () => idSet(K.favs);
  const followIds = () => idSet(K.follows);
  function unreadCount() { return Number(load(K.unread, 0) || 0); }

  /* 游戏索引：byId 的同步查找靠它，任何一次 API 调用之前先把它拉下来 */
  let indexPromise = null;
  let people = [];
  function ensureIndex() {
    if (!BASE) return Promise.reject(Object.assign(new Error('未配置 JIWAN_API_BASE'), { code: 'no_base' }));
    if (!indexPromise) {
      indexPromise = fetch(BASE + '/games/index', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          people = Array.isArray(data.people) ? data.people : [];
          if (typeof J.setIndex === 'function') J.setIndex(data.items || []);
          return data;
        })
        .catch(err => { indexPromise = null; throw err; });
    }
    return indexPromise;
  }
  /* 上架 / 下架之后索引会变旧（架上列表要跟着变），这里丢缓存重新取一次 */
  function refreshIndex() {
    indexPromise = null;
    return ensureIndex();
  }
  function findUser(idOrName) {
    const s = String(idOrName || '');
    if (!s) return null;
    return people.find(u => u.id === s || u.handle === s || u.name === s) || null;
  }

  function fail(code, message) {
    const err = new Error(message || code);
    err.code = code;
    return Promise.reject(err);
  }

  async function req(method, path, body) {
    /* 空 id（/posts/、/games/、/users/）在服务端会被路由收敛成集合路径，
       返回体里没有 post/game/user。这里直接判 not_found，免得调用方拿到错形状的对象。 */
    if (/\/$/.test(path) || /\/\//.test(path)) return fail('not_found', 'missing id');
    await ensureIndex().catch(() => {});
    const res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || res.statusText || 'error');
      err.code = data.code || String(res.status);
      throw err;
    }
    return data;
  }

  /* 把服务端真值同步到本地：会话给导航用，几个 Set 给列表里的心形 / 关注态用 */
  function syncAfter(name, data) {
    if (!data) return;
    if (Object.prototype.hasOwnProperty.call(data, 'user')) setSession(data.user || null);
    if (name === 'logout') { setSession(null); save(K.unread, 0); return; }
    if (data.prev && typeof J.setRankPrev === 'function') J.setRankPrev(data.prev.map || {});
    if (name === 'likePost' && data.id != null) {
      const set = likes();
      if (data.liked) { set.add(data.id); set.add(Number(data.id)); }
      else { set.delete(data.id); set.delete(Number(data.id)); }
      saveSet(K.likes, set);
    }
    if (name === 'getPost' && data.post && typeof data.liked === 'boolean') {
      const set = likes();
      if (data.liked) set.add(data.post.id); else set.delete(data.post.id);
      saveSet(K.likes, set);
    }
    if (name === 'getHome' || name === 'getPosts' || name === 'search') {
      const items = name === 'getHome' ? (data.posts || [])
        : name === 'getPosts' ? (data.items || [])
          : (data.posts || []);
      if (items.length) {
        const set = likes();
        items.forEach(p => {
          if (!p || typeof p.liked !== 'boolean') return;
          if (p.liked) { set.add(p.id); set.add(Number(p.id)); }
          else { set.delete(p.id); set.delete(Number(p.id)); }
        });
        saveSet(K.likes, set);
      }
    }
    if (name === 'followGame' && data.id) {
      const set = favs();
      if (data.followed) set.add(data.id); else set.delete(data.id);
      saveSet(K.favs, set);
    }
    if (name === 'getGame' && data.game && typeof data.followed === 'boolean') {
      const set = favs();
      if (data.followed) set.add(data.game.id); else set.delete(data.game.id);
      saveSet(K.favs, set);
    }
    if (name === 'followUser' && data.id) {
      const set = followIds();
      if (data.followed) set.add(data.id); else set.delete(data.id);
      saveSet(K.follows, set);
    }
    if (name === 'getUser' && data.user && typeof data.following === 'boolean') {
      const set = followIds();
      if (data.following) set.add(data.user.id); else set.delete(data.user.id);
      saveSet(K.follows, set);
    }
    if (name === 'getNotifs' && Array.isArray(data.items)) save(K.unread, data.items.filter(n => !n.read).length);
    if (name === 'markNotifsRead') save(K.unread, 0);
    if (name === 'markNotifRead') save(K.unread, Math.max(0, unreadCount() - 1));
  }

  /* 表里存的是「路径构造函数」，避免在定义时就求值 */
  const E = encodeURIComponent;
  const idArg = a => (typeof a === 'object' && a ? (a.id || a.gameId || a.postId || '') : (a == null ? '' : a));
  const TABLE = {
    getHome: ['GET', () => '/home'],
    getGames: ['GET', () => '/games'],
    getGame: ['GET', a => '/games/' + E(idArg(a))],
    getRankings: ['GET', () => '/rankings'],
    search: ['GET', () => '/search'],
    getPosts: ['GET', () => '/posts'],
    getPost: ['GET', a => '/posts/' + E(idArg(a))],
    createPost: ['POST', () => '/posts'],
    updatePost: ['POST', a => '/posts/' + E(idArg(a))],
    deletePost: ['POST', a => '/posts/' + E(idArg(a)) + '/delete'],
    likePost: ['POST', a => '/posts/' + E(idArg(a)) + '/like'],
    addComment: ['POST', a => '/posts/' + E(idArg(a)) + '/comments'],
    updateComment: ['POST', a => '/comments/' + E(idArg(a))],
    deleteComment: ['POST', a => '/comments/' + E(idArg(a)) + '/delete'],
    report: ['POST', () => '/reports'],
    getReports: ['GET', () => '/reports'],
    dismissReport: ['POST', a => '/reports/' + E(idArg(a)) + '/dismiss'],
    hidePost: ['POST', a => '/posts/' + E(idArg(a)) + '/hide'],
    takedownGame: ['POST', a => '/games/' + E(idArg(a)) + '/takedown'],
    login: ['POST', () => '/auth/login'],
    register: ['POST', () => '/auth/register'],
    resetPassword: ['POST', () => '/auth/reset'],
    me: ['GET', () => '/me'],
    updateMe: ['POST', () => '/me'],
    changePassword: ['POST', () => '/me/password'],
    logout: ['POST', () => '/logout'],
    followGame: ['POST', a => '/games/' + E(idArg(a)) + '/follow'],
    review: ['POST', a => '/games/' + E(idArg(a)) + '/reviews'],
    deleteReview: ['POST', a => '/games/' + E(idArg(a)) + '/reviews/delete'],
    followUser: ['POST', a => '/users/' + E(idArg(a)) + '/follow'],
    getUser: ['GET', a => '/users/' + E(idArg(a))],
    submitPack: ['POST', () => '/workshop/packs'],
    updatePack: ['POST', a => '/workshop/packs/' + E(idArg(a))],
    reviewPack: ['POST', a => '/workshop/packs/' + E(idArg(a)) + '/review'],
    unlistPack: ['POST', a => '/workshop/packs/' + E(idArg(a)) + '/unlist'],
    resubmitPack: ['POST', a => '/workshop/packs/' + E(idArg(a)) + '/resubmit'],
    getWorkshopMine: ['GET', () => '/workshop/mine'],
    getWorkshopQueue: ['GET', () => '/workshop/queue'],
    recordPlay: ['POST', () => '/plays'],
    getNotifs: ['GET', () => '/notifs'],
    /* 后台（admin/reviewer） */
    adminStats: ['GET', () => '/admin/stats'],
    adminUsers: ['GET', () => '/admin/users'],
    adminSetUser: ['POST', a => '/admin/users/' + E(idArg(a))],
    adminResetPass: ['POST', a => '/admin/users/' + E(idArg(a)) + '/password'],
    adminPosts: ['GET', () => '/admin/posts'],
    adminDeletePost: ['POST', a => '/admin/posts/' + E(idArg(a)) + '/delete'],
    adminRestorePost: ['POST', a => '/admin/posts/' + E(idArg(a)) + '/restore'],
    adminGames: ['GET', () => '/admin/games'],
    adminSetGameSource: ['POST', a => '/admin/games/' + E(idArg(a))],
    adminRestoreGame: ['POST', a => '/admin/games/' + E(idArg(a)) + '/restore'],
    markNotifsRead: ['POST', () => '/notifs/read'],
    markNotifRead: ['POST', a => '/notifs/' + E(idArg(a)) + '/read']
  };

  function wrap(name) {
    const [method, build] = TABLE[name];
    return function (arg) {
      if (!BASE) return fail('no_base', '未配置 JIWAN_API_BASE');
      const path = build(arg);
      const q = (method === 'GET' && arg && typeof arg === 'object')
        ? path + '?' + new URLSearchParams(
          Object.entries(arg).filter(([, v]) => v != null && v !== '')
        ).toString()
        : path;
      const body = method === 'GET' ? undefined
        : (typeof arg === 'object' && arg ? arg : (name === 'recordPlay' ? { id: arg } : { id: arg }));
      return req(method, q, body).then(function (data) {
        try { syncAfter(name, data); } catch (e) { /* 本地缓存坏掉不该影响数据 */ }
        return data;
      });
    };
  }

  /* 启动：有本地会话就向服务端校正一次（Cookie 才是权威） */
  function reconcileSession() {
    if (!BASE || !session()) return;
    ensureIndex().catch(() => {});
    req('GET', '/me').then(function (data) {
      if (data && Object.prototype.hasOwnProperty.call(data, 'user')) setSession(data.user || null);
    }).catch(function () {});
  }

  const api = {
    base: BASE,
    meSync,
    unreadCount,
    findUser,
    followIds,
    favs,
    likes,
    isReviewer,
    safeNext,
    resolveNext: J.resolveNext || safeNext,
    rememberReturn: J.rememberReturn,
    takeReturn,
    currentPage,
    loadIndex: ensureIndex,
    refreshIndex: refreshIndex,
    requireAuth(next) {
      if (meSync()) return true;
      location.href = (J.loginHref || function (n) {
        return 'login.html?next=' + encodeURIComponent(n || currentPage());
      })(next);
      return false;
    }
  };
  Object.keys(TABLE).forEach(name => { api[name] = wrap(name); });

  J.api = api;
  if (typeof J.loginHref !== 'function') {
    J.loginHref = function (next) {
      return 'login.html?next=' + encodeURIComponent(next || currentPage());
    };
  }
  J.userHref = function (id) { return 'user.html?id=' + encodeURIComponent(id); };
  J.postHref = function (id) { return 'post.html?id=' + encodeURIComponent(id); };
  J.notifyHref = function () { return 'notify.html'; };

  reconcileSession();
})(window.JIWAN);
