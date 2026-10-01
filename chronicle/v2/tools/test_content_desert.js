#!/usr/bin/env node
// 砂漠（desert_*.js）のテスト（node）。オーナーの決まりと、筋・置き場所・戦闘の考えどころを確かめる。
//   node v2/tools/test_content_desert.js
//   1 形: マップ・イベント・手がかり・編成が契約どおり、参照がそろう
//   2 置き場所: ダンジョンごとに泉、宝箱は床の上で見える（町は見える物だけ）、隠し通路はダンジョンの中だけ（A27）、ワールドに宝箱なし
//   3 文: ボイスの id が台本にあって音のファイルがある・仲間 20 人の名前を出さない（A36）
//   4 筋: 閉包で clearRegion('r_desert') に着く（鷹団 3 通り × 近道／遠回り）。解決でティア +1・ページ・光の柱の場所
//   5 戦闘: ボスの予告と第 2 の姿、名を呼ぶ道具（第 2 の姿の前は戻る・後は勝ち）、盗み専用の品の出どころ
'use strict';
const fs = require('fs');
const { inline: i18nInline } = require('./lib/i18n_src');   // R.T('key') を日本語の文に戻して文面を確かめる（i18n）
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const R = require('./lib/load')({ quiet: true });
const M = require('./lib/maps').create(R);
const D = R.DB;
const V2 = path.resolve(__dirname, '..');
const MY_MAPS = Object.keys(D.maps).filter((id) => /^(desert_|kasim|sandedge)/.test(id));
const EV_FILES = fs.readdirSync(path.join(V2, 'src', 'events')).filter((f) => /^desert_/.test(f));
const SRC = i18nInline(EV_FILES.map((f) => fs.readFileSync(path.join(V2, 'src', 'events', f), 'utf8')).join('\n'));
const MAP_SRC = i18nInline(fs.readdirSync(path.join(V2, 'src', 'maps')).filter((f) => /^desert_/.test(f)).map((f) => fs.readFileSync(path.join(V2, 'src', 'maps', f), 'utf8')).join('\n'));

// ================================================================ 1
section('1. 形と参照');
ok('R.loadErrors 0', R.loadErrors.length === 0, R.loadErrors);
ok(`砂漠のマップ ${MY_MAPS.length} 枚（町 2・屋内・野営地 3・王墓 3・寄り道）`, MY_MAPS.length >= 25, MY_MAPS);
for (const id of MY_MAPS) {
  const r = R.Contract.check('map', D.maps[id]);
  if (!r.ok) ok(`map ${id} が K.map`, false, r.errors);
}
const myEvents = [...SRC.matchAll(/\bE\('([a-z0-9_]+)'/g)].map((m) => m[1]).filter((id) => !id.endsWith('_'));
ok(`砂漠のイベント ${myEvents.length} 本が R.DB.events にある`, myEvents.every((id) => D.events[id]), myEvents.filter((id) => !D.events[id]));
{
  const miss = [];
  for (const id of MY_MAPS.concat(['world'])) {
    const m = D.maps[id];
    for (const o of m.objects || []) if (o.event && /^(desert|kasim|sandedge)/.test(o.event) && !D.events[o.event]) miss.push(`${id} obj ${o.event}`);
    for (const n of m.npcs || []) if (typeof n.talk === 'string' && !D.events[n.talk]) miss.push(`${id} npc ${n.id} → ${n.talk}`);
    for (const t of m.triggers || []) if (!D.events[t.event]) miss.push(`${id} trigger ${t.event}`);
  }
  ok('マップの人・物・範囲のイベントがすべてある', miss.length === 0, miss);
}
const leads = Object.entries(D.leads).filter(([, l]) => l.region === 'r_desert');
ok(`砂漠の手がかり ${leads.length} 件（地方・依頼・うわさ）`, leads.length >= 18, leads.length);
ok('ボスの編成（鷹団の頭・アジト・砂もぐり・砂の王）', ['tr_b_hawkchief', 'tr_b_hawkhold', 'tr_b_sandworm', 'tr_b_sandking'].every((t) => D.troops[t]));
ok('地方 r_desert の錠が外れ、光の柱の場所がある', !D.regions.r_desert.slice && !!D.regions.r_desert.beaconAt);
// 地方の slice:'locked' は「まだ作っていない地方」（湿原・灰の荒野は marsh_*.js・ash_*.js で開いた）。
//   体験版で行けないこと自体は、ワールドの峠の崖崩れと番人（cond {slice:true}）が受け持つ（qa/progress.js の 3b・5）
ok('まだ作っていない地方（諸島・鉱山・星）は錠のまま', ['r_isles', 'r_mine', 'r_star'].every((id) => D.regions[id].slice === 'locked'));
{
  const W = D.maps.world;
  ok('体験版では砂漠への南の峠と灰の荒野への峠に番人が立つ（cond {slice:true}）', ['guard_south', 'guard_ash'].every((id) => (W.npcs || []).some((n) => n.id === id && n.cond && n.cond.slice === true)));
}

// ================================================================ 2
section('2. 置き場所（A27・泉・宝箱）');
{
  const dungeons = MY_MAPS.filter((id) => D.maps[id].kind === 'dungeon');
  // 泉は 1 ダンジョンに 1 つまで（WORLD §6.2、check_springs）: 砂漠のダンジョンでは王墓 3 階の王の前だけ
  const withSpring = dungeons.filter((id) => (D.maps[id].objects || []).some((o) => o.type === 'spring'));
  ok(`ダンジョン ${dungeons.length} 階のうち泉は王墓 3 階だけ`, withSpring.join() === 'desert_tomb_3', withSpring);
  const secretOut = MY_MAPS.filter((id) => D.maps[id].kind !== 'dungeon' && Object.values(D.maps[id].legend).some((l) => l.secret));
  ok('隠し通路はダンジョンの中だけ（町・野営地・屋内に無い）', secretOut.length === 0, secretOut);
  const w = D.maps.world;
  const inDesert = (o) => { const [x, y] = R.WorldXform ? R.WorldXform.lcell(w, o.x, o.y) : [o.x, o.y]; return x >= 8 && x <= 95 && y >= 118 && y <= 166; };   // 箱は論理の座標 L（WORLD v3）
  ok('ワールドの砂漠に宝箱なし', !(w.objects || []).some((o) => o.type === 'chest' && inDesert(o)));
  const townChests = MY_MAPS.filter((id) => D.maps[id].kind !== 'dungeon').flatMap((id) => (D.maps[id].objects || []).filter((o) => o.type === 'chest').map((o) => id + ':' + o.id));
  ok(`町の宝箱は見える物だけ（${townChests.length} 個、どれも通りから見える床の上）`, townChests.length <= 4, townChests);
  // 宝箱は床の上で、上に重なる物が無い
  const bad = [];
  for (const id of MY_MAPS) {
    const m = D.maps[id];
    for (const o of (m.objects || []).filter((q) => q.type === 'chest')) {
      const c = R.MapUtil.cell(m, o.x, o.y);
      if (!c || c.solid || c.walk === false || c.secret) bad.push(`${id} ${o.id} not on floor`);
      if ((m.objects || []).some((q) => q !== o && q.type !== 'chest' && q.x === o.x && q.y === o.y)) bad.push(`${id} ${o.id} under another object`);
    }
  }
  ok('宝箱は床の上で、ほかの物と重ならない', bad.length === 0, bad);
  // 入口から届く（隠し通路を通らずに届かない宝箱は、隠し部屋の分だけ）
  const hidden = [];
  for (const id of MY_MAPS.filter((q) => D.maps[q].kind === 'dungeon')) {
    const m = D.maps[id];
    const starts = Object.keys(m.spawns || {}).map((s) => M.dest({ map: id, spawn: s }));
    const res = M.bfs(m, starts, { blocked: (x, y) => { const c = R.MapUtil.cell(m, x, y); return !!(c && c.secret); } });
    for (const o of (m.objects || []).filter((q) => q.type === 'chest')) if (!M.standCells(id, { kind: 'obj', ref: o }).some((c) => res.get(c.x, c.y, c.lv))) hidden.push(`${id}:${o.id}`);
  }
  ok(`隠し通路の先の宝箱（ご褒美）は ${hidden.length} 個`, hidden.length <= 3, hidden);
}

// ================================================================ 3
section('3. 文（ボイス・A36）');
{
  // 2026-09-28: 地方のボイスを再開。使う id は voice_story_map.json の story か script.csv の録音済みの行で、音のファイルがある（文面は qa/check_voice.js）
  const CHRON = path.resolve(V2, '..');
  const SMAP = JSON.parse(fs.readFileSync(path.join(V2, 'design', 'voice_story_map.json'), 'utf8')).lines;
  const SCRIPT = fs.readFileSync(path.join(CHRON, 'design', 'voice', 'script.csv'), 'utf8');
  const ids = [...new Set([...SRC.matchAll(/'(v_[a-z]+_[a-z0-9]+_\d\d)'/g)].map((m) => m[1]))];
  const bad = ids.filter((id) => !((SMAP[id] && SMAP[id].kind === 'story') || SCRIPT.includes('\n' + id + ',')) || !fs.existsSync(path.join(CHRON, 'assets', 'voice', id + '.ogg')));
  ok(`砂漠のイベントのボイス ${ids.length} 本は、どれも台本にあって音のファイルがある`, bad.length === 0, bad);
  ok('砂漠のイベントのボイスは {hero} を読まない（voice_story_map.json の文面に {hero} が無い）', ids.every((id) => !(SMAP[id] && /\{hero\}/.test(SMAP[id].text))));
}
{
  const names = Object.values(D.companions || {}).map((c) => c.name).filter((n) => n && n.length >= 2);
  const hits = names.filter((n) => SRC.includes(n) || MAP_SRC.includes(n));
  ok(`仲間 ${names.length} 人の名前を砂漠の文に出さない（A36）`, hits.length === 0, hits);
}

// ================================================================ 4
section('4. 筋（閉包）');
{
  const P = require('./qa/progress');
  P.init(R);
  // 砂漠は縦切り（DB.config.slice）の外。ワールドの閉じ（guard_south）を外した形で閉包を回す（本物の config は変えない: この R の中だけ）
  const slice0 = D.config.slice;
  D.config.slice = false;
  R.MapUtil.invalidate();
  for (const hawk of ['fight', 'water', 'pay']) for (const route of ['short', 'long']) {
    const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_desert_hawk: hawk, ch_desert_route: route, ch_desert_write: 'pain' } });
    ok(`鷹団=${hawk} 道=${route}: clearRegion('r_desert')`, !!(r.flags.cleared_r_desert && r.flags.desert_finale_done && r.flags.desert_reward_given), { king: !!r.flags.desert_king, cleared: !!r.flags.cleared_r_desert });
  }
  const r = P.closure({ variant: { ch_forest_pim: 'send', ch_forest_fawn: 'heal', ch_forest_write: 'pain', ch_desert_hawk: 'water', ch_desert_route: 'long' }, restricted: true });
  ok('隠し通路・寄り道・依頼なしでも着く', !!r.flags.cleared_r_desert);
  D.config.slice = slice0;
  R.MapUtil.invalidate();
  ok('縦切りのあいだ（slice）は砂漠へ行けない（guard_south が閉じたまま）', (() => { const q = P.closure({ variant: {} }); return !q.visited.has('kasim') && !q.visited.has('sandedge'); })());
}
{
  // 解決: ページ・ティア +1・pendingTier（R.Events._clearRegion をそのまま、演出は止める）
  R.State.newGame({ seed: 7 });
  const G = R.Game;
  G.tier = 1;
  const cel = R.Tier.celebrate;
  R.Tier.celebrate = async () => {};
  let t = null;
  R.Events._clearRegion('r_desert').then((v) => { t = v; });
  setTimeout(() => {
    R.Tier.celebrate = cel;
    ok('clearRegion: ティア 1 → 2、pendingTier、cleared_r_desert', t === 2 && G.pendingTier === 2 && G.flags.cleared_r_desert === true, { t, pending: G.pendingTier });
    const page = R.Tier.regionInfo('r_desert').pageId;
    ok('clearRegion: ページを持つ', !page || (G.items[page] || 0) > 0, page);
    battle();
  }, 0);
}

// ================================================================ 5
function battle() {
  section('5. 戦闘（予告・第 2 の姿・名を呼ぶ・盗み専用）');
  const A = D.bossActions;
  for (const id of ['eb_hawk_dust', 'eb_worm_rear', 'eb_worm_sink', 'eb_king_raise']) ok(`${id} は予告（telegraph → next）`, !!(A[id] && A[id].telegraph && A[A[id].telegraph.next]));
  ok('砂の王は第 2 の姿（hpBelow 0.4）', !!(D.monsters.b_sandking.phases || []).length);
  ok('名を呼ぶ道具は戦闘の中で special desert_call_name', D.items.i_desert_kingname.use.effects[0].id === 'desert_call_name');
  ok('盗み専用: 砂の王 ac_st_sandking・黄金の守護像 hn_st_gold_idol は盗みだけ（イベントで渡さない）', ['ac_st_sandking', 'hn_st_gold_idol'].every((id) => D.items[id] && D.items[id].stealOnly && !SRC.includes(id)) && D.stealSources.ac_st_sandking.mon === 'b_sandking');
  // 名を呼ぶ: 第 2 の姿の前は道具が戻る、後は王が倒れる（R.BattleCore の本物の特別な効果）
  const BC = R.BattleCore;
  const fake = (rate, phase) => {
    const king = { alive: true, d: { orbHost: true }, hpRate: () => rate, phaseDone: phase ? [true] : [] };
    const eng = { mons: [king], inv: {}, flags: {}, m: (t) => ({ t: 'msg', text: t }), *die(u) { u.alive = false; yield { t: 'die' }; } };
    const out = [...BC.specials.desert_call_name(eng, {}, king, {}, { id: 'i_desert_kingname' })];
    return { eng, king, out };
  };
  const a = fake(0.8, false);
  ok('名を呼ぶ（早すぎる）: 道具が戻り、王は倒れない', a.eng.inv.i_desert_kingname === 1 && a.king.alive);
  R.State.newGame({ seed: 8 });
  const b = fake(0.3, true);
  ok('名を呼ぶ（第 2 の姿の後）: 王が倒れ、desert_named', !b.king.alive && R.Game.flags.desert_named === true);
  // 砂もぐり（2026-10-01 オーナー「3 ターンに 1 回しか攻撃してこない」）: 攻めの手番の割合・続けて休まない・土で予告を消す／引きずり出す
  {
    const BC = R.BattleCore, AI = R.BattleAI, A = D.bossActions;
    const { buildParty, STD } = require('./sim_zones');
    const inv = { i_salve: 6, i_revive: 2, i_waker: 4, i_antidote: 3, i_clear: 2 };
    const party = buildParty(R, { tier: 1, kind: 'mid', members: STD, items: inv, seed: 5 });
    const offensive = (id) => id === 'attack' || !!(A[id] && (A[id].target !== 'self' || (A[id].effects || []).some((e) => e.type === 'damage')));
    const E = BC.Engine.prototype, exec0 = E.execute;
    let log = null;
    E.execute = function* (u, cmd) { if (log && !u.isParty && u.id === 'b_sandworm') log.push({ id: cmd.type === 'attack' ? 'attack' : cmd.id, round: this.round }); yield* exec0.call(this, u, cmd); };
    let acts = 0, off = 0, streak = 0, maxIdle = 0;
    try {
      for (let i = 0; i < 40; i++) {
        log = [];
        BC.simulate({ party, troop: 'tr_b_sandworm', tier: 1, seed: 'worm-reg:' + i, inv, maxRounds: 30, ai: AI.styleAI('script') });
        let s = 0;
        for (const x of log) { acts++; if (offensive(x.id)) { off++; s = 0; } else { s++; maxIdle = Math.max(maxIdle, s); } }
      }
    } finally { E.execute = exec0; log = null; }
    ok(`砂もぐり: 攻めの手番が 6 割以上（台本 40 戦 ${acts} 手番で ${Math.round((100 * off) / acts)}%）`, off / acts >= 0.6, { acts, off });
    ok('砂もぐり: 攻めない手番は続かない（身を沈める予告の 1 手番だけ）', maxIdle <= 1, maxIdle);
    ok('砂もぐり: もぐりざまの一撃（eb_worm_sink）はダメージがあり、予告の次は砂中の一撃', A.eb_worm_sink.effects.some((e) => e.type === 'damage') && A.eb_worm_sink.telegraph.next === 'eb_worm_burst');
    // 土で打つ: 予告（身を沈める）の間 → もぐれない／もぐっている間 → すぐ引きずり出す（battle_core の cancel・cancel.special）
    const isEarth = (a) => !!(a && ((a.elements || []).includes('earth') || (a.effects || []).some((e) => e.type === 'damage' && e.element === 'earth')));
    const earthAI = (want) => (eng) => {
      const w = eng.living('mon')[0];
      return eng.party.map((u) => {
        if (!u.commandable()) return null;
        if (w && w.reserved && w.reserved.id === want) {
          const o = AI.abilityOptions(eng, u).find((x) => isEarth(x.ab) && x.ab.target === 'enemy' && x.mp <= u.mp);
          if (o) return { type: o.type, id: o.id, target: w };
        }
        return { type: 'defend' };
      });
    };
    // 墓荒らしの土の石で 術の使える 3 人が『石つぶて』を覚えた一行（1 人が倒れても試せる）
    const earthParty = party.map((c, i) => (i >= 1 ? Object.assign({}, c, { spells: (c.spells || []).concat(['s_earth_1']) }) : c));
    const probe = (want) => {
      const seen = [];
      const ex1 = E.execute;
      E.execute = function* (u, cmd) {
        const before = { sunk: !!this.flags.worm_sunk };
        yield* ex1.call(this, u, cmd);
        if (u.isParty && cmd.target && cmd.target.id === 'b_sandworm' && isEarth(BC.ACT(cmd.id))) seen.push({ before, after: { sunk: !!this.flags.worm_sunk, reserved: cmd.target.reserved && cmd.target.reserved.id, slash: (cmd.target.ownDef().phys || {}).slash } });
      };
      // 術の人が砂もぐりより遅いと先に大技が来るので、いくつかの種で試す
      try { for (let i = 0; i < 12 && seen.length < 3; i++) BC.simulate({ party: earthParty, troop: 'tr_b_sandworm', tier: 1, seed: 'worm-earth:' + i, inv, maxRounds: 8, ai: earthAI(want) }); } finally { E.execute = ex1; }
      return seen;
    };
    const r1 = probe('eb_worm_sink');
    ok('土で打つ（身を沈める予告の間）: 予告が消えてもぐらない', r1.length > 0 && r1.every((x) => !x.after.reserved && !x.after.sunk), r1);
    const r2 = probe('eb_worm_burst');
    ok('土で打つ（もぐっている間）: 砂中の一撃が消え、すぐに顔を出す（刃が通る）', r2.length > 0 && r2.some((x) => x.before.sunk) && r2.every((x) => !x.after.sunk && !x.after.reserved && !(x.after.slash < 1)), r2);
  }
  done('test_content_desert');
}
