// Save（CORE）: 記録 3 枠＋オート＋中断、冒険の合言葉、戦闘の直前の写し（V2_PLAN §2.5.3・§3.13）
//
// 保存するのは R.State.serialize() の結果だけ（形は EVENTS が持つ）。記録 = {ver: 2, card, state, t}
// 接頭辞 luminous_chronicle_v2_。版が違う・読めない記録は札に {bad:'old'} を返し、読まない（止まらない・壊れない）
// 札に Lv を出さない（章＝クリアした地方の数）
// 使える所: R.Storage（デスクトップ版はファイル、ブラウザは localStorage、使えない環境ではメモリだけ＝ページを閉じると消える）
(function (R) {
  'use strict';
  const SLOTS = ['auto', 'suspend', 's1', 's2', 's3'];
  const VER = 2;
  const checkpoints = {}; // tag → {state, extra}（メモリの中だけ）

  // 置き場は R.Storage（core/storage.js）: デスクトップ版はファイル、ブラウザは localStorage、どちらも無ければメモリ
  function rawGet(k) { return R.Storage.get(k); }
  function rawSet(k, v) { return R.Storage.set(k, v); }
  function rawDel(k) { R.Storage.remove(k); }

  /** 今の R.Game から札を作る */
  function makeCard() {
    const G = R.Game || {};
    const pos = G.pos || {};
    const map = pos.map && R.DB.maps[pos.map];
    const loc = map && map.location && R.DB.locations[map.location];
    const chars = G.chars || {};
    const card = {
      place: (map && map.name) || (loc && loc.name) || pos.map || '',
      chapter: Object.keys(G.cleared || {}).filter((k) => G.cleared[k]).length,
      playMs: Math.floor(G.playMs || 0),
      date: Date.now(),
      faces: (G.party || []).map((id) => (chars[id] && chars[id].look) || id).slice(0, 4),
    };
    if (G.flags && G.flags.final_clear) card.clear = true;   // クリアの記録（エンディングの後。札に「クリア」の印。つづきはロアの里から）
    if (G.testerUsed) card.test = true;   // テスト用メニュー（src/tester/）を使った旅: 札に「TEST」の印（使っていなければ項目も無い）
    return card;
  }
  function serialize() {
    if (!R.State || !R.State.serialize) throw new Error('R.State.serialize is missing');
    return R.State.serialize();
  }
  function parse(raw) {
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (!o || o.ver !== VER || !o.state || !o.card) return { bad: 'old' };
      return o;
    } catch (e) { return { bad: 'old' }; }
  }

  // ---------------------------------------------------------------- 合言葉の符号（base64url＋crc32）
  function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(unescape(encodeURIComponent(s)), (c) => c.charCodeAt(0)); }
  function unutf8(b) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(b) : decodeURIComponent(escape(String.fromCharCode.apply(null, b))); }
  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const s = atob(str), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  let CRC = null;
  function crc32(bytes) {
    if (!CRC) { CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
    let c = -1;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return ((c ^ -1) >>> 0).toString(36);
  }

  const Save = (R.Save = {
    SLOTS,
    VER,
    /** [{slot, card | {bad:'old'} | null}] */
    cards() {
      return SLOTS.map((slot) => {
        const o = parse(rawGet('slot_' + slot));
        return { slot, card: o ? (o.bad ? { bad: o.bad } : o.card) : null };
      });
    },
    save(slot) {
      if (!SLOTS.includes(slot)) { R.warn('bad save slot ' + slot); return false; }
      // 戦闘の中はセーブしない（Part A「戦闘の外ならどこでも」。戦闘の直前の写しは checkpoint を使う）
      if (R.Engine && R.Engine.has && R.Engine.has('battle')) { R.warn('save refused during battle: ' + slot); return false; }
      let rec;
      try { rec = { ver: VER, card: makeCard(), state: serialize(), t: Date.now() }; } catch (e) { console.error('[save]', e); return false; }
      const ok = rawSet('slot_' + slot, JSON.stringify(rec));
      if (slot !== 'auto' && slot !== 'suspend') rawSet('last', slot);
      R.emit('save', { slot, ok });
      return true;
    },
    load(slot) {
      const o = parse(rawGet('slot_' + slot));
      if (!o || o.bad) return false;
      let ok = false;
      try { ok = !!R.State.deserialize(R.U.clone(o.state)); } catch (e) { console.error('[load]', e); ok = false; }
      if (ok && slot === 'suspend') Save.remove('suspend');
      return ok;
    },
    remove(slot) { rawDel('slot_' + slot); },
    /** 'map'|'battle'|'inn'|'boss'。右上に 2.4 秒の通知（R.UIK.toast。会話の窓が開いている間は出さない） */
    autosave(reason) {
      const ok = Save.save('auto');
      if (ok) {
        try { if (R.UIK && R.UIK.toast) R.UIK.toast(R.T('ui.save.Save.autosave.toast'), { icon: 'save', ms: 2400, anchor: 'bl' }); } catch (e) { console.error(e); }
        R.emit('autosave', { reason });
      }
      return ok;
    },
    /** 中断（読み込むと消える） */
    suspend() { return Save.save('suspend'); },
    /** 最後に記録した枠（'s1' など）か null */
    lastSlot() { return rawGet('last'); },
    /** 冒険の合言葉（A2）: 今の状態を 1 行の文字にする */
    passphrase() {
      const bytes = utf8(JSON.stringify({ ver: VER, state: serialize() }));
      return 'LC2-' + b64url(bytes) + '-' + crc32(bytes);
    },
    fromPassphrase(s) {
      try {
        const m = /^LC2-([A-Za-z0-9_-]+)-([0-9a-z]+)$/.exec(String(s || '').replace(/\s+/g, ''));
        if (!m) return false;
        const bytes = unb64url(m[1]);
        if (crc32(bytes) !== m[2]) return false;
        const o = JSON.parse(unutf8(bytes));
        if (!o || o.ver !== VER || !o.state) return false;
        return !!R.State.deserialize(o.state);
      } catch (e) { return false; }
    },
    /** メモリの中だけの写し。tag 'battle' は戦闘の直前（extra に setup と種を入れる） */
    checkpoint(tag, extra) {
      try { checkpoints[tag] = { state: serialize(), extra: extra == null ? null : R.U.clone(extra) }; return true; } catch (e) { console.error('[checkpoint]', e); return false; }
    },
    restore(tag) {
      const c = checkpoints[tag];
      if (!c) return false;
      try { return !!R.State.deserialize(R.U.clone(c.state)); } catch (e) { console.error('[restore]', e); return false; }
    },
    /** checkpoint で預けた extra（無ければ null） */
    checkpointData(tag) { const c = checkpoints[tag]; return c ? R.U.clone(c.extra) : null; },
    dropCheckpoint(tag) { delete checkpoints[tag]; },
    /** テスト用: 生の記録を書く（版違いの札の確かめ） */
    _raw(slot, str) { if (str === undefined) return rawGet('slot_' + slot); rawSet('slot_' + slot, str); return true; },
  });
})(window.RPG);
