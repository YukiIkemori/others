// （RULES。今の木の src/data/statuses.js から「そのまま」移した。tools/port/port_techs.js）
// 状態（悪い状態 9・即死・良い状態 5）。DESIGN §7.9.2 が正本、働きは §4.8.1、身軽は §7.3.4-1、かばうは §6.2.4-B。
//   turns: null = 治るまで（戦闘の終わりまで） / [min, max] = かかったときに決める手番の数 / 'next' = 次の自分の手番まで
//   bossTurns: ボス・レア魔物のときの持続   disable: 動けなくなる状態（同時に 1 つだけ）   instant: その場で効く効果（即死）
//   persists はすべて false（戦闘の終わりにすべて消える）。cure:'all' が消すのは bad && !instant のもの。
//   このオブジェクトの並びが、戦闘の状態の印を並べる順（§11.13）。icon の 1 字はメニューで使う。
(function (R) {
  'use strict';
  Object.assign(R.DB.statuses, {
    poison:   { name: R.T('statuses.poison.name'),        bad: true,  persists: false, turns: null,       icon: R.T('statuses.poison.icon'), on: R.T('statuses.poison.on'),     off: R.T('statuses.poison.off') },
    burn:     { name: R.T('statuses.burn.name'),    bad: true,  persists: false, turns: [3, 3],     icon: R.T('statuses.burn.icon'), on: R.T('statuses.burn.on'),      off: R.T('statuses.burn.off') },
    sleep:    { name: R.T('statuses.sleep.name'),      bad: true,  persists: false, turns: [2, 4], bossTurns: [1, 1], disable: true, icon: R.T('statuses.sleep.icon'), on: R.T('statuses.sleep.on'), off: R.T('statuses.sleep.off') },
    paralyze: { name: R.T('statuses.paralyze.name'),      bad: true,  persists: false, turns: [1, 3], bossTurns: [1, 1], disable: true, icon: R.T('statuses.paralyze.icon'), on: R.T('statuses.paralyze.on'), off: R.T('statuses.paralyze.off') },
    freeze:   { name: R.T('statuses.freeze.name'),      bad: true,  persists: false, turns: [1, 2], bossTurns: [1, 1], disable: true, icon: R.T('statuses.freeze.icon'), on: R.T('statuses.freeze.on'), off: R.T('statuses.freeze.off') },
    stun:     { name: R.T('statuses.stun.name'),      bad: true,  persists: false, turns: [1, 1], disable: true, icon: R.T('statuses.stun.icon'), on: R.T('statuses.stun.on'), off: R.T('statuses.stun.off') },
    confuse:  { name: R.T('statuses.confuse.name'),      bad: true,  persists: false, turns: [2, 4], bossTurns: [1, 2], icon: R.T('statuses.confuse.icon'), on: R.T('statuses.confuse.on'), off: R.T('statuses.confuse.off') },
    silence:  { name: R.T('statuses.silence.name'),      bad: true,  persists: false, turns: [3, 5],     icon: R.T('statuses.silence.icon'), on: R.T('statuses.silence.on'),     off: R.T('statuses.silence.off') },
    blind:    { name: R.T('statuses.blind.name'),      bad: true,  persists: false, turns: [3, 5],     icon: R.T('statuses.blind.icon'), on: R.T('statuses.blind.on'), off: R.T('statuses.blind.off') },
    death:    { name: R.T('statuses.death.name'),      bad: true,  persists: false, instant: true,     icon: '',   on: R.T('statuses.death.on'),           off: '' },
    regen:    { name: R.T('statuses.regen.name'),      bad: false, persists: false, turns: [5, 5],     icon: R.T('statuses.regen.icon'), on: R.T('statuses.regen.on'), off: R.T('statuses.regen.off') },
    veil:     { name: R.T('statuses.veil.name'),      bad: false, persists: false, turns: [3, 3],     icon: R.T('statuses.veil.icon'), on: R.T('statuses.veil.on'),     off: R.T('statuses.veil.off') },
    counter:  { name: R.T('statuses.counter.name'), bad: false, persists: false, turns: 'next',    icon: R.T('statuses.counter.icon'), on: R.T('statuses.counter.on'), off: '' },
    nimble:   { name: R.T('statuses.nimble.name'),      bad: false, persists: false, turns: [3, 3],     icon: R.T('statuses.nimble.icon'), on: R.T('statuses.nimble.on'),       off: R.T('statuses.nimble.off') },
    cover:    { name: R.T('statuses.cover.name'),    bad: false, persists: false, turns: 'next',    icon: R.T('statuses.cover.icon'), on: R.T('statuses.cover.on'), off: '' },   // §6.2.4-B（編集で足した。批評 22）
  });
})(window.RPG);
