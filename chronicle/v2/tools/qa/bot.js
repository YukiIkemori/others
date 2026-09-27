// QA: playthrough の入力の台本を動かす「手」（ページの中で動く。tools/qa/playthrough.js が tools/lib/maps.js の後に入れる）。
// ゲームの中身には触らず、R.Input._set（CORE のテスト用の口）でボタンを押し、R.Engine.step で時間を進める。
// 読むのは画面の状態だけ（一番上の場面・一覧の index・会話の選択肢・戦闘の st.ui・FIELD の位置）。
//   __bot.setup(route)   台本（目標の列・選択・全滅の仕方）を置く
//   __bot.run(frames)    frames だけ進める → 状態 {goal, done, fail, frames, top, pos, …}
(function () {
  'use strict';
  const R = window.RPG;
  const DT = 50;                  // 1 フレームで進める時間（場面はどれも時間で動くので、20 fps の刻みでよい）
  const RENDER_EVERY = 5;        // 描く間隔（会話の頁割りは draw で決まるので時々は描く）
  const BTNS = ['a', 'b', 'x', 'y', 'l', 'r', 'start', 'up', 'down', 'left', 'right', 'dash'];
  const B = (window.__bot = {
    route: null, goals: [], log: [], frames: 0, done: false, fail: null, warn: [],
    stats: { tops: {}, taps: 0, screenOps: 0, choices: 0, chars: 0, captions: 0, battles: [], wipes: [], talks: 0, plans: 0, planMs: 0, forced: [] },
    phaseAt: {}, marks: [],
  });
  let M = null;
  let held = {}, cool = 0;
  const now = () => (R.Engine ? R.Engine.time : 0);
  const G = () => R.Game;
  const check = (c) => { if (c == null) return true; if (typeof c === 'function') { try { return !!c(); } catch (e) { return false; } } try { return !!(G() && R.State.check(c)); } catch (e) { return false; } };
  function note(s, o) { const e = { f: B.frames, t: Math.round(now()), msg: s }; if (o) e.o = o; B.log.push(e); if (B.log.length > 4000) B.log.shift(); }
  B.note = note;

  // ---------------------------------------------------------------- 入力
  function tap(b) { if (cool > 0) return false; held[b] = true; cool = 2; B.stats.taps++; const t = R.Engine.top(); if (t && /^screen:/.test(t.id)) B.stats.screenOps++; return true; }
  function hold(b) { held[b] = true; }
  function dirTo(dx, dy) { if (dx > 0) hold('right'); if (dx < 0) hold('left'); if (dy > 0) hold('down'); if (dy < 0) hold('up'); }
  function apply() { for (const b of BTNS) R.Input._set(b, !!held[b]); }

  // ---------------------------------------------------------------- 会話の見張り（選択肢の文字と字数を数える）
  let lastSay = null;
  function hook() {
    const Msg = R.UIK.Message;
    if (Msg._qaHooked) return;
    Msg._qaHooked = true;
    const say = Msg.say, cap = Msg.caption;
    Msg.say = function (o) {
      lastSay = o || {};
      const t = Msg.plain ? Msg.plain(String((o && o.text) || '')) : String((o && o.text) || '');
      B.stats.chars += t.replace(/\s/g, '').length;
      B.stats.talks++;
      if (o && o.choices && o.choices.length) B.stats.choices++;
      return say.apply(this, arguments);
    };
    Msg.caption = function (text) {
      B.stats.captions++;
      B.stats.chars += String(text || '').replace(/\s/g, '').length;
      return cap.apply(this, arguments);
    };
    R.on('battle:start', (e) => {
      const s = (e && e.setup) || {};
      const boss = !!s.boss || !!(s.troop && R.DB.troops[s.troop] && R.DB.troops[s.troop].boss);
      const map = R.Field.pos.map;
      const L = B.loseNext;
      const lose = !!L && (L.zako ? !boss && !s.troop && (!L.map || map.indexOf(L.map) === 0) : L.boss ? boss : true);
      B.cur = { troop: s.troop || null, zone: s.zone || null, boss, map, gold: G() ? G().gold : 0, rounds: 0, lose, f: B.frames, t0: now() };
      if (lose) note('lose mode: ' + (s.troop || s.zone));
    });
    R.on('battle:end', (res) => {
      const c = B.cur || {};
      c.result = res && res.result; c.to = res && res.to; c.ms = now() - (c.t0 || now());
      B.stats.battles.push(c);
      B.cur = null;
      if (c.wiped && res && res.result === 'abort') B.afterWipe = { to: res.to, goldBefore: c.gold, f: B.frames, battle: c.troop || c.zone };
    });
    R.on('spring:use', () => { B.springAt = B.frames; });
  }

  // ---------------------------------------------------------------- 一覧（UIK.List）で行を選ぶ
  function selectRow(list, pred) {
    if (!list || !list.rows) return false;
    const i = list.rows.findIndex(pred);
    if (i < 0) return false;
    if (list.index === i) { tap('a'); return true; }
    const c = list.cols || 1, cur = list.index;
    const li = Math.floor(i / c), lc = Math.floor(cur / c);
    if (li !== lc) tap(li > lc ? 'down' : 'up');
    else tap(i % c > cur % c ? 'right' : 'left');
    return true;
  }
  function pickChoice(text, choices) {
    const s = (text || '') + ' || ' + choices.join(' | ');
    for (const r of (B.route && B.route.choices) || []) {
      if (!new RegExp(r.re).test(s)) continue;
      if (typeof r.pick === 'number') return r.pick;
      const i = choices.findIndex((c) => new RegExp(r.pick).test(c));
      if (i >= 0) return i;
    }
    return 0;
  }

  // ---------------------------------------------------------------- 場面ごと
  function onMessage() {
    const st = R.UIK.Message.state();
    if (!st) { tap('a'); return; }
    const o = lastSay || {};
    const ch = o.choices || [];
    if (ch.length && st.full) {
      const want = pickChoice(o.text, ch.map(String));
      if (st.choice !== want) { tap(st.choice < want ? 'down' : 'up'); return; }
      if (B.lastChoiceNote !== o) { B.lastChoiceNote = o; note('choose ' + JSON.stringify(ch[want]) + ' for ' + JSON.stringify(String(o.text || '').slice(0, 30))); }
      tap('a');
      return;
    }
    tap('a');
  }

  function onScreen(name, top) {
    const v = top.view || {};
    const list = top.list;
    const task = B.task;
    if (v.modal) {
      const m = v.modal, rows = (m.list && m.list.rows) || [];
      const labels = rows.map((r) => String(r.label || ''));
      let want = 0;
      if (task && task.modal) { const i = labels.findIndex((l) => new RegExp(task.modal).test(l)); if (i >= 0) want = i; }
      else want = pickChoice(String(m.text || m.title || ''), labels);
      if (m.list && rows.length) selectRow(m.list, (r, i) => i === want);
      else tap('a');
      return;
    }
    switch (name) {
      case 'title': {
        const want = (task && task.title) || 'new';
        if (task && task.title) task.stage = 'title';
        if (!selectRow(list, (r) => r.value === want)) tap('a');
        return;
      }
      case 'charcreate': {
        const h = B.route.hero;
        const row = v.rows[v.list.index];
        const need = [['sex', h.sex], ['type', h.type]].concat(h.fav ? [['fav', h.fav]] : []);
        const bad = need.find(([k, val]) => v[k] !== val);
        if (bad) {
          const bi = v.rows.findIndex((r) => r.key === bad[0]);
          if (v.list.index !== bi) { tap(v.list.index < bi ? 'down' : 'up'); return; }
          tap('right');
          return;
        }
        const gi = v.rows.findIndex((r) => r.key === 'go');
        if (row && row.key === 'go') tap('a'); else tap(v.list.index < gi ? 'down' : 'up');
        return;
      }
      case 'nameentry': tap('b'); return;
      case 'partySelect': {
        const want = B.route.party.find((id) => !(v.picks || []).includes(id) && v.ids.includes(id));
        if (want) selectRow(list, (r) => r.value === want);
        else tap('a');
        return;
      }
      case 'hub': {
        if (task && task.stage === 'saved') { tap('b'); return; }
        if (task && (task.kind === 'save' || task.kind === 'suspend')) { selectRow(list, (r) => r.value === 'save') || tap('b'); return; }
        tap('b');
        return;
      }
      case 'save': {
        if (task && task.kind === 'save') {
          if (task.stage === 'saved') { tap('b'); return; }
          task.modal = '上書き';
          selectRow(list, (r) => r.value === task.slot);
          return;
        }
        if (task && task.kind === 'suspend') { task.modal = '中断する'; selectRow(list, (r) => r.value === 'suspend'); return; }
        tap('b');
        return;
      }
      case 'load': {
        if (task && task.slot) { task.modal = '読み込む'; selectRow(list, (r) => r.value === task.slot); return; }
        tap('b');
        return;
      }
      case 'inn': {
        if (list && selectRow(list, (r) => /泊/.test(r.label || '') || r.value === 'stay')) return;
        tap('a');
        return;
      }
      case 'shop': return onShop(v, list);
      case 'letter': case 'tip': case 'detail': tap('a'); return;
      default:
        // 店・装備など（台本では使わない）: 閉じる
        if ((B.scrTaps = (B.scrTaps || 0) + 1) % 3 === 0) tap('a'); else tap('b');
    }
  }

  // ---------------------------------------------------------------- 店: 一行が強くなる装備（付けられる人の中でいちばん上がる人）と消耗品を買う
  const STOCK = { i_salve: 8, i_potion: 6, i_waker: 4, i_antidote: 3, i_firepot: 3, i_revive: 2, i_ether: 3 };
  function onShop(v, list) {
    if (v.busy || v.tab !== 0) { if (v.tab !== 0) tap('l'); return; }
    const g = B.goals.find((h) => h.id === B.goalId);
    if (!g || !g.shop) { tap('b'); return; }
    const Sx = R.Screens, G0 = G();
    const gold = G0.gold, reserve = 40;
    let best = -1, bestV = 0;
    list.rows.forEach((row, i) => {
      const id = row.value, it = R.DB.items[id];
      if (!it || !(it.price > 0) || it.price > gold - reserve) return;
      if (['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc'].includes(it.slot) && !/^ac_ward_/.test(id)) {   // 状態よけより能力値のアクセサリ
        if ((G0.items[id] || 0) > 0) return;   // 買って付けなかった物がある
        let gain = 0;
        for (const c of R.Party.members()) {
          const slot = R.Rules.defaultSlot(c, id);
          if (!slot || !R.Rules.canEquip(c, id, slot)) continue;
          const d = Sx.equipScore(c, slot, id) - Sx.equipScore(c, slot, c.equip[slot] || null);
          if (d > gain) gain = d;
        }
        if (gain > 0 && gain / it.price > bestV) { bestV = gain / it.price; best = i; }
      } else if (STOCK[id] && (G0.items[id] || 0) < STOCK[id] && bestV === 0 && best < 0) best = i;
    });
    if (best < 0 || (B.shopBuys = (B.shopBuys || 0) + 1) > 40) { B.shopBuys = 0; tap('b'); return; }
    if (list.index === best) note('buy ' + list.rows[best].value + ' (' + gold + ' G)');
    selectRow(list, (r, i) => i === best);
  }

  // ---------------------------------------------------------------- 戦闘
  const TOPKEY = { attack: 'weapon', skill: 'weapon', spell: 'spell', defend: 'defend', item: 'item' };
  function onBattle() {
    const st = R.Battle.debug && R.Battle.debug();
    if (!st) { tap('a'); return; }
    const eng = st.B && st.B.engine;
    if (B.cur && eng) B.cur.rounds = Math.max(B.cur.rounds || 0, eng.round || 0);
    // 負ける台本: 全員が守るだけ。6 ラウンドで倒れなければ（守ると倒れない相手）、一行の HP を 1 にする（台本の都合。stats.forced に残す）
    if (B.cur && B.cur.lose && eng && eng.round >= 6 && !B.cur.forced) {
      B.cur.forced = true;
      for (const u of eng.party) if (u.alive) u.hp = 1;
      B.stats.forced.push({ battle: B.cur.troop || B.cur.zone, round: eng.round, f: B.frames });
      note('lose mode: party HP set to 1 at round ' + eng.round);
    }
    const w = st.ui;
    if (!w) { if (st.phase === 'play') hold('a'); else tap('a'); return; }
    const rows = w.o && w.o.rows;
    if (!rows) {
      // ねらい: st.hot の相手が決めた相手になるまで ↓
      const hot = Object.keys(st.hot || {});
      const d = B.dec && B.dec.target;
      if (hot.length > 1 || d == null || (st.hot && st.hot[d]) || (B.tgtTries = (B.tgtTries || 0) + 1) > 12) { B.tgtTries = 0; tap('a'); return; }
      tap('down');
      return;
    }
    const keys = rows.map((r) => r.key);
    if (keys.includes('retry') && keys.includes('inn')) {
      if (B.cur && B.goLast !== B.cur.f + ':' + (eng ? eng.round : 0)) {
        B.goLast = B.cur.f + ':' + (eng ? eng.round : 0);
        B.cur.lost = (B.cur.lost || 0) + 1;
        if (B.cur.lost > 1) note('lost again (' + B.cur.lost + ') ' + (B.cur.troop || B.cur.zone));
        if (B.cur.lost > 6) { fail('lost ' + B.cur.lost + ' times in a row to ' + (B.cur.troop || B.cur.zone)); return; }
      }
      let want = (B.wipeTo || 'retry');
      // 本気で負けた（負ける台本でない）: 1 回目は直前の戦闘から。2 回目は宿へ戻り、道中で 12 戦ほど腕を磨いてから行き直す
      if (B.cur && !B.cur.lose && B.goKey !== B.goLast) {
        B.goKey = B.goLast;
        B.realLoss = (B.realLoss || {});
        const k = B.cur.troop || B.cur.zone;
        B.realLoss[k] = (B.realLoss[k] || 0) + 1;
        if (B.realLoss[k] >= 2 && B.realLoss[k] % 2 === 0) { want = 'inn'; B.grind = { n: 12, from: B.stats.battles.length + 1 }; note('lost twice to ' + k + ' → inn and grind 12 battles'); }
        B.goWant = want;
      } else if (B.goWant && B.goKey === B.goLast) want = B.goWant;
      if (B.cur && !B.cur.wiped) { B.cur.wiped = true; B.cur.lose = false; B.loseNext = null; B.stats.wipes.push({ battle: B.cur.troop || B.cur.zone, map: B.cur.map, to: want, gold: B.cur.gold, round: B.cur.rounds, f: B.frames }); note('gameover → ' + want); }
      menuPick(w, rows.findIndex((r) => r.key === want));
      return;
    }
    if (keys.includes('fight')) { B.dec = null; menuPick(w, rows.findIndex((r) => r.key === 'fight')); return; }
    if (keys.includes('weapon') || keys.includes('defend')) {
      const uid = st.activeUid;
      const dk = uid + ':' + (eng ? eng.round : 0);
      if (!B.dec || B.decKey !== dk) {
        B.decKey = dk;
        let d = null;
        const lose = B.cur && B.cur.lose;
        if (lose) d = { cmd: 'defend', id: 'defend', target: uid };
        else { try { d = R.BattleAI.partyCommand(st.B, uid, 'script'); } catch (e) { d = null; } }
        B.dec = d || { cmd: 'attack', id: 'attack', target: null };
      }
      let k = TOPKEY[B.dec.cmd] || B.dec.cmd;
      let i = rows.findIndex((r) => r.key === k && !r.disabled);
      if (i < 0) { B.dec = { cmd: 'attack', id: 'attack', target: null }; i = rows.findIndex((r) => r.key === 'weapon'); }
      if (i < 0) i = 0;
      menuPick(w, i);
      return;
    }
    // 技・術・道具の一覧
    let i = rows.findIndex((r) => r.id === (B.dec && B.dec.id) && !r.disabled);
    if (i < 0) i = rows.findIndex((r) => r.id === 'attack');
    if (i < 0) i = rows.findIndex((r) => !r.disabled);
    if (i < 0) { tap('b'); return; }
    menuPick(w, i);
  }
  function menuPick(w, i) {
    if (i < 0) i = 0;
    if (w.sel === i) { tap('a'); return; }
    const hz = w.o && w.o.horizontal;
    tap(w.sel < i ? (hz ? 'right' : 'down') : (hz ? 'left' : 'up'));
  }

  // ---------------------------------------------------------------- フィールド: 目標へ歩く・話す・調べる
  function F() { return R.Field; }
  function S() { return R.Field._s; }
  function partyHp() {
    let hp = 0, max = 0;
    for (const c of R.Party.members()) { const s = R.Rules.stats(c); hp += Math.max(0, c.hp); max += s.maxHp; }
    return max ? hp / max : 1;
  }
  function goalDone(g) {
    if (g.doneFn) return g.doneFn();
    if (g.done != null) return check(g.done);
    return !!g._done;
  }
  function curGoal() {
    const s = S(), zoneHere = !!(s && s.map && (s.map.zones || []).length && s.map.kind !== 'town' && s.map.kind !== 'interior');
    for (const g of B.goals) {
      if (g._skip) continue;
      if (goalDone(g)) continue;
      if (g.grind != null && !zoneHere) continue;   // 腕を磨くのは出現のあるマップに着いてから
      return g;
    }
    return null;
  }
  function placesFor(g) {
    if (g.spring) {
      const out = [];
      for (const mid of [].concat(g.spring)) for (const o of M.springs(mid)) out.push({ map: mid, kind: 'obj', ref: o });
      return out;
    }
    if (g.go) return [{ map: g.go.map, kind: 'cell', ref: g.go }];
    if (!g.ev) return [];
    return M.eventPlaces(g.ev);
  }
  function goalCells(g) {
    const places = placesFor(g);
    return (mid) => {
      const out = [];
      for (const p of places) {
        if (p.map !== mid) continue;
        if (p.kind === 'cell') { out.push({ x: p.ref.x, y: p.ref.y, lv: p.ref.lv || 0, place: p }); continue; }
        for (const c of M.standCells(mid, p)) out.push(Object.assign(c, { place: p }));
      }
      return out;
    };
  }
  function planFor(g) {
    const s = S();
    const t0 = performance.now();
    const blocked = B.blocked || {};
    // 順番の決まった目標（救出の順）: まだ番の来ていない目標の「踏むと始まる範囲」は踏まない
    const avoid = {};
    if (g.ordered || g._h) {
      const cur = B.goals.indexOf(B.goals.find((h) => h.id === B.goalId));
      for (const h of B.goals.slice(cur + 1)) {
        if (!h.ordered || h._skip || goalDone(h) || !h.ev) continue;
        for (const p of M.eventPlaces(h.ev)) if (p.kind === 'trigger') for (const c of M.standCells(p.map, p)) avoid[p.map + ':' + c.x + ',' + c.y] = 1;
      }
    }
    let pl = M.plan({ map: s.map.id, x: s.x, y: s.y, lv: s.lv || 0 }, goalCells(g), {
      blocked: (m, x, y, lv) => !!blocked[m + ':' + x + ',' + y + ',' + lv] || !!avoid[m + ':' + x + ',' + y],
    });
    if (!pl && Object.keys(avoid).length) {
      pl = M.plan({ map: s.map.id, x: s.x, y: s.y, lv: s.lv || 0 }, goalCells(g), { blocked: (m, x, y, lv) => !!blocked[m + ':' + x + ',' + y + ',' + lv] });
      if (pl && !g._avoidNote) { g._avoidNote = true; note('goal ' + g.id + ': only reachable through the trigger of a later rescue'); }
    }
    B.stats.plans++; B.stats.planMs += performance.now() - t0;
    if (!pl) return null;
    const leg = pl.legs[0];
    const path = M.path(leg.res, leg.to.x, leg.to.y, leg.to.lv);
    return { g, map: s.map.id, leg, path, cost: pl.cost, legs: pl.legs.length, goalCell: pl.legs[pl.legs.length - 1].goal };
  }

  function onField() {
    const s = S();
    if (!s || !s.map) return;
    const f = F();
    if (R.Events.busy() || f._locked() || s.entering || s.arriving || R.Engine.fade.a > 0.01) { B.idle = 0; return; }
    // 目標
    const g = curGoal();
    if (!g) { B.done = true; return; }
    if (B.goalId !== g.id) {
      B.goalId = g.id; B.plan = null; B.tries = 0; B.stuck = 0; B.blocked = {};
      g.t0 = B.frames;
      note('goal ' + g.id);
      if (g.lose) B.loseNext = { boss: true };
      if (g.wipeTo) B.wipeTo = g.wipeTo;
    }
    if (B.frames - g.t0 > (g.maxFrames || 60000)) { fail('goal ' + g.id + ' timed out'); return; }
    if (B.afterWipe && B.afterWipe.goldAfter == null) { B.afterWipe.goldAfter = G().gold; B.afterWipe.mapAfter = s.map.id; B.stats.wipes[B.stats.wipes.length - 1].after = { gold: G().gold, map: s.map.id }; note('after wipe: gold ' + B.afterWipe.goldBefore + ' → ' + G().gold + ' at ' + s.map.id); }
    if (g.grind != null) {
      if (B.stats.battles.length >= g.grind) { g._done = true; B.grind = null; note('grind goal ' + g.id + ' done (' + B.stats.battles.length + ' battles)'); return; }
      if ((s.map.zones || []).length && s.map.kind !== 'town' && s.map.kind !== 'interior') { if (!B.grind) { B.grind = { n: g.grind - B.stats.battles.length, from: B.stats.battles.length }; note('grind to ' + g.grind + ' battles on ' + s.map.id); } }
      else if (!g.ev) { g._skip = true; note('grind ' + g.id + ': no encounter zone here, skipped'); return; }
    }
    if (g.setLose) { B.loseNext = g.setLose; if (g.wipeTo) B.wipeTo = g.wipeTo; g._done = true; note('armed lose ' + JSON.stringify(g.setLose)); return; }
    // 台本のメニュー操作（R5: セーブ・中断・読み込み）
    if (g.task) {
      if (!B.task || B.task.goal !== g.id) { B.task = Object.assign({ goal: g.id, stage: 'open' }, g.task); note('task ' + JSON.stringify(g.task)); }
      if (B.task.stage === 'done') { g._done = true; B.task = null; return; }
      if (B.task.stage === 'title' || B.task.stage === 'loaded') { B.task.stage = 'done'; return; }
      if (B.task.kind === 'save' && B.task.stage === 'saved') { B.task.stage = 'done'; return; }
      tap('y');
      return;
    }
    // 腕を磨く（ボスに 2 回負けた後）: 今のマップに出現表があれば、近くの出現するマスを行き来する
    if (B.grind && B.stats.battles.length - B.grind.from >= B.grind.n) { note('grind done'); B.grind = null; B.plan = null; }
    if (B.grind && !g.task && (s.map.zones || []).length && s.map.kind !== 'town' && s.map.kind !== 'interior') {
      if (!B.grindAt || (s.x === B.grindAt.x && s.y === B.grindAt.y) || (B.grindT = (B.grindT || 0) + 1) > 400) {
        B.grindT = 0;
        const res = M.bfs(s.map, [{ x: s.x, y: s.y, lv: s.lv || 0 }], { maxDist: 30 });
        const cand = [...res.dist.entries()].filter(([k, d]) => d >= 5 && d <= (B.grindFar ? 30 : 12)).map(([k]) => k.split(',').map(Number)).filter(([x, y]) => M.zoneAt(s.map, x, y));
        B.grindFar = !cand.length;
        B.grindAt = cand.length ? { x: cand[(B.frames * 7) % cand.length][0], y: cand[(B.frames * 7) % cand.length][1], lv: cand[(B.frames * 7) % cand.length][2] } : null;
        B.plan = null;
      }
      if (B.grindAt) {
        if (!B.plan || B.plan.g !== B.grindG || B.plan.map !== s.map.id) {
          B.grindG = { id: 'grind', go: { map: s.map.id, x: B.grindAt.x, y: B.grindAt.y, lv: B.grindAt.lv } };
          B.plan = planFor(B.grindG);
          B.pi = 0;
          if (!B.plan) { B.grindAt = null; return; }
        }
        const P0 = B.plan;
        let i0 = -1;
        for (let k = 0; k < P0.path.length; k++) { const c = P0.path[k]; if (c.x === s.x && c.y === s.y) { i0 = k; break; } }
        if (i0 < 0 || i0 >= P0.path.length - 1) { B.grindAt = null; return; }
        const n0 = P0.path[i0 + 1];
        dirTo(n0.x - s.x, n0.y - s.y);
        return;
      }
      if (g.grind != null) return;   // 次のフレームで広く探す
    }
    // HP が少ない: 近くの泉（ダンジョン）
    if (!g.noHeal && s.map.kind === 'dungeon' && partyHp() < 0.35 && !B.healing && (B.frames - (B.springAt || -1e9)) > 600) {
      const sp = M.springs(s.map);
      if (sp.length) { B.healing = { spring: s.map.id, id: 'heal', _h: true, t0: B.frames }; B.plan = null; note('low HP ' + partyHp().toFixed(2) + ' → spring'); }
    }
    const tg = B.healing || g;
    if (B.healing && (B.springAt || 0) > B.healing.t0) { B.healing = null; B.plan = null; return; }
    if (!B.plan || B.plan.map !== s.map.id || B.plan.g !== tg) {
      B.plan = planFor(tg);
      if (!B.plan) {
        if (B.healing) { B.healing = null; return; }
        B.unreach = (B.unreach || 0) + 1;
        if (g.optional || B.unreach > 3) { note('unreachable ' + g.id + (g.optional ? ' (optional, skipped)' : '')); if (g.optional) { g._skip = true; B.unreach = 0; return; } }
        // ほかの目標で先に届く物があれば、そちらを先に（順番のしばりの無い物だけ）
        const alt = B.goals.find((h) => h !== g && !h._skip && !goalDone(h) && !h.ordered && !h.task && h.grind == null && (h.ev || h.spring || h.go) && planFor(h));
        if (alt) { note('goal ' + g.id + ' not reachable yet; doing ' + alt.id + ' first'); B.goals.splice(B.goals.indexOf(alt), 1); B.goals.splice(B.goals.indexOf(g), 0, alt); B.goalId = null; return; }
        fail('goal ' + g.id + ' unreachable from ' + s.map.id + ' ' + s.x + ',' + s.y);
        return;
      }
      B.unreach = 0;
      B.pi = 0;
    }
    const P = B.plan;
    // 今の位置が道のどこか
    let i = -1;
    for (let k = Math.max(0, B.pi - 1); k < P.path.length; k++) { const c = P.path[k]; if (c.x === s.x && c.y === s.y && c.lv === (s.lv || 0)) { i = k; break; } }
    if (i < 0) { if (s.mv) return; B.plan = null; return; }
    B.pi = i;
    if (i < P.path.length - 1) {
      const n = P.path[i + 1];
      dirTo(n.x - s.x, n.y - s.y);
      if (!s.mv) {
        B.stuck = (B.stuck || 0) + 1;
        if (B.stuck > 45) {
          B.stuck = 0;
          B.blocked = B.blocked || {};
          B.blocked[s.map.id + ':' + n.x + ',' + n.y + ',' + n.lv] = 1;
          B.plan = null;
          B.stuckN = (B.stuckN || 0) + 1;
          note('stuck at ' + s.x + ',' + s.y + ' → block ' + n.x + ',' + n.y);
          if (B.stuckN > 40) fail('stuck too often at goal ' + g.id);
        }
      } else B.stuck = 0;
      return;
    }
    // 道の終わり
    if (P.leg.portal) { B.atEnd = (B.atEnd || 0) + 1; if (B.atEnd > 20) { B.atEnd = 0; B.plan = null; } return; }
    const gc = P.goalCell || {};
    const place = gc.place || {};
    if (place.kind === 'trigger' || place.kind === 'enter' || place.kind === 'cell') {
      // 範囲に着いた: イベントが走らなければ一歩外へ出て入り直す
      B.atEnd = (B.atEnd || 0) + 1;
      if (B.atEnd > 30) {
        B.atEnd = 0;
        if (place.kind === 'cell') { tg._done = true; B.plan = null; return; }
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => f._canEnter(s.map, s.x, s.y, s.x + dx, s.y + dy, s.lv || 0, dx > 0 ? 'e' : dx < 0 ? 'w' : dy > 0 ? 's' : 'n'));
        if (nb) { dirTo(nb[0], nb[1]); B.plan = null; }
        if ((B.tries = (B.tries || 0) + 1) > 6) fail('trigger for ' + g.id + ' does not fire');
      }
      return;
    }
    // 話す・調べる: 向きを合わせて A
    const face = gc.face;
    if (face && s.dir !== face) { const d = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face]; dirTo(d[0], d[1]); return; }
    const fr = f._front();
    const want = place.ref;
    const ok = fr && ((fr.kind === 'npc' && want && fr.npc && (fr.npc.id === want.id || fr.npc.def === want)) || (fr.kind === 'obj' && fr.obj === want));
    if (B.actAt && B.frames - B.actAt < 30) return;   // 押した後はイベントが始まるのを待つ
    if (ok || (fr && B.atEnd > 20)) {
      if (tap('a')) {
        B.actAt = B.frames;
        B.tries = (B.tries || 0) + 1;
        B.atEnd = 0;
        note('act ' + (tg._h ? 'spring' : g.id) + ' at ' + s.map.id + ' ' + s.x + ',' + s.y + (ok ? '' : ' (front: ' + (fr.npc ? fr.npc.id : fr.obj && fr.obj.type) + ')'));
        if (tg.spring && !tg._h) tg._done = true;
        if (B.tries > (g.maxTries || 6)) { if (g.optional) { g._skip = true; note('gave up optional ' + g.id); } else fail('goal ' + g.id + ' not done after ' + B.tries + ' tries'); }
        B.plan = null;
      }
      return;
    }
    B.atEnd = (B.atEnd || 0) + 1;
    if (B.atEnd > 40) { B.atEnd = 0; B.plan = null; B.blocked = {}; }
  }

  function fail(msg) { if (!B.fail) { B.fail = msg; note('FAIL ' + msg); } }

  // ---------------------------------------------------------------- 1 フレーム
  function decide() {
    const top = R.Engine.top();
    const id = top ? top.id : '(none)';
    B.stats.tops[id] = (B.stats.tops[id] || 0) + 1;
    B.topId = id;
    if (!top) return;
    if (id === 'message') return onMessage();
    if (id === 'caption') return tap('a');
    if (id === 'battle') return onBattle();
    if (id.indexOf('screen:') === 0) return onScreen(id.slice(7), top);
    if (id === 'field') return onField();
    // 自前の幕・小さな遊びなど: 待つ。長く続けば A
    if ((B.otherN = (B.otherN || 0) + 1) % 20 === 0) tap('a');
  }

  function mark() {
    const g = G();
    if (!g) return;
    for (const [k, c] of [['prologue_done', 'prologue_done'], ['forest_start', 'forest_start'], ['cleared', 'cleared_r_forest'], ['t1', 'story_t1']]) {
      if (!B.phaseAt[k] && check(c)) B.phaseAt[k] = { f: B.frames, t: now(), steps: g.steps || 0, chars: B.stats.chars, ops: B.stats.screenOps + B.stats.choices, battles: B.stats.battles.length, playMs: g.playMs || 0 };
    }
  }

  function macro() { return new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); }

  B.setup = function (route) {
    M = window.QAMaps.create(R);
    B.M = M;
    hook();
    B.route = route;
    B.goals = route.goals.map((g) => Object.assign({}, g));
    for (const g of B.goals) if (g.doneJs) g.doneFn = new Function('R', 'G', 'B', 'return (' + g.doneJs + ')').bind(null, R, () => R.Game, B);
    for (const [k, v] of Object.entries(route.settings || {})) R.Settings.set(k, v);
    R.Engine.pause();
    B.phaseAt.start = { f: 0, t: now(), steps: 0, chars: 0, ops: 0, battles: 0, playMs: 0 };
    // R5 の台本のメニュー: 成り行きを画面から見る
    R.on('scene:push', (e) => {
      const t = B.task;
      if (!t) return;
      if (e.id === 'screen:title' && t.kind === 'suspend') t.stage = 'title-open';
    });
    R.on('scene:pop', (e) => {
      if (e.id !== 'screen:shop') return;
      const g = B.goals.find((h) => h.id === B.goalId);
      if (g && g.shop) { g._done = true; note('shop done ' + g.id + ' gold ' + G().gold); }
    });
    R.on('save', (e) => {
      const t = B.task;
      if (t && t.kind === 'save' && e && e.slot === t.slot) { t.stage = 'saved'; note('saved ' + e.slot); }
    });
    return true;
  };
  /** 目標が終わった後: フィールドで止まっているまで A を押して進める（不変条件の確かめの前） */
  B.settle = async function (n) {
    for (let i = 0; i < n; i++) {
      const t = R.Engine.top();
      const idle = t && t.id === 'field' && !R.Events.busy() && !R.UIK.Message.busy() && R.Engine.fade.a < 0.01 && !Object.keys(R.Field.locks()).length;
      if (idle && i > 20) break;
      held = {};
      if (t && t.id !== 'field') { try { decide(); } catch (e) { /* */ } } else if (!idle) tap('a');
      apply();
      R.Engine.step(DT);
      if (cool > 0) cool--;
      B.frames++;
      if (B.frames % RENDER_EVERY === 0) R.Engine.render();
      await macro();
    }
    for (const b of BTNS) R.Input._set(b, false);
    R.Engine.render();
    return B.status();
  };
  B.status = function () {
    const s = S() || {};
    const g = G();
    return {
      frames: B.frames, time: Math.round(now()), goal: B.goalId, done: B.done, fail: B.fail, top: B.topId,
      pos: s.map ? s.map.id + ' ' + s.x + ',' + s.y : null, steps: g ? g.steps : 0, gold: g ? g.gold : 0,
      battles: B.stats.battles.length, wipes: B.stats.wipes.length, round: B.cur ? B.cur.rounds : null, hp: R.Party && G() ? +partyHp().toFixed(2) : null, engineError: R.Engine.error ? R.Engine.error.msg.slice(0, 300) : null,
    };
  };
  B.run = async function (n) {
    for (let i = 0; i < n; i++) {
      if (B.done || B.fail) break;
      held = {};
      try { decide(); } catch (e) { fail('bot error: ' + (e.stack || e)); break; }
      apply();
      try { R.Engine.step(DT); } catch (e) { fail('engine step threw: ' + (e.stack || e)); break; }
      if (cool > 0) cool--;
      B.frames++;
      if (B.frames % RENDER_EVERY === 0) R.Engine.render();
      if (B.frames % 30 === 0) mark();
      await macro();
    }
    mark();
    for (const b of BTNS) R.Input._set(b, false);
    return B.status();
  };
})();
