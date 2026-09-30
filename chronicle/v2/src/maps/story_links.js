// CONTENT-P: ティアで変わる世界を、どの町にも同じ表から置く（STORY_BIBLE §3.5・§4.3 の「世界の反応」・§5.1・§6.3・§6.7・§10.5）。
//   TOWNS: 地方の町ごとに、広場の近くの開けたマス（周り 8 マスも歩ける所）へ 3 人:
//     うわさ好き（ティア 2 から。events/story_world.js の story_rumor）・白衣の書記（T4 の布告の後、終盤まで。story_scribe）・
//     子ども（ティア 6 から「暁」を口にする。台詞の行）。見た目は地方の町の人の型（npc_<地方>_*）
//   OFFICES: 記録院の出張所（ファロス・ロッホ・ユール・オルビス）の壁に、T4 の後の布告と私信の写し（story_decree_board）
//   MIST: 内海の白い霧（T4 から T8 まで）。ファロスと灯台の岬に map.weather 'mist'（天気の層。ほかの天気のある所には足さない）
//   roa: T7 の後、ロアに身を寄せたロウェル（終盤のロアの場面まで）
//   差し込みは 2 段目の onData（マップの登録の後。maps/final_links.js と同じ）。体験版では tier が 2 に届かないので出ない。
(function (R) {
  'use strict';
  const TOWNS = {
    pharos: { rumor: [14, 23], scribe: [24, 24], child: [13, 30], look: 'pen' },
    fern: { rumor: [33, 39], scribe: [30, 40], child: [36, 41], look: 'forest' },
    kasim: { rumor: [34, 34], scribe: [28, 35], child: [31, 38], look: 'desert' },
    yule: { rumor: [26, 29], scribe: [30, 29], child: [28, 38], look: 'snow' },
    loch: { rumor: [30, 17], scribe: [25, 18], child: [23, 16], look: 'marsh' },
    coral: { rumor: [20, 46], scribe: [23, 49], child: [23, 42], look: 'isles' },
    nerei: { rumor: [20, 18], scribe: [20, 24], child: [23, 23], look: 'isles' },
    dovan: { rumor: [24, 27], scribe: [31, 27], child: [26, 30], look: 'mine' },
    caldera: { rumor: [32, 35], scribe: [17, 37], child: [34, 33], look: 'ash' },
    orbis: { rumor: [30, 35], scribe: [23, 38], child: [25, 25], look: 'star' },
  };
  // 出張所の壁の布告（x, y は壁の下の段。調べる所も同じマス。前のマスは床）。ファロスは床に立てる掲示板
  const OFFICES = {
    pharos_record: { x: 3, y: 2 },
    loch_klaus: { x: 5, y: 1 },
    yule_branch: { x: 5, y: 1 },
    orbis_records: { x: 3, y: 1 },
  };
  const MIST = ['pharos', 'f_cape'];
  const ROA_ROWELL = [26, 27];
  const LOOK = {
    pen: { rumor: 'npc_pen_old_f', child: 'npc_pen_child' },
    forest: { rumor: 'npc_forest_old_f', child: 'npc_forest_child' },
    desert: { rumor: 'npc_desert_old_m', child: 'npc_desert_child' },
    snow: { rumor: 'npc_snow_old_f', child: 'npc_snow_child' },
    marsh: { rumor: 'npc_marsh_old_m', child: 'npc_marsh_child' },
    isles: { rumor: 'npc_isles_old_f', child: 'npc_isles_child' },
    mine: { rumor: 'npc_mine_old_m', child: 'npc_mine_child' },
    ash: { rumor: 'npc_ash_old_f', child: 'npc_ash_child' },
    star: { rumor: 'npc_star_old_m', child: 'npc_star_child' },
  };
  R.Story = R.Story || {};
  R.Story.TOWNS = TOWNS;
  R.Story.OFFICES = OFFICES;
  R.Story.MIST = MIST;
  R.Story.ROA_ROWELL = ROA_ROWELL;

  R.onData(function () {
    R.onData(function () {
      const K = R.ContentF.kit, L = K.L;
      for (const id of Object.keys(TOWNS)) {
        const m = R.DB.maps[id], t = TOWNS[id], lk = LOOK[t.look];
        if (!m) continue;
        m.npcs = m.npcs || [];
        m.npcs.push(
          K.npc('story_rumor_' + id, lk.rumor, t.rumor[0], t.rumor[1], { name: R.T('map.story_links.name'), dir: 's', talk: 'story_rumor', reward: 'news', cond: { tier: 2 } }),
          K.npc('story_scribe_' + id, 'npc_scribe', t.scribe[0], t.scribe[1], { name: R.T('map.story_links.name_2'), dir: 's', talk: 'story_scribe', reward: 'news', pushable: false, cond: ['story_t4', '!final_clear'] }),
          K.npc('story_child_' + id, lk.child, t.child[0], t.child[1], { name: R.T('map.story_links.name_3'), dir: 's', reward: 'news', cond: { tier: 6 },
            talk: [
              L(R.T('map.story_links.talk.0.L')),
              L({ tier: 7 }, R.T('map.story_links.talk.1.L')),
              L({ tier: 8 }, R.T('map.story_links.talk.2.L')),
            ] }),
        );
      }
      for (const id of Object.keys(OFFICES)) {
        const m = R.DB.maps[id], o = OFFICES[id];
        if (!m) continue;
        m.objects = m.objects || [];
        m.objects.push(K.prop('board', o.x, o.y, { cond: 'story_t4' }), K.exam(o.x, o.y, 'story_decree_board', { cond: 'story_t4' }));
      }
      for (const id of MIST) {
        const m = R.DB.maps[id];
        if (!m || m.weather) continue;
        m.weather = 'mist';
        m.weatherCond = ['story_t4', '!story_t8'];
      }
      const roa = R.DB.maps.roa;
      if (roa) {
        roa.npcs.push(K.npc('story_rowell_roa', 'rowell', ROA_ROWELL[0], ROA_ROWELL[1], { name: R.T('map.story_links.story_rowell_roa.name'), dir: 's', talk: 'story_rowell_roa', reward: null, pushable: false,
          cond: ['story_t7', '!final_roa', '!final_roa_scene'] }));
      }
    });
  });
})(window.RPG);
