// The game on top of the field engine (game.js): party, items, villagers, shops, chests, saving, encounters, menus.
// The field engine calls RPG.onMap / onStep / onTrigger / onExit / onKey (see game.js); battles are in battle.js.
window.RPG = (function () {
  'use strict';
  const D = window.RPGDATA, S = window.SND, $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const root = $('rpg'), wait = ms => new Promise(r => setTimeout(r, ms)), rnd = (a, b) => a + Math.random() * (b - a), ri = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const game = () => window.__game;
  const Q = new URLSearchParams(location.search);
  const SAVE_KEY = 'twilight_slice_save_v1';
  let G = null, memSave = null, busy = false, started = false, mapProps = [], curMap = '';
  const ui = [];                       // open widgets; the last one has the keys

  // ------------------------------------------------------------------ state
  const expNext = lv => Math.round((.5 * lv * lv + 5 * lv + 5) * (5 + .5 * lv));
  function stats(id) {
    const c = D.chars[id], p = G.party[id], f = k => Math.floor(c[k][0] + c[k][1] * p.lv);
    const s = { mhp: f('hp'), mmp: f('mp'), str: f('str'), def: f('def'), int: f('int'), spd: f('spd'), dex: f('dex'), atk: 0, mag: 0, healp: 0, arm: D.BODY_DEF, steal: 0, wtype: null };
    for (const slot in p.equip) { const it = D.items[p.equip[slot]]; if (!it) continue; s.atk += it.atk || 0; s.mag += it.mag || 0; s.healp += it.healp || 0; s.arm += it.def || 0; s.steal += it.steal || 0; if (slot === 'weapon') s.wtype = it.wtype; }
    return s;
  }
  const skillsOf = id => Object.entries(D.skills).filter(([k, s]) => s.user === id && s.lv <= G.party[id].lv).map(([k, s]) => Object.assign({ id: k }, s));
  const hasPassive = k => { const p = D.passives[k]; return G.party[p.user].lv >= p.lv && G.party[p.user].hp > 0; };
  function newGame() {
    G = { v: 1, gold: D.start.gold, items: Object.assign({}, D.start.items), party: {}, flags: {}, talk: {}, seen: {}, map: D.start.map, x: null, y: null, dir: 'down',
          steps: 0, next: ri(15, 35), time: 0, wins: 0, set: { speed: 1, bgm: S.vol.bgm, sfx: S.vol.sfx } };
    for (const id of D.order) { const c = D.chars[id]; G.party[id] = { lv: 1, exp: 0, row: c.row, equip: Object.assign({}, c.equip), hp: 1, mp: 0 }; const s = stats(id); G.party[id].hp = s.mhp; G.party[id].mp = s.mmp; }
  }
  const count = it => G.items[it] || 0;
  function give(it, n) { const have = count(it), add = Math.min(n, 10 - have); if (add > 0) G.items[it] = have + add; return add; }
  function take(it, n) { G.items[it] = Math.max(0, count(it) - (n || 1)); if (!G.items[it]) delete G.items[it]; }
  function healAll() { for (const id of D.order) { const s = stats(id); G.party[id].hp = s.mhp; G.party[id].mp = s.mmp; } }
  function gainExp(id, n) {             // -> list of messages (level ups, new skills)
    const p = G.party[id], out = []; p.exp += n;
    while (p.exp >= expNext(p.lv)) {
      p.exp -= expNext(p.lv); const before = skillsOf(id).map(s => s.id), s0 = stats(id); p.lv++;
      const s1 = stats(id); p.hp += s1.mhp - s0.mhp; p.mp += s1.mmp - s0.mmp;
      out.push({ lv: p.lv, text: `${D.chars[id].name}は、\nLv${p.lv}になった！` });
      for (const s of skillsOf(id)) if (!before.includes(s.id)) out.push({ text: `${D.chars[id].name}は、\n${s.name}を覚えた！` });
      for (const k in D.passives) if (D.passives[k].user === id && D.passives[k].lv === p.lv) out.push({ text: `${D.chars[id].name}は、\n${D.passives[k].name}を覚えた！` });
    }
    return out;
  }
  // ------------------------------------------------------------------ saving (the browser's storage may be closed: then it lasts until the page is closed)
  function save() {
    const g = game(); G.map = curMap; G.x = Math.round(g.hero.x); G.y = Math.round(g.hero.y); G.dir = g.hero.dir;
    memSave = JSON.stringify(G);
    try { localStorage.setItem(SAVE_KEY, memSave); } catch (e) {}
  }
  function loadSave() { let s = memSave; try { s = localStorage.getItem(SAVE_KEY) || s; } catch (e) {} if (!s) return null; try { const o = JSON.parse(s); return o && o.v === 1 ? o : null; } catch (e) { return null; } }

  // ------------------------------------------------------------------ pictures
  const imgs = new Map();
  const img = src => { if (!imgs.has(src)) imgs.set(src, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('画像を読み込めません: ' + src)); im.src = src; })); return imgs.get(src); };

  // ------------------------------------------------------------------ widgets
  const KEY = e => ({ ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
                      z: 'ok', Z: 'ok', Enter: 'ok', ' ': 'ok', x: 'cancel', X: 'cancel', Escape: 'cancel', Backspace: 'cancel' })[e.key] || e.key;
  const top = () => ui[ui.length - 1];
  function push(o) { ui.push(o); return o; }
  function drop(o) { const i = ui.indexOf(o); if (i >= 0) ui.splice(i, 1); }
  // a list in a pane.  items: [{ label, r (text on the right), dim, help, ... }]
  function list(parent, items, opt) {
    opt = opt || {};
    const pane = el('div', 'pane hit ' + (opt.cls || '')); if (opt.id) pane.id = opt.id; if (opt.title) pane.appendChild(el('h4', '', opt.title));
    const box = el('div', 'list'); pane.appendChild(box); parent.appendChild(pane);
    let idx = clamp(opt.index || 0, 0, Math.max(0, items.length - 1));
    const move = () => { const it = o.items[idx]; if (opt.onMove) opt.onMove(it, idx); };
    const pick = () => { const it = o.items[idx]; if (!it) return; if (it.dim) { S.sfx('buzz'); if (opt.onDim) opt.onDim(it, idx); return; } if (!opt.quiet) S.sfx('ok'); opt.onPick(it, idx); };
    const o = { pane, items, get idx() { return idx; }, set idx(v) { idx = clamp(v, 0, Math.max(0, o.items.length - 1)); o.render(); },
      render() {
        box.innerHTML = '';
        o.items.forEach((it, i) => {
          const d = el('div', 'li' + (it.dim ? ' dim' : '') + (i === idx ? ' sel' : '') + (opt.small ? ' small' : ''), `<span>${it.label}</span>` + (it.r != null ? `<span class="r">${it.r}</span>` : ''));
          d.onclick = ev => { ev.stopPropagation(); if (top() !== o) return; if (idx !== i) { idx = i; o.render(); move(); } pick(); };
          box.appendChild(d);
        });
        if (!o.items.length) box.appendChild(el('div', 'li dim small', '<span>（何もない）</span>'));
        const s = box.children[idx]; if (s && opt.scroll) s.scrollIntoView({ block: 'nearest' });
      },
      key(e) {
        const k = KEY(e), n = o.items.length;
        if ((k === 'up' || k === 'down') && n) { idx = (idx + (k === 'up' ? n - 1 : 1)) % n; S.sfx('cursor'); o.render(); move(); }
        else if (k === 'ok') pick();
        else if (k === 'cancel' && opt.onCancel) { S.sfx('cancel'); opt.onCancel(); }
        else if (opt.onKey) opt.onKey(k, o.items[idx], idx);
      },
      set(items2, keep) { o.items = items2; idx = keep ? clamp(idx, 0, Math.max(0, items2.length - 1)) : 0; o.render(); move(); },
      focus() { move(); }, close() { pane.remove(); drop(o); } };
    if (opt.scroll) { box.style.maxHeight = `calc(${opt.scroll} * var(--u))`; box.style.overflow = 'hidden'; }
    push(o); o.render(); move(); return o;
  }
  // a short line in the parchment box; goes away by itself (ms) or on a key
  let noticeEl = null;
  function notice(text, opt) {
    opt = opt || {};
    return new Promise(res => {
      if (!noticeEl) { noticeEl = el('div', 'parch hit'); noticeEl.id = 'notice'; root.appendChild(noticeEl); }
      noticeEl.textContent = text; noticeEl.classList.toggle('top', !!opt.top); noticeEl.classList.add('on');
      let done = false, timer = 0;
      const o = { key(e) { const k = KEY(e); if (k === 'ok' || k === 'cancel') end(); } };
      const end = () => { if (done) return; done = true; clearTimeout(timer); noticeEl.onclick = null; if (!opt.keep) noticeEl.classList.remove('on'); drop(o); res(); };
      if (!opt.passive) push(o);
      noticeEl.onclick = end;
      if (opt.ms) timer = setTimeout(end, opt.ms);
    });
  }
  const hideNotice = () => noticeEl && noticeEl.classList.remove('on');
  // a question with a few answers -> index, or -1 when cancelled
  function choose(text, options, opt) {
    opt = opt || {};
    return new Promise(res => {
      if (!noticeEl) { noticeEl = el('div', 'parch hit'); noticeEl.id = 'notice'; root.appendChild(noticeEl); }
      noticeEl.textContent = text; noticeEl.classList.remove('top'); noticeEl.classList.add('on'); noticeEl.onclick = null;
      const end = v => { l.close(); hideNotice(); res(v); };
      const l = list(root, options.map(o => typeof o === 'string' ? { label: o } : o), { id: 'choice', onPick: (it, i) => end(i), onCancel: () => end(-1) });
    });
  }
  function helpbar(parent, keys) {
    const b = el('div', 'helpbar', '<span class="t"></span><span class="keys"></span>'); parent.appendChild(b);
    b.querySelector('.keys').innerHTML = keys || '<span><b class="keycap">Z</b>決める</span><span class="hit back"><b class="keycap">X</b>もどる</span>';
    const back = b.querySelector('.back'); if (back) back.onclick = ev => { ev.stopPropagation(); const t = top(); if (t) t.key({ key: 'Escape' }); };
    return { el: b, set(t) { b.querySelector('.t').textContent = t || ''; } };
  }
  // the four party members as cards (menus)
  function cards(parent) {
    const box = el('div', 'cards hit'); parent.appendChild(box); let sel = -1, onClick = null;
    const o = { el: box, render() {
      box.innerHTML = '';
      D.order.forEach((id, i) => {
        const p = G.party[id], s = stats(id), c = el('div', 'card' + (i === sel ? ' sel' : ''));
        c.innerHTML = `<canvas width="96" height="128"></canvas><span class="nm">${D.chars[id].name}</span><span class="lv">Lv ${p.lv}</span><span class="row">${p.row === 'front' ? '前の列' : '後ろの列'}</span>
          <div class="bars"><div><span class="k">HP</span>${p.hp}<span class="max"> / ${s.mhp}</span><span class="bar${p.hp < s.mhp * .3 ? ' low' : ''}"><i style="width:${100 * p.hp / s.mhp}%"></i></span></div>
          <div><span class="k">MP</span>${p.mp}<span class="max"> / ${s.mmp}</span><span class="bar mp"><i style="width:${s.mmp ? 100 * p.mp / s.mmp : 0}%"></i></span></div></div>`;
        img(D.chars[id].sprite + '.png').then(im => { const x = c.querySelector('canvas').getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, 96, 128, 0, 0, 96, 128); });
        c.onclick = ev => { ev.stopPropagation(); if (onClick) onClick(i); };
        box.appendChild(c);
      });
    }, set sel(v) { sel = v; o.render(); }, get sel() { return sel; }, set onClick(f) { onClick = f; } };
    o.render(); return o;
  }
  // choose one of the four on the cards -> index or -1
  function pickChar(cd, start) {
    return new Promise(res => {
      cd.sel = start || 0;
      const end = v => { drop(o); cd.onClick = null; if (v < 0) cd.sel = -1; res(v); };
      const o = push({ key(e) { const k = KEY(e); if (k === 'up' || k === 'down') { cd.sel = (cd.sel + (k === 'up' ? 3 : 1)) % 4; S.sfx('cursor'); } else if (k === 'ok') { S.sfx('ok'); end(cd.sel); } else if (k === 'cancel') { S.sfx('cancel'); end(-1); } } });
      cd.onClick = i => { cd.sel = i; S.sfx('ok'); end(i); };
    });
  }

  // ------------------------------------------------------------------ fades and map changes
  const fade = $('fade');
  async function fadeOut(ms) { fade.classList.add('fast'); fade.classList.remove('off'); await wait(ms || 300); }
  async function fadeIn() { fade.classList.remove('off'); void fade.offsetWidth; fade.classList.add('off'); await wait(300); fade.classList.remove('fast'); }
  async function changeMap(name, at, quiet) {
    busy = true; const g = game(); g.paused = true;
    await fadeOut(300); $('loading').classList.remove('off');
    await g.loadMap(name + '/map.json', at);
    $('loading').classList.add('off'); g.paused = false; busy = false;
    if (!quiet) g.announce(250, 3400);
    await fadeIn();
  }

  // ------------------------------------------------------------------ the field
  async function onMap(M) {
    const g = game(); curMap = g.mapUrl.split('/')[0]; mapProps = [];
    if (G) G.map = curMap;
    for (const t of M.triggers) {
      if (t.kind === 'chest' && G && G.flags[t.id]) t.hidden = true;
      if (t.kind === 'spot' && G && G.flags[t.id]) t.hidden = true;
      if (t.kind === 'dig' && G && G.flags[t.id]) { t.kind = null; t.text = ['もう、何もない']; t.prompt = null; }
      if (!t.prop) continue;
      const pr = t.prop;
      img(pr.src.replace(/^~\//, '')).then(im => {
        if (game().map !== M) return;
        const fw = pr.fw || 96, fh = pr.fh || 128;
        const q = g.addProp({ img: im, x: t.x + (pr.dx || 0), y: t.y + (pr.dy || 0), fw, fh, foot: pr.foot || [48, 120], body: pr.body || (t.kind === 'npc' ? 76 : fh - 10), block: pr.block, shadow: pr.shadow, frame: t.kind === 'chest' && G && G.flags[t.id] ? 1 : 0, bob: pr.bob });
        t.propObj = q; mapProps.push(q);
      }).catch(e => console.warn(e));
    }
    if (started) S.bgm(M.bgm);
    if (!started) startScreen();
  }
  function near(M) { const g = game(), n = M.encounter.near; return n && Math.hypot(g.hero.x - n[0], g.hero.y - n[1]) < n[2]; }
  function onStep(d) {
    const g = game(), M = g.map; if (!G || busy || !M.encounter || Q.get('enc') === '0') return;
    G.steps += d / 36;
    if (G.steps < G.next) return;
    G.steps = 0; G.next = Math.round(ri(15, 35) * (D.passives.shinobi && hasPassive('shinobi') ? 1.2 : 1));
    const T = D.encounters[M.encounter.table], pool = T.groups.filter(q => !q.far || !near(M));
    let r = Math.random() * pool.reduce((a, q) => a + q.w, 0), pickG = pool[0];
    for (const q of pool) { r -= q.w; if (r <= 0) { pickG = q; break; } }
    battle(pickG.m, T);
  }
  async function battle(group, T) {
    if (busy) return; busy = true; const g = game(); g.paused = true;
    S.sfx('encounter'); S.bgm(T.bgm, { fade: .15, in: .05, restart: true });
    await window.BATTLE.transition();
    g.paused = 'cover';
    const r = await window.BATTLE.run(env, { group, bg: T.bg });
    if (r === 'lose') { await gameOver(); return; }
    S.bgm(g.map.bgm, { fade: .4 });
    g.paused = false; busy = false;
  }
  async function gameOver() {
    const g = game();
    const s = loadSave(); if (s) G = s; else newGame();
    S.volume('bgm', G.set.bgm); S.volume('sfx', G.set.sfx);
    busy = false; await changeMap(G.map, s && s.x != null ? { x: s.x, y: s.y, dir: s.dir } : { spawn: D.start.spawn });
  }
  async function getChest(id, opened) {
    const c = D.chests[id]; G.flags[id] = 1;
    for (const [it, n] of c.give || []) {
      const got = give(it, n), nm = D.items[it].name + (n > 1 ? '×' + n : '');
      S.sfx('get'); await notice(got ? (opened ? `${nm}を\n手に入れた！` : `物かげに、何かある。\n${nm}を手に入れた`) : `${D.items[it].name}は、\nこれ以上持てない`);
    }
    if (c.gold) { G.gold += c.gold; S.sfx('coin'); await notice(`お金を${c.gold}枚、\n手に入れた！`); }
  }
  function onTrigger(t) {
    if (!G || busy) return true;
    const g = game();
    const run = async f => { busy = true; g.paused = true; try { await f(); } finally { g.paused = false; busy = false; } };
    if (t.kind === 'npc') {
      const n = D.npcs[t.id], k = G.talk[t.id] || 0, lines = n.lines[Math.min(k, n.lines.length - 1)]; G.talk[t.id] = k + 1;
      g.say(lines, n.name, () => { if (n.shop) run(() => shop(n.shop)); else if (n.inn) run(inn); });
      return true;
    }
    if (t.kind === 'shop') { S.sfx('door'); run(() => shop(t.shop)); return true; }
    if (t.kind === 'inn') { run(inn); return true; }
    if (t.kind === 'chest') { run(async () => { S.sfx('chest'); if (t.propObj) t.propObj.frame = 1; t.hidden = true; await wait(450); await getChest(t.id, true); }); return true; }
    if (t.kind === 'spot') { run(async () => { S.sfx('glint'); t.hidden = true; await wait(200); await getChest(t.id, false); }); return true; }
    if (t.kind === 'dig') { run(async () => { await notice('一本杉の根もとを、\nほってみた…'); S.sfx('get'); G.flags[t.id] = 1; give('spoon', 1); await notice('さびたスプーンを\n手に入れた'); t.kind = null; t.text = ['もう、何もない']; t.prompt = null; }); return true; }
    if (t.kind === 'crystal') { run(() => crystal(t)); return true; }
    if (t.kind === 'jump') { run(async () => { await fadeOut(200); S.sfx('thud'); g.teleport(t.to[0], t.to[1], 'down'); await fadeIn(); }); return true; }
    if (t.kind === 'warp') { (async () => { busy = true; g.paused = true; const a = await choose(t.ask, [t.prompt, 'やめる']); g.paused = false; busy = false; if (a === 0) { S.sfx('step'); changeMap(t.to, { spawn: t.spawn }); } })(); return true; }
    return false;
  }
  async function inn() {
    const a = await choose('休んでいく？', ['休む', 'やめる']); if (a !== 0) return;
    await fadeOut(600); S.sfx('rest'); healAll(); await wait(1500); await fadeIn();
    await notice('4人は、ぐっすり休んだ。\nHPとMPが全部もどった');
  }
  async function crystal(t) {
    const opts = ['書きとめる']; if (count('tent')) opts.push('テントで休む'); opts.push('やめる');
    const a = await choose('セーブ結晶だ。\n旅を書きとめる？', opts);
    if (opts[a] === '書きとめる') { save(); S.sfx('save'); await notice('ここまでの旅を、\n書きとめた'); }
    else if (opts[a] === 'テントで休む') { take('tent'); await fadeOut(600); S.sfx('rest'); healAll(); await wait(1500); await fadeIn(); await notice('4人は、テントで休んだ。\nHPとMPが全部もどった'); }
  }
  function onExit(e) {
    if (!G || busy) return;
    const g = game();
    if (e.closed) { g.say(e.closed, ''); return; }
    S.sfx('step'); changeMap(e.to, { spawn: e.spawn });
  }
  function onKey(e, down) {
    if (!down) return false;
    if (ui.length) { if (!e.repeat || /^Arrow/.test(e.key)) top().key(e); return true; }
    if (busy) return true;
    const g = game(); if (!g || g.loading || !started) return !started;
    if (!g.dialog && (e.key === 'x' || e.key === 'X' || e.key === 'Escape')) { if (!e.repeat) menu(); return true; }
    return false;
  }

  // ------------------------------------------------------------------ start screen
  function startScreen() {
    const g = game(); g.paused = true;
    const sc = el('div', 'hit'); sc.id = 'start';
    sc.innerHTML = '<div class="t1">The first slice</div><div class="t2">麦の丘の一区切り</div><div class="t3">始まりの村から、崖の修道院の入口まで</div>';
    root.appendChild(sc);
    const has = !!loadSave();
    const l = list(sc, [{ label: 'はじめから' }, { label: 'つづきから', dim: !has }], { onPick: async (it, i) => {
      l.close(); S.bgm(null);
      if (i === 1) { G = loadSave(); S.volume('bgm', G.set.bgm); S.volume('sfx', G.set.sfx); started = true; sc.remove(); await changeMap(G.map, { x: G.x, y: G.y, dir: G.dir }); }
      else { newGame(); started = true; await fadeOut(350); sc.remove(); S.bgm(g.map.bgm); g.paused = false; g.announce(300, 3600); await fadeIn(); }
      hud();
    } });
    sc.appendChild(el('div', 'note', '<b class="keycap">← ↑ ↓ →</b>歩く　<b class="keycap">Shift</b>走る　<b class="keycap">Z</b>決める・話す　<b class="keycap">X</b>メニュー・もどる<br>戦いの中：<b class="keycap">R</b>リピート　<b class="keycap">F</b>倍速'));
    S.bgm('bgm01');
  }
  function hud() {
    if ($('fieldhint')) return;
    const h = el('div', '', '<span><b class="keycap">X</b>メニュー</span><span><b class="keycap">Z</b>調べる・話す</span><span><b class="keycap">Shift</b>走る</span>'); h.id = 'fieldhint'; root.appendChild(h);
    if (matchMedia('(pointer: coarse)').matches) { const b = el('button', 'hit', 'メニュー'); b.id = 'menubtn'; b.onclick = ev => { ev.stopPropagation(); if (!ui.length && !busy && !game().dialog) menu(); }; root.appendChild(b); h.style.display = 'none'; }
  }

  // ------------------------------------------------------------------ main menu
  function menu() {
    const g = game(); g.paused = true; S.sfx('open'); if ($('title')) $('title').classList.remove('on');
    const m = el('div', 'hit'); m.id = 'menu'; root.appendChild(m);
    const where = el('div', 'where'); m.appendChild(where);
    const paintWhere = () => where.innerHTML = `<b>${g.map.title}</b>お金<span class="g">${G.gold}</span>枚`;
    const hb = helpbar(m), cd = cards(m); paintWhere();
    const close = () => { main.close(); m.remove(); g.paused = false; };
    const canSave = g.map.save === 'any';
    const main = list(m, [
      { label: 'どうぐ', help: '持っている物を見る・使う', f: items }, { label: 'そうび', help: '武器やよろいをつけかえる', f: equip }, { label: 'つよさ', help: '4人の今の力と、覚えた技を見る', f: status },
      { label: 'ならび', help: '前の列と後ろの列を入れかえる', f: rows }, { label: 'せってい', help: '音の大きさと、戦いの速さを変える', f: settings },
      { label: 'セーブ', help: canSave ? 'ここまでの旅を書きとめる' : 'ダンジョンの中では、セーブ結晶でだけ書きとめられる', dim: !canSave, f: doSave },
    ], { cls: 'cmds', onMove: it => hb.set(it.help), onPick: it => it.f(), onCancel: close });

    async function items() {
      const mk = () => Object.keys(G.items).filter(k => count(k) > 0).map(k => ({ label: D.items[k].name, r: '×' + count(k), id: k, help: D.items[k].help, dim: D.items[k].kind !== 'use' }));
      const l = list(m, mk(), { cls: 'sub', title: 'どうぐ', scroll: 700, onMove: it => hb.set(it ? it.help : ''), onCancel: () => { l.close(); main.focus(); },
        onPick: async it => {
          const i = await pickChar(cd, 0); if (i < 0) return;
          const id = D.order[i], p = G.party[id], s = stats(id), d = D.items[it.id];
          if (d.heal && p.hp > 0 && p.hp < s.mhp) { const n = Math.min(d.heal, s.mhp - p.hp); p.hp += n; take(it.id); S.sfx('heal'); cd.render(); await notice(`${D.chars[id].name}のHPが、\n${n}回復した`, { ms: 1200 }); }
          else { S.sfx('buzz'); await notice('使っても、何も起きない', { ms: 1000 }); }
          cd.sel = -1; l.set(mk(), true);
        } });
    }
    async function equip() {
      const i = await pickChar(cd, 0); if (i < 0) return;
      const id = D.order[i], p = G.party[id];
      const slots = () => D.SLOTS.filter(([sl]) => sl !== 'shield' || id === 'teto').map(([sl, nm]) => ({ label: `<span style="color:var(--gold);font-size:.6em;letter-spacing:.2em;margin-right:1em">${nm}</span>${p.equip[sl] ? D.items[p.equip[sl]].name : '―'}`, slot: sl,
        help: p.equip[sl] ? D.items[p.equip[sl]].help : 'つけている物はない' }));
      const l = list(m, slots(), { cls: 'sub', title: D.chars[id].name + ' のそうび', onMove: it => hb.set(it.help), onCancel: () => { l.close(); cd.sel = -1; main.focus(); },
        onPick: it => {
          const sl = it.slot, cand = Object.keys(G.items).filter(k => { const d = D.items[k]; return d.kind === 'gear' && d.slot === sl && (!d.user || d.user === id) && count(k) > 0; });
          const opts = cand.map(k => ({ label: D.items[k].name, id: k, help: D.items[k].help, r: gearNum(D.items[k]) })); if (p.equip[sl] && sl !== 'weapon') opts.push({ label: 'はずす', id: null, help: 'つけている物をはずす' });
          if (!opts.length) { S.sfx('buzz'); hb.set('つけかえられる物を、持っていない'); return; }
          const l2 = list(m, opts, { cls: 'sub', title: 'どれをつける？', onMove: o => hb.set(o.help), onCancel: () => { l2.close(); l.focus(); }, onPick: o => {
            const old = p.equip[sl]; if (old) give(old, 1);
            if (o.id) { take(o.id); p.equip[sl] = o.id; } else delete p.equip[sl];
            if (sl === 'weapon') { const wt = D.items[o.id].wtype; if (wt === 'great' && p.equip.shield) { give(p.equip.shield, 1); delete p.equip.shield; } }
            if (sl === 'shield' && p.equip.weapon && D.items[p.equip.weapon].wtype === 'great') { give(p.equip.shield, 1); delete p.equip.shield; S.sfx('buzz'); hb.set('大剣の時は、盾を持てない'); }
            const s = stats(id); p.hp = Math.min(p.hp, s.mhp); p.mp = Math.min(p.mp, s.mmp);
            l2.close(); l.set(slots(), true); cd.render();
          } });
          l2.pane.style.top = 'calc(420 * var(--u))';
        } });
    }
    const gearNum = d => [d.atk ? 'こうげき ' + d.atk : '', d.mag ? '術 ' + d.mag : '', d.healp ? '回復 ' + d.healp : '', d.def ? '守り ' + d.def : ''].filter(Boolean).join('　');
    async function status() {
      let i = await pickChar(cd, 0); if (i < 0) return;
      const pane = el('div', 'pane info'); m.appendChild(pane);
      const paint = () => {
        const id = D.order[i], p = G.party[id], s = stats(id), sk = skillsOf(id);
        pane.innerHTML = `<div class="big">${D.chars[id].name}　<span style="font-family:var(--latin);color:var(--gold)">Lv ${p.lv}</span></div>
          <table><tr><td>HP</td><td class="n">${p.hp} / ${s.mhp}</td><td>MP</td><td class="n">${p.mp} / ${s.mmp}</td></tr>
          <tr><td>こうげき</td><td class="n">${s.str + s.atk}</td><td>守り</td><td class="n">${s.def + s.arm}</td></tr>
          <tr><td>術の力</td><td class="n">${s.int + s.mag}</td><td>すばやさ</td><td class="n">${s.spd}</td></tr>
          <tr><td>器用さ</td><td class="n">${s.dex}</td><td>次のLvまで</td><td class="n">${expNext(p.lv) - p.exp}</td></tr></table>
          <div class="lab">覚えた技と術</div>${sk.length ? sk.map(q => `${q.name}　<span style="color:var(--paper-dim);font-size:.8em">MP ${q.mp}　${q.help}</span>`).join('<br>') : '<span style="color:var(--paper-dim)">まだ、何も覚えていない</span>'}
          ${id === 'pamp' ? '<br>ぬすむ　<span style="color:var(--paper-dim);font-size:.8em">魔物の持ち物をぬすむ。前の列のほうが成功しやすい</span>' : ''}`;
        cd.sel = i; hb.set('↑ ↓ で、人を切りかえる');
      };
      paint();
      const o = push({ key(e) { const k = KEY(e); if (k === 'up' || k === 'down') { i = (i + (k === 'up' ? 3 : 1)) % 4; S.sfx('cursor'); paint(); } else if (k === 'cancel' || k === 'ok') { S.sfx('cancel'); drop(o); pane.remove(); cd.sel = -1; cd.onClick = null; main.focus(); } } });
      cd.onClick = n => { i = n; paint(); };
    }
    async function rows() {
      hb.set('列を入れかえる人をえらぶ。前の列は、殴りが強く、ねらわれやすい');
      for (let i = 0; ;) { i = await pickChar(cd, i); if (i < 0) break; const p = G.party[D.order[i]]; p.row = p.row === 'front' ? 'back' : 'front'; cd.render(); }
      main.focus();
    }
    function settings() {
      const pct = v => Math.round(v * 10), mk = () => [{ label: '音楽の大きさ', r: '◀ ' + pct(G.set.bgm) + ' ▶', k: 'bgm', help: '← → で変える' }, { label: '効果音の大きさ', r: '◀ ' + pct(G.set.sfx) + ' ▶', k: 'sfx', help: '← → で変える' },
        { label: '戦いの速さ', r: G.set.speed === 2 ? '倍速' : 'ふつう', k: 'speed', help: '戦いの動きを2倍の速さにする' }];
      const ch = (it, dir) => { if (it.k === 'speed') G.set.speed = G.set.speed === 2 ? 1 : 2; else { G.set[it.k] = clamp(Math.round((G.set[it.k] + dir * .1) * 10) / 10, 0, 1); S.volume(it.k, G.set[it.k]); } S.sfx('cursor'); l.set(mk(), true); };
      const l = list(m, mk(), { cls: 'sub', title: 'せってい', quiet: true, onMove: it => hb.set(it.help), onCancel: () => { l.close(); main.focus(); }, onPick: it => ch(it, 1), onKey: (k, it) => { if (k === 'left') ch(it, -1); if (k === 'right') ch(it, 1); } });
    }
    async function doSave() { save(); S.sfx('quill'); await notice('ここまでの旅を、\n書きとめた', { ms: 1400 }); }
  }

  // ------------------------------------------------------------------ shop
  function shop(id) {
    return new Promise(res => {
      const sh = D.shops[id], m = el('div', 'hit'); m.id = 'shop'; root.appendChild(m);
      m.appendChild(el('div', 'name', sh.name)); const gd = el('div', 'gold'); m.appendChild(gd);
      const gold = () => gd.innerHTML = `お金<b>${G.gold}</b>枚`; gold();
      const hb = helpbar(m), cd = cards(m); cd.el.style.top = 'calc(96 * var(--u))';
      const main = list(m, [{ label: '買う', help: '品をえらんで買う' }, { label: '売る', help: '持っている物を売る' }, { label: 'やめる', help: '店を出る' }], { cls: 'cmds', onMove: it => hb.set(it.help), onCancel: () => { main.close(); m.remove(); res(); },
        onPick: (it, i) => { if (i === 2) { main.close(); m.remove(); res(); } else if (i === 0) buy(); else sell(); } });
      const owned = k => count(k) + D.order.filter(c => Object.values(G.party[c].equip).includes(k)).length;
      function buy() {
        const mk = () => sh.items.map(k => ({ label: D.items[k].name, r: `${D.items[k].price}枚　<span style="font-size:.8em">持っている数 ${owned(k)}</span>`, id: k, dim: G.gold < D.items[k].price || count(k) >= 10,
          help: D.items[k].help + (D.items[k].kind === 'gear' && gearInfo(D.items[k]) ? '　' + gearInfo(D.items[k]) : '') }));
        const l = list(m, mk(), { cls: 'goods', title: '買う', quiet: true, onMove: it => hb.set(it.help), onCancel: () => { l.close(); main.focus(); },
          onDim: it => hb.set(count(it.id) >= 10 ? 'これ以上は、持てない' : 'お金が足りない'),
          onPick: it => { G.gold -= D.items[it.id].price; give(it.id, 1); S.sfx('coin'); gold(); l.set(mk(), true); hb.set(`${D.items[it.id].name}を買った`); } });
      }
      const gearInfo = d => [d.atk ? 'こうげき ' + d.atk : '', d.mag ? '術 ' + d.mag : '', d.healp ? '回復 ' + d.healp : '', d.def ? '守り ' + d.def : ''].filter(Boolean).join('　');
      function sell() {
        const price = d => d.sell != null ? d.sell : Math.floor((d.price || 0) / 2);
        const mk = () => Object.keys(G.items).filter(k => count(k) > 0).map(k => ({ label: D.items[k].name, r: `${price(D.items[k])}枚　<span style="font-size:.8em">×${count(k)}</span>`, id: k, help: D.items[k].help }));
        const l = list(m, mk(), { cls: 'goods', title: '売る', quiet: true, scroll: 700, onMove: it => hb.set(it ? it.help : '売れる物を、持っていない'), onCancel: () => { l.close(); main.focus(); },
          onPick: it => { const n = price(D.items[it.id]); G.gold += n; take(it.id); S.sfx('coin'); gold(); l.set(mk(), true); hb.set(`${n}枚で売った`); } });
      }
    });
  }

  // what battle.js needs from here
  const env = { get G() { return G; }, D, S, el, root, ui, push, drop, top, list, notice, hideNotice, helpbar, KEY, stats, skillsOf, hasPassive, give, take, count, gainExp, img, rnd, ri, clamp, wait };
  const api = { startMap: Q.get('map') || 'village/map.json', onMap, onStep, onTrigger, onExit, onKey, env,
    get G() { return G; }, get busy() { return busy; }, get ui() { return ui; }, get started() { return started; },
    // for tests and for trying things out: RPG.debug.battle(['mn001','mn005'])
    debug: { battle: (g, table) => battle(g, D.encounters[table || 'f01']), newGame, healAll, give, go: (name, at) => changeMap(name, at), save, menu, shop,
             lv(n) { for (const id of D.order) { G.party[id].lv = n; } healAll(); } } };
  return api;
})();
