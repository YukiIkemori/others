#!/usr/bin/env node
// 言語ごとのボイス（2026-10-10、英語版のボイス）: ゲームの言語が英語なら chronicle/assets/voice/en/<id>.ogg、無い id は日本語の声。
//   node v2/tools/build.js && node v2/tools/test_voice_lang.js [--no-browser]
//   node の部: core/media.js の引き方（ja → voice、en → voice_en が先・無ければ voice、ko などほかの言語 → voice）、
//              build の取り込み（scanVoiceLang・dist/voice/en・RPG_MEDIA.voice_en・--single の埋め込み・片づけが en を消さない）、
//              pack_web の voice/en/pack_NN.ogg。
//   ブラウザの部（dist/index.html）: ?lang=en で物語の声と戦闘の掛け声が voice/en/ から読まれて鳴る、en に無い id は日本語の
//              ファイル、?lang=ja は日本語のファイル、同じ頁で言語を替えても前の言語の音を使い回さない。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ok, section, done } = require('./lib/testkit');

const V2 = path.resolve(__dirname, '..');
const ASSETS = path.join(V2, '..', 'assets');
const DIST = path.join(V2, 'dist');
const argv = process.argv.slice(2);
const EN_DIR = path.join(ASSETS, 'voice', 'en');
const enIds = fs.existsSync(EN_DIR) ? fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort() : [];
const jaIds = fs.readdirSync(path.join(ASSETS, 'voice')).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort();
// 確かめに使う声: 物語（PV の 1 行）・戦闘の掛け声・英語の無い声（英語版の範囲の外の行）
const STORY = 'v_fine_t1_02', SHOUT = 'b_rouga_attack_1';
const NO_EN = jaIds.find((id) => !enIds.includes(id));
function mediaOf(html) { const m = /<script>window\.RPG_MEDIA=(.*?);<\/script>/s.exec(html); return m ? JSON.parse(m[1]) : null; }

function nodePart() {
  section('core/media.js: 言語でボイスの表を選ぶ');
  const media = {
    voice: { v_a: 'voice/v_a.ogg', v_b: 'voice/v_b.ogg', b_x_attack_1: 'voice/b_x_attack_1.ogg' },
    voice_en: { v_a: 'voice/en/v_a.ogg', b_x_attack_1: 'voice/en/b_x_attack_1.ogg' },
    bgm: { title: { url: 'bgm/title.ogg' } },
  };
  const R = require('./lib/load')({ quiet: true, globals: { RPG_MEDIA: media } });
  const M = R.Media, I = R.I18n;
  const at = (l) => { I.setLang(l); return { a: M.url('voice', 'v_a'), b: M.url('voice', 'v_b'), x: M.url('voice', 'b_x_attack_1'), srcA: M.voiceSource('v_a'), srcB: M.voiceSource('v_b'), hasB: M.has('voice', 'v_b'), none: M.entry('voice', 'v_zz'), bgm: M.url('bgm', 'title') }; };
  const ja = at('ja');
  ok('ja: 日本語のファイル', ja.a === 'voice/v_a.ogg' && ja.b === 'voice/v_b.ogg' && ja.x === 'voice/b_x_attack_1.ogg' && ja.srcA === 'voice', ja);
  const en = at('en');
  ok('en: 英語のファイルを先に（物語の声・戦闘の掛け声）', en.a === 'voice/en/v_a.ogg' && en.x === 'voice/en/b_x_attack_1.ogg' && en.srcA === 'voice_en', en);
  ok('en: 英語の無い id は日本語のファイル（has も真）', en.b === 'voice/v_b.ogg' && en.srcB === 'voice' && en.hasB === true, en);
  ok('en: どちらにも無い id は null', en.none === null);
  ok('en: ボイス以外（BGM）は変わらない', en.bgm === 'bgm/title.ogg');
  for (const l of ['ko', 'zh-Hans', 'zh-Hant']) {
    const r = at(l);
    ok(`${l}: 日本語の声のまま`, r.a === 'voice/v_a.ogg' && r.x === 'voice/b_x_attack_1.ogg' && r.srcA === 'voice', r);
  }
  const back = at('ja');
  ok('ja に戻すと日本語', back.a === 'voice/v_a.ogg');
  // 戦闘の掛け声の候補は日本語の表の id から選ぶ（英語の表に無い id も残る → 鳴らす時に日本語のファイル）
  I.setLang('en');
  const clips = R.Battle && R.Battle._ && R.Battle._.voice ? R.Battle._.voice.clips('b_x_attack_') : null;
  ok('戦闘: 掛け声の候補は英語でも同じ', Array.isArray(clips) && clips.length === 1 && clips[0] === 'b_x_attack_1', clips);
  // bytes() も同じ表（fetch の URL）
  const seen = [];
  R._sandbox.fetch = (u) => { seen.push(u); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }); };
  return Promise.all([M.bytes('voice', 'v_a'), M.bytes('voice', 'v_b')]).then(() => {
    ok('bytes(): en は英語のファイル、無い id は日本語のファイルを読む', seen[0] === 'voice/en/v_a.ogg' && seen[1] === 'voice/v_b.ogg', seen);
    I.setLang('ja');
  });
}

function buildPart() {
  const B = require('./build.js');
  section('build: 英語のボイスの取り込み（assets/voice/en → dist/voice/en・RPG_MEDIA.voice_en）');
  const list = B.scanVoiceLang(EN_DIR);
  ok(`assets/voice/en の ${enIds.length} 本を全部取り込む`, list.length === enIds.length && list.every((e, i) => e.id === enIds[i] && e.ext === 'ogg'), list.length);
  ok('英語のボイスがある（英語版の 537 本）', enIds.length >= 537, enIds.length);
  ok('英語の id はどれも日本語にもある（日本語に戻せる）', enIds.every((id) => jaIds.includes(id)), enIds.filter((id) => !jaIds.includes(id)));
  for (const page of ['index.html', 'dev.html']) {
    const f = path.join(DIST, page);
    if (!fs.existsSync(f)) { ok(`${page} がある（node v2/tools/build.js の後）`, false); continue; }
    const M = mediaOf(fs.readFileSync(f, 'utf8'));
    const en = (M && M.voice_en) || {}, ja = (M && M.voice) || {};
    ok(`${page}: RPG_MEDIA.voice_en に ${enIds.length} 本`, Object.keys(en).length === enIds.length && enIds.every((id) => en[id]), Object.keys(en).length);
    ok(`${page}: url は voice/en/<id>.ogg?v=…、dist にある`, Object.entries(en).every(([id, u]) => u.startsWith(`voice/en/${id}.ogg?v=`) && fs.existsSync(path.join(DIST, u.split('?')[0]))));
    ok(`${page}: 日本語の voice は ${jaIds.length} 本のまま`, Object.keys(ja).length === jaIds.length && Object.values(ja).every((u) => /^voice\/[a-z0-9_]+\.ogg\?v=/.test(u)), Object.keys(ja).length);
  }
  const dEn = path.join(DIST, 'voice', 'en');
  ok('dist/voice/en にちょうど英語のファイル', fs.existsSync(dEn) && fs.readdirSync(dEn).sort().join() === enIds.map((id) => id + '.ogg').join());
  ok('dist/voice の日本語のファイルも消えていない', jaIds.every((id) => fs.existsSync(path.join(DIST, 'voice', id + '.ogg'))));

  section('build: 外に置く版の片づけ・--single の埋め込み');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_vlang_'));
  try {
    fs.mkdirSync(path.join(tmp, 'voice', 'en'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'voice', 'old_ja.ogg'), 'x');
    fs.writeFileSync(path.join(tmp, 'voice', 'en', 'old_en.ogg'), 'x');
    const pick = (ids, dir) => ids.map((id) => ({ id, ext: 'ogg', file: path.join(dir, id + '.ogg'), meta: {} }));
    const media = { bgm: [], portraits: [], voice: pick([STORY, SHOUT, NO_EN], path.join(ASSETS, 'voice')), voice_en: pick([STORY, SHOUT], EN_DIR) };
    let T, err = null;
    try { T = B.mediaTable(media, 'external', tmp); } catch (e) { err = e.message; }
    ok('外に置く: voice/en のディレクトリがあっても片づけで落ちない', !err, err);
    ok('外に置く: 古いファイルは消え、使うファイルが写る', !fs.existsSync(path.join(tmp, 'voice', 'old_ja.ogg')) && !fs.existsSync(path.join(tmp, 'voice', 'en', 'old_en.ogg')) && fs.existsSync(path.join(tmp, 'voice', 'en', STORY + '.ogg')) && fs.existsSync(path.join(tmp, 'voice', NO_EN + '.ogg')));
    const Mx = T ? mediaOf(T.script) : null;
    ok('外に置く: RPG_MEDIA.voice_en の url', Mx && Mx.voice_en[STORY].startsWith(`voice/en/${STORY}.ogg?v=`) && !Mx.voice_en[NO_EN] && Mx.voice[NO_EN], Mx && Mx.voice_en);
    const E = B.mediaTable(media, 'embed', tmp);
    const Me = mediaOf(E.script);
    ok('--single: 英語のボイスは #media:voice_en:<id> の埋め込み', Me.voice_en[STORY] === `#media:voice_en:${STORY}` && new RegExp(`id="media:voice_en:${STORY}" data-type="audio/ogg"`).test(E.embeds), Me.voice_en);
    ok('--single: 日本語のボイスも埋め込み', Me.voice[STORY] === `#media:voice:${STORY}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  section('pack_web: 英語のボイスのまとめ（voice/en/pack_NN.<hash>.ogg）');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_vpack_'));
  try {
    const table = { [STORY]: `voice/en/${STORY}.ogg?v=1`, [SHOUT]: `voice/en/${SHOUT}.ogg?v=1` };
    const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(V2, 'tools'))}); import pack_web
new, n = pack_web.pack_voice(json.loads(sys.argv[1]), sys.argv[2], sys.argv[3], 2500000, 'voice_en', 'voice/en')
print(json.dumps({'new': new, 'n': n}))`;
    const r = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(table), DIST, out], { encoding: 'utf8' }).trim().split('\n').pop());
    const e = r.new[STORY];
    ok('pack_voice(voice_en): voice/en/pack_00.<hash>.ogg に {url, off, len}', r.n === 1 && e && /^voice\/en\/pack_00\.[0-9a-f]{10}\.ogg$/.test(e.url) && e.len === fs.statSync(path.join(EN_DIR, STORY + '.ogg')).size, r);
    const buf = fs.readFileSync(path.join(out, e.url));
    ok('まとめの中の範囲は元の Ogg そのもの', buf.subarray(e.off, e.off + e.len).equals(fs.readFileSync(path.join(EN_DIR, STORY + '.ogg'))));
    const src = fs.readFileSync(path.join(V2, 'tools', 'pack_web.py'), 'utf8');
    ok("pack_web の本体が voice_en をまとめる", /media\.get\('voice_en'\)/.test(src) && /pack_voice\(media\['voice_en'\][^\n]*'voice\/en'\)/.test(src));
    const kp = fs.readFileSync(path.join(V2, 'tools', 'keep_prev_assets.py'), 'utf8');
    ok('keep_prev_assets: voice/en/pack_NN.<hash>.ogg も残す', /voice\|sfx\|bgm\)\/\(\?:en\/\)\?/.test(kp));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
}

async function browserPart() {
  const Bw = require('./lib/browser');
  const S = await Bw.start();
  const dur = (id, sub) => {
    const GA = require(path.join(V2, '..', 'tools', 'lib', 'gemini_audio'));
    const d = GA.decode(path.join(ASSETS, 'voice', ...(sub ? [sub] : []), id + '.ogg'), { rate: 24000, channels: 1 });
    return d.channels[0].length / 24000;
  };
  const play = (page, ids) => page.evaluate(async (ids) => {
    const A = window.RPG.Audio, out = { lang: window.RPG.I18n.lang(), urls: {}, played: {} };
    A.init();
    if (A.context && A.context.resume) await A.context.resume();
    const wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await new Promise((r) => setTimeout(r, 50)); } return null; };
    for (const [id, how] of ids) {
      out.urls[id] = window.RPG.Media.url('voice', id);
      const h = how === 'battle' ? A.battleVoiceId(id) : A.playVoice(id);
      const b = h ? await wait(() => h.src && h.src.buffer, 8000) : null;
      out.played[id] = b ? Math.round(b.duration * 100) / 100 : null;
      if (how === 'battle') A.battleVoiceId(null); else A.stopVoice();
    }
    return out;
  }, ids);
  try {
    const reqs = (P) => { const r = []; P.page.on('request', (q) => { const u = q.url(); if (/\/voice\//.test(u)) r.push(u.slice(S.base.length).split('?')[0]); }); return r; };
    section('ブラウザ: ?lang=en');
    {
      const P = await Bw.open(S, 'index.html?lang=en');
      const R0 = reqs(P);
      const r = await play(P.page, [[STORY, 'story'], [SHOUT, 'battle'], [NO_EN, 'story']]);
      ok('言語は en', r.lang === 'en', r.lang);
      ok(`物語の声 ${STORY}: voice/en/ から読んで鳴る（長さは英語のファイル）`, r.urls[STORY].startsWith(`voice/en/${STORY}.ogg`) && R0.includes(`voice/en/${STORY}.ogg`) && Math.abs(r.played[STORY] - dur(STORY, 'en')) < 0.05, [r.urls[STORY], r.played[STORY], dur(STORY, 'en')]);
      ok(`戦闘の掛け声 ${SHOUT}: voice/en/ から読んで鳴る`, r.urls[SHOUT].startsWith(`voice/en/${SHOUT}.ogg`) && R0.includes(`voice/en/${SHOUT}.ogg`) && Math.abs(r.played[SHOUT] - dur(SHOUT, 'en')) < 0.05, [r.urls[SHOUT], r.played[SHOUT], dur(SHOUT, 'en')]);
      ok(`英語の無い声 ${NO_EN}: 日本語のファイルで鳴る`, r.urls[NO_EN].startsWith(`voice/${NO_EN}.ogg`) && R0.includes(`voice/${NO_EN}.ogg`) && r.played[NO_EN] > 0, [r.urls[NO_EN], r.played[NO_EN]]);
      ok('en: 日本語の版の物語の声・掛け声は読まない', !R0.includes(`voice/${STORY}.ogg`) && !R0.includes(`voice/${SHOUT}.ogg`), R0);
      // 同じ頁で言語を替えたら、解いた英語の音を使い回さない（core/audio.js の loadBuffer が url を見る）
      await P.page.evaluate(() => window.RPG.I18n.setLang('ja'));
      const r2 = await play(P.page, [[STORY, 'story']]);
      ok('同じ頁で ja に替えると日本語のファイルを読み直す', r2.urls[STORY].startsWith(`voice/${STORY}.ogg`) && R0.includes(`voice/${STORY}.ogg`) && Math.abs(r2.played[STORY] - dur(STORY)) < 0.05, [r2.urls[STORY], r2.played[STORY], dur(STORY)]);
      await P.page.evaluate(() => window.RPG.I18n.setLang('en'));
      ok('ページのエラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    section('ブラウザ: ?lang=ja');
    {
      const P = await Bw.open(S, 'index.html?lang=ja');
      const R0 = reqs(P);
      const r = await play(P.page, [[STORY, 'story'], [SHOUT, 'battle']]);
      ok('言語は ja', r.lang === 'ja', r.lang);
      ok(`物語の声 ${STORY}: 日本語のファイル`, r.urls[STORY].startsWith(`voice/${STORY}.ogg`) && R0.includes(`voice/${STORY}.ogg`) && Math.abs(r.played[STORY] - dur(STORY)) < 0.05, [r.urls[STORY], r.played[STORY], dur(STORY)]);
      ok(`戦闘の掛け声 ${SHOUT}: 日本語のファイル`, r.urls[SHOUT].startsWith(`voice/${SHOUT}.ogg`) && R0.includes(`voice/${SHOUT}.ogg`) && r.played[SHOUT] > 0, [r.urls[SHOUT], r.played[SHOUT]]);
      ok('ja: voice/en/ は読まない', R0.every((u) => !u.startsWith('voice/en/')), R0);
      ok('ページのエラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    section('ブラウザ: 設定の言語を英語にして起こし直す（screens/settings.js と同じ: Settings の lang → R.I18n.restart）');
    {
      const P = await Bw.open(S, 'index.html');
      const before = await P.page.evaluate(() => ({ lang: window.RPG.I18n.lang(), url: window.RPG.Media.url('voice', 'v_fine_t1_02') }));
      await P.page.evaluate(async () => {
        const R = window.RPG;
        R.Settings.set('lang', 'en');
        if (R.Storage && R.Storage.flush) { try { await R.Storage.flush(); } catch (e) { /* 書けなくても起こし直す */ } }
        R.I18n.setLang('en');
      });
      await Promise.all([P.page.waitForEvent('load'), P.page.evaluate(() => window.RPG.I18n.restart())]);
      await P.page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 60000 });
      const R0 = reqs(P);
      const r = await play(P.page, [[STORY, 'story'], [SHOUT, 'battle']]);
      ok('起こし直す前は日本語', before.lang === 'ja' && before.url.startsWith(`voice/${STORY}.ogg`), before);
      ok('起こし直した後は en、物語の声と掛け声が voice/en/ から鳴る', r.lang === 'en' && R0.includes(`voice/en/${STORY}.ogg`) && R0.includes(`voice/en/${SHOUT}.ogg`) && r.played[STORY] > 0 && r.played[SHOUT] > 0, [r, R0]);
      await P.close();
    }
    section('ブラウザ: ?lang=ko（ほかの言語は日本語の声のまま）');
    {
      const P = await Bw.open(S, 'index.html?lang=ko');
      const r = await play(P.page, [[STORY, 'story']]);
      ok('ko: 日本語のファイル', r.lang === 'ko' && r.urls[STORY].startsWith(`voice/${STORY}.ogg`) && r.played[STORY] > 0, r);
      await P.close();
    }
  } finally { await Bw.stop(S); }
}

(async () => {
  await nodePart();
  buildPart();
  if (!argv.includes('--no-browser')) await browserPart();
  done('test_voice_lang');
})().catch((e) => { console.error(e); process.exitCode = 1; });
