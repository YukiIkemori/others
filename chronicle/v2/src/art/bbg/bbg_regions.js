// BEAST: 戦闘背景（地方 7 つ: desert snow marsh isles mine ash star ＋ 終盤の library ＋ ダンジョン・ボス・クリア後の 10: ship watercave swamp manor oblivion volcano pyramid ice peak road）。本体は描いた画像（v2/assets/env/bbg/<id>、ENV_ASSETS.md の K.envLayers）。
// 画像が無いとき（node・読めなかった）の控えは、夜空と平らな地面だけの簡単な絵。
// like: 'cave' の物（洞窟の中）は、控えも洞窟（bbg_cave.js のコードの洞窟）。夜空と月の野原では洞窟の戦闘に見えない
//   （持ち主 2026-10-04「潮鳴りの洞窟、戦闘背景が凄くしょぼい」: 遅い回線で描いた絵が戦闘の始まりの 2.5 秒に間に合わず、控えの月夜の野原が出ていた）
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const K = (BZ.bbg = BZ.bbg || {});
  const REG = {
    desert: { mood: 'night', ambient: 'rgb(110,104,170)', ground: ['#4a4038', '#6e604c'] },
    snow: { mood: 'night', ambient: 'rgb(120,130,190)', ground: ['#5a6070', '#8a94a8'] },
    marsh: { mood: 'forest_night', ambient: 'rgb(88,104,150)', ground: ['#2c3024', '#44482e'] },
    isles: { mood: 'coast', ambient: 'rgb(104,114,190)', ground: ['#4a4a50', '#7a766a'] },
    mine: { mood: 'cave', ambient: 'rgb(122,106,188)', ground: ['#2a2830', '#46404a'], like: 'cave' },
    ash: { mood: 'cave', ambient: 'rgb(150,96,120)', ground: ['#2c2626', '#4a3a36'] },
    star: { mood: 'tower', ambient: 'rgb(108,98,172)', ground: ['#3a3a4c', '#5a5a70'] },
    // 終盤（白の大書庫。描いた絵は v2/assets/env/bbg/library、design/art_ref/gen/env/bbg/library.png）
    library: { mood: 'tower', ambient: 'rgb(116,112,184)', ground: ['#6a6878', '#9a98a8'] },
    // ダンジョン・ボス・クリア後の場所（描いた絵は v2/assets/env/bbg/<id>、design/art_ref/gen/env/_tools/jobs_bbg_more.py）
    ship: { mood: 'coast', ambient: 'rgb(94,102,178)', ground: ['#2a2e34', '#3e4248'] },          // 幽霊船の甲板（霧・破れた帆・亡霊の光）
    watercave: { mood: 'cave', ambient: 'rgb(122,106,188)', ground: ['#1e2a30', '#30424a'], like: 'cave' },     // 潮鳴りの洞窟（濡れた岩・光る貝・潮だまり）
    swamp: { mood: 'forest_night', ambient: 'rgb(88,104,158)', ground: ['#28261e', '#3e3a2c'] }, // 鐘沈みの沼（沈んだ鐘楼・泥炭の島）
    manor: { mood: 'tower', ambient: 'rgb(108,98,172)', ground: ['#3a2a28', '#54403a'] },        // 霧の館の音楽室（舞台・寄木の床）
    oblivion: { mood: 'tower', ambient: 'rgb(108,98,172)', ground: ['#6a6a78', '#9898a6'] },     // 忘却の底（虚無・沈む頁・白い石の床）
    volcano: { mood: 'cave', ambient: 'rgb(150,96,120)', ground: ['#2a2222', '#3e302c'] },       // 火口の中（溶岩の湖・黒い土手道）
    pyramid: { mood: 'cave', ambient: 'rgb(122,106,188)', ground: ['#4a4030', '#6a5a40'] },      // 砂の王墓の王の間（壁画・砂岩・砂）
    ice: { mood: 'night', ambient: 'rgb(120,130,190)', ground: ['#3a4a5a', '#5a6e84'] },        // 巨人の氷壁（青い氷の壁・凍った湖）
    peak: { mood: 'night', ambient: 'rgb(120,130,190)', ground: ['#5a6070', '#8a94a8'] },       // 白竜の峰の頂（雲海・立石の輪）
    road: { mood: 'night', ambient: 'rgb(116,104,196)', ground: ['#2e2a2a', '#46403a'] },       // 町の門の外の夜の道（ロウェルとの決闘）
  };
  for (const id of Object.keys(REG)) {
    const r = REG[id];
    const cave = r.like === 'cave' ? K.caveDef : null;   // bbg_cave.js は名前順でこの前に読まれる
    (K._defs = K._defs || []).push([id, {
      mood: r.mood, ambient: r.ambient, geo: cave ? cave.geo : undefined,
      *bake(g, L, c) {
        if (cave) return yield* cave.bake(g, L, c);
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
