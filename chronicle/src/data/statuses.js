// 状態（悪い状態 9・即死・良い状態 5）。DESIGN §7.9.2 が正本、働きは §4.8.1、身軽は §7.3.4-1、かばうは §6.2.4-B。
//   turns: null = 治るまで（戦闘の終わりまで） / [min, max] = かかったときに決める手番の数 / 'next' = 次の自分の手番まで
//   bossTurns: ボス・レア魔物のときの持続   disable: 動けなくなる状態（同時に 1 つだけ）   instant: その場で効く効果（即死）
//   persists はすべて false（戦闘の終わりにすべて消える）。cure:'all' が消すのは bad && !instant のもの。
//   このオブジェクトの並びが、戦闘の状態の印を並べる順（§11.13）。icon の 1 字はメニューで使う。
(function (R) {
  'use strict';
  Object.assign(R.DB.statuses, {
    poison:   { name: '毒',        bad: true,  persists: false, turns: null,       icon: '毒', on: '{name}は毒におかされた！',     off: '{name}の毒が消えた。' },
    burn:     { name: 'やけど',    bad: true,  persists: false, turns: [3, 3],     icon: '焼', on: '{name}はやけどを負った！',      off: '{name}のやけどが治った。' },
    sleep:    { name: '眠り',      bad: true,  persists: false, turns: [2, 4], bossTurns: [1, 1], disable: true, icon: '眠', on: '{name}は眠ってしまった！', off: '{name}は目を覚ました！' },
    paralyze: { name: 'まひ',      bad: true,  persists: false, turns: [1, 3], bossTurns: [1, 1], disable: true, icon: '麻', on: '{name}は体がしびれて動けない！', off: '{name}のまひが治った。' },
    freeze:   { name: '凍結',      bad: true,  persists: false, turns: [1, 2], bossTurns: [1, 1], disable: true, icon: '凍', on: '{name}は凍りついた！', off: '{name}の氷が溶けた。' },
    stun:     { name: '気絶',      bad: true,  persists: false, turns: [1, 1], disable: true, icon: '気', on: '{name}は気を失った！', off: '{name}は気がついた。' },
    confuse:  { name: '混乱',      bad: true,  persists: false, turns: [2, 4], bossTurns: [1, 2], icon: '混', on: '{name}は混乱した！', off: '{name}は正気に戻った。' },
    silence:  { name: '沈黙',      bad: true,  persists: false, turns: [3, 5],     icon: '黙', on: '{name}は術を封じられた！',     off: '{name}は術を使えるようになった。' },
    blind:    { name: '暗闇',      bad: true,  persists: false, turns: [3, 5],     icon: '暗', on: '{name}は目が見えなくなった！', off: '{name}の目が見えるようになった。' },
    death:    { name: '即死',      bad: true,  persists: false, instant: true,     icon: '',   on: '{name}は息絶えた！',           off: '' },
    regen:    { name: '再生',      bad: false, persists: false, turns: [5, 5],     icon: '再', on: '{name}は再生の力に包まれた！', off: '{name}の再生の力が消えた。' },
    veil:     { name: '加護',      bad: false, persists: false, turns: [3, 3],     icon: '護', on: '{name}は加護に守られた！',     off: '{name}の加護が消えた。' },
    counter:  { name: '反撃の構え', bad: false, persists: false, turns: 'next',    icon: '構', on: '{name}は反撃の構えをとった！', off: '' },
    nimble:   { name: '身軽',      bad: false, persists: false, turns: [3, 3],     icon: '軽', on: '{name}は身軽になった！',       off: '{name}の身軽さが消えた。' },
    cover:    { name: 'かばう',    bad: false, persists: false, turns: 'next',    icon: '守', on: '{name}は仲間の前に立ちはだかった！', off: '' },   // §6.2.4-B（編集で足した。批評 22）
  });
})(window.RPG);
