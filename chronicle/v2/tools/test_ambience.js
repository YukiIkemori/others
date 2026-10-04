#!/usr/bin/env node
// 環境音（core/audio.js の ambience・systems/field/ambience.js。design/notes/audio.md §14）
//   node v2/tools/test_ambience.js [--no-browser] [--out <dir>] [--dur <秒>]
//   node の部: 地図と天気 → 床の選び方（F.ambienceFor）、戦闘・タイトルで消える、設定 vol.amb。
//   ブラウザの部（dist/index.html。先に node v2/tools/build.js）: 床ごとに OfflineAudioContext で鳴らし、
//     無音でない・NaN なし・山が上限（−18 dBFS）の下・入れ替えで古い床の音源が止まる・消した後が無音、を確かめる。
//     --out <dir> で床ごとの WAV（16 bit ステレオ、既定 12 秒）を書き出す（耳・聞き取りで確かめる用。リポジトリの外に）。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const CAP_DB = -18;

function nodePart() {
  const R = require('./lib/load')({ quiet: true });
  const F = R.Field, M = R.DB.maps;
  section('床の選び方（F.ambienceFor）');
  ok('F.ambienceFor がある', typeof F.ambienceFor === 'function');
  const pick = (id, wx, night) => F.ambienceFor(M[id], wx, night == null ? 1 : night);
  const bed = (s) => (s ? s.bed : null);
  ok('吹雪の峰 → blizzard', bed(pick('f_snowpass', { kind: 'blizzard', i: 1 })) === 'blizzard');
  ok('雪 → snow', bed(pick('f_floe', { kind: 'snow', i: 1 })) === 'snow');
  ok('白い霧（ファロス）→ mist', bed(pick('pharos', { kind: 'mist', i: 1 })) === 'mist');
  ok('砂嵐 → sandstorm（強さは天気の i）', (() => { const s = pick('d_west', { kind: 'sandstorm', i: 0.6 }); return s.bed === 'sandstorm' && s.i === 0.6; })());
  ok('陽炎 → heat', bed(pick('d_east', { kind: 'heat', i: 1 })) === 'heat');
  ok('沼の霧 → marsh', bed(pick('m_bog', { kind: 'fog', i: 1 })) === 'marsh');
  ok('島の霧雨 → rain ＋ 岸の波', (() => { const s = pick('i_cape', { kind: 'drizzle', i: 1 }); return s.bed === 'rain' && s.surf > 0; })());
  ok('灰 → ash', bed(pick('a_lava', { kind: 'ash', i: 1 })) === 'ash');
  ok('木漏れ日 → forest（夜の深さを持つ）', (() => { const s = pick('f_cross', { kind: 'rays', i: 1 }, 0.75); return s.bed === 'forest' && s.night === 0.75; })());
  ok('風の木の葉 → breeze', bed(pick('f_windhill', { kind: 'leaves', i: 1 })) === 'breeze');
  ok('流れ星 → highwind', bed(pick('s_plateau', { kind: 'stars', i: 1 })) === 'highwind');
  section('天気の無い地図（控えめな場所の床）');
  ok('町・屋内は鳴らさない', pick('roa', null) === null && pick('fern_inn', null) === null && pick('coral', null) === null);
  ok('ワールドは鳴らさない', pick('world', null) === null);
  ok('坑道 → cave', bed(pick('mine_1', null)) === 'cave');
  ok('洞窟 → cave', bed(pick('isles_cave_1', null)) === 'cave');
  ok('墓 → cave（雫なし）', (() => { const s = pick('desert_tomb_1', null); return s && s.bed === 'cave' && s.dry; })());
  ok('火山の中 → volcano', bed(pick('ash_volcano_1', null)) === 'volcano');
  ok('幽霊船 → sea（こもる）', (() => { const s = pick('ghost_ship_1', null); return s && s.bed === 'sea' && s.muffled; })());
  ok('晴れの島の野 → sea（弱く）', (() => { const s = pick('i_crab', null); return s && s.bed === 'sea' && s.i < 1; })());
  ok('晴れの森の野 → forest（弱く）', (() => { const s = pick('f_cross', null); return s && s.bed === 'forest' && s.i < 1; })());
  ok('塔・書庫は鳴らさない', pick('lighthouse_1', null) === null && pick('archive_1', null) === null);
  section('map.ambience で上書き');
  ok('null で消す', F.ambienceFor({ id: 'x', kind: 'field', ambience: null }, { kind: 'snow', i: 1 }, 1) === null);
  ok('名前で', bed(F.ambienceFor({ id: 'x', kind: 'town', ambience: 'sea' }, null, 1)) === 'sea');
  ok('{bed, i}', (() => { const s = F.ambienceFor({ id: 'x', kind: 'town', ambience: { bed: 'cave', i: 0.3 } }, null, 1); return s.bed === 'cave' && s.i === 0.3; })());
  section('全部の地図で選べる床は鳴らせる名前');
  const beds = new Set(R.Audio.AMB_BEDS || []);
  const bad = [];
  for (const id of Object.keys(M)) {
    const wxs = [null].concat((F._WX_AUTO[id] || []).map((e) => ({ kind: e.k, i: e.i || 1 })), M[id].weather ? [{ kind: M[id].weather, i: 1 }] : []);
    for (const wx of wxs) {
      const s = F.ambienceFor(M[id], wx, 0.5);
      if (s && !beds.has(s.bed)) bad.push(id + ':' + s.bed);
    }
  }
  ok('知らない床の名前なし', bad.length === 0, bad.slice(0, 8));
  section('鳴らす・消す（場面）');
  const calls = [];
  const realAmb = R.Audio.ambience;
  R.Audio.ambience = (s, o) => { calls.push({ s, o }); return realAmb(s, o); };
  const E = R.Engine, stack = [];
  const hasOrig = E.has;
  E.has = (id) => stack.includes(id);
  F._s.map = M.f_snowpass;
  F._wxForce = { kind: 'blizzard', i: 1 };
  stack.push('field');
  F._ambienceTick(0, 300);
  ok('フィールド → blizzard', calls.length && calls[calls.length - 1].s && calls[calls.length - 1].s.bed === 'blizzard');
  stack.push('battle');
  F._ambienceTick(0, 300);
  ok('戦闘 → 消す（0.6 秒）', calls[calls.length - 1].s === null && calls[calls.length - 1].o.fade === 0.6);
  stack.pop();
  F._ambienceTick(0, 300);
  ok('戦闘の後 → 戻る（1.2 秒）', calls[calls.length - 1].s && calls[calls.length - 1].s.bed === 'blizzard' && calls[calls.length - 1].o.fade === 1.2);
  stack.length = 0; stack.push('title');
  F._ambienceTick(0, 300);
  ok('タイトル → 消す', calls[calls.length - 1].s === null);
  ok('AudioContext の無い node でも投げない（覚えておくだけ）', R.Audio.ambience('wind') === true && R.Audio.ambienceInfo().bed === 'wind' && R.Audio.ambience(null) === true);
  ok('reduceMotion は音に効かない', (() => { R.Settings.set('reduceMotion', true); stack.length = 0; stack.push('field'); const w = F._ambienceWant(); R.Settings.set('reduceMotion', false); return w.spec && w.spec.bed === 'blizzard'; })());
  E.has = hasOrig; F._wxForce = null; R.Audio.ambience = realAmb;
  section('設定');
  ok('vol.amb は 0〜10・既定 7', R.Settings.get('vol.amb') === 7 && R.Settings.CHOICES['vol.amb'].length === 11);
  for (const L of ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'i18n', L, 'ui.js'), 'utf8');
    ok(`設定の名前（${L}）`, /'ui\.settings\.TABS\.vol_amb\.name'/.test(src) && /'ui\.settings\.TABS\.vol_amb\.desc'/.test(src));
  }
  return R.Audio.AMB_BEDS;
}

// ---------------------------------------------------------------- ブラウザ（OfflineAudioContext）
const SPECS = [
  ['wind', { bed: 'wind' }], ['snow', { bed: 'snow' }], ['mist', { bed: 'mist' }], ['breeze_day', { bed: 'breeze', night: 0 }], ['breeze_night', { bed: 'breeze', night: 1 }],
  ['highwind', { bed: 'highwind' }], ['blizzard', { bed: 'blizzard' }], ['sandstorm', { bed: 'sandstorm' }], ['heat', { bed: 'heat' }],
  ['rain', { bed: 'rain' }], ['rain_surf', { bed: 'rain', surf: 0.8 }], ['sea', { bed: 'sea' }], ['ship', { bed: 'sea', muffled: true, i: 0.45 }],
  ['marsh', { bed: 'marsh', night: 0.75 }], ['ash', { bed: 'ash' }], ['forest_day', { bed: 'forest', night: 0 }], ['forest_night', { bed: 'forest', night: 1 }],
  ['cave', { bed: 'cave' }], ['tomb', { bed: 'cave', dry: true, i: 0.5 }], ['volcano', { bed: 'volcano' }],
];

async function browserPart(beds) {
  const B = require('./lib/browser');
  const out = arg('--out', null), dur = +arg('--dur', out ? 12 : 8);
  if (out) fs.mkdirSync(out, { recursive: true });
  const S = await B.start();
  try {
    const P = await B.open(S, 'index.html');
    section('床ごとの音（OfflineAudioContext、強さ 1・音量 10）');
    const covered = new Set(SPECS.map((s) => s[1].bed));
    ok('全部の床を鳴らす', beds.every((b) => covered.has(b)), beds.filter((b) => !covered.has(b)));
    for (const [name, spec] of SPECS) {
      const r = await P.page.evaluate(async ({ spec, dur, wav }) => {
        const A = window.RPG.Audio, SR = 48000;
        const octx = new OfflineAudioContext(2, SR * dur, SR);
        A.renderAmbience(octx, Object.assign({ seed: 12345 }, spec), { dur });
        const buf = await octx.startRendering();
        const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
        let pk = 0, e = 0, nan = 0;
        for (let i = 0; i < L.length; i++) {
          const a = L[i], b = Rr[i];
          if (!(a === a) || !(b === b)) { nan++; continue; }
          pk = Math.max(pk, Math.abs(a), Math.abs(b)); e += a * a + b * b;
        }
        // 1 秒ごとの RMS（どこかで無音に落ちていないか）
        const sec = [];
        for (let s = 0; s + SR <= L.length; s += SR) { let q = 0; for (let i = s; i < s + SR; i++) q += L[i] * L[i] + Rr[i] * Rr[i]; sec.push(10 * Math.log10(q / (2 * SR) + 1e-20)); }
        const res = { peakDb: 20 * Math.log10(pk + 1e-20), rmsDb: 10 * Math.log10(e / (2 * L.length) + 1e-20), nan, sec };
        if (wav) {
          const n = L.length, ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
          const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
          w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
          dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
          for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true); }
          let s = ''; const u8 = new Uint8Array(ab);
          for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          res.b64 = btoa(s);
        }
        return res;
      }, { spec, dur, wav: !!out });
      if (out && r.b64) { fs.writeFileSync(path.join(out, name + '.wav'), Buffer.from(r.b64, 'base64')); delete r.b64; }
      const minSec = Math.min(...r.sec.slice(1));
      console.log(`      ${name.padEnd(13)} peak ${r.peakDb.toFixed(1)} dBFS  rms ${r.rmsDb.toFixed(1)} dBFS  quietest 1 s ${minSec.toFixed(1)} dBFS`);
      ok(`${name}: NaN なし`, r.nan === 0);
      ok(`${name}: 鳴る（RMS > −60 dBFS、どの 1 秒も −75 より上）`, r.rmsDb > -60 && minSec > -75, r);
      ok(`${name}: 山が ${CAP_DB} dBFS の下`, r.peakDb < CAP_DB, r.peakDb);
    }

    section('入れ替え（古い床の音源が止まる）');
    const x = await P.page.evaluate(async () => {
      const A = window.RPG.Audio, SR = 48000, dur = 7, at = 3, fade = 1.2;
      const o1 = new OfflineAudioContext(2, SR * dur, SR);
      const r1 = A.renderAmbience(o1, { bed: 'blizzard', seed: 7 }, { dur, at, to: { bed: 'forest', night: 0, seed: 8 }, fade });
      await o1.startRendering();
      const a = r1.beds[0], b = r1.beds[1];
      const old = { alive: a.alive, stopAt: a.stopAt, srcs: a.srcs.length, stopped: a.srcs.filter((s) => s._stopAt != null && s._stopAt <= at + fade + 0.06).length };
      // 消すだけ（to なし）: 消えた後は無音
      const o2 = new OfflineAudioContext(2, SR * dur, SR);
      A.renderAmbience(o2, { bed: 'rain', surf: 0.8, seed: 9 }, { dur, at, to: null, fade });
      const buf = await o2.startRendering();
      const L = buf.getChannelData(0);
      let tail = 0, before = 0;
      for (let i = Math.ceil((at + fade + 0.1) * SR); i < L.length; i++) tail = Math.max(tail, Math.abs(L[i]));
      for (let i = Math.floor(1 * SR); i < Math.floor(at * SR); i++) before = Math.max(before, Math.abs(L[i]));
      return { old, newAlive: b && b.alive, beds: r1.beds.length, tail, before };
    });
    ok('古い床は止まった（alive false・全部の音源に止める時刻）', !x.old.alive && x.old.srcs > 0 && x.old.stopped === x.old.srcs, x.old);
    ok('新しい床が鳴っている', x.beds === 2 && x.newAlive === true);
    ok('消した後は無音（fade の後）', x.before > 0.001 && x.tail < 1e-6, { before: x.before, tail: x.tail });

    section('live（AudioContext）: 入れ替えで鳴っている床は 1 つ');
    const live = await P.page.evaluate(async () => {
      const A = window.RPG.Audio;
      A.init();
      A.ambience({ bed: 'wind' }, { fade: 0.1 });
      const i1 = A.ambienceInfo();
      A.ambience({ bed: 'cave' }, { fade: 0.1 });
      const i2 = A.ambienceInfo();
      const same = A.ambience({ bed: 'cave' });
      A.setVolumes(null, null, null, 0.5);
      const vol = A.debug().volumes.amb;
      A.ambience(null, { fade: 0.1 });
      return { i1, i2, same, vol, i3: A.ambienceInfo() };
    });
    ok('wind → cave', live.i1 && live.i1.bed === 'wind' && live.i2 && live.i2.bed === 'cave' && live.i2.alive);
    ok('同じ spec はなにもしない', live.same === false);
    ok('setVolumes の 4 つ目が環境音', live.vol === 0.5);
    ok('null で消える', live.i3 === null);
    ok('ページのエラー 0', P.errors.length === 0, P.errors.slice(0, 3));
  } finally { await B.stop(S); }
}

(async () => {
  const beds = nodePart();
  if (!argv.includes('--no-browser')) await browserPart(beds);
  done('ambience');
})().catch((e) => { console.error(e); process.exit(1); });
