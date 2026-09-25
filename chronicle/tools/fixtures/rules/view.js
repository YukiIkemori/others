// Visual check of rules A1 in the real renderer (fixture only; never shipped):
//   node tools/build.js --with tools/fixtures/rules      → debug_rules.html
//   node tools/shot.js --html debug_rules.html --eval "RPG.rulesView({page:'sheet', member:0})" --wait 300 --out x.png
// Pages: 'sheet' (stats of one member), 'gear' (9 slots and an optimize plan), 'apt' (aptitude
// letters and proficiency), 'growth' (max HP/MP/WP by level for the party, EXP per level).
// Everything shown is computed by R.Rules / R.State / R.Party at draw time.
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const C = () => R.Gfx.C;
  const LETTER_COL = { S: '#ff9040', A: '#f8d838', B: '#60d060', C: '#80b8ff', D: '#9090a0' };

  function heroLine(c) {
    const Ru = R.Rules;
    if (c.id === 'hero') {
      const t = R.DB.heroTypes[c.heroType];
      const fav = c.favor.kind === 'weapon' ? Ru.WTYPE_NAMES[c.favor.id] : Ru.ELEMENT_NAMES[c.favor.id];
      return ((t && t.name) || c.heroType) + '　' + fav + 'が得意';
    }
    const d = R.DB.companions[c.id];
    return (d && d.title) || '';
  }
  function header(c, page) {
    const g = G();
    g.window(4, 4, 248, 40);
    const spr = R.Party.spriteKey(c);
    if (g.has(spr)) { const s = g.get(spr); const f = (s && s.down && s.down[0]) || s; if (f && f.width) g.draw(f, 12, 12); }
    g.text(c.name, 34, 10);
    g.text('Lv' + c.level, 150, 10, { align: 'right' });
    g.text(heroLine(c), 34, 24, { color: '#c8c8d8' });
    const row = R.Rules.effectiveRow(c);
    g.text(row === 'middle' ? '中列' : '前列', 244, 10, { align: 'right', color: row === 'middle' ? C().cyan : C().orange });
    g.text(page, 244, 24, { align: 'right', color: '#808090' });
  }
  function sheet(c) {
    const g = G(), Ru = R.Rules;
    const s = Ru.stats(c), base = Ru.baseStats(c);
    g.window(4, 46, 122, 128);
    let y = 52;
    for (const k of ['hp', 'mp', 'wp']) {
      g.text(Ru.STAT_NAMES[k], 12, y, { color: '#c8c8d8' });
      g.text(c[k] + '/' + s[k], 118, y, { align: 'right' });
      y += 13;
    }
    g.rect(12, y + 1, 106, 1, '#303048');
    y += 3;
    for (const k of Ru.STATS) {
      g.text(Ru.STAT_NAMES[k], 12, y, { color: '#c8c8d8' });
      const plus = s[k] - base[k];
      g.text(String(s[k]), 92, y, { align: 'right' });
      if (plus) g.text((plus > 0 ? '+' : '') + plus, 118, y, { align: 'right', color: plus > 0 ? C().green : C().red });
      y += 13;
    }
    g.window(130, 46, 122, 128);
    const D = [['攻撃1', s.atk1], ['攻撃2', s.w.weapon2 ? s.atk2 : '―'], ['術力', s.mag], ['守備', s.def], ['術防', s.mdef], ['命中', s.hit], ['回避', s.eva], ['会心', s.crit + '%']];
    y = 54;
    for (const [n, v] of D) { g.text(n, 138, y, { color: '#c8c8d8' }); g.text(String(v), 244, y, { align: 'right' }); y += 14; }
    g.window(4, 176, 248, 44);
    g.text('経験値', 12, 184, { color: '#c8c8d8' });
    g.text(String(c.exp), 150, 184, { align: 'right' });
    g.text('次のレベルまで', 12, 198, { color: '#c8c8d8' });
    g.text(String(Ru.expToNext(c)), 150, 198, { align: 'right' });
    const m = Ru.mods(c);
    const tags = [];
    if (m.expPct) tags.push('経験値' + (m.expPct > 0 ? '+' : '') + m.expPct + '%');
    if (m.encounterPct) tags.push('出会い' + (m.encounterPct > 0 ? '+' : '') + m.encounterPct + '%');
    if (m.goldPct) tags.push('お金+' + m.goldPct + '%');
    if (m.autoSteal) tags.push('ついでに盗む');
    g.text(tags.slice(0, 2).join('　'), 244, 184, { align: 'right', color: C().cyan });
  }
  function gear(c, mode) {
    const g = G(), Ru = R.Rules;
    const plan = Ru.optimize(c, mode || 'phys');
    g.window(4, 46, 248, 138);
    let y = 54;
    for (const s of Ru.SLOTS) {
      const id = c.equip[s];
      const it = id && R.DB.items[id];
      g.text(Ru.SLOT_NAMES[s], 12, y, { color: '#c8c8d8' });
      const to = plan.equip[s];
      const changed = s in plan.equip && to !== (id || null);
      const name = it ? it.name : s === 'shield' && Ru.hasTwoHanded(c) ? '（両手持ち）' : '―';
      g.fitText(name, 60, y, 88, { color: it ? (it.grade === 'super' ? '#ff88d0' : it.grade === 'rare' ? '#f8d838' : C().white) : '#808090' });
      if (changed) g.fitText('▶ ' + (to ? R.DB.items[to].name : '外す'), 152, y, 94, { color: C().green });
      y += 14;
    }
    g.window(4, 186, 248, 34);
    const d = plan.diff;
    const parts = Ru.DIFF_KEYS.filter((k) => d[k]).map((k) => Ru.DIFF_NAMES[k] + (d[k] > 0 ? '+' : '') + d[k]);
    g.fitText(plan.changes.length ? parts.join('　') : '今の装備がいちばんだ。', 12, 197, 232, { color: plan.changes.length ? C().white : '#c8c8d8' });
  }
  function apt(c) {
    const g = G(), Ru = R.Rules;
    const L = Ru.aptLetters(c);
    g.window(4, 46, 248, 174);
    const line = (x, y, name, letter, pts) => {
      const r = Ru.profRank(pts);
      g.text(name, x, y, { color: '#c8c8d8' });
      g.text(letter, x + 36, y, { color: LETTER_COL[letter] });
      g.text(String(r), x + 60, y, { align: 'right' });
      for (let i = 0; i < 10; i++) g.rect(x + 66 + i * 5, y + 4, 4, 5, i < r ? LETTER_COL[letter] : '#303040');
    };
    let y = 54;
    for (const w of Ru.WTYPES) { line(12, y, Ru.WTYPE_NAMES[w], L.w[w], c.wprof[w]); y += 14; }
    y = 54;
    for (const e of Ru.ELEMENTS) { line(128, y, Ru.ELEMENT_NAMES[e], L.e[e], c.eprof[e]); y += 14; }
    const S = { S: 4, A: 3, B: 2, C: 1, D: 0 };
    const ws = Ru.WTYPES.reduce((a, w) => a + S[L.w[w]], 0), es = Ru.ELEMENTS.reduce((a, e) => a + S[L.e[e]], 0);
    g.text('武器計 ' + ws + '　属性計 ' + es, 128, 54 + 14 * 7, { color: '#808090' });
    const techs = Ru.allTechs(c).length, spells = Ru.spellList(c).length;
    g.text('技 ' + techs + '　術 ' + spells, 128, 54 + 14 * 8, { color: '#808090' });
  }
  function plot(x, y, w, h, key, cap, ticks, title, party, cols) {
    const g = G(), Ru = R.Rules;
    g.window(x, y, w, h);
    g.text(title, x + 8, y + 5, { color: '#c8c8d8' });
    const X0 = x + 30, Y0 = y + h - 16, W = w - 40, H = h - 42;
    for (const v of ticks) {
      const yy = Y0 - Math.round(v / cap * H);
      g.rect(X0, yy, W, 1, '#2a2a3c');
      g.text(String(v), X0 - 3, yy - 5, { align: 'right', color: '#808090', size: 8 });
    }
    g.rect(X0, Y0, W, 1, '#606070'); g.rect(X0, Y0 - H, 1, H + 1, '#606070');
    for (const L of [1, 50, 99]) g.text(String(L), X0 + Math.round((L - 1) / 98 * W), Y0 + 2, { align: 'center', color: '#808090', size: 8 });
    party.forEach((c, i) => {
      let py = null;
      for (let L = 1; L <= 99; L++) {
        const px = X0 + Math.round((L - 1) / 98 * W);
        const nx = L < 99 ? X0 + Math.round(L / 98 * W) : px + 1;
        const v = Ru.maxAt(c, key, L);
        const ny = Y0 - Math.round(v / cap * H);
        const top = py == null ? ny : Math.min(py, ny), bot = py == null ? ny : Math.max(py, ny);
        g.rect(px, top, 1, bot - top + 1, cols[i]);
        g.rect(px, ny, Math.max(1, nx - px), 1, cols[i]);
        py = ny;
      }
    });
  }
  function growth() {
    const g = G();
    const party = R.Game.party;
    const cols = [C().orange, C().cyan, C().green, C().pink];
    plot(4, 4, 248, 124, 'hp', 1000, [250, 500, 750, 999], '最大HP　Lv1〜99（今の装備で）', party, cols);
    plot(4, 130, 122, 68, 'mp', 150, [50, 100, 150], '最大MP', party, cols);
    plot(130, 130, 122, 68, 'wp', 100, [50, 99], '最大WP', party, cols);
    g.window(4, 200, 248, 20);
    party.forEach((c, i) => {
      g.rect(12 + i * 60, 207, 6, 6, cols[i]);
      g.fitText(c.name, 21 + i * 60, 203, 46, { color: cols[i] });
    });
  }

  class RulesView extends R.Layer {
    constructor(o) { super(); this.opaque = true; this.o = o || {}; }
    update() {
      const I = R.Input;
      const n = R.Game.party.length;
      if (I.pressed('r')) this.o.member = ((this.o.member || 0) + 1) % n;
      if (I.pressed('l')) this.o.member = ((this.o.member || 0) + n - 1) % n;
      if (I.pressed('b')) this.close();
    }
    draw() {
      const g = G();
      g.rect(0, 0, R.W, R.H, '#101018');
      const c = R.Game.party[this.o.member || 0];
      const page = this.o.page || 'sheet';
      if (page === 'growth') return growth();
      header(c, { sheet: '能力', gear: '最強装備', apt: '熟練度' }[page] || page);
      if (page === 'gear') gear(c, this.o.mode);
      else if (page === 'apt') apt(c);
      else sheet(c);
    }
  }
  R.RulesView = RulesView;
  /** set up a sample game (unless o.keep) and show a page */
  R.rulesView = function (o) {
    o = o || {};
    if (!o.keep || !R.Game) {
      R.State.newGame(o.hero || null, { companions: o.companions || ['brigitta', 'marta', 'sylvain'] });
      const lv = o.level || 24;
      for (const c of R.State.all()) R.Rules.setLevel(c, lv);
      R.Game.regionsCleared = ['r_forest', 'r_desert', 'r_snow'].slice(0, o.tier == null ? 3 : o.tier);
      R.Game.tier = R.Game.regionsCleared.length;
      for (const [id, n] of Object.entries(o.items || {})) R.State.addItem(id, n);
      if (o.gearTier != null) {
        for (const id in R.DB.items) {
          const it = R.DB.items[id];
          if (it.src === 'shop' && it.tier === o.gearTier && R.Rules.EQUIP_TYPES.includes(it.type) && it.type !== 'acc') R.State.addItem(id, 1);
        }
      }
      for (const c of R.State.all()) { R.Rules.clampHpMp(c); if (o.hurt) { c.hp = Math.ceil(c.hp * 0.6); c.mp = Math.floor(c.mp / 2); } }
    }
    for (const l of R.Engine.layers.slice()) if (l instanceof RulesView) l.close();
    R.Engine.push(new RulesView(o));
    return R.Game.party.map((c) => c.name + ' Lv' + c.level).join(', ');
  };
})(window.RPG);
