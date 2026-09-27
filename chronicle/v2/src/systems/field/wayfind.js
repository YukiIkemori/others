// FIELD — 町の道しるべ（出口の灯りと、店の吊り看板）。オーナーの試遊の報告「町の出入り口が見つけにくい」「家が何の店か、入るまで分からない」
//   出口: 町・ダンジョンの exits（to が別のマップ、cond が今合う物）と、外へ出る戸口・階段（door／stairs の物で、行き先が屋内でない物）。
//         出口のマスに灯籠の色のやわらかい光の脈（2.4 秒）＋外へ向く小さな矢印。先頭が 2 マス以内に来たら「→ 迷いの森」の札。
//         行き先の名前は行き先のマップの name。ワールドなら着く所の地方の名前（world.meta.areas）。同じマップの中へ戻す出口（迷いの森のループ）は出さない。
//   看板: 町の建物の戸口（door.to）の上に小さな吊り看板。種類は戸口の行き先の屋内から決める:
//         中の人の話（R.DB.events の run）が ev.shop('<id>') → R.DB.shops[id].kind、ev.inn → 宿、ev.tavern／仲間選び → 酒場、セーブ → セーブ。
//         中に何も無ければ建物の sign、それも無ければ屋内の名前（「〜の道具屋」「宿」…）。ただの家（homes_slice.js）は看板なし。
//         外に立つ売り手（町の NPC の話が店・宿）にも、頭の横に同じ看板。先頭が近い（1.5 マス）と店の名前の札。
//   どれもマップのデータ（戸口・出口の座標）だけから作るので、町の絵を描き直しても付いていく。描くのは町の絵（チャンクの base／over）の上。
//   F._wayfind(g, t, cx, cy)（Post の前: 光・矢印・看板）と F._wayfindLabels(g, t, cx, cy)（Post の後: 文字の札）。layers.js が呼ぶ。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const W = (F.wayfind = F.wayfind || {});

  // 看板の種類 → アイコン（UIK.icon）と短い呼び名
  const KIND = {
    weapon: { icon: 'sword', ja: '武具屋' }, armor: { icon: 'shield', ja: '防具屋' }, item: { icon: 'potion', ja: '道具屋' },
    special: { icon: 'gem', ja: '店' }, shop: { icon: 'shop', ja: '店' }, inn: { icon: 'inn', ja: '宿屋' }, tavern: { icon: 'chat', ja: '酒場' },
    church: { icon: 'light', ja: '教会' }, save: { icon: 'save', ja: 'セーブ' }, guild: { icon: 'journal', ja: 'ギルド' },
    record: { icon: 'book', ja: '記録院' }, records: { icon: 'book', ja: '記録院' }, hall: { icon: 'book', ja: '集会所' }, map: { icon: 'map', ja: '地図屋' },
  };
  // 屋内の名前からの見当（中の人から決まらないときだけ）
  const BY_NAME = [[/教会|礼拝|聖堂/, 'church'], [/酒場|亭」?$/, 'tavern'], [/宿/, 'inn'], [/武具|武器|鍛冶/, 'weapon'], [/防具/, 'armor'],
    [/道具屋|雑貨/, 'item'], [/地図/, 'map'], [/ギルド|組合|詰所/, 'guild'], [/記録院/, 'record'], [/の間$|集会/, 'hall']];
  const ARROW = { n: '↑', s: '↓', e: '→', w: '←' };
  const cache = {};

  /** 話（イベントの id）が開く施設の種類。無ければ null */
  function kindOfTalk(talk) {
    const ev = typeof talk === 'string' && R.DB.events && R.DB.events[talk];
    if (!ev || typeof ev.run !== 'function') return null;
    let src = '';
    try { src = String(ev.run); } catch (e) { return null; }
    const sh = src.match(/\.shop\(([^)]*)\)/);
    if (sh) {
      const ids = sh[1].match(/['"]([\w-]+)['"]/g) || [];
      for (const q of ids) { const d = R.DB.shops && R.DB.shops[q.slice(1, -1)]; if (d) return KIND[d.kind] ? d.kind : 'shop'; }
      return 'shop';
    }
    if (/\.inn\(/.test(src)) return 'inn';
    if (/\.tavern\(|chooseCompanions/.test(src)) return 'tavern';
    if (/\.church\(|\.pray\(/.test(src)) return 'church';
    if (/\.save\(|open\(\s*['"]save['"]/.test(src)) return 'save';
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
  function areaName(world, x, y) {
    for (const a of (world.meta && world.meta.areas) || []) {
      const r = a.rect;
      if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) return a.name;
    }
    return world.name;
  }
  /** 行き先の名前 */
  W.destName = function (to) {
    const d = to && R.DB.maps && R.DB.maps[to.map];
    if (!d) return '';
    if (d.kind === 'world') {
      const sp = d.spawns && d.spawns[to.spawn];
      const loc = R.DB.locations && R.DB.locations[to.spawn];
      return sp ? areaName(d, sp.x, sp.y) : (loc && loc.name) || d.name || '';
    }
    return d.name || '';
  };
  function edgeDir(m, x, y, w, h) {
    const W0 = m.w || (m.rows && m.rows[0] && m.rows[0].length) || 0, H0 = m.h || (m.rows && m.rows.length) || 0;
    const d = [['w', x], ['e', W0 - (x + w)], ['n', y], ['s', H0 - (y + h)]];
    d.sort((a, b) => a[1] - b[1]);
    return d[0][0];
  }
  /** このマップの印の一覧（マップと状態の印が変わるまで使い回す） */
  W.info = function (m) {
    const G = R.Game || {};
    const sig = m.id + ':' + Object.keys(G.flags || {}).length + ':' + JSON.stringify(G.vars || {}).length;
    const c = cache[m.id];
    if (c && c.sig === sig) return c;
    const out = { sig, exits: [], signs: [] };
    const ok = (cond) => cond == null || (R.State && R.State.check(cond));
    if (m.kind === 'town' || m.kind === 'dungeon') {
      for (const e of m.exits || []) {
        if (!e.to || e.to.map === m.id || !ok(e.cond)) continue;
        const d = R.DB.maps[e.to.map];
        if (!d || d.kind === 'interior') continue;
        const w = e.w || 1, h = e.h || 1;
        out.exits.push({ x: e.x, y: e.y, w, h, lv: e.lv || 0, dir: edgeDir(m, e.x, e.y, w, h), label: '', to: e.to });
      }
      for (const o of m.objects || []) {
        if ((o.type !== 'door' && o.type !== 'stairs') || !o.to || o.to.map === m.id || !ok(o.cond)) continue;
        const d = R.DB.maps[o.to.map];
        if (!d || d.kind === 'interior' || (m.kind === 'dungeon' && d.kind === 'dungeon')) continue;   // 階段の上り下りは別の話
        out.exits.push({ x: o.x, y: o.y, w: 1, h: 1, lv: o.lv || 0, dir: edgeDir(m, o.x, o.y, 1, 1), label: '', to: o.to, warp: true });
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
        const k = kindOfTalk(n.talk);
        if (!k) continue;
        out.signs.push({ x: n.x, y: n.y, lv: n.lv || 0, kind: k, name: n.title || n.name || KIND[k].ja, npc: n.id, cond: n.cond });
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
  function drawExit(g, e, t, cx, cy, tm) {
    const u = t / 32;
    const ph = (tm % 2400) / 2400, k = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < e.w; i++) for (let j = 0; j < e.h; j++) {
      const x = (e.x + i + 0.5) * t - cx, y = (e.y + j + 0.55) * t - cy;
      if (x < -t * 2 || y < -t * 2 || x > R.W + t * 2 || y > R.H + t * 2) continue;
      const r = t * (0.95 + 0.25 * k);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,196,110,${0.30 + 0.22 * k})`);
      gr.addColorStop(0.55, `rgba(255,160,80,${0.12 + 0.10 * k})`);
      gr.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
    // 外へ向く矢印（出口のまん中。外へ少し揺れる）
    const mx = (e.x + e.w / 2) * t - cx, my = (e.y + e.h / 2) * t - cy;
    if (mx < -t || my < -t || mx > R.W + t || my > R.H + t) return;
    const v = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[e.dir];
    const bob = Math.sin(tm / 260) * 2.5 * u;
    // 端のマスは画面の端に来るので、矢印は内へ半マス寄せる
    const ax = mx - v[0] * t * 0.35 + v[0] * bob, ay = my - v[1] * t * 0.35 + v[1] * bob;
    g.save();
    g.globalAlpha = 0.75 + 0.25 * k;
    chevron(g, ax, ay, e.dir, 11 * u, '#ffdf9a');
    chevron(g, ax - v[0] * 9 * u, ay - v[1] * 9 * u, e.dir, 8 * u, 'rgba(255,214,140,0.55)');
    g.restore();
  }
  /** 吊り看板（腕木から 2 本の鎖、木の板にアイコン） */
  function drawSign(g, s, x, y, u, tm) {
    const K = KIND[s.kind] || KIND.shop;
    const bw = 22 * u, bh = 19 * u;
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
    const is = 13 * u;
    R.UIK.icon(g, K.icon, x - is / 2, by + (bh - is) / 2, is, '#ffe2a4', { lw: 2.3 });
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
    if (!m || (m.kind !== 'town' && m.kind !== 'dungeon')) return;
    const I = W.info(m), tm = R.Engine.time, u = t / 32;
    for (const e of I.exits) drawExit(g, e, t, cx, cy, tm);
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
    let bx = Math.round(x - w / 2), by = Math.round(y - h / 2);
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
    if (!m || (m.kind !== 'town' && m.kind !== 'dungeon')) return;
    const I = W.info(m);
    const top = R.Engine.top() === F.scene && !F._locked() && !(R.Events && R.Events.busy && R.Events.busy());
    const px = S.x, py = S.y;
    for (let i = 0; i < I.exits.length; i++) {
      const e = I.exits[i];
      if (!e.label) continue;
      const a = alphaFor(m.id + ':x' + i, top && near(e, px, py, 2));
      if (a <= 0.01) continue;
      const v = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[e.dir];   // 内へ
      const x = (e.x + e.w / 2 + v[0] * 1.6) * t - cx, y = (e.y + e.h / 2 + v[1] * 1.6) * t - cy - (e.dir === 'e' || e.dir === 'w' ? t * 0.9 : 0);
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
})(window.RPG);
