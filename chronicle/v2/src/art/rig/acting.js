// CAST: 画像のつなぎ（tween）と演技のポーズ（STYLE_REFERENCE R6）。原画の画像にも仮の絵にも同じ手で使う。
// 1 枚のコマ（{c, ox, oy}）の行を動かして、うなずき・首ふり・跳ねる・かがむ・前のめり などのコマを作る（画素は増やさない・色も変えない）。
//   const T = R.Art.rig.tween;  T.head(fr, {neck, dx, dy}) / T.lean(fr, {waist, top, px}) / T.crouch(fr, {waist, px}) / T.hop(fr, px)
//   R.Art.rig.ACTING[name] = [[op, args]…]   フィールドの演技 11 種（南向きだけ。§2.5.7）
//   R.Art.rig.act(frame, name, geo) → [コマ…]   geo = {top, neck, waist}（コマの中の行、描く点からの相対でなく c の中の y）
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});
  const T = (rig.tween = rig.tween || {});
  const mk = (w, h) => R.Hd.RZ.canvas(w, h);
  /** 同じ大きさ・同じ描く点の空のコマ（pad を足せる） */
  function blank(fr, pad) {
    pad = pad || 0;
    const c = mk(fr.c.width + pad * 2, fr.c.height + pad * 2);
    return { c, ox: fr.ox + pad, oy: fr.oy + pad, anchors: fr.anchors };
  }
  const PAD = 3;
  /** 頭（neck より上の行）だけを (dx, dy) 動かす。体を先に描き、頭を上に重ねる */
  T.head = function (fr, o) {
    const out = blank(fr, PAD), x = out.c.getContext('2d'), w = fr.c.width, h = fr.c.height, n = Math.max(1, Math.min(h - 1, Math.round(o.neck)));
    x.drawImage(fr.c, 0, n, w, h - n, PAD, PAD + n, w, h - n);
    // 頭を上げるときは首の行を伸ばしてすき間を埋める
    for (let i = 0; i < -(o.dy | 0); i++) x.drawImage(fr.c, 0, n - 1, w, 1, PAD + Math.round((o.dx | 0) * (i + 1) / (1 - (o.dy | 0))), PAD + n - 1 - i, w, 1);
    x.drawImage(fr.c, 0, 0, w, n, PAD + (o.dx | 0), PAD + (o.dy | 0), w, n);
    return out;
  };
  /** 上半身の前のめり（waist より上の行を、上へ行くほど px までずらす）。px < 0 で左、> 0 で右 */
  T.lean = function (fr, o) {
    const out = blank(fr, PAD + Math.abs(o.px | 0)), pd = PAD + Math.abs(o.px | 0), x = out.c.getContext('2d'), w = fr.c.width, h = fr.c.height;
    const wa = Math.max(1, Math.min(h, Math.round(o.waist))), top = Math.max(0, Math.round(o.top || 0));
    x.drawImage(fr.c, 0, wa, w, h - wa, pd, pd + wa, w, h - wa);
    for (let y = 0; y < wa; y++) {
      const k = y <= top ? 1 : (wa - y) / Math.max(1, wa - top);
      const dx = Math.round(o.px * k);
      x.drawImage(fr.c, 0, y, w, 1, pd + dx, pd + y + (o.drop && y < wa ? Math.round(o.drop * k) : 0), w, 1);
    }
    return out;
  };
  /** かがむ: waist より上を px 下げ（脚の上端に重ねる） */
  T.crouch = function (fr, o) {
    const out = blank(fr, PAD), x = out.c.getContext('2d'), w = fr.c.width, h = fr.c.height, wa = Math.max(1, Math.min(h, Math.round(o.waist)));
    const knee = Math.round(wa + (h - wa) * 0.45), p = o.px | 0;
    // 脚: 腿の途中の p 行を抜いて詰める（足元の位置は変えない）
    x.drawImage(fr.c, 0, knee, w, h - knee, PAD, PAD + knee, w, h - knee);
    x.drawImage(fr.c, 0, wa, w, knee - wa - p, PAD, PAD + wa + p, w, knee - wa - p);
    x.drawImage(fr.c, 0, 0, w, wa, PAD, PAD + p, w, wa);
    return out;
  };
  /** 跳ねる（全体を px 上へ。描く点は同じ） */
  T.hop = function (fr, px) { return { c: fr.c, ox: fr.ox, oy: fr.oy + (px | 0), anchors: fr.anchors }; };
  /** 組み合わせ: ops = [[op, args]…] を順に */
  T.chain = function (fr, ops, geo) {
    let f = fr, g = Object.assign({}, geo), off = 0;
    for (const [op, a] of ops) {
      if (op === 'hop') { f = T.hop(f, a); continue; }
      const args = Object.assign({}, a);
      // 前の op で pad が増えた分だけ行の位置もずれる
      if (args.neck == null) args.neck = g.neck + off; else args.neck += off;
      if (args.waist == null) args.waist = g.waist + off; else args.waist += off;
      if (args.top == null) args.top = g.top + off;
      const before = f.oy;
      f = T[op](f, args);
      off += f.oy - before;
    }
    return f;
  };

  // ---------- フィールドの演技（南向き。R6 の 11 種）。1 つのポーズ = コマの並び（各コマは ops の列）
  rig.ACTING = {
    nod: [[], [['head', { dy: 1 }]], [['head', { dy: 2 }]], [['head', { dy: 1 }]]],
    shake: [[], [['head', { dx: -1 }]], [], [['head', { dx: 1 }]]],
    surprise: [[['hop', -3]], [['hop', -2]], [['head', { dy: -1 }]], []],
    laugh: [[['head', { dy: -1 }]], [], [['head', { dy: -1 }], ['hop', -1]], []],
    sad: [[['head', { dy: 2 }], ['crouch', { px: 1 }]]],
    point: [[['lean', { px: 2 }]], [['lean', { px: 2 }], ['head', { dx: 1 }]]],
    kneel: [[['crouch', { px: 3 }]], [['crouch', { px: 5 }], ['head', { dy: 1 }]]],
    sit: [[['crouch', { px: 6 }]]],
    bow: [[['head', { dy: 1 }]], [['head', { dy: 3 }], ['crouch', { px: 1 }]], [['head', { dy: 3 }], ['crouch', { px: 1 }]], [['head', { dy: 1 }]]],
    raise_lantern: [[['hop', -1]], [['head', { dy: -1 }], ['hop', -1]]],
    think: [[['head', { dx: 1, dy: 1 }]], [['head', { dx: 1, dy: 1 }]], [['head', { dx: 0, dy: 1 }]]],
  };
  rig.ACTING_FPS = { nod: 7, shake: 8, surprise: 10, laugh: 8, sad: 2, point: 3, kneel: 4, sit: 2, bow: 5, raise_lantern: 3, think: 2 };
  /** 演技のコマ（frame から）。geo = {top, neck, waist}（c の中の行） */
  rig.act = function (fr, name, geo) {
    return (rig.ACTING[name] || [[]]).map((ops) => (ops.length ? T.chain(fr, ops, geo) : fr));
  };
  /** コマの不透明な範囲から行の目安を出す（2.7 頭身: 首は上から 37%、腰は 62%） */
  rig.geo = function (fr) {
    const c = fr.c, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let top = -1, bot = -1;
    for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { top = y; break; }
    for (let y = h - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { bot = y; break; }
    if (top < 0) { top = 0; bot = h - 1; }
    const H = bot - top + 1;
    return { top, bot, neck: top + H * 0.37, waist: top + H * 0.62, height: H };
  };
})(window.RPG);
