// BEAST: 戦闘背景（地方 7 つ: desert snow marsh isles mine ash star ＋ 終盤の library）。本体は描いた画像（v2/assets/env/bbg/<id>、ENV_ASSETS.md の K.envLayers）。
// 画像が無いとき（node・読めなかった）の控えは、夜空と平らな地面だけの簡単な絵。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const REG = {
    desert: { mood: 'night', ambient: 'rgb(110,104,170)', ground: ['#4a4038', '#6e604c'] },
    snow: { mood: 'night', ambient: 'rgb(120,130,190)', ground: ['#5a6070', '#8a94a8'] },
    marsh: { mood: 'forest_night', ambient: 'rgb(88,104,150)', ground: ['#2c3024', '#44482e'] },
    isles: { mood: 'coast', ambient: 'rgb(104,114,190)', ground: ['#4a4a50', '#7a766a'] },
    mine: { mood: 'cave', ambient: 'rgb(122,106,188)', ground: ['#2a2830', '#46404a'] },
    ash: { mood: 'cave', ambient: 'rgb(150,96,120)', ground: ['#2c2626', '#4a3a36'] },
    star: { mood: 'tower', ambient: 'rgb(108,98,172)', ground: ['#3a3a4c', '#5a5a70'] },
    // 終盤（白の大書庫。描いた絵は v2/assets/env/bbg/library、design/art_ref/gen/env/bbg/library.png）
    library: { mood: 'tower', ambient: 'rgb(116,112,184)', ground: ['#6a6878', '#9a98a8'] },
  };
  for (const id of Object.keys(REG)) {
    const r = REG[id];
    (K._defs = K._defs || []).push([id, {
      mood: r.mood, ambient: r.ambient,
      *bake(g) {
        const W = g.W, H = g.H;
        const back = K.mk(W, H), bx = back.getContext('2d');
        K.nightSky(bx, W, g.GT + 20 * g.s, { moon: [W * 0.3, 60 * g.s, 18 * g.s], auroraY: 0.3, auroraW: 0.6, seed: id.length });
        yield* K.tick();
        const ground = K.mk(W, H), gx = ground.getContext('2d');
        const gr = gx.createLinearGradient(0, g.GT, 0, H);
        gr.addColorStop(0, r.ground[0]); gr.addColorStop(1, r.ground[1]);
        gx.fillStyle = gr; gx.fillRect(0, g.GT, W, H - g.GT);
        return { back, ground, front: K.mk(W, H), post: K.mk(W, H) };
      },
    }]);
  }
})(window.RPG);
