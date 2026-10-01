#!/usr/bin/env node
// 技・術の演出の見本を書き出す（dev.html の RPG.FxGallery を使う。ビルドは先に: node v2/tools/build.js）
//   node v2/tools/fx_gallery.js --out <dir> --shot t_sword_first [--at 300,700]   1 コマの PNG（見せ場の時間 ms、既定は当たる瞬間の少し後）
//   node v2/tools/fx_gallery.js --out <dir> --sheet <名前> id id …                 並べた一覧（見せ場の 1 コマずつ、5 列）
//   node v2/tools/fx_gallery.js --out <dir> --clip <名前> id id …                  mp4（30 fps、1280×720。ffmpeg に直接流す）
//   node v2/tools/fx_gallery.js --out <dir> --plan <FX_PLAN.md>                    表の考え（c）を FX_PLAN.md の「技・術ごとの表」に書き出す
//   選び方: id の代わりに @tech:sword（剣の技を段の順に）・@tier:6・@spell:single・@spell:combo・@spell:triple も書ける
//   node v2/tools/fx_gallery.js --out <dir> --parts <名前>                         画像の効果の部品（assets/fx）を全部動かした一覧を 4 枚（時間をずらして）
//   node v2/tools/fx_gallery.js --out <dir> --strip <名前> id id …                 技・術ごとに 1 行・時間の順に 6 コマ（演出の流れの見本）
//   --speed 1|2|3|5（戦闘の速さ）、--glimmer（閃きの帯つき）、--seen（2 回目の短い版）
//   --noimg（画像の効果の部品を使わない＝手続きの効果だけ。前後の比べ用）、--mons goblin_1,wolf_1,imp_1（見本の敵の絵）、--crop x,y,w,h（--strip の切り出し。1920×1080 の px）、--keep（--strip の山の 2 コマを 1920×1080 で残す）
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const B = require('./lib/browser');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const OUT = path.resolve(opt('--out', path.join(B.V2, 'design', 'shots', 'fx')));
const FFMPEG = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const FPS = 30;

function idsFrom(list, all) {
  const out = [];
  for (const a of list) {
    if (a.startsWith('@')) {
      const [k, v] = a.slice(1).split(':');
      for (const x of all) {
        if (k === 'tech' && x.tech && x.wtype === v) out.push(x.id);
        else if (k === 'tier' && x.tier === +v) out.push(x.id);
        else if (k === 'spell' && !x.tech && x.cls === v) out.push(x.id);
        else if (k === 'element' && !x.tech && x.cls === 'single' && x.el === v) out.push(x.id);
      }
    } else out.push(a);
  }
  return out;
}

async function main() {
  // 表の書き出しはブラウザ無しで（node に読み込む）
  if (has('--plan')) {
    const R = require('./lib/load')({ quiet: true });
    const Sq = R.BFX.seq;
    const all = Object.keys(Sq.table).map((id) => { const d = R.DB.techs[id] || R.DB.spells[id]; const s = Sq.get('sq:' + id); return { id, tech: !!R.DB.techs[id], wtype: d.wtype, cls: d.cls, el: d.elements && d.elements[0], tier: s.tier, dur: Math.max(s.dur, s.lead + s.hitDur), name: d.name, c: s.c, rank: d.rank || d.step || 0 }; });
    writePlan(opt('--plan'), all);
    if (!has('--sheet') && !has('--clip') && !has('--shot')) return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const S = await B.start();
  const P = await B.open(S, 'dev.html?fixture=core_stub_road');
  const p = P.page;
  await B.waitFor(p, `${B.TOP}==='field'`, 20000);
  await B.ev(p, `RPG.Settings.set('battleSpeed', ${+opt('--speed', 1)})`);
  await B.ev(p, "RPG.Settings.set('fx', 'high')");
  if (has('--parts')) {
    // 画像の効果の部品の一覧（RPG.FxGallery.parts）: 読み終わるまで待って、時間をずらして 4 枚（1920×1080）
    const name = opt('--parts');
    await p.evaluate(() => RPG.BFX.img.preload(Object.keys(RPG_MEDIA.fx || {})).then(() => RPG.FxGallery.parts(true)));
    await p.waitForTimeout(400);
    for (let i = 0; i < 4; i++) {
      const d = await p.evaluate(() => RPG.Gfx.canvas.toDataURL('image/jpeg', 0.9));
      const f = path.join(OUT, `${name}_${i}.jpg`);
      fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
      console.log(f);
      await p.waitForTimeout(190);
    }
    if (P.errors.length) console.log('page errors:', P.errors.slice(0, 5));
    await B.stop(S);
    return;
  }
  await B.ev(p, 'RPG.FxGallery.open({ demo: "normal" })');
  await B.waitFor(p, "RPG.Battle.debug() && RPG.Battle.debug().phase === 'gallery'", 30000);
  await p.waitForTimeout(1500);
  const all = await B.ev(p, `RPG.FxGallery.list().map((id) => { const d = RPG.DB.techs[id] || RPG.DB.spells[id]; const s = RPG.BFX.seq.get('sq:' + id); return { id, tech: !!RPG.DB.techs[id], wtype: d.wtype, cls: d.cls, el: d.elements && d.elements[0], tier: s.tier, lead: s.lead, dur: s.dur, name: d.name, c: s.c, rank: d.rank || d.step || 0 }; }).sort((a, b) => a.tier - b.tier || a.rank - b.rank)`);
  const info = Object.fromEntries(all.map((x) => [x.id, x]));
  // --mons a,b,c: 見本の敵の絵を描いた魔物（assets/monsters）に替える（見本の敵には絵の無い物があり、当たりの白い光が四角になる）
  if (opt('--mons')) await p.evaluate((list) => { const st = RPG.FxGallery.state(); const es = st.B.units.filter((u) => u.side === 'enemy'); es.forEach((u, i) => { u.sprite = list[i % list.length]; const a = st.actor(u.uid); if (a) { a.sprite = u.sprite; Object.assign(a, RPG.Battle._.actors.keyOf(u)); } }); }, opt('--mons').split(','));
  // 画像の効果の部品（assets/fx）: 先に全部読んでおく（--noimg なら使わない）
  if (has('--noimg')) await B.ev(p, 'RPG.BFX.img && RPG.BFX.img.set(false)');
  else await p.evaluate(() => RPG.BFX.img ? RPG.BFX.img.preload(Object.keys((window.RPG_MEDIA && RPG_MEDIA.fx) || {})).then(() => 0) : 0);
  await B.ev(p, 'RPG.Engine.pause(); RPG.FxGallery.interactive = false;');

  const seen = has('--seen');
  if (seen) await B.ev(p, "RPG.Game.vars.fx_seen = RPG.FxGallery.list().join(',')"); else await B.ev(p, "RPG.Game.vars.fx_seen = ''");
  const grab = (q) => p.evaluate((q) => RPG.Gfx.canvas.toDataURL('image/jpeg', q), q || 0.9);
  /** 1 つ流して、frames を (t, dataURL) で呼ぶ。t は流し始めからの戦闘の時計 */
  async function run(id, onFrame, every) {
    const o = has('--glimmer') ? '{ glimmer: true }' : '{}';
    const c0 = (await p.evaluate(() => RPG.FxGallery.step(1))).clock;
    await p.evaluate(`RPG.FxGallery.begin(${JSON.stringify(id)}, ${o})`);
    let t = 0, n = 0, done = false;
    for (;;) {
      const r = await p.evaluate((ms) => RPG.FxGallery.step(ms), every);
      t = r.clock - c0; n++; done = r.done;
      const stop = await onFrame(t, r.done, r);
      if (stop || (r.done && n > 3) || n > 900) break;
    }
    // 流し終わるまで進めてから静める（次の begin が空振りしないように）
    for (let i = 0; i < 300 && !done; i++) done = (await p.evaluate(() => RPG.FxGallery.step(1000 / 30))).done;
    for (let i = 0; i < 10; i++) await p.evaluate(() => RPG.FxGallery.step(1000 / 30));
  }

  if (has('--shot')) {
    const id = opt('--shot');
    const ats = (opt('--at', '') || '').split(',').filter(Boolean).map(Number);
    const x = info[id];
    const want = ats.length ? ats : [x.lead + 260 + (x.tech ? 200 : 460)];
    let wi = 0;
    await run(id, async (t) => {
      while (wi < want.length && t >= want[wi]) {
        const d = await grab(0.92);
        const f = path.join(OUT, `${id}_${want[wi]}.jpg`);
        fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64'));
        console.log(f);
        wi++;
      }
      return wi >= want.length;
    }, 1000 / 60);
  }

  if (has('--perf')) {
    // 1 コマの描画の時間（R.Engine.render、ソフトの描画）: 静かな時と、演出の間
    const i0 = args.indexOf('--perf') + 1;
    const ids = idsFrom(args.slice(i0).filter((a) => !a.startsWith('--')), all).filter((id) => info[id]);
    const time = () => p.evaluate(() => { const g = RPG.Gfx.ctx; g.getImageData(0, 0, 1, 1); const t0 = performance.now(); RPG.Engine.render(); g.getImageData(0, 0, 1, 1); return performance.now() - t0; });   // getImageData で描画を実際に終わらせて測る
    const base = [];
    for (let i = 0; i < 40; i++) { await p.evaluate(() => RPG.FxGallery.step(1000 / 30)); base.push(await time()); }
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    console.log(`idle: median ${med(base).toFixed(1)} ms  max ${Math.max(...base).toFixed(1)} ms`);
    for (const id of ids) {
      const ms = [];
      await run(id, async (t, done, r) => { if (r.seqT >= 0 || r.hitT >= 0) ms.push(await time()); return false; }, 1000 / 30);
      console.log(`${id} (tier ${info[id].tier}): median ${med(ms).toFixed(1)} ms  max ${Math.max(...ms).toFixed(1)} ms  frames ${ms.length}`);
    }
  }

  if (has('--strip')) {
    // 技・術ごとに 1 行: 溜めの終わりから余韻まで 6 コマ（1920×1080 の画面を 480×270 にして並べる）
    const name = opt('--strip');
    const i0 = args.indexOf('--strip') + 2;
    const ids = idsFrom(args.slice(i0).filter((a) => !a.startsWith('--')), all).filter((id) => info[id]);
    const cols = 6, cw = 480, ch = 270;
    const file = path.join(OUT, name + '.jpg');
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-', '-vf', `${opt('--crop') ? 'crop=' + opt('--crop').split(',').slice(2).join(':') + ':' + opt('--crop').split(',').slice(0, 2).join(':') + ',' : ''}scale=${cw}:${ch},tile=${cols}x${ids.length}:padding=3:color=0x101018`, '-frames:v', '1', '-q:v', '3', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const write = (d) => new Promise((res) => { if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) ff.stdin.once('drain', res); else res(); });
    for (const id of ids) {
      const x = info[id];
      // 段 1–3: 最初の当たりからの時間（当たりの効果が主役）。段 4 以上: 画面の演出の溜めの終わりから
      const byHit = x.tier <= 3;
      const a0 = byHit ? 0 : Math.max(0, x.lead - 300), a1 = byHit ? 420 : x.lead + Math.max(360, Math.min(800, x.dur - x.lead));
      const want = Array.from({ length: cols }, (_, i) => Math.round(a0 + (a1 - a0) * i / (cols - 1)));
      let wi = 0, last = null;
      console.log(`${id}  tier ${x.tier}  ${x.name}  ${byHit ? 'hit+' : ''}${want.join(',')}`);
      await run(id, async (t, done, r) => {
        const tt = byHit ? r.hitT : r.seqT;
        while (wi < want.length && tt >= want[wi]) {
          last = await grab(0.88); await write(last);
          // --keep: 山の 2 コマ（3・4 枚目）は 1920×1080 のまま残す
          if (has('--keep') && (wi === 2 || wi === 3)) fs.writeFileSync(path.join(OUT, `${name}_${id}_${wi}.jpg`), Buffer.from(last.split(',')[1], 'base64'));
          wi++;
        }
        return wi >= want.length;
      }, 1000 / 60);
      while (wi < want.length) { await write(last || await grab(0.88)); wi++; }
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    console.log('->', file);
  }

  if (has('--sheet') || has('--clip')) {
    const name = opt(has('--sheet') ? '--sheet' : '--clip');
    const i0 = args.indexOf(has('--sheet') ? '--sheet' : '--clip') + 2;
    const ids = idsFrom(args.slice(i0).filter((a) => !a.startsWith('--') && !/^\d+$/.test(a)), all).filter((id) => info[id]);
    const clip = has('--clip');
    const cols = 5, cw = 384, ch = 216;
    const file = path.join(OUT, name + (clip ? '.mp4' : '.jpg'));
    const ff = clip
      ? spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=1280:720', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'veryfast', file], { stdio: ['pipe', 'inherit', 'inherit'] })
      : spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', '-', '-vf', `scale=${cw}:${ch},tile=${cols}x${Math.ceil(ids.length / cols)}:padding=4:color=0x101018`, '-frames:v', '1', '-q:v', '3', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const write = (d) => new Promise((res) => { if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) ff.stdin.once('drain', res); else res(); });
    for (const id of ids) {
      const x = info[id];
      console.log(`${id}  tier ${x.tier}  ${x.name}`);
      if (clip) {
        let last = null;
        await run(id, async (t, done) => { last = await grab(0.85); await write(last); return done && t > x.dur + 300; }, 1000 / FPS);
        for (let i = 0; i < 6; i++) await write(last);   // 区切りの間
      } else {
        // 見せ場: 段 1–2 は最初の当たりの少し後、段 3 以上は当たる瞬間の少し後（主役の見える所）
        let got = false;
        await run(id, async (t, done, r) => {
          const ready = x.tier <= 2 ? r.hitT >= 70 : r.seqT >= x.lead + (x.tier >= 5 ? 160 : 90);
          if (!got && (ready || done)) { await write(await grab(0.9)); got = true; }
          return got;
        }, 1000 / 60);
      }
    }
    ff.stdin.end();
    await new Promise((res) => ff.on('close', res));
    console.log('->', file);
  }

  if (P.errors.length) console.log('page errors:', P.errors.slice(0, 5));
  await B.stop(S);
}
function writePlan(f, all) {
  {
    const src = fs.readFileSync(f, 'utf8');
    const head = src.split('## 技・術ごとの表')[0];
    const W = { sword: '剣', greatsword: '大剣', dagger: '短剣', bow: '弓', staff: '杖' };
    const rows = [];
    const group = (title, list) => {
      rows.push(`\n### ${title}\n`, '| id | 名前 | 段 | 長さ (ms) | 演出 |', '|---|---|---|---|---|');
      for (const x of list) rows.push(`| ${x.id} | ${x.name} | ${x.tier} | ${Math.round(x.dur)} | ${x.c.replace(/\|/g, '／')} |`);
    };
    for (const w of Object.keys(W)) group(`${W[w]}の技`, all.filter((x) => x.tech && x.wtype === w).sort((a, b) => a.rank - b.rank || a.tier - b.tier));
    group('術（単属性）', all.filter((x) => !x.tech && x.cls === 'single').sort((a, b) => (a.el < b.el ? -1 : a.el > b.el ? 1 : a.rank - b.rank)));
    group('術（2 属性の合成）', all.filter((x) => !x.tech && /combo/.test(x.cls)));
    group('術（3 属性の合成）', all.filter((x) => !x.tech && x.cls === 'triple'));
    fs.writeFileSync(f, head + '## 技・術ごとの表\n（tools/fx_gallery.js --plan が src/art/fx/fx_seq_table.js の c から書き出した物）\n' + rows.join('\n') + '\n');
    console.log('plan ->', f, all.length, 'rows');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
