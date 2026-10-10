#!/usr/bin/env node
// 言語ごとのボイス（2026-10-10、英語・中国語・韓国語のボイス）: ゲームの言語が英語なら chronicle/assets/voice/en/<id>.ogg、
//   zh-Hans・zh-Hant なら voice/zh（普通話 1 組）、ko なら voice/ko。無い id は日本語の声。
//   言葉でない叫び（design/voice/cry_reuse.txt）は中国語・韓国語では録音せず、日本語の声をそのまま鳴らす（RPG_MEDIA.voice_zh / voice_ko の
//   {alias: 'voice'}。英語は自分の録音を持つ）。
//   node v2/tools/build.js && node v2/tools/test_voice_lang.js [--no-browser]
//   node の部: core/media.js の引き方（ja → voice、en → voice_en、zh-Hans・zh-Hant → voice_zh、ko → voice_ko が先・無ければ voice、alias は
//              日本語の声）、build の取り込み（scanVoiceLang・dist/voice/en|zh|ko・RPG_MEDIA.voice_en|zh|ko・alias・--single の埋め込み・
//              片づけが言語のディレクトリを消さない）、pack_web の voice/<言語>/pack_NN.ogg と alias の素通し、cry_reuse.txt の中身。
//   ブラウザの部（dist/index.html）: ?lang=en|zh-Hans|zh-Hant|ko で物語の声と戦闘の掛け声が voice/<言語>/ から読まれて鳴る、
//              叫び（cry_reuse）は zh・ko で日本語のファイル（voice/<id>.ogg）、言語に無い id も日本語のファイル、?lang=ja は日本語のファイル、
//              同じ頁で言語を替えても前の言語の音を使い回さない。
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
const EN_DIR = path.join(ASSETS, 'voice', 'en'), ZH_DIR = path.join(ASSETS, 'voice', 'zh'), KO_DIR = path.join(ASSETS, 'voice', 'ko');
const idsOf = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort() : []);
const enIds = idsOf(EN_DIR), zhIds = idsOf(ZH_DIR), koIds = idsOf(KO_DIR);
const jaIds = fs.readdirSync(path.join(ASSETS, 'voice')).filter((f) => f.endsWith('.ogg')).map((f) => f.slice(0, -4)).sort();
const CRY_FILE = path.join(V2, '..', 'design', 'voice', 'cry_reuse.txt');
const cryIds = fs.readFileSync(CRY_FILE, 'utf8').split(/\r?\n/).map((x) => x.replace(/#.*/, '').trim()).filter(Boolean);
const SCOPE = fs.readFileSync(path.join(V2, '..', 'design', 'voice', 'voice_scope.txt'), 'utf8').split(/\r?\n/).map((x) => x.replace(/#.*/, '').trim()).filter(Boolean);
// 確かめに使う声: 物語（PV の 1 行）・戦闘の掛け声（叫びなので zh・ko では日本語の声を使い回す）・文のある掛け声（zh・ko も録音）・
// 英語の無い声（範囲の外の行）
const STORY = 'v_fine_t1_02', SHOUT = 'b_rouga_attack_1', SENT = 'b_rouga_bigtech_1';
const NO_EN = jaIds.find((id) => !enIds.includes(id));
const LANGS = [{ lang: 'zh-Hans', dir: ZH_DIR, ids: zhIds, folder: 'zh', table: 'voice_zh' }, { lang: 'zh-Hant', dir: ZH_DIR, ids: zhIds, folder: 'zh', table: 'voice_zh' }, { lang: 'ko', dir: KO_DIR, ids: koIds, folder: 'ko', table: 'voice_ko' }];
function mediaOf(html) { const m = /<script>window\.RPG_MEDIA=(.*?);<\/script>/s.exec(html); return m ? JSON.parse(m[1]) : null; }

function nodePart() {
  section('core/media.js: 言語でボイスの表を選ぶ');
  const alias = { alias: 'voice' };
  const media = {
    voice: { v_a: 'voice/v_a.ogg', v_b: 'voice/v_b.ogg', b_x_attack_1: 'voice/b_x_attack_1.ogg', b_x_hurt_1: 'voice/b_x_hurt_1.ogg' },
    voice_en: { v_a: 'voice/en/v_a.ogg', b_x_attack_1: 'voice/en/b_x_attack_1.ogg', b_x_hurt_1: 'voice/en/b_x_hurt_1.ogg' },
    voice_zh: { v_a: 'voice/zh/v_a.ogg', b_x_attack_1: 'voice/zh/b_x_attack_1.ogg', b_x_hurt_1: alias },
    voice_ko: { v_a: 'voice/ko/v_a.ogg', b_x_hurt_1: alias, v_gone: alias },
    bgm: { title: { url: 'bgm/title.ogg' } },
  };
  const R = require('./lib/load')({ quiet: true, globals: { RPG_MEDIA: media } });
  const M = R.Media, I = R.I18n;
  const at = (l) => { I.setLang(l); return { a: M.url('voice', 'v_a'), b: M.url('voice', 'v_b'), x: M.url('voice', 'b_x_attack_1'), h: M.url('voice', 'b_x_hurt_1'), srcA: M.voiceSource('v_a'), srcB: M.voiceSource('v_b'), srcH: M.voiceSource('b_x_hurt_1'), reusedH: M.voiceReused('b_x_hurt_1'), reusedA: M.voiceReused('v_a'), hasB: M.has('voice', 'v_b'), none: M.entry('voice', 'v_zz'), gone: M.entry('voice', 'v_gone'), bgm: M.url('bgm', 'title') }; };
  const ja = at('ja');
  ok('ja: 日本語のファイル', ja.a === 'voice/v_a.ogg' && ja.b === 'voice/v_b.ogg' && ja.x === 'voice/b_x_attack_1.ogg' && ja.srcA === 'voice' && ja.reusedH === false, ja);
  const en = at('en');
  ok('en: 英語のファイルを先に（物語の声・戦闘の掛け声・叫びも英語の録音）', en.a === 'voice/en/v_a.ogg' && en.x === 'voice/en/b_x_attack_1.ogg' && en.h === 'voice/en/b_x_hurt_1.ogg' && en.srcA === 'voice_en' && en.reusedH === false, en);
  ok('en: 英語の無い id は日本語のファイル（has も真）', en.b === 'voice/v_b.ogg' && en.srcB === 'voice' && en.hasB === true, en);
  ok('en: どちらにも無い id は null', en.none === null);
  ok('en: ボイス以外（BGM）は変わらない', en.bgm === 'bgm/title.ogg');
  for (const l of ['zh-Hans', 'zh-Hant']) {
    const r = at(l);
    ok(`${l}: 中国語（voice_zh）のファイルを先に`, r.a === 'voice/zh/v_a.ogg' && r.x === 'voice/zh/b_x_attack_1.ogg' && r.srcA === 'voice_zh' && r.reusedA === false, r);
    ok(`${l}: 中国語の無い id は日本語のファイル`, r.b === 'voice/v_b.ogg' && r.srcB === 'voice' && r.hasB === true, r);
    ok(`${l}: 叫び（alias）は日本語のファイル。voiceSource は voice、voiceReused は真`, r.h === 'voice/b_x_hurt_1.ogg' && r.srcH === 'voice' && r.reusedH === true, r);
  }
  const ko = at('ko');
  ok('ko: 韓国語（voice_ko）のファイルを先に', ko.a === 'voice/ko/v_a.ogg' && ko.srcA === 'voice_ko', ko);
  ok('ko: 韓国語の無い id（b_x_attack_1）は日本語のファイル', ko.x === 'voice/b_x_attack_1.ogg' && ko.b === 'voice/v_b.ogg', ko);
  ok('ko: 叫び（alias）は日本語のファイル', ko.h === 'voice/b_x_hurt_1.ogg' && ko.srcH === 'voice' && ko.reusedH === true, ko);
  ok('ko: 日本語の声が無い alias は null（落ちない）', ko.gone === null, ko.gone);
  ok('ja に戻すと日本語', at('ja').a === 'voice/v_a.ogg');
  // 戦闘の掛け声の候補は日本語の表の id から選ぶ（言語の表に無い id も残る → 鳴らす時に日本語のファイル）
  I.setLang('zh-Hans');
  const clips = R.Battle && R.Battle._ && R.Battle._.voice ? R.Battle._.voice.clips('b_x_attack_') : null;
  ok('戦闘: 掛け声の候補は中国語でも同じ', Array.isArray(clips) && clips.length === 1 && clips[0] === 'b_x_attack_1', clips);
  // bytes() も同じ表（fetch の URL）
  const seen = [];
  R._sandbox.fetch = (u) => { seen.push(u); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }); };
  I.setLang('en');
  return Promise.all([M.bytes('voice', 'v_a'), M.bytes('voice', 'v_b')]).then(() => {
    ok('bytes(): en は英語のファイル、無い id は日本語のファイルを読む', seen[0] === 'voice/en/v_a.ogg' && seen[1] === 'voice/v_b.ogg', seen);
    seen.length = 0;
    I.setLang('ko');
    return Promise.all([M.bytes('voice', 'v_a'), M.bytes('voice', 'b_x_hurt_1')]);
  }).then(() => {
    ok('bytes(): ko は韓国語のファイル、叫び（alias）は日本語のファイルを読む', seen[0] === 'voice/ko/v_a.ogg' && seen[1] === 'voice/b_x_hurt_1.ogg', seen);
    I.setLang('ja');
  });
}

function buildPart() {
  const B = require('./build.js');
  section('build: 言語ごとのボイスの取り込み（assets/voice/en|zh|ko → dist/voice/en|zh|ko・RPG_MEDIA.voice_en|zh|ko）');
  const sc = { en: B.scanVoiceLang(EN_DIR), zh: B.scanVoiceLang(ZH_DIR), ko: B.scanVoiceLang(KO_DIR) };
  ok(`assets/voice/en の ${enIds.length} 本を全部取り込む`, sc.en.length === enIds.length && sc.en.every((e, i) => e.id === enIds[i] && e.ext === 'ogg'), sc.en.length);
  ok(`assets/voice/zh の ${zhIds.length} 本を全部取り込む`, sc.zh.length === zhIds.length && sc.zh.every((e, i) => e.id === zhIds[i] && e.ext === 'ogg'), sc.zh.length);
  ok(`assets/voice/ko の ${koIds.length} 本を全部取り込む`, sc.ko.length === koIds.length && sc.ko.every((e, i) => e.id === koIds[i] && e.ext === 'ogg'), sc.ko.length);
  const med = B.scanMedia(ASSETS, {});
  ok('scanMedia: voice_en / voice_zh / voice_ko / voice_reuse', med.voice_en.length === enIds.length && med.voice_zh.length === zhIds.length && med.voice_ko.length === koIds.length && med.voice_reuse.length === cryIds.length, [med.voice_en.length, med.voice_zh.length, med.voice_ko.length, med.voice_reuse.length]);
  ok(`ボイスは 3 言語とも ${SCOPE.length} 本の範囲（録音 + 日本語の叫びの使い回し）`, enIds.length === SCOPE.length && zhIds.length + cryIds.length === SCOPE.length && koIds.length + cryIds.length === SCOPE.length && SCOPE.every((id) => enIds.includes(id) && (zhIds.includes(id) !== cryIds.includes(id)) && (koIds.includes(id) !== cryIds.includes(id))), { en: enIds.length, zh: zhIds.length, ko: koIds.length, cry: cryIds.length, scope: SCOPE.length });
  ok('英語・中国語・韓国語の id はどれも日本語にもある（日本語に戻せる）', [enIds, zhIds, koIds].every((a) => a.every((id) => jaIds.includes(id))), [enIds, zhIds, koIds].map((a) => a.filter((id) => !jaIds.includes(id))));
  ok('叫び（cry_reuse.txt）は日本語の声があり、中国語・韓国語のファイルが無く、範囲の中にあり、英語は自分の録音を持つ', cryIds.length > 30 && cryIds.every((id) => jaIds.includes(id) && !zhIds.includes(id) && !koIds.includes(id) && SCOPE.includes(id) && enIds.includes(id)), cryIds.filter((id) => !jaIds.includes(id) || zhIds.includes(id) || koIds.includes(id)));
  {
    // cry_reuse.txt は日本語の文から決まる（tools/voice_cry_reuse.js: 漢字なし・6 字まで・感嘆のかなだけ）。今の規則の結果と同じか
    const CR = require(path.join(V2, '..', 'tools', 'voice_cry_reuse.js'));
    const b = CR.build();
    ok('cry_reuse.txt は tools/voice_cry_reuse.js の規則の結果と同じ（古くなっていない）', b.ids.join() === cryIds.slice().sort().join() && fs.readFileSync(CRY_FILE, 'utf8') === b.text, [b.ids.length, cryIds.length]);
    ok('叫びの日本語の文は、漢字のない感嘆のかなと記号だけ', b.ids.every((id) => { const r = require(path.join(V2, '..', 'tools', 'voice_en_lines.js')).loadRows().find((x) => x.id === id); return r && !/[一-鿿]/.test(r.ja_text) && /^[぀-ヿ！？…。、ー―～\s]+$/.test(r.ja_text); }));
  }
  for (const page of ['index.html', 'dev.html']) {
    const f = path.join(DIST, page);
    if (!fs.existsSync(f)) { ok(`${page} がある（node v2/tools/build.js の後）`, false); continue; }
    const M = mediaOf(fs.readFileSync(f, 'utf8'));
    const en = (M && M.voice_en) || {}, ja = (M && M.voice) || {};
    ok(`${page}: RPG_MEDIA.voice_en に ${enIds.length} 本`, Object.keys(en).length === enIds.length && enIds.every((id) => en[id]), Object.keys(en).length);
    ok(`${page}: url は voice/en/<id>.ogg?v=…、dist にある`, Object.entries(en).every(([id, u]) => u.startsWith(`voice/en/${id}.ogg?v=`) && fs.existsSync(path.join(DIST, u.split('?')[0]))));
    ok(`${page}: 日本語の voice は ${jaIds.length} 本のまま`, Object.keys(ja).length === jaIds.length && Object.values(ja).every((u) => /^voice\/[a-z0-9_]+\.ogg\?v=/.test(u)), Object.keys(ja).length);
    for (const [lg, ids] of [['zh', zhIds], ['ko', koIds]]) {
      const T = (M && M['voice_' + lg]) || {};
      const files = Object.entries(T).filter(([, u]) => typeof u === 'string'), als = Object.entries(T).filter(([, u]) => u && typeof u === 'object');
      ok(`${page}: RPG_MEDIA.voice_${lg} に録音 ${ids.length} 本 + 叫びの alias ${cryIds.length} 本`, files.length === ids.length && ids.every((id) => T[id]) && als.length === cryIds.length, [files.length, als.length]);
      ok(`${page}: voice_${lg} の url は voice/${lg}/<id>.ogg?v=…、dist にある`, files.every(([id, u]) => u.startsWith(`voice/${lg}/${id}.ogg?v=`) && fs.existsSync(path.join(DIST, u.split('?')[0]))));
      ok(`${page}: voice_${lg} の alias は {alias: 'voice'} で、cry_reuse.txt の id と一致し、日本語の voice にある`, als.every(([id, e]) => e.alias === 'voice' && ja[id]) && als.map(([id]) => id).sort().join() === cryIds.slice().sort().join(), als.length);
      ok(`${page}: 英語の表（voice_en）に alias は無い（叫びも英語の録音）`, Object.values(en).every((u) => typeof u === 'string'));
    }
  }
  for (const [lg, ids] of [['en', enIds], ['zh', zhIds], ['ko', koIds]]) {
    const d = path.join(DIST, 'voice', lg);
    ok(`dist/voice/${lg} にちょうど ${lg} のファイル`, fs.existsSync(d) && fs.readdirSync(d).sort().join() === ids.map((id) => id + '.ogg').join());
  }
  ok('dist/voice の日本語のファイルも消えていない', jaIds.every((id) => fs.existsSync(path.join(DIST, 'voice', id + '.ogg'))));

  section('build: 外に置く版の片づけ・--single の埋め込み・叫びの alias');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_vlang_'));
  try {
    for (const lg of ['en', 'zh', 'ko']) fs.mkdirSync(path.join(tmp, 'voice', lg), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'voice', 'old_ja.ogg'), 'x');
    for (const lg of ['en', 'zh', 'ko']) fs.writeFileSync(path.join(tmp, 'voice', lg, `old_${lg}.ogg`), 'x');
    const pick = (ids, dir) => ids.map((id) => ({ id, ext: 'ogg', file: path.join(dir, id + '.ogg'), meta: {} }));
    const CRY = cryIds[0];
    const media = { bgm: [], portraits: [], voice: pick([STORY, SHOUT, SENT, CRY, NO_EN].filter((v, i, a) => a.indexOf(v) === i), path.join(ASSETS, 'voice')), voice_en: pick([STORY, SHOUT], EN_DIR), voice_zh: pick([STORY, SENT], ZH_DIR), voice_ko: pick([STORY], KO_DIR), voice_reuse: [CRY, 'v_not_in_ja'] };
    let T, err = null;
    try { T = B.mediaTable(media, 'external', tmp); } catch (e) { err = e.message; }
    ok('外に置く: voice/en|zh|ko のディレクトリがあっても片づけで落ちない', !err, err);
    ok('外に置く: 古いファイルは消え、使うファイルが写る', !fs.existsSync(path.join(tmp, 'voice', 'old_ja.ogg')) && ['en', 'zh', 'ko'].every((lg) => !fs.existsSync(path.join(tmp, 'voice', lg, `old_${lg}.ogg`))) && fs.existsSync(path.join(tmp, 'voice', 'en', STORY + '.ogg')) && fs.existsSync(path.join(tmp, 'voice', 'zh', SENT + '.ogg')) && fs.existsSync(path.join(tmp, 'voice', 'ko', STORY + '.ogg')) && fs.existsSync(path.join(tmp, 'voice', NO_EN + '.ogg')));
    const Mx = T ? mediaOf(T.script) : null;
    ok('外に置く: RPG_MEDIA.voice_en の url', Mx && Mx.voice_en[STORY].startsWith(`voice/en/${STORY}.ogg?v=`) && !Mx.voice_en[NO_EN] && Mx.voice[NO_EN], Mx && Mx.voice_en);
    ok('外に置く: RPG_MEDIA.voice_zh / voice_ko の url', Mx && Mx.voice_zh[SENT].startsWith(`voice/zh/${SENT}.ogg?v=`) && Mx.voice_ko[STORY].startsWith(`voice/ko/${STORY}.ogg?v=`) && !Mx.voice_zh[NO_EN] && !Mx.voice_ko[NO_EN], Mx && [Mx.voice_zh, Mx.voice_ko]);
    ok('外に置く: 叫び（alias）は zh・ko にだけ。日本語の声がある id だけ。英語には置かない', Mx && JSON.stringify(Mx.voice_zh[CRY]) === '{"alias":"voice"}' && JSON.stringify(Mx.voice_ko[CRY]) === '{"alias":"voice"}' && !Mx.voice_zh.v_not_in_ja && !Mx.voice_en[CRY] && Mx.voice[CRY], Mx && [Mx.voice_zh[CRY], Mx.voice_ko[CRY], Mx.voice_en[CRY]]);
    ok('外に置く: 録音のある zh の id は alias にしない（先に録音）', Mx && typeof Mx.voice_zh[STORY] === 'string');
    const E = B.mediaTable(media, 'embed', tmp);
    const Me = mediaOf(E.script);
    ok('--single: 英語・中国語・韓国語のボイスは #media:voice_<言語>:<id> の埋め込み', Me.voice_en[STORY] === `#media:voice_en:${STORY}` && Me.voice_zh[SENT] === `#media:voice_zh:${SENT}` && Me.voice_ko[STORY] === `#media:voice_ko:${STORY}` && new RegExp(`id="media:voice_zh:${SENT}" data-type="audio/ogg"`).test(E.embeds), Me.voice_zh);
    ok('--single: 日本語のボイスも埋め込み。叫びの alias は日本語の埋め込みを指す', Me.voice[STORY] === `#media:voice:${STORY}` && JSON.stringify(Me.voice_zh[CRY]) === '{"alias":"voice"}' && Me.voice[CRY] === `#media:voice:${CRY}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  section('pack_web: 言語ごとのボイスのまとめ（voice/en|zh|ko/pack_NN.<hash>.ogg）と alias の素通し');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lc_vpack_'));
  try {
    const py = `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(V2, 'tools'))}); import pack_web
new, n = pack_web.pack_voice(json.loads(sys.argv[1]), sys.argv[2], sys.argv[3], 2500000, sys.argv[4], sys.argv[5])
print(json.dumps({'new': new, 'n': n}))`;
    const CRY = cryIds[0];
    for (const [lg, dir, ids] of [['en', EN_DIR, [STORY, SHOUT]], ['zh', ZH_DIR, [STORY, SENT]], ['ko', KO_DIR, [STORY, SENT]]]) {
      const table = {}; for (const id of ids) table[id] = `voice/${lg}/${id}.ogg?v=1`;
      if (lg !== 'en') table[CRY] = { alias: 'voice' };
      const r = JSON.parse(execFileSync('python3', ['-c', py, JSON.stringify(table), DIST, out, 'voice_' + lg, 'voice/' + lg], { encoding: 'utf8' }).trim().split('\n').pop());
      const e = r.new[ids[0]];
      ok(`pack_voice(voice_${lg}): voice/${lg}/pack_00.<hash>.ogg に {url, off, len}`, r.n === 1 && e && new RegExp(`^voice/${lg}/pack_00\\.[0-9a-f]{10}\\.ogg$`).test(e.url) && e.len === fs.statSync(path.join(dir, ids[0] + '.ogg')).size, r);
      const buf = fs.readFileSync(path.join(out, e.url));
      ok(`まとめの中の範囲（${lg}）は元の Ogg そのもの`, buf.subarray(e.off, e.off + e.len).equals(fs.readFileSync(path.join(dir, ids[0] + '.ogg'))));
      if (lg !== 'en') ok(`pack_voice(voice_${lg}): alias の項はまとめに入れず、そのまま残る`, JSON.stringify(r.new[CRY]) === '{"alias":"voice"}', r.new[CRY]);
    }
    const src = fs.readFileSync(path.join(V2, 'tools', 'pack_web.py'), 'utf8');
    ok("pack_web の本体が voice_en・voice_zh・voice_ko をまとめる", /for lg in \('en', 'zh', 'ko'\)/.test(src) && /pack_voice\(media\['voice_' \+ lg\][^\n]*'voice\/' \+ lg\)/.test(src));
    const kp = fs.readFileSync(path.join(V2, 'tools', 'keep_prev_assets.py'), 'utf8');
    ok('keep_prev_assets: voice/en|zh|ko/pack_NN.<hash>.ogg も残す', /voice\|sfx\|bgm\)\/\(\?:\(\?:en\|zh\|ko\)\/\)\?/.test(kp));
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
    const A = window.RPG.Audio, out = { lang: window.RPG.I18n.lang(), urls: {}, played: {}, reused: {}, source: {} };
    A.init();
    if (A.context && A.context.resume) await A.context.resume();
    const wait = async (f, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = f(); if (v) return v; await new Promise((r) => setTimeout(r, 50)); } return null; };
    for (const [id, how] of ids) {
      out.urls[id] = window.RPG.Media.url('voice', id);
      out.reused[id] = window.RPG.Media.voiceReused(id);
      out.source[id] = window.RPG.Media.voiceSource(id);
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
      ok(`戦闘の掛け声 ${SHOUT}（叫び）: 英語は自分の録音 voice/en/ から読んで鳴る`, r.urls[SHOUT].startsWith(`voice/en/${SHOUT}.ogg`) && R0.includes(`voice/en/${SHOUT}.ogg`) && Math.abs(r.played[SHOUT] - dur(SHOUT, 'en')) < 0.05 && r.reused[SHOUT] === false, [r.urls[SHOUT], r.played[SHOUT], dur(SHOUT, 'en')]);
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
      ok(`戦闘の掛け声 ${SHOUT}: 日本語のファイル`, r.urls[SHOUT].startsWith(`voice/${SHOUT}.ogg`) && R0.includes(`voice/${SHOUT}.ogg`) && r.played[SHOUT] > 0 && r.reused[SHOUT] === false, [r.urls[SHOUT], r.played[SHOUT]]);
      ok('ja: voice/en|zh|ko/ は読まない', R0.every((u) => !/^voice\/(en|zh|ko)\//.test(u)), R0);
      ok('ページのエラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    for (const L of LANGS) {
      section(`ブラウザ: ?lang=${L.lang}（${L.folder}）`);
      const P = await Bw.open(S, `index.html?lang=${L.lang}`);
      const R0 = reqs(P);
      const r = await play(P.page, [[STORY, 'story'], [SHOUT, 'battle'], [SENT, 'battle'], [NO_EN, 'story']]);
      ok(`言語は ${L.lang}`, r.lang === L.lang, r.lang);
      ok(`物語の声 ${STORY}: voice/${L.folder}/ から読んで鳴る（長さはそのファイル）`, r.urls[STORY].startsWith(`voice/${L.folder}/${STORY}.ogg`) && R0.includes(`voice/${L.folder}/${STORY}.ogg`) && Math.abs(r.played[STORY] - dur(STORY, L.folder)) < 0.05 && r.source[STORY] === L.table, [r.urls[STORY], r.played[STORY], dur(STORY, L.folder)]);
      ok(`文のある掛け声 ${SENT}: voice/${L.folder}/ から読んで鳴る`, r.urls[SENT].startsWith(`voice/${L.folder}/${SENT}.ogg`) && R0.includes(`voice/${L.folder}/${SENT}.ogg`) && Math.abs(r.played[SENT] - dur(SENT, L.folder)) < 0.05, [r.urls[SENT], r.played[SENT], dur(SENT, L.folder)]);
      ok(`叫び ${SHOUT}（cry_reuse）: 日本語のファイル voice/${SHOUT}.ogg を鳴らす（voice/${L.folder}/ は読まない）。使い回しの印が付く`, r.urls[SHOUT].startsWith(`voice/${SHOUT}.ogg`) && R0.includes(`voice/${SHOUT}.ogg`) && !R0.includes(`voice/${L.folder}/${SHOUT}.ogg`) && Math.abs(r.played[SHOUT] - dur(SHOUT)) < 0.05 && r.reused[SHOUT] === true && r.source[SHOUT] === 'voice', [r.urls[SHOUT], r.played[SHOUT], dur(SHOUT), r.reused[SHOUT]]);
      ok(`範囲の外の声 ${NO_EN}: 日本語のファイルで鳴る`, r.urls[NO_EN].startsWith(`voice/${NO_EN}.ogg`) && R0.includes(`voice/${NO_EN}.ogg`) && r.played[NO_EN] > 0, [r.urls[NO_EN], r.played[NO_EN]]);
      ok(`${L.lang}: 日本語の物語の声は読まない`, !R0.includes(`voice/${STORY}.ogg`), R0);
      // 同じ頁で言語を替えたら、前の言語の音を使い回さない
      await P.page.evaluate(() => window.RPG.I18n.setLang('ja'));
      const r2 = await play(P.page, [[STORY, 'story'], [SENT, 'battle']]);
      ok('同じ頁で ja に替えると日本語のファイルを読み直す', r2.urls[STORY].startsWith(`voice/${STORY}.ogg`) && R0.includes(`voice/${STORY}.ogg`) && Math.abs(r2.played[STORY] - dur(STORY)) < 0.05 && r2.urls[SENT].startsWith(`voice/${SENT}.ogg`) && r2.played[SENT] > 0, [r2.urls[STORY], r2.played[STORY], dur(STORY)]);
      ok('ページのエラーなし', P.errors.length === 0, P.errors);
      await P.close();
    }
    section('ブラウザ: 設定の言語を韓国語・中国語にして起こし直す（screens/settings.js と同じ: Settings の lang → R.I18n.restart）');
    for (const L of [LANGS[0], LANGS[2]]) {
      const P = await Bw.open(S, 'index.html');
      const before = await P.page.evaluate(() => ({ lang: window.RPG.I18n.lang(), url: window.RPG.Media.url('voice', 'v_fine_t1_02') }));
      await P.page.evaluate(async (lang) => {
        const R = window.RPG;
        R.Settings.set('lang', lang);
        if (R.Storage && R.Storage.flush) { try { await R.Storage.flush(); } catch (e) { /* 書けなくても起こし直す */ } }
        R.I18n.setLang(lang);
      }, L.lang);
      await Promise.all([P.page.waitForEvent('load'), P.page.evaluate(() => window.RPG.I18n.restart())]);
      await P.page.waitForFunction('window.RPG && RPG.Engine && RPG.Engine.running && RPG.Engine.top()', null, { timeout: 60000 });
      const R0 = reqs(P);
      const r = await play(P.page, [[STORY, 'story'], [SHOUT, 'battle']]);
      ok(`${L.lang}: 起こし直す前は日本語`, before.lang === 'ja' && before.url.startsWith(`voice/${STORY}.ogg`), before);
      ok(`${L.lang}: 起こし直した後は物語の声が voice/${L.folder}/ から、叫びは日本語のファイルで鳴る`, r.lang === L.lang && R0.includes(`voice/${L.folder}/${STORY}.ogg`) && R0.includes(`voice/${SHOUT}.ogg`) && r.played[STORY] > 0 && r.played[SHOUT] > 0, [r, R0]);
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
