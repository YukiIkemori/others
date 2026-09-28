// 体験版の記録の引き継ぎ（持ち主 2026-09-28「体験版の出口」）。R.DemoCarry
//   体験版の終わり（R.Demo.end）で、ふつうの記録の枠とは別の置き場に「体験版クリアの記録」を 1 つ書く。
//   製品版（DB.config.slice が偽）は はじめから の前にこれを見つけ、「引き継ぎますか？」と聞いて読み込む。
//
//   置き場: localStorage の R.SAVE_PREFIX + 'demo_clear'（使えないときはメモリ）。記録の 3 枠・オート・中断には触れない。
//   形（fmt 1）: {kind:'lc_demo_clear', demo_clear:true, fmt, version, saveVer, t, card:{playMs, place, chapter},
//                 carry:{hero:{name,type,sex,fav}, party, reserve, joined, chars:{id:{…}}, gold, items, flags, vars, cleared, tier, leads},
//                 state}
//     state = R.State.serialize() の丸ごと（同じ形の版なら、これをそのまま読む）。
//     carry = 版が変わって state が読めないときの控え（パーティ・成長・品・お金・フラグだけ。無い id は捨てて組み直す）。
//
//   R.DemoCarry.write()            → rec | null   今の R.Game から書く（体験版の終わりで 1 回）
//   R.DemoCarry.find()             → rec | null   あれば（形の違う・壊れた物は null。止まらない）
//   R.DemoCarry.importRec(rec, o)  → 'state' | 'carry' | false   R.Game にする。o.mode 'carry' で控えから組み直す（確かめ用）
//   R.DemoCarry.offer()            → Promise<bool>   製品版の「はじめから」の前: あれば聞いて、引き継いだら true（R.Game ができている）
//   R.DemoCarry.exportCode() / importCode(s)   別の置き場（製品版の窓が別の保存先のとき）へ運ぶ 1 行の文字（LCD1-…）
//   製品版の差し込み口: DB.config.slice が偽のときだけ、R.Flow.newGame の前に offer() を聞く（下の onBoot）。
//     引き継いだら記録の場所から R.Flow.resume()。引き継ぎの後は flags.demo_imported。
(function (R) {
  'use strict';
  const KEY = 'demo_clear';
  const FMT = 1;
  const KIND = 'lc_demo_clear';
  const mem = {};
  const DC = (R.DemoCarry = R.DemoCarry || {});
  DC.KEY = KEY;
  DC.FMT = FMT;

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  function ls() { try { return window.localStorage || null; } catch (e) { return null; } }
  function get() {
    const s = ls();
    try { const v = s && s.getItem((R.SAVE_PREFIX || '') + KEY); if (v != null) return v; } catch (e) { /* */ }
    return Object.prototype.hasOwnProperty.call(mem, KEY) ? mem[KEY] : null;
  }
  function set(v) {
    mem[KEY] = v;
    const s = ls();
    try { if (s) s.setItem((R.SAVE_PREFIX || '') + KEY, v); } catch (e) { return false; }
    return true;
  }
  DC.remove = function () { delete mem[KEY]; const s = ls(); try { if (s) s.removeItem((R.SAVE_PREFIX || '') + KEY); } catch (e) { /* */ } };

  /** 版が変わっても読める控え（ゲームの id と数だけ） */
  function carryOf(G) {
    const chars = {};
    for (const [id, c] of Object.entries(G.chars || {})) {
      if (!c) continue;
      chars[id] = { name: c.name, type: c.type, look: c.look, sex: c.sex, fav: c.fav, gl: c.gl, row: c.row,
        wprof: clone(c.wprof || {}), eprof: clone(c.eprof || {}), techs: (c.techs || []).slice(), spells: (c.spells || []).slice(), equip: clone(c.equip || {}) };
    }
    const h = chars[G.hero || 'hero'] || {};
    const flags = {};
    for (const [k, v] of Object.entries(G.flags || {})) if (v) flags[k] = v;
    return {
      hero: { name: h.name, type: h.type, sex: h.sex, fav: h.fav },
      party: (G.party || []).slice(), reserve: (G.reserve || []).slice(), joined: (G.joined || []).slice(), chars,
      gold: G.gold | 0, items: clone(G.items || {}), flags, vars: clone(G.vars || {}), cleared: clone(G.cleared || {}),
      tier: G.tier | 0, leads: clone(G.leads || {}),
    };
  }

  DC.write = function () {
    const G = R.Game;
    if (!G || !R.State || !R.State.serialize) return null;
    let rec;
    try {
      const pos = G.pos || {}, map = pos.map && R.DB.maps[pos.map];
      rec = {
        kind: KIND, demo_clear: true, fmt: FMT, version: String(R.VERSION || ''), saveVer: (R.Save && R.Save.VER) || 0, t: Date.now(),
        card: { playMs: Math.floor(G.playMs || 0), place: (map && map.name) || '', chapter: Object.keys(G.cleared || {}).filter((k) => G.cleared[k]).length },
        carry: carryOf(G),
        state: R.State.serialize(),
      };
    } catch (e) { console.error('[demo carry]', e); return null; }
    set(JSON.stringify(rec));   // localStorage に書けなくてもメモリには残る
    return rec;
  };

  const valid = (o) => !!(o && typeof o === 'object' && o.demo_clear === true && o.kind === KIND && (o.state || o.carry));
  DC.find = function () {
    const raw = get();
    if (!raw) return null;
    try { const o = JSON.parse(raw); return valid(o) ? o : null; } catch (e) { return null; }
  };

  /** 控え（carry）から組み直す: 主人公 → 仲間（今の DB に居る人だけ）→ 成長・技・術・装備（今ある id だけ）→ 品・お金・フラグ */
  function fromCarry(c) {
    const DB = R.DB, Rules = R.Rules;
    const hc = (c.chars && c.chars.hero) || {};
    const G = R.State.newGame({});
    G.tier = Math.max(0, c.tier | 0);
    R.State.setHero({ type: (c.hero && c.hero.type) || hc.type, sex: (c.hero && c.hero.sex) || hc.sex, name: (c.hero && c.hero.name) || hc.name, fav: (c.hero && c.hero.fav) || hc.fav });
    const known = (x) => { try { return !!(Rules && Rules.actionOf && Rules.actionOf(x)); } catch (e) { return false; } };
    const fill = (ch, s) => {
      if (!ch || !s) return;
      if (s.gl > 0 && R.Growth && R.Growth.init) { try { R.Growth.init(ch, { tier: G.tier, joinFrom: 'event', gl: +s.gl }); } catch (e) { /* 成長は作り直した値のまま */ } }
      for (const w of Object.keys(ch.wprof || {})) if (s.wprof && s.wprof[w] > ch.wprof[w]) ch.wprof[w] = s.wprof[w];
      for (const e of Object.keys(ch.eprof || {})) if (s.eprof && s.eprof[e] > ch.eprof[e]) ch.eprof[e] = s.eprof[e];
      ch.techs = Array.from(new Set((ch.techs || []).concat((s.techs || []).filter(known))));
      ch.spells = Array.from(new Set((ch.spells || []).concat((s.spells || []).filter(known))));
      for (const k of Object.keys(ch.equip || {})) { const it = s.equip && s.equip[k]; if (it && DB.items[it]) ch.equip[k] = it; }
      if (s.row === 'front' || s.row === 'back') ch.row = s.row;
      try { if (Rules && Rules.fullRestore) Rules.fullRestore(ch); } catch (e) { /* */ }
    };
    fill(G.chars.hero, hc);
    for (const id of (c.joined || []).concat(c.party || [], c.reserve || [])) {
      if (id === 'hero' || G.chars[id] || !(DB.companions && DB.companions[id])) continue;
      try { R.Party.join(id, { tier: G.tier, joinFrom: 'event', toReserve: !(c.party || []).includes(id) }); } catch (e) { continue; }
      fill(G.chars[id], c.chars && c.chars[id]);
    }
    G.gold = Math.max(0, Math.min(9999999, c.gold | 0));
    for (const [id, n] of Object.entries(c.items || {})) if (DB.items[id] && n > 0) G.items[id] = Math.min(99, n | 0);
    Object.assign(G.flags, c.flags || {});
    for (const [k, v] of Object.entries(c.vars || {})) if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') G.vars[k] = v;
    for (const [k, v] of Object.entries(c.cleared || {})) if (v && DB.regions && DB.regions[k]) G.cleared[k] = v;
    for (const [id, l] of Object.entries(c.leads || {})) if (DB.leads && DB.leads[id] && l && typeof l === 'object') G.leads[id] = clone(l);
    return G;
  }

  DC.importRec = function (rec, o) {
    o = o || {};
    if (!valid(rec)) return false;
    let how = false;
    const st = rec.state;
    if (o.mode !== 'carry' && st && R.State && R.State.deserialize) {
      try { if (R.State.deserialize(clone(st))) how = 'state'; } catch (e) { how = false; }
    }
    if (!how && rec.carry) {
      try { fromCarry(rec.carry); how = 'carry'; } catch (e) { console.error('[demo carry]', e); return false; }
      // 組み直したときは場所を持たない: 製品版の始まり（config.carryStart → 無ければ最後の町の代わりに config.start）
      const C = R.DB.config || {}, s = C.carryStart || C.start || {};
      const M = s.map && R.DB.maps[s.map];
      const sp = M && R.MapUtil && R.MapUtil.spawn ? R.MapUtil.spawn(M, s.spawn) : null;
      if (sp) R.Game.pos = { map: s.map, x: sp.x, y: sp.y, dir: sp.dir || 's' };
    }
    if (!how) return false;
    const G = R.Game;
    G.flags.demo_imported = true;
    G.flags.demo_imported_from = String(rec.version || '');
    if (R.DB.config && !R.DB.config.slice) delete G.flags.world_demo_end;   // 製品版では「体験版の終わり」はもう出さない（flag の有無で分かれる所を残さない）
    return how;
  };

  // ---------------------------------------------------------------- 別の置き場へ運ぶ 1 行（LCD1-<base64url>-<crc32>）
  function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0)); }
  function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(b) : decodeURIComponent(escape(String.fromCharCode.apply(null, b))); }
  function crc(bytes) {
    let c = -1;
    for (let i = 0; i < bytes.length; i++) { c ^= bytes[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    return ((c ^ -1) >>> 0).toString(36);
  }
  function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s), o = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; }
  /** 控えだけ（state は入れない。短く、版に強い）の 1 行 */
  DC.exportCode = function (rec) {
    rec = rec || DC.find();
    if (!valid(rec)) return null;
    const bytes = utf8(JSON.stringify({ kind: KIND, demo_clear: true, fmt: FMT, version: rec.version, t: rec.t, card: rec.card, carry: rec.carry }));
    return 'LCD1-' + b64(bytes) + '-' + crc(bytes);
  };
  /** 1 行を読んで置き場に書く → rec | null */
  DC.importCode = function (s) {
    try {
      const m = /^LCD1-([A-Za-z0-9_-]+)-([0-9a-z]+)$/.exec(String(s || '').replace(/\s+/g, ''));
      if (!m) return null;
      const bytes = unb64(m[1]);
      if (crc(bytes) !== m[2]) return null;
      const o = JSON.parse(unutf8(bytes));
      if (!valid(o)) return null;
      set(JSON.stringify(o));
      return o;
    } catch (e) { return null; }
  };

  /** 製品版の「はじめから」の前: 体験版の記録があれば聞く。引き継いだら true */
  DC.offer = async function () {
    if (R.DB.config && R.DB.config.slice) return false;
    const rec = DC.find();
    if (!rec) return false;
    const t = R.Screens && R.Screens.playTimeJa ? R.Screens.playTimeJa(rec.card && rec.card.playMs) : '';
    let i = 1;
    try {
      i = await R.UIK.Message.say({ text: '体験版の冒険の記録が\n見つかりました' + (t ? '（' + t + '）' : '') + '。\n引き継いで始めますか？', choices: ['引き継ぐ', '新しく始める'], cancel: 1, face: false });
    } catch (e) { return false; }
    if (i !== 0) return false;
    const how = DC.importRec(rec);
    if (how) { try { if (R.Analytics) R.Analytics.event('demo_carry_import', { how }); } catch (e) { /* */ } }
    return !!how;
  };

  // 製品版の差し込み口（体験版では何もしない）: はじめから（hero を渡されていない物）の前に聞く
  if (R.onBoot) R.onBoot(() => {
    const F = R.Flow;
    if (!F || F._carry) return;
    F._carry = true;
    const ng = F.newGame;
    F.newGame = async function (o) {
      if (!(R.DB.config && R.DB.config.slice) && !(o && o.hero) && !(o && o.noCarry)) {
        let yes = false;
        try { yes = await DC.offer(); } catch (e) { yes = false; }
        if (yes) { if (o && o.faded) R.Engine.fadeTo(0, 300); return F.resume(); }
      }
      return ng.apply(this, arguments);
    };
  });
})(window.RPG);
