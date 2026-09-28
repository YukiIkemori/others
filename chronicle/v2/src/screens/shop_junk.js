// MENUS: 店の「使わない物をまとめて売る」の決まり（shop.js の売るタブ・START から）。S.shopJunk(stock) → [{id, n, unit, total, why}]
//   持ち主 2026-09-28「使わない物をまとめて売る」。まちがって大事な物を売らないよう、決まりはわざと狭くしてある。
//   売る候補にするのは次の 2 つだけ:
//     (1) 売るための品: 道具（slot 'use'）で使い道が無く（use が無い）値段のある物（黄金のどんぐり・金の延べ板など。
//         説明に「売ると高いお金になる。使うことはできない。」とある、魔物が落とす換金の品）。持っている数を全部。
//         この品はめずらしさ（grade）が rare でも、売る以外に役目が無いので候補に入れる（札で外せる）。
//     (2) 全員の今の装備より弱い装備: 次の全部に当てはまる物。
//         ・ふつうの品（grade 'normal'）で店で売っている物（src 'shop'）。唯一の品・盗み専用・その人専用・性別の決まりがある物は入れない
//         ・特別な効き目を持たない（mods・onHit・属性・特攻・能力・クセ・技 などがあれば、数の比べでは分からないので入れない）
//         ・アクセサリは入れない（効き目が主で、枠も 2 つある）
//         ・一行と控えの中に付けられる人が 1 人以上いて、その全員が「同じ枠に同じ種類（武器は同じ武器の型、防具は同じ重さ）の物を
//           もう付けていて」「付け替えると値が 1 つも上がらず、どれか 1 つは下がる」（R.Rules.preview の増減、S.statDiff）
//           付けられる人がいない・枠が空いている人がいる・型や重さがちがう人がいる品は、先で使うかもしれないので入れない
//         ・この店で買い直せない物は、1 つは残す（最後の 1 つは売らない）。買い直せる物だけ全部売る
//   ほかは何があっても入れない: 大事な物（slot 'key'）・使う道具（薬など）・めずらしい装備（rare・super）・付けている物（袋に無い）・値の付かない物。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  const EQUIP = ['weapon', 'shield', 'head', 'body', 'hands', 'feet'];
  // これを持つ装備は「数の比べ」だけでは弱いと言い切れない
  const SPECIAL = ['mods', 'onHit', 'element', 'vs', 'abil', 'quirk', 'drain', 'sealTech', 'art', 'stone', 'astat', 'metalHit', 'statsAdd', 'grow', 'magMult', 'only', 'gender', 'exclusive', 'unique', 'stealOnly'];
  const roster = () => (S.party ? S.party() : []).concat(R.Party && R.Party.reserve ? R.Party.reserve() : []);
  /** 売るための品（使えない・装備でもない・値がある） */
  S.isSellOnly = function (it) {
    return !!it && it.slot === 'use' && !it.use && (it.price || 0) > 0 && !it.unique;
  };
  /** 同じ種類か（武器は武器の型、防具は重さ） */
  function sameKind(a, b) {
    if (!a || !b) return false;
    if (a.slot === 'weapon') return !!a.wtype && a.wtype === b.wtype;
    return (a.weight || '') === (b.weight || '');
  }
  /** 付けられる人（一行と控え）全員にとって、今の物より弱い装備か */
  S.isWorseForAll = function (id) {
    const it = S.item(id);
    if (!it || !EQUIP.includes(it.slot) || it.grade !== 'normal' || it.src !== 'shop') return false;
    if (SPECIAL.some((k) => it[k] != null && !(typeof it[k] === 'object' && !Array.isArray(it[k]) && !Object.keys(it[k]).length))) return false;
    let wearers = 0;
    for (const c of roster()) {
      const slot = R.Rules.defaultSlot(c, id);
      if (!R.Rules.canEquip(c, id, slot)) continue;
      wearers++;
      const cur = S.item(c.equip && c.equip[slot]);
      if (!cur || !sameKind(it, cur)) return false;
      const rows = S.statDiff(c, slot, id, { all: true });
      if (!rows.length || rows.some((r) => r.d > 0) || !rows.some((r) => r.d < 0)) return false;
    }
    return wearers > 0;
  };
  /** まとめて売る候補。stock = この店で買える id（買い直せない物は 1 つ残す）→ [{id, n, unit, total, why}]（売値の高い順） */
  S.shopJunk = function (stock) {
    const buyable = new Set(stock || []);
    const out = [];
    for (const id of S.bag()) {
      const it = S.item(id), have = S.count(id), unit = R.Rules.sellPrice(id);
      if (!it || it.slot === 'key' || unit <= 0 || have <= 0) continue;
      let n = 0, why = '';
      if (S.isSellOnly(it)) { n = have; why = '売るための品'; }
      else if (S.isWorseForAll(id)) { n = buyable.has(id) ? have : have - 1; why = buyable.has(id) ? '全員の装備より弱い' : '全員の装備より弱い（1 つ残す）'; }
      if (n > 0) out.push({ id, n, unit, total: unit * n, why });
    }
    return out.sort((a, b) => b.total - a.total || (it0(a).sort || 0) - (it0(b).sort || 0));
  };
  const it0 = (r) => S.item(r.id) || {};
})(window.RPG);
