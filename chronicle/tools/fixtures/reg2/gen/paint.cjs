// tiny grid painter for map rows + decor rows
'use strict';
const fs = require('fs');
class Grid {
  constructor(w, h, fill, dfill) {
    this.w = w; this.h = h;
    this.t = Array.from({ length: h }, () => Array(w).fill(fill));
    this.d = Array.from({ length: h }, () => Array(w).fill(dfill || '.'));
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, ch) { if (this.in(x, y)) this.t[y][x] = ch; return this; }
  get(x, y) { return this.in(x, y) ? this.t[y][x] : null; }
  dec(x, y, ch) { if (this.in(x, y)) this.d[y][x] = ch; return this; }
  rect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch); return this; }
  drect(x0, y0, x1, y1, ch) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.dec(x, y, ch); return this; }
  outline(x0, y0, x1, y1, ch) {
    for (let x = x0; x <= x1; x++) { this.set(x, y0, ch); this.set(x, y1, ch); }
    for (let y = y0; y <= y1; y++) { this.set(x0, y, ch); this.set(x1, y, ch); }
    return this;
  }
  /** stamp tile rows (and optional decor rows) at x,y; ' ' in a stamp = leave as is */
  stamp(x, y, rows, drows) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ' ') this.set(x + i, y + j, ch); }));
    if (drows) drows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ' ') this.dec(x + i, y + j, ch); }));
    return this;
  }
  replace(x0, y0, x1, y1, from, to) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (from.includes(this.t[y][x])) this.t[y][x] = to; return this; }
  rows() { return this.t.map((r) => r.join('')); }
  drows() { return this.d.map((r) => r.join('')); }
  print() { console.log(this.rows().map((r, i) => String(i).padStart(2) + ' ' + r).join('\n')); console.log(); console.log(this.drows().map((r, i) => String(i).padStart(2) + ' ' + r).join('\n')); }
}
/** replace the block between `// @rows id` and `// @end id` in file with rows/decor arrays */
function inject(file, id, g, indent) {
  indent = indent || '    ';
  const src = fs.readFileSync(file, 'utf8');
  const a = src.indexOf('// @rows ' + id + '\n'), b = src.indexOf('// @end ' + id);
  if (a < 0 || b < 0) throw new Error('markers for ' + id + ' not found in ' + file);
  const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const body = indent + 'rows: [\n' + g.rows().map((r) => indent + '  ' + q(r) + ',').join('\n') + '\n' + indent + '],\n' +
    indent + 'decor: [\n' + g.drows().map((r) => indent + '  ' + q(r) + ',').join('\n') + '\n' + indent + '],\n' + indent;
  const head = src.slice(0, a + ('// @rows ' + id + '\n').length);
  fs.writeFileSync(file, head + body + src.slice(b));
}
module.exports = { Grid, inject };
