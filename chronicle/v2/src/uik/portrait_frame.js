// UIK: 顔の枠（MODERN_UI §6.3・§2.5.16）。中身は R.Portrait（CAST。描いた顔 → hd:face → 無し）
//   portraitFrame(g, rect, key, o)   key = 'look' | 'look:expr' | {look, expr}。rect は掛けた後の論理 px
//   o = {dim（暗く）, r, ring:true, bg:[上, 下]}
//   UIK.hasFace(key) → bool   顔があるか（無い人は枠ごと出さない、MODERN_UI §6.3）
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});

  function parse(key) {
    if (key && typeof key === 'object') return { look: key.look || '', expr: key.expr || 'neutral' };
    if (R.Portrait && R.Portrait.parse) return R.Portrait.parse(String(key || ''));
    const [look, expr] = String(key || '').split(':');
    return { look: look || '', expr: expr || 'neutral' };
  }
  UIK.hasFace = function (key) {
    if (!key) return false;
    const p = parse(key);
    if (!p.look) return false;
    try { return !!(R.Portrait && R.Portrait.has && R.Portrait.has(p.look, p.expr)); } catch (e) { return false; }
  };

  UIK.portraitFrame = function (g, rect, key, o) {
    o = o || {};
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    const r = o.r != null ? o.r : Math.min(UIK.u(8), w / 8);
    const bg = o.bg || ['#3a3440', '#1a1820'];
    g.save();
    UIK.rr(g, x, y, w, h, r); g.clip();
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    UIK.glow(g, x + w * 0.62, y + h * 0.2, w * 0.9, [255, 220, 170], 0.16);
    if (key) {
      const p = parse(key);
      if (p.look && R.Portrait && R.Portrait.draw) {
        g.imageSmoothingEnabled = false;
        try { R.Portrait.draw(g, p.look, { x, y, w, h }, { expr: p.expr, dim: o.dim }); } catch (e) { /* 顔の絵は無くてよい */ }
      }
    }
    if (o.dim) { g.fillStyle = 'rgba(8,9,16,0.45)'; g.fillRect(x, y, w, h); }
    g.restore();
    if (o.ring !== false) {
      g.save(); UIK.rr(g, x + 0.25, y + 0.25, w - 0.5, h - 0.5, r);
      g.strokeStyle = o.ringColor || 'rgba(240,228,200,0.28)'; g.lineWidth = 1; g.stroke(); g.restore();
    }
  };
})(window.RPG);
