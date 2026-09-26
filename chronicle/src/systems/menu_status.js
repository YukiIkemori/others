// Field menu: 強さ (DESIGN §11.7.6: per member, pages 能力 / 装備 / 技 / 術 / 熟練度 / 耐性),
// 並びと隊列 (§11.7.7: order + front / middle rows) and 図鑑 (§11.7.9: 268 entries, three drop
// slots with dots, detail page 1 = the 落とす / 盗む table, page 2 = weaknesses).
//   R.Menu.statusScreen(o)  R.Menu.orderScreen()  R.Menu.bookScreen()
//   R.Menu.monsterOrder() → [monId]   R.Menu.bookDropRows(monId) → [{label, text, color, drop, steal}] (tests T7・T8)
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  let lastPage = 0;
  let lastMon = 0;

  let C = null;
  const cls = () => C || (C = build());
  Menu.statusScreen = (o) => R.Engine.run(new (cls().StatusScreen)(o || {}));
  Menu.orderScreen = () => R.Engine.run(new (cls().OrderScreen)());
  Menu.bookScreen = () => R.Engine.run(new (cls().BookScreen)());

  // ============================================================ bestiary data
  const flagsOf = (m) => (m && m.flags) || [];
  const isBoss = (id) => flagsOf(DB.monsters[id]).includes('boss');
  const isRareMon = (id) => flagsOf(DB.monsters[id]).includes('rare');
  let orderCache = null;
  /**
   * book order (§9.14.2): regular monsters by lineage (the DB.lineages order) → stage, a `family`
   * lineage (the steel branches) right after its base lineage; then the rare monsters, then the bosses
   * in fight order (their DB order). Monsters flagged noBook are left out.
   */
  function monsterOrder() {
    const nMon = Object.keys(DB.monsters).length;
    if (orderCache && orderCache.n === nMon) return orderCache.ids.slice();
    const out = [], used = {};
    const add = (id) => { if (id && DB.monsters[id] && !used[id] && !DB.monsters[id].noBook) { used[id] = 1; out.push(id); } };
    const lin = DB.lineages || {};
    const branches = {};
    for (const lid of Object.keys(lin)) if (lin[lid].family) (branches[lin[lid].family] = branches[lin[lid].family] || []).push(lid);
    const addLineage = (lid) => {
      for (const s of lin[lid].stages || []) add(s.mon);
      // monsters of the lineage that are not listed as a stage (by their stage number)
      Object.keys(DB.monsters).filter((id) => DB.monsters[id].lineage === lid && !isBoss(id) && !isRareMon(id))
        .sort((a, b) => (DB.monsters[a].stage || 0) - (DB.monsters[b].stage || 0)).forEach(add);
    };
    for (const lid of Object.keys(lin)) {
      if (lin[lid].family) continue;
      addLineage(lid);
      for (const b of branches[lid] || []) addLineage(b);
    }
    for (const lid of Object.keys(lin)) if (lin[lid].family && !DB.lineages[lin[lid].family]) addLineage(lid);
    for (const id of Object.keys(DB.monsters)) if (!isBoss(id) && !isRareMon(id) && DB.monsters[id].lineage) add(id);
    for (const id of Object.keys(DB.monsters)) if (isRareMon(id) && !isBoss(id)) add(id);
    for (const id of Object.keys(DB.monsters)) if (isBoss(id)) add(id);
    orderCache = { n: nMon, ids: out };
    return out.slice();
  }
  Menu.monsterOrder = monsterOrder;
  const book = () => (R.Game && R.Game.book && R.Game.book.mon) || (R.Game && R.Game.bestiary) || {};
  const rec = (id) => book()[id] || null;
  const seen = (id) => { const b = rec(id); return !!(b && (b.seen || b.kills)); };
  const beaten = (id) => { const b = rec(id); return !!(b && b.kills); };
  /** stats and weaknesses are shown once beaten or scanned (見破る, §4.10.4) */
  const known = (id) => { const b = rec(id); return !!(b && (b.kills || b.scan)); };
  Menu.bookSeen = seen;
  Menu.bookKnown = known;
  const SLOT_KEYS = [['normal', 'drop', '通常'], ['rare', 'rare', 'レア'], ['super', 'sr', '超レア']];
  const POOL_LABEL = { p_boss: 'レアの装備品', p_boss_mid: '装備品' };
  /** which drop slots a monster has (normal / rare / super), for the list dots */
  function slotsOf(id) {
    const d = (DB.monsters[id] && DB.monsters[id].drops) || {};
    return SLOT_KEYS.map(([k, bk]) => ({ k, bk, has: !!(d[k] && (d[k].item || d[k].pool)), got: !!(rec(id) && rec(id)[bk]) }));
  }
  Menu.bookSlots = slotsOf;

  /**
   * the 落とす / 盗む table of detail page 1 (§11.7.9): one row per slot —
   * {label, text, color, drop:'○'|'―', steal:'○'|'―', got, none}. An obtained slot (by drop or steal) shows
   * ★ + the item name (itemColor) even before the first kill; an empty one ？？？; a missing one ―.
   * Super rares are never stolen. Scanning never reveals item names.
   */
  function bookDropRows(id) {
    const m = DB.monsters[id] || {};
    const d = m.drops || {};
    const r = rec(id) || {};
    return SLOT_KEYS.map(([k, bk, label]) => {
      const s = d[k];
      const hasSlot = !!(s && (s.item || s.pool));
      const got = hasSlot && !!r[bk];
      let text = '―', color = K().COL.gray;
      if (hasSlot && got) {
        if (s.item) { text = '★' + K().itemName(s.item); color = K().itemColor(s.item); }
        else {
          text = '★' + (POOL_LABEL[s.pool] || '装備品');
          color = s.pool === 'p_boss' ? G().C.rare : '#ffffff';
        }
        if (k === 'normal' && d.bonus && d.bonus.item) text += '・' + K().itemName(d.bonus.item);
      } else if (hasSlot) { text = '？？？'; color = K().COL.gray; }
      const drop = hasSlot ? '○' : '―';
      const steal = hasSlot && k !== 'super' ? '○' : '―';
      return { k, label, text, color, drop, steal, got, none: !hasSlot };
    });
  }
  Menu.bookDropRows = bookDropRows;

  /** the monster's canvas (first frame) */
  function monSprite(id) {
    const m = DB.monsters[id];
    const key = 'mon:' + ((m && m.sprite) || id);
    if (!G().has(key)) return null;
    const v = G().get(key);
    return Array.isArray(v) ? v[0] : v;
  }
  /** draw a monster centred on cx with its feet on `bottom`: small ones doubled when they fit, big ones halved until they do */
  function drawMon(id, cx, bottom, maxW, maxH, dark) {
    const img = monSprite(id);
    if (!img) { G().text('？', cx, bottom - 24, { align: 'center', color: K().COL.gray, size: 16 }); return; }
    let s = 1;
    if (img.width * 2 <= maxW && img.height * 2 <= maxH) s = 2;
    while ((img.width * s > maxW || img.height * s > maxH) && s > 0.125) s /= 2;
    const w = Math.round(img.width * s), h = Math.round(img.height * s);
    const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
    if (dark) G().drawTinted(img, x, y, '#000000', 0.85);
    else G().draw(img, x, y, s !== 1 ? { w, h } : null);
  }
  const pad3 = (n) => U.padL(n, 3, '0');

  // ============================================================ status helpers
  /** the element table text for 耐性 (§11.7.6) */
  function resistWord(v) {
    if (v == null || v === 1) return ['ふつう', '#ffffff'];
    if (v < 0) return ['吸収', G().C.cyan];
    if (v === 0) return ['無効', G().C.green];
    if (v < 1) return ['半減', G().C.green];
    return ['弱点', G().C.red];
  }
  Menu.resistWord = resistWord;

  function build() {
    const Kt = K();

    // ============================================================ 強さ
    class StatusScreen extends Kt.Screen {
      constructor(o) {
        super();
        const n = R.Game.party.length;
        this.m = o.member != null ? o.member : (Kt.lastMember || 0) < n ? Kt.lastMember || 0 : 0;
        this.page = 0;
        this.buildPages(lastPage);
      }
      get c() { return R.Game.party[this.m]; }
      /** pages depend on the member (22 techs / spells per page) */
      buildPages(keepKind) {
        const c = this.c;
        const techs = Kt.allTechs(c), spells = Kt.spellList(c);
        const tp = Math.max(1, Math.ceil(techs.length / 22)), sp = Math.max(1, Math.ceil(spells.length / 22));
        const pages = [{ kind: 'ability', title: '能力' }, { kind: 'gear', title: '装備' }];
        for (let i = 0; i < tp; i++) pages.push({ kind: 'tech', title: tp > 1 ? '技 ' + (i + 1) + '/' + tp : '技', list: techs.slice(i * 22, i * 22 + 22) });
        for (let i = 0; i < sp; i++) pages.push({ kind: 'spell', title: sp > 1 ? '術 ' + (i + 1) + '/' + sp : '術', list: spells.slice(i * 22, i * 22 + 22) });
        pages.push({ kind: 'prof', title: '熟練度' }, { kind: 'resist', title: '耐性' });
        this.pages = pages;
        if (typeof keepKind === 'string') {
          const k = pages.findIndex((p) => p.kind === keepKind);
          this.page = k >= 0 ? k : 0;
        } else this.page = U.clamp(this.page, 0, pages.length - 1);
      }
      input() {
        const d = In().dirRepeat();
        const lr = Kt.memberStep() || (d === 'left' ? -1 : d === 'right' ? 1 : 0);
        if (lr) {
          const kind = this.pages[this.page].kind;
          this.m = Kt.cycle(this.m, lr, R.Game.party.length);
          Kt.lastMember = this.m;
          this.buildPages(kind);
          R.sfx('cursor');
          return;
        }
        const n = this.pages.length;
        if (d === 'up' || d === 'down' || In().pressed('a')) {
          this.page = (this.page + (d === 'up' ? n - 1 : 1)) % n;
          lastPage = this.pages[this.page].kind;
          R.sfx('page');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); }
      }
      render() {
        const c = this.c;
        const st = Kt.stats(c);
        const pg = this.pages[this.page];
        G().window(4, 4, 248, 40);
        Kt.drawSpriteAt(c, 12, 12, { frame: Math.floor(R.Engine.frame / 20) });
        Kt.fitText(c.name, 34, 10, 58, { color: Kt.condColor(c) });
        G().text('Lv' + c.level, 118, 10, { align: 'right' });
        const row = Kt.effectiveRow(c);
        G().text(row === 'middle' ? '中列' : '前列', 126, 10, { color: row === 'middle' ? G().C.cyan : G().C.orange });
        if (c.hp <= 0) G().text('戦闘不能', 154, 10, { color: G().C.dead });
        G().text('ページ ' + (this.page + 1) + '/' + this.pages.length, 244, 10, { align: 'right', color: Kt.COL.sub });
        Kt.fitText(Kt.subtitle(c, true), 34, 24, 170, { color: Kt.COL.sub });
        Kt.lrHint(244, 26);
        switch (pg.kind) {
          case 'ability': this.pageAbility(c, st); break;
          case 'gear': this.pageGear(c); break;
          case 'tech': this.pageActs(c, pg, 'tech'); break;
          case 'spell': this.pageActs(c, pg, 'spell'); break;
          case 'prof': this.pageProf(c); break;
          default: this.pageResist(c, st); break;
        }
      }
      pageAbility(c, st) {
        const base = R.Rules && R.Rules.baseStats ? R.Rules.baseStats(c) : {};
        G().window(4, 46, 122, 128, { title: '能力' });
        const L = [['最大HP', c.hp + '/' + (st.hp || 0), Kt.condColor(c)], ['最大MP', c.mp + '/' + (st.mp || 0)], ['最大WP', (c.wp || 0) + '/' + (st.wp || 0)]];
        L.forEach(([k, v, col], i) => {
          const y = 53 + i * 13;
          G().text(k, 12, y, { color: Kt.COL.sub });
          G().text(v, 118, y, { align: 'right', color: col || '#ffffff' });
        });
        G().rect(12, 53 + 3 * 13 - 1, 106, 1, '#3a4470');
        Kt.STATS6.forEach((k, i) => {
          const y = 53 + (i + 3) * 13 + 1;
          G().text(Kt.STAT_NAMES[k], 12, y, { color: Kt.COL.sub });
          G().text(String(st[k] || 0), 86, y, { align: 'right' });
          const add = (st[k] || 0) - (base[k] != null ? base[k] : st[k] || 0);
          if (add) G().text(Kt.signed(add), 118, y, { align: 'right', color: add > 0 ? G().C.green : G().C.red });
        });
        G().window(130, 46, 122, 128, { title: '戦闘' });
        const v = Kt.statVector(st);
        const w2 = !!c.equip.weapon2;
        const R2 = [['攻撃1', v.atk1], ['攻撃2', w2 ? v.atk2 : '―'], ['術力', v.mag], ['守備', v.def], ['術防', v.mdef], ['命中', v.hit], ['回避', v.eva], ['会心', (v.crit || 0) + '%']];
        R2.forEach(([k, val], i) => {
          const y = 54 + i * 14;
          G().text(k, 139, y, { color: Kt.COL.sub });
          G().text(String(val), 244, y, { align: 'right', color: val === '―' ? Kt.COL.gray : '#ffffff' });
        });
        G().window(4, 176, 248, 44);
        G().text('経験値', 14, 183, { color: Kt.COL.sub });
        G().text(String(c.exp || 0), 140, 183, { align: 'right' });
        G().text('次のレベルまで', 14, 197, { color: Kt.COL.sub });
        const maxLv = (R.Rules && R.Rules.MAX_LEVEL) || 99;
        const nx = R.Rules && R.Rules.expToNext ? R.Rules.expToNext(c) : 0;
        G().text(c.level >= maxLv ? '―' : String(nx), 140, 197, { align: 'right', color: G().C.yellow });
        const d = DB.companions[c.id];
        const who = c.id === 'hero' ? (c.gender === 'f' ? '主人公・女' : '主人公・男') : d ? (d.kin || '') + (d.age ? '・' + d.age + '歳' : '') : '';
        Kt.fitText(who, 150, 183, 92, { color: Kt.COL.sub });
        G().text('閃き ' + ((c.counts && c.counts.glimmers) || 0) + '回', 244, 197, { align: 'right', color: Kt.COL.sub });
      }
      pageGear(c) {
        G().window(4, 46, 248, 130, { title: '装備' });
        Kt.slots().forEach((s, i) => {
          const y = 54 + i * 13;
          G().text(Kt.slotName(s), 14, y, { color: Kt.COL.sub });
          const id = c.equip[s];
          if (!id) { G().text(s === 'shield' && Kt.holdsTwoHanded(c) ? '（両手持ち）' : '―', 62, y, { color: Kt.COL.gray }); return; }
          const it = DB.items[id];
          Kt.drawIcon(it, 60, y + 2);
          Kt.fitText(Kt.itemLabel(id), 72, y, 110, { color: Kt.itemColor(id) });
          G().text(mainNumber(it), 244, y, { align: 'right', color: Kt.COL.sub });
        });
        G().window(4, 178, 248, 42);
        if (c.id === 'hero') {
          const f = c.favor || {};
          const nm = f.kind === 'element' ? Kt.elemName(f.id) : Kt.wtypeName(f.id);
          const desc = (DB.starterKit && DB.starterKit.favorDesc && DB.starterKit.favorDesc[f.id]) || (f.kind !== 'element' && DB.weaponTypes[f.id] && DB.weaponTypes[f.id].desc) || '';
          G().text('得意分野：' + (f.id ? nm : '―'), 14, 184, { color: G().C.yellow });
          Kt.fitText(desc, 14, 198, 228);
        } else {
          const inn = (DB.companions[c.id] && DB.companions[c.id].innate) || {};
          G().text('個性：' + (inn.name || '―'), 14, 184, { color: G().C.yellow });
          Kt.fitText(String(inn.desc || '').split('\n')[0], 14, 198, 228);
        }
      }
      pageActs(c, pg, kind) {
        const list = pg.list || [];
        // content-sized (Part A11): as tall as the longer of the two columns
        G().window(4, 46, 248, 16 + Math.max(2, Math.min(11, list.length)) * 15, { title: pg.title });
        if (!list.length) { G().text(kind === 'tech' ? 'まだ技を覚えていない。' : 'まだ術を覚えていない。', 16, 56, { color: Kt.COL.gray }); return; }
        list.forEach((id, i) => {
          const a = DB.actions[id];
          const col = Math.floor(i / 11), row = i % 11;
          const x = 12 + col * 120, y = 54 + row * 15;
          let ix = 10;
          if (kind === 'tech') Kt.drawIcon({ type: 'weapon', wtype: a.wtype }, x, y + 2);
          else { Kt.drawElemIcons(a.elements || [], x, y + 2); ix = (a.elements || []).length * 9 + 1; }
          Kt.fitText(a.name, x + ix, y, 116 - ix - 30, {});
          G().text((kind === 'tech' ? 'W' : 'M') + Kt.cost(c, id), x + 112, y, { align: 'right', color: Kt.COL.sub });
        });
      }
      pageProf(c) {
        G().window(4, 46, 248, 174, { title: '熟練度' });
        const apt = Kt.aptLetters(c);
        const rank = (kind, id) => {
          const pts = ((kind === 'w' ? c.wprof : c.eprof) || {})[id] || 0;
          return R.Rules && R.Rules.profRank ? R.Rules.profRank(pts) : 0;
        };
        const drawRow = (x, y, name, letter, r) => {
          Kt.fitText(name, x, y, 26, { color: '#ffffff' });
          const col = Kt.APT_COLOR[letter] || '#ffffff';
          G().text(letter || '―', x + 30, y, { color: col });
          G().text(String(r), x + 52, y, { align: 'right' });
          for (let k = 0; k < 10; k++) G().rect(x + 56 + k * 5, y + 3, 4, 5, k < r ? col : '#2a3050');
        };
        Kt.wtypes().forEach((w, i) => drawRow(12, 54 + i * 14, Kt.wtypeName(w), apt.w && apt.w[w], rank('w', w)));
        Kt.elems().forEach((e, i) => drawRow(132, 54 + i * 14, Kt.elemName(e), apt.e && apt.e[e], rank('e', e)));
        const ly = 54 + 7 * 14;
        G().text('文字：閃きやすさ', 132, ly, { color: Kt.COL.sub, size: 8 });
        ['S', 'A', 'B', 'C', 'D'].forEach((L, i) => G().text(L, 132 + i * 12, ly + 12, { color: Kt.APT_COLOR[L] }));
        G().text('数と棒：熟練度', 132, ly + 28, { color: Kt.COL.sub, size: 8 });
        G().text('使うほど伸びて、', 132, ly + 42, { color: Kt.COL.gray, size: 8 });
        G().text('上の技・術を閃く。', 132, ly + 54, { color: Kt.COL.gray, size: 8 });
      }
      pageResist(c, st) {
        G().window(4, 46, 248, 174, { title: '耐性' });
        const m = st.mods || (R.Rules && R.Rules.mods ? R.Rules.mods(c) : {}) || {};
        const er = st.elemResist || m.elemResist || {};
        const boost = st.elemBoost || m.elemBoost || {};
        Kt.elems().forEach((e, i) => {
          const x = 14 + (i % 2) * 118, y = 54 + Math.floor(i / 2) * 14;
          G().text(Kt.elemName(e), x, y, { color: Kt.elemColor(e) });
          const [w, col] = resistWord(er[e]);
          G().text(w, x + 16, y, { color: col });
          if (boost[e]) G().text('威力' + (boost[e] > 0 ? '+' : '') + boost[e] + '%', x + 108, y, { align: 'right', color: G().C.orange });
        });
        G().rect(12, 98, 232, 1, '#3a4470');
        G().text('状態の守り', 14, 102, { color: Kt.COL.sub });
        const imm = st.statusImmune || m.statusImmune || [];
        const res = st.statusResist || m.statusResist || {};
        const ph = [];
        if (imm.length) ph.push({ text: imm.map(Kt.statusName).join('・') + 'が効かない', color: G().C.green });
        const rs = Object.keys(res).filter((s) => res[s] && !imm.includes(s));
        if (rs.length) ph.push({ text: rs.map(Kt.statusName).join('・') + 'にかかりにくい', color: '#ffffff' });
        if (!ph.length) G().text('なし', 80, 102, { color: Kt.COL.gray });
        else (Menu.packLines(ph, 2, 164)).forEach((l, i) => Kt.drawSegs(l.segs, 80, 102 + i * 14, 164));
        G().rect(12, 132, 232, 1, '#3a4470');
        G().text('特別な効果', 14, 136, { color: Kt.COL.sub });
        const skip = { elemResist: 1, elemBoost: 1, statusImmune: 1, statusResist: 1 };
        const mm = {};
        for (const k of Object.keys(m)) if (!skip[k]) mm[k] = m[k];
        const fx = Menu.modPhrases ? Menu.modPhrases(mm, null) : [];
        if (!fx.length) G().text('なし', 80, 136, { color: Kt.COL.gray });
        else Menu.packLines(fx, 5, 164).forEach((l, i) => Kt.drawSegs(l.segs, 80, 136 + i * 14, 164));
      }
    }
    /** an item's main number for the 装備 page: 攻撃力 / 術力 (staves) / 守備力 / the first stat of an accessory */
    function mainNumber(it) {
      if (!it) return '';
      if (it.type === 'weapon') return (it.mag || 0) > (it.atk || 0) ? '術力 ' + it.mag : '攻撃力 ' + (it.atk || 0);
      if (it.type === 'acc') {
        const st = it.stats || {};
        const k = Kt.STATS6.find((s) => st[s]);
        return k ? Kt.STAT_NAMES[k] + Kt.signed(st[k]) : '';
      }
      return '守備力 ' + (it.def || 0);
    }

    // ============================================================ 並びと隊列
    class OrderScreen extends Kt.Screen {
      constructor() {
        super();
        this.index = 0;
        this.first = -1; // index chosen for a swap
      }
      get party() { return R.Game.party; }
      input() {
        const n = this.party.length;
        const d = In().dirRepeat();
        if (d === 'up' || d === 'down') { this.index = (this.index + (d === 'up' ? n - 1 : 1)) % n; R.sfx('cursor'); }
        if (In().pressed('b')) {
          R.sfx('cancel');
          if (this.first >= 0) this.first = -1; else this.close();
          return;
        }
        if (!In().pressed('a')) return;
        if (this.first >= 0) {
          const a = this.first, b = this.index;
          this.first = -1;
          if (a === b) { R.sfx('cancel'); return; }
          const ids = this.party.map((c) => c.id);
          [ids[a], ids[b]] = [ids[b], ids[a]];
          const ok = R.Party && R.Party.setOrder ? R.Party.setOrder(ids) : (([this.party[a], this.party[b]] = [this.party[b], this.party[a]]), true);
          R.sfx(ok ? 'swap' : 'buzzer');
          return;
        }
        R.sfx('confirm');
        this.flow(async () => {
          const y = Math.min(8 + this.index * 30 + 20, 120);
          const i = await Kt.choose(['並びを入れ替える', '隊列を変える'], { x: 104, y, w: 128, cancel: true });
          if (i === 0) { this.first = this.index; return; }
          if (i === 1) {
            const c = this.party[this.index];
            const to = (c.row || 'front') === 'middle' ? 'front' : 'middle';
            const ok = R.Party && R.Party.setRow ? R.Party.setRow(c.id, to) : ((c.row = to), true);
            R.sfx(ok ? 'swap' : 'buzzer');
          }
        });
      }
      render() {
        const party = this.party;
        const x = 4, y = 4, w = 150;
        G().window(x, y, w, 134, { title: this.first >= 0 ? '誰と入れ替える？' : '並びと隊列' });
        party.forEach((c, i) => {
          const ry = y + 7 + i * 30;
          if (i === this.first) G().rect(x + 4, ry - 1, w - 8, 28, Kt.blink(10) ? '#2a3a74' : '#223060');
          Kt.drawMemberRow(c, x + 2, ry, w - 2, { anim: i === this.index });
          if (i === this.index) G().cursor(x + 3, ry + 8, !this.busy);
        });
        // front / middle counts
        const rows = party.map((c) => c.row || 'front');
        const eff = party.map((c) => Kt.effectiveRow(c));
        G().window(156, 4, 96, 134, { title: '隊列' });
        G().text('前列', 166, 14, { color: G().C.orange });
        G().text(rows.filter((r) => r !== 'middle').length + '人', 242, 14, { align: 'right' });
        G().text('中列', 166, 28, { color: G().C.cyan });
        G().text(rows.filter((r) => r === 'middle').length + '人', 242, 28, { align: 'right' });
        const frontAlive = party.some((c) => c.hp > 0 && (c.row || 'front') !== 'middle');
        const lines = !rows.some((r) => r !== 'middle')
          ? ['全員が中列だと、', '全員が前列として', '戦う。']
          : !frontAlive || eff.some((r, i) => r !== rows[i])
            ? ['前列が全員倒れて', 'いるので、中列が', '前に出て戦う。']
            : ['前列が全員倒れる', 'と、中列が前に', '出て戦う。'];
        // re-wrapped to the window (compact menus raise size 8 to the readable floor, Part A11)
        G().wrap(lines.join(''), 82, 8).slice(0, 4).forEach((l, i) => G().text(l, 164, 50 + i * 14, { color: !frontAlive ? G().C.yellow : Kt.COL.gray, size: 8 }));
        G().text('Aで選ぶ', 164, 112, { color: Kt.COL.gray, size: 8 });
        G().window(4, 140, 248, 80);
        ['前列：敵に狙われやすい。', '中列：受ける物理のダメージが減る。', '中列からは剣や斧などが届かない。', '槍・弓・鞭と術は、どこからでも届く。']
          .forEach((l, i) => Kt.fitText(l, 14, 147 + i * 16, 228, { color: i ? '#ffffff' : '#ffffff' }));
      }
    }

    // ============================================================ 図鑑
    class BookScreen extends Kt.Screen {
      constructor() {
        super();
        this.ids = monsterOrder();
        this.detail = false;
        this.page = 0;
        this.list = new R.UI.List({
          x: 4, y: 30, w: 150, h: 190, rows: 13, index: U.clamp(lastMon, 0, Math.max(0, this.ids.length - 1)),
          items: this.ids.map((id) => ({ id })),
          onChange: (i) => { lastMon = i; },
          drawItem: (row, x, y, w, i) => this.drawRow(row, x, y, i),
        });
        this.nSeen = this.ids.filter(seen).length;
        this.nBeat = this.ids.filter(beaten).length;
      }
      get id() { return this.ids[this.list.index]; }
      input() {
        if (this.detail) return this.inputDetail();
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select') {
          if (!seen(this.id)) { R.sfx('buzzer'); return; }
          this.detail = true; this.page = 0;
          R.sfx('page');
        }
      }
      inputDetail() {
        const d = In().dirRepeat();
        const lr = Kt.memberStep() || (d === 'left' ? -1 : d === 'right' ? 1 : 0);
        if (lr) {
          const n = this.ids.length;
          let i = this.list.index;
          for (let k = 0; k < n; k++) {
            i = (i + (lr < 0 ? n - 1 : 1)) % n;
            if (seen(this.ids[i])) break;
          }
          this.list.index = i; this.list.scrollTo(); lastMon = i;
          R.sfx('cursor');
        } else if (d === 'up' || d === 'down' || In().pressed('a')) {
          this.page = 1 - this.page;
          R.sfx('page');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.detail = false; }
      }
      drawRow(row, x, y, i) {
        const id = row.id, m = DB.monsters[id];
        const s = seen(id), b = beaten(id);
        G().text(pad3(i + 1), x, y, { color: Kt.COL.gray });
        let nx = x + 20;
        if (s && isRareMon(id)) { G().text('★', nx, y, { color: G().C.gold }); nx += 11; }
        Kt.fitText(s ? m.name : '？？？？？', nx, y, 132 - nx, { color: s ? (b ? '#ffffff' : Kt.COL.gray) : Kt.COL.dim });
        // three dots: normal / rare / super, coloured once obtained
        const cols = ['#ffffff', G().C.rare, G().C.super];
        slotsOf(id).forEach((sl, k) => {
          if (!sl.has) return;
          G().rect(this.list.x + 132 + k * 5, y + 5, 3, 3, sl.got ? cols[k] : Kt.COL.dim);
        });
      }
      render() {
        if (this.detail) { this.renderDetail(); return; }
        G().window(4, 4, 248, 24);
        G().text('図鑑', 14, 10, { color: G().C.yellow });
        G().text('見つけた ' + this.nSeen + '/' + this.ids.length, 150, 10, { align: 'right' });
        G().text('倒した ' + this.nBeat, 242, 10, { align: 'right' });
        this.list.draw();
        const id = this.id, m = DB.monsters[id];
        G().window(156, 30, 96, 120);
        if (m && seen(id)) {
          G().rect(162, 134, 84, 1, '#34406a');
          drawMon(id, 204, 134, 84, 96, false);
          K().fitText(m.name, 204, 136, 84, { align: 'center', color: isRareMon(id) ? G().C.gold : '#ffffff', size: 8 });
        } else if (m) G().text('？', 204, 76, { align: 'center', color: Kt.COL.dim, size: 24 });
        G().window(156, 152, 96, 68);
        if (m && seen(id)) {
          const r = rec(id) || {};
          G().text('倒した数', 164, 159, { color: Kt.COL.sub });
          G().text(String(r.kills || 0), 244, 173, { align: 'right' });
          if (r.gold) { G().text('金色', 164, 187, { color: G().C.gold }); G().text(String(r.gold), 244, 187, { align: 'right', color: G().C.gold }); }
          else G().text('Aで詳しく', 164, 201, { color: Kt.COL.gray, size: 8 });
        } else { G().text('まだ出会って', 164, 162, { color: Kt.COL.gray }); G().text('いない', 164, 176, { color: Kt.COL.gray }); }
      }
      renderDetail() {
        const id = this.id, m = DB.monsters[id];
        const r = rec(id) || {};
        const kn = known(id);
        G().window(4, 4, 248, 26);
        G().text('No.' + pad3(this.list.index + 1), 14, 11, { color: Kt.COL.gray });
        let nx = 66;
        if (isRareMon(id)) { G().text('★', nx, 11, { color: G().C.gold }); nx += 11; }
        Kt.fitText(m.name, nx, 11, 130, { color: isRareMon(id) ? G().C.gold : isBoss(id) ? G().C.orange : '#ffffff' });
        G().text((this.page + 1) + '/2', 244, 11, { align: 'right', color: Kt.COL.sub });
        G().window(4, 32, 108, 104);
        G().rect(10, 118, 96, 12, '#141a34');
        G().rect(10, 118, 96, 1, '#34406a');
        drawMon(id, 58, 124, 96, 88, false);
        G().text('◀', 12, 76, { color: Kt.COL.gray, size: 8 });
        G().text('▶', 104, 76, { align: 'right', color: Kt.COL.gray, size: 8 });
        if (this.page === 0) this.detail1(id, m, r, kn);
        else this.detail2(id, m, r, kn);
      }
      detail1(id, m, r, kn) {
        const q = (v) => (kn ? String(v == null ? '―' : v) : '？？？');
        G().window(114, 32, 138, 104, { title: '能力（目安）' });
        const rows = [['Lv', m.lv != null ? m.lv : '―', true], ['HP', m.hp], ['攻撃', m.atk], ['守備', m.def], ['術力', m.mag], ['素早さ', m.agi]];
        rows.forEach(([k, v, always], i) => {
          const y = 41 + i * 14;
          G().text(k, 124, y, { color: Kt.COL.sub });
          G().text(always ? String(v) : q(v), 244, y, { align: 'right', color: always || kn ? '#ffffff' : Kt.COL.gray });
        });
        const x = 4, y = 138;
        G().window(x, y, 248, 82);
        G().text('経験値', x + 8, y + 6, { color: Kt.COL.sub });
        G().text(q(m.exp), x + 44, y + 6, { color: kn ? '#ffffff' : Kt.COL.gray });
        G().text('ゴールド', x + 88, y + 6, { color: Kt.COL.sub });
        G().text(q(m.gold), x + 134, y + 6, { color: kn ? '#ffffff' : Kt.COL.gray });
        G().text('落とす', x + 190, y + 6, { align: 'center', color: Kt.COL.sub });
        G().text('盗む', x + 226, y + 6, { align: 'center', color: Kt.COL.sub });
        bookDropRows(id).forEach((row, i) => {
          const yy = y + 20 + i * 14;
          G().text(row.label, x + 8, yy, { color: Kt.COL.sub });
          Kt.fitText(row.text, x + 44, yy, 120, { color: row.color });
          G().text(row.drop, x + 190, yy, { align: 'center', color: row.drop === '○' ? '#ffffff' : Kt.COL.gray });
          G().text(row.steal, x + 226, yy, { align: 'center', color: row.steal === '○' ? '#ffffff' : Kt.COL.gray });
        });
        Kt.fitText(String(m.desc || '').split('\n')[0], x + 8, y + 62, 232, { color: '#d8d8e8' });
      }
      detail2(id, m, r, kn) {
        G().window(114, 32, 138, 104, { title: '特徴' });
        const fl = flagsOf(m);
        const tags = [];
        if (fl.includes('flying')) tags.push('飛ぶ');
        if (fl.includes('metal')) tags.push('鋼');
        if (fl.includes('boss')) tags.push('ボス');
        if (fl.includes('rare')) tags.push('めずらしい');
        const aff = kn && m.affinity ? m.affinity : null;
        const rows = [
          ['種族', Kt.raceName(m.race) || '―', '#ffffff'],
          ['特徴', tags.join('・') || 'なし', tags.length ? G().C.yellow : Kt.COL.gray],
          ['親和', aff ? Kt.elemName(aff) + 'の力' : kn ? 'なし' : '？？？', aff ? Kt.elemColor(aff) : Kt.COL.gray],
          ['倒した数', String(r.kills || 0), G().C.cyan],
          ['金色', String(r.gold || 0), r.gold ? G().C.gold : Kt.COL.gray],
        ];
        rows.forEach(([k, v, col], i) => {
          const y = 41 + i * 14;
          G().text(k, 124, y, { color: Kt.COL.sub });
          Kt.fitText(v, 244, y, 70, { align: 'right', color: col });
        });
        const x = 4, y = 138;
        G().window(x, y, 248, 82, { title: '弱点と耐性' });
        if (!kn) {
          G().text('倒すか、見破ると分かる。', x + 10, y + 8, { color: Kt.COL.gray });
        } else {
          const el = m.elem || {};
          const weak = [], half = [], none = [], drain = [];
          for (const e of Kt.elems()) {
            const v = el[e] == null ? 1 : el[e];
            if (v > 1) weak.push(Kt.elemName(e));
            else if (v < 0) drain.push(Kt.elemName(e));
            else if (v === 0) none.push(Kt.elemName(e));
            else if (v < 1) half.push(Kt.elemName(e));
          }
          const ph = m.phys || {};
          const KIND = { slash: '斬', blunt: '打', pierce: '突' };
          for (const k of Object.keys(KIND)) { const v = ph[k]; if (v != null && v > 1) weak.push(KIND[k]); else if (v != null && v < 1) half.push(KIND[k]); }
          const l1 = [];
          if (weak.length) l1.push({ text: weak.join('・') + 'に弱い', color: G().C.green });
          const l2 = [];
          if (half.length) l2.push({ text: half.join('・') + 'が効きにくい', color: G().C.orange });
          if (none.length) l2.push({ text: none.join('・') + 'が効かない', color: G().C.orange });
          if (drain.length) l2.push({ text: drain.join('・') + 'を吸う', color: G().C.red });
          const sr = m.statusRes || {};
          const imm = Object.keys(sr).filter((s) => sr[s] >= 1).map(Kt.statusName);
          const lines = [];
          lines.push(l1.length ? l1 : [{ text: '弱点は見つからない。', color: Kt.COL.gray }]);
          if (l2.length) lines.push(l2);
          if (imm.length) lines.push([{ text: imm.join('・') + 'が効かない', color: '#ffffff' }]);
          lines.slice(0, 3).forEach((segs, i) => { const j = Menu.packLines(segs, 1, 228)[0]; if (j) Kt.drawSegs(j.segs, x + 10, y + 8 + i * 14, 228); });
        }
        const dl = String(m.desc || '').split('\n');
        dl.slice(0, 2).forEach((l, i) => Kt.fitText(l, x + 10, y + 50 + i * 14, 228, { color: '#d8d8e8' }));
      }
    }

    return { StatusScreen, OrderScreen, BookScreen };
  }
})(window.RPG);
