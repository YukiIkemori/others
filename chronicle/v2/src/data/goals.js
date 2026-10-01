// MENUS: 「次にやること」の表（R.DB.goals。R.Leads.goal() が読む。メニューの上と、フィールドの L の札）
//   本筋の進み（序章 → 森 → 体験版の終わり）を 1 行で。上から順に並べ、今の状態で at が真の「いちばん下の段」が今の目標。
//     at:   その段に来た条件（R.State.check。前の段の条件は含めなくてよい。フィクスチャのように途中の旗が欠けていても後ろの段を選ぶ）
//     text: 1 行の文か [{when?, text}]（when が真の最初の物。when の無い物が既定）
//     lead: その段の手がかり（メニューの札の横に「手がかり帳」と出す用。無くてよい）
//   文の中の {flags:a,b,c} は立っている旗の数、{var:x} は変数の値。
//   先の出来事は書かない（ボスの名前・誰が出てくるか・何が起きるかは言わない）。場所と人の名前は、その段で聞いている物だけ。
(function (R) {
  'use strict';
  const FOUR = 'forest_found_hans,forest_found_ben,forest_found_roy,forest_found_pim';
  const ALL_FOUND = ['forest_found_hans', 'forest_found_ben', 'forest_found_roy', 'forest_found_pim'];
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
    // ---------------------------------------------------------------- 旅立ち（うわさ → 森）
    g_rumors: { n: 80, at: 'prologue_done', lead: 'l_main_rumors', text: R.T('goals.g_rumors.text') },
    g_fern: { n: 90, at: { lead: 'l_rumor_forest' }, lead: 'l_rumor_forest', text: R.T('goals.g_fern.text') },
    g_gord: { n: 100, at: 'forest_start', lead: 'l_forest_board', text: [
      { when: { any: ['forest_board', { lead: 'l_forest_board' }] }, text: R.T('goals.g_gord.text.0.text') },
      { text: R.T('goals.g_gord.text.1.text') },
    ] },
    g_search: { n: 110, at: 'forest_gord_talked', lead: 'l_forest_woodcutters', text: [
      { when: { not: { any: ['forest_found_pim', { lead: 'l_forest_pim' }] } }, text: R.T('goals.g_search.text.0.text') },
      { text: R.T('goals.g_search.text.1.text', { FOUR }) },
    ] },
    g_song: { n: 120, at: ALL_FOUND, lead: 'l_forest_song', text: R.T('goals.g_song.text') },
    g_elder: { n: 130, at: ALL_FOUND.concat([{ var: 'forest_verses', gte: 3 }]), text: R.T('goals.g_elder.text') },
    g_rest: { n: 140, at: 'cleared_r_forest', text: R.T('goals.g_rest.text') },
    // ---------------------------------------------------------------- 体験版の終わりのあと（製品版は次のうわさへ）
    // 製品版では fromLeads: 手がかり帳から今の目標を選ぶ（leads.js leadGoal）。手がかりが無いときだけ下の文
    g_free: { n: 150, at: { any: ['story_t1', 'world_demo_end'] }, fromLeads: true, text: [
      { when: { slice: true }, text: R.T('goals.g_free.text.0.text') },
      { text: R.T('goals.g_free.text.1.text') },
    ] },
  });
})(window.RPG);
