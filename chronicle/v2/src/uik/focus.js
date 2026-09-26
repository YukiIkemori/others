// UIK: フォーカス（選んでいる所、MODERN_UI §3.5）
//   focus(g, rect, t, o)  琥珀の左の線・左から薄くなる帯・細い縁・左端の光る菱形。t は R.Engine.time（光の脈動 1.6 秒 ±10%）
//   o = {r, cursor:true, strong:true, paper:false}   paper は羊皮紙の上（茶の帯）
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});

  UIK.focus = function (g, rect, t, o) {
    o = o || {};
    const T = UIK.T, x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    const r = o.r != null ? o.r : UIK.u(6);
    const pulse = UIK.lessFlash() || t == null ? 1 : 1 + 0.1 * Math.sin((t / T.ms.pulse) * Math.PI * 2);
    g.save();
    UIK.rr(g, x, y, w, h, r); g.clip();
    const gr = g.createLinearGradient(x, 0, x + w, 0);
    if (o.paper) {
      gr.addColorStop(0, `rgba(120,80,30,${0.2 * pulse})`); gr.addColorStop(0.75, 'rgba(120,80,30,0.08)'); gr.addColorStop(1, 'rgba(120,80,30,0.04)');
    } else {
      const a0 = (o.strong === false ? 0.16 : 0.30) * pulse;
      gr.addColorStop(0, `rgba(236,201,124,${a0})`); gr.addColorStop(0.7, 'rgba(236,201,124,0.07)'); gr.addColorStop(1, 'rgba(236,201,124,0.02)');
    }
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = o.paper ? '#a8672a' : T.color.gold; g.fillRect(x, y, 2, h);
    g.restore();
    g.save();
    UIK.rr(g, x, y, w, h, r);
    g.strokeStyle = o.paper ? 'rgba(120,80,30,0.35)' : `rgba(236,201,124,${0.45 * pulse})`; g.lineWidth = 0.75; g.stroke();
    g.restore();
    if (o.cursor !== false) {
      const cs = Math.max(3, h * 0.12);
      if (!o.paper) UIK.glow(g, x + 1, y + h / 2, cs * 2.6, [255, 220, 150], 0.5 * pulse);
      UIK.diamond(g, x + 1, y + h / 2, cs, o.paper ? '#a8672a' : T.color.goldHi, o.paper ? null : 'rgba(90,60,20,0.8)', 0.75);
    }
  };
})(window.RPG);
