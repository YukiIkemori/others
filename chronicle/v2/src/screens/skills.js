// MENUS: 技・術（MODERN_UI §6.8、A13b・A15・A29）
//   人は L/R。覚えた技（武器の系統ごと）と術（属性ごと）だけを出す（覚えていない物・技の書は出さない、A15）。
//   行は名前と M n（MP 0 は青緑）、閃いたばかりの物に NEW（R.Game.seenSkill）。右: 説明 1〜2 行と範囲（ひとり／みんな）。
//   フィールドで使える術は A で相手を選んで唱える。今の武器の系統でない技は「◯を持つと使える」。
//   派生で覚えた技（c.derived）は説明の札に「〇〇から派生」（design/BACKLOG「派生技の閃き」）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const act = (id) => (R.Rules.actionOf ? R.Rules.actionOf(id) : (R.DB.techs[id] || R.DB.spells[id])) || null;
  const RANGE = { enemy: R.T('ui.skills.RANGE.enemy'), enemies: R.T('ui.skills.RANGE.enemies'), ally: R.T('ui.skills.RANGE.ally'), allies: R.T('ui.skills.RANGE.allies'), self: R.T('ui.skills.RANGE.self'), ally_dead: R.T('ui.skills.RANGE.ally_dead'), party: R.T('ui.skills.RANGE.party'), all: R.T('ui.skills.RANGE.all') };

  S.rangeName = (a) => RANGE[(a && (a.target || (a.use && a.use.target))) || ''] || '';
  /** 派生で覚えた技の元の技の名前（R.Glimmer.derivedFrom。派生でなければ null） */
  S.derivedFromName = (c, id) => { const f = R.Glimmer && R.Glimmer.derivedFrom ? R.Glimmer.derivedFrom(c, id) : null; return f ? ((act(f) || {}).name || null) : null; };
  S.isNew = (c, id) => { const s = R.Game && R.Game.seenSkill; return !!(c && s && !(s[c.id] && s[c.id][id])); };

  S.def('skills', {
    init(p) {
      this.ci = 0;
      if (p && p.id) this.ci = Math.max(0, S.party().findIndex((c) => c.id === p.id));
      this.list = new R.UIK.List({ rows: [], rowH: 34 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => { this.markSeen(); this.close(undefined); };
      this.list.onDetail = (row) => { if (row) S.detail({ kind: row.kind, id: row.value, c: this.char() }); };
      this.seen = {};
      this.refresh();
      this.tgt = null;
      this.cards = [];
    },
    char() { return S.party()[this.ci]; },
    refresh(keep) {
      const c = this.char();
      if (!c) { this.list.setRows([]); return; }
      const Rl = R.Rules;
      const techs = (Rl.allTechs ? Rl.allTechs(c) : c.techs || []).map((id) => ({ value: id, kind: 'tech' }));
      const spells = (Rl.spellList ? Rl.spellList(c) : c.spells || []).map((id) => ({ value: id, kind: 'spell' }));
      const rows = techs.concat(spells).map((r) => {
        const a = act(r.value) || {};
        const usable = r.kind === 'spell' && S.fieldUsable(a);
        return Object.assign(r, { label: a.name || r.value, disabled: !usable, a });
      });
      this.list.setRows(rows, keep);
    },
    markSeen() {
      const c = this.char();
      if (!c || !R.Game) return;
      const s = (R.Game.seenSkill = R.Game.seenSkill || {});
      const m = (s[c.id] = s[c.id] || {});
      for (const id of Object.keys(this.seen)) m[id] = true;
      this.seen = {};
    },
    pick(row) {
      const c = this.char();
      if (!row.a || !S.fieldUsable(row.a)) { R.UIK.sfx('buzzer'); return; }
      if (!(c.hp > 0)) { R.UIK.sfx('buzzer'); return; }
      if (R.Rules.mpCost(c, row.value) > c.mp) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.skills.pick.toast'), { anchor: 'bl' }); return; }
      S.targetStart(this, row.a, c, row.value);
    },
    use(targets) {
      const c = this.char(), id = this.tgt.id, a = this.tgt.a;
      const cost = R.Rules.mpCost(c, id);
      if (cost > c.mp) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.skills.use.toast'), { anchor: 'bl' }); this.tgt = null; return; }
      const ok = targets.filter((t) => S.canTarget(a, t));
      if (!ok.length) { R.UIK.sfx('buzzer'); return; }
      const res = S.applyField(a, c, ok);
      if (!res.changed) { R.UIK.sfx('buzzer'); R.UIK.toast(R.T('ui.skills.use.toast_2'), { anchor: 'bl' }); return; }
      c.mp -= cost;
      R.UIK.sfx('heal');
      for (const l of res.lines.slice(0, 2)) R.UIK.toast(l, { anchor: 'bl', icon: 'heal' });
      if (R.Rules.mpCost(c, id) > c.mp) this.tgt = null;
    },
    update() {
      if (this.tgt) { S.targetUpdate(this, (t) => this.use(t), this.cards); return; }
      const k = S.charInput(this.ci, S.party().length, this.lr);
      if (k >= 0) { this.markSeen(); this.ci = k; this.refresh(false); return; }
      this.list.update();
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall(), c = this.char();
      if (!c) return;
      const lw = tall ? b.w : Math.min(u(440), b.w * 0.48);
      // 人の見出し（L/R）
      const hp = { x: b.x, y: b.y, w: lw, h: u(70) };
      R.UIK.panel(g, hp, { frost: true });
      R.UIK.portraitFrame(g, { x: hp.x + u(10), y: hp.y + u(9), w: u(52), h: u(52) }, c.look, {});
      R.UIK.text(g, c.name, hp.x + u(74), hp.y + u(12), { size: u(18), weight: 700, color: C.text });
      const wt = R.Rules.weaponType ? R.Rules.weaponType(c) : null;
      R.UIK.text(g, R.T('ui.skills.draw.text', { title: S.title(c), p1: wt && wt !== 'fist' ? S.wname(wt) : R.T('ui.skills.draw.text_2') }), hp.x + u(74), hp.y + u(40), { size: u(12.5), color: C.text2, maxW: hp.w - u(160) });
      R.UIK.text(g, `MP ${c.mp}`, hp.x + hp.w - u(16), hp.y + u(40), { size: u(13), weight: 700, color: C.text2, align: 'right' });
      const lx = S.lrChips(g, hp.x + hp.w - u(14), hp.y + u(20));
      this.lr = { l: { x: lx - u(4), y: hp.y, w: u(28), h: u(40) }, r: { x: hp.x + hp.w - u(34), y: hp.y, w: u(34), h: u(40) } };
      const lp = { x: b.x, y: hp.y + hp.h + u(10), w: lw, h: tall ? b.h * 0.42 : b.h - hp.h - u(10) };
      R.UIK.panel(g, lp, { frost: true });
      const lr = { x: lp.x + u(8), y: lp.y + u(10), w: lp.w - u(16), h: lp.h - u(20) };
      this.list.active = !this.tgt;
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15), a = row.a || {};
        const ic = row.kind === 'tech' ? a.wtype : (a.elements && a.elements[0]) || 'arts';
        const wrong = row.kind === 'tech' && a.wtype !== wt;
        R.UIK.icon(gg, S.elemIcon(ic), rect.x + u(14), rect.y + (rect.h - sz) / 2, sz, wrong ? C.disabled : f ? C.gold : C.text2);
        const col = wrong ? C.disabled : f ? C.goldHi : C.text;
        const nw = R.UIK.text(gg, row.label, rect.x + u(40), rect.y + (rect.h - sz) / 2 - u(1), { size: sz, weight: f ? 700 : 500, color: col, maxW: rect.w - u(130) });
        if (S.isNew(c, row.value)) { R.UIK.chip(gg, rect.x + u(46) + nw, rect.y + (rect.h - R.UIK.chipH(9.5)) / 2, 'NEW', { kind: 'new', size: 9.5 }); this.seen[row.value] = true; }
        const mp = R.Rules.mpCost ? R.Rules.mpCost(c, row.value) : a.mp || 0;
        R.UIK.text(gg, 'M ' + mp, rect.x + rect.w - u(14), rect.y + (rect.h - sz) / 2, { size: sz, weight: 700, color: mp === 0 ? C.teal : wrong ? C.disabled : C.text2, align: 'right' });
      };
      this.list.draw(g, lr);
      if (!this.list.rows.length) R.UIK.text(g, R.T('ui.skills.draw.text_3'), lr.x + u(16), lr.y + u(8), { size: u(15), color: C.text3 });
      // 右: 説明と人の札
      const rx = tall ? b.x : lp.x + lp.w + u(18), rw = tall ? b.w : b.x + b.w - rx;
      const dp = { x: rx, y: tall ? lp.y + lp.h + u(10) : b.y, w: rw, h: u(tall ? 124 : 150) };
      R.UIK.panel(g, dp, { frost: true });
      const row = this.tgt ? { value: this.tgt.id, a: this.tgt.a, kind: 'spell' } : this.list.current();
      if (row && row.a) {
        const a = row.a;
        R.UIK.text(g, a.name, dp.x + u(20), dp.y + u(16), { size: u(19), weight: 700, color: C.goldHi, maxW: dp.w * 0.6 });
        const sub = row.kind === 'tech' ? R.T('ui.skills.draw.sub', { wname: S.wname(a.wtype) }) : R.T('ui.skills.draw.sub_2', { join: (a.elements || []).map(S.ename).join(R.T('ui.skills.draw.sub.join')) });
        R.UIK.text(g, sub, dp.x + dp.w - u(20), dp.y + u(20), { size: u(12.5), color: C.text3, align: 'right' });
        let yy = dp.y + u(50);
        for (const l of R.UIK.wrap(R.I18n.unwrap(a.desc), dp.w - u(40), { size: u(14.5) }).slice(0, 2)) { R.UIK.text(g, l, dp.x + u(20), yy, { size: u(14.5), color: C.text }); yy += u(24); }
        let cx = dp.x + u(20);
        cx += R.UIK.chip(g, cx, yy + u(4), S.rangeName(a) || '―', { kind: 'plain', size: 11 }) + u(8);
        // 技の特徴（先制・2回・火・守備無視 …）を金の札で。入りきらない分は出さない（持ち主 2026-10-01「違いも分からん」）
        if (row.kind === 'tech' && R.Rules.techTags) {
          const lim = dp.x + dp.w - u(20) - (a.wtype !== wt ? u(110) : 0);
          for (const t of R.Rules.techTags(a)) {
            if (cx + R.UIK.measure(t, { size: u(11), weight: 700 }) + u(20) > lim) break;
            cx += R.UIK.chip(g, cx, yy + u(4), t, { kind: 'plain', size: 11, color: C.gold }) + u(6);
          }
          cx += u(2);
        }
        const from = row.kind === 'tech' ? S.derivedFromName(c, row.value) : null;
        if (from) cx += R.UIK.chip(g, cx, yy + u(4), R.T('ui.skills.draw.cx.chip', { from }), { kind: 'plain', size: 11, color: C.gold }) + u(8);
        if (row.kind === 'tech' && a.wtype !== wt) R.UIK.chip(g, cx, yy + u(4), R.T('ui.skills.draw.chip', { wname: S.wname(a.wtype) }), { kind: 'plain', size: 11, color: C.text3 });
        else if (S.fieldUsable(a)) R.UIK.chip(g, cx, yy + u(4), R.T('ui.skills.draw.chip_2'), { kind: 'teal', size: 11, icon: 'heal' });
      }
      const cp = { x: rx, y: dp.y + dp.h + u(12), w: rw, h: b.y + b.h - (dp.y + dp.h + u(12)) };
      if (this.tgt) R.UIK.text(g, this.tgt.kind === 'all' ? R.T('ui.skills.draw.text_4') : R.T('ui.skills.draw.text_5'), cp.x + u(4), cp.y - u(2), { size: u(13), weight: 700, color: C.gold });
      this.cards = S.memberCards(this, g, { x: cp.x, y: cp.y + (this.tgt ? u(20) : 0), w: cp.w, h: cp.h - (this.tgt ? u(20) : 0) });
      S.prompts(g, this.tgt ? [{ btn: 'a', label: R.T('ui.skills.draw.0.label') }, { btn: 'b', label: R.T('ui.skills.draw.1.label') }] : [{ btn: 'a', label: R.T('ui.skills.draw.0.label_2') }, { btn: 'y', label: R.T('ui.skills.draw.1.label_2') }, { btn: 'r', label: R.T('ui.skills.draw.2.label') }, { btn: 'b', label: R.T('ui.skills.draw.3.label') }]);
    },
  });
})(window.RPG);
