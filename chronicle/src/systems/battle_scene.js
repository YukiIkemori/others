// Side-view battle scene (owner: SV-SCENE — DESIGN §11.5, Part A8 版). RS2-style composition: the monsters stand on
// the left (front-facing sprites as drawn), the party of four stands on the right in a column facing left (the middle
// row one step back), a status panel at the bottom right (row tag, name, H/M/W per member), commands at the bottom
// left and a message / help window at the top that shows only when there is text. It drives a R.Battle.Engine and
// only animates the events the engine yields (battle.js), so real battles and R.Battle.simulate share every rule.
// The scene alone plays sounds, jingles and screen shakes (§3.3.8).
//
//   const result = await R.Battle.start({zone|troop|mons, bg, bgm, canLose, noEscape, surprise,
//                                        noRare, noGolden, tier, lvOff, glimmerForce, members});
//   → 'win' | 'lose' | 'escape'          R.Battle.last = {result, rounds, killed, exp, gold, drops, glimmers, levelUps, …}
//
// Public: R.Battle.LAYOUT (§11.5.1), R.Battle.enemyLayout(list) (§11.5.13), R.Battle.HELP / BANNER / CARD (new values),
// and the legacy front-view constants WIN WIN_BOTTOM BOX GROUND (values unchanged, unused by the screen — other owners'
// tools still read them). Party battle sprites come from R.Art.battler (SV-ART, §11.4.4); while it is not there the
// scene builds its own stand-in sheet from the field sprite (§11.4.4.3 「代わり」).
(function (R) {
  'use strict';
  const U = R.U;
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const B = (R.Battle = R.Battle || {});

  // ------------------------------------------------------------ layout (DESIGN §11.5.1 — R.Battle.LAYOUT)
  const FIELD = { x: 0, y: 0, w: 256, h: 152 };
  const MSG = { x: 4, y: 4, w: 248, h: 34, lines: 2 };
  const MSG_BIG = { x: 4, y: 4, w: 248, h: 62, lines: 4 };
  const HELP = { x: 4, y: 4, w: 248, h: 19 };
  const LIST = { x: 4, y: 64, w: 168, rows: 5, lineH: 14, padY: 8 };
  const CMD = { x: 4, y: 152, w: 88, h: 68 };
  const STATUS = { x: 94, y: 152, w: 158, h: 68 };
  const BANNER = { cx: 88, y: 44, h: 32 };
  const CARD = { x: 8, y: 76, w: 168 };
  // Part A12: the rare / super steal popup shows POP_LEN frames (~1.5 s) whatever the speeds; A cuts it, never below
  // POP_MIN (0.6 s). A rare / super drop card of the rewards takes no key before CARD_MIN (0.6 s)
  const POP_LEN = 90, POP_MIN = 36, CARD_MIN = 36;
  const POP = { cx: 88, y: 44, h: 36, minW: 124 }; // under MSG, where the glimmer banner opens (never at once)
  const EZ = { x0: 4, x1: 172, cx: 88 };
  const PARTY = { front: 192, middle: 222, zig: [0, 10, 0, 10], step: 10, y: { 1: [126], 2: [112, 136], 3: [106, 124, 142], 4: [100, 116, 132, 148] } };
  const LAYOUT = { FIELD, MSG, MSG_BIG, HELP, LIST, CMD, STATUS, BANNER, CARD, EZ, PARTY };
  // STATUS columns (§11.5.2; x from the window's left): letters at h / m, 「現在/最大」 right-aligned at hp / mp
  // (A18: WP is gone, so each row shows H cur/max and M cur/max; room for 999/999 and 250/250, the name fitted in nameW)
  const SCOL = { tag: 4, name: 18, nameW: 36, h: 56, hp: 100, m: 104, mp: 154 };
  // legacy (front view): kept with their old values for the tools that still read them (§11.5.1). Not used on screen.
  const WIN = { xs: [3, 66, 129, 192], y: 5, w: 61, h: 46 };
  const WIN_BOTTOM = 56;
  const BOX = { x: 8, y: 150, w: 240, h: 68, lines: 4 };
  const GROUND = 130;

  // enemy rows (§11.5.13)
  const ROW_FEET = { 1: [134], 2: [114, 142], 3: [102, 122, 142] };
  const BIG_H = 80, BIG_FEET = 146, ROW_W = 164, ROW_W3 = 196, GAP = 6, BACK_SHIFT = 8;

  const AUTO_OPTS = { thrift: true, items: 'auto' }; // オート: conserve MP, items only as a last resort
  const BACK = { back: true };
  const METAL_COL = '#c8d0e0'; // 鋼の魔物の名前 (§11.1.2)
  const GOLD_TINT = '#ffd24a';
  const GLOW_FILL = '#fff0a0', GLOW_EDGE = '#ffd24a';
  const GLOW_FRAMES = 40;
  const GLIM_MIN = 36; // the tech's own fx never starts earlier than this after the ピコーン (§11.0 0.5)
  const GLIM_HANDBACK = 14; // the glimmer handler returns here: the 「…を閃いた！」 line types under the open banner
  const RAY_COL = '#fff6c0';
  const HURT_VOICE_GAP = 120; // the hero's 'hurt' shout at most every 2 s (real frames — multi-hits and DoT ticks, §11.10.8)
  // unusable(u, id, slot) → help line (§11.5.3 / STYLE_JA §9)
  const WHY = {
    mp: 'MPが足りない！', silence: '術を封じられている！', reach: '後列からは届かない。',
    field: '戦闘中は使えない。', noescape: 'この戦いからは逃げられない！',
  };
  const HELP_REPEAT = '前と同じ行動を、Bを押すまで続ける。';
  const HELP_REPEAT_NONE = 'くり返す行動がまだない。';
  const HELP_NOESCAPE = 'この戦いからは逃げられない！';
  // used only while DB.statuses is empty (order of §7.9.2)
  const BASE_STATUSES = ['poison', 'burn', 'sleep', 'paralyze', 'freeze', 'stun', 'confuse', 'silence', 'blind', 'regen', 'veil', 'counter', 'nimble', 'cover'];
  const GRADE_RANK = { normal: 0, rare: 1, super: 2 };
  const ART_FX = { katana: 'slash', club: 'strike' }; // an item's art shape → its plain-attack fx (A19: 刀の剣・メイスの斧)

  // ------------------------------------------------------------ party battle sprites (§11.4.4 — SV-ART's API)
  // The table of §11.4.4.4; R.Art.BATTLER is the reference once SV-ART has landed it.
  const BAT_FALLBACK = {
    W: 48, H: 40, FEET: [24, 39],
    POSES: ['idle', 'walk', 'slash', 'thrust', 'smash', 'shoot', 'punch', 'lash', 'cast', 'item', 'guard', 'hit', 'weak', 'ko', 'victory'],
    FRAMES: { idle: 2, walk: 2, slash: 3, thrust: 3, smash: 3, shoot: 3, punch: 3, lash: 3, cast: 3, item: 2, guard: 1, hit: 1, weak: 2, ko: 1, victory: 2 },
    IMPACT: { slash: 1, thrust: 1, smash: 1, shoot: 2, punch: 1, lash: 1, cast: 2, item: 1 },
    // the 7 weapon types + fist (素手); katana / club stay as art shapes (item art:'katana' swords, art:'club' maces)
    FAMILY: { sword: 'slash', greatsword: 'slash', dagger: 'thrust', axe: 'smash', spear: 'thrust', bow: 'shoot', staff: 'smash', fist: 'punch', katana: 'slash', club: 'smash' },
  };
  const HOLD = { idle: [24, 24], walk: [4, 4], slash: [5, 3, 10], thrust: [5, 3, 10], smash: [6, 3, 10], shoot: [6, 4, 10], punch: [4, 3, 10], lash: [5, 3, 10], cast: [6, 10, 8], item: [6, 10], guard: [1], hit: [12], weak: [30, 30], ko: [1], victory: [12, 12] };
  const LOOPS = { idle: 1, walk: 1, guard: 1, weak: 1, ko: 1, victory: 1 };
  const BAT = () => (R.Art && R.Art.BATTLER && R.Art.BATTLER.FAMILY ? R.Art.BATTLER : BAT_FALLBACK);
  const familyOf = (wtype) => BAT().FAMILY[wtype] || BAT_FALLBACK.FAMILY[wtype] || 'punch';

  /** the frame of a pose t frames after it started (sheets without their own frame()) */
  function frameAt(sheet, pose, t) {
    const p = sheet.poses[pose] || sheet.poses.idle;
    const fr = p.frames, n = fr.length;
    if (n <= 1) return fr[0];
    const hold = p.hold && p.hold.length ? p.hold : fr.map(() => 8);
    const total = hold.reduce((s, x) => s + x, 0) || 1;
    if (!p.loop && t >= total) return fr[n - 1];
    let tt = p.loop ? ((Math.floor(t) % total) + total) % total : Math.max(0, t);
    for (let i = 0; i < n; i++) { if (tt < hold[i]) return fr[i]; tt -= hold[i]; }
    return fr[n - 1];
  }
  const FB_SHEETS = new Map();
  /**
   * Stand-in sheet (§11.4.4.3 代わり): the field sprite (16×24) standing on the feet point (24, 39) of a 48×40 frame,
   * with a few offsets so the choreography still reads (lean back, lunge, kneel, lie down, hop). Works without a
   * canvas (node): the frames then carry anchors and no image.
   */
  function fallbackSheet(c, wtype) {
    let look = 'party';
    if (typeof c === 'string') look = 'party:' + c; // a look id ('selma', 'hero_m_mage' …)
    else { try { look = R.Party && R.Party.spriteKey ? R.Party.spriteKey(c) : 'party:' + (c && c.id); } catch (e) { look = 'party:' + (c && c.id); } }
    const key = look + ':' + (wtype || 'fist');
    if (FB_SHEETS.has(key)) return FB_SHEETS.get(key);
    let fs = null;
    try { fs = G().has(look) ? G().get(look) : null; } catch (e) { fs = null; }
    const pickF = (dir, i) => { const l = fs && fs[dir]; return l && l.length ? l[i % l.length] : null; };
    const canvasOf = (src, dx, dy, rot) => {
      if (!src || !src.width) return null;
      try {
        const cv = G().makeCanvas(48, 40), x = cv.getContext('2d');
        if (!x) return null;
        x.imageSmoothingEnabled = false;
        if (rot) { x.translate(24 + dx, 31 + dy); x.rotate(Math.PI / 2); x.drawImage(src, -8, -12); } // head to the right (back)
        else x.drawImage(src, 16 + dx, 15 + dy);
        return cv;
      } catch (e) { return null; }
    };
    const mk = (src, dx, dy, o) => {
      o = o || {};
      const rot = !!o.rot;
      const box = rot ? { x: 12 + dx, y: 23 + dy, w: 24, h: 16 } : { x: 16 + dx, y: 15 + dy, w: 16, h: Math.min(24, 39 - (15 + dy) + 1) };
      const head = rot ? [34 + dx, 30 + dy] : [24 + dx, 15 + dy];
      const tip = o.tip || [box.x - 2, box.y + 12];
      return {
        img: canvasOf(src, dx, dy, rot), feet: [24, 39], head, hit: rot ? [24 + dx, 31 + dy] : [24 + dx, 28 + dy],
        hand: [box.x + 2, box.y + 15], tip, cast: [box.x - 3, box.y + 13], box,
      };
    };
    const L0 = pickF('left', 0), L1 = pickF('left', 1), D0 = pickF('down', 0);
    const atk = (lead) => [mk(L0, 2, 0), mk(L1 || L0, -4, 0, { tip: [8, 26] }), mk(L0, lead, 0)];
    const F = {
      idle: [mk(L0, 0, 0), mk(L0, 0, 0)], walk: [mk(L1 || L0, 0, 0), mk(L0, 0, -1)],
      slash: atk(-2), thrust: atk(-2), smash: atk(-2), punch: atk(-2), lash: atk(-2),
      shoot: [mk(L0, 1, 0), mk(L0, 2, 0), mk(L0, 0, 0, { tip: [12, 26] })],
      cast: [mk(L0, 0, 0), mk(L0, 0, -1), mk(L0, -2, 0)], item: [mk(L0, 0, 0), mk(L0, -1, -1)],
      guard: [mk(L0, 1, 2)], hit: [mk(L0, 3, 1)], weak: [mk(L0, 0, 4), mk(L0, 0, 5)], ko: [mk(L0, 0, 0, { rot: true })],
      victory: [mk(D0 || L0, 0, 0), mk(D0 || L0, 0, -1)],
    };
    const poses = {};
    for (const p of BAT_FALLBACK.POSES) poses[p] = { frames: F[p], hold: HOLD[p].slice(), loop: !!LOOPS[p], impact: BAT_FALLBACK.IMPACT[p] != null ? BAT_FALLBACK.IMPACT[p] : null };
    const sh = { key: 'bsv:' + key, look, wtype: wtype || 'fist', family: familyOf(wtype || 'fist'), W: 48, H: 40, poses, pending: true, stand: true };
    sh.frame = (pose, t) => frameAt(sh, pose, t);
    FB_SHEETS.set(key, sh);
    return sh;
  }
  /** weapon type of a slot (the other slot, then fist) — R.Art.battlerWtype when SV-ART has landed */
  function wtypeOf(c, slot) {
    if (R.Art && R.Art.battlerWtype) { try { return R.Art.battlerWtype(c, slot) || 'fist'; } catch (e) { /* fall through */ } }
    const eq = (c && c.equip) || {};
    const s = slot || 'weapon1', o = s === 'weapon1' ? 'weapon2' : 'weapon1';
    const it = DB.items[eq[s]] || DB.items[eq[o]];
    return (it && it.wtype) || 'fist';
  }
  /** the battle sheet of a member (R.Art.battler; the stand-in while it is missing or throws) */
  function battlerSheet(c, wtype) {
    const A = R.Art;
    if (A && typeof A.battler === 'function') {
      try {
        const s = A.battler(c, wtype ? { wtype } : undefined);
        if (s && s.poses && s.poses.idle && s.poses.idle.frames && s.poses.idle.frames.length) return s;
      } catch (e) { /* stand-in below */ }
    }
    return fallbackSheet(c, wtype || wtypeOf(c, 'weapon1'));
  }
  const sheetFrame = (sh, pose, t) => (typeof sh.frame === 'function' ? sh.frame(pose, t) : frameAt(sh, pose, t)) || frameAt(sh, 'idle', 0);
  const poseHold = (sh, pose) => { const p = sh.poses[pose]; return p && p.hold && p.hold.length ? p.hold : HOLD[pose] || [8]; };
  const poseImpact = (sh, pose) => { const p = sh.poses[pose]; const i = p && p.impact != null ? p.impact : BAT().IMPACT[pose]; return i == null ? 1 : i; };

  // ------------------------------------------------------------ small helpers
  function mem(c) {
    const blank = () => ({ cmd: 0, list: {}, item: 0, target: null });
    if (!c) return blank();
    if (R.Settings && R.Settings.cursorMemory === false) return blank();
    if (!c.mem || typeof c.mem !== 'object') c.mem = blank();
    if (!c.mem.list || typeof c.mem.list !== 'object') c.mem.list = {};
    return c.mem;
  }
  const flagOf = (m, f) => !!m && (typeof m.flag === 'function' ? m.flag(f) : !!(m.d && m.d.flags && m.d.flags.includes(f)));
  const isGolden = (m) => !!m && !!(m.golden || (m.d && m.d.golden) || flagOf(m, 'golden'));
  const isMetal = (m) => flagOf(m, 'metal');
  const isRareMon = (m) => flagOf(m, 'rare');
  const actionOf = (id) => (DB.actions && DB.actions[id]) || null;
  /** the six element ids in their official order (DB.elements key order) */
  const elemOrder = () => { const k = Object.keys(DB.elements || {}); return k.length ? k : ['fire', 'water', 'wind', 'earth', 'light', 'dark']; };
  /** オート: the party AI with the in-game options (battle_ai's own AUTO_OPTS when it defines them) */
  function autoCommands(eng) {
    const AI = R.BattleAI;
    return AI && AI.partyCommands ? AI.partyCommands(eng, AI.AUTO_OPTS || AUTO_OPTS) : [];
  }
  /** a 2-line item desc on the 1-line help strip: joined when it still reads (≥ 7 px a character), else its first line */
  function helpLine(desc) {
    const lines = String(desc || '').split('\n');
    const joined = lines.join('');
    return G().textWidth(joined) * (7 / (32 / 3)) <= HELP.w - 20 ? joined : lines[0];
  }
  function copyCmds(cmds) {
    const out = [];
    cmds.forEach((c, i) => { out[i] = c ? Object.assign({}, c) : c; });
    return out;
  }
  let ITEM_USES = null;
  /** is this action an item's use block (items carry no kind of their own on the fx event) */
  function isItemUse(ab) {
    if (!ab || ab.kind) return false;
    if (!ITEM_USES) { ITEM_USES = new Set(); for (const id in DB.items) if (DB.items[id].use) ITEM_USES.add(DB.items[id].use); }
    return ITEM_USES.has(ab);
  }

  // item names in battle: ★ (rare, yellow) / ★ (super, pink) / ◆ (unique, cyan) — menu's kit when it has the new API
  function kit() { return R.Menu && R.Menu.kit && R.Menu.kit.itemColor ? R.Menu.kit : null; }
  function itemLabel(id) {
    const K = kit();
    if (K && K.itemLabel) return K.itemLabel(id);
    const it = DB.items[id];
    if (!it) return '？？？';
    return (it.unique ? '◆' : it.grade === 'rare' || it.grade === 'super' || it.rare ? '★' : '') + it.name;
  }
  function itemColor(id) {
    const K = kit();
    if (K && K.itemColor) return K.itemColor(id);
    const it = DB.items[id], C = G().C;
    if (!it) return C.white;
    return it.unique ? C.cyan : it.grade === 'super' ? C.super : it.grade === 'rare' || it.rare ? C.rare : C.white;
  }
  /** icon key of an item (§8.2.8 defaults; R.Menu.kit.iconKey when available); always a registered key */
  function iconKey(id) {
    const it = DB.items[id];
    const K = R.Menu && R.Menu.kit;
    let k = null;
    if (K && K.iconKey) { try { k = K.iconKey(it); } catch (e) { k = null; } }
    if (!k && it) {
      if (it.icon) k = String(it.icon).startsWith('icon:') ? it.icon : 'icon:' + it.icon;
      else if (it.type === 'weapon') k = 'icon:' + it.wtype;
      else if (['shield', 'head', 'body', 'hands', 'feet'].includes(it.type)) k = 'icon:' + it.type;
      else if (it.type === 'acc') k = 'icon:acc';
      else if (it.type === 'key') k = 'icon:key';
      else if (it.stone) k = 'icon:el_' + it.stone;
      else if (it.type === 'consumable') {
        const e = (it.use && it.use.effects) || [];
        k = e.some((x) => x.type === 'heal' || x.type === 'revive' || x.type === 'grow') ? 'icon:herb' : 'icon:potion';
      }
    }
    return k && G().has(k) ? k : 'icon:acc';
  }

  // ------------------------------------------------------------ monster sprites and the enemy layout (§11.5.13)
  function monKey(m) { const d = m.d || {}; return 'mon:' + (m.spriteOverride || m.sprite || d.sprite || d.baseId || m.id); }
  function monImage(m) {
    const d = m.d || {};
    const key = monKey(m);
    const opts = {};
    if (d.hue) opts.hue = d.hue;
    if (d.sat != null) opts.sat = d.sat;
    if (d.bri != null) opts.bri = d.bri;
    if (isGolden(m)) opts.tint = GOLD_TINT;
    let img = Object.keys(opts).length ? G().variant(key, opts) : G().get(key);
    if (Array.isArray(img)) img = img[0];
    return img;
  }
  /** one row: sprite offsets (gaps ≤ 6, overlap ≤ half of the narrower sprite) and its default left x */
  function rowShape(items, sz, feet, shift, right) {
    const n = items.length;
    const ws = items.map((it) => sz(it).w);
    const tot = ws.reduce((s, w) => s + w, 0);
    const span = EZ.x1 - EZ.x0;
    let gap = n > 1 ? Math.min(GAP, (ROW_W - tot) / (n - 1)) : 0;
    if (n > 1) {
      const minW = Math.min(...ws);
      gap = Math.max(gap, -Math.floor(minW / 2));
      if (tot + gap * (n - 1) > span) gap = Math.max(-Math.floor(minW / 2), (span - tot) / (n - 1));
    }
    const width = tot + gap * Math.max(0, n - 1);
    const offs = [];
    let x = 0;
    for (let i = 0; i < n; i++) { offs.push(Math.round(x)); x += ws[i] + gap; }
    let x0 = right ? EZ.x1 - width : EZ.cx + shift - width / 2;
    x0 = Math.max(EZ.x0, Math.min(x0, EZ.x1 - width));
    return { items, feet, feetDef: feet, offs, width, x0: Math.round(x0), def: Math.round(x0) };
  }
  /** share of each sprite's box not covered by the ones drawn after it (feet order, then list order) */
  function visibility(rows, sz, only) {
    const boxes = [];
    rows.forEach((r) => r.items.forEach((it, i) => { const z = sz(it); boxes.push({ it, row: r, x: r.x0 + r.offs[i], y: r.feet - z.h, w: z.w, h: z.h, feet: r.feet, k: boxes.length }); }));
    const out = new Map();
    for (const A of boxes) {
      if (only && A.row !== only) continue;
      const over = boxes.filter((Bx) => Bx !== A && (Bx.feet > A.feet || (Bx.feet === A.feet && Bx.k > A.k)) && Bx.x < A.x + A.w && Bx.x + Bx.w > A.x && Bx.y < A.y + A.h && Bx.y + Bx.h > A.y);
      if (!over.length) { out.set(A.it, 1); continue; }
      let n = 0, hid = 0;
      for (let y = A.y + 1; y < A.y + A.h; y += 3) for (let x = A.x + 1; x < A.x + A.w; x += 3) { n++; if (over.some((Bx) => x >= Bx.x && x < Bx.x + Bx.w && y >= Bx.y && y < Bx.y + Bx.h)) hid++; }
      out.set(A.it, n ? 1 - hid / n : 1);
    }
    return out;
  }
  /**
   * R.Battle.enemyLayout(list [, sizeOf]) → Map(item → {x, y, row, rows, feet}) (x y = the sprite's top left).
   * list: monster units (their sprite decides the size) or plain {w, h, flying}. §11.5.13: rows and feet by the
   * table; each row centred on x 88, the back rows 8 px further right; when a back row would hide under the one in
   * front (less than 60 % of a sprite showing) it slides sideways to the nearest place that shows the most.
   */
  function enemyLayout(list, sizeOf) {
    const cache = new Map();
    const sz = (it) => {
      if (cache.has(it)) return cache.get(it);
      let w = 32, h = 32;
      if (it && typeof it.w === 'number' && typeof it.h === 'number' && !it.d && !it.id) { w = it.w; h = it.h; }
      else {
        let img = null;
        try { img = sizeOf ? sizeOf(it) : monImage(it); } catch (e) { img = null; }
        if (img) { w = img.width || w; h = img.height || h; }
      }
      const r = { w, h };
      cache.set(it, r);
      return r;
    };
    const out = new Map();
    const n = list.length;
    if (!n) return out;
    const width = (row) => row.reduce((s, it) => s + sz(it).w, 0) + GAP * Math.max(0, row.length - 1);
    let rows = []; // back to front
    const big = list.filter((it) => sz(it).h >= BIG_H);
    if (big.length) {
      // big sprites in front (feet 146, centred), the rest behind them right-aligned — split in two when too wide.
      // When that hides an escort (under half showing), the big row moves to the left edge; if one is still
      // hidden, the escorts stand in front at the big one's right (feet 148) instead (§11.5.13)
      const rest = list.filter((it) => sz(it).h < BIG_H);
      const layout = (left, front) => {
        const out = [];
        const bigRow = rowShape(big, sz, BIG_FEET, 0, false);
        if (left) bigRow.x0 = bigRow.def = EZ.x0;
        if (rest.length && front) { out.push(bigRow, rowShape(rest, sz, BIG_FEET + 2, 0, true)); return out; }
        let backRows = rest.length ? [rest] : [];
        if (rest.length && width(rest) > ROW_W) backRows = [rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)];
        const feetB = backRows.length === 2 ? [102, 122] : [114];
        backRows.forEach((row, ri) => out.push(rowShape(row, sz, feetB[ri], 0, true)));
        out.push(bigRow);
        return out;
      };
      const worst = (rs) => Math.min(...visibility(rs, sz).values());
      let best = null, bestV = -1;
      for (const [left, front] of [[false, false], [true, false], [true, true]]) {
        const rs = layout(left, front);
        const v = rest.length ? worst(rs) : 1;
        if (v > bestV + 0.001) { best = rs; bestV = v; }
        if (v >= 0.5) break;
      }
      rows = best;
    } else {
      let rowsN = 1;
      if (!(width(list) <= ROW_W && n <= 3)) {
        rowsN = 2;
        const two = [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)];
        if (two.some((r) => width(r) > ROW_W3)) rowsN = 3;
      }
      for (let r = 0; r < rowsN; r++) rows.push(rowShape(list.filter((_, i) => i % rowsN === r), sz, ROW_FEET[rowsN][r], (rowsN - 1 - r) * BACK_SHIFT, false));
    }
    // back rows slide sideways only when the row in front would hide them (front row first, then further back).
    // Not behind a big sprite: its escorts peek out at its upper right as placed (§11.5.13)
    for (let r = big.length ? -1 : rows.length - 2; r >= 0; r--) {
      const row = rows[r];
      const minVis = () => Math.min(...visibility(rows, sz, row).values());
      if (minVis() >= 0.6) continue;
      let best = row.def, bestScore = -Infinity;
      for (let x0 = EZ.x0; x0 <= EZ.x1 - row.width; x0 += 2) {
        row.x0 = x0;
        const score = Math.min(0.6, minVis()) * 1000 - Math.abs(x0 - row.def);
        if (score > bestScore) { bestScore = score; best = x0; }
      }
      row.x0 = best;
      // still under half showing: the row stands up to 6 px further back (§11.5.13 allows ±6 px)
      for (let up = 2; up <= 6 && minVis() < 0.5; up += 2) row.feet = row.feetDef - up;
    }
    rows.forEach((row, ri) => row.items.forEach((it, i) => out.set(it, { x: row.x0 + row.offs[i], y: row.feet - sz(it).h, row: ri, rows: rows.length, feet: row.feet })));
    return out;
  }

  // ------------------------------------------------------------ the scene
  class BattleScene extends R.Layer {
    constructor(eng, o) {
      super();
      this.eng = eng;
      this.o = o || {};
      this.opaque = false; // the field stays visible during the intro flashes
      this.ready = false;
      this.fxList = [];
      this.pops = [];
      this.msg = { lines: [], start: 0, ch: 0, need: 0, hold: 0, wait: 0, key: false, resolve: null };
      this.big = false; // MSG_BIG: rewards, defeat, escape (§11.5.5)
      this.input = null;
      this.panel = null;
      this.cmdList = null; // the member's command list while one of its lists is open (drawn gray in CMD)
      this.auto = !!this.o.autoStart;
      this.autoCancel = false;
      this.repeating = false; // リピート: on until B (this battle only, never in c.mem — §11.5.3a)
      this.repeatCancel = false;
      this.lastCmds = null;
      this.acting = null; // the member entering commands (steps forward, STATUS band)
      this.actor = null; // the unit whose action is playing
      this.picking = null; // {units:[...]} | {ally} | {allies:true}
      this.winFx = eng.party.map(() => ({ shake: 0, flash: 0, glow: 0 })); // STATUS row effects
      this.partyIdx = 0;
      this.glim = null; // glimmer {u, t0, H, name, title, color, w, bulb}
      this.glimUntil = 0; // the next action waits until this frame
      this.card = null; // drop card {grade, item, t0, transient}
      this.cardSkip = false; // a key pressed while a rare / super drop card was younger than CARD_MIN (Part A12)
      this.stealPop = null; // rare / super steal popup {grade, item, t0, cut} (Part A12, §11.5.8)
      this.dim = 0; // super-rare: the field darkened
      this.locked = false; // super-rare jingle: key waits refuse input until it ends
      this.levelJingle = false;
      this.log = { glimmers: [], drops: [], levelUps: [], stolen: [] };
      this.goldenShown = new Set();
      this.roundCmds = null;
      this.inRound = false;
      this.victoryPose = false;
      this.actStart = 0;
      this.layout();
      this.layoutParty();
    }
    get spd() { return [1, 1.6, 2.6][R.Settings.battleSpeed] || 1.6; }
    /** length of a motion (§11.5.16): n / spd, オート・リピート中は移動 ×0.6・攻撃のポーズ ×0.8 */
    dur(n, kind) {
      const k = this.auto || this.repeating ? (kind === 'move' ? 0.6 : 0.8) : 1;
      return Math.max(1, Math.ceil((n / this.spd) * k));
    }

    // ------------------------------------------------------------ monsters (§11.5.13)
    spriteKey(m) { return monKey(m); }
    monImg(m) { return monImage(m); }
    visImg(m) { const v = this.vis && this.vis.get(m); return v ? v.img : monImage(m); }
    newVis(m, i, img) {
      return {
        m, img, x: 0, y: 0, w: img ? img.width : 32, h: img ? img.height : 32, i, row: 0, rows: 1, back: false,
        flash: 0, shake: 0, blink: 0, lunge: 0, lungeN: 12, dodge: 0, appear: 0, appearN: 20, solid: 0, gflash: 0,
        die: null, flee: null, gone: false, move: null, spk: [], fly: flagOf(m, 'flying'),
      };
    }
    /** positions of a list (display order): R.Battle.enemyLayout with this scene's sprites; .back = not the front row */
    arrange(list) {
      const pos = enemyLayout(list, (m) => this.visImg(m));
      for (const p of pos.values()) p.back = p.row < p.rows - 1;
      return pos;
    }
    layout() {
      this.vis = new Map();
      const list = this.eng.mons;
      list.forEach((m, i) => this.vis.set(m, this.newVis(m, i, monImage(m))));
      for (const [m, p] of this.arrange(list)) Object.assign(this.vis.get(m), { x: p.x, y: p.y, row: p.row, rows: p.rows, back: p.back });
    }
    /** summoned monsters: everyone still standing is laid out again; newcomers slide in from the left edge (§11.5.13) */
    relayout(newcomers) {
      const fresh = new Set(newcomers);
      for (const m of newcomers) if (!this.vis.has(m)) this.vis.set(m, this.newVis(m, this.eng.mons.indexOf(m), monImage(m)));
      const list = this.eng.mons.filter((m) => fresh.has(m) || (m.alive && !this.vis.get(m).gone && !this.vis.get(m).die));
      for (const [m, p] of this.arrange(list)) {
        const v = this.vis.get(m);
        v.row = p.row; v.rows = p.rows; v.back = p.back;
        if (fresh.has(m)) {
          v.x = -v.w - 4; v.y = p.y;
          v.appear = 12; v.appearN = 12;
          v.die = null; v.flee = null; v.gone = false;
        }
        v.move = { x0: v.x, y0: v.y, x1: p.x, y1: p.y, t: 0, n: 12 };
      }
    }

    // ------------------------------------------------------------ party (§11.5.14)
    layoutParty() {
      this.pvs = this.eng.party.map((p, i) => ({
        p, i, x: 0, y: 0, homeX: 0, homeY: 0, lift: 0, koShown: !p.alive, deadAt: null, glide: null, move: null, act: null, tmp: null, flash: null,
        shake: 0, push: null, hop: null, nudge: null, away: false, flee: null, alt: null, sheets: {},
      }));
      this.pvMap = new Map(this.pvs.map((v) => [v.p, v]));
      this.updateHomes(true);
    }
    pv(u) { return u && this.pvMap ? this.pvMap.get(u) || null : null; }
    homeOf(p, i) {
      const n = U.clamp(this.eng.party.length, 1, 4);
      const ys = PARTY.y[n];
      const y = ys[Math.min(i, ys.length - 1)];
      const x = (this.rowOf(p) === 'middle' ? PARTY.middle : PARTY.front) + (PARTY.zig[i] || 0);
      return [x, y];
    }
    /** homes follow the effective row (a middle row whose front has fallen moves up); snap = no walk */
    updateHomes(snap) {
      for (const v of this.pvs || []) {
        const [x, y] = this.homeOf(v.p, v.i);
        v.homeX = x; v.homeY = y;
        if (snap) { v.x = x; v.y = y; v.glide = null; }
      }
    }
    sheetOf(v) {
      const w = v.alt || wtypeOf(v.p.c, 'weapon1');
      return v.sheets[w] || (v.sheets[w] = battlerSheet(v.p.c, w));
    }
    /** the pose a member shows when not acting (§11.5.14) */
    restPose(v) {
      const p = v.p, st = p.status || {};
      if (!p.alive) {
        // a lethal hit leaves the member reeling (not yet lying) until the engine's 'die' event, which plays hit 6 → ko;
        // lying down at the 'dmg' and standing up again for the 'die' flickered (review round 1). 90 frames at most.
        const F = R.Engine.frame;
        if (v.koShown) return { pose: 'ko', fi: 0 };
        if (v.deadAt == null) v.deadAt = F;
        if (F - v.deadAt < 90) return { pose: 'hit', fi: 0 };
        v.koShown = true;
        return { pose: 'ko', fi: 0 };
      }
      v.koShown = false; v.deadAt = null;
      if (this.victoryPose) return { pose: 'victory' };
      const cmd = this.inRound && this.roundCmds && this.roundCmds[p.idx];
      if (this.inRound && ((cmd && cmd.type === 'defend') || p.defending)) return { pose: 'guard', fi: 0 };
      if (st.sleep) return { pose: 'weak', fi: 0 };
      if (st.paralyze || st.freeze || st.stun) return { pose: 'idle', fi: 0 };
      if (p.hp <= p.mhp * 0.25) return { pose: 'weak' };
      return { pose: 'idle' };
    }
    poseOf(v) {
      const F = R.Engine.frame;
      if (v.flee) return { pose: 'walk', t: F - v.flee.f0, flip: true };
      if (v.move) return { pose: v.move.pose, fi: v.move.fi, t: F - v.move.f0 };
      if (v.tmp && F < v.tmp.until) return v.tmp;
      if (v.act) return v.act;
      if (v.glide) return { pose: 'walk', t: F - v.glide.f0 };
      if (v.hop) return { pose: 'walk', fi: 1 };
      const r = this.restPose(v);
      if (r.fi == null) r.t = F + v.i * 11; // the breath of each member is out of step
      return r;
    }
    frameOf(v) {
      const sh = this.sheetOf(v);
      const q = this.poseOf(v);
      const pose = sh.poses[q.pose] ? q.pose : 'idle';
      const fr = sh.poses[pose].frames;
      const f = q.fi != null ? fr[U.clamp(q.fi, 0, fr.length - 1)] : sheetFrame(sh, pose, q.t || 0);
      return { f: f || fr[0], flip: !!q.flip, pose };
    }
    /** the member's feet on screen, with the small hit / dodge / escape offsets */
    posOf(v) {
      const F = R.Engine.frame;
      let x = v.x;
      const wave = (o, amp) => { if (!o) return 0; const q = (F - o.f0) / o.n; return q >= 0 && q < 1 ? Math.sin(q * Math.PI) * amp : 0; };
      x += wave(v.push, 3) + wave(v.hop, 8) + wave(v.nudge, 4);
      if (v.shake > 0) x += Math.floor(v.shake) % 4 < 2 ? 2 : -2;
      if (v.flee) x += Math.max(0, F - v.flee.f0) * (80 / 24);
      const st = v.p.status || {};
      if (st.confuse && v.p.alive && !v.act && !v.move) x += Math.floor(F / 24) % 2;
      return [Math.round(x), Math.round(v.y - (v.lift || 0))];
    }
    /** scripted walk / hop of a member; resolves on arrival (n already scaled) */
    moveTo(v, x, y, n, o) {
      o = o || {};
      return new Promise((res) => {
        if (v.move && v.move.res) v.move.res();
        v.glide = null;
        v.move = { x0: v.x, y0: v.y, x1: x, y1: y, t: -(o.delay || 0), n: Math.max(1, n), arc: o.arc || 0, pose: o.pose || 'walk', fi: o.fi != null ? o.fi : null, f0: R.Engine.frame, res };
      });
    }
    /** a member in front of the enemy hops back home (back to front, walk frame 0, a 4 px arc — §11.5.15) */
    async returnHome(v) {
      v.act = null;
      if (!v.away) return;
      await this.moveTo(v, v.homeX, v.homeY, this.dur(10, 'move'), { pose: v.p.alive ? 'walk' : 'ko', fi: 0, arc: v.p.alive ? 4 : 0 });
      v.away = false;
      v.alt = null;
    }
    /** everyone home and out of their action poses (next actor, end of the round, victory, escape) */
    settle() {
      const away = (this.pvs || []).filter((v) => v.away);
      for (const v of this.pvs || []) if (!v.away) { v.act = null; v.alt = null; }
      return away.length ? Promise.all(away.map((v) => this.returnHome(v))) : null;
    }
    /** run up to the target(s): 12 px right of the right edge, at their feet (§11.5.15 立つ所) */
    async runTo(v, foes) {
      const rs = foes.map((t) => this.rectOf(t));
      let x = Math.max(...rs.map((r) => r.x + r.w)) + 12;
      const ys = foes.map((t) => { const mv = this.vis.get(t); return mv ? mv.y + mv.h : this.rectOf(t).bottom; });
      const y = U.clamp(Math.round(ys.reduce((s, q) => s + q, 0) / ys.length), 100, 148);
      x = Math.round(Math.min(x, v.homeX - 8));
      if (v.away && Math.abs(v.x - x) < 1 && Math.abs(v.y - y) < 1) return;
      v.act = null;
      v.away = true;
      await this.moveTo(v, x, y, this.dur(12, 'move'), { pose: 'walk' });
    }
    walkIn() {
      // the party walks in from the right while the screen brightens (16 frames, 3 frames apart — §11.5.9)
      (this.pvs || []).forEach((v, i) => {
        if (!v.p.alive) return;
        v.x = v.homeX + 56;
        this.moveTo(v, v.homeX, v.homeY, 16, { pose: 'walk', delay: i * 3 });
      });
    }

    /** geometry used by effects, numbers and cursors (§11.5.17 rectOf) */
    rectOf(u) {
      if (u && u.isParty) {
        const v = this.pv(u);
        if (!v) return { x: 200, y: 100, w: 20, h: 28, cx: 210, cy: 114, bottom: 128, side: 'party', feet: [210, 128], head: [210, 100], hand: [204, 114], tip: [200, 110], cast: [198, 112] };
        const { f } = this.frameOf(v);
        const [X, Y] = this.posOf(v);
        const ox = X - 24, oy = Y - 39;
        const b = (f && f.box) || { x: 16, y: 15, w: 16, h: 24 };
        const P = (a, d) => (a ? [ox + a[0], oy + a[1]] : d);
        const hit = P(f && f.hit, [X, oy + b.y + b.h / 2]);
        return {
          x: ox + b.x, y: oy + b.y, w: b.w, h: b.h, cx: hit[0], cy: hit[1], bottom: Y, side: 'party', feet: [X, Y],
          head: P(f && f.head, [X, oy + b.y]), hand: P(f && f.hand, [ox + b.x, hit[1]]), tip: P(f && f.tip, [ox + b.x - 2, hit[1]]),
          cast: P(f && f.cast, [ox + b.x - 3, hit[1]]),
        };
      }
      const v = this.vis.get(u);
      if (!v) return { x: 72, y: 90, w: 32, h: 32, cx: 88, cy: 108, bottom: 120, side: 'mon', head: [88, 90], cast: [88, 101] };
      const cx = v.x + v.w / 2;
      return { x: v.x, y: v.y, w: v.w, h: v.h, cx, cy: v.y + v.h * 0.55, bottom: v.y + v.h - 2, side: 'mon', head: [cx, v.y], cast: [cx, v.y + v.h * 0.35] };
    }
    addFx(f) { this.fxList.push(f); }
    rowOf(p) {
      const c = p.c;
      if (R.Rules && R.Rules.effectiveRow && c) {
        try { return R.Rules.effectiveRow(c, this.eng.party.map((x) => x.c)); } catch (e) { /* fall through */ }
      }
      return (typeof p.row === 'string' ? p.row : c && c.row) === 'middle' ? 'middle' : 'front';
    }
    /** status icons of a party member, in DB.statuses order then up/down (§11.3.6) */
    iconsOf(p) {
      if (!this._iconOrder) {
        const keys = Object.keys(DB.statuses || {});
        this._iconOrder = (keys.length ? keys : BASE_STATUSES).filter((s) => s !== 'death' && G().has('bfx:icon_' + s));
      }
      const st = p.status || {};
      const out = this._iconOrder.filter((s) => st[s] || (s === 'regen' && p.permRegen && p.alive));
      if (p.alive && p.buffs) {
        const v = Object.values(p.buffs);
        if (v.some((x) => x > 0)) out.push('up');
        if (v.some((x) => x < 0)) out.push('down');
      }
      return out;
    }

    // ------------------------------------------------------------ helpers
    frames(n) { return R.Engine.wait(Math.max(1, Math.ceil(n / this.spd))); }
    ask(fn) { return new Promise((res) => { this.input = fn; this.inputRes = res; }); }
    /** a number over a unit (§11.5.6): monsters at 40 % of the sprite; members on their own chest (the hit anchor
     *  − 8) — above the head it would sit on the member drawn one row higher (rows are 16 px apart) */
    pop(u, n, color) {
      const r = this.rectOf(u);
      const same = this.pops.filter((p) => p.u === u && p.t < 20).length;
      const x = r.cx;
      const y = (u.isParty ? Math.max(42, r.cy - 8) : Math.max(42, r.y + r.h * 0.4)) - same * 9;
      this.pops.push({ u, x, y, str: n == null ? 'MISS' : String(n), color, t: 0, party: !!u.isParty });
    }

    // ------------------------------------------------------------ messages
    get msgBox() { return this.big || this.paged ? MSG_BIG : MSG; }
    clearMsg() { const m = this.msg; m.lines = []; m.start = 0; m.ch = 0; m.need = 0; }
    async say(text) {
      const box = this.msgBox;
      const lines = G().wrap(text, box.w - 20);
      // paged mode (rewards): never scroll unread lines away — wait for a key and start a new page
      if (this.paged && this.msg.lines.length && this.msg.lines.length + lines.length > box.lines) {
        await this.waitKey();
        this.clearMsg();
      }
      return new Promise((resolve) => {
        const m = this.msg;
        m.lines = m.lines.concat(lines);
        while (m.lines.length > box.lines) m.lines.shift();
        m.start = m.lines.length - lines.length;
        m.ch = 0;
        m.need = lines.join('').length;
        m.hold = 0;
        m.wait = 30;
        m.key = false;
        m.resolve = resolve;
      });
    }
    waitKey() {
      return new Promise((resolve) => {
        const m = this.msg;
        m.ch = m.need; m.key = true; m.resolve = resolve;
      });
    }
    tickMsg() {
      const m = this.msg;
      if (!m.resolve) return;
      if (m.ch < m.need) {
        const rate = ([0.5, 1, 2, 999][R.Settings.msgSpeed] || 2) * this.spd * (In().down('a') ? 3 : 1);
        m.ch = Math.min(m.need, m.ch + rate);
        return;
      }
      if (m.key) return;
      m.hold += this.spd * (In().down('a') ? 2.5 : this.auto ? 1.4 : 1);
      if (m.hold >= m.wait) { const r = m.resolve; m.resolve = null; r(); }
    }

    // ------------------------------------------------------------ main flow
    onPush() { this.main(); }
    async main() {
      let result = 'escape';
      const eng = this.eng;
      try {
        await this.intro();
        await this.play(eng.begin());
        await this.goldenEntrance(); // for an engine that yields no {t:'golden'}
        while (!eng.result) {
          const ambush = eng.round === 0 && eng.surprise === 'ambush';
          this.updateHomes(false); // a middle row whose front has fallen steps up (§11.5.14)
          const cmds = ambush ? null : await this.commandPhase();
          // リピート repeats what was really entered last round (menus, リピート or オート); 逃げる never repeats
          if (cmds && !cmds.flee && cmds.some(Boolean)) this.lastCmds = copyCmds(cmds);
          this.panel = null;
          this.acting = null;
          this.roundCmds = cmds || null;
          this.inRound = true;
          await this.play(eng.playRound(cmds));
          await this.settle();
          this.inRound = false;
          this.actor = null;
          await this.waitStealPop();
          this.clearTransientCard();
        }
        result = eng.result;
        if (this.autoCancel || result === 'lose') B.autoCarry = false; // B pressed during the last round / wiped
        this.auto = false;
        this.repeating = false;
        this.repeatCancel = false;
        this.acting = null;
        await this.waitGlimmerClosed();
        if (result === 'win') await this.victory();
        else if (result === 'lose') await this.defeat();
        else await this.frames(16);
      } catch (e) {
        R.Engine.reportError(e);
        result = eng.result || (eng.party.some((p) => p.alive) ? 'escape' : 'lose');
      }
      this.card = null; this.dim = 0; this.locked = false; this.stealPop = null;
      try { eng.finish(); } catch (e) { R.Engine.reportError(e); }
      await R.Engine.fadeOut(16);
      // ↓ used to page the rewards: wait for its release so it does not walk the party on the field
      for (let i = 0; i < 600 && this.downLatch && In().down('down'); i++) await R.Engine.wait(1);
      this.downLatch = false;
      In().consume();
      this.close(result);
      R.Engine.fadeIn(12);
    }
    async intro() {
      // two flashes over the field, then black stripes zip in from alternate sides
      for (let i = 0; i < 2; i++) { R.Engine.flashScreen('#ffffff', 7); await R.Engine.wait(8); }
      this.wipe = { t: 0, n: 22 };
      await R.Engine.wait(this.wipe.n + 2);
      this.wipe = null;
      R.Engine.fadeAlpha = 1;
      this.opaque = true;
      this.ready = true;
      this.walkIn();
      await R.Engine.fadeIn(14);
      if (this.eng.boss) { R.sfx('roar'); R.Engine.shake(24, 2); await R.Engine.wait(20); }
      if (this.o.rare || this.eng.mons.some(isRareMon)) {
        // めずらしい魔物: two golden flashes + the fanfare, then the usual appearance lines (§11.5.9)
        for (let i = 0; i < 2; i++) { R.Engine.flashScreen('#ffe890', 14); await R.Engine.wait(12); }
        const j = R.jingle('rare');
        await this.say('めったに出会えない魔物が現れた！');
        await j;
        await this.frames(10);
      }
    }
    async goldenEntrance() {
      for (const m of this.eng.mons) if (isGolden(m) && !this.goldenShown.has(m)) await this.onGolden({ u: m });
    }
    async play(gen) { for (const ev of gen) await this.handle(ev); }

    async victory() {
      await this.frames(12);
      this.clearMsg();
      this.paged = true;
      await this.play(this.eng.rewards());
      this.paged = false;
    }
    async defeat() {
      if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(20);
      this.clearMsg();
      this.big = true;
      await this.say(this.o.canLose ? '{hero}たちは力つきた……。' : '{hero}たちは全滅した……。');
      await this.waitKey();
    }

    // ------------------------------------------------------------ the hero's battle voice (§11.10.8, owner 2026-09-26)
    /** R.Audio.battleVoice(kind, gender) when `u` is the hero. A new clip replaces the previous one (audio.js), voice
     *  volume 0 is silent there; headless / no R.Audio → no-op. 'hurt' is throttled to HURT_VOICE_GAP frames. */
    heroVoice(u, kind) {
      if (!u || !u.isParty || !u.c || u.c.id !== 'hero') return false;
      const A = R.Audio;
      if (!A || typeof A.battleVoice !== 'function') return false;
      if (kind === 'hurt') {
        const F = R.Engine.frame;
        if (this.hurtVoiceAt != null && F - this.hurtVoiceAt < HURT_VOICE_GAP) return false;
        this.hurtVoiceAt = F;
      }
      try { A.battleVoice(kind, u.c.gender === 'f' ? 'f' : 'm'); } catch (e) { /* never breaks a battle */ }
      return true;
    }

    // ------------------------------------------------------------ events (§11.5.15 — the choreography)
    async handle(ev) {
      const s = this;
      switch (ev.t) {
        case 'msg': return s.say(ev.text);
        case 'clear': s.clearMsg(); return;
        case 'actor': {
          await s.waitStealPop(); // a rare steal's popup keeps its time before the next action (Part A12)
          s.clearMsg();
          s.lastFx = null;
          s.clearTransientCard();
          s.glimVoiced = false; // the glimmer shout covers only the action it belongs to
          const back = s.settle(); // the one who stepped in hops back before the next one acts
          if (back) await back;
          s.actor = ev.u || null;
          if (ev.u && !ev.u.isParty && s.vis.get(ev.u)) { s.vis.get(ev.u).blink = 10; await s.frames(8); }
          return;
        }
        case 'fx': return s.playFx(ev);
        case 'dmg': return s.onDamage(ev);
        case 'heal':
          if (ev.n > 0) s.pop(ev.u, ev.n, ev.mp ? 'cyan' : 'green');
          return;
        case 'miss': {
          R.sfx(ev.parry ? 'parry' : 'miss'); // 反撃の構え's parry rings like steel
          if (ev.u && !ev.u.isParty && s.vis.get(ev.u)) s.vis.get(ev.u).dodge = 12;
          const v = s.pv(ev.u);
          if (v && !ev.parry) v.hop = { f0: R.Engine.frame, n: s.dur(12, 'atk') }; // a member sidesteps to the right
          if (v && ev.parry) v.flash = { col: '#ffffff', a: 0.55, n: 6 };
          s.pop(ev.u, null, 'gray');
          return s.frames(6);
        }
        case 'crit':
          R.sfx('crit');
          R.Engine.flashScreen('#ffffff', 6);
          return s.frames(8);
        case 'die': return s.onDie(ev);
        case 'revive': {
          if (!ev.u.isParty) { const v = s.vis.get(ev.u); if (v) { v.die = null; v.flee = null; v.gone = false; v.appear = 20; v.appearN = 20; } }
          else { const v = s.pv(ev.u); if (v) v.tmp = null; }
          if (s.lastFx !== 'revive') { s.lastFx = 'revive'; R.BattleFX.play(s, 'revive', { targets: [s.rectOf(ev.u)], dir: 0 }); }
          else R.sfx('revive');
          return s.frames(12);
        }
        case 'status': return s.onStatus(ev);
        case 'buff':
          if (ev.stat && ev.d) R.sfx(ev.d > 0 ? 'buff' : 'debuff');
          return;
        case 'flee': {
          R.sfx('escape');
          const v = s.vis.get(ev.u);
          if (v) v.flee = { t: 0 };
          return s.frames(18);
        }
        case 'escape': return s.onEscape(ev);
        case 'cover': {
          // かばう: the one who steps in walks in front of the one protected and guards (§11.5.10a)
          R.sfx('parry'); // §11.10.5: かばう uses the parry sound
          const v = s.pv(ev.u), al = s.pv(ev.ally);
          if (v && al && v !== al) {
            v.away = true;
            v.act = null;
            await s.moveTo(v, Math.round(al.x - 14), al.y, s.dur(8, 'move'), { pose: 'walk' });
            v.act = { pose: 'guard', fi: 0 };
            return;
          }
          return s.frames(10);
        }
        case 'counter':
        case 'react': {
          // autoCounter / 反撃の構え: parry sound and a white flash, then the counter's own fx (a normal attack).
          // autoRevive ({kind:'revive'}) only flashes: the revive pillar and 「…は立ち上がった！」 follow
          if (ev.t === 'counter' || ev.kind !== 'revive') R.sfx('parry');
          const v = s.pv(ev.u);
          // (the front view's raised member window is gone: STATUS is one fixed window at y 152, nothing can rise into y 0)
          if (v) v.flash = { col: '#ffffff', a: 0.55, n: 6 };
          else if (ev.u && s.vis.get(ev.u)) s.vis.get(ev.u).blink = 6;
          return s.frames(6);
        }
        case 'gain': return s.onGain(ev);
        case 'rare': // old engine form of a rare drop
          R.Engine.flashScreen('#fff4b0', 16);
          R.jingle('rare');
          return s.frames(12);
        case 'drop': return s.onDrop(ev);
        case 'golden': return s.onGolden(ev);
        case 'glimmer': return s.onGlimmer(ev);
        case 'phase': return s.onPhase(ev);
        case 'summon': return s.onSummon(ev);
        case 'levelup': {
          const c = ev.c || (ev.u && ev.u.c);
          const inParty = c && s.eng.party.some((p) => p.c === c);
          s.log.levelUps.push({ char: c ? c.id : null, level: ev.level });
          if (inParty && !ev.reserve && !s.levelJingle) { s.levelJingle = true; R.jingle('levelup'); }
          return;
        }
        case 'prof': return; // proficiency rank-ups are not shown in battle (§11.5.6)
        case 'victory': {
          const back = s.settle();
          if (back) await back;
          s.victoryPose = true; // everyone standing raises the weapon (§11.5.10)
          if (R.Audio && R.Audio.stopBGM) R.Audio.stopBGM(6);
          R.jingle('victory');
          { const h = (s.eng.party || []).find((p) => p.c && p.c.id === 'hero'); if (h && h.alive) s.heroVoice(h, 'victory'); }
          return;
        }
        case 'jingle':
          if (ev.id === 'levelup') { if (s.levelJingle) return; s.levelJingle = true; }
          R.jingle(ev.id);
          return;
        case 'pause':
          await s.waitKey();
          s.card = null; s.dim = 0;
          return;
      }
    }
    clearTransientCard() { if (this.card && this.card.transient) this.card = null; }
    /** frames the steal popup still shows (Part A12): POP_LEN, or POP_MIN once A cut it */
    stealPopLeft() {
      const p = this.stealPop;
      if (!p) return 0;
      const t = R.Engine.frame - p.t0;
      return Math.max(0, (p.cut ? POP_MIN : POP_LEN) - t);
    }
    async waitStealPop() {
      for (let i = 0; i < POP_LEN + 2 && this.stealPopLeft() > 0; i++) await R.Engine.wait(1);
      this.stealPop = null;
    }
    /** a rare / super drop card refuses keys until it has been up CARD_MIN frames (Part A12) */
    cardYoung() {
      const cd = this.card;
      return !!cd && (cd.grade === 'rare' || cd.grade === 'super') && R.Engine.frame - cd.t0 < CARD_MIN;
    }
    async waitGlimmer() {
      const F = R.Engine.frame;
      if (this.glimUntil > F) await R.Engine.wait(this.glimUntil - F);
    }
    async waitGlimmerClosed() {
      if (!this.glim) return;
      const end = this.glim.t0 + this.glim.H + 6, F = R.Engine.frame;
      if (end > F) await R.Engine.wait(end - F);
    }
    /** the weapon slot of a member's plain attack: the event's, else the round's command, else weapon1 */
    slotOf(u, ev) {
      if (ev && ev.slot) return ev.slot;
      const c = u && u.isParty && this.roundCmds && this.roundCmds[u.idx];
      if (c && c.slot && (c.type === 'attack' || c.type === 'tech')) return c.slot;
      if (u && u.isParty && typeof u.defaultSlot === 'function') { try { return u.defaultSlot() || 'weapon1'; } catch (e) { /* weapon1 */ } }
      return 'weapon1';
    }
    /** how a member performs an action (§11.5.15): melee run-in / bow / spell / item / stance / a pose in place */
    modeOf(ev, u, ab, foes, list, slot) {
      if (ev.item || isItemUse(ab)) return { kind: 'item' };
      if (ab && (ab.kind === 'spell' || ab.magic)) return { kind: 'spell' };
      const k0 = R.BattleFX.resolve(list[0], ab).kind;
      if (k0 === 'stance' || (ab && (ab.effects || []).some((e) => e.type === 'cover'))) return { kind: 'stance' };
      const wtype = ab && ab.kind === 'tech' && ab.wtype ? ab.wtype : wtypeOf(u.c, slot || 'weapon1');
      const family = familyOf(wtype);
      if (!foes.length) return { kind: 'pose', family, wtype };
      return { kind: family === 'shoot' ? 'bow' : 'melee', family, wtype };
    }
    async playFx(ev) {
      await this.waitGlimmer();
      this.actStart = R.Engine.frame;
      const u = ev.user || null;
      const tunits = (ev.targets || []).filter(Boolean);
      const ab = ev.ab || null;
      const slot = u && u.isParty ? this.slotOf(u, ev) : null;
      let ids = ev.fx;
      if (!ids && (ev.kind === 'attack' || ev.kind === 'counter')) ids = this.weaponFx(u, slot);
      const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x != null);
      if (!list.length) list.push(null);
      const foes = u ? tunits.filter((t) => !!t.isParty !== !!u.isParty) : [];
      const dir = !u || !foes.length ? 0 : u.isParty ? -1 : 1; // §11.5.12: −1 party → enemy (left), +1 enemy → party
      const v = u && u.isParty ? this.pv(u) : null;
      if (v) return this.partyAct(ev, v, tunits, foes, ab, list, dir, slot);
      const mv = u && !u.isParty ? this.vis.get(u) : null;
      if (mv && ev.kind === 'attack') {
        // a monster's attack: it hops 8 px toward the party, the fx lands on the member (§11.5.15)
        mv.lungeN = this.dur(12, 'atk'); mv.lunge = mv.lungeN;
        await R.Engine.wait(Math.ceil(mv.lungeN * 0.55));
      } else if (mv) { mv.blink = 10; await this.frames(6); }
      await this.chain(list, u ? () => this.rectOf(u) : () => null, tunits, ab, ev.kind, dir);
    }
    /** fx arrays (§7.3.4-7): left to right, the 2nd+ at 60 % length; numbers come at the last one's impact */
    async chain(list, userRect, tunits, ab, kind, dir) {
      for (let i = 0; i < list.length; i++) {
        const rate = i === 0 ? 1 : 1 / 0.6;
        this.lastFx = R.BattleFX.resolve(list[i], ab).kind;
        const hold = R.BattleFX.play(this, list[i], { user: userRect(), targets: tunits.map((t) => this.rectOf(t)), ab, kind, rate, dir });
        await this.frames(hold);
      }
    }
    async partyAct(ev, v, tunits, foes, ab, list, dir, slot) {
      const u = v.p;
      const mode = this.modeOf(ev, u, ab, foes, list, slot);
      const w1 = wtypeOf(u.c, 'weapon1');
      if (mode.wtype) v.alt = mode.wtype !== w1 ? mode.wtype : null; // weapon2 / another type's tech: that weapon's sheet
      const sh = this.sheetOf(v);
      const rect = () => this.rectOf(u);
      const wait = (n) => R.Engine.wait(n);
      const holdOf = (pose, k, rate) => this.dur((poseHold(sh, pose)[k] || 6) * (rate || 1), 'atk');
      // the hero's shout at the start of a swing / a cast — once per action (not on the repeated hits), and not
      // over the glimmer shout of the tech / spell just glimmered (it would cut it off)
      const voice = !ev.again && !this.glimVoiced;
      if (mode.kind === 'melee' || mode.kind === 'bow' || mode.kind === 'pose') {
        const fam = sh.poses[mode.family] ? mode.family : 'punch';
        if (voice) this.heroVoice(u, 'attack');
        if (mode.kind === 'melee' && !ev.again) await this.runTo(v, foes);
        const imp = poseImpact(sh, fam), last = sh.poses[fam].frames.length - 1;
        for (let i = 0; i < list.length; i++) {
          const rate = i === 0 && !ev.again ? 1 : 0.6; // repeated swings at 60 % (§11.5.15)
          for (let k = 0; k < imp; k++) { v.act = { pose: fam, fi: k }; await wait(holdOf(fam, k, rate)); }
          v.act = { pose: fam, fi: imp };
          this.lastFx = R.BattleFX.resolve(list[i], ab).kind;
          const h = R.BattleFX.play(this, list[i], { user: rect(), targets: tunits.map((t) => this.rectOf(t)), ab, kind: ev.kind, rate: i === 0 ? 1 : 1 / 0.6, dir });
          await wait(Math.max(holdOf(fam, imp, rate), Math.ceil(h / this.spd)));
          v.act = { pose: fam, fi: last };
        }
        return;
      }
      if (mode.kind === 'spell') {
        if (!ev.again && ev.kind !== 'counter') {
          if (voice) this.heroVoice(u, 'spell');
          v.act = { pose: 'cast', fi: 0 };
          await wait(holdOf('cast', 0));
          v.act = { pose: 'cast', fi: 1 };
          R.BattleFX.FX.cast(this, { user: rect(), ab });
          R.sfx('magic');
          await wait(holdOf('cast', 1));
        }
        v.act = { pose: 'cast', fi: 2 };
        return this.chain(list, rect, tunits, ab, ev.kind, dir);
      }
      if (mode.kind === 'item') {
        if (!ev.again) { v.act = { pose: 'item', fi: 0 }; await wait(holdOf('item', 0)); }
        v.act = { pose: 'item', fi: 1 };
        return this.chain(list, rect, tunits, ab, ev.kind, dir);
      }
      // 構え・かばう: guard, and the sprite flashes white (§11.5.12 stance)
      v.act = { pose: 'guard', fi: 0 };
      v.flash = { col: '#ffffff', a: 0.7, n: 10 };
      return this.chain(list, rect, tunits, ab, ev.kind, dir);
    }
    /** the fx of a plain attack when the event carries none: the weapon type's fx (§6.8.1) */
    weaponFx(u, slot) {
      if (!u || !u.isParty) return (u && u.d && u.d.attackFx) || 'claw';
      const c = u.c || {}, eq = c.equip || {};
      const it = DB.items[eq[slot || 'weapon1']] || DB.items[eq.weapon1] || DB.items[eq.weapon2];
      const wt = it ? it.wtype : 'fist';
      return (it && (it.fx || ART_FX[it.art])) || (DB.weaponTypes && DB.weaponTypes[wt] && DB.weaponTypes[wt].fx) || 'strike';
    }
    async onDamage(ev) {
      const u = ev.u;
      if (ev.kind === 'cost') { this.pop(u, ev.n, 'gray'); return this.frames(6); }
      const color = ev.mp ? 'cyan' : ev.kind === 'poison' ? 'purple' : ev.kind === 'burn' ? 'orange' : ev.crit ? 'yellow' : 'white';
      const dot = ev.kind === 'poison' || ev.kind === 'burn';
      if (u.isParty) {
        if (ev.n > 0) {
          const f = this.winFx[u.idx];
          if (f) f.flash = 14; // the STATUS row blinks red (§11.5.2)
          const v = this.pv(u);
          if (v && !ev.mp) {
            // のけぞり: hit pose, pushed 3 px to the right and back, a 2 px shake (§11.5.15)
            const n = this.dur(12, 'atk'), F = R.Engine.frame;
            v.tmp = { pose: 'hit', fi: 0, until: F + n };
            v.push = { f0: F, n };
            v.shake = 6;
          }
          if (!ev.mp) R.Engine.shake(dot ? 6 : 12, ev.crit ? 4 : 2);
          R.sfx(ev.kind === 'poison' ? 'poison' : ev.kind === 'burn' ? 'burn' : 'hurt');
          if (u.alive && !ev.mp) this.heroVoice(u, 'hurt'); // a lethal hit shouts 'ko' at the 'die' instead
        }
      } else {
        const v = this.vis.get(u);
        if (ev.n > 0 && v) { v.flash = 12; v.shake = 12; R.sfx(ev.kind === 'poison' ? 'poison' : ev.kind === 'burn' ? 'burn' : 'hit'); }
      }
      this.pop(u, ev.n, color);
      return this.frames(8);
    }
    async onDie(ev) {
      const u = ev.u;
      if (u.isParty) {
        R.sfx('death');
        this.heroVoice(u, 'ko');
        if (this.winFx[u.idx]) this.winFx[u.idx].flash = 16;
        const v = this.pv(u);
        if (v) { v.act = null; v.tmp = { pose: 'hit', fi: 0, until: R.Engine.frame + 6 }; v.koShown = true; } // hit 6 → ko
        return this.frames(12);
      }
      const v = this.vis.get(u);
      if (!v) return;
      v.flash = 0; v.shake = 0; v.solid = 0; v.gflash = 0;
      if (u.boss) {
        R.sfx('boss_die');
        v.die = { t: 0, boss: true };
        await this.frames(116);
        R.Engine.flashScreen('#ffffff', 16);
      } else {
        R.sfx('enemy_die');
        v.die = { t: 0 };
        await this.frames(14);
      }
    }
    async onEscape(ev) {
      const back = this.settle();
      if (back) await back;
      const alive = (this.pvs || []).filter((v) => v.p.alive);
      const F = R.Engine.frame;
      if (ev.ok) {
        // everyone standing turns round and runs off to the right, 2 frames apart (§11.5.10)
        R.sfx('escape');
        this.big = true;
        alive.forEach((v, i) => { v.flee = { f0: F + i * 2 }; });
        await R.Engine.wait(24 + alive.length * 2);
        return;
      }
      alive.forEach((v) => { v.nudge = { f0: F, n: 8 }; }); // a failed escape: a step to the right and back
      await R.Engine.wait(8);
    }
    async onStatus(ev) {
      const s = ev.s;
      if (!ev.on || s === 'death') return;
      const FX = R.BattleFX.FX;
      // statuses from weapons / damage skills get their own puff (a spell for that status already showed one)
      const key = s === 'counter' || s === 'cover' ? 'stance' : s;
      if (this.lastFx !== key && FX[key] && !(ev.u && ev.u.isParty && key === 'stance')) {
        R.BattleFX.play(this, key, { user: this.rectOf(ev.u), targets: [this.rectOf(ev.u)], dir: 0 });
        return this.frames(10);
      }
      R.sfx({ poison: 'poison', sleep: 'sleep', burn: 'burn', freeze: 'freeze' }[s] || 'status');
    }
    async onGain(ev) {
      // stolen item (§3.3.8 gain {item, grade, stolen}): steal sound; a rare one gets the rare card too
      const grade = ev.grade || (ev.rare ? 'rare' : 'normal');
      if (ev.stolen || ev.grade) this.log.stolen.push({ item: ev.item, grade });
      if (ev.stolen || ev.grade) {
        R.sfx('steal');
        if (grade === 'rare' || grade === 'super') {
          // Part A12: a popup card that stays ~1.5 s whatever the message / battle speed, オート or リピート.
          // It does not stop the flow (the 「…を盗んだ！」 line types under it); the next actor / the end of the
          // round waits for it (waitStealPop). A held / pressed A cuts it, never before POP_MIN.
          await this.waitStealPop();
          R.Engine.flashScreen(grade === 'super' ? '#ffe0f4' : '#fff4b0', 12);
          R.jingle(grade === 'super' ? 'superrare' : 'rare'); // not awaited (§11.10.6)
          this.stealPop = { grade, item: ev.item, t0: R.Engine.frame, cut: false };
        }
        return;
      }
      R.sfx(ev.rare ? 'item' : 'steal'); // old engine form
    }
    async onDrop(ev) {
      const grade = ev.grade || (ev.rare ? 'rare' : 'normal');
      const mon = ev.mon && typeof ev.mon === 'object' ? ev.mon.id : ev.mon;
      this.log.drops.push({ item: ev.item, grade, mon });
      this.card = null; this.dim = 0;
      if (grade === 'normal') { R.sfx('item'); return; }
      if (grade === 'rare') {
        R.Engine.flashScreen('#fff4b0', 16);
        R.jingle('rare'); // not awaited (§11.10.6)
        this.card = { grade: 'rare', item: ev.item, t0: R.Engine.frame };
        return this.frames(6);
      }
      // super rare: the field darkens, the fanfare plays to the end before any key is taken (§11.5.8)
      this.dim = 0.45;
      this.card = { grade: 'super', item: ev.item, t0: R.Engine.frame };
      R.Engine.flashScreen('#ffe0f4', 10);
      const tok = (this.lockTok = (this.lockTok || 0) + 1);
      this.locked = true;
      const unlock = () => { if (this.lockTok === tok) this.locked = false; };
      Promise.resolve(R.jingle('superrare')).then(unlock, unlock);
      R.Engine.wait(360).then(unlock); // safety net: never lock the rewards for good
      return this.frames(8);
    }
    async onGolden(ev) {
      const m = ev.u;
      if (!m || this.goldenShown.has(m)) return;
      this.goldenShown.add(m);
      const v = this.vis.get(m);
      if (v) v.gflash = 24; // #fff4b0 every 4 frames for 24 frames (§11.5.9)
      R.sfx('golden');
      await R.Engine.wait(14);
    }
    /**
     * 閃き (§11.5.7 Part A8): ピコーン → the bulb lights over the member's head (with four rays) and the STATUS row
     * glows → the tech-name banner opens on the enemy side (frames 8–14) → the line types (frame 14) → the new tech
     * waits until frame H = max(36, 50 / spd) (never shortened by オート・リピート) and is then performed.
     */
    async onGlimmer(ev) {
      // one banner at a time: a second glimmer in the same round waits until the first has closed
      await this.waitGlimmerClosed();
      const u = ev.u;
      const ab = actionOf(ev.id) || {};
      R.sfx('glimmer');
      if (this.heroVoice(u, 'glimmer')) this.glimVoiced = true;
      if (R.Audio && R.Audio.duck) { try { R.Audio.duck(-6, 18); } catch (e) { /* optional */ } }
      const H = Math.max(GLIM_MIN, Math.round(50 / this.spd));
      const F = R.Engine.frame;
      const v = u && u.isParty ? this.pv(u) : null;
      if (v) {
        if (this.winFx[u.idx]) this.winFx[u.idx].glow = GLOW_FRAMES;
        v.act = null;
        v.tmp = { pose: 'idle', fi: 0, until: F + H }; // stands up (even from weak) and looks up
        v.flash = { col: '#ffffff', a: 0.6, n: 2 };
      }
      R.Engine.flashScreen('#fff8d0', 4);
      this.glim = Object.assign({ u, t0: F, H, id: ev.id, kind: ev.kind, bulb: !!v }, bannerOf(ab, ev.kind));
      this.glimUntil = F + H;
      this.log.glimmers.push({ char: u && u.c ? u.c.id : null, id: ev.id, kind: ev.kind || ab.kind });
      // frame 14: the banner is open — hand back so the 「〇〇は〇〇を閃いた！」 line types under it
      await R.Engine.wait(GLIM_HANDBACK);
    }
    async onPhase(ev) {
      const v = this.vis.get(ev.u);
      R.sfx('shake');
      R.Engine.shake(20, 2);
      if (v) v.solid = 12;
      await this.frames(6);
      if (v && ev.sprite && G().has('mon:' + ev.sprite)) {
        // swap the sprite at frame 6, keeping the feet and the centre
        const feet = v.y + v.h, cx = v.x + v.w / 2;
        ev.u.spriteOverride = ev.sprite;
        v.img = monImage(ev.u);
        v.w = v.img.width; v.h = v.img.height;
        v.x = Math.round(cx - v.w / 2); v.y = feet - v.h;
        v.mask = null;
      }
      await this.frames(6);
      if (ev.text) await this.say(ev.text);
    }
    async onSummon(ev) {
      const units = (ev.units || []).map((i) => (typeof i === 'number' ? this.eng.mons[i] : i)).filter(Boolean);
      if (!units.length) return;
      this.relayout(units);
      await this.frames(14);
    }

    // ------------------------------------------------------------ commands (§11.5.3)
    /** the commands of one round (menus, オート or リピート); the panel is closed when it returns */
    async commandPhase() {
      const cmds = await this.commandInput();
      this.panel = null;
      this.cmdList = null;
      return cmds;
    }
    async commandInput() {
      const eng = this.eng;
      if (this.auto && this.autoCancel) { this.auto = false; this.autoCancel = false; B.autoCarry = false; }
      if (this.auto) return autoCommands(eng);
      // リピート stays on until B; B stops it before the next input and the party menu opens on 戦う
      if (this.repeating && this.repeatCancel) { this.repeating = false; this.repeatCancel = false; this.partyIdx = 0; }
      if (this.repeating && this.lastCmds) return this.repeatCmds();
      if (!eng.party.some((p) => p.commandable())) { await this.frames(24); return []; }
      this.clearMsg();
      for (;;) {
        const r = await this.partyMenu();
        if (r === 'auto') {
          this.auto = true; this.autoCancel = false; B.autoCarry = true;
          return autoCommands(eng);
        }
        if (r === 'repeat') { this.repeating = true; this.repeatCancel = false; return this.repeatCmds(); }
        if (r === 'flee') return { flee: true };
        const cmds = await this.memberCommands();
        if (cmds) return cmds;
      }
    }
    repeatCmds() {
      const eng = this.eng;
      if (eng.repeatCommands) return eng.repeatCommands(this.lastCmds);
      const out = [];
      for (const p of eng.party) if (p.commandable()) out[p.idx] = this.lastCmds[p.idx] ? Object.assign({}, this.lastCmds[p.idx]) : { type: 'attack', slot: 'weapon1', target: null };
      return out;
    }
    get canRepeat() { return !!(this.lastCmds && this.lastCmds.some(Boolean)); }
    async partyMenu() {
      // 戦う / リピート / オート / 逃げる — one column in CMD (§11.5.3)
      const ids = ['fight', 'repeat', 'auto', 'flee'];
      const canRepeat = this.canRepeat;
      const list = new R.UI.List({
        x: CMD.x, y: CMD.y, w: CMD.w, h: CMD.h, cols: 1, rows: 4, lineH: 14, padY: 6, cancel: false,
        items: ['戦う', { label: 'リピート', disabled: !canRepeat }, 'オート', { label: '逃げる', disabled: !!this.eng.noEscape }],
        index: this.partyIdx,
      });
      if (list.isDisabled(list.index)) list.index = 0;
      this.panel = {
        left: list, enemies: true,
        help: () => {
          const id = ids[list.index];
          if (id === 'repeat') return canRepeat ? HELP_REPEAT : HELP_REPEAT_NONE;
          if (id === 'flee' && this.eng.noEscape) return HELP_NOESCAPE;
          return '';
        },
      };
      const r = await this.ask(() => (list.update() === 'select' ? list.index : undefined));
      this.partyIdx = r === 1 || r === 2 ? r : 0;
      return ids[r];
    }
    async memberCommands() {
      const order = this.eng.party.filter((p) => p.commandable());
      const cmds = [];
      const reserved = {};
      let k = 0;
      while (k < order.length) {
        const u = order[k];
        const c = await this.memberMenu(u, reserved);
        if (c === BACK) {
          if (k === 0) { this.acting = null; return null; }
          k--;
          const prev = cmds[order[k].idx];
          if (prev && prev.type === 'item') reserved[prev.id]--;
          cmds[order[k].idx] = undefined;
          continue;
        }
        if (c.type === 'item') reserved[c.id] = (reserved[c.id] || 0) + 1;
        cmds[u.idx] = c;
        k++;
      }
      this.acting = null;
      this.cmdList = null;
      return cmds;
    }
    battleItems(reserved) {
      const inv = this.eng.inv || {};
      const gr = (it) => GRADE_RANK[it.grade] || (it.rare ? 1 : 0);
      return Object.keys(inv)
        .filter((id) => { const it = DB.items[id]; return it && it.type === 'consumable' && it.use && it.use.battle && inv[id] > 0; })
        .sort((a, b) => { const x = DB.items[a], y = DB.items[b]; return gr(x) - gr(y) || ((x.sort || 0) - (y.sort || 0)) || ((x.price || 0) - (y.price || 0)) || (a < b ? -1 : a > b ? 1 : 0); })
        .map((id) => ({ id, it: DB.items[id], n: inv[id] - ((reserved && reserved[id]) || 0), noEsc: !!(this.eng.noEscape && B.isEscape && B.isEscape(DB.items[id].use)) }));
    }
    commandsOf(c) {
      if (R.Rules && R.Rules.commands) { try { return R.Rules.commands(c) || []; } catch (e) { R.warn('battle: Rules.commands failed', e); } }
      return [{ type: 'weapon', slot: 'weapon1', wtype: 'fist', name: '素手' }, { type: 'defend', name: '防御' }, { type: 'item', name: '道具' }];
    }
    async memberMenu(u, reserved) {
      const c = u.c, m = mem(c);
      const cmds = this.commandsOf(c);
      const items = cmds.map((k) => ({
        label: k.name || (k.type === 'spell' ? '術' : k.type === 'defend' ? '防御' : k.type === 'item' ? '道具' : k.wtype),
        disabled: k.type === 'item' && !this.battleItems(reserved).some((x) => x.n > 0),
      }));
      const list = new R.UI.List({ x: CMD.x, y: CMD.y, w: CMD.w, h: CMD.h, items, cols: 2, rows: 3, lineH: 16, padY: 10, title: c.name, index: Math.min(m.cmd || 0, items.length - 1) });
      if (list.isDisabled(list.index)) list.index = 0;
      this.acting = u; // steps forward (§11.5.14) and gets the STATUS band
      for (;;) {
        this.panel = { left: list, enemies: true };
        this.cmdList = list;
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) { this.cmdList = null; return BACK; }
        m.cmd = i;
        const k = cmds[i];
        list.active = false;
        let r = BACK;
        if (k.type === 'weapon') r = await this.weaponMenu(u, k);
        else if (k.type === 'spell') r = await this.spellMenu(u);
        else if (k.type === 'defend') { this.cmdList = null; return { type: 'defend' }; }
        else if (k.type === 'item') r = await this.itemMenu(u, reserved);
        else if (k.type === 'attack') { const t = await this.pickTarget(u, 'enemy'); if (t !== BACK) r = { type: 'attack', slot: k.slot || null, target: t }; }
        if (r !== BACK) { this.cmdList = null; return r; }
      }
    }
    /** why the plain 攻撃 of a weapon slot can't be chosen (null = usable): only 'reach' (§4.5.3) */
    attackIssue(u, k) {
      const eng = this.eng;
      if (eng.attackIssue) { try { return eng.attackIssue(u, k.slot); } catch (e) { /* fall through */ } }
      const wt = DB.weaponTypes && DB.weaponTypes[k.wtype];
      if (wt && wt.reach === false && this.rowOf(u) === 'middle') return 'reach';
      return null;
    }
    weaponName(c, slot) {
      const it = slot && c.equip && DB.items[c.equip[slot]];
      return it ? it.name : null;
    }
    /** a tech / spell / item list: one column of five on the enemy side (LIST, §11.5.3) */
    listOpts(title, items, index) {
      return { x: LIST.x, y: LIST.y, w: LIST.w, items, cols: 1, rows: LIST.rows, lineH: LIST.lineH, padY: LIST.padY, title, index: U.clamp(index || 0, 0, Math.max(0, items.length - 1)), drawItem: drawListItem };
    }
    /** 攻撃 + the techs of that slot's weapon type; right column M and the MP cost, like spells (§11.5.3, A18) */
    async weaponMenu(u, k) {
      const c = u.c, m = mem(c), eng = this.eng;
      const key = k.slot || 'weapon1';
      const techs = R.Rules && R.Rules.techList ? R.Rules.techList(c, k.wtype, k.slot) : [];
      const atkWhy = this.attackIssue(u, k);
      const rows = [{ id: 'attack', why: atkWhy }].concat(techs.map((id) => ({ id, ab: actionOf(id), why: eng.unusable ? eng.unusable(u, id, k.slot) || null : null })));
      const items = rows.map((r) => {
        if (r.id === 'attack') return { label: '攻撃', disabled: !!r.why };
        const cost = eng.mpCost ? eng.mpCost(u, r.id) : R.Rules && R.Rules.mpCost ? R.Rules.mpCost(c, r.id) : (r.ab && r.ab.mp) || 0;
        return { label: r.ab ? r.ab.name : r.id, right: 'M' + cost, disabled: !!r.why };
      });
      const wname = (DB.weaponTypes && DB.weaponTypes[k.wtype] && DB.weaponTypes[k.wtype].name) || k.name;
      const list = new R.UI.List(this.listOpts(wname, items, m.list[key]));
      const help = () => {
        const r = rows[list.index];
        if (!r) return '';
        if (r.why) return WHY[r.why] || '';
        if (r.id === 'attack') { const n = this.weaponName(c, k.slot); return n ? `${n}で攻撃する。` : '素手で攻撃する。'; }
        return (r.ab && r.ab.desc) || '';
      };
      for (;;) {
        this.panel = { left: list, under: this.cmdList, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.list[key] = i;
        list.active = false;
        const r = rows[i];
        if (r.id === 'attack') {
          const t = await this.pickTarget(u, 'enemy');
          if (t !== BACK) return { type: 'attack', slot: k.slot || null, target: t };
        } else {
          const t = await this.pickTarget(u, (r.ab && r.ab.target) || 'enemy');
          if (t !== BACK) return { type: 'tech', id: r.id, slot: k.slot || null, target: t };
        }
      }
    }
    async spellMenu(u) {
      const c = u.c, m = mem(c), eng = this.eng;
      const ids = R.Rules && R.Rules.spellList ? R.Rules.spellList(c) : (c.spells || []);
      const rows = ids.map((id) => ({ id, ab: actionOf(id), why: eng.unusable ? eng.unusable(u, id) || null : null }));
      const items = rows.map((r) => {
        const cost = R.Rules && R.Rules.mpCost ? R.Rules.mpCost(c, r.id) : (r.ab && r.ab.mp) || 0;
        // Part A13b: an MP cut by proficiency (0 / half) shows in cyan
        const cut = R.Rules && R.Rules.profMpKind ? R.Rules.profMpKind(c, r.id) : null;
        return { label: r.ab ? r.ab.name : r.id, right: 'M' + cost, rightColor: cut ? G().C.cyan : null, disabled: !!r.why };
      });
      if (!items.length) { R.sfx('buzzer'); return BACK; }
      const list = new R.UI.List(this.listOpts('術', items, m.list.spell));
      const help = () => { const r = rows[list.index]; return r ? (r.why ? WHY[r.why] || '' : (r.ab && r.ab.desc) || '') : ''; };
      for (;;) {
        this.panel = { left: list, under: this.cmdList, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.list.spell = i;
        list.active = false;
        const r = rows[i];
        const t = await this.pickTarget(u, (r.ab && r.ab.target) || 'enemy');
        if (t !== BACK) return { type: 'spell', id: r.id, target: t };
      }
    }
    async itemMenu(u, reserved) {
      const m = mem(u.c);
      const list0 = this.battleItems(reserved);
      if (!list0.length) { R.sfx('buzzer'); return BACK; }
      const items = list0.map((x) => {
        const dis = x.n <= 0 || x.noEsc;
        return { label: itemLabel(x.id), right: String(Math.max(0, x.n)), disabled: dis, color: dis ? G().C.gray : itemColor(x.id) };
      });
      const list = new R.UI.List(this.listOpts('道具', items, m.item));
      const help = () => {
        const x = list0[list.index];
        if (!x) return '';
        if (x.noEsc) return WHY.noescape;
        return helpLine(x.it.desc);
      };
      for (;;) {
        this.panel = { left: list, under: this.cmdList, help };
        list.active = true;
        const i = await this.ask(() => { const r = list.update(); return r === 'select' ? list.index : r === 'cancel' ? -1 : undefined; });
        if (i < 0) return BACK;
        m.item = i;
        const it = list0[i].it;
        list.active = false;
        const t = await this.pickTarget(u, (it.use && it.use.target) || 'self');
        if (t !== BACK) return { type: 'item', id: list0[i].id, target: t };
      }
    }

    // ------------------------------------------------------------ targeting (§11.5.3: the list closes while aiming)
    async pickTarget(u, type) {
      if (type === 'enemy' || type === 'group') return this.pickEnemy(u, type === 'group');
      if (type === 'ally' || type === 'ally_any' || type === 'ally_dead' || type === 'ally_other') return this.pickAlly(u, type);
      if (type === 'enemies' || type === 'random' || type === 'allies') return this.confirmAll(type);
      return null; // self / party: no choice (§7.3.2)
    }
    /** all-target actions: highlight every target and confirm with A (B = back) */
    async confirmAll(type) {
      const foes = type !== 'allies';
      const prevPanel = this.panel;
      const label = foes ? (type === 'random' ? '敵全体にランダム' : '敵全体') : '味方全員';
      this.panel = Object.assign({}, prevPanel, { help: () => label, helpCenter: true, hideList: true });
      this.picking = foes ? { units: this.eng.mons.filter((m) => m.alive) } : { allies: true };
      const r = await this.ask(() => {
        if (In().pressed('a')) { R.sfx('confirm'); return null; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      return r;
    }
    groupsOf() {
      const eng = this.eng;
      if (eng.groups) return eng.groups().map((g) => g.units.filter((x) => x.alive)).filter((l) => l.length);
      const by = new Map();
      for (const m of eng.mons) if (m.alive) { if (!by.has(m.id)) by.set(m.id, []); by.get(m.id).push(m); }
      return [...by.values()];
    }
    /**
     * enemies: ←→ in screen x order (the back row first at the same x), ↑↓ between the rows (the nearest x in the
     * next row that has someone — §11.5.3)
     */
    async pickEnemy(u, group) {
      const m = mem(u.c);
      const vx = (x) => { const v = this.vis.get(x); return v ? v.x + v.w / 2 : 0; };
      const vr = (x) => { const v = this.vis.get(x); return v ? v.row : 0; };
      const byX = (a, b) => vx(a[0]) - vx(b[0]) || vr(a[0]) - vr(b[0]);
      const alive = this.eng.mons.filter((x) => x.alive);
      if (!alive.length) return BACK;
      const choices = (group ? this.groupsOf() : alive.map((x) => [x])).sort(byX);
      let i = Math.max(0, choices.findIndex((l) => l.some((x) => x.key === m.target)));
      const prevPanel = this.panel;
      const name = () => { const l = choices[i]; return group && l.length > 1 ? `${l[0].base || l[0].name}　${l.length}匹` : l[0].name; };
      const color = () => { const l = choices[i]; return isGolden(l[0]) ? G().C.gold : isMetal(l[0]) ? METAL_COL : null; };
      this.panel = Object.assign({}, prevPanel, { help: name, helpColor: color, helpCenter: true, hideList: true });
      this.picking = { units: choices[i] };
      const rowStep = (d) => {
        // the nearest (by x) choice in the next row up / down that has one; the same as ←→ when there is one row
        const r0 = vr(choices[i][0]), x0 = vx(choices[i][0]);
        const rows = [...new Set(choices.map((l) => vr(l[0])))].sort((a, b) => a - b);
        if (rows.length < 2) return (i + d + choices.length) % choices.length;
        const k = rows.indexOf(r0);
        const r1 = rows[(k + d + rows.length) % rows.length];
        let best = i, bd = Infinity;
        choices.forEach((l, j) => { if (vr(l[0]) === r1 && Math.abs(vx(l[0]) - x0) < bd) { bd = Math.abs(vx(l[0]) - x0); best = j; } });
        return best;
      };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d && choices.length > 1) {
          const j = group || d === 'left' || d === 'right' ? (i + (d === 'left' || d === 'up' ? -1 : 1) + choices.length) % choices.length : rowStep(d === 'up' ? -1 : 1);
          if (j !== i) { i = j; this.picking.units = choices[i]; R.sfx('cursor'); }
        }
        if (In().pressed('a')) { R.sfx('confirm'); return choices[i][0]; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      if (r !== BACK) m.target = r.key;
      return r;
    }
    async pickAlly(u, type) {
      const party = this.eng.party;
      const n = party.length;
      const ok = (p) => (type === 'ally' ? p.alive : type === 'ally_other' ? p.alive && p !== u : type === 'ally_dead' ? !p.alive && !p.gone : true);
      const cands = party.filter(ok);
      if (!cands.length) { R.sfx('buzzer'); return BACK; }
      const most = type === 'ally' || type === 'ally_other';
      let t = type === 'ally_dead' ? cands[0] : most ? cands.slice().sort((a, b) => a.hpRate() - b.hpRate())[0] : u;
      if (most && t.hpRate() >= 1) t = ok(u) ? u : cands[0];
      let i = party.indexOf(t);
      const prevPanel = this.panel;
      const line = () => {
        const p = party[i];
        return `${p.name}　HP ${p.hp}/${p.mhp}　MP ${p.mp}/${p.mmp}`;
      };
      this.panel = Object.assign({}, prevPanel, { help: line, helpCenter: true, hideList: true });
      this.picking = { ally: party[i] };
      const r = await this.ask(() => {
        const d = In().dirRepeat();
        if (d) {
          const step = d === 'left' || d === 'up' ? -1 : 1;
          let j = i;
          // the cursor goes round all members (% party.length)
          for (let k = 0; k < n; k++) { j = (j + step + n) % n; if (ok(party[j])) break; }
          if (j !== i && ok(party[j])) { i = j; this.picking.ally = party[i]; R.sfx('cursor'); }
        }
        if (In().pressed('a')) { R.sfx('confirm'); return party[i]; }
        if (In().pressed('b')) { R.sfx('cancel'); return BACK; }
        return undefined;
      });
      this.picking = null;
      this.panel = prevPanel;
      return r;
    }

    // ------------------------------------------------------------ layer hooks
    update() {
      if (this.auto && !this.autoCancel && In().pressed('b')) { this.autoCancel = true; R.sfx('cancel'); }
      if (this.repeating && !this.repeatCancel && In().pressed('b')) { this.repeatCancel = true; R.sfx('cancel'); }
      if (this.stealPop && In().down('a')) this.stealPop.cut = true; // A (pressed or held to fast-forward) cuts it
      const m = this.msg;
      // a page waiting for a key (rewards, level-ups, drops, pause): A, B or ↓ — not while the super-rare fanfare plays.
      // A rare / super drop card stays at least CARD_MIN frames: a key pressed sooner is kept and taken then (Part A12)
      const down = In().pressed('down');
      const key = In().pressed('a') || In().pressed('b') || down;
      if (m.resolve && m.key && m.ch >= m.need && !this.locked && this.cardYoung()) {
        if (key) { this.cardSkip = true; if (down) this.downLatch = true; In().consume(); }
        return;
      }
      if (m.resolve && m.key && m.ch >= m.need && !this.locked && (key || this.cardSkip)) {
        this.cardSkip = false;
        R.sfx('confirm_soft');
        if (down) this.downLatch = true; // the held ↓ must not move a menu cursor / the party afterwards
        In().consume();
        const r = m.resolve; m.resolve = null; m.key = false;
        r();
        return;
      }
      if (this.downLatch) {
        if (In().down('down')) return;
        this.downLatch = false;
      }
      if (this.input) {
        const v = this.input();
        if (v !== undefined) { const f = this.inputRes; this.input = null; f(v); }
      }
    }
    tick() {
      if (this.wipe) this.wipe.t++;
      const s = this.spd;
      const F = R.Engine.frame;
      for (const v of this.vis.values()) {
        for (const k of ['flash', 'shake', 'blink', 'dodge', 'appear', 'solid']) if (v[k] > 0) v[k] = Math.max(0, v[k] - s);
        if (v.lunge > 0) v.lunge--; // already scaled (dur)
        if (v.gflash > 0) v.gflash--;
        if (v.move) {
          v.move.t += s;
          const q = Math.min(1, v.move.t / v.move.n), e = 1 - (1 - q) * (1 - q);
          v.x = Math.round(v.move.x0 + (v.move.x1 - v.move.x0) * e);
          v.y = Math.round(v.move.y0 + (v.move.y1 - v.move.y0) * e);
          if (q >= 1) v.move = null;
        }
        if (v.flee) v.flee.t += s;
        // golden: a sparkle somewhere on the body every 30 frames (0.5 s, §9.8 / §11.4.2)
        if (isGolden(v.m) && v.m.alive && !v.die && !v.flee && (F + v.i * 7) % 30 === 0) {
          const p = this.opaquePoint(v);
          v.spk.push({ x: p[0], y: p[1], t0: F });
        }
        if (v.spk.length) v.spk = v.spk.filter((q) => F - q.t0 < 16);
        if (v.die) {
          v.die.t += s;
          if (v.die.boss && v.die.t < 70 && (v.die.nb = (v.die.nb || 0) + s) >= 9) {
            v.die.nb = 0;
            const r = { cx: v.x + U.rf(0.2, 0.8) * v.w, cy: v.y + U.rf(0.2, 0.8) * v.h, w: 20, h: 20, side: 'mon' };
            r.x = r.cx - 10; r.y = r.cy - 10; r.bottom = r.cy + 10;
            R.BattleFX.FX.fire(this, { targets: [r] }, 1);
            R.sfx('fire');
            R.Engine.shake(8, 2);
          }
        }
      }
      for (const v of this.pvs || []) this.tickMember(v, F);
      for (const f of this.winFx) {
        if (f.shake > 0) f.shake = Math.max(0, f.shake - s);
        if (f.flash > 0) f.flash = Math.max(0, f.flash - s);
        if (f.glow > 0) f.glow--; // glimmer glow runs in real frames (not shortened by battle speed)
      }
      if (this.glim && F > this.glim.t0 + this.glim.H + 6) this.glim = null;
      if (this.fxList.length) this.fxList = this.fxList.filter((f) => (f.t += s * (f.rate || 1)) < f.life);
      if (this.pops.length) this.pops = this.pops.filter((p) => (p.t += s) < 52);
      this.tickMsg();
    }
    tickMember(v, F) {
      if (v.move) {
        const mv = v.move;
        mv.t++;
        const q = U.clamp(mv.t / mv.n, 0, 1);
        v.x = mv.x0 + (mv.x1 - mv.x0) * q;
        v.y = mv.y0 + (mv.y1 - mv.y0) * q;
        v.lift = mv.arc ? Math.sin(q * Math.PI) * mv.arc : 0;
        if (q >= 1) { v.move = null; v.lift = 0; v.x = mv.x1; v.y = mv.y1; mv.res(); }
      } else if (!v.away && !v.flee) {
        // input: the member entering commands stands one step forward (§11.5.14); homes follow the effective row
        const goal = v.homeX - (this.acting === v.p && this.panel && !this.inRound ? PARTY.step : 0);
        if (Math.abs(v.x - goal) > 0.01 || Math.abs(v.y - v.homeY) > 0.01) {
          if (!v.glide || v.glide.x1 !== goal || v.glide.y1 !== v.homeY) {
            const small = Math.abs(goal - v.x) <= PARTY.step + 0.5 && Math.abs(v.homeY - v.y) < 1;
            v.glide = { x0: v.x, y0: v.y, x1: goal, y1: v.homeY, t: 0, n: this.dur(small ? 6 : 8, 'move'), f0: F };
          }
          const gl = v.glide;
          gl.t++;
          const q = Math.min(1, gl.t / gl.n);
          v.x = gl.x0 + (gl.x1 - gl.x0) * q;
          v.y = gl.y0 + (gl.y1 - gl.y0) * q;
          if (q >= 1) { v.x = gl.x1; v.y = gl.y1; v.glide = null; }
        } else v.glide = null;
      }
      if (v.tmp && F >= v.tmp.until) v.tmp = null;
      for (const k of ['push', 'hop', 'nudge']) if (v[k] && F - v[k].f0 >= v[k].n) v[k] = null;
      if (v.shake > 0) v.shake--;
      if (v.flash && --v.flash.n <= 0) v.flash = null;
    }
    /** a random opaque pixel of a monster sprite (relative to the screen) */
    opaquePoint(v) {
      if (!v.mask) {
        v.mask = [];
        try {
          const img = v.img, c = img.getContext ? img.getContext('2d', { willReadFrequently: true }) : null;
          if (c) {
            const d = c.getImageData(0, 0, img.width, img.height).data;
            for (let y = 2; y < img.height - 2; y += 2) for (let x = 2; x < img.width - 2; x += 2) if (d[(y * img.width + x) * 4 + 3] > 0) v.mask.push([x, y]);
          }
        } catch (e) { /* no pixel access: use the box */ }
      }
      const p = v.mask.length ? U.pick(v.mask) : [U.rf(0.2, 0.8) * v.w, U.rf(0.2, 0.8) * v.h];
      return [v.x + p[0], v.y + p[1]];
    }

    // ------------------------------------------------------------ drawing (§11.5.1: back to front, fx clipped to FIELD)
    draw() {
      if (!this.ready) { if (this.wipe) this.drawWipe(); return; }
      const g = G(), c = g.ctx;
      g.clear('#000');
      c.save();
      c.beginPath(); c.rect(FIELD.x, FIELD.y, FIELD.w, FIELD.h); c.clip();
      this.drawBackdrop();
      this.drawFx('under');
      this.drawUnits();
      this.drawFx('mid');
      this.drawFx('top');
      this.drawCursors();
      this.drawPops();
      this.drawBulb();
      if (this.dim > 0) g.rect(FIELD.x, FIELD.y, FIELD.w, FIELD.h, 'rgba(0,0,0,' + this.dim + ')');
      c.restore();
      this.drawTop();
      this.drawList();
      this.drawBanner();
      this.drawCard();
      this.drawStealPop();
      this.drawCmd();
      this.drawStatus();
      this.drawAuto();
    }
    drawWipe() {
      const k = this.wipe.t / this.wipe.n;
      for (let i = 0; i < 16; i++) {
        const w = Math.round(U.clamp(k * 1.6 - (i / 16) * 0.6, 0, 1) * R.W);
        if (w > 0) G().rect(i % 2 ? R.W - w : 0, i * 14, w, 14, '#000');
      }
    }
    drawBackdrop() {
      const id = this.o.bg || 'grass';
      let bg = G().has('bbg:' + id) ? G().get('bbg:' + id) : R.BattleFX.fallbackBg(id);
      if (Array.isArray(bg)) bg = bg[Math.floor(R.Engine.frame / 16) % bg.length];
      if (!bg) return;
      G().draw(bg, 0, 0);
      // y 144–151: the backdrop's last row repeated (§11.5.1)
      const h = bg.height || 144;
      if (h < FIELD.h) G().draw(bg, 0, h, { sx: 0, sy: h - 1, sw: bg.width || 256, sh: 1, w: FIELD.w, h: FIELD.h - h });
    }
    /** monsters and members sorted by their feet; a member who ran in is drawn in front of every monster, so a
     *  front-row monster never hides someone attacking the row behind it (§11.5.1) */
    drawUnits() {
      const items = [];
      for (const v of this.vis.values()) {
        if (v.gone || (!v.m.alive && !v.die && !v.flee)) continue;
        items.push({ y: v.y + v.h, o: 0, i: v.i, v });
      }
      for (const v of this.pvs || []) items.push({ y: v.away ? 10000 + v.y : v.y, o: 1, i: v.i, pv: v });
      items.sort((a, b) => a.y - b.y || a.o - b.o || a.i - b.i);
      for (const v of this.pvs || []) this.drawShadow(v);
      for (const it of items) { if (it.v) this.drawMonster(it.v); else this.drawMember(it.pv); }
    }
    drawMonster(v) {
      const F = R.Engine.frame, m = v.m;
      let x = v.x, y = v.y, alpha = 1;
      if (v.fly && !v.die) y += Math.round(Math.sin(F / 18 + v.i) * 2);
      if (v.shake > 0) x += Math.floor(v.shake) % 4 < 2 ? 2 : -2;
      if (v.lunge > 0) x += Math.round(Math.sin(((v.lungeN - v.lunge) / v.lungeN) * Math.PI) * 8); // toward the party
      if (v.dodge > 0) x -= Math.round(Math.sin(((12 - v.dodge) / 12) * Math.PI) * 10); // away from the party
      if (v.appear > 0) alpha = 1 - v.appear / (v.appearN || 20);
      if (v.flee) {
        x -= v.flee.t * 5; // runs off to the left edge
        alpha = 1 - v.flee.t / 18;
        if (alpha <= 0) { v.gone = true; return; }
      }
      if (v.die) { if (this.drawDying(v, x, y)) v.gone = true; return; }
      const targeted = this.picking && this.picking.units && this.picking.units.includes(m);
      const g = G();
      if (v.solid > 0) g.drawTinted(v.img, x, y, '#ffffff', 0.9);
      else if (v.flash > 0 && Math.floor(v.flash / 2) % 2 === 0) g.drawTinted(v.img, x, y, '#ffffff', 0.9);
      else if (v.gflash > 0 && Math.floor(v.gflash / 4) % 2 === 0) g.drawTinted(v.img, x, y, '#fff4b0', 0.85);
      else if (v.blink > 0 && Math.floor(v.blink / 3) % 2 === 0) g.drawTinted(v.img, x, y, '#ffffff', 0.55);
      else if (targeted) g.drawTinted(v.img, x, y, '#ffffff', 0.18 + 0.18 * Math.sin(F * 0.2));
      else g.draw(v.img, x, y, alpha < 1 ? { alpha } : undefined);
      if (isRareMon(m)) this.drawSparkles(v, x, y, F);
      if (v.spk.length) this.drawGoldSparkles(v, F);
    }
    /** a 3-px ellipse of black 50 % (a checkerboard) under each member, as wide as the body (§11.5.14) */
    drawShadow(v) {
      if (v.flee) return;
      const { f } = this.frameOf(v);
      const [X] = this.posOf(v);
      const Y = Math.round(v.y);
      const w = Math.max(10, Math.min(30, (f && f.box && f.box.w) || 16) + 2);
      const a = w / 2, g = G();
      for (let dy = -1; dy <= 1; dy++) {
        const half = Math.round(a * Math.sqrt(1 - (dy / 1.8) * (dy / 1.8)));
        for (let x = -half; x <= half; x++) if (((X + x + Y + dy) & 1) === 0) g.rect(X + x, Y + dy, 1, 1, '#000000');
      }
    }
    drawMember(v) {
      const g = G(), F = R.Engine.frame, p = v.p;
      const { f, flip } = this.frameOf(v);
      if (!f) return;
      const [X, Y] = this.posOf(v);
      const x = X - 24, y = Y - 39;
      const st = p.status || {};
      if (f.img) {
        const picked = this.isPicked(p) && Math.floor(F / 10) % 3 !== 2;
        if (v.flash) g.drawTinted(f.img, x, y, v.flash.col, v.flash.a);
        else if (st.freeze && p.alive) g.drawTinted(f.img, x, y, '#a8ecff', 0.4);
        else if (picked) g.drawTinted(f.img, x, y, '#ffffff', 0.18 + 0.12 * Math.sin(F * 0.2));
        else g.draw(f.img, x, y, flip ? { flip: true } : undefined);
      }
      if (v.flee) return;
      const head = f.head || [24, 15];
      const hx = x + head[0], hy = y + head[1];
      // status icons on the back (right) side, three at a time (§11.5.14)
      const icons = this.iconsOf(p);
      if (icons.length) {
        const pages = Math.ceil(icons.length / 3);
        const pg = pages > 1 ? Math.floor(F / 60) % pages : 0;
        const top = p.alive ? hy : y + ((f.box && f.box.y) || 23) - 9;
        icons.slice(pg * 3, pg * 3 + 3).forEach((s, k) => g.draw(R.BattleFX.get('icon_' + s), X + 10, top + k * 9));
      }
      // 眠り: a zzz rises over the head every 60 frames
      if (st.sleep && p.alive) {
        const t = (F + v.i * 17) % 60;
        if (t < 36) g.draw(R.BattleFX.get('zzz'), hx + 3 + Math.floor(t / 12), hy - 7 - Math.floor(t / 4), { alpha: t > 24 ? (36 - t) / 12 : 1 });
      }
    }
    /** twinkling stars around a rare monster (white and pale gold, period 90 frames) */
    drawSparkles(v, x, y, F) {
      const g = G();
      for (let k = 0; k < 5; k++) {
        const t = (F + k * 37) % 90;
        if (t > 30) continue;
        const px = x + ((k * 53 + Math.floor((F + k * 37) / 90) * 29) % Math.max(8, v.w));
        const py = y + ((k * 31 + Math.floor((F + k * 37) / 90) * 17) % Math.max(8, v.img.height - 4));
        const r = t < 15 ? Math.ceil(t / 5) : Math.ceil((30 - t) / 5);
        const c = k % 2 ? '#fff6c0' : '#ffffff';
        g.rect(px, py - r, 1, r * 2 + 1, c);
        g.rect(px - r, py, r * 2 + 1, 1, c);
      }
    }
    drawGoldSparkles(v, F) {
      const sp = G().has('obj:sparkle') ? G().get('obj:sparkle') : null;
      for (const q of v.spk) {
        const f = Math.min(3, Math.floor((F - q.t0) / 4));
        if (sp && sp[f]) G().draw(sp[f], q.x - 8, q.y - 8);
        else R.BattleFX.twinkle(G(), q.x, q.y, [1, 2, 3, 1][f], '#ffe45a');
      }
    }
    /** returns true when the dissolve is finished */
    drawDying(v, x, y) {
      const t = v.die.t;
      const frames = R.BattleFX.dissolve(v.img);
      if (v.die.boss) {
        if (t < 70) {
          const sx = x + (Math.floor(t) % 4 < 2 ? 2 : -2);
          const k = Math.floor(t / 4) % 3;
          if (k === 0) G().drawTinted(v.img, sx, y, '#ffffff', 0.8);
          else if (k === 1) G().drawTinted(v.img, sx, y, '#ff4030', 0.6);
          else G().draw(v.img, sx, y);
          return false;
        }
        const f = Math.floor((t - 70) / 4);
        if (f >= frames.length) return true;
        G().draw(frames[f], x, y);
        return false;
      }
      if (t < 6) { G().drawTinted(v.img, x, y, '#ffffff', 0.9); return false; }
      const f = Math.floor((t - 6) / 2);
      if (f >= frames.length) return true;
      G().draw(frames[f], x, y);
      return false;
    }
    drawFx(layer) {
      for (const f of this.fxList) if ((f.layer || 'mid') === layer) f.draw(G(), f.t);
    }
    /** ▼ over the aimed monsters (a ▶ on the left of one whose top hides under the help strip) and members */
    drawCursors() {
      if (!this.picking || Math.floor(R.Engine.frame / 10) % 3 === 2) return;
      for (const m of this.picking.units || []) {
        const v = this.vis.get(m);
        if (!v) continue;
        if (v.y - 9 < 26) { rightArrow(Math.max(2, v.x - 8), Math.round(Math.max(34, v.y + Math.min(v.h / 2, 40)))); continue; }
        downArrow(Math.round(v.x + v.w / 2), v.y - 9);
      }
      for (const v of this.pvs || []) {
        if (!this.isPicked(v.p)) continue;
        const r = this.rectOf(v.p);
        downArrow(r.head[0], r.head[1] - 10);
      }
    }
    drawPops() {
      for (const p of this.pops) {
        const gl = R.BattleFX.glyphs(p.color);
        const w = p.str.length * 6 + 1;
        const alpha = p.t > 40 ? (52 - p.t) / 12 : 1;
        for (let i = 0; i < p.str.length; i++) {
          const a = p.t - i * 1.5;
          if (a < 0) continue;
          const dy = a < 10 ? -Math.sin((a / 10) * Math.PI) * 7 : 0;
          const img = gl[p.str[i]];
          if (img) G().draw(img, Math.round(p.x - w / 2 + i * 6), Math.round(p.y + dy), { alpha });
        }
      }
    }
    isPicked(p) { return !!(this.picking && (this.picking.ally === p || (this.picking.allies && !p.gone))); }
    theme() { const T = G().WINDOW_THEMES; return T[R.Settings.windowColor] || T.ink || T.black; }
    /** the glimmer bulb over the head (§11.5.7): rises 6 px as it appears, frames 0/1 every 4, four rays spread */
    drawBulb() {
      const gl = this.glim;
      if (!gl || !gl.bulb) return;
      const t = R.Engine.frame - gl.t0;
      if (t < 0 || t > gl.H) return;
      const v = this.pv(gl.u);
      if (!v) return;
      const r = this.rectOf(gl.u);
      const img = G().has('obj:glimmer') ? G().get('obj:glimmer') : R.BattleFX.get('bulb');
      const fr = Array.isArray(img) ? img[Math.floor(t / 4) % img.length] : img;
      const bx = Math.round(r.head[0] - 8), by = Math.round(r.head[1] - 17 + (t < 6 ? 6 * (1 - t / 6) : 0));
      G().draw(fr, bx, by, t < 6 ? { alpha: Math.max(0.15, t / 6) } : undefined);
      if (t < 8) {
        const cx = bx + 8, cy = by + 7, d = 8 + t, g = G(), c = g.ctx, a0 = c.globalAlpha;
        c.globalAlpha = a0 * (1 - t / 8);
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let k = 0; k < 3; k++) g.rect(cx + sx * (d + k), cy + sy * (d + k), 1, 1, RAY_COL);
        c.globalAlpha = a0;
      }
    }
    /** the tech-name banner: opens 8→14, stays until H, closes H→H+6 (§11.5.7) */
    drawBanner() {
      const gl = this.glim;
      if (!gl) return;
      const t = R.Engine.frame - gl.t0;
      let h;
      if (t < 8) return;
      if (t < 14) h = (BANNER.h * (t - 8)) / 6;
      else if (t <= gl.H) h = BANNER.h;
      else if (t <= gl.H + 6) h = BANNER.h * (1 - (t - gl.H) / 6);
      else return;
      h = Math.round(h);
      if (h < 2) return;
      const g = G(), w = gl.w, x = Math.round(BANNER.cx - w / 2), cy = BANNER.y + BANNER.h / 2;
      const y = Math.round(cy - h / 2);
      if (h < 10) {
        const th = this.theme();
        g.rect(x + 2, y, w - 4, h, th.fill);
        g.rect(x + 4, Math.round(cy), w - 8, 1, th.border);
        return;
      }
      g.window(x, y, w, h);
      const c = g.ctx;
      c.save();
      c.beginPath(); c.rect(x, y + 3, w, h - 6); c.clip();
      g.text(gl.name, BANNER.cx, BANNER.y + 8, { size: 16, align: 'center', color: gl.color, shadow: '#000' });
      c.restore();
      if (h >= BANNER.h - 4) titlePlate(x, BANNER.y, w, gl.title, gl.titleColor || g.C.white, this.theme());
    }
    /** the drop card (rare / super rare) with its sparkles (§11.5.8) */
    drawCard() {
      const cd = this.card;
      if (!cd) return;
      const g = G(), C = g.C, F = R.Engine.frame, t = F - cd.t0;
      const sup = cd.grade === 'super';
      const x = CARD.x, y = sup ? CARD.y - 2 : CARD.y, w = CARD.w, h = sup ? 46 : 30;
      // pops open over 5 frames
      const k = Math.min(1, (t + 1) / 5);
      if (k < 1) {
        const hh = Math.max(4, Math.round(h * k));
        g.window(x, Math.round(y + (h - hh) / 2), w, hh);
        return;
      }
      g.window(x, y, w, h);
      titlePlate(x, y, w, sup ? '超レア' : 'レア', sup ? C.super : C.white, this.theme());
      const it = DB.items[cd.item];
      const name = '★' + (it ? it.name : cd.item);
      g.draw(g.get(iconKey(cd.item)), x + (sup ? 14 : 12), y + (sup ? 10 : 11));
      g.fitText(name, x + (sup ? 26 : 24), y + (sup ? 8 : 9), w - (sup ? 26 : 24) - 10, { color: sup ? C.super : C.rare });
      if (sup) g.text('ほかでは手に入らない一品', x + 14, y + 24, { color: '#c8c8d8' });
      if (sup) {
        // seven pink and white crosses round the card, radius 1–3, blinking on a 20-frame cycle
        const P = [[x + 4, y - 6], [x + 30, y - 7], [x + 104, y - 8], [x + w + 4, y + 12], [x + w - 16, y + h + 6], [x + 58, y + h + 7], [x + 2, y + h + 5]];
        P.forEach(([px, py], i) => {
          const q = (t + i * 7) % 20;
          const r = q < 10 ? 1 + Math.floor(q / 4) : Math.max(0, 3 - Math.floor((q - 10) / 3));
          if (r > 0) R.BattleFX.twinkle(g, px, py, Math.min(3, r), i % 2 ? '#ffffff' : C.super, '#ffffff');
        });
      } else {
        // two white crosses left and right of the card
        [[x + 3, y - 5], [x + w + 5, y + h / 2]].forEach(([px, py], i) => {
          const q = (t + i * 10) % 20;
          const r = q < 10 ? 1 + Math.floor(q / 4) : Math.max(0, 3 - Math.floor((q - 10) / 3));
          if (r > 0) R.BattleFX.twinkle(g, px, py, Math.min(3, r), '#ffffff', '#ffffff');
        });
      }
    }
    /**
     * the steal popup (Part A12): a small card over the enemy side — 「★ レアを盗んだ！」 / 「★★ 超レアを盗んだ！」 on top
     * (the mark in C.rare / C.super), the item's icon and name below; it pops open over 5 frames and folds over the last 6
     */
    drawStealPop() {
      const p = this.stealPop;
      const left = this.stealPopLeft();
      if (!p || left <= 0) return;
      const g = G(), C = g.C, t = R.Engine.frame - p.t0;
      const sup = p.grade === 'super';
      const col = sup ? C.super : C.rare;
      const mark = sup ? '★★' : '★', label = sup ? '超レアを盗んだ！' : 'レアを盗んだ！';
      const it = DB.items[p.item];
      const name = it ? it.name : String(p.item);
      const w = Math.min(EZ.x1 - EZ.x0 - 8, Math.max(POP.minW, Math.ceil(g.textWidth(name)) + 44, Math.ceil(g.textWidth(mark + ' ' + label)) + 24));
      const x = Math.round(POP.cx - w / 2), y = POP.y, h = POP.h;
      const k = Math.min(1, (t + 1) / 5, left / 6);
      if (k < 1) {
        const hh = Math.max(4, Math.round(h * k));
        g.window(x, Math.round(y + (h - hh) / 2), w, hh);
        return;
      }
      g.window(x, y, w, h);
      const mw = Math.ceil(g.textWidth(mark + ' '));
      const lx = Math.round(POP.cx - (mw + g.textWidth(label)) / 2);
      g.text(mark, lx, y + 5, { color: col, shadow: '#000' });
      g.text(label, lx + mw, y + 5, { color: C.white });
      g.draw(g.get(iconKey(p.item)), x + 10, y + 19);
      g.fitText(name, x + 28, y + 18, w - 28 - 8, { color: col });
      // white (rare) / pink and white (super) crosses at the corners, blinking on a 20-frame cycle
      [[x + 3, y - 4], [x + w - 2, y + 6], [x + w + 3, y + h - 6], [x + 2, y + h + 3]].forEach(([px, py], i) => {
        const q = (t + i * 5) % 20;
        const r = q < 10 ? 1 + Math.floor(q / 4) : Math.max(0, 3 - Math.floor((q - 10) / 3));
        if (r > 0) R.BattleFX.twinkle(g, px, py, Math.min(3, r), sup && i % 2 ? C.super : '#ffffff', '#ffffff');
      });
    }
    /** the top window: the help / target strip while commands are entered, else the message window (only with text) */
    drawTop() {
      const p = this.panel;
      const s = p && p.help ? p.help() : '';
      if (s) {
        const g = G();
        g.window(HELP.x, HELP.y, HELP.w, HELP.h);
        const color = (p.helpColor && p.helpColor()) || undefined;
        const room = HELP.w - 16;
        if (p.helpCenter) {
          const w = Math.min(room, g.textWidth(s));
          g.fitText(s, Math.round(HELP.x + (HELP.w - w) / 2), HELP.y + 4, room, { color });
        } else g.fitText(s, HELP.x + 8, HELP.y + 4, room, { color });
        return;
      }
      this.drawMsg();
    }
    drawMsg() {
      const m = this.msg;
      if (!m.lines.length) return; // no text, no window: the field stays open (§11.5.5)
      const box = this.msgBox;
      G().window(box.x, box.y, box.w, box.h);
      let left = Math.floor(m.ch);
      m.lines.forEach((line, i) => {
        let s = line;
        if (i >= m.start) { s = line.slice(0, Math.max(0, left)); left -= line.length; }
        G().text(s, box.x + 10, box.y + 5 + i * 14);
      });
      if (m.resolve && m.key && m.ch >= m.need && !this.locked) G().moreArrow(box.x + box.w - 16, box.y + box.h - 9);
    }
    /** the tech / spell / item list on the enemy side; closed while a target is chosen (§11.5.3) */
    drawList() {
      const p = this.panel;
      if (!p || !p.left || p.left.y === CMD.y || p.hideList) return;
      p.left.draw({ showInactiveCursor: true });
    }
    /** CMD: the party / member menu while commands are entered, else the enemy names (§11.5.4) */
    drawCmd() {
      const p = this.panel;
      let drawn = false;
      if (p && p.under) { p.under.draw({ showInactiveCursor: true }); drawn = true; }
      if (p && p.left && p.left.y === CMD.y && !drawn) { p.left.draw({ showInactiveCursor: true }); drawn = true; }
      if (!drawn) this.drawEnemyNames();
    }
    /** enemy names: one line per species group (golden ones apart), ≤ 4 lines (§11.5.4) */
    enemyGroups() {
      const out = [], by = {};
      for (const m of this.eng.mons) {
        if (!m.alive) continue;
        const gold = isGolden(m);
        const k = (m.id || m.base) + (gold ? '*' : '');
        let g = by[k];
        if (!g) { g = by[k] = { name: m.base || m.name, n: 0, gold, metal: isMetal(m) }; out.push(g); }
        g.n++;
      }
      return out;
    }
    drawEnemyNames() {
      const g = G(), C = g.C, x = CMD.x, y = CMD.y;
      g.window(x, y, CMD.w, CMD.h);
      const gr = this.enemyGroups();
      const lines = gr.length > 4 ? gr.slice(0, 3).concat([{ name: `ほか${gr.length - 3}組`, n: '', more: true }]) : gr;
      // the オート／リピート badge sits on the top border and is one text line tall: the names start under it
      const badge = this.auto || this.repeating;
      lines.forEach((l, i) => {
        const ty = badge ? y + 11 + i * 13 : y + 7 + i * 14;
        const color = l.gold ? C.gold : l.metal ? METAL_COL : C.white;
        g.fitText(l.name, x + 8, ty, l.more ? 74 : 64, { color });
        if (!l.more) g.text(String(l.n), x + 82, ty, { align: 'right', color });
      });
    }
    /** STATUS: one row per member — row tag, name, H cur/max, M cur/max (§11.5.2, A18) */
    drawStatus() {
      const g = G(), C = g.C, F = R.Engine.frame;
      const th = this.theme();
      const fill2 = th.fill2 || th.fill;
      const band = g.mix ? g.mix(th.fill, th.border, 0.16) : fill2;
      const x = STATUS.x;
      g.window(x, STATUS.y, STATUS.w, STATUS.h);
      this.eng.party.slice(0, 4).forEach((p, i) => {
        const y = STATUS.y + 7 + i * 14;
        const f = this.winFx[i] || {};
        const inputting = this.acting === p && this.panel && !this.inRound;
        const picked = this.isPicked(p);
        if (inputting || (picked && Math.floor(F / 10) % 3 !== 2)) g.rect(x + 3, y - 1, 152, 13, band);
        if (f.glow > 0) {
          const t = GLOW_FRAMES - f.glow;
          const c = g.ctx, a0 = c.globalAlpha;
          c.globalAlpha = a0 * 0.35 * (f.glow / GLOW_FRAMES);
          g.rect(x + 3, y - 1, 152, 13, GLOW_FILL);
          c.globalAlpha = a0;
          if (t < 16 && Math.floor(t / 4) % 2 === 0) g.strokeRect(x + 3, y - 1, 152, 13, GLOW_EDGE);
        }
        const red = f.flash > 0 && Math.floor(f.flash / 3) % 2 === 0;
        const col = red ? C.red : p.hp <= 0 ? C.dead : p.hp < p.mhp * 0.25 ? C.yellow : C.white;
        const mid = this.rowOf(p) === 'middle';
        g.rect(x + SCOL.tag, y + 1, 12, 11, fill2);
        g.text(mid ? '後' : '前', x + SCOL.tag + 1, y, { color: mid ? C.cyan : C.orange });
        g.fitText(p.name, x + SCOL.name, y, SCOL.nameW, { color: col });
        g.text('H', x + SCOL.h, y, { color: col });
        g.text(`${Math.max(0, p.hp)}/${p.mhp}`, x + SCOL.hp, y, { color: col, align: 'right' });
        g.text('M', x + SCOL.m, y, { color: col });
        g.text(`${Math.max(0, p.mp)}/${p.mmp}`, x + SCOL.mp, y, { color: col, align: 'right' });
      });
    }
    /** オート・リピート: the badge on CMD's top border (§11.5.11) */
    drawAuto() {
      if (!this.auto && !this.repeating) return;
      const g = G();
      const cancel = this.auto ? this.autoCancel : this.repeatCancel;
      const name = this.auto ? 'オート' : 'リピート';
      const s = cancel ? name + '解除' : name + '　Bで解除';
      const tw = Math.min(80, Math.ceil(g.textWidth(s)));
      g.rect(CMD.x + 2, CMD.y - 3, tw + 4, 8, this.theme().fill);
      g.fitText(s, CMD.x + 4, CMD.y - 3, 80, { color: cancel ? g.C.yellow : g.C.white });
    }
  }

  /**
   * one row of the one-column battle list (techs / spells / items): the name in ≈ 124 px (8 characters fit unsqueezed,
   * §11.5.3), the cost right-aligned at the right edge
   */
  function drawListItem(it, x, y, w) {
    // called as the List's drawItem (`this` = the R.UI.List). In a list of more than one column the cost ends 6 px
    // short of the next column's ▶ (drawn at its x − 10), as R.UI.List's own rows do (owner 2026-09-26)
    const g = G(), colW = w + 4, multi = !!(this && this.cols > 1);
    const rEnd = multi ? colW - 16 : colW - 6;
    const label = typeof it === 'object' ? it.label : it;
    const dis = typeof it === 'object' && it.disabled;
    const color = (typeof it === 'object' && it.color) || (dis ? g.C.gray : g.C.white);
    const right = typeof it === 'object' && it.right != null && it.right !== '' ? String(it.right) : null;
    if (right) {
      const rw = g.textWidth(right);
      g.fitText(label, x, y, rEnd - 4 - rw, { color });
      g.text(right, x + rEnd, y, { color: (!dis && it.rightColor) || color, align: 'right' });
    } else g.fitText(label, x, y, multi ? colW - 16 : colW - 8, { color });
  }
  /** title plate on a window's top border in a given colour (Gfx.window only draws white titles) */
  function titlePlate(x, y, w, title, color, theme) {
    const g = G();
    const tw = Math.ceil(g.textWidth(title)) + 8;
    const tx = x + Math.floor((w - tw) / 2);
    g.rect(tx, Math.max(0, y - 3), tw, 8 + Math.min(0, y - 3), theme.fill);
    g.text(title, tx + 4, y - 3, { color });
  }
  /** banner text for a glimmered action: title, name colour, width (§11.5.7) */
  function bannerOf(ab, kind) {
    const C = G().C;
    const name = ab.name || '？？？';
    let title = '閃き！', color = '#fff8d0', titleColor = null;
    const isSpell = (ab.kind || kind) === 'spell';
    if (isSpell) {
      const els = Array.isArray(ab.elements) ? ab.elements : [];
      if (els.length >= 2) title = '合成術';
      const first = elemOrder().find((e) => els.includes(e)) || els[0];
      color = (first && DB.elements && DB.elements[first] && DB.elements[first].color) || '#fff8d0';
    } else {
      const lv = (ab.glim && ab.glim.lv) || ab.rank || 0;
      if (lv >= 10) { title = '極意'; color = C.super; titleColor = C.super; } else if (lv === 9) { title = '奥義'; color = C.gold; titleColor = C.gold; }
    }
    const tw = Math.ceil(G().textWidth(name, 16));
    const w = Math.min(168, Math.max(128, tw + 40));
    return { name, title, color, titleColor, w };
  }

  // target cursors: a white triangle with a full 1-px black outline (readable over clouds, snow and light sprites)
  /** ▼ whose tip is at (cx, y + 4) */
  function downArrow(cx, y) {
    const g = G();
    g.rect(cx - 5, y - 1, 11, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - 5 + i, y + i, 11 - i * 2, 1, '#000000');
    g.rect(cx, y + 5, 1, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(cx - 4 + i, y + i, 9 - i * 2, 1, '#ffffff');
  }
  /** ▶ whose tip is at (x + 4, cy) */
  function rightArrow(x, cy) {
    const g = G();
    g.rect(x - 1, cy - 5, 1, 11, '#000000');
    for (let i = 0; i < 5; i++) g.rect(x + i, cy - 5 + i, 1, 11 - i * 2, '#000000');
    g.rect(x + 5, cy, 1, 1, '#000000');
    for (let i = 0; i < 5; i++) g.rect(x + i, cy - 4 + i, 1, 9 - i * 2, '#ffffff');
  }

  // --------------------------------------------------------------- entry
  const monDef = (id) => (DB.monsters && DB.monsters[id]) || null;
  const hasFlag = (id, f) => { const d = monDef(id); return !!(d && d.flags && d.flags.includes(f)); };
  function partyMod(key) {
    try {
      if (R.Rules && R.Rules.partyMods) { const m = R.Rules.partyMods(); if (m && m[key] != null) return m[key]; }
      if (R.Party && R.Party.mod) return R.Party.mod(key) || 0;
    } catch (e) { /* no party mods yet */ }
    return 0;
  }
  /** Tb of a battle (§4.14.1): o.tier, the troop's fixed tier, the zone's fixed tier, else the world tier */
  function battleTier(o, troop, zone) {
    if (o.tier != null) return o.tier;
    const cur = R.Tier && R.Tier.current ? R.Tier.current() : (R.Game && R.Game.tier) || 0;
    if (troop) return troop.tier != null ? troop.tier : cur;
    if (zone && typeof zone.tier === 'number') return zone.tier;
    return cur;
  }
  function buildIds(spec, tier) {
    if (R.Mon && R.Mon.buildList) return R.Mon.buildList(spec, tier);
    return B.buildMons ? B.buildMons({ mons: spec }) : [];
  }
  /** the zone's めずらしい魔物 swap (§3.3.8): p = 1/rate × (1 + min(150, rareEncPct)/100) × (lure ? 2 : 1) */
  function rollRare(zoneId) {
    const rr = DB.rareEncounters && DB.rareEncounters[zoneId];
    if (!rr || !monDef(rr.mon)) return null;
    const N = +rr.rate || 0;
    if (N <= 0) return null;
    const base = N >= 1 ? 1 / N : N; // rate is a denominator (80 = 1/80); an old probability < 1 still works
    const lure = R.Game && R.Game.encItem && R.Game.encItem.pct > 0 ? 2 : 1;
    const p = base * (1 + Math.min(150, partyMod('rareEncPct')) / 100) * lure;
    return U.r() < p ? rr.mon : null;
  }
  /**
   * Decide everything about a battle before it starts (pure except for the random rolls):
   * monsters (rare swap → build → golden roll), party / reserve (members), BGM, backdrop, auto start.
   */
  function prepare(o) {
    o = Object.assign({}, o || {});
    const troop = (o.troop && DB.troops && DB.troops[o.troop]) || null;
    const zone = (o.zone && DB.encounters && DB.encounters[o.zone]) || null;
    const tier = battleTier(o, troop, zone);
    const zoneFight = !!(o.zone && !o.troop && !o.mons);
    let rareMon = o.rareMon || null;
    if (zoneFight && !rareMon && !o.noRare) rareMon = rollRare(o.zone);
    let ids = [];
    if (rareMon) ids = [rareMon];
    else if (o.mons) ids = buildIds(o.mons, tier);
    else if (troop) ids = buildIds(troop.mons, tier);
    else if (zone) {
      const grp = R.Mon && R.Mon.zoneGroup ? R.Mon.zoneGroup(o.zone, tier) : zone.groups && zone.groups.length ? U.weighted(zone.groups) : null;
      ids = grp ? buildIds(grp.mons, tier) : [];
    }
    // 金色の魔物: random zone fights only; not after a rare swap; never a metal-only group (rollGolden skips metal / rare / boss)
    let golden = -1;
    if (zoneFight && !rareMon && !o.noGolden && ids.length && R.Mon && R.Mon.rollGolden) golden = R.Mon.rollGolden(ids);
    const boss = ids.some((id) => hasFlag(id, 'boss'));
    const metal = ids.some((id) => hasFlag(id, 'metal'));
    const rare = !!rareMon || ids.some((id) => hasFlag(id, 'rare'));
    const mons = golden >= 0 ? ids.map((id, i) => ({ id, golden: i === golden })) : ids.slice();
    const bgm = o.bgm || (troop && troop.bgm) || (rare || golden >= 0 || metal ? 'rarebattle' : boss ? 'boss' : 'battle');
    const bg = o.bg || (troop && troop.bg) || (zone && zone.bg) || 'grass';
    // members: only these fight; the others of the party are treated like the reserve (60 % EXP)
    const all = (R.Game && R.Game.party) || [];
    let party = all, reserve = ((R.Game && R.Game.reserve) || []).slice();
    if (Array.isArray(o.members) && o.members.length) {
      const inBattle = all.filter((c) => o.members.includes(c.id));
      if (inBattle.length) { party = inBattle; reserve = all.filter((c) => !inBattle.includes(c)).concat(reserve); }
    }
    const noEscape = !!(o.noEscape || (troop && troop.noEscape) || boss);
    // オート継続 (§3.3.8): plain random zone fights only, never with a boss / rare / golden / metal monster
    const autoStart = zoneFight && !o.canLose && !noEscape && !boss && !rare && golden < 0 && !metal &&
      R.Settings.autoKeep !== false && !!B.autoCarry;
    return { o, troop, zone, tier, zoneFight, rareMon, ids, mons, golden, boss, metal, rare, bgm, bg, party, reserve, noEscape, autoStart };
  }

  /**
   * Start a battle (§3.3.8). o: {zone | troop | mons, bg, bgm, canLose, noEscape, surprise, noRare, noGolden,
   * tier, lvOff, glimmerForce, members}. Resolves 'win' | 'lose' | 'escape'. On 'lose' the party is left as is
   * (the caller runs the game over / canLose recovery).
   */
  async function start(o) {
    o = o || {};
    if (!R.Game) throw new Error('R.Battle.start: no game in progress');
    // the engine side (battle.js R.Battle.setup: tier, level, rare swap, golden roll, members) decides the fight;
    // prepare() below is the same logic for an engine without setup()
    const S = setupBattle(o);
    if (!S || !S.eng || !S.eng.mons.length) { R.warn('battle: no monsters for', o.zone || o.troop || o.mons); return 'win'; }
    const eng = S.eng;
    const A = R.Audio;
    const prev = A && A.current;
    if (A && A.pushBGM) A.pushBGM(S.bgm); else R.bgm(S.bgm);
    R.Game.battles = (R.Game.battles || 0) + 1;
    const lastBefore = B.last;
    const scene = new BattleScene(eng, { bg: S.bg, bgm: S.bgm, canLose: !!o.canLose, autoStart: !!S.autoStart, rare: !!S.rare });
    B.current = scene;
    let res;
    try {
      res = await R.Engine.run(scene);
    } finally {
      B.current = null;
      if (A && A.popBGM) A.popBGM(); else if (prev) R.bgm(prev);
    }
    if (res === 'win' && eng.killed && eng.killed.length) R.Game.wins = (R.Game.wins || 0) + 1;
    if (res === 'escape') R.Game.escapes = (R.Game.escapes || 0) + 1;
    // a live engine writes R.Battle.last in finish(); fill in what it left out from the scene's own log
    const mine = lastOf(eng, scene, res, o);
    B.last = B.last && B.last !== lastBefore ? Object.assign(mine, B.last, { result: res }) : mine;
    R.emit('battleEnd', res, o);
    return res;
  }
  /** {eng, bg, bgm, autoStart, rare} for R.Battle.start */
  function setupBattle(o) {
    if (B.setup) return B.setup(o);
    const P = prepare(o);
    if (!P.mons.length) return null;
    const eo = {
      party: P.party, reserve: P.reserve, mons: P.mons, inv: R.Game.inv, live: true,
      noEscape: P.noEscape, noSurprise: !P.zoneFight, canLose: !!o.canLose,
      zone: o.zone || null, troop: o.troop || null, tier: P.tier, glimmerForce: o.glimmerForce || null, rare: P.rare,
    };
    if (o.surprise !== undefined) eo.surprise = o.surprise;
    let bg = P.bg;
    if (!o.bg && !(P.troop && P.troop.bg) && !(P.zone && P.zone.bg) && R.Field && R.Field.battleBg) { try { bg = R.Field.battleBg(o.zone) || bg; } catch (e) { /* keep grass */ } }
    return { eng: new B.Engine(eo), bg, bgm: P.bgm, autoStart: P.autoStart, rare: P.rare };
  }
  /** R.Battle.last (§3.3.8): what the battle gave, for events and tests */
  function lastOf(eng, scene, result, o) {
    const rw = eng.rewardInfo || {};
    const base = eng.last && typeof eng.last === 'object' ? eng.last : {};
    return Object.assign({
      result, rounds: eng.round, zone: o.zone || null, troop: o.troop || null,
      killed: (eng.killed || []).map((m) => ({ id: (m.d && m.d.baseId) || m.id, golden: isGolden(m) })),
      exp: rw.exp || 0, gold: rw.gold || 0,
      drops: scene.log.drops.slice(),
      glimmers: scene.log.glimmers.slice(),
      levelUps: scene.log.levelUps.slice(),
      stolen: scene.log.stolen.slice(),
    }, base);
  }

  Object.assign(B, {
    start, prepare, setupBattle, Scene: BattleScene, current: null, last: B.last || null,
    LAYOUT, STATUS_COLS: SCOL, enemyLayout: (list, sizeOf) => enemyLayout(list || [], sizeOf),
    HELP, BANNER, CARD,
    WIN, WIN_BOTTOM, BOX, GROUND, // legacy (front view): values unchanged for other owners' tools (§11.5.1)
    ui: { itemLabel, itemColor, iconKey, bannerOf, helpLine, WHY, battlerSheet, fallbackSheet, wtypeOf, familyOf, BAT_FALLBACK, drawListItem },
  });
})(window.RPG);
