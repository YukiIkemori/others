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
    },
    update() {
      const I = R.Input;
      if (this.town && (I.pressed('y') || I.pressed('r'))) { R.UIK.sfx('cursor'); this.view = this.view === 'town' ? 'world' : 'town'; return; }
      if (I.pressed('b') || I.pressed('a') || I.pressed('x')) { R.UIK.sfx('cancel'); this.close(undefined); }
    },
    promptList() {
      if (!this.town) return [{ btn: 'b', label: '戻る' }];
      return [{ btn: 'y', label: this.view === 'town' ? '世界の地図' : '町の地図' }, { btn: 'b', label: '閉じる' }];
    },
    /** 町の地図（R.Field.townmap が描く）: 町の名前・地図・凡例 */
    drawTown(g) {
      const b = S.box(), C = T().color, tall = S.tall(), m = R.DB.maps[this.town];
      S.heading(g, '町の地図', b.x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      R.UIK.text(g, m.name || m.id, b.x + u(8), b.y + u(26), { size: u(19), weight: 700, color: C.text });
      const lw = tall ? b.w : Math.min(b.w, u(900));
      const lh = R.Field.townmap.legendHeight(m.id, lw);
      const area = { x: b.x + u(8), y: b.y + u(60), w: b.w - u(16), h: b.h - u(60) - lh - u(tall ? 70 : 18) };
      const r = R.Field.townmap.draw(g, area, m.id) || area;
      R.Field.townmap.legend(g, { x: b.x + (b.w - lw) / 2, y: Math.min(r.y + r.h + u(14), b.y + b.h - lh - u(tall ? 56 : 4)), w: lw, h: lh }, m.id);
      S.prompts(g, this.promptList());
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
      const b = S.box(), C = T().color, tall = S.tall(), G = R.Game || {};
      S.heading(g, '地図', b.x + u(8), b.y + u(6), 0, { size: 15, track: 4 });
      const w = worldMap();
      if (!this.tried) { this.tried = true; try { this.thumb = R.Terrain && R.Terrain.worldThumb ? R.Terrain.worldThumb(R.Tier ? R.Tier.get() : G.tier) : null; } catch (e) { this.thumb = null; } }
      const area = { x: b.x, y: b.y + u(44), w: b.w, h: b.h - u(44) - u(tall ? 90 : 46) };
      const places = this.places();
      const pinned = R.Leads && R.Leads.pinned ? R.Leads.pinned() : null;
      const pinL = pinned && R.DB.leads ? R.DB.leads[pinned] : null;
      if (!w || !this.thumb) {
        R.UIK.panel(g, area, { frost: true });
        R.UIK.text(g, 'まだ知らない土地', area.x + area.w / 2, area.y + u(40), { size: u(20), weight: 700, color: C.text2, align: 'center' });
        let y = area.y + u(90);
        S.label(g, '行った場所', area.x + u(30), y); y += u(30);
        for (const p of places.filter((q) => q.been)) {
          R.UIK.icon(g, p.kind === 'dungeon' ? 'door' : 'inn', area.x + u(30), y, u(16), C.gold);
          R.UIK.text(g, p.name, area.x + u(56), y, { size: u(15), color: C.text }); y += u(28);
        }
        const here = S.placeName();
        if (here) { R.UIK.icon(g, 'pin', area.x + u(30), y + u(8), u(16), C.teal); R.UIK.text(g, '今いる所：' + here, area.x + u(56), y + u(8), { size: u(15), color: C.teal }); }
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
      else { const m = R.DB.maps[pos.map]; const L = m && m.location && R.DB.locations[m.location]; here = S.worldPosOf((L && L.map) || pos.map); }
      if (here) {
        const q = px(here), s = u(7);
        R.UIK.glow(g, q.x, q.y, u(14), [143, 214, 216], 0.5 + 0.2 * Math.sin(t / 400));
        g.save(); g.fillStyle = '#fff1c8'; g.strokeStyle = 'rgba(20,14,6,0.9)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(q.x, q.y - s); g.lineTo(q.x + s * 0.7, q.y + s * 0.6); g.lineTo(q.x, q.y + s * 0.25); g.lineTo(q.x - s * 0.7, q.y + s * 0.6); g.closePath(); g.fill(); g.stroke(); g.restore();
      }
      // 凡例
      const lg = tall ? { x: b.x, y: dy + dh + u(20), w: b.w, h: u(76) } : { x: b.x, y: area.y + area.h + u(8), w: Math.min(b.w - u(140), u(560)), h: u(36) };
      R.UIK.panel(g, lg, { dense: true });
      const items = [['diamond', '町'], ['dot', 'ダンジョン'], ['pin', '目印の手がかり'], ['arrow', 'いま']];
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
