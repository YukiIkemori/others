// Media（CORE）: 録音の BGM・ボイス・顔絵の一覧 window.RPG_MEDIA の読み方（V2_PLAN §2.5.4・§2.7・§6.2）
//
// window.RPG_MEDIA = {bgm: {id: {url, loopStart, loopEnd, gain, loop}}, voice: {id: url}, portraits: {key: url},
//                     sprites: {'<look>:<kind>': {url, meta}}}   ← 版 2: CAST の原画の取り込み（v2/assets/sprites/<look>/<kind>.png＋.json）
//   url は相対パス（外に置いた版: bgm/<id>.ogg）か '#media:<kind>:<id>'（--single の埋め込み）。
//   埋め込みは <script type="application/octet-stream" id="media:<kind>:<id>" data-type="audio/ogg">base64</script>
//   で置かれ、起動時には解かない。初めて使うときに bytes() / url() が解く（Blob にして URL を作る）。
// 実行時に外へ通信しない（相対 URL は同じ所に置いたファイル）。
(function (R) {
  'use strict';
  const blobUrls = {};
  const images = {};

  function table() {
    const M = (typeof window !== 'undefined' && window.RPG_MEDIA) || R.MEDIA || {};
    M.bgm = M.bgm || {}; M.voice = M.voice || {}; M.portraits = M.portraits || {}; M.sprites = M.sprites || {};
    return M;
  }
  function raw(kind, id) {
    const t = table()[kind];
    return t && Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null;
  }
  function embedded(ref) {
    if (typeof document === 'undefined' || !document.getElementById) return null;
    const el = document.getElementById(ref.slice(1));
    return el ? { b64: el.textContent.trim(), type: el.getAttribute('data-type') || 'application/octet-stream' } : null;
  }
  function b64ToBytes(b64) {
    const s = atob(b64), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }

  const Media = (R.Media = {
    table,
    has(kind, id) { return !!raw(kind, id); },
    /** bgm: {url, loopStart, loopEnd, gain, loop} / voice・portraits: {url} / 無ければ null */
    entry(kind, id) {
      const e = raw(kind, id);
      if (!e) return null;
      return typeof e === 'string' ? { url: e } : e;
    },
    /** 使える URL（埋め込みは初めてのときに Blob にする） */
    url(kind, id) {
      const e = Media.entry(kind, id);
      if (!e) return null;
      if (e.url.charAt(0) !== '#') return e.url;
      if (blobUrls[e.url]) return blobUrls[e.url];
      const d = embedded(e.url);
      if (!d) return null;
      const u = URL.createObjectURL(new Blob([b64ToBytes(d.b64)], { type: d.type }));
      blobUrls[e.url] = u;
      return u;
    },
    /** → Promise<ArrayBuffer>（音を解く用）。埋め込みは base64 から、外は fetch */
    bytes(kind, id) {
      const e = Media.entry(kind, id);
      if (!e) return Promise.reject(new Error(`no media ${kind}:${id}`));
      if (e.url.charAt(0) === '#') {
        const d = embedded(e.url);
        if (!d) return Promise.reject(new Error(`embedded media missing ${e.url}`));
        return Promise.resolve(b64ToBytes(d.b64).buffer);
      }
      return fetch(e.url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
    },
    /** 画像。→ {img, ready, failed, meta, promise} | null。初めて呼んだときに読み込みを始める（decode の間は ready false）。
     *  kind は 'portraits'（既定。key = 'portrait:<look>:<expr>'）か 'sprites'（key = '<look>:<kind>'、meta はその .json） */
    image(key, kind) {
      kind = kind || 'portraits';
      const ik = kind + '|' + key;
      if (images[ik]) return images[ik];
      if (typeof Image === 'undefined') return null;
      const url = Media.url(kind, key);
      if (!url) return null;
      const e = Media.entry(kind, key) || {};
      const rec = { img: new Image(), ready: false, failed: false, meta: e.meta || null, promise: null };
      rec.promise = new Promise((res) => {
        rec.img.onload = () => { rec.ready = true; res(rec); };
        rec.img.onerror = () => { rec.failed = true; res(rec); };
      });
      rec.img.src = url;
      images[ik] = rec;
      return rec;
    },
    /** 画像をまとめて先に読む（CAST が R.onBoot で sprites を読む用）。→ Promise<読めた数>。失敗しても解決する */
    preload(kind, keys) {
      const t = table()[kind] || {};
      const list = (keys || Object.keys(t)).map((k) => Media.image(k, kind)).filter(Boolean);
      return Promise.all(list.map((r) => r.promise)).then((rs) => rs.filter((r) => r.ready).length);
    },
  });
})(window.RPG);
