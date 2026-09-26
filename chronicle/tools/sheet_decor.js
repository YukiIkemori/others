#!/usr/bin/env node
// Contact sheets for the decor layer (DESIGN §7.1) — art review tool.
//
//   node tools/sheet_decor.js [--out DIR] [--only decor,themes,rooms,study] [--scale N] [--frame F]
//        [--themes castle,house,town] [--ids a,b,…] [--room throne,house,…]
//   node tools/sheet_decor.js --emit <room|theme>  print a --eval expression for tools/shot.js
//                                                  that injects demo room <room> (or the small
//                                                  theme room in <theme>) and starts there
//   node tools/sheet_decor.js --list               list the demo rooms
//   node tools/sheet_decor.js --zoom <png> --rect x,y,w,h [--z N] --to <png>   crop & upscale
//
// Sheets (PNG, nearest-neighbour upscaled, paginated):
//   decor    every decor id (or --ids) on castle / house / town walls & floors (--themes);
//            animated ids show every frame; joining ids are shown as small groups
//   themes   one small composed room per theme (all 12 themes), same layout
//   rooms    hand-composed demo rooms (throne room, great hall, house, dining hall, library,
//            chapel, treasury, inn; Chronicle: tavern, archive reading room, manor parlour)
//   study    art-local review maps (--study dungeon|town, --themes a,b): every themed, closed
//            and secret tile of a dungeon theme in context (one secret drawn "found"), or a town
//            block per town theme (streets, regional houses and roofs, lawn, canal, an interior)
// Pass --maps to also load src/maps (off by default: other owners' map files cannot break it).
// Maps are real R.FieldMap compiles with a decor layer, rendered like the field:
// R.Art.localTile for the base, then decor (R.Art.decorTile or 'decor:<id>') bottom-aligned.
// Loads core + data + art + maps + systems/field_map.js only (no game boot).
//
// In-game check of a room:
//   node tools/shot.js --out /tmp/x.png --eval "$(node tools/sheet_decor.js --emit throne)"
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

// ------------------------------------------------------------ demo rooms
// Local legend for rows, decor legend for decor (src/data/tiles.js).
const ROOMS = {
  throne: {
    name: 'throne room', theme: 'castle', type: 'castle',
    rows: [
      '################',
      '#..............#',
      '#......KK......#',
      '#.....++++.....#',
      '#..............#',
      '#l............l#',
      '#..............#',
      '#l............l#',
      '#..............#',
      '#l............l#',
      '#..............#',
      '#######@D#######',
    ],
    decor: [
      '.b.W.B.cc.B.W.b.',
      '.Q.Y.dddddd.Y.Q.',
      '.Z...dd..dd...Z.',
      '.....dddddd.....',
      '.......rr.......',
      '.......rr.......',
      '..a.a..rr..a.a..',
      '.......rr.......',
      '...z...rr.......',
      '.......rr....z..',
      '.......rr.......',
      '................',
    ],
    npcs: [['king', 7, 2], ['queen', 8, 2], ['minister', 5, 4], ['soldier', 3, 6], ['soldier', 12, 6]],
  },
  hall: {
    name: 'great hall (two-tile walls)', theme: 'castle', type: 'castle',
    rows: [
      '################',
      '################',
      '#..............#',
      '#..............#',
      '#..............#',
      '#l............l#',
      '#..............#',
      '#######@D#######',
    ],
    decor: [
      '................',
      '.b..B.W.cW.B..b.',
      '.Q.Y..........Q.',
      '....oooooooo....',
      '..a.oooooooo.a..',
      '.Z............Z.',
      '..e..........e..',
      '................',
    ],
    npcs: [['knight', 3, 4], ['soldier', 12, 4]],
  },
  house: {
    name: 'house (living room + kitchen)', theme: 'house', type: 'town',
    rows: [
      '##############',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#####.########',
      '#..b.b.......#',
      '#..b.b.......#',
      '#............#',
      '###@D#########',
    ],
    decor: [
      '..w.p.m..w.k..',
      '.F..TA.V..CKS.',
      '..rrrr.....q..',
      '..rrrr.Z......',
      '.y.......L..e.',
      '..............',
      '.A........y.U.',
      '.....v...D....',
      '.Z..RRR......q',
      '..............',
    ],
    tiles: { '.': '.' },
    npcs: [['woman', 7, 3], ['girl', 9, 7]],
  },
  dining: {
    name: 'castle dining hall + barracks', theme: 'castle', type: 'castle',
    rows: [
      '################',
      '#..........#...#',
      '#..........#b.b#',
      '#..........#b.b#',
      '#..........#...#',
      '#..........D...#',
      '#..........#...#',
      '#######@D#######',
    ],
    decor: [
      '.b.t.i.p.b..x.w.',
      '.C..Q....Q..X.Y.',
      '..eeeeeee.......',
      '..LLLLLLL.......',
      '..eeeeeee....s..',
      '.Z......vn....U.',
      '..q.K....S..sUq.',
      '................',
    ],
    npcs: [['soldier', 6, 1], ['woman', 8, 5], ['knight', 13, 5]],
  },
  library: {
    name: 'library / study', theme: 'tower', type: 'castle',
    rows: [
      '##############',
      '#kk.kkkk.kk..#',
      '#............#',
      '#............#',
      '#..kk..kk....#',
      '#............#',
      '#............#',
      '######@D######',
    ],
    decor: [
      '...P.......W..',
      '...V.....Q..Z.',
      '.....RRRR..D..',
      '.I...RRRR..n..',
      '.............Q',
      '.v...T....z..y',
      '.............Z',
      '..............',
    ],
    npcs: [['scholar', 11, 1], ['sage', 6, 5]],
  },
  chapel: {
    name: 'chapel', theme: 'shrine', type: 'shrine',
    rows: [
      '##############',
      '##############',
      '#.....a......#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '#............#',
      '######@D######',
    ],
    decor: [
      '..............',
      '..W.B.W.B.W...',
      '.Q.Z..dd...Z.Q',
      '.....ooo......',
      '.....ooo......',
      '..eee...eee...',
      '..eee...eee...',
      '.v..........v.',
      '..............',
    ],
    npcs: [['priest', 6, 3], ['nun', 3, 7]],
  },
  treasury: {
    name: 'treasury + smithy', theme: 'fort', type: 'dungeon',
    rows: [
      '##############',
      '#.....#......#',
      '#.....#......#',
      '#.....#......#',
      '#.....D......#',
      '#.....#......#',
      '######@D######',
    ],
    decor: [
      '..c.x...i..k..',
      '.GYG.U.X.O.K..',
      '.q..G.....s...',
      '.a.a.U...g..z.',
      '..a.q.......s.',
      '.U.z.q.Y.q..U.',
      '..............',
    ],
    npcs: [['old_man', 9, 3]],
  },
  inn: {
    name: 'inn / tavern', theme: 'house', type: 'town',
    rows: [
      '##############',
      '#............#',
      '#......ccc...#',
      '#............#',
      '#............#',
      '#............#',
      '######@D######',
    ],
    decor: [
      '.w.i.p.i.w.k..',
      '.U..V.K..qS.C.',
      '..n.n.........',
      '..LLL..T......',
      '..n.n..n..LLL.',
      '.Z........n.n.',
      '..............',
    ],
    npcs: [['innkeeper', 8, 1], ['man', 5, 4], ['dancer', 9, 5]],
  },
  // --- Chronicle rooms (art-local): new decor at DQ5 density
  tavern: {
    name: 'tavern with a stage (語らいの灯亭)', theme: 'house', type: 'town',
    rows: [
      '################',
      '#..............#',
      '#cccc..........#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#######@D#######',
    ],
    decor: [
      '.H.$.w.[.p.w.H..',
      '.N........0000..',
      '..........0000..',
      '..n.T.n.......Z.',
      '.&&....n.T.n....',
      '.Q.n.T.n......%.',
      '................',
    ],
    npcs: [['bartender', 2, 1], ['dancer', 12, 1], ['sailor', 4, 4], ['man', 9, 3]],
  },
  archive: {
    name: 'reading room of the white archive', theme: 'library', type: 'dungeon',
    rows: [
      '################',
      '#..............#',
      '#.l..........l.#',
      '#..............#',
      '#.l..........l.#',
      '#..............#',
      '#######@D#######',
    ],
    decor: [
      '.}..}.i....i.}..',
      '..{..>..=....{..',
      '....=...........',
      '..RRRRRRRRRRRR..',
      '.......I...{....',
      '.{..=.......>...',
      '................',
    ],
    npcs: [['scholar', 6, 3]],
  },
  manor: {
    name: 'parlour of the misty manor', theme: 'manor', type: 'dungeon',
    rows: [
      '################',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#######@D#######',
    ],
    decor: [
      '.P.|..W..V.w.m..',
      '.:........F.....',
      '...rrrrr......@.',
      '...rrrrr..;.....',
      '.@.........Q....',
      '..,.......v.....',
      '................',
    ],
    decorLegend: { '|': 'doll_shelf', ':': 'piano', ',': 'broken_chair', ';': 'rug_round' },
    npcs: [['ghost', 7, 4]],
  },
};
// one small room shown in every theme
const THEME_ROOM = {
  rows: [
    '############',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#..........#',
    '#####@D#####',
  ],
  decor: [
    '.b.W.i.p.w..',
    '.Y..Q.C.U.Z.',
    '...rrr...z..',
    '.a.rrr..LL..',
    '.v.......n.q',
    '..dd..s.g.l.',
    '............',
  ],
};
const THEMES_CREST = ['town', 'castle', 'house', 'cave', 'fort', 'pyramid', 'water', 'ice', 'volcano', 'tower', 'shrine', 'demon'];
const THEMES_DUNGEON = ['forest', 'tree', 'snow', 'manor', 'swamp', 'ship', 'mine', 'library', 'oblivion'];
const THEMES_TOWN = ['town', 'town_roa', 'town_forest', 'town_sand', 'town_snow', 'town_marsh', 'town_isle', 'town_mine', 'town_ash', 'town_star', 'town_white'];
const THEMES = THEMES_CREST.concat(THEMES_DUNGEON, THEMES_TOWN.slice(1));

// ------------------------------------------------------------ study maps (art-local review)
// dungeon: every themed / closed / secret tile of a theme in context ('%' secrets:
// the one marked F is drawn "found"); town: streets, houses, lawn, canal, an interior
const STUDY = {
  dungeon: {
    rows: [
      '################',
      '#i##D##E##O##%##',
      '#..............#',
      '#.l..r...S..s..#',
      '#..............#',
      '####%####.######',
      '#......#.......#',
      '#.VV.II#GGG.Q.U#',
      '#......#.......#',
      '#.zz...%..www..#',
      '#.zzz.....w~w..#',
      '################',
    ],
    found: [[13, 1], [7, 9]],
    decor: null,
  },
  town: {
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T,,RRRRRRR,,,RRRRR,T',
      'T,,RRRRRRR,,,RRRRR,T',
      'T,,BBBDBBB,,,BBDBB,T',
      'T,,,,,.,,,,,,,,.,,,T',
      'T,..............,,,T',
      'T,..............:::T',
      'T,,,,,.,,,,,,,,,:,,T',
      'T######D###,,~~~|~~T',
      'T#________#,,~~~|~~T',
      'T#__t_____#,,,,,:,,T',
      'T#________E,,,,,:,,T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
    decor: [
      '                    ',
      '                    ',
      '                    ',
      '   w  4 w     w 7   ',
      '    3        1   h  ',
      '                    ',
      '                    ',
      '  3          3      ',
      '  w  $  w           ',
      '  A C  F  Z         ',
      '   n n              ',
      '  &&     e          ',
      '                    ',
    ],
  },
};
/** R.DB.maps def for a study map of a theme */
function studyDef(kind, theme) {
  const S = STUDY[kind];
  return {
    name: kind + ':' + theme, type: kind === 'town' ? 'town' : 'dungeon', legend: 'local', theme, bgm: 'town',
    outside: kind === 'town' ? 'T' : '#', rows: S.rows.slice(), decor: S.decor ? S.decor.map((r) => r.replace(/ /g, '.')) : undefined,
    spawns: { entrance: { x: 2, y: 2 } }, npcs: [], found: S.found || [],
  };
}

/** R.DB.maps def for a demo room */
function roomDef(key) {
  const r = key === 'theme' ? THEME_ROOM : ROOMS[key];
  if (!r) return null;
  const def = {
    name: r.name || key, type: r.type || 'town', legend: 'local', theme: r.theme || 'castle', bgm: 'town',
    rows: r.rows.map((s) => s.replace('@', '.')), decor: r.decor, decorLegend: r.decorLegend, outside: '#',
    spawns: {}, npcs: [],
  };
  let sx = 1, sy = 1;
  r.rows.forEach((row, y) => { const x = row.indexOf('@'); if (x >= 0) { sx = x; sy = y - 1; } });
  def.spawns.entrance = { x: sx, y: sy, dir: 'up' };
  (r.npcs || []).forEach(([sprite, x, y], i) => def.npcs.push({ id: 'demo_' + i, x, y, sprite: 'npc:' + sprite, dir: 'down', text: '……。' }));
  return def;
}

if (args.includes('--list')) {
  for (const k in ROOMS) console.log(k.padEnd(10), ROOMS[k].theme.padEnd(8), ROOMS[k].name);
  process.exit(0);
}
if (opt('emit')) {
  const key = opt('emit');
  const theme = opt('theme');
  const def = roomDef(ROOMS[key] ? key : 'theme');
  if (!def) { console.error('unknown room ' + key); process.exit(1); }
  if (theme) def.theme = theme;
  else if (!ROOMS[key] && THEMES.includes(key)) def.theme = key;
  process.stdout.write(`(RPG.DB.maps.decor_demo = ${JSON.stringify(def)}, RPG.debug.noEncounter(true), RPG.debug.newGameAt('decor_demo', 'entrance'), 'ok')`);
  process.exit(0);
}

// ---------------------------------------------------------------- page code
const OUT = path.resolve(opt('out', '/tmp/claude-0/decor'));
const ONLY = opt('only', 'decor,themes,rooms').split(',');
const SCALE = +opt('scale', 3);
const FRAME = +opt('frame', 0);

function sources() {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const list = ['ns.js', 'input.js', 'gfx.js'].map((f) => path.join(ROOT, 'src/core', f));
  // maps are only needed with --maps (other owners' map files must not break art review)
  for (const d of args.includes('--maps') ? ['data', 'art', 'maps'] : ['data', 'art']) {
    const dir = path.join(ROOT, 'src', d);
    if (fs.existsSync(dir)) list.push(...walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b)));
  }
  list.push(path.join(ROOT, 'src/systems/field_map.js'));
  return list;
}

const PAGE = String.raw`
window.SHEET = (function () {
  const R = window.RPG, G = R.Gfx;
  function canvas(w, h, bg) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.fillStyle = bg || '#202028'; c.fillRect(0, 0, w, h);
    return [cv, c];
  }
  function label(c, s, x, y, col) { c.font = '11px monospace'; c.fillStyle = col || '#d8d8e0'; c.textBaseline = 'top'; c.fillText(s, x, y); }
  const pick = (g, f) => (Array.isArray(g) ? g[f % g.length] : g);
  function tileGfx(m, id) {
    if (id === 'void') return null;
    return m.theme && G.has('tile:' + m.theme + ':' + id) ? G.get('tile:' + m.theme + ':' + id) : G.get('tile:' + id);
  }
  function compile(def) {
    const id = def.id || '__sheet';
    R.DB.maps[id] = def;
    const m = R.FieldMap.compile(id);
    delete R.DB.maps[id];
    if (def.found && def.found.length) {
      R.Game = R.Game || {};
      R.Game.secrets = R.Game.secrets || {};
      for (const [x, y] of def.found) R.Game.secrets[id + ':' + x + ',' + y] = true;
    }
    return m;
  }
  /** render like the field: base (localTile) → decor (bottom-aligned) → npcs */
  function render(m, frame, o) {
    o = o || {};
    const [cv, c] = canvas(m.w * 16, m.h * 16, '#000');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      let g = R.Art.localTile ? R.Art.localTile(m, x, y) : null;
      if (!g) g = tileGfx(m, m.tileAt(x, y));
      g = pick(g, frame);
      if (g) c.drawImage(g, x * 16, y * 16);
    }
    if (m.decor) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const id = m.decorAt(x, y);
      if (!id) continue;
      let g = R.Art.decorTile ? R.Art.decorTile(m, x, y) : null;
      if (!g) g = G.get('decor:' + id);
      g = pick(g, frame);
      if (g) c.drawImage(g, x * 16 + ((16 - g.width) >> 1), y * 16 + 16 - g.height);
    }
    if (!o.noNpc) for (const n of m.npcs) {
      const sh = G.get(n.sprite);
      const f = sh && sh.down ? sh.down[0] : pick(sh, 0);
      if (f) c.drawImage(f, n.x * 16 + ((16 - f.width) >> 1), n.y * 16 + 16 - f.height);
    }
    return cv;
  }
  function up(cv, s) {
    const [o, oc] = canvas(cv.width * s, cv.height * s, '#000');
    oc.drawImage(cv, 0, 0, o.width, o.height);
    return o;
  }
  // every decor id in three contexts
  function decorSheet(scale, themes) {
    const ids = window.SHEET_IDS || Object.keys(R.DB.decor);
    const auto = { rug: [3, 3], rug_blue: [3, 2], dais: [4, 2], table_long: [4, 1], bench: [3, 1], mosaic: [3, 3], hedge: [3, 1], fountain: [2, 2], stall: [3, 1], stage: [3, 2], rails: [3, 1] };
    const cells = ids.map((id) => {
      const d = R.DB.decor[id];
      const frames = (() => { const g = G.get('decor:' + id); return Array.isArray(g) ? g.length : 1; })();
      const [aw, ah] = auto[id] || [1, 1];
      return { id, d, frames, aw, ah };
    });
    const cols = 8, bw = 5, pad = 6;
    const blocks = [];
    for (const cell of cells) {
      const per = themes.map((th) => {
        const w = Math.max(3, cell.aw + 2), h = cell.ah + 2;
        const rows = [], dec = [];
        for (let y = 0; y < h; y++) {
          rows.push(y === 0 ? '#'.repeat(w) : '.'.repeat(w));
          let r = '';
          for (let x = 0; x < w; x++) {
            const inside = cell.d.wall ? (y === 0 && x >= 1 && x <= cell.aw) : (y >= 1 && y <= cell.ah && x >= 1 && x <= cell.aw);
            r += inside ? (Object.keys(R.DB.legends.decor).find((k) => R.DB.legends.decor[k] === cell.id) || '|') : '.';
          }
          dec.push(r);
        }
        // ids on water (boat, hot spring, sunken bell) stand on a pond
        if (/^(boat|hot_spring|sunken_bell)$/.test(cell.id)) for (let y = 1; y < rows.length; y++) rows[y] = rows[y].replace(/\./g, '~');
        const m = compile({ name: 's', type: 'town', legend: 'local', theme: th, rows, decor: dec, decorLegend: { '|': cell.id }, outside: '#', spawns: { e: { x: 0, y: 1 } } });
        const fr = [];
        for (let f = 0; f < cell.frames; f++) fr.push(render(m, f, { noNpc: true }));
        return fr;
      });
      blocks.push({ cell, per });
    }
    const bwpx = (b) => b.per.reduce((s, fr) => s + fr.length * (fr[0].width * scale + 2) + 6, 0);
    const rowsOut = [];
    let cur = [], wsum = 0;
    const MAXW = +(window.SHEET_MAXW || 1100), PAGE_H = +(window.SHEET_PAGEH || 900);
    for (const b of blocks) {
      const w = bwpx(b) + pad;
      if (wsum + w > MAXW && cur.length) { rowsOut.push(cur); cur = []; wsum = 0; }
      cur.push(b); wsum += w;
    }
    if (cur.length) rowsOut.push(cur);
    const rowH = (r) => Math.max(...r.map((b) => b.per[0][0].height * scale)) + 20;
    // paginate: pages of at most PAGE_H px
    const pages = [];
    let pg = [], ph = 8;
    for (const r of rowsOut) {
      if (ph + rowH(r) > PAGE_H && pg.length) { pages.push(pg); pg = []; ph = 8; }
      pg.push(r); ph += rowH(r);
    }
    if (pg.length) pages.push(pg);
    return pages.map((rows) => {
      const H = rows.reduce((s, r) => s + rowH(r), 8);
      const W = Math.max(...rows.map((r) => r.reduce((s, b) => s + bwpx(b) + pad, 8)));
      return drawRows(rows, W, H);
    });
    function drawRows(rowsOut, W, H) {
    const [cv, c] = canvas(W, H);
    let y = 4;
    for (const r of rowsOut) {
      let x = 4;
      for (const b of r) {
        const d = b.cell.d;
        label(c, b.cell.id + (b.cell.frames > 1 ? ' x' + b.cell.frames : '') + (d.tall ? ' T' : '') + (d.pass ? ' ~' : ''), x, y);
        let xx = x;
        for (const fr of b.per) {
          for (const f of fr) { c.drawImage(up(f, scale), xx, y + 14); xx += f.width * scale + 2; }
          xx += 6;
        }
        x = xx + pad;
      }
      y += rowH(r);
    }
    return cv.toDataURL();
    }
  }
  function roomsSheet(list, scale, frame) {
    const parts = list.map((r) => ({ name: r.name, cv: up(render(compile(r.def), frame), scale) }));
    const W = Math.max(...parts.map((p) => p.cv.width)) + 8;
    const H = parts.reduce((s, p) => s + p.cv.height + 20, 4);
    const [cv, c] = canvas(W, H);
    let y = 4;
    for (const p of parts) { label(c, p.name, 4, y); c.drawImage(p.cv, 4, y + 16); y += p.cv.height + 20; }
    return cv.toDataURL();
  }
  function grid(list, scale, frame, cols) {
    const parts = list.map((r) => ({ name: r.name, cv: up(render(compile(r.def), frame), scale) }));
    const cw = Math.max(...parts.map((p) => p.cv.width)) + 8, ch = Math.max(...parts.map((p) => p.cv.height)) + 22;
    const [cv, c] = canvas(cols * cw + 4, Math.ceil(parts.length / cols) * ch + 4);
    parts.forEach((p, i) => { const x = (i % cols) * cw + 4, y = Math.floor(i / cols) * ch + 4; label(c, p.name, x, y); c.drawImage(p.cv, x, y + 16); });
    return cv.toDataURL();
  }
  return { decorSheet, roomsSheet, grid, render, up };
})();
`;

/** --zoom <png> --rect x,y,w,h [--z N] --to <png>: crop & upscale any screenshot/sheet */
async function zoom(pw) {
  const [x, y, w, h] = opt('rect', '0,0,256,224').split(',').map(Number), z = +opt('z', 2);
  const src = 'data:image/png;base64,' + fs.readFileSync(path.resolve(opt('zoom'))).toString('base64');
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const url = await page.evaluate(async ([src, x, y, w, h, z]) => {
    const img = new Image(); img.src = src; await img.decode();
    const cv = document.createElement('canvas'); cv.width = w * z; cv.height = h * z;
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.drawImage(img, x, y, w, h, 0, 0, w * z, h * z);
    return cv.toDataURL();
  }, [src, x, y, w, h, z]);
  const out = path.resolve(opt('to', '/tmp/claude-0/zoom.png'));
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('zoom →', out);
  await browser.close();
}

async function main() {
  let playwright;
  try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }
  if (opt('zoom')) return zoom(playwright);
  fs.mkdirSync(OUT, { recursive: true });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
${sources().map((f) => `<script src="file://${f}"></script>`).join('\n')}
<script src="file://${path.join(OUT, '_decor_page.js')}"></script>
</body></html>`;
  fs.writeFileSync(path.join(OUT, '_decor_page.js'), PAGE);
  const pageFile = path.join(OUT, '_decor.html');
  fs.writeFileSync(pageFile, html);
  const browser = await playwright.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto('file://' + pageFile);
  await page.waitForTimeout(300);
  const save = (name, url) => {
    const f = path.join(OUT, name + '.png');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log('sheet →', f);
  };
  const t0 = Date.now();
  if (ONLY.includes('decor')) {
    const themes = (opt('themes', 'castle,house,town')).split(',');
    const ids = opt('ids') ? opt('ids').split(',') : null;
    const urls = await page.evaluate(([s, th, ids]) => { if (ids) window.SHEET_IDS = ids; return SHEET.decorSheet(s, th); }, [SCALE, themes, ids]);
    urls.forEach((u, i) => save('decor' + (urls.length > 1 ? '_' + (i + 1) : ''), u));
  }
  if (ONLY.includes('themes')) {
    const list = THEMES.map((th) => { const def = roomDef('theme'); def.theme = th; return { name: th, def }; });
    save('themes', await page.evaluate(([l, s, f]) => SHEET.grid(l, s, f, 3), [list, Math.max(1, SCALE - 1), FRAME]));
  }
  if (ONLY.includes('study')) {
    // --study dungeon|town (both by default), --themes a,b,… ; one PNG per two themes
    const kinds = opt('study', 'dungeon,town').split(',');
    for (const kind of kinds) {
      const themes = opt('themes') ? opt('themes').split(',') : kind === 'town' ? THEMES_TOWN : THEMES_DUNGEON;
      for (let i = 0; i < themes.length; i += 2) {
        const pair = themes.slice(i, i + 2);
        const list = pair.map((th) => { const d = studyDef(kind, th); d.id = 'study_' + kind + '_' + th; return { name: th, def: d }; });
        save('study_' + kind + '_' + pair.join('+'), await page.evaluate(([l, sc, f]) => SHEET.grid(l, sc, f, 2), [list, SCALE, FRAME]));
      }
    }
  }
  if (ONLY.includes('rooms')) {
    const list = Object.keys(ROOMS).filter((k) => !opt('room') || opt('room').split(',').includes(k)).map((k) => ({ name: k + ' — ' + ROOMS[k].name + ' (' + ROOMS[k].theme + ')', def: roomDef(k) }));
    save('rooms', await page.evaluate(([l, s, f]) => SHEET.roomsSheet(l, s, f), [list, SCALE, FRAME]));
  }
  const stats = await page.evaluate(`(() => { const G = RPG.Gfx; return { warned: Object.keys(G._warned) }; })()`);
  console.log('missing', stats.warned.join(' ') || '-', 'in', Date.now() - t0, 'ms');
  for (const e of errors) console.log('[page]', e);
  await browser.close();
  if (errors.length) process.exitCode = 1;
}
main().catch((e) => { console.error(e); process.exit(2); });
