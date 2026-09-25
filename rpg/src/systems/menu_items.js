// Field menu: どうぐ (consumables / equipment / key items; use, discard) and
// アビリティ (field-usable action abilities per member).
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  const TABS = [
    { id: 'use', label: 'どうぐ', pred: (it) => it.type === 'consumable' },
    { id: 'gear', label: 'そうび', pred: (it) => ['weapon', 'shield', 'head', 'body', 'acc'].includes(it.type) },
    { id: 'key', label: 'だいじなもの', pred: (it) => it.type === 'key' },
  ];
  const ROWS = 8;
  let lastTab = 0;

  /** one-line summary of an equipment item's main numbers */
  function gearSummary(it) {
    const K = Menu.kit;
    const parts = [];
    if (it.atk) parts.push('こうげき' + it.atk);
    if (it.def) parts.push('しゅび' + it.def);
    if (it.mag) parts.push('まりょく' + it.mag);
    if (it.mdef) parts.push('まぼうぎょ' + it.mdef);
    const st = it.stats || {};
    for (const k of ['str', 'vit', 'agi', 'int', 'mnd', 'luk', 'hp', 'mp']) if (st[k]) parts.push(K.STAT_NAMES[k].replace('さいだい', '') + (st[k] > 0 ? '+' : '') + st[k]);
    if (it.element) parts.push(K.elemName(it.element));
    return parts.join(' ');
  }
  Menu.gearSummary = gearSummary;

  let lastMember = 0;
  // classes are built on first use (Menu.kit comes from menu.js, whose load order is not guaranteed)
  let C = null;
  const cls = () => C || (C = build());
  Menu.itemScreen = () => R.Engine.run(new (cls().ItemScreen)());
  Menu.abilityScreen = () => R.Engine.run(new (cls().AbilityScreen)());

  function build() {
    // ------------------------------------------------------------ どうぐ
    class ItemScreen extends Menu.kit.Screen {
      constructor() {
        super();
        this.tab = lastTab;
        this.list = new R.UI.List({ x: 4, y: 30, w: 248, rows: ROWS, items: [], padX: 16, drawItem: (it, x, y, w, i, sel) => this.drawRow(it, x, y, w, sel) });
        this.refresh(false);
      }
      refresh(keep) {
        this.entries = R.State.items(TABS[this.tab].pred);
        this.list.setItems(this.entries.map((e) => ({ label: e.item.name, e })), keep);
      }
      get cur() { const it = this.list.item; return it && it.e; }
      input() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          this.tab = (this.tab + (d === 'left' ? TABS.length - 1 : 1)) % TABS.length;
          lastTab = this.tab;
          R.sfx('cursor');
          this.refresh(false);
          return;
        }
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select' && this.cur) this.flow(() => this.act(this.cur));
      }
      async act(e) {
        const K = Menu.kit;
        const it = e.item;
        const tab = TABS[this.tab].id;
        if (tab === 'key') { await K.msg(it.name + 'は だいじに しまってある。'); return; }
        const u = it.use || {};
        const usable = !!(u.field && (u.effects || []).length);
        const opts = tab === 'use' ? [{ label: 'つかう', disabled: !usable }, 'すてる'] : ['そうびする', 'すてる'];
        const row = this.list.index - this.list.top;
        const i = await R.UI.choose(opts, { x: 160, y: Math.min(30 + 8 + row * 14 - 4, 118), w: 88 });
        if (i < 0) return;
        if (tab === 'use' && i === 0) {
          const res = await Menu.useItem(e.id);
          if (res === 'exit') { this.close('exit'); return; }
        } else if (tab === 'gear' && i === 0) await this.equip(e);
        else await this.discard(e);
        this.refresh(true);
      }
      async equip(e) {
        const K = Menu.kit;
        const slot = R.Rules.itemSlot(e.id);
        const ok = (c) => R.Rules.canEquip(c, e.id, slot);
        if (!R.Game.party.some(ok)) { R.sfx('buzzer'); await K.msg('だれも そうび できない。'); return; }
        const k = await Menu.pickMember({ title: 'だれが そうびする？', valid: ok, initial: Math.max(0, R.Game.party.findIndex(ok)) });
        if (k < 0) return;
        const c = R.Game.party[k];
        if (!R.Rules.equip(c, slot, e.id)) { R.sfx('buzzer'); return; }
        R.sfx('item');
        await K.msg(c.name + 'は ' + e.item.name + 'を そうびした！');
      }
      async discard(e) {
        const K = Menu.kit;
        const it = e.item;
        let n = 1;
        if (e.count > 1) {
          n = await R.UI.number({ min: 1, max: e.count, initial: 1, label: 'すてる かず', x: 128, y: 100, w: 120 });
          if (n < 0) return;
        }
        if (!(await K.yesno(it.name + (n > 1 ? 'を ' + n + 'こ' : 'を') + ' すてますか？'))) return;
        R.State.removeItem(e.id, n);
        R.sfx('confirm_soft');
        await K.msg(R.State.leader().name + 'は ' + it.name + 'を すてた。');
      }
      drawRow(row, x, y, w, sel) {
        const e = row.e, it = e.item;
        const K = Menu.kit;
        K.drawIcon(it, x, y + 2);
        G().text(K.itemLabel(e.id), x + 11, y, { color: it.rare ? G().C.yellow : G().C.white });
        if (it.type !== 'key') G().text(String(R.State.count(e.id)), x + w - 8, y, { align: 'right' });
      }
      render() {
        const K = Menu.kit;
        // tabs
        G().window(4, 4, 248, 26);
        const tx = [30, 100, 170];
        TABS.forEach((t, i) => {
          const on = i === this.tab;
          G().text(t.label, tx[i], 11, { color: on ? G().C.yellow : G().C.gray });
          if (on) G().rect(tx[i], 23, G().textWidth(t.label), 1, G().C.yellow);
        });
        K.lrArrows(12, 243, 12);
        this.list.draw();
        if (!this.entries.length) G().text('なにも もっていない。', 20, 38, { color: G().C.gray });
        // description
        G().window(4, 158, 248, 60);
        const e = this.cur;
        if (!e) return;
        const it = e.item;
        const lines = G().wrap(it.desc || '', 226).slice(0, 2);
        lines.forEach((l, i) => G().text(l, 15, 166 + i * 14));
        if (TABS[this.tab].id === 'gear') {
          K.fitText(gearSummary(it), 15, 194, 168, { color: G().C.cyan });
          let x = 242;
          for (const c of R.Game.party.slice().reverse()) {
            const ok = R.Rules.canEquip(c, e.id);
            x -= 18;
            K.drawSprite(c, x + 8, 214, { dark: !ok, darkAmt: 0.75 });
          }
        } else if (it.type === 'consumable') {
          const u = it.use || {};
          const where = u.field && u.battle ? 'どこでも つかえる' : u.field ? 'フィールドで つかえる' : u.battle ? 'せんとうで つかえる' : '';
          if (where) G().text(where, 15, 194, { color: G().C.gray });
          if (it.price) G().text('うりね ' + Math.floor(it.price / 2) + 'G', 242, 194, { align: 'right', color: G().C.gray });
        }
      }
    }

    // ------------------------------------------------------------ アビリティ
    class AbilityScreen extends Menu.kit.Screen {
      constructor() {
        super();
        const party = R.Game.party;
        this.m = lastMember < party.length ? lastMember : 0;
        if (!R.Rules.fieldActions(party[this.m]).length) {
          const k = party.findIndex((c) => R.Rules.fieldActions(c).length && c.hp > 0);
          if (k >= 0) this.m = k;
        }
        this.list = new R.UI.List({ x: 4, y: 42, w: 248, rows: ROWS, items: [], drawItem: (it, x, y, w, i, sel) => this.drawRow(it, x, y, w) });
        this.refresh(false);
      }
      get c() { return R.Game.party[this.m]; }
      refresh(keep) {
        this.abs = R.Rules.fieldActions(this.c);
        this.list.setItems(this.abs.map((id) => ({ label: Menu.kit.abName(id), id, disabled: !!Menu.abilityBlock(this.c, id) })), keep);
      }
      input() {
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          const n = R.Game.party.length;
          this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
          lastMember = this.m;
          R.sfx('cursor');
          this.refresh(false);
          return;
        }
        if (In().pressed('a') && this.abs.length) {
          const id = this.list.item.id;
          const block = Menu.abilityBlock(this.c, id);
          if (block) {
            R.sfx('buzzer');
            this.flow(() => Menu.kit.msg(block === 'MPが たりない' ? 'MPが たりない！' : this.c.name + 'は ' + block + '。'));
            return;
          }
          R.sfx('confirm');
          this.flow(async () => {
            const res = await Menu.useAbility(this.c, id);
            if (res === 'exit') { this.close('exit'); return; }
            this.refresh(true);
          });
          return;
        }
        const r = this.list.update();
        if (r === 'cancel') this.close();
      }
      drawRow(row, x, y, w) {
        const col = row.disabled ? G().C.gray : G().C.white;
        G().text(row.label, x, y, { color: col });
        const cost = R.Rules.mpCost(this.c, row.id);
        G().text(cost ? 'MP ' + cost : '―', x + w - 8, y, { align: 'right', color: col });
      }
      render() {
        const K = Menu.kit;
        const c = this.c, st = R.Rules.stats(c);
        G().window(4, 4, 248, 38);
        K.drawSprite(c, 30, 36, { frame: Math.floor(R.Engine.frame / 20) });
        G().text(c.name, 44, 10, { color: K.condColor(c) });
        G().text(K.jobName(c.job), 44, 23, { color: G().C.cyan });
        G().text('HP', 150, 10); G().text(c.hp + '/' + st.hp, 236, 10, { align: 'right', color: K.condColor(c) === G().C.purple ? G().C.white : K.condColor(c) });
        G().text('MP', 150, 23); G().text(c.mp + '/' + st.mp, 236, 23, { align: 'right' });
        K.lrArrows(10, 246, 17);
        this.list.draw();
        if (!this.abs.length) G().text('つかえる アビリティが ない。', 20, 50, { color: G().C.gray });
        G().window(4, 170, 248, 46);
        const row = this.list.item;
        if (row) {
          const ab = DB.abilities[row.id];
          G().wrap((ab && ab.desc) || '', 226).slice(0, 2).forEach((l, i) => G().text(l, 15, 178 + i * 14));
        }
      }
    }
    return { ItemScreen, AbilityScreen };
  }
})(window.RPG);
