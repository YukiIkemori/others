#!/usr/bin/env node
// A8 spells の単体テスト（DESIGN §7.12.3・§7.13・§4.9・§3.3.7）。失敗が 1 つでもあれば exit 1。
//
//   node tools/test_spells.js [--rules auto|shim|real] [-v]
//
// 1. 術 77 の形（id・属性・cls/glim/rank/order/step・MP の範囲・名前と説明の幅・効果・対象・fx・フィールドの術）
// 2. 属性 6・状態 15 の形
// 3. R.Glimmer: 候補の規則（§7.1.4・§4.9.3・§6.4.4）、重み、確率の式（§4.9.4 の検算の例）、魔石の入口、
//    glimmerForce、learn の副作用、params（§4.9.2）、spellId、banner
// 新しい R.Rules がまだ無いときは、tools/fixtures/spells/lib/harness.js の §4 の写しで動かす（出力の先頭に書く）。
'use strict';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const VERBOSE = args.includes('-v');
const H = require('./fixtures/spells/lib/harness')({ rules: opt('rules', 'auto') });
const R = H.R, DB = R.DB, G = R.Glimmer;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); }
  else { fail++; fails.push(msg); console.log('  NG  ' + msg); }
}
function near(a, b, eps, msg) { ok(Math.abs(a - b) <= eps, `${msg} (got ${+a.toFixed(6)}, want ${+b.toFixed(6)})`); }
function section(s) { console.log('\n# ' + s); }

console.log(`test_spells: rules=${H.info.rules}${H.info.specData.length ? ' specData=' + H.info.specData.join(',') : ''}`);

const EL = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
const PAIRS = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) PAIRS.push(EL[i] + '_' + EL[j]);
const TRIPLES = []; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) for (let k = j + 1; k < 6; k++) TRIPLES.push(EL[i] + '_' + EL[j] + '_' + EL[k]);
const spells = Object.keys(DB.actions).filter((k) => k.startsWith('s_'));
const S = (id) => DB.actions[id];
const width = (s) => { let w = 0; for (const ch of String(s)) w += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1; return w; };

// ---------------------------------------------------------------- 1. 術 77 の形
section('術 77 の形（§7.2・§7.3・§7.13）');
ok(spells.length === 77, `術がちょうど 77（${spells.length}）`);
for (const id of spells) ok(S(id).kind === 'spell', `${id}: kind === 'spell'`);
const singles = spells.filter((id) => S(id).elements.length === 1);
const pairs = spells.filter((id) => S(id).elements.length === 2);
const triples = spells.filter((id) => S(id).elements.length === 3);
ok(singles.length === 27 && pairs.length === 30 && triples.length === 20, `単 27・合成 30・三属性 20（${singles.length}/${pairs.length}/${triples.length}）`);
const STEPS = { fire: [1, 2, 3, 4, 5], light: [1, 2, 3, 4, 5], dark: [1, 2, 3, 4, 5], water: [1, 2, 3, 5], wind: [1, 2, 3, 5], earth: [1, 2, 3, 5] };
for (const e of EL) {
  const got = singles.filter((id) => S(id).elements[0] === e).map((id) => S(id).step).sort();
  ok(JSON.stringify(got) === JSON.stringify(STEPS[e]), `${e} の段が ${STEPS[e].join('・')}（${got.join('・')}）`);
}
for (const p of PAIRS) {
  ok(!!DB.actions['s_' + p + '_a'] && !!DB.actions['s_' + p + '_b'], `組 ${p} に A と B`);
}
for (const t of TRIPLES) ok(!!DB.actions['s_' + t], `3属性 ${t}`);

const GLIM = { single: { 1: [1, 0], 2: [2, 2], 3: [3, 4], 4: [5, 6], 5: [7, 8] }, comboA: [4, 5], comboB: [6, 7], triple: [8, 8] };
const MP = { 1: [2, 3], 2: [3, 5], 3: [5, 7], 4: [7, 9], 5: [11, 12], comboA: [7, 9], comboB: [10, 13], triple: [15, 20] };
const BIG4 = ['s_fire_water_wind', 's_fire_wind_earth', 's_fire_light_dark', 's_earth_light_dark'];
const orders = new Set();
for (const id of spells) {
  const a = S(id), els = a.elements;
  const sorted = els.slice().sort((x, y) => EL.indexOf(x) - EL.indexOf(y));
  ok(JSON.stringify(els) === JSON.stringify(sorted) && new Set(els).size === els.length && els.every((e) => EL.includes(e)), `${id}: 属性が正式な並び・重なりなし`);
  let wantId, cls, glim, mp, order;
  if (els.length === 1) {
    wantId = `s_${els[0]}_${a.step}`; cls = 'single'; glim = GLIM.single[a.step]; mp = MP[a.step];
    order = 10 * (EL.indexOf(els[0]) + 1) + a.step;
  } else if (els.length === 2) {
    const ab = id.endsWith('_a') ? 'a' : 'b';
    wantId = `s_${els.join('_')}_${ab}`; cls = ab === 'a' ? 'comboA' : 'comboB'; glim = GLIM[cls]; mp = MP[cls];
    order = 100 + 2 * PAIRS.indexOf(els.join('_')) + (ab === 'a' ? 0 : 1);
    ok(a.step === undefined, `${id}: 合成術に step が無い`);
  } else {
    wantId = `s_${els.join('_')}`; cls = 'triple'; glim = GLIM.triple; mp = MP.triple;
    order = 200 + TRIPLES.indexOf(els.join('_'));
  }
  ok(id === wantId, `${id}: id が属性から作れる（${wantId}）`);
  ok(a.cls === cls, `${id}: cls ${cls}（${a.cls}）`);
  ok(a.glim && a.glim.lv === glim[0] && a.glim.prof === glim[1], `${id}: glim ${glim}（${a.glim && [a.glim.lv, a.glim.prof]}）`);
  ok(a.rank === a.glim.lv, `${id}: rank === glim.lv`);
  ok(a.order === order && !orders.has(order), `${id}: order ${order}（${a.order}）`);
  orders.add(a.order);
  ok(a.mp >= mp[0] && a.mp <= mp[1], `${id}: MP ${a.mp} が ${mp[0]}〜${mp[1]}`);
  ok(a.magic === true, `${id}: magic:true`);
  ok(G.spellId(els, els.length === 1 ? a.step : els.length === 2 ? (cls === 'comboA' ? 'a' : 'b') : null) === id, `${id}: R.Glimmer.spellId で同じ id`);
  ok(typeof a.name === 'string' && width(a.name) <= 8, `${id}: 名前 ${a.name} は 8 字以内（${width(a.name)}）`);
  ok(typeof a.desc === 'string' && width(a.desc) <= 20 && !a.desc.includes('\n'), `${id}: desc は 1 行 20 字以内（${width(a.desc)}）`);
}
for (const id of BIG4) ok(S(id).mp === 20, `大技 ${id} の MP は 20`);

section('効果・対象（§7.3.2・§7.3.3）');
const TYPES = new Set(['damage', 'heal', 'revive', 'cure', 'status', 'buff', 'dispel', 'healWp', 'encounter']);
const GOOD = new Set(['regen', 'veil', 'counter', 'nimble', 'cover']);
const TARGETS = { enemy: 17, enemies: 30, random: 3, ally: 4, allies: 19, self: 1, ally_dead: 2, party: 1 };
const tcount = {};
const FIELD_OK = new Set(['heal', 'revive', 'healWp', 'cure']);
for (const id of spells) {
  const a = S(id);
  tcount[a.target] = (tcount[a.target] || 0) + 1;
  ok(Object.prototype.hasOwnProperty.call(TARGETS, a.target), `${id}: target ${a.target}`);
  ok(Array.isArray(a.effects) && a.effects.length > 0, `${id}: 効果がある`);
  ok(a.scale === undefined && a.element === undefined && a.escape === undefined, `${id}: scale/element/escape を書いていない`);
  for (const e of a.effects) {
    ok(TYPES.has(e.type), `${id}: 効果の型 ${e.type}`);
    ok(e.element === undefined && e.metalHit === undefined && e.scale === undefined, `${id}: 効果に element/metalHit/scale が無い`);
    if (e.on !== undefined) ok(e.on === 'allies' || e.on === 'self', `${id}: on は allies か self`);
    if (e.type === 'damage') {
      ok(e.formula === 'magic' || e.formula === 'percent', `${id}: damage の formula ${e.formula}`);
      ok(typeof e.power === 'number' && e.power > 0, `${id}: power > 0`);
      if (e.hits !== undefined) ok(Number.isInteger(e.hits) && e.hits >= 2, `${id}: hits は 2 以上の整数`);
      if (e.drain !== undefined) ok(e.drain > 0 && e.drain <= 0.5, `${id}: drain 0〜0.5`);
      if (e.ignoreMdef !== undefined) ok(e.ignoreMdef > 0 && e.ignoreMdef < 1, `${id}: ignoreMdef 0〜1`);
    }
    if (e.type === 'status') {
      ok(!!DB.statuses[e.status], `${id}: 状態 ${e.status} が DB.statuses にある`);
      if (GOOD.has(e.status)) ok(e.chance === undefined, `${id}: 良い状態 ${e.status} に chance が無い`);
      else ok(typeof e.chance === 'number' && e.chance > 0 && e.chance <= 0.5, `${id}: 悪い状態 ${e.status} の chance 0〜0.5`);
    }
    if (e.type === 'buff') {
      ok(['atk', 'def', 'mag', 'mdef', 'agi'].includes(e.stat), `${id}: buff.stat ${e.stat}`);
      ok(Number.isInteger(e.stages) && e.stages !== 0 && Math.abs(e.stages) <= 2, `${id}: stages −2〜+2`);
      if (e.stages > 0) ok(e.chance === undefined, `${id}: 味方の強化に chance が無い`);
    }
    if (e.type === 'dispel') ok(e.side === 'good' || e.side === 'bad', `${id}: dispel.side`);
    if (e.type === 'heal' || e.type === 'revive' || e.type === 'healWp') ok(e.pct > 0 && e.pct <= 1, `${id}: ${e.type}.pct`);
    if (e.type === 'cure') ok(e.statuses === 'all' || Array.isArray(e.statuses), `${id}: cure.statuses`);
  }
  if (a.target === 'random') ok(a.effects.some((e) => e.type === 'damage' && e.hits >= 2), `${id}: random には damage.hits`);
  if (a.field) {
    const fe = a.fieldEffects || a.effects.filter((e) => FIELD_OK.has(e.type));
    ok(fe.length > 0, `${id}: field:true の術に外で働く効果がある`);
  }
  if (a.fieldEffects) {
    ok(a.field === true, `${id}: fieldEffects なら field:true`);
    for (const e of a.fieldEffects) ok(e.type === 'encounter' && (e.pct === 100 || e.pct === -100) && e.steps === 100, `${id}: fieldEffects の encounter`);
  }
  const fx = Array.isArray(a.fx) ? a.fx : [a.fx];
  ok(fx.length >= 1 && fx.every((f) => typeof f === 'string' && /^[a-z]+[1-3]?$/.test(f)), `${id}: fx の形（${fx.join(',')}）`);
}
for (const t in TARGETS) ok((tcount[t] || 0) === TARGETS[t], `対象 ${t} の数 ${TARGETS[t]}（${tcount[t] || 0}）`);
const fieldIds = spells.filter((id) => S(id).field).sort();
ok(fieldIds.length === 15, `フィールドで使える術 15（${fieldIds.length}）`);
ok(S('s_fire_dark_a').fieldEffects[0].pct === 100 && !S('s_fire_dark_a').fieldEffects[0].weakOnly, '誘い火: 誘い寄せ（+100・100歩）');
ok(S('s_wind_dark_a').fieldEffects[0].pct === -100 && S('s_wind_dark_a').fieldEffects[0].weakOnly === true, '影隠れ: 弱い魔物だけ（−100・100歩）');
ok(S('s_wind_1').quick === true && S('s_fire_wind_a').quick === true && spells.filter((id) => S(id).quick).length === 2, '先制は 風切り・野を焼く風 の 2 つ');
ok(S('s_dark_5').effects[0].status === 'death' && S('s_dark_5').effects[1].type === 'damage', '黄泉の門は 即死 → ダメージ の順');
ok(S('s_earth_5').effects[2].on === 'allies' && S('s_water_light_dark').effects[2].on === 'allies', '［味方全員］は 大地の目覚め・月の満ち欠け');
for (const id of ['s_fire_1', 's_water_1', 's_wind_1', 's_earth_1', 's_light_1', 's_dark_1']) ok(S(id).step === 1, `1段 ${id}`);
ok(S('s_light_1').effects[0].type === 'heal' && ['s_fire_1', 's_water_1', 's_wind_1', 's_earth_1', 's_dark_1'].every((id) => S(id).target === 'enemy'),
  '1段: ひだまりは回復、ほかは敵1体への攻撃（§5.1.3）');

section('開始時の術と魔物（§7.13-8）');
for (const [cid, c] of Object.entries(DB.companions)) {
  if (cid.startsWith('_sim_')) continue;
  for (const s of c.startSpells || []) ok(!!DB.actions[s] && DB.actions[s].step === 1, `${cid} の startSpells ${s} は 1段`);
}
if (DB.starterKit && DB.starterKit.spell) for (const [e, s] of Object.entries(DB.starterKit.spell)) ok(DB.actions[s] && DB.actions[s].step === 1 && DB.actions[s].elements[0] === e, `starterKit.spell.${e} = ${s}`);
for (const [ht, h] of Object.entries(DB.heroTypes)) for (const k of ['weapon', 'element']) for (const s of ((h.onFavor || {})[k] || {}).spells || []) ok(DB.actions[s] && DB.actions[s].step === 1, `${ht}.onFavor.${k} の ${s} は 1段`);
let monSpell = 0;
for (const m of Object.values(DB.monsters)) for (const a of m.actions || []) if (String(a.id || a).startsWith('s_')) monSpell++;
ok(monSpell === 0, `魔物の行動に s_ が無い（${monSpell}）`);

// ---------------------------------------------------------------- 2. 属性と状態
section('属性 6・状態 15（§7.9）');
ok(JSON.stringify(Object.keys(DB.elements)) === JSON.stringify(EL), '属性の並び fire water wind earth light dark');
const RING = { fire: 'water', water: 'earth', earth: 'wind', wind: 'fire', light: 'dark', dark: 'light' };
for (const e of EL) {
  const d = DB.elements[e];
  ok(d && d.name && /^#[0-9a-f]{6}$/.test(d.color) && d.fx && d.sfx && d.icon === 'icon:el_' + e, `${e}: name/color/fx/sfx/icon`);
  ok(d.weakTo === RING[e], `${e}: weakTo ${RING[e]}`);
}
const ST_ORDER = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'death', 'regen', 'veil', 'counter', 'nimble', 'cover'];
ok(JSON.stringify(Object.keys(DB.statuses)) === JSON.stringify(ST_ORDER), '状態の並び（§7.9.2。印の並び順）');
for (const s of ST_ORDER) {
  const d = DB.statuses[s];
  ok(d.persists === false, `${s}: persists false`);
  ok(d.bad === !GOOD.has(s), `${s}: bad ${!GOOD.has(s)}`);
  ok(s === 'death' ? d.instant === true && d.icon === '' : width(d.icon) === 1, `${s}: 印は 1 字`);
  ok(typeof d.on === 'string' && d.on.includes('{name}'), `${s}: on に {name}`);
  ok(typeof d.off === 'string' && (d.off === '' || d.off.includes('{name}')), `${s}: off`);
  ok(d.turns === null || d.turns === 'next' || (Array.isArray(d.turns) && d.turns[0] <= d.turns[1]) || d.instant, `${s}: turns の形`);
}
ok(['sleep', 'paralyze', 'freeze', 'stun'].every((s) => DB.statuses[s].disable) && ST_ORDER.filter((s) => DB.statuses[s].disable).length === 4, 'disable は 眠り・まひ・凍結・気絶');
ok(DB.statuses.nimble.turns[0] === 3 && DB.statuses.cover.turns === 'next', '身軽 3 手番・かばう next');

// ---------------------------------------------------------------- 3. R.Glimmer
section('R.Glimmer: API');
for (const f of ['classOf', 'candidates', 'chance', 'roll', 'learn', 'params', 'monRank', 'pairsKnown', 'spellId', 'sideOf', 'banner', 'reindex']) ok(typeof G[f] === 'function', `R.Glimmer.${f}`);
ok(G.classOf(S('s_fire_1')) === 'single' && G.classOf(S('s_fire_wind_a')) === 'comboA' && G.classOf(S('s_fire_wind_b')) === 'comboB' && G.classOf(S('s_fire_wind_earth')) === 'triple', 'classOf 術');
const aTech = Object.keys(DB.actions).find((k) => DB.actions[k].kind === 'tech');
ok(aTech && G.classOf(DB.actions[aTech]) === 'tech', 'classOf 技');
ok(G.classOf(null) === null, 'classOf(null)');

const K = (R.Rules.K && R.Rules.K.GLIM) || G.SPEC.GLIM;
const PTS = (rank) => R.Glimmer.SPEC.PROF_PTS[rank];
const base = { rankB: 9, ef: 1, tier: 8, row: 'front', silenced: false };
const mage = (o) => H.makeChar(Object.assign({ id: 'teo', level: 50 }, o || {}));

section('術の候補（§7.1.4・§7.12.3 の例）');
{
  const c = mage({ eprof: { fire: PTS(5), wind: PTS(5), water: 0, earth: 0, light: 0, dark: 0 }, spells: ['s_fire_1'] });
  const ids = G.candidates(c, Object.assign({}, base, { kind: 'spell', elements: ['fire'], used: 's_fire_1', rankB: 6 })).map((x) => x.id);
  ok(ids.includes('s_fire_wind_a'), '火5・風5 で火の術 → s_fire_wind_a が候補');
  ok(!ids.includes('s_fire_wind_b'), '… s_fire_wind_b は候補でない（熟練 7 が要る）');
  ok(!ids.includes('s_fire_1'), '… 覚えている s_fire_1 は候補でない');
  ok(ids.includes('s_fire_2') && ids.includes('s_fire_3') && !ids.includes('s_fire_4'), '… 火の 2・3段は候補、4段（熟練 6）は候補でない');
  ok(!ids.some((id) => S(id).elements.length === 1 && S(id).elements[0] === 'wind'), '… 風だけの術は候補でない（使った属性を含まない）');
  const idsW = G.candidates(c, Object.assign({}, base, { kind: 'spell', elements: ['wind'], used: 's_wind_1', rankB: 6 })).map((x) => x.id);
  ok(idsW.includes('s_fire_wind_a'), '… 風の術を使っても s_fire_wind_a は候補（どちらの属性でも）');
  const idsLow = G.candidates(c, Object.assign({}, base, { kind: 'spell', elements: ['fire'], used: 's_fire_1', rankB: 3 })).map((x) => x.id);
  ok(!idsLow.includes('s_fire_wind_a') && idsLow.includes('s_fire_3'), 'rankB 3 では合成A（格4）は候補でなく、3段（格3）は候補');
  const c2 = mage({ eprof: { fire: PTS(5), wind: PTS(4) } });
  ok(!G.candidates(c2, Object.assign({}, base, { kind: 'spell', elements: ['fire'], rankB: 6 })).some((x) => x.id === 's_fire_wind_a'), '風の熟練 4 なら s_fire_wind_a は候補でない（すべての属性）');
}
{
  const all8 = { fire: PTS(8), water: PTS(8), wind: PTS(8), earth: PTS(8), light: PTS(8), dark: PTS(8) };
  const c = mage({ eprof: all8, spells: ['s_fire_wind_a'] });
  const ctx = Object.assign({}, base, { kind: 'spell', elements: ['fire'], rankB: 8 });
  ok(!G.candidates(c, ctx).some((x) => x.id === 's_fire_wind_earth'), '3属性: 組の合成術が 1 組だけなら候補でない');
  ok(G.pairsKnown(c, ['fire', 'wind', 'earth']) === 1, 'pairsKnown 1');
  c.spells.push('s_wind_earth_b');
  ok(G.pairsKnown(c, ['fire', 'wind', 'earth']) === 2, 'pairsKnown 2');
  ok(G.candidates(c, ctx).some((x) => x.id === 's_fire_wind_earth'), '3属性: 2 組（火風・風土）で候補');
  c.spells.push('s_fire_earth_a', 's_fire_earth_b');
  ok(G.pairsKnown(c, ['earth', 'fire', 'wind']) === 3, 'pairsKnown は同じ組の A・B を 1 つに数え、並びに依らない');
  ok(!G.candidates(c, Object.assign({}, ctx, { rankB: 7 })).some((x) => x.id === 's_fire_wind_earth'), '3属性は rankB 7 では候補でない');
  const c3 = mage({ eprof: Object.assign({}, all8, { earth: PTS(7) }), spells: ['s_fire_wind_a', 's_wind_earth_b'] });
  ok(!G.candidates(c3, ctx).some((x) => x.id === 's_fire_wind_earth'), '3属性: 土の熟練 7 なら候補でない');
  ok(G.candidates(c, Object.assign({}, ctx, { silenced: true })).length === 0, '沈黙なら術の候補は無い（§6.4.4-2）');
  const cNo = mage({ eprof: all8, mods: { noSpell: true } });
  ok(H.info.rules === 'real' || G.candidates(cNo, ctx).length === 0, 'noSpell の人は術を閃かない（§8.3.7）');
}
{
  const c = mage({ eprof: { fire: PTS(8) } });
  const cs = G.candidates(c, Object.assign({}, base, { kind: 'spell', elements: ['fire'], rankB: 8 }));
  const lvMin = Math.min(...cs.map((x) => S(x.id).glim.lv));
  ok(cs.every((x) => x.w === (S(x.id).glim.lv === lvMin ? 2 : 1)), '術の重み: 格の一番小さいものが 2、ほかは 1');
  ok(cs.every((x) => x.p > 0 && x.p <= K.cap), '候補の p は 0〜cap');
}
{
  const c = mage({ eprof: { light: PTS(6) }, spells: ['s_light_1'] });
  const ids = G.candidates(c, Object.assign({}, base, { kind: 'spell', elements: ['light'], rankB: 5 })).map((x) => x.id);
  ok(ids.includes('s_light_4'), '蘇生の術 s_light_4 は倒れた味方がいなくても候補になる（対象が無いときの扱いは battle。§7.0 の 0.12）');
}

section('技の候補（§4.9.3・§6.4.4）');
{
  const sw = Object.keys(DB.actions).filter((k) => DB.actions[k].kind === 'tech' && DB.actions[k].wtype === 'sword');
  ok(sw.length === 11, `剣の技 11（${sw.length}）`);
  const w = H.makeChar({ id: 'selma', level: 30, wprof: { sword: PTS(3) } });
  const ctx = Object.assign({}, base, { kind: 'tech', wtype: 'sword', used: 'attack', rankB: 5 });
  const cs = G.candidates(w, ctx);
  ok(cs.length > 0 && cs.every((x) => S(x.id).glim.lv <= 4), '熟練の段階 3 → 格 4 まで（lv − 1 ≤ 段階）');
  ok(cs.every((x) => S(x.id).wtype === 'sword'), '同じ系統だけ');
  ok(G.candidates(w, Object.assign({}, ctx, { rankB: 2 })).every((x) => S(x.id).glim.lv <= 2), 'rankB 2 → 格 2 まで');
  const lvMin = Math.min(...cs.map((x) => S(x.id).glim.lv));
  for (const x of cs) {
    const a = S(x.id);
    const want = (a.glim.from.includes('attack') ? K.wFrom : 1) * (a.glim.lv === lvMin ? K.wLowest : 1);
    ok(x.w === want, `重み ${x.id} = ${want}（from ×3・一番低い格 ×2）`);
  }
  const midCs = G.candidates(w, Object.assign({}, ctx, { row: 'middle' }));
  ok(midCs.every((x) => S(x.id).reach === true), '中列では reach:false の技を外す（§6.4.4-1）');
  const st = H.makeChar({ id: 'teo', level: 30, wprof: { staff: PTS(9) } });
  const stc = Object.assign({}, base, { kind: 'tech', wtype: 'staff', used: 'attack', rankB: 10 });
  ok(G.candidates(st, stc).length > 0 && G.candidates(st, Object.assign({}, stc, { silenced: true })).every((x) => !S(x.id).magic), '沈黙なら magic:true の技（杖）を外す');
  ok(G.candidates(w, Object.assign({}, ctx, { sealTech: true })).length === 0, 'sealTech の枠は技を閃かない');
  const lv10 = sw.find((id) => S(id).glim.lv === 10);
  const w9 = H.makeChar({ id: 'selma', wprof: { sword: PTS(9) } });
  ok(G.candidates(w9, Object.assign({}, ctx, { rankB: 10 })).some((x) => x.id === lv10), '極意（格 10）は rankB 10・熟練 9 で候補');
  ok(!G.candidates(w9, Object.assign({}, ctx, { rankB: 9 })).some((x) => x.id === lv10), '… rankB 9 では候補でない');
  const w8 = H.makeChar({ id: 'selma', wprof: { sword: PTS(8) } });
  ok(!G.candidates(w8, Object.assign({}, ctx, { rankB: 10 })).some((x) => x.id === lv10), '… 熟練 8 では候補でない');
  ok(G.candidates(w, Object.assign({}, ctx, { wtype: undefined })).length === 0, 'wtype が無ければ候補なし');
  const usedTech = sw.find((id) => S(id).glim.lv === 2);
  const withFrom = G.candidates(Object.assign(H.makeChar({ id: 'selma', wprof: { sword: PTS(5) } }), {}), Object.assign({}, ctx, { rankB: 6, used: usedTech }));
  const child = withFrom.find((x) => S(x.id).glim.from.includes(usedTech));
  ok(!child || child.w % K.wFrom === 0, 'used が from にある技は重み ×3');
}

section('確率の式（§4.9.4 の検算の例）');
{
  // 例1: プロローグのボス（rank 3・EF 2.5）で得意 S・器用さ 30 の主人公が lv1 の技 → 0.063
  const hero = H.makeChar({ heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' }, techs: [] });
  const dex = R.Rules.stats(hero).dex;
  const lv1 = Object.keys(DB.actions).find((k) => DB.actions[k].wtype === 'sword' && DB.actions[k].glim.lv === 1);
  const p1 = G.chance(hero, lv1, { kind: 'tech', wtype: 'sword', rankB: 3, ef: 2.5, tier: 0 });
  const want1 = 0.012 * 2 * U(((100 + dex) / 150), 0.7, 2) * 1 * 2.5 * 1.2;
  near(p1, want1, 1e-9, `例1 の p（器用さ ${dex}）`);
  if (dex === 30) near(p1, 0.0624, 0.001, '例1 = 約 0.063');
  // 例2: T4 の普通の戦闘、A の主な武器、器用さ 49、覚えている数 10 → 1.8%（B 1.2%・C 0.7%・D 0.36%、ボス A 5.4%）
  const lv5 = Object.keys(DB.actions).find((k) => DB.actions[k].wtype === 'sword' && DB.actions[k].glim.lv === 5);
  const mk = (letter) => {
    const id = H.defineSimChar('_sim_apt_' + letter, 'selma', { stats: { str: 50, vit: 44, dex: 49, agi: 28, int: 18, mnd: 30 } });
    R.DB.companions[id].apt = JSON.parse(JSON.stringify(R.DB.companions.selma.apt));
    R.DB.companions[id].apt.w.sword = letter;
    const c = H.makeChar({ id });
    c.techs = sw10(10);
    return c;
  };
  function sw10(n) { return Object.keys(DB.actions).filter((k) => DB.actions[k].kind === 'tech' && DB.actions[k].wtype !== 'sword').slice(0, n); }
  const ctx2 = { kind: 'tech', wtype: 'sword', rankB: 5, ef: 1, tier: 4 };
  const want = { A: 0.018, B: 0.012, C: 0.007, D: 0.0036 };
  for (const L of ['A', 'B', 'C', 'D']) {
    const c = mk(L);
    near(G.chance(c, lv5, ctx2), 0.012 * { A: 1.5, B: 1, C: 0.6, D: 0.3 }[L] * (149 / 150), 1e-9, `例2 の p（${L}）`);
    near(G.chance(c, lv5, ctx2), want[L], want[L] * 0.05, `例2 ≒ ${want[L] * 100}%（${L}）`);
  }
  near(G.chance(mk('A'), lv5, Object.assign({}, ctx2, { rankB: 7, ef: 2.5 })), 0.054, 0.001, '例2 のボス戦（A）≒ 5.4%');
  // 例3（術、T8、A の属性、候補の lv = rankB、覚えている数は EXPECT − 2 以上）: 知力 52 → 2.3%、112 → 3.2%、232 → 4.5%
  const mid = H.defineSimChar('_sim_mage_a', 'teo', { stats: { str: 18, vit: 24, dex: 30, agi: 34, int: 52, mnd: 42 } });
  R.DB.companions[mid].apt = JSON.parse(JSON.stringify(R.DB.companions.teo.apt));
  R.DB.companions[mid].apt.e.fire = 'A';
  const ctx3 = { kind: 'spell', elements: ['fire'], rankB: 5, ef: 1, tier: 8 };
  const pm = [];
  for (const [intAdd, w] of [[0, 0.023], [60, 0.032], [180, 0.045]]) {
    const c = H.makeChar({ id: mid, add: { int: intAdd } });
    c.spells = Object.keys(DB.actions).filter((k) => k.startsWith('s_') && !k.startsWith('s_fire')).slice(0, 17);
    const p = G.chance(c, 's_fire_5', ctx3);
    pm.push(p);
    if (H.info.rules !== 'real') near(p, w, w * 0.04, `例3 知力 ${52 + intAdd} → ${w * 100}%`);
  }
  if (H.info.rules !== 'real') {
    ok(pm[2] / pm[0] >= 1.8 && pm[2] / pm[1] >= 1.35, `知力の差 S/Z ${(pm[2] / pm[0]).toFixed(2)} ≥ 1.8、S/N ${(pm[2] / pm[1]).toFixed(2)} ≥ 1.35（§4.9.5）`);
  }
  // FK（少ない人ほど）と MARGIN（格上ほど）と上限
  const c0 = H.makeChar({ id: 'selma' });
  const pFK = G.chance(c0, lv5, ctx2);
  const c10 = H.makeChar({ id: 'selma' }); c10.techs = sw10(10);
  near(pFK / G.chance(c10, lv5, ctx2), 4, 1e-9, 'FK: T4 で 0 個の人は 4 倍（上限）');
  const c7 = H.makeChar({ id: 'selma' }); c7.techs = sw10(7);
  near(G.chance(c7, lv5, ctx2) / G.chance(c10, lv5, ctx2), 1 + 0.4 * (10 - 7 - 2), 1e-9, 'FK = 1 + 0.4 × (EXPECT − 覚えている数 − 2)');
  const c9 = H.makeChar({ id: 'selma' }); c9.techs = sw10(9);
  near(G.chance(c9, lv5, ctx2), G.chance(c10, lv5, ctx2), 1e-12, 'FK: 遅れ 2 以内は 1');
  near(G.chance(c10, lv5, Object.assign({}, ctx2, { rankB: 8 })) / G.chance(c10, lv5, ctx2), 1.3, 1e-9, 'MARGIN: rankB − 格 = 3 → ×1.3');
  near(G.chance(c10, lv1, Object.assign({}, ctx2, { rankB: 10 })) / G.chance(c10, lv1, Object.assign({}, ctx2, { rankB: 6 })), 1.5 / 1.5, 1e-9, 'MARGIN は 5 で止まる');
  near(G.chance(c10, lv5, Object.assign({}, ctx2, { ef: 2 })) / G.chance(c10, lv5, ctx2), 2, 1e-9, 'EF はそのままかかる');
  ok(G.chance(c0, lv5, Object.assign({}, ctx2, { ef: 10, rankB: 10 })) === K.cap, `上限 ${K.cap}`);
  ok(G.chance(c0, lv5, Object.assign({}, ctx2, { force: true })) === 1, 'force なら p = 1');
  if (H.info.rules !== 'real') {
    const cm = H.makeChar({ id: 'selma', mods: { glimPct: { sword: 20, tech: 10, spell: 30 } } }); cm.techs = sw10(10);
    near(G.chance(cm, lv5, ctx2) / G.chance(c10, lv5, ctx2), 1.3, 1e-9, 'glimPct: 系統 + tech（spell は足さない）');
    const cc = H.makeChar({ id: 'selma', mods: { glimPct: { sword: 90 } } }); cc.techs = sw10(10);
    near(G.chance(cc, lv5, ctx2) / G.chance(c10, lv5, ctx2), 1.4, 1e-9, 'glimPct はキーごとに +40 で止まる');
    const mm = H.makeChar({ id: mid, mods: { glimPct: { fire: 10, wind: 20, spell: 5 } } });
    const m0 = H.makeChar({ id: mid });
    near(G.chance(mm, 's_fire_wind_a', ctx3) / G.chance(m0, 's_fire_wind_a', ctx3), 1.25, 1e-9, 'glimPct: 術の属性の最大 + spell');
    const apt = R.Rules.aptitude(m0).e;
    near(G.chance(m0, 's_fire_wind_a', ctx3) / G.chance(m0, 's_fire_5', ctx3), (0.012 / 0.015) * ((apt.fire + apt.wind) / 2) / apt.fire * (1 + 0.1 * 1) / 1, 1e-9, '合成術: BASE comboA・APT は属性の平均');
  }
}

section('魔石の入口（§4.9.4）');
{
  const c = H.makeChar({ id: 'selma', spells: [] });
  const ctx = { kind: 'spell', elements: ['light'], rankB: 1, ef: 1, tier: 0, stone: true };
  const cs = G.candidates(c, ctx);
  ok(cs.length === 1 && cs[0].id === 's_light_1', '術 0 の人が光の魔石 → 候補は ひだまり');
  const pStone = G.chance(c, 's_light_1', ctx), pNo = G.chance(c, 's_light_1', Object.assign({}, ctx, { stone: false }));
  near(Math.min(K.cap, pNo * 10), pStone, 1e-12, '×10（上限はそのまま）');
  const c2 = H.makeChar({ id: 'selma', spells: ['s_earth_light_a'], eprof: { light: PTS(4) } });
  const p2 = G.chance(c2, 's_light_2', Object.assign({}, ctx, { rankB: 3 })), p2n = G.chance(c2, 's_light_2', Object.assign({}, ctx, { rankB: 3, stone: false }));
  near(p2, p2n, 1e-12, '光を含む術を覚えていれば ×10 しない');
}

section('roll・glimmerForce（§3.3.7）');
{
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const w = H.makeChar({ id: 'selma', wprof: { sword: PTS(1) } });
  const ctx = { kind: 'tech', wtype: 'sword', used: 'attack', rankB: 2, ef: 1, tier: 0, row: 'front', silenced: false };
  ok(G.roll(w, Object.assign({}, ctx, { rng: seq([0, 0.999]) })) === null, '当たらなければ null');
  const r1 = G.roll(w, Object.assign({}, ctx, { rng: seq([0, 0]) }));
  ok(r1 && r1.kind === 'tech' && S(r1.id).wtype === 'sword', '当たれば {id, kind:tech}');
  ok(w.techs.length === 0, 'roll は c を変えない');
  const rf = G.roll(w, Object.assign({}, ctx, { force: true, rng: seq([0.5, 0.999]) }));
  ok(rf && S(rf.id).wtype === 'sword', 'force: 候補から p = 1');
  const hero = H.makeChar({ heroType: 'mage', favor: { kind: 'element', id: 'fire' }, spells: ['s_fire_1'], equip: { weapon1: 'w_staff_novice' } });
  const rd = G.roll(hero, { kind: 'defend', rankB: 1, ef: 1, tier: 0, force: true, fallbackWtype: 'staff' });
  const staffLow = Object.keys(DB.actions).filter((k) => DB.actions[k].kind === 'tech' && DB.actions[k].wtype === 'staff').sort((a, b) => S(a).glim.lv - S(b).glim.lv)[0];
  ok(rd && rd.id === staffLow, `force で防御: 武器1の系統の一番低い覚えていない技（${rd && rd.id}）`);
  const hn = H.makeChar({ heroType: 'warrior', favor: { kind: 'weapon', id: 'sword' } });
  const rn = G.roll(hn, { kind: 'item', rankB: 1, ef: 1, tier: 0, force: true });
  ok(rn && rn.kind === 'tech', `force で道具（武器なし → 体術か武器1）: ${rn && rn.id}`);
  const rs = G.roll(hero, { kind: 'spell', elements: ['fire'], rankB: 1, ef: 1, tier: 0, force: true, fallbackWtype: 'staff' });
  ok(rs && rs.id === staffLow, '術の候補が無い（1段を覚えている・rank 1）ときも force は武器1の技');
  const hs = H.makeChar({ heroType: 'mage', favor: { kind: 'element', id: 'fire' }, spells: [] });
  const rs2 = G.roll(hs, { kind: 'spell', elements: ['fire'], rankB: 1, ef: 1, tier: 0, force: true, fallbackWtype: 'staff' });
  ok(rs2 && rs2.id === 's_fire_1' && rs2.kind === 'spell', '術の候補があれば force はその術');
  // 乱数の再現
  R.U.seed(7); const a1 = []; for (let i = 0; i < 50; i++) a1.push(JSON.stringify(G.roll(w, Object.assign({}, ctx, { ef: 20 }))));
  R.U.seed(7); const a2 = []; for (let i = 0; i < 50; i++) a2.push(JSON.stringify(G.roll(w, Object.assign({}, ctx, { ef: 20 }))));
  ok(a1.join() === a2.join(), 'R.U.seed で同じ結果');
  R.U.unseed();
  // 確率の実測（10 万回）
  const pc = G.chance(w, G.candidates(w, ctx)[0].id, ctx);
  let hits = 0; R.U.seed(11);
  const cands = G.candidates(w, ctx);
  const pAvg = cands.reduce((s, x) => s + x.w * x.p, 0) / cands.reduce((s, x) => s + x.w, 0);
  for (let i = 0; i < 100000; i++) if (G.roll(w, ctx)) hits++;
  R.U.unseed();
  near(hits / 100000, pAvg, pAvg * 0.1, `roll の当たる率 = 重みつき平均の p（${pc.toFixed(4)}）`);
}

section('learn（§3.3.7）');
{
  const saved = R.Game;
  R.Game = { book: { mon: {}, tech: {}, spell: {} }, records: { glimmers: 0 } };
  const had = R.State && R.State.noteLearned;
  let emitted = null;
  const fn = (c, id, kind) => { emitted = [c.id, id, kind]; };
  R.on('glimmer', fn);
  const c = H.makeChar({ id: 'marta', spells: ['s_light_1'] });
  ok(G.learn(c, 's_light_2') === true && c.spells.includes('s_light_2'), 'learn で c.spells に加わる');
  ok(c.counts.glimmers === 1, 'c.counts.glimmers++');
  ok(R.Game.records.glimmers === 1, 'R.Game.records.glimmers++');
  ok(had || (R.Game.book.spell.s_light_2 && R.Game.book.spell.s_light_2[0] === 'marta'), 'book.spell に記録（R.State.noteLearned か、無ければ直接）');
  ok(emitted && emitted[1] === 's_light_2' && emitted[2] === 'spell', "R.emit('glimmer', c, id, kind)");
  ok(G.learn(c, 's_light_2') === false && c.spells.filter((s) => s === 's_light_2').length === 1, '覚えている術は false・重ならない');
  emitted = null;
  const before = R.Game.records.glimmers;
  ok(G.learn(c, lvTech('sword', 1), { record: false }) === true && c.techs.length === 1, 'record:false でも c は変わる');
  ok(R.Game.records.glimmers === before && emitted === null, 'record:false なら R.Game と emit に触れない');
  ok(G.learn(c, 'e_nothing_here') === false, '無い id は false');
  R.off('glimmer', fn);
  R.Game = saved;
}
function lvTech(w, lv) { return Object.keys(DB.actions).find((k) => DB.actions[k].kind === 'tech' && DB.actions[k].wtype === w && DB.actions[k].glim.lv === lv); }

section('params・monRank（§4.9.2）');
{
  const p = (units, Tb) => G.params(units, Tb);
  ok(JSON.stringify(p([{ flags: [] }, { flags: [] }], 3)) === JSON.stringify({ rankB: 4, ef: 1 }), '普通: rank Tb+1・EF 1');
  ok(JSON.stringify(p([{ flags: [], golden: true }], 3)) === JSON.stringify({ rankB: 5, ef: 1.5 }), '金色: +1・EF 1.5');
  ok(JSON.stringify(p([{ flags: ['rare'] }], 3)) === JSON.stringify({ rankB: 6, ef: 2 }), 'レア魔物: +2・EF 2');
  ok(JSON.stringify(p([{ flags: ['boss'] }, { flags: [] }], 3)) === JSON.stringify({ rankB: 6, ef: 2.5 }), 'ボス: +2・EF 2.5（最大）');
  ok(JSON.stringify(p([{ flags: ['metal'] }], 3)) === JSON.stringify({ rankB: 5, ef: 1 }), '鋼: +1・EF 1');
  ok(p([{ def: { flags: [], rankAdd: 1 } }], 3).rankB === 5, 'rankAdd（夢食いバク）');
  ok(p([], 8).rankB === 9, '魔物がいなくても Tb+1');
}

section('補助');
{
  ok(G.sideOf('enemy') === 'foe' && G.sideOf('random') === 'foe' && G.sideOf(S('s_light_4')) === 'ally' && G.sideOf(S('s_earth_light_dark')) === 'ally', 'sideOf');
  ok(G.banner(S('s_fire_1')).title === '閃き！' && G.banner(S('s_fire_1')).color === DB.elements.fire.color, 'banner 単属性 = 閃き！・属性の色');
  ok(G.banner(S('s_water_wind_a')).title === '合成術' && G.banner(S('s_water_wind_a')).color === DB.elements.water.color, 'banner 合成術 = 最初の属性の色');
  ok(G.banner(S('s_water_earth_dark')).title === '合成術', 'banner 三属性 = 合成術');
  ok(G.banner(DB.actions[lvTech('sword', 9)]).title === '奥義' && G.banner(DB.actions[lvTech('sword', 10)]).title === '極意' && G.banner(DB.actions[lvTech('sword', 3)]).title === '閃き！', 'banner 技: 奥義・極意・閃き！');
  ok(G.spellId(['wind', 'fire'], 'A') === 's_fire_wind_a' && G.spellId(['dark', 'light', 'earth']) === 's_earth_light_dark', 'spellId は属性を並べ直す');
}

function U(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILED:\n  ' + fails.slice(0, 40).join('\n  ')); process.exit(1); }
