// CONTENT（砂漠）: 隊商路の野営地 3 つ（WORLD_REDESIGN §4.2 の流れ 2・3、STORY_BIBLE §7.2）。どれも 30×22 の小さな場所（戦闘なし）。
//   desert_camp1 野営地「岩の井戸」: 岩に囲まれた井戸と、名の削れた戦没者の碑（lo_war_desert）。たき火の場面で砂の鷹団が来る
//   desert_camp2 野営地「星の石」: 星を刻んだ立ち石と、記録官が置き去りにしたくら袋（くべられなかった手紙）。砂嵐の選択（近道・遠回り）
//   desert_camp3 王墓のオアシス: 古い泉（回復の泉）と王墓の入口。隊はここで待つ（ここから先は一行だけ）
//   入ると隊と一緒ならたき火の場面（desert_campN_scene、once は旗で）。隊と一緒でなければ静かな野営の跡。
(function (R) {
  'use strict';
  R.onData(function () {
    const K = R.ContentF.kit, DK = R.Desert.kit;
    const L = K.L;
    const W = 30, H = 22;
    // 描いた下絵（desert_painted_rows.js）があれば、その当たりと絵を使う（無ければマスから焼く）
    const painted = (id, g) => { const P = R.Desert.PAINTED && R.Desert.PAINTED[id]; return P ? { rows: P.rows, art: P.art } : { rows: g }; };

    function base(seed) {
      const g = K.grid(W, H, 'u');
      K.blob(g, 15, 11, 12, 8, 's', seed + 'a');
      K.blob(g, 15, 12, 5, 3, 'k', seed + 'b', 's');
      K.rect(g, 14, 18, 2, 4, 'd');                     // 南の口（ワールドへ）
      K.path(g, [[15, 18], [15, 13]], 'd', 1, 'suk');
      return g;
    }
    const camp = (O, cx, cy) => {
      O.push({ type: 'brazier', id: 'fire_' + cx + '_' + cy, x: cx, y: cy, on: true });
      O.push(K.prop('log', cx - 1, cy + 1), K.prop('log', cx + 1, cy + 1), K.prop('log', cx, cy - 1));
    };
    // 隊の人（たき火の場面のあいだもそこにいる）。ザイードは隊と一緒のあいだは一行の後ろにつく人（ev.guest）なので、
    // 野営地の人としては置かない（同じ人が 2 人にならない）。o.zaid = ザイードが野営地に残る条件（王墓のオアシスだけ）
    const caravan = (id, cond, o) => [
      ...(o.zaid ? [K.npc(id + '_zaid', 'npc_zaid', o.zx, o.zy, { name: R.T('map.desert_camps.caravan.0.name'), title: R.T('map.desert_camps.caravan.0.title'), dir: o.zd || 's', talk: 'desert_camp_zaid', reward: 'news', cond: o.zaid, pushable: false })] : []),
      K.npc(id + '_man1', 'npc_caravan', o.ax, o.ay, { name: R.T('map.desert_camps.caravan.1.name'), dir: 'e', talk: 'desert_camp_man', reward: 'news', cond }),
      K.npc(id + '_man2', 'npc_desert_man', o.bx, o.by, { name: R.T('map.desert_camps.caravan.2.name'), dir: 'w', talk: 'desert_camp_man', reward: 'news', cond }),
      K.npc(id + '_camel1', 'ani_camel', o.c1x, o.c1y, { name: R.T('map.desert_camps.caravan.3.name'), dir: 'w', talk: [L(R.T('map.desert_camps.caravan.3.talk.0.L'))], reward: null, cond }),
      K.npc(id + '_camel2', 'ani_camel', o.c2x, o.c2y, { name: R.T('map.desert_camps.caravan.4.name'), dir: 'e', talk: [L(R.T('map.desert_camps.caravan.4.talk.0.L'))], reward: null, cond }),
    ];

    // ---------------------------------------------------------------- 1. 岩の井戸
    {
      const g = base('c1');
      K.blob(g, 5, 6, 4, 4, 'm', 'c1r1'); K.blob(g, 24, 5, 5, 4, 'm', 'c1r2'); K.blob(g, 25, 16, 3, 3, 'm', 'c1r3');
      K.blob(g, 5, 16, 3, 2, 'm', 'c1r4');
      const O = [];
      camp(O, 15, 11);
      O.push(K.prop('dry_well', 11, 7), K.exam(11, 8, 'desert_camp1_well'));
      O.push(K.prop('broken_pillar', 20, 7), K.exam(20, 8, 'desert_camp1_memorial'));
      // 小物は岩の際にだけ（道・たき火のまわりは空ける。持ち主 2026-09-28「野営地の小物も整理して」）
      O.push(K.prop('tent', 9, 11), K.prop('tent', 21, 12), K.prop('cart_barrels', 22, 16), K.prop('crate', 22, 15), K.prop('clay_jars', 8, 16), K.prop('sack', 8, 15));
      O.push(K.prop('cactus', 8, 14), K.prop('sand_mound', 18, 4), K.prop('desert_palm', 16, 6));
      O.push(K.prop('lantern', 12, 10), K.prop('lantern', 18, 13), K.prop('copper_brazier', 14, 17), K.prop('copper_brazier', 16, 17));
      O.push(K.sign(17, 18, R.T('map.desert_camps.sign')));
      O.push(K.prop('sand_mound', 4, 13), K.prop('rock_small', 26, 12), K.prop('cactus', 27, 19), K.prop('bones', 3, 19), K.prop('rock_small', 10, 4));
      const N = caravan('c1', ['desert_caravan_on', '!desert_camp2_done'], { zx: 14, zy: 10, ax: 13, ay: 12, bx: 17, by: 12, c1x: 22, c1y: 14, c2x: 8, c2y: 12 })
        .concat([
          K.npc('rashid_fire', 'npc_rashid', 16, 10, { name: R.T('map.desert_camps.N.0.rashid_fire.name'), title: R.T('map.desert_camps.N.0.rashid_fire.title'), dir: 'w', talk: 'desert_rashid_fire', reward: 'hint', cond: ['desert_hawk_met', '!desert_camp2_done', { not: { choice: 'ch_desert_hawk', is: 'fight' } }] }),
          K.npc('camp1_old', 'npc_desert_old_m', 22, 9, { name: R.T('map.desert_camps.N.1.camp1_old.name'), dir: 'w', talk: 'desert_camp1_old', reward: 'news', cond: '!desert_caravan_on' }),
        ]);
      K.def('desert_camp1', {
        ...painted('desert_camp1', g),
        name: R.T('map.desert_camps.desert_camp1.name'), kind: 'town', region: 'r_desert', location: 'camp1', theme: 'desert',
        legend: DK.LEGEND(), outside: 'dune_sand', objects: O, npcs: N,
        spawns: { road: { x: 15, y: 19, dir: 'n' }, fire: { x: 15, y: 13, dir: 'n' } },
        exits: [{ x: 14, y: 21, w: 2, h: 1, to: { map: 'world', spawn: 'camp1' } }],
        triggers: [{ id: 'scene', on: 'enter', event: 'desert_camp1_scene' }],
        zones: [], light: DK.LIGHT_OUT, dark: false, bgm: 'caravan', bbg: 'desert',
        meta: { sub: R.T('map.desert_camps.desert_camp1.meta.sub'), chestsInfo: false },
      });
    }

    // ---------------------------------------------------------------- 2. 星の石
    {
      const g = base('c2');
      K.blob(g, 4, 5, 3, 3, 'X', 'c2r1', 'su'); K.blob(g, 26, 7, 3, 4, 'X', 'c2r2', 'su'); K.blob(g, 23, 17, 3, 2, 'm', 'c2r3');
      const O = [];
      camp(O, 13, 12);
      O.push(K.prop('obelisk', 18, 7), K.exam(18, 8, 'desert_camp2_stone'));
      O.push(K.prop('sack', 23, 12), K.exam(23, 13, 'desert_camp2_saddlebag'));           // 記録官のくら袋（くべられなかった手紙）
      // 小物は岩の際にだけ（道・たき火のまわりは空ける）
      O.push(K.prop('tent', 8, 10), K.prop('tent', 19, 13), K.prop('cart_barrels', 20, 17), K.prop('crate', 20, 16));
      O.push(K.prop('bones', 6, 13), K.prop('sand_mound', 21, 4), K.prop('thorn_bush', 7, 7), K.prop('cactus', 24, 10), K.prop('desert_palm', 11, 6, { variant: 1 }));
      O.push(K.prop('lantern', 15, 10), K.prop('lantern', 11, 14), K.prop('copper_brazier', 14, 17), K.prop('copper_brazier', 16, 17));
      O.push(K.sign(17, 18, R.T('map.desert_camps.sign_2')));
      O.push(K.prop('sand_mound', 4, 16), K.prop('rock_small', 27, 14), K.prop('cactus', 3, 10), K.prop('bones', 26, 19), K.prop('rock_small', 8, 4), K.prop('clay_jars', 23, 11));
      const N = caravan('c2', ['desert_caravan_on', 'desert_camp1_done', '!desert_camp3_done'], { zx: 12, zy: 11, ax: 11, ay: 13, bx: 15, by: 13, c1x: 21, c1y: 15, c2x: 7, c2y: 12 })
        .concat([K.npc('camp2_star', 'npc_desert_child', 20, 9, { name: R.T('map.desert_camps.N.0.camp2_star.name'), dir: 'w', talk: 'desert_camp2_child', reward: 'hint', cond: '!desert_caravan_on' })]);
      K.def('desert_camp2', {
        ...painted('desert_camp2', g),
        name: R.T('map.desert_camps.desert_camp2.name'), kind: 'town', region: 'r_desert', location: 'camp2', theme: 'desert',
        legend: DK.LEGEND(), outside: 'dune_sand', objects: O, npcs: N,
        spawns: { road: { x: 15, y: 19, dir: 'n' }, fire: { x: 13, y: 14, dir: 'n' } },
        exits: [{ x: 14, y: 21, w: 2, h: 1, to: { map: 'world', spawn: 'camp2' } }],
        triggers: [{ id: 'scene', on: 'enter', event: 'desert_camp2_scene' }],
        zones: [], light: DK.LIGHT_OUT, dark: false, bgm: 'caravan', bbg: 'desert',
        meta: { sub: R.T('map.desert_camps.desert_camp2.meta.sub'), chestsInfo: false },
      });
    }

    // ---------------------------------------------------------------- 3. 王墓のオアシス（古い泉・王墓の入口）
    {
      const g = K.grid(W, H + 4, 'u');
      K.blob(g, 15, 13, 13, 10, 's', 'c3a');
      K.blob(g, 11, 12, 5, 3, 'g', 'c3g', 's');
      K.blob(g, 11, 12, 3, 2, 'w', 'c3w', 'g');                // 古い泉（枯れかけ。解決で満ちる＝tilePatches）
      K.rect(g, 16, 1, 12, 7, 'X');                            // 王墓の正面（砂岩の崖）
      K.rect(g, 20, 5, 4, 3, 'Q'); K.rect(g, 21, 3, 2, 2, 'Q');  // 墓の入口の前庭
      K.rect(g, 14, 22, 2, 4, 'd');
      K.path(g, [[15, 22], [15, 17], [21, 17], [21, 8]], 'd', 1, 'sukg');
      const O = [];
      camp(O, 17, 14);
      // 王墓の戸口（描いた下絵の戸口は 2 マス幅、y 5。当たりは desert_painted_rows.js）
      for (const [x, id] of [[21, 'desert_camp3_tomb'], [22, 'desert_camp3_tomb_b']]) {
        O.push(K.stairs(x, 5, { map: 'desert_tomb_1', spawn: 'entrance' }, { id, cond: 'desert_camp3_done', look: 'none' }), K.exam(x, 5, 'desert_tomb_sealed', { cond: '!desert_camp3_done' }));
      }
      O.push(K.prop('obelisk', 19, 6), K.prop('obelisk', 24, 6), K.prop('tomb_urn', 18, 8), K.prop('tomb_urn', 24, 8));   // 壺は墓の崖の際（入口の前 x 20〜23 は空ける）
      O.push(K.spring('desert_camp3_s1', 7, 15));             // 古い泉のほとりの湧き水（回復の泉）
      O.push(K.exam(13, 11, 'desert_camp3_oldspring'));
      O.push(K.prop('beacon', 13, 8, { cond: 'cleared_r_desert' }));   // 日輪の火（大灯火の光の柱）
      for (const [x, y, v] of [[6, 9, 0], [16, 9, 1], [5, 13, 1], [17, 11, 0], [8, 18, 0], [13, 19, 1], [25, 12, 0]]) O.push(K.prop('desert_palm', x, y, { variant: v }));
      O.push(K.prop('tent', 22, 13), K.prop('tent', 22, 18), K.prop('cart_barrels', 26, 16), K.prop('clay_jars', 24, 20));
      O.push(K.prop('lantern', 19, 12), K.prop('lantern', 14, 17), K.prop('copper_brazier', 19, 9), K.prop('copper_brazier', 24, 9), K.prop('copper_brazier', 13, 22), K.prop('copper_brazier', 16, 22));
      O.push(K.sign(18, 22, R.T('map.desert_camps.sign_3')), K.sign(25, 9, R.T('map.desert_camps.sign_4')));
      O.push(K.prop('bones', 3, 17), K.prop('sand_mound', 26, 21), K.prop('thorn_bush', 4, 7));
      const wait = [{ any: [['desert_caravan_on', 'desert_camp2_done'], 'desert_camp3_done'] }, '!desert_finale_done'];
      const N = caravan('c3', wait, { zaid: ['desert_camp3_done', '!desert_finale_done'], zx: 18, zy: 13, zd: 'w', ax: 16, ay: 15, bx: 20, by: 15, c1x: 25, c1y: 14, c2x: 9, c2y: 18 })
        .concat([
          K.npc('abul_oasis', 'npc_abul', 12, 16, { name: R.T('map.desert_camps.N.0.abul_oasis.name'), title: R.T('map.desert_camps.N.0.abul_oasis.title'), dir: 'n', talk: 'desert_abul_oasis', reward: 'boss', cond: ['desert_abul_came', '!cleared_r_desert'] }),
          K.npc('hazal_spirit', 'npc_hazal', 11, 10, { name: R.T('map.desert_camps.N.1.hazal_spirit.name'), dir: 's', talk: 'desert_hazal_after', reward: 'news', cond: 'cleared_r_desert' }),
        ]);
      K.def('desert_camp3', {
        ...painted('desert_camp3', g),
        name: R.T('map.desert_camps.desert_camp3.name'), kind: 'town', region: 'r_desert', location: 'oasis', theme: 'desert',
        legend: DK.LEGEND(), outside: 'dune_sand', objects: O, npcs: N,
        spawns: { road: { x: 15, y: 23, dir: 'n' }, tomb: { x: 21, y: 7, dir: 's' }, fire: { x: 17, y: 16, dir: 'n' }, spring: { x: 13, y: 15, dir: 'n' } },
        exits: [{ x: 14, y: 25, w: 2, h: 1, to: { map: 'world', spawn: 'camp3' } }],
        triggers: [{ id: 'scene', on: 'enter', event: 'desert_camp3_scene' }],
        tilePatches: [{ cond: 'cleared_r_desert', rect: [8, 11, 7, 3], rows: [' wwwww ', 'wwwwwww', ' wwwww '] }],
        zones: [], light: DK.LIGHT_OUT, dark: false, bgm: 'caravan', bbg: 'desert',
        meta: { sub: R.T('map.desert_camps.desert_camp3.meta.sub'), chestsInfo: false },
      });
    }
  });
})(window.RPG);
