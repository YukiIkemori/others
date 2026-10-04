// CONTENT-F: マップを組み立てる小道具（フェルン・迷いの森・千年樹・ユラ・きこりの休み小屋。V2_PLAN §2.6.1）
//   R.ContentF.kit: grid / put / rect / hline / vline / path / blob / border / stamp / at / rows / def
//                   scatter（空いたマスに物を散らす。同じ種なら同じ置き方）/ room（屋内の箱）
//                   prop / chest / spring / sign / exam / stairs / npc / lines（物と人の短い書き方）
//   各マップのファイルは R.onData(() => …) の中で組み立てる（読み込みの順に依らない。§2.4）。
//   同じ名前空間の小道具を CONTENT-P も持つ（R.ContentP.kit）が、担当ごとにファイルを分けるため別に置く。
(function (R) {
  'use strict';
  const C = (R.ContentF = R.ContentF || {});
  const K = (C.kit = C.kit || {});
  const SCATTERED = new WeakSet();   // scatter が置いた物（K.fit が壁の上の物を除く）

  K.grid = function (w, h, ch) { const a = []; for (let y = 0; y < h; y++) a.push(new Array(w).fill(ch)); return a; };
  K.at = function (g, x, y) { return g[y] ? g[y][x] : undefined; };
  K.put = function (g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch; };
  K.rect = function (g, x, y, w, h, ch, only) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (!only || only.includes(K.at(g, i, j))) K.put(g, i, j, ch);
  };
  K.hline = function (g, x0, x1, y, ch) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) K.put(g, x, y, ch); };
  K.vline = function (g, x, y0, y1, ch) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) K.put(g, x, y, ch); };
  K.border = function (g, ch, t) { const h = g.length, w = g[0].length, n = t || 1; K.rect(g, 0, 0, w, n, ch); K.rect(g, 0, h - n, w, n, ch); K.rect(g, 0, 0, n, h, ch); K.rect(g, w - n, 0, n, h, ch); };
  /** 折れ線（横 → 縦の順に歩く）を幅 wd で塗る。only を渡すとその字の上だけ */
  K.path = function (g, pts, ch, wd, only) {
    const n = wd || 1;
    for (let i = 0; i < pts.length - 1; i++) {
      let [x, y] = pts[i]; const [x2, y2] = pts[i + 1];
      K.rect(g, x, y, n, n, ch, only);
      while (x !== x2 || y !== y2) {
        if (x !== x2) x += Math.sign(x2 - x); else y += Math.sign(y2 - y);
        K.rect(g, x, y, n, n, ch, only);
      }
    }
  };
  /** 楕円の塊（縁は種で決まるゆらぎ。同じ種なら同じ形） */
  K.blob = function (g, cx, cy, rx, ry, ch, seed, only) {
    const rng = R.rng('cf_blob:' + seed);
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
      const r = rng.next();
      if (d < 1 - r * 0.22 && (!only || only.includes(K.at(g, x, y)))) K.put(g, x, y, ch);
    }
  };
  /**
   * 道の縁をやわらげる: wall の字のうち、歩ける字（walk）に接するマスを確率 p で verge の字に変える。
   * 別の道どうしをつながないよう、向かい合う 2 方向（上下・左右・斜めの対）の両方に歩ける字があるマスは変えない
   * （変えたマスはその場で歩ける字として数えるので、厚さ 2 の壁も抜けない）。外周 1 マスと keep の中は変えない。
   */
  K.soften = function (g, wall, walk, verge, p, seed, keep) {
    const rng = R.rng('cf_soften:' + seed);
    const h = g.length, w = g[0].length;
    const isW = (x, y) => { const c = K.at(g, x, y); return c != null && walk.includes(c); };
    const orig = g.map((r) => r.slice());
    const wasW = (x, y) => { const c = orig[y] && orig[y][x]; return c != null && walk.includes(c); };
    const OPP = [[[0, -1], [0, 1]], [[-1, 0], [1, 0]], [[-1, -1], [1, 1]], [[1, -1], [-1, 1]], [[0, -1], [1, 1]], [[0, -1], [-1, 1]], [[0, 1], [1, -1]], [[0, 1], [-1, -1]], [[-1, 0], [1, 1]], [[-1, 0], [1, -1]], [[1, 0], [-1, 1]], [[1, 0], [-1, -1]]];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!wall.includes(g[y][x]) || (keep && keep.has(x + ',' + y))) continue;
      if (!(wasW(x - 1, y) || wasW(x + 1, y) || wasW(x, y - 1) || wasW(x, y + 1))) continue;
      if (OPP.some(([a, b]) => isW(x + a[0], y + a[1]) && isW(x + b[0], y + b[1]))) continue;
      if (rng.next() < p) g[y][x] = Array.isArray(verge) ? verge[rng.int(0, verge.length - 1)] : verge;
    }
  };
  /** 文字の絵を (x, y) に置く（' ' はそのまま） */
  K.stamp = function (g, x, y, art) { art.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ' ') K.put(g, x + i, y + j, ch); })); };
  K.rows = function (g) { return g.map((r) => r.join('')); };
  /**
   * 描いた一枚絵に当たりを合わせる: fit = { 字: 'x,y x,y …' }（その字に置き換えるマス）。組み立ての最後（散らしのあと）に呼ぶ。
   * 絵が下書きからずれた所（壁の立ち上がり・描き足した大木・広がった床）を直す。マスの一覧は絵の床の割合から拾い、目で確かめた物
   * （持ち主 2026-09-28「壁際の下のほうが判定おかしくて、壁にめり込んでる」「上の判定も右の判定もおかしい」）。
   * objs を渡すと、壁になったマスに落ちた散らしの小物（scatter の物・painted に無い物）を除く（木や壁の上に小物を浮かせない）
   */
  /** 物を (x, y) へ動かす（match の鍵がみな等しい最初の物）。散らしのあとに動かす（前に動かすと散らしの置き方が変わり、絵の小物とずれる） */
  K.moveTo = function (objs, match, x, y) {
    const o = objs.find((ob) => Object.keys(match).every((k) => ob[k] === match[k]));
    if (!o) { R.warn && R.warn('ContentF.kit.moveTo: no object ' + JSON.stringify(match)); return; }
    o.x = x; o.y = y;
  };
  K.fit = function (g, fit, objs, painted) {
    const solidNow = new Set();
    for (const ch of Object.keys(fit)) {
      for (const p of fit[ch].trim().split(/\s+/)) {
        if (!p) continue;
        const [x, y] = p.split(',').map(Number);
        K.put(g, x, y, ch);
        solidNow.add(x + ',' + y + ':' + ch);
      }
    }
    if (!objs) return;
    const pset = new Set((painted || []).map((s) => s.split('@')[1]));
    const walls = new Set([...solidNow].filter((k) => /[FTbBR~]$/.test(k)).map((k) => k.split(':')[0]));
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (SCATTERED.has(o) && walls.has(o.x + ',' + o.y) && !pset.has(o.x + ',' + o.y)) objs.splice(i, 1);
    }
  };

  /** マップを登録（rows が配列の配列なら文字列にし、w・h を数える） */
  K.def = function (id, m) {
    m.id = id;
    if (Array.isArray(m.rows) && Array.isArray(m.rows[0])) m.rows = K.rows(m.rows);
    m.h = m.rows.length; m.w = [...m.rows[0]].length;
    R.def('maps', id, m);
    return m;
  };

  /** 物が占めるマス（建物 w×h・泉 2×2・ほかは 1） */
  function cellsOf(o) {
    const w = o.type === 'spring' ? 2 : o.w || 1, h = o.type === 'spring' ? 2 : o.h || 1;
    const out = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push((o.x + i) + ',' + (o.y + j));
    return out;
  }
  K.cellsOf = cellsOf;
  /**
   * 空いたマスに物を散らす: g の字が on に含まれ、ほかの物・人・keep（'x,y' の集合）と重ならず、
   * 同じ散らしの物どうしが gap マス以上離れる所へ n 個。→ 置いた物の配列（objs に足す）
   * o.roomy = 歩ける字の文字列: まわり 2 マス（5×5）がどれもその字で、ほかの物も無い広い所にだけ置く（ダンジョンの当たる小物が
   *   通路をふさいだり、壁や物との間に 1 マスのすきまを残したりしない。持ち主 2026-09-28「通路真ん中にはおかないで」）
   */
  K.scatter = function (g, objs, id, n, area, on, seed, o) {
    o = o || {};
    const gap = o.gap == null ? 2 : o.gap;
    const used = new Set();
    for (const ob of objs) if (ob.x != null) for (const c of cellsOf(ob)) used.add(c);
    for (const nn of o.npcs || []) used.add(nn.x + ',' + nn.y);
    const keep = o.keep || new Set();
    const rng = R.rng('cf_scatter:' + seed);
    const [ax, ay, aw, ah] = area;
    const out = [];
    const roomyAt = (x, y) => {
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
        const c = K.at(g, x + i, y + j);
        if (c == null || !o.roomy.includes(c) || used.has((x + i) + ',' + (y + j))) return false;
      }
      return true;
    };
    let tries = 0;
    while (out.length < n && tries++ < n * 80) {
      const x = ax + rng.int(0, aw - 1), y = ay + rng.int(0, ah - 1);
      const k = x + ',' + y;
      if (used.has(k) || keep.has(k) || !on.includes(K.at(g, x, y))) continue;
      if (out.some((p) => Math.abs(p.x - x) < gap && Math.abs(p.y - y) < gap)) continue;
      if (o.roomy && !roomyAt(x, y)) continue;
      const p = Object.assign({ type: 'prop', id: Array.isArray(id) ? id[rng.int(0, id.length - 1)] : id, x, y }, o.extra || {});
      if (o.variant) p.variant = rng.int(0, 3);
      out.push(p); used.add(k); SCATTERED.add(p);
    }
    objs.push(...out);
    return out;
  };

  // ---------------------------------------------------------------- 物と人の短い書き方
  K.prop = (id, x, y, o) => Object.assign({ type: 'prop', id, x, y }, o || {});
  K.props = (id, pts, o) => pts.map(([x, y], i) => K.prop(id, x, y, Object.assign({ variant: i % 4 }, o || {})));
  K.chest = (id, x, y, o) => Object.assign({ type: 'chest', id, x, y }, o || {});
  K.spring = (id, x, y, o) => Object.assign({ type: 'spring', id, x, y }, o || {});
  K.sign = (x, y, text, o) => Object.assign({ type: 'sign', x, y, text }, o || {});
  K.exam = (x, y, event, o) => Object.assign({ type: 'examine', x, y, event }, o || {});
  /** 「ここに何かある」のきらめき（prop 'glint'。歩ける・灯りつき。絵は systems/field/layers.js）。cond はまだ拾っていない間だけ真に */
  K.glint = (x, y, cond, o) => Object.assign({ type: 'prop', id: 'glint', x, y }, cond != null ? { cond } : {}, o || {});
  K.stairs = (x, y, to, o) => Object.assign({ type: 'stairs', x, y, to }, o || {});
  /** 人: talk が文字列ならイベント、配列なら {lines} */
  K.npc = function (id, look, x, y, o) {
    const n = Object.assign({ id, look, x, y, dir: 's', move: 'still' }, o || {});
    if (Array.isArray(n.talk)) n.talk = { lines: n.talk };
    if (n.key === undefined && n.talk) n.key = id;
    return n;
  };
  /** 台詞の行: L(text) / L(cond, text, face?) */
  K.L = function (a, b, c) { return b === undefined ? { text: a } : Object.assign({ cond: a, text: b }, c ? { face: c } : {}); };

  // ---------------------------------------------------------------- 屋内の型（壁・床・戸口）
  /**
   * 屋内の箱: w×h、上の 2 行は壁（立ち上がり）、左右と下は壁、下の中ほどに戸口（1 マス。外の絵の扉も 1 マス）。→ {g, door:{x, y, w: 1}}
   * 戸口のマスは 'd'（床と同じ素材）。出口の範囲は戸口の 1 マス、着くのはその真上
   */
  K.room = function (w, h, o) {
    o = o || {};
    const g = K.grid(w, h, 'f');
    K.rect(g, 0, 0, w, 2, 'W');
    K.vline(g, 0, 0, h - 1, 'W'); K.vline(g, w - 1, 0, h - 1, 'W');
    K.hline(g, 0, w - 1, h - 1, 'W');
    const dx = o.doorX != null ? o.doorX : Math.floor(w / 2) - 1;
    K.put(g, dx, h - 1, 'd');
    return { g, door: { x: dx, y: h - 1, w: 1 } };
  };
  K.ROOM_LEGEND = function (wall, floor) {
    return {
      W: { mat: wall || 'wall_wood', solid: true, rise: 2 },
      f: { mat: floor || 'wood_floor' },
      c: { mat: 'carpet' },
      d: { mat: floor || 'wood_floor', name: 'door' },
    };
  };
  /** 森の外の景色（マップの外・壁の森）の共通の凡例 */
  K.FOREST_LEGEND = function (extra) {
    return Object.assign({
      F: { mat: 'forest_dark', solid: true },
      T: { mat: 'tree', solid: true },
      b: { mat: 'bush', solid: true },
      R: { mat: 'roots', solid: true },
      ',': { mat: 'grass' },
      '"': { mat: 'tall_grass' },
      '.': { mat: 'moss_earth' },
      '*': { mat: 'flowers' },
      r: { mat: 'road' },
      e: { mat: 'dirt' },
      '~': { mat: 'water', walk: false },
      '_': { mat: 'shallow' },
    }, extra || {});
  };
})(window.RPG);
