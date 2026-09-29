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
    g_berna: { n: 10, at: true, text: '師匠ベルナと話そう' },
    g_pharos: { n: 20, at: 'prologue_berna', text: '里を出て、南東の港町ファロスへ向かおう' },
    g_tavern: { n: 30, at: 'prologue_pharos', text: [
      { when: '!prologue_berna', text: 'ロアの里の師匠ベルナと話そう' },
      { text: 'ファロスの酒場「潮風亭」で、旅の仲間を探そう' },
    ] },
    g_otto: { n: 40, at: 'prologue_party', text: '港にいる灯台守オットーを訪ねよう' },
    g_lighthouse: { n: 50, at: 'prologue_key', text: '町の南、岬の先のファロス灯台へ向かおう' },
    g_climb: { n: 60, at: 'prologue_tutorial', text: '灯台を上って、てっぺんの灯室を目指そう' },
    g_return: { n: 70, at: 'prologue_boss', text: 'ファロスの町へ戻ろう' },
    // ---------------------------------------------------------------- 旅立ち（うわさ → 森）
    g_rumors: { n: 80, at: 'prologue_done', lead: 'l_main_rumors', text: '潮風亭で、うわさを聞いてみよう' },
    g_fern: { n: 90, at: { lead: 'l_rumor_forest' }, lead: 'l_rumor_forest', text: '西の森の村フェルンへ向かおう' },
    g_gord: { n: 100, at: 'forest_start', lead: 'l_forest_board', text: [
      { when: { any: ['forest_board', { lead: 'l_forest_board' }] }, text: 'フェルンのきこり頭ゴードの家を訪ねよう' },
      { text: 'フェルンの広場の掲示板を見てみよう' },
    ] },
    g_search: { n: 110, at: 'forest_gord_talked', lead: 'l_forest_woodcutters', text: [
      { when: { not: { any: ['forest_found_pim', { lead: 'l_forest_pim' }] } }, text: 'ゴードの女房カトリに、息子のことを聞こう' },
      { text: `迷いの森で、行方知れずの四人を探そう（{flags:${FOUR}}/4 人）` },
    ] },
    g_song: { n: 120, at: ALL_FOUND, lead: 'l_forest_song', text: '迷いの森の歌の石を探そう（{var:forest_verses}/3）' },
    g_elder: { n: 130, at: ALL_FOUND.concat([{ var: 'forest_verses', gte: 3 }]), text: '森の奥、千年樹のもとへ向かおう' },
    g_rest: { n: 140, at: 'cleared_r_forest', text: '村か里に戻って、ひと休みしよう' },
    // ---------------------------------------------------------------- 体験版の終わりのあと（製品版は次のうわさへ）
    g_free: { n: 150, at: { any: ['story_t1', 'world_demo_end'] }, text: [
      { when: { slice: true }, text: '体験版はここまで。森と半島の依頼や寄り道をどうぞ' },
      { text: '潮風亭で、次のうわさを聞いてみよう' },
    ] },
  });
})(window.RPG);
