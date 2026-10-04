#!/usr/bin/env node
// 録音の効果音・環境音の床（design/notes/audio.md §15・§15.1。core/audio.js・tools/build.js・tools/pack_web.py）
//   node v2/tools/build.js && node v2/tools/test_sfx_media.js [--no-browser]
//   node の部: build の取り込み（keepSynth の効果音・keepProcedural / weak の床は入れない）、dist に写したファイルと RPG_MEDIA の表、
//              --single の埋め込み（mediaTable の embed）。
//   ブラウザの部（dist/index.html）: 全部の取り直しが裏で解ける、取り直しは続けて同じ物にならない、無い id・表から消した id は合成、
//              S.duck を録音でも借りる（glimmer）、vol / pan、環境音の床が録音を回す（作った床への戻り・同じファイルは鳴らし直さない）。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const ASSETS = path.join(V2, '..', 'assets');
const DIST = path.join(V2, 'dist');
const argv = process.argv.slice(2);
function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
// 外す物は assets の json の印から読む（取り直しで印が外れても直さなくてよい）
const jsonIds = (dir, keep) => fs.readdirSync(path.join(ASSETS, dir)).filter((f) => f.endsWith('.json')).filter((f) => keep(readJson(path.join(ASSETS, dir, f)))).map((f) => f.slice(0, -5));
const KEEP_SYNTH = jsonIds('sfx', (j) => j.keepSynth);
const SFX_REC = jsonIds('sfx', (j) => !j.keepSynth);
const NOT_AMB = jsonIds('amb', (j) => j.keepProcedural || j.weak).concat(['blizzard']);
const AMB_REC = jsonIds('amb', (j) => !(j.keepProcedural || j.weak));
const SYNTH_ID = KEEP_SYNTH[0] || null;   // 合成のまま鳴る id（今は無い → そのテストは表を消して確かめる）
function mediaOf(html) {
  const m = /<script>window\.RPG_MEDIA=(.*?);<\/script>/s.exec(html);
  return m ? JSON.parse(m[1]) : null;
}

function nodePart() {
  const B = require('./build.js');
  section('build: 取り込み（assets/sfx・assets/amb）');
  const s = B.scanSfx(path.join(ASSETS, 'sfx')), a = B.scanAmb(path.join(ASSETS, 'amb'));
  const sIds = new Set(s.list.map((e) => e.id.replace(/\.\d+$/, '')));
  const keepSynth = fs.readdirSync(path.join(ASSETS, 'sfx')).filter((f) => f.endsWith('.json')).filter((f) => readJson(path.join(ASSETS, 'sfx', f)).keepSynth).map((f) => f.slice(0, -5));
  ok('keepSynth の id は assets の json と同じ', KEEP_SYNTH.length === keepSynth.length && KEEP_SYNTH.every((id) => keepSynth.includes(id)), keepSynth);
  ok('keepSynth の id は取り込まない', keepSynth.every((id) => !sIds.has(id)) && keepSynth.every((id) => s.skipped.includes(id)), s.skipped);
  ok(`ほかの効果音は全部入る（${SFX_REC.length} id）`, sIds.size === SFX_REC.length && SFX_REC.every((id) => sIds.has(id)), sIds.size);
  ok('取り直しのファイルは全部ある', s.list.every((e) => fs.existsSync(e.file)));
  const aIds = a.list.map((e) => e.id);
  ok('keepProcedural・weak の床は入れない', NOT_AMB.every((b) => !aIds.includes(b)), aIds);
  ok(`床は ${AMB_REC.length}（印の無い物ぜんぶ）`, aIds.length === AMB_REC.length && AMB_REC.every((b) => aIds.includes(b)), aIds);
  ok('床はループ点を持つ（loopStart 0 < loopEnd）', a.list.every((e) => e.meta.loopStart === 0 && e.meta.loopEnd > 10), a.list.map((e) => [e.id, e.meta]));

  section('dist（node v2/tools/build.js の後）');
  for (const page of ['index.html', 'dev.html']) {
    const f = path.join(DIST, page);
    if (!fs.existsSync(f)) { ok(`${page} がある`, false); continue; }
    const M = mediaOf(fs.readFileSync(f, 'utf8'));
    ok(`${page}: RPG_MEDIA.sfx と .amb`, M && M.sfx && M.amb && Object.keys(M.sfx).length === s.list.length && Object.keys(M.amb).length === a.list.length, M && [Object.keys(M.sfx || {}).length, Object.keys(M.amb || {}).length]);
    if (!M) continue;
    ok(`${page}: keepSynth の取り直しは表に無い`, Object.keys(M.sfx).every((k) => !KEEP_SYNTH.includes(k.replace(/\.\d+$/, ''))));
    ok(`${page}: 表の url のファイルが dist にある`, Object.values(M.sfx).concat(Object.values(M.amb).map((e) => e.url)).every((u) => fs.existsSync(path.join(DIST, u.split('?')[0]))));
    ok(`${page}: 床の表は {url, loopStart, loopEnd}`, Object.values(M.amb).every((e) => typeof e.url === 'string' && e.loopStart === 0 && e.loopEnd > 0));
  }
  ok('dist/sfx に keepSynth のファイルが無い', fs.readdirSync(path.join(DIST, 'sfx')).every((f) => !KEEP_SYNTH.includes(f.split('.')[0])));
  ok('dist/amb に外した床のファイルが無い', fs.readdirSync(path.join(DIST, 'amb')).every((f) => !NOT_AMB.includes(f.split('.')[0])));

  section('--single（埋め込み）');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sfxmedia_'));
  try {
    const pick = { bgm: [], voice: [], portraits: [], sfx: s.list.filter((e) => /^(hit|glimmer)\./.test(e.id)), amb: a.list.filter((e) => e.id === 'heat') };
    const T = B.mediaTable(pick, 'embed', tmp);
    const M = mediaOf(T.script);
    ok('sfx は #media:sfx:<id>.<k> の埋め込み', M.sfx['hit.0'] === '#media:sfx:hit.0' && /id="media:sfx:hit\.0" data-type="audio\/ogg"/.test(T.embeds));
    ok('amb は {url: #media:amb:<床>, loopStart, loopEnd}', M.amb.heat && M.amb.heat.url === '#media:amb:heat' && M.amb.heat.loopEnd > 0 && /id="media:amb:heat"/.test(T.embeds));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

async function browserPart() {
  const Bw = require('./lib/browser');
  const S = await Bw.start();
  try {
    const P = await Bw.open(S, 'index.html');
    const page = P.page;
    section('効果音: 裏で解く');
    await page.evaluate(() => window.RPG.Audio.init());
    await page.waitForFunction(() => { const i = window.RPG.Audio.mediaInfo(); return i.sfx.preload === 'done'; }, null, { timeout: 60000 });
    const info = await page.evaluate(() => window.RPG.Audio.mediaInfo());
    ok('全部の取り直しが解けた', info.sfx.takes > 100 && info.sfx.decoded === info.sfx.takes, [info.sfx.takes, info.sfx.decoded]);
    ok('録音: hit glimmer crit…', ['hit', 'glimmer', 'crit', 'cursor', 'roar'].every((id) => info.sfx.recorded.includes(id)));
    ok('合成: keepSynth の id', KEEP_SYNTH.every((id) => info.sfx.synth.includes(id) && !info.sfx.recorded.includes(id)), info.sfx.synth);

    section('効果音: 取り直しの選び方');
    const pk = await page.evaluate((syn) => {
      const A = window.RPG.Audio, seq = [];
      for (let i = 0; i < 300; i++) seq.push(A._sfxPick('hit'));
      const one = []; for (let i = 0; i < 5; i++) one.push(A._sfxPick('glimmer'));
      return { seq, one, syn: syn ? A._sfxPick(syn) : null, lamp: A._sfxPick('lamp'), lead: A._sfxPick('lead'), quill: A._sfxPick('quill') };
    }, SYNTH_ID);
    let rep = 0; for (let i = 1; i < pk.seq.length; i++) if (pk.seq[i] === pk.seq[i - 1]) rep++;
    ok('hit: 続けて同じ取り直しにならない（300 回）', rep === 0 && pk.seq.every(Boolean), rep);
    ok('hit: 3 本とも使う', new Set(pk.seq).size === 3, [...new Set(pk.seq)]);
    ok('1 本だけの id（glimmer）はそれを鳴らす', pk.one.every((k) => k === 'glimmer.0'));
    if (SYNTH_ID) ok(`keepSynth の id（${SYNTH_ID}）は合成（null）`, pk.syn === null);
    ok('付け替えの id は付け替え先に従う（lamp → light の録音、lead → quill と同じ）', /^light\.\d$/.test(pk.lamp) && (pk.quill === null ? pk.lead === null : /^quill\.\d$/.test(pk.lead)), [pk.lamp, pk.lead, pk.quill]);

    section('効果音: 鳴らす');
    const pl = await page.evaluate(async (syn) => {
      const A = window.RPG.Audio, out = {};
      await new Promise((r) => setTimeout(r, 400));   // 前の duck が戻るまで
      out.duck0 = A._duckGain();
      A.sfx('glimmer');
      await new Promise((r) => setTimeout(r, 120));
      out.duck1 = A._duckGain();
      out.glimmer = A._sfxLive('glimmer');
      A.sfx('hit', { vol: 0.5, pan: -0.6 });
      out.hit = A._sfxLive('hit');
      if (syn) { A.sfx(syn); out.syn = A._sfxLive(syn); }
      for (let i = 0; i < 6; i++) { A.sfx('cursor'); await new Promise((r) => setTimeout(r, 40)); }
      out.cursor = A._sfxLive('cursor').length;
      // 表から消すと合成に戻る
      const keep = window.RPG_MEDIA.sfx;
      window.RPG_MEDIA.sfx = {};
      await new Promise((r) => setTimeout(r, 50));
      out.pickGone = A._sfxPick('hit');
      A.sfx('hit');
      out.hitGone = A._sfxLive('hit');
      out.infoGone = A.mediaInfo().sfx.recorded.length;
      window.RPG_MEDIA.sfx = keep;
      out.pickBack = A._sfxPick('hit');
      return out;
    }, SYNTH_ID);
    ok('glimmer: 録音が鳴る', pl.glimmer.length && pl.glimmer[pl.glimmer.length - 1].rec, pl.glimmer);
    ok('glimmer: 録音でも BGM を沈める（合成の定義の S.duck だけを借りる）', pl.duck0 > 0.99 && pl.duck1 < 0.7, [pl.duck0, pl.duck1]);
    ok('hit {vol, pan}: 録音が鳴る', pl.hit.length && pl.hit[pl.hit.length - 1].rec);
    if (SYNTH_ID) ok(`${SYNTH_ID}: 合成`, pl.syn.length && !pl.syn[pl.syn.length - 1].rec);
    ok('同じ id は 3 つまで（liveSfx）', pl.cursor <= 3, pl.cursor);
    ok('表に無ければ合成に戻る', pl.pickGone === null && pl.hitGone.length && !pl.hitGone[pl.hitGone.length - 1].rec && pl.infoGone === 0, pl);
    ok('表を戻せば録音', /^hit\.\d$/.test(pl.pickBack));

    section('効果音: 戦闘を静かに（core/audio.js の SFX_GAIN・SFX_GAP・SFX_VOICES）');
    const calm = await page.evaluate(async () => {
      const A = window.RPG.Audio, out = { lim: A.SFX_LIMITS }, wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(300);
      const s0 = A._sfxStats;
      A.sfx('hit'); A.sfx('hit'); A.sfx('hit');   // 同じ音の連打 → 1 つ
      const s1 = A._sfxStats;
      out.burstPlayed = (s1.played.hit || 0) - (s0.played.hit || 0);
      out.burstSkipped = (s1.skipped.hit || 0) - (s0.skipped.hit || 0);
      await wait(200);
      for (const id of ['magic', 'heal', 'fire', 'thunder', 'crit', 'roar', 'boss_die']) A.sfx(id);   // 違う音が一度に 7 つ
      out.voices = A._sfxVoices();
      for (let i = 0; i < 4; i++) { A.sfx('thunder'); await wait(140); }   // 長い音を続けて
      out.sameThunder = A._sfxLive('thunder').filter((x) => x.end > A.context.currentTime).length;
      const before = A._sfxStats.skipped.confirm || 0;
      A.sfx('confirm');
      out.confirmSkipped = (A._sfxStats.skipped.confirm || 0) - before;
      // 鳴り残る取り直し（enemy_die.0）は選ばない
      out.dieTakes = []; for (let i = 0; i < 20; i++) out.dieTakes.push(A._sfxPick('enemy_die'));
      return out;
    });
    ok('同じ id は 0.12 秒の内は 1 回（連打 3 → 1）', calm.burstPlayed === 1 && calm.burstSkipped === 2, calm);
    ok(`一度に鳴るのは ${calm.lim.voices} つまで（古い物から消す）`, calm.voices <= calm.lim.voices && calm.lim.voices <= 5, calm.voices);
    ok(`同じ id は ${calm.lim.sameMax} つまで`, calm.sameThunder <= calm.lim.sameMax, calm.sameThunder);
    ok('決定（confirm）は鳴らない', calm.confirmSkipped === 1);
    ok('鐘・グラスの響きの音は小さく（magic heal item buff ≤ 0.6）', ['magic', 'heal', 'item', 'buff'].every((id) => calm.lim.gain[id] > 0 && calm.lim.gain[id] <= 0.6), calm.lim.gain);
    ok('enemy_die: 鳴り残る取り直し（.0）は使わない', calm.lim.dropTakes.includes('enemy_die.0') && calm.dieTakes.every((k) => k === 'enemy_die.1'), [...new Set(calm.dieTakes)]);
    {
      const src = (f) => fs.readFileSync(path.join(V2, 'src', 'systems', 'battle', f), 'utf8');
      const pb = src('playback.js');
      ok('戦闘: 状態が解けても回復の音（heal）を鳴らさない', !/'debuff'\) : 'heal'\)/.test(pb) && /if \(e\.on\) sfxOnce\(ctx/.test(pb));
      ok('戦闘: 回復・強化・弱体の音は 1 つの行動で 1 回（sfxOnce）', /sfxOnce\(ctx, 'heal'\)/.test(pb) && /sfxOnce\(ctx, up \? 'buff' : 'debuff'\)/.test(pb));
      ok('戦闘の一覧: カーソル・戻るは小さく', ['command.js', 'targeting.js'].every((f) => /UI_TICK = \{ cursor: 0\.\d+, cancel: 0\.\d+/.test(src(f))));
    }

    section('環境音: 録音の床');
    const ids = await page.evaluate(() => {
      const f = window.RPG.Audio.ambienceFileId;
      return {
        sand: f({ bed: 'sandstorm' }), heat: f({ bed: 'heat' }), wind: f({ bed: 'wind' }), fd: f({ bed: 'forest', night: 0.25 }), fn: f({ bed: 'forest', night: 0.75 }),
        rs: f({ bed: 'rain', surf: 0.8 }), rain: f({ bed: 'rain' }), tomb: f({ bed: 'cave', dry: true }), cave: f({ bed: 'cave' }), ship: f({ bed: 'sea', muffled: true }), sea: f({ bed: 'sea' }),
        mist: f({ bed: 'mist' }), snow: f({ bed: 'snow' }), hw: f({ bed: 'highwind' }), br: f({ bed: 'breeze' }), brn: f({ bed: 'breeze', night: 1 }), bl: f({ bed: 'blizzard' }),
      };
    });
    ok('spec → 録音の id', ids.sand === 'sandstorm' && ids.heat === 'heat' && ids.wind === 'wind' && ids.fd === 'forest' && ids.fn === 'forest_night' && ids.rs === 'rain_surf' && ids.tomb === 'tomb' && ids.cave === 'cave' && ids.ship === 'ship' && ids.sea === 'sea', ids);
    const keyOf = { rain: 'rain', mist: 'mist', snow: 'snow', highwind: 'hw', breeze: 'br', breeze_night: 'brn', blizzard: 'bl' };
    ok('外した床・無い床は作った音（null）、印の無い床は録音', Object.entries(keyOf).every(([b, k]) => NOT_AMB.includes(b) ? ids[k] === null : ids[k] === b), ids);
    const am = await page.evaluate(async () => {
      // フィールドの環境音の tick（タイトルでは毎 0.25 秒 ambience(null)）を外し、本物の ambience をここから呼ぶ
      const A0 = window.RPG.Audio, real = A0.ambience;
      A0.ambience = () => false;
      const A = Object.assign({}, A0, { ambience: real, ambienceMod: A0.ambienceMod, ambienceInfo: A0.ambienceInfo, mediaInfo: A0.mediaInfo, debug: A0.debug });
      const out = {}, wait = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
      A.ambience({ bed: 'sandstorm', i: 0.7 }, { fade: 0.1 });
      out.sandOk = await wait(() => (A.ambienceInfo() || {}).file === 'sandstorm', 5000);
      out.sand = A.ambienceInfo();
      A.ambienceMod(0.5);   // 録音には効かない（投げない）
      A.ambience({ bed: 'forest', night: 1, i: 0.5 }, { fade: 0.1 });
      out.fnOk = await wait(() => (A.ambienceInfo() || {}).file === 'forest_night', 5000);
      const s1 = A.ambienceInfo();
      out.sameRet = A.ambience({ bed: 'forest', night: 0.75, i: 0.8 }, { fade: 0.1 });
      out.same = A.ambienceInfo();
      out.sameSince = s1.since === out.same.since;
      A.ambience({ bed: 'forest', night: 0.25, i: 0.8 }, { fade: 0.1 });
      out.dayOk = await wait(() => (A.ambienceInfo() || {}).file === 'forest', 5000);
      A.ambience({ bed: 'snow' }, { fade: 0.1 });
      out.mist = A.ambienceInfo();
      // 表から消した床 → 作った床
      const keep = window.RPG_MEDIA.amb.heat;
      delete window.RPG_MEDIA.amb.heat;
      A.ambience({ bed: 'heat' }, { fade: 0.1 });
      out.heatProc = A.ambienceInfo();
      window.RPG_MEDIA.amb.heat = keep;
      // 解けないファイル → 作った床
      window.RPG_MEDIA.amb.volcano = { url: 'index.html', loopStart: 0, loopEnd: 10 };
      A.ambience({ bed: 'volcano' }, { fade: 0.1 });
      out.badOk = await wait(() => { const i = A.ambienceInfo(); return i && i.alive && !i.file && i.srcs > 1; }, 5000);
      out.bad = A.ambienceInfo();
      A.ambience({ bed: 'heat' }, { fade: 0.1 });
      out.heatOk = await wait(() => (A.ambienceInfo() || {}).file === 'heat', 5000);
      out.media = A.mediaInfo().amb;
      A.ambience(null, { fade: 0.6 });
      out.off = A.ambienceInfo();
      out.dbg = !!A.debug().media;
      A0.ambience = real;
      return out;
    });
    ok('sandstorm: 録音を回す（強さ 0.7）', am.sandOk && am.sand.alive && am.sand.srcs === 1 && am.sand.i === 0.7, am.sand);
    ok('forest night 1 → forest_night', am.fnOk);
    ok('同じファイルに当たる変化は鳴らし直さない（強さだけ）', am.sameRet === true && am.sameSince && am.same.file === 'forest_night' && am.same.i === 0.8, [am.sameRet, am.sameSince, am.same]);
    ok('forest night 0.25 → forest', am.dayOk);
    ok('snow（weak）→ 作った床', am.mist && am.mist.alive && am.mist.file === null && am.mist.srcs > 1, am.mist);
    ok('表に無い床 → 作った床', am.heatProc && am.heatProc.file === null && am.heatProc.srcs > 1, am.heatProc);
    ok('解けないファイル → 作った床', am.badOk, am.bad);
    ok('表を戻せば録音', am.heatOk);
    ok('mediaInfo().amb', am.media.recorded.includes('sandstorm') && am.media.procedural.includes('snow') && am.media.playing === 'heat', am.media);
    ok('null で消える', am.off === null);
    ok('debug() に media', am.dbg);
    ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  } finally { await Bw.stop(S); }
}

(async () => {
  nodePart();
  if (!argv.includes('--no-browser')) await browserPart();
  done('sfx_media');
})().catch((e) => { console.error(e); process.exit(1); });
