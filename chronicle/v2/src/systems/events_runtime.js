// EVENTS — イベントの実行 R.Events と ev（V2_PLAN §2.5.10・§2.5.3・§2.11、中身は CONTENT が R.DB.events に書く）
//
//   R.Events.run(id, ctx) → Promise       同時に 1 本だけ。走っている間は R.Field.lock('event')。cond が偽・once で済みなら何もしない
//                                         （once の記録は flags['ev_<id>']）。走っている間に来た FIELD のトリガー（ctx.trigger）は
//                                         終わった後に順に走らせる（ほかは R.warn して無視）
//   R.Events.busy() / abort()             abort は全滅の宿・タイトル（§2.5.3）: 開いた会話を閉じ、lock を外し、暗転を戻す。
//                                         走っていた ev はこの後の呼び出しで止まる（例外 {aborted:true} を run が飲む）
//   R.Events.talk(map, npc) → Promise     npc.talk が文字列ならそのイベント、{lines} なら cond の合う最後の行を say。R.Game.heard[key] を書く
//   R.Events.isNew(map, npc) → bool       E19 の「新しい話」: 今の台詞のハッシュが R.Game.heard[key] と違う
//   R.Events.makeEv(ctx) → ev             OBJ_API.ev の全部（下）
//   足した物: runId() / current() → {id, ctx} | null / after(fn)（走っているイベントが終わったら。無ければすぐ）/ lineHash(line)
//
// ev の決まり（§2.11）
//   say(who, text, {voice, face, name, title})   who = 今のマップの NPC の id か、一行の人の id（'hero' など）か look か null（地の文）。
//        名前は npc.name → 人の名前 → looks[look].name。face を書かなければ look に顔があれば（R.Portrait.has）出す。false で出さない。
//        face に表情だけ（'smile'）を書いたら話者の look に付ける。文の中の {hero} は主人公の名前
//   choose(labels, {cancel, text})  → 選んだ番号（B は cancel の番号）
//   caption(text, {ms}) → R.UIK.Message.caption / fade('out'|'in', ms) / wait(ms)
//   item(id, n, {silent}) → K.gain。右上に「〜を 手に入れた」/ take(id, n) → bool / gold(n, {silent}) / has(id)（袋＋装備）
//   battle(troop|setup, opts) → 'win'|'lose'|'escape'（全滅して宿・タイトルを選んだら戻らない）
//   inn(price?) → bool          画面は {stay} だけ。お金・暗転・R.Party.restoreAll・lastInn（K.place）・autosave('inn')・emit('inn') はここ
//   chooseCompanions({count}) → ids（R.Party.join までここ）/ createHero() → K.hero（B で戻ったらもう一度開く）
//   clearRegion(rid)            ページ → cleared・tier+1・pendingTier・章の数 → 地方の目印を外す → R.Tier.celebrate → 'region:clear'
//   letter(id) → R.Screens.open('letter') / mini.sequence・mini.timing → R.Mini
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Events');
  const Events = (R.Events = R.Events || {});

  let busy = false;
  let aborted = 0;       // abort のたびに増える（古い ev を止める）
  let runSeq = 0;        // run の番号
  let cur = null;        // {id, ctx, run}
  const later = [];      // 終わった後に走らせるトリガー [{id, ctx}]
  const afters = [];     // 終わった後の関数

  const G = () => R.Game;
  const abortErr = () => Object.assign(new Error('event aborted'), { aborted: true });

  // ---------------------------------------------------------------- 話者
  function speaker(who) {
    if (!who) return { name: null, look: null, title: null };
    const pos = (R.Field && R.Field.pos) || {};
    const map = R.DB.maps[pos.map];
    const npc = map && (map.npcs || []).find((n) => n.id === who);
    if (npc) {
      const L = R.DB.looks[npc.look];
      return { name: npc.name || (L && L.name) || null, look: npc.look || null, title: npc.title || null };
    }
    const g = G();
    const c = g && g.chars && g.chars[who];
    if (c) return { name: c.name || null, look: c.look || null, title: null };
    const L = R.DB.looks[who];
    return { name: (L && L.name) || null, look: who, title: null };
  }
  Events.speaker = speaker;

  const EXPRS = () => (R.Contract && R.Contract.EXPRS) || ['neutral', 'smile', 'sad', 'angry', 'surprise'];
  function faceOf(sp, face) {
    if (face === false) return false;
    if (face == null || face === true) {
      if (!sp.look) return false;
      let has = false;
      try { has = !!(R.Portrait && R.Portrait.has && R.Portrait.has(sp.look, 'neutral')); } catch (e) { has = false; }
      return has ? sp.look : false;
    }
    if (typeof face === 'string' && EXPRS().includes(face)) return sp.look ? sp.look + ':' + face : false;
    return face;
  }
  function fill(text) {
    const name = R.State && R.State.heroName ? R.State.heroName() : '';
    const one = (s) => String(s == null ? '' : s).replace(/\{hero\}/g, name || '');
    return Array.isArray(text) ? text.map(one) : one(text);
  }
  Events.fill = fill;

  function lineHash(line) {
    const t = line && line.text;
    return R.U.hash(JSON.stringify(t == null ? '' : t)).toString(36);
  }
  Events.lineHash = lineHash;
  function currentLine(npc) {
    if (!npc || !npc.talk) return null;
    if (typeof npc.talk === 'string') {
      // イベントの話: 台詞の中身の代わりに、その NPC が今の cond で出る事実とイベントの id を印にする
      return { text: 'event:' + npc.talk };
    }
    let line = null;
    for (const l of npc.talk.lines || []) if (!l.cond || R.State.check(l.cond)) line = l;
    return line;
  }

  function toastGain(r, o) {
    if (o && o.silent) return;
    if (!r || !r.n) return;
    const it = R.DB.items[r.item];
    const icon = it ? (it.slot === 'key' ? 'key' : it.icon && R.UIK.hasIcon && R.UIK.hasIcon(it.icon) ? it.icon : 'bag') : 'bag';
    const txt = `${r.name || r.item}${r.n > 1 ? ' ×' + r.n : ''} を 手に入れた`;
    try { if (R.Field && R.Field.hud && R.Field.hud.toast && R.Engine.has('field')) R.Field.hud.toast(txt, { icon }); else R.UIK.toast(txt, { icon, anchor: 'tr' }); } catch (e) { /* */ }
    try { (it && it.slot === 'key' ? R.Audio.jingle('keyitem') : R.Audio.sfx('item')); } catch (e) { /* */ }
  }

  // ---------------------------------------------------------------- ev
  function makeEv(ctx) {
    ctx = ctx || {};
    const token = aborted;
    const guard = () => { if (token !== aborted) throw abortErr(); };
    const ev = {
      ctx,
      async say(who, text, o) {
        guard(); o = o || {};
        const sp = speaker(who);
        const face = faceOf(sp, o.face);
        const name = o.name || sp.name || undefined;
        const msg = { text: fill(text) };
        if (name) msg.name = fill(name);
        if (o.title || sp.title) msg.title = o.title || sp.title;
        msg.face = face;
        if (o.voice) msg.voice = o.voice;
        const r = await R.UIK.Message.say(msg);
        guard(); return r;
      },
      async choose(labels, o) {
        guard(); o = o || {};
        const msg = { text: fill(o.text || ''), choices: (labels || []).map((l) => fill(l)), face: false };
        if (o.cancel != null) msg.cancel = o.cancel;
        const r = await R.UIK.Message.say(msg);
        guard();
        return r == null ? (o.cancel != null ? o.cancel : -1) : r;
      },
      async caption(text, o) { guard(); await R.UIK.Message.caption(fill(Array.isArray(text) ? text.join('\n') : text), o || {}); guard(); },
      async fade(dir, ms) { guard(); await R.Engine.fadeTo(dir === 'out' ? 1 : 0, ms == null ? 260 : ms); guard(); },
      async wait(ms) { guard(); await R.wait(ms); guard(); },
      flag(id) { return !!G().flags[id]; },
      setFlag(id, v) {
        guard();
        v = v === undefined ? true : v;
        if (v === false || v == null) delete G().flags[id]; else G().flags[id] = v;
        R.emit('flag', { id, v: G().flags[id] || false });
      },
      var(name) { return G().vars[name] || 0; },
      addVar(name, n) { guard(); G().vars[name] = (G().vars[name] || 0) + (n == null ? 1 : n); R.emit('var', { name, v: G().vars[name] }); return G().vars[name]; },
      setVar(name, v) { guard(); G().vars[name] = v; R.emit('var', { name, v }); return v; },
      item(id, n, o) { guard(); const r = R.State.gain(id, n == null ? 1 : n); toastGain(r, o); return r; },
      take(id, n) { guard(); return R.State.take(id, n == null ? 1 : n); },
      gold(n, o) {
        guard();
        const v = R.State.gold(n || 0);
        if (n > 0 && !(o && o.silent)) {
          try { if (R.Engine.has('field')) R.Field.hud.toast(`${n} G を 手に入れた`, { icon: 'coin' }); else R.UIK.toast(`${n} G を 手に入れた`, { icon: 'coin', anchor: 'tr' }); } catch (e) { /* */ }
          try { R.Audio.sfx('gold'); } catch (e) { /* */ }
        }
        return v;
      },
      has(id) { return R.State.owned(id) > 0; },
      async battle(setup, opts) {
        guard();
        if (typeof setup === 'string') setup = { troop: setup };
        const r = await R.Battle.start(Object.assign({}, setup, opts || {}));
        // 'abort'（全滅して宿・タイトル）: R.Flow.wipe がもう R.Events.abort() を呼んでいる。念のためここでも止める
        if (r && r.result === 'abort') { if (token === aborted) Events.abort(); throw abortErr(); }
        guard();
        ctx._battled = true;
        return r ? r.result : 'win';
      },
      async warp(map, spawn) { guard(); await R.Field.enter(map, spawn); guard(); },
      heal() { guard(); R.Party.heal(true); },
      rest() { guard(); R.Party.restoreAll(); },
      async inn(price) {
        guard();
        if (price == null) price = R.Tier.innPrice();
        const r = await R.Screens.open('inn', { price });
        guard();
        if (!r || !r.stay) return false;
        if ((G().gold || 0) < price) return false;
        G().gold -= price;
        await R.Engine.fadeTo(1, 400);
        try { R.Audio.jingle && R.Audio.jingle('inn'); } catch (e) { /* */ }
        R.Party.restoreAll();
        const p = R.Field.pos || {};
        G().lastInn = { map: p.map, x: p.x | 0, y: p.y | 0, dir: p.dir || 's' };
        await R.wait(900);
        await R.Engine.fadeTo(0, 400);
        guard();
        try { R.Save.autosave('inn'); } catch (e) { R.warn('autosave inn', e && e.message); }
        R.emit('inn', { map: p.map });
        return true;
      },
      async shop(id) { guard(); const r = await R.Screens.open('shop', { id }); guard(); return r; },
      async tavern(o) { guard(); const r = await R.Screens.open('tavern', o || {}); guard(); return r; },
      async chooseCompanions(o) {
        guard();
        o = Object.assign({ count: 3 }, o || {});
        const ids = await R.Screens.open('partySelect', o);
        guard();
        const out = [];
        for (const id of Array.isArray(ids) ? ids : []) {
          if (G().joined.includes(id)) continue;
          try { R.Party.join(id); out.push(id); } catch (e) { R.warn('join ' + id, e && e.message); }
        }
        return out;
      },
      async createHero() {
        guard();
        let h = null;
        for (let i = 0; i < 20 && !h; i++) { h = await R.Screens.open('charcreate'); guard(); }
        if (!h) h = (R.DB.config && R.DB.config.defaultHero) || { type: 'warrior', sex: 'm', name: 'アルン' };
        R.State.setHero(h);
        return h;
      },
      lead(id) { guard(); return R.Leads.add(id); },
      leadDone(id) { guard(); return R.Leads.done(id); },
      choice(key, value) { guard(); G().choices[key] = value; },
      choiceOf(key) { return G().choices[key]; },
      async clearRegion(rid) { guard(); const r = await clearRegion(rid); guard(); return r; },
      npc(id) { return R.Field.npc(id); },
      guest(look) { guard(); R.Field.setGuest(look ? { id: look, look } : null); },
      async camera(x, y, ms) { guard(); if (x == null) await R.Field.camera.follow({ ms }); else await R.Field.camera.focus(x, y, { ms }); guard(); },
      mini: {
        async sequence(o) { guard(); const r = await R.Mini.sequence(o); guard(); return r; },
        async timing(o) { guard(); const r = await R.Mini.timing(o); guard(); return r; },
      },
      async letter(id) { guard(); await R.Screens.open('letter', { id }); guard(); },
      async call(id, args) {
        guard();
        const e = R.DB.events[id];
        if (!e) { R.warn('ev.call: no event ' + id); return undefined; }
        const c = Object.assign({}, ctx, args || {});
        const r = await e.run(makeEv(c), c);
        guard();
        return r;
      },
      g(male, female) { return R.State.heroSex() === 'f' ? female : male; },
      bgm(id) { try { R.Audio.bgm(id); } catch (e) { /* */ } },
      sfx(id) { try { R.Audio.sfx(id); } catch (e) { /* */ } },
      jingle(id) { try { return R.Audio.jingle(id); } catch (e) { return Promise.resolve(); } },
    };
    return ev;
  }
  Events.makeEv = function (ctx) { return makeEv(ctx); };

  // ---------------------------------------------------------------- 地方の解決（§2.5.14）
  async function clearRegion(rid) {
    const g = G();
    if (!rid) return g.tier;
    if (g.cleared[rid]) return g.tier;
    const info = R.Tier.regionInfo(rid);
    // 1. ページ（大事な物。通知は章の札が出すので黙って）
    if (info.pageId && R.DB.items[info.pageId]) R.State.gain(info.pageId, 1);
    // 2. 状態
    g.cleared[rid] = true;
    g.flags['cleared_' + rid] = true;
    g.tier = Math.min(R.Tier.MAX, (g.tier || 0) + 1);
    g.pendingTier = g.tier;
    g.chapter = Object.keys(g.cleared).filter((k) => g.cleared[k]).length;
    if (!g.chronicle.chapters.some((c) => c.id === rid)) g.chronicle.chapters.push({ id: rid, summaryKey: rid });
    R.Tier._arm();
    // 3. その地方の目印を外す
    R.Leads.clearRegionPins(rid);
    R.emit('region:clear', { rid, tier: g.tier });
    // 4. 大灯火の演出（暗転の中で 'tier' を出し、空とチャンクを引き直す）
    await R.Tier.celebrate(rid);
    return g.tier;
  }
  Events._clearRegion = clearRegion;

  // ---------------------------------------------------------------- 実行
  Events.runId = function () { return busy && cur ? cur.run : 0; };
  Events.current = function () { return busy && cur ? { id: cur.id, ctx: cur.ctx } : null; };
  Events.after = function (fn) { if (!busy) { try { fn(); } catch (e) { console.error(e); } return; } afters.push(fn); };

  Events.run = async function (id, ctx) {
    const e = R.DB.events[id];
    ctx = ctx || {};
    if (!e) { R.warn('no event ' + id); return undefined; }
    if (busy) {
      if (ctx.trigger && !later.some((l) => l.id === id)) later.push({ id, ctx });
      else R.warn('event already running (' + (cur && cur.id) + '), ignored: ' + id);
      return undefined;
    }
    if (!R.Game) return undefined;
    if (e.cond && !R.State.check(e.cond)) return undefined;
    if (e.once && R.Game.flags['ev_' + id]) return undefined;
    busy = true;
    const run = ++runSeq;
    cur = { id, ctx, run };
    const token = aborted;
    try { R.Field.lock('event'); } catch (err) { /* node */ }
    let result;
    try {
      result = await e.run(makeEv(ctx), ctx);
      if (e.once && token === aborted) R.Game.flags['ev_' + id] = true;
    } catch (err) {
      if (!(err && err.aborted)) { console.error('[event ' + id + ']', err); }
      result = undefined;
    } finally {
      if (cur && cur.run === run) {
        busy = false;
        cur = null;
        if (token === aborted) { try { R.Field.unlock('event'); } catch (err) { /* */ } }
        if (token === aborted && R.Engine.fade.a > 0.01 && !(R.Engine.fade.anim)) R.Engine.fadeTo(0, 200);
        if (ctx._battled && R.Field.encounter && R.Field.encounter.suppress) { try { R.Field.encounter.suppress(6); } catch (err) { /* */ } }
      }
    }
    if (!busy) drain();
    return result;
  };

  function drain() {
    while (afters.length && !busy) { const fn = afters.shift(); try { fn(); } catch (e) { console.error(e); } }
    if (!busy && later.length) {
      const nx = later.shift();
      Promise.resolve().then(() => Events.run(nx.id, nx.ctx));
    }
  }

  Events.busy = function () { return busy; };

  Events.abort = function () {
    aborted++;
    later.length = 0;
    afters.length = 0;
    if (R.UIK && R.UIK.Message && R.UIK.Message.busy()) R.UIK.Message.close();
    // 積まれた演出（celebrate・歌あわせ）を外す
    try {
      const st = R.Engine.stack;
      for (let i = st.length - 1; i >= 0; i--) if (st[i].id === 'celebrate' || /^mini/.test(st[i].id)) R.Engine.remove(st[i]);
    } catch (e) { /* */ }
    const wasBusy = busy;
    busy = false;
    cur = null;
    void wasBusy;
    try { const L = R.Field.locks ? R.Field.locks() : {}; for (const k of ['event', 'talk']) for (let i = 0; i < (L[k] || 0); i++) R.Field.unlock(k); } catch (e) { /* */ }
    R.Engine.fadeTo(0, 0);
  };

  Events.isNew = function (map, npc) {
    if (!npc || !npc.key || !R.Game) return false;
    const line = currentLine(npc);
    return !!line && R.Game.heard[npc.key] !== lineHash(line);
  };

  Events.talk = async function (map, npc) {
    if (!npc) return undefined;
    const mapId = map && map.id ? map.id : map;
    R.emit('talk', { npc: npc.id });
    if (typeof npc.talk === 'string') {
      if (npc.key) R.Game.heard[npc.key] = lineHash(currentLine(npc));
      return Events.run(npc.talk, { map: mapId, npc: npc.id, x: npc.x, y: npc.y });
    }
    const line = currentLine(npc);
    if (!line) return undefined;
    if (npc.key) R.Game.heard[npc.key] = lineHash(line);
    if (busy) return undefined;
    busy = true;
    const run = ++runSeq;
    cur = { id: 'talk:' + npc.id, ctx: { map: mapId, npc: npc.id }, run };
    const token = aborted;
    try { R.Field.lock('talk'); } catch (e) { /* */ }
    try {
      return await makeEv({ map: mapId, npc: npc.id }).say(npc.id, line.text, { face: line.face, voice: line.voice });
    } catch (err) {
      if (!(err && err.aborted)) console.error('[talk ' + npc.id + ']', err);
      return undefined;
    } finally {
      if (cur && cur.run === run) { busy = false; cur = null; if (token === aborted) { try { R.Field.unlock('talk'); } catch (e) { /* */ } } }
      if (!busy) drain();
    }
  };
})(window.RPG);
