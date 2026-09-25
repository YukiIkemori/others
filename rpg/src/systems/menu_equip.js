// Field menu: そうび — per member, per slot, with live stat previews
// (↑ green / ↓ red), さいきょう (optimize) and はずす. Dual wield puts a one-handed
// weapon in the shield slot when the member may use two swords.
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  const SLOTS = ['weapon', 'shield', 'head', 'body', 'acc'];
  const LABEL = { weapon: 'ぶき', shield: 'たて', head: 'あたま', body: 'からだ', acc: 'アクセサリ' };
  const SHOW = [['atk', 'こうげき'], ['def', 'しゅび'], ['mag', 'まりょく'], ['mdef', 'まぼうぎょ'], ['agi', 'すばやさ'], ['eva', 'かいひ'], ['hp', 'さいだいHP'], ['mp', 'さいだいMP']];
  const ROWS = 6;
  let lastMember = 0;

  /** can this member hold a weapon in the shield slot? */
  const dual = (c) => !!R.Rules.mods(c, { ignoreEquip: true }).twoSwords;
  const twoHanded = (c) => { const w = c.equip.weapon && DB.items[c.equip.weapon]; return !!(w && w.twoHanded); };

  /** stats of c if `id` were put in `slot` (no inventory changes) */
  function previewStats(c, slot, id) {
    const t = { id: c.id, level: c.level, job: c.job, jobs: c.jobs, set: c.set, bonus: c.bonus, equip: Object.assign({}, c.equip) };
    t.equip[slot] = id || null;
    const w = t.equip.weapon && DB.items[t.equip.weapon];
    if (slot === 'weapon' && w && w.twoHanded) t.equip.shield = null;
    if (slot === 'shield' && id && w && w.twoHanded) t.equip.weapon = null;
    return R.Rules.stats(t);
  }
  Menu.previewStats = previewStats;

  /** inventory items c could put into slot */
  function candidates(c, slot) {
    return R.State.items((it, id) => (it.type === slot || (slot === 'shield' && it.type === 'weapon')) && R.Rules.canEquip(c, id, slot)).map((e) => e.id);
  }
  Menu.equipCandidates = candidates;

  /** main number for comparing gear in a slot */
  const keyStat = (slot, it) => (slot === 'weapon' || (it && it.type === 'weapon') ? (it && it.mag > (it.atk || 0) ? 'mag' : 'atk') : 'def');

  let C = null;
  const cls = () => C || (C = build());
  /** open the equipment screen (o.member: party index to start with) */
  Menu.equipScreen = (o) => R.Engine.run(new (cls().EquipScreen)(o || {}));

  function build() {
    class EquipScreen extends Menu.kit.Screen {
      constructor(o) {
        super();
        this.m = o.member != null ? o.member : lastMember < R.Game.party.length ? lastMember : 0;
        this.row = 0;
        this.mode = 'slot';
        this.cand = null; // {slot, ids, list}
        this.preview = null;
      }
      get c() { return R.Game.party[this.m]; }
      input() {
        if (this.mode === 'cand') return this.inputCand();
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          const n = R.Game.party.length;
          this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
          lastMember = this.m;
          R.sfx('cursor');
          return;
        }
        if (d === 'up' || d === 'down') { this.row = (this.row + (d === 'up' ? ROWS - 1 : 1)) % ROWS; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); return; }
        if (!In().pressed('a')) return;
        if (this.row === 5) { R.sfx('confirm'); this.flow(() => this.optimize()); return; }
        const slot = SLOTS[this.row];
        const ids = candidates(this.c, slot);
        if (!ids.length && !this.c.equip[slot]) { R.sfx('buzzer'); return; }
        R.sfx('confirm');
        this.openCand(slot, ids);
      }
      openCand(slot, ids) {
        const c = this.c;
        const cur = R.Rules.stats(c);
        const items = [{ label: 'はずす', id: null }].concat(ids.map((id) => {
          const it = DB.items[id];
          const k = slot === 'shield' && it.type === 'weapon' ? 'atk2' : keyStat(slot, it);
          const d = previewStats(c, slot, id)[k] - cur[k];
          return { label: Menu.kit.itemLabel(id), id, d };
        }));
        const start = Math.max(0, ids.indexOf(c.equip[slot]) + 1);
        const list = new R.UI.List({
          x: 4, y: 46, w: 248, rows: ROWS, items, index: ids.length ? (start || 1) : 0,
          title: slot === 'shield' && dual(c) ? 'ひだりて' : LABEL[slot],
          onChange: () => this.updatePreview(),
          drawItem: (row, x, y, w) => this.drawCand(row, x, y, w),
        });
        this.cand = { slot, ids, list };
        this.mode = 'cand';
        this.updatePreview();
      }
      updatePreview() {
        const cd = this.cand;
        if (!cd) { this.preview = null; return; }
        const row = cd.list.item;
        this.preview = previewStats(this.c, cd.slot, row ? row.id : null);
      }
      inputCand() {
        const cd = this.cand;
        const r = cd.list.update();
        if (r === 'cancel') { this.mode = 'slot'; this.cand = null; this.preview = null; return; }
        if (r !== 'select') return;
        const id = cd.list.item.id;
        const c = this.c;
        if ((c.equip[cd.slot] || null) !== id) {
          R.Rules.equip(c, cd.slot, id);
          R.sfx(id ? 'item' : 'confirm_soft');
        }
        this.mode = 'slot'; this.cand = null; this.preview = null;
      }
      async optimize() {
        const c = this.c;
        const before = JSON.stringify(c.equip);
        R.Rules.optimize(c);
        if (JSON.stringify(c.equip) === before) await Menu.kit.msg('いまの そうびが いちばん つよい ようだ。');
        else { R.sfx('item'); await Menu.kit.msg(c.name + 'は さいきょうの そうびに かえた！'); }
      }
      drawCand(row, x, y, w) {
        if (!row.id) { G().text('はずす', x, y, { color: G().C.cyan }); return; }
        const it = DB.items[row.id];
        Menu.kit.drawIcon(it, x, y + 2);
        G().text(row.label, x + 11, y, { color: it.rare ? G().C.yellow : G().C.white });
        G().text(String(R.State.count(row.id)), x + w - 22, y, { align: 'right' });
        if (row.d) arrow(x + w - 14, y + 3, row.d > 0);
      }
      render() {
        const K = Menu.kit;
        const c = this.c;
        // header: member (or the highlighted item's description while choosing)
        G().window(4, 4, 248, 40);
        const cd = this.mode === 'cand' ? this.cand : null;
        if (cd) {
          const row = cd.list.item;
          const text = row && row.id ? (DB.items[row.id].desc || '') : 'いまの そうびを はずす。';
          G().wrap(text, 226).slice(0, 2).forEach((l, i) => G().text(l, 15, 11 + i * 14));
        } else {
          K.drawSprite(c, 26, 38, { frame: Math.floor(R.Engine.frame / 20) });
          G().text(c.name, 42, 11, { color: K.condColor(c) });
          G().text('Lv' + c.level, 42, 25);
          G().text(K.jobName(c.job), 150, 11, { color: G().C.cyan });
          K.lrArrows(10, 246, 20);
        }
        // slots
        if (cd) {
          cd.list.draw();
        } else {
          G().window(4, 46, 248, 96);
          SLOTS.forEach((s, i) => {
            const y = 54 + i * 14;
            const lbl = s === 'shield' && dual(c) ? 'ひだりて' : LABEL[s];
            G().text(lbl, 20, y, { color: G().C.gray });
            const id = c.equip[s];
            if (s === 'shield' && !id && twoHanded(c)) G().text('（りょうてもち）', 90, y, { color: G().C.gray });
            else if (id) { K.drawIcon(DB.items[id], 78, y + 2); G().text(K.itemLabel(id), 90, y, { color: DB.items[id].rare ? G().C.yellow : G().C.white }); }
            else G().text('―――', 90, y, { color: G().C.dark });
          });
          G().text('さいきょう そうび', 20, 54 + 5 * 14, { color: G().C.cyan });
          G().cursor(10, 55 + this.row * 14, !this.busy);
        }
        // stats
        G().window(4, 144, 248, 74);
        const cur = R.Rules.stats(c), nxt = this.preview;
        // dual wield: show the off-hand attack in place of evasion
        const show = cur.atk2 || (nxt && nxt.atk2) ? SHOW.map((e) => (e[0] === 'eva' ? ['atk2', 'ひだりて'] : e)) : SHOW;
        show.forEach(([k, label], i) => {
          const x = 14 + (i % 2) * 118, y = 152 + Math.floor(i / 2) * 14;
          G().text(label, x, y, { color: G().C.gray });
          G().text(String(cur[k]), x + 78, y, { align: 'right' });
          if (nxt) {
            const v = nxt[k], col = v > cur[k] ? G().C.green : v < cur[k] ? G().C.red : G().C.gray;
            G().text('→', x + 80, y, { color: G().C.gray });
            G().text(String(v), x + 112, y, { align: 'right', color: col });
          }
        });
      }
    }
    return { EquipScreen };
  }

  /** tiny ▲ (green) / ▼ (red) */
  function arrow(x, y, up) {
    const col = up ? '#6ee07a' : '#ff5a4a';
    for (let i = 0; i < 4; i++) {
      const yy = up ? y + i : y + 3 - i;
      G().rect(x + 3 - i, yy, 1 + i * 2, 1, col);
    }
  }
  Menu.kitArrow = arrow;
})(window.RPG);
