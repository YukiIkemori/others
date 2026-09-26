// CAST: 仮の顔 hd:face:<look>（V2_PLAN §6.1・§2.5.7）。胸から上、表情 5 つ（neutral smile sad angry surprise）の 1 コマずつ。
//   原画の顔（v2/assets/sprites/<look>/face.png、キャラのシートの表情。A38: 顔絵は画像 API を使わず、シートの表情で作る）があればそれ、
//   無ければ骨組みの頭を大きく焼いた**仮の顔**（ART_REWORK §4.2 の「顔 34」の作り方、scale 3、夜の光・背中のリム）。
//   顔を出す人（§6.1）: 主人公 10・仲間 20・物語の人・名前のある町の人。町の人の型・動物は顔なし（R.Portrait.has が null → 枠ごと出さない）。
//   コマの (ox, oy) は下の中央。R.Portrait.draw が枠に合わせて拡大する（整数に近い倍率、ぼかさない）。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const EXPRS = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
  const FACE_SCALE = 3;

  /** この look に顔を出すか（§6.1） */
  cast.hasFace = function (look) {
    const l = (R.DB.looks || {})[look];
    if (!l || l.animal) return false;
    return l.face !== false && !/^npc_(man|woman|old_m|old_f|child|sailor|merchant|woodcutter|guard|keeper|bard|yura_folk)_\d$/.test(look);
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
      // 胸から上を切る（頭の中心から上 19・下 17、左右 ±18 のモデル単位）
      const hx = r.ox + pt.head[0] * sc, hy = r.oy + pt.head[1] * sc;
      const W = Math.round(36 * sc), Hh = Math.round(36 * sc);
      const x0 = Math.round(hx - 18 * sc), y0 = Math.round(hy - 19 * sc);
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
        return rigFace(look);
      }, { kind: 'face', look });
    }
  });
})(window.RPG);
