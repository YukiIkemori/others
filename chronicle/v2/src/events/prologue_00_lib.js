// CONTENT-P: 序章・ファロス・ワールド・本筋のイベントが使う小道具（R.ContentP.ev）。関数の中でだけ R の物を読む（§2.4）。
//   t(text)                 '{hero}' を主人公の名前に（配列はそれぞれ）
//   say(ev, who, text, o)   ev.say に t() を通して渡す。who = NPC id か look か null（地の文）
//   narr(ev, text)          地の文（顔も名前もなし）
//   give(ev, id, n, o)      ev.item → 右上の入手の通知（o.say で地の文も）。K.gain を返す
//   gold(ev, n)             ev.gold → 通知
//   lore(ev, id)            読み物（STORY_BIBLE §10.2 の lo_*）を書庫に書き写す: フラグ id を立て、R.DB.lore[id] を通知
//   toast(text, icon)       フィールドの通知（無ければ何もしない）
//   pick(list)              [{cond, text}…] の上から最初に合う物の text（cond なしは必ず合う）。pickEntry(list) は項目ごと（voice 付き）
//   stay(ev, o)             ただで泊まる（ベルナの家）。暗転 → ev.rest → lastInn。o.morningVoice で朝の一言にボイス
//   chapter(id)             年代記の章を足す（R.Game.chronicle.chapters に {id, summaryKey}。同じ id は 1 回）
//   ageLine(age)            世代で分けた台詞の型（STORY_BIBLE §3.5）
// TODO(EVENTS): ev.say が '{hero}' を置き換え、ev.item が入手の通知を出すようになったら、t() と give() の通知を外す（requests.jsonl）。
(function (R) {
  'use strict';
  const C = (R.ContentP = R.ContentP || {});
  const E = (C.ev = C.ev || {});

  E.heroName = function () {
    const h = R.Game && R.Game.chars && R.Game.chars.hero;
    return (h && h.name) || R.T('ev.prologue_00_lib.heroName.ret');
  };
  E.t = function (s) {
    if (Array.isArray(s)) return s.map(E.t);
    return R.I18n && R.I18n.fillName ? R.I18n.fillName(s, 'hero', E.heroName()) : String(s).replace(/\{hero\}/g, E.heroName());   // 韓国語の助詞も選ぶ
  };
  E.say = function (ev, who, text, o) { return ev.say(who, E.t(text), o); };
  E.narr = function (ev, text) { return ev.say(null, E.t(text), { face: false }); };
  E.toast = function (text, icon) {
    try { if (R.Field && R.Field.hud && R.Field.hud.toast) R.Field.hud.toast(E.t(text), { icon: icon || 'bag' }); } catch (e) { /* 通知は無くても止めない */ }
  };
  E.itemName = function (id) { const it = R.DB.items && R.DB.items[id]; return (it && it.name) || id; };
  E.give = async function (ev, id, n, o) {
    const r = ev.item(id, n == null ? 1 : n, { silent: true }) || { item: id, n: n || 1 };
    const name = (r && r.name) || E.itemName(id);
    const cnt = (n || 1) > 1 ? ' ×' + n : '';
    const key = /^k_/.test(id);
    // 語り（say）や、その場の地の文で入手を言うときは通知を出さない（持ち主 2026-09-28「受け取った／手に入れたが二重に出る」）
    if (!(o && (o.say || o.quiet))) E.toast(R.T('ev.prologue_00_lib.give.toast', { p0: name + cnt }), key ? 'key' : 'bag');
    if (o && o.say) await E.narr(ev, R.T('ev.prologue_00_lib.give.narr', { name, cnt }));
    return r;
  };
  E.gold = function (ev, n, o) { ev.gold(n, { silent: true }); if (!(o && o.quiet)) E.toast(R.T('ev.prologue_00_lib.gold.toast', { n }), 'coin'); };   // 通知は 1 つだけ（ev.gold の分は出さない）
  E.lore = function (ev, id) {
    if (ev.flag(id)) return false;
    ev.setFlag(id);
    const d = R.DB.lore && R.DB.lore[id];
    E.toast(R.T('ev.prologue_00_lib.lore.toast', { p0: d ? R.T('ev.prologue_00_lib.lore.toast_2', { title: d.title }) : '' }), 'book');
    return true;
  };
  /** pick の項目ごと（{text, voice?}）。合う物が無ければ {text: null} */
  E.pickEntry = function (list) {
    for (const e of list) if (e && (e.cond == null || R.State.check(e.cond))) return e;
    return { text: null };
  };
  E.pick = function (list) {
    for (const e of list) if (e && (e.cond == null || R.State.check(e.cond))) return e.text;
    return null;
  };
  E.stay = async function (ev, o) {
    o = o || {};
    const i = await ev.choose([o.yes || R.T('ev.prologue_00_lib.stay.i.choose.0'), o.no || R.T('ev.prologue_00_lib.stay.i.choose.1')], { cancel: 1, who: o.who || true, text: E.t(o.ask || R.T('ev.prologue_00_lib.stay.i.choose.text.t')) });
    if (i !== 0) { if (o.bye) await E.say(ev, o.who || null, o.bye); return false; }
    const p = R.Field.pos;
    // 暗転とジングル（飛ばせるのは 2.5 秒から。明ける前にジングルを閉じて BGM を戻す）は ev.inn と同じ R.Events.night
    await R.Events.night({ onDark() {
      ev.rest();
      if (R.Game) R.Game.lastInn = { map: p.map, x: p.x, y: p.y, dir: p.dir };
    } });
    try { R.Save.autosave('inn'); } catch (e) { /* */ }
    R.emit('inn', { map: p.map });
    if (o.morning) await E.say(ev, o.who || null, o.morning, o.morningVoice ? { voice: o.morningVoice } : undefined);
    return true;
  };
  E.chapter = function (id) {
    const G = R.Game;
    if (!G) return;
    G.chronicle = G.chronicle || { chapters: [] };
    if (!G.chronicle.chapters.some((c) => c.id === id)) G.chronicle.chapters.push({ id, summaryKey: id });
  };
  /** STORY_BIBLE §3.5: young = 二十歳より下（朝を知らない）、mid = 二十〜四十（少し明るかった気がする）、old = 年寄り（食い違う記憶） */
  E.AGE = {
    young: R.T('ev.prologue_00_lib.AGE.young'),
    mid: R.T('ev.prologue_00_lib.AGE.mid'),
    old: R.T('ev.prologue_00_lib.AGE.old'),
  };
})(window.RPG);
