// RENDER: 焼いた絵のキャッシュ（種類ごとの上限と LRU、pin）と、R.Hd の外で持つ焼いた絵の量の届け出（track）。V2_PLAN §2.10
// 上限は R.Hd.BUDGET.mb（MB）。人（field・btl）・魔物とボス（mon・boss）・物と効果（prop・fx）は組で上限を共有する（R.Hd.BUDGET_SHARE）。
// 合計（自分の分＋track の分）が BUDGET.mb.total を超えたら、自分の分の古い物から捨てる。pin したキーは捨てない。
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});
  const S = (Hd._s = Hd._s || {});
  S.entries = S.entries || new Map();   // ck → {ck, key, kind, sheet, bytes, used}
  S.pins = S.pins || new Map();         // key → 回数（pin を 2 回したら unpin も 2 回）
  S.tracked = S.tracked || {};          // kind → {id: bytes}
  S.bytesMine = S.bytesMine || 0;
  S.tick = S.tick || 0;
  S.evicted = S.evicted || 0;

  const MB = 1024 * 1024;
  function group(kind) { return (Hd.BUDGET_SHARE && Hd.BUDGET_SHARE[kind]) || kind; }
  function limitOf(kind) {
    const mb = (Hd.BUDGET && Hd.BUDGET.mb) || {};
    return (mb[kind] != null ? mb[kind] : mb.fx != null ? mb.fx : 20) * MB;
  }

  /** Sheet（またはコマ・canvas）が持つ画素のバイト（同じ canvas は 1 回だけ数える）。幅 × 高さ × 4 */
  function bytesOf(sheet) {
    if (!sheet) return 0;
    const seen = new Set();
    let n = 0;
    const add = (c) => { if (c && !seen.has(c) && c.width) { seen.add(c); n += c.width * c.height * 4; } };
    if (sheet.width && sheet.height && !sheet.frames) add(sheet);
    else if (sheet.c) add(sheet.c);
    if (Array.isArray(sheet.frames)) for (const f of sheet.frames) if (f) add(f.c || f);
    return n;
  }
  Hd._bytesOf = bytesOf;

  function groupBytes(g) {
    let n = 0;
    for (const e of S.entries.values()) if (group(e.kind) === g) n += e.bytes;
    return n;
  }
  function trackedTotal() {
    let n = 0;
    for (const k of Object.keys(S.tracked)) for (const id of Object.keys(S.tracked[k])) n += S.tracked[k][id];
    return n;
  }
  function pinned(e) { return S.pins.has(e.key); }

  /** 捨てる（古い順。pin は残す）。kind を渡すとその組だけ */
  function evict(needGroup, over, skip) {
    for (const e of S.entries.values()) {
      if (over <= 0) break;
      if (pinned(e) || e.ck === skip) continue;
      if (needGroup && group(e.kind) !== needGroup) continue;
      S.entries.delete(e.ck);
      S.bytesMine -= e.bytes;
      S.evicted++;
      over -= e.bytes;
    }
  }
  function enforce(kind, skip) {
    const g = group(kind);
    const over = groupBytes(g) - limitOf(kind);
    if (over > 0) evict(g, over, skip);
    const total = ((Hd.BUDGET && Hd.BUDGET.mb && Hd.BUDGET.mb.total) || 150) * MB;
    const over2 = S.bytesMine + trackedTotal() - total;
    if (over2 > 0) evict(null, over2, skip);
  }

  /** 焼けた絵を入れる（bake.js と hd.js の now が呼ぶ） */
  Hd._put = function (ck, key, sheet) {
    const old = S.entries.get(ck);
    if (old) { S.entries.delete(ck); S.bytesMine -= old.bytes; }
    const e = { ck, key, kind: Hd.kindOf(key), sheet, bytes: bytesOf(sheet), used: S.tick };
    S.entries.set(ck, e);
    S.bytesMine += e.bytes;
    enforce(e.kind, ck);
    return sheet;
  };
  /** 取り出す（使った印を付けて LRU の後ろへ） */
  Hd._take = function (ck) {
    const e = S.entries.get(ck);
    if (!e) return null;
    if (e.used !== S.tick) { e.used = S.tick; S.entries.delete(ck); S.entries.set(ck, e); }
    return e.sheet;
  };
  Hd._has = function (ck) { return S.entries.has(ck); };

  /** LRU で消さない（出撃中の 4 人の戦闘の絵など）。opts の違う物もすべて */
  Hd.pin = function (key) { S.pins.set(key, (S.pins.get(key) || 0) + 1); };
  Hd.unpin = function (key) {
    const n = (S.pins.get(key) || 0) - 1;
    if (n > 0) S.pins.set(key, n); else S.pins.delete(key);
  };
  Hd.pinned = function (key) { return S.pins.has(key); };

  /** キーの焼いた物を全部捨てる（装備を替えた・原画が届いた、など。登録は残る） */
  Hd.forget = function (key) {
    for (const e of Array.from(S.entries.values())) if (e.key === key || (key.endsWith('*') && e.key.startsWith(key.slice(0, -1)))) { S.entries.delete(e.ck); S.bytesMine -= e.bytes; }
  };

  /** 版 2: R.Hd の外で持つ焼いた絵（FIELD のチャンク・UIK のすりガラス）の量を届ける。bytes = null で消す */
  Hd.track = function (kind, id, bytes) {
    const t = (S.tracked[kind] = S.tracked[kind] || {});
    if (bytes == null) delete t[id]; else t[id] = +bytes || 0;
    if (bytes != null) enforce(kind);
  };

  /** キャッシュの中身の一覧（hd_perf.js・テスト用） */
  Hd._entries = function () { return Array.from(S.entries.values()).map((e) => ({ ck: e.ck, key: e.key, kind: e.kind, bytes: e.bytes, pinned: pinned(e) })); };
  Hd._trackedTotal = trackedTotal;
  Hd._limitOf = limitOf;
  Hd._group = group;
})(window.RPG);
