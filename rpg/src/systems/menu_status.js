// Field menu: つよさ (3-page status per member), ならびかえ (swap order) and
// ずかん (monster book: list + detail with sprite, stats, drops, resistances).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  let lastMember = 0;
  let lastPage = 0;
  let lastMon = 0;

  let C = null;
  const cls = () => C || (C = build());
  Menu.statusScreen = (o) => R.Engine.run(new (cls().StatusScreen)(o || {}));
  Menu.bookScreen = () => R.Engine.run(new (cls().BookScreen)());

  /** ならびかえ: pick two members and swap them (repeat until B) */
  Menu.orderScreen = async function () {
    const party = R.Game.party;
    let a = 0;
    for (;;) {
      a = await Menu.pickMember({ title: 'だれを いれかえる？', initial: a, x: 53, y: 40 });
      if (a < 0) return;
      const b = await Menu.pickMember({
        title: 'だれと いれかえる？', initial: a, x: 53, y: 40, mark: a,
        info: (x, y) => { G().window(x, y, 150, 24); G().text(party[a].name + 'と …', x + 12, y + 6, { color: G().C.yellow }); },
      });
      if (b < 0 || b === a) continue;
      [party[a], party[b]] = [party[b], party[a]];
      R.sfx('confirm_soft');
      a = b;
    }
  };

  // ------------------------------------------------------------ monster list
  /** book order: regular monsters by level, bosses last (stable) */
  function monsterOrder() {
    const ids = Object.keys(DB.monsters);
    const boss = (id) => ((DB.monsters[id].flags || []).includes('boss') ? 1 : 0);
    return ids.map((id, i) => ({ id, i })).sort((p, q) => boss(p.id) - boss(q.id) || (DB.monsters[p.id].lv || 0) - (DB.monsters[q.id].lv || 0) || p.i - q.i).map((p) => p.id);
  }
  Menu.monsterOrder = monsterOrder;
  const rec = (id) => (R.Game.bestiary && R.Game.bestiary[id]) || null;
  const seen = (id) => { const b = rec(id); return !!(b && (b.seen || b.kills)); };
  const beaten = (id) => { const b = rec(id); return !!(b && b.kills); };
  function monSprite(m) {
    const key = 'mon:' + m.sprite;
    if (!G().has(key)) return null;
    const v = m.hue || m.sat != null || m.bri != null || m.pal ? G().variant(key, { hue: m.hue, sat: m.sat, bri: m.bri, pal: m.pal }) : G().get(key);
    return Array.isArray(v) ? v[0] : v;
  }
  /** draw a monster sprite centred on (cx, bottom), scaled down to fit maxW x maxH */
  function drawMon(m, cx, bottom, maxW, maxH, dark) {
    const img = monSprite(m);
    if (!img) { G().text('？', cx, bottom - 20, { align: 'center', color: G().C.gray }); return; }
    let s = 1;
    while ((img.width * s > maxW || img.height * s > maxH) && s > 0.25) s /= 2;
    const w = img.width * s, h = img.height * s;
    if (dark) G().drawTinted(img, cx - w / 2, bottom - h, '#000000', 0.85);
    else G().draw(img, cx - w / 2, bottom - h, s !== 1 ? { w, h } : null);
  }
  const pad3 = (n) => U.padL(n, 3, '0');

  function build() {
    const K = Menu.kit;

    // ============================================================ つよさ
    const PAGES = ['のうりょく', 'そうび・アビリティ', 'たいせい・とくせい'];
    class StatusScreen extends K.Screen {
      constructor(o) {
        super();
        this.m = o.member != null ? o.member : lastMember < R.Game.party.length ? lastMember : 0;
        this.page = lastPage;
      }
      get c() { return R.Game.party[this.m]; }
      input() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          const n = R.Game.party.length;
          this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
          lastMember = this.m;
          R.sfx('cursor');
        } else if (d === 'up' || d === 'down') {
          this.page = (this.page + (d === 'up' ? PAGES.length - 1 : 1)) % PAGES.length;
          lastPage = this.page;
          R.sfx('cursor');
        }
        if (In().pressed('a')) { this.page = (this.page + 1) % PAGES.length; lastPage = this.page; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); }
      }
      render() {
        const c = this.c;
        const st = R.Rules.stats(c);
        // header
        G().window(4, 4, 248, 40);
        K.drawSprite(c, 26, 38, { frame: Math.floor(R.Engine.frame / 20) });
        G().text(c.name, 42, 10, { color: K.condColor(c) });
        const stt = K.statusText(c);
        if (stt) G().text(stt.text, 42 + G().textWidth(c.name) + 8, 10, { color: stt.color });
        G().text('Lv ' + c.level, 150, 10);
        G().text(K.jobName(c.job) + ' Lv' + R.Rules.jobLevel(c, c.job), 42, 24, { color: G().C.cyan });
        G().text('JP ' + ((c.jobs[c.job] && c.jobs[c.job].jp) || 0), 240, 24, { align: 'right', color: G().C.yellow });
        G().text((this.page + 1) + '/' + PAGES.length, 240, 10, { align: 'right', color: G().C.gray });
        K.lrArrows(8, 248, 18);
        if (this.page === 0) this.page1(c, st);
        else if (this.page === 1) this.page2(c, st);
        else this.page3(c, st);
      }
      page1(c, st) {
        G().window(4, 46, 122, 128, { title: 'きほん' });
        const L = [['HP', c.hp + '/' + st.hp], ['MP', c.mp + '/' + st.mp], ['ちから', st.str], ['たいりょく', st.vit], ['すばやさ', st.agi], ['かしこさ', st.int], ['せいしん', st.mnd], ['うんのよさ', st.luk]];
        L.forEach(([k, v], i) => { G().text(k, 13, 55 + i * 14, { color: G().C.gray }); G().text(String(v), 117, 55 + i * 14, { align: 'right', color: i === 0 ? K.condColor(c) === G().C.purple ? G().C.white : K.condColor(c) : G().C.white }); });
        G().window(130, 46, 122, 128, { title: 'せんとう' });
        const Rr = [['こうげき', st.atk2 ? st.atk + '/' + st.atk2 : st.atk], ['しゅび', st.def], ['まりょく', st.mag], ['まぼうぎょ', st.mdef], ['めいちゅう', st.hit], ['かいひ', st.eva], ['かいしん', st.crit + '%'], ['ぞくせい', st.element ? K.elemName(st.element) : 'なし']];
        Rr.forEach(([k, v], i) => { G().text(k, 139, 55 + i * 14, { color: G().C.gray }); G().text(String(v), 243, 55 + i * 14, { align: 'right' }); });
        G().window(4, 176, 248, 44);
        G().text('けいけんち', 14, 183, { color: G().C.gray });
        G().text(String(c.exp), 240, 183, { align: 'right' });
        G().text('つぎの レベルまで', 14, 197, { color: G().C.gray });
        const nx = R.Rules.expToNext(c);
        G().text(c.level >= R.Rules.MAX_LEVEL ? '―' : String(nx), 240, 197, { align: 'right', color: G().C.yellow });
      }
      page2(c) {
        G().window(4, 46, 248, 86, { title: 'そうび' });
        const SL = [['weapon', 'ぶき'], ['shield', R.Rules.mods(c, { ignoreEquip: true }).twoSwords ? 'ひだりて' : 'たて'], ['head', 'あたま'], ['body', 'からだ'], ['acc', 'アクセサリ']];
        SL.forEach(([s, lbl], i) => {
          const y = 55 + i * 14;
          G().text(lbl, 14, y, { color: G().C.gray });
          const id = c.equip[s];
          if (id) { K.drawIcon(DB.items[id], 76, y + 2); G().text(K.itemLabel(id), 88, y, { color: DB.items[id].rare ? G().C.yellow : G().C.white }); }
          else G().text('―――', 88, y, { color: G().C.dark });
        });
        G().window(4, 134, 248, 86, { title: 'アビリティ' });
        const cmd = (j) => (DB.jobs[j] && DB.jobs[j].command) || '';
        const AL = [
          ['コマンド', cmd(c.job), K.KIND_COLORS.action],
          ['サブ', c.set.sub ? cmd(c.set.sub) + '（' + K.jobName(c.set.sub) + '）' : '', K.KIND_COLORS.action],
          ['リアクション', c.set.reaction ? K.abName(c.set.reaction) : '', K.KIND_COLORS.reaction],
          ['サポート', c.set.support ? K.abName(c.set.support) : '', K.KIND_COLORS.support],
          ['フィールド', c.set.field ? K.abName(c.set.field) : '', K.KIND_COLORS.field],
        ];
        AL.forEach(([lbl, v, col], i) => {
          const y = 143 + i * 14;
          G().text(lbl, 14, y, { color: col });
          G().text(v || '―――', 88, y, { color: v ? G().C.white : G().C.dark });
        });
      }
      page3(c, st) {
        const m = st.mods || {};
        const res = m.elemResist || {}, boost = m.elemBoost || {};
        G().window(4, 46, 248, 72, { title: 'ぞくせい' });
        K.ELEMS.forEach((e, i) => {
          const x = 14 + (i % 2) * 120, y = 55 + Math.floor(i / 2) * 14;
          G().text(K.elemName(e), x, y, { color: G().C.gray });
          const r = res[e];
          let t = '―', col = G().C.dark;
          if (r != null && r < 0) { t = 'きゅうしゅう'; col = G().C.cyan; }
          else if (r === 0) { t = 'むこう'; col = G().C.green; }
          else if (r != null && r < 1) { t = 'たいせい'; col = G().C.green; }
          else if (r != null && r > 1) { t = 'よわい'; col = G().C.red; }
          if (boost[e]) { t = (t === '―' ? '' : t + ' ') + 'いりょく+' + boost[e]; col = t.startsWith('いりょく') ? G().C.orange : col; }
          G().text(t, x + 110, y, { align: 'right', color: col });
        });
        G().window(4, 120, 248, 72, { title: 'じょうたい' });
        const imm = m.statusImmune || [];
        ['poison', 'sleep', 'paralyze', 'confuse', 'silence', 'blind', 'death'].forEach((s, i) => {
          const x = 14 + (i % 2) * 120, y = 129 + Math.floor(i / 2) * 14;
          G().text(K.statusName(s), x, y, { color: G().C.gray });
          const on = imm.includes(s);
          G().text(on ? 'むこう' : '―', x + 110, y, { align: 'right', color: on ? G().C.green : G().C.dark });
        });
        G().window(4, 194, 248, 26);
        const tr = traits(m);
        K.fitText(tr.length ? tr.join(' ') : 'とくせい なし', 14, 201, 228, { color: tr.length ? G().C.white : G().C.dark });
      }
    }

    /** short labels for notable modifiers */
    function traits(m) {
      const t = [];
      if (m.twoSwords) t.push('にとうりゅう');
      if (m.regen) t.push('さいせい');
      if (m.walkHeal) t.push('あるいて かいふく');
      if (m.encounterPct < 0) t.push('まものよけ');
      if (m.encounterPct > 0) t.push('まものよせ');
      if (m.noFloorDamage) t.push('ゆかダメージ むこう');
      if (m.treasureSense) t.push('たからさがし');
      if (m.expPct) t.push('EXP+' + m.expPct + '%');
      if (m.jpPct) t.push('JP+' + m.jpPct + '%');
      if (m.goldPct) t.push('G+' + m.goldPct + '%');
      if (m.dropPct || m.rarePct) t.push('ドロップ+' + ((m.dropPct || 0) + (m.rarePct || 0)) + '%');
      if (m.stealPct) t.push('ぬすみ+' + m.stealPct + '%');
      if (m.mpCostPct) t.push('MPしょうひ' + m.mpCostPct + '%');
      if (m.healPct) t.push('かいふく+' + m.healPct + '%');
      if (m.magicPct) t.push('まほう+' + m.magicPct + '%');
      if (m.physPct) t.push('こうげき+' + m.physPct + '%');
      if (m.escapePct) t.push('にげあし+' + m.escapePct + '%');
      if (m.preemptPct) t.push('せんせい+' + m.preemptPct + '%');
      return t;
    }

    // ============================================================ ずかん
    class BookScreen extends K.Screen {
      constructor() {
        super();
        this.ids = monsterOrder();
        this.detail = false;
        this.page = 0;
        this.list = new R.UI.List({
          x: 4, y: 46, w: 150, rows: 9, index: U.clamp(lastMon, 0, Math.max(0, this.ids.length - 1)),
          items: this.ids.map((id) => ({ id })),
          onChange: (i) => { lastMon = i; },
          drawItem: (row, x, y, w, i) => this.drawRow(row, x, y, w, i),
        });
        const all = this.ids.length;
        this.nSeen = this.ids.filter(seen).length;
        this.nBeat = this.ids.filter(beaten).length;
        this.all = all;
      }
      get id() { return this.ids[this.list.index]; }
      input() {
        if (this.detail) return this.inputDetail();
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select') {
          if (!seen(this.id)) { R.sfx('buzzer'); return; }
          this.detail = true; this.page = 0;
        }
      }
      inputDetail() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          // previous / next monster that has been seen
          const n = this.ids.length;
          let i = this.list.index;
          for (let k = 0; k < n; k++) {
            i = (i + (d === 'left' ? n - 1 : 1)) % n;
            if (seen(this.ids[i])) break;
          }
          this.list.index = i; this.list.scrollTo(); lastMon = i;
          R.sfx('cursor');
        } else if (d === 'up' || d === 'down' || In().pressed('a')) {
          this.page = 1 - this.page;
          R.sfx('cursor');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.detail = false; }
      }
      drawRow(row, x, y, w, i) {
        const s = seen(row.id), b = beaten(row.id);
        G().text(pad3(i + 1), x, y, { color: G().C.gray });
        const m = DB.monsters[row.id];
        G().text(s ? m.name : '？？？？？', x + 20, y, { color: s ? (b ? G().C.white : '#b0b0c0') : G().C.dark });
        const r = rec(row.id);
        if (r && r.rare) Menu.kitStar(x + w - 9, y + 3);
      }
      render() {
        if (this.detail) { this.renderDetail(); return; }
        G().window(4, 4, 248, 40);
        G().text('モンスター ずかん', 14, 10, { color: G().C.yellow });
        G().text('みつけた', 14, 24, { color: G().C.gray });
        G().text(this.nSeen + '/' + this.all, 110, 24, { align: 'right' });
        G().text('たおした', 130, 24, { color: G().C.gray });
        G().text(this.nBeat + '/' + this.all, 240, 24, { align: 'right' });
        this.list.draw();
        // preview
        G().window(156, 46, 96, 140);
        const id = this.id, m = DB.monsters[id];
        if (m && seen(id)) {
          G().rect(164, 150, 80, 1, '#2a2a40');
          drawMon(m, 204, 148, 80, 90, false);
          const r = rec(id) || {};
          G().text('たおした', 164, 158, { color: G().C.gray });
          G().text(String(r.kills || 0), 244, 172, { align: 'right' });
        } else if (m) {
          G().text('？', 204, 100, { align: 'center', color: G().C.dark, size: 24 });
        }
        G().window(4, 188, 248, 30);
        G().text(m && seen(id) ? 'A: くわしく みる' : 'まだ であって いない', 14, 196, { color: G().C.gray });
      }
      renderDetail() {
        const id = this.id, m = DB.monsters[id], r = rec(id) || {};
        const b = !!r.kills;
        // title
        G().window(4, 4, 248, 26);
        G().text('No.' + pad3(this.list.index + 1), 14, 11, { color: G().C.gray });
        G().text(m.name, 64, 11, { color: G().C.yellow });
        G().text((this.page + 1) + '/2', 240, 11, { align: 'right', color: G().C.gray });
        // sprite panel with a little ground
        G().window(4, 32, 108, 104);
        G().rect(10, 118, 96, 12, '#1a1a28');
        G().rect(10, 118, 96, 1, '#34344c');
        drawMon(m, 58, 124, 96, 90, false);
        K.lrArrows(8, 108, 80);
        if (this.page === 0) this.detail1(m, r, b);
        else this.detail2(m, r, b);
      }
      detail1(m, r, b) {
        const q = (v) => (b ? String(v) : '？？？');
        G().window(114, 32, 138, 104);
        const rows = [['レベル', m.lv], ['HP', m.hp], ['こうげき', m.atk], ['しゅび', m.def], ['すばやさ', m.agi], ['たおした', r.kills || 0]];
        rows.forEach(([k, v], i) => {
          G().text(k, 124, 40 + i * 14, { color: G().C.gray });
          G().text(i === 5 ? String(v) : q(v), 242, 40 + i * 14, { align: 'right', color: i === 5 ? G().C.cyan : G().C.white });
        });
        G().window(4, 138, 248, 82);
        G().text('EXP', 14, 145, { color: G().C.gray }); G().text(q(m.exp), 80, 145, { align: 'right' });
        G().text('ゴールド', 92, 145, { color: G().C.gray }); G().text(q(m.gold), 170, 145, { align: 'right' });
        G().text('JP', 182, 145, { color: G().C.gray }); G().text(q(m.jp), 242, 145, { align: 'right' });
        const drop = (slot, flag) => {
          if (!m[slot] || !m[slot].item) return b ? 'なし' : '？？？';
          return r[flag] ? K.itemLabel(m[slot].item) : '？？？';
        };
        G().text('ドロップ', 14, 159, { color: G().C.gray });
        G().text(drop('drop', 'drop'), 82, 159, { color: r.drop ? G().C.white : G().C.dark });
        G().text('レア', 14, 173, { color: G().C.gray });
        G().text(drop('rare', 'rare'), 82, 173, { color: r.rare ? G().C.yellow : G().C.dark });
        G().wrap(m.desc || '', 226).slice(0, 2).forEach((l, i) => G().text(l, 14, 190 + i * 13, { color: '#d0d0e0' }));
      }
      detail2(m, r, b) {
        const q = (v) => (b ? String(v) : '？？？');
        G().window(114, 32, 138, 104);
        const acts = m.actsPerTurn || 1;
        const rows = [['MP', q(m.mp || 0)], ['まりょく', q(m.mag || 0)], ['まぼうぎょ', q(m.mdef || 0)], ['かいひ', b ? (m.eva != null ? m.eva : 3) + '%' : '？？？'], ['こうどう', b ? acts + 'かい' : '？？？']];
        rows.forEach(([k, v], i) => {
          G().text(k, 124, 40 + i * 14, { color: G().C.gray });
          G().text(v, 242, 40 + i * 14, { align: 'right' });
        });
        G().window(4, 138, 248, 82, { title: 'とくちょう' });
        if (!b) { G().text('たおすと わかる。', 14, 150, { color: G().C.dark }); return; }
        const el = m.elem || {};
        const weak = [], strong = [];
        for (const e of K.ELEMS) {
          const v = el[e] == null ? 1 : el[e];
          if (v > 1) weak.push(K.elemName(e));
          else if (v < 0) strong.push(K.elemName(e) + '(きゅうしゅう)');
          else if (v === 0) strong.push(K.elemName(e) + '(むこう)');
          else if (v < 1) strong.push(K.elemName(e));
        }
        const sr = m.statusRes || {};
        const immune = Object.keys(sr).filter((s) => sr[s] >= 1).map(K.statusName);
        const FL = { boss: 'ボス', metal: 'メタル', undead: 'アンデッド', flying: 'ひこう', dragon: 'ドラゴン', flee: 'にげやすい' };
        const tags = (m.flags || []).map((f) => FL[f]).filter(Boolean);
        const lines = [
          ['よわい', weak.join(' ') || 'なし', weak.length ? G().C.green : G().C.gray],
          ['つよい', strong.join(' ') || 'なし', strong.length ? G().C.orange : G().C.gray],
          ['きかない', immune.join(' ') || 'なし', immune.length ? G().C.white : G().C.gray],
        ];
        if (m.steal && m.steal.item) lines.push(['ぬすめる', r.steal ? K.itemLabel(m.steal.item) : '？？？', r.steal ? G().C.white : G().C.dark]);
        if (tags.length) lines.push(['しゅぞく', tags.join(' '), G().C.yellow]);
        lines.slice(0, 5).forEach(([k, v, col], i) => {
          G().text(k, 14, 147 + i * 14, { color: G().C.gray });
          K.fitText(v, 76, 147 + i * 14, 166, { color: col });
        });
      }
    }

    return { StatusScreen, BookScreen };
  }
})(window.RPG);
