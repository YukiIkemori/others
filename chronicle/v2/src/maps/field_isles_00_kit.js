// マレア諸島（r_isles）のエリア切り替えのフィールドの共通（maps/field_isles_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.ISLE_LEGEND  諸島のエリアの凡例（字は field_isles/lib.py と同じ。絵の当たりの合わせ fit.py がそのまま使える）
//     ',' 草・';' 風になびく草と浜なでしこ・'"' 野の花・'.' 白い道・':' 小道・'s' 白い砂浜・'_' 波打ちぎわ・'=' 板の桟橋・橋・'c' 白い敷石
//     'k' 平らな岩棚・'~' 海・'w' 潮だまり・'T' 海辺の松・やし・'b' 茂み・'r' 岩・'R' 白い崖・'X' 築いた物（灯台・塔・難破船）
//   R.FieldArea.ISLE_LIGHT   諸島の夜の光（夜光虫の海の青い暗さ）
//   小道具の組 'isles'（v2/assets/env/isles/props/*__isles）: 道しるべの灯 = 白い石の柱の船のランタン（港の灯）、置き灯・看板・掲示板も諸島の物。
//   諸島への道（WORLD_REDESIGN §2.5「最初: 定期船 → 諸島」）: ファロスの定期船の桟橋（T 字、看板「しばらく欠航いたします。」）に、
//     コーラルへ渡る乗り場（戸口の形、はい／いいえを聞く）と船の人を足す（pharos_town.js は書き換えない。データの後処理の 2 段目）。
//     乗り場と船の人は cond {not:{slice:true}}: 体験版のあいだは今のまま欠航（乗り場のマスを調べると欠航の札）。コーラルの T 字の桟橋から戻る。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.ISLE_LEGEND = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'coral_sand' }, _: { mat: 'shallow' }, '=': { mat: 'pier' }, c: { mat: 'white_paving' }, u: { mat: 'deck' }, k: { mat: 'tide_rock' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false }, l: { mat: 'rock', solid: true },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
  };
  FA.ISLE_LIGHT = { ambient: '#4c5c9a', k: 0.5, mood: 'night' };
  if (FA.CONFIRM) FA.CONFIRM.isles_cave_1 = R.T('map.field_isles_00_kit.isles_cave_1');
  // ファロスの定期船の乗り場（T 字の桟橋の南の縁）と、着く所
  const PH = { door: { x: 23, y: 42 }, spawn: { x: 23, y: 41, dir: 'n' }, hand: { x: 25, y: 41 } };
  const OFF = { not: { slice: true } };
  function link() {
    const M = R.DB.maps || {};
    const ph = M.pharos;
    if (!ph || !M.coral) return;
    if (ph.spawns && !ph.spawns.ferry) ph.spawns.ferry = Object.assign({}, PH.spawn);
    ph.objects = ph.objects || [];
    if (!ph.objects.some((o) => o.to && o.to.map === 'coral')) {
      ph.objects.push(
        { type: 'door', x: PH.door.x, y: PH.door.y, look: 'none', to: { map: 'coral', spawn: 'ferry' }, cond: OFF, confirm: R.T('map.field_isles_00_kit.link.confirm') },
        { type: 'examine', x: PH.door.x, y: PH.door.y, event: 'isles_ferry_closed', cond: { slice: true } });
    }
    ph.npcs = ph.npcs || [];
    // 島々（生成したエリアのファイルは書き換えない）: 灯台島に着いたとき・座礁した商船の船長と、積荷を拾ったときのティア宝箱 3
    const L = M.i_light, W = M.i_wreck;
    if (L && !(L.triggers || []).some((t) => t.event === 'isles_light_arrive')) L.triggers = (L.triggers || []).concat([{ id: 'arrive', on: 'enter', event: 'isles_light_arrive' }]);
    if (W) {
      W.npcs = W.npcs || [];
      if (!W.npcs.some((n) => n.id === 'wreck_captain')) {
        W.npcs.push({ id: 'wreck_captain', look: 'npc_merchant_captain', name: R.T('map.field_isles_00_kit.link.wreck_captain.name'), x: 22, y: 18, dir: 's', move: 'still', pushable: false, talk: 'isles_wreck', reward: null, key: 'wreck_captain', cond: '!isles_wreck_done' });
        const CARGO = { choice: 'ch_isles_wreck', is: 'cargo' };
        W.objects.push({ type: 'chest', id: 'i_wreck_cargo1', x: 18, y: 19, pool: 'p_T', cond: CARGO }, { type: 'chest', id: 'i_wreck_cargo2', x: 27, y: 18, pool: 'p_T', cond: CARGO },
          { type: 'chest', id: 'i_wreck_cargo3', x: 29, y: 19, pool: 'p_T', cond: CARGO });
      }
    }
    // 島々の桟橋の外洋船（持ち主 2026-10-04「舵を取る場所がわかりづらい」）: 桟橋の板に重ならない海に船の絵、桟橋から船へ向いて調べると舵。
    //   生成のエリアのファイルの「桟橋の先のマスを調べる isles_boat」は外し、R.Isles.kit.moor の船と舵に替える
    const MOOR = {
      i_light: { ship: [22, 30], helm: [[20, 29], [20, 30]], way: { x: 20, y: 29, w: 1, h: 2, dir: 'e' } },
      i_siren: { id: 'ship_small', ship: [33, 17, 0.67], helm: [[33, 16], [34, 15]], way: { x: 33, y: 16, w: 1, h: 1, dir: 's' }, patch: { cond: 'isles_ship', rect: [32, 17, 1, 1], rows: ['~'] } },
      i_crab: { ship: [2, 14], helm: [[3, 14], [4, 14], [5, 14]], way: { x: 3, y: 14, w: 3, h: 1, dir: 'n' } },
      i_wreck: { ship: [26, 29], helm: [[24, 28], [24, 29]], way: { x: 24, y: 28, w: 1, h: 2, dir: 'e' } },
    };
    for (const id of Object.keys(MOOR)) {
      const A = M[id], o = MOOR[id];
      if (!A || !R.Isles || !R.Isles.kit || !R.Isles.kit.moor || (A.objects || []).some((q) => q.mooredShip)) continue;
      A.objects = (A.objects || []).filter((q) => q.event !== 'isles_boat').concat(R.Isles.kit.moor(Object.assign({ event: 'isles_boat' }, o)));
      if (o.patch) A.tilePatches = (A.tilePatches || []).concat([o.patch]);   // 船尾の下の浅瀬（歩けた）を船のあいだだけ海に
    }
    if (!ph.npcs.some((n) => n.id === 'ferry_hand')) {
      ph.npcs.push({ id: 'ferry_hand', look: 'npc_isles_sailor', name: R.T('map.field_isles_00_kit.link.ferry_hand.name'), x: PH.hand.x, y: PH.hand.y, dir: 'w', move: 'still', pushable: false, talk: 'isles_ferry_hand', reward: 'lead', key: 'ferry_hand', cond: OFF });
    }
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
