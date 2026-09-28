// Storage（CORE）: 記録と設定の置き場の抽象（PC 版の「ファイルに保存」。Save・Settings はここだけを通す）
//
//   R.Storage.get(key) → 文字 | null     key は 'slot_s1'・'last'・'settings' など（接頭辞は付けない）
//   R.Storage.set(key, str) → true/false  R.Storage.remove(key)  R.Storage.keys() → [key]
//   R.Storage.init() → Promise            起動の最初に 1 回（main.js）。置き場を決め、デスクトップ版はファイルを先に全部読む
//   R.Storage.flush() → Promise            書きかけのファイルを待つ（閉じる前）
//   R.Storage.backend                      'desktop'（ファイル）| 'local'（ブラウザの localStorage）| 'memory'（どちらも無い）
//
// 置き場の順: window.chronicleDesktop（デスクトップ版の橋。desktop/preload.js）→ localStorage → メモリだけ。
//   橋 = {read(name) → 文字|null, write(name, text) → bool, list() → [name], remove(name)}（どれも値か Promise を返してよい）。
//   読むのは init の時にまとめて（手元の写しに入れる）。Save・Settings の API は同期のままで、書くのは写し＋橋へ（待たない）。
//   橋へ書けなかったときは localStorage にも残す（消えないように）。
// 引っ越し（版 1）: デスクトップ版を初めて起こしたとき、localStorage に前からある記録（同じ接頭辞）をファイルへ写す。
//   写したら 'storage_meta' に印を置き、2 回目からは写さない（消した記録がよみがえらない）。localStorage の方は消さない。
//   ブラウザ版はキーの名前も中身も前と同じ（luminous_chronicle_v2_<key>）なので、今までの記録はそのまま読める。
(function (R) {
  'use strict';
  const NAME = /^[a-z0-9_]{1,64}$/;
  const META = 'storage_meta';
  const SKIP = { tester: 1 };   // テスト用メニューの覚え（src/tester/ が localStorage に直に持つ）はファイルに写さない
  const mem = {};               // どこにも書けないときの置き場
  const cache = {};             // デスクトップ版の写し（init で埋める）
  const pending = new Set();
  let bridge = null;

  function ls() { try { return window.localStorage || null; } catch (e) { return null; } }
  function lsGet(k) { const s = ls(); try { return s ? s.getItem(R.SAVE_PREFIX + k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { const s = ls(); try { if (!s) return false; s.setItem(R.SAVE_PREFIX + k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { const s = ls(); try { if (s) s.removeItem(R.SAVE_PREFIX + k); } catch (e) { /* 消せない */ } }
  function lsKeys() {
    const s = ls(), out = [];
    try {
      if (!s) return out;
      const n = s.length;
      if (typeof n === 'number' && typeof s.key === 'function') {
        for (let i = 0; i < n; i++) { const k = s.key(i); if (k && k.indexOf(R.SAVE_PREFIX) === 0) out.push(k.slice(R.SAVE_PREFIX.length)); }
      } else for (const k of Object.keys(s)) if (k.indexOf(R.SAVE_PREFIX) === 0) out.push(k.slice(R.SAVE_PREFIX.length));
    } catch (e) { /* 読めない */ }
    return out;
  }
  const isP = (v) => v && typeof v.then === 'function';
  function track(p, what) {
    if (!isP(p)) return p;
    const q = Promise.resolve(p).catch((e) => { St.lastError = what + ': ' + (e && e.message || e); R.warn('[storage] ' + St.lastError); return false; });
    pending.add(q); q.then(() => pending.delete(q));
    return q;
  }
  function findBridge() {
    try {
      const b = typeof window !== 'undefined' ? window.chronicleDesktop : null;
      if (b && typeof b.read === 'function' && typeof b.write === 'function' && typeof b.list === 'function') return b;
    } catch (e) { /* */ }
    return null;
  }

  const St = (R.Storage = {
    backend: ls() ? 'local' : 'memory',
    lastError: null,
    migrated: 0,
    get(key) {
      if (bridge) return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null;
      const v = lsGet(key);
      if (v != null) return v;
      return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null;
    },
    set(key, v) {
      v = String(v);
      if (bridge) {
        if (!NAME.test(key)) { R.warn('[storage] bad key ' + key); return false; }
        cache[key] = v;
        let r;
        try { r = bridge.write(key, v); } catch (e) { r = false; St.lastError = 'write ' + key + ': ' + (e && e.message || e); }
        if (isP(r)) track(Promise.resolve(r).then((ok) => { if (ok === false) { lsSet(key, v); throw new Error('write refused'); } return ok; }), 'write ' + key);
        else if (r === false) { lsSet(key, v); R.warn('[storage] write failed, kept in browser storage: ' + key); }
        return true;
      }
      mem[key] = v;
      return lsSet(key, v) || St.backend === 'memory';
    },
    remove(key) {
      if (bridge) {
        delete cache[key];
        try { if (typeof bridge.remove === 'function') track(bridge.remove(key), 'remove ' + key); else track(bridge.write(key, ''), 'remove ' + key); } catch (e) { /* */ }
        return;
      }
      delete mem[key];
      lsDel(key);
    },
    keys() {
      if (bridge) return Object.keys(cache);
      const s = new Set(lsKeys());
      for (const k of Object.keys(mem)) s.add(k);
      return Array.from(s);
    },
    /** 置き場を決める。デスクトップの橋があればファイルを全部読み、初めてなら localStorage から引っ越す */
    async init(o) {
      o = o || {};
      const b = o.bridge !== undefined ? o.bridge : findBridge();
      if (!b) { bridge = null; St.backend = ls() ? 'local' : 'memory'; return St.backend; }
      let names = [];
      try { names = (await b.list()) || []; } catch (e) { R.warn('[storage] list failed, using browser storage', e); bridge = null; St.backend = ls() ? 'local' : 'memory'; return St.backend; }
      for (const k of Object.keys(cache)) delete cache[k];
      for (const n of names) {
        if (!NAME.test(n)) continue;
        try { const v = await b.read(n); if (v != null && v !== '') cache[n] = String(v); } catch (e) { R.warn('[storage] read failed: ' + n, e); }
      }
      bridge = b;
      St.backend = 'desktop';
      St.migrated = 0;
      if (!Object.prototype.hasOwnProperty.call(cache, META)) {
        for (const k of lsKeys()) {
          if (SKIP[k] || !NAME.test(k) || Object.prototype.hasOwnProperty.call(cache, k)) continue;
          const v = lsGet(k);
          if (v == null) continue;
          St.set(k, v); St.migrated++;
        }
        St.set(META, JSON.stringify({ ver: 1, from: St.migrated ? 'local' : 'none', n: St.migrated, t: Date.now() }));
      }
      return St.backend;
    },
    flush() { return Promise.all(Array.from(pending)).then(() => true); },
    /** テスト用: 橋を外してブラウザの置き場に戻す */
    _reset() { bridge = null; for (const k of Object.keys(cache)) delete cache[k]; St.backend = ls() ? 'local' : 'memory'; },
  });
})(window.RPG);
