#!/usr/bin/env node
// ティアの場面 T2〜T7（events/story_*.js・maps/story_links.js）のテスト（node）。STORY_BIBLE §3.1・§4.3・§5.1・§6.2〜§6.4・§10.2〜§10.5・§11
//   node v2/tools/test_story_tiers.js
//   1 形: 場面・手がかり（余白 2〜7・ロアの寄り道・ミラのうわさ）・読み物・手紙・大事な物が契約どおり。手がかりの文は 3 行 × 22 字
//   2 声: T2〜T7 の 26 行が script.csv の文のまま 1 回ずつ（check_voice と同じ見方）。主人公はしゃべらない。仲間の名を出さない
//   3 順: 8 地方をいろいろな順・寄り方（宿・町を出る・寄らずに次の地方・よその町）で解いても、T1〜T8 がどれも 1 回ずつ、番号の順に起きる
//        （飛ばしたティアは次の宿・町でまとめて）。ロウェルの 2 戦は解いたばかりの地方の町（宿か出口。寄らなければ次の町で追ってくる）
//   4 手紙: T3（字の乱れ）・T5（二通、同じ文面）・封書（k_berna_sealed）→ T6 のロアで開ける（§10.4 の 4 枚）
//   5 世界: 空の段（T2 群青・T4 薄紫・T6 薄紅）・灯油の倍率（1.0/0.9/0.8/0.7/0.6）・町ごとのうわさ好き・白衣の書記・子どもの「あかつき」・
//        出張所の布告・内海の霧が、ティアと旗で出る。置いたマスが歩けて、町の入口から着ける
//   6 終盤: T6 のロアで封書を読んだ／T5 の封書を持ったまま／どちらも無い（古い記録）で、終盤のロアが本当の場面を使い、無いときだけ代わりを使う。
//        T7 を見ていれば手帳は T7 の物（終盤で二度渡さない）
//   7 体験版: DB.config.slice では T2 から先は何もしない
'use strict';
const fs = require('fs');
const path = require('path');
const { inline: i18nInline } = require('./lib/i18n_src');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const CHRON = path.resolve(V2, '..');
const FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^story_(00_tiers|t[2-7]|roa|world)\.js$/.test(f));
const SRC = i18nInline(FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readFileSync(path.join(V2, 'src', 'maps', 'story_links.js'), 'utf8'));
const M = require('./lib/maps').create(R);
const TOWN = { r_forest: 'fern', r_desert: 'kasim', r_snow: 'yule', r_marsh: 'loch', r_isles: 'nerei', r_mine: 'dovan', r_ash: 'caldera', r_star: 'orbis' };
const REGIONS = Object.keys(TOWN);
const W = (s) => [...String(s)].reduce((a, c) => a + (/[ -~]/.test(c) ? 0.5 : 1), 0);

// ================================================================ 1
section('1. 形');
const EVS = ['story_tiers', 'story_t2', 'story_t3', 'story_t4', 'story_t5', 'story_t6', 'story_t7', 'story_roa_tales', 'story_roa_t6', 'story_rumor', 'story_scribe', 'story_decree_board', 'story_rowell_roa'];
ok('場面のイベントがそろい K.event', EVS.every((id) => D.events[id] && R.Contract.check('event', D.events[id]).ok), EVS.filter((id) => !D.events[id] || !R.Contract.check('event', D.events[id]).ok));
const LEADS = ['l_main_margin_2', 'l_main_margin_3', 'l_main_margin_4', 'l_main_margin_5', 'l_main_margin_6', 'l_main_margin_7', 'l_main_roa_t3', 'l_main_roa_t6', 'l_rumor_mira'];
ok('手がかり（余白 2〜7・ロアの寄り道 2・ミラのうわさ）が K.lead', LEADS.every((id) => D.leads[id] && R.Contract.check('lead', D.leads[id]).ok), LEADS.filter((id) => !D.leads[id] || !R.Contract.check('lead', D.leads[id]).ok));
const LORE = ['lo_rowell_cover', 'lo_decree', 'lo_decree_memo', 'lo_hifuda'];
ok('読み物（手帳の表紙の裏・布告・私信の写し・灯札）が K.lore', LORE.every((id) => D.lore[id] && R.Contract.check('lore', D.lore[id]).ok), LORE.filter((id) => !D.lore[id]));
ok('手紙 berna_t3・berna_t5・berna_t5_2（同じ文面）', ['berna_t3', 'berna_t5', 'berna_t5_2'].every((id) => D.letters[id] && R.Contract.check('letter', D.letters[id]).ok) &&
  JSON.stringify(D.letters.berna_t5.text) === JSON.stringify(D.letters.berna_t5_2.text));
ok('大事な物 k_berna_sealed（ベルナの封書）', !!(D.items.k_berna_sealed && D.items.k_berna_sealed.slot === 'key'));
ok('ロウェルの編成 tr_b_rowell1（ティア 2）・tr_b_rowell2（ティア 5）', D.troops.tr_b_rowell1 && D.troops.tr_b_rowell2 && D.troops.tr_b_rowell1.tier === 2 && D.troops.tr_b_rowell2.tier === 5);
ok('手帳・筆・手甲の品がある', ['k_rowell_note', 'ac_rival_pen', 'hn_rival_bracer'].every((id) => D.items[id]));
{
  R.State.newGame({ seed: 3 });
  const bad = [];
  const tryAll = () => { for (const id of LEADS) { const l = D.leads[id], t = String(l.text).split('\n'); if (t.length > 3 || t.some((x) => W(x) > 22) || W(l.title) > 14) bad.push(id + ':' + JSON.stringify(l.text)); } };
  tryAll();
  // ふくらむ余白（戦の傷 2・手紙 1・時の証 3・封書）
  for (const id of ['lo_war_forest', 'lo_war_desert', 'lo_lz_1', 'lo_time_forest', 'lo_time_desert', 'lo_time_snow', 'lo_time_marsh', 'lo_berna_confession']) R.Game.flags[id] = true;
  tryAll();
  ok('手がかりの文は 3 行 × 22 字・題 14 字まで（ふくらんだ余白も）', bad.length === 0, bad);
  ok('ふくらんだ余白: 戦の傷・ミラ・時の証の名・リオナ', /戦の傷/.test(D.leads.l_main_margin_4.text) && /ミラ/.test(D.leads.l_main_margin_5.text) && /（.+……）/.test(D.leads.l_main_margin_6.text) && /リオナ/.test(D.leads.l_main_margin_7.text),
    [4, 5, 6, 7].map((n) => D.leads['l_main_margin_' + n].text));
}

// ================================================================ 2
section('2. 声と文');
{
  const rows = fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const head = rows.shift().split(',');
  const ii = head.indexOf('id'), ti = head.indexOf('text');
  const script = {};
  for (const r of rows) { const c = r.split(','); script[c[ii]] = c[ti]; }
  const want = ['v_rowell_t2_01', 'v_rowell_t2_02', 'v_rowell_t2_03', 'v_rowell_t2_04', 'v_rowell_t2_05', 'v_rowell_t2_06', 'v_rowell_t2_07', 'v_rowell_t4_01', 'v_rowell_t4_02', 'v_rowell_t4_03',
    'v_rowell_t5_01', 'v_rowell_t5_02', 'v_rowell_t5_03', 'v_rowell_t5_04', 'v_rowell_t5_05', 'v_rowell_t7_01', 'v_rowell_t7_02', 'v_rowell_t7_03', 'v_rowell_t7_04', 'v_rowell_t7_05',
    'v_rowell_t7_06', 'v_rowell_t7_07', 'v_fine_t3_01', 'v_fine_t3_02', 'v_fine_t6_01', 'v_fine_t6_02'];
  const used = {};
  for (const m of SRC.matchAll(/\.say\(\s*[^,]+,\s*'((?:[^'\\]|\\.)*)',\s*Object\.assign\(\{[^}]*voice:\s*'(v_[a-z0-9_]+)'/g)) (used[m[2]] = used[m[2]] || []).push(m[1].replace(/\\n/g, ''));
  const miss = want.filter((id) => !used[id] || used[id].length !== 1);
  ok('T2〜T7 の 26 行をどれも 1 回ずつ使う', miss.length === 0, miss);
  const diff = want.filter((id) => used[id] && used[id][0] !== script[id]).map((id) => [id, used[id][0], script[id]]);
  ok('文面が script.csv と 1 字も違わない（改行を除く）', diff.length === 0, diff);
  ok('ほかのボイスを使っていない', Object.keys(used).every((id) => want.includes(id)), Object.keys(used).filter((id) => !want.includes(id)));
  ok('主人公はしゃべらない', !/ev\.say\('hero'/.test(SRC));
  const names = Object.values(D.companions || {}).map((c) => c && c.name).filter((n) => n && n.length >= 2);
  const hit = names.filter((n) => new RegExp(`['「\\n　]${n}[「」、。！？\\n　']`).test(SRC + MAP_SRC));
  ok('仲間の名前を出さない（A36）', hit.length === 0, hit);
  // 1 ページ: 会話の窓の 3 行 × 20 字（STYLE_JA §1 の 20 字。窓は 3 行で次のページへ送る）。場面の文の表（i18n の ja）から: 手がかり・読み物の枠（別の決まり）は除く
  const TB = R.I18n.table('ja');
  const long2 = [];
  for (const k of Object.keys(TB)) {
    if (!/^(ev|events)\.story_(t[2-7]|roa|world|00_tiers)\b|^events\.story_(roa|rumor|scribe|decree|rowell)|^map\.story_links|^letters\.berna_t[35]/.test(k)) continue;
    if (/\.(MARGIN|KOSOU|NUM|WARI|title|from|dir|l_main_|l_rumor|lore)|\.text$/.test(k) && !/^letters\./.test(k)) continue;
    for (const t of [].concat(TB[k])) {
      const ls = String(t).split('\n');
      if (ls.length > 3 || ls.some((x) => W(x) > 20)) long2.push(k + ': ' + t);
    }
  }
  ok('台詞・地の文は 1 ページ 3 行（会話の窓）× 20 字まで', long2.length === 0, long2);
}

// ================================================================ 3〜6 は真似の ev で流す
function setup() {
  R.Screens.tip = async () => {}; R.Screens.open = async () => undefined;
  R.Events.night = async (o) => { if (o && o.onDark) o.onDark(); };
  R.State.newGame({ seed: 11 });
  R.State.setHero({ type: 'ranger', sex: 'f', name: 'リズ', fav: 'bow' });
  const G = R.Game;
  for (const f of ['prologue_start', 'prologue_berna', 'prologue_done']) G.flags[f] = true;
  G.chronicle.chapters.push({ id: 'prologue', summaryKey: 'prologue' });
  return G;
}
const T = {};   // 1 回の流しの記録
function mkEv(ctx) {
  const G = R.Game;
  const ev = Object.assign({}, R.Events.makeEv(ctx || {}));
  Object.assign(ev, {
    say: async (who, t, o) => { T.log.push({ k: 'say', who, t: String(t), voice: o && o.voice, name: o && o.name, map: T.map }); },
    choose: async (labels) => { T.log.push({ k: 'choose', labels }); return T.choose != null ? T.choose : 0; },
    caption: async (t) => { T.log.push({ k: 'caption', t: String(t) }); },
    fade: async () => {}, wait: async () => {},
    letter: async (id) => { T.log.push({ k: 'letter', id }); },
    battle: async (s) => { const troop = typeof s === 'string' ? s : s.troop; T.log.push({ k: 'battle', troop, map: T.map, canLose: !!(s && s.canLose), rid: T.rid, way: T.way, tier: R.Game.tier }); return T.win ? 'win' : 'lose'; },
    warp: async (map, sp) => { T.log.push({ k: 'warp', map, sp }); T.map = map; G.pos = { map, x: 0, y: 0, dir: 's' }; },
    appear: async () => {}, leave: async () => {}, npc: () => ({ move: async () => {}, face: async () => {}, act: async () => {}, hide: async () => {}, show: async () => {}, setPos: async () => {} }),
    inn: async () => true, jingle: async () => {}, bgm: () => {}, sfx: () => {}, mapBgm: () => {}, heal: () => {},
    call: (id, args) => { const c = Object.assign({}, ctx, args); return R.DB.events[id].run(mkEv(c), c); },
  });
  return ev;
}
const runEv = async (id, ctx) => { T.log.push({ k: 'run', id, ctx }); const e = R.DB.events[id]; await e.run(mkEv(ctx), ctx || {}); };
/** 地方を解く（ev.clearRegion の状態の部分だけ。演出なし） */
function clear(rid) {
  const G = R.Game;
  G.cleared[rid] = true; G.flags['cleared_' + rid] = true;
  G.tier = Math.min(8, (G.tier || 0) + 1); G.pendingTier = G.tier;
  G.chapter = Object.keys(G.cleared).length;
  G.chronicle.chapters.push({ id: rid, summaryKey: rid });
  G.choices['ch_' + rid.slice(2) + '_write'] = 'pain';
  T.map = TOWN[rid];
}
/** E17 の起こし方（tier.js の wake と同じ判断）: reason 'inn' | 'enter' | 'leave' */
async function wake(reason, map, from) {
  const G = R.Game, p = G.pendingTier;
  if (p == null) return null;
  if (reason === 'enter' && !(D.maps[map] && D.maps[map].kind === 'town')) return null;
  if (reason === 'enter' && R.Tier.holdOnEnter && R.Tier.holdOnEnter(p, map)) return null;
  if (reason === 'leave' && !(R.Tier.wakeOnLeave && R.Tier.wakeOnLeave(p, map, from))) return null;
  const id = R.Tier.sceneFor(p);
  if (id === null) { G.pendingTier = null; return null; }
  if (!D.events[id]) return null;
  G.pendingTier = null;
  T.map = reason === 'leave' ? map : map;
  const ctx = { map, reason, tier: p, from: from || null };
  await runEv(id, ctx);
  return id;
}

// 寄り方: inn（その町の宿）・leave（その町を出る）・skip（どこにも寄らずに次の地方）・other（ほかの地方の町に入る）
async function playOrder(order, ways, o) {
  o = o || {};
  const G = setup();
  T.log = []; T.win = o.win != null ? o.win : true; T.map = 'pharos';
  const SL = D.config.slice; D.config.slice = false;
  try {
    for (let i = 0; i < order.length; i++) {
      const rid = order[i], town = TOWN[rid], way = ways[i % ways.length];
      clear(rid);
      T.rid = rid; T.way = way;
      if (way === 'inn') await wake('inn', town);
      else if (way === 'leave') { await wake('leave', 'field_cross', town); T.way = 'leave_next'; await wake('enter', 'pharos'); }
      else if (way === 'other') { const other = i ? TOWN[order[i - 1]] : 'pharos'; T.map = other; await wake('enter', other); }
      // skip: 何もしない（次の地方の後でまとめて）
      if (o.roaAt && o.roaAt(G)) { T.map = 'roa_house'; T.way = 'roa'; await runEv('roa_berna', { npc: 'berna_desk', map: 'roa_house' }); }
    }
    // 最後の地方の後に寄らなかった分（T8 を含む）
    T.way = 'final';
    await wake('enter', 'pharos');
    await wake('inn', 'pharos');   // ロウェルの場面は町に入ってすぐは起きない（宿か町の出口で）
    // もう一度起こしても何も起きない（全部見た）
    const n = T.log.length;
    G.pendingTier = G.tier;
    await wake('inn', 'pharos');
    if (T.log.length !== n || G.pendingTier !== null) T.log.push({ k: 'error', t: 'twice' });
  } finally { D.config.slice = SL; }
  const fights = T.log.filter((e) => e.k === 'battle');
  return { G: R.Game, log: T.log, fights };
}

(async function main() {
  // ================================================================ 3
  section('3. どの順でも T1〜T8 が 1 回ずつ（飛ばしたティアは次の宿・町で）');
  const rng = R.rng('tiers');
  const orders = [REGIONS.slice(), REGIONS.slice().reverse()];
  for (let k = 0; k < 6; k++) { const a = REGIONS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } orders.push(a); }
  const WAYS = [['inn'], ['leave'], ['inn', 'skip', 'leave', 'other'], ['skip', 'skip', 'inn'], ['other'], ['leave', 'inn'], ['skip', 'leave', 'skip', 'inn', 'other'], ['inn', 'leave', 'skip']];
  const TIER_VOICE = { 1: 'v_fine_t1_01', 2: 'v_rowell_t2_01', 3: 'v_fine_t3_01', 4: 'v_rowell_t4_02', 5: 'v_rowell_t5_02', 6: 'v_fine_t6_01', 7: 'v_rowell_t7_01', 8: 'v_fine_t8_01' };
  let allOk = true, orderOk = true, twiceOk = true, fightOk = true, chasedOk = true, exitOk = true, margins = true, errs = [];
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i], ways = WAYS[i % WAYS.length];
    let r;
    try { r = await playOrder(order, ways, { win: i % 2 === 0 }); } catch (e) { errs.push(order.join(',') + ': ' + (e && e.stack || e)); continue; }
    const seq = r.log.filter((e) => e.k === 'say' && e.voice && Object.values(TIER_VOICE).includes(e.voice)).map((e) => +Object.keys(TIER_VOICE).find((t) => TIER_VOICE[t] === e.voice));
    const flags = [1, 2, 3, 4, 5, 6, 7, 8].every((t) => r.G.flags['story_t' + t]);
    if (!flags || seq.length !== 8) { allOk = false; errs.push({ order, ways, seq, flags: [1, 2, 3, 4, 5, 6, 7, 8].map((t) => !!r.G.flags['story_t' + t]) }); }
    if (seq.join() !== '1,2,3,4,5,6,7,8') orderOk = false;
    if (r.log.some((e) => e.k === 'error')) twiceOk = false;
    // ロウェルの 2 戦: 宿か出口で起きたら、その場は解いたばかりの地方の町
    const f = r.fights;
    if (f.length !== 2 || f[0].troop !== 'tr_b_rowell1' || f[1].troop !== 'tr_b_rowell2' || !f.every((x) => x.canLose)) { fightOk = false; errs.push({ fights: f }); }
    for (const x of f) {
        if ((x.way === 'inn' || x.way === 'leave') && x.tier === (x.troop === 'tr_b_rowell1' ? 2 : 5) && x.map !== TOWN[x.rid]) { fightOk = false; errs.push({ fightAt: x }); }
    }
    // 出口: 町を出たら町の門へ戻ってから
    for (const x of f.filter((q) => q.way === 'leave' && q.tier === (q.troop === 'tr_b_rowell1' ? 2 : 5))) {
      const w = r.log.find((e) => e.k === 'warp' && e.map === TOWN[x.rid]);
      if (!w || !(D.maps[w.map].spawns || {})[w.sp]) { exitOk = false; errs.push({ exit: x, w }); }
    }
    // よその町・寄らずに次で起きたら「追ってきた」
    const chasedLines = r.log.filter((e) => e.k === 'say' && /追ってきた/.test(e.t)).length;
    const expectChase = f.filter((x) => D.maps[x.map] && D.maps[x.map].region !== x.rid && x.map !== undefined).length;
    if (chasedLines < Math.min(1, expectChase)) chasedOk = false;
    if (![2, 3, 4, 5, 6, 7].every((n) => r.G.leads['l_main_margin_' + n])) margins = false;
  }
  ok(`${orders.length} 通りの順と寄り方で、例外なく流れる`, errs.filter((e) => typeof e === 'string').length === 0, errs.filter((e) => typeof e === 'string'));
  ok('どの順でも T1〜T8 の場面がそろう（旗 story_t1〜t8・各場面の声が 1 回）', allOk, errs.filter((e) => e.seq));
  ok('場面は番号の順（飛ばしたティアも T1 から順に）', orderOk);
  ok('同じ町で 2 度起こしても場面をくり返さない', twiceOk);
  ok('ロウェルの 2 戦（負けても続く）は、宿・出口なら解いたばかりの地方の町で', fightOk, errs.filter((e) => e.fights || e.fightAt));
  ok('町を出たとき: その町の門（spawn）へ戻って呼び止められる', exitOk, errs.filter((e) => e.exit));
  ok('よその町・次の町で起きたときは「追ってきた」の一行', chasedOk);
  // ロウェルの場面（T2・T4・T5・T7）は町に入ってすぐは起きない（オーナー 2026-10-03）。戦いの前に一息（手当て・記録の問い）
  {
    let enterOk = true, prepOk = true;
    for (let i = 0; i < 4; i++) {
      const r = await playOrder(orders[i], WAYS[i % WAYS.length], { win: true });
      const ROW = ['v_rowell_t2_01', 'v_rowell_t4_02', 'v_rowell_t5_02', 'v_rowell_t7_01'];
      // その場面を走らせた束の ctx.reason
      let reason = null;
      for (const e of r.log) {
        if (e.k === 'run') reason = e.ctx && e.ctx.reason;
        if (e.k === 'say' && ROW.includes(e.voice) && reason === 'enter') enterOk = false;
      }
      const bi = r.log.map((e, j) => (e.k === 'battle' ? j : -1)).filter((j) => j >= 0);
      for (const j of bi) { const prev = r.log.slice(Math.max(0, j - 4), j); if (!prev.some((e) => e.k === 'choose' && e.labels.some((l) => /記録/.test(l)))) prepOk = false; }
    }
    ok('ロウェルの場面は町に入ってすぐは起きない（宿か町の出口）', enterOk);
    ok('ロウェルとの戦いの前に一息（手当てと「記録してから受けて立つ」）', prepOk);
    // 町に入ったとき: 先頭がロウェルなら起こさない・ロウェルでなければ起こして、ロウェルの手前で止める
    const G = setup(); const SL = D.config.slice; D.config.slice = false;
    try {
      G.flags.story_t1 = true; G.tier = 2; G.pendingTier = 2;
      ok('holdOnEnter: T2 が次なら町に入っても起こさない', R.Tier.holdOnEnter(2) === true && R.Tier.wakeOnLeave(2) === true);
      G.flags.story_t2 = true; G.flags.story_t3 = true; G.tier = 4; G.pendingTier = 4;
      ok('holdOnEnter: T4（布告とロウェル）も同じ', R.Tier.holdOnEnter(4) === true);
      G.flags.story_t4 = true; G.flags.story_t5 = true; G.tier = 6; G.pendingTier = 6;
      ok('holdOnEnter: T6（フィーネ）は町に入ってすぐ', R.Tier.holdOnEnter(6) === false && R.Tier.wakeOnLeave(6) === false);
      G.tier = 7; G.pendingTier = 7; T.log = []; T.map = 'yule';
      await runEv('story_tiers', { map: 'yule', reason: 'enter', tier: 7 });
      ok('束（T6・T7）を町に入って起こしたら T6 だけ、T7 は pending のまま', G.flags.story_t6 && !G.flags.story_t7 && G.pendingTier === 7, [G.flags.story_t6, G.flags.story_t7, G.pendingTier]);
    } finally { D.config.slice = SL; }
  }
  ok('余白の 2〜7 段目が手がかり帳に入る', margins);
  // 勝ち負けの分岐
  {
    const w = await playOrder(REGIONS, ['inn'], { win: true });
    const l = await playOrder(REGIONS, ['inn'], { win: false });
    const vs = (r) => r.log.filter((e) => e.voice).map((e) => e.voice);
    ok('勝ち: 銀の筆・手甲、t2_04〜06・t4_01・t5_01・t5_04・t7_02', w.G.items.ac_rival_pen >= 1 && (w.G.items.hn_rival_bracer || 0) >= 1 &&
      ['v_rowell_t2_04', 'v_rowell_t2_06', 'v_rowell_t4_01', 'v_rowell_t5_01', 'v_rowell_t5_04', 'v_rowell_t7_02'].every((v) => vs(w).includes(v)) && !vs(w).includes('v_rowell_t2_07'));
    ok('負け: t2_07・t5_05、勝ちの行は流れない', ['v_rowell_t2_07', 'v_rowell_t5_05'].every((v) => vs(l).includes(v)) && !['v_rowell_t4_01', 'v_rowell_t5_01', 'v_rowell_t7_02', 'v_rowell_t2_04'].some((v) => vs(l).includes(v)) && !l.G.items.ac_rival_pen);
    ok('T7: 手帳（k_rowell_note）・表紙の裏（lo_rowell_cover）・記録院を抜ける', w.G.items.k_rowell_note >= 1 && w.G.flags.lo_rowell_cover && w.G.flags.story_rowell_defect);
    ok('T4: 布告と私信の写し（lo_decree・lo_decree_memo）、ロウェルが布告を丸める', w.G.flags.lo_decree && w.G.flags.lo_decree_memo && w.log.some((e) => e.k === 'say' && /丸めた/.test(e.t)));
    ok('T3: フィーネが名乗り、以後の名は「フィーネ」', w.log.some((e) => e.voice === 'v_fine_t3_02' && e.name === '灰色のマントの少女') && w.log.some((e) => e.voice === 'v_fine_t6_01' && e.name === 'フィーネ'));
    ok('T6: 足元が透ける・ロアへ（l_main_roa_t6）', w.log.some((e) => e.k === 'caption' && /足元/.test(e.t)) && !!w.G.leads.l_main_roa_t6);

    // ================================================================ 4
    section('4. 手紙と封書');
    const letters = w.log.filter((e) => e.k === 'letter').map((e) => e.id);
    ok('手紙: T1 → T3（乱れた字）→ T5 の二通', ['berna_t1', 'berna_t3', 'berna_t5', 'berna_t5_2'].every((id) => letters.includes(id)) && letters.indexOf('berna_t3') < letters.indexOf('berna_t5'), letters);
    ok('T5: 二通目の中の封書（k_berna_sealed、「ロアに帰ったら開けて」）', (w.G.items.k_berna_sealed || 0) >= 1 && w.log.some((e) => /ロアに帰ったら開けて/.test(e.t || '')));
  }
  // ロアの寄り道
  {
    const r = await playOrder(REGIONS, ['inn'], { win: true, roaAt: (G) => G.tier === 4 || G.tier === 6 });
    const t3 = r.log.findIndex((e) => e.k === 'run' && e.id === 'roa_berna' && true);
    ok('T3〜T5 のロア: ベルナが旅の話をせがむ（章の題の字幕）・布を二度かけ直す（story_roa_t3）', r.G.flags.story_roa_t3 && r.log.some((e) => e.k === 'caption' && /^『.+』$/.test(e.t)) &&
      r.log.some((e) => /もう一度/.test(e.t || '') && /布/.test(e.t || '')) && t3 >= 0);
    ok('T6 のロア: 「旅の方？」・「いい子だね」・名簿の名をなぞる', r.G.flags.story_roa_t6 && r.log.some((e) => /旅の方？/.test(e.t || '')) && r.log.some((e) => /いい子だね/.test(e.t || '')) && r.log.some((e) => /誰だったかね/.test(e.t || '')));
    const conf = r.log.filter((e) => e.k === 'letter' && /^berna_confession/.test(e.id)).length;
    ok('T6 のロアで封書を開ける（§10.4 の 4 枚、lo_berna_confession、封書は手元から消える）', conf === 4 && r.G.flags.lo_berna_confession && !(r.G.items.k_berna_sealed > 0), conf);
    ok('余白の 7 段目にリオナの一行（封書を読んでいたので）', /リオナ/.test(D.leads.l_main_margin_7.text));

    // ================================================================ 6
    section('6. 終盤のロア（本当の場面を使い、無いときだけ代わり）');
    // a) T6 のロアで読んだ
    T.log = []; T.map = 'roa';
    const G = R.Game;
    const note0 = G.items.k_rowell_note;
    await runEv('story_final_roa', { map: 'roa' });
    ok('a) T6 で読んでいれば、門のおかみは封書を渡さない・もう一度は開けない', !T.log.some((e) => e.who === 'gatewoman2') && !T.log.some((e) => e.k === 'letter'));
    ok('a) T7 を見ていれば、ロウェルは里に身を寄せていた（地の文）・手帳は二度渡さない', T.log.some((e) => /身を寄せていた/.test(e.t || '')) && G.items.k_rowell_note === note0 && !T.log.some((e) => /古い手帳を\n差し出した/.test(e.t || '')));
    ok('a) 終盤のロアの場面が最後まで（final_roa・final_open）', G.flags.final_roa && G.flags.final_open);
  }
  {
    // b) T5 の封書を持ったまま（T6 のロアに寄らなかった）
    const r = await playOrder(REGIONS, ['inn'], { win: true });
    T.log = []; T.map = 'roa';
    await runEv('story_final_roa', { map: 'roa' });
    const conf = T.log.filter((e) => e.k === 'letter' && /^berna_confession/.test(e.id)).length;
    ok('b) 封書を持っていれば、ロアの門で自分で開ける（門のおかみは出ない）', conf === 4 && !T.log.some((e) => e.who === 'gatewoman2') && r.G.flags.lo_berna_confession && !(r.G.items.k_berna_sealed > 0));
  }
  {
    // c) 古い記録: T8 だけ（T2〜T7 を見ていない）→ 代わり（門のおかみ・手帳を終盤で）
    const G = setup();
    for (const rid of REGIONS) { G.cleared[rid] = true; G.flags['cleared_' + rid] = true; G.chronicle.chapters.push({ id: rid }); }
    G.tier = 8; G.flags.story_t8 = true;
    T.log = []; T.map = 'roa';
    await runEv('story_final_roa', { map: 'roa' });
    ok('c) T5〜T7 を見ていない古い記録だけ: 門のおかみが封書を渡し、ロウェルが手帳を渡す（声の行は流さない）',
      T.log.some((e) => e.who === 'gatewoman2') && G.items.k_rowell_note >= 1 && G.flags.lo_rowell_cover && !T.log.some((e) => /^v_rowell_t7/.test(e.voice || '')) && !T.log.some((e) => /身を寄せていた/.test(e.t || '')));
  }

  // ロアに着いたとき（roa_enter → R.Story.roaArrive。オーナー 2026-10-03）
  {
    const SL = D.config.slice; D.config.slice = false;
    try {
      // a) T5 の後・T6 の前にロアへ: 門で開ける（4 枚）
      let G = setup();
      for (let k = 1; k <= 5; k++) G.flags['story_t' + k] = true;
      G.tier = 5; G.items.k_berna_sealed = 1;
      T.log = []; T.map = 'roa';
      await runEv('roa_enter', { map: 'roa', trigger: 'enter', from: 'world' });
      const n1 = T.log.filter((e) => e.k === 'letter' && /^berna_confession/.test(e.id)).length;
      ok('T5〜T6 の間にロアへ帰ると、門で封書を開ける（「ロアに帰ったら開けて」）', n1 === 4 && G.flags.lo_berna_confession && !(G.items.k_berna_sealed > 0), n1);
      // その後の T6 のロアの場面は、封書なしで最後まで（読んでいる所の一行は出さない）
      G.flags.story_t6 = true; T.log = []; T.map = 'roa_house';
      await runEv('roa_berna', { npc: 'berna_desk', map: 'roa_house' });
      ok('門で読んだ後の T6 のロア: 場面は最後まで・二度は読まない', G.flags.story_roa_t6 && !T.log.some((e) => e.k === 'letter') && !T.log.some((e) => /手紙を読む/.test(e.t || '')));
      // b) T6 の後にロアへ: 着いた所で思い出す（ベルナの家で開ける）。家から出てきたときは何もしない
      G = setup();
      for (let k = 1; k <= 6; k++) G.flags['story_t' + k] = true;
      G.tier = 6; G.items.k_berna_sealed = 1;
      T.log = []; T.map = 'roa';
      await runEv('roa_enter', { map: 'roa', trigger: 'enter', from: 'world' });
      ok('T6 の後にロアへ帰ると、着いた所で封書を思い出す（開けるのはベルナの家）', T.log.some((e) => /封書を\n思い出した/.test(e.t || '')) && !T.log.some((e) => e.k === 'letter') && G.items.k_berna_sealed === 1);
      T.log = [];
      await runEv('roa_enter', { map: 'roa', trigger: 'enter', from: 'roa_house' });
      ok('家から出てきたときは知らせない', !T.log.some((e) => e.k === 'say'));
      T.log = []; T.map = 'roa_house';
      await runEv('roa_berna', { npc: 'berna_desk', map: 'roa_house' });
      ok('ベルナの家で T6 の場面が封書を開ける', T.log.filter((e) => e.k === 'letter').length === 4 && G.flags.lo_berna_confession && T.log.some((e) => /手紙を読む/.test(e.t || '')));
    } finally { D.config.slice = SL; }
  }

  // ================================================================ 5
  section('5. 世界の反応（どの町も同じ表から）');
  {
    const hue = (hex) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); h *= 60; return h < 0 ? h + 360 : h; };
    const hz = (t) => R.Sky.at(t).horizon;
    ok('空の段: T2 群青（青）・T4 薄紫・T6 薄紅（地平の色）', hue(hz(2)) > 200 && hue(hz(2)) < 240 && hue(hz(4)) > 250 && hue(hz(4)) < 290 && (hue(hz(6)) > 300 || hue(hz(6)) < 20), [hz(2), hz(4), hz(6)].map(hue));
    ok('灯油の倍率 T0 1.0・T2 0.9・T4 0.8・T6 0.7・T8 0.6（R.Tier.oil）', [0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => R.Tier.oil(t)).join() === '1,1,0.9,0.9,0.8,0.8,0.7,0.7,0.6');
    const G = setup();
    const vis = (m, id) => { const n = (D.maps[m].npcs || []).find((q) => q.id === id); return !!n && (!n.cond || R.State.check(n.cond)); };
    const towns = Object.keys(R.Story.TOWNS);
    ok(`${towns.length} 町にうわさ好き・書記・子どもを置く`, towns.length >= 10 && towns.every((t) => ['story_rumor_', 'story_scribe_', 'story_child_'].every((p) => (D.maps[t].npcs || []).some((n) => n.id === p + t))));
    G.tier = 1;
    ok('ティア 1: どれも出ない', towns.every((t) => !vis(t, 'story_rumor_' + t) && !vis(t, 'story_scribe_' + t) && !vis(t, 'story_child_' + t)));
    G.tier = 2;
    ok('ティア 2: うわさ好きが出る', towns.every((t) => vis(t, 'story_rumor_' + t)));
    G.tier = 4;
    ok('ティア 4 でも布告の前は書記は出ない', towns.every((t) => !vis(t, 'story_scribe_' + t)));
    G.flags.story_t4 = true;
    ok('T4 の布告の後: どの町にも白衣の書記', towns.every((t) => vis(t, 'story_scribe_' + t)));
    const offices = Object.keys(R.Story.OFFICES);
    ok('T4 の後: 出張所（ファロス・ロッホ・ユール・オルビス）に布告', offices.length === 4 && offices.every((m) => (D.maps[m].objects || []).some((o) => o.event === 'story_decree_board' && R.State.check(o.cond))));
    ok('T4〜T7: ファロスと灯台の岬に内海の霧（T8 で晴れる）', R.Story.MIST.every((m) => D.maps[m].weather === 'mist' && R.State.check(D.maps[m].weatherCond)) &&
      (G.flags.story_t8 = true, R.Story.MIST.every((m) => !R.State.check(D.maps[m].weatherCond))) && !(G.flags.story_t8 = false));
    G.tier = 6;
    ok('ティア 6: 子どもが「あかつき」を口にする', towns.every((t) => vis(t, 'story_child_' + t)) &&
      towns.every((t) => { const n = D.maps[t].npcs.find((q) => q.id === 'story_child_' + t); let line = null; for (const l of n.talk.lines) if (!l.cond || R.State.check(l.cond)) line = l; return /あかつき/.test(line.text); }));
    // うわさの台詞（§10.5）
    const rum = async (t) => { G.tier = t; T.log = []; await runEv('story_rumor', { npc: 'story_rumor_fern' }); return T.log.filter((e) => e.k === 'say').map((e) => e.t).join('|'); };
    ok('T2: 「空がちょっと青くないかい？」', /青くないかい/.test(await rum(2)));
    ok('T3: 灯油の値が前の九割', /九割/.test(await rum(3)));
    ok('T4: 何のための戦だったか分からない', /何のための/.test(await rum(4)));
    const r5 = await rum(5);
    ok('T5: 院長の娘の名「ミラ」が初めて出る（l_rumor_mira）', /ミラ/.test(r5) && G.flags.story_mira_heard && !!G.leads.l_rumor_mira);
    const r6 = await rum(6);
    ok('T6: 灯札が紙くずになりかける（lo_hifuda）・油は七割', /紙くず/.test(r6) && /七割/.test(r6) && G.flags.lo_hifuda && !/ミラ/.test(r6));
    ok('T7: 灯札を油と替えてくれない', /替えてくれなく/.test(await rum(7)));
    const yena = async (t) => { G.tier = t; T.log = []; await runEv('pharos_yena', { npc: 'yena' }); return T.log.filter((e) => e.k === 'say').map((e) => e.t).join('|'); };
    ok('イェナの弧（§8.10）: T0〜2 は今のまま・T3〜5 会を抜ける人・T6〜7 本当の名', /名は重荷/.test(await yena(1)) && /会を抜ける/.test(await yena(4)) && /本当の名/.test(await yena(6)));
    delete G.flags.story_mira_heard;
    ok('ミラを聞きそびれていれば、後のティアでも先に言う', /ミラ/.test(await rum(7)));
    // 置いたマスが歩けて、町の入口から着ける（開けたマス: 周りも歩ける）
    G.tier = 8; G.flags.story_t4 = true; G.flags.story_t7 = true;
    const bad = [];
    for (const t of towns) {
      const m = D.maps[t];
      const start = Object.values(m.spawns)[0];
      const reach = M.bfs(m, [{ x: start.x, y: start.y, lv: 0 }], { npcs: false }).dist;
      for (const p of ['story_rumor_', 'story_scribe_', 'story_child_']) {
        const n = m.npcs.find((q) => q.id === p + t);
        if (!reach.has(n.x + ',' + n.y + ',0')) { bad.push(t + ' ' + n.id + ' unreachable'); continue; }
        const others = m.npcs.filter((q) => q !== n && q.x === n.x && q.y === n.y);
        if (others.length) bad.push(t + ' ' + n.id + ' on ' + others.map((q) => q.id));
        if (M.portalAt(M.portals(m, { all: true }), n.x, n.y, 0)) bad.push(t + ' ' + n.id + ' on a door');
        let open = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (R.Field._walkable(m, n.x + i, n.y + j, null, 0)) open++;
        if (open < 9) bad.push(t + ' ' + n.id + ' not open (' + open + ')');
      }
    }
    const roa = D.maps.roa, rw = roa.npcs.find((n) => n.id === 'story_rowell_roa');
    if (!rw || !R.Field._walkable(roa, rw.x, rw.y, null, 0)) bad.push('roa rowell');
    for (const id of offices) {
      const m = D.maps[id], o = R.Story.OFFICES[id];
      if (!R.Field._walkable(m, o.x, o.y + 1, null, 0) && !R.Field._walkable(m, o.x, o.y, null, 0)) bad.push(id + ' board not facing a floor');
    }
    ok('置いた人と布告: 歩ける開けたマス・入口から着く・人や戸口と重ならない', bad.length === 0, bad);
    G.flags.story_t7 = true; G.flags.final_roa = false;
    ok('T7 の後: ロウェルがロアに身を寄せる（終盤のロアまで）', vis('roa', 'story_rowell_roa') && (G.flags.final_roa = true, !vis('roa', 'story_rowell_roa')));
  }

  // ================================================================ 7
  section('7. 体験版の錠');
  {
    const G = setup();
    const SL = D.config.slice; D.config.slice = true;
    G.cleared.r_forest = true; G.tier = 2; G.pendingTier = 2; G.flags.story_t1 = true;
    T.log = []; T.map = 'fern';
    await runEv('story_t2', { map: 'fern', reason: 'inn', tier: 2 });
    await runEv('story_tiers', { map: 'fern', reason: 'inn', tier: 2 });
    ok('体験版では T2 から先は何もしない（戦わず、旗も立たない）', !T.log.some((e) => e.k === 'battle' || e.k === 'say') && !G.flags.story_t2);
    ok('体験版では町を出ても起こさない（wakeOnLeave）', R.Tier.wakeOnLeave(2) === false);
    D.config.slice = SL;
  }
  done('test_story_tiers');
})().catch((e) => { console.error(e); process.exit(1); });
