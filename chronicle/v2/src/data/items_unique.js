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
    u_hans_axe: U('weapon', 'きこりの大斧', { wtype: 'greatsword', art: 'axe', units: 's1v1', mult: 1.4, crit: 2, vs: { plant: 1.5 }, icon: 'greatsword',
      desc: '植物に大きなダメージ。\n持ち主とともに強くなる大斧。' }),
    u_ben_whistle: U('acc', 'ベンの呼び笛', { mods: { preemptPct: 10, escapePct: 25, spd: 4 }, icon: 'ring',
      desc: '先制しやすくなる。逃げやすくなる。\nすばやく動ける。' }),
    u_roy_charm: U('acc', 'ロイのお守り', { mods: { hpPct: 6, statusResist: { poison: 0.5, sleep: 0.5 } }, icon: 'ring',
      desc: '最大HPが上がる。\n毒・眠りにかかりにくい。' }),
    u_pim_cap: U('head', 'ピムの帽子', { weight: 'light', mods: { glimPct: { tech: 10, spell: 10 } }, icon: 'helm',
      desc: '技と術を閃きやすい。\n小さな語り部の帽子。' }),
    // 寄り道の一品物（縦切りでは「あとで」の場所。WORLD_REDESIGN §2.7 #2・#5）
    u_windchime: U('acc', '風の鈴', { mods: { encounterPct: -15 }, icon: 'ring', desc: '魔物に出会いにくい。\n風が歌うように鳴る鈴。' }),
    u_twin_bow: U('weapon', '見張りの長弓', { wtype: 'bow', units: 'd2', hit: 5, crit: 4, icon: 'bow', desc: 'よく当たる。会心が出やすい。\n見張り塔に伝わる長弓。' }),
  });
})(window.RPG);
