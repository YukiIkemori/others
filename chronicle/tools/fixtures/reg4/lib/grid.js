// R4 (reg4) layout kit: a tiny stamp grid used by layout.js to compose the region-4 maps.
// Node-only (lives in lib/ so `build.js --with tools/fixtures/reg4` does not pick it up).
'use strict';
class Grid {
  constructor(w, h, fill) { this.w = w; this.h = h; this.a = Array.from({ length: h }, () => Array(w).fill(fill)); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.a[y][x] : null; }
  set(x, y, c) { if (this.in(x, y)) this.a[y][x] = c; return this; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  /** outline of a rectangle */
  frame(x, y, w, h, c) { for (let i = 0; i < w; i++) { this.set(x + i, y, c); this.set(x + i, y + h - 1, c); } for (let j = 0; j < h; j++) { this.set(x, y + j, c); this.set(x + w - 1, y + j, c); } return this; }
  /** stamp literal rows at (x, y); ' ' keeps what is there */
  stamp(x, y, rows) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') this.set(x + i, y + j, r[i]); }); return this; }
  /** replace every cell equal to `from` inside a rect */
  swap(x, y, w, h, from, to) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.get(x + i, y + j) === from) this.set(x + i, y + j, to); return this; }
  /** a list of [x, y] cells */
  pts(list, c) { for (const [x, y] of list) this.set(x, y, c); return this; }
  rows() { return this.a.map((r) => r.join('')); }
}
module.exports = { Grid };
