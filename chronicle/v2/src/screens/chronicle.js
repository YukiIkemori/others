// MENUS: 年代記・手がかり（MODERN_UI §6.11、WORLD_REDESIGN §3.2、V2_PLAN §2.6.4・§3.5）
//   タブ（L/R）: 年代記（章）／手がかり。手がかりは地方ごとに並べ、右に題名・聞いた所・場所と方角・詳しい文。
//   A で目印（1 つだけ、琥珀の羽ペンの印。もう一度 A で外す）。解決した物は薄く。slice:'locked' と体験版で行けない地方の物（R.Leads.locked）は「この先は、まだ語られていない」。
//   開いて見た手がかりは seen（「新」の印が消える）。
//   書庫（3 つ目のタブ）: 書き写した読み物（R.DB.lore。ev.lore(id) で旗 = id）を地方ごとに並べ、右に全文（長ければ A で読む＝↑↓・ホイール・引きずりで送る）。
//     書き写していない物は「？？？」（文は出さない）。体験版で行けない地方（R.Leads.locked と同じ決まり）は地方ごと 1 行の「？？？」にまとめ、題も文も出さない。
//     数は「書き写した 書き写せる物の数」（行けない地方の物は数えない）。開いて見た物は R.Game.loreSeen[id] = true（セーブに残る。「新」の印が消える）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;
  const KIND = { main: R.T('ui.chronicle.KIND.main'), region: R.T('ui.chronicle.KIND.region'), side: R.T('ui.chronicle.KIND.side'), rumor: R.T('ui.chronicle.KIND.rumor'), map: R.T('ui.chronicle.KIND.map') };
  const REGION_ORDER = ['prologue', 'r_forest', 'r_snow', 'r_desert', 'r_marsh', 'r_isles', 'r_mine', 'r_ash', 'r_star'];

  S.regionName = function (rid) {
    const rg = R.DB.regions && R.DB.regions[rid];
    if (rg && rg.name) return rg.name;
    return ({ prologue: R.T('ui.chronicle.regionName.prologue'), r_forest: R.T('ui.chronicle.regionName.r_forest'), r_snow: R.T('ui.chronicle.regionName.r_snow'), r_desert: R.T('ui.chronicle.regionName.r_desert'), r_marsh: R.T('ui.chronicle.regionName.r_marsh'), r_isles: R.T('ui.chronicle.regionName.r_isles'), r_mine: R.T('ui.chronicle.regionName.r_mine'), r_ash: R.T('ui.chronicle.regionName.r_ash'), r_star: R.T('ui.chronicle.regionName.r_star'), main: R.T('ui.chronicle.regionName.main'), '-': '' })[rid] || '';
  };

  // ---------------------------------------------------------------- 書庫（R.DB.lore）
  // 地方の並び: REGION_ORDER → 世界のうわさ（world）→ 知らない地方 → 終盤（finale）
  const loreRank = (rid) => { const i = REGION_ORDER.indexOf(rid); return i >= 0 ? i : rid === 'world' ? 50 : rid === 'finale' ? 99 : 60; };
  const loreLocked = (d) => (R.Leads && R.Leads.locked ? R.Leads.locked(d) : !!(d && d.slice === 'locked'));
  S.loreRegionName = (rid) => S.regionName(rid) || R.T('ui.chronicle.lore.otherRegion');
  /** 書庫の行 → [{value, label, region, first, got, locked, isNew, d, songs}]。行けない地方は 1 行（value 'locked:<rid>'）にまとめる */
  S.loreRows = function () {
    const G = R.Game || {}, flags = G.flags || {}, seen = G.loreSeen || {};
    const groups = {};
    let n = 0;
    for (const [id, d] of Object.entries(R.DB.lore || {})) {
      if (!d || typeof d !== 'object') continue;
      const rid = d.region || '-';
      (groups[rid] = groups[rid] || []).push({ id, d, k: d.order != null ? d.order : 1000 + n++ });
    }
    const rids = Object.keys(groups).sort((a, b) => loreRank(a) - loreRank(b));
    const unknown = R.T('ui.chronicle.lore.unknown');
    const rows = [];
    for (const rid of rids) {
      const list = groups[rid].slice().sort((a, b) => a.k - b.k);
      if (list.every((e) => loreLocked(e.d))) { rows.push({ value: 'locked:' + rid, label: unknown, region: rid, first: true, got: false, locked: true, isNew: false, songs: [] }); continue; }
      list.forEach((e, i) => {
        const locked = loreLocked(e.d), got = !locked && !!flags[e.id];
        const text = got ? (Array.isArray(e.d.text) ? e.d.text.join('\n') : String(e.d.text == null ? '' : e.d.text)) : '';
        rows.push({
          value: e.id, label: got ? e.d.title || e.id : unknown, region: rid, first: i === 0, got, locked, isNew: got && !seen[e.id], d: e.d,
          text: got && R.Events && R.Events.fill ? R.Events.fill(text) : text,
          songs: got && e.d.voice ? [{ id: e.id, title: e.d.title, text, voice: e.d.voice }] : [],
        });
      });
    }
    return rows;
  };
  /** 書庫の数 → {got, total}（行けない地方の物は数えない） */
  S.loreCount = function () {
    const flags = (R.Game && R.Game.flags) || {};
    let got = 0, total = 0;
    for (const [id, d] of Object.entries(R.DB.lore || {})) { if (!d || typeof d !== 'object' || loreLocked(d)) continue; total++; if (flags[id]) got++; }
    return { got, total };
  };
  /** 開いて見た（「新」の印を消す）。初めてなら true */
  S.loreSeen = function (id) {
    const G = R.Game;
    if (!G || !id || !(G.flags || {})[id]) return false;
    const s = (G.loreSeen = G.loreSeen && typeof G.loreSeen === 'object' ? G.loreSeen : {});
    if (s[id]) return false;
    s[id] = true;
    return true;
  };

  S.def('chronicle', {
    init() {
      this.tab = 1;
      this.list = new R.UIK.List({ rows: [], rowH: 34 });
      this.list.onSelect = (row) => this.pick(row);
      this.list.onCancel = () => this.close(undefined);
      this.loreScroll = 0; this.loreMax = 0; this.reading = false;
      this.refresh(false);
      if (!this.list.rows.length) { this.tab = 0; this.refresh(false); }
    },
    leadRows() {
      let groups = [];
      try { groups = R.Leads.list() || []; } catch (e) { groups = []; }
      groups = groups.slice().sort((a, b) => (REGION_ORDER.indexOf(a.region) + 99) % 99 - (REGION_ORDER.indexOf(b.region) + 99) % 99);
      const rows = [];
      for (const gr of groups) {
        const items = gr.items.slice().sort((a, b) => (a.state === 'done') - (b.state === 'done'));
        items.forEach((it, i) => {
          const L = (R.DB.leads || {})[it.id] || { title: it.id, text: '' };
          rows.push({ value: it.id, label: L.title, L, st: it.state, pinned: it.pinned, region: gr.region, first: i === 0, locked: R.Leads.locked ? R.Leads.locked(L) : L.slice === 'locked' });
        });
      }
      return rows;
    },
    chapterRows() {
      const G = R.Game || {};
      const ch = (G.chronicle && G.chronicle.chapters) || [];
      let n = 0;
      return ch.map((c) => {
        // 章の文: R.DB.chronicle（地方の選択で変わる文）→ 無ければ地方の chapter（R.DB.regions）か DB.config.chronicle（序章）
        const reg = (R.DB.regions || {})[c.id] || {}, cfg = ((R.DB.config || {}).chronicle || {})[c.id] || {};
        const txt = (R.DB.chronicle && (R.DB.chronicle[c.summaryKey] || R.DB.chronicle[c.id])) ||
          (reg.chapter && reg.chapter.summary ? { title: reg.chapter.title, text: reg.chapter.summary } : cfg.summary ? { title: cfg.title, text: cfg.summary } : null);
        const pro = c.id === 'prologue';
        const title = (txt && txt.title) || (pro ? R.T('ui.chronicle.chapterRows.title') : S.regionName(c.id));
        // 章の文の {hero} は主人公の名前に（韓国語は助詞も選ぶ）
        const body = txt ? (Array.isArray(txt.text) ? txt.text.join('\n') : txt.text || '') : '';
        return { value: c.id, label: title, no: pro ? -1 : n++, text: R.Events && R.Events.fill ? R.Events.fill(body) : body, songs: this.songsOf(c.id) };
      });
    },
    /** その章で書き写した、声のある読み物（R.DB.lore の voice。灯台の守り歌 v_fine_song_02 など）→ [{id, title, text, voice}] */
    songsOf(region) {
      const flags = (R.Game && R.Game.flags) || {};
      return Object.entries(R.DB.lore || {}).filter(([id, d]) => d && d.voice && d.region === region && flags[id])
        .map(([id, d]) => ({ id, title: d.title, text: Array.isArray(d.text) ? d.text.join('\n') : String(d.text || ''), voice: d.voice }));
    },
    /** 章の歌を聞き直す（A）。鳴っていれば止める。ボイスの音量 0 なら鳴らない（R.Audio.playVoice が null） */
    playSong(row) {
      const sg = row && row.songs && row.songs[0];
      if (!sg || !R.Audio) return;
      if (R.Audio.voiceId === sg.voice) { R.Audio.stopVoice(); this.songOn = null; return; }
      const h = R.Audio.playVoice ? R.Audio.playVoice(sg.voice) : null;
      this.songOn = h ? sg.voice : null;
      if (!h) R.UIK.toast(R.T('ui.chronicle.playSong.toast'), { anchor: 'bl' });
    },
    exit() { if (this.songOn && R.Audio && R.Audio.voiceId === this.songOn) R.Audio.stopVoice(); },
    refresh(keep) {
      this.list.setRows(this.tab === 0 ? this.chapterRows() : this.tab === 1 ? this.leadRows() : S.loreRows(), keep);
      if (!keep) this.setReading(false);
    },
    /** 書庫の長い文を読む（A）: 一覧を止めて ↑↓ で文を送る。B・A で一覧へ */
    setReading(on) { this.reading = !!on; this.list.active = !on; },
    scrollLore(d) { this.loreScroll = Math.max(0, Math.min(this.loreMax, (this.loreScroll || 0) + d)); },
    pick(row) {
      if (this.tab === 2) {
        if (!row || !row.got) { R.UIK.sfx('buzzer'); return; }
        if (row.songs && row.songs.length) { this.playSong(row); return; }
        if (this.loreMax > 0) this.setReading(true);
        return;
      }
      if (this.tab !== 1) { this.playSong(row); return; }
      if (row.locked) { R.UIK.sfx('buzzer'); return; }
      if (row.st === 'done') { R.UIK.sfx('buzzer'); return; }
      if (row.pinned) { R.Leads.unpin(); R.UIK.toast(R.T('ui.chronicle.pick.toast'), { anchor: 'bl', icon: 'pin' }); }
      else { R.Leads.pin(row.value); R.UIK.toast(R.T('ui.chronicle.pick.toast_2', { label: row.label }), { anchor: 'bl', icon: 'pin' }); }
      this.refresh(true);
    },
    update() {
      const k = S.tabInput(this.tabRects, this.tab, 3);
      if (k >= 0) { this.tab = k; this.refresh(false); return; }
      if (this.tab === 2 && this.updateLore()) return;
      this.list.update();
      // 見た手がかり
      const row = this.list.current();
      if (this.tab === 1 && row && R.Game && R.Game.leads && R.Game.leads[row.value] && !R.Game.leads[row.value].seen) {
        if (R.Leads.seen) R.Leads.seen(row.value); else R.Game.leads[row.value].seen = true;
      }
      // 書庫: 開いて見た物（「新」を消す）。行が替わったら文の頭から
      if (this.tab === 2 && row) {
        if (row.value !== this.loreId) { this.loreId = row.value; this.loreScroll = 0; }
        if (row.got && row.isNew && S.loreSeen(row.value)) row.isNew = false;
      }
    },
    /** 書庫の文の送り（ホイール・引きずりは右の札の上でいつでも。読む間は ↑↓・B）。入力を使い切ったら true */
    updateLore() {
      const I = R.Input, p = I.pointer, dr = this.loreRect;
      if (p && dr) {
        if (p.wheel && R.UIK.hit(dr, p.x, p.y)) this.scrollLore(p.wheel > 0 ? 1 : -1);
        if (p.pressed && R.UIK.hit(dr, p.x, p.y)) this.drag = { y0: p.y, s0: this.loreScroll };
        else if (this.drag && p.down) this.scrollLore(Math.round(this.drag.s0 - (p.y - this.drag.y0) / (this.loreLH || u(28))) - this.loreScroll);
        else if (this.drag && !p.down) this.drag = null;
      }
      if (!this.reading) return false;
      if (I.repeat('down')) this.scrollLore(1);
      else if (I.repeat('up')) this.scrollLore(-1);
      else if (I.pressed('b') || I.pressed('a')) { R.UIK.sfx('cancel'); this.setReading(false); }
      return true;
    },
    draw(g) {
      const b = S.box(), C = T().color, tall = S.tall();
      this.tabRects = S.tabs(g, R.T('ui.chronicle.draw.tabRects.tabs'), this.tab, b.x + u(4), b.y + u(4));
      const lw = tall ? b.w : Math.min(u(400), b.w * 0.42);
      // 書庫の数（タブの列の右、一覧の札の右端にそろえる。入らなければ「書き写した」を省く）
      if (this.tab === 2) {
        const n = S.loreCount(), tr = this.tabRects[this.tabRects.length - 1];
        const cx = b.x + lw - u(10), cy = tr.y + (tr.h - u(16)) / 2;
        const nw = R.UIK.text(g, R.T('ui.chronicle.lore.count', { got: n.got, total: n.total }), cx, cy, { size: u(16), weight: 700, color: C.goldHi, align: 'right' });
        const lab = R.T('ui.chronicle.lore.countLabel'), labW = R.UIK.measure(lab, { size: u(12.5) });
        if (cx - nw - u(10) - labW > tr.x + tr.w + u(8)) R.UIK.text(g, lab, cx - nw - u(10), cy + u(2.5), { size: u(12.5), color: C.text3, align: 'right' });
      }
      const lp = { x: b.x, y: b.y + u(48), w: lw, h: tall ? b.h * 0.42 : b.h - u(48) };
      R.UIK.panel(g, lp, { frost: true });
      const lr = { x: lp.x + u(8), y: lp.y + u(12), w: lp.w - u(16), h: lp.h - u(24) };
      this.list.render = (gg, row, rect, f) => {
        const sz = u(15), cy = rect.y + (rect.h - sz) / 2 - u(1);
        if (this.tab === 2) {
          // 地方の始まりに細い線。書き写した物は題、まだの物は「？？？」
          if (row.first && rect.y > lr.y + u(2)) R.UIK.rule(gg, rect.x + u(6), rect.x + rect.w - u(6), rect.y, 0.18);
          if (row.isNew) R.UIK.text(gg, R.T('ui.chronicle.lore.new'), rect.x + u(19), cy + u(1), { size: u(12), weight: 700, color: C.gold, align: 'center' });
          else if (row.got) R.UIK.icon(gg, 'book', rect.x + u(12), cy, sz, f ? C.gold : C.text2);
          R.UIK.text(gg, row.label, rect.x + u(38), cy, { size: sz, weight: f ? 700 : 500, color: !row.got ? C.disabled : f ? C.goldHi : C.text, maxW: rect.w - u(row.first ? 170 : 60) });
          if (row.first) R.UIK.text(gg, S.loreRegionName(row.region), rect.x + rect.w - u(12), cy + u(2), { size: u(11.5), color: C.gold, align: 'right', maxW: u(120) });   // 地方の名は群れの 1 行目だけ（見出しの代わり）
          return;
        }
        if (this.tab === 0) {
          R.UIK.icon(gg, 'book', rect.x + u(14), cy, sz, f ? C.gold : C.text2);
          R.UIK.text(gg, row.label, rect.x + u(40), cy, { size: sz, weight: f ? 700 : 500, color: f ? C.goldHi : C.text, maxW: rect.w - u(50) });
          return;
        }
        const dim = row.st === 'done' || row.locked;
        if (row.pinned) R.UIK.icon(gg, 'pin', rect.x + u(12), cy, sz, C.gold);
        else if (row.st === 'new') R.UIK.diamond(gg, rect.x + u(19), rect.y + rect.h / 2, u(4), C.gold);
        else if (row.st === 'done') R.UIK.icon(gg, 'check', rect.x + u(12), cy, sz, C.disabled);
        R.UIK.text(gg, row.label, rect.x + u(38), cy, { size: sz, weight: f ? 700 : 500, color: dim ? C.disabled : f ? C.goldHi : C.text, maxW: rect.w - u(130) });
        R.UIK.text(gg, S.regionName(row.region), rect.x + rect.w - u(12), cy + u(2), { size: u(11.5), color: C.text3, align: 'right', maxW: u(84) });
      };
      this.list.draw(g, lr);
      if (!this.list.rows.length) R.UIK.text(g, this.tab === 2 ? R.T('ui.chronicle.lore.empty') : this.tab === 0 ? R.T('ui.chronicle.draw.text') : R.T('ui.chronicle.draw.text_2'), lr.x + u(16), lr.y + u(8), { size: u(15), color: C.text3 });
      // 右
      const dp = tall ? { x: b.x, y: lp.y + lp.h + u(12), w: b.w, h: b.y + b.h - (lp.y + lp.h + u(12)) } : { x: lp.x + lp.w + u(18), y: b.y, w: b.x + b.w - (lp.x + lp.w + u(18)), h: b.h };
      R.UIK.panel(g, dp, { frost: true });
      const row = this.list.current(), px = dp.x + u(26), pw = dp.w - u(52);
      let y = dp.y + u(24);
      this.loreRect = null;
      if (row && this.tab === 2) this.drawLore(g, row, dp, px, pw, y);
      else if (row && this.tab === 0) {
        R.UIK.text(g, row.no < 0 ? R.T('ui.chronicle.draw.text_3') : R.T('ui.chronicle.draw.text_4', { p0: row.no + 1 }), px, y, { size: u(13), weight: 700, color: C.gold, track: u(2) }); y += u(26);
        R.UIK.text(g, row.label, px, y, { size: u(22), weight: 700, color: C.goldHi, maxW: pw }); y += u(40);
        for (const l of R.UIK.wrap(row.text || '', pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: C.text }); y += u(28); if (y > dp.y + dp.h - u(30)) break; }
        // 書き写した歌（A で聞き直す）
        for (const sg of row.songs || []) {
          if (y > dp.y + dp.h - u(110)) break;
          y += u(8); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
          const on = R.Audio && R.Audio.voiceId === sg.voice;
          R.UIK.text(g, sg.title, px, y, { size: u(14), weight: 700, color: on ? C.goldHi : C.gold }); y += u(26);
          for (const l of R.UIK.wrap(sg.text, pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: on ? C.goldHi : C.text }); y += u(28); if (y > dp.y + dp.h - u(30)) break; }
        }
      } else if (row) {
        const L = row.L;
        let cx = px;
        cx += R.UIK.chip(g, cx, y, KIND[L.kind] || R.T('ui.chronicle.draw.cx.chip'), { kind: L.kind === 'main' ? 'gold' : 'plain', size: 11 }) + u(8);
        if (row.pinned) R.UIK.chip(g, cx, y, R.T('ui.chronicle.draw.chip'), { kind: 'gold', size: 11, icon: 'pin' });
        y += u(32);
        R.UIK.text(g, L.title, px, y, { size: u(22), weight: 700, color: row.locked || row.st === 'done' ? C.text2 : C.goldHi, maxW: pw }); y += u(40);
        const meta = [];
        if (L.from) meta.push([R.T('ui.chronicle.draw.0'), S.locName(L.from)]);
        if (L.place || L.dir) meta.push([R.T('ui.chronicle.draw.0_2'), [S.locName(L.place), L.dir].filter(Boolean).join(R.T('ui.chronicle.draw.1.join'))]);
        for (const [k, v] of meta) { R.UIK.text(g, k, px, y, { size: u(12.5), color: C.text3 }); R.UIK.text(g, v, px + u(84), y - u(1), { size: u(14.5), color: C.text, maxW: pw - u(84) }); y += u(26); }
        y += u(6); R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
        const text = row.locked ? R.T('ui.chronicle.draw.text_5') : String(L.text || '');
        for (const l of R.UIK.wrap(text, pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: row.locked ? C.text3 : C.text }); y += u(28); if (y > dp.y + dp.h - u(30)) break; }
        if (row.st === 'done') R.UIK.chip(g, px, dp.y + dp.h - u(40), R.T('ui.chronicle.draw.chip_2'), { kind: 'plain', size: 11, icon: 'check' });
      }
      if (this.tab === 2) { S.prompts(g, this.lorePrompts(row)); return; }
      S.prompts(g, this.tab === 1 ? [{ btn: 'a', label: R.T('ui.chronicle.draw.0.label') }, { btn: 'l', label: R.T('ui.chronicle.draw.1.label') }, { btn: 'b', label: R.T('ui.chronicle.draw.2.label') }] : [].concat(row && row.songs && row.songs.length ? [{ btn: 'a', label: R.Audio && R.Audio.voiceId === row.songs[0].voice ? R.T('ui.chronicle.draw.0.label_2') : R.T('ui.chronicle.draw.0.label_3') }] : [], [{ btn: 'r', label: R.T('ui.chronicle.draw.0.label_4') }, { btn: 'b', label: R.T('ui.chronicle.draw.1.label_2') }]));
    },
    lorePrompts(row) {
      if (this.reading) return [{ btn: 'up', label: R.T('ui.chronicle.lore.prompt.scroll') }, { btn: 'b', label: R.T('ui.chronicle.lore.prompt.done') }];
      const out = [];
      if (row && row.songs && row.songs.length) out.push({ btn: 'a', label: R.Audio && R.Audio.voiceId === row.songs[0].voice ? R.T('ui.chronicle.draw.0.label_2') : R.T('ui.chronicle.draw.0.label_3') });
      else if (row && row.got && this.loreMax > 0) out.push({ btn: 'a', label: R.T('ui.chronicle.lore.prompt.read') });
      out.push({ btn: 'l', label: R.T('ui.chronicle.lore.prompt.leads') }, { btn: 'b', label: R.T('ui.chronicle.draw.1.label_2') });
      return out;
    },
    /** 書庫の右の札: 地方の札・題・線・全文（はみ出す分は送る。上下に細いつまみ） */
    drawLore(g, row, dp, px, pw, y) {
      const C = T().color;
      let cx = px;
      cx += R.UIK.chip(g, cx, y, S.loreRegionName(row.region), { kind: row.got ? 'gold' : 'plain', size: 11 }) + u(8);
      if (row.got && row.d && row.d.letter) R.UIK.chip(g, cx, y, R.T('ui.chronicle.lore.letter'), { kind: 'plain', size: 11 });
      y += u(32);
      const title = row.got ? row.label : R.T('ui.chronicle.lore.unknown');
      R.UIK.text(g, title, px, y, { size: u(22), weight: 700, color: row.got ? C.goldHi : C.text2, maxW: pw }); y += u(40);
      R.UIK.rule(g, px, px + pw, y, 0.14); y += u(14);
      if (!row.got) {
        this.loreMax = 0;
        const msg = row.locked ? R.T('ui.chronicle.draw.text_5') : R.T('ui.chronicle.lore.notYet');
        for (const l of R.UIK.wrap(msg, pw, { size: u(15.5) })) { R.UIK.text(g, l, px, y, { size: u(15.5), color: C.text3 }); y += u(28); }
        return;
      }
      const on = row.songs.length && R.Audio && R.Audio.voiceId === row.songs[0].voice;
      const lh = u(28), sz = u(15.5), bottom = dp.y + dp.h - u(22);
      const key = row.value + '|' + Math.round(pw) + '|' + sz;
      if (!this.loreWrap || this.loreWrap.key !== key) this.loreWrap = { key, lines: R.UIK.wrap(row.text || '', pw, { size: sz }) };
      const lines = this.loreWrap.lines, vis = Math.max(1, Math.floor((bottom - y) / lh));
      this.loreLH = lh;
      this.loreMax = Math.max(0, lines.length - vis);
      this.loreScroll = Math.max(0, Math.min(this.loreMax, this.loreScroll || 0));
      this.loreRect = { x: dp.x, y: y - u(6), w: dp.w, h: bottom - y + u(12) };
      g.save(); g.beginPath(); g.rect(px - u(4), y - u(6), pw + u(8), vis * lh + u(6)); g.clip();
      let ly = y;
      for (let i = this.loreScroll; i < lines.length && i < this.loreScroll + vis; i++) { R.UIK.text(g, lines[i], px, ly, { size: sz, color: on ? C.goldHi : C.text }); ly += lh; }
      g.restore();
      // はみ出す: 右端に細いつまみ（読む間は琥珀）・上下に続きの印
      if (this.loreMax > 0) {
        const tx = dp.x + dp.w - u(12), th = vis * lh, kh = Math.max(u(18), th * vis / lines.length), ky = y + (th - kh) * (this.loreScroll / this.loreMax);
        g.save(); g.fillStyle = 'rgba(240,228,200,0.10)'; g.fillRect(tx, y, u(2), th);
        g.fillStyle = this.reading ? 'rgba(236,201,124,0.85)' : 'rgba(240,228,200,0.42)'; g.fillRect(tx - u(0.5), ky, u(3), kh); g.restore();
        if (this.loreScroll < this.loreMax) R.UIK.text(g, '▾', px + pw / 2, y + th - u(4), { size: u(13), color: C.gold, align: 'center' });
      }
    },
  });
})(window.RPG);
