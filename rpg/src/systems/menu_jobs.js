// Field menu: ジョブ (FFT-style job board: every job by tier, member sprite in
// that job's outfit, job level pips, ★ mastered, locked jobs dark with their
// requirements), アビリティを覚える (spend JP) and セット (ability slots).
(function (R) {
  'use strict';
  const DB = R.DB;
  const U = R.U;
  const G = () => R.Gfx;
  const In = () => R.Input;
  const Menu = (R.Menu = R.Menu || {});

  const CELL = 34;
  let lastMember = 0;
  let lastJob = null;

  /** jobs grouped by tier (rows of the board), in DB order */
  function tiers() {
    const rows = [];
    for (const id of Object.keys(DB.jobs)) {
      const t = U.clamp((DB.jobs[id].tier | 0) || 1, 1, 9);
      (rows[t - 1] = rows[t - 1] || []).push(id);
    }
    const out = rows.filter((r) => r && r.length);
    // very wide tiers wrap onto extra rows
    const fixed = [];
    for (const r of out) for (let i = 0; i < r.length; i += 7) fixed.push(r.slice(i, i + 7));
    return fixed;
  }

  const reqText = (req) => Menu.kit.jobName(req[0]) + ' Lv' + req[1];

  /** things a job change took off, as message lines */
  function removedLines(c, removed) {
    if (!removed || !removed.length) return [];
    const names = removed.map((id) => Menu.kit.itemName(id));
    return [c.name + 'は' + names.join(names.length > 2 ? '、' : 'と') + 'を外した。'];
  }

  async function doChangeJob(c, job) {
    const K = Menu.kit;
    const prevJob = c.job, prevSub = c.set.sub;
    const removed = R.Rules.changeJob(c, job);
    if (removed == null) { R.sfx('buzzer'); return false; }
    R.sfx('buff');
    const lines = [c.name + 'は' + K.jobName(job) + 'になった！'].concat(removedLines(c, removed));
    if (prevSub && !c.set.sub) lines.push('サブアクションが外れた。');
    // an empty サブアクション takes the previous job, so its learned skills stay usable in battle
    if (!c.set.sub && prevJob !== job && R.Rules.slotOptions(c, 'sub').includes(prevJob)) {
      R.Rules.setSlot(c, 'sub', prevJob);
      lines.push('サブアクションに' + ((DB.jobs[prevJob] && DB.jobs[prevJob].command) || K.jobName(prevJob)) + 'をセットした。');
    }
    await K.msg(lines.join('\n'));
    if (removed.length && R.Rules.optimize) {
      if (await K.yesno('最強の装備にしますか？')) {
        R.Rules.optimize(c);
        R.sfx('item');
      }
    }
    return true;
  }
  Menu.changeJob = doChangeJob;

  let C = null;
  const cls = () => C || (C = build());
  Menu.jobScreen = (o) => R.Engine.run(new (cls().JobScreen)(o || {}));
  Menu.learnScreen = (c, job) => R.Engine.run(new (cls().LearnScreen)(c, job));
  Menu.setScreen = (o) => R.Engine.run(new (cls().SetScreen)(o || {}));

  function build() {
    const K = Menu.kit;

    // ============================================================ job board
    class JobScreen extends K.Screen {
      constructor(o) {
        super();
        this.m = o.member != null ? o.member : lastMember < R.Game.party.length ? lastMember : 0;
        this.rows = tiers();
        this.place(lastJob && DB.jobs[lastJob] ? lastJob : this.c.job);
      }
      get c() { return R.Game.party[this.m]; }
      get job() { const r = this.rows[this.r]; return r ? r[this.i] : null; }
      place(job) {
        this.r = 0; this.i = 0;
        this.rows.forEach((row, r) => { const k = row.indexOf(job); if (k >= 0) { this.r = r; this.i = k; } });
      }
      cellX(r, i) { const n = this.rows[r].length; return 9 + (7 - n) * (CELL / 2) + i * CELL; }
      cellY(r) { return 15 + r * CELL; }
      input() {
        if (!this.rows.length) { if (In().pressed('b') || In().pressed('a')) { R.sfx('cancel'); this.close(); } return; }
        const d = In().dirRepeat();
        // Shift (dash) switches member from anywhere on the board
        if (In().pressed('dash')) {
          const n = R.Game.party.length;
          this.m = (this.m + 1) % n;
          lastMember = this.m;
          R.sfx('cursor');
          return;
        }
        if (d && this.r < 0) {
          // member row (the board's title): left/right switch member
          if (d === 'left' || d === 'right') {
            const n = R.Game.party.length;
            this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
            lastMember = this.m;
          } else this.enterRow(d === 'up' ? this.rows.length - 1 : 0, this.memoX);
          R.sfx('cursor');
        } else if (d) {
          const row = this.rows[this.r];
          if (d === 'left' || d === 'right') {
            this.i = (this.i + (d === 'left' ? row.length - 1 : 1)) % row.length;
          } else {
            const nr = this.r + (d === 'up' ? -1 : 1);
            this.memoX = this.cellX(this.r, this.i);
            if (nr < 0 || nr >= this.rows.length) this.r = -1;
            else this.enterRow(nr, this.memoX);
          }
          if (this.r >= 0) lastJob = this.job;
          R.sfx('cursor');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); return; }
        if (In().pressed('a') && this.r >= 0) this.flow(() => this.act());
      }
      /** move to row r, on the cell nearest to x */
      enterRow(r, x) {
        this.r = r;
        const nr = this.rows[r];
        let best = 0, bd = 1e9;
        for (let k = 0; k < nr.length; k++) { const dd = Math.abs(this.cellX(r, k) - (x == null ? 128 : x)); if (dd < bd) { bd = dd; best = k; } }
        this.i = best;
      }
      async act() {
        const c = this.c, job = this.job;
        if (!R.Rules.isJobUnlocked(c, job)) {
          R.sfx('buzzer');
          await K.msg(K.jobName(job) + 'になるには\n' + (DB.jobs[job].req || []).map(reqText).join('と') + 'が必要だ。');
          return;
        }
        R.sfx('confirm');
        const cur = c.job === job;
        const opts = [{ label: 'ジョブを変える', disabled: cur }, { label: 'アビリティを覚える' }];
        const cx = this.cellX(this.r, this.i);
        const w = Math.ceil(Math.max(...opts.map((o) => G().textWidth(o.label)))) + 32; // sized to the longest label
        const i = await R.UI.choose(opts, { x: cx > 120 ? 8 : 248 - w, y: 58, w, initial: cur ? 1 : 0 });
        if (i === 0) await doChangeJob(c, job);
        else if (i === 1) { this.hidden = true; try { await Menu.learnScreen(c, job); } finally { this.hidden = false; } }
      }
      render() {
        const c = this.c;
        const f = Math.floor(R.Engine.frame / 16);
        G().window(4, 8, 248, 146);
        this.renderTitle();
        // faint tier separators
        for (let r = 1; r < this.rows.length; r++) {
          const y = this.cellY(r) - 1;
          for (let x = 14; x < 242; x += 4) G().rect(x, y, 2, 1, '#3a3a58');
        }
        this.rows.forEach((row, r) => row.forEach((job, i) => {
          const x = this.cellX(r, i), y = this.cellY(r);
          const open = R.Rules.isJobUnlocked(c, job);
          const sel = r === this.r && i === this.i;
          if (job === c.job) { G().rect(x + 2, y + 1, CELL - 4, CELL - 3, '#23336e'); G().strokeRect(x + 2, y + 1, CELL - 4, CELL - 3, '#4a64c0'); }
          else if (job === c.set.sub) G().strokeRect(x + 2, y + 1, CELL - 4, CELL - 3, '#3a6a5a');
          K.drawSprite(c, x + CELL / 2, y + 26, { job, frame: sel ? f : 0, dark: !open, darkAmt: 0.8 });
          if (open) {
            const lv = R.Rules.jobLevel(c, job);
            const mast = R.Rules.isMastered(c, job);
            for (let k = 0; k < 8; k++) {
              const on = k < lv;
              G().rect(x + 5 + k * 3, y + 28, 2, 2, on ? (mast ? '#ffd24a' : '#6fd8ff') : '#383850');
            }
            if (mast) star(x + CELL - 9, y + 2);
          } else {
            G().text('?', x + CELL / 2, y + 9, { align: 'center', color: sel ? '#9090b0' : '#50506a' });
          }
          if (sel) cursorFrame(x + 1, y, CELL - 2, CELL - 1);
        }));
        this.renderInfo();
      }
      renderTitle() {
        const c = this.c;
        const t = c.name + 'のジョブ';
        const tw = Math.ceil(G().textWidth(t)) + 8;
        const tx = 128 - (tw >> 1);
        const focus = this.r < 0;
        // a solid plate behind the title (it sits on the window's top border, never over the field)
        G().rect(tx - (focus ? 12 : 0), 2, tw + (focus ? 24 : 0), 12, '#000000');
        G().text(t, tx + 4, 3, { color: focus ? G().C.yellow : G().C.white });
        if (focus) K.lrArrows(tx - 10, tx + tw + 9, 4);
      }
      renderInfo() {
        const c = this.c, job = this.job, j = DB.jobs[job];
        G().window(4, 156, 248, 64);
        if (this.r < 0) { this.renderMember(); return; }
        if (!j) return;
        const open = R.Rules.isJobUnlocked(c, job);
        const x = 14, y = 163;
        if (!open) {
          G().text(j.name, x, y, { color: G().C.gray });
          G().text('未解放', 242, y, { align: 'right', color: G().C.red });
          G().text('条件', x, y + 14, { color: G().C.gray });
          (j.req || []).forEach((rq, k) => {
            const ok = R.Rules.jobLevel(c, rq[0]) >= rq[1];
            const now = R.Rules.jobLevel(c, rq[0]);
            const col = ok ? G().C.green : G().C.white;
            const yy = y + 14 + k * 14;
            G().text(reqText(rq), x + 58, yy, { color: col });
            G().text(ok ? 'OK' : '現在 Lv' + now, 242, yy, { align: 'right', color: ok ? G().C.green : G().C.gray });
          });
          return;
        }
        const lv = R.Rules.jobLevel(c, job);
        const rec = c.jobs[job] || { jp: 0, total: 0, learned: [] };
        const all = R.Rules.jobAbilities(job);
        const got = all.filter((a) => rec.learned.includes(a)).length;
        const mast = R.Rules.isMastered(c, job);
        G().text(j.name, x, y, { color: mast ? G().C.gold : G().C.white });
        const tags = [];
        if (job === c.job) tags.push(['現在のジョブ', G().C.cyan]);
        else if (job === c.set.sub) tags.push(['サブ', '#6ad0a0']);
        let tx = x + G().textWidth(j.name) + 8;
        for (const [t, col] of tags) { G().text(t, tx, y, { color: col }); tx += G().textWidth(t) + 6; }
        G().text('Lv ' + lv + (mast ? ' ★' : ''), 242, y, { align: 'right', color: mast ? G().C.gold : G().C.white });
        G().text('JP ' + rec.jp, x, y + 14, { color: G().C.yellow });
        const nx = R.Rules.jpToNextLevel(c, job);
        G().text(nx > 0 ? '次のLvまで ' + nx : 'Lv MAX', x + 70, y + 14, { color: G().C.gray });
        G().text('習得 ' + got + '/' + all.length, 242, y + 14, { align: 'right', color: mast ? G().C.gold : G().C.white });
        G().wrap(j.desc || '', 226).slice(0, 2).forEach((l, k) => G().text(l, x, y + 28 + k * 14));
      }
      renderMember() {
        const c = this.c, x = 14, y = 163;
        const all = Object.keys(DB.jobs);
        const open = all.filter((j) => R.Rules.isJobUnlocked(c, j)).length;
        const mast = all.filter((j) => R.Rules.isMastered(c, j)).length;
        G().text(c.name, x, y, { color: K.condColor(c) });
        G().text('Lv ' + c.level, 242, y, { align: 'right' });
        G().text('ジョブ', x, y + 14, { color: G().C.gray });
        G().text(K.jobName(c.job) + ' Lv' + R.Rules.jobLevel(c, c.job), x + 44, y + 14, { color: G().C.cyan });
        G().text('サブ', x, y + 28, { color: G().C.gray });
        G().text(c.set.sub ? K.jobName(c.set.sub) : '―――', x + 44, y + 28, { color: c.set.sub ? G().C.white : G().C.dark });
        G().text('ジョブ ' + open + '/' + all.length, 242, y + 28, { align: 'right' });
        G().text('◀▶・Shiftで仲間を切り替え', x, y + 42, { color: G().C.gray });
        G().text('★ ' + mast, 242, y + 42, { align: 'right', color: mast ? G().C.gold : G().C.gray });
      }
    }

    // ============================================================ learn
    class LearnScreen extends K.Screen {
      constructor(c, job) {
        super();
        this.c = c;
        this.jobs = R.Rules.unlockedJobs(c);
        this.job = job;
        this.list = new R.UI.List({ x: 4, y: 36, w: 248, rows: 8, items: [], drawItem: (row, x, y, w) => this.drawRow(row, x, y, w) });
        this.refresh(false);
      }
      refresh(keep) {
        this.list.setItems(R.Rules.jobAbilities(this.job).map((id) => ({ id, label: K.abName(id) })), keep);
      }
      input() {
        const d = In().dirRepeat();
        if ((d === 'left' || d === 'right') && this.jobs.length > 1) {
          let k = this.jobs.indexOf(this.job);
          k = (k + (d === 'left' ? this.jobs.length - 1 : 1)) % this.jobs.length;
          this.job = this.jobs[k];
          R.sfx('cursor');
          this.refresh(false);
          return;
        }
        const r = this.list.update();
        if (r === 'cancel') this.close();
        else if (r === 'select') this.flow(() => this.learn(this.list.item.id));
      }
      async learn(id) {
        const c = this.c, ab = DB.abilities[id];
        if (R.Rules.learned(c, id)) { await K.msg(ab.name + 'はもう覚えている。'); return; }
        const chk = R.Rules.canLearn(c, id);
        if (!chk.ok) { R.sfx('buzzer'); await K.msg('JPが足りない！\n（' + ab.name + 'には' + (ab.jp || 0) + 'JP必要だ）'); return; }
        if (!(await K.yesno((ab.jp || 0) + 'JPで' + ab.name + 'を覚えますか？'))) return;
        R.Rules.learn(c, id);
        R.sfx('buff');
        await K.msg(c.name + 'は' + ab.name + 'を覚えた！');
        if (R.Rules.isMastered(c, this.job)) {
          await R.jingle('jobup');
          await K.msg(c.name + 'は' + K.jobName(this.job) + 'をマスターした！');
        }
        if (ab.kind !== 'action' && !c.set[ab.kind]) {
          if (await K.yesno(ab.name + 'を\n' + K.KIND_NAMES[ab.kind] + 'にセットしますか？')) {
            const before = Object.assign({}, c.equip);
            R.Rules.setSlot(c, ab.kind, id);
            R.sfx('confirm');
            await reportUnequip(c, before);
          }
        }
      }
      drawRow(row, x, y, w) {
        const c = this.c, ab = DB.abilities[row.id];
        const got = R.Rules.learned(c, row.id);
        badge(ab.kind, x, y);
        G().text(ab.name, x + 14, y, { color: got ? G().C.gray : G().C.white });
        if (got) { check(x + w - 34, y + 2); G().text('済み', x + w - 8, y, { align: 'right', color: G().C.gray }); }
        else {
          const rec = c.jobs[this.job] || { jp: 0 };
          G().text(String(ab.jp || 0), x + w - 8, y, { align: 'right', color: rec.jp >= (ab.jp || 0) ? G().C.yellow : G().C.red });
        }
      }
      render() {
        const c = this.c, j = DB.jobs[this.job];
        const rec = c.jobs[this.job] || { jp: 0 };
        G().window(4, 4, 248, 30);
        K.drawSprite(c, 24, 30, { job: this.job, frame: Math.floor(R.Engine.frame / 20) });
        G().text(j ? j.name : '', 38, 11, { color: R.Rules.isMastered(c, this.job) ? G().C.gold : G().C.white });
        G().text('JP', 162, 11, { color: G().C.gray });
        G().text(String(rec.jp), 240, 11, { align: 'right', color: G().C.yellow });
        if (this.jobs.length > 1) K.lrArrows(10, 246, 13);
        this.list.draw();
        if (!this.list.items.length) G().text('覚えられるアビリティがない。', 20, 44, { color: G().C.gray });
        G().window(4, 164, 248, 54);
        const row = this.list.item;
        if (!row) return;
        const ab = DB.abilities[row.id];
        G().text(K.KIND_NAMES[ab.kind] || '', 14, 171, { color: K.KIND_COLORS[ab.kind] });
        const right = [];
        if (ab.kind === 'action' && ab.mp) right.push('MP ' + R.Rules.mpCost(c, row.id));
        if (ab.kind === 'action' && ab.fieldUse) right.push('フィールドでも使える');
        G().text(right.join('  '), 242, 171, { align: 'right', color: G().C.gray });
        G().wrap(ab.desc || '', 226).slice(0, 2).forEach((l, k) => G().text(l, 14, 185 + k * 14));
      }
    }

    // ============================================================ set
    const SET_ROWS = [
      { slot: 'cmd', label: 'ジョブコマンド' },
      { slot: 'sub', label: 'サブアクション' },
      { slot: 'reaction', label: 'リアクション' },
      { slot: 'support', label: 'サポート' },
      { slot: 'field', label: 'フィールド' },
    ];
    const subLabel = (job) => (DB.jobs[job] ? (DB.jobs[job].command || '特技') : '？？？');
    const subDesc = (c, job) => {
      const acts = R.Rules.actionList(c, job).map(K.abName);
      return K.jobName(job) + 'のアビリティを使う。' + (acts.length ? '\n' + acts.join('、') : '');
    };

    class SetScreen extends K.Screen {
      constructor(o) {
        super();
        this.m = o.member != null ? o.member : lastMember < R.Game.party.length ? lastMember : 0;
        this.row = 1;
        this.opt = null; // {slot, list}
      }
      get c() { return R.Game.party[this.m]; }
      input() {
        if (this.opt) return this.inputOpt();
        const d = In().dirRepeat();
        if (d === 'left' || d === 'right') {
          const n = R.Game.party.length;
          this.m = (this.m + (d === 'left' ? n - 1 : 1)) % n;
          lastMember = this.m;
          R.sfx('cursor');
          return;
        }
        if (d === 'up' || d === 'down') {
          this.row = this.row + (d === 'up' ? -1 : 1);
          if (this.row < 1) this.row = SET_ROWS.length - 1;
          if (this.row >= SET_ROWS.length) this.row = 1;
          R.sfx('cursor');
        }
        if (In().pressed('b')) { R.sfx('cancel'); this.close(); return; }
        if (In().pressed('a')) {
          const slot = SET_ROWS[this.row].slot;
          const opts = R.Rules.slotOptions(this.c, slot);
          if (!opts.length && !this.c.set[slot]) { R.sfx('buzzer'); this.flow(() => K.msg('セットできるアビリティを\nまだ覚えていない。')); return; }
          R.sfx('confirm');
          const items = [{ label: '外す', value: null }].concat(opts.map((v) => ({ label: slot === 'sub' ? subLabel(v) : K.abName(v), value: v })));
          const cur = this.c.set[slot];
          const k = items.findIndex((it) => it.value === cur);
          this.opt = { slot, list: new R.UI.List({ x: 110, y: 40, w: 142, rows: 8, items, index: k >= 0 ? k : Math.min(1, items.length - 1), title: SET_ROWS[this.row].label, drawItem: (row, x, y, w) => this.drawOpt(row, x, y, w) }) };
        }
      }
      inputOpt() {
        const o = this.opt;
        const r = o.list.update();
        if (r === 'cancel') { this.opt = null; return; }
        if (r !== 'select') return;
        const v = o.list.item.value;
        const c = this.c;
        this.opt = null;
        if (c.set[o.slot] === v) return;
        const before = Object.assign({}, c.equip);
        R.Rules.setSlot(c, o.slot, v);
        this.flow(() => reportUnequip(c, before));
      }
      drawOpt(row, x, y, w) {
        if (row.value == null) { G().text('外す', x, y, { color: G().C.cyan }); return; }
        const on = this.c.set[this.opt.slot] === row.value;
        if (this.opt.slot === 'sub') {
          G().text(row.label, x, y, { color: on ? G().C.yellow : G().C.white });
        } else {
          G().text(row.label, x, y, { color: on ? G().C.yellow : G().C.white });
        }
        if (on) G().text('E', x + w - 6, y, { align: 'right', color: G().C.yellow });
      }
      /** description of the highlighted option / slot value */
      descText() {
        const c = this.c;
        let slot, v;
        if (this.opt) { slot = this.opt.slot; const it = this.opt.list.item; v = it ? it.value : null; if (v == null) return { head: '外す', text: 'この枠を空にする。' }; }
        else { slot = SET_ROWS[this.row].slot; v = c.set[slot]; }
        if (!v) return { head: '', text: 'Aボタンでセットするアビリティを選ぶ。' };
        if (slot === 'sub') return { head: subLabel(v) + '（' + K.jobName(v) + '）', text: subDesc(c, v) };
        const ab = DB.abilities[v];
        return { head: ab ? ab.name + '（' + K.jobName(ab.job) + '）' : '', text: (ab && ab.desc) || '' };
      }
      render() {
        const c = this.c;
        G().window(4, 4, 248, 30);
        K.drawSprite(c, 24, 30, { frame: Math.floor(R.Engine.frame / 20) });
        G().text(c.name, 38, 11, { color: K.condColor(c) });
        G().text(K.jobName(c.job), 104, 11, { color: G().C.cyan });
        K.lrArrows(10, 246, 13);
        G().window(4, 36, 248, 16 + SET_ROWS.length * 24 - 6);
        SET_ROWS.forEach((r, i) => {
          const y = 44 + i * 24;
          G().text(r.label, 20, y, { color: r.slot === 'cmd' ? G().C.gray : KIND_COL[r.slot] });
          let val, col = G().C.white;
          if (r.slot === 'cmd') { val = subLabel(c.job); col = G().C.gray; }
          else if (r.slot === 'sub') val = c.set.sub ? subLabel(c.set.sub) + '（' + K.jobName(c.set.sub) + '）' : null;
          else val = c.set[r.slot] ? K.abName(c.set[r.slot]) : null;
          G().text(val || '―――', 36, y + 12, { color: val ? col : G().C.dark });
          if (i === this.row && !this.opt) G().cursor(10, y + 1, !this.busy);
        });
        if (this.opt) this.opt.list.draw();
        const d = this.descText();
        G().window(4, 168, 248, 52);
        if (d.head) {
          G().text(d.head, 14, 175, { color: G().C.yellow });
          G().wrap(d.text, 226).slice(0, 2).forEach((l, k) => G().text(l, 14, 188 + k * 13));
        } else G().wrap(d.text, 226).slice(0, 3).forEach((l, k) => G().text(l, 14, 175 + k * 13, { color: G().C.gray }));
      }
    }
    const KIND_COL = { sub: K.KIND_COLORS.action, reaction: K.KIND_COLORS.reaction, support: K.KIND_COLORS.support, field: K.KIND_COLORS.field };

    return { JobScreen, LearnScreen, SetScreen };
  }

  async function reportUnequip(c, before) {
    const off = Object.keys(before).filter((s) => before[s] && !c.equip[s]).map((s) => before[s]);
    if (off.length) await Menu.kit.msg(removedLines(c, off).join('\n'));
  }

  // ------------------------------------------------------------ pixel bits
  function star(x, y) {
    const c = '#ffd24a';
    G().rect(x + 3, y, 1, 2, c); G().rect(x, y + 2, 7, 1, c); G().rect(x + 1, y + 3, 5, 1, c);
    G().rect(x + 2, y + 4, 3, 1, c); G().rect(x + 1, y + 5, 2, 1, c); G().rect(x + 4, y + 5, 2, 1, c);
  }
  function check(x, y) {
    const c = '#6ee07a';
    for (let i = 0; i < 3; i++) G().rect(x + i, y + 3 + i, 1, 1, c);
    for (let i = 0; i < 5; i++) G().rect(x + 3 + i, y + 4 - i, 1, 1, c);
  }
  /** coloured one-letter kind badge (ア/リ/サ/フ) */
  function badge(kind, x, y) {
    const col = Menu.kit.KIND_COLORS[kind] || '#888';
    G().rect(x - 1, y + 1, 11, 11, col);
    G().text(((Menu.kit.KIND_NAMES[kind] || '？')[0]), x + 4.5, y + 1, { align: 'center', color: '#101018', size: 8 });
  }
  function cursorFrame(x, y, w, h) {
    const on = Math.floor(R.Engine.frame / 12) % 2 === 0;
    const c = on ? '#ffffff' : '#9aa0c8';
    G().strokeRect(x, y, w, h, c);
    // corner brackets
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
      G().rect(Math.min(cx, cx + dx * 4), cy, 5, 1, c); G().rect(cx, Math.min(cy, cy + dy * 4), 1, 5, c);
      G().rect(Math.min(cx + dx, cx + dx * 4), cy + dy, 4, 1, c); G().rect(cx + dx, Math.min(cy + dy, cy + dy * 4), 1, 4, c);
    }
  }
  Menu.kitStar = star;
})(window.RPG);
