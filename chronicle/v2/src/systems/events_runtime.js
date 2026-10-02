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
//   night({onDark}) → {skipped}   宿・寝床の暗転とジングル（ev.inn・休み小屋・序章の宿が使う）
//   bark(map, npc)：npc.bark（あいさつのボイス）を、マップに来てから最初に話しかけたときだけ鳴らす（talk が呼ぶ）
//
// ev の決まり（§2.11）
//   say(who, text, {voice, face, name, title})   who = 今のマップの NPC の id か、一行の人の id（'hero' など）か look か null（地の文）。
//        名前は npc.name → 人の名前 → looks[look].name。face を書かなければ look に顔があれば（R.Portrait.has）出す。false で出さない。
//        face に表情だけ（'smile'）を書いたら話者の look に付ける。文の中の {hero} は主人公の名前
//   choose(labels, {cancel, text, who, face, index（最初のカーソル）})  → 選んだ番号（B は cancel の番号）。who（NPC の id か true = 話しかけた NPC）を書くと
//        問いの窓に say と同じ名前・顔を付ける
//   caption(text, {ms}) → R.UIK.Message.caption / fade('out'|'in', ms) / wait(ms)
//   item(id, n, {silent}) → K.gain。右上に「〜を 手に入れた」/ take(id, n) → bool / gold(n, {silent}) / has(id)（袋＋装備）
//   battle(troop|setup, opts) → 'win'|'lose'|'escape'（全滅して宿・タイトルを選んだら戻らない）
//   inn(price?) → bool          画面は {stay} だけ。お金・暗転・R.Party.restoreAll・lastInn（K.place）・autosave('inn')・emit('inn') はここ
//                               暗転とジングルは Events.night（下）: 2.5 秒は飛ばせない → A・B・タップで飛ばす／ジングルの終わりで明ける
//   chooseCompanions({count}) → ids（R.Party.join までここ）/ createHero() → K.hero（B で戻ったらもう一度開く）
//   clearRegion(rid)            ページ → cleared・regionTier（出現の固定）・tier+1・pendingTier・章の数 → 地方の目印を外す → R.Tier.celebrate → 'region:clear'
//   letter(id) → R.Screens.open('letter') / mini.sequence・mini.timing → R.Mini
//   lore(id) → bool             読み物を書庫へ（旗 = id。呼ぶ側が先に旗を立てていても通知は出す）
//   partyShow(id | ids | 'all', {near:'hero'|npcId, at:[x,y], dir, ms, wait, stay}) / partyHide(id | ids | 'all', {ms, wait})
//        フィールドは主人公だけ（FIELD trail.js、オーナーの決まり 2026-09-27）。仲間を主人公の横に短いフェードで出す／消す。
//        出した人は ev.npc(id) で動かせる。say(who) の who が一行の仲間（主人公以外）で、地図にその NPC がいなければ自動で出す
//        （o.show === false で出さない）。chooseCompanions で加わった人も出す。イベント（run・talk）が終わると stay の人を除いて消える
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
    // 韓国語は {hero} の後の助詞の印（은(는)・이(가)…）を名前の받침で選ぶ（R.I18n.fillName）
    const one = (s) => (R.I18n && R.I18n.fillName ? R.I18n.fillName(s, 'hero', name || '') : String(s == null ? '' : s).replace(/\{hero\}/g, name || ''));
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
    const txt = R.T('sys.events_runtime.toastGain.txt', { p0: r.name || r.item, p1: r.n > 1 ? ' ×' + r.n : '' });
    try { if (R.Field && R.Field.hud && R.Field.hud.toast && R.Engine.has('field')) R.Field.hud.toast(txt, { icon }); else R.UIK.toast(txt, { icon, anchor: 'tr' }); } catch (e) { /* */ }
    try { (it && it.slot === 'key' ? R.Audio.jingle('keyitem') : R.Audio.sfx('item')); } catch (e) { /* */ }
  }

  // ---------------------------------------------------------------- 報酬のアクセサリを付けるか聞く
  // 地方の報酬（src: 'reward' のアクセサリ。木霊の首飾り・砂王の印章・灯台守のランタン…）は袋に入るだけで、付けずに先へ進んでいた（テスター 2026-10-02 Q10）。
  //   イベントの中で手に入れたら覚えておき、イベントの終わりに「〇〇を誰かに付けますか？」。カーソルは付けていちばん強くなる人（R.Screens.wearPlan）、
  //   誰も強くならなければ「あとで」。空いた枠が無い人は外れる品を右に出す。出てすぐの決定は受けない（会話の選択肢と同じ）
  const wearQ = [];
  const isRewardAcc = (id) => { const it = R.DB && R.DB.items && R.DB.items[id]; return !!it && it.slot === 'acc' && it.src === 'reward'; };
  if (R.on) R.on('item:gain', (e) => { if (busy && e && e.n > 0 && isRewardAcc(e.id) && !wearQ.includes(e.id)) wearQ.push(e.id); });
  async function offerWear(ev, id) {
    const S = R.Screens, it = R.DB.items[id];
    if (!S || !S.wearPlan || !it || R.State.owned(id) < 1 || (R.Game.items[id] || 0) < 1) return;
    const plan = S.wearPlan(id);
    const rows = plan.rows.map((r, i) => Object.assign({ i }, r)).filter((r) => r.can && r.slot && !r.wearing);
    if (!rows.length) return;
    const labels = rows.map((r) => {
      const d = S.bestDelta ? S.bestDelta(S.statDiff(r.c, r.slot, id)) : null;
      const right = r.swap ? R.T('sys.events_runtime.offerWear.swap', { name: (R.DB.items[r.swap] || {}).name || r.swap })
        : d ? `${d.name} ${d.d > 0 ? '+' : '−'}${Math.abs(d.d)}` : R.T('sys.events_runtime.offerWear.free');
      return r.c.name + '\t' + right;
    });
    const later = labels.length;
    const bi = rows.findIndex((r) => r.i === plan.best);
    if (R.Engine.fade && R.Engine.fade.a > 0.01) await ev.fade('in', 200);
    const k = await ev.choose(labels.concat([R.T('sys.events_runtime.offerWear.later')]), { text: R.T('sys.events_runtime.offerWear.text', { name: it.name }), cancel: later, index: bi >= 0 ? bi : later });
    if (k < 0 || k >= later) return;
    const r = rows[k];
    const res = R.Rules.equip(r.c, r.slot, id);
    if (res && res.ok) {
      try { R.UIK.sfx('equip'); } catch (e) { /* */ }
      const txt = R.T('ui.shop.offerEquip.toast', { name: r.c.name, name2: it.name });
      try { if (R.Field && R.Field.hud && R.Field.hud.toast && R.Engine.has('field')) R.Field.hud.toast(txt, { icon: 'equip' }); else R.UIK.toast(txt, { icon: 'equip', anchor: 'tr' }); } catch (e) { /* */ }
    }
  }
  Events._offerWear = offerWear;

  // ---------------------------------------------------------------- 仲間を出す（主人公だけのフィールド）
  function fieldOn() {
    try { return !!(R.Field && R.Field.partyShow && R.Field._s && R.Field._s.map && R.Engine.has && R.Engine.has('field')); } catch (e) { return false; }
  }
  /** say の話し手が一行の仲間なら、主人公の横に出す（地図にその NPC がいれば出さない） */
  function autoShow(who) {
    if (!who || !fieldOn() || !R.Field._isMember || !R.Field._isMember(who)) return;
    const S = R.Field._s;
    const ex = S.npcById && S.npcById[who];
    if (ex && (!ex.party || !ex.leaving)) return;
    try { R.Field.partyShow(who, { near: 'hero' }); } catch (e) { R.warn('partyShow', e && e.message); }
  }
  /** イベントが終わった: 出した仲間を消す（stay は残す）。abort なら一度に */
  function autoHide(now) {
    try { if (R.Field && R.Field.partyHide && R.Field._s && R.Field._s.map) R.Field.partyHide('all', now ? { ms: 0 } : { auto: true }); } catch (e) { /* */ }
  }
  Events._autoShow = autoShow;

  // ---------------------------------------------------------------- 宿の眠り（暗転の中のジングル）
  // 暗転 → 'inn' のジングル → o.onDark()（全快など）→ ジングルが終わるまで暗いまま → 明ける。ジングルは明ける前に必ず閉じる
  // （前は 0.9 秒で明けてジングルが会話・フィールドの上で鳴り続けた）。はじめの hold ms は押しても飛ばない（押下は溜めず、
  // ここで飲み込む）。その後の A・B・タップで飛ばす: ジングルを skipFade ms で消して BGM を戻す（R.Audio.endJingle）。
  // 飛ばさなければジングルの終わり（長くても max ms）で明ける。音が無い・BGM の音量 0 なら min ms だけ暗くする
  const NIGHT = { hold: 2500, min: 900, max: 7500, skipFade: 500, endFade: 1200, fade: 400 };
  Events.NIGHT = NIGHT;
  function bgmOn() {
    try { return !(R.Settings && R.Settings.get && R.Settings.get('vol.bgm') <= 0); } catch (e) { return true; }
  }
  function skipPress() {
    const I = R.Input;
    if (!I) return false;
    const hit = I.pressed('a') || I.pressed('b') || !!(I.pointer && I.pointer.pressed);
    I.consume();   // 押したままの A が明けた後の会話に漏れない
    return hit;
  }
  Events.night = async function (o) {
    o = o || {};
    await R.Engine.fadeTo(1, NIGHT.fade);
    let over = true;
    if (bgmOn()) {
      let p = null;
      try { p = R.Audio.jingle && R.Audio.jingle('inn'); } catch (e) { p = null; }
      if (p && p.then) { over = false; p.then(() => { over = true; }, () => { over = true; }); }
    }
    if (o.onDark) o.onDark();
    const t0 = R.Engine.time;
    let skipped = false;
    await R.until(() => {
      const t = R.Engine.time - t0;
      const hit = skipPress();
      if (t >= NIGHT.max) return true;
      if (over) return t >= NIGHT.min;
      if (hit && t >= NIGHT.hold) { skipped = true; return true; }
      return false;
    });
    // 飛ばした・長すぎた: ジングルを閉じて BGM を戻す（'ended' を待たない。前の曲はここで必ず戻る）
    try { if (R.Audio.jingleId === 'inn' && R.Audio.endJingle) R.Audio.endJingle(skipped ? NIGHT.skipFade : NIGHT.endFade); } catch (e) { /* */ }
    await R.Engine.fadeTo(0, NIGHT.fade);
    return { skipped };
  };

  // ---------------------------------------------------------------- ev
  function makeEv(ctx) {
    ctx = ctx || {};
    const token = aborted;
    const guard = () => { if (token !== aborted) throw abortErr(); };
    const ev = {
      ctx,
      async say(who, text, o) {
        guard(); o = o || {};
        if (o.show !== false) autoShow(who);
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
        // 問いを NPC が言うとき（o.who = NPC の id か true = 話しかけた NPC）: say と同じく名前・肩書き・顔を付ける
        //   （前は選択肢の窓だけ名前と顔が消えて、2 回目の会話で「誰が話しているか分からない」と言われた。テスター 2026-09-30）
        const w = o.who === true ? ctx.npc : o.who;
        if (w && o.text) {
          const sp = speaker(w);
          const name = o.name || sp.name;
          if (name) msg.name = fill(name);
          if (o.title || sp.title) msg.title = o.title || sp.title;
          msg.face = faceOf(sp, o.face);
        }
        if (o.cancel != null) msg.cancel = o.cancel;
        if (o.index != null) msg.index = o.index;
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
          try { if (R.Engine.has('field')) R.Field.hud.toast(R.T('sys.events_runtime.makeEv.ev.gold.toast', { n }), { icon: 'coin' }); else R.UIK.toast(R.T('sys.events_runtime.makeEv.ev.gold.toast', { n }), { icon: 'coin', anchor: 'tr' }); } catch (e) { /* */ }
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
        const p = R.Field.pos || {};
        await Events.night({ onDark() {
          R.Party.restoreAll();
          G().lastInn = { map: p.map, x: p.x | 0, y: p.y | 0, dir: p.dir || 's' };
        } });
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
        // 加わった人を主人公の横に出す（フィールドは主人公だけ。イベントが終わると消える）
        if (out.length && fieldOn()) { try { R.Field.partyShow(out, { near: 'hero' }); } catch (e) { R.warn('partyShow', e && e.message); } }
        return out;
      },
      async createHero() {
        guard();
        let h = null;
        for (let i = 0; i < 20 && !h; i++) { h = await R.Screens.open('charcreate'); guard(); }
        if (!h) h = (R.DB.config && R.DB.config.defaultHero) || { type: 'warrior', sex: 'm', name: R.T('sys.events_runtime.makeEv.ev.createHero.h.name') };
        R.State.setHero(h);
        return h;
      },
      /** 読み物（R.DB.lore の lo_*）を書庫へ: 旗 = id（CONTENT-P・F の今の形のまま）。右上に通知する（呼ぶ側が once を守る）。初めてなら true */
      lore(id) {
        guard();
        const first = !G().flags[id];
        if (first) { G().flags[id] = true; R.emit('flag', { id, v: true }); }
        const d = R.DB.lore && R.DB.lore[id];
        const txt = R.T('sys.events_runtime.makeEv.ev.lore.txt', { p0: d && d.title ? R.T('sys.events_runtime.makeEv.ev.lore.txt_2', { title: d.title }) : '' });
        try { if (R.Field && R.Field.hud && R.Field.hud.toast && R.Engine.has('field')) R.Field.hud.toast(txt, { icon: 'book' }); else R.UIK.toast(txt, { icon: 'book', anchor: 'tr' }); } catch (e) { /* */ }
        try { R.Audio.sfx('quill'); } catch (e) { /* */ }
        return first;
      },
      lead(id) { guard(); return R.Leads.add(id); },
      leadDone(id) { guard(); return R.Leads.done(id); },
      choice(key, value) { guard(); G().choices[key] = value; },
      choiceOf(key) { return G().choices[key]; },
      async clearRegion(rid) { guard(); const r = await clearRegion(rid); guard(); return r; },
      npc(id) { return R.Field.npc(id); },
      /** 立ち去る（背を向けて数歩歩き、薄れて消える）。ids は 1 人か配列。みんな同時に歩く。o = {steps, path, ms, stagger} */
      async leave(ids, o) {
        guard();
        const list = [].concat(ids).filter(Boolean);
        const st = (o && o.stagger) != null ? o.stagger : 140;
        const self = this;
        await Promise.all(list.map(async (id, i) => {
          if (i && st) await self.wait(i * st);
          const h = self.npc(id);
          await (h.leave ? h.leave(o) : h.hide());
        }));
        guard();
      },
      /** 現れる（leave の逆。薄く浮かび上がる）。ids は 1 人か配列。o = {ms, from: [x, y], speed, dir, stagger} */
      async appear(ids, o) {
        guard();
        const list = [].concat(ids).filter(Boolean);
        const st = (o && o.stagger) != null ? o.stagger : 140;
        const self = this;
        await Promise.all(list.map(async (id, i) => {
          if (i && st) await self.wait(i * st);
          const h = self.npc(id);
          await (h.appear ? h.appear(o) : h.show());
        }));
        guard();
      },
      async partyShow(id, o) { guard(); if (!fieldOn()) return []; const r = await R.Field.partyShow(id, o || {}); guard(); return r; },
      async partyHide(id, o) { guard(); if (!fieldOn()) return []; const r = await R.Field.partyHide(id, o || {}); guard(); return r; },
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
      bgm(id, o) { try { R.Audio.bgm(id, o); } catch (e) { /* */ } },
      /** 今のマップの BGM に戻す（予告の曲 omen・灯の曲 dawn の後） */
      mapBgm(o) { try { const m = R.DB.maps[(R.Field && R.Field.pos && R.Field.pos.map) || ctx.map]; if (m && m.bgm) R.Audio.bgm(m.bgm, o); } catch (e) { /* */ } },
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
    // その地方の雑魚は解決する直前のティア（ここで戦ってきた強さ）で止める（R.Tier.forZone）
    if (R.Tier.lockRegion) R.Tier.lockRegion(rid, g.tier || 0);
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
    wearQ.length = 0;
    try {
      const ev = makeEv(ctx);
      result = await e.run(ev, ctx);
      if (e.once && token === aborted) R.Game.flags['ev_' + id] = true;
      while (wearQ.length && token === aborted) await offerWear(ev, wearQ.shift());
    } catch (err) {
      if (!(err && err.aborted)) { console.error('[event ' + id + ']', err); }
      result = undefined;
    } finally {
      if (cur && cur.run === run) {
        busy = false;
        cur = null;
        if (token === aborted) { try { R.Field.unlock('event'); } catch (err) { /* */ } autoHide(false); }
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
    autoHide(true);
    R.Engine.fadeTo(0, 0);
  };

  Events.isNew = function (map, npc) {
    if (!npc || !npc.key || !R.Game) return false;
    const line = currentLine(npc);
    return !!line && R.Game.heard[npc.key] !== lineHash(line);
  };

  // 話しかけたときのあいさつ（npc.bark、design/voice_story_map.json の bark）: マップに来てから最初の 1 回だけ。
  // 最初の台詞にボイスがあるとき（R.Audio.voiceId）は、そちらが bark を止める（message の say がボイスを鳴らし直す）
  let barked = {};   // マップに来るたびに空にする（'map:enter'）
  if (R.on) R.on('map:enter', () => { barked = {}; });
  function bark(mapId, npc) {
    if (!npc || !npc.bark || busy) return;
    const k = mapId + ':' + npc.id;
    if (barked[k]) return;
    barked[k] = true;
    try { if (R.Audio && R.Audio.playVoice && !R.Audio.voiceId) R.Audio.playVoice(npc.bark); } catch (e) { /* 声が無くても止めない */ }
  }
  Events.bark = bark;

  Events.talk = async function (map, npc) {
    if (!npc) return undefined;
    const mapId = map && map.id ? map.id : map;
    R.emit('talk', { npc: npc.id });
    bark(mapId, npc);
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
      if (cur && cur.run === run) { busy = false; cur = null; if (token === aborted) { try { R.Field.unlock('talk'); } catch (e) { /* */ } autoHide(false); } }
      if (!busy) drain();
    }
  };
})(window.RPG);
