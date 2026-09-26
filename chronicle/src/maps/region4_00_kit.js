// Region 4 グレイモア湿原 (r_marsh) — shared helpers for the region-4 maps and events.
// Owner: reg-4 (R4, DESIGN §13.1). Loaded before region4_*.js maps ('0' sorts first).
//
// Maps: loch (水辺の町ロッホ) · mist_manor_1..2 (霧の館) · bell_marsh_1 (鐘沈みの沼) — DESIGN §10.8.5.
// The rows/decor of each map are composed by tools/fixtures/reg4/lib/layout_*.js and written
// between the `// @rows <id>` / `// @end <id>` markers by tools/fixtures/reg4/lib/sync.js;
// every object (NPCs, signs, chests, spawns, events, warps) is listed explicitly with x,y.
//
//   const K = R.Reg4;
//   K.npc(id, sprite, x, y, o) · K.talk(id, sprite, x, y, text, o) · K.sign(x, y, text, cond)
//   K.chest(id, x, y, pool) · K.step(id, x, y, o) · K.exam(id, x, y, o) · K.band(id, x0, y0, x1, y1, o)
//   K.warp(x, y, to, spawn, o) · K.C (text conds) · K.checkRows(id, def)
//
// Also registered here (data, §9.1.4 shapes):
//   z_r_marsh_teaparty — the hidden tea room behind the secret wall of mist_manor_1 (§10.6.4
//   「レア魔物の小部屋」: its own zone, the rare-monster rate ×3). A copy of z_r_marsh_manor made in
//   an onData hook (same groups), with DB.rareEncounters rate = ⌈z_r_marsh_manor's rate / 3⌉.
// Art for the region's set pieces (obj:*, drawn here like the prologue's great lamp):
//   obj:loch_bell / obj:loch_bell_ring   the bell in Loch's bell tower (still / swinging after the clear)
//   obj:marsh_chain / obj:marsh_chain_open   a bell chain in the bog: a pile with an iron chain and
//                                        a padlock (locked) / the padlock hanging open (rung)
(function (R) {
  'use strict';
  const K = (R.Reg4 = R.Reg4 || {});

  K.npc = function (id, sprite, x, y, o) {
    const s = String(sprite || 'man');
    return Object.assign({ id, sprite: s.includes(':') ? s : 'npc:' + s, x, y, dir: 'down' }, o || {});
  };
  K.talk = function (id, sprite, x, y, text, o) { return K.npc(id, sprite, x, y, Object.assign({ text }, o || {})); };
  K.sign = function (x, y, text, cond) { const s = { x, y, text }; if (cond != null) s.cond = cond; return s; };
  K.chest = function (id, x, y, pool) { return { id, x, y, pool: pool || 'p_supply' }; };
  K.step = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'step' }, o || {}); };
  K.exam = function (id, x, y, o) { return Object.assign({ id, x, y, trigger: 'examine' }, o || {}); };
  K.band = function (id, x0, y0, x1, y1, o) {
    const out = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(K.step(id, x, y, o));
    return out;
  };
  K.warp = function (x, y, to, spawn, o) { return Object.assign({ x, y, to, spawn }, o || {}); };

  /** text conds (§3.2.3): cleared = this region is done (the fog lifted) */
  K.C = {
    post: { postgame: true },
    fog: 'final_open',
    clear: { cleared: 'r_marsh' },
    key: 'marsh_key',
    mid: 'marsh_mid',
    start: 'marsh_start',
    t1: { tier: 1 }, t3: { tier: 3 }, t4: { tier: 4 }, t6: { tier: 6 }, t7: { tier: 7 },
  };

  /** every row (and decor row) of a def has the same width; warns once per map */
  K.checkRows = function (id, def) {
    const w = def.rows[0].length;
    def.rows.forEach((r, y) => { if (r.length !== w) R.warn('reg4 map ' + id + ': row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    if (def.decor) {
      if (def.decor.length !== def.rows.length) R.warn('reg4 map ' + id + ': decor has ' + def.decor.length + ' rows, not ' + def.rows.length);
      def.decor.forEach((r, y) => { if (r.length !== w) R.warn('reg4 map ' + id + ': decor row ' + y + ' is ' + r.length + ' wide, not ' + w); });
    }
    return def;
  };

  /** the region's map ids (tools) */
  K.MAPS = ['loch', 'mist_manor_1', 'mist_manor_2', 'bell_marsh_1'];
  K.RARE_ROOM_ZONE = 'z_r_marsh_teaparty';

  // ------------------------------------------------------------ the tea room's zone (§10.6.4)
  if (R.onData) R.onData(() => {
    const DB = R.DB;
    const base = DB.encounters && DB.encounters.z_r_marsh_manor;
    if (base && !DB.encounters[K.RARE_ROOM_ZONE]) {
      DB.encounters[K.RARE_ROOM_ZONE] = Object.assign({}, base, { rareRoom: 'z_r_marsh_manor' });
    }
    const rr = DB.rareEncounters && DB.rareEncounters.z_r_marsh_manor;
    if (rr && !DB.rareEncounters[K.RARE_ROOM_ZONE]) {
      DB.rareEncounters[K.RARE_ROOM_ZONE] = Object.assign({}, rr, { rate: Math.max(1, Math.ceil((rr.rate || 80) / 3)) });
    }
  });

  // ------------------------------------------------------------ set-piece art
  /** a canvas from pixel rows ('.' = clear) and a palette {char: '#rrggbb'} */
  function pix(rows, pal) {
    const G = R.Gfx;
    const cv = G.makeCanvas(rows[0].length, rows.length), c = cv.getContext('2d');
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const col = pal[r[x]];
        if (!col) continue;
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      }
    });
    return cv;
  }
  const BELL_PAL = { k: '#2a1a0c', d: '#7a4e1c', b: '#b0782e', h: '#e6b85c', H: '#fff0b0', w: '#5a3a20', W: '#7c5430', s: '#1c140c', i: '#3c3c44' };
  // the belfry frame (two posts and a beam) with the town bell; 16×24
  const BELL = [
    '.WWWWWWWWWWWWWW.',
    'wwwwwwwwwwwwwwww',
    '.w.....ii.....w.',
    '.w....kddk....w.',
    '.w...kbhbbk...w.',
    '.w..kbhHbbdk..w.',
    '.w..kbhhbbdk..w.',
    '.w.kbhhbbbbdk.w.',
    '.w.kbhbbbbbdk.w.',
    '.w.kbhbbbbbdk.w.',
    '.wkbhbbbbbbbdkw.',
    '.wkbhbbbbbbbdkw.',
    '.kbhbbbbbbbbbdk.',
    '.kddddddddddddk.',
    '.wkkkkkkkkkkkkw.',
    '.w.....kk.....w.',
    '.w.....kk.....w.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    'sws..........sws',
    '.s............s.',
  ];
  // the same bell swung to the right (second frame when it rings)
  const BELL_SWING = [
    '.WWWWWWWWWWWWWW.',
    'wwwwwwwwwwwwwwww',
    '.w.....ii.....w.',
    '.w.....kddk...w.',
    '.w....kbhbbk..w.',
    '.w....kbhHbdk.w.',
    '.w...kbhhbbdk.w.',
    '.w...kbhbbbbdkw.',
    '.w..kbhbbbbbdkw.',
    '.w..kbhbbbbbbdk.',
    '.w.kbhbbbbbbbdk.',
    '.w.kbhbbbbbbbbdk',
    '.w.kbbbbbbbbbbdk',
    '.w..kddddddddddk',
    '.w...kkkkkkkkkk.',
    '.w.........kk.w.',
    '.w..........kkw.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    '.w............w.',
    'sws..........sws',
    '.s............s.',
  ];
  const CHAIN_PAL = { k: '#1e1a16', p: '#4a3a28', P: '#6a5438', q: '#8a7250', c: '#6c707a', C: '#a8aeb8', g: '#c89a28', G: '#f0d060', m: '#3c4a30', s: '#10140c' };
  // a mooring pile in the bog with the bell chain wound on it and a padlock; 16×24
  const CHAIN = [
    '................',
    '.....kkkkkk.....',
    '....kqqqqqPk....',
    '....kPPPPPpk....',
    '....kpPPPPpk....',
    '...cCcCcCcCc....',
    '....kPPPPPpk....',
    '...cCcCcCcCc....',
    '....kpPPPPpk....',
    '....kPPPPPpkc...',
    '....kpPPPPpkCc..',
    '....kPPkkkpk.Cc.',
    '....kpkgGgkk..C.',
    '....kPkGggkk..c.',
    '....kpkgggkk.cC.',
    '....kPPkkkpk.C..',
    '....kpPPPPpk.c..',
    '....kPPPPPpkCc..',
    '....kpPPPPpkc...',
    '...mkPPPPPpkm...',
    '..mmkpPPPPpkmm..',
    '.mmmkkkkkkkkmmm.',
    '..mmmsssssssmm..',
    '....mmmmmmmm....',
  ];
  // the padlock hangs open on the chain (the bell has been rung)
  const CHAIN_OPEN = CHAIN.map((r, y) => {
    if (y >= 11 && y <= 15) return '....kpPPPPpk' + r.slice(12);
    if (y === 16) return '....kpPPPPpk.cgG';
    if (y === 17) return '....kPPPPPpkCcGk';
    if (y === 18) return '....kpPPPPpkc.kg';
    return r;
  });
  if (R.Gfx && !R.Gfx.has('obj:loch_bell')) {
    R.Gfx.def('obj:loch_bell', () => [pix(BELL, BELL_PAL)]);
    R.Gfx.def('obj:loch_bell_ring', () => [pix(BELL, BELL_PAL), pix(BELL_SWING, BELL_PAL)]);
    R.Gfx.def('obj:marsh_chain', () => [pix(CHAIN, CHAIN_PAL)]);
    R.Gfx.def('obj:marsh_chain_open', () => [pix(CHAIN_OPEN, CHAIN_PAL)]);
  }
})(window.RPG);
