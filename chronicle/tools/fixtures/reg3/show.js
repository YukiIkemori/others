// R3: print a map region with decor overlaid (decor char in place of the tile when present)
const R = require('../../lib/load')({ quiet: true });
const [id, x0, y0, x1, y1] = process.argv.slice(2);
const m = R.DB.maps[id];
const X0 = +x0 || 0, Y0 = +y0 || 0, X1 = x1 != null ? +x1 : m.rows[0].length - 1, Y1 = y1 != null ? +y1 : m.rows.length - 1;
const occ = {};
for (const n of m.npcs || []) occ[n.x + ',' + n.y] = '@';
for (const c of m.chests || []) occ[c.x + ',' + c.y] = '$';
let hdr = '    ';
for (let x = X0; x <= X1; x++) hdr += x % 10;
console.log(hdr);
for (let y = Y0; y <= Y1; y++) {
  let s = String(y).padStart(3) + ' ';
  for (let x = X0; x <= X1; x++) {
    const d = m.decor && m.decor[y][x];
    s += occ[x + ',' + y] || (d && d !== '.' ? '\x1b[33m' + d + '\x1b[0m' : m.rows[y][x]);
  }
  console.log(s);
}
