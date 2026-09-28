// 世界の地図の画面の一枚絵（古い羊皮紙の地図、持ち主 2026-09-28「古い羊皮紙で進めてください」）の表（screens/map.js が読む）。
//   絵: v2/assets/env/world/under/parchment@32.png（2048×1536、字は描いていない。名前は画面が重ねる）。生成と道具は design/art_ref/gen/env/_tools/worldmap/。
//   絵は前のワールドの形をもとに描き直した物で、座標はぴったりではない。ワールドの座標 (x, y) → 絵の px は既定で xform（S 倍・OX, OY ずらし）、
//   合わない所は anchors（マップ id か locations の id → 絵の px [x, y]）とエリアの四角 areas（エリアの id → 絵の px [x, y, w, h]）で手で合わせる。
//   regions: 地方の霧（まだ行っていない地方の上にかける羊皮紙のしみ）。円の並び [絵の x, y, 半径]
(function (R) {
  'use strict';
  R.WorldMap = {
    image: 'world/under/parchment@32',
    size: [2048, 1536],
    xform: { S: 2.6667, OX: 128, OY: 0 },
    anchors: {},
    areas: {},
    regions: {},
    /** ワールドの座標 → 絵の px */
    toPaint(x, y) { const f = this.xform; return [f.OX + x * f.S, f.OY + y * f.S]; },
  };
})(window.RPG);
