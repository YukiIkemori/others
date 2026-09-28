// CAST: 仮の顔 hd:face:<look>（V2_PLAN §6.1・§2.5.7）。胸から上、表情 5 つ（neutral smile sad angry surprise）の 1 コマずつ。
//   原画の顔（v2/assets/sprites/<look>/face.png、キャラのシートの表情。A38: 顔絵は画像 API を使わず、シートの表情で作る）があればそれ、
//   無ければ骨組みの頭を大きく焼いた**仮の顔**（ART_REWORK §4.2 の「顔 34」の作り方、scale 3、夜の光・背中のリム）。
//   顔を出す人（§6.1、オーナーの決まり 2026-09-28「町の人の顔は外す・物語の主な人は仲間と同じ質で」）:
//   主人公 10・仲間 20・物語の主な人（MAIN_CAST。どれも原画の顔 face.png がある）だけ。ほかの町の人・名前のある町の人・動物は顔なし
//   （R.Portrait.has が null → 会話は名前だけの窓、枠ごと出さない）。
//   コマの (ox, oy) は下の中央。R.Portrait.draw が枠に合わせて拡大する（整数に近い倍率、ぼかさない）。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
  const FACE_SCALE = 3;
  // 物語の主な人（design/art_ref/npc_sheets.json の顔6 のある人）。序章の 4 人・敵・地方をまたぐ人・各地方の要の人
  const MAIN_CAST = ['berna', 'fine', 'rowell', 'otto', 'lazaro', 'noa',
    'npc_tadeo', 'npc_yena', 'npc_pim', 'npc_zaid', 'npc_rashid', 'npc_jorn', 'npc_kaya', 'npc_zakuro'];
  cast.MAIN_CAST = MAIN_CAST;

  /** この look に顔を出すか（§6.1）: 主人公・仲間・物語の主な人だけ */
  cast.hasFace = function (look) {
    const l = (R.DB.looks || {})[look];
    if (!l || l.animal) return false;
    if (MAIN_CAST.includes(look)) return true;
    if (l.face === false) return false;
    if (/^hero_/.test(look)) return true;
    const C = R.DB.companions || {};
    return Object.keys(C).some((id) => (C[id].look || id) === look);
  };

  function rigFace(look) {
    const rig = R.Art.rig, RZ = R.Hd.RZ;
    const L = rig.fromLook(look);
    if (!L) return null;
    const sc = FACE_SCALE;
    const tasks = EXPRS.map((e) => () => {
      const p = rig.pose('idle', Object.assign({ aN: 0.25, eN: 0.3, aF: -0.1, eF: 0.3, tilt: -0.04 }, rig.EXPR[e]));
      const B = new RZ.Builder();
      const pt = rig.draw(B, L, p, { noWeapon: true });
      const r = RZ.render(B, rig.renderOpts({ scale: sc, light: rig.light('face') }));
      // 胸から上を切る（顔が真ん中に来るよう頭の中心より少し前。32 × 32 のモデル単位）
      const hx = r.ox + pt.head[0] * sc, hy = r.oy + pt.head[1] * sc;
      const W = Math.round(32 * sc), Hh = Math.round(32 * sc);
      const x0 = Math.round(hx - 13 * sc), y0 = Math.round(hy - 16 * sc);
      const c = RZ.canvas(W, Hh), x = c.getContext('2d');
      x.drawImage(r.canvas, -x0, -y0);
      return { c, ox: W >> 1, oy: Hh - 1 };
    });
    return cast.job(tasks, (frames) => {
      const poses = {};
      EXPRS.forEach((e, i) => { poses[e] = [i]; });
      return { frames, poses, fps: {}, anchors: { feet: [0, 0] }, w: frames[0].c.width, h: frames[0].c.height,
        meta: { look, source: 'rig', placeholder: true, scale: sc } };
    }, 'face');
  }
  cast._rigFace = rigFace;

  /** 歩きの原画（正面の立ち）の胸から上 → 顔のシート（表情は 1 つを全部に）。読み込み中は null、作れなければ undefined */
  function fieldFace(look) {
    const sh = cast.sprites.field(look, {});
    if (sh === null) return null;
    if (!sh || !sh.frames) return undefined;
    const P = sh.poses.stand_s || sh.poses.idle_s || [0];
    const fr = sh.frames[P[0]];
    if (!fr || !fr.c) return undefined;
    const src = fr.c;
    let b = { x: 0, y: 0, w: src.width, h: src.height };
    try {
      const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
      let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= x0) b = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { /* 全体 */ }
    // 2.5〜3 頭身: 上から 52% が頭と肩
    const ch = Math.max(8, Math.round(b.h * 0.52)), cw = Math.max(ch, b.w);
    const cx = b.x + b.w / 2;
    const sc = Math.max(2, Math.round(84 / ch));
    const c = R.Hd.RZ.canvas(Math.round(cw * sc), Math.round(ch * sc)), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, Math.round(cx - cw / 2), b.y, cw, ch, 0, 0, c.width, c.height);
    const frames = [{ c, ox: c.width >> 1, oy: c.height - 1, id: 'face_neutral' }];
    const poses = {};
    EXPRS.forEach((e) => { poses[e] = [0]; });
    if (R.Hd && R.Hd.track) R.Hd.track('sprite', 'cast:fieldface:' + look, c.width * c.height * 4);
    return { frames, poses, fps: {}, anchors: { feet: [0, 0] }, w: c.width, h: c.height, meta: { look, source: 'sprite', from: 'field', pixel: true } };
  }
  cast._fieldFace = fieldFace;

  R.onData(function () {
    if (!R.Hd || !R.Hd.def) return;
    for (const look of Object.keys(R.DB.looks || {})) {
      if (!cast.hasFace(look)) continue;
      const key = 'hd:face:' + look;
      if (R.Hd.has(key)) continue;
      R.Hd.def(key, function () {
        const sp = cast.sprites.face(look);
        if (sp === null) return null;
        if (sp) return sp;
        // 顔の原画がまだ読めない・無い主な人: 古い仮の顔ではなく、歩きの原画の胸から上を拡大して顔にする（予備の道）
        if (cast.sprites.has(look, 'field')) {
          const fs = fieldFace(look);
          if (fs !== undefined) return fs;
        }
        return rigFace(look);
      }, { kind: 'face', look });
    }
  });
})(window.RPG);
