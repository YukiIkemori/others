// オルビス高原（r_star）のエリア切り替えのフィールドの共通（maps/field_star_*.js。生成物は
//   design/art_ref/gen/env/_tools/under/field_star/ の areas_star.py → fit.py → tomap.py）。森と同じ仕組み（field_00_kit.js）の上に:
//   R.FieldArea.STAR_LEGEND  高原のエリアの凡例（字は field_star/lib.py と同じ。絵の当たりの合わせ fit.py がそのまま使える）
//     ',' 高原の銀の草・';' ヒース・'"' 星の花・'.' 古い道・':' 小道・'c' 石畳・石段・'k' くぼ地の平らな岩
//     'w' 小さな池・'T' 高原の松・'F' 谷の深い松林・'b' ねずの茂み・'r' 岩・星の結晶・'R' 岩の崖・'X' 築いた物（城壁・塔・列柱）
//   R.FieldArea.STAR_LIGHT   高原の夜の光（星明かりの青。星が消えて暗い）
//   小道具の組 'star'（v2/assets/env/star/props/*__star）: 道しるべの灯 = 白い石の柱の上の星灯（ほしび）のガラスの灯。看板・掲示板も高原の物。
//   高原への道（WORLD_REDESIGN §2.3: 高原は湿原の北・山地の東）: 前のワールドの山あいの街道（森の十字路 f_cross と湿原の霧の入口 m_north を
//     結ぶ道）の北の行き止まり（崖の切れ目、W 476〜477, 145）に、星見の坂（s_steps）の西の端への出口を足す。戻りは spawn star_w
//     （world.js は書き換えない。データの後処理の 2 段目。cond {not:{slice:true}}: 体験版の間は data/demo_gate.js の止めが効く）。
(function (R) {
  'use strict';
  const FA = (R.FieldArea = R.FieldArea || {});
  FA.STAR_LEGEND = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    s: { mat: 'dirt' }, _: { mat: 'shallow' }, '=': { mat: 'bridge' }, c: { mat: 'cobble' }, u: { mat: 'road' }, k: { mat: 'cave_floor' },
    '~': { mat: 'deep_water', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true },
    r: { mat: 'rock', solid: true }, R: { mat: 'cliff', solid: true, rise: 1 }, X: { mat: 'wall_stone', solid: true },
    l: { mat: 'rock', solid: true },
  };
  FA.STAR_LIGHT = { ambient: '#4a5496', k: 0.5, mood: 'night' };
  if (FA.CONFIRM) FA.CONFIRM.star_tower_1 = R.T('map.field_star_00_kit.star_tower_1');
  // 前のワールドの街道の東の端（外海で切れている所）と、戻って着く所
  const W = { exit: { x: 476, y: 145, w: 2, h: 1, to: { map: 's_steps', spawn: 'west' }, cond: { not: { slice: true } } }, spawn: { x: 476, y: 147, dir: 's' } };
  function link() {
    const M = R.DB.maps || {};
    const w = M.world;
    if (!w || !M.s_steps) return;
    if (w.spawns && !w.spawns.star_w) w.spawns.star_w = Object.assign({}, W.spawn);
    if (w.exits && !w.exits.some((e) => e.to && e.to.map === 's_steps')) w.exits.push(JSON.parse(JSON.stringify(W.exit)));
    // 体験版のあいだの表の止め（ほかの峠と同じ）: 峠の口の崖崩れ（cond {slice:true} の tilePatch）と番人
    if (!(w.npcs || []).some((n) => n.id === 'guard_star')) {
      w.tilePatches = (w.tilePatches || []).concat([{ cond: { slice: true }, rect: [476, 146, 2, 1], rows: ['mm'] }]);
      w.npcs = w.npcs || [];
      w.npcs.push({ id: 'guard_star', look: 'npc_guard_1', name: R.T('map.field_star_00_kit.guard.name'), x: 478, y: 147, dir: 's', move: 'still', pushable: false, cond: { slice: true },
        talk: { lines: [{ text: [R.T('map.field_star_00_kit.guard.text'), R.T('map.field_star_00_kit.guard.text_2')] }] }, reward: 'news', key: 'world_guard_star' });
    }
    // トロッコ線の高原の終点（WORLD_REDESIGN §2.5: 組合につくか仲裁で ドヴァン ⇔ 高原）。坂の西の崖の下にトロッコと車止め（events/mine_field.js の star_rail_stop）
    const ST = M.s_steps;
    if (!(ST.objects || []).some((o) => o.event === 'star_rail_stop')) {
      ST.objects.push({ type: 'prop', id: 'mine_cart', x: 6, y: 24 }, { type: 'examine', x: 6, y: 24, event: 'star_rail_stop' });
      ST.spawns.rail = { x: 7, y: 25, dir: 'e' };
    }
    // 星読みの尾根の塔の扉（生成したエリアのファイルは書き換えない）: 星図で開けるまでは閉じた扉（当たり）、開けたら塔の 1 階へ
    const G = M.s_ridge;
    if (G && M.star_tower_1 && !(G.objects || []).some((o) => o.to && o.to.map === 'star_tower_1')) {
      G.objects.push({ type: 'door', x: 24, y: 6, look: 'none', to: { map: 'star_tower_1', spawn: 'entrance' }, cond: 'star_tower_open' },
        { type: 'examine', x: 24, y: 6, event: 'star_tower_seal', cond: '!star_tower_open' }, { type: 'examine', x: 25, y: 6, event: 'star_tower_seal', cond: '!star_tower_open' });
      G.tilePatches = (G.tilePatches || []).concat([{ cond: '!star_tower_open', rect: [24, 6, 2, 1], rows: ['XX'] }, { cond: 'star_tower_open', rect: [25, 6, 1, 1], rows: ['X'] }]);   // 扉の右の半分は枠（行き先の札を 1 つに）
    }
  }
  if (R.onData) R.onData(() => R.onData(link));
})(window.RPG);
