// Media（CORE）: 録音の BGM・ボイス・顔絵の一覧 window.RPG_MEDIA の読み方（V2_PLAN §2.5.4・§2.7・§6.2）
//
// window.RPG_MEDIA = {bgm: {id: {url, loopStart, loopEnd, gain, loop}}, voice: {id: url}, portraits: {key: url},
//                     sprites: {'<look>:<kind>': {url, meta}}}   ← 版 2: CAST の原画の取り込み（v2/assets/sprites/<look>/<kind>.png＋.json）
//                     sfx: {'<id>.<k>': url}   ← 録音の効果音の 1 本（k = 取り直しの番号。core/audio.js が id ごとにまとめる）
//                     amb: {'<床>': {url, loopStart, loopEnd}}   ← 録音の環境音の床（design/notes/audio.md §15.1）
//                     voice_en: {id: url}   ← 英語のボイス（chronicle/assets/voice/en。2026-10-10）
//   言語ごとのボイス: ゲームの言語（R.I18n.lang()）が en のとき、'voice' の id は voice_en を先に引き、無ければ日本語の voice。
//   ほかの言語は今は日本語の声のまま（voice_<言語> の表が無い）。has / entry / url / bytes のどれも同じ決まり。
//   url は相対パス（外に置いた版: bgm/<id>.ogg）か '#media:<kind>:<id>'（--single の埋め込み）。
//   埋め込みは <script type="application/octet-stream" id="media:<kind>:<id>" data-type="audio/ogg">base64</script>
//   で置かれ、起動時には解かない。初めて使うときに bytes() / url() が解く（Blob にして URL を作る）。
//   まとめた版（tools/pack_web.py、ファイルの数を減らす公開用の写し）:
//     画像 {url: 'env/atlas_03.webp', rect: [x, y, w, h], meta} = 地図帳（atlas）の一部。image() が切り出して canvas にする
//     音   {url: 'voice/pack_2.ogg', off, len} = つないだ Ogg（chained）の一部。bytes() がその範囲だけを返す
// 実行時に外へ通信しない（相対 URL は同じ所に置いたファイル）。
(function (R) {
  'use strict';
  const blobUrls = {};
  const images = {};
  const atlases = {};   // url → {img, ready, failed, promise, pending}（頼まれた切り出しが済んだら地図帳を手放す。あとで別の部分を頼まれたら読み直す）
  const packs = {};     // url → Promise<ArrayBuffer>
  function atlas(kind, url) {
    let a = atlases[url];
    if (a) return a;
    a = atlases[url] = { img: new Image(), ready: false, failed: false, promise: null, pending: 0 };
    a.promise = new Promise((res) => {
      // 読めたら先に decode() で解いておく（2026-09-29 性能: 切り出しの drawImage が主の糸で 2048² の WebP を解いて、起動の間
      // タイトルが止まっていた。decode() は裏の糸で解く）。decode が無い・失敗したときはそのまま（切り出しの時に解く）
      a.img.onload = () => {
        const ok = () => { a.ready = true; res(a); };
        if (a.img && a.img.decode) a.img.decode().then(ok, ok); else ok();
      };
      a.img.onerror = () => { a.failed = true; res(a); };
    });
    a.img.src = url;
    return a;
  }
  function fetchPack(url) {
    if (!packs[url]) packs[url] = fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).catch((e) => { delete packs[url]; throw e; });
    return packs[url];
  }

  function table() {
    const M = (typeof window !== 'undefined' && window.RPG_MEDIA) || R.MEDIA || {};
    M.bgm = M.bgm || {}; M.voice = M.voice || {}; M.portraits = M.portraits || {}; M.sprites = M.sprites || {}; M.title = M.title || {}; M.sfx = M.sfx || {}; M.amb = M.amb || {};
    return M;
  }
  const own = (t, id) => !!t && Object.prototype.hasOwnProperty.call(t, id);
  /** 今の言語のボイスの表の名前（'voice_en'）。日本語・表の無い言語は null */
  function voiceLangKind() {
    const l = R.I18n && R.I18n.lang ? R.I18n.lang() : 'ja';
    return l && l !== 'ja' ? 'voice_' + l : null;
  }
  function raw(kind, id) {
    const M = table();
    if (kind === 'voice') {
      const lk = voiceLangKind();
      if (lk && own(M[lk], id)) return M[lk][id];
    }
    const t = M[kind];
    return own(t, id) ? t[id] : null;
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

  // 読み込みの数（R.Loading の進みの棒が読む）: req = 読み始めた画像、done = 読み終えた（読めなかった物も）
  const stat = { req: 0, done: 0 };
  function count(rec) { stat.req++; rec.promise.then(() => { stat.done++; }, () => { stat.done++; }); return rec; }

  const Media = (R.Media = {
    table,
    stat,
    has(kind, id) { return !!raw(kind, id); },
    /** 'voice' の id がどの表から鳴るか（'voice_en' | 'voice' | null。テスト・QA 用） */
    voiceSource(id) {
      const lk = voiceLangKind(), M = table();
      return lk && own(M[lk], id) ? lk : own(M.voice, id) ? 'voice' : null;
    },
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
      if (typeof e.len === 'number') return fetchPack(e.url).then((ab) => ab.slice(e.off || 0, (e.off || 0) + e.len));
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
      if (Array.isArray(e.rect) && typeof document !== 'undefined') {
        // 地図帳の一部: 同じ大きさの canvas を先に渡し、地図帳が読めたら切り出す
        const [x, y, w, h] = e.rect;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const rec = { img: c, ready: false, failed: false, meta: e.meta || null, promise: null };
        const a = atlas(kind, url);
        a.pending++;
        rec.promise = a.promise.then(() => {
          if (a.failed) { rec.failed = true; } else {
            try { c.getContext('2d').drawImage(a.img, x, y, w, h, 0, 0, w, h); rec.ready = true; } catch (err) { rec.failed = true; }
          }
          // 待っている切り出しが無くなったら地図帳の画像を手放す（展開した地図帳を持ち続けない）
          if (--a.pending <= 0) { a.img = null; if (atlases[url] === a) delete atlases[url]; }
          return rec;
        });
        images[ik] = count(rec);
        return rec;
      }
      const rec = { img: new Image(), ready: false, failed: false, meta: e.meta || null, promise: null };
      rec.promise = new Promise((res) => {
        rec.img.onload = () => { rec.ready = true; res(rec); };
        rec.img.onerror = () => { rec.failed = true; res(rec); };
      });
      rec.img.src = url;
      images[ik] = count(rec);
      return rec;
    },
    /** 読んだ画像を手放す（覚えを消すだけ。使っている所が無くなれば GC が展開した画素を返す。次に image() で読み直す） */
    release(key, kind) {
      const ik = (kind || 'portraits') + '|' + key;
      if (!images[ik]) return false;
      delete images[ik];
      return true;
    },
    /** 画像をまとめて先に読む（CAST が R.onBoot で sprites を読む用）。→ Promise<読めた数>。失敗しても解決する */
    preload(kind, keys) {
      const t = table()[kind] || {};
      const list = (keys || Object.keys(t)).map((k) => Media.image(k, kind)).filter(Boolean);
      return Promise.all(list.map((r) => r.promise)).then((rs) => rs.filter((r) => r.ready).length);
    },
  });
})(window.RPG);
