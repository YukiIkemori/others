// PV 第 2 弾「名前を呼ぶ物語」の撮影の台本（物語・世界・人物のカット。台本 v2/design/pv/PV2_SCENARIO.md の §1〜§4・§6・§7・§9）。
//   shots.js（第 1 弾）と同じ作り: 1 カット = 1 つの mp4。時計は 1 フレームずつ、入力は台本どおり（何度でも同じ絵に撮り直せる）。
//   node v2/tools/pv/shots_pv2_story.js --site <dist の写し（製品版: slice:false）> --out <clips のディレクトリ> [--still] [カットの id ...]
//   出力: <out>/<id>.mp4（1920×1080・60fps・音なし）、<id>.audio.json（鳴った音・声の記録）、<id>.jpg（頭・中・終わりの 3 コマ）
//   --still: 撮らずに、準備のあと n フレームのあいだ 1 秒ごとに JPEG を <out>/still/<id>_NN.jpg に置く（下見用）
//   主人公はリーネ（女・術剣士・得意は剣）、仲間はシグレ・ザフィラ・ロウガ。歩くカットは仲間を一列に並べる（PV2.party。ゲームの設定は変えない）。
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const C = require('./cap');
const PVLIB = require('./pvlib');

const sec = (s) => Math.round(s * 60);
// ---------------------------------------------------------------- ページに足す小道具（pvlib の上に足すだけ。ゲームのファイルは変えない）
//   PV2.party()   歩くときに仲間を後ろに一列で並べる（フィールドのテスト用の差し込み口 _trailForce）
//   PV2.quiet()   「新しい手がかり」の札とはじめての説明の札を出さない
//   PV2.say(lines) 本物の会話の窓で、ゲームの台詞（文の鍵・声・顔）をそのまま言わせる（序章の町で言う台詞を、ほかの場所で撮るとき）
const PV2LIB = `(() => {
  const R = window.RPG;
  const PV2 = (window.PV2 = {
    party() { R.Field._trailForce = true; if (R.Field._resetTrail) R.Field._resetTrail(false); return true; },
    quiet() {
      const E = R.Engine;
      if (!E.__pv2ov) { E.__pv2ov = true; const ov = E.overlay; E.overlay = function (id, draw, z) { if (id === 'leads') draw = () => {}; return ov.call(this, id, draw, z); }; ov.call(E, 'leads', () => {}, 45); }
      R.Game.flags.tip_leads = true;
      return true;
    },
    /** lines: [{who, key, voice, face, name}] → 順に ev.say（台詞の文はゲームの文の鍵から） */
    say(lines, map) {
      const id = '__pv2_say';
      R.def('events', id, { run: async (ev) => { for (const l of lines) await ev.say(l.who, R.T(l.key), Object.assign({}, l.voice ? { voice: l.voice } : {}, l.face ? { face: l.face } : {}, l.name ? { name: R.T(l.name) } : {})); }, meta: { needs: [], gives: [] } });
      return R.Events.run(id, { map: map || R.Field._s.map.id });
    },
    /** カメラを進む先へ少し寄せる（毎フレーム呼ぶ）。寄せる量は 1 秒ほどでなめらかに (dx, dy) マスへ。止まった後も同じ量を保つ */
    _lo: null,
    lead(dx, dy, k) {
      const F = R.Field, S = F._s, v = { px: 0, py: 0 };
      F._vis(v);
      const o = PV2._lo || (PV2._lo = { x: 0, y: 0 });
      k = k || 0.035;
      o.x += (dx - o.x) * k; o.y += (dy - o.y) * k;
      S.cam = { mode: 'focus', fx: v.px + o.x, fy: v.py + o.y, x: v.px + o.x, y: v.py + o.y, t0: R.Engine.time, ms: 0 };
      return true;
    },
    /** 名前の入力の表で、字 ch のマスにカーソルを置く（ch = 'ok' で決定のマス） */
    cell(ch) {
      for (const sc of R.Engine.stack) for (const o of [sc, sc.view]) if (o && o.cells && o.label) {
        const i = o.cells.findIndex((c) => (ch === 'ok' ? c.act === 'ok' : !c.act && o.label(c) === ch));
        if (i >= 0) { o.cur = i; R.UIK.sfx('cursor'); return i; }
      }
      return -1;
    },
    /** 仲間選びの表: 道順 plan（[{to: id か index, pick: true?}]）を、矢印を 1 つずつ押してたどる（毎 step フレームに呼ぶ）。終われば決定の問いに A */
    walkGrid(plan) {
      let o = null;
      for (const sc of R.Engine.stack) for (const v of [sc, sc.view]) if (v && v.ids && v.list && v.picks) o = v;
      if (!o) return false;
      const P = PV2._gp || (PV2._gp = { i: 0 });
      if (o.busy) { PV.tap('a', 3); return true; }   // 決めるかの問い（はい）
      const st = plan[P.i];
      if (!st) return false;
      const idx = typeof st.to === 'number' ? st.to : o.ids.indexOf(st.to), cur = o.list.index, cols = o.list.cols || 1;
      const dr = Math.floor(idx / cols) - Math.floor(cur / cols), dc = (idx % cols) - (cur % cols);
      if (dr) PV.tap(dr > 0 ? 'down' : 'up', 3);
      else if (dc) PV.tap(dc > 0 ? 'right' : 'left', 3);
      else { if (st.pick) PV.tap('a', 3); P.i++; }
      return true;
    },
    /** 選択肢が出そろってから gap フレームごとに keys を 1 つずつ押す（毎フレーム呼ぶ）。'a' で決める */
    _ck: null,
    choiceKeys(keys, gap) {
      const st = R.UIK.Message.state();
      const c = PV2._ck || (PV2._ck = { i: 0, f: 0 });
      if (!st || !st.full || st.choiceRect == null) { c.f = 0; return false; }
      if (++c.f >= (gap || 40) && c.i < keys.length) { PV.tap(keys[c.i++], 3); c.f = 0; }
      return true;
    },
    /** 戦闘は勝ったことにする（演出のある出来事を、戦いを撮らずに先へ進める） */
    winAll() { R.Battle.start = async () => ({ result: 'win' }); return true; },
  });
  return true;
})()`;

// リーネの一行の状態（PV.state に渡す）。o で上書き
const RINE = (o) => {
  const base = {
    hero: { type: 'spellblade', sex: 'f', name: 'リーネ', fav: 'sword' }, party: ['hero', 'shigure', 'zafira', 'rouga'], reserve: [], tier: 3, gl: 'auto', prof: 'auto', vars: {},
    items: { i_potion: 4 }, gold: 2000, leads: [],
    flags: { prologue_done: true, forest_start: true, cleared_r_forest: true, story_t1: true },
    map: { id: 'coral', spawn: 'north' },
  };
  o = o || {};
  const out = Object.assign({}, base, o);
  out.flags = Object.assign({}, base.flags, o.flags || {});
  return JSON.stringify(out);
};
// フィールドに入る（HUD なし・歩いて出る戦闘なし・手がかりの札なし）
const FIELD = (st, map, spawn) => `PV.clean(); PV.noEnc(); PV.state(${RINE(st)}); PV2.quiet(); PV.enter('${map}', ${JSON.stringify(spawn)}).then(() => PV2.party())`;
const at = (tbl) => (i) => tbl[i] || null;
const STEER = () => 'PV.steer()';
// 道に沿って歩く（行き先 pts を順に。撮る前に道のりを決め、毎フレーム PV.steer() で次のマスへ）
const WALK = (pts, o) => async (T) => { const k = await T.js(`PV.go(${JSON.stringify(pts)}, ${JSON.stringify(o || {})})`); console.log('[pv] route', k, await T.js('JSON.stringify(PV.routeStats())')); };
// カメラを進む先へ少し寄せる（一行の向きへ dx, dy マス。PV2.lead）。毎フレーム呼ぶ
const LEAD = (dx, dy) => `PV2.lead(${dx}, ${dy})`;
const STEER_LEAD = (dx, dy) => () => `PV.steer(); ${LEAD(dx, dy)}`;

// 砂の王墓の出来事の旗（2 階の砂もぐりは倒した後）
const DESERT = { desert_arrived: true, desert_camp3_done: true, desert_worm: true, desert_robber_gone: true };
// 歩き終えたら出来事を始める（毎フレーム）。始まった後はカメラを出来事に任せる
const THEN_EVENT = (ev, map, auto, lead) => () => `if (!PV.route && !window.__pvEv) { window.__pvEv = 1; PV.btn({}); PV.autoMsg(${auto || 90}); RPG.Events.run('${ev}', {map: '${map}'}); } else if (!window.__pvEv) { PV.steer(); ${lead || ''} }`;

const SHOTS = {
  // ================================================================ §1 つかみ
  // 砂の王墓 3 階: たいまつの灯りだけの通路を北へ → 玉座の前で ハザル「……わが名を……わが名を、返せ……！」（v_hazal_tomb_01、本物の会話の窓）
  s1_tomb: {
    prep: async (T) => {
      await T.js(FIELD({ flags: DESERT }, 'desert_tomb_3', { x: 26, y: 25, dir: 'n' }));
      await T.idle(150); await T.settle();
      await T.js('PV2.winAll()');
      await WALK([[27, 11]], { run: false })(T);
    },
    n: sec(12), walk: true,
    each: THEN_EVENT('desert_tomb_king', 'desert_tomb_3', 150, LEAD(0, -3)),
  },
};

// ---------------------------------------------------------------- 撮る
async function rec(P, file, n, each, o) {
  o = o || {};
  if (!o.dt) return C.rec(P, file, n, each);
  // ゆっくり（dt ms ずつ進める）。cap.rec と同じ流れで、進める時間だけ変える
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const ff = spawn(C.FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(C.FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(C.FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
  P.recFrame0 = await P.page.evaluate('RPG.Engine.frame + 1');
  P.S.S0.sink = ff.stdin;
  for (let i = 0; i < n; i++) {
    const js = each ? each(i) : null;
    await P.page.evaluate(`(async () => { ${js ? js + ';' : ''}RPG.Engine.advance(${o.dt});
      const b = await new Promise((r) => document.querySelector('canvas').toBlob(r, 'image/jpeg', 0.95));
      for (let k = 0; ; k++) { try { await fetch('/__pv', { method: 'POST', body: b }); break; } catch (e) { if (k >= 4) throw e; await new Promise((r) => setTimeout(r, 200)); } } return 1; })()`);
  }
  P.S.S0.sink = null;
  ff.stdin.end();
  await done;
  const log = await P.audio();
  fs.writeFileSync(file.replace(/\.mp4$/, '.audio.json'), JSON.stringify(log));
  console.log(`[pv] ${path.basename(file)}: ${n} frames (dt ${o.dt}), audio events ${log.length}, errors ${P.errors.length}`);
  return log;
}

async function shoot(S, id, out, still) {
  const sh = SHOTS[id];
  const P = await C.open(S, sh.url || 'dev.html?fixture=content_p_roa');
  await C.run(P, PVLIB);
  await C.run(P, PV2LIB);
  const T = {
    js: (code) => C.run(P, code),
    idle: (n, each) => C.idle(P, n, each),
    until: (cond, max, each) => C.until(P, cond, max, each),
    settle: async () => { await C.run(P, 'PV.autoMsg(15)'); await C.until(P, '!RPG.Events.busy() && !RPG.UIK.Message.busy()', 1800); await C.run(P, 'PV.autoMsg(0)'); await C.idle(P, 20); },
    P,
  };
  await sh.prep(T);
  if (still) {
    const dir = path.join(out, 'still');
    fs.mkdirSync(dir, { recursive: true });
    const step = sh.stillStep || 60;
    for (let i = 0; i < sh.n; i++) {
      const js = sh.each ? sh.each(i) : null;
      await P.page.evaluate(`${js ? js + ';' : ''}RPG.Engine.advance(${sh.dt || 1000 / 60}); 1`);
      if (i % step === 0 || i === sh.n - 1) await C.still(P, path.join(dir, `${id}_${String(Math.floor(i / step)).padStart(2, '0')}.jpg`));
    }
    const st = await C.run(P, 'JSON.stringify({stuck: PV.stuck || 0, left: PV.route ? PV.route.length - PV.ri : 0, line: PV.lastLine()})');
    console.log(`[still] ${id}`, st);
    if (P.errors.length) console.log(`[pv] ${id} errors:`, P.errors.slice(0, 4));
    await P.close();
    return;
  }
  const file = path.join(out, id + '.mp4');
  await rec(P, file, sh.n, sh.each || null, { dt: sh.dt });
  const st = await C.run(P, 'JSON.stringify(Object.assign({stuck: PV.stuck || 0, left: PV.route ? PV.route.length - PV.ri : 0}, PV.routeStats ? PV.routeStats() : {}))');
  if (sh.walk) console.log(`[pv] ${id} steer`, st);   // stuck > 0 なら道から外れた・止まった
  if (P.errors.length) console.log(`[pv] ${id} errors:`, P.errors.slice(0, 4));
  await P.close();
  const t = [0.05, sh.n / 120, sh.n / 60 - 0.1];
  const args = ['-y', '-loglevel', 'error'];
  t.forEach((s) => args.push('-ss', String(s), '-i', file));
  args.push('-filter_complex', '[0:v]scale=640:360[a];[1:v]scale=640:360[b];[2:v]scale=640:360[c];[a][b][c]hstack=3', '-frames:v', '1', path.join(out, id + '.jpg'));
  execFileSync(C.FF, args);
}

async function main() {
  const a = process.argv.slice(2);
  let site = null, out = null, still = false;
  const ids = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--site') site = a[++i];
    else if (a[i] === '--out') out = a[++i];
    else if (a[i] === '--still') still = true;
    else ids.push(a[i]);
  }
  fs.mkdirSync(out, { recursive: true });
  const S = await C.start({ site });
  try {
    for (const id of ids.length ? ids : Object.keys(SHOTS)) {
      if (!SHOTS[id]) { console.log('no shot', id); continue; }
      try { await shoot(S, id, out, still); } catch (e) { console.log(`[pv] ${id} FAILED`, e.message); }
    }
  } finally { await C.stop(S); }
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { SHOTS, RINE };
// 窓を出さない写し（同じ撮り。声だけ重ねる用）
SHOTS.s1_tomb_clean = Object.assign({}, SHOTS.s1_tomb, { prep: async (T) => { await SHOTS.s1_tomb.prep(T); await T.js('PV.hideMsg()'); } });
// 白に飲まれる元の絵: 白の大書庫（ビブリア）の広間。舞う白紙の淡い光の中を、北へゆっくり見上げる（人は映さない）
SHOTS.s1_white = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { final_sailed: true, final_arrived: true, final_rowell: true } }, 'archive_1', 'entrance'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(22, 19, 22, 8, 6000)`);
  },
  n: sec(6),
};
// 白崖の道（マレア諸島）を夜明け前に、左 → 右へ歩くリーネたち
SHOTS.s1_cliff = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { isles_arrived: true } }, 'i_cliff', { x: 18, y: 19, dir: 'e' }));
    await T.idle(150); await T.settle();
    await WALK([[49, 19]], { run: false })(T);
  },
  n: sec(7.5), walk: true,
  each: STEER_LEAD(3, 0),
};
// 題字（shots.js の title_screen と同じ: 命令の列・版の表記・ボタンの手引きを描かない）
SHOTS.s1_title = {
  url: 'dev.html',
  prep: async (T) => {
    await T.js(`(() => { const U = RPG.UIK, S = RPG.Screens; const tx = U.text;
      U.text = function (g, s) { if (typeof s === 'string' && s.indexOf('ver ') >= 0 && s.indexOf('Studio Metem') >= 0) return; return tx.apply(this, arguments); };
      S.prompts = () => {};
      for (const sc of RPG.Engine.stack) for (const o of [sc, sc.view]) if (o && o.list && o.list.draw) o.list.draw = () => {};
      return true; })()`);
    await T.idle(4);
  },
  n: sec(8),
};

// ================================================================ §2 物語のはじまり
// ロアの里の朝（エンディングの朝の写し roa_dawn）を引きで。主人公は画面の外（門）に置く
SHOTS.s2_roa_dawn = {
  prep: async (T) => {
    await T.js(FIELD({}, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(9, 13, 27, 18, 6000)`);
  },
  n: sec(6),
};
// ベルナ（本物の会話の窓・声）。台詞は序章の旅立ち（ファロス）の物だが、序章の町は映さない決まりなので、朝のロアの語り石のそばのベルナで言わせる
//   「全部を語り直して、年代記を書き上げなさい。……」（v_berna_lute_04）→「どこから回ってもいい。……」（v_berna_lute_05。年代記の画面に重ねる声）
SHOTS.s2_berna = {
  prep: async (T) => {
    await T.js(FIELD({}, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Field.camera.focus(21, 16, {ms: 0})`); await T.idle(30);
    await T.js(`PV.autoMsg(200); PV2.say([
      {who: 'e_berna', key: 'ev.pharos_story.pharos_departure.run.say_7', voice: 'v_berna_lute_04', face: 'berna:neutral'},
      {who: 'e_berna', key: 'ev.pharos_story.pharos_departure.run.say_9', voice: 'v_berna_lute_05', face: 'berna:smile'}])`);
  },
  n: sec(14),
};
// 年代記の画面: まだ何も書かれていない白いページ（章なし・手がかりなし）
SHOTS.s2_chronicle = {
  prep: async (T) => {
    await T.js(FIELD({ leads: [] }, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Game.chronicle.chapters = []; RPG.Game.leads = {}; RPG.Field.camera.focus(21, 16, {ms: 0})`); await T.idle(30);
    await T.js(`RPG.Screens.open('chronicle')`); await T.idle(20);
  },
  n: sec(6),
};
// 記録院のロウェル（本物の会話の窓・声）。序章の出張所の台詞「伝承は記録院が責任をもって保管する。……」（v_rowell_prologue_02）を、
//   書の都ビブリアの北の門に立つロウェルで言わせる（序章の町は映さない）
SHOTS.s2_rowell = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { final_sailed: true, final_arrived: true } }, 'biblia', { x: 27, y: 17, dir: 'e' }));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Field.camera.focus(28.5, 15, {ms: 0})`); await T.idle(30);
    await T.js(`PV.autoMsg(200); PV2.say([{who: 'rowell', key: 'ev.pharos_story.pharos_rowell.run.say_2', voice: 'v_rowell_prologue_02', face: 'rowell:angry'}])`);
  },
  n: sec(7),
};
// 灰色のマントの少女フィーネの後ろ姿（岬の村ネレイの岬の先で海を見ている。会話の前）。声は v_fine_t1_02 を重ねる
SHOTS.s2_fine = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { isles_arrived: true, isles_marina_met: true } }, 'nerei', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(20, 9, 20, 5, 6000)`);
  },
  n: sec(6),
};

// ================================================================ §3 あなただけの主人公と仲間
// 主人公の作成: 男 → 女、タイプを送る（戦士・狩人・術師・術剣士・旅人 → 術剣士に戻す）、得意を送る（剣に戻す）→ 名前（リーネを打ち直す）→ 決める
//   台本の 0:52（作成）と 1:00（名前 → リーネの顔の絵）を 1 本で撮る。名前の入力は 11.5 秒ごろから
const KEYS_CREATE = { 30: 'right', 80: 'down', 110: 'right', 145: 'right', 180: 'right', 215: 'right', 255: 'left', 300: 'down', 335: 'right', 370: 'right', 405: 'right', 445: 'left', 480: 'left', 515: 'left', 560: 'down', 600: 'a',
  650: 'b', 680: 'b', 710: 'b', 900: 'a' };
const CELLS_CREATE = { 745: 'リ', 770: null, 800: 'ー', 825: null, 855: 'ネ', 880: null, 885: 'ok' };
SHOTS.s3_create = {
  prep: async (T) => {
    await T.js(FIELD({}, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Screens.open('charcreate')`); await T.idle(30);
  },
  n: sec(17.5),
  each: (i) => {
    if (KEYS_CREATE[i]) return `PV.tap('${KEYS_CREATE[i]}', 3)`;
    if (CELLS_CREATE[i] === null) return `PV.tap('a', 3)`;
    if (CELLS_CREATE[i]) return `PV2.cell('${CELLS_CREATE[i]}')`;
    return null;
  },
};
// 潮風亭の仲間選び: 20 人の顔絵の表をなめる（下へ → 右上へ）→ シグレ・ザフィラ・ロウガを選ぶ → 決める（台本 1:03 の「なめる」と 1:08 の「選ぶ」を 1 本で）
//   一行は主人公だけから（20 人がみな表に出る）
const GRID_PLAN = [{ to: 18 }, { to: 2 }, { to: 'shigure', pick: true }, { to: 'zafira', pick: true }, { to: 'rouga', pick: true }];
SHOTS.s3_tavern = {
  prep: async (T) => {
    await T.js(FIELD({ party: ['hero'] }, 'coral', 'north'));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Screens.open('partySelect', {count: 3})`); await T.idle(30);
  },
  n: sec(9.5),
  each: (i) => (i >= 40 && i % 13 === 0 ? `PV2.walkGrid(${JSON.stringify(GRID_PLAN)})` : null),
};
// 4 人で港町コーラルを出る: 町のまん中の石畳の大通りを、北の町の出口（崖の切り通し）へまっすぐ。カメラは北を少し多めに
SHOTS.s3_coral = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { isles_arrived: true } }, 'coral', { x: 22, y: 37, dir: 'n' }));
    await T.idle(150); await T.settle();
    await WALK([[22, 4]], { run: false })(T);
  },
  n: sec(7.5), walk: true,
  each: STEER_LEAD(0, -2.5),
};

// ================================================================ §4 どこから旅してもいい世界
// 一枚絵の大陸の地図（地図の画面・いちばん引いた倍率）: 霧のかかった 8 つの地方が、1 つずつ晴れて町の印がともる
//   （行った所の霧が晴れる・町の印が出る、のは地図の画面のふだんの描き方。行った地方を 0.6 秒ごとに 1 つずつ足して撮る）
const REGIONS8 = ['r_forest', 'r_desert', 'r_snow', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];
const VISIT = (rid) => `(() => { const G = RPG.Game; for (const m of Object.values(RPG.DB.maps)) if (m && m.region === '${rid}') G.visited[m.id] = true;
  for (const [id, L] of Object.entries(RPG.DB.locations || {})) { const m = RPG.DB.maps[L.map]; if (m && m.region === '${rid}') { G.warps = G.warps || {}; G.warps[id] = true; } } return true; })()`;
const MAPZOOM = (z) => `(() => { for (const sc of RPG.Engine.stack) for (const v of [sc, sc.view]) if (v && v.pm) { v.pm.z = v.pm.zt = ${z}; } return true; })()`;
SHOTS.s4_world = {
  prep: async (T) => {
    await T.js(FIELD({}, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Game.visited = {roa_dawn: true}; RPG.Game.warps = {}; RPG.Screens.open('map')`); await T.idle(30);
    await T.js(MAPZOOM(1)); await T.idle(10);
  },
  n: sec(7),
  each: (i) => { const k = (i - 40) / 36; return i >= 40 && Number.isInteger(k) && k < 8 ? `${VISIT(REGIONS8[k])}; ${MAPZOOM(1)}` : (i % 10 === 0 ? MAPZOOM(1) : null); },
};
// しんきろうの市（消灯の刻だけ。宿で「消灯の刻まで休む」= desert_night）: 夜店の灯の通りを奥（北）へ
SHOTS.s4_mirage = {
  prep: async (T) => {
    await T.js(FIELD({ flags: Object.assign({ desert_night: true, l_opt_mirage: true }, DESERT) }, 'desert_mirage', { x: 18, y: 24, dir: 'n' }));
    await T.idle(150); await T.settle();
    await WALK([[18, 3]], { run: false })(T);
  },
  n: sec(5), walk: true,
  each: STEER_LEAD(0, -2.5),
};
// 凍った湖（ノルデン雪原の f_lake）: ユールからの道を西へ、湖の上を渡る
SHOTS.s4_lake = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { snow_start: true } }, 'f_lake', { x: 46, y: 32, dir: 'w' }));
    await T.idle(150); await T.settle();
    await WALK([[13, 32]], { run: false })(T);
  },
  n: sec(6), walk: true,
  each: STEER_LEAD(-3, 0),
};
// 夜光虫の入り江（マレア諸島の i_cove）: 浜沿いの道を西 → 東へ
SHOTS.s4_cove = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { isles_arrived: true } }, 'i_cove', { x: 3, y: 11, dir: 'e' }));
    await T.idle(150); await T.settle();
    await WALK([[40, 11]], { run: false })(T);
  },
  n: sec(5), walk: true,
  each: STEER_LEAD(3, 0),
};
// 雪の村ユールの夜（消灯の刻の版 yule_night。籠城・吹雪）: 広場の大かがり火を見下ろす
SHOTS.s4_yule_night = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { snow_start: true } }, 'yule_night', 'gate_w'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(28, 38, 28, 25, 4500)`);
  },
  n: sec(4.5),
};
// 雪の土手の秘密基地: 合言葉を聞く子ども（本物の会話の窓・選択肢。3 つ目の正しい合言葉を選ぶ → 子は基地の穴へ）
SHOTS.s4_snow_base = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { snow_start: true } }, 'yule', { x: 36, y: 43, dir: 'n' }));
    await T.idle(150); await T.settle();
    await T.js(`RPG.Field.camera.focus(36, 40, {ms: 0})`); await T.idle(20);
    await T.js(`PV.autoMsg(70); RPG.Events.run('yule_base_kid', {map: 'yule'})`);
  },
  n: sec(10),
  each: () => `PV2.choiceKeys(['down', 'down', 'a'], 35)`,
};
// 水辺の町ロッホ: 霧の中の鐘楼（東の塔）へカメラを渡す
SHOTS.s4_loch_bells = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { marsh_arrived: true } }, 'loch', 'gate_w'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(26, 16, 44, 14, 4500)`);
  },
  n: sec(4.5),
};
// ロッホの集会所: 証拠をそろえて、町の人を「名指し」する選択肢（本物の窓。カーソルを容疑者から「霧そのもの」へ送る）
const MARSH_EV = { marsh_arrived: true, marsh_emma_met: true, marsh_ev_foot: true, marsh_ev_book: true, marsh_ev_doll: true, marsh_ev_drawing: true, marsh_ev_melda: true, marsh_ev_stone: true, marsh_can_assemble: true, marsh_melda_warned: true };
SHOTS.s4_loch_naming = {
  prep: async (T) => {
    await T.js(FIELD({ flags: MARSH_EV, vars: { marsh_evidence: 6 } }, 'loch_hall', 'door'));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(60); RPG.Events.run('loch_assembly', {map: 'loch_hall'})`);
    await T.until('RPG.UIK.Message.state() && RPG.UIK.Message.state().choiceRect != null', 1500);
    await T.idle(20);
  },
  n: sec(6),
  each: (i) => ({ 60: `PV.tap('down', 3)`, 110: `PV.tap('down', 3)`, 160: `PV.tap('down', 3)` })[i] || null,
};
// 潮鳴りの洞窟: 潮の石を叩く（本物の窓・選択）→ 潮が引いて道が出る
SHOTS.s4_tide = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { isles_arrived: true, isles_tide_high: true } }, 'isles_cave_1', { x: 20, y: 17, dir: 'n' }));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(50); RPG.Events.run('isles_tide_stone', {map: 'isles_cave_1'})`);
  },
  n: sec(9),
  each: () => `PV2.choiceKeys(['a'], 40)`,
};
// トロッコ線の崖（ガルド山地 g_rail）: 線路沿いにカメラを渡す
SHOTS.s4_rail = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { mine_arrived: true } }, 'g_rail', 'hut'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(12, 19, 36, 19, 4000)`);
  },
  n: sec(4),
};
// 鉱山都市ドヴァンの灯: 南の門から町の奥へ見上げる
SHOTS.s4_dovan = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { mine_arrived: true } }, 'dovan', 'mine'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(27, 40, 27, 24, 4000)`);
  },
  n: sec(4),
};
// 湯けむりの谷（灰の荒野 a_spa）
SHOTS.s4_spa = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { ash_arrived: true } }, 'a_spa', 'south'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(23, 27, 23, 12, 4000)`);
  },
  n: sec(4),
};
// 溶岩の原（a_lava）
SHOTS.s4_lava = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { ash_arrived: true } }, 'a_lava', 'north'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(10, 22, 38, 22, 4000)`);
  },
  n: sec(4),
};
// 星降りのくぼ地（オルビス高原 s_crater）
SHOTS.s4_crater = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { star_arrived: true } }, 's_crater', 'north'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(12, 26, 40, 26, 4000)`);
  },
  n: sec(4),
};
// 学術都市オルビス: 南の門から広場へ
SHOTS.s4_orbis = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { star_arrived: true } }, 'orbis', 'academy'));
    await T.idle(150); await T.settle();
    await T.js(`PV.pan(30, 44, 30, 30, 4000)`);
  },
  n: sec(4),
};
// 手がかり帳（年代記の画面の「手がかり」）: うわさ・地方の手がかり・本筋が並ぶ。カーソルを下へ送って中身を見せる
SHOTS.s4_leads = {
  prep: async (T) => {
    await T.js(FIELD({ flags: Object.assign({}, DESERT) }, 'roa_dawn', 'gate'));
    await T.idle(150); await T.settle();
    await T.js(`(() => { const ids = ['l_opt_mirage', 'l_desert_glyphs', 'l_desert_tomb', 'l_marsh_mist', 'l_marsh_evidence', 'l_opt_lotus', 'q_marsh_cat', 'l_main_recorder_desert', 'l_main_recorder_marsh'];
      for (const id of ids) if (RPG.DB.leads[id]) RPG.Leads.add(id); RPG.Leads.pin('l_desert_tomb'); return true; })()`);
    await T.idle(10);
    await T.js(`RPG.Screens.open('chronicle')`); await T.idle(20);
  },
  n: sec(6),
  each: (i) => (i > 40 && i % 50 === 0 && i < 330 ? `PV.tap('down', 3)` : null),
};

// ================================================================ §6 あなたの選択が、年代記になる
const DESERT_KING = Object.assign({ desert_king: true, desert_named: true }, DESERT);
// 砂漠の灯り直す場面の頭: 古い泉の底に日輪の火 → 光の柱 → 年代記の章の札（「CHAPTER」・章の題が書き加えられる）。台本 2:54 の「年代記に書き足される」の元
SHOTS.s6_chapter = {
  prep: async (T) => {
    await T.js(FIELD({ flags: DESERT_KING }, 'desert_tomb_3', 'throne'));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(60); RPG.Events.run('desert_finale', {map: 'desert_tomb_3'})`);
    await T.idle(20);
  },
  n: sec(16),
};
// 地方の終わりの選択「年代記に何を書く？」（砂漠 ch_desert_write。本物の窓）: 語り部が年代記を開く → 選択 → 2 つ目（痛みの側）を選ぶ
SHOTS.s6_write = {
  prep: async (T) => {
    await T.js(FIELD({ flags: DESERT_KING }, 'desert_tomb_3', 'throne'));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(8); PV.autoChoose = false; RPG.Events.run('desert_finale', {map: 'desert_tomb_3'})`);
    await T.until(`PV.lastLine().includes('年代記を開いた')`, 6000);
    await T.js(`PV.autoMsg(100)`);
  },
  n: sec(13),
  each: () => `PV2.choiceKeys(['down', 'up', 'down', 'a'], 45)`,
};

// ================================================================ §9 結び: 八つの灯が 1 つずつ光の柱になってともる
//   地方を解決したときの本物の筋（R.Events._clearRegion = ev.clearRegion: ページ・ティア・章の数 → 光の柱 → 章の札）を、
//   前の地方を解決済みにした状態で、その地方の大灯火の場所（regions の beaconAt。ワールドの上にある物はワールド）で 1 つずつ撮る。
//   章の札（CHAPTER n）は柱が立って約 2.4 秒後に出る（柱だけ使うなら頭の 2.4 秒）
const BEACONS = [
  ['r_forest', 'world', null], ['r_desert', 'desert_camp3', 'spring'], ['r_snow', 'peak_top', 'altar'], ['r_marsh', 'world', null],
  ['r_isles', 'i_light', null], ['r_mine', 'dovan', 'mine'], ['r_ash', 'ash_volcano_2', null], ['r_star', 'star_tower_top', 'lectern'],
];
BEACONS.forEach(([rid, map, spawn], k) => {
  SHOTS['s9_beacon_' + (k + 1)] = {
    prep: async (T) => {
      const prev = BEACONS.slice(0, k).map((b) => b[0]);
      const fl = {}; for (const r of prev) fl['cleared_' + r] = true;
      await T.js(FIELD({ flags: Object.assign({ cleared_r_forest: k > 0 }, fl), tier: k }, map, spawn));
      await T.idle(150); await T.settle();
      await T.js(`(() => { const G = RPG.Game; G.cleared = {}; for (const r of ${JSON.stringify(prev)}) G.cleared[r] = true; G.flags.cleared_r_forest = ${k > 0};
        G.chronicle.chapters = ${JSON.stringify(prev)}.map((id) => ({id, summaryKey: id})); G.tier = ${k};
        const rg = RPG.DB.regions['${rid}'], b = rg.beaconAt; if (b && b.map === '${map}' && b.x != null) RPG.Field.camera.focus(b.x, b.y, {ms: 0});
        return true; })()`);
      await T.idle(30);
      await T.js(`RPG.Events._clearRegion('${rid}')`);
      await T.idle(40);   // 暗転の間（0.7 秒）は撮らない
    },
    n: sec(6),
  };
});

// ================================================================ §7 想い（本物の出来事。戦いは勝ったことにして飛ばし、戦いの後の場面から撮る。声と窓は本物）
//   どれも *_clean（窓・地の文を描かない写し）も撮る。台本は「文字は出さない」なので、編集で選ぶ
// 事前に早送り（autoMsg 8）して cond が真になったら、ふつうの速さ（autoMsg 110）に戻して撮る
const FF_UNTIL = (cond) => async (T) => { await T.until(cond, 9000); await T.js(`PV.autoMsg(110)`); };
// 白竜の峰の頂: 白竜が膝を折る → ネーヴェ「……あたたかい。人の子らは、わたしを忘れてはいなかったのか。」（v_neve_peak_02）
SHOTS.s7_neve = {
  prep: async (T) => {
    await T.js(FIELD({ flags: { snow_start: true, snow_giant: true, snow_dawn: true }, items: { k_winter_flame: 1 } }, 'peak_top', 'altar'));
    await T.idle(150); await T.settle();
    await T.js(`PV2.winAll(); PV.autoMsg(8); RPG.Events.run('peak_neve', {map: 'peak_top'})`);
    await FF_UNTIL(`PV.lastLine().includes('膝を折り')`)(T);
  },
  n: sec(11),
};
// 幽霊船の船長室: 亡霊船長グレン（戦いの後）→ 舟歌 → グレン「……マリナ。そうだ、おれは帰ると約束したんだ。」（v_glen_ship_03）
const ISLES = { isles_arrived: true, isles_marina_met: true, isles_fog_open: true, isles_song_done: true, isles_fine_seen: true };
SHOTS.s7_glen = {
  prep: async (T) => {
    await T.js(FIELD({ flags: ISLES }, 'ghost_ship_3', { x: 10, y: 14, dir: 'w' }));
    await T.idle(150); await T.settle();
    await T.js(`PV2.winAll(); PV.autoMsg(8); RPG.Events.run('isles_captain', {map: 'ghost_ship_3'})`);
    await FF_UNTIL(`RPG.Game.flags.isles_captain`)(T);
  },
  n: sec(17),
};
// 岬の村ネレイの桟橋、地平が白むころ: マリナ「おかえりなさい、グレン。」（v_marina_dawn_01）→ グレン「ただいま、マリナ。」（v_glen_dawn_01）
SHOTS.s7_marina = {
  prep: async (T) => {
    await T.js(FIELD({ flags: Object.assign({ isles_captain: true, isles_log_white: true }, ISLES) }, 'nerei', 'pier_end'));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(110); RPG.Events.run('isles_dawn', {map: 'nerei'})`);
  },
  n: sec(17),
};
// 砂の王墓: 王の霊が浮かび上がり、名を取り戻す → ハザル「民は、約束を覚えていてくれたのだな……。」（v_hazal_tomb_04）
SHOTS.s7_hazal = {
  prep: async (T) => {
    await T.js(FIELD({ flags: DESERT, items: { i_desert_kingname: 1 } }, 'desert_tomb_3', { x: 26, y: 11, dir: 'n' }));
    await T.idle(150); await T.settle();
    await T.js(`PV2.winAll(); PV.autoMsg(8); RPG.Events.run('desert_tomb_king', {map: 'desert_tomb_3'})`);
    await FF_UNTIL(`RPG.Game.flags.desert_king`)(T);
  },
  n: sec(20),
};
// 火山の火口の縁: フィーネ「燃え尽きることと、忘れられることは、違うわ。」（v_fine_ash_01）
const ASH = { ash_arrived: true, ash_lavabeast: true };
SHOTS.s7_fine_ash = {
  prep: async (T) => {
    await T.js(FIELD({ flags: ASH }, 'ash_volcano_2', { x: 24, y: 6, dir: 'e' }));
    await T.idle(150); await T.settle();
    await T.js(`PV.autoMsg(110); RPG.Events.run('ash_crater_fine', {map: 'ash_volcano_2'})`);
  },
  n: sec(11),
};
// 火口: 卵に壁画の物語を語る → 火の鳥がかえる → 火の鳥の灯（大灯火の光の柱・章の札）。語りの字幕は出さない（窓なしで撮る）
SHOTS.s7_firebird = {
  prep: async (T) => {
    await T.js(FIELD({ flags: Object.assign({ ash_fine_seen: true }, ASH) }, 'ash_volcano_2', 'egg'));
    await T.idle(150); await T.settle();
    await T.js(`PV.hideMsg(); PV.autoMsg(60); RPG.Events.run('ash_crater_egg', {map: 'ash_volcano_2'})`);
  },
  n: sec(27),
};
for (const id of ['s7_neve', 's7_glen', 's7_marina', 's7_hazal', 's7_fine_ash']) {
  SHOTS[id + '_clean'] = Object.assign({}, SHOTS[id], { prep: async (T) => { await T.js('PV.hideMsg()'); await SHOTS[id].prep(T); } });
}
