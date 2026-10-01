#!/usr/bin/env node
// 技・術の演出（R.BFX.seq、node）: 全部の技・術が別の演出 id と別の中身を持つ・段が上がるほど長い・全部の部品が描ける（仮の 2D の口）・
// 2 回目からは短い・演出の出来事の流れ（当たる瞬間まで待ってから数字）。
//   node v2/tools/test_fx_seq.js
'use strict';
const { ok, section, done } = require('./lib/testkit');
const load = require('./lib/load');

const R = load({ quiet: true });
const S = R.BFX && R.BFX.seq;
const T = R.DB.techs, SP = R.DB.spells;

section('表');
ok('R.BFX.seq is present', !!S && typeof S.draw === 'function');
const ids = [...Object.keys(T).map((k) => ['techs', k]), ...Object.keys(SP).map((k) => ['spells', k])];
ok('128 techs and 79 spells in the data', Object.keys(T).length === 128 && Object.keys(SP).length === 79, [Object.keys(T).length, Object.keys(SP).length]);
const sids = ids.map(([db, k]) => S.idFor(db, k));
const missing = ids.filter((x, i) => !sids[i]).map((x) => x[1]);
ok('every tech / spell resolves to an fx id', !missing.length, missing);
ok('fx ids are all distinct', new Set(sids).size === sids.length);
// 表の行は技・術のほか、敵・ボスの行動・敵の合体技（R.BFX.seq.combo で足す。src/data/enemy_combos.js）も持てる
const EA = R.DB.enemyActions || {}, BA = R.DB.bossActions || {};
// 敵の合体技（R.DB.enemyCombos の merge.seq・steps[].seq が 'sq:<id>' で指す行）も許す
const comboSeq = new Set((JSON.stringify(R.DB.enemyCombos || {}).match(/"sq:[a-z0-9_]+"/g) || []).map((x) => x.slice(4, -1)));
const extra = Object.keys(S.table).filter((k) => !T[k] && !SP[k] && !EA[k] && !BA[k] && !comboSeq.has(k));
ok('no table rows for unknown ids', !extra.length, extra);
const actRows = Object.keys(S.table).filter((k) => !T[k] && !SP[k]).map((k) => S.get('sq:' + k));
ok('enemy / boss action rows compile with known parts and a hit effect', actRows.every((s) => s && s.hit.length > 0 && [...s.main, ...s.hit].every((L) => !!S.prims[L.p])), actRows.filter((s) => !s || !s.hit.length).map((s) => s && s.id));
// 合わせ技の組み立て（S.combo）: 段 5・画像の部品の層と、画像が無い時の手続きの層を持つ（試しの行は表から消す）
{
  const sid = S.combo('__combo_probe', 'fire', 'ice');
  const sp = S.get(sid);
  ok('S.combo builds a tier-5 row with image parts and code fallbacks', sp.tier === 5 && sp.main.some((L) => L.p === 'img' && L.id === 'combo_vortex') && sp.main.some((L) => L.p === 'vortex') && sp.hit.some((L) => L.p === 'img' && L.id === 'combo_burst') && sp.hit.some((L) => L.p === 'ring'));
  delete S.table.__combo_probe; delete S.cache[sid];
}
const specs = sids.filter(Boolean).map((sid) => S.get(sid));
ok('every row compiles', specs.every(Boolean));
const sig = new Map();
const dup = [];
for (const s of specs) { if (sig.has(s.sig)) dup.push([sig.get(s.sig), s.id]); else sig.set(s.sig, s.id); }
ok('no two techs / spells look the same (distinct layer signatures)', !dup.length, dup);
const badPrim = [];
for (const s of specs) for (const L of [...s.main, ...s.hit]) if (!S.prims[L.p]) badPrim.push(s.id + ':' + L.p);
ok('every layer names a known part', !badPrim.length, badPrim);
ok('every row has a concept note (FX_PLAN)', specs.every((s) => s.c && s.c.length > 4), specs.filter((s) => !s.c).map((s) => s.id));
ok('every row has a hit effect', specs.every((s) => s.hit.length > 0));

section('段（tier）');
const byTier = {};
for (const s of specs) (byTier[s.tier] = byTier[s.tier] || []).push(s);
ok('tiers 1〜6 are all used', [1, 2, 3, 4, 5, 6].every((t) => (byTier[t] || []).length), Object.keys(byTier));
ok('rank 10 techs and triple spells are tier 6', specs.filter((s) => { const d = T[s.key] || SP[s.key]; return d.rank === 10 && d.kind === 'tech' || d.cls === 'triple'; }).every((s) => s.tier === 6));
ok('combo spells (A/B) are tier 5', specs.filter((s) => SP[s.key] && /combo/.test(SP[s.key].cls)).every((s) => s.tier === 5));
const avg = (t) => byTier[t].reduce((a, s) => a + s.dur, 0) / byTier[t].length;
const avgs = [1, 2, 3, 4, 5, 6].map(avg);
ok('average length grows with the tier', avgs.every((v, i) => !i || v > avgs[i - 1]), avgs.map(Math.round));
const minTop = Math.min(...byTier[5].concat(byTier[6]).map((s) => s.dur));
const maxMid = Math.max(...byTier[3].concat(byTier[2], byTier[1]).map((s) => s.dur));
ok('every top-tier (5–6) set piece is longer than every mid tier (1–3) effect', minTop > maxMid, { minTop, maxMid });
ok('tier 6 set pieces: 1.5〜2.6 s', byTier[6].every((s) => s.dur >= 1500 && s.dur <= 2600), byTier[6].filter((s) => s.dur < 1500 || s.dur > 2600).map((s) => [s.key, s.dur]));
ok('tier 5 set pieces: 1.2〜2.2 s', byTier[5].every((s) => s.dur >= 1200 && s.dur <= 2200), byTier[5].filter((s) => s.dur < 1200 || s.dur > 2200).map((s) => [s.key, s.dur]));
ok('tier 1 effects are short (≤ 0.75 s)', byTier[1].every((s) => s.dur <= 750 && s.hitDur <= 750), byTier[1].filter((s) => s.dur > 750 || s.hitDur > 750).map((s) => [s.key, s.dur, s.hitDur]));
ok('only tier 6 has the cut-in banner', specs.every((s) => s.banner === (s.tier === 6)));
ok('tier ≥ 4 dims the screen, tier ≤ 3 does not', specs.every((s) => (s.tier >= 4) === s.main.some((L) => L.p === 'dim')));
ok('tier ≥ 3 shakes and flashes', specs.filter((s) => s.tier >= 3).every((s) => s.shakes.length && s.main.some((L) => L.p === 'flash')));
ok('tier 1 does not shake', byTier[1].every((s) => !s.shakes.length));
ok('hit effects are short (≤ 0.8 s, damage numbers stay readable)', specs.every((s) => s.hitDur <= 800), specs.filter((s) => s.hitDur > 800).map((s) => [s.key, s.hitDur]));

section('2 回目からは短く');
R.Game = R.Game || {};
R.Game.vars = {};
const top = S.get('sq:s_fire_light_dark');
ok('not seen at first', !S.seen('sq:s_fire_light_dark') && S.rateFor(top, false) === 1);
S.markSeen('sq:s_fire_light_dark');
ok('seen after mark (stored in R.Game.vars.fx_seen, a string)', S.seen('sq:s_fire_light_dark') && typeof R.Game.vars.fx_seen === 'string');
ok('top tier plays ≥ 1.4× faster the second time', S.rateFor(top, true) >= 1.4);
ok('low tiers are not shortened', S.rateFor(S.get('sq:t_sword_stepcut'), true) === 1);

section('描く（仮の 2D の口で、全部の段・全部の時間）');
const grad = { addColorStop() {} };
const g = new Proxy({ globalAlpha: 1, globalCompositeOperation: 'source-over', createLinearGradient: () => grad, createRadialGradient: () => grad, measureText: () => ({ width: 10 }) }, {
  get(t, k) { if (k in t) return t[k]; return () => {}; },
  set(t, k, v) { t[k] = v; return true; },
});
S.strict = true;
R.W = 960; R.H = 540; R.uiScale = 1;
const errs = [];
let frames = 0;
for (const spec of specs) {
  for (const dir of [-1, 1]) {
    const c = S.ctx({ src: { x: 640, y: 360, fy: 400, h: 70 }, tgts: [{ x: 300, y: 380, fy: 410, h: 50 }, { x: 170, y: 330, fy: 350, h: 40 }], dir, W: 960, H: 540, name: spec.name, seed: 7 });
    for (const part of ['main', 'hit']) {
      const D = part === 'main' ? spec.dur : spec.hitDur;
      for (let t = 0; t <= D + 40; t += 45) {
        try { S.draw(g, { seq: spec.id, part, c, rate: 1, hitIdx: 1 }, t); frames++; } catch (e) { errs.push(spec.id + ' ' + part + ' t=' + t + ': ' + e.message); break; }
      }
    }
  }
}
S.strict = false;
ok('every set piece draws without errors (both directions, all frames)', !errs.length, errs.slice(0, 5));
ok('frames drawn', frames > 5000, frames);
ok('draw returns false after the end', S.draw(g, { seq: 'sq:t_sword_stepcut', part: 'main', c: S.ctx({}), rate: 1 }, 99999) === false);

section('演出の流れ（playback）');
const P = R.Battle._.play;
ok('playback knows the seq ids', typeof P.seqOf === 'function' && P.seqOf({ cmd: 'skill', id: 't_sword_first' }) === 'sq:t_sword_first' && P.seqOf({ cmd: 'spell', id: 's_fire_1' }) === 'sq:s_fire_1');
ok('items and plain attacks keep the old effects', P.seqOf({ cmd: 'item', id: 'i_potion' }) === null && P.seqOf({ cmd: 'attack', id: 'attack' }) === null);
ok('old fx names still resolve (aliases)', ['slash3', 'arrow2', 'holy3', 'water1', 'pierce', 'explosion2'].every((n) => !!P.bfxId(n)));

done('test_fx_seq');
