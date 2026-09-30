// CONTENT-P（ティアの場面 T2〜T7）: 本筋の大事な物。STORY_BIBLE §6.3 の T5・§10.2 の 43
//   ベルナの封書（T5 の二通目の手紙の中。表に「ロアに帰ったら開けて」。T6 のロアで開ける。寄らなければ終盤のロアで）
(function (R) {
  'use strict';
  const K = (name, desc, o) => Object.assign({ name, slot: 'key', grade: 'normal', tier: 0, price: 0, src: 'key', desc, icon: 'key' }, o || {});
  const KEYS = {
    k_berna_sealed: K(R.T('data.items_story.KEYS.k_berna_sealed.K'), R.T('data.items_story.KEYS.k_berna_sealed.K_2'), { icon: 'journal' }),
  };
  let n = 0;
  for (const id of Object.keys(KEYS)) { KEYS[id].sort = 9580 + n++; R.def('items', id, KEYS[id]); }
})(window.RPG);
