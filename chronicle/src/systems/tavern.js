// 酒場（担当 newgame A6。DESIGN §5.5・§5.6・§11.8.4・§11.8.5）。
//
//   await R.Tavern.chooseStart({count = 3, recruit = true, announce = true}) → [companionId×count]
//        最初の仲間を 20 人から選ぶ（キャンセル不可）。決まったら選んだ順に 1 人ずつ R.Party.recruit し、
//        「{name}が仲間に加わった！」＋joinLine（ジングル recruit は最初の 1 回）。ev.chooseCompanions は
//        加入済みの人を飛ばすので二重にならない。recruit:false なら状態を変えずに id だけ返す。
//   await R.Tavern.open({recruit = true})
//        酒場のマスター: 仲間を探す（recruit のときだけ）/ 入れ替える / 並びと隊列 / 装備をあずかる / やめる。
//        状態は R.Party・R.Rules の API だけで変える（recruit・swap・setParty・setOrder・setRow・unequipAll）。
//   R.Tavern.LINES      マスターの台詞（§5.5.5）       R.Tavern.announceJoin(c|id, {jingle, bench})
(function (R) {
  'use strict';
  const G = () => R.Gfx;
  const In = () => R.Input;
  const DB = R.DB;
  const K = () => R.CharCreate.kit;

  const LINES = {
    greet: 'いらっしゃい。\n旅の仲間なら、ここで探せるよ。',
    commands: ['仲間を探す', '入れ替える', '並びと隊列', '装備をあずかる', 'やめる'],
    none: '名簿の旅人は、もう全員そろってるよ。',
    ask: '{name}を仲間にするかい？',
    deposit: '控えの{name}の装備を、\nすべて外して預かるかい？',
    deposited: '装備を外して、持ち物に入れた。',
    overflow: '持ちきれない品があったので、\nその品は付けたままにしておいたよ。',
    full: '出撃できるのは4人までだよ。',
    // the same questions when no master is there (field menu 「仲間」)
    depositPlain: '控えの{name}の装備を、\nすべて外して持ち物に入れますか？',
    overflowPlain: '持ちきれない品があったので、\nその品は付けたままにした。',
    fullPlain: '出撃できるのは4人までだ。',
    bye: 'またいつでも寄っとくれ。',
    advice: '迷ったら、前に立つ人・中列から戦う人・\n術で支える人を、1人ずつ選ぶといい。',
    joined: '{name}が仲間に加わった！',
    bench: '{name}は控えで待っている。',
    heroStays: '{hero}は外せない。',
    noReserve: '控えの仲間がいない。',
    noGear: '控えの仲間は、何も装備していない。',
  };
  // the field menu kit's frame (BRIEF A11 compact menus): the 仲間 screens draw at the menu UI scale
  const MK = () => (R.Menu && R.Menu.kit) || null;
  const inFrame = (fn) => (MK() ? MK().inFrame(fn) : fn());
  const compact = () => !!(MK() && !MK().large());
  const nm = (s, name) => String(s).replace(/\{name\}/g, name);
  const SLOTS = ['weapon1', 'weapon2', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];

  // ------------------------------------------------------------ state helpers (read-only; changes go through R.Party)
  const P = () => R.Party || null;
  function candidates() {
    const p = P();
    if (p && p.candidates) { try { return p.candidates(); } catch (e) { R.warn('Party.candidates', e); } }
    return Object.keys(DB.companions);
  }
  function party() { return (R.Game && R.Game.party) || []; }
  function reserve() { return (R.Game && R.Game.reserve) || []; }
  function isRecruited(id) {
    const p = P();
    if (p && p.isRecruited) { try { return !!p.isRecruited(id); } catch (e) { /* fall through */ } }
    return party().concat(reserve()).some((c) => c.id === id);
  }
  const unrecruited = () => candidates().filter((id) => DB.companions[id] && !isRecruited(id));
  const maxParty = () => (P() && P().MAX) || R.PARTY_MAX || 4;
  function call(fn, ...args) {
    const p = P();
    if (!p || typeof p[fn] !== 'function') { R.warn('R.Party.' + fn + ' is missing'); return false; }
    return p[fn](...args);
  }
  const say = (t) => R.UI.say(t);
  async function yesno(t) { const v = await R.UI.yesno(t); R.UI.closeMessage(); return v; }

  /** 「{name}が仲間に加わった！」→ joinLine（→ 控えなら「{name}は控えで待っている。」）。o: {jingle, bench} */
  async function announceJoin(who, o) {
    const opt = o || {};
    const id = typeof who === 'string' ? who : who.id;
    const d = DB.companions[id];
    if (!d) return;
    const name = typeof who === 'object' && who.name ? who.name : d.name;
    if (opt.jingle !== false) R.jingle('recruit');
    await say(nm(LINES.joined, name));
    if (d.joinLine) await say(d.joinLine);
    if (opt.bench) await say(nm(LINES.bench, name));
  }

  function withBgm(on) {
    const prev = R.Audio && R.Audio.current;
    if (on) R.bgm('tavern', { fade: 20 });
    return () => { if (on && prev && prev !== 'tavern') R.bgm(prev, { fade: 20 }); };
  }

  // ------------------------------------------------------------ 仲間を選ぶ・探す（§11.8.4）
  class ChooseLayer extends R.Layer {
    constructor(o) {
      super();
      this.opaque = true;
      this.o = o;
      this.mode = o.mode; // 'start' | 'browse'
      this.count = o.count || 3;
      this.ids = this.mode === 'browse' ? unrecruited() : candidates().filter((id) => DB.companions[id]);
      this.cur = 0;
      if (this.mode === 'start') { const i = this.ids.findIndex((id) => !isRecruited(id)); this.cur = Math.max(0, i); }
      this.page = 0;
      this.chosen = [];
      this.busy = false;
    }
    get id() { return this.ids[this.cur]; }
    flow(fn) {
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    move(dx) {
      if (!this.ids.length) return;
      this.cur = (this.cur + dx + this.ids.length) % this.ids.length;
      R.sfx('cursor');
    }
    update() {
      if (this.busy || this.closed) return;
      const d = In().dirRepeat();
      if (d === 'up' || d === 'down') this.move(d === 'up' ? -1 : 1);
      if (d === 'left' || d === 'right') { this.page ^= 1; R.sfx('page'); }
      if (In().repeat('l')) this.move(-1);
      if (In().repeat('r')) this.move(1);
      if (In().pressed('b')) {
        if (this.mode === 'browse') { R.sfx('cancel'); this.close(null); return; }
        if (this.chosen.length) { this.chosen.pop(); R.sfx('cancel'); }
        return;
      }
      if (!In().pressed('a') || !this.ids.length) return;
      if (this.mode === 'browse') { R.sfx('confirm'); this.flow(() => this.browsePick()); return; }
      const id = this.id;
      if (isRecruited(id)) { R.sfx('buzzer'); return; }
      const at = this.chosen.indexOf(id);
      if (at >= 0) { this.chosen.splice(at, 1); R.sfx('cancel'); return; }
      if (this.chosen.length >= this.count) { R.sfx('buzzer'); return; }
      this.chosen.push(id);
      R.sfx('confirm');
      if (this.chosen.length === this.count) this.flow(() => this.confirmStart());
    }
    async confirmStart() {
      const ok = await yesno('この' + this.count + '人と旅立ちますか？');
      if (ok) this.close(this.chosen.slice());
    }
    async browsePick() {
      const id = this.id, d = DB.companions[id];
      if (!(await yesno(nm(LINES.ask, d.name)))) return;
      const before = reserve().length;
      const c = call('recruit', id);
      if (!c) { R.sfx('buzzer'); return; }
      await announceJoin(c, { bench: reserve().length > before });
      R.UI.closeMessage();
      this.ids = unrecruited();
      this.cur = Math.min(this.cur, Math.max(0, this.ids.length - 1));
      if (!this.ids.length) { await say(LINES.none); R.UI.closeMessage(); this.close(id); }
    }
    draw() {
      const g = G(), C = g.C, kit = K();
      kit.backdrop();
      const title = this.mode === 'browse' ? '仲間を探す' : '仲間を' + this.count + '人選ぼう　' + this.chosen.length + '/' + this.count;
      g.window(4, 2, 248, 60, { title });
      const walk = Math.floor(R.Engine.frame / 16) % 2;
      this.ids.forEach((id, i) => {
        // 2 rows × 10 (§11.8.4: x = 11 + 24i; the rows sit 1px higher than the sketch so the second row's
        // cursor frame and number plates stay inside the window's border line at y 59)
        const x = 11 + 24 * (i % 10), y = 7 + 26 * Math.floor(i / 10);
        const dim = this.mode === 'start' && isRecruited(id) && !this.chosen.includes(id);
        kit.drawFigure(kit.defKey(id), x, y, { frame: i === this.cur ? walk : 0, dim });
        const n = this.chosen.indexOf(id);
        if (n >= 0) {
          const th = g.WINDOW_THEMES[(R.Settings && R.Settings.windowColor) || 'ink'] || g.WINDOW_THEMES.ink;
          g.rect(x + 10, y + 12, 8, 11, th.fill2 || '#000');
          g.strokeRect(x + 10, y + 12, 8, 11, C.yellow);
          g.text(String(n + 1), x + 11.5, y + 12.5, { color: C.yellow });
        }
        if (i === this.cur && Math.floor(R.Engine.frame / 20) % 4 !== 3) g.strokeRect(x - 2, y - 1, 20, 26, C.white);
      });
      if (!this.ids.length) g.text(LINES.none, 128, 26, { align: 'center', color: '#c8c8d8' });
      g.window(4, 64, 248, 156, { title: (this.page + 1) + '/2' });
      const id = this.id;
      if (id) (this.page ? drawPage2 : drawPage1)(id, walk);
      if (Math.floor(R.Engine.frame / 16) % 2 === 0) {
        if (this.page === 0) arrow(240, 206, 1); else arrow(10, 206, -1);
      }
    }
  }
  function arrow(x, y, dir) {
    for (let i = 0; i < 4; i++) G().rect(dir > 0 ? x + i : x + 3 - i, y + 1 + i, 1, 9 - i * 2, '#ffffff');
  }
  /** 1 ページ目: 絵・名前・性別 年齢 肩書・役割 隊列・プロフィール・得手不得手 */
  function drawPage1(id, walk) {
    const g = G(), C = g.C, kit = K(), d = DB.companions[id];
    kit.drawFigure(kit.defKey(id), 12, 72, { scale: 2, frame: walk });
    g.text(d.name, 52, 72, { size: 16 });
    g.text((d.gender === 'f' ? '女' : '男') + '　' + d.age + '歳　' + d.title, 52, 92, { color: '#c8c8d8' });
    g.text(kit.ROLE_NAMES[d.role] + '　' + kit.ROW_NAMES[d.row] + (d.kin && d.kin !== '人間' ? '　' + d.kin : ''), 52, 106, { color: C.cyan });
    String(d.profile || '').split('\n').forEach((l, i) => g.fitText(l, 12, 124 + 14 * i, 230));
    kit.drawAptWide(d.apt, 12, 166, { pitch: 14, gap: 2 });
  }
  /**
   * the ability bonuses of a set of starting gear (§8.1.2: 鉄の胸当て 腕力+2・鉄の額当て 体力+1 …, the
   * weapons included), summed over the slots → {str:n, …}. Items not registered yet add nothing.
   */
  function gearBonus(equip) {
    const out = {};
    for (const s of SLOTS) {
      const it = equip && equip[s] ? DB.items[equip[s]] : null;
      if (!it || !it.stats) continue;
      for (const k of Object.keys(it.stats)) if (typeof it.stats[k] === 'number') out[k] = (out[k] || 0) + it.stats[k];
    }
    return out;
  }
  /** the names of the starting armour in slot order (盾・頭・体) */
  const armorNames = (e) => ['shield', 'head', 'body'].filter((s) => e && e[s]).map((s) => K().itemName(e[s]));
  /** 2 ページ目: 能力 6 つ（初期装備の分は緑の +n）・成長・個性・出身・初期装備・始めの技と術 */
  function drawPage2(id) {
    const g = G(), C = g.C, kit = K(), d = DB.companions[id];
    const e = d.startEquip || {};
    const plus = gearBonus(e);
    kit.STATS.forEach((s, k) => {
      const y = 74 + 14 * k, v = d.stats[s], b = plus[s] || 0;
      g.text(kit.STAT_NAMES[s], 12, y, { color: '#c8c8d8' });
      g.text(String(v), 62, y, { align: 'right' });
      if (b) g.text('+' + b, 64, y, { color: C.green });
      kit.statBar(78, y + 4, v, { bonus: b, scale: 0.78 });
    });
    let gx = 132;
    [['HP', 'hp'], ['MP', 'mp'], ['WP', 'wp']].forEach(([lab, k]) => {
      g.text(lab, gx, 74, { color: '#c8c8d8' });
      g.text(d.growth[k], gx + 13, 74, { color: kit.aptColor(d.growth[k]) });
      gx += 38;
    });
    g.text('個性：', 132, 92, { color: '#c8c8d8' });
    g.fitText(d.innate.name, 132 + g.textWidth('個性：'), 92, 80, { color: C.gold });
    kit.jbreak(d.innate.desc, 110).forEach((l, i) => g.text(l, 136, 106 + 14 * i));
    g.text('出身：', 132, 138, { color: '#c8c8d8' });
    g.fitText(d.from, 132 + g.textWidth('出身：'), 138, 84);
    const label = (t, x, y) => { g.text(t, x, y, { color: '#c8c8d8' }); return x + g.textWidth(t); };
    let x = label('武器1：', 12, 162);
    g.fitText(kit.itemName(e.weapon1), x, 162, 92);
    x = label('武器2：', 128, 162);
    g.fitText(e.weapon2 ? kit.itemName(e.weapon2) : '――', x, 162, 244 - x, { color: e.weapon2 ? C.white : '#8c90a8' });
    x = label('防具：', 12, 176);
    g.fitText(armorNames(e).join('・') || '――', x, 176, 244 - x);
    const acts = (d.startTechs || []).concat(d.startSpells || []).map(kit.actionName);
    x = label('始めの技・術：', 12, 192);
    g.fitText(acts.join('・') || '――', x, 192, 244 - x, { color: C.white });
  }

  // ------------------------------------------------------------ 入れ替える（§11.8.5）
  class SwapLayer extends R.Layer {
    constructor(o) {
      super();
      this.opaque = !compact(); // compact: the field (or the tavern) stays visible around the windows
      this.o = o || {};
      this.side = 0; // 0 = 出撃, 1 = 控え
      this.ai = 0; this.ri = 0; this.rtop = 0;
      this.pick = null; // {side, id}
      this.busy = false;
    }
    get cur() { return this.side ? reserve()[this.ri] : party()[this.ai]; }
    flow(fn) {
      this.busy = true;
      Promise.resolve().then(() => fn.call(this)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    clamp() {
      this.ai = Math.max(0, Math.min(this.ai, party().length - 1));
      this.ri = Math.max(0, Math.min(this.ri, reserve().length - 1));
      if (this.ri < this.rtop) this.rtop = this.ri;
      if (this.ri >= this.rtop + 8) this.rtop = this.ri - 7;
      this.rtop = Math.max(0, Math.min(this.rtop, Math.max(0, reserve().length - 8)));
      if (this.side === 1 && !reserve().length) this.side = 0;
    }
    update() {
      if (this.busy || this.closed) return;
      const d = In().dirRepeat();
      if (d === 'left' || d === 'right') {
        const want = d === 'right' ? 1 : 0;
        if (want !== this.side && (want === 0 || reserve().length)) { this.side = want; R.sfx('cursor'); }
      } else if (d === 'up' || d === 'down') {
        const n = this.side ? reserve().length : party().length;
        if (n) {
          const step = d === 'up' ? n - 1 : 1;
          if (this.side) this.ri = (this.ri + step) % n; else this.ai = (this.ai + step) % n;
          R.sfx('cursor');
        }
      }
      this.clamp();
      if (In().pressed('b')) {
        R.sfx('cancel');
        if (this.pick) this.pick = null; else this.close();
        return;
      }
      if (!In().pressed('a')) return;
      const c = this.cur;
      if (!c) { R.sfx('buzzer'); return; }
      if (this.pick) { R.sfx('confirm'); this.flow(() => this.second(c)); return; }
      R.sfx('confirm');
      this.flow(() => this.first(c));
    }
    async first(c) {
      const inParty = this.side === 0;
      const items = inParty
        ? [{ label: '入れ替える' }, { label: '外す', disabled: c.id === 'hero' }, { label: '隊列を変える' }]
        : [{ label: '入れ替える' }, { label: '加える', color: party().length >= maxParty() ? G().C.gray : null }];
      const y = inParty ? 12 + 28 * this.ai : 12 + 14 * (this.ri - this.rtop);
      const x = inParty ? 116 : 20;
      const i = await (R.Menu && R.Menu.kit ? R.Menu.kit.choose : R.UI.choose)(items, { x, y: Math.min(y, 160), w: 112 });
      if (i < 0) return;
      if (i === 0) { this.pick = { side: this.side, id: c.id }; return; }
      if (inParty && i === 1) {
        const ids = party().map((m) => m.id).filter((id) => id !== c.id);
        if (call('setParty', ids)) { R.sfx('swap'); await this.lines([c], []); }
        else R.sfx('buzzer');
      } else if (inParty && i === 2) {
        const row = c.row === 'middle' ? 'front' : 'middle';
        call('setRow', c.id, row);
        R.sfx('swap');
      } else if (!inParty && i === 1) {
        if (party().length >= maxParty()) { await say(this.o.master ? LINES.full : LINES.fullPlain); R.UI.closeMessage(); return; }
        const ids = party().map((m) => m.id).concat([c.id]);
        if (call('setParty', ids)) { R.sfx('swap'); await this.lines([], [c]); this.side = 0; this.ai = party().length - 1; }
        else R.sfx('buzzer');
      }
      this.clamp();
    }
    async second(c) {
      const a = this.pick;
      this.pick = null;
      const b = { side: this.side, id: c.id };
      if (a.id === b.id) return;
      const find = (id) => party().concat(reserve()).find((m) => m.id === id);
      if (a.side === 0 && b.side === 0) {
        const ids = party().map((m) => m.id);
        const i = ids.indexOf(a.id), j = ids.indexOf(b.id);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        if (call('setOrder', ids) !== false) R.sfx('swap');
        return;
      }
      if (a.side === 1 && b.side === 1) { R.sfx('buzzer'); return; }
      const act = a.side === 0 ? a.id : b.id, res = a.side === 0 ? b.id : a.id;
      const out = find(act), inn = find(res);
      if (act === 'hero') { await say(LINES.heroStays); R.UI.closeMessage(); return; }
      if (!call('swap', act, res)) { R.sfx('buzzer'); return; }
      R.sfx('swap');
      await this.lines([out], [inn]);
      this.side = 0;
      this.ai = Math.max(0, party().findIndex((m) => m.id === res));
      this.clamp();
    }
    /** put the cursor on a member (party or reserve) so the lower window shows who is talking */
    focus(id) {
      const a = party().findIndex((m) => m.id === id);
      if (a >= 0) { this.side = 0; this.ai = a; } else {
        const r = reserve().findIndex((m) => m.id === id);
        if (r >= 0) { this.side = 1; this.ri = r; }
      }
      this.clamp();
    }
    /** leaveLine of those benched → rejoinLine of those joining (one line each, A to advance) */
    async lines(outs, ins) {
      for (const m of outs) { const d = m && DB.companions[m.id]; if (d && d.leaveLine) { this.focus(m.id); await say(d.leaveLine); } }
      for (const m of ins) { const d = m && DB.companions[m.id]; if (d && d.rejoinLine) { this.focus(m.id); await say(d.rejoinLine); } }
      R.UI.closeMessage();
    }
    draw() {
      if (this.opaque) K().backdrop();
      inFrame(() => this.render());
    }
    render() {
      const g = G(), C = g.C, kit = K();
      const walk = Math.floor(R.Engine.frame / 16) % 2;
      const blink = Math.floor(R.Engine.frame / 8) % 2 === 0;
      g.window(4, 4, 124, 126, { title: '出撃' });
      party().forEach((m, k) => {
        // row of 28: figure (x+8, y+6+28k), the name on the first line, Lv and the 前/中 plate on the second
        const y = 4 + 8 + 28 * k;
        const picked = this.pick && this.pick.id === m.id;
        if (picked && blink) { g.ctx.globalAlpha = 0.35; g.rect(8, y - 3, 116, 27, '#6fd8ff'); g.ctx.globalAlpha = 1; }
        kit.drawFigure(kit.charKey(m), 12, y - 2, { frame: this.side === 0 && k === this.ai ? walk : 0 });
        g.fitText(m.name, 32, y, 88, { color: m.hp <= 0 ? C.dead : C.white });
        g.text('Lv' + (m.level || 1), 34, y + 12, { color: '#c8c8d8' });
        kit.drawRowTag(m.row, 108, y + 11);
        if (this.side === 0 && k === this.ai) g.cursor(4 + 2, y + 5, !this.busy);
      });
      for (let k = party().length; k < maxParty(); k++) g.text('――', 32, 12 + 28 * k, { color: '#4c5070' });
      const rs = reserve();
      g.window(130, 4, 122, 126, { title: '控え' });
      for (let k = 0; k < 8 && this.rtop + k < rs.length; k++) {
        const i = this.rtop + k, m = rs[i], y = 12 + 14 * k;
        const picked = this.pick && this.pick.id === m.id;
        if (picked && blink) { g.ctx.globalAlpha = 0.35; g.rect(134, y - 1, 114, 13, '#6fd8ff'); g.ctx.globalAlpha = 1; }
        g.fitText(m.name, 146, y, 62);
        g.text('Lv' + (m.level || 1), 244, y, { align: 'right', color: '#c8c8d8' });
        if (this.side === 1 && i === this.ri) g.cursor(136, y + 1, !this.busy);
      }
      if (!rs.length) g.text('いない', 191, 60, { align: 'center', color: '#4c5070' });
      if (this.rtop > 0) tri(191, 7, -1);
      if (this.rtop + 8 < rs.length) tri(191, 123, 1);
      // after the first pick the lower window's title asks for the second one (nothing covers the lists)
      const who = this.pick ? party().concat(rs).find((m) => m.id === this.pick.id) : null;
      g.window(4, 132, 248, 88, { title: who ? who.name + 'と入れ替える人は？' : null });
      const c = this.cur;
      if (c) drawInfo(c, 12, 141);
    }
  }
  const tri = (x, y, dir) => K().tri(x, y, dir);
  /** カーソルの人の要約: 肩書・役割・隊列、個性、得手不得手 3 行 */
  function drawInfo(c, x, y) {
    const g = G(), C = g.C, kit = K();
    const d = DB.companions[c.id];
    if (c.id === 'hero') {
      const T = DB.heroTypes[c.heroType];
      const fav = c.favor ? (c.favor.kind === 'weapon' ? kit.wname(c.favor.id) : kit.ename(c.favor.id)) : '';
      g.text(c.name, x, y);
      g.text((T ? T.name : '') + (fav ? '　得意：' + fav : ''), x + 62, y, { color: '#c8c8d8' });
      g.text(kit.ROW_NAMES[c.row] || '', x + 232, y, { align: 'right', color: c.row === 'middle' ? C.cyan : C.orange });
      if (T) g.fitText(T.desc.split('\n')[0], x, y + 14, 232, { color: '#c8c8d8' });
    } else if (d) {
      g.text(c.name, x, y);
      g.text(d.title + '　' + kit.ROLE_NAMES[d.role], x + 62, y, { color: '#c8c8d8' });
      g.text(kit.ROW_NAMES[c.row] || '', x + 232, y, { align: 'right', color: c.row === 'middle' ? C.cyan : C.orange });
      g.text('個性：', x, y + 14, { color: '#c8c8d8' });
      g.text(d.innate.name, x + 32, y + 14, { color: C.gold });
      g.fitText(d.innate.desc, x + 36 + g.textWidth(d.innate.name), y + 14, 232 - 36 - g.textWidth(d.innate.name));
    }
    kit.drawAptWide(kit.aptOf(c), x, y + 30, { pitch: 14, gap: 2 });
  }

  // ------------------------------------------------------------ 装備をあずかる
  const gearCount = (c) => SLOTS.filter((s) => c.equip && c.equip[s]).length;
  class DepositLayer extends R.Layer {
    constructor(o) {
      super();
      this.o = o || {};
      this.busy = false;
      this.list = null;
      this.build(Math.max(0, reserve().findIndex((c) => gearCount(c))));
    }
    build(index) {
      const items = reserve().map((c) => ({ label: c.name, right: gearCount(c) ? '装備' + gearCount(c) : '', disabled: !gearCount(c), c }));
      this.list = new R.UI.List({ x: 4, y: 4, w: 110, items, rows: Math.min(9, Math.max(1, items.length)), index: index || 0, title: '控えの仲間' });
    }
    update() {
      if (this.busy || this.closed) return;
      const r = this.list.update();
      if (r === 'cancel') { this.close(); return; }
      if (r !== 'select') return;
      const c = this.list.item.c;
      this.busy = true;
      Promise.resolve().then(async () => {
        if (!(await yesno(nm(this.o.master ? LINES.deposit : LINES.depositPlain, c.name)))) return;
        if (!R.Rules || !R.Rules.unequipAll) { R.warn('R.Rules.unequipAll is missing'); R.sfx('buzzer'); return; }
        R.Rules.unequipAll(c);
        R.sfx('item');
        this.build(this.list.index);
        await say(gearCount(c) ? (this.o.master ? LINES.overflow : LINES.overflowPlain) : LINES.deposited);
        R.UI.closeMessage();
        if (!reserve().some((m) => gearCount(m))) this.close();
      }).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; R.Input.consume(); });
    }
    draw() { inFrame(() => this.render()); }
    render() {
      const g = G(), C = g.C;
      this.list.draw({ showInactiveCursor: true });
      const it = this.list.item;
      if (!it) return;
      const c = it.c;
      g.window(116, 4, 136, 142, { title: c.name });
      const names = Object.assign({ weapon1: '武器1', weapon2: '武器2', shield: '盾', head: '頭', body: '体', hands: '手', feet: '足', acc1: 'アクセ1', acc2: 'アクセ2' },
        (R.Rules && R.Rules.SLOT_NAMES) || {});
      SLOTS.forEach((s, k) => {
        const y = 12 + 14 * k, id = c.equip[s];
        g.fitText(names[s], 124, y, 36, { color: '#8c90a8' });
        if (!id) { g.text('――', 164, y, { color: '#4c5070' }); return; }
        const K2 = R.Menu && R.Menu.kit;
        const label = K2 && K2.itemLabel ? K2.itemLabel(id) : K().itemName(id);
        const color = K2 && K2.itemColor ? K2.itemColor(id) : C.white;
        g.fitText(label, 164, y, 82, { color });
      });
    }
  }
  async function deposit(o) {
    const rs = reserve();
    if (!rs.length) { await say(LINES.noReserve); R.UI.closeMessage(); return; }
    if (!rs.some((c) => gearCount(c))) { await say(LINES.noGear); R.UI.closeMessage(); return; }
    await R.Engine.run(new DepositLayer(o));
  }

  // ------------------------------------------------------------ 並びと隊列
  async function orderScreen(master) {
    if (R.Menu && R.Menu.orderScreen) return R.Menu.orderScreen();
    return R.Engine.run(new SwapLayer({ master }));
  }

  // ------------------------------------------------------------ the tavern
  class CommandLayer extends R.Layer {
    constructor(o) {
      super();
      this.o = o;
      this.busy = false;
      this.list = null;
      this.build();
    }
    build() {
      const idx = this.list ? this.list.index : 0;
      const items = [];
      if (this.o.recruit) items.push({ label: LINES.commands[0], id: 'find', color: unrecruited().length ? null : G().C.gray });
      items.push({ label: LINES.commands[1], id: 'swap' }, { label: LINES.commands[2], id: 'order' }, { label: LINES.commands[3], id: 'deposit' }, { label: LINES.commands[4], id: 'quit' });
      this.list = new R.UI.List({ x: 4, y: 4, w: 120, items, rows: items.length, index: idx });
    }
    update() {
      if (this.busy || this.closed) return;
      const r = this.list.update();
      if (r === 'cancel') { this.close(); return; }
      if (r !== 'select') return;
      const id = this.list.item.id;
      if (id === 'quit') { this.close(); return; }
      this.busy = true;
      Promise.resolve().then(() => this.run(id)).catch((e) => R.Engine.reportError(e)).finally(() => { this.busy = false; this.build(); R.Input.consume(); });
    }
    async run(id) {
      if (id === 'find' && !unrecruited().length) { await say(LINES.none); R.UI.closeMessage(); return; }
      this.hidden = true;
      try {
        if (id === 'find') await R.Engine.run(new ChooseLayer({ mode: 'browse' }));
        else if (id === 'swap') await R.Engine.run(new SwapLayer({ master: this.o.recruit }));
        else if (id === 'order') await orderScreen(this.o.recruit);
        else if (id === 'deposit') await deposit({ master: this.o.recruit });
      } finally { this.hidden = false; }
    }
    draw() { if (!this.hidden) inFrame(() => this.list.draw({ showInactiveCursor: true })); }
  }

  R.Tavern = {
    LINES, announceJoin,
    /** the first companions (§11.8.4). Resolves the chosen ids (always count of them). */
    async chooseStart(o) {
      const opts = Object.assign({ count: 3, recruit: true, announce: true }, o || {});
      const restore = withBgm(true);
      const L = new ChooseLayer({ mode: 'start', count: opts.count });
      const done = R.Engine.run(L);
      if (opts.advice !== false) { L.busy = true; await say(LINES.advice); R.UI.closeMessage(); L.busy = false; R.Input.consume(); }
      const ids = await done;
      // keep the chosen roster on screen while each one joins and introduces themselves
      const show = opts.announce ? new ChooseLayer({ mode: 'start', count: opts.count }) : null;
      if (show) { show.chosen = ids.slice(); show.busy = true; R.Engine.push(show); }
      for (let i = 0; i < ids.length; i++) {
        const before = reserve().length;
        const c = opts.recruit ? call('recruit', ids[i]) : null;
        if (!show) continue;
        show.cur = Math.max(0, show.ids.indexOf(ids[i]));
        show.page = 0;
        await announceJoin(c || ids[i], { jingle: i === 0, bench: !!c && reserve().length > before });
      }
      if (show) { R.UI.closeMessage(); show.close(); }
      restore();
      return ids;
    },
    /** the tavern master (recruit:true) or the field menu 仲間 (recruit:false) */
    async open(o) {
      const opts = Object.assign({ recruit: true }, o || {});
      const restore = withBgm(opts.recruit);
      try {
        if (opts.recruit) await R.UI.say(LINES.greet, { noWait: true });
        await R.Engine.run(new CommandLayer(opts));
        R.UI.closeMessage();
        if (opts.recruit) { await say(LINES.bye); }
      } finally {
        R.UI.closeMessage();
        restore();
      }
    },
    /** 仲間を探す alone (the same screen as chooseStart, one at a time) */
    browse() { return unrecruited().length ? R.Engine.run(new ChooseLayer({ mode: 'browse' })) : say(LINES.none).then(() => R.UI.closeMessage()); },
    swapScreen(o) { return R.Engine.run(new SwapLayer(o || {})); },
    deposit,
    unrecruited,
    _ChooseLayer: ChooseLayer, _SwapLayer: SwapLayer, _CommandLayer: CommandLayer, _DepositLayer: DepositLayer,
  };
})(window.RPG);
