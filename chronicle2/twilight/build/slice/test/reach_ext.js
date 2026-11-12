// Reach test for the new maps: every trigger and every exit must be reachable on foot from every spawn's flood fill (the first spawn is used).
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  await p.keyboard.press('z'); await p.waitForTimeout(3000);
  for (const map of (process.env.MAPS || 'f02,capital,plaza,abbey2,abbey').split(',')) {
    await J(p, m => { RPG.debug.go(m, {}); }, map); await p.waitForFunction(m => __game.mapUrl.startsWith(m) && !__game.loading && !RPG.busy, map, { timeout: 120000 }); await p.waitForTimeout(2500);
    console.log('== ' + map, await J(p, () => {
      const g = __game, S = 6, W = Math.ceil(g.map.w / S), H = Math.ceil(g.map.h / S), seen = new Uint8Array(W * H), q = [];
      const sx = Math.round(g.hero.x / S), sy = Math.round(g.hero.y / S); seen[sy * W + sx] = 1; q.push(sx, sy); let n = 0;
      while (q.length) { const y = q.pop(), x = q.pop(); n++; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue; if (!g.free(nx * S, ny * S)) continue; seen[ny * W + nx] = 1; q.push(nx, ny); } }
      const near = (tx, ty, r) => { for (let y = Math.floor((ty - r) / S); y <= (ty + r) / S; y++) for (let x = Math.floor((tx - r) / S); x <= (tx + r) / S; x++) if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x] && Math.hypot(x * S - tx, (y * S - ty) * 1.25) <= r) return true; return false; };
      const inRect = r => { for (let y = Math.floor(r[1] / S); y <= (r[1] + r[3]) / S; y++) for (let x = Math.floor(r[0] / S); x <= (r[0] + r[2]) / S; x++) if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x]) return true; return false; };
      const out = ['cells ' + n + ' hero ' + (g.hero.x | 0) + ',' + (g.hero.y | 0)];
      for (const t of g.map.triggers) { if (t.kind === 'boss') continue; const r = (t.r || 44) - 4; out.push((near(t.x, t.y, r) ? 'ok ' : 'NO ') + (t.kind || 'text') + ' ' + (t.id || t.title || '') + ' ' + t.x + ',' + t.y); }
      for (const e of g.map.exits) out.push(((e.rect ? inRect(e.rect) : near(e.x, e.y, e.r || 40)) ? 'ok ' : 'NO ') + 'exit ' + (e.to || 'closed') + ' ' + JSON.stringify(e.rect || [e.x, e.y, e.r]));
      for (const k in g.map.spawns || {}) { const s = g.map.spawns[k]; out.push((seen[Math.round(s.y / S) * W + Math.round(s.x / S)] ? 'ok ' : 'NO ') + 'spawn ' + k + ' ' + s.x + ',' + s.y); }
      if (g.map.boss) out.push((inRect(g.map.boss.rect) ? 'ok ' : 'NO ') + 'boss line');
      return out.join('\n');
    }));
  }
};
