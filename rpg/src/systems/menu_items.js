// Field menu: 道具 (consumables / equipment / key items; use, discard) and
// アビリティ (field-usable action abilities per member).
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  const TABS = [
    { id: 'use', label: '道具', pred: (it) => it.type === 'consumable' },
    { id: 'gear', label: '装備品', pred: (it) => ['weapon', 'shield', 'head', 'body', 'acc'].includes(it.type) },
    { id: 'key', label: '大事なもの', pred: (it) => it.type === 'key' },
  ];
  const ROWS = 8;
  let lastTab = 0;

  /** one-line summary of an equipment item's main numbers */
  function gearSummary(it) {
    const K = Menu.kit;
    const parts = [];
    if (it.atk) parts.push('攻撃力' + it.atk);
    if (it.def) parts.push('守備力' + it.def);
    if (it.mag) parts.push('魔力' + it.mag);
    if (it.mdef) parts.push('魔法防御' + it.mdef);
    const st = it.stats || {};
    for (const k of ['str', 'vit', 'agi', 'int', 'mnd', 'luk', 'hp', 'mp']) if (st[k]) parts.push(K.STAT_NAMES[k].replace('最大', '') + (st[k] > 0 ? '+' : '') + st[k]);
    if (it.element) parts.push(K.elemName(it.element));
    return parts.join(' ');
  }
  Menu.gearSummary = gearSummary;

  const TYPE_NAMES = { weapon: '武器', shield: '盾', head: '頭', body: '体', acc: 'アクセサリ', consumable: '道具', key: '大切なもの' };
  const pctText = (v) => (v > 0 ? '+' : '') + v + '%';
  /** special effects of an item (its mods and on-hit extras) as short Japanese phrases */
  function effectLines(it) {
    const K = Menu.kit, m = it.mods || {}, out = [];
    const el = (o, f) => Object.keys(o).map((e) => K.elemName(e) + f(o[e]));
    if (it.onHit && it.onHit.status) out.push('攻撃時 ' + Math.round((it.onHit.chance || 0) * 100) + '%で' + K.statusName(it.onHit.status));
    if (it.twoHanded) out.push('両手持ち');
    if (it.hit) out.push('命中' + (it.hit > 0 ? '+' : '') + it.hit);
    if (it.eva) out.push('回避+' + it.eva + '%');
    if (m.statusImmune) out.push(m.statusImmune.map(K.statusName).join('・') + 'を防ぐ');
    if (m.elemResist) out.push(el(m.elemResist, (v) => (v <= 0 ? '無効' : 'ダメージ' + Math.round((1 - v) * 100) + '%減')).join('・'));
    if (m.elemBoost) out.push(el(m.elemBoost, (v) => '威力' + pctText(v)).join('・'));
    if (m.hpPct) out.push('最大HP' + pctText(m.hpPct));
    if (m.mpPct) out.push('最大MP' + pctText(m.mpPct));
    if (m.crit) out.push('会心率' + pctText(m.crit));
    if (m.hit) out.push('命中' + pctText(m.hit));
    if (m.magicPct) out.push('魔法の威力' + pctText(m.magicPct));
    if (m.healPct) out.push('回復量' + pctText(m.healPct));
    if (m.mpCostPct) out.push('消費MP' + pctText(m.mpCostPct));
    if (m.startBuffs) out.push('戦闘開始時 ' + Object.keys(m.startBuffs).map((k) => ({ atk: '攻撃力', def: '守備力', mag: '魔力', mdef: '魔法防御', agi: '素早さ' }[k] || k)).join('・') + 'アップ');
    if (m.regen) out.push('戦闘中HPが少しずつ回復');
    if (m.walkHeal) out.push('歩くとHPが回復');
    if (m.noFloorDamage) out.push('ダメージ床を無効');
    if (m.preemptPct) out.push('先制率' + pctText(m.preemptPct));
    if (m.escapePct) out.push('逃げやすさ' + pctText(m.escapePct));
    if (m.expPct) out.push('経験値' + pctText(m.expPct));
    if (m.goldPct) out.push('ゴールド' + pctText(m.goldPct));
    if (m.dropPct) out.push('ドロップ率' + pctText(m.dropPct));
    if (m.rarePct) out.push('レア率' + pctText(m.rarePct));
    if (m.stealPct) out.push('盗み成功率' + pctText(m.stealPct));
    return out;
  }
  Menu.itemEffects = effectLines;

  let lastMember = 0;
  // classes are built on first use (Menu.kit comes from menu.js, whose load order is not guaranteed)
  let C = null;
  const cls = () => C || (C = build());
  Menu.itemScreen = () => R.Engine.run(new (cls().ItemScreen)());
  /** Y (詳細) in item lists: a popup with everything about the item; any button closes it */
  Menu.itemDetail = (id) => (DB.items[id] ? R.Engine.run(new (cls().ItemDetail)(id)) : Promise.resolve());
  Menu.abilityScreen = () => R.Engine.run(new (cls().AbilityScreen)());

  function build() {
    // ------------------------------------------------------------ 道具
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
        if (In().pressed('y') && this.cur) { R.sfx('confirm'); this.flow(() => Menu.itemDetail(this.cur.id)); return; }
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select' && this.cur) this.flow(() => this.act(this.cur));
      }
      async act(e) {
        const K = Menu.kit;
        const it = e.item;
        const tab = TABS[this.tab].id;
        if (tab === 'key') { await K.msg(it.name + 'は大切にしまってある。'); return; }
        const u = it.use || {};
        const usable = !!(u.field && (u.effects || []).length);
        const opts = tab === 'use' ? [{ label: '使う', disabled: !usable }, '捨てる'] : ['装備する', '捨てる'];
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
        if (!R.Game.party.some(ok)) { R.sfx('buzzer'); await K.msg('誰も装備できない。'); return; }
        const k = await Menu.pickMember({ title: '誰が装備する？', valid: ok, initial: Math.max(0, R.Game.party.findIndex(ok)) });
        if (k < 0) return;
        const c = R.Game.party[k];
        if (!R.Rules.equip(c, slot, e.id)) { R.sfx('buzzer'); return; }
        R.sfx('item');
        await K.msg(c.name + 'は' + e.item.name + 'を装備した！');
      }
      async discard(e) {
        const K = Menu.kit;
        const it = e.item;
        let n = 1;
        if (e.count > 1) {
          n = await R.UI.number({ min: 1, max: e.count, initial: 1, label: '捨てる数', x: 128, y: 100, w: 120 });
          if (n < 0) return;
        }
        if (!(await K.yesno(it.name + 'を' + (n > 1 ? n + '個' : '') + '捨てますか？'))) return;
        R.State.removeItem(e.id, n);
        R.sfx('confirm_soft');
        await K.msg(R.State.leader().name + 'は' + it.name + 'を捨てた。');
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
        if (!this.entries.length) G().text('何も持っていない。', 20, 38, { color: G().C.gray });
        // description (Y opens the full 詳細 popup)
        G().window(4, 158, 248, 60, this.cur ? { title: 'Y：詳細' } : undefined);
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
          const where = u.field && u.battle ? 'いつでも使える' : u.field ? 'フィールドで使える' : u.battle ? '戦闘中に使える' : '';
          if (where) G().text(where, 15, 194, { color: G().C.gray });
          if (it.price) G().text('売値 ' + Math.floor(it.price / 2) + 'G', 242, 194, { align: 'right', color: G().C.gray });
        }
      }
    }

    // ------------------------------------------------------------ 詳細 popup
    class ItemDetail extends Menu.kit.Screen {
      constructor(id) {
        super();
        const K = Menu.kit, it = DB.items[id];
        this.id = id; this.it = it;
        const L = [];
        const W = 212;
        for (const l of G().wrap(it.desc || '', W)) L.push([l, G().C.white]);
        const gear = ['weapon', 'shield', 'head', 'body', 'acc'].includes(it.type);
        if (gear) {
          const sum = gearSummary(it);
          if (sum) for (const l of G().wrap(sum, W)) L.push([l, G().C.cyan]);
        }
        const fx = effectLines(it);
        if (fx.length) for (const l of G().wrap('効果：' + fx.join('、'), W)) L.push([l, G().C.green]);
        if (it.type === 'consumable') {
          const u = it.use || {};
          const where = u.field && u.battle ? 'いつでも使える' : u.field ? 'フィールドで使える' : u.battle ? '戦闘中に使える' : '';
          if (where) L.push([where, G().C.gray]);
        }
        if (gear) {
          const who = R.Game.party.filter((c) => R.Rules.canEquip(c, id)).map((c) => c.name);
          L.push(['今のジョブで装備できる：' + (who.length === R.Game.party.length ? '全員' : who.length ? who.join('・') : 'なし'), G().C.gray]);
        }
        const own = R.State.count(id);
        L.push(['持っている数 ' + own + (it.price ? '　　売値 ' + Math.floor(it.price / 2) + 'G' : ''), G().C.gray]);
        this.lines = L;
        this.h = Math.min(200, 34 + L.length * 14);
      }
      input() {
        if (In().pressed('a') || In().pressed('b') || In().pressed('y')) { R.sfx('cancel'); this.close(); }
      }
      render() {
        const K = Menu.kit, it = this.it;
        const y0 = Math.max(8, Math.floor((R.H - this.h) / 2));
        G().window(12, y0, 232, this.h, { title: '詳細' });
        K.drawIcon(it, 22, y0 + 12);
        G().text(K.itemLabel(this.id), 34, y0 + 10, { color: it.rare ? G().C.yellow : G().C.white });
        G().text(TYPE_NAMES[it.type] || '', 234, y0 + 10, { align: 'right', color: G().C.gray });
        const max = Math.floor((this.h - 30) / 14);
        this.lines.slice(0, max).forEach(([l, col], i) => K.fitText(l, 22, y0 + 28 + i * 14, 214, { color: col }));
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
        const lr = Menu.kit.memberStep();
        if (d === 'left' || d === 'right' || lr) {
          const n = R.Game.party.length;
          this.m = (this.m + ((lr || (d === 'left' ? -1 : 1)) < 0 ? n - 1 : 1)) % n;
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
            this.flow(() => Menu.kit.msg(block === 'MPが足りない' ? 'MPが足りない！' : this.c.name + 'は' + block + '。'));
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
        K.lrArrows(10, 246, 17, true);
        this.list.draw();
        if (!this.abs.length) G().text('使えるアビリティがない。', 20, 50, { color: G().C.gray });
        G().window(4, 170, 248, 46);
        const row = this.list.item;
        if (row) {
          const ab = DB.abilities[row.id];
          G().wrap((ab && ab.desc) || '', 226).slice(0, 2).forEach((l, i) => G().text(l, 15, 178 + i * 14));
        }
      }
    }
    return { ItemScreen, AbilityScreen, ItemDetail };
  }
})(window.RPG);
