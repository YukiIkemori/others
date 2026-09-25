// gear-a (A10a) visual check — only in debug_gear-a.html (node tools/build.js --with tools/fixtures/gear-a).
//   ?geara=sheet&set=<name>&p=<page>   contact sheet of armor / accessories, 4 per page, drawn with the menu's own
//                                     window and text (★ colours, icon, numbers, the 2-line desc at the item
//                                     screen's width 226). set: int8 str8 dex8 band7 band9 relic reward support
//                                     monster longest (the 40 widest descs) — or an id list: set=bd_sr_starry,ac_rs_prism
//   RPG.GearASheet.measure()          → pixel widths of every gear-a name / desc line against the menu columns
//   RPG.GearASheet.play(o)            → quickStart + one of every armor / accessory in the bag (for the real menus)
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const DB = R.DB;
  const q = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
  const MINE = () => Object.keys(DB.items).filter((id) => /^(bd|hd|sh|hn|ft|ac)_/.test(id));
  const TYPE = { shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc: 'アクセサリ' };
  const WEIGHT = { heavy: '重装', light: '軽装', cloth: '布' };
  const GRADE = { normal: '', rare: 'レア', super: '超レア' };
  const SN = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const SETS = {
    int8: ['sh_sr_blank', 'hd_sr_dusk', 'bd_sr_starry', 'hn_sr_words', 'ft_sr_cloud', 'ac_sr_owl', 'ac_sr_ink', 'bd_robe_8'],
    str8: ['sh_sr_steadfast', 'hd_sr_oni', 'bd_sr_dragonhide', 'hn_sr_mighty', 'ft_sr_quake', 'ac_sr_beastheart', 'ac_sr_bloodoath', 'bd_mail_8'],
    dex8: ['sh_sr_phantom', 'hd_sr_heaveneye', 'bd_sr_shadow', 'hn_sr_hundred', 'ft_sr_whirl', 'ac_sr_eagle', 'ac_sr_needle', 'bd_vest_8'],
  };
  const pick = (set) => {
    const all = MINE();
    if (SETS[set]) return SETS[set];
    if (/^band\d$/.test(set)) return all.filter((id) => DB.items[id].src === 'drop' && DB.items[id].tier === +set[4]);
    if (set === 'relic' || set === 'reward') return all.filter((id) => DB.items[id].src === set);
    if (set === 'support') return all.filter((id) => (DB.items[id].line || '').startsWith('charm_'));
    if (set === 'monster') return all.filter((id) => DB.items[id].src === 'mdrop' || (DB.items[id].src === 'super' && /_\d$|^[a-z]+_[a-z]+_\d/.test(DB.items[id].exclusive || '')));
    if (set === 'longest') return all.sort((a, b) => wmax(b) - wmax(a)).slice(0, 40);
    if (set && set.includes(',')) return set.split(',');
    return all;
  };
  const tw = (s) => G().textWidth(s);
  const wmax = (id) => Math.max(...String(DB.items[id].desc || '').split('\n').map(tw));
  const K = () => R.Menu && R.Menu.kit;
  function numbers(it) {
    const out = [];
    if (it.def !== undefined) out.push(`守${it.def} 防${it.mdef}${it.eva ? ' 回避' + it.eva : ''}`);
    for (const [k, v] of Object.entries(it.stats || {})) if (v) out.push(`${SN[k]}${v > 0 ? '+' : ''}${v}`);
    if (!out.length) out.push('能力値の増減なし');
    return out.join('  ');
  }
  function color(it) {
    const kit = K();
    if (kit && kit.itemColor) return kit.itemColor(Object.keys(DB.items).find((k) => DB.items[k] === it));
    return it.unique ? '#78e0ff' : it.grade === 'super' ? '#ff88d0' : it.grade === 'rare' ? '#f8d838' : '#ffffff';
  }
  function label(it, id) {
    const kit = K();
    if (kit && kit.itemLabel) return kit.itemLabel(id);
    return (it.unique ? '◆' : it.grade !== 'normal' ? '★' : '') + it.name;
  }

  class Sheet extends R.Layer {
    constructor(ids, page) { super(); this.opaque = true; this.ids = ids; this.page = page; this.pages = Math.max(1, Math.ceil(ids.length / 4)); }
    update() {
      const In = R.Input;
      if (In.pressed('right') || In.pressed('down')) this.page = (this.page + 1) % this.pages;
      if (In.pressed('left') || In.pressed('up')) this.page = (this.page + this.pages - 1) % this.pages;
    }
    draw() {
      G().clear('#101018');
      const ids = this.ids.slice(this.page * 4, this.page * 4 + 4);
      ids.forEach((id, i) => {
        const it = DB.items[id];
        const y = 1 + i * 55;
        G().window(4, y, 248, 54);
        if (!it) { G().text('？？？ ' + id, 14, y + 6, { color: '#ff5a4a' }); return; }
        if (K() && K().drawIcon) K().drawIcon(it, 12, y + 7);
        const lab = label(it, id);
        if (K() && K().fitText) K().fitText(lab, 23, y + 5, 116, { color: color(it) }); else G().text(lab, 23, y + 5, { color: color(it) });
        const tag = `${TYPE[it.type]}${it.weight ? '・' + WEIGHT[it.weight] : ''} T${it.tier}${GRADE[it.grade] ? ' ' + GRADE[it.grade] : ''}`;
        G().text(tag, 244, y + 5, { align: 'right', color: '#c8c8d8' });
        G().text(numbers(it), 14, y + 16, { color: '#78e0ff' });
        String(it.desc || '').split('\n').slice(0, 2).forEach((l, k) => {
          const w = tw(l);
          const fit = K() && K().fitText ? K().fitText : (s, x, yy, mw, o) => G().text(s, x, yy, o);
          fit(l, 14, y + 27 + k * 11, 226, { color: w > 226 ? '#ff5a4a' : '#ffffff' });
        });
      });
      G().text(`${this.page + 1}/${this.pages}`, 250, 214, { align: 'right', color: '#8c8c8c', size: 8 });
    }
  }

  R.GearASheet = {
    show(set, page) { R.Engine.layers.length = 0; R.Engine.push(new Sheet(pick(set), page | 0)); return pick(set).length; },
    /** widths in logical px: names (list column 116 with the mark, equip candidate 100), desc lines (item screen 226, equip 210) */
    measure() {
      const out = { items: 0, nameMax: 0, nameMaxId: '', descMax: 0, descMaxId: '', over: { name116: [], name100: [], desc226: [], desc213: [], desc210: [] } };
      for (const id of MINE()) {
        const it = DB.items[id];
        out.items++;
        const nw = tw(label(it, id));
        if (nw > out.nameMax) { out.nameMax = nw; out.nameMaxId = id; }
        if (nw > 116) out.over.name116.push(id);
        if (nw > 100) out.over.name100.push(id);
        for (const l of String(it.desc || '').split('\n')) {
          const w = tw(l);
          if (w > out.descMax) { out.descMax = w; out.descMaxId = id; }
          if (w > 226) out.over.desc226.push(id);
          if (w > 213.4) out.over.desc213.push(id);
          if (w > 210) out.over.desc210.push(id);
        }
      }
      for (const k in out.over) out.over[k + 'Count'] = out.over[k].length;
      out.nameMax = Math.round(out.nameMax * 10) / 10; out.descMax = Math.round(out.descMax * 10) / 10;
      return out;
    },
    /** a started game with every armor / accessory in the bag (real menus: R.Menu.itemScreen, equipScreen, itemDetail) */
    async play(o) {
      await R.debug.quickStart(Object.assign({ tier: 8, level: 50, gear: 'tier', noEncounter: true }, o || {}));
      R.debug.giveAll('armor');
      R.debug.giveAll('acc');
      return R.Game.party.map((c) => c.name);
    },
  };
  const set = q.get('geara') === 'sheet' ? (q.get('set') || 'all') : null;
  if (set) R.on('booted', () => setTimeout(() => R.GearASheet.show(set, +(q.get('p') || 0)), 50));
})(window.RPG);
