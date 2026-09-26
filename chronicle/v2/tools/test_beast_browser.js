// BEAST のブラウザのテスト: 全部の絵を焼いて調べる（V2_PLAN §4.4 の BEAST の行・ART_REWORK §7.5 の hd_check の項目）
//   node v2/tools/build.js && node v2/tools/test_beast_browser.js
// K.sheet・K.bbgSheet の形／ポーズ／anchors／右向き／純黒 0／大きさの段／段 2 が色だけの違いでない／金色／同じキーで同じ画素／
// 戦闘背景（16:9 と縦持ち）／焼く時間（G1 の報告用。予算は R.Hd.BUDGET と §2.10）
'use strict';
const Bw = require('./lib/browser');
const { ok, section, done } = require('./lib/testkit');

function pageCheck() {
  const R = window.RPG, BZ = R.Beast, C = R.Contract;
  const out = { mons: {}, bbg: {}, errors: [] };
  const lum = (d, i) => (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
  function scan(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let black = 0, opaque = 0, hueSum = 0, hueN = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      opaque++;
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 0) black++;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 0.25 && mx > 0.3) {
        let h = mx === r ? (g - b) / (mx - mn) : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
        h = (h * 60 + 360) % 360; hueSum += h; hueN++;
      }
    }
    return { black, opaque, hue: hueN ? hueSum / hueN : null };
  }
  function mask(f, n) {
    // 外形を n×n に正規化（大きさを除いた形の比較用）
    const c = f.c, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3]) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const m = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const sx = Math.floor(x0 + (i + 0.5) / n * (x1 - x0 + 1)), sy = Math.floor(y0 + (j + 0.5) / n * (y1 - y0 + 1));
      m[j * n + i] = d[(sy * c.width + sx) * 4 + 3] ? 1 : 0;
    }
    return m;
  }
  function hash(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return (h >>> 0).toString(16) + ':' + c.width + 'x' + c.height; }

  const keys = BZ.keyList().filter((k) => /^hd:(mon|boss):/.test(k));
  for (const key of keys) {
    try {
      const sh = R.Hd.now(key, {}), gd = R.Hd.now(key, { golden: true });
      if (!sh) { out.mons[key] = { missing: true }; continue; }
      const chk = C.check('sheet', sh);
      const sc = sh.frames.map((f) => scan(f.c)), gs = gd ? gd.frames.map((f) => scan(f.c)) : [];
      const idle = (sh.poses.idle || []).map((i) => sh.frames[i]);
      const right = idle.every((f) => { const a = Object.assign({}, sh.anchors, f.anchors || {}); return a.head && a.center && a.head.x > a.center.x; });
      out.mons[key] = {
        ok: chk.ok, errors: chk.errors, poses: Object.fromEntries(Object.entries(sh.poses).map(([k, v]) => [k, v.length])),
        anchors: Object.keys(sh.anchors), right, black: sc.reduce((s, v) => s + v.black, 0) + gs.reduce((s, v) => s + v.black, 0),
        h: sh.h, w: sh.w, visH: sh.meta.visH, tier: sh.meta.tier, fly: !!sh.meta.fly, band: BZ.tierPx(sh.meta.tier), bakeMs: sh.meta.bakeMs, bakeMsGold: gd && gd.meta.bakeMs,
        frames: sh.frames.length, hue: sc[0].hue, goldHue: gs[0] && gs[0].hue, goldDiff: gd ? hash(gd.frames[0].c) !== hash(sh.frames[0].c) : false,
        stage: sh.meta.stage, base: sh.meta.base, mask: Array.from(mask(sh.frames[0], 24)),
      };
    } catch (e) { out.errors.push(key + ': ' + e.message); }
  }
  // 同じキーで同じ画素（焼き直して比べる）
  out.det = {};
  for (const id of ['wolf_1', 'jelly_2', 'fairy_2']) { const a = BZ.bakeMon(id, {}), b = BZ.bakeMon(id, {}); out.det[id] = a.frames.every((f, i) => hash(f.c) === hash(b.frames[i].c)); }
  { const a = BZ.bakeBoss('boss_moth', {}), b = BZ.bakeBoss('boss_moth', {}); out.det.boss_moth = a.frames.every((f, i) => hash(f.c) === hash(b.frames[i].c)); }
  // 戦闘背景（16:9・縦持ち）
  for (const id of BZ.BBG_IDS || []) {
    for (const [w, h] of [[960, 540], [540, 1169]]) {
      try {
        const sh = R.Hd.now('hd:bbg:' + id, { w, h });
        const chk = C.check('bbgSheet', sh);
        const m = sh.meta;
        const layers = ['back', 'ground', 'front', 'post'].filter((p) => sh.poses[p]);
        const sized = sh.frames.every((f) => f.c.width === w && f.c.height === h);
        const bl = sh.frames.reduce((s, f) => s + scan(f.c).black, 0);
        out.bbg[id + '@' + w + 'x' + h] = { ok: chk.ok, errors: chk.errors, mood: m.mood, moodOk: C.MOODS.includes(m.mood), layers, sized, black: bl,
          lanternIn: m.lantern.x > 0 && m.lantern.x < w && m.lantern.y > m.horizon && m.lantern.y < h, party: m.party.length, foesBox: m.foes, bakeMs: m.bakeMs };
      } catch (e) { out.errors.push(id + ': ' + e.message); }
    }
  }
  out.stats = R.Hd.stats ? R.Hd.stats() : null;
  return out;
}

(async () => {
  const S = await Bw.start();
  let P;
  try {
    P = await Bw.open(S, 'dev.html');
    const r = await P.page.evaluate(pageCheck);
    const mine = P.errors.filter((e) => /art\/(mons|boss|bbg)|hd:(mon|boss|bbg)|Beast/.test(e));
    const others = P.errors.filter((e) => !mine.includes(e));
    if (others.length) console.log('（ほかの担当のエラー、参考）\n  ' + others.map((e) => e.split('\n')[0]).join('\n  '));

    section('魔物・ボスの Sheet（K.sheet・ポーズ・anchors・右向き・純黒 0）');
    ok('焼くときの例外なし', r.errors.length === 0, r.errors);
    ok('BEAST のファイルのコンソールのエラー 0', mine.length === 0, mine);
    for (const [key, m] of Object.entries(r.mons)) {
      if (m.missing) { ok(key + ' が焼ける', false); continue; }
      const boss = /^hd:boss:/.test(key) && !/b_root|boss_root/.test(key);
      const needPoses = boss ? ['idle', 'attack', 'hit', 'tele'] : ['idle', 'attack', 'hit'];
      ok(`${key}: K.sheet`, m.ok, m.errors);
      ok(`${key}: ポーズ ${JSON.stringify(m.poses)}（待機 2・攻撃 1・被弾 1${boss ? '・予告 tele' : ''}）`, needPoses.every((p) => m.poses[p]) && m.poses.idle >= 2);
      ok(`${key}: anchors feet・head・center・fx`, ['feet', 'head', 'center', 'fx'].every((a) => m.anchors.includes(a)), m.anchors);
      ok(`${key}: 右向き（head.x > center.x）`, m.right);
      ok(`${key}: 純黒の画素 0（普通と金色）`, m.black === 0, m.black);
      const v = m.fly ? m.visH : m.h;
      ok(`${key}: 大きさの段 ${m.tier} ${m.band[0]}〜${m.band[1]} px に ${v} px${m.fly ? '（飛ぶ: 見た目の高さ）' : ''}`, v >= m.band[0] - 2 && v <= m.band[1] + 2);
      ok(`${key}: 金色（opts.golden）は別の画素で金の色相（${m.goldHue && m.goldHue.toFixed(0)}°）`, m.goldDiff && m.goldHue != null && m.goldHue > 22 && m.goldHue < 62);
    }
    section('段 2 は段 1 と色だけの違いでない（大きさ・形）');
    for (const base of ['jelly', 'rat', 'seabird', 'crab', 'bat', 'bee', 'mushroom', 'plant', 'fairy', 'wolf', 'treant']) {
      const a = r.mons['hd:mon:' + base + '_1'], b = r.mons['hd:mon:' + base + '_2'];
      if (!a || !b || a.missing || b.missing) { ok(base + ' の段 1・2', false); continue; }
      let inter = 0, uni = 0;
      for (let i = 0; i < a.mask.length; i++) { inter += a.mask[i] & b.mask[i]; uni += a.mask[i] | b.mask[i]; }
      const iou = inter / uni, ha = a.fly ? a.visH : a.h, hb = b.fly ? b.visH : b.h;
      ok(`${base}: 段 2 が大きい（${ha} → ${hb} px）`, hb > ha);
      ok(`${base}: 形が違う（外形の重なり ${(iou * 100).toFixed(1)}% < 97%）`, iou < 0.97);
    }
    section('同じキーで同じ画素');
    for (const [id, same] of Object.entries(r.det)) ok(`${id}: 2 回焼いて同じ`, same);
    section('戦闘背景（K.bbgSheet・16:9 と縦持ち）');
    for (const [id, b] of Object.entries(r.bbg)) {
      ok(`${id}: K.bbgSheet`, b.ok, b.errors);
      ok(`${id}: mood ${b.mood} は MOODS の中`, b.moodOk);
      ok(`${id}: 層 back・ground・front・post（${b.layers.join(' ')}）`, b.layers.length === 4);
      ok(`${id}: 層の大きさ = opts {w, h}`, b.sized);
      ok(`${id}: 純黒 0`, b.black === 0, b.black);
      ok(`${id}: ランタンが画面の中・地平より下`, b.lanternIn);
      ok(`${id}: 味方 4 人と敵の置き場所`, b.party === 4 && b.foesBox && b.foesBox.x1 > b.foesBox.x0);
    }
    section('焼く時間（G1 の報告。予算の目安: 魔物 1 コマ 5〜15 ms・ボス 1 コマ 30〜80 ms（ART_REWORK §1.4）、この計測は並列の作業と同じ機械）');
    const rows = Object.entries(r.mons).map(([k, m]) => [k, m.bakeMs, m.frames, m.w + 'x' + (m.fly ? m.visH : m.h)]);
    for (const [k, ms, n, sz] of rows) console.log(`  ${k.padEnd(26)} ${String(ms).padStart(7)} ms / ${n} コマ = ${(ms / n).toFixed(1).padStart(6)} ms/コマ  ${sz}`);
    for (const [k, b] of Object.entries(r.bbg)) console.log(`  hd:bbg:${k.padEnd(20)} ${String(b.bakeMs).padStart(7)} ms`);
    if (r.stats) console.log('  R.Hd.stats().byKind', JSON.stringify(r.stats.byKind));
  } finally { if (P) await P.close(); await Bw.stop(S); }
  done('test_beast_browser');
})().catch((e) => { console.error(e); process.exit(1); });
