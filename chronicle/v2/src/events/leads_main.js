// CONTENT-P: 手がかり帳の本筋・世界・ファロスの依頼（R.DB.leads、K.lead。V2_PLAN §3.5、WORLD_REDESIGN §3.2）と、
// 序章・世界の読み物（R.DB.lore、STORY_BIBLE §10.2 の lo_*。契約の外の表 → TODO(リード): K.lore と手がかり帳の「書庫」のタブ）。
//   region: 'world' = 世界のうわさ・本筋、'prologue' = ファロス半島、'r_<rs>' = 地方（地方の見出しでまとめる）
//   slice:'locked' = 縦切りで行けない地方のうわさ（帳には入るが「この先は、まだ語られていない」と薄く出す）
//   地方の手がかり（l_forest_*）と森の依頼（q_fern_* q_forest_*）、森の寄り道のうわさ（l_opt_hut・l_opt_yura）は CONTENT-F が forest_*.js に書く。
(function (R) {
  'use strict';
  R.defs('leads', {
    // ---------------------------------------------------------------- 本筋（main）
    l_main_rumors: {
      title: R.T('leads.l_main_rumors.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_rumors.from'), place: 'pharos', dir: R.T('leads.l_main_rumors.dir'),
      text: R.T('leads.l_main_rumors.text'),
      done: { any: ['cleared_r_forest', { lead: 'l_rumor_forest' }] },
    },
    l_main_recorder_forest: {
      title: R.T('leads.l_main_recorder_forest.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_recorder_forest.from'), place: 'hut', dir: R.T('leads.l_main_recorder_forest.dir'),
      text: R.T('leads.l_main_recorder_forest.text'),
    },
    l_main_margin_1: {
      title: R.T('leads.l_main_margin_1.title'), kind: 'main', region: 'world', from: R.T('leads.l_main_margin_1.from'),
      text: R.T('leads.l_main_margin_1.text'),
    },

    // ---------------------------------------------------------------- 潮風亭のうわさ（rumor、ティア 0。森以外は縦切りでは行けない）
    l_rumor_forest: {
      title: R.T('leads.l_rumor_forest.title'), kind: 'rumor', region: 'r_forest', from: R.T('leads.l_rumor_forest.from'), place: 'fern', dir: R.T('leads.l_rumor_forest.dir'),
      text: R.T('leads.l_rumor_forest.text'),
      done: 'cleared_r_forest',
    },
    l_rumor_snow: {
      title: R.T('leads.l_rumor_snow.title'), kind: 'rumor', region: 'r_snow', from: R.T('leads.l_rumor_snow.from'), place: 'yule', dir: R.T('leads.l_rumor_snow.dir'),
      text: R.T('leads.l_rumor_snow.text'), done: 'cleared_r_snow',
    },
    l_rumor_desert: {
      title: R.T('leads.l_rumor_desert.title'), kind: 'rumor', region: 'r_desert', from: R.T('leads.l_rumor_desert.from'), place: 'kasim', dir: R.T('leads.l_rumor_desert.dir'),
      text: R.T('leads.l_rumor_desert.text'), done: 'cleared_r_desert',
    },
    l_rumor_marsh: {
      title: R.T('leads.l_rumor_marsh.title'), kind: 'rumor', region: 'r_marsh', from: R.T('leads.l_rumor_marsh.from'), dir: R.T('leads.l_rumor_marsh.dir'), slice: 'locked',
      text: R.T('leads.l_rumor_marsh.text'), done: 'cleared_r_marsh',
    },
    l_rumor_isles: {
      title: R.T('leads.l_rumor_isles.title'), kind: 'rumor', region: 'r_isles', from: R.T('leads.l_rumor_isles.from'), dir: R.T('leads.l_rumor_isles.dir'), slice: 'locked',
      text: R.T('leads.l_rumor_isles.text'), done: 'cleared_r_isles',
    },
    l_rumor_mine: {
      title: R.T('leads.l_rumor_mine.title'), kind: 'rumor', region: 'r_mine', from: R.T('leads.l_rumor_mine.from'), dir: R.T('leads.l_rumor_mine.dir'), slice: 'locked',
      text: R.T('leads.l_rumor_mine.text'), done: 'cleared_r_mine',
    },
    l_rumor_ash: {
      title: R.T('leads.l_rumor_ash.title'), kind: 'rumor', region: 'r_ash', from: R.T('leads.l_rumor_ash.from'), dir: R.T('leads.l_rumor_ash.dir'), slice: 'locked',
      text: R.T('leads.l_rumor_ash.text'), done: 'cleared_r_ash',
    },
    l_rumor_star: {
      title: R.T('leads.l_rumor_star.title'), kind: 'rumor', region: 'r_star', from: R.T('leads.l_rumor_star.from'), dir: R.T('leads.l_rumor_star.dir'), slice: 'locked',
      text: R.T('leads.l_rumor_star.text'), done: 'cleared_r_star',
    },

    // ---------------------------------------------------------------- 寄り道のうわさ（rumor）
    l_opt_well: {
      title: R.T('leads.l_opt_well.title'), kind: 'rumor', region: 'prologue', from: R.T('leads.l_opt_well.from'), place: 'well', dir: R.T('leads.l_opt_well.dir'),
      text: R.T('leads.l_opt_well.text'),
      done: 'prologue_well_nest',
    },
    l_opt_windhill: {
      title: R.T('leads.l_opt_windhill.title'), kind: 'rumor', region: 'r_forest', from: R.T('leads.l_opt_windhill.from'), dir: R.T('leads.l_opt_windhill.dir'),
      text: R.T('leads.l_opt_windhill.text'),
      done: 'prologue_windhill',
    },

    // ---------------------------------------------------------------- ファロスの依頼（side。id は依頼と同じ q_*）
    q_pharos_well: {
      title: R.T('leads.q_pharos_well.title'), kind: 'side', region: 'prologue', from: R.T('leads.q_pharos_well.from'), place: 'well', dir: R.T('leads.q_pharos_well.dir'),
      text: R.T('leads.q_pharos_well.text'),
      done: 'prologue_well_nest',
    },
    q_pharos_lamp: {
      title: R.T('leads.q_pharos_lamp.title'), kind: 'side', region: 'prologue', from: R.T('leads.q_pharos_lamp.from'), dir: R.T('leads.q_pharos_lamp.dir'),
      text: R.T('leads.q_pharos_lamp.text'),
      done: ['prologue_lamp_road', 'prologue_lamp_lookout'],
      offer: 'prologue_done',   // タデオが頼むのは灯台が戻ってから（頭の上の依頼の吹き出し、R.Leads.offerOf）
    },
    q_pharos_delivery: {
      title: R.T('leads.q_pharos_delivery.title'), kind: 'side', region: 'prologue', from: R.T('leads.q_pharos_delivery.from'), place: 'fern', dir: R.T('leads.q_pharos_delivery.dir'),
      text: R.T('leads.q_pharos_delivery.text'),
      done: 'q_pharos_delivery_done',
    },
  });

  // ---------------------------------------------------------------- 読み物（STORY_BIBLE §10.2。序章の分）
  //   {title, text, kind:'main'|'rumor'…, region, must}。調べると R.ContentP.ev.lore(ev, id) がフラグ id を立てる。
  R.defs('lore', {
    lo_roa_stone: { title: R.T('lore.lo_roa_stone.title'), region: 'prologue', must: true, text: R.T('lore.lo_roa_stone.text') },
    lo_roa_seat: { title: R.T('lore.lo_roa_seat.title'), region: 'prologue', must: false, text: R.T('lore.lo_roa_seat.text') },
    lo_roa_register: { title: R.T('lore.lo_roa_register.title'), region: 'prologue', must: true, text: R.T('lore.lo_roa_register.text') },
    lo_ev_prologue: { title: R.T('lore.lo_ev_prologue.title'), region: 'prologue', must: true, text: R.T('lore.lo_ev_prologue.text') },
    lo_lighthouse_song: { title: R.T('lore.lo_lighthouse_song.title'), region: 'prologue', must: true, text: R.T('lore.lo_lighthouse_song.text'), voice: 'v_fine_song_02' },   // voice: 年代記の章で聞き直せる（screens/chronicle.js）
    lo_pharos_oilboard: { title: R.T('lore.lo_pharos_oilboard.title'), region: 'prologue', must: false, text: R.T('lore.lo_pharos_oilboard.text') },
    lo_silent_tract: { title: R.T('lore.lo_silent_tract.title'), region: 'prologue', must: false, text: R.T('lore.lo_silent_tract.text') },
  });
})(window.RPG);
