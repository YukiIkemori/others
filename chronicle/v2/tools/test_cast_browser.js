#!/usr/bin/env node
// CAST のブラウザのテスト（V2_PLAN §4.4 の CAST の行）: 焼いて調べる。
//   node v2/tools/build.js && node v2/tools/test_cast_browser.js
// - 30 人＋物語の人・町の人・動物: hd:field・hd:btl（5 系統）・hd:face が K.sheet、ポーズの数、anchors、純黒 0
// - 原画のある look（hero_m_warrior）: 画像から（source 'sprite'）・表情 5 つ・ランタン
// - シートの形（bare＋weapons）の原画: 剣以外の系統で武器を持ち手に付けて焼く（design/sprite_pipe/out/arun_mock を差し込んで確かめる）
// - 後頭部の肌（骨組みで肌だけ目印にして焼き、頭の後ろ半分の肌の割合 ≤ STYLE.hairSkinMax）
// - R.Portrait.draw・has、出撃中の 4 人のキーと pin
// - 焼く時間（G1 の報告用。R.Hd.BUDGET.charBakeMs と比べる）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const Bw = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

const CHRON = path.resolve(__dirname, '..', '..');

function pageCheck() {
  const R = window.RPG, C = R.Contract, cast = R.Art.cast;
  const out = { sheets: {}, errs: [] };
  const COMP = R.DB.companions;
  const persons = Object.keys(R.DB.looks).filter((l) => /^hero_/.test(l)).concat(Object.keys(COMP));
  const extra = ['berna', 'rowell', 'fine', 'otto', 'elm', 'npc_hanna', 'npc_gord', 'npc_pim', 'npc_man_1', 'npc_guard_2', 'npc_yura_folk_3', 'ani_cat', 'ani_hen'];
  const black = (sh) => { let n = 0; for (const f of sh.frames) { const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 127 && d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) n++; } return n; };
  const summary = (sh) => ({ ok: C.check('sheet', sh).ok, err: C.check('sheet', sh).errors.slice(0, 2), poses: Object.keys(sh.poses), frames: sh.frames.length, black: black(sh), head: !!(sh.anchors && sh.anchors.head), feet: !!(sh.anchors && sh.anchors.feet), source: sh.meta && sh.meta.source, placeholder: !!(sh.meta && sh.meta.placeholder), meta: { skin: sh.meta && sh.meta.skin && sh.meta.skin.length, headR: sh.meta && sh.meta.headR, facing: sh.meta && sh.meta.facing, weaponDrawn: sh.meta && sh.meta.weaponDrawn, weaponMismatch: sh.meta && sh.meta.weaponMismatch, lantern: sh.meta && sh.meta.lantern } });
  for (const l of persons.concat(extra)) {
    try {
      const f = R.Hd.now('hd:field:' + l, { scale: 1.15 });
      out.sheets['field:' + l] = f ? summary(f) : null;
      if (!R.DB.looks[l].animal) {
        const wts = persons.includes(l) ? cast.WTYPES : ['sword'];
        for (const w of wts) { const b = R.Hd.now(`hd:btl:${l}:${w}`); out.sheets[`btl:${l}:${w}`] = b ? summary(b) : null; }
      }
      if (R.Hd.has('hd:face:' + l)) { const fc = R.Hd.now('hd:face:' + l); out.sheets['face:' + l] = fc ? summary(fc) : null; }
    } catch (e) { out.errs.push(l + ': ' + e.message); }
  }
  // ランタン
  const lf = R.Hd.now('hd:field:hero_m_warrior', { scale: 1.15, lantern: true });
  out.lantern = { anchor: lf.anchors.lantern || null, dirs: Object.keys((lf.meta && lf.meta.lantern) || {}) };
  const lr = R.Hd.now('hd:field:selma', { scale: 1.15, lantern: true });
  out.lanternRig = { anchor: lr.anchors.lantern || null, dirs: Object.keys((lr.meta && lr.meta.lantern) || {}) };
  // 広さの設定（ちかい・ひろい）: 高さが倍率どおり
  const hOf = (sh) => { const g = R.Art.rig.geo(sh.frames[sh.poses.stand_s[0]]); return g.height; };
  out.scales = {};
  for (const l of ['hero_m_warrior', 'selma']) out.scales[l] = [0.9, 1.15, 1.4].map((s) => hOf(R.Hd.now('hd:field:' + l, { scale: s })));
  // 顔: Portrait.draw が画素を描く
  const cv = document.createElement('canvas'); cv.width = 118; cv.height = 118; const g = cv.getContext('2d');
  out.portrait = {};
  for (const l of ['hero_m_warrior', 'selma', 'berna', 'npc_man_1']) {
    g.clearRect(0, 0, 118, 118);
    const r = R.Portrait.draw(g, l, { x: 0, y: 0, w: 118, h: 118 }, { expr: 'smile' });
    const d = g.getImageData(0, 0, 118, 118).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    out.portrait[l] = { drew: r, px: n, has: R.Portrait.has(l) };
  }
  // 表情の違い（仮の顔の 5 コマが同じ画素でない）
  // 仮の顔（骨組み）の look で。selma は原画の顔（表情の対応で同じコマを使う表情がある）になったので、顔の原画の無い名前のある町の人で見る
  //   （町の人の顔も原画が増えたので、決まった 3 人ではなく、顔の原画の無い人を全部の look から探す）
  const rigFace = (l) => R.Hd.has('hd:face:' + l) && !(R.Art.cast.sprites.has(l, 'face'));
  const fl = ['npc_hanna', 'npc_rita', 'npc_gord'].find(rigFace) || Object.keys(R.DB.looks).find(rigFace) || 'selma';
  out.faceLook = fl;
  const fs = R.Hd.now('hd:face:' + fl);
  const hs = fs.frames.map((f) => { const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; });
  out.faceDistinct = new Set(hs).size;
  // 同じキーで同じ画素
  const hashSheet = (sh) => { let h = 2166136261; for (const f of sh.frames) { const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data; for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619); } return h >>> 0; };
  const k = 'hd:btl:viola:staff'; const h1 = hashSheet(R.Hd.now(k)); R.Hd.forget(k); out.same = h1 === hashSheet(R.Hd.now(k));
  // 出撃中の 4 人のキー
  const G0 = R.Game;
  R.Game = { party: ['hero', 'selma', 'sylvain', 'viola'], chars: { hero: { look: 'hero_m_warrior', equip: { weapon1: null } }, selma: { look: 'selma', equip: { weapon1: COMP.selma.startEquip.weapon1 } }, sylvain: { look: 'sylvain', equip: { weapon1: COMP.sylvain.startEquip.weapon1 } }, viola: { look: 'viola', equip: { weapon1: COMP.viola.startEquip.weapon1 } } } };
  out.keys = cast.battleKeys();
  out.pinned = cast.repin();
  out.pins = R.Hd.pinned ? out.keys.every((kk) => R.Hd.pinned(kk)) : null;
  R.Game = G0;
  cast.repin();
  return out;
}

// 後頭部の肌（目印の焼き）: 骨組みの look ごとに待機と横・後ろのコマ
function pageHair() {
  const R = window.RPG, RZ = R.Hd.RZ, rig = R.Art.rig;
  const MARK = RZ.mat({ keys: ['#00ff00', '#00ff00'], n: 2, flat: true, outline: '#00ff00' });
  const res = {};
  for (const l of Object.keys(R.DB.looks)) {
    if (R.DB.looks[l].animal) continue;
    const L = Object.assign({}, rig.fromLook(l), { skin: MARK });
    let worst = 0;
    // 戦闘（右向きで焼く＝後ろは左）: 待機・構え・攻撃
    for (const pn of ['idle', 'ready', 'slash', 'cast', 'victory']) {
      const B = new RZ.Builder(); const pt = rig.draw(B, L, rig.pose(pn));
      const r = RZ.render(B, { scale: 1.2, tones: 5 });
      const c = r.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const hx = r.ox + pt.head[0] * 1.2, hy = r.oy + pt.head[1] * 1.2, hr = pt.headR * 1.2;
      let n = 0, s = 0;
      for (let y = Math.floor(hy - hr); y < hy + hr; y++) for (let x = Math.floor(hx - hr); x < hx - hr * 0.1; x++) {
        if ((x - hx) ** 2 + (y - hy) ** 2 > hr * hr || x < 0 || y < 0 || x >= c.width || y >= c.height) continue;
        const q = (y * c.width + x) * 4; if (d[q + 3] < 128) continue; n++;
        if (d[q + 1] > 150 && d[q] < 90 && d[q + 2] < 90) s++;
      }
      if (n > 8) worst = Math.max(worst, s / n);
    }
    // フィールドの後ろ向き（頭の全部が後頭部）
    const B2 = new RZ.Builder(); const fp = rig.field.build(B2, L, 'up', 0, {});
    const r2 = RZ.render(B2, { scale: 1.15, tones: 5 });
    const c2 = r2.canvas, d2 = c2.getContext('2d').getImageData(0, 0, c2.width, c2.height).data;
    const hx2 = r2.ox + fp.head[0] * 1.15, hy2 = r2.oy + fp.head[1] * 1.15, hr2 = 9 * 1.15;
    let n2 = 0, s2 = 0;
    for (let y = Math.floor(hy2 - hr2); y < hy2 + hr2; y++) for (let x = Math.floor(hx2 - hr2); x < hx2 + hr2; x++) {
      if ((x - hx2) ** 2 + (y - hy2) ** 2 > hr2 * hr2 || x < 0 || y < 0 || x >= c2.width || y >= c2.height) continue;
      const q = (y * c2.width + x) * 4; if (d2[q + 3] < 128) continue; n2++;
      if (d2[q + 1] > 150 && d2[q] < 90 && d2[q + 2] < 90) s2++;
    }
    res[l] = { btl: +worst.toFixed(3), fieldBack: n2 ? +(s2 / n2).toFixed(3) : 0, elf: R.DB.looks[l].hair.ears === 'elf' };
  }
  return res;
}

// シートの形の原画を差し込んで武器の付け替えを確かめる（look は hero_f_warrior を借りる。差し込むのはこのページの中だけ）
function pageAttach(media) {
  const R = window.RPG;
  const T = R.Media.table().sprites;
  for (const [kind, v] of Object.entries(media)) T['hero_f_warrior:' + kind] = v;
  return R.Media.preload('sprites', Object.keys(media).map((k) => 'hero_f_warrior:' + k)).then((n) => {
    for (const kk of R.Hd.keys('hd:btl:hero_f_warrior:').concat(['hd:field:hero_f_warrior', 'hd:face:hero_f_warrior'])) R.Hd.forget(kk);
    const out = { loaded: n };
    const px = (f) => { const d = f.c.getContext('2d').getImageData(0, 0, f.c.width, f.c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
    const sw = R.Hd.now('hd:btl:hero_f_warrior:sword');
    for (const w of R.Art.cast.WTYPES) {
      const sh = R.Hd.now('hd:btl:hero_f_warrior:' + w);
      out[w] = { source: sh.meta.source, weaponDrawn: sh.meta.weaponDrawn, mismatch: sh.meta.weaponMismatch, ok: R.Contract.check('sheet', sh).ok,
        differs: px(sh.frames[sh.poses.slash[1]]) !== px(sw.frames[sw.poses.slash[1]]), frames: sh.frames.length };
    }
    const fd = R.Hd.now('hd:field:hero_f_warrior', { scale: 1.15 });
    out.field = { source: fd.meta.source, run: !!fd.poses.run_s, actFromSheet: fd.poses.nod && fd.poses.nod.length === 1 };
    const fc = R.Hd.now('hd:face:hero_f_warrior');
    out.face = { source: fc.meta.source, exprs: Object.keys(fc.poses).length };
    // 描いて保存（目で見る）
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 560; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#2a2c3c'; g.fillRect(0, 0, cv.width, cv.height);
    R.Art.cast.WTYPES.forEach((w, r) => {
      const sh = R.Hd.now('hd:btl:hero_f_warrior:' + w);
      ['idle', 'slash', 'thrust', 'smash', 'shoot', 'cast', 'victory'].forEach((p, j) => {
        const list = sh.poses[p]; const f = sh.frames[list[Math.floor(list.length / 2)]];
        g.save(); g.translate(90 + j * 190, 100 + r * 108); g.scale(1, 1); g.drawImage(f.c, -f.ox, -f.oy); g.restore();
      });
      g.fillStyle = '#c8c4d8'; g.font = '12px sans-serif'; g.fillText(w, 4, 100 + r * 108 - 60);
    });
    out.png = cv.toDataURL();
    return out;
  });
}

async function run() {
  const S = await Bw.start();
  try {
    const P = await Bw.open(S, 'dev.html');
    await Bw.waitFor(P.page, 'window.RPG && RPG.Engine.time > 200', 20000);
    const t0 = Date.now();
    const res = await P.page.evaluate(`(${pageCheck})()`);
    console.log(`(baked in ${Date.now() - t0} ms)`);

    section('シートの形とポーズ（§2.5.7）');
    const BTL = ['idle', 'step', 'slash', 'thrust', 'smash', 'shoot', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory', 'windup', 'evade'];
    const FLD = ['stand_s', 'stand_n', 'stand_e', 'stand_w', 'walk_s', 'walk_n', 'walk_e', 'walk_w', 'nod', 'shake', 'surprise', 'laugh', 'sad', 'point', 'kneel', 'sit', 'bow', 'raise_lantern', 'think'];
    const EX = ['neutral', 'smile', 'sad', 'angry', 'surprise'];
    const all = Object.entries(res.sheets);
    ok('例外なく焼けた', res.errs.length === 0, res.errs);
    ok('全部が K.sheet', all.every(([, s]) => s && s.ok), all.filter(([, s]) => !s || !s.ok).slice(0, 4));
    ok('純黒 0', all.every(([, s]) => s && s.black === 0), all.filter(([, s]) => s && s.black).map(([k]) => k).slice(0, 5));
    ok('戦闘: 15 ポーズ', all.filter(([k]) => k.startsWith('btl:')).every(([, s]) => BTL.every((p) => s.poses.includes(p))));
    ok('フィールド: 4 方向の立ち・歩き＋演技 11', all.filter(([k]) => k.startsWith('field:')).every(([, s]) => FLD.every((p) => s.poses.includes(p))));
    ok('顔: 表情 5 つ', all.filter(([k]) => k.startsWith('face:')).every(([, s]) => EX.every((p) => s.poses.includes(p))));
    ok('anchors.feet・head', all.every(([, s]) => s.feet && (s.head || /^face:/.test(all.find((a) => a[1] === s)[0]))));
    ok('戦闘は左向き（meta.facing）', all.filter(([k]) => k.startsWith('btl:')).every(([, s]) => s.meta.facing === 'left'));
    ok('仮の絵の人は meta.skin・headR を持つ（hd_check_hair）', all.filter(([k, s]) => !k.startsWith('face:') && s.source === 'rig' && !/ani_/.test(k)).every(([, s]) => s.meta.skin >= 0 && s.meta.headR > 0));
    ok('仮の絵ははっきり「仮」（meta.placeholder）', all.filter(([, s]) => s.source === 'rig').every(([, s]) => s.placeholder));

    section('原画（アルン = hero_m_warrior、設定資料から）');
    const a = res.sheets;
    ok('戦闘・フィールド・顔が画像から', a['btl:hero_m_warrior:sword'].source === 'sprite' && a['field:hero_m_warrior'].source === 'sprite' && a['face:hero_m_warrior'].source === 'sprite');
    ok('シートの形（bare＋weapons）: 5 系統とも武器を持ち手に付けて焼く', ['sword', 'greatsword', 'dagger', 'bow', 'staff'].every((w) => a['btl:hero_m_warrior:' + w].meta.weaponDrawn === w && !a['btl:hero_m_warrior:' + w].meta.weaponMismatch), ['sword', 'bow', 'staff'].map((w) => a['btl:hero_m_warrior:' + w].meta));
    ok('先頭のランタン: 描かれたランタンの芯の位置（原画、3 方向以上。右向きは体の奥で隠れてよい）', res.lantern.anchor && res.lantern.dirs.length >= 3, res.lantern);
    ok('先頭のランタン: 4 方向に芯の位置（仮の絵）', res.lanternRig.anchor && res.lanternRig.dirs.length === 4, res.lanternRig);
    for (const [l, hs] of Object.entries(res.scales)) ok(`${l}: 広さの設定の倍率で高さが変わる（ひろい < ふつう < ちかい）`, hs[0] < hs[1] && hs[1] < hs[2], hs);

    section('R.Portrait');
    ok('顔のある人に描く（原画・仮の顔）', ['hero_m_warrior', 'selma', 'berna'].every((l) => res.portrait[l].drew && res.portrait[l].px > 1500), res.portrait);
    ok('町の人の型は描かない（has null）', !res.portrait.npc_man_1.drew && res.portrait.npc_man_1.has === null);
    ok('仮の顔の 5 つの表情がすべて違う画素', res.faceDistinct === 5, { look: res.faceLook, distinct: res.faceDistinct });
    ok('同じキーで同じ画素', res.same);

    section('出撃中の 4 人だけ（§2.10）');
    ok('battleKeys = 4 人の今の武器', res.keys.length === 4 && res.keys[0] === 'hd:btl:hero_m_warrior:sword' && res.keys[2] === 'hd:btl:sylvain:bow' && res.keys[3] === 'hd:btl:viola:sword', res.keys);
    if (res.pins !== null) ok('R.Hd.pin されている', res.pins);

    section('後頭部の肌（目印の焼き。STYLE.hairSkinMax）');
    const hair = await P.page.evaluate(`(${pageHair})()`);
    const MAX = 0.08;
    // 森の民の長い耳（ears:'elf'）は髪から出す作り（プロトと同じ）なので、耳の分を 5% まで許す
    const allow = (l) => MAX + (hair[l].elf ? 0.05 : 0);
    const badB = Object.entries(hair).filter(([l, v]) => v.btl > allow(l)), badF = Object.entries(hair).filter(([, v]) => v.fieldBack > MAX);
    ok(`戦闘の頭の後ろ半分の肌 ≤ ${MAX * 100}%（${Object.keys(hair).length} 人）`, badB.length === 0, badB.slice(0, 8));
    ok(`フィールドの後ろ向きの頭の肌 ≤ ${MAX * 100}%`, badF.length === 0, badF.slice(0, 8));

    section('シートの形の原画で武器を付け替える（arun_mock を差し込む）');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cast_mock_'));
    let media = null;
    try {
      execFileSync('python3', ['tools/to_v2.py', 'out/arun_mock', '--look', 'hero_f_warrior', '--dst', tmp], { cwd: path.join(CHRON, 'design', 'sprite_pipe') });
      media = {};
      for (const f of fs.readdirSync(tmp).filter((f) => f.endsWith('.png'))) {
        const k = f.replace('.png', '');
        media[k] = { url: 'data:image/png;base64,' + fs.readFileSync(path.join(tmp, f)).toString('base64'), meta: JSON.parse(fs.readFileSync(path.join(tmp, k + '.json'), 'utf8')) };
      }
    } catch (e) { console.log('  (python の取り込みに失敗: ' + e.message + ')'); }
    ok('取り込みの道具（to_v2.py）がシートの形を読める', media && media.battle && media.bare && media.weapons && media.face && media.field);
    if (media) {
      const at = await P.page.evaluate(`(${pageAttach})(${JSON.stringify(media)})`);
      fs.mkdirSync(path.join(Bw.V2, 'design', 'shots', 'cast'), { recursive: true });
      fs.writeFileSync(path.join(Bw.V2, 'design', 'shots', 'cast', 'attach_mock.png'), Buffer.from(at.png.split(',')[1], 'base64'));
      delete at.png;
      ok('5 つの画像が読めた', at.loaded === 5, at.loaded);
      ok('剣は描かれたまま', at.sword.source === 'sprite' && at.sword.weaponDrawn === 'sword' && !at.sword.mismatch);
      for (const w of ['greatsword', 'dagger', 'bow', 'staff']) ok(`${w}: 武器なしの体＋${w} の画像（持ち手に付けた）`, at[w].weaponDrawn === w && !at[w].mismatch && at[w].ok && at[w].differs, at[w]);
      ok('フィールド: 走り・演技をシートから', at.field.source === 'sprite' && at.field.run && at.field.actFromSheet, at.field);
      ok('顔: 表情 5 つ', at.face.source === 'sprite' && at.face.exprs === 5, at.face);
    }
    fs.rmSync(tmp, { recursive: true, force: true });

    section('焼く時間（G1 の報告用。予算 R.Hd.BUDGET.charBakeMs = 1 人 12 コマ）');
    const perf = await P.page.evaluate(() => {
      const R = window.RPG, t = (f) => { const a = performance.now(); f(); return performance.now() - a; }, out = {};
      for (const l of ['hero_m_warrior', 'selma', 'viola', 'npc_man_2']) {
        for (const k of [`hd:btl:${l}:sword`, 'hd:field:' + l]) R.Hd.forget(k);
        const b = t(() => R.Hd.now(`hd:btl:${l}:sword`)), f = t(() => R.Hd.now('hd:field:' + l, { scale: 1.15 }));
        const nb = R.Hd.now(`hd:btl:${l}:sword`).frames.length, nf = R.Hd.now('hd:field:' + l, { scale: 1.15 }).frames.length;
        out[l] = { btlMs: +b.toFixed(1), btlFrames: nb, per12btl: +(b / nb * 12).toFixed(1), fieldMs: +f.toFixed(1), fieldFrames: nf };
      }
      out.budget = R.Hd.BUDGET.charBakeMs;
      return out;
    });
    console.log(JSON.stringify(perf, null, 1));
    ok('原画の人（アルン）は予算の中（12 コマあたり ≤ desk）', perf.hero_m_warrior.per12btl <= perf.budget.desk, perf.hero_m_warrior);
    ok('仮の絵は予算の 4 倍まで（原画に替われば消える。open に書く）', ['selma', 'viola', 'npc_man_2'].every((l) => perf[l].per12btl <= perf.budget.desk * 4), perf);

    ok('ページのエラー 0', P.errors.length === 0, P.errors);
    await P.close();
  } finally { await Bw.stop(S); }
  done('test_cast_browser');
}
run().catch((e) => { console.error(e); process.exit(1); });
