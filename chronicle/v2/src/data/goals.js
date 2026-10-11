// MENUS: 「次にやること」の表（R.DB.goals と R.DB.goalstories。R.Leads.goal() が読む。メニューの上と、フィールドの L の札）
//   本筋の進みを 1 行で（持ち主 2026-10-11「次に何をすればいいか分からない。『余白　八枚目』では何も分からない。
//   本筋の、すぐ次の一歩を具体的に（次に会う人・向かう場所）。寄り道は要らない」）。二つの表でできている。
//
//   1. R.DB.goals（序章とその後のつなぎ。上から順に並べ、今の状態で at が真の「いちばん下の段」が今の目標）
//        at:        その段に来た条件（R.State.check。前の段の条件は含めなくてよい）
//        text:      1 行の文か [{when?, text}]（when が真の最初の物。when の無い物が既定）
//        fromLeads: 真なら、まず地方の本筋（下の goalstories）を見て、あればそれを出す。無いときだけこの段の文
//        lead:      その段の手がかり（無くてよい）
//   2. R.DB.goalstories（地方ごと・終盤ごとの本筋の道しるべ。地方は好きな順に進むので、段の並びではなく「物語」ごとに持つ）
//        kind:      'region'（地方の本筋）／ 'main'（終盤・ロアへの帰り。地方より先に出す）／
//                   'optional'（寄り道のうわさ。目印を付けたときだけ）／ 'note'（手がかり帳の余白・記録官の物。目印を付けると「今の目標」と同じ文）
//        region:    地方の id（今いる地方・体験版の錠の見分けに使う）
//        arrived:   その物語に入った条件（町に着いた旗など。手がかりを聞いていなくても、着いていれば出す）
//        done:      その物語の終わり（真なら出さない）
//        rumor:     酒場で聞くうわさの手がかり（これだけ聞いた間は「向かおう」。まだ始めていない地方として後ろに回す）
//        leads:     この物語に入る手がかり（地方の手がかりは全部。目印を付けたら、この物語の「今の一歩」を出す）
//        steps:     [{id, when?, text}] 「後ろの一歩」から順に並べ、when が真の最初の物が今の一歩（when の無い物が最初の一歩）。
//                   when の旗は、その地方の出来事（src/events/*.js）が立てる物
//   文の中の {flags:a,b,c} は立っている旗の数、{var:x} は変数の値。
//   先の出来事は書かない（ボスの名前・誰が出てくるか・何が起きるかは言わない）。場所と人の名前は、その一歩で聞いている物だけ。
//   体験版（DB.config.slice）は序章と森まで。ほかの地方は錠のまま（goalstories の region が sliceOpen に無い物は出さない）。
(function (R) {
  'use strict';
  const FOUR = 'forest_found_hans,forest_found_ben,forest_found_roy,forest_found_pim';
  const ALL_FOUND = ['forest_found_hans', 'forest_found_ben', 'forest_found_roy', 'forest_found_pim'];
  // 地方に着いた旗（町や村に入った時に立つ）。序章の旗が欠けた状態（フィクスチャ・テスターで直接その地方へ）でも、地方の道しるべを見る
  const ARRIVED = ['forest_start', 'desert_arrived', 'snow_start', 'marsh_arrived', 'isles_arrived', 'mine_arrived', 'ash_arrived', 'star_arrived'];
  const step = (id, when, key, params) => ({ id, when, text: R.T(key, params) });
  const base = (id, key, params) => ({ id, text: R.T(key, params) });   // when の無い（既定の）一歩

  R.defs('goals', {
    // ---------------------------------------------------------------- 序章（ロア → ファロス → 灯台）
    g_berna: { n: 10, at: true, text: R.T('goals.g_berna.text') },
    g_pharos: { n: 20, at: 'prologue_berna', text: R.T('goals.g_pharos.text') },
    g_tavern: { n: 30, at: 'prologue_pharos', text: [
      { when: '!prologue_berna', text: R.T('goals.g_tavern.text.0.text') },
      { text: R.T('goals.g_tavern.text.1.text') },
    ] },
    g_otto: { n: 40, at: 'prologue_party', text: R.T('goals.g_otto.text') },
    g_lighthouse: { n: 50, at: 'prologue_key', text: R.T('goals.g_lighthouse.text') },
    g_climb: { n: 60, at: 'prologue_tutorial', text: R.T('goals.g_climb.text') },
    g_return: { n: 70, at: 'prologue_boss', text: R.T('goals.g_return.text') },
    // ---------------------------------------------------------------- 旅立ち（うわさ → 好きな地方へ。地方の道しるべは下の goalstories）
    g_rumors: { n: 80, at: { any: ['prologue_done'].concat(ARRIVED) }, fromLeads: true, lead: 'l_main_rumors', text: R.T('goals.g_rumors.text') },
    // 森を解いたあと（場面が起きる前）
    g_rest: { n: 140, at: 'cleared_r_forest', fromLeads: true, text: R.T('goals.g_rest.text') },
    // 体験版の終わりのあと（製品版は次のうわさへ）。地方の道しるべが無いときだけこの文
    g_free: { n: 150, at: { any: ['story_t1', 'world_demo_end'] }, fromLeads: true, text: [
      { when: { slice: true }, text: R.T('goals.g_free.text.0.text') },
      { when: 'final_clear', text: R.T('goals.g_free.done') },
      { text: R.T('goals.g_free.text.1.text') },
    ] },
  });

  // ================================================================ 地方・終盤ごとの本筋の道しるべ
  R.defs('goalstories', {
    // ---------------------------------------------------------------- 森（ヴェルダの森。フェルン）
    forest: {
      n: 10, kind: 'region', region: 'r_forest', arrived: 'forest_start', done: 'cleared_r_forest', rumor: 'l_rumor_forest',
      leads: ['l_rumor_forest', 'l_forest_board', 'l_forest_pim', 'l_forest_woodcutters', 'l_forest_song', 'l_forest_hut'],
      steps: [
        step('elder', ALL_FOUND.concat([{ var: 'forest_verses', gte: 3 }]), 'goals.g_elder.text'),
        step('song', ALL_FOUND, 'goals.g_song.text'),
        step('search', ['forest_gord_talked', { any: ['forest_found_pim', { lead: 'l_forest_pim' }] }], 'goals.g_search.text.1.text', { FOUR }),
        step('katri', 'forest_gord_talked', 'goals.g_search.text.0.text'),
        step('gord', ['forest_start', { any: ['forest_board', { lead: 'l_forest_board' }] }], 'goals.g_gord.text.0.text'),
        step('board', 'forest_start', 'goals.g_gord.text.1.text'),
        base('fern', 'goals.g_fern.text'),
      ],
    },
    // ---------------------------------------------------------------- 砂漠（カシム → 隊商の護衛 → 王墓）
    desert: {
      n: 20, kind: 'region', region: 'r_desert', arrived: 'desert_arrived', done: 'cleared_r_desert', rumor: 'l_rumor_desert',
      leads: ['l_rumor_desert', 'l_desert_caravan', 'l_desert_spring', 'l_desert_song', 'l_desert_glyphs', 'l_desert_tomb', 'l_desert_hawks', 'l_desert_sundial'],
      steps: [
        step('deep', 'desert_worm', 'goals.desert.deep'),
        step('tomb', 'desert_camp3_done', 'goals.desert.tomb'),
        step('caravan', 'desert_caravan_on', 'goals.desert.caravan'),
        step('zaid', 'desert_zaid_met', 'goals.desert.zaid'),
        step('guild', 'desert_arrived', 'goals.desert.guild'),
        base('kasim', 'goals.desert.kasim'),
      ],
    },
    // ---------------------------------------------------------------- 雪原（ユール → 大火祭 → 白竜の峰）
    snow: {
      n: 30, kind: 'region', region: 'r_snow', arrived: 'snow_start', done: 'cleared_r_snow', rumor: 'l_rumor_snow',
      leads: ['l_rumor_snow', 'l_snow_prep', 'l_snow_book', 'l_snow_howl', 'l_snow_peak'],
      steps: [
        step('flame', 'snow_giant', 'goals.snow.flame'),
        step('peak', 'snow_dawn', 'goals.snow.peak'),
        step('siege', 'snow_festival_lit', 'goals.snow.siege'),
        step('festival', ['snow_logs_done', 'snow_tales_done'], 'goals.snow.festival'),
        step('tales', 'snow_logs_done', 'goals.snow.tales', { F: 'snow_tale_dragon,snow_tale_hunter,snow_tale_fire_child' }),
        step('logs', 'snow_jorn_talked', 'goals.snow.logs'),
        step('jorn', 'snow_start', 'goals.snow.jorn'),
        base('yule', 'goals.snow.yule'),
      ],
    },
    // ---------------------------------------------------------------- 湿原（ロッホ → 証拠 → 集会 → 沼）
    marsh: {
      n: 40, kind: 'region', region: 'r_marsh', arrived: 'marsh_arrived', done: 'cleared_r_marsh', rumor: 'l_rumor_marsh',
      leads: ['l_rumor_marsh', 'l_marsh_mist', 'l_marsh_emma', 'l_marsh_evidence', 'l_marsh_assembly', 'l_marsh_manor', 'l_marsh_bog',
        'l_marsh_ev_foot', 'l_marsh_ev_book', 'l_marsh_ev_doll', 'l_marsh_ev_drawing', 'l_marsh_ev_melda', 'l_marsh_ev_stone'],
      steps: [
        step('bells', ['marsh_assembly_done', { item: 'k_bell_key' }], 'goals.marsh.bells', { F: 'marsh_bell_1,marsh_bell_2,marsh_bell_3' }),
        step('key', 'marsh_assembly_done', 'goals.marsh.key'),
        step('assembly', { var: 'marsh_evidence', gte: 4 }, 'goals.marsh.assembly'),
        step('evidence', 'marsh_emma_met', 'goals.marsh.evidence'),
        step('emma', 'marsh_arrived', 'goals.marsh.emma'),
        base('loch', 'goals.marsh.loch'),
      ],
    },
    // ---------------------------------------------------------------- 諸島（コーラル → 外洋船 → ネレイ → 霧の海）
    isles: {
      n: 50, kind: 'region', region: 'r_isles', arrived: 'isles_arrived', done: 'cleared_r_isles', rumor: 'l_rumor_isles',
      leads: ['l_rumor_isles', 'l_isles_harbor', 'l_isles_ship', 'l_isles_shell', 'l_isles_song', 'l_isles_chart', 'l_isles_fog'],
      steps: [
        step('ghost', 'isles_fog_open', 'goals.isles.ghost'),
        step('pier', ['isles_ship', 'isles_fog_found', 'isles_song_ready'], 'goals.isles.pier'),
        step('marina_again', ['isles_ship', 'isles_fog_found', 'isles_marina_met', { any: ['isles_siren_heard', 'isles_marina_night'] }], 'goals.isles.marina_again'),
        step('marina_inn', ['isles_ship', 'isles_fog_found', 'isles_marina_met'], 'goals.isles.marina_inn'),
        step('marina_meet', ['isles_ship', 'isles_fog_found'], 'goals.isles.marina_meet'),
        step('chart', ['isles_ship', 'isles_chart_got'], 'goals.isles.chart'),
        step('harbor', 'isles_ship', 'goals.isles.harbor'),
        step('deliver', { item: 'k_glow_shell' }, 'goals.isles.deliver'),
        step('shell', 'isles_drake_met', 'goals.isles.shell'),
        step('drake', 'isles_arrived', 'goals.isles.drake'),
        base('ferry', 'goals.isles.ferry'),
      ],
    },
    // ---------------------------------------------------------------- 山地（ドヴァン → 坑道の救出 → 集会 → 七の層）
    mine: {
      n: 60, kind: 'region', region: 'r_mine', arrived: 'mine_arrived', done: 'cleared_r_mine', rumor: 'l_rumor_mine',
      leads: ['l_rumor_mine', 'l_mine_trapped', 'l_mine_guild', 'l_mine_smiths', 'l_mine_stone', 'l_mine_seven', 'l_mine_door', 'l_mine_warden'],
      steps: [
        step('warden', 'mine_choice', 'goals.mine.warden'),
        step('hall', 'mine_door_seen', 'goals.mine.hall'),
        step('seven', 'mine_rescued_all', 'goals.mine.seven'),
        step('rescue', 'mine_watch_met', 'goals.mine.rescue', { F: 'mine_miner1,mine_miner2,mine_pip' }),
        step('watch', 'mine_arrived', 'goals.mine.watch'),
        base('dovan', 'goals.mine.dovan'),
      ],
    },
    // ---------------------------------------------------------------- 灰の荒野（カルデラ → 闘技大会 → 灰の火山）
    ash: {
      n: 70, kind: 'region', region: 'r_ash', arrived: 'ash_arrived', done: 'cleared_r_ash', rumor: 'l_rumor_ash',
      leads: ['l_rumor_ash', 'l_ash_trial', 'l_ash_egg', 'l_ash_stranger', 'l_ash_volcano', 'l_ash_murals'],
      steps: [
        step('egg', 'ash_lavabeast', 'goals.ash.egg'),
        step('crater', ['ash_champion', { var: 'ash_murals', gte: 3 }], 'goals.ash.crater'),
        step('murals', ['ash_champion', 'ash_volcano_seen'], 'goals.ash.murals'),
        step('volcano', 'ash_champion', 'goals.ash.volcano'),
        step('arena', 'ash_entered', 'goals.ash.arena'),
        step('enter', 'ash_arrived', 'goals.ash.enter'),
        base('caldera', 'goals.ash.caldera'),
      ],
    },
    // ---------------------------------------------------------------- 高原（オルビス → 学院への潜入 → 星読みの塔）
    star: {
      n: 80, kind: 'region', region: 'r_star', arrived: 'star_arrived', done: 'cleared_r_star', rumor: 'l_rumor_star',
      leads: ['l_rumor_star', 'l_star_stars', 'l_star_tower', 'l_star_message', 'l_star_prep', 'l_star_vault', 'l_star_summit', 'l_star_margin'],
      steps: [
        step('names', 'star_stareater', 'goals.star.names'),
        step('climb', 'star_tower_open', 'goals.star.climb'),
        step('tower', 'star_chart_got', 'goals.star.tower'),
        step('chart', 'star_vault_open', 'goals.star.chart'),
        step('vault', 'star_night_seen', 'goals.star.vault'),
        step('sneak', 'star_ready', 'goals.star.sneak'),
        step('prep', 'star_message', 'goals.star.prep', { F: 'star_prep_key,star_prep_route,star_prep_uniform' }),
        step('library', 'star_gate_seen', 'goals.star.library'),
        step('gate', 'star_luca_met', 'goals.star.gate'),
        step('observatory', 'star_arrived', 'goals.star.observatory'),
        base('orbis', 'goals.star.orbis'),
      ],
    },
    // ---------------------------------------------------------------- 六つ目のあとのロア（フィーネに言われた帰り道。終盤より前）
    roa6: {
      n: 250, kind: 'main', region: 'world', arrived: 'story_t6', done: 'story_roa_t6',
      leads: ['l_main_roa_t6'],
      steps: [base('roa', 'goals.roa6.roa')],
    },
    // ---------------------------------------------------------------- 終盤（八つ目のあと。ロア → ビブリアへの船 → 白の大書庫）
    finale: {
      n: 300, kind: 'main', region: 'finale', arrived: 'story_t8', done: 'final_clear',
      leads: ['l_main_final_roa', 'l_main_final_ferry', 'l_main_final_archive'],
      steps: [
        step('top', 'final_lazaro', 'goals.finale.top'),
        step('up', 'final_rowell', 'goals.finale.up'),
        step('seal', 'final_golem', 'goals.finale.seal'),
        step('climb', 'final_archive_seen', 'goals.finale.climb'),
        step('archive', 'final_arrived', 'goals.finale.archive'),
        step('ferry', 'final_open', 'goals.finale.ferry'),
        base('roa', 'goals.finale.roa'),
      ],
    },
    // ---------------------------------------------------------------- クリア後（忘却の底）
    post: {
      n: 310, kind: 'main', region: 'finale', arrived: 'final_clear', done: 'oblivion_ouroboros',
      leads: ['l_post_oblivion'],
      steps: [
        step('bottom', 'oblivion_echo', 'goals.post.bottom'),
        step('down', 'oblivion_1_arrive', 'goals.post.down'),
        base('stairs', 'goals.post.stairs'),
      ],
    },

    // ---------------------------------------------------------------- 寄り道（目印を付けたときだけ。1 本ずつ）
    opt_roa_t3: { kind: 'optional', leads: ['l_main_roa_t3'], steps: [base('go', 'goals.opt.l_main_roa_t3')] },
    opt_well: { kind: 'optional', leads: ['l_opt_well'], steps: [base('go', 'goals.opt.l_opt_well')] },
    opt_windhill: { kind: 'optional', leads: ['l_opt_windhill'], steps: [base('go', 'goals.opt.l_opt_windhill')] },
    opt_hut: { kind: 'optional', leads: ['l_opt_hut'], steps: [base('go', 'goals.opt.l_opt_hut')] },
    opt_yura: { kind: 'optional', leads: ['l_opt_yura'], steps: [base('go', 'goals.opt.l_opt_yura')] },
    opt_sandedge: { kind: 'optional', leads: ['l_opt_sandedge'], steps: [base('go', 'goals.opt.l_opt_sandedge')] },
    opt_mirage: { kind: 'optional', leads: ['l_opt_mirage'], steps: [base('go', 'goals.opt.l_opt_mirage')] },
    opt_temple: { kind: 'optional', leads: ['l_opt_temple'], steps: [base('go', 'goals.opt.l_opt_temple')] },
    opt_rocks: { kind: 'optional', leads: ['l_opt_rocks'], steps: [base('go', 'goals.opt.l_opt_rocks')] },
    opt_hawknest: { kind: 'optional', leads: ['l_opt_hawknest'], steps: [base('go', 'goals.opt.l_opt_hawknest')] },
    opt_icicle: { kind: 'optional', leads: ['l_opt_icicle'], steps: [base('go', 'goals.opt.l_opt_icicle')] },
    opt_pass_inn: { kind: 'optional', leads: ['l_opt_pass_inn'], steps: [base('go', 'goals.opt.l_opt_pass_inn')] },
    opt_aurora: { kind: 'optional', leads: ['l_opt_aurora'], steps: [base('go', 'goals.opt.l_opt_aurora')] },
    opt_frost_ship: { kind: 'optional', leads: ['l_opt_frost_ship'], steps: [base('go', 'goals.opt.l_opt_frost_ship')] },
    opt_snow_fox: { kind: 'optional', leads: ['l_snow_fox'], steps: [base('go', 'goals.opt.l_snow_fox')] },
    opt_lotus: { kind: 'optional', leads: ['l_opt_lotus'], steps: [base('go', 'goals.opt.l_opt_lotus')] },
    opt_siren: { kind: 'optional', leads: ['l_opt_siren'], steps: [base('go', 'goals.opt.l_opt_siren')] },
    opt_crab: { kind: 'optional', leads: ['l_opt_crab'], steps: [base('go', 'goals.opt.l_opt_crab')] },
    opt_whale: { kind: 'optional', leads: ['l_opt_whale'], steps: [base('go', 'goals.opt.l_opt_whale')] },
    opt_volk: { kind: 'optional', leads: ['l_opt_volk'], steps: [base('go', 'goals.opt.l_opt_volk')] },
    opt_vein: { kind: 'optional', leads: ['l_opt_vein'], steps: [base('go', 'goals.opt.l_opt_vein')] },
    opt_hermit: { kind: 'optional', leads: ['l_opt_hermit'], steps: [base('go', 'goals.opt.l_opt_hermit')] },
    opt_spa: { kind: 'optional', leads: ['l_opt_spa'], steps: [base('go', 'goals.opt.l_opt_spa')] },
    opt_turtle: { kind: 'optional', leads: ['l_opt_turtle'], steps: [base('go', 'goals.opt.l_opt_turtle')] },
    opt_battlefield: { kind: 'optional', leads: ['l_opt_battlefield'], steps: [base('go', 'goals.opt.l_opt_battlefield')] },
    opt_starfall: { kind: 'optional', leads: ['l_opt_starfall'], steps: [base('go', 'goals.opt.l_opt_starfall')] },
    opt_clockbird: { kind: 'optional', leads: ['l_opt_clockbird'], steps: [base('go', 'goals.opt.l_opt_clockbird')] },

    // ---------------------------------------------------------------- 手がかり帳の覚え書き（余白・記録官の物・うわさの案内。段ではない。目印を付けたら「今の目標」と同じ文を出す）
    notes: {
      kind: 'note',
      leads: ['l_main_rumors', 'l_rumor_mira',
        'l_main_recorder_forest', 'l_main_recorder_desert', 'l_main_recorder_snow', 'l_main_recorder_marsh',
        'l_main_recorder_isles', 'l_main_recorder_mine', 'l_main_recorder_ash', 'l_main_recorder_star',
        'l_main_margin_1', 'l_main_margin_2', 'l_main_margin_3', 'l_main_margin_4', 'l_main_margin_5', 'l_main_margin_6', 'l_main_margin_7', 'l_main_margin_8',
        'l_main_margin_named', 'l_main_margin_noa', 'l_main_margin_study'],
    },
  });
})(window.RPG);
