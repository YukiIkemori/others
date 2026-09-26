// CAST: フィールドの人の絵 hd:field:<look>（V2_PLAN §2.5.7、MODERN_UI §8.6）。全高 約 50 art px（scale 1.15）。
//   opts = {scale: 1.4|1.15|0.9（広さの設定）, lantern: 先頭の人だけ true}（FIELD が同じ物を使い回す）
//   ポーズ: stand_s/n/e/w（1 コマ）・walk_*（[立ち, 右足, 立ち, 左足]）・演技 nod shake surprise laugh sad point kneel sit bow raise_lantern think（南向き）
//   anchors: feet・head（頭の中心）・center・lantern（ランタンの芯。向きごとは meta.lantern[dir]）
//   原画（v2/assets/sprites/<look>/field.png）があればそれ（cast/sprites.js）、無ければ仮の絵の骨組み（rig/dirs.js）、動物は animals.js。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const DIR = { s: 'down', n: 'up', e: 'right' };

  function mirror(f) {
    const c = R.Hd.RZ.canvas(f.c.width, f.c.height), x = c.getContext('2d');
    x.translate(f.c.width, 0); x.scale(-1, 1); x.drawImage(f.c, 0, 0);
    const out = { c, ox: f.c.width - 1 - f.ox, oy: f.oy };
    if (f.anchors) { out.anchors = {}; for (const [k, v] of Object.entries(f.anchors)) out.anchors[k] = [-v[0], v[1]]; }
    return out;
  }
  cast.mirror = mirror;

  /** 仮の絵のフィールドのシート（焼く仕事）。9 コマ（3 向き × 3）＋左は反転＋演技はつなぎ */
  function rigField(look, o) {
    const rig = R.Art.rig, RZ = R.Hd.RZ;
    const L = rig.fromLook(look);
    if (!L) return null;
    const sc = (o && o.scale) || 1.15, lantern = !!(o && o.lantern);
    const tasks = [];
    const order = [];
    for (const d of ['s', 'n', 'e']) for (let fr = 0; fr < 3; fr++) {
      order.push([d, fr]);
      tasks.push(() => {
        const B = new RZ.Builder();
        const pt = rig.field.build(B, L, DIR[d], fr, { lantern });
        const r = RZ.render(B, rig.renderOpts({ scale: sc, light: rig.light('field') }));
        const f = cast.limitColors(RZ.frame(r), cast.maxColors('field'));
        const rel = (q) => (q ? [Math.round(q[0] * sc), Math.round(q[1] * sc)] : null);
        f.anchors = { head: rel(pt.head) };
        if (pt.lantern) f.anchors.lantern = rel(pt.lantern);
        return f;
      });
    }
    return cast.job(tasks, (made) => finishField(look, made, order, { sc, lantern, L, source: 'rig' }), 'field');
  }
  cast._rigField = rigField;

  /** 焼いたコマ（向き × 3）→ Sheet（左は反転、演技は南の立ちからつなぎ） */
  function finishField(look, made, order, o) {
    const rig = R.Art.rig;
    const frames = [], poses = {}, fps = {}, lant = {};
    const idx = {};
    made.forEach((f, i) => { const [d, fr] = order[i]; frames.push(f); idx[d + fr] = frames.length - 1; });
    for (let fr = 0; fr < 3; fr++) { frames.push(mirror(made[order.findIndex((q) => q[0] === 'e' && q[1] === fr)])); idx['w' + fr] = frames.length - 1; }
    for (const d of ['s', 'n', 'e', 'w']) {
      poses['stand_' + d] = [idx[d + 0]];
      poses['walk_' + d] = [idx[d + 0], idx[d + 1], idx[d + 0], idx[d + 2]];
      const a = frames[idx[d + 0]].anchors;
      if (a && a.lantern) lant[d] = a.lantern;
    }
    const s0 = frames[idx.s0], g = rig.geo(s0);
    for (const name of Object.keys(rig.ACTING)) {
      poses[name] = rig.act(s0, name, g).map((f) => { if (f === s0) return idx.s0; frames.push(f); return frames.length - 1; });
      fps[name] = rig.ACTING_FPS[name] || 4;
    }
    const head = (s0.anchors && s0.anchors.head) || [0, -Math.round(g.height * 0.7)];
    const anchors = { feet: [0, 0], head, center: [0, -Math.round((s0.oy - g.top) / 2)] };
    if (lant.s) anchors.lantern = lant.s;
    let w = 0, h = 0;
    for (const f of frames) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
    const headR = Math.round(9 * (o.L && o.L.headScale ? o.L.headScale / 0.88 : 1) * o.sc);
    return { frames, poses, fps, anchors, w, h,
      meta: { look, source: o.source, placeholder: o.source !== 'sprite', skin: o.L ? cast.skinColors([frames[idx.s0]], o.L) : [], headR, lantern: lant, scale: o.sc } };
  }
  cast._finishField = finishField;

  // ---------------------------------------------------------------- 原画に重ねるランタン（小物。原画に描かれるまで）
  const lanternCache = {};
  cast.lanternFrame = function (k) {
    const key = (k || 1).toFixed(2);
    if (lanternCache[key]) return lanternCache[key];
    const RZ = R.Hd.RZ, rig = R.Art.rig, B = new RZ.Builder();
    rig.field.lantern(B, 0, 0, 8);
    const sc = 1.15 * (k || 1);
    const r = RZ.render(B, rig.renderOpts({ scale: sc, light: rig.light('field') }));
    const f = RZ.frame(r);
    f.oy = Math.round(f.oy - 3 * sc);   // 持つ所 = 取っ手の上
    f.glowY = Math.round(5.5 * sc);
    return (lanternCache[key] = f);
  };

  // ---------------------------------------------------------------- 登録
  R.onData(function () {
    if (!R.Hd || !R.Hd.def) return;
    for (const look of Object.keys(R.DB.looks || {})) {
      const key = 'hd:field:' + look;
      if (R.Hd.has(key)) continue;
      R.Hd.def(key, function (o) {
        const lk = R.DB.looks[look];
        if (lk && lk.animal) return cast.animalField(look, o);
        const sp = cast.sprites.field(look, o);
        if (sp === null) return null;
        if (sp) return sp;
        return rigField(look, o);
      }, { kind: 'field', look });
    }
  });
})(window.RPG);
