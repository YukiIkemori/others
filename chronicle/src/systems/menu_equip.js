// Field menu: 装備 (DESIGN §11.7.5) — per member (L/R), 9 slots + 最強装備, the candidate list
// strongest first with 攻・術・守 deltas (Part A5・A6), the 付けると window (every other change,
// green up / red down), the compare window, 最強装備 in 3 modes (R.Rules.optimize → confirm →
// R.Rules.applyLoadout) and Y for the detail popup.
//   R.Menu.previewStats(c, slot, id) → the stats after wearing id (built from R.Rules.previewStats)
//   R.Menu.candidateRows(c, slot)    → [{id:null (外す)}, {id, worn, score, diff}…] in list order (tests T4–T6)
//   R.Menu.equipCandidates(c, slot)  → the candidate ids (strongest first)
(function (R) {
  'use strict';
  const DB = R.DB;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});
  const K = () => Menu.kit;

  const CMP = [['atk1', '攻撃1'], ['atk2', '攻撃2'], ['mag', '術力'], ['def', '守備'], ['mdef', '術防'], ['hit', '命中'], ['eva', '回避'], ['crit', '会心'],
    ['str', '腕力'], ['vit', '体力'], ['dex', '器用さ'], ['agi', '素早さ'], ['int', '知力'], ['mnd', '精神']];
  const MODES = [['phys', '物理重視'], ['magic', '術重視'], ['balance', 'バランス']];

  /** the stats c would have wearing `id` in `slot` (inventory untouched); atk1/atk2 included */
  function previewStats(c, slot, id) {
    const st = K().stats(c);
    const d = K().previewDiff(c, slot, id);
    const cur = K().statVector(st);
    const out = Object.assign({}, st);
    for (const k of K().DIFF_KEYS) out[k] = (cur[k] || 0) + (d[k] || 0);
    out.atk = out.atk1;
    return out;
  }
  Menu.previewStats = previewStats;

  /**
   * the member's style for ranking gear: 'magic' when 知力 leads the fixed stats (≥ 1.2 × the best of
   * 腕力・器用さ), 'phys' when those lead (≥ 1.2 × 知力), else 'balance'. Fixed stats only (gear does not move it).
   */
  function styleOf(c) {
    const b = R.Rules && R.Rules.baseStats ? R.Rules.baseStats(c) : K().stats(c);
    const p = Math.max(b.str || 0, b.dex || 0), m = b.int || 0;
    if (m >= 1.2 * p) return 'magic';
    if (p >= 1.2 * m) return 'phys';
    return 'balance';
  }
  Menu.gearStyle = styleOf;
  /**
   * the candidate score (§11.7.5, Part A6): max(Δ攻, Δ術) + Δ守 + floor(Δ術防 / 2) for fighters. For a member
   * whose main stat is 知力 the 術力 counts the way 最強装備（術重視） weighs it (Δ術 + 0.6 Δ術防 + 0.3 Δ守, §4.4.1),
   * and a balanced member takes the mean of the two: BRIEF A6 「術師向け装備は術力も考慮した総合点」 and DESIGN's
   * own test T4 (a mage's 知力 hat above a 守備 helm) do not hold with the plain formula on the real items.
   */
  function candScore(d, slot, style) {
    const atk = (slot === 'weapon2' ? d.atk2 : d.atk1) || 0, mag = d.mag || 0;
    // max(Δ攻, Δ術) is "the better of the two gains"; when neither gains, the loss counts (a weaker axe for a
    // spearman is Δ攻 −4, Δ術 0: plain max() would call it even and the shop would show ― instead of ▼4)
    const pow = atk > 0 || mag > 0 ? Math.max(atk, mag) : Math.min(atk, mag);
    const phys = pow + (d.def || 0) + Math.floor((d.mdef || 0) / 2);
    if (!style || style === 'phys') return phys;
    const magic = (d.mag || 0) + 0.6 * (d.mdef || 0) + 0.3 * (d.def || 0);
    const v = style === 'magic' ? magic : (phys + magic) / 2;
    return Math.round(v * 10) / 10;
  }
  Menu.candScore = candScore;

  /** inventory items c may put into slot (plus nothing else) */
  function invCandidates(c, slot) {
    const out = [];
    for (const id of Object.keys(R.Game.inv || {})) {
      if (!(R.State.count(id) > 0) || !DB.items[id]) continue;
      if (!K().slotsFor(id).includes(slot)) continue;
      if (!K().canEquip(c, id, slot)) continue;
      out.push(id);
    }
    return out;
  }
  /** rows of the candidate list: 外す first, then everything by score (ties: id order); the worn item in its place with E */
  function candidateRows(c, slot) {
    const now = c.equip[slot] || null;
    const ids = invCandidates(c, slot).filter((id) => id !== now);
    if (now) ids.push(now);
    const style = styleOf(c);
    const rows = ids.map((id) => {
      const diff = id === now ? zeroDiff() : K().previewDiff(c, slot, id);
      return { id, worn: id === now, diff, score: candScore(diff, slot, style) };
    });
    rows.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const off = now ? K().previewDiff(c, slot, null) : zeroDiff();
    return [{ id: null, diff: off, score: candScore(off, slot, style) }].concat(rows);
  }
  function zeroDiff() { const d = {}; for (const k of K().DIFF_KEYS) d[k] = 0; return d; }
  Menu.candidateRows = candidateRows;
  Menu.equipCandidates = (c, slot) => candidateRows(c, slot).slice(1).filter((r) => !r.worn).map((r) => r.id);

  /** the 付けると phrases: every changed key except the three of the row (§11.7.5) */
  function otherChanges(d, slot) {
    const shown = { mag: 1, def: 1 };
    shown[slot === 'weapon2' ? 'atk2' : 'atk1'] = 1;
    const out = [];
    for (const k of K().DIFF_KEYS) {
      if (shown[k] || !d[k]) continue;
      out.push({ text: K().STAT_NAMES[k] + K().signed(d[k]), color: d[k] > 0 ? K().COL.good : K().COL.bad });
    }
    return out;
  }
  Menu.otherChanges = otherChanges;

  let C = null;
  const cls = () => C || (C = build());
  /** open the equipment screen (o.member: party index to start with) */
  Menu.equipScreen = (o) => R.Engine.run(new (cls().EquipScreen)(o || {}));

  function build() {
    const Kt = K();
    const SLOTS = Kt.slots();
    const ROWS = SLOTS.length + 1; // + 最強装備

    class EquipScreen extends Kt.Screen {
      constructor(o) {
        super();
        const n = R.Game.party.length;
        this.m = o.member != null ? o.member : (Kt.lastMember || 0) < n ? Kt.lastMember || 0 : 0;
        this.row = 0;
        this.mode = 'slot'; // 'slot' | 'cand' | 'plan'
        this.cand = null;
        this.plan = null;
      }
      get c() { return R.Game.party[this.m]; }
      switchMember(d) {
        this.m = Kt.cycle(this.m, d, R.Game.party.length);
        Kt.lastMember = this.m;
        R.sfx('cursor');
        if (this.mode === 'cand') this.openCand(this.cand.slot, true);
      }
      input() {
        if (this.mode === 'cand') return this.inputCand();
        if (this.mode === 'plan') return;
        const d = In().dirRepeat();
        const lr = Kt.memberStep() || (d === 'left' ? -1 : d === 'right' ? 1 : 0);
        if (lr) { this.switchMember(lr); return; }
        if (d === 'up' || d === 'down') { this.row = (this.row + (d === 'up' ? ROWS - 1 : 1)) % ROWS; R.sfx('cursor'); }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); return; }
        const slot = SLOTS[this.row];
        if (In().pressed('y') && slot && this.c.equip[slot]) { this.flow(() => Menu.itemDetail(this.c.equip[slot], { member: this.c })); return; }
        if (!In().pressed('a')) return;
        if (this.row === SLOTS.length) { R.sfx('confirm'); this.flow(() => this.optimize()); return; }
        if (slot === 'shield' && Kt.holdsTwoHanded(this.c) && !this.c.equip.shield) {
          R.sfx('buzzer');
          this.flow(() => Kt.msg('両手持ちの武器を装備している。'));
          return;
        }
        const rows = candidateRows(this.c, slot);
        if (rows.length <= 1 && !this.c.equip[slot]) { R.sfx('buzzer'); return; }
        R.sfx('confirm');
        this.openCand(slot);
      }
      openCand(slot, keepCursor) {
        const c = this.c;
        const rows = candidateRows(c, slot);
        const worn = rows.findIndex((r) => r.worn);
        const prevId = keepCursor && this.cand && this.cand.list.item ? this.cand.list.item.id : undefined;
        let index = worn > 0 ? worn : rows.length > 1 ? 1 : 0;
        if (prevId !== undefined) { const k = rows.findIndex((r) => r.id === prevId); if (k >= 0) index = k; }
        const list = new R.UI.List({
          x: 4, y: 46, w: 248, h: 120, rows: 7, items: rows, index, title: Kt.slotName(slot),
          drawItem: (row, x, y) => this.drawCand(row, y, slot),
        });
        this.cand = { slot, rows, list };
        this.mode = 'cand';
      }
      inputCand() {
        const cd = this.cand;
        const lr = Kt.memberStep();
        if (lr) { this.switchMember(lr); return; }
        const row = cd.list.item;
        if (In().pressed('y') && row && row.id) { this.flow(() => Menu.itemDetail(row.id, { member: this.c })); return; }
        const r = cd.list.update();
        if (r === 'cancel') { this.mode = 'slot'; this.cand = null; return; }
        if (r !== 'select') return;
        const c = this.c, id = row.id;
        if ((c.equip[cd.slot] || null) === id) { this.mode = 'slot'; this.cand = null; return; }
        const res = Kt.equip(c, cd.slot, id);
        this.mode = 'slot'; this.cand = null;
        if (!res.ok) { R.sfx('buzzer'); this.flow(() => Kt.msg(res.reason || '装備できない。')); return; }
        R.sfx(id ? 'item' : 'confirm_soft');
        const shieldOff = cd.slot !== 'shield' && res.removed.some((x) => DB.items[x] && DB.items[x].type === 'shield');
        if (shieldOff) this.flow(() => Kt.msg('盾を外した。'));
      }
      async optimize() {
        const c = this.c;
        if (!R.Rules || typeof R.Rules.optimize !== 'function') { R.sfx('buzzer'); return; }
        const i = await Kt.choose(MODES.map((m) => m[1]), { x: 60, y: 128, w: 96, title: '最強装備', initial: Kt.lastOptMode || 0 });
        if (i < 0) return;
        Kt.lastOptMode = i;
        const plan = R.Rules.optimize(c, MODES[i][0]);
        if (!plan || !(plan.changes || []).length) { await Kt.msg('今の装備がいちばんだ。'); return; }
        this.plan = Object.assign({ label: MODES[i][1] }, plan);
        this.mode = 'plan';
        try {
          const ok = await Kt.choose(['はい', 'いいえ'], { x: 196, y: 3, w: 56, cancel: true });
          if (ok !== 0) return;
          const r = R.Rules.applyLoadout(c, plan) || {};
          if (!r.ok) { R.sfx('buzzer'); await Kt.msg('これ以上は持てない。'); return; }
          R.sfx('item');
        } finally { this.mode = 'slot'; this.plan = null; }
      }
      drawCand(row, y, slot) {
        const d = row.diff || {};
        if (!row.id) G().text('外す', 28, y, { color: G().C.cyan });
        else {
          if (row.worn) G().text('E', 20, y, { color: G().C.cyan });
          const n = R.State.count(row.id);
          const label = Kt.itemLabel(row.id) + (!row.worn && n >= 2 ? '×' + n : '');
          Kt.fitText(label, 28, y, 96, { color: Kt.itemColor(row.id) });
        }
        const atk = slot === 'weapon2' ? d.atk2 : d.atk1;
        const col = (v) => Kt.deltaColor(v);
        // columns 攻 128–164, 術 168–204, 守 208–244 (4px inside the frame, §11.7.5 shifted to clear the border)
        G().text('攻', 128, y, { color: Kt.COL.sub }); G().text(Kt.signed(atk), 164, y, { align: 'right', color: col(atk) });
        G().text('術', 168, y, { color: Kt.COL.sub }); G().text(Kt.signed(d.mag), 204, y, { align: 'right', color: col(d.mag) });
        G().text('守', 208, y, { color: Kt.COL.sub }); G().text(Kt.signed(d.def), 244, y, { align: 'right', color: col(d.def) });
      }
      drawHeader() {
        const c = this.c;
        G().window(4, 4, 248, 40);
        Kt.drawSpriteAt(c, 12, 12, { frame: Math.floor(R.Engine.frame / 20) });
        const cd = this.mode === 'cand' ? this.cand : null;
        if (cd) {
          const row = cd.list.item;
          const text = row && row.id ? DB.items[row.id].desc || '' : '今の装備を外す。';
          String(text).split('\n').slice(0, 2).forEach((l, i) => Kt.fitText(l, 34, 10 + i * 14, 210));
          return;
        }
        if (this.mode === 'plan') {
          G().text('最強装備：' + this.plan.label, 34, 10, { color: G().C.cyan });
          G().text('この装備にしますか？', 34, 24, { color: G().C.yellow });
          return;
        }
        Kt.fitText(c.name, 34, 10, 58, { color: Kt.condColor(c) });
        G().text('Lv' + c.level, 118, 10, { align: 'right' });
        Kt.fitText(Kt.subtitle(c), 34, 24, 150, { color: Kt.COL.sub });
        const row = Kt.effectiveRow(c);
        G().text(row === 'middle' ? '中列' : '前列', 244, 10, { align: 'right', color: row === 'middle' ? G().C.cyan : G().C.orange });
        Kt.lrHint(244, 24);
      }
      drawSlots() {
        const c = this.c;
        const plan = this.mode === 'plan' ? this.plan : null;
        const change = {};
        if (plan) for (const ch of plan.changes) change[ch.slot] = ch;
        G().window(4, 46, 146, 154);
        SLOTS.forEach((s, i) => {
          const y = 54 + i * 14;
          G().text(Kt.slotName(s), 20, y, { color: Kt.COL.sub });
          const ch = change[s];
          if (ch) {
            if (Kt.blink(12)) G().rect(62, y - 1, 84, 13, '#1c4a2c');
            if (ch.to) Kt.fitText(Kt.itemLabel(ch.to), 64, y, 80, { color: G().C.green });
            else G().text('―', 64, y, { color: G().C.green });
            return;
          }
          const id = c.equip[s];
          if (s === 'shield' && !id && Kt.holdsTwoHanded(c)) G().text('（両手持ち）', 64, y, { color: Kt.COL.gray });
          else if (id) Kt.fitText(Kt.itemLabel(id), 64, y, 80, { color: Kt.itemColor(id) });
          else G().text('―', 64, y, { color: Kt.COL.gray });
        });
        G().text('最強装備', 20, 54 + SLOTS.length * 14, { color: G().C.cyan });
        if (this.mode === 'slot') G().cursor(10, 55 + this.row * 14, !this.busy);
      }
      drawCompare() {
        const c = this.c;
        const cur = Kt.statVector(Kt.stats(c));
        const plan = this.mode === 'plan' ? this.plan : null;
        G().window(152, 46, 100, 174);
        CMP.forEach(([k, label], i) => {
          const y = 53 + i * 11;
          G().text(label, 158, y, { color: Kt.COL.sub });
          G().text(String(cur[k] || 0), 208, y, { align: 'right' });
          if (plan) {
            const d = (plan.diff && plan.diff[k]) || 0;
            G().text('▶', 210, y, { color: Kt.COL.gray });
            G().text(String((cur[k] || 0) + d), 246, y, { align: 'right', color: d > 0 ? G().C.green : d < 0 ? G().C.red : '#ffffff' });
          }
        });
        G().window(4, 202, 146, 18);
        if (plan) {
          const segs = [];
          for (const k of ['hp', 'mp', 'wp']) {
            const d = (plan.diff && plan.diff[k]) || 0;
            if (!d) continue;
            if (segs.length) segs.push({ text: '　' });
            segs.push({ text: Kt.STAT_NAMES[k] + Kt.signed(d), color: d > 0 ? G().C.green : G().C.red });
          }
          if (segs.length) Kt.drawSegs(segs, 12, 205, 132);
        } else if (Kt.holdsTwoHanded(c)) Kt.fitText('両手持ち：盾は使えない', 12, 205, 132, { color: G().C.yellow });
      }
      drawCandInfo() {
        const cd = this.cand;
        cd.list.draw();
        const row = cd.list.item;
        G().window(4, 168, 248, 52, { title: '付けると' });
        if (!row) return;
        const segs = otherChanges(row.diff || {}, cd.slot);
        if (!segs.length || row.worn) G().text(row.worn ? '今付けている。' : 'ほかに変わる能力はない。', 14, 174, { color: Kt.COL.gray });
        else {
          const lines = Menu.packLines ? Menu.packLines(segs, 2, 228) : [{ segs }];
          lines.forEach((l, i) => Kt.drawSegs(l.segs, 14, 174 + i * 14, 228));
        }
        const notes = [];
        if (row.id && Kt.isTwoHanded(row.id) && this.c.equip.shield && cd.slot !== 'shield') notes.push('両手持ち：盾は外れる');
        if (row.id && DB.items[row.id].quirk) notes.push('クセのあるアイテム（Yで詳細）');
        if (notes.length) Kt.fitText(notes.join('　'), 14, 202, 228, { color: G().C.yellow });
      }
      render() {
        this.drawHeader();
        if (this.mode === 'cand') { this.drawCandInfo(); return; }
        this.drawSlots();
        this.drawCompare();
      }
    }
    return { EquipScreen };
  }
})(window.RPG);
