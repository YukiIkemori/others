#!/usr/bin/env node
// test_boss（BATTLE、2026-10-01 ボスの組み直し）: ボス戦の型の回帰テスト。
//   オーナー「どのボスもワンパターン（溜め → 全体攻撃の繰り返し）」「溜めての即死級はもう飽きた。難しくなるほど色んな角度から」
//   1 序盤の後のボスは予告（溜め → 大技）を使わない。序盤の予告は決まった間隔で回らない（重み 100 未満、2 手番おきの繰り返しが 3 回続かない）
//   2 手の幅: 序盤 3 つ以上・中盤 5 つ以上・終盤 7 つ以上（ふつうの攻撃を除く。お供と合体技も数える）。中盤・終盤は 3 種類以上の角度（ダメージ・状態・弱体…）
//   3 2 回動くのは中盤から: 序盤は 1 回（半分を切っても増えない）、中盤の地方ボスは 2 回、終盤は 2 回以上
//   4 氷壁の巨人・狼の群れ頭: ダメージのある手番が 6 割以上（前は 2〜3 割）
//   5 満タンから 1 ラウンドで全滅しない（台本の sim）・予告と大技の 2 手番の繰り返しがない
'use strict';
const R = require('./lib/load')({ quiet: true });
const { ok, done, section } = require('./lib/testkit');
const { buildParty, STD } = require('./sim_zones');
const SB = require('./sim_bosses');
const D = R.DB, A = D.bossActions, BC = R.BattleCore;
const ACT = (id) => BC.ACT(id);

// 段（地方の順・ティア）: 序章・森・砂漠・ライバル 1 戦目 = 序盤、雪原から = 中盤、白の大書庫・クリア後 = 終盤
const EARLY = { tr_b_pageeater: 'b_pageeater', tr_a21_forest_wolves: 'b_wolflord', tr_b_moth: 'b_moth', tr_b_rooteater: 'b_rooteater', tr_b_hawkchief: 'b_hawk_chief',
  tr_b_sandworm: 'b_sandworm', tr_b_sandking: 'b_sandking', tr_b_rowell1: 'b_rowell1' };
const MID = { tr_b_blizzardwolf_0: 'b_blizzardwolf', tr_b_icegiant: 'b_icegiant', tr_b_whitedragon: 'b_whitedragon', tr_b_dolls: 'b_doll_conductor', tr_b_mistbeast: 'b_mistbeast',
  tr_b_octopus: 'b_octopus', tr_b_captain: 'b_captain', tr_b_rockeater: 'b_rockeater', tr_b_ironwarden: 'b_ironwarden', tr_b_ash_r2: 'b_tamer', tr_b_ash_r3: 'b_sister_elder',
  tr_b_ash_r4: 'b_armorman', tr_b_zakuro: 'b_zakuro', tr_b_hellhound: 'b_hellhound', tr_b_lavabeast: 'b_lavabeast', tr_b_orrery: 'b_orrery', tr_b_stareater: 'b_stareater',
  tr_b_rowell2: 'b_rowell2', tr_b_frost_admiral: 'b_frost_admiral', tr_b_vein_lord: 'b_vein_lord' };
const LATE = { tr_b_bookgolem: 'b_bookgolem', tr_b_heroshades: 'b_shade_sword', tr_b_lazaro: 'b_lazaro', tr_b_nemrea1: 'b_nemrea1', tr_b_nemrea2: 'b_nemrea2',
  tr_b_valzard_echo: 'b_valzard_echo', tr_b_ouroboros: 'b_ouroboros' };
const REGION_MID = ['b_whitedragon', 'b_mistbeast', 'b_captain', 'b_ironwarden', 'b_lavabeast', 'b_stareater'];

const bossMons = (troop) => (D.troops[troop].mons || []).map((e) => (Array.isArray(e) ? e[0] : e)).filter((id) => D.monsters[id] && (D.monsters[id].flags || []).includes('boss'));
/** 行動の種類（表の札）: dmg / status / debuff / buff / heal / summon / field / drain / counter / steal / curse / shift / dispel / revive */
function tags(id) {
  const a = ACT(id);
  if (!a) return [];
  const out = new Set();
  for (const e of a.effects || []) {
    if (e.type === 'damage') { out.add('dmg'); if (e.drain || e.mp) out.add('drain'); }
    else if (e.type === 'status') out.add(e.status === 'counter' ? 'counter' : ['regen', 'veil', 'nimble'].includes(e.status) ? 'buff' : 'status');
    else if (e.type === 'buff') out.add(e.stages < 0 ? 'debuff' : 'buff');
    else if (e.type === 'heal') out.add('heal');
    else if (e.type === 'summon') out.add('summon');
    else if (e.type === 'revive') out.add('revive');
    else if (e.type === 'dispel') out.add('dispel');
    else if (e.type === 'special') out.add({ boss_field: 'field', boss_snatch: 'steal', boss_mark: 'curse', boss_mark_burst: 'curse', boss_shift: 'shift', desert_sweep: 'dmg', desert_orb_absorb: 'buff' }[e.id] || 'special');
  }
  return [...out];
}
/** 編成で使う手（ふつうの攻撃を除く。ボスとお供の行動、予告の次の大技、その編成で出る合体技） */
function movesOf(troop) {
  const ids = new Set(), mons = bossMons(troop);
  for (const m of mons) for (const a of D.monsters[m].actions || []) {
    if (a.id === 'attack') continue;
    ids.add(a.id);
    const T = ACT(a.id) && ACT(a.id).telegraph;
    if (T && T.next) ids.add(T.next);
  }
  let combos = 0;
  for (const [cid, c] of Object.entries(D.enemyCombos || {})) {
    if (!/^c_b_/.test(cid)) continue;
    if ((c.members || []).some((mm) => mm.mon && [].concat(mm.mon).some((x) => mons.includes(x)))) combos++;
  }
  return { ids: [...ids], combos };
}

section('1. 予告（溜め → 大技）');
for (const [troop, id] of Object.entries(Object.assign({}, MID, LATE))) {
  const tele = bossMons(troop).flatMap((m) => D.monsters[m].actions.filter((a) => ACT(a.id) && ACT(a.id).telegraph).map((a) => m + ':' + a.id));
  ok(`${id}: 予告を使わない（中盤・終盤）`, !tele.length, tele);
}
for (const [troop, id] of Object.entries(EARLY)) {
  const forced = D.monsters[id].actions.filter((a) => ACT(a.id) && ACT(a.id).telegraph && (a.w >= 100 || (a.cond && a.cond.every && a.cond.every[0] <= 2)));
  ok(`${id}: 予告は決まった間隔で回らない（重み 100 未満・2 手番おきでない）`, !forced.length, forced.map((a) => a.id));
  for (const a of D.monsters[id].actions) {
    const T = ACT(a.id) && ACT(a.id).telegraph, big = T && ACT(T.next);
    const sw = big && (big.effects || []).find((e) => e.type === 'special' && e.id === 'desert_sweep');
    if (sw) ok(`${id}: ${T.next} は即死級でない（最大 HP の 5 割以下）`, sw.pct <= 0.5, sw.pct);
  }
}

section('2. 手の幅と角度');
for (const [band, list, min, minTags] of [['序盤', EARLY, 3, 1], ['中盤', MID, 5, 3], ['終盤', LATE, 7, 3]]) {
  for (const [troop, id] of Object.entries(list)) {
    const { ids, combos } = movesOf(troop);
    const n = ids.length + combos;
    const tg = new Set(ids.flatMap(tags));
    ok(`${band} ${id}: 手が ${min} つ以上（${n}: ${ids.length} 手＋合体技 ${combos}）`, n >= min, ids);
    ok(`${band} ${id}: ${minTags} 種類以上の角度（${[...tg].join('・')}）`, tg.size >= minTags, [...tg]);
  }
}
ok('合体技: お供のいるボスに合体技がある（群れ頭・根食らい・鷹団・吹雪の大狼・楽団・霧食らい・大ダコ・グレン・鉱脈の主・獣使い・姉妹・三英雄・ラザロ・船団長）',
  ['c_b_lord_pack', 'c_b_root_bind', 'c_b_hawk_hunt', 'c_b_siege_hunt', 'c_b_doll_trio', 'c_b_mist_embrace', 'c_b_octo_squeeze', 'c_b_captain_boarding', 'c_b_vein_resonance',
    'c_b_tamer_charge', 'c_b_sister_flames', 'c_b_three_heroes', 'c_b_lazaro_scribes', 'c_b_admiral_volley'].every((c) => D.enemyCombos[c] && D.enemyCombos[c].steps.every((s) => ACT(s.act))));
ok('新しい技の名前と文が 5 言語にある', ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'].every((lang) =>
  ['bossActions.eb_king_mark.name', 'bossActions.eb_captain_barrage.msg', 'enemyCombos.c_b_three_heroes.name', 'data.bosses_kit.mark.m'].every((k) => R.I18n.has(k, lang))));

section('3. 2 回動くのは中盤から');
for (const id of Object.values(EARLY)) {
  const d = D.monsters[id];
  ok(`序盤 ${id}: 1 手番に 1 回（半分を切っても増えない）`, (d.actsPerTurn || 1) === 1 && !(d.phases || []).some((p) => p.set && p.set.actsPerTurn > 1), d.actsPerTurn);
}
for (const id of REGION_MID) ok(`中盤の地方ボス ${id}: 1 ラウンドに 2 回`, D.monsters[id].actsPerTurn === 2, D.monsters[id].actsPerTurn);
for (const id of ['b_bookgolem', 'b_lazaro', 'b_nemrea1', 'b_nemrea2', 'b_valzard_echo', 'b_ouroboros']) ok(`終盤 ${id}: 2 回以上`, D.monsters[id].actsPerTurn >= 2, D.monsters[id].actsPerTurn);
ok('3 回動くのはまれ（ネムレア・クリア後の円環竜だけ）', Object.values(D.monsters).filter((d) => (d.flags || []).includes('boss') && d.actsPerTurn >= 3).map((d) => d.id || '').length <= 2 &&
  Object.entries(D.monsters).filter(([, d]) => (d.flags || []).includes('boss') && d.actsPerTurn >= 3).every(([id]) => ['b_nemrea2', 'b_ouroboros'].includes(id)));

section('4・5. sim（台本）: ダメージのある手番・1 ラウンドの全滅・予告の繰り返し');
{
  const E = BC.Engine.prototype, exec0 = E.execute, play0 = E.playRound;
  let rec = null;
  E.execute = function* (u, cmd) {
    if (!rec || u.isParty) { yield* exec0.call(this, u, cmd); return; }
    const t0 = this.stats.taken;
    yield* exec0.call(this, u, cmd);
    if (u.id !== rec.main) return;
    const id = cmd.type === 'attack' ? 'attack' : cmd.id;
    rec.acts++; if (this.stats.taken > t0) rec.dmg++;
    rec.seq.push(!!(ACT(id) && ACT(id).telegraph));
  };
  E.playRound = function* (cmds) {
    if (!rec) { yield* play0.call(this, cmds); return; }
    const full = this.party.every((p) => p.alive && p.hp >= 0.9 * p.mhp);
    yield* play0.call(this, cmds);
    if (full && this.party.every((p) => !p.alive)) rec.wipe++;
  };
  const loopOf = (seq) => { let best = 0; for (let i = 0; i < seq.length; i++) { if (!seq[i]) continue; let k = 1, j = i; while (seq[j + 2]) { k++; j += 2; } best = Math.max(best, k); } return best; };
  const run = (key, main, n) => {
    const cfg = SB.BOSSES[key];
    const inv = cfg.items || SB.ITEMS;
    const party = buildParty(R, Object.assign({ seed: 5, items: inv }, cfg));
    const tot = { acts: 0, dmg: 0, wipe: 0, loop: 0 };
    try {
      for (let i = 0; i < n; i++) {
        rec = { main, acts: 0, dmg: 0, wipe: 0, seq: [] };
        BC.simulate({ party, troop: cfg.troop || key, tier: cfg.tier, seed: `tb2:${key}:${i}`, inv, maxRounds: 30, ai: R.BattleAI.styleAI('script') });
        tot.acts += rec.acts; tot.dmg += rec.dmg; tot.wipe += rec.wipe; tot.loop = Math.max(tot.loop, loopOf(rec.seq));
      }
    } finally { rec = null; }
    return tot;
  };
  for (const [key, main] of [['tr_b_icegiant@1', 'b_icegiant'], ['tr_a21_forest_wolves', 'b_wolflord']]) {
    const t = run(key, main, 30);
    ok(`${main}: ダメージのある手番が 6 割以上（${Math.round((100 * t.dmg) / t.acts)}%）`, t.dmg / t.acts >= 0.6, t);
  }
  const all = Object.keys(SB.BOSSES).filter((k) => k !== 'tr_tutorial');
  let wipes = [], loops = [];
  for (const key of all) {
    const troop = SB.BOSSES[key].troop || key;
    const main = Object.assign({}, EARLY, MID, LATE)[troop] || bossMons(troop).find((m) => D.monsters[m].bossType !== 'add');
    const t = run(key, main, 6);
    if (t.wipe) wipes.push(key);
    if (t.loop >= 3) loops.push(key + ':' + t.loop);
  }
  ok(`満タンから 1 ラウンドで全滅しない（${all.length} 行 × 6 戦）`, !wipes.length, wipes);
  ok('予告 → 大技 の 2 手番の繰り返しが 3 回続かない', !loops.length, loops);
}

done('test_boss');
