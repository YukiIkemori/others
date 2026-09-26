// UIK: ゲージ・数字・星（MODERN_UI §3.1・§3.2）
//   gauge(g, rect, cur, max, kind, o)   kind = 'hp'|'mp'|'exp'|[色, 色]。HP は 50% 未満で琥珀、25% 未満で赤（色覚の補助では緑 → 青）
//                                       o = {ghost: 0〜1（被ダメージの白い残像）}。rect.h は 1〜3 px の細い線（掛けた後）
//   frac(g, cur, max, x, y, o)          「現在」を太く大きく、「/ 最大」を 0.72 倍の細字で。x は右端（右寄せ）。→ 幅
//   stars(g, grade, x, y, size)         'rare' ★（#86c8ff）| 'super' ★★（#ffb65e）| 数
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});

  UIK.gaugeColors = function (k, kind) {
    const C = UIK.T.color;
    if (Array.isArray(kind)) return kind;
    if (kind === 'mp') return C.mp;
    if (kind === 'exp') return C.exp;
    if (k < 0.25) return C.hpCrit;
    if (k < 0.5) return C.hpLow;
    return UIK.setting('colorAssist', false) ? C.hpAssist : C.hp;
  };

  UIK.gauge = function (g, rect, cur, max, kind, o) {
    o = o || {};
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h || 3;
    const k = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
    const cols = UIK.gaugeColors(k, kind || 'hp');
    g.save();
    UIK.rr(g, x, y, w, h, h / 2); g.fillStyle = 'rgba(6,8,12,0.6)'; g.fill();
    if (o.ghost != null && o.ghost > k) { UIK.rr(g, x, y, w * Math.min(1, o.ghost), h, h / 2); g.fillStyle = 'rgba(255,240,220,0.35)'; g.fill(); }
    if (k > 0) {
      UIK.rr(g, x, y, Math.max(h, w * k), h, h / 2);
      const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
      g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x + 1, y, Math.max(0, w * k - 2), Math.max(0.5, h * 0.35));
    }
    g.restore();
  };

  /** 数字を 3 桁ごとに区切る（1,284） */
  UIK.num = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };

  /** 現在／最大の幅（掛けた後）。o = {size} */
  UIK.fracWidth = function (cur, max, o) {
    const sz = (o && o.size) || UIK.u(UIK.T.size.body);
    return UIK.measure(String(cur), { size: sz, weight: 700 }) + UIK.u(4) + UIK.measure('/ ' + max, { size: sz * 0.72 });
  };
  /** 「現在 / 最大」を右寄せで。x は右端、y は大きい字の上端。o = {size, color, sub, low: bool（25% 未満で琥珀）, shadow} */
  UIK.frac = function (g, cur, max, x, y, o) {
    o = o || {};
    const T = UIK.T, sz = o.size || UIK.u(T.size.body);
    const low = o.low !== false && max > 0 && cur / max < 0.25;
    const sw = UIK.measure('/ ' + max, { size: sz * 0.72 });
    UIK.text(g, '/ ' + max, x, y + sz * 0.26, { size: sz * 0.72, color: o.sub || T.color.text3, align: 'right', shadow: o.shadow });
    UIK.text(g, String(cur), x - sw - UIK.u(4), y, { size: sz, weight: 700, color: low ? T.color.gold : o.color || T.color.text, align: 'right', shadow: o.shadow });
    return UIK.fracWidth(cur, max, o);
  };

  /** レア度の星。grade = 'rare'|'super'|数。size は掛けた後（既定 label）。→ 幅 */
  UIK.stars = function (g, grade, x, y, size) {
    const T = UIK.T;
    const n = grade === 'super' || grade === 'superRare' ? 2 : grade === 'rare' ? 1 : typeof grade === 'number' ? grade : 0;
    const s = size || UIK.u(T.size.label);
    const col = n >= 2 ? T.color.superRare : T.color.rare;
    for (let i = 0; i < n; i++) UIK.icon(g, 'star', x + i * s * 0.9, y, s, col);
    return n ? s * 0.9 * (n - 1) + s : 0;
  };
})(window.RPG);
