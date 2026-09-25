// Static map parsing shared by QA tools (validate.js, progress.js).
// Mirrors DESIGN.md §7.1: rows + legend + marks/explicit objects.
'use strict';

function parseMap(R, id) {
  const m = R.DB.maps[id];
  const legend = R.DB.legends[m.legend || (m.type === 'world' ? 'world' : 'local')] || {};
  const rows = (m.rows || []).slice();
  const h = rows.length, w = rows.reduce((a, r) => Math.max(a, r.length), 0);
  const issues = [];
  rows.forEach((r, y) => { if (r.length !== w) issues.push(`row ${y} length ${r.length} != ${w}`); });
  const grid = [];
  const out = {
    id, def: m, w, h, grid, legend, issues,
    spawns: {}, npcs: [], chests: [], warps: [], events: [], hidden: [], signs: [],
  };
  const marks = m.marks || {};
  const seen = {};
  const suffix = (base) => { seen[base] = (seen[base] || 0) + 1; return seen[base] === 1 ? base : base + '_' + seen[base]; };
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x] === undefined ? ' ' : rows[y][x];
      const mk = marks[ch];
      if (mk) {
        const under = mk.under != null ? mk.under : (m.type === 'world' ? '.' : '.');
        if (mk.spawn) out.spawns[mk.spawn] = { x, y, dir: mk.dir };
        if (mk.npc) out.npcs.push(Object.assign({}, mk.npc, { x, y, id: suffix(mk.npc.id || ('npc_' + ch)) }));
        if (mk.chest) out.chests.push(Object.assign({}, mk.chest, { x, y, id: suffix(mk.chest.id || ('chest_' + id + '_' + ch)) }));
        if (mk.warp) out.warps.push(Object.assign({}, mk.warp, { x, y }));
        if (mk.event) out.events.push(Object.assign({}, mk.event, { x, y }));
        if (mk.hidden) out.hidden.push(Object.assign({}, mk.hidden, { x, y, id: suffix(mk.hidden.id || ('hidden_' + id + '_' + ch)) }));
        if (mk.sign) out.signs.push(Object.assign({}, mk.sign, { x, y }));
        ch = under;
      }
      const tid = legend[ch];
      if (!tid) issues.push(`unknown char '${ch}' at ${x},${y}`);
      row.push(tid || 'void');
    }
    grid.push(row);
  }
  // decor layer
  out.decor = null;
  if (Array.isArray(m.decor) && m.decor.length) {
    const dl = R.DB.legends.decor || {};
    out.decor = [];
    if (m.decor.length !== h) issues.push(`decor has ${m.decor.length} rows, map has ${h}`);
    for (let y = 0; y < h; y++) {
      const row = String(m.decor[y] || '');
      if (m.decor[y] != null && row.length !== w) issues.push(`decor row ${y} length ${row.length} != ${w}`);
      const r = [];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === undefined || ch === ' ' || ch === '.') { r.push(null); continue; }
        if (!dl[ch]) { issues.push(`unknown decor char '${ch}' at ${x},${y}`); r.push(null); continue; }
        r.push(dl[ch]);
      }
      out.decor.push(r);
    }
  }
  out.decorAt = (x, y) => (out.decor && x >= 0 && y >= 0 && x < w && y < h ? out.decor[y][x] : null);
  for (const k in (m.spawns || {})) out.spawns[k] = m.spawns[k];
  for (const k of ['npcs', 'chests', 'warps', 'events', 'hidden', 'signs']) for (const o of (m[k] || [])) out[k].push(Object.assign({}, o));
  out.tileAt = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? grid[y][x] : null);
  return out;
}

module.exports = { parseMap };
