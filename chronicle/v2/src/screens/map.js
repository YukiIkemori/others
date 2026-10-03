// MENUS: 地図（MODERN_UI §6.12、E13、A17）。町で X（params {town}）は先に町の地図（R.Field.townmap）、Y・R で世界の地図へ。世界の一枚絵（R.Terrain.worldThumb）を画面いっぱいより少し小さく。拡大はしない。
//   印: 行った町（名前）・行ったダンジョン・目印の手がかり（琥珀の羽ペン、ゆっくり光る）・一行の位置（矢印）。右下に凡例。
//   縦切りの範囲の外は「まだ知らない土地」。ワールドのマップが無いときは、行った場所の一覧だけを出す。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  function worldMap() { return R.DB.maps.world || Object.values(R.DB.maps).find((m) => m && m.kind === 'world') || null; }
  /** ワールドの上での、そのマップ（町・ダンジョンの入口）の位置（出口・扉・階段のうち、to.map が一致する物） */
  S.worldPosOf = function (mapId) {
    const w = worldMap();
    if (!w || !mapId) return null;
    const hits = [];
    for (const e of w.exits || []) if (e.to && e.to.map === mapId) hits.push({ x: e.x + (e.w || 1) / 2, y: e.y + (e.h || 1) / 2 });
    for (const o of w.objects || []) if (o.to && o.to.map === mapId) hits.push({ x: o.x + 0.5, y: o.y + 0.5 });
    for (const t of w.triggers || []) if (t.to && t.to.map === mapId) hits.push({ x: t.x + 0.5, y: t.y + 0.5 });
    return hits[0] || null;
  };

  S.def('map', {
    // params {town: mapId}（町で X）: 先にその町の地図。Y・R で世界の地図と行き来する。B・X で閉じる
    init(p) {
      this.thumb = null; this.tried = false;
      const tm = p && p.town && R.DB.maps[p.town];
      this.town = tm && tm.kind === 'town' && R.Field && R.Field.townmap ? tm.id : null;
      this.view = this.town ? 'town' : 'world';
      this.pm = null;   // 羊皮紙の地図の見え方 {cx, cy, z}（絵の px の中心と倍率。開いたときに今いる地方へ寄せる）
    },
    update() {
      const I = R.Input;
      if (this.town && I.pressed('y')) { R.UIK.sfx('cursor'); this.view = this.view === 'town' ? 'world' : 'town'; return; }
      if (this.view === 'world' && this.pm) {
        // 羊皮紙の地図: 十字（左スティック）で動かす・L/R（Q/E）とホイールで拡大・縮小。ゲームパッドも同じボタン
        const P = this.pm, dt = Math.min(50, R.Engine.dt || 16);
        const sp = (I.down('dash') ? 2.2 : 1) * dt * 0.9 / P.z;
        if (I.down('left')) P.cx -= sp; if (I.down('right')) P.cx += sp;
        if (I.down('up')) P.cy -= sp; if (I.down('down')) P.cy += sp;
        const wz = (I.pointer && I.pointer.wheel) || 0;
        if (I.repeat('r') || wz < 0) P.zt = Math.min(P.zmax, P.zt * 1.25);
        if (I.repeat('l') || wz > 0) P.zt = Math.max(P.zmin, P.zt / 1.25);
        P.z += (P.zt - P.z) * Math.min(1, dt / 90);
        // 近づいたら目標にそろえる（前は限りなく近づくだけで毎フレーム 1e-10 ずつ動き続け、名前の置き場の当たりが毎フレーム変わってちらついた。オーナー 2026-10-03）
        if (Math.abs(P.zt - P.z) < P.zt * 0.002) P.z = P.zt;
      } else if (this.town && I.pressed('r')) { R.UIK.sfx('cursor'); this.view = 'world'; return; }
      if (I.pressed('b') || I.pressed('a') || I.pressed('x')) { R.UIK.sfx('cancel'); this.close(undefined); }
    },
    promptList() {
      const pan = this.view === 'world' && this.pm ? [{ btn: 'l', label: R.T('ui.map.promptList.pan.0.label') }, { btn: 'r', label: R.T('ui.map.promptList.pan.1.label') }] : [];
      if (!this.town) return pan.concat([{ btn: 'b', label: R.T('ui.map.promptList.0.label') }]);
      return pan.concat([{ btn: 'y', label: this.view === 'town' ? R.T('ui.map.promptList.0.label_2') : R.T('ui.map.promptList.0.label_3') }, { btn: 'b', label: R.T('ui.map.promptList.1.label') }]);
    },
    /** 町の地図（R.Field.townmap が描く）: 町の名前・地図・凡例 */
    drawTown(g) {
      const b = S.box(), C = T().color, tall = S.tall(), m = R.DB.maps[this.town];
      S.heading(g, R.T('ui.map.drawTown.heading'), b.x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      R.UIK.text(g, m.name || m.id, b.x + u(8), b.y + u(26), { size: u(19), weight: 700, color: C.text });
      const lw = tall ? b.w : Math.min(b.w, u(900));
      const lh = R.Field.townmap.legendHeight(m.id, lw);
      const area = { x: b.x + u(8), y: b.y + u(60), w: b.w - u(16), h: b.h - u(60) - lh - u(tall ? 70 : 18) };
      const r = R.Field.townmap.draw(g, area, m.id, { top: tall }) || area;
      R.Field.townmap.legend(g, { x: b.x + (b.w - lw) / 2, y: Math.min(r.y + r.h + u(14), b.y + b.h - lh - u(tall ? 56 : 4)), w: lw, h: lh }, m.id);
      S.prompts(g, this.promptList());
    },
    /** 絵の上の位置（絵の px）: 今いる所・行った所・目印 */
    paintPos(mapId, x, y) {
      const WM = R.WorldMap, m = R.DB.maps[mapId];
      if (!WM || !m) return null;
      const A = WM.areas[mapId], wr = m.meta && m.meta.worldRect;
      if (A && x != null) return [A[0] + ((x + 0.5) / m.w) * A[2], A[1] + ((y + 0.5) / m.h) * A[3]];
      if (A) return [A[0] + A[2] / 2, A[1] + A[3] / 2];
      if (WM.anchors[mapId]) return WM.anchors[mapId];
      if (wr) return WM.toPaint(wr[0] + ((x == null ? m.w / 2 : x + 0.5) / m.w) * wr[2], wr[1] + ((y == null ? m.h / 2 : y + 0.5) / m.h) * wr[3]);
      if (m.kind === 'world' && x != null) return WM.toPaint(x + 0.5, y + 0.5);
      const L = m.location && R.DB.locations && R.DB.locations[m.location];
      if (L && L.map !== mapId) return this.paintPos(L.map);
      if (L && WM.anchors[m.location]) return WM.anchors[m.location];
      const w = S.worldPosOf(mapId);
      if (w) return WM.toPaint(w.x, w.y);
      // それでも無ければ、入口のある所（エリア・町・ひとつ上の階）の入口の位置（深さ 4 まで）
      if ((this._depth || 0) > 4) return null;
      this._depth = (this._depth || 0) + 1;
      try {
        const kinds = ['field', 'town', 'dungeon', 'interior'];
        for (const kd of kinds) for (const o of Object.values(R.DB.maps)) {
          if (!o || o.kind !== kd || o.id === mapId) continue;
          const hit = (o.exits || []).find((e) => e.to && e.to.map === mapId) || (o.objects || []).find((q) => (q.to && q.to.map === mapId) || (q.door && q.door.to && q.door.to.map === mapId));
          if (hit) { const c = this.paintPos(o.id, hit.door ? hit.door.x : hit.x, hit.door ? hit.door.y : hit.y); if (c) return c; }
        }
      } finally { this._depth--; }
      return null;
    },
    /** 羊皮紙の一枚絵の地図（R.WorldMap）。絵が読めていなければ false（前の地図を出す） */
    drawParchment(g) {
      const WM = R.WorldMap;
      if (!WM || !R.Media || !R.Media.image) return false;
      const rec = R.Media.image(WM.image, 'env');
      if (!rec || rec.failed) return false;
      const b = S.box(), C = T().color, G = R.Game || {}, t = R.Engine.time;
      S.heading(g, R.T('ui.map.drawParchment.heading'), b.x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const area = { x: b.x, y: b.y + u(44), w: b.w, h: b.h - u(44) };
      if (!rec.ready) { R.UIK.text(g, R.T('ui.map.drawParchment.text'), area.x + area.w / 2, area.y + area.h / 2, { size: u(18), color: C.text2, align: 'center' }); S.prompts(g, this.promptList()); return true; }
      const [IW, IH] = WM.size, fit = Math.min(area.w / IW, area.h / IH);
      // 今いる所
      const pos = (R.Field && R.Field.pos) || G.pos || {};
      const here = this.paintPos(pos.map, pos.x, pos.y);
      if (!this.pm) {
        const c = here || [IW / 2, IH / 2];
        this.pm = { cx: c[0], cy: c[1], z: 1.9, zt: 1.9, zmin: 1, zmax: 4 };
      }
      const P = this.pm, k = fit * P.z;
      WM.drawn = { t, z: P.z, here: !!here };   // 検査用（tools/test_worldmap.js）
      // 絵の外へ出ない
      const hw = area.w / 2 / k, hh = area.h / 2 / k;
      P.cx = hw * 2 >= IW ? IW / 2 : Math.max(hw, Math.min(IW - hw, P.cx));
      P.cy = hh * 2 >= IH ? IH / 2 : Math.max(hh, Math.min(IH - hh, P.cy));
      const X = (px) => area.x + area.w / 2 + (px - P.cx) * k, Y = (py) => area.y + area.h / 2 + (py - P.cy) * k;
      const dw = IW * k, dh = IH * k;
      g.save();
      R.UIK.rr(g, area.x, area.y, area.w, area.h, u(10)); g.clip();
      g.fillStyle = '#2a1f14'; g.fillRect(area.x, area.y, area.w, area.h);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(rec.img, X(0), Y(0), dw, dh);
      // 地方の霧: まだ行っていない地方は羊皮紙のしみでかすませる（体験版で閉じた地方は濃く）
      const seen = new Set();
      for (const id of Object.keys(G.visited || {})) { const m = R.DB.maps[id]; if (m && m.region) seen.add(m.region); }
      const C0 = R.DB.config || {}, open = new Set(C0.sliceOpen || []);
      for (const [rid, circles] of Object.entries(WM.regions)) {
        if (seen.has(rid)) continue;
        const reg = R.DB.regions && R.DB.regions[rid];
        const locked = (reg && reg.slice === 'locked') || (C0.slice && open.size && !open.has(rid));
        const a = locked ? 0.8 : 0.55;
        for (const [cx, cy, r] of circles) {
          const gr = g.createRadialGradient(X(cx), Y(cy), 0, X(cx), Y(cy), r * k);
          gr.addColorStop(0, `rgba(214,190,146,${a})`); gr.addColorStop(0.65, `rgba(208,184,140,${a * 0.85})`); gr.addColorStop(1, 'rgba(208,184,140,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(X(cx), Y(cy), r * k, 0, Math.PI * 2); g.fill();
        }
      }
      // 名前（行った町・ダンジョン・エリア）。字は絵に描いていないので、ここで墨の字を重ねる
      const ink = '#3b2614', paper = 'rgba(240,226,192,0.92)';
      // 名前は重ならないように置く: 町 → ダンジョン → エリアの順に、重なれば下・上へずらし、それでも重なる物は出さない（引くと小さい物から消える）
      const labels = [], marks = [];
      // mx, my: 印の位置（町・ダンジョン、絵の px）。下に置けないときは印のすぐ上・右・左に置く（引いたとき、隣の町の名前をよけて遠くへ飛ばない）
      const want = (text, px, py, sz, strong, prio, mx, my) => labels.push({ text, x: X(px), y: Y(py), sz: u(sz), strong, prio, mark: mx != null, mx: X(mx != null ? mx : px), my: Y(my != null ? my : py) });
      for (const m of Object.values(R.DB.maps)) {
        if (!m || m.kind !== 'field' || !(G.visited && G.visited[m.id])) continue;
        const c = this.paintPos(m.id);
        if (c) want(m.name, c[0], c[1] - 10 / k, 12, false, 1);
      }
      const drawn = new Set();
      for (const p of this.places()) {
        if (!p.been || drawn.has(p.map)) continue;
        drawn.add(p.map);
        const c = this.paintPos(p.map);
        if (!c) continue;
        marks.push({ kind: p.kind, x: X(c[0]), y: Y(c[1]) });
        if (p.kind === 'town') want(p.name, c[0], c[1] + 9 / k, 14, true, 3, c[0], c[1]); else want(p.name, c[0], c[1] + 8 / k, 12, false, 2, c[0], c[1]);
      }
      for (const q of marks) {
        if (q.kind === 'town') R.UIK.diamond(g, q.x, q.y, u(5.5), '#8a2d1c', 'rgba(250,236,200,0.9)', 1.5);
        else { g.save(); g.fillStyle = '#20404a'; g.strokeStyle = 'rgba(250,236,200,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, u(4), 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      }
      const placed = marks.map((q) => ({ x0: q.x - u(6), y0: q.y - u(6), x1: q.x + u(6), y1: q.y + u(6) }));
      // 当たりは 0.5 px 以上の重なりだけ（ちょうど接する箱が小数の誤差で当たったり外れたりしない）
      const EPS = 0.5;
      const hit = (b) => placed.some((o) => b.x0 < o.x1 - EPS && b.x1 > o.x0 + EPS && b.y0 < o.y1 - EPS && b.y1 > o.y0 + EPS);
      // 前のフレームで選んだ置き場を先に試す（拡大・縮小の途中で候補が行ったり来たりしない）。名前の札の id は 名前#同じ名前の何番目
      const prev = this.labelPick || new Map(), pick = new Map(), seenN = {}, prevFit = this.labelFit || new Map(), fits = new Map();
      labels.sort((a, b) => b.prio - a.prio);
      // 見え方が前のフレームと同じ（止まっている）なら、前の置き場をそのまま使う（同じ物を毎フレーム置き直さない）
      const sig = [P.z, P.cx, P.cy, area.x, area.y, area.w, area.h, R.SCALE, R.uiScale, labels.map((L) => L.text).join('|')].join(',');
      const same = this.labelSig === sig && this.labelDone;
      if (same) {
        for (const d of this.labelDone) R.UIK.text(g, d.text, d.tx, d.ty, { size: d.sz, weight: d.strong ? 700 : 500, color: ink, align: d.align, stroke: [paper, u(3.2)] });
        labels.forEach((L, i) => { L.drawnAt = this.labelBoxes[i]; });
      }
      const done = [];
      let deferred = false;
      for (const L of same ? [] : labels) {
        const w = R.UIK.measure(L.text, { size: L.sz, weight: L.strong ? 700 : 500 }) + u(6), h = L.sz + u(6);
        let ok = null;
        // 置く所の候補（印の近くから）: 既定（下か上）→ 印のすぐ上 → 印の右・左 → すぐ上で左右に少しずらす → 上下にもうひとつ離す
        //   （引いた ×1 では隣の町の名前とぶつかりやすい。前は上下に 2 段飛ばして、印から離れた所に出ていた）
        const gap = u(9), up = L.my - u(6) - h + u(2), side = L.my - h / 2 + u(2);
        const far = [[L.x, L.y + h, 'center'], [L.x, L.y - h - u(10), 'center'], [L.x, L.y + 2 * h, 'center'], [L.x, L.y - 2 * h - u(10), 'center']];
        const cands = L.mark ? [[L.x, L.y, 'center'], [L.mx, up, 'center'], [L.mx + gap, side, 'left'], [L.mx - gap, side, 'right'],
          [L.mx + w / 3, up, 'center'], [L.mx - w / 3, up, 'center']].concat(far) : [[L.x, L.y, 'center']].concat(far);   // エリアの名前（印なし）は上下だけ
        const key = L.text + '#' + (seenN[L.text] = (seenN[L.text] || 0) + 1);
        const pi = prev.get(key), order = cands.map((c, i) => i);
        if (pi != null && pi > 0 && pi < cands.length) { order.splice(pi, 1); order.unshift(pi); }
        for (const ci of order) {
          const [tx, ty, align] = cands[ci];
          const x0 = align === 'left' ? tx - u(3) : align === 'right' ? tx - w + u(3) : tx - w / 2, y0 = ty - u(2);
          const b = { x0, y0, x1: x0 + w, y1: y0 + h };
          if (!hit(b)) { ok = { b, tx, ty, align }; pick.set(key, ci); break; }
        }
        // 前のフレームで出ていなかった名前は、2 フレーム続けて置けたときに出す（拡大・縮小の途中で 1 フレームだけ出て消えるのを防ぐ）
        const fitN = ok ? (prevFit.get(key) || 0) + 1 : 0;
        fits.set(key, fitN);
        if (ok && prev.size && !prev.has(key) && fitN < 2) { pick.delete(key); deferred = true; continue; }
        if (!ok) continue;
        placed.push(ok.b);
        L.drawnAt = ok.b;
        done.push({ text: L.text, tx: ok.tx, ty: ok.ty, sz: L.sz, strong: L.strong, align: ok.align });
        R.UIK.text(g, L.text, ok.tx, ok.ty, { size: L.sz, weight: L.strong ? 700 : 500, color: ink, align: ok.align, stroke: [paper, u(3.2)] });
      }
      if (!same) { this.labelFit = fits; this.labelPick = pick; this.labelSig = deferred ? null : sig; this.labelDone = done; this.labelBoxes = labels.map((L) => L.drawnAt || null); }
      WM.labels = labels.map((L) => ({ text: L.text, box: L.drawnAt || null }));   // 検査用
      // 目印の手がかり
      const pinned = R.Leads && R.Leads.pinned ? R.Leads.pinned() : null, pinL = pinned && R.DB.leads ? R.DB.leads[pinned] : null;
      if (pinL && pinL.place) {
        const L = R.DB.locations && R.DB.locations[pinL.place];
        const c = this.paintPos(L ? L.map : pinL.place);
        if (c) { const a = 0.6 + 0.4 * Math.sin(t / 600); R.UIK.glow(g, X(c[0]), Y(c[1]) - u(10), u(18), [255, 214, 140], a * 0.6); R.UIK.icon(g, 'pin', X(c[0]) - u(9), Y(c[1]) - u(22), u(18), '#8a2d1c'); }
      }
      // いま（ゆっくり脈打つ輪と矢）
      if (here) {
        const qx = X(here[0]), qy = Y(here[1]), ph = (t % 1600) / 1600, s = u(8);
        g.save(); g.strokeStyle = `rgba(138,45,28,${0.8 * (1 - ph)})`; g.lineWidth = u(2.2); g.beginPath(); g.arc(qx, qy, u(6) + ph * u(20), 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#8a2d1c'; g.strokeStyle = 'rgba(250,236,200,0.95)'; g.lineWidth = u(1.5); g.beginPath();
        g.moveTo(qx, qy - s); g.lineTo(qx + s * 0.7, qy + s * 0.6); g.lineTo(qx, qy + s * 0.25); g.lineTo(qx - s * 0.7, qy + s * 0.6); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      g.restore();
      g.save(); R.UIK.rr(g, area.x, area.y, area.w, area.h, u(10)); g.strokeStyle = 'rgba(236,201,124,0.45)'; g.lineWidth = 1.5; g.stroke(); g.restore();
      // 今いる所の名前（左下）
      const nm = S.placeName();
      if (nm) { R.UIK.panel(g, { x: area.x + u(12), y: area.y + area.h - u(52), w: R.UIK.measure(nm, { size: u(15), weight: 700 }) + u(60), h: u(40) }, { dense: true }); R.UIK.icon(g, 'pin', area.x + u(26), area.y + area.h - u(42), u(16), C.gold); R.UIK.text(g, nm, area.x + u(50), area.y + area.h - u(42), { size: u(15), weight: 700, color: C.text }); }
      S.prompts(g, this.promptList());
      return true;
    },
    places() {
      const G = R.Game || {}, out = [];
      for (const [id, L] of Object.entries(R.DB.locations || {})) {
        if (/^stub_/.test(id) && !(G.visited && G.visited[L.map])) continue;
        const been = !!((G.visited && G.visited[L.map]) || (G.warps && G.warps[id]));
        out.push({ id, name: L.name || id, kind: L.kind || 'place', map: L.map, been, pos: S.worldPosOf(L.map) });
      }
      return out;
    },
    draw(g) {
      if (this.view === 'town') { this.drawTown(g); return; }
      if (this.drawParchment(g)) return;
      const b = S.box(), C = T().color, tall = S.tall(), G = R.Game || {};
      S.heading(g, R.T('ui.map.draw.heading'), b.x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const w = worldMap();
      if (!this.tried) { this.tried = true; try { this.thumb = R.Terrain && R.Terrain.worldThumb ? R.Terrain.worldThumb(R.Tier ? R.Tier.get() : G.tier) : null; } catch (e) { this.thumb = null; } }
      const area = { x: b.x, y: b.y + u(44), w: b.w, h: b.h - u(44) - u(tall ? 90 : 46) };
      const places = this.places();
      const pinned = R.Leads && R.Leads.pinned ? R.Leads.pinned() : null;
      const pinL = pinned && R.DB.leads ? R.DB.leads[pinned] : null;
      if (!w || !this.thumb) {
        R.UIK.panel(g, area, { frost: true });
        R.UIK.text(g, R.T('ui.map.draw.text'), area.x + area.w / 2, area.y + u(40), { size: u(20), weight: 700, color: C.text2, align: 'center' });
        let y = area.y + u(90);
        S.label(g, R.T('ui.map.draw.label'), area.x + u(30), y); y += u(30);
        for (const p of places.filter((q) => q.been)) {
          R.UIK.icon(g, p.kind === 'dungeon' ? 'door' : 'inn', area.x + u(30), y, u(16), C.gold);
          R.UIK.text(g, p.name, area.x + u(56), y, { size: u(15), color: C.text }); y += u(28);
        }
        const here = S.placeName();
        if (here) { R.UIK.icon(g, 'pin', area.x + u(30), y + u(8), u(16), C.teal); R.UIK.text(g, R.T('ui.map.draw.text_2', { here }), area.x + u(56), y + u(8), { size: u(15), color: C.teal }); }
        S.prompts(g, this.promptList());
        return;
      }
      // 一枚絵
      const tw = this.thumb.width, th = this.thumb.height;
      const k = Math.min(area.w / tw, area.h / th);
      const dw = tw * k, dh = th * k, dx = area.x + (area.w - dw) / 2, dy = area.y + (area.h - dh) / 2;
      g.save();
      R.UIK.rr(g, dx - u(6), dy - u(6), dw + u(12), dh + u(12), u(10)); g.fillStyle = 'rgba(10,11,20,0.8)'; g.fill();
      g.strokeStyle = 'rgba(236,201,124,0.35)'; g.lineWidth = 1; g.stroke();
      g.imageSmoothingEnabled = false; g.drawImage(this.thumb, dx, dy, dw, dh);
      g.restore();
      const px = (p) => ({ x: dx + (p.x / w.w) * dw, y: dy + (p.y / w.h) * dh });
      const t = R.Engine.time;
      for (const p of places) {
        if (!p.been || !p.pos) continue;
        const q = px(p.pos);
        if (p.kind === 'town') { R.UIK.diamond(g, q.x, q.y, u(5), C.goldHi, 'rgba(40,24,8,0.9)', 1); R.UIK.text(g, p.name, q.x, q.y + u(8), { size: u(12.5), weight: 700, color: C.text, align: 'center', shadow: true }); }
        else { g.save(); g.fillStyle = C.teal; g.beginPath(); g.arc(q.x, q.y, u(3.5), 0, Math.PI * 2); g.fill(); g.restore(); R.UIK.text(g, p.name, q.x, q.y + u(7), { size: u(11.5), color: C.text2, align: 'center', shadow: true }); }
      }
      // 目印
      if (pinL && pinL.place) {
        const L = R.DB.locations && R.DB.locations[pinL.place];
        const pos = L ? S.worldPosOf(L.map) : S.worldPosOf(pinL.place);
        if (pos) { const q = px(pos); const a = 0.6 + 0.4 * Math.sin(t / 600); R.UIK.glow(g, q.x, q.y - u(10), u(18), [255, 214, 140], a * 0.6); R.UIK.icon(g, 'pin', q.x - u(9), q.y - u(22), u(18), C.gold); }
      }
      // 一行
      const pos = (R.Field && R.Field.pos) || G.pos || {};
      let here = null;
      if (pos.map === w.id) here = { x: pos.x + 0.5, y: pos.y + 0.5 };
      else {
        const m = R.DB.maps[pos.map], wr = m && m.meta && m.meta.worldRect;   // エリア切り替えのフィールド: エリアがワールドのどの四角か（meta.worldRect [x, y, w, h]）から位置を割り出す
        if (wr && m.w && m.h) here = { x: wr[0] + ((pos.x + 0.5) / m.w) * wr[2], y: wr[1] + ((pos.y + 0.5) / m.h) * wr[3] };
        else { const L = m && m.location && R.DB.locations[m.location]; here = S.worldPosOf((L && L.map) || pos.map); }
      }
      if (here) {
        const q = px(here), s = u(7);
        R.UIK.glow(g, q.x, q.y, u(14), [143, 214, 216], 0.5 + 0.2 * Math.sin(t / 400));
        g.save(); g.fillStyle = '#fff1c8'; g.strokeStyle = 'rgba(20,14,6,0.9)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(q.x, q.y - s); g.lineTo(q.x + s * 0.7, q.y + s * 0.6); g.lineTo(q.x, q.y + s * 0.25); g.lineTo(q.x - s * 0.7, q.y + s * 0.6); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      // 凡例
      const lg = tall ? { x: b.x, y: dy + dh + u(20), w: b.w, h: u(76) } : { x: b.x, y: area.y + area.h + u(8), w: Math.min(b.w - u(140), u(560)), h: u(36) };
      R.UIK.panel(g, lg, { dense: true });
      const items = [['diamond', R.T('ui.map.draw.items.0.1')], ['dot', R.T('ui.map.draw.items.1')], ['pin', R.T('ui.map.draw.items.2.1')], ['arrow', R.T('ui.map.draw.items.3.1')]];
      items.forEach(([kind, lab], i) => {
        const cols = tall ? 2 : 4;
        const x = lg.x + u(18) + (i % cols) * ((lg.w - u(18)) / cols), y = lg.y + (tall ? u(14) : u(10)) + Math.floor(i / cols) * u(26);
        if (kind === 'diamond') R.UIK.diamond(g, x + u(6), y + u(7), u(5), C.goldHi);
        else if (kind === 'dot') { g.save(); g.fillStyle = C.teal; g.beginPath(); g.arc(x + u(6), y + u(7), u(3.5), 0, Math.PI * 2); g.fill(); g.restore(); }
        else if (kind === 'pin') R.UIK.icon(g, 'pin', x - u(1), y - u(1), u(15), C.gold);
        else R.UIK.icon(g, 'up', x - u(1), y - u(1), u(15), '#fff1c8');
        R.UIK.text(g, lab, x + u(22), y, { size: u(12.5), color: C.text2 });
      });
      S.prompts(g, this.promptList());
    },
  });
})(window.RPG);
