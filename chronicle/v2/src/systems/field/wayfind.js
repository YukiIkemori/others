// FIELD — 町の道しるべ（出口の灯りと、店の吊り看板）。オーナーの試遊の報告「町の出入り口が見つけにくい」「家が何の店か、入るまで分からない」
//   出口: 町・ダンジョンの exits（to が別のマップ、cond が今合う物）と、外へ出る戸口・階段（door／stairs の物で、行き先が屋内でない物）。
//         出口のマスに灯籠の色のやわらかい光の脈（2.4 秒）＋外へ向く小さな矢印。先頭が 2 マス以内に来たら「→ 迷いの森」の札。
//         行き先の名前は行き先のマップの name。ワールドなら着く所の地方の名前（world.meta.areas）。同じマップの中へ戻す出口（迷いの森のループ）は出さない。
//   看板: 町の建物の戸口（door.to）の上に小さな吊り看板。種類は戸口の行き先の屋内から決める:
//         中の人の話（R.DB.events の run）が ev.shop('<id>') → R.DB.shops[id].kind、ev.inn → 宿、ev.tavern／仲間選び → 酒場、セーブ → セーブ。
//         中に何も無ければ建物の sign、それも無ければ屋内の名前（「〜の道具屋」「宿」…）。ただの家（homes_slice.js）は看板なし。
//         外に立つ売り手（町の NPC の話が店・宿）にも、頭の横に同じ看板。先頭が近い（1.5 マス）と店の名前の札。
//   物の印: o.way（外洋船の舵。maps/isles_00_kit.js の K.moor）にも出口と同じ灯りの脈と矢印、近いと「→ 外洋船の舵」の札。
//   どれもマップのデータ（戸口・出口の座標）だけから作るので、町の絵を描き直しても付いていく。描くのは町の絵（チャンクの base／over）の上。
//   F._wayfind(g, t, cx, cy)（Post の前: 光・矢印・看板）と F._wayfindLabels(g, t, cx, cy)（Post の後: 文字の札）。layers.js が呼ぶ。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const W = (F.wayfind = F.wayfind || {});

  // 看板の種類 → アイコン（UIK.icon）と短い呼び名
  const KIND = {
    weapon: { icon: 'sword', ja: R.T('sys.wayfind.KIND.weapon.ja') }, armor: { icon: 'shield', ja: R.T('sys.wayfind.KIND.armor.ja') }, item: { icon: 'potion', ja: R.T('sys.wayfind.KIND.item.ja') },
    special: { icon: 'gem', ja: R.T('sys.wayfind.KIND.special.ja') }, shop: { icon: 'shop', ja: R.T('sys.wayfind.KIND.shop.ja') }, inn: { icon: 'inn', ja: R.T('sys.wayfind.KIND.inn.ja') }, tavern: { icon: 'chat', ja: R.T('sys.wayfind.KIND.tavern.ja') },
    church: { icon: 'light', ja: R.T('sys.wayfind.KIND.church.ja') }, save: { icon: 'save', ja: R.T('sys.wayfind.KIND.save.ja') }, guild: { icon: 'journal', ja: R.T('sys.wayfind.KIND.guild.ja') },
    record: { icon: 'book', ja: R.T('sys.wayfind.KIND.record.ja') }, records: { icon: 'book', ja: R.T('sys.wayfind.KIND.records.ja') }, hall: { icon: 'book', ja: R.T('sys.wayfind.KIND.hall.ja') }, map: { icon: 'map', ja: R.T('sys.wayfind.KIND.map.ja') },
  };
  // 屋内の名前からの見当（中の人から決まらないときだけ）
  const BY_NAME = [[/教会|礼拝|聖堂/, 'church'], [/酒場|亭」?$/, 'tavern'], [/宿/, 'inn'], [/武具|武器|鍛冶/, 'weapon'], [/防具/, 'armor'],
    [/道具屋|雑貨/, 'item'], [/地図/, 'map'], [/ギルド|組合|詰所/, 'guild'], [/記録院/, 'record'], [/の間$|集会/, 'hall']];
  const ARROW = { n: '↑', s: '↓', e: '→', w: '←' };
  const cache = {};

  /** 話（イベントの id）が開く施設の種類。無ければ null */
  function kindOfTalk(talk) { const r = talkInfo(talk); return r && r.kind; }
  /** 話が開く施設 → {kind, shop?}（店なら R.DB.shops の定義） */
  function talkInfo(talk) {
    const ev = typeof talk === 'string' && R.DB.events && R.DB.events[talk];
    if (!ev || typeof ev.run !== 'function') return null;
    let src = '';
    try { src = String(ev.run); } catch (e) { return null; }
    const sh = src.match(/\.shop\(([^)]*)\)/);
    if (sh) {
      const ids = sh[1].match(/['"]([\w-]+)['"]/g) || [];
      for (const q of ids) { const d = R.DB.shops && R.DB.shops[q.slice(1, -1)]; if (d) return { kind: KIND[d.kind] ? d.kind : 'shop', shop: d }; }
      return { kind: 'shop' };
    }
    if (/\.inn\(/.test(src)) return { kind: 'inn' };
    if (/\.tavern\(|chooseCompanions/.test(src)) return { kind: 'tavern' };
    if (/\.church\(|\.pray\(/.test(src)) return { kind: 'church' };
    if (/\.save\(|open\(\s*['"]save['"]/.test(src)) return { kind: 'save' };
    return null;
  }
  /** 屋内のマップの施設の種類（中の人・物から）。家なら null */
  function kindOfInterior(id) {
    const m = R.DB.maps && R.DB.maps[id];
    if (!m) return null;
    const found = [];
    for (const n of m.npcs || []) { const k = kindOfTalk(n.talk); if (k) found.push(k); }
    for (const o of m.objects || []) {
      if (o.type === 'save' || o.type === 'savepoint' || o.id === 'save_crystal') found.push('save');
      if (o.type === 'examine') { const k = kindOfTalk(o.event); if (k) found.push(k); }
    }
    // 宿・酒場・店が並ぶときは、いちばん「看板らしい」物を選ぶ（宿の売店より宿）
    for (const k of ['tavern', 'inn', 'weapon', 'armor', 'item', 'special', 'shop', 'church', 'save']) if (found.includes(k)) return k;
    return null;
  }
  function kindByName(name) {
    for (const [re, k] of BY_NAME) if (re.test(name || '')) return k;
    return null;
  }
  /** 戸口の行き先（屋内）→ {kind, name}。ただの家は null */
  W.facility = function (toMap, bldSign) {
    const m = R.DB.maps && R.DB.maps[toMap];
    if (!m || m.kind !== 'interior') return null;
    const k = kindOfInterior(toMap) || (bldSign && KIND[bldSign] ? bldSign : null) || (!/家|小屋/.test(m.name || '') ? kindByName(m.name) : null);
    return k ? { kind: k, name: m.name || KIND[k].ja } : null;
  };

  // ---------------------------------------------------------------- 出口
  // 地方の範囲は重なることがある（北の野の範囲が湿原の入口まで掛かり、霧の入口の北口が「北の野」と出た。持ち主 2026-10-04）→
  //   掛かる範囲の名前のうち、全体（同じ名前の四角の合計）が一番小さい物（今いる地方そのものの名前は、外へ出る出口の行き先にならないので除く）
  const areaTotal = new WeakMap();
  function totals(world) {
    let t = areaTotal.get(world);
    if (!t) { t = {}; for (const a of (world.meta && world.meta.areas) || []) t[a.name] = (t[a.name] || 0) + a.rect[2] * a.rect[3]; areaTotal.set(world, t); }
    return t;
  }
  function areaName(world, x, y, leaving) {
    const tot = totals(world);
    let best = null;
    for (const a of (world.meta && world.meta.areas) || []) {
      const r = a.rect;
      if (!(x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3])) continue;
      if (leaving && String(a.name) === leaving) continue;
      if (!best || tot[a.name] < tot[best.name]) best = a;
    }
    return best ? best.name : world.name;
  }
  function regionName() {
    try { const m = F._s && F._s.map, rg = m && m.region && R.DB.regions && R.DB.regions[m.region]; return rg ? String(rg.name) : null; } catch (e) { return null; }
  }
  /** 行き先の名前 */
  W.destName = function (to) {
    const d = to && R.DB.maps && R.DB.maps[to.map];
    if (!d) return '';
    if (d.kind === 'world') {
      const sp = d.spawns && d.spawns[to.spawn];
      const loc = R.DB.locations && R.DB.locations[to.spawn];
      return sp ? areaName(d, sp.x, sp.y, regionName()) : (loc && loc.name) || d.name || '';
    }
    return d.name || '';
  };
  function edgeDir(m, x, y, w, h) {
    const W0 = m.w || (m.rows && m.rows[0] && m.rows[0].length) || 0, H0 = m.h || (m.rows && m.rows.length) || 0;
    const d = [['w', x], ['e', W0 - (x + w)], ['n', y], ['s', H0 - (y + h)]];
    d.sort((a, b) => a[1] - b[1]);
    return d[0][0];
  }
  /**
   * 出口の向き: データの dir があればそれ。マップの端に触れていれば近い端。端でない出口（描いた門のアーチ、f_cape のファロスの門）は、
   * 四角のすぐ外で「その向きの先が通れず、反対の向きの先が通れる」向き（門の奥＝建物の側）。決まらなければ近い端
   */
  function exitDir(m, e, w, h) {
    if (e.dir && ARROW[e.dir]) return e.dir;
    const W0 = m.w || 0, H0 = m.h || 0;
    if (e.x === 0 || e.y === 0 || e.x + w >= W0 || e.y + h >= H0) return edgeDir(m, e.x, e.y, w, h);
    const walk = (x, y) => { try { return !!(F.passable && F.passable(m, x, y, null, 0)); } catch (er) { return true; } };
    const side = { n: [e.x, e.y - 1, e.x, e.y + h], s: [e.x, e.y + h, e.x, e.y - 1], w: [e.x - 1, e.y, e.x + w, e.y], e: [e.x + w, e.y, e.x - 1, e.y] };
    for (const d of ['n', 's', 'w', 'e']) { const q = side[d]; if (!walk(q[0], q[1]) && walk(q[2], q[3])) return d; }
    return edgeDir(m, e.x, e.y, w, h);
  }
  /** 同じ所の続き（迷いの森 1 → 2 など）。外へ出る出口ではない */
  function sameArea(m, d) {
    return d.kind === m.kind && ((m.location && d.location === m.location) || (m.name && d.name === m.name));
  }
  /** このマップの印の一覧（マップと状態の印が変わるまで使い回す） */
  W.info = function (m) {
    const G = R.Game || {};
    const sig = m.id + ':' + Object.keys(G.flags || {}).length + ':' + JSON.stringify(G.vars || {}).length;
    const c = cache[m.id];
    if (c && c.sig === sig) return c;
    const out = { sig, exits: [], signs: [], marks: [] };
    const ok = (cond) => cond == null || (R.State && R.State.check(cond));
    // 物の印（o.way = {label, dir, x?, y?, w?, h?}）: 出口でない所（外洋船の舵など）に、出口と同じ灯りの脈と札。持ち主 2026-10-04「舵を取る場所がわかりづらい」
    for (const o of m.objects || []) {
      if (!o.way || !ok(o.cond)) continue;
      const q = o.way, dir = q.dir || 's';
      out.marks.push({ x: q.x != null ? q.x : o.x, y: q.y != null ? q.y : o.y, w: q.w || 1, h: q.h || 1, lv: o.lv || 0, dir, label: q.label ? ARROW[dir] + ' ' + q.label : '' });
    }
    if (m.kind === 'town' || m.kind === 'dungeon' || m.kind === 'field') {   // field = エリア切り替えのフィールド（端の出口に行き先の札）
      for (const e of m.exits || []) {
        if (!e.to || e.to.map === m.id || !ok(e.cond)) continue;
        const d = R.DB.maps[e.to.map];
        if (!d || d.kind === 'interior' || sameArea(m, d)) continue;
        const w = e.w || 1, h = e.h || 1;
        out.exits.push({ x: e.x, y: e.y, w, h, lv: e.lv || 0, dir: exitDir(m, e, w, h), label: '', to: e.to });
      }
      for (const o of m.objects || []) {
        if ((o.type !== 'door' && o.type !== 'stairs') || !o.to || o.to.map === m.id || !ok(o.cond)) continue;
        const d = R.DB.maps[o.to.map];
        if (!d || d.kind === 'interior' || (m.kind === 'dungeon' && d.kind === 'dungeon')) continue;   // 階段の上り下りは別の話
        // 幅のある入口（door の w・h。f_lake のつららの回廊の口は w 2）は四角ぜんたいの中ほどに印（前は 1 マスとして左のマスの中ほど＝半マスずれていた）
        const ow = o.w || 1, oh = o.h || 1;
        out.exits.push({ x: o.x, y: o.y, w: ow, h: oh, lv: o.lv || 0, dir: exitDir(m, o, ow, oh), label: '', to: o.to, warp: true });
      }
      for (const e of out.exits) { const n = W.destName(e.to); e.label = n ? ARROW[e.dir] + ' ' + n : ''; }
    }
    if (m.kind === 'town') {
      for (const o of m.objects || []) {
        if (o.type !== 'building' || !o.door || !o.door.to || !ok(o.cond)) continue;
        const f = W.facility(o.door.to.map, o.sign);
        if (f) out.signs.push({ x: o.door.x, y: o.door.y, lv: o.lv || 0, kind: f.kind, name: f.name, bld: o });
      }
      for (const n of m.npcs || []) {
        if (n.move && n.move !== 'still') continue;
        const f = talkInfo(n.talk);
        if (!f) continue;
        out.signs.push({ x: n.x, y: n.y, lv: n.lv || 0, kind: f.kind, name: (f.shop && f.shop.name) || n.title || KIND[f.kind].ja, npc: n.id });
      }
    }
    cache[m.id] = out;
    return out;
  };

  // ---------------------------------------------------------------- 描く
  function near(e, px, py, r) {
    const dx = Math.max(e.x - px, 0, px - (e.x + e.w - 1)), dy = Math.max(e.y - py, 0, py - (e.y + e.h - 1));
    return Math.max(dx, dy) <= r;
  }
  function chevron(g, x, y, dir, s, fill) {
    const a = { n: -Math.PI / 2, s: Math.PI / 2, e: 0, w: Math.PI }[dir];
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(-s * 0.55, -s * 0.7); g.lineTo(s * 0.45, 0); g.lineTo(-s * 0.55, s * 0.7); g.lineTo(-s * 0.2, 0); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = Math.max(1, s * 0.28); g.strokeStyle = 'rgba(28,16,10,0.85)'; g.stroke();
    g.fillStyle = fill; g.fill();
    g.restore();
  }
  /** 外へ向く矢印（出口のまん中。外へ少し揺れる）。端のマスは画面の端に来るので内へ寄せる。仕上げ（Post）の後に描いて色をくすませない */
  function drawArrow(g, e, t, cx, cy, tm) {
    const u = t / 32, v = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.dir];
    const mx = (e.x + e.w / 2) * t - cx, my = (e.y + e.h / 2) * t - cy;
    if (mx < -t || my < -t || mx > R.W + t || my > R.H + t) return;
    const bob = (0.5 + 0.5 * Math.sin(tm / 300)) * 4 * u;
    const ax = mx - v[0] * t * 0.55 + v[0] * bob, ay = my - v[1] * t * 0.55 + v[1] * bob;
    g.save();
    chevron(g, ax, ay, e.dir, 13 * u, '#ffe3a0');
    g.globalAlpha = 0.65;
    chevron(g, ax - v[0] * 11 * u, ay - v[1] * 11 * u, e.dir, 10 * u, '#ffc878');
    g.restore();
  }
  function drawExit(g, e, t, cx, cy, tm) {
    const u = t / 32;
    const ph = (tm % 2400) / 2400, k = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < e.w; i++) for (let j = 0; j < e.h; j++) {
      const x = (e.x + i + 0.5) * t - cx, y = (e.y + j + 0.6) * t - cy;
      if (x < -t * 2 || y < -t * 2 || x > R.W + t * 2 || y > R.H + t * 2) continue;
      const r = t * (1.0 + 0.3 * k);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,196,112,${0.55 + 0.3 * k})`);
      gr.addColorStop(0.5, `rgba(255,160,80,${0.26 + 0.16 * k})`);
      gr.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 地面に広がる灯りの輪（外へ流れる）
    const mx0 = (e.x + e.w / 2) * t - cx, my0 = (e.y + e.h / 2 + 0.1) * t - cy;
    const rw = (e.w / 2 + 0.3 + ph * 0.6) * t, rh = (e.h / 2 + 0.15 + ph * 0.45) * t;
    g.strokeStyle = `rgba(255,214,150,${0.5 * (1 - ph)})`; g.lineWidth = 1.6 * u;
    g.beginPath(); g.ellipse(mx0, my0, rw, rh, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  // 看板の絵（24 の箱の中の塗りの形。F: 塗る / S: 線）。線の細いアイコンより、夜の小さな板で読みやすい
  const PICT = {
    weapon: ['F:M4 18.5L15.5 7l1.5 1.5L5.5 20z', 'F:M15 4.5l4.5-.5-.5 4.5-2.2.2-2-2z', 'F:M3 16.5l1.5-1.5 4.5 4.5-1.5 1.5z',
      'F:M20 18.5L8.5 7 7 8.5 18.5 20z', 'F:M9 4.5L4.5 4l.5 4.5 2.2.2 2-2z', 'F:M21 16.5L19.5 15 15 19.5l1.5 1.5z'],
    armor: ['F:M12 2.8l7.5 2.7v6.2c0 4.8-3.2 7.9-7.5 10-4.3-2.1-7.5-5.2-7.5-10V5.5z', 'D:M12 6.5v12M7.5 10.5h9'],
    item: ['F:M9.5 2.5h5v2h-.8v4l4.3 6.8a5.2 5.2 0 0 1-4.4 7.2h-3.2a5.2 5.2 0 0 1-4.4-7.2l4.3-6.8v-4h-.8z', 'D:M7.2 15h9.6'],
    inn: ['F:M2.5 11h3v4h13.5v-2.5a2.5 2.5 0 0 1 2.5 2.5v6h-2.5v-2H5.5v2h-3z', 'F:M6.5 10.5a2.3 2.3 0 1 1 0 .1z', 'F:M10 10.5h7.5a2 2 0 0 1 2 2V14H10z',
      'F:M15 3h4l-4 4h4', 'S:M15 3h4l-4 4h4'],
    tavern: ['F:M5 6h10v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'S:M15 9h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H15', 'F:M4.5 4.5a2.5 2.5 0 0 1 4-1.5 2.6 2.6 0 0 1 4.3.2A2.3 2.3 0 0 1 15.5 6.5H4.5z',
      'D:M8 9v9M12 9v9'],
    church: ['F:M10.5 2.5h3v4h4v3h-4v12h-3v-12h-4v-3h4z'],
    save: ['F:M12 2.5l6.5 7-6.5 12-6.5-12z', 'D:M5.5 9.5h13M12 2.5v19'],
    guild: ['F:M5 3h14v14l-7 4-7-4z', 'D:M8.5 8h7M8.5 11.5h7'],
    record: ['F:M3 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 9-.5V19.5c-3.5-1.5-6.5-1.5-9 .5-2.5-2-5.5-2-9-.5z', 'D:M12 6v14'],
    special: ['F:M7 4h10l4.5 5L12 21 2.5 9z', 'D:M2.5 9h19M12 9v12'],
    map: ['F:M3 5.5l6-2 6 2 6-2v15l-6 2-6-2-6 2z', 'D:M9 3.5v15M15 5.5v15'],
  };
  PICT.records = PICT.record; PICT.hall = PICT.record; PICT.shop = PICT.special;
  const pcache = {};
  function pict(g, kind, x, y, size) {
    const L = PICT[kind];
    if (!L || typeof Path2D === 'undefined') return false;
    const ops = pcache[kind] || (pcache[kind] = L.map((q) => ({ t: q[0], p: new Path2D(q.slice(2)) })));
    const k = size / 24;
    g.save();
    g.translate(x, y); g.scale(k, k);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // 影（板に沈める）→ 塗り → 切り込み
    g.translate(0.6, 0.9);
    g.fillStyle = 'rgba(20,10,6,0.75)'; g.strokeStyle = 'rgba(20,10,6,0.75)'; g.lineWidth = 2.2;
    for (const o of ops) { if (o.t === 'F') g.fill(o.p); else if (o.t === 'S') g.stroke(o.p); }
    g.translate(-0.6, -0.9);
    g.fillStyle = '#ffdf9c'; g.strokeStyle = '#ffdf9c';
    for (const o of ops) { if (o.t === 'F') g.fill(o.p); else if (o.t === 'S') g.stroke(o.p); }
    g.strokeStyle = '#5a3a24'; g.lineWidth = 1.5;
    for (const o of ops) if (o.t === 'D') g.stroke(o.p);
    g.restore();
    return true;
  }
  /** 吊り看板（腕木から 2 本の鎖、木の板にアイコン） */
  function drawSign(g, s, x, y, u, tm) {
    const K = KIND[s.kind] || KIND.shop;
    const bw = 25 * u, bh = 21 * u;
    const sway = Math.sin(tm / 900 + s.x * 1.7) * 0.035;
    // 腕木（壁から右へ）
    g.fillStyle = '#2a1c14';
    g.fillRect(x - bw / 2 - 3 * u, y - 5 * u, bw + 6 * u, 2.2 * u);
    g.fillStyle = '#6a4a30';
    g.fillRect(x - bw / 2 - 3 * u, y - 5 * u, bw + 6 * u, 1 * u);
    // 灯り（板のうしろのにじみ）
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y + bh / 2, 0, x, y + bh / 2, bw * 1.1);
    gr.addColorStop(0, 'rgba(255,190,110,0.30)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = gr; g.fillRect(x - bw * 1.1, y + bh / 2 - bw * 1.1, bw * 2.2, bw * 2.2);
    g.restore();
    g.save();
    g.translate(x, y - 4 * u); g.rotate(sway); g.translate(-x, -(y - 4 * u));
    // 鎖
    g.strokeStyle = '#1e1410'; g.lineWidth = 1.2 * u;
    g.beginPath(); g.moveTo(x - bw * 0.32, y - 4 * u); g.lineTo(x - bw * 0.32, y + 1 * u); g.moveTo(x + bw * 0.32, y - 4 * u); g.lineTo(x + bw * 0.32, y + 1 * u); g.stroke();
    // 板
    const by = y + 1 * u;
    R.Gfx.roundRect(x - bw / 2, by, bw, bh, 3 * u, '#5a3a24', '#1c120c', Math.max(1, 1.2 * u));
    const lg = g.createLinearGradient(0, by, 0, by + bh);
    lg.addColorStop(0, 'rgba(255,214,150,0.28)'); lg.addColorStop(0.5, 'rgba(255,190,120,0.06)'); lg.addColorStop(1, 'rgba(10,6,20,0.25)');
    g.fillStyle = lg; g.fillRect(x - bw / 2 + 1.5 * u, by + 1.5 * u, bw - 3 * u, bh - 3 * u);
    g.strokeStyle = 'rgba(236,201,124,0.55)'; g.lineWidth = Math.max(0.75, 0.8 * u);
    g.strokeRect(x - bw / 2 + 2.2 * u, by + 2.2 * u, bw - 4.4 * u, bh - 4.4 * u);
    const is = 16 * u;
    if (!pict(g, s.kind, x - is / 2, by + (bh - is) / 2, is)) R.UIK.icon(g, K.icon, x - is / 2, by + (bh - is) / 2, is, '#ffe2a4', { lw: 2.3 });
    g.restore();
  }
  /** 看板の吊る位置（論理 px）: 戸口の真上の壁。外の売り手は頭の右 */
  function signPos(s, t, cx, cy) {
    if (s.npc) return [(s.x + 1.05) * t - cx, (s.y - 0.55) * t - cy];
    return [(s.x + 0.5) * t - cx, (s.y - 1.15) * t - cy];
  }
  function npcShown(s) {
    const n = (S.npcs || []).find((q) => q.id === s.npc);
    return !!(n && n.vis && !n.hidden);
  }

  F._wayfind = function (g, t, cx, cy) {
    const m = S.map;
    if (!m || (m.kind !== 'town' && m.kind !== 'dungeon' && m.kind !== 'field')) return;
    const I = W.info(m), tm = R.Engine.time, u = t / 32;
    for (const e of I.exits) drawExit(g, e, t, cx, cy, tm);
    for (const e of I.marks || []) drawExit(g, e, t, cx, cy, tm);
    for (const s of I.signs) {
      if (s.npc && !npcShown(s)) continue;
      const [x, y] = signPos(s, t, cx, cy);
      if (x < -t || y < -t || x > R.W + t || y > R.H + t) continue;
      drawSign(g, s, Math.round(x), Math.round(y), u, tm);
    }
  };

  function tag(g, text, x, y, o) {
    const U = R.UIK.u, T = R.UIK.T;
    const size = U(o.size || 12), pad = U(7);
    const w = R.UIK.measure(text, { size, weight: 700 }) + pad * 2, h = size + U(9);
    let bx = Math.round(o.left ? x : x - w / 2), by = Math.round(y - h / 2);
    const s = R.safe || { l: 0, r: 0, t: 0, b: 0 };
    bx = Math.max(s.l + U(6), Math.min(R.W - s.r - U(6) - w, bx));
    by = Math.max(s.t + U(6), Math.min(R.H - s.b - U(6) - h, by));
    g.save();
    g.globalAlpha *= o.alpha;
    R.Gfx.roundRect(bx, by, w, h, h / 2, 'rgba(18,12,20,0.82)', 'rgba(236,201,124,0.75)', 1);
    R.UIK.text(g, text, bx + w / 2, by + U(4.5), { size, weight: 700, align: 'center', color: o.color || T.color.gold });
    g.restore();
  }
  const fade = {};
  function alphaFor(key, on) {
    const now = R.Engine.time, f = fade[key] || (fade[key] = { a: 0, t: now });
    const dt = Math.min(100, now - f.t); f.t = now;
    f.a = Math.max(0, Math.min(1, f.a + (on ? dt / 180 : -dt / 240)));
    return f.a;
  }
  F._wayfindLabels = function (g, t, cx, cy) {
    const m = S.map;
    if (!m || (m.kind !== 'town' && m.kind !== 'dungeon' && m.kind !== 'field')) return;
    const I = W.info(m), tm = R.Engine.time;
    for (const e of I.exits) drawArrow(g, e, t, cx, cy, tm);
    for (const e of I.marks || []) drawArrow(g, e, t, cx, cy, tm);
    const top = R.Engine.top() === F.scene && !F._locked() && !(R.Events && R.Events.busy && R.Events.busy());
    const px = S.x, py = S.y;
    for (let i = 0; i < I.exits.length; i++) {
      const e = I.exits[i];
      if (!e.label) continue;
      const a = alphaFor(m.id + ':x' + i, top && near(e, px, py, 2));
      if (a <= 0.01) continue;
      // 札は出口の横（南北の出口は右、東西の出口は下）。人の頭の吹き出しと重ねない
      let x, y;
      if (e.dir === 'n' || e.dir === 's') { x = (e.x + e.w + 0.3) * t - cx; y = (e.y + e.h / 2 + (e.dir === 'n' ? 0.5 : -0.3)) * t - cy; }
      else { x = (e.x + e.w / 2 + (e.dir === 'w' ? 1.4 : -1.4)) * t - cx; y = (e.y + e.h + 0.55) * t - cy; }
      tag(g, e.label, x, y, { alpha: a, size: 12.5, left: e.dir === 'n' || e.dir === 's' });
    }
    // 物の印の札（外洋船の舵）: 3 マス以内で。札は印の向こう（船の側）に
    const marks = I.marks || [];
    for (let i = 0; i < marks.length; i++) {
      const e = marks[i];
      if (!e.label) continue;
      const a = alphaFor(m.id + ':m' + i, top && near(e, px, py, 3));
      if (a <= 0.01) continue;
      const v = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.dir] || [0, 1];
      const x = (e.x + e.w / 2 + v[0] * 1.2) * t - cx, y = (e.y + e.h / 2 + v[1] * 1.0) * t - cy;
      tag(g, e.label, x, y, { alpha: a, size: 12.5 });
    }
    for (let i = 0; i < I.signs.length; i++) {
      const s = I.signs[i];
      if (s.npc && !npcShown(s)) continue;
      const a = alphaFor(m.id + ':s' + i, top && Math.abs(s.x - px) <= 1 && py - s.y >= 0 && py - s.y <= 2);
      if (a <= 0.01) continue;
      const [x, y] = signPos(s, t, cx, cy);
      tag(g, s.name, x, y - 11 * (t / 32), { alpha: a, size: 11, color: '#fff1d6' });
    }
  };
  // 町の地図（townmap.js）が看板と同じ絵と種類を使う
  W.KIND = KIND;
  W.pict = pict;
})(window.RPG);
