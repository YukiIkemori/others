// EVENTS のブラウザのテストとスクショ用のイベント・手がかり（id は ev_ で始める。本物の中身は CONTENT-P・F が書く）。
// tools/test_events_browser.js がページに読み込む（FIELD の試しのマップ dev_test_field_fx.html の上で動かす）。
// 地方 r_forest の見出し（章題・ページ・光の柱の場所）は CONTENT-P の R.DB.regions がまだ無いときだけ仮に置く。
(function (R) {
  'use strict';
  const def = (kind, id, obj) => { if (!R.DB[kind][id]) R.DB[kind][id] = obj; };

  def('leads', 'l_ev_forest_missing', {
    title: '森で人が消える', text: 'フェルンの樵が三人、森から\n戻らないらしい。', region: 'r_forest', kind: 'region', from: 'ファロスの酒場', place: 'fern', dir: 'w',
  });
  def('leads', 'l_ev_snow_fire', {
    title: '雪の村の大火祭', text: '北の雪の村は、大火祭の支度で大忙し。', region: 'r_snow', kind: 'rumor', from: 'ファロスの酒場', dir: 'n', slice: 'locked',
  });
  R.DB.regions.r_forest = R.DB.regions.r_forest || { name: 'ヴェルダの森', chapter: { title: '千年樹の歌' }, page: 'k_page_forest' };
  if (!R.DB.regions.r_forest.beacon) R.DB.regions.r_forest.beacon = { map: 'field_fern', x: 20, y: 7 };

  def('events', 'ev_rumor', {
    async run(ev) {
      await ev.say(null, '噂好きの女「西の森の村で、樵が三人帰ってこないんだって。\nそれを探しに、子どもまで森に入ったとか。」', { face: false });
      ev.lead('l_ev_forest_missing');
      ev.lead('l_ev_snow_fire');
    },
    meta: { needs: [], gives: ['l_ev_forest_missing'], calls: [] },
  });
  def('events', 'ev_song', {
    async run(ev) {
      const r = await ev.mini.sequence({ title: 'リタの歌あわせ', symbols: 4, rounds: 3, tempo: 520, theme: 'forest', seed: 'ev_song' });
      ev.setVar('ev_song_score', r.score);
      window.__evSong = r;
    },
    meta: { needs: [], gives: [], calls: [] },
  });
  def('events', 'ev_clear', {
    async run(ev) {
      await ev.clearRegion('r_forest');
      window.__evCleared = true;
    },
    meta: { needs: [], gives: ['cleared_r_forest'], calls: [] },
  });
  def('events', 'story_t1', {
    async run(ev, ctx) {
      window.__evT1 = ctx.reason;
      await ev.say(null, '（T1 の場面の仮。中身は CONTENT-P の story_t1）', { face: false });
    },
    meta: { needs: [], gives: [], calls: [] },
  });
})(window.RPG);
