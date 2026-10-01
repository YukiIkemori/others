#!/usr/bin/env node
// QA: 物の置き場所の見た目の検査（node だけ。ブラウザは使わない）。
// 持ち主の報告（2026-10-01）「カルデラの武器屋の飾りが壁に埋まってる」「武器屋だけじゃないから、他も全部みてみて」の再発を止める。
//
//   node v2/tools/qa/check_props.js [--map id,…] [--json out.json] [--all-flags]
//
// 物の絵の四角（assets/env/*/props/<id>.json の cell・feet と、@32 の画像の不透明な画素の箱）を、
// チャンクが描くのと同じ点（T._objFeet: マスの中ほど・足もと 0.84）に置いて、マップのマス（凡例の solid・rise・water）と比べる。
// 失敗にする置き方:
//  1 床の物の足もとが歩けないマス（壁・岩・水）の上 … 床に置く物・宝箱・人・看板・かがり火・灯籠・スイッチ
//     （水に浮く物・木・岩など、歩けないマスに立つのが本来の物は除く: ON_SOLID_OK・ON_WATER_OK）
//  2 床の物の絵が横の壁（上から見た壁の頭・柱。立ち上がりの面でない壁のマス）に食い込む（4 px より多く）
//     奥の壁の面（物より上の行の立ち上がり）に掛かるのは手前に立つ物なので良い
//  3 壁に掛ける物（wall_*）: 掛けたマスが見えている壁の面（下が床の壁、rise の内）でない・絵が面からはみ出す（床へ垂れる・横の壁の頭に掛かる）
//  4 人・宝箱が当たりのある物・建物の敷地に重なる
//  5 同じマスに物が二つ（2 マス幅の物の続きを除く）
//  6 出口の印（wayfind）: 印の向きの先がマップの外か歩けない所で、反対の側が歩ける。行き先から戻る出口が反対の向き
//     （東の端から出たら、行き先では西の端に着く）。下絵の扉（doors32）と戸口・階段・扉の四角が同じマス
//  7 町の吊り看板（戸口の真上）: 戸口が建物の敷地の下の行にあり、看板の吊る壁（戸口の上のマス）が建物の敷地の中
// 下絵（map.art.painted）に描き込んだ物は絵が無いので 2・3・5 を見ない（当たりの 1・4 は見る）。
// 例外（受け入れた物）は EXCEPT（マップ → [規則:物の id@x,y, 理由]）。他の担当の持ち場（カルデラ・砂漠）は OWNED で、数えるが失敗にしない。
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ok, section, done } = require('../lib/testkit');

const V2 = path.resolve(__dirname, '..', '..');
const ENV = path.join(V2, 'assets', 'env');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ONLY = arg('--map', null);
const JSON_OUT = arg('--json', null);

const R = require('../lib/load')({ quiet: true });
R.State.newGame({ hero: { type: 'fighter', sex: 'm', name: 'テスト' }, seed: 1 });
const MU = R.MapUtil, F = R.Field;

// ---------------------------------------------------------------- 他の担当の持ち場（数えるが失敗にしない。報告で渡す）
const OWNED = [
  [/^caldera/, 'カルデラの絵の描き直しの担当'],
];
const ownedBy = (id) => {
  for (const [re, who] of OWNED) if (re.test(id)) return who;
  return null;
};
// 受け入れた例外: map → { 'rule:id@x,y': 理由 }
const EXCEPT = {};

// ---------------------------------------------------------------- PNG（不透明な画素の箱だけ。8 bit・インタレース無し）
function pngBox(file, thr) {
  const b = fs.readFileSync(file);
  let p = 8, W = 0, H = 0, ct = 0, bd = 8, pal = null, trns = null;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = d.readUInt32BE(0); H = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) return null; }
    else if (type === 'PLTE') pal = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) return null;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * ch;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < W; x++) {
      let al = 255;
      if (ct === 6) al = cur[x * 4 + 3]; else if (ct === 4) al = cur[x * 2 + 1];
      else if (ct === 3) al = trns && cur[x] < trns.length ? trns[cur[x]] : 255;
      if (al > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    cur.copy(prev);
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

// ---------------------------------------------------------------- 物の画像の索引（env.js の build と同じ: <id>・<id>_v<n>・<id>__<set>）
const PROP = {};   // id → {cell, feet, frames, box: [x0,y0,x1,y1]（コマ 0 の中、不透明 > 128）}
for (const th of fs.readdirSync(ENV).sort()) {
  const dir = path.join(ENV, th, 'props');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.json$/.test(f)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    const id = f.slice(0, -5), png = path.join(dir, id + '@32.png');
    if (!fs.existsSync(png)) continue;
    const names = j.frames || ['default'];
    const cell = (j.cell && j.cell['32']) || null, feet = (j.feet && j.feet['32']) || null;
    let box = null;
    try { box = pngBox(png, 128); } catch (e) { box = null; }
    if (!cell) continue;
    // コマ 0 の範囲に切る
    if (box) box = [Math.max(0, box[0]), box[1], Math.min(cell[0], box[2]), box[3]];
    PROP[id] = { th, cell, feet: feet || [cell[0] / 2, cell[1] - 1], frames: names, box };
  }
}
const VAR = {};
for (const id of Object.keys(PROP)) { const mv = /^(.*)_v(\d+)$/.exec(id), base = mv ? mv[1] : id; (VAR[base] = VAR[base] || [])[mv ? +mv[2] : 0] = id; }
for (const k of Object.keys(VAR)) VAR[k] = VAR[k].filter(Boolean);
const PROP_SET = { harbor: 'harbor', hill_village: 'village', treetop: 'forest', moss_village: 'forest', forest_dungeon: 'wood', tree_inside: 'wood', cave: 'cave', lighthouse: 'lighthouse', desert: 'desert', desert_town: 'desert' };
const T = R.Terrain || {};
function setOf(m) { return (T._propSetOf && T._propSetOf(m)) || m.propSet || PROP_SET[m.theme] || null; }
/** 物の絵（描く id と 32 の箱） */
function spriteOf(m, key, v) {
  const set = setOf(m), base = m.propSetBase;
  let id = null;
  if (set && PROP[key + '__' + set]) id = key + '__' + set;
  else if (base && PROP[key + '__' + base]) id = key + '__' + base;
  else { const l = VAR[key]; if (l && l.length) id = l[(((v | 0) % l.length) + l.length) % l.length]; }
  return id ? Object.assign({ id }, PROP[id]) : null;
}

// ---------------------------------------------------------------- マス
// 壁に掛ける物（wall_*）と、壁のマスに据える物（腕木の灯り hook_lamp・壁の暖炉 fireplace は壁のマスに置けば壁の面に付く）
const TOL = +(arg('--tol', 2));   // 壁に食い込む px（32 の論理 px）の許し
const WALL_ITEM = /^wall_/;
const WALL_MOUNT = /^(hook_lamp|fireplace)$/;
/** 絵の無い物（光だけの物: window_glow・ember_glow…。コードの絵も画像も無い）*/
const invisible = (m, id) => { const D = R.Terrain && R.Terrain._PROP_DRAW && R.Terrain._PROP_DRAW[id]; return !!(D && D.envOnly && !spriteOf(m, id, 0)); };
// 歩けないマスに立つのが本来の物（木・岩・柵・水の物・崖の飾り…）
const ON_SOLID_OK = /^(wisp_lamp|tree|pine|tree_|bush|roots|rock|snow_rock|lava_rock|volcanic_rocks|snow_fir|desert_palm|coco_palm|palm_|swamp_tree|willow|mangrove_roots|fence|snow_fence|cactus|thorn_bush|charred_|ash_bush|stump|log|log_moss|rotten_stump|reeds|reeds_tall|lily_pads|fern|dec_|ore_|crystal|ice_crystal|obelisk|broken_pillar|coral|stilt_posts|rowboat|mud_boat|buoys|net_frame|driftwood|anchor|ship|rope_bridge|leaves_over|bell_frame|timber_frame|steam_vent|sulphur|hot_spring|lava_glow|obsidian_shards|snow_bank|ice_hole|sand_mound|bones|grave_moss|pale_mushrooms|mushroom_glow|songstone|topiary|blue_flowers|beacon|firefly|tent|hay|lift_cage|rail|scaffold|stove_pipe|phoenix_statue|scholar_statue|telescope|iron_gate|lamp_pillar|hook_lamp|tide_|shells|white_pot)/;
const SOFTISH = /^(firefly|footprint|lava_glow|leaves_over|rope_bridge)$/;
function cellAt(m, x, y) { return MU.cell(m, x, y); }
function isWater(c) { return !!(c && (c.water || c.deep || /water|sea|lava|glow_sea|shallow/.test(c.mat || '')) && c.walk === false || (c && c.water && c.solid)); }
function blocked(c) { return !c || c.walk === false || (c.solid && !c.secret); }
function wallish(c) { return !!(c && c.solid && !c.secret && !c.tall && !c.water && !c.deep && !/water|sea|lava/.test(c.mat || '')); }
/** (x, y) が見えている壁の面（下の rise マスの内に床がある）→ {base: 床の行, top: 面の上の行} | null */
function faceAt(m, x, y) {
  const c = cellAt(m, x, y);
  if (!wallish(c)) return null;
  // 下へ続く壁を数え、その下が床なら、床から rise マス上までが面
  let yy = y;
  while (wallish(cellAt(m, x, yy + 1)) && yy - y < 6) yy++;
  const below = cellAt(m, x, yy + 1);
  if (!below || blocked(below)) return null;
  const rise = (cellAt(m, x, yy) || {}).rise || 1;
  if (yy + 1 - y > rise) return null;   // 面より上の壁の頭
  return { base: yy + 1, top: yy + 1 - rise };
}

// ---------------------------------------------------------------- 検査
const flags = [];
const counts = { maps: 0, props: 0, wall: 0, npcs: 0, chests: 0, exits: 0 };
function flag(m, rule, what, o, info) {
  const key = rule + ':' + (o ? (o.id || o.type) + '@' + o.x + ',' + o.y : what);
  const exc = EXCEPT[m.id] && EXCEPT[m.id][key];
  const own = ownedBy(m.id, m);
  flags.push({ map: m.id, kind: m.kind, rule, what, key, obj: o ? { type: o.type, id: o.id, x: o.x, y: o.y } : null, info: info || null, except: exc || null, owned: own });
}
const painted = (m, o) => {
  const a = m.art && m.art.painted;
  if (!a || !a.length || !(m.art && m.art.image)) return false;
  return a.includes(o.id) || a.includes(o.id + '@' + o.x + ',' + o.y);
};
const condTrue = (c) => { if (c == null) return true; try { return !!R.State.check(c); } catch (e) { return false; } };

/** 描く絵の四角（32 の論理 px、不透明な画素）→ [x0,y0,x1,y1] | null */
function rectOf(m, o) {
  const key = o.type === 'prop' ? o.id : o.type === 'sign' ? 'signboard' : o.type === 'chest' ? 'chest' : /^(brazier|waylamp|switch)$/.test(o.type) ? o.type : null;
  if (!key) return null;
  const sp = spriteOf(m, key, o.variant || 0);
  if (!sp || !sp.box) return null;
  const fx = (o.x + 0.5) * 32, fy = (o.y + 0.84) * 32 - (o.lift || 0);
  const x0 = fx - sp.feet[0], y0 = fy - sp.feet[1];
  const flip = !!o.flip;
  const bx0 = flip ? sp.cell[0] - sp.box[2] : sp.box[0], bx1 = flip ? sp.cell[0] - sp.box[0] : sp.box[2];
  return { r: [x0 + bx0, y0 + sp.box[1], x0 + bx1, y0 + sp.box[3]], sp };
}
function ovl(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

function checkMap(m) {
  counts.maps++;
  const W0 = m.w, H0 = m.h;
  const objs = (m.objects || []).filter((o) => o.x != null && o.y != null && (o.cond == null || o.type === 'trail' || condTrue(o.cond) || true));
  const solidProps = new Map();   // 'x,y' → [o]
  const occ = new Map();
  for (const o of objs) {
    if (o.type === 'prop' && o.id) {
      const meta = (R.DB.props && R.DB.props[o.id]) || {};
      const w = o.w || 1;
      for (let i = 0; i < w; i++) {
        const k = (o.x + i) + ',' + o.y;
        if (meta.solid && !meta.soft && !o.soft) (solidProps.get(k) || solidProps.set(k, []).get(k)).push(o);
        if (!WALL_ITEM.test(o.id) && !SOFTISH.test(o.id)) (occ.get(k) || occ.set(k, []).get(k)).push(o);
      }
    }
  }
  const bldAt = (x, y) => objs.find((b) => b.type === 'building' && x >= b.x && y >= b.y && x < b.x + (b.w || 3) && y < b.y + (b.h || 3) && !(b.door && b.door.x === x && b.door.y === y));
  const isTown = m.kind === 'town';
  for (const o of objs) {
    const lv = o.lv || 0;
    if (o.type === 'prop' && o.id) {
      counts.props++;
      if (invisible(m, o.id)) continue;
      const pnt = painted(m, o);
      const c = cellAt(m, o.x, o.y);
      const wallItem = WALL_ITEM.test(o.id) || (WALL_MOUNT.test(o.id) && wallish(c));
      if (wallItem) {
        counts.wall++;
        const fc = faceAt(m, o.x, o.y);
        if (!fc) { flag(m, 'wall-off-face', `${o.id} が見えている壁の面に無い（${c ? (c.solid ? '壁の頭・裏の壁' : '床') : 'マップの外'}）`, o); continue; }
        if (pnt) continue;
        const rr = rectOf(m, o);
        if (!rr) continue;
        const [x0, y0, x1, y1] = rr.r;
        const faceTop = fc.top * 32, faceBot = fc.base * 32;
        const out = [];
        if (y1 > faceBot + 2) out.push(`床へ ${Math.round(y1 - faceBot)}px 垂れる`);
        if (y0 < faceTop - 4) out.push(`面の上へ ${Math.round(faceTop - y0)}px はみ出す`);
        // 横: 絵の掛かる列がどれも同じ面
        for (let cx = Math.floor(x0 / 32); cx <= Math.floor((x1 - 1) / 32); cx++) {
          if (cx === o.x) continue;
          const ov = ovl(x0, x1, cx * 32, cx * 32 + 32);
          if (ov <= 3) continue;
          const f2 = faceAt(m, cx, o.y);
          if (!f2 || f2.base !== fc.base) out.push(`横のマス x ${cx} は${f2 ? '別の面' : '面でない'}（${Math.round(ov)}px）`);
        }
        if (out.length) flag(m, 'wall-overhang', `${o.id}: ${out.join('・')}`, o, { rect: rr.r.map(Math.round), sprite: rr.sp.id });
        continue;
      }
      // 1 足もと
      const barrier = objs.some((q) => q !== o && q.x === o.x && q.y === o.y && (q.type === 'examine' || q.type === 'door' || q.type === 'stairs'));   // 通せんぼ（開くまで道をふさぐ板など）
      if (!lv && !pnt && !barrier && blocked(c) && !ON_SOLID_OK.test(o.id) && !SOFTISH.test(o.id)) {
        flag(m, 'on-solid', `${o.id} の足もとが歩けないマス（${c ? c.mat : 'マップの外'}${c && c.water ? '・水' : ''}）`, o);
      }
      if (pnt || lv || SOFTISH.test(o.id)) continue;
      // 2 横の壁に食い込む
      const rr = rectOf(m, o);
      if (!rr) continue;
      const [x0, y0, x1, y1] = rr.r;
      const hits = [];
      for (let cy = Math.floor(y0 / 32); cy <= Math.floor((y1 - 1) / 32); cy++) for (let cx = Math.floor(x0 / 32); cx <= Math.floor((x1 - 1) / 32); cx++) {
        if (cx === o.x && cy === o.y) continue;
        if (o.w && cy === o.y && cx > o.x && cx < o.x + o.w) continue;
        const cc = cellAt(m, cx, cy);
        const out = cx < 0 || cy < 0 || cx >= W0 || cy >= H0;
        if (!out && !wallish(cc)) continue;
        if (out && m.kind !== 'interior') continue;
        const fc = out ? null : faceAt(m, cx, cy);
        if (fc && cy < o.y) continue;   // 奥の壁の面（物より上の行）: 手前に立つ
        // 物と同じ行の面でも、面の床（base）が物の行より上なら奥。物の行に床がある面（横の柱の下の面）は横から食い込む
        if (fc && fc.base <= o.y) continue;
        const ox = ovl(x0, x1, cx * 32, cx * 32 + 32), oy = ovl(y0, y1, cy * 32, cy * 32 + 32);
        if (ox > TOL && oy > 4) hits.push({ x: cx, y: cy, ox: Math.round(ox), oy: Math.round(oy), face: !!fc });
      }
      if (hits.length) {
        const worst = hits.reduce((a, h) => Math.max(a, h.ox), 0);
        flag(m, 'into-wall', `${o.id} の絵が壁に食い込む（最大 ${worst}px: ${hits.map((h) => h.x + ',' + h.y).join(' ')}）`, o, { rect: rr.r.map(Math.round), sprite: rr.sp.id, hits });
      }
      continue;
    }
    if (o.type === 'chest' || o.type === 'sign' || o.type === 'brazier' || o.type === 'waylamp' || o.type === 'switch') {
      if (o.type === 'chest') counts.chests++;
      const c = cellAt(m, o.x, o.y);
      if (!lv && blocked(c) && !(o.type === 'switch' && o.look === 'hole')) flag(m, 'on-solid', `${o.type} ${o.id || ''} の足もとが歩けないマス（${c ? c.mat : 'マップの外'}）`, o);
      const sp = solidProps.get(o.x + ',' + o.y);
      if (sp && sp.length) flag(m, 'stacked', `${o.type} ${o.id || ''} が物（${sp.map((q) => q.id).join(',')}）と同じマス`, o);
      const b = bldAt(o.x, o.y);
      if (b && !(m.art && m.art.image)) flag(m, 'in-building', `${o.type} ${o.id || ''} が建物 ${b.id} の敷地の中`, o);
      if (!lv && o.type !== 'switch') {
        const rr = rectOf(m, o);
        if (rr) {
          const [x0, , x1] = rr.r;
          for (const cx of [o.x - 1, o.x + 1]) {
            const cc = cellAt(m, cx, o.y), fc = faceAt(m, cx, o.y);
            const ox = ovl(x0, x1, cx * 32, cx * 32 + 32);
            if (ox > 4 && wallish(cc) && !(fc && fc.base <= o.y)) flag(m, 'into-wall', `${o.type} ${o.id || ''} の絵が横の壁 ${cx},${o.y} に ${Math.round(ox)}px 食い込む`, o, { rect: rr.r.map(Math.round) });
          }
        }
      }
    }
  }
  // 5 同じマスに二つ
  for (const [k, l] of occ) {
    if (l.length < 2) continue;
    const ids = l.map((q) => q.id);
    if (l.every((q) => painted(m, q))) continue;
    flag(m, 'stacked', `同じマス ${k} に ${ids.join(' と ')}`, l[1]);
  }
  // 4 人
  for (const n of m.npcs || []) {
    if (n.x == null) continue;
    counts.npcs++;
    const lv = n.lv || 0;
    const c = cellAt(m, n.x, n.y);
    if (!lv && blocked(c) && !n.ghost && !n.fly) flag(m, 'npc-on-solid', `人 ${n.id} の足もとが歩けないマス（${c ? c.mat : 'マップの外'}）`, { type: 'npc', id: n.id, x: n.x, y: n.y });
    const sp = solidProps.get(n.x + ',' + n.y);
    if (sp && sp.length && !lv) flag(m, 'npc-on-prop', `人 ${n.id} が物（${sp.map((q) => q.id).join(',')}）と同じマス`, { type: 'npc', id: n.id, x: n.x, y: n.y });
    const ch = objs.find((o) => (o.type === 'chest' || o.type === 'spring') && MU.footprint && (() => { const f = MU.footprint(o); return n.x >= f[0] && n.y >= f[1] && n.x < f[0] + f[2] && n.y < f[1] + f[3]; })());
    if (ch) flag(m, 'npc-on-prop', `人 ${n.id} が ${ch.type} と同じマス`, { type: 'npc', id: n.id, x: n.x, y: n.y });
    const b = bldAt(n.x, n.y);
    if (b && !lv) flag(m, 'npc-on-prop', `人 ${n.id} が建物 ${b.id} の敷地の中`, { type: 'npc', id: n.id, x: n.x, y: n.y });
  }
  // 7 町の吊り看板
  if (isTown) {
    const W = F.wayfind;
    const I = W && W.info ? W.info(m) : null;
    for (const s of (I && I.signs) || []) {
      if (!s.bld) continue;
      const b = s.bld, d = b.door;
      const inX = d.x >= b.x && d.x < b.x + (b.w || 3);
      const bottom = d.y === b.y + (b.h || 3) - 1;
      const above = d.y - 1 >= b.y && d.y - 1 < b.y + (b.h || 3);
      if (!inX || !bottom || !above) flag(m, 'sign-off', `${b.id} の戸口 ${d.x},${d.y} の看板: ${!inX ? '戸口が敷地の横の外' : !bottom ? '戸口が敷地の下の行でない（看板が壁に掛からない）' : '戸口の上が敷地の外'}`, { type: 'building', id: b.id, x: d.x, y: d.y });
    }
  }
  // 6 出口の印
  if (m.kind === 'town' || m.kind === 'dungeon' || m.kind === 'field') {
    const W = F.wayfind;
    const I = W && W.info ? W.info(m) : null;
    for (const e of (I && I.exits) || []) {
      counts.exits++;
      const v = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.dir];
      // 印の向きの先（出口の四角のすぐ外）と手前
      const cells = [];
      for (let i = 0; i < e.w; i++) for (let j = 0; j < e.h; j++) cells.push([e.x + i, e.y + j]);
      const beyond = cells.map(([x, y]) => [x + v[0], y + v[1]]).filter(([x, y]) => !cells.some((c) => c[0] === x && c[1] === y));
      const behind = cells.map(([x, y]) => [x - v[0], y - v[1]]).filter(([x, y]) => !cells.some((c) => c[0] === x && c[1] === y));
      const outOrBlocked = (x, y) => x < 0 || y < 0 || x >= W0 || y >= H0 || !F._walkable(m, x, y, null, e.lv || 0) || !!F._warpAt(m, x, y, e.lv || 0);
      const walk = (x, y) => x >= 0 && y >= 0 && x < W0 && y < H0 && F._walkable(m, x, y, null, e.lv || 0);
      const fwdOk = beyond.some(([x, y]) => outOrBlocked(x, y));
      const backOk = behind.some(([x, y]) => walk(x, y));
      if (!fwdOk || !backOk) flag(m, 'exit-dir', `出口の印 ${e.x},${e.y} (${e.w}×${e.h}) → ${e.to.map}: 矢印 ${e.dir} の${!fwdOk ? '先が歩ける（外へ向いていない）' : '手前に歩ける所が無い'}`, { type: 'exit', id: e.to.map, x: e.x, y: e.y }, { dir: e.dir });
      // 行き先で戻る出口の向き（エリア・町・ダンジョンの端の出口どうし）
      const d = R.DB.maps[e.to.map];
      if (!d || d.kind === 'world' || !e.to.spawn || !(d.spawns && d.spawns[e.to.spawn])) continue;
      const sp = d.spawns[e.to.spawn];
      const DI = W.info(d);
      let best = null, bd = 1e9;
      for (const e2 of DI.exits) {
        if (!e2.to || e2.to.map !== m.id) continue;
        const dd = Math.max(0, e2.x - sp.x, sp.x - (e2.x + e2.w - 1)) + Math.max(0, e2.y - sp.y, sp.y - (e2.y + e2.h - 1));
        if (dd < bd) { bd = dd; best = e2; }
      }
      const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
      if (best && bd <= 3 && !e.warp && !best.warp && best.dir !== OPP[e.dir]) {
        flag(m, 'exit-side', `出口 ${e.x},${e.y} は ${e.dir} へ出るのに、${d.id} の着く所（${e.to.spawn} ${sp.x},${sp.y}）の戻る出口 ${best.x},${best.y} は ${best.dir}（${OPP[e.dir]} のはず）`, { type: 'exit', id: d.id, x: e.x, y: e.y }, { dir: e.dir, back: best.dir });
      }
    }
    // 下絵の扉（doors32）と戸口・扉・階段のマス
    const under = m.art && m.art.image ? underMeta(m.art.image) : null;
    if (under && Array.isArray(under.doors32)) {
      for (const pd of under.doors32) {
        const tx = Math.floor(pd.x / 32), ty = Math.floor(pd.y / 32);
        const near = [];
        for (const o of objs) {
          if (o.type === 'building' && o.door) near.push([o.door.x, o.door.y, 1, 1, o.id]);
          if ((o.type === 'door' || o.type === 'stairs') && o.to) near.push([o.x, o.y, o.w || 1, o.h || 1, o.type]);
        }
        for (const e of m.exits || []) near.push([e.x, e.y, e.w || 1, e.h || 1, 'exit']);
        const hit = near.find((q) => tx >= q[0] - 1 && tx < q[0] + q[2] + 1 && ty >= q[1] - 1 && ty < q[1] + q[3] + 1);
        if (hit && !(tx >= hit[0] && tx < hit[0] + hit[2])) flag(m, 'door-offset', `下絵の扉 ${pd.x},${pd.y}px（x ${tx}）が ${hit[4]} の ${hit[0]},${hit[1]} (${hit[2]}×${hit[3]}) と横にずれる`, { type: 'door', id: hit[4], x: hit[0], y: hit[1] });
      }
    }
  }
}
function underMeta(key) {
  const [th, , name] = String(key || '').split('/');
  try { return JSON.parse(fs.readFileSync(path.join(ENV, th || '', 'under', (name || '') + '.json'), 'utf8')); } catch (e) { return null; }
}

// ---------------------------------------------------------------- 実行
const ids = Object.keys(R.DB.maps).sort().filter((id) => {
  const m = R.DB.maps[id];
  if (m.kind === 'world' || /^(stub_|t_)/.test(id)) return false;
  return !ONLY || ONLY.split(',').includes(id);
});
for (const id of ids) {
  try { checkMap(R.DB.maps[id]); } catch (e) { flags.push({ map: id, rule: 'error', what: String(e && e.stack || e).slice(0, 300) }); }
}

section(`物の置き場所（マップ ${counts.maps}・物 ${counts.props}（壁に掛ける物 ${counts.wall}）・人 ${counts.npcs}・宝箱 ${counts.chests}・出口の印 ${counts.exits}）`);
const byMap = {};
for (const f of flags) (byMap[f.map] = byMap[f.map] || []).push(f);
let owned = 0, excepted = 0;
for (const id of ids) {
  const l = byMap[id] || [];
  const real = l.filter((f) => !f.except && !f.owned);
  owned += l.filter((f) => f.owned && !f.except).length;
  excepted += l.filter((f) => f.except).length;
  if (argv.includes('--all-flags')) for (const f of l.filter((q) => q.except || q.owned)) console.log(`info  ${id}: [${f.rule}] ${f.what}${f.except ? '  （例外: ' + f.except + '）' : '  （' + f.owned + 'の持ち場）'}`);
  if (!real.length) { if (!ONLY) continue; ok(`${id}: 物の置き場所`, true); continue; }
  for (const f of real) ok(`${id}: [${f.rule}] ${f.what}`, false, f.info || undefined);
}
ok(`全マップ ${ids.length}: 持ち場の外（カルデラ・砂漠）の物 ${owned}、受け入れた例外 ${excepted} を除いて失敗なし`, !flags.some((f) => !f.except && !f.owned));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ counts, flags }, null, 1));
done('check_props');
