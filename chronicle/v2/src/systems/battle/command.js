// BSCENE: コマンド（MODERN_UI §6.17・§2.3）。ラウンドの初めの一行の命令（戦う／リピート／逃げる）→ 1 人ずつ行動の一覧
// （持っている武器の系統の名前・術・防御・道具）→ 技・術・道具の一覧（見出し「アルン › 剣」、M n、MP 0 は青緑、足りない物は灰色、NEW）
// → ねらい（targeting.js）。技・術は MP の少ない順（同じなら覚えた順）。術は属性のタブ（R.SkillTabs。←→ と札のクリック。
//   L/R はタブに使わない: 一覧の中でもリピート・速さのまま。持ち主 2026-10-01）。技は今の武器の系統だけなのでタブは出ない。
// カーソル記憶は R.Game.battle.cursor[人の id]（設定 cursorMemory）。NEW は一覧を見せたら R.Game.seenSkill に書く。
// 縦持ちは親指の届く横一列の大きな札と説明の帯（battle_tall.png）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const C = (_.cmd = {});

  const WNAME = { sword: R.T('battle.command.WNAME.sword'), greatsword: R.T('battle.command.WNAME.greatsword'), dagger: R.T('battle.command.WNAME.dagger'), bow: R.T('battle.command.WNAME.bow'), staff: R.T('battle.command.WNAME.staff') };
  const TARGET_JA = { enemy: R.T('battle.command.TARGET_JA.enemy'), group: R.T('battle.command.TARGET_JA.group'), enemies: R.T('battle.command.TARGET_JA.enemies'), random: R.T('battle.command.TARGET_JA.random'), ally: R.T('battle.command.TARGET_JA.ally'), ally_other: R.T('battle.command.TARGET_JA.ally_other'), ally_any: R.T('battle.command.TARGET_JA.ally_any'), ally_dead: R.T('battle.command.TARGET_JA.ally_dead'), allies: R.T('battle.command.TARGET_JA.allies'), party: R.T('battle.command.TARGET_JA.party'), self: R.T('battle.command.TARGET_JA.self') };
  C.WNAME = WNAME;
  C.TARGET_JA = TARGET_JA;
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* ignore */ } };
  /** 今の入力のボタンの字（キーボード Q・パッド LB など。割り当ての変更も反映。R.Input.prompt） */
  const glyphLabel = (btn) => { try { const p = R.Input.prompt(btn); return (p && p.label) || String(btn).toUpperCase(); } catch (e) { return String(btn).toUpperCase(); } };

  function mem(uid, st) {
    const G = R.Game;
    const on = R.Settings.get('cursorMemory') !== false;
    const u = st.unit(uid);
    const key = (u && u.id) || uid;
    st.localMem = st.localMem || {};
    if (!on || !G || !G.battle) return (st.localMem[key] = st.localMem[key] || {});
    G.battle.cursor = G.battle.cursor || {};
    return (G.battle.cursor[key] = G.battle.cursor[key] || {});
  }
  C.mem = mem;

  // ---------------------------------------------------------------- 一覧の部品（上下で選ぶ。縦持ちの横一列の札は horizontal）
  function menu(st, o) {
    return new Promise((resolve) => {
      const n = o.rows.length;
      const w = { sel: Math.max(0, Math.min(n - 1, o.sel || 0)), rects: [], prompts: o.prompts, tallPrompts: o.tallPrompts, top: 0, o };
      w.tabbed = !!(o.tabs && o.tabs.groups.length > 1 && R.SkillTabs);
      w.tabRects = [];
      let last = -1;
      const done = (v) => { if (st.ui === w) st.ui = null; if (o.onClose) o.onClose(w); resolve(v); };
      const choose = (i) => {
        if (!o.rows[i] || o.rows[i].disabled) { sfx('buzzer'); return; }
        sfx('confirm');
        done(i);
      };
      w.update = function () {
        const I = R.Input;
        if (st.chipTap && o.onChip) { const c = st.chipTap; st.chipTap = null; const r = o.onChip(c); if (r !== undefined) { done(r); return; } }
        st.chipTap = null;
        // 種類のタブ（o.tabs = {groups, index}）: ←→・札のクリックで {tab: i} を返す（呼んだ側が一覧を替えて開き直す）
        if (w.tabbed) { const j = R.SkillTabs.input(o.tabs.groups.length, o.tabs.index, w.tabRects, { arrows: !o.horizontal }); if (j >= 0) { done({ tab: j, sel: w.sel }); return; } }
        if (!n) { if (I.pressed('b')) done('back'); return; }
        const fwd = o.horizontal ? 'right' : 'down', back = o.horizontal ? 'left' : 'up';
        if (I.repeat(fwd)) { w.sel = (w.sel + 1) % n; sfx('cursor'); }
        if (I.repeat(back)) { w.sel = (w.sel + n - 1) % n; sfx('cursor'); }
        if (w.sel !== last) { last = w.sel; if (o.onFocus) o.onFocus(w.sel, w); }
        const p = I.pointer;
        // 縦持ちの札の「戻る」（タップ）
        if (p && p.pressed && w.backRect && o.cancel !== false && p.x >= w.backRect.x && p.x <= w.backRect.x + w.backRect.w && p.y >= w.backRect.y && p.y <= w.backRect.y + w.backRect.h) { sfx('cancel'); done('back'); return; }
        if (p && (p.pressed || p.longPress)) {
          for (let i = 0; i < w.rects.length; i++) {
            const r = w.rects[i];
            if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
              w.sel = r.i != null ? r.i : i;
              if (p.longPress && o.detail) { o.detail(w.sel); return; }
              if (p.pressed) { choose(w.sel); return; }
            }
          }
        }
        if (I.pressed('a')) choose(w.sel);
        else if (I.pressed('b') && o.cancel !== false) { sfx('cancel'); done('back'); }
        else if ((I.pressed('x') || I.pressed('y')) && o.detail) o.detail(w.sel);
      };
      w.draw = (g) => o.draw(g, w);
      st.ui = w;
    });
  }
  C.menu = menu;

  // ---------------------------------------------------------------- 描き方（16:9 の小さな窓）
  const K = () => _.K;
  function listPanel(g, w, geo) {
    const k = R.uiScale || 1, Kt = K(), t = R.Engine.time;
    const rows = w.o.rows, rowH = geo.rowH * k, barH = w.tabbed ? (R.SkillTabs.BAR_H + 4) * k : 0, head = (geo.title ? 28 * k : 6 * k) + barH;
    const vis = Math.min(rows.length, geo.maxRows || 7);
    if (w.sel < w.top) w.top = w.sel;
    if (w.sel >= w.top + vis) w.top = w.sel - vis + 1;
    const h = head + vis * rowH + 8 * k;
    const r = { x: geo.x, y: geo.y, w: geo.w * k, h };
    const open = w.o.t0 != null ? Math.min(1, (R.Engine.time - w.o.t0) / 140) : 1;
    g.save();
    g.globalAlpha = open;
    g.translate(0, (1 - open) * 6);
    Kt.box(g, r, { a: 0.6, r: 6 });
    if (geo.title) {
      Kt.text(g, geo.title, r.x + 12 * k, r.y + 8 * k, { size: 11 * k, weight: 700, color: Kt.COL.gold, raw: true });
      Kt.hline(g, r.x + 8 * k, r.x + r.w - 8 * k, r.y + 25 * k, 0.2);
    }
    if (w.tabbed) w.tabRects = R.SkillTabs.drawBar(g, { x: r.x + 8 * k, y: r.y + (geo.title ? 28 : 4) * k, w: r.w - 16 * k, h: R.SkillTabs.BAR_H * k }, w.o.tabs.groups, w.o.tabs.index, { glyphs: ['left', 'right'], size: 12 });
    w.rects = [];
    for (let j = 0; j < vis; j++) {
      const i = w.top + j, row = rows[i];
      const ry = r.y + head + j * rowH;
      const rr = { x: r.x + 4 * k, y: ry + 1 * k, w: r.w - 8 * k, h: rowH - 2 * k, i };
      w.rects.push(rr);
      const f = i === w.sel;
      if (f) Kt.focus(g, rr, t);
      const dis = row.disabled;
      let tx = r.x + 16 * k;
      if (row.icon) { Kt.icon(g, row.icon, r.x + 14 * k, ry + rowH / 2 - 7.5 * k, 15 * k, dis ? Kt.COL.disabled : f ? Kt.COL.goldHi : Kt.COL.text2); tx = r.x + 36 * k; }
      const size = (geo.size || 14) * k;
      const label = Kt.fit(row.label, r.w - (tx - r.x) - (row.right ? 52 * k : 12 * k) - (row.isNew ? 40 * k : 0), { size, weight: f ? 700 : 500 });
      Kt.text(g, label, tx, ry + (rowH - size) / 2 - 1 * k, { size, weight: f ? 700 : 500, color: dis ? Kt.COL.disabled : f ? '#fff8e6' : Kt.COL.text, raw: true });
      if (row.isNew) {
        const nx = tx + Kt.measure(label, { size, weight: f ? 700 : 500 }) + 6 * k;
        Kt.chip(g, nx, ry + rowH / 2 - 8 * k, 'NEW', { size: 8.5 * k, color: '#241a08', bg: Kt.COL.gold, line: 'rgba(255,240,200,0.6)' });
      }
      if (row.right) Kt.text(g, row.right, r.x + r.w - 12 * k, ry + (rowH - 11.5 * k) / 2, { size: 11.5 * k, weight: 700, align: 'right', color: row.free ? Kt.COL.teal : dis ? Kt.COL.disabled : Kt.COL.text2, raw: true });
    }
    // スクロールのつまみ
    if (rows.length > vis) {
      const th = (vis / rows.length) * (vis * rowH), ty = r.y + head + (w.top / rows.length) * (vis * rowH);
      g.fillStyle = 'rgba(240,228,200,0.35)'; g.fillRect(r.x + r.w - 3 * k, ty, 2 * k, th);
    }
    g.restore();
    return r;
  }
  /** 説明の小さな窓（右隣）。数字の効果は出さない（A17） */
  function descBox(g, x, y, d, maxRight) {
    if (!d || !d.text) return;
    const k = R.uiScale || 1, Kt = K();
    const w = Math.min((maxRight || R.W) - x - 12 * k, 240 * k);
    if (w < 120 * k) return;
    const lines = (R.UIK && R.UIK.wrap ? R.UIK.wrap(d.text, w - 24 * k, { size: 12 * k }) : [d.text]).slice(0, 2);
    // 技の特徴の行（金色。説明の文の下、狙いの行の上）
    const tags = d.tags ? (R.UIK && R.UIK.wrap ? R.UIK.wrap(d.tags, w - 24 * k, { size: 11.5 * k }) : [d.tags]).slice(0, 1) : [];
    const h = (lines.length * 18 + tags.length * 18 + (d.sub ? 20 : 0) + 18) * k;
    Kt.box(g, { x, y, w, h }, { a: 0.6, r: 8 });
    lines.forEach((l, i) => Kt.text(g, l, x + 12 * k, y + 9 * k + i * 18 * k, { size: 12 * k, color: Kt.COL.text2, raw: true }));
    if (tags.length) Kt.text(g, tags[0], x + 12 * k, y + 10 * k + lines.length * 18 * k, { size: 11.5 * k, weight: 700, color: Kt.COL.gold || '#e8c87a', raw: true });
    if (d.sub) Kt.text(g, d.sub, x + 12 * k, y + 11 * k + (lines.length + tags.length) * 18 * k, { size: 10.5 * k, color: Kt.COL.text3, raw: true });
  }
  C.descBox = descBox;

  // ---------------------------------------------------------------- 描き方（縦持ちの大きな札と説明の帯）
  function tallCards(g, w, st, who) {
    const k = R.uiScale || 1, Kt = K(), L = st.L, t = R.Engine.time;
    const rows = w.o.rows, n = rows.length;
    const pad = 12 * k, gap = 8 * k, y = L.cmdY + 20 * k, h = 88 * k;
    const cw = (R.W - pad * 2 - gap * (n - 1)) / Math.max(1, n);
    if (who) Kt.text(g, who, pad + 4 * k, L.cmdY, { size: 13 * k, weight: 700, color: Kt.COL.gold, raw: true });
    // 右上に「戻る」（ひとつ前の人へ。縦持ちはボタン表示を出さないので、ここで見せる）
    w.backRect = null;
    if (who && w.o.cancel !== false) {
      const bs = Math.max(12 * k, R.minFont || 0), bw = Kt.measure(R.T('battle.command.tallCards.bw.measure'), { size: bs, weight: 700 }) + 30 * k, bh = 22 * k;
      const br = { x: R.W - pad - bw, y: L.cmdY - 4 * k, w: bw, h: bh };
      Kt.box(g, br, { a: 0.5, r: 8 * k, edge: 'rgba(240,228,200,0.35)' });
      Kt.text(g, R.T('battle.command.tallCards.text'), br.x + br.w / 2, br.y + (bh - bs) / 2, { size: bs, weight: 700, align: 'center', color: Kt.COL.text, raw: true });
      const hh = Math.max(bh, R.minTouch || 0);
      w.backRect = { x: br.x - 6 * k, y: br.y + bh - hh, w: bw + 12 * k, h: hh };
    }
    w.rects = [];
    rows.forEach((row, i) => {
      const r = { x: pad + i * (cw + gap), y, w: cw, h, i };
      w.rects.push(r);
      const f = i === w.sel;
      Kt.box(g, r, { a: f ? 0.55 : 0.72, r: 14 * k, edge: f ? 'rgba(236,201,124,0.8)' : 'rgba(240,228,200,0.16)' });
      if (f) Kt.focus(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, t, { cursor: false });
      const col = row.disabled ? Kt.COL.disabled : f ? Kt.COL.goldHi : Kt.COL.text2;
      if (row.icon) Kt.icon(g, row.icon, r.x + r.w / 2 - 15 * k, r.y + 13 * k, 30 * k, col);
      Kt.text(g, Kt.fit(row.label, r.w - 8 * k, { size: 16 * k, weight: 700 }), r.x + r.w / 2, r.y + h - 30 * k, { size: 16 * k, weight: 700, align: 'center', color: row.disabled ? Kt.COL.disabled : f ? '#fff8e6' : Kt.COL.text, raw: true });
    });
    const d = w.o.desc ? w.o.desc(w.sel) : null;
    const by = y + h + 10 * k;
    Kt.box(g, { x: pad, y: by, w: R.W - pad * 2, h: 46 * k }, { a: 0.6, r: 12 * k, edge: 'rgba(240,228,200,0.16)' });
    if (d && d.text) Kt.text(g, Kt.fit(d.text + (d.sub ? '　' + d.sub : ''), R.W - pad * 2 - 32 * k, { size: 13 * k }), pad + 16 * k, by + 15 * k, { size: 13 * k, color: Kt.COL.text2, raw: true });
    tallHint(g, st);
  }
  function tallList(g, w, st, title) {
    const k = R.uiScale || 1, Kt = K(), L = st.L, t = R.Engine.time;
    const rows = w.o.rows, pad = 12 * k;
    const top = L.cmdY - 8 * k, rowH = 34 * k;
    const barH = w.tabbed ? (R.SkillTabs.BAR_H + 4) * k : 0;
    const maxRows = Math.max(2, Math.floor((L.chipsY - top - 100 * k - barH) / rowH));
    const vis = Math.min(rows.length, maxRows);
    if (w.sel < w.top) w.top = w.sel;
    if (w.sel >= w.top + vis) w.top = w.sel - vis + 1;
    const r = { x: pad, y: top, w: R.W - pad * 2, h: 30 * k + barH + vis * rowH + 8 * k };
    Kt.box(g, r, { a: 0.72, r: 12 * k, edge: 'rgba(240,228,200,0.2)' });
    Kt.text(g, title, r.x + 14 * k, r.y + 9 * k, { size: 13 * k, weight: 700, color: Kt.COL.gold, raw: true });
    // 右上に「戻る」（縦持ちはボタン表示を出さないので、押せる札で）
    w.backRect = null;
    if (w.o.cancel !== false) {
      // 見た目は見出しの行の右の小さな札、押せる所は上下へ広げて 44 CSS px 以上
      const bs = Math.max(12 * k, R.minFont || 0), bw = Kt.measure(R.T('battle.command.tallList.bw.measure'), { size: bs, weight: 700 }) + 30 * k, bh = 24 * k;
      const br = { x: r.x + r.w - bw - 8 * k, y: r.y + 4 * k, w: bw, h: bh };
      Kt.box(g, br, { a: 0.5, r: 8 * k, edge: 'rgba(240,228,200,0.35)' });
      Kt.text(g, R.T('battle.command.tallList.text'), br.x + br.w / 2, br.y + (bh - bs) / 2, { size: bs, weight: 700, align: 'center', color: Kt.COL.text, raw: true });
      const hh = Math.max(bh, R.minTouch || 0);
      w.backRect = { x: br.x - 6 * k, y: br.y + bh - hh, w: bw + 12 * k, h: hh };   // 上へ広げる（下の行に掛からない）
    }
    if (w.tabbed) w.tabRects = R.SkillTabs.drawBar(g, { x: r.x + 10 * k, y: r.y + 30 * k, w: r.w - 20 * k, h: R.SkillTabs.BAR_H * k }, w.o.tabs.groups, w.o.tabs.index, { glyphs: ['left', 'right'], size: 13 });
    w.rects = [];
    for (let j = 0; j < vis; j++) {
      const i = w.top + j, row = rows[i], ry = r.y + 30 * k + barH + j * rowH, f = i === w.sel;
      const rr = { x: r.x + 6 * k, y: ry, w: r.w - 12 * k, h: rowH - 2 * k, i };
      w.rects.push(rr);
      if (f) Kt.focus(g, rr, t);
      const size = 16 * k;
      Kt.text(g, Kt.fit(row.label, rr.w - 90 * k, { size, weight: f ? 700 : 500 }), rr.x + 14 * k, ry + (rowH - size) / 2 - 1, { size, weight: f ? 700 : 500, color: row.disabled ? Kt.COL.disabled : f ? '#fff8e6' : Kt.COL.text, raw: true });
      if (row.isNew) Kt.chip(g, rr.x + 22 * k + Kt.measure(row.label, { size, weight: f ? 700 : 500 }), ry + rowH / 2 - 9 * k, 'NEW', { size: 9.5 * k, color: '#241a08', bg: Kt.COL.gold });
      if (row.right) Kt.text(g, row.right, rr.x + rr.w - 12 * k, ry + (rowH - 13 * k) / 2, { size: 13 * k, weight: 700, align: 'right', color: row.free ? Kt.COL.teal : row.disabled ? Kt.COL.disabled : Kt.COL.text2, raw: true });
    }
    const d = w.o.desc ? w.o.desc(w.sel) : null;
    const by = r.y + r.h + 8 * k;
    Kt.box(g, { x: pad, y: by, w: R.W - pad * 2, h: 46 * k }, { a: 0.6, r: 12 * k, edge: 'rgba(240,228,200,0.16)' });
    if (d && d.text) Kt.text(g, Kt.fit(d.text + (d.sub ? '　' + d.sub : ''), R.W - pad * 2 - 32 * k, { size: 13 * k }), pad + 16 * k, by + 15 * k, { size: 13 * k, color: Kt.COL.text2, raw: true });
    tallHint(g, st);
  }
  function tallHint(g, st) {
    const k = R.uiScale || 1, Kt = K();
    const dev = R.Input.lastDevice;
    const s = dev === 'touch' || !dev ? R.T('battle.command.tallHint.s') : '';
    if (s) Kt.text(g, s, R.W / 2, R.H - (R.safe.b || 0) - 34 * k, { size: 11.5 * k, color: Kt.COL.text3, align: 'center', raw: true });
  }

  /** 行動する人の頭の左上（人の left − 150, top − 128）。画面に収める */
  function anchorFor(st, uid, w, h, dx, dy) {
    const a = st.actor(uid), k = R.uiScale || 1;
    const top = a ? a.y - _.actors.height(a) : 200;
    let x = (a ? a.x - 20 : 500) + dx * k, y = top + dy * k;
    x = Math.max(12 * k, Math.min(R.W - w - 12 * k, x));
    y = Math.max(70 * k, Math.min(R.H - h - 40 * k, y));
    return { x, y };
  }

  // ---------------------------------------------------------------- 一行の命令（戦う／リピート／逃げる）
  C.partyMenu = async function (st) {
    const po = st.partyOpts || ['fight'];
    const NAMES = { fight: [R.T('battle.command.partyMenu.NAMES.fight.0'), 'sword'], repeat: [R.T('battle.command.partyMenu.NAMES.repeat.0'), 'repeat'], escape: [R.T('battle.command.partyMenu.NAMES.escape.0'), 'exit'] };
    const all = ['fight', 'repeat', 'escape'].filter((c) => c !== 'escape' || !st.setup.noEscape);
    const rows = all.map((c) => ({ key: c, label: NAMES[c][0], icon: NAMES[c][1], disabled: !po.includes(c) }));
    const m = st.localMem = st.localMem || {};
    const G = R.Game;
    const memOn = R.Settings.get('cursorMemory') !== false;
    const start = memOn && G && G.battle && G.battle.cursor && G.battle.cursor._party != null ? G.battle.cursor._party : (m._party || 0);
    st.activeUid = null;
    const sub0 = po.includes('repeat') ? R.T('battle.command.partyMenu.head.sub', { l: glyphLabel('l'), b: glyphLabel('b') }) : R.T('battle.command.partyMenu.head.sub_2');
    st.head = { name: R.T('battle.command.partyMenu.head.name'), sub: sub0 };
    // 灰色の「逃げる」に合わせたら、わけを説明の行に（テスター 2026-09-30 2-3）
    const boss = !!((st.info && st.info.boss) || (st.B && st.B.engine && st.B.engine.boss));
    const escWhy = boss ? R.T('battle.command.partyMenu.escapeWhy.boss') : R.T('sys.battle_core.UNUSABLE_TEXT.noescape');
    const k = R.uiScale || 1;
    const i = await menu(st, {
      rows, sel: rows[start] && !rows[start].disabled ? start : 0, t0: R.Engine.time, cancel: false,
      onFocus(j) { if (st.head) st.head.sub = rows[j] && rows[j].key === 'escape' && rows[j].disabled ? escWhy : sub0; },
      prompts: [{ btn: 'a', label: R.T('battle.command.partyMenu.i.prompts.0.label') }, { btn: 'r', label: R.T('battle.command.partyMenu.i.prompts.1.label') }],
      onChip: (c) => { const j = rows.findIndex((r) => r.key === c && !r.disabled); return j >= 0 ? j : undefined; },   // L・札のリピート
      draw(g, w) {
        const n = st.partyUnits().length;
        const x = R.W - (R.safe.r || 0) - 14 * k - 150 * k, y = (14 + n * 44) * k;
        listPanel(g, w, { x, y, w: 150, rowH: 26, size: 13.5 });
      },
    });
    const idx = typeof i === 'number' ? i : 0;
    m._party = idx;
    if (memOn && G && G.battle) { G.battle.cursor = G.battle.cursor || {}; G.battle.cursor._party = idx; }
    return rows[idx].key;
  };

  // ---------------------------------------------------------------- 1 ラウンドの全員の行動
  C.commandRound = async function (st) {
    const B = st.B;
    const members = st.partyUnits().filter((u) => {
      const v = st.vis[u.uid];
      if (!(v ? v.alive : u.alive)) return false;
      const o = B.options(u.uid);
      return Array.isArray(o) && o.length > 0;
    });
    let i = 0;
    while (i < members.length) {
      const u = members[i];
      // 選び直す人の前の命令は取り消す（取り置いた道具の数を戻す。1-7）
      if (typeof B.unsubmit === 'function') { try { B.unsubmit(u.uid); } catch (e) { /* ignore */ } }
      const r = await C.member(st, u, i);
      if (r && r.party) { st.activeUid = null; return r; }
      if (r === 'back') {
        if (i === 0) { st.activeUid = null; return 'back'; }
        i--; continue;
      }
      try { B.submit(u.uid, r); } catch (e) { console.error('[battle submit]', e); }
      i++;
    }
    st.activeUid = null;
    return 'ok';
  };

  function markSeen(rows) {
    const G = R.Game;
    if (!G) return;
    G.seenSkill = G.seenSkill || {};
    for (const r of rows) if (r.isNew && r.id) G.seenSkill[r.id] = true;
  }

  /** 1 人の行動を決める → {cmd, id, target} | 'back' | {party} */
  C.member = async function (st, u, idx) {
    const B = st.B, k = R.uiScale || 1;
    const opts = B.options(u.uid) || [];
    const find = (c) => opts.find((o) => o.cmd === c);
    const atk = find('attack'), sk = find('skill'), sp = find('spell'), df = find('defend'), it = find('item');
    const wname = WNAME[u.wtype] || R.T('battle.command.member.wname');
    const top = [];
    if (atk || sk) top.push({ key: 'weapon', label: wname, icon: u.wtype || 'sword' });
    if (sp) top.push({ key: 'spell', label: R.T('battle.command.member.spell.label'), icon: 'arts', disabled: !(sp.list && sp.list.length) });
    if (df) top.push({ key: 'defend', label: R.T('battle.command.member.defend.label'), icon: 'shield' });
    if (it) top.push({ key: 'item', label: R.T('battle.command.member.item.label'), icon: 'bag', disabled: !(it.list && it.list.length) });
    for (const o of opts) if (!['attack', 'skill', 'spell', 'defend', 'item'].includes(o.cmd)) top.push({ key: o.cmd, label: o.name || o.cmd, icon: 'star', opt: o });
    const M = mem(u.uid, st);
    st.activeUid = u.uid;
    const DESC = {
      weapon: R.T('battle.command.member.DESC.weapon', { p0: wname === R.T('battle.command.member.wname') ? R.T('battle.command.member.DESC.weapon_2') : wname }), spell: R.T('battle.command.member.DESC.spell'), defend: R.T('battle.command.member.DESC.defend'), item: R.T('battle.command.member.DESC.item'),
    };
    const onChip = (c) => (c === 'repeat' && st.partyOpts.includes('repeat')) || (c === 'escape' && st.partyOpts.includes('escape')) ? { party: c } : undefined;
    for (;;) {
      st.head = { name: R.T('battle.command.member.head.name', { name: u.name }), sub: R.T('battle.command.member.head.sub') };
      const topSel = Math.min(top.length - 1, M.top || 0);
      const ti = await menu(st, {
        rows: top, sel: top[topSel] && !top[topSel].disabled ? topSel : 0, t0: R.Engine.time, onChip,
        prompts: [{ btn: 'a', label: R.T('battle.command.member.ti.prompts.0.label') }, { btn: 'b', label: R.T('battle.command.member.ti.prompts.1.label') }, { btn: 'r', label: R.T('battle.command.member.ti.prompts.2.label') }],
        tallPrompts: false,
        onFocus(i) { st.head.sub = (DESC[top[i].key] || '') + (top[i].key === 'weapon' ? R.T('battle.command.member.ti.onFocus.sub') : ''); },
        desc: (i) => ({ text: (DESC[top[i].key] || '') + (top[i].key === 'weapon' ? R.T('battle.command.member.ti.desc.text') : '') }),
        draw(g, w) {
          if (st.L.tall) { tallCards(g, w, st, u.name); return; }
          const h = (28 + top.length * 26 + 8) * k;
          const p = anchorFor(st, u.uid, 128 * k, h, -150, -128);
          listPanel(g, w, { x: p.x, y: p.y, w: 128, rowH: 26, title: u.name, size: 14 });
        },
      });
      if (ti === 'back' || (ti && ti.party)) return ti;
      // 防御だけは覚えない（テスター 2026-09-30 2-1: 決定の連打で防御し続けてしまう）。次のラウンドは既定の命令（先頭）から
      M.top = top[ti] && top[ti].key === 'defend' ? 0 : ti;
      const sel = top[ti];
      let res = null;
      if (sel.key === 'defend') res = { cmd: 'defend', id: 'defend', target: u.uid };
      else if (sel.key === 'weapon') {
        const rows = [];
        if (atk) rows.push({ id: 'attack', label: R.T('battle.command.member.attack.label'), cmd: 'attack', target: atk.target || 'enemy', usable: true });
        // 技は MP の少ない順（同じなら覚えた順。持ち主 2026-10-01）。「攻撃」はいつも先頭
        for (const s of sortByMp(u, (sk && sk.list) || [])) rows.push(skillRow(s, 'skill', sk.target));
        if (rows.length === 1 && atk) res = await targetFor(st, u, rows[0], M);
        else res = await subList(st, u, rows, `${u.name} › ${wname}`, 'weapon', M);
      } else if (sel.key === 'spell') {
        // 術は属性のタブに分ける（火・水 … 合成）。中は MP の少ない順
        const srows = sp.list.map((s) => Object.assign(skillRow(s, 'spell', sp.target), { kind: 'spell', mp: s.mp }));
        const groups = R.SkillTabs ? R.SkillTabs.group({ spells: srows.map((r) => r.id) }, srows, { cost: (id) => (srows.find((r) => r.id === id) || {}).mp || 0 }) : [{ id: 'all', items: srows }];
        res = await subList(st, u, groups.length === 1 ? groups[0].items : srows, R.T('battle.command.member.res.subList', { name: u.name }), 'spell', M, groups.length > 1 ? groups : null);
      }
      else if (sel.key === 'item') res = await subList(st, u, it.list.map((s) => skillRow(s, 'item', it.target)), R.T('battle.command.member.res.subList_2', { name: u.name }), 'item', M);
      else if (sel.opt) res = await targetFor(st, u, { id: sel.key, cmd: sel.key, target: sel.opt.target || 'self' }, M);
      if (res && res !== 'back') return res;
    }
  };

  /** 戦闘の一覧の行（{id, mp}）を MP の少ない順に（R.SkillTabs.sortIds。同じなら覚えた順 → id） */
  function sortByMp(u, list) {
    if (!R.SkillTabs || !list.length) return list;
    const by = {}; for (const s of list) by[s.id] = s;
    const ids = list.map((s) => s.id);
    return R.SkillTabs.sortIds({ techs: ids, spells: ids }, ids, (id) => by[id].mp || 0).map((id) => by[id]);   // 一覧の並び = 覚えた順
  }
  C.sortByMp = sortByMp;   // テスト用

  function skillRow(s, cmd, target) {
    const dbk = cmd === 'skill' ? 'techs' : cmd === 'spell' ? 'spells' : 'items';
    const d = (R.DB[dbk] && R.DB[dbk][s.id]) || {};
    const G = R.Game;
    const isNew = !!s.isNew && !(G && G.seenSkill && G.seenSkill[s.id]);
    let right = '';
    if (cmd !== 'item' && s.mp != null) right = 'M ' + s.mp;
    // 道具の数は戦闘の袋から（このラウンドにほかの仲間が選んだ分は引いてある。1-7）。無ければ R.Game の袋
    if (cmd === 'item') { const n = typeof s.n === 'number' ? s.n : G && G.items ? G.items[s.id] : null; if (n != null) right = '×' + n; }
    return {
      id: s.id, label: s.name || d.name || s.id, cmd, right, free: cmd === 'spell' && s.mp === 0, disabled: s.usable === false,
      reason: s.reason || null, isNew, target: s.target || d.target || target || 'enemy', desc: d.desc || s.desc || '', element: d.element,
      // 技の特徴（先制・2回・火・守備無視 …）。持ち主 2026-10-01「同じようなのがあって違いも分からん」
      tags: cmd === 'skill' && R.Rules.techTagLine ? R.Rules.techTagLine(d) : '',
    };
  }

  function targetName(st, M, row) {
    const t = row.target;
    if (t !== 'enemy') return '';
    const uid = M.target;
    const a = uid != null ? st.aliveEnemies().find((x) => x.uid === uid) : null;
    return a ? a.name : (st.aliveEnemies()[0] || {}).name || '';
  }

  /** 技・術・道具の一覧の窓の幅（掛ける前）。いちばん長い名前＋NEW＋右の MP・個数が入る幅（172〜300）。
   *  テスター 2026-09-30 1-10: 幅が決まっていて、NEW の付いた技の名前が「武器落…」のように切れていた */
  function subListWidth(rows, title) {
    const k = R.uiScale || 1, Kt = K();
    let need = 172;
    const size = 14 * k;
    for (const row of rows) {
      const lw = Kt.measure(row.label || '', { size, weight: 700 }) / k;
      need = Math.max(need, 36 + lw + (row.isNew ? 40 : 0) + (row.right ? 52 : 12) + 4);
    }
    if (title) need = Math.max(need, Kt.measure(title, { size: 11 * k, weight: 700 }) / k + 24);
    return Math.min(300, Math.ceil(need));
  }

  C.subListWidth = subListWidth;   // テスト用

  /** groups（R.SkillTabs.group の結果。2 つ以上）があれば種類のタブ。タブは人ごとに覚え（R.SkillTabs.remember、この起動の間）、
   *  カーソルはタブごとに M[memKey + ':' + タブ] */
  async function subList(st, u, rows, title, memKey, M, groups) {
    const k = R.uiScale || 1;
    const shown = new Set();
    const cid = (u && (u.id || (u.c && u.c.id))) || (u && u.uid);
    let tab = groups ? R.SkillTabs.startIndex(groups, cid, 'battle_' + memKey) : 0, anim = true;
    const ckey = () => (groups ? memKey + ':' + groups[tab].id : memKey);
    for (;;) {
      if (groups) rows = groups[tab].items;
      const start = Math.min(rows.length - 1, M[ckey()] || 0);
      st.head = { name: R.T('battle.command.subList.head.name', { name: u.name }), sub: memKey === 'weapon' ? R.T('battle.command.subList.head.sub', { p0: C.WNAME[u.wtype] || R.T('battle.command.subList.head.sub_2') }) : memKey === 'spell' ? R.T('battle.command.subList.head.sub_3') : R.T('battle.command.subList.head.sub_4') };
      const i = await menu(st, {
        rows, sel: Math.max(0, start), t0: anim ? R.Engine.time : null, tabs: groups ? { groups, index: tab } : null,
        prompts: st.L.tall ? null : [{ btn: 'a', label: R.T('battle.command.subList.i.prompts.0.label') }, { btn: 'b', label: R.T('battle.command.subList.i.prompts.1.label') }, { btn: 'x', label: R.T('battle.command.subList.i.prompts.2.label') }, { btn: 'r', label: R.T('battle.command.subList.i.prompts.3.label') }],
        tallPrompts: false,
        onFocus(i) { shown.add(i); },
        onClose() { const rs = rows; markSeen([...shown].map((i) => rs[i]).filter(Boolean)); shown.clear(); },
        detail(i) { const r = rows[i]; if (r && R.Screens && R.Screens.open) R.Screens.open('detail', { kind: r.cmd === 'skill' ? 'tech' : r.cmd, id: r.id }); },
        desc(i) {
          const r = rows[i];
          if (!r) return null;
          const text = r.reason === 'reach' ? R.T('battle.command.subList.i.desc.text') : r.disabled && r.reason === 'mp' ? R.T('battle.command.subList.i.desc.text_2') : r.disabled && r.reason === 'nodead' ? R.T('battle.command.subList.i.desc.text_3') : r.id === 'attack' ? R.T('battle.command.subList.i.desc.text_4') : r.desc || '';
          const tn = targetName(st, M, r);
          return { text, tags: r.reason === 'reach' || r.id === 'attack' ? '' : r.tags || '', sub: (TARGET_JA[r.target] || '') + (tn ? R.T('battle.command.subList.i.desc.sub', { tn }) : '') };
        },
        draw(g, w) {
          if (st.L.tall) { tallList(g, w, st, title); return; }
          const h = (28 + (w.tabbed ? R.SkillTabs.BAR_H + 4 : 0) + Math.min(rows.length, 7) * 26 + 8) * k;
          // タブの帯があるときは、どのタブでも同じ幅（切り替えで窓が揺れない）。帯が入る幅（256）以上
          const pw = groups ? Math.max(256, ...groups.map((gr) => C.subListWidth(gr.items, title))) : C.subListWidth(rows, title);
          const p = anchorFor(st, u.uid, pw * k, h, -200, -228);
          const r = listPanel(g, w, { x: p.x, y: p.y, w: pw, rowH: 26, title, size: 14, maxRows: 7 });
          // 説明は右隣（右上の一覧に重ねない。入らなければ一覧の下）
          const pr = _.hud.partyRects(st);
          const limit = pr.length ? pr[0].x - 8 * k : R.W;
          const d = w.o.desc(w.sel);
          if (limit - (r.x + r.w + 8 * k) >= 170 * k) descBox(g, r.x + r.w + 8 * k, r.y + 60 * k, d, limit);
          else descBox(g, r.x, r.y + r.h + 6 * k, d, r.x + Math.max(r.w, 260 * k));
          // ねらいは前回の相手を覚えている（選ぶ前から琥珀の菱形）
          const row = rows[w.sel];
          if (row && row.target === 'enemy') {
            const a = st.aliveEnemies().find((x) => x.uid === M.target) || null;
            if (a) _.K.diamond(g, a.x + 8, a.y - _.actors.height(a) - 12, 5 * k, 'rgba(255,241,200,0.85)', 'rgba(80,60,30,0.9)', 1);
          }
        },
      });
      if (i && i.tab != null) {
        // タブを替えた: 今のカーソルを覚え、新しいタブの一覧で開き直す（開く動きはしない）
        M[ckey()] = i.sel || 0;
        tab = i.tab; anim = false;
        R.SkillTabs.remember(cid, 'battle_' + memKey, groups[tab].id);
        continue;
      }
      anim = true;
      if (i === 'back') return 'back';
      M[ckey()] = i;
      const res = await targetFor(st, u, rows[i], M);
      if (res !== 'back') return res;
    }
  }

  async function targetFor(st, u, row, M) {
    const t = await _.target.pick(st, u, row.target || 'enemy', { row, mem: M });
    if (t === 'back') return 'back';
    return { cmd: row.cmd, id: row.id, target: t };
  }
})(window.RPG);
