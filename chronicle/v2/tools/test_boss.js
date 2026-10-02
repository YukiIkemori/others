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

// ================================================================ 暴走モード（持ち主 2026-10-02）
section('暴走モード: ボスが HP の低い段階に入った最初の 1 回だけ「〜が怒り狂った！」');
{
  const bosses = Object.keys(D.monsters).filter((id) => (D.monsters[id].flags || []).includes('boss'));
  const main = bosses.filter((id) => D.monsters[id].bossType !== 'add');
  const adds = bosses.filter((id) => D.monsters[id].bossType === 'add');
  ok('every boss (not adds) has a threshold in (0, 0.5]', main.every((id) => { const v = BC.enrageAt(D.monsters[id], true); return v > 0 && v <= 0.5; }), main.map((id) => [id, BC.enrageAt(D.monsters[id], true)]).filter((x) => !(x[1] > 0 && x[1] <= 0.5)));
  ok('adds (お供・籠城の狼) never enrage', adds.every((id) => BC.enrageAt(D.monsters[id], true) == null), adds.filter((id) => BC.enrageAt(D.monsters[id], true) != null));
  ok('ordinary monsters never enrage', Object.keys(D.monsters).filter((id) => !(D.monsters[id].flags || []).includes('boss')).every((id) => BC.enrageAt(D.monsters[id], false) == null));
  ok('derived from hpBelow: 鉄の番人 0.3（0.75・0.7 は数えない）, 砂の王 0.4, ふつうは 0.5', BC.enrageAt(D.monsters.b_ironwarden, true) === 0.3 && BC.enrageAt(D.monsters.b_sandking, true) === 0.4 && BC.enrageAt(D.monsters.b_moth, true) === 0.5);
  ok('explicit field: enrage number (also on a mob) / enrage false', BC.enrageAt({ enrage: 0.35 }, false) === 0.35 && BC.enrageAt({ enrage: false, phases: [{ hpBelow: 0.5 }] }, true) == null);
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: 'アルン' }, seed: 11 });
  const pc = () => R.Party.members().map((c) => JSON.parse(JSON.stringify(c)));
  const eng = new BC.Engine({ party: pc(), mons: ['b_moth'], tier: 0, lv: 8, inv: {}, rng: R.Mon.mkRng('enr') });
  eng.use();
  const m = eng.mons[0];
  m.hp = Math.ceil(m.mhp * 0.6);
  const e0 = [...eng.afterAction()];
  ok('above the threshold: nothing', !e0.some((e) => e.t === 'enrage'));
  m.hp = Math.floor(m.mhp * 0.45);
  const e1 = [...eng.afterAction()];
  const out = []; for (const e of e1) BC.toEvents(e, 'A', out, eng);
  const msg = out.find((e) => e.t === 'msg' && e.enrage);
  ok('crossing: one enrage event → contract msg {enrage, uid} with the caption', e1.filter((e) => e.t === 'enrage').length === 1 && msg && msg.uid === m.uid && msg.text === R.T('sys.battle_core.enrage', { name: m.name }) && R.Contract.check('battleEvent', msg).ok, msg);
  // 人・会話のある相手は「本気になった！」（光は軽く、唸りなし）。獣・魔物は「怒り狂った！」
  const serious = Object.keys(D.monsters).filter((id) => D.monsters[id].enrageText === 'serious');
  ok('character bosses use the serious caption (ロウェル・ネムレア・ラザロ・勇者の影・魔王の残影・名のある人)', ['b_rowell1', 'b_rowell2', 'b_nemrea1', 'b_nemrea2', 'b_lazaro', 'b_shade_sword', 'b_valzard_echo', 'b_captain', 'b_zakuro', 'b_hawk_chief', 'b_tamer', 'b_sister_elder', 'b_armorman'].every((id) => serious.includes(id)) && !['b_moth', 'b_whitedragon', 'b_icegiant', 'b_wolflord', 'b_ouroboros'].some((id) => serious.includes(id)), serious);
  const eR = new BC.Engine({ party: pc(), mons: ['b_rowell1'], tier: 2, lv: 20, inv: {}, rng: R.Mon.mkRng('enr4') });
  eR.use(); eR.mons[0].hp = 1;
  const oR = []; for (const e of eR.afterAction()) BC.toEvents(e, 'A', oR, eR);
  ok('ロウェル: 「本気になった！」 with enrage "serious"', oR.length === 1 && oR[0].enrage === 'serious' && oR[0].text === R.T('sys.battle_core.enrage.serious', { name: eR.mons[0].name }) && /本気になった/.test(oR[0].text), oR);
  ok('serious caption in 5 languages', ['ja', 'en', 'ko', 'zh-Hans', 'zh-Hant'].every((l) => /'sys\.battle_core\.enrage\.serious': '\{name\}/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'i18n', l, 'battle.js'), 'utf8'))));
  m.hp = Math.floor(m.mhp * 0.1);
  const e2 = [...eng.afterAction()];
  ok('only once per battle', !e2.some((e) => e.t === 'enrage') && m.enraged === true);
  const mob = new BC.Engine({ party: pc(), mons: ['rat_1'], tier: 0, lv: 8, inv: {}, rng: R.Mon.mkRng('enr2') });
  mob.use(); mob.mons[0].hp = 1;
  ok('a mob at 1 HP does not enrage', ![...mob.afterAction()].some((e) => e.t === 'enrage'));
  // 本物の流れ: 台本で最後まで戦っても、暴走は 1 回だけ（ボスが 1 体の戦闘）
  const B = BC.create({ troop: 'tr_b_moth', seed: 'enr3' });
  let evs = B.intro(), n = 0;
  for (let r = 0; r < 40 && !B.over; r++) {
    for (const u of B.units.filter((x) => x.side === 'party' && x.alive)) B.submit(u.uid, { cmd: 'attack', target: (B.units.find((x) => x.side === 'enemy' && x.alive) || {}).uid });
    evs = evs.concat(B.round());
  }
  n = evs.filter((e) => e.t === 'msg' && e.enrage).length;
  ok('a whole fight: at most one enrage line (and one if the boss fell below 0.5)', n <= 1 && (!B.engine.mons[0].alive || B.engine.mons[0].hpRate() >= 0.5 ? n === (B.engine.mons[0].enraged ? 1 : 0) : n === 1), n);
}

done('test_boss');
