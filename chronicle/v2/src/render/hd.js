// RENDER: R.Hd — 絵の登録簿・取り出し・描き方・効果の質・量の数え方。V2_PLAN §2.5.5・§2.11
//   R.Hd.def(key, factory, meta)   factory(opts, key) → Sheet | K.bakeJob（大きい絵を切れ端で）| null（まだ焼けない）
//   R.Hd.get(key, opts)            焼けていれば Sheet、無ければ null を返して列へ（毎フレーム呼んでよい）
//   R.Hd.now(key, opts)            同期で焼く（暗転中・戦闘の開始だけ）
//   R.Hd.draw(g, frame, x, y, {flip, alpha, tint, tintAmt, scale})   (x, y) = 描く点。コマの (ox, oy) をそこに合わせ、整数に丸める
// 足した物（契約の外。使ってよいが、無くても困らない形で）: redef・meta・keys・forget・pinned・frameAt・RZ（rz.js）・autoQuality
(function (R) {
  'use strict';
  // この 4 つの名前空間は RENDER が全部持つ（仮の実装で穴を埋めない。V2_PLAN §2.11）
  R.Stubs.claim('Hd');
  R.Stubs.claim('Light');
  R.Stubs.claim('Post');
  R.Stubs.claim('Sky');

  const Hd = (R.Hd = R.Hd || {});
  const S = (Hd._s = Hd._s || {});
  S.defs = S.defs || {};
  S.auto = S.auto || null;   // 自動の下げ（'low'）。設定 fx は書き換えない

  /** キャッシュのキー（opts は短い JSON。キーの順は呼ぶ側で揃える） */
  Hd._ck = function (key, opts) {
    if (!opts) return key;
    let empty = true;
    for (const k in opts) { if (opts[k] !== undefined) { empty = false; break; } }
    return empty ? key : key + '|' + JSON.stringify(opts);
  };
  Hd._def = function (key) { return S.defs[key] || null; };

  /** 登録。同じキーを 2 回登録したら警告して上書きしない（§2.4） */
  Hd.def = function (key, factory, meta) {
    if (typeof key !== 'string' || typeof factory !== 'function') { R.loadErrors.push(`bad R.Hd.def ${key}`); return false; }
    if (S.defs[key]) { const m = `duplicate R.Hd.def ${key} (ignored)`; R.loadErrors.push(m); if (typeof console !== 'undefined') console.warn('[RPG]', m); return false; }
    S.defs[key] = { factory, meta: meta || {} };
    return true;
  };
  /** 登録の差し替え（同じ担当が「空の登録」を中身に替える・原画が届いて画像から作り直す）。焼いた物は捨てる */
  Hd.redef = function (key, factory, meta) {
    S.defs[key] = { factory, meta: meta || (S.defs[key] && S.defs[key].meta) || {} };
    Hd.forget(key);
    if (S.failed) for (const ck of Array.from(S.failed.keys())) if (ck === key || ck.startsWith(key + '|')) S.failed.delete(ck);
    return true;
  };
  Hd.has = function (key) { return !!S.defs[key]; };
  Hd.meta = function (key) { const d = S.defs[key]; return d ? d.meta : null; };
  /** 登録のキーの一覧（接頭辞で絞る。'hd:mon:' など） */
  Hd.keys = function (prefix) { return Object.keys(S.defs).filter((k) => !prefix || k.startsWith(prefix)).sort(); };

  Hd.get = function (key, opts) {
    const ck = Hd._ck(key, opts);
    const sh = Hd._take(ck);
    if (sh) return sh;
    if (S.defs[key]) Hd.want(key, opts, 0);
    return null;
  };
  Hd.now = function (key, opts) {
    const ck = Hd._ck(key, opts);
    return Hd._take(ck) || Hd._bakeNow(key, opts, ck);
  };
  Hd.ready = function (key, opts) { return Hd._has(Hd._ck(key, opts)); };

  /** 版 2: 'hd:bld:xx' → 'prop' など（R.Contract.HD_KINDS）。stats().byKind の名前 */
  Hd.kindOf = function (key) {
    const k = String(key).split(':')[1];
    const map = (R.Contract && R.Contract.HD_KINDS) || {};
    return map[k] || k || 'other';
  };

  // ------------------------------------------------------------------ 描く
  const tints = new WeakMap();   // canvas → Map(tint|amt → canvas)
  function tinted(c, tint, amt) {
    let m = tints.get(c);
    if (!m) { m = new Map(); tints.set(c, m); }
    const k = tint + '|' + amt;
    let t = m.get(k);
    if (!t) {
      t = Hd.RZ.canvas(c.width, c.height);
      const x = t.getContext('2d');
      x.drawImage(c, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.globalAlpha = Math.max(0, Math.min(1, amt));
      x.fillStyle = tint;
      x.fillRect(0, 0, c.width, c.height);
      m.set(k, t);
      if (m.size > 16) m.delete(m.keys().next().value);
    }
    return t;
  }

  /**
   * コマを描く。frame = {c, ox, oy}（Sheet を渡したら o.i 番目のコマ）。(x, y) = 描く点（足元の中央など）。
   * o = {flip（描く点を軸に左右反転）, alpha, tint:'#rrggbb', tintAmt:0..1（被弾の白・毒の緑など。金色は焼くときの opts）, scale（縮小だけ。1 以下）}
   */
  Hd.draw = function (g, frame, x, y, o) {
    if (!frame) return;
    if (frame.frames) frame = frame.frames[(o && o.i) | 0];
    if (!frame || !frame.c) return;
    let c = frame.c;
    const ox = frame.ox || 0, oy = frame.oy || 0;
    if (!o) { g.drawImage(c, Math.round(x - ox), Math.round(y - oy)); return; }
    if (o.tint && o.tintAmt > 0) c = tinted(c, o.tint, o.tintAmt);
    const a0 = g.globalAlpha;
    if (o.alpha != null) g.globalAlpha = a0 * o.alpha;
    const s = o.scale && o.scale > 0 && o.scale < 1 ? o.scale : 1;
    const rx = Math.round(x), ry = Math.round(y);
    if (o.flip) {
      g.save();
      g.translate(rx, ry);
      g.scale(-1, 1);
      if (s === 1) g.drawImage(c, -ox, -oy); else g.drawImage(c, -ox * s, -oy * s, c.width * s, c.height * s);
      g.restore();
    } else if (s === 1) g.drawImage(c, rx - ox, ry - oy);
    else g.drawImage(c, Math.round(x - ox * s), Math.round(y - oy * s), Math.round(c.width * s), Math.round(c.height * s));
    g.globalAlpha = a0;
  };

  /** ポーズのコマを時刻から選ぶ（fps は sheet.fps[pose]、無ければ 8）。→ コマ | null */
  Hd.frameAt = function (sheet, pose, t) {
    if (!sheet || !sheet.frames) return null;
    const list = (sheet.poses && sheet.poses[pose]) || (sheet.poses && sheet.poses.idle) || [0];
    const fps = (sheet.fps && sheet.fps[pose]) || 8;
    const i = list[Math.floor(((t || 0) / 1000) * fps) % list.length] | 0;
    return sheet.frames[i] || sheet.frames[0] || null;
  };

  // ------------------------------------------------------------------ 効果の質
  const RANK = { off: 0, low: 1, high: 2 };
  /** 設定「効果」と自動の下げの低い方（設定は書き換えない）。'high'|'low'|'off' */
  Hd.quality = function () {
    let q = 'high';
    try { q = (R.Settings && R.Settings.get && R.Settings.get('fx')) || 'high'; } catch (e) { q = 'high'; }
    if (RANK[q] == null) q = 'high';
    if (S.auto && RANK[S.auto] < RANK[q]) q = S.auto;
    return q;
  };
  /** 自動の下げの今の値（null か 'low'）。null を渡すと戻す（テスト・設定の画面で「効果」を選び直したとき） */
  Hd.autoQuality = function (v) { if (v !== undefined) S.auto = v; return S.auto; };

  // 最初の戦闘の 120 フレームの平均が 14 ms を超えたら自動で low（ART_REWORK §1.5.3、§2.11 の「仕上げ」）
  R.onBoot(function () {
    if (!R.on || !R.Engine) return;
    const A = (Hd.BUDGET && Hd.BUDGET.autoLow) || { frames: 120, avgMs: 14 };
    let watching = false, measured = false, startFrame = 0;
    R.on('battle:start', () => {
      if (measured) return;
      watching = true;
      startFrame = R.Engine.frame;
      if (R.Engine.resetStats) R.Engine.resetStats();
    });
    R.on('battle:end', () => { watching = false; });
    if (R.Engine.addTick) R.Engine.addTick(() => {
      if (!watching || measured) return;
      if (R.Engine.frame - startFrame < A.frames) return;
      measured = true; watching = false;
      const st = R.Engine.frameStats ? R.Engine.frameStats() : null;
      if (st && st.n >= A.frames * 0.5 && st.avg > A.avgMs) S.auto = 'low';
    });
  });

  // ------------------------------------------------------------------ 量
  /** {bytes, byKind, queue, bakedMs:{kind:[avg, max]}}（K.hdStats）＋ 足した物 {mine, tracked, entries, pinned, over, evicted, pumpMs, limits} */
  Hd.stats = function () {
    const byKind = {};
    let mine = 0, entries = 0, pinnedN = 0;
    for (const e of S.entries.values()) { byKind[e.kind] = (byKind[e.kind] || 0) + e.bytes; mine += e.bytes; entries++; if (S.pins.has(e.key)) pinnedN++; }
    let tracked = 0;
    for (const k of Object.keys(S.tracked)) for (const id of Object.keys(S.tracked[k])) { byKind[k] = (byKind[k] || 0) + S.tracked[k][id]; tracked += S.tracked[k][id]; }
    const bakedMs = {};
    for (const k of Object.keys(S.baked || {})) { const b = S.baked[k]; bakedMs[k] = [b.n ? +(b.sum / b.n).toFixed(3) : 0, +b.max.toFixed(3)]; }
    return {
      bytes: mine + tracked, byKind, queue: S.queue ? S.queue.length : 0, bakedMs,
      mine, tracked, entries, pinned: pinnedN, over: S.over || 0, evicted: S.evicted || 0,
      pumpMs: S.pumpMs ? { last: +S.pumpMs.last.toFixed(3), max: +S.pumpMs.max.toFixed(3) } : { last: 0, max: 0 },
    };
  };
})(window.RPG);
