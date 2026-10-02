#!/usr/bin/env node
// ボスの必殺技・大技の演出（src/art/fx/fx_seq_table_boss.js・src/systems/battle/ult_fx.js、node）:
//   1 どのボスにも、オリジナルの部品（tools/vfx/vfx_parts.json の group 'boss'）を使う演出の行が 1 つ以上・必殺技（ult）が 1 つ以上
//     （お供だけの編成・合体技で締めるボスは合体技の行でもよい）。地方の主・終盤・ラスボス・クリア後のボスは 3 つ以上（ラスボスは 6 つ以上）
//   2 行の部品は全部 assets/fx にある・行はボスの行動か、ボスの合体技が指す
//   3 全部の行が描ける（仮の 2D の口・両向き・全部の時間）・当たりは 0.8 秒まで・長さは 2.6 秒まで
//   4 差し込みの長さ: 初めて 1.1 秒・2 回目とくり返し中は短く・戦闘の速さで割る
//   node v2/tools/test_fx_boss.js
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const R = require('./lib/load')({ quiet: true });
const S = R.BFX.seq, D = R.DB;
const V2 = path.resolve(__dirname, '..');
const parts = JSON.parse(fs.readFileSync(path.join(V2, 'tools', 'vfx', 'vfx_parts.json'), 'utf8')).parts;
const BOSS_PARTS = new Set(parts.filter((p) => p.group === 'boss').map((p) => p.id));
const onDisk = (id) => fs.existsSync(path.join(V2, 'assets', 'fx', id + '.webp')) && fs.existsSync(path.join(V2, 'assets', 'fx', id + '.json'));

section('行と部品');
const rows = S.bossRows();
ok('boss rows exist', rows.length >= 80, rows.length);
const missing = [];
for (const k of rows) for (const id of S.partsOf(k)) if (!onDisk(id)) missing.push(k + ':' + id);
ok('every part a boss row uses is in assets/fx', !missing.length, missing.slice(0, 10));
ok('every boss row uses at least one original boss part', rows.every((k) => S.partsOf(k).some((id) => BOSS_PARTS.has(id))), rows.filter((k) => !S.partsOf(k).some((id) => BOSS_PARTS.has(id))));
const comboSeq = JSON.stringify(D.enemyCombos);
ok('rows are boss actions (with seq) or boss combo rows', rows.every((k) => (D.bossActions[k] && D.bossActions[k].seq === 'sq:' + k) || comboSeq.includes('"sq:' + k + '"')), rows.filter((k) => !(D.bossActions[k] && D.bossActions[k].seq === 'sq:' + k) && !comboSeq.includes('"sq:' + k + '"')));
ok('every boss part is used by a row', [...BOSS_PARTS].every((id) => rows.some((k) => S.partsOf(k).includes(id))), [...BOSS_PARTS].filter((id) => !rows.some((k) => S.partsOf(k).includes(id))));

section('ボスごと');
const IMPORTANT = { b_rooteater: 3, b_sandking: 3, b_whitedragon: 3, b_mistbeast: 3, b_captain: 3, b_ironwarden: 3, b_lavabeast: 3, b_stareater: 3, b_lazaro: 3, b_nemrea1: 3, b_nemrea2: 6, b_valzard_echo: 3, b_ouroboros: 3 };
const bosses = Object.entries(D.monsters).filter(([, M]) => (M.flags || []).includes('boss') && M.bossType !== 'add');
const per = {};
for (const [id, M] of bosses) {
  const ids = new Set();
  for (const a of M.actions || []) { let x = a.id; for (let i = 0; x && i < 4; i++) { ids.add(x); const t = (D.bossActions[x] || {}).telegraph; x = t && t.next; } }
  const own = [...ids].filter((k) => S.table[k] && rows.includes(k));
  for (const C of Object.values(D.enemyCombos)) if ((C.members || []).some((m) => m.mon && [].concat(m.mon).includes(id))) for (const s of C.steps || []) if (s.seq && /^sq:ec_b_/.test(s.seq)) own.push(s.seq.slice(3));
  per[id] = { n: own.length, ult: own.some((k) => S.isUlt(k)) || own.some((k) => /^ec_b_/.test(k)) };
}
const none = Object.entries(per).filter(([, v]) => !v.n).map(([k]) => k);
ok('every boss has at least one original effect', !none.length, none);
const noUlt = Object.entries(per).filter(([, v]) => !v.ult).map(([k]) => k);
ok('every boss has an ultimate (cut-in) or a boss combo row', !noUlt.length, noUlt);
const thin = Object.entries(IMPORTANT).filter(([k, n]) => !per[k] || per[k].n < n).map(([k, n]) => [k, per[k] && per[k].n, n]);
ok('region / finale / final / post-game bosses have several original effects', !thin.length, thin);

section('描く');
const grad = { addColorStop() {} };
const g = new Proxy({ globalAlpha: 1, globalCompositeOperation: 'source-over', createLinearGradient: () => grad, createRadialGradient: () => grad, measureText: () => ({ width: 10 }) }, {
  get(t, k) { if (k in t) return t[k]; return () => {}; },
  set(t, k, v) { t[k] = v; return true; },
});
S.strict = true;
R.W = 960; R.H = 540; R.uiScale = 1;
const errs = [], long = [];
for (const k of rows) {
  const spec = S.get('sq:' + k);
  if (spec.hitDur > 800 || spec.dur > 2600) long.push([k, spec.dur, spec.hitDur]);
  for (const dir of [-1, 1]) {
    const c = S.ctx({ src: { x: 240, y: 300, fy: 380, h: 160 }, tgts: [{ x: 640, y: 360, fy: 400, h: 70 }, { x: 720, y: 400, fy: 440, h: 70 }], dir, W: 960, H: 540, name: k, seed: 3 });
    for (const part of ['main', 'hit']) {
      const Dd = part === 'main' ? spec.dur : spec.hitDur;
      for (let t = 0; t <= Dd + 40; t += 50) {
        try { S.draw(g, { seq: spec.id, part, c, rate: 1, hitIdx: 0 }, t); } catch (e) { errs.push(k + ' ' + part + ' t=' + t + ': ' + e.message); break; }
      }
    }
  }
}
S.strict = false;
ok('every boss row draws without errors (both directions, all frames)', !errs.length, errs.slice(0, 5));
ok('boss rows: hit ≤ 0.8 s, whole ≤ 2.6 s', !long.length, long);
ok('ultimates are tier 5–6 and dim the screen', rows.filter((k) => S.isUlt(k)).every((k) => { const s = S.get('sq:' + k); return s.tier >= 5 && s.main.some((L) => L.p === 'dim'); }));
ok('boss rows do not use the tier-6 tech banner (the cut-in names the move)', rows.every((k) => !S.get('sq:' + k).banner));

section('差し込み（ult_fx）');
const U = R.Battle._.ult;
ok('ult module is present and wraps the banner drawing', !!U && typeof U.play === 'function' && !!R.Battle._.glimmer.drawBanner._ult);
R.Game = R.Game || {}; R.Game.vars = {};
const sid = 'sq:eb_nemrea2_close';
const st = (sp, rep) => ({ speed: () => sp, B: { repeatOn: !!rep } });
ok('first time 1.1 s at normal speed', U.msFor(st(1), sid) === 1100);
ok('faster battle speed shortens it', U.msFor(st(2), sid) === 550 && U.msFor(st(5), sid) <= 230);
ok('repeat (auto) mode uses the short one', U.msFor(st(1, true), sid) === 650);
S.markSeen(sid);
ok('second time is short (0.65 s)', U.msFor(st(1), sid) === 650);
ok('only ultimate rows trigger the cut-in', U.is(sid) && !U.is('sq:eb_unwrite') && !U.is('sq:t_sword_first'));

done('test_fx_boss');
