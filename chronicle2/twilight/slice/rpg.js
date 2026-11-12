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
          steps: 0, next: 60, time: 0, wins: 0, set: { speed: 1, dash: false, bgm: S.vol.bgm, sfx: S.vol.sfx } };
    for (const id of D.order) { const c = D.chars[id]; G.party[id] = { lv: 1, exp: 0, row: c.row, equip: Object.assign({}, c.equip), hp: 1, mp: 0 }; const s = stats(id); G.party[id].hp = s.mhp; G.party[id].mp = s.mmp; }
  }
  const count = it => G.items[it] || 0;
  const MAX = 99;                                     // of one kind in the bag (the old game's number)
  function give(it, n) { const have = count(it), add = Math.min(n, MAX - have); if (add > 0) G.items[it] = have + add; return add; }
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
  // ------------------------------------------------------------------ gear (the old game's rules: screens/equip.js itemDiff, shop.js)
  const VALS = [['atk', 'こうげき'], ['mag', '術'], ['healp', '回復'], ['def', '守り'], ['steal', 'ぬすみ']];
  const KIND = { sword: '片手剣', great: '大剣', staff: '杖', book: '本', dagger: '短剣', bow: '弓', holy: '聖杖', mace: 'メイス' };
  const slotName = sl => (D.SLOTS.find(q => q[0] === sl) || [0, sl])[1];
  const isGear = it => !!D.items[it] && D.items[it].kind === 'gear';
  const canWear = (id, it) => { const d = D.items[it]; return isGear(it) && (!d.user || d.user === id) && (d.slot !== 'shield' || id === 'teto'); };
  const twoHand = it => !!it && !!D.items[it] && D.items[it].wtype === 'great';
  const gearText = d => VALS.filter(([k]) => d[k]).map(([k, n]) => n + ' ' + d[k]).join('　');
  const power = it => { const d = D.items[it]; return d ? (d.atk || 0) + (d.mag || 0) + (d.healp || 0) + (d.def || 0) : 0; };
  const wornBy = it => D.order.filter(c => Object.values(G.party[c].equip).includes(it));
  // the item's own numbers against what is worn in that slot now -> [{ k, name, before, after, d }]
  // (a two-handed weapon also takes the shield off, so the shield's numbers go too)
  function itemDiff(id, sl, it) {
    const p = G.party[id], cur = D.items[p.equip[sl]], nw = D.items[it], sh = sl === 'weapon' && twoHand(it) && p.equip.shield ? D.items[p.equip.shield] : null;
    return VALS.map(([k, name]) => { const before = (cur && cur[k] || 0) + (sh && sh[k] || 0), after = nw && nw[k] || 0; return { k, name, before, after, d: after - before }; }).filter(r => r.before || r.after);
  }
  const diffHtml = r => r.d > 0 ? `<b class="up">▲+${r.d}</b>` : r.d < 0 ? `<b class="down">▼−${-r.d}</b>` : '<b class="eq">±0</b>';
  const bestDelta = rows => rows.filter(r => r.d).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0] || null;
  function putOn(id, sl, it) {          // it = null takes the thing off.  -> { ok, note }
    const p = G.party[id];
    if (it && sl === 'shield' && twoHand(p.equip.weapon)) return { ok: false, note: '大剣の時は、盾を持てない' };
    const old = p.equip[sl]; if (old) give(old, 1);
    if (it) { take(it); p.equip[sl] = it; } else delete p.equip[sl];
    let note = null;
    if (sl === 'weapon' && twoHand(it) && p.equip.shield) { give(p.equip.shield, 1); delete p.equip.shield; note = '両手持ちなので盾を外した'; }
    const st = stats(id); p.hp = Math.min(p.hp, st.mhp); p.mp = Math.min(p.mp, st.mmp);
    return { ok: true, note };
  }
  // 満タン (the old game's R.Party.fullHeal): the healing spells first, the best HP per MP first, always on the one who
  // lacks most; if that is not enough, the cheapest healing items.  dry = only say what would be used.
  // -> { used: [{ who (member id or 'bag'), what, n }], healed: [id], short }
  function fullHeal(dry) {
    const P = dry ? JSON.parse(JSON.stringify(G.party)) : G.party, inv = dry ? Object.assign({}, G.items) : G.items;
    const st = {}; for (const id of D.order) st[id] = stats(id);
    const miss = id => P[id].hp > 0 ? st[id].mhp - P[id].hp : 0, hurt = () => D.order.filter(id => miss(id) > 0), worst = h => h.reduce((a, b) => miss(b) > miss(a) ? b : a);
    const healed = hurt(), used = {}, note = (who, what) => { const k = who + '|' + what; (used[k] = used[k] || { who, what, n: 0 }).n++; };
    for (let g = 0; g < 200; g++) {
      const h = hurt(); if (!h.length) break; let best = null; const t = worst(h);
      for (const c of D.order) { if (P[c].hp <= 0) continue;
        for (const sk of skillsOf(c)) { if (sk.kind !== 'heal' || sk.target !== 'ally' || sk.mp > P[c].mp) continue;
          const gain = Math.min(miss(t), Math.floor((st[c].int + st[c].healp) * sk.power)), eff = gain / Math.max(.5, sk.mp);
          if (gain > 0 && (!best || eff > best.eff + 1e-9)) best = { c, sk, gain, eff }; } }
      if (!best) break;
      P[best.c].mp -= best.sk.mp; P[t].hp += best.gain; note(best.c, best.sk.id);
    }
    const meds = Object.keys(inv).filter(k => D.items[k] && D.items[k].kind === 'use' && D.items[k].heal).sort((a, b) => (D.items[a].price || D.items[a].sell || 0) - (D.items[b].price || D.items[b].sell || 0));
    for (let g = 0; g < 400; g++) {
      const h = hurt(); if (!h.length) break; const t = worst(h), k = meds.find(q => (inv[q] || 0) > 0); if (!k) break;
      P[t].hp = Math.min(st[t].mhp, P[t].hp + D.items[k].heal); inv[k]--; if (!dry && inv[k] <= 0) delete inv[k]; note('bag', k);
    }
    return { used: Object.values(used), healed, short: hurt().length > 0 };
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
                      z: 'ok', Z: 'ok', Enter: 'ok', ' ': 'ok', x: 'cancel', X: 'cancel', Escape: 'cancel', Backspace: 'cancel',
                      c: 'menu', C: 'menu', Tab: 'menu', v: 'X', V: 'X', q: 'L', Q: 'L', e: 'R', E: 'R' })[e.key] || e.key;      // the keys of the old game: Z A, X B, C menu (Y), V the X button, Q / E for L / R
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
  // a small window in the middle: a title, a line of text and choices -> index (opt.cancel, or -1, when backed out).
  // rows: strings or { label, r, dim }
  function ask(title, text, rows, opt) {
    opt = opt || {};
    return new Promise(res => {
      const w = el('div', 'hit'); w.id = 'ask'; root.appendChild(w);
      const end = v => { l.close(); w.remove(); res(v); };
      const l = list(w, rows.map(r => typeof r === 'string' ? { label: r } : r), { cls: 'askp', title, index: opt.index || 0, onPick: (it, i) => end(i), onCancel: () => end(opt.cancel == null ? -1 : opt.cancel) });
      if (text) l.pane.insertBefore(el('div', 'askt', text), l.pane.querySelector('.list'));
    });
  }
  // a small window that only tells something: lines are strings or { text, r, cls }
  function note(title, lines) {
    return new Promise(res => {
      const w = el('div', 'hit'); w.id = 'ask'; root.appendChild(w);
      const pane = el('div', 'pane askp', `<h4>${title}</h4>` + lines.map(q => typeof q === 'string' ? `<div class="askl">${q}</div>` : `<div class="askl ${q.cls || ''}">${q.text}${q.r ? `<span class="r">${q.r}</span>` : ''}</div>`).join('')); w.appendChild(pane);
      const end = () => { drop(o); w.remove(); res(); }, o = push({ key(e) { const k = KEY(e); if (k === 'ok' || k === 'cancel') { S.sfx('cursor'); end(); } } });
      w.onclick = ev => { ev.stopPropagation(); end(); };
    });
  }
  // how many: ← → one, ↑ ↓ ten, L / R the least and the most -> n, 0 when backed out.  o: { name, unit, max, sell, cap: 'gold' | 'bag' | 'have' }
  function pickQty(o) {
    return new Promise(res => {
      const w = el('div', 'hit'); w.id = 'ask'; root.appendChild(w); const pane = el('div', 'pane askp qty'); w.appendChild(pane); let n = 1;
      const end = v => { drop(k); w.remove(); res(v); };
      const set = v => { v = clamp(v, 1, o.max); if (v !== n) { n = v; S.sfx('cursor'); paint(); } };
      const paint = () => {
        const tot = n * o.unit, cap = n >= o.max ? (o.cap === 'gold' ? '（所持金で買えるのはここまで）' : o.cap === 'bag' ? `（持てるのは ${MAX} 個まで）` : '（持っているのはここまで）') : '';
        pane.innerHTML = `<h4>${o.sell ? 'いくつ売る？' : 'いくつ買う？'}</h4><div class="askt">${o.name}<span class="u">${o.sell ? '売値' : '1つ'} ${o.unit}枚</span></div>
          <div class="num"><i data-d="-10">−10</i><i data-d="-1">◀</i><b>${n}</b><i data-d="1">▶</i><i data-d="10">＋10</i></div>
          <div class="capl">← →で1つ、↑ ↓で10ずつ、L・Rで最小・最大${cap}</div>
          <div class="tot">${o.sell ? '受け取り' : '合計'} <b>${tot}</b>枚<span>所持金 ${G.gold} → <b>${o.sell ? G.gold + tot : G.gold - tot}</b>枚</span></div>
          <div class="btns"><span class="btn ok">${o.sell ? '売る' : '買う'}</span><span class="btn no">やめる</span></div>`;
        pane.querySelectorAll('.num i').forEach(b => b.onclick = ev => { ev.stopPropagation(); set(n + (+b.dataset.d)); });
        pane.querySelector('.ok').onclick = ev => { ev.stopPropagation(); S.sfx('ok'); end(n); }; pane.querySelector('.no').onclick = ev => { ev.stopPropagation(); S.sfx('cancel'); end(0); };
      };
      const k = push({ key(e) { const c = KEY(e); if (c === 'left') set(n - 1); else if (c === 'right') set(n + 1); else if (c === 'up') set(n + 10); else if (c === 'down') set(n - 10); else if (c === 'L') set(1); else if (c === 'R') set(o.max);
        else if (c === 'ok') { S.sfx('ok'); end(n); } else if (c === 'cancel') { S.sfx('cancel'); end(0); } } });
      paint();
    });
  }
  // the pane that tells about one item: its numbers, the comparison with what one member wears (o.who), and what it would
  // do for the others.  o: { price, sell, who, remove (the comparison is with nothing), party: false, empty: text }
  function detail(parent) {
    const pane = el('div', 'pane detail'); parent.appendChild(pane);
    return { el: pane, show(it, o) {
      o = o || {}; const d = D.items[it];
      if (!d) { pane.innerHTML = `<div class="dh">${o.empty || ''}</div>`; return; }
      const gear = d.kind === 'gear', worn = wornBy(it).length;
      let h = `<div class="dn">${d.name}</div><div class="dk">${gear ? slotName(d.slot) + (d.wtype ? '・' + KIND[d.wtype] : '') : d.kind === 'mat' ? '売るための品' : '道具'}` + (o.price != null ? `<span>${o.sell ? '売値' : '値段'} <b>${o.price}</b>枚</span>` : '') + '</div>';
      if (gear && gearText(d)) h += `<div class="dv">${gearText(d)}</div>`;
      h += `<div class="dh">${d.help || ''}</div><div class="own">${count(it) ? '持っている ×' + count(it) : '持っていない'}${worn ? '（装備中 ' + worn + '）' : ''}</div>`;
      if (gear && o.who) {
        const rows = itemDiff(o.who, d.slot, o.remove ? null : it), same = !o.remove && G.party[o.who].equip[d.slot] === it;
        h += '<div class="lab">いまの装備と比べる</div>' + (same || !rows.some(r => r.d) ? '<div class="same">変わらない</div>' : '<table class="cmp">' + rows.map(r => `<tr><td>${r.name}</td><td class="n">${r.before} → ${r.after}</td><td>${diffHtml(r)}</td></tr>`).join('') + '</table>');
      }
      if (gear && o.party !== false && !o.remove) {
        h += `<div class="lab">${o.sell ? '仲間が付けると（売る前に）' : o.who ? 'ほかの仲間が付けると' : '仲間が付けると'}</div><div class="strip">` + D.order.filter(c => c !== o.who).map(c => {
          const can = canWear(c, it), rows = can ? itemDiff(c, d.slot, it).filter(r => r.d) : [];
          const t = !can ? '<span class="no">装備できない</span>' : G.party[c].equip[d.slot] === it ? '<span class="no">装備中</span>' : rows.length ? rows.map(r => `<span>${r.name} ${diffHtml(r)}</span>`).join('') : '<span><b class="eq">±0</b></span>';
          return `<div class="pc${can ? '' : ' off'}"><canvas width="48" height="48" data-c="${c}"></canvas><span class="nm">${D.chars[c].name}</span>${t}</div>`; }).join('') + '</div>';
      }
      pane.innerHTML = h;
      pane.querySelectorAll('canvas').forEach(cv => img(D.chars[cv.dataset.c].sprite + '.png').then(im => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 24, 38, 48, 48, 0, 0, 48, 48); }));
    } };
  }
  // "今すぐ装備する？" after buying gear (the old shop's offerEquip): everyone is listed, who cannot wear it cannot be chosen,
  // the cursor starts on the first who can.  -> true when somebody put it on
  async function offerEquip(k, left, say) {
    const d = D.items[k], sl = d.slot, wear = D.order.map(c => canWear(c, k)), room = D.order.map((c, i) => wear[i] && G.party[c].equip[sl] !== k);
    if (!room.some(Boolean) || count(k) < 1) return false;
    const rows = D.order.map((c, i) => { const nm = D.chars[c].name; if (!wear[i]) return { label: nm, r: '装備できない', dim: true }; if (!room[i]) return { label: nm, r: '装備中', dim: true };
      const ds = itemDiff(c, sl, k).filter(r => r.d); return { label: nm, r: ds.length ? ds.map(r => `${r.name} ${diffHtml(r)}`).join('　') : '<b class="eq">±0</b>' }; }).concat([{ label: '装備しない' }]);
    left = Math.min(left, count(k));
    const i = await ask(left > 1 ? `今すぐ装備する？（あと ${left} 個）` : '今すぐ装備する？', d.name, rows, { index: room.findIndex(Boolean), cancel: D.order.length });
    if (i < 0 || i >= D.order.length || !room[i]) return false;
    const r = putOn(D.order[i], sl, k);
    if (!r.ok) { S.sfx('buzz'); say(r.note || '付けられない'); return false; }
    S.sfx('ok'); say(`${D.chars[D.order[i]].name} が ${d.name} を付けた` + (r.note ? '（' + r.note + '）' : '')); return true;
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
    if (G && M.encounter) { G.steps = 0; G.next = encGap(M); }
    for (const t of M.triggers) {
      if (t.kind === 'chest' && G && G.flags[t.id]) t.hidden = true;
      if (t.kind === 'spot' && G && G.flags[t.id]) t.hidden = true;
      if (t.kind === 'dig' && G && G.flags[t.id]) { t.kind = null; t.text = ['もう、何もない']; t.prompt = null; }
      if (t.kind === 'npc' && !t.prompt) t.prompt = '話す';
      if (!t.prop) continue;
      const pr = t.prop;
      img(pr.src.replace(/^~\//, '')).then(im => {
        if (game().map !== M) return;
        const fw = pr.fw || 96, fh = pr.fh || 128;
        const q = g.addProp({ img: im, x: t.x + (pr.dx || 0), y: t.y + (pr.dy || 0), fw, fh, foot: pr.foot || [48, 120], body: pr.body || (t.kind === 'npc' ? 76 : fh - 10), block: pr.block, shadow: pr.shadow, frame: t.kind === 'chest' && G && G.flags[t.id] ? 1 : 0, bob: pr.bob, glow: t.kind === 'chest' && G && G.flags[t.id] ? null : pr.glow });
        t.propObj = q; mapProps.push(q);
      }).catch(e => console.warn(e));
    }
    if (started) S.bgm(M.bgm);
    if (!started) startScreen();
  }
  const encGap = M => Math.round((M.encounter.steps || 60) * rnd(.6, 1.4));
  function near(M) { const g = game(), n = M.encounter.near; return n && Math.hypot(g.hero.x - n[0], g.hero.y - n[1]) < n[2]; }
  function onStep(d) {
    const g = game(), M = g.map; if (!G || busy || !M.encounter || Q.get('enc') === '0') return;
    // How often: as in the old game, an average number of steps per place (a step = 36 dots; 60 in the open, fewer in a
    // dungeon), each gap drawn from 0.6 to 1.4 of it, and steps walked instead of run count 0.8.
    G.steps += d / 36 * (g.hero.running ? 1 : .8);
    if (G.steps < G.next) return;
    G.steps = 0; G.next = encGap(M);
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
    if (t.kind === 'chest') { run(async () => { S.sfx('chest'); if (t.propObj) { t.propObj.frame = 1; t.propObj.glow = null; } t.hidden = true; await wait(450); await getChest(t.id, true); }); return true; }
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
    if (!g.dialog && KEY(e) === 'menu') { if (!e.repeat) menu(); return true; }
    if (e.key === 'Escape') return true;
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
    sc.appendChild(el('div', 'note', '<b class="keycap">← ↑ ↓ →</b>歩く　<b class="keycap">Z</b>決める・話す　<b class="keycap">X</b>もどる・押しながら走る　<b class="keycap">C</b>メニュー<br>戦いの中：<b class="keycap">Q</b>リピート　<b class="keycap">E</b>戦闘の速さ'));
    S.bgm('bgm01');
  }
  const hintHtml = () => '<span><b class="keycap">C</b>メニュー</span><span><b class="keycap">Z</b>調べる・話す</span><span><b class="keycap">X</b>' + (G && G.set.dash ? '押しながら歩く' : '押しながら走る') + '</span>';
  function hud() {
    if ($('fieldhint')) { $('fieldhint').innerHTML = hintHtml(); return; }
    const h = el('div', '', hintHtml()); h.id = 'fieldhint'; root.appendChild(h);
    if (matchMedia('(pointer: coarse)').matches) { const b = el('button', 'hit', 'メニュー'); b.id = 'menubtn'; b.onclick = ev => { ev.stopPropagation(); if (!ui.length && !busy && !game().dialog) menu(); }; root.appendChild(b); h.style.display = 'none'; }
  }

  // ------------------------------------------------------------------ main menu
  function menu() {
    const g = game(); g.paused = true; S.sfx('open'); if ($('title')) $('title').classList.remove('on');
    const m = el('div', 'hit'); m.id = 'menu'; root.appendChild(m);
    const where = el('div', 'where'); m.appendChild(where);
    const paintWhere = () => where.innerHTML = `<b>${g.map.title}</b>お金<span class="g">${G.gold}</span>枚`;
    const hb = helpbar(m, '<span><b class="keycap">Z</b>決める</span><span class="hit back"><b class="keycap">X</b>もどる</span><span class="hit full"><b class="keycap">V</b>満タン</span>'), cd = cards(m); paintWhere();
    hb.el.querySelector('.full').onclick = ev => { ev.stopPropagation(); if (top() === main) doFull(); };
    const close = () => { main.close(); m.remove(); g.paused = false; };
    const canSave = g.map.save === 'any';
    const main = list(m, [
      { label: 'どうぐ', help: '持っている物を見る・使う', f: items }, { label: 'そうび', help: '武器やよろいをつけかえる', f: equip }, { label: 'つよさ', help: '4人の今の力と、覚えた技を見る', f: status },
      { label: 'ならび', help: '前の列と後ろの列を入れかえる', f: rows }, { label: 'せってい', help: '音の大きさと、戦いの速さを変える', f: settings },
      { label: 'セーブ', help: canSave ? 'ここまでの旅を書きとめる' : 'ダンジョンの中では、セーブ結晶でだけ書きとめられる', dim: !canSave, f: doSave },
    ], { cls: 'cmds', onMove: it => hb.set(it.help), onPick: it => it.f(), onCancel: close, onKey: k => { if (k === 'X') doFull(); else if (k === 'menu') { S.sfx('cancel'); close(); } } });
    let fullBusy = false;
    async function doFull() {              // 満タン: one button fills everybody's HP (texts and steps as in the old game's menu)
      if (fullBusy) return; fullBusy = true;
      try {
        const plan = fullHeal(true), what = k => (D.skills[k] || D.items[k]).name, line = x => ({ text: (x.who === 'bag' ? '' : D.chars[x.who].name + '：') + what(x.what), r: '× ' + x.n });
        if (!plan.healed.length) { S.sfx('buzz'); await note('満タン', ['みんな元気だ。']); return; }
        if (!plan.used.length) { S.sfx('buzz'); await note('満タン', ['回復の術も、使える薬もない。']); return; }
        if (plan.used.some(x => x.who === 'bag')) {
          const a = await ask('満タン', '術が足りないので、道具も使う。<br>' + plan.used.map(x => `<span class="askl">${line(x).text}<span class="r">${line(x).r}</span></span>`).join(''), ['使う', 'やめる'], { cancel: 1 });
          if (a !== 0) return;
        }
        const r = fullHeal(false); S.sfx('heal'); cd.render();
        await note('満タン', r.used.map(line).concat([{ text: r.healed.map(id => D.chars[id].name).join('・') + ' の HP が戻った。', cls: 'good' }], r.short ? [{ text: 'まだ回復しきれていない人がいる。', cls: 'warn' }] : []));
      } finally { fullBusy = false; main.focus(); }
    }

    async function items() {
      const mk = () => Object.keys(G.items).filter(k => count(k) > 0).map(k => ({ label: D.items[k].name, r: '×' + count(k), id: k, help: D.items[k].help, dim: D.items[k].kind !== 'use' }));
      const l = list(m, mk(), { cls: 'sub', title: 'どうぐ', scroll: 700, onMove: it => hb.set(it ? it.help : ''), onCancel: () => { l.close(); main.focus(); },
        onDim: it => hb.set(D.items[it.id].kind === 'gear' ? '「そうび」で付ける' : 'ここでは使えない'),
        onPick: async it => {                 // the choice of the person stays open after a use: decide again uses another, back returns
          const d = D.items[it.id];
          for (let i = 0; count(it.id) > 0;) {
            i = await pickChar(cd, i); if (i < 0) break;
            const id = D.order[i], p = G.party[id], st = stats(id);
            if (d.heal && p.hp > 0 && p.hp < st.mhp) { const n = Math.min(d.heal, st.mhp - p.hp); p.hp += n; take(it.id); S.sfx('heal'); cd.render(); cd.sel = i; hb.set(`${D.chars[id].name}のHPが、${n}回復した（のこり ×${count(it.id)}）`); }
            else { S.sfx('buzz'); hb.set('使っても、何も起きない'); }
          }
          cd.sel = -1; l.set(mk(), true);
        } });
    }
    // そうび (the old game's equip screen): the slots, the candidates strongest first, the comparison with what is worn,
    // what it would do for the others; L / R the next member, the X button "いちばん強く"
    async function equip() {
      let i = await pickChar(cd, 0); if (i < 0) return;
      const dt = detail(m); cd.el.style.display = 'none';
      const keys0 = hb.el.querySelector('.keys').innerHTML;
      hb.el.querySelector('.keys').innerHTML = '<span><b class="keycap">Z</b>選ぶ</span><span><b class="keycap">X</b>もどる</span><span><b class="keycap">V</b>いちばん強く</span><span><b class="keycap">Q</b><b class="keycap">E</b>次の仲間</span>';
      const who = () => D.order[i], P = () => G.party[who()];
      const slotRows = () => D.SLOTS.filter(([sl]) => sl !== 'shield' || who() === 'teto').map(([sl, nm]) => { const two = sl === 'shield' && twoHand(P().equip.weapon);
        return { slot: sl, dim: two, label: `<span class="sl">${nm}</span>${two ? '両手持ち' : P().equip[sl] ? D.items[P().equip[sl]].name : 'なし'}` }; });
      const title = () => { l.pane.querySelector('h4').textContent = D.chars[who()].name + ' の装備'; };
      const showSlot = it => { if (!it) return; const cur = P().equip[it.slot]; dt.show(cur, { party: false, empty: it.dim ? '両手持ちの武器を持っている。' : 'なし' }); hb.set(cur ? D.items[cur].help : it.dim ? '両手持ちの武器を持っている。' : '付けている物はない'); };
      const done = () => { l.close(); dt.el.remove(); cd.el.style.display = ''; cd.sel = -1; cd.render(); hb.el.querySelector('.keys').innerHTML = keys0; hb.el.querySelector('.full').onclick = ev => { ev.stopPropagation(); if (top() === main) doFull(); }; const bk = hb.el.querySelector('.back'); if (bk) bk.onclick = ev => { ev.stopPropagation(); const t = top(); if (t) t.key({ key: 'Escape' }); }; main.focus(); };
      const l = list(m, slotRows(), { cls: 'sub', title: ' ', onMove: showSlot, onCancel: done, onDim: () => hb.set('両手持ちの武器を持っている。'),
        onKey: k => { if (k === 'L' || k === 'R') { i = (i + (k === 'L' ? 3 : 1)) % 4; S.sfx('cursor'); title(); l.set(slotRows()); } else if (k === 'X') best(); },
        onPick: it => cands(it.slot) });
      title();
      function cands(sl) {
        const cur = P().equip[sl];
        const all = Object.keys(G.items).filter(k => count(k) > 0 && isGear(k) && D.items[k].slot === sl && canWear(who(), k) && k !== cur).concat(cur ? [cur] : []).sort((a, b) => power(b) - power(a));
        if (all.length <= (cur ? 1 : 0) && !(cur && sl !== 'weapon')) { S.sfx('buzz'); hb.set('付けられる物を持っていない'); return; }
        const opts = all.map(k => ({ id: k, cur: k === cur, label: D.items[k].name + (k === cur ? '<span class="worn">装備中</span>' : ''), r: k === cur ? '' : '×' + count(k) }));
        if (cur && sl !== 'weapon') opts.push({ id: null, label: '外す' });
        const l2 = list(m, opts, { cls: 'sub cand', title: slotName(sl) + ' の候補', index: Math.max(0, all.indexOf(cur)), quiet: true,
          onMove: o => { if (!o) return; if (o.id) { dt.show(o.id, { who: who() }); hb.set(D.items[o.id].help); } else { dt.show(cur, { who: who(), remove: true }); hb.set('付けている物を外す'); } },
          onCancel: () => { l2.close(); l.focus(); },
          onPick: o => {
            if (!o.cur) { const r = putOn(who(), sl, o.id); if (!r.ok) { S.sfx('buzz'); hb.set(r.note); return; } S.sfx('ok'); l2.close(); l.set(slotRows(), true); if (r.note) hb.set(r.note); }
            else { S.sfx('cancel'); l2.close(); l.focus(); }
          } });
      }
      async function best() {              // "いちばん強く": every slot but the trinket takes the strongest thing in the bag, after asking
        const c = who(), p = P(), bag = sl => Object.keys(G.items).filter(k => count(k) > 0 && isGear(k) && D.items[k].slot === sl && canWear(c, k));
        const topOf = (sl, cur) => bag(sl).reduce((a, k) => power(k) > power(a) ? k : a, cur || null), plan = [];
        const sh = c === 'teto' ? topOf('shield', p.equip.shield) : null, wv = k => k ? power(k) + (twoHand(k) ? 0 : power(sh)) : -1;
        const w = bag('weapon').reduce((a, k) => wv(k) > wv(a) ? k : a, p.equip.weapon || null);
        if (w !== p.equip.weapon) plan.push(['weapon', w]);
        for (const [sl] of D.SLOTS) { if (sl === 'weapon' || sl === 'acc' || (sl === 'shield' && (c !== 'teto' || twoHand(w)))) continue; const k = sl === 'shield' ? sh : topOf(sl, p.equip[sl]); if (k && k !== p.equip[sl]) plan.push([sl, k]); }
        if (!plan.length) { S.sfx('buzz'); await note('いちばん強く', ['いまの装備が、いちばん強い。']); l.focus(); return; }
        const a = await ask('いちばん強く', 'アクセサリは変えない。<br>' + plan.map(([sl, k]) => `<span class="askl">${slotName(sl)}：${p.equip[sl] ? D.items[p.equip[sl]].name : 'なし'} → ${D.items[k].name}</span>`).join(''), ['付け替える', 'やめる'], { cancel: 1 });
        if (a === 0) { for (const [sl, k] of plan) putOn(c, sl, k); S.sfx('ok'); }
        l.set(slotRows(), true);
      }
    }
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
    function settings() {            // the rows and their wording follow the old game
      const pct = v => Math.round(v * 10), SP = window.BATTLE.SPEEDS, SPN = window.BATTLE.SPEED_LABEL, pad = window.PAD;
      const mk = () => [{ label: '音楽の大きさ', r: '◀ ' + pct(G.set.bgm) + ' ▶', k: 'bgm', help: '← → で変える' }, { label: '効果音の大きさ', r: '◀ ' + pct(G.set.sfx) + ' ▶', k: 'sfx', help: '← → で変える' },
        { label: '戦闘の速さ', r: '◀ ' + SPN[window.BATTLE.speedOf(G.set.speed)] + ' ▶', k: 'speed', help: '戦闘の演出の速さ。戦闘中もRボタンで「通常→＋1→＋2→＋4」と切り替えられ、次の戦闘も同じ速さで始まる' },
        { label: '常にダッシュ', r: G.set.dash ? 'オン' : 'オフ', k: 'dash', help: 'オンにすると、Bを押している間だけ歩く' }]
        .concat(pad ? [{ label: '決定ボタンの位置', r: pad.confirm === 'down' ? '下' : '右', k: 'confirm', help: 'パッドで決定に使うボタンの位置' }] : []);
      const ch = (it, dir) => {
        if (it.k === 'speed') G.set.speed = SP[(SP.indexOf(window.BATTLE.speedOf(G.set.speed)) + (dir < 0 ? SP.length - 1 : 1)) % SP.length];
        else if (it.k === 'dash') { G.set.dash = !G.set.dash; hud(); }
        else if (it.k === 'confirm') pad.confirm = pad.confirm === 'down' ? 'right' : 'down';
        else { G.set[it.k] = clamp(Math.round((G.set[it.k] + dir * .1) * 10) / 10, 0, 1); S.volume(it.k, G.set[it.k]); }
        S.sfx('cursor'); l.set(mk(), true); };
      const l = list(m, mk(), { cls: 'sub', title: 'せってい', quiet: true, onMove: it => hb.set(it.help), onCancel: () => { l.close(); main.focus(); }, onPick: it => ch(it, 1), onKey: (k, it) => { if (k === 'left') ch(it, -1); if (k === 'right') ch(it, 1); } });
    }
    async function doSave() { save(); S.sfx('quill'); await notice('ここまでの旅を、\n書きとめた', { ms: 1400 }); }
  }

  // ------------------------------------------------------------------ shop (the old game's shop: screens/shop.js)
  // Tabs 武器 / 防具 / 道具 (those the shop stocks) and 売る, changed with L / R.  A row shows the name, "装備中", how many are
  // in the bag and the price; the pane on the right tells what the thing does and how much it would change for each
  // member.  Buying asks how many, and gear then asks "今すぐ装備する？" once per piece.  Selling asks how many when there
  // are two or more, and asks again for things no shop sells.  (Not taken over: sorting, the filter, selling junk in one go.)
  function shop(id) {
    return new Promise(res => {
      const sh = D.shops[id], m = el('div', 'hit'); m.id = 'shop'; root.appendChild(m);
      m.appendChild(el('div', 'name', sh.name)); const gd = el('div', 'gold'); m.appendChild(gd);
      const gold = () => gd.innerHTML = `所持金<b>${G.gold}</b>枚`; gold();
      const catOf = k => !isGear(k) ? 'item' : D.items[k].slot === 'weapon' ? 'weapon' : 'armor';
      const TABS = [['weapon', '武器'], ['armor', '防具'], ['item', '道具']].filter(([k]) => sh.items.some(q => catOf(q) === k)).concat([['sell', '売る']]);
      const tabs = el('div', 'tabs hit'); m.appendChild(tabs); let tab = 0, busy2 = false;
      const selling = () => TABS[tab][0] === 'sell';
      const hb = helpbar(m, '<span><b class="keycap">Z</b><i class="act">買う</i></span><span class="hit back"><b class="keycap">X</b>もどる</span><span><b class="keycap">Q</b><b class="keycap">E</b>切りかえ</span>'), dt = detail(m);
      const sellP = k => { const d = D.items[k]; return d.sell != null ? d.sell : Math.floor((d.price || 0) / 2); };
      const rows = () => selling()
        ? Object.keys(G.items).filter(k => count(k) > 0).map(k => ({ id: k, label: D.items[k].name, r: `<span class="n">×${count(k)}</span>${sellP(k)}枚` }))
        : sh.items.filter(k => catOf(k) === TABS[tab][0]).map(k => ({ id: k, label: `<span class="${isGear(k) && !D.order.some(c => canWear(c, k)) ? 'cant' : ''}">${D.items[k].name}</span>` + (wornBy(k).length ? '<span class="worn">装備中</span>' : ''),
            r: (count(k) ? `<span class="n">×${count(k)}</span>` : '') + `<span class="${G.gold < D.items[k].price ? 'poor' : ''}">${D.items[k].price}枚</span>` }));
      const paintTabs = () => { tabs.innerHTML = TABS.map(([k, n], i) => `<span class="${i === tab ? 'on' : ''}" data-i="${i}">${n}</span>`).join(''); tabs.querySelectorAll('span').forEach(q => q.onclick = ev => { ev.stopPropagation(); if (top() === l && !busy2) setTab(+q.dataset.i); });
        hb.el.querySelector('.act').textContent = selling() ? '売る' : '買う'; };
      const show = it => { if (!it) { dt.show(null, { empty: selling() ? '売れる物を持っていない。' : '並んでいる品がない。' }); return; } dt.show(it.id, { price: selling() ? sellP(it.id) : D.items[it.id].price, sell: selling() }); };
      const setTab = i => { tab = (i + TABS.length) % TABS.length; S.sfx('cursor'); paintTabs(); l.set(rows()); hb.set(''); };
      const refresh = () => { gold(); l.set(rows(), true); };
      const close = () => { l.close(); m.remove(); res(); };
      const l = list(m, rows(), { cls: 'goods', quiet: true, scroll: 760, onMove: show, onCancel: close,
        onKey: k => { if (k === 'L') setTab(tab - 1); else if (k === 'R') setTab(tab + 1); },
        onPick: async it => { if (busy2) return; busy2 = true; try { if (selling()) await doSell(it.id); else await doBuy(it.id); } finally { busy2 = false; } } });
      paintTabs();
      async function doBuy(k) {
        const d = D.items[k], byGold = Math.floor(G.gold / d.price), byBag = MAX - count(k);
        if (byGold < 1) { S.sfx('buzz'); hb.set('お金が足りない'); return; }
        if (byBag < 1) { S.sfx('buzz'); hb.set('これ以上は持てない'); return; }
        const n = await pickQty({ name: d.name, unit: d.price, max: Math.min(byGold, byBag), cap: byGold <= byBag ? 'gold' : 'bag' });
        if (!n) return;
        G.gold -= d.price * n; give(k, n); S.sfx('coin'); refresh(); hb.set(`${d.name}${n > 1 ? ' ×' + n : ''} を買った`);
        if (isGear(k)) for (let i = 0; i < n; i++) if (!(await offerEquip(k, n - i, t => hb.set(t)))) break;
        refresh();
      }
      async function doSell(k) {
        const d = D.items[k], sp = sellP(k), n = count(k) >= 2 ? await pickQty({ name: d.name, unit: sp, max: count(k), sell: true, cap: 'have' }) : 1;
        if (!n) return;
        if (isGear(k) && d.price == null && (await ask(d.name, `めずらしい品だ。${sp * n}枚で売る？`, ['売る', 'やめる'], { index: 1, cancel: 1 })) !== 0) return;
        take(k, n); G.gold += sp * n; S.sfx('coin'); refresh(); hb.set(`${d.name}${n > 1 ? ' ×' + n : ''} を ${sp * n}枚で売った`);
      }
    });
  }

  // what battle.js needs from here
  const env = { get G() { return G; }, D, S, el, root, ui, push, drop, top, list, notice, hideNotice, helpbar, KEY, MAX, stats, skillsOf, hasPassive, give, take, count, gainExp, img, rnd, ri, clamp, wait };
  const api = { startMap: Q.get('map') || 'village/map.json', onMap, onStep, onTrigger, onExit, onKey, alwaysDash: () => !!(G && G.set.dash), env,
    get G() { return G; }, get busy() { return busy; }, get ui() { return ui; }, get started() { return started; },
    // for tests and for trying things out: RPG.debug.battle(['mn001','mn005'])
    debug: { battle: (g, table) => battle(g, D.encounters[table || 'f01']), newGame, healAll, give, fullHeal, go: (name, at) => changeMap(name, at), save, menu, shop,
             lv(n) { for (const id of D.order) { G.party[id].lv = n; } healAll(); } } };
  return api;
})();
