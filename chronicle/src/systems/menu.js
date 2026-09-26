// Field menu (DESIGN §11.7): the Y-button command window (16 commands) with the
// gold / play time / chronicle window, the four party windows and the next
// objective, plus the shared menu kit (labels, item marks and colours, icons,
// sprites, the row tag, the L◀ ▶R hint, the screen base class, the party
// picker), the field effects of items and spells (R.Menu.applyFieldEffect),
// field use of items / spells with repeat targeting, 満タン, ワープ and 脱出.
// Sub-screens live in menu_*.js and register themselves on R.Menu at load time;
// classes are built lazily because the in-directory load order is not fixed.
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  // ------------------------------------------------------------ ids & labels (DESIGN §3.1.1, STYLE_JA §8)
  const STATS6 = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
  const SLOTS_DEFAULT = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
  const SLOT_NAMES = { weapon1: '武器1', weapon2: '武器2', shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc1: 'アクセ1', acc2: 'アクセ2' };
  const SLOT_TYPE = { weapon1: 'weapon', weapon2: 'weapon', shield: 'shield', head: 'head', body: 'body', hands: 'hands', feet: 'feet', acc1: 'acc', acc2: 'acc' };
  const GEAR_TYPES = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'];
  const TYPE_NAMES = { weapon: '武器', shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc: 'アクセサリ', consumable: '道具', key: '大事なもの' };
  // the 17 keys of R.Rules.previewStats (§3.3.3) in display order, with their short names (§11.7.5)
  const DIFF_KEYS = ['atk1', 'atk2', 'mag', 'def', 'mdef', 'hit', 'eva', 'crit', 'str', 'vit', 'dex', 'agi', 'int', 'mnd', 'hp', 'mp', 'wp'];
  const STAT_NAMES = {
    atk1: '攻撃1', atk2: '攻撃2', mag: '術力', def: '守備', mdef: '術防', hit: '命中', eva: '回避', crit: '会心', spd: '行動の速さ',
    str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神', hp: '最大HP', mp: '最大MP', wp: '最大WP',
  };
  // strengthening / weakening targets (§3.1.1) in their long form
  const BUFF_NAMES = { atk: '攻撃力', def: '守備力', mag: '術力', mdef: '術防', agi: '素早さ' };
  const WTYPES_DEFAULT = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const WTYPE_NAMES = { sword: '剣', greatsword: '大剣', dagger: '短剣', axe: '斧', spear: '槍', bow: '弓', club: '棍棒', staff: '杖', katana: '刀', fist: '体術', whip: '鞭' };
  const TWO_HANDED_DEFAULT = { greatsword: 1, spear: 1, bow: 1 };
  const ELEMS_DEFAULT = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const ELEM_NAMES = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const ELEM_COLORS = { fire: '#ff7038', water: '#48a8ff', wind: '#68dc88', earth: '#c89850', light: '#fff0a0', dark: '#a068e0' };
  const STATUS_NAMES = {
    poison: '毒', burn: 'やけど', sleep: '眠り', paralyze: 'まひ', freeze: '凍結', stun: '気絶', confuse: '混乱', silence: '沈黙', blind: '暗闇',
    death: '即死', regen: '再生', veil: '加護', counter: '反撃の構え', nimble: '身軽', cover: 'かばう',
  };
  const RACE_NAMES = {
    beast: '獣', construct: '魔造', insect: '虫', humanoid: '人型', spirit: '霊体', plant: '植物', demon: '魔族', aquatic: '水生',
    undead: '不死', fairy: '妖精', bird: '鳥', slime: '軟体', ooze: '軟体', dragon: '竜', human: '人',
  };
  const ROLE_NAMES = { guard: '前衛・重', striker: '前衛・軽', ranged: '中列・武器', caster: '術・攻め', healer: '術・癒やし', hybrid: '武器と術' };
  const APT_COLOR = { S: '#ffd24a', A: '#6ee07a', B: '#ffffff', C: '#a0a0a8', D: '#707080' };
  const COL = {
    sub: '#c8c8d8', // labels / supplementary text (§11.1.1)
    gray: '#8c8c8c', // unusable
    zero: '#808090', // a 0 delta
    off: '#606070', // cannot equip
    dim: '#404050', // empty bestiary dots
    good: '#6ee07a', bad: '#ff5a4a',
  };

  const wtypes = () => {
    const k = Object.keys(DB.weaponTypes || {});
    if (!k.length) return WTYPES_DEFAULT.slice();
    return k.sort((a, b) => ((DB.weaponTypes[a].order ?? 99) - (DB.weaponTypes[b].order ?? 99)));
  };
  const elems = () => { const k = Object.keys(DB.elements || {}); return k.length ? k : ELEMS_DEFAULT.slice(); };
  const elemName = (e) => (DB.elements[e] && DB.elements[e].name) || ELEM_NAMES[e] || e;
  const elemColor = (e) => (DB.elements[e] && DB.elements[e].color) || ELEM_COLORS[e] || '#ffffff';
  const statusName = (s) => (DB.statuses[s] && DB.statuses[s].name) || STATUS_NAMES[s] || s;
  const wtypeName = (w) => (DB.weaponTypes[w] && DB.weaponTypes[w].name) || WTYPE_NAMES[w] || w;
  const raceName = (r) => RACE_NAMES[r] || r || '';
  const itemName = (id) => (DB.items[id] && DB.items[id].name) || '？？？';
  const actName = (id) => (DB.actions[id] && DB.actions[id].name) || '？？？';

  // ------------------------------------------------------------ rules adapters
  // The menu computes nothing that R.Rules owns (§11.13): these only call the rules API and
  // keep the screens alive while another area's module is still missing (§1.2-5).
  const Rl = () => R.Rules || {};
  const has = (o, f) => !!(o && typeof o[f] === 'function');
  const slots = () => (Array.isArray(Rl().SLOTS) && Rl().SLOTS.includes('weapon1') ? Rl().SLOTS.slice() : SLOTS_DEFAULT.slice());
  const slotName = (s) => (Rl().SLOT_NAMES && Rl().SLOT_NAMES[s]) || SLOT_NAMES[s] || s;
  function slotGroup(id) {
    if (has(Rl(), 'slotGroup')) return Rl().slotGroup(id);
    const it = DB.items[id];
    return it && GEAR_TYPES.includes(it.type) ? it.type : null;
  }
  function slotsFor(id) {
    if (has(Rl(), 'slotsFor')) return Rl().slotsFor(id) || [];
    const g = slotGroup(id);
    return g ? slots().filter((s) => SLOT_TYPE[s] === g) : [];
  }
  function isTwoHanded(id) {
    if (!id) return false;
    if (has(Rl(), 'isTwoHanded')) return !!Rl().isTwoHanded(id);
    const it = DB.items[id];
    if (!it || it.type !== 'weapon') return false;
    if (it.twoHanded != null) return !!it.twoHanded;
    const wt = DB.weaponTypes[it.wtype];
    return wt ? !!wt.twoHanded : !!TWO_HANDED_DEFAULT[it.wtype];
  }
  const holdsTwoHanded = (c) => (has(Rl(), 'hasTwoHanded') ? !!Rl().hasTwoHanded(c) : isTwoHanded(c.equip.weapon1) || isTwoHanded(c.equip.weapon2));
  function canEquip(c, id, slot) {
    if (!id) return true;
    if (has(Rl(), 'canEquip')) { try { return !!Rl().canEquip(c, id, slot); } catch (e) { return false; } }
    return slot ? slotsFor(id).includes(slot) : slotsFor(id).length > 0;
  }
  function equipIssue(c, id, slot) {
    if (has(Rl(), 'equipIssue')) { try { return Rl().equipIssue(c, id, slot); } catch (e) { return null; } }
    return canEquip(c, id, slot) ? null : '装備できない。';
  }
  /** R.Rules.equip normalised to {ok, removed, reason} (§3.3.3: the result is an object; old code returned a bool) */
  function equip(c, slot, id) {
    if (!has(Rl(), 'equip')) return { ok: false, removed: [], reason: '装備できない。' };
    const r = Rl().equip(c, slot, id || null);
    if (r && typeof r === 'object') return { ok: !!r.ok, removed: r.removed || [], reason: r.reason };
    return { ok: !!r, removed: [] };
  }
  const stats = (c) => (has(Rl(), 'stats') ? Rl().stats(c) : { hp: c.hp || 1, mp: c.mp || 0, wp: c.wp || 0 });
  /** attack of a weapon slot from a stats() result (weapon1 falls back to the bare hands) */
  function atkOf(st, slot) {
    if (!st) return 0;
    if (slot === 'weapon1' && st.atk1 != null) return st.atk1 || 0;
    if (slot === 'weapon2' && st.atk2 != null) return st.atk2 || 0;
    const w = st.w;
    if (w) {
      if (w[slot]) return w[slot].atk || 0;
      if (slot === 'weapon1' && w.fist) return w.fist.atk || 0;
      return 0;
    }
    return slot === 'weapon1' ? st.atk || 0 : 0;
  }
  /** the 17 derived values of a stats() result, keyed like previewStats' Diff */
  function statVector(st) {
    const out = {};
    for (const k of DIFF_KEYS) out[k] = k === 'atk1' ? atkOf(st, 'weapon1') : k === 'atk2' ? atkOf(st, 'weapon2') : st[k] || 0;
    const w1 = st.w && (st.w.weapon1 || (!st.w.weapon2 && st.w.fist));
    if (w1 && w1.hit != null && st.hit == null) out.hit = w1.hit;
    return out;
  }
  /** Diff of wearing `id` in `slot` (R.Rules.previewStats; a stats() of a copy while that is missing) */
  function previewDiff(c, slot, id) {
    if (has(Rl(), 'previewStats')) {
      const d = Rl().previewStats(c, slot, id || null) || {};
      const out = {};
      for (const k of DIFF_KEYS) out[k] = d[k] || 0;
      return out;
    }
    const t = Object.assign({}, c, { equip: Object.assign({}, c.equip) });
    t.equip[slot] = id || null;
    if (id && isTwoHanded(id)) t.equip.shield = null;
    const a = statVector(stats(c)), b = statVector(stats(t));
    const out = {};
    for (const k of DIFF_KEYS) out[k] = b[k] - a[k];
    return out;
  }
  const cost = (c, id, kind) => {
    const a = DB.actions[id];
    if (!a) return 0;
    if (kind === 'wp' || a.kind === 'tech') return has(Rl(), 'wpCost') ? Rl().wpCost(c, id) : a.wp || 0;
    return has(Rl(), 'mpCost') ? Rl().mpCost(c, id) : a.mp || 0;
  };
  const spellOrder = (id) => (DB.actions[id] && DB.actions[id].order) || 999;
  function spellList(c) {
    if (has(Rl(), 'spellList')) return (Rl().spellList(c) || []).filter((id) => DB.actions[id]);
    return (c.spells || []).filter((id) => DB.actions[id]).sort((a, b) => spellOrder(a) - spellOrder(b));
  }
  function techList(c, wt) {
    if (has(Rl(), 'techList')) return (Rl().techList(c, wt) || []).filter((id) => DB.actions[id]);
    return (c.techs || []).filter((id) => DB.actions[id] && DB.actions[id].wtype === wt).sort((a, b) => (DB.actions[a].rank || 0) - (DB.actions[b].rank || 0));
  }
  /** every tech c knows, weapon type order → rank order */
  function allTechs(c) {
    const out = [];
    for (const w of wtypes()) {
      const known = (c.techs || []).filter((id) => DB.actions[id] && DB.actions[id].wtype === w);
      known.sort((a, b) => (DB.actions[a].rank || 0) - (DB.actions[b].rank || 0) || techOrder(a) - techOrder(b));
      out.push(...known);
    }
    return out;
  }
  const TECH_ORDER = {};
  function techOrder(id) {
    if (!(id in TECH_ORDER)) { let i = 0; for (const k in DB.actions) TECH_ORDER[k] = i++; }
    return TECH_ORDER[id] ?? 1e6;
  }
  function effectiveRow(c) {
    if (has(Rl(), 'effectiveRow')) { try { return Rl().effectiveRow(c, R.Game.party) || c.row || 'front'; } catch (e) { /* fall through */ } }
    return c.row || 'front';
  }
  function spriteKey(c) {
    if (R.Party && typeof R.Party.spriteKey === 'function') { try { return R.Party.spriteKey(c); } catch (e) { /* fall through */ } }
    if (c.id === 'hero') return 'party:hero_' + (c.gender || 'm') + '_' + (c.heroType || 'warrior');
    return 'party:' + ((DB.companions[c.id] && DB.companions[c.id].sprite) || c.id);
  }
  const heroOf = () => (R.State && typeof R.State.hero === 'function' ? R.State.hero() : null) || (R.Game && R.Game.party.find((c) => c.id === 'hero')) || (R.Game && R.Game.party[0]);
  const allChars = () => (R.Game ? R.Game.party.concat(R.Game.reserve || []) : []);
  const charById = (id) => allChars().find((c) => c.id === id) || null;
  const prologueDone = () => !!(R.Game && R.Game.flags && R.Game.flags.prologue_done);
  const hasItem = (id) => !!(R.State && (typeof R.State.hasItem === 'function' ? R.State.hasItem(id) : R.State.count(id) > 0));

  /** the hero's letters of aptitude (§5.2.3/§5.2.4): type letters with the favoured field S (mages: the pair A) */
  function aptLetters(c) {
    if (has(Rl(), 'aptLetters')) { try { const a = Rl().aptLetters(c); if (a && a.w) return a; } catch (e) { /* fall through */ } }
    if (c.id !== 'hero') {
      const d = DB.companions[c.id];
      return (d && d.apt) || { w: {}, e: {} };
    }
    const t = DB.heroTypes[c.heroType] || {};
    const a = { w: Object.assign({}, (t.apt && t.apt.w) || {}), e: Object.assign({}, (t.apt && t.apt.e) || {}) };
    const f = c.favor;
    if (f && f.id) {
      if (f.kind === 'weapon') a.w[f.id] = 'S';
      else {
        a.e[f.id] = 'S';
        const pair = DB.starterKit && DB.starterKit.pair && DB.starterKit.pair[f.id];
        if (t.pairElement && pair && a.e[pair] !== 'S') a.e[pair] = 'A';
      }
    }
    return a;
  }
  /** header line 2 (§11.7.5/§11.7.6): hero 「戦士　剣が得意」, companion 肩書 (+ role) */
  function subtitle(c, withRole) {
    if (c.id === 'hero') {
      const t = DB.heroTypes[c.heroType];
      const f = c.favor;
      const fav = f && f.id ? (f.kind === 'element' ? elemName(f.id) : wtypeName(f.id)) + 'が得意' : '';
      return ((t && t.name) || '') + (fav ? '　' + fav : '');
    }
    const d = DB.companions[c.id] || {};
    return (d.title || '') + (withRole && ROLE_NAMES[d.role] ? '（' + ROLE_NAMES[d.role] + '）' : '');
  }

  // ------------------------------------------------------------ item marks & colours (§8.2.8, §11.1.2)
  function gradeOf(it) { return (it && it.grade) || 'normal'; }
  function itemMark(it) {
    if (!it) return '';
    if (it.unique) return '◆';
    const g = gradeOf(it);
    return g === 'rare' || g === 'super' ? '★' : '';
  }
  function itemColorOf(it) {
    if (!it) return '#ffffff';
    if (it.unique) return G().C.cyan;
    const g = gradeOf(it);
    return g === 'super' ? G().C.super : g === 'rare' ? G().C.rare : '#ffffff';
  }
  const iconOf = (it) => {
    if (!it) return 'icon:acc';
    if (it.icon) return String(it.icon).startsWith('icon:') ? it.icon : 'icon:' + it.icon;
    switch (it.type) {
      case 'weapon': return 'icon:' + it.wtype;
      case 'shield': case 'head': case 'body': case 'hands': case 'feet': case 'acc': return 'icon:' + it.type;
      case 'key': return 'icon:key';
      case 'consumable': {
        if (it.stone) return 'icon:el_' + it.stone;
        const e = (it.use && it.use.effects) || [];
        return e.some((x) => x.type === 'heal' || x.type === 'revive' || x.type === 'grow') ? 'icon:herb' : 'icon:potion';
      }
    }
    return 'icon:acc';
  };
  const ICON_FALLBACK = {
    'icon:dagger': 'icon:knife', 'icon:greatsword': 'icon:sword', 'icon:club': 'icon:rod', 'icon:fist': 'icon:claw', 'icon:whip': 'icon:rod',
    'icon:head': 'icon:helm', 'icon:body': 'icon:light', 'icon:hands': 'icon:acc', 'icon:feet': 'icon:acc',
  };

  // ------------------------------------------------------------ drawing kit
  const K = {
    STATS6, SLOT_NAMES, SLOT_TYPE, GEAR_TYPES, TYPE_NAMES, DIFF_KEYS, STAT_NAMES, BUFF_NAMES, WTYPE_NAMES, ELEM_NAMES, STATUS_NAMES,
    ROLE_NAMES, APT_COLOR, COL,
    ELEMS: ELEMS_DEFAULT,
    wtypes, elems, elemName, elemColor, statusName, wtypeName, raceName, itemName, actName,
    slots, slotName, slotGroup, slotsFor, isTwoHanded, holdsTwoHanded, canEquip, equipIssue, equip, stats, atkOf, statVector, previewDiff,
    cost, spellList, techList, allTechs, techOrder, effectiveRow, spriteKey, heroOf, allChars, charById, prologueDone, hasItem, aptLetters, subtitle,
    gradeOf, itemMark,

    /** 「★炎の剣」: the rarity mark (★ rare / super, ◆ one-of-a-kind reward) and the name (§8.2.8) */
    itemLabel(id) { const it = DB.items[id]; return it ? itemMark(it) + it.name : '？？？'; },
    /** colour of an item's name: レア #f8d838, 超レア #ff88d0, 一品物 cyan, else white */
    itemColor(id) { return itemColorOf(DB.items[id]); },
    /** the 8×8 icon key of an item (§8.2.8 rules; icon:acc when that art is missing, §11.3.6) */
    iconKey(it) {
      if (typeof it === 'string') it = DB.items[it];
      const k = iconOf(it);
      if (G().has(k)) return k;
      if (ICON_FALLBACK[k] && G().has(ICON_FALLBACK[k])) return ICON_FALLBACK[k];
      return G().has('icon:acc') ? 'icon:acc' : null;
    },
    drawIcon(it, x, y) {
      const k = K.iconKey(it);
      if (k) G().draw(G().get(k), x, y);
      else { G().rect(x + 1, y + 1, 6, 6, '#5a6080'); G().rect(x + 2, y + 2, 4, 4, '#9aa0c0'); }
    },
    /** element marks (icon:el_*) side by side, 8px + 1px gap each */
    drawElemIcons(list, x, y) {
      (list || []).forEach((e, i) => {
        const k = 'icon:el_' + e;
        if (G().has(k)) G().draw(G().get(k), x + i * 9, y);
        else { G().rect(x + i * 9 + 1, y + 1, 6, 6, elemColor(e)); }
      });
    },

    /** text squeezed horizontally to fit maxW; never thinner than 7px per character (§11.1.1) */
    fitText(str, x, y, maxW, opts) {
      const o = opts || {};
      const s = R.Text ? R.Text.fmt(str) : String(str);
      const w = G().textWidth(s, o.size);
      if (w <= maxW || maxW <= 0) { G().text(s, x, y, o); return w; }
      const n = Math.max(1, [...s].length);
      const k = Math.max(maxW / w, Math.min(1, (7 * n) / w));
      const c = G().ctx;
      const al = o.align || 'left';
      const dw = w * k;
      const ox = al === 'right' ? x - dw : al === 'center' ? x - dw / 2 : x;
      c.save(); c.translate(ox, y); c.scale(k, 1);
      G().text(s, 0, 0, Object.assign({}, o, { align: 'left' }));
      c.restore();
      return dw;
    },
    /** coloured segments [{text, color}] in one line, squeezed together when wider than maxW */
    drawSegs(segs, x, y, maxW, opts) {
      const o = opts || {};
      const parts = (segs || []).filter((s) => s && s.text);
      if (!parts.length) return 0;
      const ws = parts.map((s) => G().textWidth(s.text, o.size));
      const w = ws.reduce((a, b) => a + b, 0);
      const k = maxW > 0 && w > maxW ? maxW / w : 1;
      const c = G().ctx;
      c.save(); c.translate(x, y); c.scale(k, 1);
      let cx = 0;
      parts.forEach((s, i) => { G().text(s.text, cx, 0, { color: s.color || o.color || '#ffffff', size: o.size }); cx += ws[i]; });
      c.restore();
      return w * k;
    },
    /** 16×24 frame of member c (null if the art is missing) */
    sprite(c, dir, frame) {
      const key = spriteKey(c);
      if (!G().has(key)) return null;
      const s = G().get(key);
      if (!s) return null;
      if (s.getContext || (s.width && !s.down)) return s;
      const a = s[dir || 'down'] || s.down;
      return Array.isArray(a) ? a[(frame || 0) % a.length] : a || null;
    },
    /** draw member c's sprite with its top-left at (x, y); o: {frame, dir, dark, alpha, scale} */
    drawSpriteAt(c, x, y, opts) {
      const o = opts || {};
      const img = K.sprite(c, o.dir, o.frame);
      const s = o.scale || 1;
      if (img) {
        const w = img.width * s, h = img.height * s;
        const ox = x + Math.round((16 * s - w) / 2), oy = y + (24 * s - h);
        if (o.dark) {
          G().drawTinted(img, ox, oy, '#000000', o.darkAmt != null ? o.darkAmt : 0.75);
        } else G().draw(img, ox, oy, s !== 1 || o.alpha != null ? { w, h, alpha: o.alpha } : null);
        return;
      }
      // silhouette while the party art is missing (§11.1.3)
      const body = o.dark ? '#26283a' : '#6878a0', skin = o.dark ? '#30303c' : '#f0c8a0';
      G().rect(x + 5 * s, y + 3 * s, 6 * s, 6 * s, skin);
      G().rect(x + 3 * s, y + 10 * s, 10 * s, 11 * s, body);
      G().rect(x + 4 * s, y + 21 * s, 3 * s, 3 * s, body); G().rect(x + 9 * s, y + 21 * s, 3 * s, 3 * s, body);
    },
    /** the row plate on a window's lower border (§11.5.2): plate (x, y, 15, 8) in the theme's fill2, 前 orange / 中 cyan */
    rowTag(x, y, row) {
      const th = K.theme();
      G().rect(x, y, 15, 8, th.fill2 || th.fill);
      const mid = row === 'middle';
      G().text(mid ? '中' : '前', x + 2, y - 1, { color: mid ? G().C.cyan : G().C.orange });
    },
    /** a row badge inside a window (picker, shop): 前 / 中 on a dark plate */
    rowBadge(x, y, row) {
      const mid = row === 'middle';
      const col = mid ? G().C.cyan : G().C.orange;
      G().rect(x, y, 14, 13, '#0a0e20');
      G().rect(x, y, 14, 1, col); G().rect(x, y + 12, 14, 1, col);
      G().text(mid ? '中' : '前', x + 2, y + 1, { color: col });
    },
    theme() {
      const T = G().WINDOW_THEMES;
      return T[(R.Settings && R.Settings.windowColor) || 'ink'] || T.ink || T.black;
    },
    /** 「L◀ ▶R」 in grey, right-aligned at x (member switch hint, §11.7.0) */
    lrHint(x, y) { G().text('L◀ ▶R', x, y, { align: 'right', color: COL.gray }); },
    /** true once on L (−1) / R (+1) — keyboard Q/E, pad shoulders, touch L/R */
    memberStep() {
      const I = In();
      if (!I || typeof I.pressed !== 'function') return 0;
      if (I.pressed('l')) return -1;
      if (I.pressed('r')) return 1;
      return 0;
    },
    /** 5×6 pixel star (bestiary rare mark, obtained drops) */
    star(x, y, color) {
      const c = color || '#ffd24a';
      G().rect(x + 3, y, 1, 2, c); G().rect(x, y + 2, 7, 1, c); G().rect(x + 1, y + 3, 5, 1, c);
      G().rect(x + 2, y + 4, 3, 1, c); G().rect(x + 1, y + 5, 2, 1, c); G().rect(x + 4, y + 5, 2, 1, c);
    },
    /** small tick (obtained) */
    check(x, y, color) {
      const c = color || '#6ee07a';
      for (let i = 0; i < 3; i++) G().rect(x + i, y + 3 + i, 1, 1, c);
      for (let i = 0; i < 5; i++) G().rect(x + 3 + i, y + 4 - i, 1, 1, c);
    },
    /** tiny ▲ (up, green) / ▼ (down, red) */
    arrow(x, y, up) {
      const col = up ? COL.good : COL.bad;
      for (let i = 0; i < 4; i++) {
        const yy = up ? y + i : y + 3 - i;
        G().rect(x + 3 - i, yy, 1 + i * 2, 1, col);
      }
    },
    /** name colour by condition: 戦闘不能 C.dead, HP under 25% yellow, else white (§11.1.1) */
    condColor(c) {
      if (c.hp <= 0) return G().C.dead;
      const st = stats(c);
      if (st.hp && c.hp < st.hp / 4) return G().C.yellow;
      return '#ffffff';
    },
    /** the only condition shown in menus is 戦闘不能 (§11.7.0) */
    statusText(c) { return c.hp <= 0 ? { text: '戦闘不能', color: G().C.dead } : null; },
    /** '+12' / '-3' / '0' (half-width signs) */
    signed(v) { v = Math.round(v || 0); return v > 0 ? '+' + v : v < 0 ? '-' + Math.abs(v) : '0'; },
    deltaColor(v) { return v > 0 ? COL.good : v < 0 ? COL.bad : COL.zero; },
    labelNum(label, value, x, y, w, opts) {
      const o = opts || {};
      G().text(label, x, y, { color: o.labelColor || COL.sub });
      G().text(String(value), x + w, y, { align: 'right', color: o.color || '#ffffff' });
    },
    /** R.UI.say with explicit flags (a reused window would otherwise inherit noWait/auto) */
    say(text, opts) { return R.UI.say(text, Object.assign({ noWait: false, keep: false, auto: 0 }, opts)); },
    async msg(text) { await K.say(text); },
    async yesno(text) { const r = await R.UI.yesno(text); R.UI.closeMessage(); return r; },
    wrap(str, w, size) { return G().wrap(str, w, size); },
    // ---------------------------------------------------------- UI scale (BRIEF Part A11, DESIGN §11.7.0)
    /** the menu UI scale: 0.75 (設定「メニューの表示：コンパクト」, default) or 1 (大きく) */
    S() { return R.Settings && R.Settings.menuSize === 'large' ? 1 : 0.75; },
    large() { return K.S() === 1; },
    /**
     * The menu frame: every sub-screen is laid out in the 256×224 frame of the old layouts; compact mode draws
     * that frame at 0.75 (192×168 px) with its corner at (FRAME_X, FRAME_Y), so the field stays visible to the
     * right and below. → {scale, ox, oy} (R.UI.inFrame / choose / number options)
     */
    frame() { return K.large() ? { scale: 1, ox: 0, oy: 0 } : { scale: K.S(), ox: K.FRAME_X, oy: K.FRAME_Y }; },
    FRAME_X: 2, FRAME_Y: 2,
    /** draw fn() in the menu frame (layers that are not a Screen: shop, tavern) */
    inFrame(fn) { return R.UI.inFrame(K.frame(), fn); },
    /** R.UI.choose inside the menu frame (x / y / w in frame units) */
    choose(items, o) { return R.UI.choose(items, Object.assign({}, K.frame(), o || {})); },
    /** R.UI.number inside the menu frame */
    number(o) { return R.UI.number(Object.assign({}, K.frame(), o || {})); },
    /** frames-based blink */
    blink(period) { return Math.floor(R.Engine.frame / (period || 16)) % 2 === 0; },
  };
  Menu.kit = K;
  Menu.kitStar = K.star; // older callers (the bestiary used this name)
  Menu.kitArrow = K.arrow;
  Menu.previewDiff = previewDiff;

  // ------------------------------------------------------------ screen base
  /** A menu layer: input goes to input() unless an async flow is running. */
  class Screen extends R.Layer {
    constructor() { super(); this.busy = false; this.hidden = false; }
    update() { if (!this.busy && !this.closed) this.input(); }
    input() {}
    /** run an async sub-flow; input is ignored until it finishes */
    flow(fn) {
      if (this.busy) return;
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => {
        this.busy = false;
        R.Input.consume();
      });
    }
    /** where this screen draws: the menu frame (the main menu overrides it with its own compact layout) */
    frameOpts() { return K.frame(); }
    draw() { if (!this.hidden) R.UI.inFrame(this.frameOpts(), () => this.render()); }
    render() {}
  }
  K.Screen = Screen;

  /** cycle a member index by d (±1) over n */
  K.cycle = (i, d, n) => (n ? (i + (d < 0 ? n - 1 : 1)) % n : 0);

  // ------------------------------------------------------------ party picker (§11.7.0)
  // Row: height 30, sprite 16×24, name fitText 54, 「H 612/640」, 「M 28 W 55」, the row badge on the right.
  const ROW_H = 30;
  function drawMemberRow(c, x, y, w, o) {
    const ok = o.ok !== false;
    const st = stats(c);
    K.drawSpriteAt(c, x + 10, y + 3, { frame: o.anim ? Math.floor(R.Engine.frame / 16) : 0, alpha: ok ? 1 : 0.4 });
    const col = ok ? K.condColor(c) : COL.gray;
    K.fitText(c.name, x + 30, y + 2, 52, { color: col });
    G().text('H', x + 88, y + 2, { color: ok ? COL.sub : COL.gray });
    G().text(c.hp + '/' + (st.hp || 0), x + w - 8, y + 2, { align: 'right', color: col });
    G().text('M', x + 30, y + 15, { color: ok ? COL.sub : COL.gray });
    G().text(String(c.mp), x + 64, y + 15, { align: 'right', color: ok ? '#ffffff' : COL.gray });
    G().text('W', x + 70, y + 15, { color: ok ? COL.sub : COL.gray });
    G().text(String(c.wp || 0), x + 104, y + 15, { align: 'right', color: ok ? '#ffffff' : COL.gray });
    if (c.hp <= 0) G().text('戦闘不能', x + w - 8, y + 15, { align: 'right', color: G().C.dead, size: 8 });
    else K.rowBadge(x + w - 24, y + 15, effectiveRow(c));
  }
  K.drawMemberRow = drawMemberRow;
  K.MEMBER_ROW_H = ROW_H;

  class PickerLayer extends Screen {
    constructor(o) {
      super();
      this.o = o;
      this.list = o.list || R.Game.party;
      this.index = U.clamp(o.initial || 0, 0, Math.max(0, this.list.length - 1));
      if (o.valid && this.list[this.index] && !o.valid(this.list[this.index])) {
        const k = this.list.findIndex(o.valid);
        if (k >= 0) this.index = k;
      }
      this.w = o.w || 150;
      this.h = 14 + this.list.length * ROW_H;
      this.x = o.x != null ? o.x : R.W - this.w - 4;
      // y 36: the top border hides whole text rows of the lists below (rows at 38 / 40 would peek out at 40)
      this.y = o.y != null ? o.y : 36;
    }
    input() {
      const d = In().dirRepeat();
      const n = this.list.length;
      if (d === 'up' || d === 'down') {
        this.index = (this.index + (d === 'up' ? n - 1 : 1)) % n;
        R.sfx('cursor');
      }
      if (In().pressed('a')) {
        const c = this.list[this.index];
        if (this.o.valid && !this.o.valid(c)) { R.sfx('buzzer'); return; }
        if (this.o.use) {
          // repeat mode: the picker stays open on the same member after each use (A again, B back)
          const r = this.o.use(this.index) || {};
          if (r.fail) R.sfx('buzzer');
          if (r.lines && r.lines.length) { this.note = r.lines.slice(-3); this.noteFail = !!r.fail; }
          if (r.done) { this.last = r; this.close(this.index); }
          return;
        }
        R.sfx('confirm');
        this.close(this.index);
      } else if (In().pressed('b')) { R.sfx('cancel'); this.close(-1); }
    }
    render() {
      const { x, y, w, h } = this;
      const title = typeof this.o.title === 'function' ? this.o.title() : this.o.title;
      G().window(x, y, w, h, title ? { title } : undefined);
      this.list.forEach((c, i) => {
        const ry = y + 7 + i * ROW_H;
        const ok = !this.o.valid || this.o.valid(c);
        if (this.o.mark === i) G().rect(x + 4, ry - 1, w - 8, ROW_H - 2, '#2a3a74');
        drawMemberRow(c, x + 2, ry, w - 2, { ok, anim: i === this.index });
        if (i === this.index) G().cursor(x + 3, ry + 8, !this.busy);
      });
      if (this.o.info) this.o.info(x, y + h + 2);
      if (this.note) {
        const nh = 16 + this.note.length * 14 - 2;
        const ny = R.H - 4 - nh;
        G().window(4, ny, R.W - 8, nh);
        this.note.forEach((l, i) => K.fitText(l, 15, ny + 7 + i * 14, R.W - 30, { color: this.noteFail ? COL.gray : '#ffffff' }));
      }
    }
  }
  /**
   * choose a party member → index or -1. o: {title (string | fn), valid(c), initial, x, y, w, info(x,y), list,
   * mark, use(i) → {lines, fail, done}}. With `use` the picker stays open after each pick (repeat use) and
   * shows the returned lines below; it closes on B or when use() returns done.
   */
  Menu.pickMember = (o) => R.Engine.run(new PickerLayer(o || {}));

  // ------------------------------------------------------------ field effects (§7.3.5, §8.9)
  const effectsOf = (def) => (def && def.effects) || [];
  const hasType = (effects, t) => (effects || []).some((e) => e.type === t);
  const FIELD_TYPES = { heal: 1, revive: 1, healWp: 1, cure: 1, healMp: 1, grow: 1, encounter: 1, teleport: 1, exit: 1 };
  const BONUS_CAP = { hp: 200, mp: 30, wp: 30 };
  const bonusCap = (k) => ((Rl().K && Rl().K.BONUS_CAP) || BONUS_CAP)[k] ?? BONUS_CAP[k];
  /** what a spell does outside battle: fieldEffects, or the heal/revive/healWp/cure of its effects (§7.3.5) */
  function fieldEffects(a) {
    if (!a) return [];
    if (Array.isArray(a.fieldEffects)) return a.fieldEffects;
    return (a.effects || []).filter((e) => e.type === 'heal' || e.type === 'revive' || e.type === 'healWp' || e.type === 'cure');
  }
  Menu.fieldEffects = fieldEffects;
  const MNDF = (mnd) => U.clamp((128 + (mnd || 0)) / 168, 0.75, 2.2);
  /** HP a heal effect restores in the field: R.Mon.healAmount (the battle formula, §3.3.6), else §4.6.4 */
  function healAmount(user, target, eff, isItem) {
    const hm = (R.Mon && R.Mon.healAmount) || (R.Battle && R.Battle.healAmount);
    if (typeof hm === 'function') {
      try {
        const v = hm(user, target, eff, { item: isItem, field: true });
        if (typeof v === 'number' && isFinite(v)) return Math.max(0, Math.round(v));
      } catch (e) { /* fall back */ }
    }
    const max = stats(target).hp || 0;
    const um = user && has(Rl(), 'mods') ? Rl().mods(user) || {} : {};
    const k = isItem ? 1 + (um.itemPct || 0) / 100 : MNDF(user ? stats(user).mnd : 40) * (1 + (um.healPct || 0) / 100);
    return Math.max(1, Math.round(max * (eff.pct || 0) * k));
  }
  Menu.healAmount = healAmount;
  const pctOf = (max, p) => (p > 0 ? Math.max(1, Math.ceil(max * p)) : 0);

  /** would these effects change anything for c right now? (no item or MP is wasted) */
  function affects(effects, c) {
    const st = stats(c);
    for (const e of effects || []) {
      switch (e.type) {
        case 'heal': if (c.hp > 0 && c.hp < st.hp) return true; break;
        case 'healMp': if (c.hp > 0 && c.mp < st.mp) return true; break;
        case 'healWp': if (c.hp > 0 && (c.wp || 0) < st.wp) return true; break;
        case 'revive': if (c.hp <= 0) return true; break;
        case 'cure': {
          const s = c.status || {};
          if (c.hp > 0 && (e.statuses === 'all' ? Object.keys(s).some((k) => s[k]) : (e.statuses || []).some((k) => s[k]))) return true;
          break;
        }
        case 'grow': if (c.hp > 0 && ((c.bonus && c.bonus[e.stat]) || 0) < bonusCap(e.stat)) return true; break;
        default: break;
      }
    }
    return false;
  }
  Menu.affects = affects;

  /**
   * Apply the field effects of `def` ({effects|fieldEffects, target}) used by `user` on `targets`.
   * Handles heal / healMp / healWp / revive / cure / grow / encounter directly; teleport / exit are
   * reported back (they need the menu closed). o: {item:bool, id, name}
   * → {lines:[text], changed:bool, teleport?:true, exit?:true}
   */
  Menu.applyFieldEffect = function (def, user, targets, opts) {
    const o = opts || {};
    const isItem = !!o.item;
    const effects = o.effects || (def && def.fieldEffects) || effectsOf(def);
    const out = { lines: [], changed: false };
    for (const e of effects) {
      if (e.type === 'teleport') out.teleport = true;
      else if (e.type === 'exit') out.exit = true;
      else if (e.type === 'encounter') {
        R.Game.encItem = { id: o.id || null, pct: e.pct || 0, steps: e.steps || 100, weakOnly: !!e.weakOnly };
        out.lines.push(e.pct < 0 ? '魔物の気配が遠のいた。' : '魔物の気配が近づいてきた……。');
        out.changed = true;
      }
    }
    for (const c of targets || []) {
      for (const e of effects) {
        const st = stats(c);
        switch (e.type) {
          case 'heal': {
            if (c.hp <= 0 || c.hp >= st.hp) break;
            const before = c.hp;
            c.hp = Math.min(st.hp, c.hp + healAmount(user, c, e, isItem));
            out.lines.push(c.name + 'のHPが' + (c.hp - before) + '回復した！');
            out.changed = true;
            break;
          }
          case 'healMp': {
            if (c.hp <= 0 || c.mp >= st.mp) break;
            const before = c.mp;
            c.mp = Math.min(st.mp, c.mp + pctOf(st.mp, e.pct != null ? e.pct : 0));
            if (c.mp === before) break;
            out.lines.push(c.name + 'のMPが' + (c.mp - before) + '回復した！');
            out.changed = true;
            break;
          }
          case 'healWp': {
            if (c.hp <= 0 || (c.wp || 0) >= st.wp) break;
            const before = c.wp || 0;
            c.wp = Math.min(st.wp, before + pctOf(st.wp, e.pct != null ? e.pct : 0));
            if (c.wp === before) break;
            out.lines.push(c.name + 'のWPが' + (c.wp - before) + '回復した！');
            out.changed = true;
            break;
          }
          case 'revive': {
            if (c.hp > 0) break;
            c.hp = Math.max(1, Math.floor((st.hp || 1) * (e.pct != null ? e.pct : 0.35)));
            c.status = {};
            out.lines.push(c.name + 'は生き返った！');
            out.changed = true;
            break;
          }
          case 'cure': {
            if (c.hp <= 0) break;
            const s = c.status || (c.status = {});
            const list = e.statuses === 'all' ? Object.keys(s).filter((k) => !DB.statuses[k] || DB.statuses[k].bad) : e.statuses || [];
            const cured = list.filter((k) => s[k]);
            if (!cured.length) break;
            for (const k of cured) delete s[k];
            out.lines.push(c.name + 'の' + cured.map(statusName).join('・') + 'が治った。');
            out.changed = true;
            break;
          }
          case 'grow': {
            if (c.hp <= 0) break;
            const key = e.stat;
            const b = c.bonus || (c.bonus = { hp: 0, mp: 0, wp: 0 });
            const room = bonusCap(key) - (b[key] || 0);
            if (room <= 0) { out.lines.push(c.name + 'には、これ以上は効かない。'); break; }
            const s0 = stats(c)[key] || 0;
            b[key] = (b[key] || 0) + Math.min(room, e.n || 1);
            const s1 = stats(c)[key] || 0;
            const gain = Math.max(0, s1 - s0);
            if (key === 'hp') c.hp = Math.min(s1, c.hp + gain);
            else if (key === 'mp') c.mp = Math.min(s1, c.mp + gain);
            else if (key === 'wp') c.wp = Math.min(s1, (c.wp || 0) + gain);
            out.lines.push(c.name + 'の' + STAT_NAMES[key] + 'が' + (gain || Math.min(room, e.n || 1)) + '増えた！');
            out.changed = true;
            break;
          }
          default: break;
        }
      }
    }
    return out;
  };

  // ------------------------------------------------------------ use flows
  const PICK_TARGETS = { ally: 1, ally_dead: 1, ally_any: 1 };
  /** who may be picked for an item / spell target */
  function validFor(target, effects) {
    const revOnly = hasType(effects, 'revive') && effects.every((e) => e.type === 'revive');
    return (c) => {
      if (target === 'ally_dead') return c.hp <= 0;
      if (target === 'ally_any') return revOnly ? c.hp <= 0 : true;
      return c.hp > 0;
    };
  }

  /**
   * Repeat-use target picker (item or spell): stays open on the same member after each use so the
   * same thing can be used again at once (A again, B back; the list keeps its cursor, §11.7.0).
   * → true if used at least once
   */
  async function repeatPick(o) {
    const { eff, valid, user, verbLine, canPay, spend, def, isItem } = o;
    const party = R.Game.party;
    let used = false, lastLines = null, done = false;
    await Menu.pickMember({
      title: o.title, valid, initial: o.initial, x: o.x, y: o.y,
      use: (i) => {
        const c = party[i];
        if (!canPay()) return { fail: true, lines: [o.outLine || 'もう使えない。'], done: true };
        if (!affects(eff, c)) return { fail: true, lines: [c.name + 'には使っても効果がない。'] };
        spend();
        const r = Menu.applyFieldEffect(def, user, [c], { item: isItem, effects: eff, id: o.id });
        used = true;
        R.sfx(hasType(eff, 'revive') ? 'revive' : hasType(eff, 'grow') ? 'buff' : 'heal');
        lastLines = [verbLine].concat(r.lines);
        done = !canPay();
        return { lines: lastLines, done };
      },
    });
    // the last use emptied the stock / MP: show its result before going back to the list
    if (done && lastLines) await K.msg(lastLines.concat(o.outLine ? [o.outLine] : []).slice(0, 4).join('\n'));
    return used;
  }

  /** after the whole menu has closed: announce + warp / escape on the field (Menu._after, Crest's mechanism) */
  function afterMenu(fn) {
    Menu._after = async () => {
      if (R.Events && R.Events.run) await R.Events.run(async () => { await fn(); }, { self: 'menu' });
      else await fn();
    };
  }
  Menu.afterMenu = afterMenu;

  /** who uses an item in the field: the living member with the best item bonus (else the leader) */
  function itemUser() {
    const lead = (R.State && R.State.leader && R.State.leader()) || R.Game.party[0];
    let best = lead, bv = 0;
    for (const c of R.Game.party) {
      if (c.hp <= 0) continue;
      const v = (has(Rl(), 'mods') && (Rl().mods(c) || {}).itemPct) || 0;
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }
  Menu.itemUser = itemUser;

  /** can the whole party warp right now? (§11.7.1: prologue_done and not inside a dungeon) */
  const canWarp = () => prologueDone() && !!(R.Field && R.Field.canTeleport && R.Field.canTeleport());
  const canEscape = () => prologueDone() && !!(R.Field && R.Field.canExit && R.Field.canExit());
  Menu.canWarp = canWarp;
  Menu.canEscape = canEscape;

  /**
   * Field use of an inventory item. Returns 'exit' when the menu must close (warp / escape),
   * true when something was used, false otherwise.
   */
  Menu.useItem = async function (id) {
    const it = DB.items[id];
    const u = it && it.use;
    if (it && it.type === 'key') {
      const e = (u && u.effects) || [];
      if (hasType(e, 'teleport')) return (await Menu.warpFlow({ item: id })) ? 'exit' : false;
      if (hasType(e, 'exit')) return (await Menu.escapeFlow({ item: id })) ? 'exit' : false;
      await K.msg(it.name + 'は大切にしまってある。');
      return false;
    }
    if (!u || !u.field || !(u.effects || []).length) { R.sfx('buzzer'); await K.msg('今は使えない。'); return false; }
    const lead = itemUser();
    const eff = u.effects;
    const verb = lead.name + 'は' + it.name + 'を使った！';
    if (!PICK_TARGETS[u.target]) {
      const targets = u.target === 'self' && !hasType(eff, 'encounter') ? [lead] : u.target === 'self' ? [] : R.Game.party.slice();
      if (!hasType(eff, 'encounter') && !targets.some((c) => affects(eff, c))) { R.sfx('buzzer'); await K.msg('使っても効果がない。'); return false; }
      R.State.removeItem(id, 1);
      const r = Menu.applyFieldEffect(u, lead, targets, { item: true, id });
      R.sfx(hasType(eff, 'encounter') ? 'item' : hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg([verb].concat(r.lines).slice(0, 8).join('\n'));
      return true;
    }
    const valid = validFor(u.target, eff);
    const first = R.Game.party.findIndex((c) => valid(c) && affects(eff, c));
    if (first < 0) { R.sfx('buzzer'); await K.msg('使っても効果がない。'); return false; }
    return repeatPick({
      eff, valid, user: lead, def: u, isItem: true, initial: first, id,
      title: () => K.itemLabel(id) + '　×' + R.State.count(id),
      verbLine: verb,
      canPay: () => R.State.count(id) > 0,
      spend: () => R.State.removeItem(id, 1),
      outLine: it.name + 'はもう無い。',
    });
  };

  /** why c cannot cast spell id in the field right now → '' | reason (STYLE_JA §9) */
  Menu.spellBlock = function (c, id) {
    const a = DB.actions[id];
    if (!a || a.kind !== 'spell' || !a.field) return '今は使えない。';
    if (c.hp <= 0) return '今は使えない。';
    if (has(Rl(), 'mods') && (Rl().mods(c) || {}).noSpell) return '今は使えない。';
    if (c.mp < cost(c, id)) return 'MPが足りない！';
    return '';
  };

  /** field use of spell id by c → 'exit' | true | false (§7.3.5) */
  Menu.useSpell = async function (c, id) {
    const a = DB.actions[id];
    const block = Menu.spellBlock(c, id);
    if (block) { R.sfx('buzzer'); await K.msg(block); return false; }
    const mp = cost(c, id);
    const eff = fieldEffects(a);
    if (!eff.length) { R.sfx('buzzer'); await K.msg('今は使えない。'); return false; }
    const verb = c.name + 'は' + a.name + 'を唱えた！';
    const encOnly = eff.every((e) => e.type === 'encounter');
    if (encOnly || !PICK_TARGETS[a.target]) {
      let targets = [];
      if (!encOnly) targets = a.target === 'self' ? [c] : a.target === 'party' ? R.Game.party.slice() : R.Game.party.filter((t) => t.hp > 0);
      if (!encOnly && !targets.some((t) => affects(eff, t))) { R.sfx('buzzer'); await K.msg('使っても効果がない。'); return false; }
      c.mp -= mp;
      const r = Menu.applyFieldEffect(a, c, targets, { effects: eff, id });
      R.sfx(encOnly ? 'magic' : hasType(eff, 'revive') ? 'revive' : 'heal');
      await K.msg([verb].concat(r.lines).slice(0, 8).join('\n'));
      return true;
    }
    const valid = validFor(a.target, eff);
    // start on whoever needs it most (the lowest HP share for heals, the first fallen one for revives)
    const need = R.Game.party.map((t, i) => [t, i]).filter(([t]) => valid(t) && affects(eff, t))
      .sort((p, q) => p[0].hp / (stats(p[0]).hp || 1) - q[0].hp / (stats(q[0]).hp || 1));
    if (!need.length) { R.sfx('buzzer'); await K.msg('使っても効果がない。'); return false; }
    return repeatPick({
      eff, valid, user: c, def: a, isItem: false, initial: need[0][1], id,
      title: () => a.name + '　M' + mp,
      verbLine: verb,
      canPay: () => c.hp > 0 && c.mp >= mp,
      spend: () => { c.mp -= mp; },
      outLine: mp ? c.name + 'はMPが足りなくなった。' : '',
    });
  };

  // ------------------------------------------------------------ ワープ・脱出 (§11.7.12)
  /** visited warp targets [{id, name, kind, region}] in DB.locations order (R.Field.teleportList, §3.3.10) */
  function warpList() {
    const raw = (R.Field && R.Field.teleportList ? R.Field.teleportList() : Object.keys(DB.locations).filter((id) => R.Game.visited[id]).map((id) => ({ id })));
    return raw.filter((l) => DB.locations[l.id] || l.name).map((l) => {
      const d = DB.locations[l.id] || {};
      return { id: l.id, name: l.name || d.name || l.id, kind: l.kind || d.kind || (d.dungeon ? 'dungeon' : 'town'), region: l.region || d.region || '' };
    });
  }
  Menu.warpList = warpList;
  /** the name of a warp group (DB.config.warpGroups, else the region's name) */
  function groupName(region) {
    const wg = DB.config && DB.config.warpGroups;
    if (wg && wg[region]) return wg[region];
    return (DB.regions[region] && DB.regions[region].name) || '';
  }
  Menu.warpGroupName = groupName;
  /** the label of a warp row: towns as they are, dungeons 「〈名前〉の入口」 */
  const warpLabel = (l) => (l.kind === 'dungeon' ? l.name + 'の入口' : l.name);
  Menu.warpLabel = warpLabel;

  class WarpScreen extends Screen {
    constructor(list) {
      super();
      this.items = list;
      // the window (4,4,248,198) is drawn here with its title (§11.7.12: 13 rows of 14); the list covers only
      // the place column (x 100, w 152) so its scroll arrows sit at x 176, clear of the title plate. The cursor
      // stays just before the place name (x 98 − 10) and the region name is drawn in the gutter at x 16
      // (squeezed to 70px so it never runs into the cursor).
      this.list = new R.UI.List({
        x: 100, y: 4, w: 152, h: 198, rows: 13, lineH: 14, padX: -2, padY: 8, window: false, wrap: true, colW: 150,
        items: list.map((l) => ({ label: warpLabel(l), l })),
        drawItem: (row, x, y, w, i) => this.drawRow(row, x, y, i),
      });
    }
    input() {
      const r = this.list.update();
      if (r === 'cancel') this.close(null);
      else if (r === 'select') this.close(this.list.item.l.id);
    }
    drawRow(row, x, y, i) {
      const l = row.l;
      const prev = this.items[i - 1];
      // the region name on the first row of each group, and on the top row after scrolling
      if (!prev || prev.region !== l.region || i === this.list.top) K.fitText(groupName(l.region), 16, y, 70, { color: G().C.cyan });
      K.fitText(warpLabel(l), x + 2, y, 144, { color: l.kind === 'dungeon' ? COL.sub : '#ffffff' });
    }
    render() {
      G().window(4, 4, 248, 198, { title: 'どこへ行く？' });
      this.list.draw();
    }
  }
  Menu.chooseWarp = async function () {
    const list = warpList();
    if (!list.length) { R.sfx('buzzer'); await K.msg('飛んでいける場所がない！'); return null; }
    return R.Engine.run(new WarpScreen(list));
  };

  /** ワープ (command or 語り部の羽ペン) → true when the menu must close and the warp runs */
  Menu.warpFlow = async function () {
    if (!canWarp()) { R.sfx('buzzer'); await K.msg('ここでは使えない。'); return false; }
    const id = await Menu.chooseWarp();
    if (!id) return false;
    afterMenu(async () => {
      R.sfx('quill');
      await R.Engine.wait(24);
      if (R.Field && R.Field.teleport) await R.Field.teleport(id);
    });
    return true;
  };
  /** 脱出 (command or 帰り道の鈴) → true when the menu must close and the escape runs */
  Menu.escapeFlow = async function () {
    if (!canEscape()) { R.sfx('buzzer'); await K.msg('ここでは使えない。'); return false; }
    if (!(await K.yesno('ダンジョンから脱出しますか？'))) return false;
    afterMenu(async () => {
      R.sfx('bell');
      await R.Engine.wait(30);
      if (R.Field && R.Field.exitDungeon) await R.Field.exitDungeon();
    });
    return true;
  };

  // ------------------------------------------------------------ 満タン (§11.7.4, Part A2)
  const missing = (c) => (c.hp > 0 ? Math.max(0, (stats(c).hp || 0) - c.hp) : 0);
  const HEAL_TARGETS = { ally: 1, ally_any: 1, self: 1, allies: 1, party: 1 };
  /** a field spell that only heals HP (no revive in it) */
  const healSpell = (a) => {
    if (!a || !a.field || !HEAL_TARGETS[a.target]) return false;
    const e = fieldEffects(a);
    return e.some((x) => x.type === 'heal') && e.every((x) => x.type === 'heal' || x.type === 'cure' || x.type === 'healWp');
  };
  const reviveSpell = (a) => !!(a && a.field && (a.target === 'ally_dead' || a.target === 'ally_any' || a.target === 'party') && fieldEffects(a).some((x) => x.type === 'revive'));
  /** cheap single-target items for 満タン: not rare, not for everyone (Part A2) */
  function mantanItems(kind) {
    const ok = (it) => it && it.type === 'consumable' && gradeOf(it) === 'normal' && !it.unique && it.use && it.use.field &&
      (kind === 'revive' ? it.use.target === 'ally_dead' || it.use.target === 'ally_any' : it.use.target === 'ally') &&
      (kind === 'revive' ? (it.use.effects || []).some((e) => e.type === 'revive') : (it.use.effects || []).some((e) => e.type === 'heal') && (it.use.effects || []).every((e) => e.type === 'heal'));
    return Object.keys(R.Game.inv || {}).filter((id) => R.State.count(id) > 0 && ok(DB.items[id]))
      .sort((a, b) => (DB.items[a].price || 0) - (DB.items[b].price || 0) || (a < b ? -1 : 1));
  }
  const expectHeal = (def, user, t, isItem, eff) => {
    let n = 0;
    for (const e of eff || fieldEffects(def)) if (e.type === 'heal') n += healAmount(user, t, e, isItem);
    return n;
  };

  /**
   * Heal the whole party as cheaply as possible (the 満タン command).
   * Spells: revive the fallen (cheapest revive spell), then HP by the best HP per MP (ties → the caster
   * with the most MP left). Items (o.items, asked first): the cheapest revive item for the fallen, then the
   * cheapest single-target heal that covers the gap (else the biggest). Rare and all-party items are never used.
   * → log {spells:{id:{n, mp}}, items:{id:n}, revived:[names]}
   */
  Menu.autoHeal = function (o) {
    const opts = o || {};
    const log = opts.log || { spells: {}, items: {}, revived: [] };
    const party = R.Game.party;
    const alive = () => party.filter((c) => c.hp > 0);
    const noteSpell = (id, mp) => { const e = log.spells[id] || (log.spells[id] = { n: 0, mp: 0 }); e.n++; e.mp += mp; };
    const known = (c, pred) => (c.spells || []).filter((id) => pred(DB.actions[id]) && !Menu.spellBlock(c, id));
    if (!opts.items) {
      for (let guard = 0; guard < 400; guard++) {
        // 1) the fallen, with the cheapest revive spell anyone living can pay for
        const dead = party.filter((c) => c.hp <= 0);
        if (dead.length) {
          let best = null;
          for (const c of alive()) for (const id of known(c, reviveSpell)) {
            const mp = cost(c, id);
            if (!best || mp < best.mp || (mp === best.mp && c.mp > best.c.mp)) best = { c, id, mp };
          }
          if (best) {
            const a = DB.actions[best.id];
            const tg = a.target === 'party' ? dead : [dead[0]];
            best.c.mp -= best.mp;
            Menu.applyFieldEffect(a, best.c, a.target === 'party' ? party.slice() : tg, { effects: fieldEffects(a) });
            noteSpell(best.id, best.mp);
            for (const t of tg) if (t.hp > 0 && !log.revived.includes(t.name)) log.revived.push(t.name);
            continue;
          }
        }
        // 2) HP by efficiency
        const need = alive().filter((c) => missing(c) > 0);
        if (!need.length) break;
        let best = null;
        for (const c of alive()) {
          for (const id of known(c, healSpell)) {
            const a = DB.actions[id], mp = cost(c, id);
            const sets = a.target === 'allies' || a.target === 'party' ? [alive()] : a.target === 'self' ? [[c]] : need.map((t) => [t]);
            for (const tg of sets) {
              const gain = tg.reduce((s, t) => s + Math.min(expectHeal(a, c, t, false), missing(t)), 0);
              if (gain <= 0) continue;
              const v = gain / Math.max(mp, 0.5);
              if (!best || v > best.v * 1.05 || (v > best.v / 1.05 && (c.mp > best.c.mp || (c === best.c && gain > best.gain)))) best = { c, id, tg, v, gain, mp };
            }
          }
        }
        if (!best) break;
        best.c.mp -= best.mp;
        Menu.applyFieldEffect(DB.actions[best.id], best.c, best.tg, { effects: fieldEffects(DB.actions[best.id]) });
        noteSpell(best.id, best.mp);
      }
      return log;
    }
    const user = itemUser();
    for (let guard = 0; guard < 400; guard++) {
      const dead = party.find((c) => c.hp <= 0);
      if (dead) {
        const ids = mantanItems('revive');
        if (ids.length) {
          R.State.removeItem(ids[0], 1);
          Menu.applyFieldEffect(DB.items[ids[0]].use, user, [dead], { item: true });
          log.items[ids[0]] = (log.items[ids[0]] || 0) + 1;
          if (dead.hp > 0 && !log.revived.includes(dead.name)) log.revived.push(dead.name);
          continue;
        }
      }
      const need = alive().filter((c) => missing(c) > 0).sort((a, b) => missing(b) - missing(a));
      if (!need.length) break;
      const t = need[0], gap = missing(t);
      const cands = mantanItems('heal').map((id) => ({ id, h: expectHeal(DB.items[id].use, user, t, true, DB.items[id].use.effects), p: DB.items[id].price || 0 }));
      if (!cands.length) break;
      const cover = cands.filter((x) => x.h >= gap).sort((a, b) => a.p - b.p || a.h - b.h);
      const pick = cover[0] || cands.slice().sort((a, b) => b.h - a.h || a.p - b.p)[0];
      R.State.removeItem(pick.id, 1);
      Menu.applyFieldEffect(DB.items[pick.id].use, user, [t], { item: true });
      log.items[pick.id] = (log.items[pick.id] || 0) + 1;
    }
    return log;
  };

  const partyHurt = () => R.Game.party.some((c) => c.hp <= 0 || missing(c) > 0);
  /** 満タン command: spells first, items only when the player agrees; then the result window */
  Menu.fullHeal = async function () {
    if (!partyHurt()) { await K.msg('回復の必要はない。'); return false; }
    const log = Menu.autoHeal();
    const casts = Object.keys(log.spells).length;
    if (casts) R.sfx('heal');
    if (partyHurt()) {
      const dead = R.Game.party.some((c) => c.hp <= 0);
      const any = mantanItems('heal').length || (dead && mantanItems('revive').length);
      if (any) {
        const why = casts ? '術だけでは回復しきれなかった。' : '回復の術を使える人がいない。';
        if (await K.yesno(why + '\n道具も使いますか？')) {
          const before = JSON.stringify(log.items);
          Menu.autoHeal({ items: true, log });
          if (JSON.stringify(log.items) !== before) R.sfx('heal');
        }
      }
    }
    await R.Engine.run(new MantanLayer(log));
    return casts > 0 || Object.keys(log.items).length > 0;
  };

  /** result lines of 満タン: 「ひだまり　×3（MP 9）」「傷薬　×2」 and the last line */
  Menu.mantanLines = function (log) {
    const lines = [];
    for (const id of Object.keys(log.spells)) lines.push({ text: actName(id) + '　×' + log.spells[id].n + '（MP ' + log.spells[id].mp + '）', color: '#ffffff' });
    for (const id of Object.keys(log.items)) lines.push({ text: itemName(id) + '　×' + log.items[id], color: '#ffffff' });
    if (!lines.length) lines.push({ text: '何も使わなかった。', color: COL.gray });
    const left = R.Game.party.filter((c) => c.hp <= 0 || missing(c) > 0).map((c) => c.name);
    const last = left.length ? { text: 'まだ傷ついている人：' + left.join('・'), color: G().C.yellow } : { text: '全員元気になった。', color: G().C.green };
    return { lines, last };
  };

  class MantanLayer extends Screen {
    constructor(log) {
      super();
      const r = Menu.mantanLines(log);
      this.lines = r.lines.length > 6 ? r.lines.slice(0, 5).concat([{ text: 'ほか ' + (r.lines.length - 5) + '件', color: COL.sub }]) : r.lines;
      this.last = r.last;
    }
    input() { if (In().pressed('a') || In().pressed('b')) { R.sfx('confirm'); this.close(); } }
    render() {
      const x = 24, y = 56, w = 208, h = 112;
      G().window(x, y, w, h, { title: '満タン' });
      this.lines.forEach((l, i) => K.fitText(l.text, x + 12, y + 9 + i * 14, w - 24, { color: l.color }));
      G().rect(x + 8, y + h - 27, w - 16, 1, '#50587c');
      K.fitText(this.last.text, x + 12, y + h - 22, w - 24, { color: this.last.color });
      if (K.blink(20)) G().moreArrow(x + w - 14, y + h - 9);
    }
  }

  // ------------------------------------------------------------ main menu (§11.7.1)
  const COMMANDS = [
    { id: 'items', label: '道具' }, { id: 'arts', label: '技・術' },
    { id: 'fullheal', label: '満タン' }, { id: 'equip', label: '装備' },
    { id: 'status', label: '強さ' }, { id: 'order', label: '並びと隊列' },
    { id: 'techbook', label: '技の書' }, { id: 'spellbook', label: '術の書' },
    { id: 'book', label: '図鑑' }, { id: 'chronicle', label: '年代記' },
    { id: 'map', label: '地図' }, { id: 'warp', label: 'ワープ' },
    { id: 'escape', label: '脱出' }, { id: 'party', label: '仲間' },
    { id: 'save', label: 'セーブ' }, { id: 'settings', label: '設定' },
  ];
  Menu.COMMANDS = COMMANDS;
  const onWorld = () => !!(R.Field && R.Field.map && R.Field.map.isWorld);
  /** the world map has been walked on at least once (the 地図 command) */
  const worldSeen = () => onWorld() || !!(R.Game.vars && R.Game.vars.menu_world_seen) || Object.keys(R.Game.visited || {}).length >= 2;
  /** is a command usable right now? (§11.7.1 table; unusable ones stay in place, grey) */
  function commandOk(id) {
    const party = R.Game.party;
    switch (id) {
      case 'arts': return party.some((c) => (c.techs || []).some((t) => DB.actions[t]) || (c.spells || []).some((s) => DB.actions[s]));
      case 'chronicle': return hasItem('k_chronicle') && typeof Menu.chronicleScreen === 'function';
      case 'map': return worldSeen() && !!(R.Minimap && R.Minimap.open);
      case 'warp': return canWarp();
      case 'escape': return canEscape();
      case 'party': return !!(R.Party && typeof R.Party.canSwapHere === 'function' && R.Party.canSwapHere() && R.Tavern && R.Tavern.open);
      default: return true;
    }
  }
  Menu.commandOk = commandOk;
  let lastCmd = 0;

  // compact main menu (BRIEF A11, §11.7.1 Part A11 版), in the virtual screen of the 0.75 scale (341×298):
  // one slim command column on the left, 4 party cards and the gold window to its right, the objective strip below.
  const CM = { x: 6, y: 6, w: 84, lineH: 12, card: { x: 92, w: 164, h: 34, pitch: 36 }, gold: { h: 60 }, obj: { h: 36 } };
  CM.h = 12 + COMMANDS.length * CM.lineH - 2; // 202
  class MainMenu extends Screen {
    constructor() {
      super();
      this.items = COMMANDS.map((c) => ({ label: c.label, disabled: !commandOk(c.id) }));
      this.build(lastCmd);
    }
    /** the command list for the current size (設定「メニューの表示」 may change while the menu is open) */
    build(index) {
      this.large = K.large();
      this.list = this.large
        ? new R.UI.List({ x: 4, y: 4, w: 128, cols: 2, rows: 8, lineH: 14, padX: 16, padY: 8, colW: 55, index, items: this.items, onChange: (i) => { lastCmd = i; } })
        : new R.UI.List({ x: CM.x, y: CM.y, w: CM.w, h: CM.h, cols: 1, rows: COMMANDS.length, lineH: CM.lineH, padX: 16, padY: 6, index, items: this.items, onChange: (i) => { lastCmd = i; } });
    }
    frameOpts() { return this.large ? { scale: 1 } : { scale: K.S() }; }
    refresh() {
      if (this.large !== K.large()) this.build(this.list.index);
      this.list.items.forEach((it, i) => { it.disabled = !commandOk(COMMANDS[i].id); });
    }
    input() {
      const r = this.list.update();
      if (r === 'cancel') this.close();
      else if (r === 'select') {
        const cmd = COMMANDS[this.list.index].id;
        lastCmd = this.list.index;
        this.flow(() => this.run(cmd));
      }
    }
    async run(cmd) {
      const screens = {
        items: Menu.itemScreen, arts: Menu.spellScreen, equip: Menu.equipScreen, status: Menu.statusScreen,
        order: Menu.orderScreen, book: Menu.bookScreen, chronicle: Menu.chronicleScreen, save: Menu.saveScreen, settings: Menu.settings,
        techbook: Menu.skillBookScreen && (() => Menu.skillBookScreen({ kind: 'tech' })),
        spellbook: Menu.skillBookScreen && (() => Menu.skillBookScreen({ kind: 'spell' })),
      };
      try {
        if (cmd === 'fullheal') { await Menu.fullHeal(); return; }
        if (cmd === 'warp') { if (await Menu.warpFlow()) this.close('exit'); return; }
        if (cmd === 'escape') { if (await Menu.escapeFlow()) this.close('exit'); return; }
        if (cmd === 'map') {
          this.hidden = true;
          try { await R.Minimap.open(); } finally { this.hidden = false; }
          return;
        }
        if (cmd === 'party') {
          this.hidden = true;
          try { await R.Tavern.open({ recruit: false }); } finally { this.hidden = false; }
          return;
        }
        const fn = screens[cmd];
        if (typeof fn !== 'function') { R.sfx('buzzer'); return; }
        this.hidden = true;
        let res;
        try { res = await fn({ fromMenu: true }); } finally { this.hidden = false; }
        if (res === 'exit' || Menu._after) this.close('exit');
      } finally { if (!this.closed) this.refresh(); }
    }
    render() {
      this.list.draw();
      if (this.large) {
        drawGold(4, 134, 128);
        drawParty(134, 4);
        drawObjective(4, 184, 248);
        return;
      }
      const cd = CM.card;
      R.Game.party.slice(0, 4).forEach((c, i) => drawMemberCard(c, cd.x, CM.y + cd.pitch * i, cd.w, cd.h));
      const gy = CM.y + CM.h - CM.gold.h;
      drawGold(cd.x, gy, cd.w, CM.gold.h);
      drawObjective(CM.x, CM.y + CM.h + 4, cd.x + cd.w - CM.x, CM.obj.h);
    }
  }
  Menu.MainMenu = MainMenu;

  /** 第N章 / 序章 / 終章 for the gold window and the save slots (N = tier; 終章 after game_clear) */
  function chapterLabel(g) {
    g = g || R.Game;
    if (g.gameClear || (g.flags && g.flags.game_clear)) return '終章';
    const t = g.tier || (g.regionsCleared || []).length;
    return t > 0 ? '第' + t + '章' : '序章';
  }
  Menu.chapterLabel = chapterLabel;

  function drawGold(x, y, w, h) {
    const title = R.Game.title;
    h = h || 46;
    G().window(x, y, w, h, title ? { title } : undefined);
    // 3 rows, centred in the window (pitch 12 in the 46 window, 14 in taller ones)
    const pitch = h >= 56 ? 14 : 12, top = y + Math.round((h - pitch * 2 - 11) / 2);
    const pad = h >= 56 ? 12 : 10;
    K.labelNum('ゴールド', R.Game.gold, x + pad, top, w - pad * 2);
    K.labelNum('時間', U.playTime(R.Game.playFrames || 0), x + pad, top + pitch, w - pad * 2);
    K.labelNum('年代記', chapterLabel(), x + pad, top + pitch * 2, w - pad * 2);
  }
  Menu.drawGold = drawGold;

  /** one member window of the main menu (§11.7.1): (x, y, 118, 43) */
  function drawMemberWindow(c, x, y) {
    G().window(x, y, 118, 43);
    const col = K.condColor(c);
    const st = stats(c);
    K.drawSpriteAt(c, x + 6, y + 10, { frame: 0 });
    K.fitText(c.name, x + 26, y + 6, 54, { color: col });
    G().text('Lv' + c.level, x + 110, y + 6, { align: 'right', color: col });
    G().text('H', x + 26, y + 18, { color: col === '#ffffff' ? COL.sub : col });
    // a fallen member reads 「戦闘不能」 in place of 0/最大 (a plate on the lower border would cover the W value)
    G().text(c.hp <= 0 ? '戦闘不能' : c.hp + '/' + (st.hp || 0), x + 110, y + 18, { align: 'right', color: col });
    G().text('M', x + 26, y + 29, { color: COL.sub });
    G().text(String(c.mp), x + 58, y + 29, { align: 'right' });
    G().text('W', x + 66, y + 29, { color: COL.sub });
    G().text(String(c.wp || 0), x + 110, y + 29, { align: 'right' });
    K.rowTag(x + 4, y + 36, effectiveRow(c));
  }
  Menu.drawMemberWindow = drawMemberWindow;
  /**
   * a compact party card (main menu, Part A11): (x, y, w≈164, h 34), 2 lines beside the sprite:
   *   [絵] 名前                H 999/999
   *        前 Lv34   M 150    W  99
   */
  function drawMemberCard(c, x, y, w, h) {
    G().window(x, y, w, h);
    const col = K.condColor(c);
    const st = stats(c);
    const R1 = x + w - 10; // right edge of the values
    K.drawSpriteAt(c, x + 6, y + Math.round((h - 24) / 2), { frame: 0, alpha: c.hp <= 0 ? 0.55 : 1 });
    K.fitText(c.name, x + 27, y + 6, 66, { color: col });
    G().text('H', R1 - 46, y + 6, { color: col === '#ffffff' ? COL.sub : col });
    G().text(c.hp <= 0 ? '戦闘不能' : c.hp + '/' + (st.hp || 0), R1, y + 6, { align: 'right', color: col });
    const ly = y + 19;
    K.rowBadge(x + 26, ly - 1, effectiveRow(c));
    G().text('Lv' + c.level, x + 44, ly, { color: '#ffffff' });
    G().text('M', R1 - 82, ly, { color: COL.sub });
    G().text(String(c.mp), R1 - 54, ly, { align: 'right' });
    G().text('W', R1 - 46, ly, { color: COL.sub });
    G().text(String(c.wp || 0), R1, ly, { align: 'right' });
  }
  Menu.drawMemberCard = drawMemberCard;
  function drawParty(x, y) {
    R.Game.party.slice(0, 4).forEach((c, i) => drawMemberWindow(c, x, y + 44 * i));
  }
  Menu.drawParty = drawParty;

  /** the objective to show (§10.13.8): the region's own while in an uncleared region, else the global one */
  function objectiveId() {
    const g = R.Game;
    const map = R.Field && R.Field.map;
    const region = map && ((map.def && map.def.region) || map.region);
    const cleared = region && (g.regionsCleared || []).includes(region);
    if (region && !cleared && g.regionObj && g.regionObj[region] && DB.objectives[g.regionObj[region]]) return g.regionObj[region];
    return g.objective;
  }
  Menu.objectiveId = objectiveId;
  function objectiveText(id) {
    const o = id && DB.objectives && DB.objectives[id];
    if (!o || !o.text) return '';
    const t = R.Game.tier || 0;
    return String(o.text).replace(/\{left\}/g, String(Math.max(0, 8 - t))).replace(/\{cleared\}/g, String(t));
  }
  Menu.objectiveText = objectiveText;
  function drawObjective(x, y, w, h) {
    const t = objectiveText(objectiveId());
    h = h || 36;
    G().window(x, y, w, h, { title: '次の目的' });
    if (!t) return;
    let lines = String(t).split('\n');
    const pad = h > 36 ? 12 : 10;
    if (lines.length === 1) lines = G().wrap(t, w - pad * 2);
    const top = y + Math.round((h - 36) / 2);
    lines.slice(0, 2).forEach((l, i) => K.fitText(l, x + pad, top + 7 + i * 14, w - pad * 2));
  }
  Menu.drawObjective = drawObjective;

  // ------------------------------------------------------------ public API
  let opened = null; // the live MainMenu layer
  /** open the field menu (Y on the field); resolves when it closes (and after a deferred warp / escape) */
  Menu.open = async function () {
    if ((opened && R.Engine.layers.includes(opened)) || !R.Game) return;
    Menu._after = null;
    R.sfx('menu_open');
    const L = (opened = new MainMenu());
    try {
      await R.Engine.run(L);
    } finally { if (opened === L) opened = null; }
    const after = Menu._after;
    Menu._after = null;
    if (after) await after();
  };
  Menu.isOpen = () => !!(opened && R.Engine.layers.includes(opened));

  // the 地図 command needs "the world has been walked on once" (§11.7.1): remember it in a menu var
  R.onBoot(() => {
    if (typeof R.on !== 'function') return;
    R.on('mapload', (id) => {
      const d = DB.maps[id];
      if (R.Game && d && (d.type === 'world' || id === 'world')) (R.Game.vars || (R.Game.vars = {})).menu_world_seen = 1;
    });
  });
})(window.RPG);
