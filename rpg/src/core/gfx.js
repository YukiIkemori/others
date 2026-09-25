// Graphics: canvas setup, sprite registry, pixel-art builders, text & windows.
// All drawing uses LOGICAL coordinates (256x224). The backing canvas is
// R.SCALE× (4× = 1024x896) and the context carries that transform, so sprites
// stay pixel-crisp (smoothing off) while text is rasterised at full resolution.
// The field layer temporarily switches to its own scale (see field.js).
(function (R) {
  'use strict';
  const U = R.U;

  const Gfx = (R.Gfx = {
    canvas: null,
    ctx: null,
    // Text size in logical px (unchanged since the 3× canvas: 32 device px there,
    // 42⅔ on the 4× canvas — same layout, same on-screen size).
    FONT: '"DotGothic16", "Hiragino Kaku Gothic ProN", "Meiryo", "Noto Sans JP", monospace',
    FS: 32 / 3, // default text size (logical px)
    LH: 14, // default line height (logical px)
    C: {
      white: '#ffffff', gray: '#8c8c8c', dark: '#404040', black: '#000000',
      red: '#ff5a4a', orange: '#ffa53c', yellow: '#ffe45a', green: '#6ee07a',
      cyan: '#6fd8ff', blue: '#4a78ff', purple: '#c38cff', pink: '#ff8cc6',
      gold: '#ffd24a', hpLow: '#ffb03c', dead: '#ff4a4a',
    },
    // window color themes (Settings.windowColor)
    WINDOW_THEMES: {
      black: { fill: '#000000', fill2: null, border: '#ffffff', alpha: 1 },
      blue: { fill: '#1c2c8c', fill2: '#0a1450', border: '#ffffff', alpha: 0.96 },
      green: { fill: '#0e4a2a', fill2: '#062414', border: '#ffffff', alpha: 0.96 },
      red: { fill: '#5a1420', fill2: '#2a060c', border: '#ffffff', alpha: 0.96 },
    },

    init(canvas) {
      Gfx.canvas = canvas;
      canvas.width = R.W * R.SCALE;
      canvas.height = R.H * R.SCALE;
      Gfx.ctx = canvas.getContext('2d', { alpha: false });
      Gfx.reset();
    },
    /** restore the default R.SCALE× transform & state (call after any save/restore mishap) */
    reset() {
      const c = Gfx.ctx;
      c.setTransform(R.SCALE, 0, 0, R.SCALE, 0, 0);
      c.imageSmoothingEnabled = false;
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.textBaseline = 'top';
    },

    // ------------------------------------------------------ primitives
    clear(color = '#000') { const c = Gfx.ctx; c.fillStyle = color; c.fillRect(0, 0, R.W, R.H); },
    rect(x, y, w, h, color) { const c = Gfx.ctx; c.fillStyle = color; c.fillRect(x, y, w, h); },
    strokeRect(x, y, w, h, color, lw = 1) {
      Gfx.rect(x, y, w, lw, color); Gfx.rect(x, y + h - lw, w, lw, color);
      Gfx.rect(x, y, lw, h, color); Gfx.rect(x + w - lw, y, lw, h, color);
    },
    /** draw a canvas/image. opts: {flip:bool, alpha, sx,sy,sw,sh (source rect), w,h (dest size)} */
    draw(img, x, y, opts) {
      if (!img) return;
      const c = Gfx.ctx;
      x = Math.round(x); y = Math.round(y);
      if (!opts) { c.drawImage(img, x, y); return; }
      const sx = opts.sx || 0, sy = opts.sy || 0;
      const sw = opts.sw || img.width, sh = opts.sh || img.height;
      const w = opts.w || sw, h = opts.h || sh;
      const a = c.globalAlpha;
      if (opts.alpha != null) c.globalAlpha = a * opts.alpha;
      if (opts.flip) {
        c.save(); c.translate(x + w, y); c.scale(-1, 1);
        c.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        c.restore();
      } else c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      c.globalAlpha = a;
    },
    /** draw an image tinted with a flat color (hit flash) */
    drawTinted(img, x, y, color, amount = 1) {
      const key = color;
      img._tint = img._tint || {};
      let t = img._tint[key];
      if (!t) {
        t = Gfx.makeCanvas(img.width, img.height);
        const tc = t.getContext('2d');
        tc.drawImage(img, 0, 0);
        tc.globalCompositeOperation = 'source-in';
        tc.fillStyle = color; tc.fillRect(0, 0, img.width, img.height);
        img._tint[key] = t;
      }
      Gfx.draw(img, x, y);
      Gfx.draw(t, x, y, { alpha: amount });
    },

    // ------------------------------------------------------------ text
    font(size) { return `${size || Gfx.FS}px ${Gfx.FONT}`; },
    /**
     * Draw text. opts: {color, size, align:'left'|'right'|'center', shadow:bool|color, alpha}
     * (x,y) is the top-left (or top-right/top-center per align).
     */
    text(str, x, y, opts) {
      const c = Gfx.ctx;
      const o = opts || {};
      c.font = Gfx.font(o.size);
      c.textAlign = o.align || 'left';
      c.textBaseline = 'top';
      const a = c.globalAlpha;
      if (o.alpha != null) c.globalAlpha = a * o.alpha;
      str = R.Text ? R.Text.fmt(str) : String(str);
      if (o.shadow) {
        c.fillStyle = o.shadow === true ? '#000' : o.shadow;
        c.fillText(str, x + 2 / 3, y + 2 / 3);
      }
      c.fillStyle = o.color || Gfx.C.white;
      c.fillText(str, x, y);
      c.globalAlpha = a;
    },
    textWidth(str, size) {
      const c = Gfx.ctx;
      c.font = Gfx.font(size);
      return c.measureText(R.Text ? R.Text.fmt(str) : String(str)).width;
    },
    /**
     * Wrap text into lines that fit width (honours \n). Unspaced Japanese: a line
     * that fits stays whole; otherwise it breaks at the last natural phrase boundary
     * in the second half of the line (after punctuation / a space, or between a
     * particle and the next word), falling back to a plain char break. Kinsoku:
     * a line never starts with closing punctuation or a small kana — the previous
     * character moves down with it instead of spilling past the window border.
     */
    wrap(str, width, size) {
      str = R.Text ? R.Text.fmt(str) : String(str);
      const key = str + '\u0000' + width + '\u0000' + (size || '');
      const hit = WRAP_CACHE.get(key);
      if (hit) return hit.slice();
      const out = [];
      const fits = (s) => Gfx.textWidth(s, size) <= width;
      for (let para of str.split('\n')) {
        let guard = 0;
        while (para && !fits(para) && guard++ < 200) {
          let n = 1;
          while (n < para.length && fits(para.slice(0, n + 1))) n++;
          let cut = 0;
          for (let k = n; k > 0 && k >= n / 2; k--) if (niceBreak(para, k)) { cut = k; break; }
          if (!cut) { cut = n; while (cut > 1 && NO_START.includes(para[cut])) cut--; }
          out.push(para.slice(0, cut).replace(/[ 　]+$/, ''));
          para = para.slice(cut).replace(/^[ 　]+/, '');
        }
        out.push(para);
      }
      if (WRAP_CACHE.size > 400) WRAP_CACHE.clear();
      WRAP_CACHE.set(key, out);
      return out.slice();
    },
    /** draw text squeezed horizontally to fit maxW (names in narrow columns) */
    fitText(str, x, y, maxW, opts) {
      const w = Gfx.textWidth(str, opts && opts.size);
      if (w <= maxW || maxW <= 0) { Gfx.text(str, x, y, opts); return; }
      const c = Gfx.ctx;
      const al = (opts && opts.align) || 'left';
      const ox = al === 'right' ? x - maxW : al === 'center' ? x - maxW / 2 : x;
      c.save(); c.translate(ox, y); c.scale(maxW / w, 1);
      Gfx.text(str, 0, 0, Object.assign({}, opts, { align: 'left' }));
      c.restore();
    },

    // --------------------------------------------------------- windows
    /**
     * DQ-style window. opts: {theme, alpha, title}
     * Border is drawn with pixel rects so it scales crisply.
     */
    window(x, y, w, h, opts) {
      const o = opts || {};
      const theme = Gfx.WINDOW_THEMES[o.theme || (R.Settings && R.Settings.windowColor) || 'black'] || Gfx.WINDOW_THEMES.black;
      const c = Gfx.ctx;
      const a = c.globalAlpha;
      c.globalAlpha = a * (o.alpha != null ? o.alpha : theme.alpha);
      // body (rounded 2px corners)
      if (theme.fill2) {
        const g = c.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, theme.fill); g.addColorStop(1, theme.fill2);
        c.fillStyle = g;
      } else c.fillStyle = theme.fill;
      c.fillRect(x + 2, y, w - 4, h);
      c.fillRect(x, y + 2, w, h - 4);
      c.fillRect(x + 1, y + 1, w - 2, h - 2);
      c.globalAlpha = a;
      // border: 1px white line inset by 2, rounded
      const b = theme.border;
      Gfx.rect(x + 4, y + 2, w - 8, 1, b);
      Gfx.rect(x + 4, y + h - 3, w - 8, 1, b);
      Gfx.rect(x + 2, y + 4, 1, h - 8, b);
      Gfx.rect(x + w - 3, y + 4, 1, h - 8, b);
      Gfx.rect(x + 3, y + 3, 1, 1, b);
      Gfx.rect(x + w - 4, y + 3, 1, 1, b);
      Gfx.rect(x + 3, y + h - 4, 1, 1, b);
      Gfx.rect(x + w - 4, y + h - 4, 1, 1, b);
      if (o.title) {
        const tw = Math.ceil(Gfx.textWidth(o.title)) + 8;
        const tx = x + Math.floor((w - tw) / 2);
        // solid plate behind the title: it sits on the top border and never shows the field through it
        Gfx.rect(tx, Math.max(0, y - 3), tw, 8 + Math.min(0, y - 3), theme.fill);
        Gfx.text(o.title, tx + 4, y - 3, { color: Gfx.C.white });
      }
    },
    /** blinking ▶ cursor whose tip is at (x+6, y+5); pass blink:false for a solid one */
    cursor(x, y, blink = true) {
      if (blink && R.Engine && Math.floor(R.Engine.frame / 16) % 2 === 1) return;
      const c = Gfx.C.white;
      for (let i = 0; i < 4; i++) Gfx.rect(x + i, y + 1 + i, 1, 9 - i * 2, c);
      Gfx.rect(x + 4, y + 5, 1, 1, c);
    },
    /** small ▼ "more text" marker */
    moreArrow(x, y) {
      if (R.Engine && Math.floor(R.Engine.frame / 16) % 2 === 1) return;
      for (let i = 0; i < 4; i++) Gfx.rect(x + i, y + i, 7 - i * 2, 1, Gfx.C.white);
    },
    bar(x, y, w, h, ratio, color, bg = '#303030') {
      Gfx.rect(x, y, w, h, bg);
      Gfx.rect(x, y, Math.max(0, Math.round(w * U.clamp(ratio, 0, 1))), h, color);
    },

    // -------------------------------------------------- sprite registry
    _defs: {},
    _cache: {},
    _warned: {},
    /** Register a lazily built graphic. factory() may return a canvas, an array of canvases, or any object. */
    def(key, factory) { Gfx._defs[key] = factory; delete Gfx._cache[key]; },
    has(key) { return key in Gfx._defs; },
    get(key) {
      if (key in Gfx._cache) return Gfx._cache[key];
      const f = Gfx._defs[key];
      let v;
      if (!f) {
        if (!Gfx._warned[key]) { Gfx._warned[key] = 1; R.warn('missing graphic', key); }
        v = Gfx.placeholder(16, 16);
      } else {
        try { v = f(); } catch (e) { console.error('graphic factory failed', key, e); v = Gfx.placeholder(16, 16); }
      }
      Gfx._cache[key] = v;
      return v;
    },
    /**
     * Cached color variant of a registered graphic (for monster palette swaps).
     * opts: {hue:deg, sat:mult, bri:mult, pal:{'#from':'#to'}}. Returns a canvas.
     */
    variant(key, opts) {
      if (!opts || (!opts.hue && !opts.pal && opts.sat == null && opts.bri == null)) return Gfx.get(key);
      const vk = key + '|' + JSON.stringify(opts);
      if (vk in Gfx._cache) return Gfx._cache[vk];
      let base = Gfx.get(key);
      if (Array.isArray(base)) base = base[0];
      let out = opts.pal ? Gfx.recolor(base, opts.pal) : base;
      if (opts.hue || opts.sat != null || opts.bri != null) out = Gfx.hsvShift(out, opts.hue || 0, opts.sat == null ? 1 : opts.sat, opts.bri == null ? 1 : opts.bri);
      Gfx._cache[vk] = out;
      return out;
    },
    /** rotate hue by deg, multiply saturation/brightness (keeps near-black/near-gray outlines) */
    hsvShift(canvas, deg, satMul, briMul) {
      return Gfx.mapColors(canvas, (r, g, b) => {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        let h = 0;
        if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h = (h * 60 + deg + 360) % 360;
        let s = mx ? d / mx : 0, v = mx / 255;
        if (s > 0.12) s = U.clamp(s * satMul, 0, 1);
        v = U.clamp(v * briMul, 0, 1);
        const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
        const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
        return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
      });
    },
    placeholder(w, h) {
      const cv = Gfx.makeCanvas(w, h), c = cv.getContext('2d');
      for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
        c.fillStyle = ((x + y) / 4) % 2 ? '#ff00ff' : '#200020'; c.fillRect(x, y, 4, 4);
      }
      return cv;
    },

    // ----------------------------------------------- pixel-art builders
    makeCanvas(w, h) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      return cv;
    },
    /**
     * Build a canvas from an ASCII grid. rows: string[] (all same length).
     * pal: {char: '#rrggbb' | '#rrggbbaa' | null}. '.' and ' ' are transparent unless in pal.
     */
    fromGrid(rows, pal) {
      const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const p = new Pix(w, h);
      p.grid(0, 0, rows, pal);
      return p.toCanvas();
    },
    /** new pixel buffer (see Pix below) */
    pix(w, h) { return new Pix(w, h); },
    /** palette swap: map {'#from':'#to'} (exact rgb match) → new canvas */
    recolor(canvas, map) {
      const w = canvas.width, h = canvas.height;
      const out = Gfx.makeCanvas(w, h), oc = out.getContext('2d');
      oc.drawImage(canvas, 0, 0);
      const id = oc.getImageData(0, 0, w, h), d = id.data;
      const m = {};
      for (const k in map) m[hexToInt(k)] = hexToRgb(map[k]);
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        const t = m[key];
        if (t) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
      }
      oc.putImageData(id, 0, 0);
      return out;
    },
    /** hue/brightness variant of a whole sprite: fn(r,g,b) -> [r,g,b] */
    mapColors(canvas, fn) {
      const w = canvas.width, h = canvas.height;
      const out = Gfx.makeCanvas(w, h), oc = out.getContext('2d');
      oc.drawImage(canvas, 0, 0);
      const id = oc.getImageData(0, 0, w, h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const r = fn(d[i], d[i + 1], d[i + 2]);
        d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2];
      }
      oc.putImageData(id, 0, 0);
      return out;
    },
    flipH(canvas) {
      const out = Gfx.makeCanvas(canvas.width, canvas.height), c = out.getContext('2d');
      c.translate(canvas.width, 0); c.scale(-1, 1); c.drawImage(canvas, 0, 0);
      return out;
    },
    /** lighten (amt>0) / darken (amt<0) a hex color, amt in -1..1 */
    shade(hex, amt) {
      const [r, g, b] = hexToRgb(hex);
      const f = (v) => U.clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
      return rgbToHex(f(r), f(g), f(b));
    },
    /** n-step ramp dark→light around a base color */
    ramp(hex, n = 4, spread = 0.55) {
      const out = [];
      for (let i = 0; i < n; i++) out.push(Gfx.shade(hex, -spread + (2 * spread * i) / Math.max(1, n - 1)));
      return out;
    },
    mix(a, b, t) {
      const x = hexToRgb(a), y = hexToRgb(b);
      return rgbToHex(Math.round(U.lerp(x[0], y[0], t)), Math.round(U.lerp(x[1], y[1], t)), Math.round(U.lerp(x[2], y[2], t)));
    },
    hexToRgb, rgbToHex,
  });

  // ---- line-break rules (unspaced Japanese; shared by message windows and battle)
  const WRAP_CACHE = new Map();
  const NO_START = '、。，．！？!?）」』】…ー・：ぁぃぅぇぉっゃゅょァィゥェォッャュョ';
  const BREAK_AFTER = '、。！？!?）」』　 ：';
  const KANA = /[\u3041-\u309f]/; // hiragana
  const KANJI = /[\u4e00-\u9fff々]/;
  // one-kana particles; after a kanji only は/を are safe (と/に/で/の/が can be okurigana: 落とす, 上がる)
  const PARTICLE = 'はをにでともへの';
  /** true when a line may break between s[k-1] and s[k] at a natural phrase boundary */
  function niceBreak(s, k) {
    const a = s[k - 1], b = s[k];
    if (!a || !b || NO_START.includes(b)) return false;
    if (BREAK_AFTER.includes(a)) return true;
    if (!KANA.test(a)) return false;
    if (!KANA.test(b)) return true; // particle / okurigana → next word (kanji, katakana, digits, 「『★)
    const w = s[k - 2]; // word + one-kana particle → hiragana word
    if (!w || KANA.test(w) || !PARTICLE.includes(a)) return false;
    return !KANJI.test(w) || a === 'は' || a === 'を';
  }
  Gfx.NO_START = NO_START;

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hexToInt(h) { const [r, g, b] = hexToRgb(h); return (r << 16) | (g << 8) | b; }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''); }

  /**
   * Pix — a tiny pixel buffer for authoring sprites procedurally.
   * Colors are '#rrggbb' strings (or null = transparent). All ops clip.
   * Typical monster recipe:
   *   const p = R.Gfx.pix(48,48);
   *   p.shadeEllipse(24,28,16,14, R.Gfx.ramp('#3c8cff',5));  // shaded body
   *   p.ellipse(18,24,3,4,'#fff'); p.set(18,25,'#000');          // eye
   *   p.mirrorX();                                              // symmetry
   *   p.outline('#101018');                                      // dark outline
   *   return p.toCanvas();
   */
  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (this.in(x, y)) this.d[y * this.w + x] = c; return this; }
    get(x, y) { return this.in(x, y) ? this.d[y * this.w + x] : null; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
    hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); return this; }
    vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); return this; }
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) this.set(x, y, c);
        }
      return this;
    }
    circle(cx, cy, r, c) { return this.ellipse(cx, cy, r, r, c); }
    /**
     * Sphere-shaded ellipse. ramp = colors dark→light. light = [lx,ly] direction
     * toward the light (default upper-left). dither: checkerboard between steps.
     */
    shadeEllipse(cx, cy, rx, ry, ramp, opts) {
      const o = opts || {};
      const lx = o.light ? o.light[0] : -0.55, ly = o.light ? o.light[1] : -0.65;
      const n = ramp.length;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const nz = Math.sqrt(1 - d2);
          let l = dx * lx + dy * ly + nz * 0.6; // lambert-ish
          l = U.clamp((l + 0.35) / 1.35, 0, 0.999);
          let idx = l * n;
          if (o.dither !== false) { const fr = idx - Math.floor(idx); if (fr > 0.5 && (x + y) % 2) idx += 0.5; }
          this.set(x, y, ramp[U.clamp(Math.floor(idx), 0, n - 1)]);
        }
      return this;
    }
    line(x0, y0, x1, y1, c, thick = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        if (thick <= 1) this.set(x, y, c);
        else this.rect(Math.round(x - (thick - 1) / 2), Math.round(y - (thick - 1) / 2), thick, thick, c);
      }
      return this;
    }
    /** filled polygon: pts [[x,y],...] */
    poly(pts, c) {
      let minY = Infinity, maxY = -Infinity;
      for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) {
            xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2)
          for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
      }
      return this;
    }
    /** stamp an ASCII grid at (ox,oy); '.'/' ' transparent unless in pal */
    grid(ox, oy, rows, pal) {
      for (let y = 0; y < rows.length; y++) {
        const r = rows[y];
        for (let x = 0; x < r.length; x++) {
          const ch = r[x];
          if (!(ch in pal) && (ch === '.' || ch === ' ')) continue;
          const c = pal[ch];
          if (c === undefined) continue;
          if (c !== null) this.set(ox + x, oy + y, c);
        }
      }
      return this;
    }
    /** copy left half onto right half (horizontal symmetry) */
    mirrorX() {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < Math.floor(this.w / 2); x++)
        this.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x];
      return this;
    }
    /** 1px outline around all opaque pixels (4-neighbour; diag:true for 8) */
    outline(c, opts) {
      const diag = opts && opts.diag;
      const src = this.d.slice();
      const at = (x, y) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : null);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        let n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        if (!n && diag) n = at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1);
        if (n) this.d[y * this.w + x] = c;
      }
      return this;
    }
    /** replace every pixel of color a with b */
    replace(a, b) { for (let i = 0; i < this.d.length; i++) if (this.d[i] === a) this.d[i] = b; return this; }
    /** apply fn(x,y,color)->color|undefined to every opaque pixel */
    each(fn) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        if (c == null) continue;
        const r = fn(x, y, c);
        if (r !== undefined) this.d[y * this.w + x] = r;
      }
      return this;
    }
    /** draw another Pix on top (null pixels skipped) */
    blit(p, ox, oy) {
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const c = p.d[y * p.w + x];
        if (c != null) this.set(ox + x, oy + y, c);
      }
      return this;
    }
    toCanvas() {
      const cv = Gfx.makeCanvas(this.w, this.h);
      const c = cv.getContext('2d');
      const id = c.createImageData(this.w, this.h), dd = id.data;
      for (let i = 0; i < this.d.length; i++) {
        const col = this.d[i];
        if (!col) continue;
        const [r, g, b] = hexToRgb(col.slice(0, 7));
        dd[i * 4] = r; dd[i * 4 + 1] = g; dd[i * 4 + 2] = b;
        dd[i * 4 + 3] = col.length > 7 ? parseInt(col.slice(7, 9), 16) : 255;
      }
      c.putImageData(id, 0, 0);
      return cv;
    }
  }
  Gfx.Pix = Pix;
})(window.RPG);
