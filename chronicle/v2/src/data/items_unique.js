// 伸びる一品物 u_*（RULES。V2_PLAN §2.6.6・§3.7、WORLD_REDESIGN §2.7）。
// 名前・見た目・効果（mods）は固定、攻撃力・守備力などの数値は「もらったときのティア」で決まる:
//   R.State.gain(id) が R.Rules.fillItem(item, {tier}) の値を R.Game.uniques[id] = {tier, atk, mag, def, mdef, eva, abil} に写し、
//   R.Rules.stats・preview・店の比べ合いはその個体の値を読む（R.Rules.itemOf(id)）。ここに書いた tier は図鑑・一覧用の目安（0）。
// 森の 4 つ（u_hans_axe・u_ben_whistle・u_roy_charm・u_pim_cap）は「どれを選んでも同じ強さ」（WORLD_REDESIGN §4.1 森の選択）:
//   武器・頭は同じティアの通常品＋等級 rare の数値、アクセサリ 2 つは効果で釣り合わせる。
(function (R) {
  'use strict';
  const U = (slot, name, o) => Object.assign({ name, slot, grade: 'rare', tier: 0, src: 'unique', grow: 'tier', price: 0 }, o);
  R.defs('items', {
    u_hans_axe: U('weapon', R.T('items.u_hans_axe.weapon'), { wtype: 'greatsword', art: 'axe', units: 's1v1', mult: 1.4, crit: 2, vs: { plant: 1.5 }, icon: 'greatsword',
      desc: R.T('items.u_hans_axe.weapon.desc') }),
    u_ben_whistle: U('acc', R.T('items.u_ben_whistle.acc'), { mods: { preemptPct: 10, escapePct: 25, spd: 4 }, icon: 'ring',
      desc: R.T('items.u_ben_whistle.acc.desc') }),
    u_roy_charm: U('acc', R.T('items.u_roy_charm.acc'), { mods: { hpPct: 6, statusResist: { poison: 0.5, sleep: 0.5 } }, icon: 'ring',
      desc: R.T('items.u_roy_charm.acc.desc') }),
    u_pim_cap: U('head', R.T('items.u_pim_cap.head'), { weight: 'light', mods: { glimPct: { tech: 10, spell: 10 } }, icon: 'helm',
      desc: R.T('items.u_pim_cap.head.desc') }),
    // 寄り道の一品物（縦切りでは「あとで」の場所。WORLD_REDESIGN §2.7 #2・#5）
    u_windchime: U('acc', R.T('items.u_windchime.acc'), { mods: { encounterPct: -15 }, icon: 'ring', desc: R.T('items.u_windchime.acc.desc') }),
    u_twin_bow: U('weapon', R.T('items.u_twin_bow.weapon'), { wtype: 'bow', units: 'd2', hit: 5, crit: 4, icon: 'bow', desc: R.T('items.u_twin_bow.weapon.desc') }),
  });
})(window.RPG);
