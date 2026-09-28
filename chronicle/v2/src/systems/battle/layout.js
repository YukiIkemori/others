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
  /** 今の R.W×R.H の配置 → {tall, ox, oy, stageH, cardsY, cmdY, chipsY, lantern, horizon, P(x,y)} */
  Lay.compute = function () {
    const tall = R.layout === 'tall';
    const k = R.uiScale || 1;
    if (tall) {
      const stageH = Math.min(Math.round(R.H * 0.52), 640);
      const oy = Math.round((stageH - 600) * 0.6);
      const cardsY = stageH - 20 * k;
      return {
        tall, ox: Math.round((R.W - 540) / 2), oy, stageH, cardsY,
        cmdY: cardsY + 2 * (64 + 8) * k + 26 * k, chipsY: R.H - (R.safe.b || 0) - 52 * k,
        T: TALL, lantern: [TALL.lantern[0] + (R.W - 540) / 2, TALL.lantern[1] + oy], horizon: TALL.horizon + oy,
      };
    }
    const ox = Math.round((R.W - 960) / 2), oy = Math.round((R.H - 540) / 2);
    return { tall, ox, oy, stageH: R.H, T: WIDE, lantern: [WIDE.lantern[0] + ox, WIDE.lantern[1] + oy], horizon: WIDE.horizon + oy };
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
    const P = L.tall ? PARTY.tall : PARTY.wide, out = {};
    const n = units.length;
    units.forEach((u, i) => {
      const y = n <= 1 ? (P.y0 + P.y1) / 2 : P.y0 + (P.y1 - P.y0) * (Math.min(n, 4) === n ? i / (n - 1) : i / 3);
      const x = P.x0 + (y - P.y0) * P.slope + (u.row === 'back' ? P.back : 0);
      out[u.uid] = { x: Math.round(x) + L.ox, y: Math.round(y) + L.oy };
    });
    return out;
  };

  /**
   * 足もとの占める広さ（半幅・半奥行き、論理 px）。重なりの判定に使う。ボスの絵は大きいので広く取る
   * （2026-09-28 の持ち主の報告「新しく敵が召喚した雑魚は当たり判定がおかしい」: 呼ばれた根・狼がボスの絵に重なっていた）
   */
  function foot(u) {
    if (u && u.boss) return [70, 34];
    const s = u && u.size;
    return s === 'l' || s === 'boss' ? [50, 26] : s === 's' ? [28, 18] : [36, 22];
  }
  Lay.foot = foot;
  function clash(p, fp, q) {
    const fq = foot(q);
    return Math.abs(q.x - p.x) < fp[0] + fq[0] && Math.abs(q.y - p.y) < fp[1] + fq[1];
  }
  /** 敵の場所の候補（論理 px。ボスが居るときはお供の場所を先に） */
  function candidates(L, withBoss) {
    const T = L.T, out = [];
    for (const p of (withBoss ? T.bossAdds : []).concat(T.foes)) out.push({ x: p[0] + L.ox, y: p[1] + L.oy });
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
  function spotFor(L, taken, u) {
    const fp = foot(u);
    const withBoss = taken.some((q) => q.boss);
    for (const c of candidates(L, withBoss)) if (!taken.some((q) => clash(c, fp, q))) return c;
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
    const bosses = units.filter((u) => u.boss);
    const rest = units.filter((u) => !u.boss).slice().sort((a, b) => (big(b) ? 1 : 0) - (big(a) ? 1 : 0));
    const taken = [];
    const put = (u, p) => { out[u.uid] = p; taken.push({ x: p.x, y: p.y, size: u.size, boss: !!u.boss }); };
    if (bosses.length) {
      bosses.forEach((u, i) => { const d = i - (bosses.length - 1) / 2; put(u, { x: T.boss[0] + L.ox + d * 120, y: T.boss[1] + L.oy + Math.abs(d) * 20 }); });
      rest.forEach((u, i) => {
        const p = T.bossAdds[i];
        const q = p ? { x: p[0] + L.ox, y: p[1] + L.oy } : null;
        put(u, q && !taken.some((t) => clash(q, foot(u), t)) ? q : spotFor(L, taken, u));
      });
      return out;
    }
    rest.forEach((u, i) => {
      const p = T.foes[i];
      const q = p ? { x: p[0] + L.ox, y: p[1] + L.oy } : null;
      put(u, q && !taken.some((t) => clash(q, foot(u), t)) ? q : spotFor(L, taken, u));
    });
    return out;
  };

  /** 呼び出し（summon）で来た敵 u の空いた場所。taken = 今見えている敵の actor（x・y・size・boss） */
  Lay.freeSpot = function (L, taken, u) { return spotFor(L, taken || [], u || { size: 'm' }); };

  /** 奥行きの係数（見本の scaleAt。影の長さ・濃さに使う） */
  Lay.depth = function (L, y) { return Math.max(0.6, Math.min(1.2, (y - L.horizon + 200) / 400)); };
})(window.RPG);
