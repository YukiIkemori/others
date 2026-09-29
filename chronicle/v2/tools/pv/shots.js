// PV の撮影の台本（1 カット = 1 つの mp4）。どのカットも同じ手順で撮り直せる（時計は 1 フレームずつ、入力は台本どおり）。
//   node v2/tools/pv/shots.js --site <dist の写し> --out <clips のディレクトリ> [カットの id ...]   （id なしで全部）
//   出力: <out>/<id>.mp4（1920×1080・60fps・音なし）、<id>.audio.json（鳴った音の記録）、<id>.jpg（頭・中・終わりの 3 コマ）
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./cap');
const PVLIB = require('./pvlib');

const sec = (s) => Math.round(s * 60);
// よく使う形
const FIELD = (state, flags, map, spawn) => `PV.clean(); PV.noEnc(); PV.state('${state}', ${JSON.stringify(flags || {})}); PV.enter('${map}', ${JSON.stringify(spawn)})`;
const at = (tbl) => (i) => tbl[i] || null;   // {フレーム: 式}

const SHOTS = {
  // ---------------------------------------------------------------- 1 つかみ
  // ロアの長老の一言（本物の会話の窓。序章のあとの台詞 E.AGE.old）
  hook_elder: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_done: true, prologue_boss: true }, 'roa', 'warp'));
      await T.idle(120);
      await T.js(`RPG.Field.camera.focus(24, 15, {ms: 0})`);
      await T.idle(30);
      await T.js(`RPG.Events.run('roa_elder', {map: 'roa'})`);
    },
    n: sec(5),
  },
  // 灯台の光が夜の海を掃く（ワールドの灯台。灯った後）
  hook_beam: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_done: true, prologue_boss: true }, 'world', 'lighthouse'));
      await T.idle(200);
      await T.js(`PV.pan(325, 380, 319, 371, 6500)`);
    },
    n: sec(6.5),
  },
  // ---------------------------------------------------------------- 2 旅立ち
  roa_pan: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', {}, 'roa', 'warp'));
      await T.idle(150);
      await T.js(`PV.pan(12, 12, 30, 16, 5000)`);
    },
    n: sec(5),
  },
  roa_hill_run: {
    prep: async (T) => {
      await T.js(FIELD('content_p_roa', { prologue_berna: true }, 'f_roa', 'roa'));
      await T.idle(150);
    },
    n: sec(5),
    each: at({ 0: `PV.btn({right: 1, b: 1})` }),
  },
  pharos_pan: {
    prep: async (T) => {
      await T.js(FIELD('content_p_pharos', {}, 'pharos', 'harbor'));
      await T.idle(150);
      await T.js(`PV.pan(14, 26, 44, 26, 6000)`);
    },
    n: sec(6),
  },

  // オットー（本物の会話・声あり v_otto_pharos_04 の台詞）
  otto: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', { prologue_key: false }, 'pharos', { x: 21, y: 32, dir: 'n' }));
      await T.idle(150); await T.settle();
      await T.js(`PV.autoMsg(30); RPG.Events.run('pharos_otto', {map: 'pharos'})`);
      await T.until(`PV.lastLine().includes('守り歌が')`, 1800);
      await T.js(`PV.autoMsg(0)`);
    },
    n: sec(6),
  },
  // 灯台の中を上る
  lh_climb: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', {}, 'lighthouse_1', 'entrance'));
      await T.idle(150);
    },
    n: sec(5),
    each: at({ 0: `PV.btn({up: 1, b: 1})` }),
  },
  // 灯室: 守り歌を書き記して、灯台に火がともる（戦闘は勝ったことにして飛ばす）
  lamp_lit: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', {}, 'lighthouse_3', 'lamp'));
      await T.idle(150); await T.settle();
      await T.js(`RPG.Battle.start = async () => ({result: 'win'}); PV.autoMsg(40); RPG.Events.run('lighthouse_3_boss', {map: 'lighthouse_3'})`);
      await T.until(`PV.lastLine().includes('文字が浮かんで')`, 3000);
    },
    n: sec(16),
  },
  // ベルナ「この大陸には八つの大きな伝承がある。」（v_berna_lute_03）
  berna_lute: {
    prep: async (T) => {
      await T.js(FIELD('content_p_lighthouse_3', { prologue_boss: true }, 'pharos', { x: 7, y: 13, dir: 'n' }));
      await T.idle(150); await T.settle();
      await T.js(`PV.autoMsg(30); RPG.Events.run('pharos_departure', {map: 'pharos'})`);
      await T.until(`PV.lastLine().includes('八つ')`, 4000);
      await T.js(`PV.autoMsg(0)`);
    },
    n: sec(7),
  },
  title_screen: {
    url: 'dev.html',
    prep: async (T) => { await T.idle(60); },
    n: sec(8),
  },
};

// ---------------------------------------------------------------- 撮る
async function shoot(S, id, out) {
  const sh = SHOTS[id];
  const P = await C.open(S, sh.url || 'dev.html?fixture=content_p_roa');   // タイトルを通らずにフィールドから（タイトルの流れと重ならない）
  await C.run(P, PVLIB);
  const T = {
    js: (code) => C.run(P, code),
    idle: (n, each) => C.idle(P, n, each),
    until: (cond, max) => C.until(P, cond, max),
    // 入った時のイベント（町の人の一言など）を送って終わらせる
    settle: async () => { await C.run(P, 'PV.autoMsg(15)'); await C.until(P, '!RPG.Events.busy() && !RPG.UIK.Message.busy()', 1800); await C.run(P, 'PV.autoMsg(0)'); await C.idle(P, 20); },
    P,
  };
  await sh.prep(T);
  const file = path.join(out, id + '.mp4');
  await C.rec(P, file, sh.n, sh.each || null);
  if (P.errors.length) console.log(`[pv] ${id} errors:`, P.errors.slice(0, 4));
  await P.close();
  // 頭・中・終わりの 3 コマ（見て確かめる用）
  const t = [0.05, sh.n / 120, sh.n / 60 - 0.1];
  const args = ['-y', '-loglevel', 'error'];
  t.forEach((s) => args.push('-ss', String(s), '-i', file));
  args.push('-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[2:v]scale=640:360[c];[a][b][c]hstack=3', '-frames:v', '1', path.join(out, id + '.jpg'));
  execFileSync(C.FF, args);
}

async function main() {
  const a = process.argv.slice(2);
  let site = null, out = null;
  const ids = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--site') site = a[++i];
    else if (a[i] === '--out') out = a[++i];
    else ids.push(a[i]);
  }
  fs.mkdirSync(out, { recursive: true });
  const S = await C.start({ site });
  try {
    for (const id of ids.length ? ids : Object.keys(SHOTS)) {
      if (!SHOTS[id]) { console.log('no shot', id); continue; }
      await shoot(S, id, out);
    }
  } finally { await C.stop(S); }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { SHOTS };
