#!/usr/bin/env node
// CORE の node のテスト（V2_PLAN §4.4 の CORE の行）: fit の表（MODERN_UI §1.2 の全行）・入力の割り当て・
// セーブの往復・版違い・合言葉・戦闘の直前の写し・音の欠けた媒体・契約の検査・ビルドの順番とフィクスチャ。
//   node v2/tools/test_core.js            （--single のビルドも確かめるときは --single）
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const load = require('./lib/load');

/** root の下の PNG で、残してよいチャンク以外を持つ物 {n, list: ['path: caBX,…']}（チャンクの頭だけ読む） */
function pngMetaLeaks(root) {
  const KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'sRGB', 'iCCP', 'pHYs']);
  const SKIP = new Set(['node_modules', '.git', 'raw']);
  const head = Buffer.alloc(12);
  const out = { n: 0, list: [] };
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(q); continue; }
      if (!e.name.endsWith('.png')) continue;
      out.n++;
      const fd = fs.openSync(q, 'r');
      try {
        const size = fs.fstatSync(fd).size, extra = [];
        let pos = 8;
        while (pos + 8 <= size) {
          fs.readSync(fd, head, 0, 8, pos);
          const len = head.readUInt32BE(0), type = head.toString('latin1', 4, 8);
          if (!KEEP.has(type)) extra.push(type);
          if (type === 'IEND') break;
          pos += 12 + len;
        }
        if (extra.length) out.list.push(path.relative(root, q) + ': ' + [...new Set(extra)].join(','));
      } finally { fs.closeSync(fd); }
    }
  };
  walk(root);
  return out;
}

let n = 0, bad = 0;
function ok(name, cond, info) {
  n++; if (!cond) bad++;
  console.log(`${cond ? 'pass' : 'FAIL'}  ${name}${cond || info === undefined ? '' : '  ' + JSON.stringify(info).slice(0, 400)}`);
}

(async () => {
  const R = load({ quiet: true, dev: true, fixtures: true });
  ok('loads in node without errors', R._nodeLoadErrors.length === 0 && R.loadErrors.length === 0, R.loadErrors);
  const all = R.Contract.checkAll();
  ok('R.Contract.checkAll() (stubs fill every §2.5 name)', all.ok, all.errors);

  // ---- fit（MODERN_UI §1.2 の表。実画面の px を CSS px × dpr で表す）
  const rows = [
    ['PC 16:9', 1920, 1080, 1, false, 960, 540, 2, 1.0],
    ['PC 16:10', 1920, 1200, 1, false, 960, 540, 2, 1.0],
    ['4K TV', 3840, 2160, 1, false, 960, 540, 4, 1.0],
    ['720p', 1280, 720, 1, false, 960, 540, 2, 1.0],
    ['1440p', 2560, 1440, 1, false, 960, 540, 2.667, 1.0],
    ['1080p at 125%', 1536, 864, 1.25, false, 960, 540, 2, 1.0],
    // 2 より細かい実画面は実画面の画素に合わせる（PC 版の決め直し。スマホ・タブレットも同じ式）
    ['phone land 19.5:9', 844, 390, 3, true, 1168, 540, 2.167, 1.25],
    ['phone portrait', 390, 844, 3, true, 540, 1169, 2.166, 1.3],
    ['tablet 4:3', 1024, 768, 2, true, 720, 540, 2.844, 1.1],
    // PC の縦長の窓（テスト報告 2026-10-01）: 縦/横 < 1.5 は横持ちの 4:3 を帯で、縦持ちは高さに合わせた uiScale
    ['PC window 800x885', 800, 885, 1, false, 720, 540, 2, 1.0],
    ['PC window 600x1000', 600, 1000, 1, false, 540, 900, 2, 1.0],
  ];
  for (const [name, w, h, dpr, coarse, W, H, S, ui] of rows) {
    const f = R.fitCalc({ cssW: w, cssH: h, dpr, coarse, uiSize: 1 });
    ok(`fit ${name}: ${W}x${H} SCALE ${S} ui ${ui}`, f.W === W && f.H === H && Math.abs(f.SCALE - S) < 0.001 && f.uiScale === ui, f);
    // ぼけない: 実キャンバスが実画面の画素に 1:1（2 以下の実画面は大きく描いて縮める）、帯の位置も実画面の画素に揃う
    const dev = Math.min(w / W, h / H) * dpr;
    if (dev >= 2 - 1e-6) ok(`fit ${name}: backing = device px (1:1)`, f.crisp && Math.abs(f.css.w * dpr - f.backing.w) < 0.01 && Math.abs(f.css.h * dpr - f.backing.h) < 0.01, f);
    ok(`fit ${name}: bars on device px`, Math.abs(f.css.left * dpr - Math.round(f.css.left * dpr)) < 1e-6 && Math.abs(f.css.top * dpr - Math.round(f.css.top * dpr)) < 1e-6, f.css);
    ok(`fit ${name}: body 15 px ≥ 12 CSS px`, 15 * f.uiScale * f.cssScale >= 12 - 1e-6, { css: 15 * f.uiScale * f.cssScale });
  }
  const int1440 = R.fitCalc({ cssW: 2560, cssH: 1440, dpr: 1, scaleMode: 'integer' });
  ok('fit integer 1440p: 2x (1920x1080 in the middle, 1:1)', int1440.SCALE === 2 && int1440.css.w === 1920 && int1440.css.left === 320 && int1440.crisp, int1440);
  const int4k = R.fitCalc({ cssW: 3840, cssH: 2160, dpr: 1, scaleMode: 'integer' });
  ok('fit integer 4K: 4x fills the screen', int4k.SCALE === 4 && int4k.css.w === 3840 && int4k.css.left === 0, int4k);
  const f720 = R.fitCalc({ cssW: 1280, cssH: 720, dpr: 1 });
  ok('fit 720p: draws at 2x and shrinks (backing 1920x1080 in a 1280x720 box)', f720.backing.w === 1920 && f720.css.w === 1280, f720);
  const f5k = R.fitCalc({ cssW: 5120, cssH: 2880, dpr: 1 });
  ok('fit 5K: SCALE capped at 4', f5k.SCALE === 4 && f5k.backing.w === 3840, f5k);
  const wide = R.fitCalc({ cssW: 3000, cssH: 1000, dpr: 1 });
  ok('fit ultra-wide caps at 1260', wide.W === 1260 && wide.css.left > 0, wide);
  const big = R.fitCalc({ cssW: 1920, cssH: 1080, dpr: 1, uiSize: 1.3 });
  ok('uiSize 1.3 multiplies uiScale', big.uiScale === 1.3, big);
  const safe = R.fitCalc({ cssW: 390, cssH: 844, dpr: 3, coarse: true, safe: { l: 0, t: 47, r: 0, b: 34 } });
  ok('safe area in logical px', safe.safe.t > 60 && safe.safe.b > 45, safe.safe);

  // ---- 入力
  const I = R.Input;
  ok('BTN list', JSON.stringify(I.BTN) === JSON.stringify(['a', 'b', 'x', 'y', 'l', 'r', 'start', 'up', 'down', 'left', 'right']));
  I._set('a', true); I.update(16);
  ok('pressed on the first frame', I.pressed('a') && I.down('a'));
  I.update(16);
  ok('pressed only once', !I.pressed('a') && I.down('a'));
  for (let t = 0; t < 260; t += 16) I.update(16);
  let reps = 0; for (let t = 0; t < 700; t += 10) { I.update(10); if (I.repeat('a')) reps++; }
  ok('repeat every ~70 ms after 260 ms', reps >= 8 && reps <= 11, reps);
  I._set('a', false); I.update(16);
  ok('released', I.released('a'));
  I._set('right', true); I._set('down', true); I.update(16);
  ok('dir8 diagonal', I.dir8().dx === 1 && I.dir8().dy === 1);
  I._set('right', false); I._set('down', false); I.update(16);
  I._stick(0.1, -0.9); I.update(16);
  ok('dir8 from the stick', I.dir8().dx === 0 && I.dir8().dy === -1);
  I._stick(0, 0); I.update(16);
  I.lastDevice = 'kb';
  ok('prompt kb: a → Z, y → C', I.prompt('a').label === 'Z' && I.prompt('y').label === 'C' && I.prompt('a').kind === 'kb');
  I.lastDevice = 'pad';
  // 印の字は標準配置のボタンの番号から（決定は既定で右 = 1）。A が右の系統（nintendo）で前の表と同じ字、A が下（xbox）は右が B
  R.Settings.set('padGlyphs', 'nintendo');
  ok('prompt pad nintendo (confirm right): a → A', I.prompt('a').label === 'A' && I.prompt('b').label === 'B');
  R.Settings.set('confirmButton', 'down');
  ok('prompt pad nintendo (confirm down): a → B (position)', I.prompt('a').label === 'B' && I.prompt('b').label === 'A');
  R.Settings.set('confirmButton', 'right');
  R.Settings.set('padGlyphs', 'xbox');
  ok('prompt pad xbox (confirm right): a → B (right face), index 1', I.prompt('a').label === 'B' && I.prompt('a').index === 1 && I.prompt('a').style === 'xbox');
  R.Settings.set('padGlyphs', 'auto');
  I.lastDevice = 'touch';
  ok('prompt touch', I.prompt('a').kind === 'touch');
  for (const k of ['a', 'b', 'x', 'y']) ok(`prompt shape ${k}`, R.Contract.check('prompt', I.prompt(k)).ok);
  I.lastDevice = 'kb';

  // ---- 設定
  ok('settings defaults (§2.5.18)', R.Settings.get('textSpeed') === 'normal' && R.Settings.get('wipe') === 'retry' && R.Settings.get('vol.voice') === 8 && R.Settings.get('fieldZoom') === 'normal');
  ok('settings reject bad values', R.Settings.set('fx', 'ultra') === false && R.Settings.get('fx') === 'high');
  let seen = null; R.on('settings', (e) => { seen = e; });
  R.Settings.set('fx', 'low');
  ok('settings emit', seen && seen.key === 'fx' && seen.v === 'low');
  ok('settings persisted', JSON.parse(R._localStorage[R.SAVE_PREFIX + 'settings']).fx === 'low');
  R.Settings.set('fx', 'high');

  // ---- セーブ
  R.Dev.applyState('core_stub_road');
  R.Game.pos = { map: 'stub_road', x: 7, y: 5, dir: 'e' };
  R.Game.cleared.r_forest = true;
  ok('game state shape (§2.6.3)', R.Contract.check('game', R.Game).ok, R.Contract.check('game', R.Game).errors);
  ok('char shape (no weapon2)', R.Contract.check('char', R.Game.chars.hero).ok, R.Contract.check('char', R.Game.chars.hero).errors);
  ok('save s1', R.Save.save('s1'));
  const card = R.Save.cards().find((e) => e.slot === 's1').card;
  ok('card shape, chapter = cleared regions, no Lv', R.Contract.check('saveCard', card).ok && card.chapter === 1 && !JSON.stringify(card).includes('"lv'), card);
  ok('key prefix luminous_chronicle_v2_', Object.keys(R._localStorage).some((k) => k === 'luminous_chronicle_v2_slot_s1'));
  const gold = R.Game.gold;
  R.Game.gold = 1;
  ok('load s1 restores', R.Save.load('s1') && R.Game.gold === gold && R.Game.pos.x === 7);
  R.Save._raw('s2', JSON.stringify({ ver: 1, card: {}, state: {} }));
  R.Save._raw('s3', '{broken');
  const c2 = R.Save.cards();
  ok('old version → {bad:"old"}, not loaded', c2.find((e) => e.slot === 's2').card.bad === 'old' && R.Save.load('s2') === false);
  ok('broken record → {bad:"old"}', c2.find((e) => e.slot === 's3').card.bad === 'old');
  ok('suspend is removed after loading', R.Save.suspend() && R.Save.load('suspend') && !R.Save.cards().find((e) => e.slot === 'suspend').card);
  const pp = R.Save.passphrase();
  R.Game.gold = 3;
  ok('passphrase round trip', /^LC2-/.test(pp) && R.Save.fromPassphrase(pp) && R.Game.gold === gold);
  ok('passphrase rejects a typo', R.Save.fromPassphrase(pp.slice(0, 20) + 'x' + pp.slice(21)) === false);
  R.Save.checkpoint('battle', { setup: { troop: 'tr_stub' }, seed: 5 });
  R.Game.gold = 0; R.Game.flags.lost = true;
  ok('checkpoint/restore (memory only)', R.Save.restore('battle') && R.Game.gold === gold && !R.Game.flags.lost && R.Save.checkpointData('battle').seed === 5);
  ok('checkpoint is not written to storage', !Object.keys(R._localStorage).some((k) => /checkpoint|battle/.test(k)));
  let toast = 0; const t0 = R.UIK.toast; R.UIK.toast = () => { toast++; };
  ok('autosave writes auto + toast', R.Save.autosave('map') && toast === 1 && R.Save.cards()[0].card);
  R.UIK.toast = t0;

  // ---- 音（node には AudioContext が無い = 媒体も鳴らない環境。どれもエラーにしない）
  let threw = null;
  try {
    R.Audio.bgm('title', { fade: 600 }); R.Audio.pushBgm('battle'); R.Audio.popBgm(); R.Audio.stopBgm(300);
    R.Audio.sfx('confirm'); R.Audio.sfx('no_such_sfx'); R.Audio.stopVoice();
    await R.Audio.voice('v_missing_line');
  } catch (e) { threw = e; }
  ok('audio calls without a context or media do not throw', !threw, String(threw));
  ok('R.Media without RPG_MEDIA', R.Media.has('bgm', 'title') === false && R.Media.entry('voice', 'x') === null);
  R._sandbox.RPG_MEDIA = { bgm: { title: { url: 'bgm/title.ogg', loopStart: 1 } }, voice: { v_a: 'voice/v_a.ogg' }, portraits: {} };
  ok('R.Media reads RPG_MEDIA', R.Media.url('bgm', 'title') === 'bgm/title.ogg' && R.Media.entry('voice', 'v_a').url === 'voice/v_a.ogg');
  ok('media table shape', R.Contract.check('media', R._sandbox.RPG_MEDIA).ok);
  ok('new v2 sfx ids exist (spring lead lamp telegraph bridge)', ['spring', 'lead', 'lamp', 'telegraph', 'bridge'].every((k) => typeof R.DB.sfx[k] === 'function'));

  // ---- Engine
  const E = R.Engine;
  E.clear();
  let entered = 0;
  const sc = { id: 't', enter() { entered++; }, exit() {}, update() {}, draw() {} };
  ok('scene contract', R.Contract.check('scene', sc).ok);
  const p = E.await(sc, {});
  E.pop('done');
  ok('await/pop returns the result', (await p) === 'done' && entered === 1);
  let waited = false; R.wait(100).then(() => { waited = true; });
  E.advance(50); await null;
  ok('R.wait counts Engine.time (not yet)', !waited);
  E.advance(80); await null; await null;
  ok('R.wait resolves by Engine.time', waited);
  E.speed = 2; const tA = E.time; E.advance(100); E.speed = 1;
  ok('Engine.speed doubles time', Math.round(E.time - tA) === 200);
  E.setTime(1234, { freeze: true }); E.advance(100);
  ok('setTime freeze (shot.js --time)', E.time === 1234);
  E.setTime(1234, { freeze: false });
  const rg = R.rng('hd:field:selma'), rg2 = R.rng('hd:field:selma');
  ok('rng with a string key is deterministic', rg.next() === rg2.next() && R.Contract.check('rng', rg).ok);

  // ---- 契約の検査そのもの
  ok('check map (stub)', R.Contract.check('map', R.DB.maps.stub_road).ok);
  const badMap = JSON.parse(JSON.stringify(R.DB.maps.stub_road)); badMap.objects.push({ type: 'chest', id: 'x', x: 1, y: 1 });
  ok('check map rejects a chest on the world map (A27)', !R.Contract.check('map', badMap).ok);
  ok('battleEvent kinds', R.Contract.check('battleEvent', { t: 'dmg', uid: 'e_0', n: 3 }).ok && !R.Contract.check('battleEvent', { t: 'nope' }).ok);
  const B = R.BattleCore.create({ troop: 'tr_tutorial' });
  ok('battle object names', R.Contract.check('battle', B).ok, R.Contract.check('battle', B).errors);
  ok('units shape', B.units.every((u) => R.Contract.check('unit', u).ok));
  const evs = [];
  for (let i = 0; i < 60 && !B.over; i++) {
    for (const u of B.units.filter((x) => x.side === 'party' && x.hp > 0)) { const foe = B.units.find((x) => x.side === 'enemy' && x.hp > 0); B.submit(u.uid, { cmd: 'attack', target: foe ? foe.uid : null }); }
    evs.push(...B.round());
  }
  ok('battle runs to an end with valid events', !!B.over && evs.every((e) => R.Contract.check('battleEvent', e).ok), { over: B.over, bad: evs.filter((e) => !R.Contract.check('battleEvent', e).ok).slice(0, 3) });
  ok('rewards shape', R.Contract.check('rewards', B.rewards()).ok);
  const ev = R.Events.makeEv({});
  ok('ev names (§2.5.10)', R.Contract.check('ev', ev).ok, R.Contract.check('ev', ev).errors);
  ok('fixtures: 1 state + 2 scenes, valid', Object.keys(R._sandbox.RPG_FIXTURES.states).length >= 1 && Object.keys(R._sandbox.RPG_FIXTURES.scenes).length >= 2 &&
    Object.values(R._sandbox.RPG_FIXTURES.states).every((s) => R.Contract.check('fixtureState', s).ok) && Object.values(R._sandbox.RPG_FIXTURES.scenes).every((s) => R.Contract.check('fixtureScene', s).ok));

  // ---- ビルドの順番
  const { order } = require('./build.js');
  const names = order({ dev: true }).map((f) => path.relative(path.join(__dirname, '..', 'src'), f));
  ok('core first 6 in order', names.slice(0, 6).join(',') === 'core/ns.js,core/util.js,core/bus.js,core/engine.js,core/fit.js,core/gfx.js', names.slice(0, 6));
  ok('main.js last, dev before it', names[names.length - 1] === 'main.js' && names[names.length - 2].startsWith('dev/'));
  ok('index order has no dev files', !order().some((f) => f.includes(path.sep + 'dev' + path.sep)));

  // ---- 書いてはいけない物（API キー・モデルの識別子）が v2 の木に無い
  const txt = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) { if (!['dist', 'node_modules', 'shots'].includes(e.name)) walk(q); } else if (/\.(js|json|md|jsonl)$/.test(e.name)) { if (q !== __filename) txt.push([q, fs.readFileSync(q, 'utf8')]); } } };
  walk(path.join(__dirname, '..'));
  const leaks = txt.filter(([, s]) => /sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|\b(gpt-[0-9]|dall-e|gemini-[0-9]|lyria|claude-[a-z0-9])/i.test(s)).map(([q]) => q);
  ok('no API keys / model identifiers in v2 sources', leaks.length === 0, leaks);

  // ---- PNG に付随チャンク（caBX = 生成の来歴・tEXt/iTXt/zTXt・eXIf など。作った道具の名前が入る）が無い（chronicle の木の全部）
  //   チャンクの頭（12 バイト）だけ読んで飛ばす（画素は開かない）。生成の生の出力（design/art_ref/gen/**/raw/）は版に入れないので除く
  {
    const t0 = Date.now();
    const bad = pngMetaLeaks(path.join(__dirname, '..', '..'));
    ok(`PNGs carry no ancillary chunks (only IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs; ${bad.n} files, ${Date.now() - t0} ms)`, bad.list.length === 0, bad.list.slice(0, 8));
  }

  // ---- --single（任意。重いので指定したときだけ）
  if (process.argv.includes('--single')) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lc2-single-'));
    execFileSync('node', [path.join(__dirname, 'build.js'), '--single', '--out', out, '--no-dev'], { stdio: 'pipe' });
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    ok('--single embeds media as octet-stream scripts', /<script type="application\/octet-stream" id="media:bgm:title"/.test(html) && html.includes('"url":"#media:bgm:title"'));
    ok('--single has no external URLs', !/(src|href)="https?:/.test(html));
    ok('--single writes no media dirs', !fs.existsSync(path.join(out, 'bgm')));
    console.log(`      single index.html: ${(html.length / 1048576).toFixed(1)} MB`);
    fs.rmSync(out, { recursive: true, force: true });
  }

  console.log(`\n${n - bad}/${n} passed` + (bad ? `  (${bad} FAILED)` : ''));
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(2); });
