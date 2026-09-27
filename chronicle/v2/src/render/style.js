// RENDER: 絵の決まりの数値（R.Hd.STYLE）と性能の予算（R.Hd.BUDGET）。V2_PLAN §2.4「数値の定数は 1 か所」・§2.10
// ほかのファイルでこの数字を書き直さない（読むだけ）。値は ART_REWORK §2・STYLE_REFERENCE §9 から。
(function (R) {
  'use strict';
  const Hd = (R.Hd = R.Hd || {});

  Hd.STYLE = {
    // --- 仮の実装から続く名前（呼ぶ側が読んでいる）
    olMix: 0.82,          // 縁 = その画素の素材の一番暗い段を暗い色へ 82% 寄せた色（ART_REWORK §2.1）
    maxColors: 80,        // 1 コマの色数の上限（戦闘の人物。フィールドは colors.field）
    rim: 0.35,            // リムの出るしきい（法線の z）
    steps: 5,             // 画面に出る 1 素材の段の数（主役の服だけ stepsHero）
    // --- 足した物
    tones: 5,             // RZ.render の tones（量子化）
    stepsHero: 6,
    sat: 0.9,             // 全体の仕上げの彩度（人物・物）
    satMon: 0.78,         // 魔物
    satMax: 0.8,          // 小さな所（宝石・魔法の光・目）の彩度の上限。服・木・石は satCloth
    satCloth: 0.55,
    rimC: '#ffd8a0', rimK: 1.25,     // 背中側の暖色のリム（1 art px）
    headScale: 0.88,
    scale: { btl: 1.12, field: 1 },  // 焼く倍率（戦闘の人物 全高 約 60 art px）
    height: { btl: [56, 62], field: [34, 40] },            // 全高（art px）
    colors: { btl: [40, 80], field: [25, 55] },            // 1 コマの色数
    // 魔物の高さの段（art px = v2 の論理 px）。STYLE_REFERENCE R1・R2 の値（S 22〜30・M 30〜45・ボス 90〜120）は旧の論理 px（人 30）なので 2 倍にした。
    // 人（戦闘 約 60）に対して 雑魚 1.0〜1.7 倍・大きい雑魚 2〜2.3 倍・ボス 3〜4 倍（STYLE_REFERENCE §0.8）
    size: { s: [44, 60], m: [60, 90], l: [90, 140], boss: [180, 240] },
    outlineDark: 0.24,    // 外周の画素の 90% 以上がこの輝度未満
    minBlack: 1,          // 純黒を使わない: どの色も r+g+b >= minBlack
    noBlack: '#070812',   // 「黒」が要る所に使う色
    hairSkinMax: 0.08,    // 後頭部の肌の割合の上限（hd_check_hair）
    hueGap: 45,           // 並ぶ 4 人の主色の色相の差（度）
    // 光（R.Light）: STYLE_REFERENCE §5.3・§6.4、MODERN_UI §4.1
    light: {
      lampColor: '#ffc27a', windowColor: '#ffcf86', moonColor: '#9fb8ff', crystalColor: '#bfe6ff', fireColor: '#ff9c4a',
      poolSquash: 0.62,   // 地面の光だまりの縦の潰れ（0.55〜0.7）
      poolWhite: 0.35,    // 光だまりの色を白へ寄せる割合（灯りの橙のままだと地面が茶色くなる）
      lanternColor: '#ffd49a',   // ランタンの輪の中の光（橙 30°）
      coreR: 7, haloMul: 3.2,        // 芯の半径（art px、5〜9）と、にじみ = 芯 × 約 3
      ringR: 88, ringDarkTiles: 4,   // ランタンの光の輪（art px）。暗がりの階は 4 マス
      lampR: 110,         // 街灯の光だまりの半径
      fireMul: 1.3,       // 篝火は街灯の 1.3 倍
      flicker: { lamp: [0.08, 3], ring: [0.05, 2] },   // [振れ幅, Hz]
      // 明るさ（map.light.k、ART_REWORK §1.4）→ 環境光の効き: nightBright で 1、1.0 で 0（R.Light.effect）
      nightBright: 0.45,
      // 夜の階調（P2、STYLE_REFERENCE §5.2 と MODERN_UI の見本 town/field/dungeon の測定に合わせた）
      ambientHue: [250, 295],   // 暗部の色相の目標。環境光の色相が 195〜250° のときこちらへ寄せる
      ambientHueShift: 0.7,     // 寄せる割合（0 = 地図の色のまま）
      ambientSat: 1.1,          // 寄せるときの彩度の倍率
      poolCore: 1.0,            // 光だまりの中心の足し算（②、k に掛ける）
      poolR: 1.2,               // 光だまりの半径の倍率（灯りの r × mood.poolMul × これ。人の背の 1.5〜2 倍、§5.3）
      ambientGain: 1.18,        // 夜の環境光の明るさの倍率（暗部の持ち上げを減らした分、中間を上げる）。フィールドのチャンク（compose）
      mapGain: 1.05, mapPoolCore: 0.6,   // 戦闘の光の地図（R.Light.map）: 明るい地面に大きな光だまり 1 つなので控えめ（見本 battle の p95 .63 に合わせる）
      spill: 0.3,               // 掛けた後に中心へ足す加算の強さ（③）
    },
    // 仕上げ（R.Post.frame）の膜: 暗部の持ち上げ = max(0, grade.sh) × shLift ＋ grade.lift × liftMul
    post: { shLift: 0.15, liftMul: 0.3 },
    // 焼いた絵の 1 画素のバイト（stats の数え方: 幅 × 高さ × 4）
    bpp: 4,
  };

  // 性能の予算（V2_PLAN §2.10 の表。desk / phone は CPU 4 倍遅くした見込み）。仮の実装の値をそのまま写した
  Hd.BUDGET = {
    frameBakeMs: 3,
    chunkBakeMs: { desk: 4, phone: 16 },
    mapEnterMs: { desk: 150, phone: 500 },
    postMs: { desk: 0.5, phone: 2 },
    charBakeMs: { desk: 25, phone: 100 },
    menuFrameMs: { desk: 1, phone: 4 },
    snapshotMs: { desk: 8, phone: 30 },
    mb: { chunk: 40, field: 30, btl: 30, mon: 30, boss: 30, bbg: 20, prop: 20, fx: 20, face: 10, total: 150 },
    longFrames: { frames: 600, over33: 1 },
    // 足した物
    autoLow: { frames: 120, avgMs: 14 },   // 最初の戦闘の 120 フレームの平均が 14 ms を超えたら効果を自動で low（ART_REWORK §1.5.3）
    lightMapMs: { desk: 1, phone: 4 },      // 光の地図 1 枚（灯り 10 個、960×540）
  };
  // mb の種類の分け方（§2.10 の表「チャンク 40・人 30・魔物とボス 30・背景 20・物と効果 20・顔 10」= 150）:
  // 人 30 は field と btl で共有、魔物とボス 30 は mon と boss で共有、物と効果 20 は prop と fx で共有。上限は組の中の mb の値
  Hd.BUDGET_SHARE = { field: 'people', btl: 'people', mon: 'beasts', boss: 'beasts', prop: 'propfx', fx: 'propfx' };
})(window.RPG);
