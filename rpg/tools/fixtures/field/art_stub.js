// Field test harness only: simple stand-in graphics for any tile/sprite key
// the art owners have not registered yet, so field screenshots are readable.
// Never registers a key that already exists.
(function (R) {
  'use strict';
  const G = R.Gfx;
  const def = (k, f) => { if (!G.has(k)) G.def(k, f); };

  const COL = {
    sea: '#2a5cc8', reef: '#50709c', barrier: '#7a2aa0', grass: '#4caf3c', plain: '#8cc850', forest: '#1f7a2c',
    hills: '#7a9c3a', mountain: '#8a7458', desert: '#e0c878', snow: '#eef3ff', snowforest: '#8aa8b8', swamp: '#5a3a78',
    beach: '#e8d890', wasteland: '#8a6a48', magma: '#e04818', bridge_h: '#a07040', bridge_v: '#a07040',
    loc_castle: '#d0d0d0', loc_town: '#e0a060', loc_village: '#c09060', loc_cave: '#403020', loc_tower: '#b0b0c0',
    loc_shrine: '#80c0e0', loc_pyramid: '#e0c060', loc_volcano: '#a03010', loc_demon: '#502060', loc_temple: '#e0e0ff',
    void: '#000000', floor: '#6a6258', wall: '#3a342e', wall_torch: '#3a342e', lgrass: '#58b048', dirt: '#b08a58',
    wood: '#9a6a3a', carpet: '#b02a2a', sand: '#e0c880', snowfloor: '#e8eef8', ice: '#a8d8f0', water: '#2a6cd8',
    lava: '#e84818', poison: '#8a3aa8', tree: '#1a6a24', flowers: '#58b048', fence: '#8a6a3a', door: '#7a4a1a',
    door_silver: '#b0b8c8', door_gold: '#e0b840', seal: '#c040ff', counter: '#7a5030', table: '#8a5a30', chair: '#9a6a3a',
    bed: '#e0e0f0', bookshelf: '#6a3a1a', shelf: '#7a5a3a', pot: '#8a6a50', barrel: '#7a5028', crate: '#9a7040',
    throne: '#c0a030', pillar: '#a0a0a0', altar: '#d0d0e0', stairs_up: '#8a8a8a', stairs_down: '#303030',
    lbridge_h: '#a07040', lbridge_v: '#a07040', rock: '#6a6a6a', statue: '#9a9a9a', sign: '#9a6a3a', well: '#5a5a6a',
    grave: '#8a8a8a', warp_pad: '#4080ff', pedestal: '#b0b0b0', housewall: '#c8b890', roof: '#a03a2a', pit: '#101010',
  };
  const SOLID = { wall: 1, wall_torch: 1, mountain: 1, tree: 1, housewall: 1, rock: 1, reef: 1, fence: 1 };

  function tile(id, frame) {
    const p = G.pix(16, 16);
    const base = COL[id] || '#ff00ff';
    const lo = G.shade(base, -0.25), hi = G.shade(base, 0.2);
    p.rect(0, 0, 16, 16, base);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x * 7 + y * 13 + frame * 5) % 11) === 0) p.set(x, y, hi);
    if (SOLID[id]) { p.hline(0, 15, 15, lo); p.vline(15, 0, 15, lo); p.hline(0, 15, 0, hi); }
    if (id === 'sea' || id === 'water') for (let i = 0; i < 3; i++) p.hline((i * 5 + frame * 2) % 12, (i * 5 + frame * 2) % 12 + 3, 3 + i * 5, hi);
    if (id === 'counter' || id === 'table') { p.rect(0, 3, 16, 10, G.shade(base, 0.15)); p.hline(0, 15, 12, lo); }
    if (id.startsWith('door')) { p.rect(3, 1, 10, 15, lo); p.set(10, 9, '#ffe060'); }
    if (id.startsWith('stairs')) for (let i = 0; i < 4; i++) p.hline(2, 13, 2 + i * 4, i % 2 ? lo : hi);
    if (id.startsWith('loc_')) { p.rect(0, 0, 16, 16, COL.grass); p.rect(3, 4, 10, 10, base); p.rect(5, 1, 6, 4, lo); p.outline('#202020'); }
    if (id === 'wall_torch') { p.rect(7, 5, 2, 5, '#6a4a2a'); p.rect(6, 2 + (frame % 2), 4, 3, frame % 2 ? '#ffd040' : '#ff8020'); }
    if (id === 'lava' || id === 'magma') p.rect(2 + frame * 6, 6, 5, 3, '#ffc040');
    if (id === 'seal') { p.rect(2, 2, 12, 12, frame % 2 ? '#e080ff' : '#a040e0'); }
    if (id === 'sign') { p.rect(0, 0, 16, 16, COL.lgrass); p.rect(2, 3, 12, 7, base); p.rect(7, 10, 2, 6, lo); }
    if (id === 'well') { p.rect(0, 0, 16, 16, COL.lgrass); p.circle(8, 8, 6, base); p.circle(8, 8, 3, '#101830'); }
    return p.toCanvas();
  }
  for (const id in R.DB.tiles) {
    const n = R.DB.tiles[id].anim || 1;
    def('tile:' + id, () => (n > 1 ? Array.from({ length: n }, (_, f) => tile(id, f)) : tile(id, 0)));
  }

  // 16x24 person sheet
  function person(body, hair, skin) {
    const mk = (dir, f) => {
      const p = G.pix(16, 24);
      p.ellipse(8, 21, 5, 2, '#00000060');
      p.rect(4, 11, 8, 9, body);
      p.rect(4 + (f ? 0 : 1), 20, 3, 3, '#303040'); p.rect(9 - (f ? 0 : 1), 20, 3, 3, '#303040');
      p.circle(8, 7, 5, skin);
      if (dir === 'up') p.circle(8, 6, 5, hair);
      else { p.rect(3, 2, 10, 3, hair); if (dir !== 'right') p.set(6, 8, '#101010'); if (dir !== 'left') p.set(10, 8, '#101010'); }
      if (dir === 'left') p.rect(10, 2, 3, 7, hair);
      if (dir === 'right') p.rect(3, 2, 3, 7, hair);
      p.outline('#101018');
      return p.toCanvas();
    };
    const out = {};
    for (const d of ['down', 'up', 'left', 'right']) out[d] = [mk(d, 0), mk(d, 1)];
    return out;
  }
  const JOB = { warrior: '#3060c0', priest: '#e0e0f0', mage: '#8040a0' };
  const HAIR = { yuki: '#503018', non: '#e0a040', metem: '#c03050' };
  for (const c of ['yuki', 'non', 'metem']) {
    for (const j of Object.keys(R.DB.jobs).concat(Object.keys(JOB))) def('party:' + c + ':' + j, () => person(JOB[j] || '#40a060', HAIR[c], '#f0c8a0'));
  }
  const NPC = { merchant: '#40a040', boy: '#e06030', elder: '#806040', soldier: '#8090a0', priest: '#f0f0ff', girl: '#e070b0', man: '#4070c0' };
  for (const n in NPC) def('npc:' + n, () => person(NPC[n], '#403020', '#f0c8a0'));

  def('obj:chest', () => {
    const mk = (open) => {
      const p = G.pix(16, 16);
      p.rect(2, 5, 12, 10, '#a06020'); p.hline(2, 13, 9, '#e0b040');
      if (open) p.rect(3, 3, 10, 4, '#301808'); else p.rect(2, 3, 12, 4, '#c07830');
      p.set(8, 9, '#fff080'); p.outline('#281008');
      return p.toCanvas();
    };
    return [mk(false), mk(true)];
  });
  def('obj:sparkle', () => [0, 1, 2, 3].map((f) => { const p = G.pix(16, 16); const r = [1, 3, 5, 3][f]; p.hline(8 - r, 8 + r, 8, '#fff'); p.vline(8, 8 - r, 8 + r, '#fff'); return p.toCanvas(); }));
  def('obj:ship', () => {
    const mk = (dir, f) => {
      const p = G.pix(32, 32);
      const w = dir === 'left' || dir === 'right' ? 13 : 8;
      p.ellipse(16, 24, w, 5, '#6a3a18'); p.ellipse(16, 23, w - 2, 3, '#9a6030');
      p.vline(16, 4, 22, '#4a2a10'); p.rect(dir === 'left' ? 9 : dir === 'right' ? 17 : 10, 6, dir === 'left' || dir === 'right' ? 7 : 12, 10, '#f0f0e0');
      p.hline(4 + f, 8 + f, 29, '#ffffff'); p.hline(22 - f, 26 - f, 29, '#ffffff');
      p.outline('#201008');
      return p.toCanvas();
    };
    const out = {};
    for (const d of ['down', 'up', 'left', 'right']) out[d] = [mk(d, 0), mk(d, 1)];
    return out;
  });
  def('mon:golem', () => {
    const p = G.pix(64, 64);
    p.shadeEllipse(32, 36, 22, 24, G.ramp('#8a7a6a', 5)); p.rect(24, 28, 5, 4, '#ffe040'); p.rect(36, 28, 5, 4, '#ffe040');
    p.outline('#201810');
    return p.toCanvas();
  });
})(window.RPG);
