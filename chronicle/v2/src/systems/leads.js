// EVENTS — 手がかり帳 R.Leads（V2_PLAN §2.5.14・§3.5・§3.14 の E1、WORLD_REDESIGN §3.1・§3.2、MODERN_UI §5.8・§6.2）
//
//   R.Leads.add(id, {silent}) → bool     聞いた（あれば何もしない）。R.Game.leads[id] = K.leadState {got: playMs, pin, seen}。'lead:add'
//   R.Leads.pin(id) / unpin()            目印は 1 つだけ。'lead:pin'（FIELD の右上の札・地図の印）
//   R.Leads.done(id)                     解決（目印も外す）。'lead:done'
//   R.Leads.list({all}) → K.leadGroup[]  地方ごと（本筋 → 世界のうわさ → 地方の順）。hideWhen が真の物は外す（all で入れる）
//   R.Leads.pinned() → id | null
//   足した物: state(id) → 'new'|'open'|'done'|null / isDone(id) / seen(id)（MENUS が詳しい文を開いたとき）/
//             clearRegionPins(rid)（ev.clearRegion が呼ぶ）/ unseen() → 数 / regionName(rid) /
//             offerOf(npcDef) → 話しかけると今くれる依頼の id | null（FIELD の頭の上の吹き出し。下の「依頼をくれる人」）
//
// 通知（MODERN_UI §6.2 の右上の札の形）: 新しく聞いたら右上に「新しい手がかり」の札（題名と聞いた所）を 4.5 秒。
//   フィールドが一番上でイベントが走っていない間に出す（会話の中で聞いたら、会話が終わってから）。
//   札が出ている間は Y で「目印を付ける」（WORLD_REDESIGN §3.1 の 4。帳を開き直さなくてよい）。Y を押したらメニューは開かない。
//   初めての手がかりのあとは説明の札（R.Screens.tip('leads')、MENUS）を 1 回。フィールドが無い間（フィクスチャ・タイトル）は出さない。
(function (R) {
  'use strict';
  if (R.Stubs && R.Stubs.claim) R.Stubs.claim('Leads');
  const Leads = (R.Leads = R.Leads || {});
  const KIND_ORDER = { main: 0, rumor: 1, map: 2, region: 3, side: 4 };
  const SHOW_MS = 4500;
  const PROMPT = [{ btn: 'y', label: R.T('sys.leads.PROMPT.0.label') }];

  const G = () => R.Game;
  const def = (id) => (R.DB.leads && R.DB.leads[id]) || null;

  Leads.isDone = function (id) {
    const g = G();
    if (!g) return false;
    return R.State.leadDoneIn ? R.State.leadDoneIn(g, id) : !!(g.leads[id] && g.leads[id].done);
  };
  Leads.state = function (id) {
    const l = G() && G().leads[id];
    if (!l) return null;
    if (Leads.isDone(id)) return 'done';
    return l.seen ? 'open' : 'new';
  };

  Leads.add = function (id, o) {
    const g = G();
    if (!g || !id) return false;
    if (g.leads[id]) return false;
    if (!def(id)) R.warn('R.Leads.add: unknown lead ' + id);
    g.leads[id] = { got: Math.floor(g.playMs || 0), pin: false, seen: false };
    R.emit('lead:add', { id });
    if (!(o && o.silent)) notify(id);
    return true;
  };
  Leads.pin = function (id) {
    const g = G();
    if (!g || !g.leads[id]) return false;
    for (const k of Object.keys(g.leads)) g.leads[k].pin = k === id;
    R.emit('lead:pin', { id });
    return true;
  };
  Leads.unpin = function () {
    const g = G();
    if (!g) return;
    let any = false;
    for (const k of Object.keys(g.leads)) { if (g.leads[k].pin) any = true; g.leads[k].pin = false; }
    if (any) R.emit('lead:pin', { id: null });
  };
  Leads.done = function (id) {
    const g = G();
    if (!g) return false;
    if (!g.leads[id]) g.leads[id] = { got: Math.floor(g.playMs || 0), pin: false, seen: true };
    const l = g.leads[id];
    if (l.done) return false;
    const wasPinned = l.pin;
    l.done = true; l.pin = false;
    R.emit('lead:done', { id });
    if (wasPinned) R.emit('lead:pin', { id: null });
    return true;
  };
  Leads.seen = function (id) { const l = G() && G().leads[id]; if (l && !l.seen) { l.seen = true; return true; } return false; };
  Leads.pinned = function () {
    const g = G();
    if (!g) return null;
    for (const k of Object.keys(g.leads)) if (g.leads[k].pin && !Leads.isDone(k)) return k;
    return null;
  };
  Leads.unseen = function () { const g = G(); if (!g) return 0; return Object.keys(g.leads).filter((k) => !g.leads[k].seen && !Leads.isDone(k)).length; };

  // ================================================================ 依頼をくれる人（頭の上のオレンジの吹き出し、layers.js。オーナーの依頼 2026-09-28）
  // 「話しかけたら依頼（kind:'side' の手がかり）をくれる人」だけ。受けた（R.Game.leads にある）・解けた人には出さない。
  // 渡す先（届け物の相手・報告の相手）には出さない（受けた依頼の数だけ町じゅうに出てうるさい。行き先は手がかり帳と目印が示す）。
  //   どの依頼か: 話す台本（def.talk の events）の meta.gives の 'lead:<id>'（meta.calls の台本も 1 段だけ）。
  //     地図の人の def.quest で上書き（id か id の配列。false なら出さない）
  //   今くれるか: まだ聞いていない・解決の条件（DB.leads[id].done）がまだ偽・slice:'locked' でない・hideWhen が偽・
  //     台本の meta.needs（flag: / item: / cleared: だけ読む。ほかは読まずに真）が真・手がかりの offer（条件。台本の中の分かれ道で
  //     まだ話を出さない間、たとえば灯台が戻るまでのタデオ）が真
  const offerInfo = new WeakMap();   // 台本 → {leads: [id], needs: cond[]}（台本の中身は変わらないので 1 回だけ読む）
  function needCond(s) {
    const i = typeof s === 'string' ? s.indexOf(':') : -1;
    if (i < 0) return null;
    const k = s.slice(0, i), v = s.slice(i + 1);
    if (k === 'flag') return v;
    if (k === 'item') return { item: v };
    if (k === 'cleared') return 'cleared_' + v;
    return null;
  }
  function eventOffers(evId, depth) {
    const e = R.DB.events && R.DB.events[evId];
    if (!e || typeof e !== 'object') return null;
    let info = offerInfo.get(e);
    if (info) return info;
    info = { leads: [], needs: [] };
    const m = e.meta || {};
    for (const n of m.needs || []) { const c = needCond(n); if (c != null) info.needs.push(c); }
    for (const gv of m.gives || []) {
      if (typeof gv !== 'string' || gv.indexOf('lead:') !== 0) continue;
      const id = gv.slice(5), d = def(id);
      if (d && d.kind === 'side' && !info.leads.includes(id)) info.leads.push(id);
    }
    // 呼ぶ台本（釣り小屋のトーレ → snow_fishing_talk など）。その台本の needs も足す
    if (!(depth > 0)) for (const c of m.calls || []) {
      const sub = eventOffers(c, 1);
      if (!sub || !sub.leads.length) continue;
      for (const id of sub.leads) if (!info.leads.includes(id)) info.leads.push(id);
      for (const nc of sub.needs) info.needs.push(nc);
    }
    offerInfo.set(e, info);
    return info;
  }
  /** 手がかり（id か定義）が今は「この先は、まだ語られていない」か: slice:'locked'（まだ作っていない地方）か、
   *  体験版（DB.config.slice）で行けない地方（DB.config.sliceOpen に無い region。峠の番人の先）の物 */
  Leads.locked = function (idOrDef) {
    const d = typeof idOrDef === 'string' ? def(idOrDef) : idOrDef;
    if (!d) return false;
    if (d.slice === 'locked') return true;
    const C = R.DB.config || {};
    return !!(C.slice && Array.isArray(C.sliceOpen) && d.region && !C.sliceOpen.includes(d.region));
  };
  /** 依頼 id を今くれるか（受けていない・解けていない・条件が真） */
  Leads.offerable = function (id) {
    const g = G(), d = def(id);
    if (!g || !d || d.kind !== 'side' || d.slice === 'locked') return false;
    if (g.leads[id]) return false;
    if (d.done != null && d.done !== false && R.State.check(d.done)) return false;   // 聞く前に解けた（先に井戸の底を見た、など）
    if (d.hideWhen != null && R.State.check(d.hideWhen)) return false;
    if (d.offer != null && !R.State.check(d.offer)) return false;
    return true;
  };
  /** 地図の人（def）が話しかけると今くれる依頼の id | null */
  Leads.offerOf = function (nd) {
    if (!nd || !G()) return null;
    let ids, needs = null;
    if (nd.quest === false) return null;
    if (nd.quest != null) ids = [].concat(nd.quest);
    else {
      if (typeof nd.talk !== 'string') return null;
      const info = eventOffers(nd.talk, 0);
      if (!info || !info.leads.length) return null;
      ids = info.leads; needs = info.needs;
    }
    if (needs) for (let i = 0; i < needs.length; i++) if (!R.State.check(needs[i])) return null;
    for (let i = 0; i < ids.length; i++) if (Leads.offerable(ids[i])) return ids[i];
    return null;
  };

  /** 地方の見出しの名前（行ったことのない地方は方角で。MENUS が使う） */
  Leads.regionName = function (rid) {
    if (!rid || rid === '-' || rid === 'world') return R.T('sys.leads.regionName.ret');
    if (rid === 'main') return R.T('sys.leads.regionName.ret_2');
    const r = R.DB.regions && R.DB.regions[rid];
    return (r && r.name) || rid;
  };

  // ================================================================ 次にやること（R.DB.goals。オーナーの依頼 2026-09-28「今の目標がいつでも 1 行で見える」）
  //   Leads.goal() → {id, text, lead} | null。表（src/data/goals.js）の、at が真の段のうち いちばん後ろの物。
  //   メニューの上（hub.js）とフィールドの L の札（field/hud.js）が読む。'goal' は段が変わったとき（hud.js が見る）
  function goalRows() {
    const T = R.DB.goals || {};
    return Object.keys(T).map((id) => Object.assign({ id }, T[id])).sort((a, b) => (a.n || 0) - (b.n || 0));
  }
  function fillGoal(s) {
    const g = G() || {};
    return String(s).replace(/\{(flags|var):([^}]*)\}/g, (m, k, v) => {
      if (k === 'var') return String(+((g.vars && g.vars[v]) || 0));
      return String(v.split(',').filter((f) => g.flags && g.flags[f.trim()]).length);
    });
  }
  /** 段の文（text が配列なら when が真の最初の物） */
  Leads.goalText = function (row) {
    if (!row) return '';
    let t = row.text;
    if (Array.isArray(t)) {
      const hit = t.find((x) => x && (x.when == null || R.State.check(x.when)));
      t = hit ? hit.text : '';
    }
    return t ? fillGoal(t) : '';
  };
  Leads.goal = function () {
    if (!G()) return null;
    const rows = goalRows();
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      let ok = false;
      try { ok = R.State.check(r.at); } catch (e) { ok = false; }
      if (!ok) continue;
      if (r.fromLeads && !(R.DB.config && R.DB.config.slice)) { const dyn = leadGoal(); if (dyn) return dyn; }
      const text = Leads.goalText(r);
      if (text) return { id: r.id, text, lead: r.lead || null };
    }
    return null;
  };
  // 製品版の森の後（表の最後の段 fromLeads）: 手がかり帳から今の目標を選ぶ（持ち主 2026-10-01「次にやることが全然更新されない」）。
  //   聞いていて まだ解けていない手がかりのうち: 目印を付けた物 → 今いる地方の地方の手がかり → 本筋（main）→ ほかの地方の手がかり → うわさ。
  //   同じ組の中では いちばん新しく聞いた物。寄り道（side）は目印を付けたときだけ。文は「題（場所）」
  const GOAL_KINDS = ['region', 'main', 'rumor'];
  function leadGoal() {
    const g = G();
    if (!g || !g.leads) return null;
    const open = Object.keys(g.leads).filter((id) => def(id) && !Leads.isDone(id) && !Leads.locked(id));
    if (!open.length) return null;
    const got = (id) => g.leads[id].got || 0;
    const newest = (ids) => ids.sort((a, b) => got(b) - got(a))[0] || null;
    const here = ((R.DB.maps || {})[g.pos && g.pos.map] || {}).region;
    const kind = (id) => def(id).kind || 'region';
    const pick = open.find((id) => g.leads[id].pin)
      || newest(open.filter((id) => kind(id) === 'region' && here && def(id).region === here))
      || newest(open.filter((id) => kind(id) === 'main'))
      || newest(open.filter((id) => kind(id) === 'region'))
      || newest(open.filter((id) => kind(id) === 'rumor'));
    if (!pick || (GOAL_KINDS.indexOf(kind(pick)) < 0 && !g.leads[pick].pin)) return null;
    const d = def(pick);
    const m = (R.DB.maps || {})[d.place];
    const place = m && m.name ? m.name : '';
    const text = place ? R.T('sys.leads.goal.withPlace', { title: d.title, place }) : d.title;
    return { id: 'lead:' + pick, text, lead: pick };
  }
  Leads._leadGoal = leadGoal;

  Leads.list = function (o) {
    const g = G();
    if (!g) return [];
    const all = o && o.all;
    const by = {};
    const order = [];
    const ids = Object.keys(g.leads).sort((a, b) => (g.leads[a].got || 0) - (g.leads[b].got || 0));
    for (const id of ids) {
      const d = def(id) || {};
      if (!all && d.hideWhen != null && R.State.check(d.hideWhen)) continue;
      const region = d.kind === 'main' ? 'main' : d.region || 'world';
      if (!by[region]) { by[region] = { region, items: [] }; order.push(region); }
      const st = Leads.isDone(id) ? 'done' : g.leads[id].seen ? 'open' : 'new';
      by[region].items.push({ id, state: st, pinned: !!g.leads[id].pin && st !== 'done' });
    }
    const rank = (r) => (r === 'main' ? 0 : r === 'world' ? 1 : 2);
    order.sort((a, b) => rank(a) - rank(b));
    for (const r of order) {
      by[r].items.sort((a, b) => (a.state === 'done') - (b.state === 'done') || (KIND_ORDER[(def(a.id) || {}).kind] || 0) - (KIND_ORDER[(def(b.id) || {}).kind] || 0));
    }
    return order.map((r) => by[r]);
  };

  /** 地方を解決したら、その地方の手がかりに付けた目印を外す（WORLD_REDESIGN §3.1 の 4） */
  Leads.clearRegionPins = function (rid) {
    const g = G();
    if (!g) return;
    for (const id of Object.keys(g.leads)) {
      const d = def(id);
      if (d && d.region === rid && g.leads[id].pin) { g.leads[id].pin = false; R.emit('lead:pin', { id: null }); }
    }
  };

  // ================================================================ 通知の札
  const queue = [];      // [{id, t0}]
  let cur = null;        // {id, t0, pinned}
  let tipDue = false;
  let installed = false;

  function fieldTop() {
    const top = R.Engine && R.Engine.top && R.Engine.top();
    return !!top && top.id === 'field';
  }
  function calm() { return fieldTop() && !(R.Events && R.Events.busy && R.Events.busy()) && R.Engine.fade.a < 0.01; }

  function notify(id) {
    if (!R.Engine || !R.Engine.has || !R.Engine.has('field')) return;   // フィクスチャ・タイトルの間は出さない
    if (!queue.some((q) => q.id === id)) queue.push({ id });
    try { R.Audio.sfx('lead'); } catch (e) { /* */ }
    if (!(G().flags && G().flags.tip_leads)) tipDue = true;
    install();
  }

  function install() {
    if (installed) return;
    installed = true;
    R.Engine.addTick(tick);
    R.Engine.overlay('leads', draw, 45);
  }

  function tick() {
    if (!R.Game) { queue.length = 0; cur = null; tipDue = false; return; }
    const now = R.Engine.time;
    if (!cur && queue.length && calm()) { cur = queue.shift(); cur.t0 = now; }
    if (cur) {
      const age = now - cur.t0;
      // Y で目印（フィールドが一番上でイベントが無い間だけ）
      const P = R.Input.pointer;
      const tap = P && P.pressed && R.UIK.hit(cardRect(), P.x, P.y);
      if (!cur.pinned && age > 150 && calm() && (R.Input.pressed('y') || tap)) {
        R.Input.consume('y');
        if (tap && R.Input.consume) R.Input.consume();
        if (Leads.pin(cur.id)) { cur.pinned = true; cur.t0 = Math.min(cur.t0, now - SHOW_MS + 1400); try { R.Audio.sfx('confirm'); } catch (e) { /* */ } }
      }
      if (age > SHOW_MS) cur = null;
      else if (!R.Engine.has('field')) cur = null;
    }
    if (!cur && !queue.length && tipDue && calm()) {
      tipDue = false;
      if (R.Screens && R.Screens.tip) { try { R.Screens.tip('leads'); } catch (e) { R.warn('tip leads', e && e.message); } }
    }
  }

  /** 札の矩形（テスト用）: 右上。FIELD の目印の札があればその下 */
  function cardRect() {
    const U = R.UIK.u, s = R.safe, tall = R.layout === 'tall';
    const w = tall ? Math.min(R.W - s.l - s.r - U(32), U(330)) : U(284);
    const h = U(88);
    let x = tall ? s.l + U(16) : R.W - s.r - U(16) - w;
    if (!tall && R.Input.touchVisible && R.Input.touchVisible()) {
      const sp = R.Input.touchSpots && R.Input.touchSpots().y;
      if (sp) x = Math.min(x, sp.x - sp.r - U(12) - w);
    }
    let y = s.t + U(18);
    if (tall) y = s.t + U(118);
    const pinned = Leads.pinned();
    if (pinned && cur && pinned !== cur.id) y += U(62);
    if (R.Field && R.Field._s && R.Field._s.hud && R.Field._s.hud.showMini && !tall) y += U(158);
    return { x, y, w, h };
  }
  Leads._cardRect = cardRect;
  Leads._current = function () { return cur ? { id: cur.id, pinned: !!cur.pinned } : null; };
  /** 手がかりの札が今出ていればその矩形（無ければ null）。入手の通知（uik/toast.js）がこの下に積む（重ねて名前を隠さない。テスト報告 P9） */
  Leads._shownRect = function () { return cur && R.Game && fieldTop() && R.Engine.time - cur.t0 <= SHOW_MS ? cardRect() : null; };

  function draw(g) {
    if (!cur || !R.Game || !fieldTop()) return;
    const d = def(cur.id) || { title: cur.id };
    const age = R.Engine.time - cur.t0;
    const T = R.UIK.T, C = T.color, U = R.UIK.u;
    const kin = Math.min(1, age / 220), kout = Math.min(1, (SHOW_MS - age) / 320);
    const a = Math.max(0, Math.min(kin, kout));
    if (a <= 0) return;
    const r = cardRect();
    const dx = (1 - R.UIK.ease(kin)) * U(18);
    g.save();
    g.globalAlpha = a;
    const x = Math.round(r.x + dx), y = r.y, w = r.w, h = r.h;
    R.UIK.panel(g, { x, y, w, h }, { r: U(12), a: 0.86 });
    // 左の琥珀の細い帯
    g.fillStyle = 'rgba(236,201,124,0.85)';
    g.fillRect(x + U(1), y + U(12), U(2), h - U(24));
    R.UIK.icon(g, 'journal', x + U(16), y + U(13), U(16), C.gold);
    R.UIK.text(g, cur.pinned ? R.T('sys.leads.draw.text') : R.T('sys.leads.draw.text_2'), x + U(38), y + U(14), { size: U(11.5), weight: 700, color: C.gold, track: U(1.5) });
    const from = d.from ? String(d.from) : '';
    if (from) R.UIK.text(g, from, x + w - U(16), y + U(15), { size: U(11), color: C.text3, align: 'right', maxW: w * 0.42 });
    R.UIK.text(g, d.title || cur.id, x + U(16), y + U(36), { size: U(16.5), weight: 700, color: C.text, maxW: w - U(32) });
    if (cur.pinned) {
      R.UIK.icon(g, 'pin', x + U(16), y + h - U(24), U(13), C.gold);
      R.UIK.text(g, R.T('sys.leads.draw.text_3'), x + U(34), y + h - U(24), { size: U(11.5), color: C.text2 });
    } else R.UIK.prompts(g, PROMPT, { x: x + w - U(14), y: y + h - U(17), align: 'right' }, { size: 11.5 });
    g.restore();
  }
})(window.RPG);
