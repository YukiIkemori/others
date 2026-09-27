// print fern layout + sanity checks
const R = require('/home/user/others/chronicle/v2/tools/lib/load')({ quiet: true });
R.State.newGame({ hero: { type: 'fighter', sex: 'm', name: 'テスト' }, seed: 1 });
const id = process.argv[2] || 'fern';
const m = R.DB.maps[id], rows = R.MapUtil.grid(m);
const occ = {};
const bad = [];
for (const o of m.objects) {
  if (o.type === 'building') { for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) occ[(o.x + i) + ',' + (o.y + j)] = (o.door.x === o.x + i && o.door.y === o.y + j) ? 'D' : 'B'; continue; }
}
const grid = rows.map((r) => [...r]);
for (const o of m.objects) if (o.type === 'building') for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) grid[o.y + j][o.x + i] = occ[(o.x + i) + ',' + (o.y + j)];
const seen = {};
for (const o of m.objects) {
  if (o.type === 'building') continue;
  const c = rows[o.y][o.x], L = m.legend[c] || {};
  const k = o.x + ',' + o.y + ',' + (o.lv || 0);
  if (seen[k]) bad.push('overlap ' + k + ' ' + (o.id || o.type) + '/' + seen[k]);
  seen[k] = o.id || o.type;
  if (occ[o.x + ',' + o.y]) bad.push('in building ' + (o.id || o.type) + '@' + o.x + ',' + o.y);
  if (o.id !== 'roots' && (L.solid || L.walk === false)) bad.push('on solid ' + c + ' ' + (o.id || o.type) + '@' + o.x + ',' + o.y);
  if ((o.lv || 0) === 1 && !L.deck) bad.push('lv1 off deck ' + (o.id || o.type) + '@' + o.x + ',' + o.y);
  grid[o.y][o.x] = o.type === 'chest' ? '$' : o.type === 'sign' ? '?' : o.type === 'examine' ? '!' : (o.lv ? '^' : (o.id === 'roots' ? 'x' : 'o'));
}
for (const n of m.npcs) { const c = rows[n.y][n.x], L = m.legend[c] || {}; if (L.solid || occ[n.x + ',' + n.y]) bad.push('npc on solid ' + n.id); if ((n.lv || 0) === 1 && !L.deck) bad.push('npc lv1 off deck ' + n.id); grid[n.y][n.x] = n.lv ? 'N' : 'n'; }
for (const [k, s] of Object.entries(m.spawns)) { const c = rows[s.y][s.x]; if ((m.legend[c] || {}).solid || occ[s.x + ',' + s.y]) bad.push('spawn solid ' + k); }
console.log('    ' + [...Array(m.w).keys()].map((x) => x % 10).join(''));
grid.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + r.join('')));
console.log(bad.join('\n') || 'no issues');
