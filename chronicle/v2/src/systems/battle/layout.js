// BSCENE: 戦闘の配置（MODERN_UI §2.3 の表。16:9 は 960 幅の値を中央に置き、幅が広い画面は真ん中の絵が広がる。
// 縦持ちは上の約 55% を戦場、その下に人の札・行動の札）。人と敵の足もとの座標（論理 px）を決める。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});

  // 16:9（960×540 の見本の値）。味方は 前列 (575,338)・(616,395)、後列 (668,361)・(726,425)
  const WIDE = {
    front: [[575, 338], [616, 395], [590, 372], [560, 412]],
    back: [[668, 361], [726, 425], [700, 392], [742, 350]],
    // 敵の足もと（x 40〜420、y 320〜460）: 味方に近い列から
    foes: [[300, 395], [165, 342], [190, 452], [330, 470], [330, 330], [60, 395], [55, 468], [60, 330]],
    boss: [255, 410], bossAdds: [[380, 368], [392, 468], [70, 360], [70, 470]],
    lantern: [505, 385], horizon: 236,
  };
  // 縦持ち（540 幅。戦場は上の 0〜stageH）。見本 battle_tall.png の値を論理 px にした物
  const TALL = {
    front: [[330, 402], [352, 462], [340, 432], [322, 488]],
    back: [[410, 424], [440, 490], [425, 455], [452, 400]],
    foes: [[190, 438], [85, 400], [100, 505], [205, 515], [210, 385], [30, 452], [35, 520], [35, 385]],
    boss: [140, 462], bossAdds: [[245, 420], [250, 520], [40, 410], [40, 525]],
    lantern: [268, 450], horizon: 250,
  };

  const Lay = (_.layout = {});
  // 縦持ちの下の部品の高さ（uiScale を掛ける前。人の札 2 段の上端から）: 札 2 段 144・すき間 26・行動の札と説明 184・下の札 22 と余白
  const NEED_STD = 412, NEED_FIT = 392;
  /**
   * 今の R.W×R.H の配置 → {tall, ox, oy, stageH, cardsY, cmdY, chipsY, lantern, horizon, k, map(x,y), sx, T, P, ...}
   *   map(x, y): 見本の表（WIDE・TALL）の論理 px → 画面の論理 px。sx は横の縮み（ボスの並びの間隔・足もとの広さに掛ける）
   *   k: 戦闘の部品の大きさ（scene.js が描く間 R.uiScale をこれにする）。bgH: 戦闘背景を焼く高さ。spriteK・partyK: 絵の縮み
   */
  Lay.compute = function () {
    const tall = R.layout === 'tall';
    const k0 = R.uiScale || 1;
    let L;
    if (tall) {
      const sb = R.safe.b || 0;
      const std = Math.min(Math.round(R.H * 0.52), 640);
      // 見本の形は、下の部品が画面に収まり、いちばん手前の敵の足もとが人の札より上にあるときだけ（スマホの高さ 1170 前後）
      if (std - 20 * k0 + NEED_STD * k0 + sb <= R.H && Math.round((std - 600) * 0.6) + 525 <= std - 20 * k0 - 8) {
        // スマホの縦持ち（見本 battle_tall.png のとおり）
        const oy = Math.round((std - 600) * 0.6), ox = Math.round((R.W - 540) / 2);
        const cardsY = std - 20 * k0;
        L = {
          tall, ox, oy, stageH: std, cardsY, k: k0,
          cmdY: cardsY + 2 * (64 + 8) * k0 + 26 * k0, chipsY: R.H - sb - 52 * k0,
          T: TALL, P: PARTY.tall, sx: 1, map: (x, y) => [x + ox, y + oy], bgH: R.H, spriteK: 0.85, partyK: 1,
        };
      } else {
        // 縦長の PC の窓（800×885 など。テスター 2026-10-01 P3・P26・P33）: 見本の縦持ちは画面の下にはみ出していた。
        //   下の部品（人の札・行動の札・説明・下の札）を少し小さくして下に寄せ、残りの上を戦場にする。
        //   戦場が低い（横長）ときは 16:9 の並びと背景を縮めて置き、高いときは縦持ちの並びを地平線に合わせて縦に詰める
        const k = Math.max(0.6, Math.min(k0, (R.H - sb - Math.max(300, R.H * 0.45)) / NEED_FIT));
        const cardsY = Math.round(R.H - sb - NEED_FIT * k);
        const stageH = Math.round(cardsY + 20 * k);
        const wideStage = R.W / stageH >= 1.2;   // 背景の絵の形（art/bbg/kit.js の K.geo と同じ境目）
        const s = stageH / 448, GT = Math.round(196 * s);   // 背景の地平線（K.geo の GT）
        const T = wideStage ? WIDE : TALL;
        const footMax = wideStage ? 470 : 525, hzRef = T.horizon;
        const cs = wideStage ? stageH / 540 : 1;
        const sy = Math.min(cs, (cardsY - 10 * k - GT) / (footMax - hzRef));
        const sx = wideStage ? R.W / 960 : 1, cx = wideStage ? 480 : 270;
        const map = (x, y) => [Math.round(R.W / 2 + (x - cx) * sx), Math.round(GT + (y - hzRef) * sy)];
        L = {
          tall, fit: true, ox: 0, oy: GT - hzRef, stageH, cardsY, k,
          cmdY: cardsY + 2 * (64 + 8) * k + 26 * k, chipsY: cardsY + 362 * k,
          T, P: wideStage ? PARTY.wide : PARTY.tall, sx, sy, map,
          // 背景は戦場の高さで焼く（横長の戦場は 16:9 の絵、高い戦場は縦の絵の戦場の部分 = 高さの 55%）
          bgH: wideStage ? stageH : Math.round(stageH / 0.55),
          spriteK: wideStage ? 0.85 * Math.min(1, cs / 0.75) : 0.85, partyK: wideStage ? Math.min(1, cs / 0.7) : 1,
        };
      }
    } else {
      const ox = Math.round((R.W - 960) / 2), oy = Math.round((R.H - 540) / 2);
      // 960 より狭い横持ち（4:3 の 720 幅。縦長の PC の窓もこれになる）: 横だけ縮めて、左端の敵・右端の味方が画面の外に出ないように
      //   （テスター 2026-10-01 P3: 攻撃の相手が画面に見えなかった）。背景の絵も真ん中に置かれるので、真ん中から縮める
      const sx = R.W < 960 ? R.W / 960 : 1;
      const map = sx < 1 ? (x, y) => [Math.round(R.W / 2 + (x - 480) * sx), y + oy] : (x, y) => [x + ox, y + oy];
      // 16:9 より縦の長い横持ち（fit.js が 720×797 のような高さを出す）: 背景は 540 の高さ（横長の絵）で焼き、真ん中へ下げて置く（bgDy）。
      //   その高さで焼くと縦持ちの絵になり、地平線とランタンの光が人と敵の位置と合わなかった
      const tallBg = R.H > 540 && R.W / R.H < 1.2;
      L = { tall, ox, oy, stageH: R.H, k: k0, T: WIDE, P: PARTY.wide, sx, map, bgH: tallBg ? 540 : R.H, bgDy: tallBg ? oy : 0, spriteK: 1, partyK: 1 };
    }
    L.lantern = L.map(L.T.lantern[0], L.T.lantern[1]);
    L.horizon = L.map(0, L.T.horizon)[1];
    Lay.last = L;
    return L;
  };

  function big(u) { return u.boss || u.size === 'l' || u.size === 'boss'; }

  /**
   * 味方の足もと（2026-09-27 の持ち主の報告「並びを変えた後の戦闘で位置と札の順が合わない」）:
   * 上から下へ隊列の順（R.Party の並び＝右上の札と同じ順）に並べ、前列・後列は横の一歩（後列は右へ）で分ける。
   * 以前は前列・後列ごとに場所を取っていたので、前・前・後・後 の並びでも見た目は 前→後→前→後 の順になっていた。
   * units は隊列の順で渡す（scene.js の place が st.partyUnits() の順にする）。
   */
  const PARTY = {
    wide: { y0: 332, y1: 448, x0: 578, slope: 0.62, back: 88 },
    tall: { y0: 396, y1: 500, x0: 330, slope: 0.35, back: 76 },
  };
  Lay.PARTY = PARTY;
  Lay.partySpots = function (L, units) {
    const P = L.P || (L.tall ? PARTY.tall : PARTY.wide), out = {};
    const n = units.length;
    units.forEach((u, i) => {
      const y = n <= 1 ? (P.y0 + P.y1) / 2 : P.y0 + (P.y1 - P.y0) * (Math.min(n, 4) === n ? i / (n - 1) : i / 3);
      const x = P.x0 + (y - P.y0) * P.slope + (u.row === 'back' ? P.back : 0);
      const q = L.map(Math.round(x), Math.round(y));
      out[u.uid] = { x: q[0], y: q[1] };
    });
    return out;
  };

  /**
   * 足もとの占める広さ（半幅・半奥行き、論理 px）。重なりの判定に使う。ボスの絵は大きいので広く取る
   * （2026-09-28 の持ち主の報告「新しく敵が召喚した雑魚は当たり判定がおかしい」: 呼ばれた根・狼がボスの絵に重なっていた）
   */
  let FK = [1, 1];   // 今の配置の縮み（縦長の窓で戦場を縮めたとき。enemySpots・freeSpot が L から入れる）
  function foot(u) {
    const f = u && u.boss ? [70, 34] : u && (u.size === 'l' || u.size === 'boss') ? [50, 26] : u && u.size === 's' ? [34, 18] : [38, 22];   // 名札（〜80 px）が隣と重ならない幅
    return FK[0] === 1 && FK[1] === 1 ? f : [f[0] * FK[0], f[1] * FK[1]];
  }
  Lay.foot = foot;
  function clash(p, fp, q) {
    const fq = foot(q);
    return Math.abs(q.x - p.x) < fp[0] + fq[0] && Math.abs(q.y - p.y) < fp[1] + fq[1];
  }
  /** 敵の場所の候補（論理 px。ボスが居るときはお供の場所を先に） */
  function candidates(L, withBoss) {
    const T = L.T, out = [];
    for (const p of (withBoss ? T.bossAdds : []).concat(T.foes)) { const q = L.map(p[0], p[1]); out.push({ x: q[0], y: q[1] }); }
    return out;
  }
  /** 敵の場所の枠（候補の外に出さない） */
  function zone(L) {
    const ps = candidates(L, true);
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  /**
   * 空いた場所: 候補を順に見て、どの敵（taken。x・y・size・boss）にも重ならない最初の所。
   * 空きが無ければ（混んでいる）枠の中を細かく探し、いちばん離れている所（重なりを小さく）。
   */
  function spotFor(L, taken, u, near) {
    const fp = foot(u);
    const withBoss = taken.some((q) => q.boss);
    const cs = candidates(L, withBoss);
    // near: 味方に近い（x が大きい）順。呼ばれた敵が左端の草の陰に隠れないように
    if (near) cs.sort((a, b) => b.x - a.x);
    for (const c of cs) if (!taken.some((q) => clash(c, fp, q))) return c;
    const Z = zone(L);
    let best = null, bestD = -Infinity;
    for (let y = Z.y0; y <= Z.y1; y += 10) {
      for (let x = Z.x0; x <= Z.x1; x += 10) {
        let d = Infinity;
        for (const q of taken) {
          const fq = foot(q);
          d = Math.min(d, Math.max(Math.abs(q.x - x) / (fp[0] + fq[0]), Math.abs(q.y - y) / (fp[1] + fq[1])));
        }
        if (d > bestD) { bestD = d; best = { x, y }; }
      }
    }
    return best || candidates(L, withBoss)[0];
  }

  /**
   * 敵の足もと。大きい物（ボス・size l）を先に良い場所へ。ボスは敵側の真ん中（2 体以上は真ん中から左右に並べる）。
   * お供・雑魚は候補の順に、先に置いた物に重ならない所へ（お供が 4 体を超えても重ねない）。
   */
  Lay.enemySpots = function (L, units) {
    const T = L.T, out = {};
    FK = [L.sx || 1, L.sy || 1];
    const at = (p) => { const q = L.map(p[0], p[1]); return { x: q[0], y: q[1] }; };
    const bosses = units.filter((u) => u.boss);
    const rest = units.filter((u) => !u.boss).slice().sort((a, b) => (big(b) ? 1 : 0) - (big(a) ? 1 : 0));
    const taken = [];
    const put = (u, p) => { out[u.uid] = p; taken.push({ x: p.x, y: p.y, size: u.size, boss: !!u.boss }); };
    if (bosses.length) {
      bosses.forEach((u, i) => { const d = i - (bosses.length - 1) / 2; const q = at([T.boss[0] + d * 120, T.boss[1] + Math.abs(d) * 20]); put(u, q); });
      rest.forEach((u, i) => {
        const p = T.bossAdds[i];
        const q = p ? at(p) : null;
        put(u, q && !taken.some((t) => clash(q, foot(u), t)) ? q : spotFor(L, taken, u));
      });
      return out;
    }
    rest.forEach((u, i) => {
      const p = T.foes[i];
      const q = p ? at(p) : null;
      put(u, q && !taken.some((t) => clash(q, foot(u), t)) ? q : spotFor(L, taken, u));
    });
    return out;
  };

  /** 呼び出し（summon）で来た敵 u の空いた場所。taken = 今見えている敵の actor（x・y・size・boss） */
  Lay.freeSpot = function (L, taken, u) { FK = [L.sx || 1, L.sy || 1]; return spotFor(L, taken || [], u || { size: 'm' }, true); };

  /** 奥行きの係数（見本の scaleAt。影の長さ・濃さに使う） */
  Lay.depth = function (L, y) { return Math.max(0.6, Math.min(1.2, (y - L.horizon + 200) / 400)); };
})(window.RPG);
