// 主人公の作成（担当 newgame A6。DESIGN §5.2・§11.8.2）。
// 性別 → タイプ → 得意分野 → 名前（R.NameEntry）→ 確認 の 5 段。どの段でも B で 1 つ前の段へ。
//
//   const spec = await R.CharCreate.run({cancel = true, initial?});   // {name, gender, type, favor:{kind, id}} | null
//   R.CharCreate.previewApt(type, favor) → {w:{…}, e:{…}}（得意分野で上書きした後の S〜D。§5.2.7 と同じ規則）
//   R.CharCreate.favorOptions(type) → [{kind, id}]      R.CharCreate.heroRow(type, favor) → 'front'|'middle'
//   R.CharCreate.favorLines(type, favor) → 右の窓の行      R.CharCreate.kit … 酒場と共用の描き方（得手不得手の行・絵・札）
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const DB = R.DB;

  // ------------------------------------------------------------ shared kit (tavern.js also uses it)
  const W = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const E = ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const WN = { sword: '剣', greatsword: '大剣', dagger: '短剣', axe: '斧', spear: '槍', bow: '弓', club: '棍棒', staff: '杖', katana: '刀', fist: '体術', whip: '鞭' };
  const EN = { fire: '火', water: '水', wind: '風', earth: '土', light: '光', dark: '闇' };
  const EC = { fire: '#ff7038', water: '#48a8ff', wind: '#68dc88', earth: '#c89850', light: '#fff0a0', dark: '#a068e0' };
  const APT = { S: '#ffd24a', A: '#6ee07a', B: '#ffffff', C: '#a0a0a8', D: '#707080' };
  const STATS = ['str', 'vit', 'dex', 'agi', 'int', 'mnd'];
  const STAT_NAMES = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const ROLE_NAMES = { guard: '前衛・重', striker: '前衛・軽', ranged: '後列・武器', caster: '術・攻め', healer: '術・癒やし', hybrid: '武器と術' };
  const ROW_NAMES = { front: '前列', middle: '後列' };
  const REACH_ANY = { spear: 1, bow: 1, whip: 1 };
  // names used until the item / action owners have registered theirs (DESIGN §5.1.2〜§5.1.4)
  const ITEM_NAMES = {
    w_sword_iron: '鉄の剣', w_greatsword_iron: '鉄の大剣', w_dagger_iron: '鉄の短剣', w_axe_hand: '手斧', w_spear_iron: '鉄の槍',
    w_bow_short: '短弓', w_club_wood: '木の棍棒', w_staff_novice: '見習いの杖', w_katana_uchi: '打ち刀', w_fist_leather: '革の拳当て',
    w_whip_leather: '革の鞭', bd_iron_cuirass: '鉄の胸当て', hd_iron_band: '鉄の額当て', sh_iron_buckler: '鉄の小盾',
    bd_leather_vest: '革の胴着', hd_leather_cap: '革の帽子', sh_leather: '革の盾', bd_hemp_robe: '麻の法衣', hd_wool_hood: '毛織りの頭巾',
    sh_primer: '術の手引き',
  };
  const ACTION_NAMES = {
    t_sword_stepcut: '踏み込み斬り', t_greatsword_overhead: '大上段', t_dagger_vital: '急所ねらい', t_axe_cleave: 'たたき割り',
    t_spear_upthrust: '突き上げ', t_bow_rapid: '速射', t_club_smash: '強打', t_staff_mind: '念じ打ち', t_katana_draw: '抜き打ち',
    t_fist_palm: '掌打', t_whip_trip: '足からめ', s_fire_1: '火の矢', s_water_1: '水の刃', s_wind_1: '風切り', s_earth_1: '石つぶて',
    s_light_1: 'ひだまり', s_dark_1: '影ばり',
  };
  // Crest icons that stand in until art-chars registers the new ones (DESIGN §11.3.6)
  const ICON_ALT = { dagger: 'knife', greatsword: 'sword', club: 'rod', fist: 'claw', whip: 'rod' };

  const kit = {
    W, E, APT, STATS, STAT_NAMES, ROLE_NAMES, ROW_NAMES,
    wname: (w) => (DB.weaponTypes[w] && DB.weaponTypes[w].name) || WN[w] || w,
    ename: (e) => (DB.elements[e] && DB.elements[e].name) || EN[e] || e,
    ecolor: (e) => (DB.elements[e] && DB.elements[e].color) || EC[e] || '#ffffff',
    aptColor: (l) => ((R.Menu && R.Menu.kit && R.Menu.kit.APT_COLOR) || APT)[l] || APT[l] || '#ffffff',
    itemName: (id) => (id && DB.items[id] && DB.items[id].name) || ITEM_NAMES[id] || '――',
    actionName: (id) => (DB.actions[id] && DB.actions[id].name) || ACTION_NAMES[id] || id,
    heroKey: (g, type) => 'party:hero_' + (g === 'f' ? 'f' : 'm') + '_' + type,
    defKey(id) { const d = DB.companions[id]; return 'party:' + ((d && d.sprite) || id); },
    /** the sprite key of a CharState (always via R.Party.spriteKey when rules has it) */
    charKey(c) {
      if (R.Party && R.Party.spriteKey) { try { return R.Party.spriteKey(c); } catch (e) { /* fall through */ } }
      return c.id === 'hero' ? kit.heroKey(c.gender, c.heroType) : kit.defKey(c.id);
    },
    reach(itemId, wtype) {
      if (itemId && R.Rules && R.Rules.reach) { try { return R.Rules.reach(itemId); } catch (e) { /* fall through */ } }
      const it = itemId && DB.items[itemId];
      const w = (it && it.wtype) || wtype;
      const wt = w && DB.weaponTypes[w];
      if (wt && wt.reach) return wt.reach === 'any' || wt.reach === true ? 'any' : 'front';
      return REACH_ANY[w] ? 'any' : 'front';
    },
    frameOf(key, dir, i) {
      const sh = key && R.Gfx.has(key) ? R.Gfx.get(key) : null;
      const fr = sh && sh[dir || 'down'];
      return Array.isArray(fr) ? fr[(i || 0) % fr.length] : null;
    },
    /** a party sprite at (x,y), scale 1 or 2; a quiet silhouette while art-chars has not registered it */
    drawFigure(key, x, y, o) {
      const opt = o || {};
      const s = opt.scale || 1;
      const fr = kit.frameOf(key, opt.dir, opt.frame);
      const g = G();
      if (fr) {
        const a0 = g.ctx.globalAlpha;
        g.ctx.globalAlpha = a0 * (opt.dim ? 0.35 : opt.alpha != null ? opt.alpha : 1);
        g.draw(fr, x, y, { w: 16 * s, h: 24 * s });
        g.ctx.globalAlpha = a0;
        return;
      }
      const c = opt.dim ? '#20243a' : '#3a3e5c';
      g.rect(x + 5 * s, y + 2 * s, 6 * s, 6 * s, c);
      g.rect(x + 4 * s, y + 9 * s, 8 * s, 10 * s, c);
      g.rect(x + 4 * s, y + 19 * s, 3 * s, 4 * s, c); g.rect(x + 9 * s, y + 19 * s, 3 * s, 4 * s, c);
    },
    /** 8×8 icon for a weapon type ('sword') or an element ('el_fire') */
    drawIcon(id, x, y) {
      const g = G();
      let key = 'icon:' + id;
      if (!R.Gfx.has(key) && ICON_ALT[id]) key = 'icon:' + ICON_ALT[id];
      if (R.Gfx.has(key)) { g.draw(R.Gfx.get(key), x, y); return; }
      if (id.startsWith('el_')) {
        const col = kit.ecolor(id.slice(3));
        g.rect(x + 2, y + 1, 4, 6, col); g.rect(x + 1, y + 2, 6, 4, col); g.rect(x + 2, y + 2, 2, 2, '#ffffff');
      }
    },
    /** the 前/中 row plate (§11.1.2 colours, window fill2 behind the letter) */
    drawRowTag(row, x, y) {
      const g = G();
      const th = g.WINDOW_THEMES[(R.Settings && R.Settings.windowColor) || 'ink'] || g.WINDOW_THEMES.ink;
      const mid = row === 'middle';
      const col = mid ? g.C.cyan : g.C.orange;
      g.rect(x, y, 13, 12, th.fill2 || th.fill);
      g.ctx.globalAlpha = 0.28;
      g.rect(x, y, 13, 12, col);
      g.ctx.globalAlpha = 1;
      g.rect(x, y + 11, 13, 1, col);
      g.text(mid ? '後' : '前', x + 1, y, { color: col });
    },
    /** letters of a def with the favour applied (heroes) or as written (companions) */
    aptOf(c) {
      if (!c) return null;
      if (c.id === 'hero') return c.heroType && DB.heroTypes[c.heroType] ? previewApt(c.heroType, c.favor) : null;
      const d = DB.companions[c.id];
      return d ? d.apt : null;
    },
    /**
     * 得意の 2 行（オーナー指示 A17: S〜D の文字は出さない。得意な武器・属性の名前だけ）: 「得意な武器：剣・槍」
     * 「得意な属性：火」。S の名前が先、A の名前が後。o: {pitch, gap, hi: Set('w:sword', …) → gold blinking name, maxW}
     */
    drawAptWide(apt, x, y, o) {
      const opt = o || {};
      const pitch = (opt.pitch || 14) + (opt.gap || 0);
      const maxW = opt.maxW || 232;
      const blink = Math.floor(R.Engine.frame / 12) % 2 === 0;
      const sub = '#c8c8d8';
      const pick = (k, ids, name, col) => {
        const out = [];
        for (const l of ['S', 'A']) for (const id of ids) if (apt && apt[k][id] === l) {
          const hot = opt.hi && opt.hi.has(k + ':' + id);
          out.push([name(id), hot && blink ? G().C.gold : col(id)]);
        }
        return out;
      };
      const line = (label, parts, yy) => {
        const segs = [[label, sub]];
        if (!parts.length) segs.push(['―', '#707080']);
        parts.forEach((p, i) => { if (i) segs.push(['・', sub]); segs.push(p); });
        drawParts({ parts: segs }, x, yy, maxW);
      };
      line('得意な武器：', pick('w', W, kit.wname, () => '#ffffff'), y);
      line('得意な属性：', pick('e', E, kit.ename, kit.ecolor), y + pitch);
    },
    /** narrow variant for the favour step (a 146px column): the same 2 lines */
    drawAptNarrow(apt, x, y, o) { kit.drawAptWide(apt, x, y, Object.assign({ pitch: 18, maxW: 146 }, o || {})); },
    /** a 48px ability bar (value × 0.8px, §11.8.2); o.bonus adds a green piece after it (the gear's share) */
    statBar(x, y, v, o) {
      const g = G(), opt = o || {};
      const k = opt.scale || 0.8, W = 48;
      const a = Math.min(W, Math.max(1, Math.round(v * k)));
      g.rect(x, y, W, 4, '#1c2442');
      g.rect(x, y, a, 4, g.C.cyan);
      g.rect(x, y, a, 1, '#c8f0ff');
      const b = Math.min(W - a, Math.round((opt.bonus || 0) * k));
      if (b > 0) { g.rect(x + a, y, b, 4, g.C.green); g.rect(x + a, y, b, 1, '#c8ffd0'); }
    },
    /**
     * a short Japanese phrase in at most two lines of maxW: one line when it fits, else a break after a
     * particle or 、 (never inside にくい・手に入る・ついでに・落とし) with both lines fitting and 4 or more
     * characters on the second — the most even of those. Falls back to Gfx.wrap.
     */
    jbreak(text, maxW) {
      const g = G(), s = String(text || '');
      if (g.textWidth(s) <= maxW) return [s];
      const ch = [...s];
      let best = -1, bestW = Infinity;
      for (let i = 1; i < ch.length - 3; i++) {
        const a = ch[i - 1], b = ch[i];
        if (!'、をがにでとはの'.includes(a) || (a === 'に' && 'く入'.includes(b)) || (a === 'で' && b === 'に') || (a === 'と' && b === 'し')) continue;
        const w1 = g.textWidth(ch.slice(0, i).join('')), w2 = g.textWidth(ch.slice(i).join(''));
        if (w1 <= maxW && w2 <= maxW && Math.max(w1, w2) <= bestW) { best = i; bestW = Math.max(w1, w2); }
      }
      return best < 0 ? g.wrap(s, maxW).slice(0, 2) : [ch.slice(0, best).join(''), ch.slice(best).join('')];
    },
    /** SFC-style dusk gradient used behind the new-game screens */
    backdrop() {
      const g = G();
      const bands = ['#070918', '#0a0c24', '#0c1030', '#101640', '#141a4a', '#1a2256', '#1e2860', '#222c66'];
      bands.forEach((c, i) => g.rect(0, i * 28, R.W, 28, c));
      g.ctx.globalAlpha = 0.5;
      for (let i = 0; i < 26; i++) {
        const x = (i * 97 + 13) % 256, y = (i * 53 + 7) % 220;
        const tw = Math.sin((R.Engine.frame + i * 37) / 40) > 0.3;
        g.rect(x, y, 1, 1, tw ? '#c8d0ff' : '#6070a0');
      }
      g.ctx.globalAlpha = 1;
    },
  };

  // ------------------------------------------------------------ rules for the preview (DESIGN §5.2.4・§5.2.7)
  function previewApt(type, favor) {
    const T = DB.heroTypes[type];
    if (!T) return null;
    const apt = { w: Object.assign({}, T.apt.w), e: Object.assign({}, T.apt.e) };
    if (favor && favor.id) {
      const K = favor.kind === 'weapon' ? 'w' : 'e';
      apt[K][favor.id] = 'S';
      const pair = DB.starterKit.pair || {};
      if (T.pairElement && favor.kind === 'element' && pair[favor.id]) apt.e[pair[favor.id]] = 'A';
    }
    return apt;
  }
  /** the letters that the favour changes (for the gold blinking frame) */
  function changedKeys(type, favor) {
    const T = DB.heroTypes[type];
    const out = new Set();
    if (!T || !favor) return out;
    const after = previewApt(type, favor);
    for (const w of W) if (after.w[w] !== T.apt.w[w]) out.add('w:' + w);
    for (const e of E) if (after.e[e] !== T.apt.e[e]) out.add('e:' + e);
    out.add((favor.kind === 'weapon' ? 'w:' : 'e:') + favor.id);
    return out;
  }
  function favorOptions(type) {
    const T = DB.heroTypes[type];
    if (!T) return [];
    const fo = T.favorOptions || {};
    const out = [];
    if (T.favorKind !== 'element') for (const id of fo.weapon || []) out.push({ kind: 'weapon', id });
    if (T.favorKind !== 'weapon') for (const id of fo.element || []) out.push({ kind: 'element', id });
    return out;
  }
  function startWeapon(type, favor) {
    const T = DB.heroTypes[type];
    const kitD = DB.starterKit || {};
    return favor && favor.kind === 'weapon' ? (kitD.weapon || {})[favor.id] : T && T.defaultWeapon;
  }
  function startActions(type, favor) {
    const T = DB.heroTypes[type];
    const kitD = DB.starterKit || {};
    if (!T || !favor) return { techs: [], spells: [] };
    const extra = (T.onFavor && T.onFavor[favor.kind]) || { techs: [], spells: [] };
    return {
      techs: (favor.kind === 'weapon' ? [(kitD.tech || {})[favor.id]] : []).concat(extra.techs || []).filter(Boolean),
      spells: (favor.kind === 'element' ? [(kitD.spell || {})[favor.id]] : []).concat(extra.spells || []).filter(Boolean),
    };
  }
  function heroRow(type, favor) {
    const T = DB.heroTypes[type];
    if (!T) return 'front';
    if (T.row !== 'auto') return T.row;
    const w = startWeapon(type, favor);
    const wtype = favor && favor.kind === 'weapon' ? favor.id : (DB.items[w] && DB.items[w].wtype) || null;
    return kit.reach(w, wtype) === 'any' || (favor && favor.kind === 'element') ? 'middle' : 'front';
  }
  const favorName = (f) => (f.kind === 'weapon' ? kit.wname(f.id) : kit.ename(f.id));
  /** lines of the right-hand window on the favour step: [{parts:[[text, color]…]}] */
  function favorLines(type, favor) {
    const T = DB.heroTypes[type];
    if (!T || !favor) return [];
    const C = G() ? G().C : {};
    const n = favorName(favor);
    const lines = [
      { parts: [['得意：', '#c8c8d8'], [n, favor.kind === 'element' ? kit.ecolor(favor.id) : '#ffffff']] },
    ];
    const pair = (DB.starterKit.pair || {})[favor.id];
    if (T.pairElement && favor.kind === 'element' && pair) {
      lines.push({ parts: [['組の属性：', '#c8c8d8'], [kit.ename(pair), kit.ecolor(pair)], ['も得意になる', '#ffffff']] });
    }
    lines.push({ parts: [['初期の武器：', '#c8c8d8'], [kit.itemName(startWeapon(type, favor)), '#ffffff']] });
    const acts = startActions(type, favor);
    const tl = acts.techs.map(kit.actionName).join('・'), sl = acts.spells.map(kit.actionName).join('・');
    const first = favor.kind === 'weapon' ? [['初期の技：', tl], ['初期の術：', sl]] : [['初期の術：', sl], ['初期の技：', tl]];
    for (const [label, v] of first) if (v) lines.push({ parts: [[label, '#c8c8d8'], [v, C.white || '#ffffff']] });
    return lines;
  }
  function drawParts(line, x, y, maxW) {
    const g = G();
    const full = line.parts.map((p) => p[0]).join('');
    const w = g.textWidth(full);
    const k = maxW && w > maxW ? maxW / w : 1;
    if (k < 1) { g.ctx.save(); g.ctx.translate(x, y); g.ctx.scale(k, 1); x = 0; y = 0; }
    let cx = x;
    for (const [t, col] of line.parts) { g.text(t, cx, y, { color: col }); cx += g.textWidth(t); }
    if (k < 1) g.ctx.restore();
  }
  kit.drawParts = drawParts;

  // ------------------------------------------------------------ the layer
  const STEP_TITLES = ['性別を選んでください', 'タイプを選んでください', '', '', 'この姿と名前で始めますか？'];
  const TYPE_IDS = () => Object.keys(DB.heroTypes);

  class CreateLayer extends R.Layer {
    constructor(o) {
      super();
      this.opaque = true;
      this.o = o;
      const ini = o.initial || {};
      this.step = 0;
      this.gender = ini.gender === 'f' ? 1 : 0;
      this.typeIdx = Math.max(0, TYPE_IDS().indexOf(ini.type || ''));
      this.favor = ini.favor ? { kind: ini.favor.kind, id: ini.favor.id } : null;
      this.name = ini.name || null;
      this.nameAuto = !ini.name;
      this.yes = 0;
      this.busy = false;
      this.favTop = 0;
      this.enterFavor();
    }
    get g() { return this.gender ? 'f' : 'm'; }
    get type() { return TYPE_IDS()[this.typeIdx]; }
    spriteKey() { return kit.heroKey(this.g, this.type); }
    /** rows of the favour list: headings (not selectable) + options */
    favRows() {
      const T = DB.heroTypes[this.type];
      const opts = favorOptions(this.type);
      if (!T || T.favorKind !== 'any') return opts;
      const out = [{ head: '武器' }];
      for (const f of opts) { if (f.kind === 'element' && !out.some((r) => r.head === '属性')) out.push({ head: '属性' }); out.push(f); }
      return out;
    }
    enterFavor() {
      const rows = this.favRows();
      let i = this.favor ? rows.findIndex((r) => !r.head && r.kind === this.favor.kind && r.id === this.favor.id) : -1;
      if (i < 0) i = rows.findIndex((r) => !r.head);
      this.favIdx = Math.max(0, i);
      this.favor = rows[this.favIdx] && !rows[this.favIdx].head ? { kind: rows[this.favIdx].kind, id: rows[this.favIdx].id } : null;
      this.scrollFav();
    }
    scrollFav() {
      const vis = 12;
      const n = this.favRows().length;
      if (this.favIdx - 1 < this.favTop) this.favTop = Math.max(0, this.favIdx - 1);
      if (this.favIdx >= this.favTop + vis) this.favTop = this.favIdx - vis + 1;
      this.favTop = Math.max(0, Math.min(this.favTop, Math.max(0, n - vis)));
    }
    flow(fn) {
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    back() {
      R.sfx('cancel');
      if (this.step === 0) { if (this.o.cancel !== false) this.close(null); return; }
      this.step = this.step === 4 ? 3 : this.step - 1;
      if (this.step === 3) this.flow(() => this.nameStep());
    }
    next() {
      R.sfx('confirm');
      this.step++;
      if (this.step === 2) this.enterFavor();
      if (this.step === 3) this.flow(() => this.nameStep());
    }
    async nameStep() {
      const names = (DB.starterKit.heroNames || {})[this.g] || [];
      const other = (DB.starterKit.heroNames || {})[this.g === 'm' ? 'f' : 'm'] || [];
      // the default follows the gender until the player has typed a name of their own
      if (!this.name || (this.nameAuto && other.includes(this.name))) this.name = names[0] || '';
      const v = await R.NameEntry.run({ initial: this.name, max: 5, spriteKey: this.spriteKey(), title: '名前を入れてください', gender: this.g, step: '4/5' });
      if (v == null) { this.step = 2; this.enterFavor(); return; }
      if (v !== this.name) this.nameAuto = names.includes(v) || other.includes(v);
      this.name = v;
      this.yes = 0;
      this.step = 4;
    }
    update() {
      if (this.busy || this.closed) return;
      const d = In().dirRepeat();
      if (In().pressed('b')) { if (this.step === 0 && this.o.cancel === false) return; this.back(); return; }
      if (this.step === 0) {
        if (d === 'left' || d === 'right') { this.gender ^= 1; R.sfx('cursor'); }
        if (In().pressed('a')) this.next();
      } else if (this.step === 1) {
        const n = TYPE_IDS().length;
        if (d === 'up' || d === 'down') {
          this.typeIdx = (this.typeIdx + (d === 'up' ? n - 1 : 1)) % n; R.sfx('cursor');
          const ok = this.favor && favorOptions(this.type).some((f) => f.kind === this.favor.kind && f.id === this.favor.id);
          if (!ok) this.favor = null;
        }
        if (In().pressed('a')) this.next();
      } else if (this.step === 2) {
        const rows = this.favRows();
        if (d === 'up' || d === 'down') {
          let i = this.favIdx;
          do { i = (i + (d === 'up' ? rows.length - 1 : 1)) % rows.length; } while (rows[i].head);
          this.favIdx = i; this.favor = { kind: rows[i].kind, id: rows[i].id };
          if (i === 1 && rows[0].head) this.favTop = 0;
          this.scrollFav(); R.sfx('cursor');
        }
        if (In().pressed('a') && this.favor) this.next();
      } else if (this.step === 4) {
        if (d === 'left' || d === 'right' || d === 'up' || d === 'down') { this.yes ^= 1; R.sfx('cursor'); }
        if (In().pressed('a')) {
          if (this.yes === 0) {
            R.sfx('confirm');
            this.close({ name: this.name, gender: this.g, type: this.type, favor: { kind: this.favor.kind, id: this.favor.id } });
          } else { R.sfx('cancel'); this.step = 0; }
        }
      }
    }
    header(title, n) {
      const g = G();
      g.window(4, 4, 248, 22);
      g.text(title, 128, 9, { align: 'center' });
      g.text(n + '/5', 244, 9, { align: 'right', color: '#c8c8d8' });
    }
    draw() {
      const g = G();
      kit.backdrop();
      if (this.step === 0) this.drawGender();
      else if (this.step === 1) this.drawType();
      else if (this.step === 2) this.drawFavor();
      else if (this.step === 4) this.drawConfirm();
      else this.drawFavor();
      if (this.step === 3) { g.ctx.globalAlpha = 0.6; g.rect(0, 0, R.W, R.H, '#000'); g.ctx.globalAlpha = 1; }
    }
    drawGender() {
      const g = G(), C = g.C, f = Math.floor(R.Engine.frame / 16) % 2;
      this.header(STEP_TITLES[0], 1);
      ['m', 'f'].forEach((sex, i) => {
        const x = i ? 132 : 28, y = 40;
        g.window(x, y, 96, 112);
        const sel = this.gender === i;
        if (sel) { g.strokeRect(x + 1, y + 1, 94, 110, C.gold); g.strokeRect(x + 3, y + 3, 90, 106, C.gold); }
        kit.drawFigure(kit.heroKey(sex, 'warrior'), x + 32, y + 22, { scale: 2, frame: sel ? f : 0, alpha: sel ? 1 : 0.8 });
        g.text(sex === 'm' ? '男' : '女', x + 48, y + 86, { align: 'center', color: sel ? C.white : C.gray, size: 16 });
        if (sel) g.cursor(x + 30, y + 88);
      });
      g.window(4, 160, 248, 60);
      g.text('性別で変わるのは、見た目と', 16, 168, { color: '#c8c8d8' });
      g.text('町の人の呼び方だけです。', 16, 182, { color: '#c8c8d8' });
      g.text('能力と得手不得手は変わりません。', 16, 196, { color: '#c8c8d8' });
    }
    drawType() {
      const g = G(), C = g.C, f = Math.floor(R.Engine.frame / 16) % 2;
      this.header(STEP_TITLES[1], 2);
      const ids = TYPE_IDS();
      g.window(4, 30, 88, 98);
      ids.forEach((id, i) => {
        const y = 38 + 16 * i;
        g.text(DB.heroTypes[id].name, 20, y, { color: i === this.typeIdx ? C.white : '#c8c8d8' });
        if (i === this.typeIdx) g.cursor(10, y + 1);
      });
      const T = DB.heroTypes[this.type];
      g.window(94, 30, 158, 98);
      kit.drawFigure(this.spriteKey(), 102, 36, { scale: 2, frame: f });
      STATS.forEach((s, k) => {
        const y = 37 + 14 * k;
        g.text(STAT_NAMES[s], 144, y, { color: '#c8c8d8' });
        g.text(String(T.stats[s]), 194, y, { align: 'right' });
        kit.statBar(198, y + 4, T.stats[s]);
      });
      g.window(4, 130, 248, 36);
      T.desc.split('\n').forEach((l, i) => g.text(l, 14, 136 + 14 * i));
      g.window(4, 168, 248, 52);
      kit.drawAptWide(T.apt, 14, 176, { pitch: 18 });
    }
    drawFavor() {
      const g = G(), C = g.C;
      const T = DB.heroTypes[this.type];
      const title = T.favorKind === 'weapon' ? '得意な武器を選んでください' : T.favorKind === 'element' ? '得意な属性を選んでください' : '得意な武器か属性を選んでください';
      this.header(title, 3);
      const rows = this.favRows();
      g.window(4, 30, 88, 190);
      const vis = 12;
      for (let k = 0; k < vis && this.favTop + k < rows.length; k++) {
        const i = this.favTop + k, r = rows[i], y = 38 + 14 * k;
        if (r.head) {
          g.text(r.head, 12, y, { color: C.cyan });
          g.rect(12 + g.textWidth(r.head) + 3, y + 6, 70 - g.textWidth(r.head), 1, '#3c4a78');
          continue;
        }
        kit.drawIcon(r.kind === 'weapon' ? r.id : 'el_' + r.id, 22, y + 2);
        g.text(favorName(r), 34, y, { color: i === this.favIdx ? C.white : '#c8c8d8' });
        if (i === this.favIdx) g.cursor(11, y + 1);
      }
      if (this.favTop > 0) tri(48, 33, -1);
      if (this.favTop + vis < rows.length) tri(48, 213, 1);
      g.window(94, 30, 158, 98);
      favorLines(this.type, this.favor).forEach((l, i) => drawParts(l, 102, 38 + 14 * i, 142));
      g.window(94, 130, 158, 36);
      const desc = this.favor ? ((DB.starterKit.favorDesc || {})[this.favor.id] || '') : '';
      g.wrap(desc, 140).slice(0, 2).forEach((l, i) => g.text(l, 102, 136 + 14 * i));
      g.window(94, 168, 158, 52);
      kit.drawAptNarrow(previewApt(this.type, this.favor), 102, 176, { hi: changedKeys(this.type, this.favor) });
    }
    drawConfirm() {
      const g = G(), C = g.C, f = Math.floor(R.Engine.frame / 16) % 2;
      this.header(STEP_TITLES[4], 5);
      const T = DB.heroTypes[this.type];
      g.window(40, 40, 176, 120);
      kit.drawFigure(this.spriteKey(), 52, 52, { scale: 2, frame: f });
      g.text(this.name || '', 96, 50, { size: 16 });
      g.text(this.g === 'm' ? '男' : '女', 96, 72, { color: this.g === 'm' ? C.cyan : C.pink });
      g.text(T.name, 116, 72);
      const row = heroRow(this.type, this.favor);
      drawParts({ parts: [['得意：', '#c8c8d8'], [favorName(this.favor), this.favor.kind === 'element' ? kit.ecolor(this.favor.id) : C.white],
        ['　', C.white], [ROW_NAMES[row], row === 'middle' ? C.cyan : C.orange]] }, 96, 86, 116);
      drawParts({ parts: [['武器：', '#c8c8d8'], [kit.itemName(startWeapon(this.type, this.favor)), C.white]] }, 96, 100, 116);
      const acts = startActions(this.type, this.favor);
      const al = (this.favor.kind === 'weapon' ? acts.techs.concat(acts.spells) : acts.spells.concat(acts.techs)).map(kit.actionName).join('・');
      drawParts({ parts: [['技・術：', '#c8c8d8'], [al || '――', C.white]] }, 52, 114, 156);
      g.rect(52, 131, 152, 1, '#3c4a78');
      ['はい', 'いいえ'].forEach((t, i) => {
        const x = i ? 146 : 86;
        g.text(t, x, 138, { color: this.yes === i ? C.white : '#c8c8d8' });
        if (this.yes === i) g.cursor(x - 11, 139);
      });
      g.window(4, 166, 248, 54);
      kit.drawAptWide(previewApt(this.type, this.favor), 14, 175, { pitch: 18 });
    }
  }
  /** blinking scroll mark: dir < 0 ▲ (more above), dir > 0 ▼ (more below) */
  function tri(x, y, dir) {
    if (Math.floor(R.Engine.frame / 12) % 2) return;
    for (let i = 0; i < 3; i++) G().rect(x - 2 + i, dir < 0 ? y + 2 - i : y + i, 5 - i * 2, 1, '#fff');
  }
  kit.tri = tri;

  R.CharCreate = {
    kit, previewApt, changedKeys, favorOptions, favorLines, heroRow, startWeapon, startActions,
    /** o: {cancel = true, initial?: heroSpec}. Resolves heroSpec {name, gender, type, favor:{kind, id}} or null. */
    async run(o) {
      const opts = Object.assign({ cancel: true }, o || {});
      if (!TYPE_IDS().length) { R.warn('CharCreate: DB.heroTypes is empty'); return null; }
      const r = await R.Engine.run(new CreateLayer(opts));
      return r || null;
    },
    _Layer: CreateLayer,
  };
})(window.RPG);
