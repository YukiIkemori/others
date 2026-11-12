// Which chests / spots / npcs can be reached on foot from the start (flood fill on the engine's own "free" test, blocked props included).
const J = (p, f, a) => p.evaluate(f, a);
module.exports = async (p, shot) => {
  await p.keyboard.press('z'); await p.waitForTimeout(3000);
  for (const map of ['village', 'f01', 'abbey']) {
    if (map !== 'village') { await J(p, m => { RPG.debug.go(m, {}); }, map); await p.waitForFunction(m => __game.mapUrl.startsWith(m) && !__game.loading && !RPG.busy, map, { timeout: 120000 }); await p.waitForTimeout(1500); }
    console.log(map, await J(p, () => {
      const g = __game, S = 6, W = Math.ceil(g.map.w / S), H = Math.ceil(g.map.h / S), seen = new Uint8Array(W * H), q = [];
      const sx = Math.round(g.hero.x / S), sy = Math.round(g.hero.y / S); seen[sy * W + sx] = 1; q.push(sx, sy);
      while (q.length) { const y = q.pop(), x = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue; if (!g.free(nx * S, ny * S)) continue; seen[ny * W + nx] = 1; q.push(nx, ny); } }
      const out = [];
      for (const t of g.map.triggers) { if (!['chest', 'spot', 'npc', 'shop', 'inn', 'save', 'look'].includes(t.kind) && !t.title) continue; const r = (t.r || 40); let ok = false;
        for (let y = Math.floor((t.y - r) / S); y <= (t.y + r) / S && !ok; y++) for (let x = Math.floor((t.x - r) / S); x <= (t.x + r) / S; x++) if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x] && Math.hypot(x * S - t.x, y * S - t.y) <= r) { ok = true; break; }
        out.push((ok ? 'ok ' : 'NO ') + (t.kind || '') + ' ' + (t.id || t.title || '') + ' ' + t.x + ',' + t.y + ' r' + r); }
      return out.join('\n');
    }));
  }
};
