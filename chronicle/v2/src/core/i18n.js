// I18n（CORE）: 画面に出す文の表と言語（Steam 版の多言語: ja（既定）・en・zh-Hans・zh-Hant・ko）
//
// 作り（2026-09-29）:
//   - 画面に出す文はすべて src/i18n/<言語>/<分野>.js の表にある（ui・battle・items・techs・events_<地方>・maps_<地方>…）。
//     ソースは R.T('key') で引く。key は <接頭辞>.<錨>.<項目>（items.w_sword_iron.name・ev.marsh_loch.loch_emma.say など）。
//   - 日本語の表が正本。ほかの言語は同じ key で訳を置き、無い key は日本語が出る。
//   - 新しい文は src/i18n/ja/<分野>.js に key を足して R.T で引く（または日本語のまま書いて tools/i18n_extract.js --write で移す）。
//     tools/i18n_audit.js が残りの直書き・key の抜け・訳の抜けと差し込みの食い違いを出し、tools/test_i18n.js が新しい直書きを止める。
//   - データの名前（道具・魔物…）は読み込みの時に表を引くので、言語を変えたら起こし直す（設定の言語の行。旅の途中は中断の記録から続ける）。
//   - 書体: 英語 Nunito、中国語・韓国語 Noto Sans SC/TC/KR（build.js が表の字だけ切り出す）。英語・韓国語は語で折り返す（UIK.wrap）。
//   - 題字の絵は言語ごと（title の 'logo_<言語>'。無ければ文字の題字）。名前の入力は日本語が五十音、ほかはラテン字の表
//     （中国語・韓国語の名前は IME か Steam の文字入力が要る。今はラテン字）。
//
//   R.T(key, params)            → 今の言語の文（無ければ日本語 → それも無ければ key。配列の文は写しの配列）
//   R.I18n.add(lang, table)     src/i18n/<lang>/*.js が登録する（同じ key の二度目は警告して上書きしない）
//   R.I18n.lang()               今の言語（'ja' | 'en' | 'zh-Hans' | 'zh-Hant' | 'ko'）
//   R.I18n.setLang(l)           言語を覚える。データの名前（道具・魔物…）は読み込みの時に決まるので、画面は R.I18n.restart() で起こし直す
//   R.I18n.has(key, lang) / keys(lang) / table(lang) / script() / isLatin() / fontStack() / format(s, params) / unwrap(s)（改行をほどく）
//
// 文の中の差し込み: {name} は params.name に置き換える（params に無い名前はそのまま残す = {hero} はイベントの側で入る）。
//   数の言い分け（英語などの単数・複数）: {n, plural, one {# item} other {# items}}（# は数。Intl.PluralRules で選ぶ。日本語は other だけ書けばよい）
//   言語ごとの選び分け: {sex, select, m {he} f {she} other {they}}
// 言語の決め方（読み込みの時。データの名前が読み込みの時に表を引くため）: URL の ?lang= → localStorage の <接頭辞>lang → 'ja'。
//   設定（R.Settings の 'lang'）は起動の後に読むので、食い違えば起こし直す（main.js）。
(function (R) {
  'use strict';
  const LANGS = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'];
  // 言語の名前はその言語で書く（言語の行はどの言語で見ても読めるように）
  const NATIVE = { ja: '日本語', en: 'English', 'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', ko: '한국어' };   // check_text:ignore i18n:ignore（言語の名前はその言語の字で）
  // 書体: 日本語は Zen Maru Gothic、英語は Nunito（丸いラテン字）、中国語・韓国語は Noto Sans の各地域版（漢字の字形が国ごとに違う）
  // 日本語の書体に無い字（設定の言語の行の「简体中文」「한국어」など）は、埋め込んだ Noto の小さな切り出しに落ちる
  const CJKFB = '"Noto Sans SC", "Noto Sans TC", "Noto Sans KR"';
  const FONT = {
    ja: `"Zen Maru Gothic", ${CJKFB}, "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif`,
    en: `"Nunito", "Zen Maru Gothic", ${CJKFB}, "Segoe UI", "Helvetica Neue", Arial, sans-serif`,
    'zh-Hans': '"Noto Sans SC", "Zen Maru Gothic", "Noto Sans TC", "Noto Sans KR", "Microsoft YaHei", "PingFang SC", sans-serif',
    'zh-Hant': '"Noto Sans TC", "Zen Maru Gothic", "Noto Sans SC", "Noto Sans KR", "Microsoft JhengHei", "PingFang TC", sans-serif',
    ko: '"Noto Sans KR", "Zen Maru Gothic", "Noto Sans SC", "Noto Sans TC", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  };
  // 起動の時に読み終えを待つ書体（main.js）
  const FAMILY = { ja: 'Zen Maru Gothic', en: 'Nunito', 'zh-Hans': 'Noto Sans SC', 'zh-Hant': 'Noto Sans TC', ko: 'Noto Sans KR' };
  const tables = {};
  for (const l of LANGS) tables[l] = Object.create(null);
  let cur = null;
  const missing = new Set();

  function lsGet(k) { try { const s = window.localStorage; return s ? s.getItem((R.SAVE_PREFIX || '') + k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { const s = window.localStorage; if (s) s.setItem((R.SAVE_PREFIX || '') + k, v); } catch (e) { /* 保存できない環境 */ } }
  /** 読み込みの時の言語（URL → localStorage → 既定） */
  function initial() {
    let q = null;
    try { const m = /[?&]lang=([A-Za-z-]+)/.exec((window.location && window.location.search) || ''); if (m) q = m[1]; } catch (e) { q = null; }
    for (const l of [q, lsGet('lang')]) { const n = norm(l); if (n) return n; }
    return 'ja';
  }
  /** 'zh-CN'・'zh_TW'・'EN' なども受ける（Steam やブラウザの言語名）→ LANGS のどれか | null */
  function norm(l) {
    if (!l) return null;
    const s = String(l).replace('_', '-').toLowerCase();
    if (s === 'ja' || s.startsWith('ja-') || s === 'japanese') return 'ja';
    if (s === 'en' || s.startsWith('en-') || s === 'english') return 'en';
    if (s === 'ko' || s.startsWith('ko-') || s === 'koreana' || s === 'korean') return 'ko';
    if (s === 'zh-hant' || s === 'zh-tw' || s === 'zh-hk' || s === 'zh-mo' || s === 'tchinese') return 'zh-Hant';
    if (s === 'zh' || s.startsWith('zh-') || s === 'schinese') return 'zh-Hans';
    return null;
  }

  // ---------------------------------------------------------------- 差し込み
  const plural = {};
  function pluralCat(lang, n) {
    try {
      if (typeof Intl !== 'undefined' && Intl.PluralRules) return (plural[lang] = plural[lang] || new Intl.PluralRules(lang)).select(n);
    } catch (e) { /* 古い環境 */ }
    return n === 1 ? 'one' : 'other';
  }
  /** {a, plural|select, k {…} …} の中身を読む → {k: 文} */
  function readCases(s) {
    const out = {};
    const re = /\s*(=?[\w-]+)\s*\{/g;
    let i = 0;
    while (i < s.length) {
      re.lastIndex = i;
      const m = re.exec(s);
      if (!m || m.index !== i && s.slice(i, m.index).trim()) break;
      let d = 1, j = re.lastIndex;
      for (; j < s.length && d; j++) { if (s[j] === '{') d++; else if (s[j] === '}') d--; }
      out[m[1]] = s.slice(re.lastIndex, j - 1);
      i = j;
    }
    return out;
  }
  function format(s, p, lang) {
    if (!p || typeof s !== 'string' || s.indexOf('{') < 0) return s;
    let out = '', i = 0;
    while (i < s.length) {
      const a = s.indexOf('{', i);
      if (a < 0) { out += s.slice(i); break; }
      out += s.slice(i, a);
      // 対応する } を探す（入れ子の {…} を数える）
      let d = 0, b = a;
      for (; b < s.length; b++) { if (s[b] === '{') d++; else if (s[b] === '}' && --d === 0) break; }
      if (b >= s.length) { out += s.slice(a); break; }
      const body = s.slice(a + 1, b);
      const m = /^\s*([A-Za-z_$][\w$]*)\s*(?:,\s*(plural|select)\s*,([\s\S]*))?$/.exec(body);
      // 差し込みでない {…}（{hero}・目標の {flags:…} など）はそのまま。中の {name} は置き換える
      if (!m || !Object.prototype.hasOwnProperty.call(p, m[1])) { out += '{'; i = a + 1; continue; }
      const v = p[m[1]];
      if (!m[2]) out += String(v);   // テンプレート文字列の ${v} と同じ（undefined も 'undefined'）
      else {
        const cases = readCases(m[3]);
        let pick;
        if (m[2] === 'plural') {
          const n = Number(v);
          pick = cases['=' + n] != null ? cases['=' + n] : cases[pluralCat(lang || cur || 'ja', n)];
          if (pick == null) pick = cases.other;
          out += format(String(pick == null ? '' : pick).replace(/#/g, String(v)), p, lang);
        } else {
          pick = cases[String(v)];
          if (pick == null) pick = cases.other;
          out += format(String(pick == null ? '' : pick), p, lang);
        }
      }
      i = b + 1;
    }
    return out;
  }

  const I18n = (R.I18n = {
    LANGS,
    NATIVE,
    FONT,
    FAMILY,
    norm,
    /** 表を足す（src/i18n/<lang>/*.js）。同じ key の二度目は警告だけ */
    add(lang, table) {
      const t = tables[lang];
      if (!t) { R.warn('i18n: unknown language ' + lang); return; }
      for (const k of Object.keys(table)) {
        if (k in t) { const msg = `i18n: duplicate key ${lang}:${k} (ignored)`; (R.loadErrors || []).push(msg); R.warn(msg); continue; }
        t[k] = table[k];
      }
    },
    lang() { if (!cur) cur = initial(); return cur; },
    /** 言語を変えて覚える（画面の文はその場で、データの名前は restart の後に変わる）→ 変わったら true */
    setLang(l) {
      const n = norm(l);
      if (!n) return false;
      lsSet('lang', n);
      if (n === I18n.lang()) return false;
      cur = n;
      if (R.Gfx && R.Gfx.clearMeasure) R.Gfx.clearMeasure();
      if (R.emit) R.emit('lang', { lang: n });
      return true;
    },
    /** 文を引く */
    t(key, params) {
      const l = I18n.lang();
      let v = tables[l][key];
      if (v === undefined && l !== 'ja') v = tables.ja[key];
      if (v === undefined) {
        if (!missing.has(key)) { missing.add(key); if (R.warn) R.warn('i18n: missing key ' + key); }
        return key;
      }
      if (Array.isArray(v)) return v.map((s) => format(s, params, l));
      return format(v, params, l);
    },
    has(key, lang) { return tables[lang || 'ja'][key] !== undefined; },
    keys(lang) { return Object.keys(tables[lang || 'ja']); },
    table(lang) { return tables[lang || 'ja']; },
    missing() { return [...missing]; },
    format(s, p, lang) { return format(s, p, lang); },
    /** 'latin'（空白で語を分ける: en）| 'cjk'（字ごとに折り返せる: ja zh ko。韓国語は語の間に空白があるが、字ごとでも読める。語で折る方を選ぶ） */
    script(lang) { const l = lang || I18n.lang(); return l === 'en' ? 'latin' : l === 'ko' ? 'hangul' : 'cjk'; },
    isLatin(lang) { return I18n.script(lang) === 'latin'; },
    /** 語を空白で折り返す言語か（英語・韓国語） */
    wrapsByWord(lang) { const s = I18n.script(lang); return s === 'latin' || s === 'hangul'; },
    fontStack(lang) { return FONT[lang || I18n.lang()] || FONT.ja; },
    /** 表の中の改行（日本語の行の区切り）をほどく: 日本語・中国語はつなぐだけ、英語・韓国語は空白に（折り返しは UIK.wrap に任せる所で使う） */
    unwrap(s, lang) { return String(s == null ? '' : s).replace(/[ \t]*\n[ \t]*/g, I18n.wrapsByWord(lang) ? ' ' : ''); },
    /** 起こし直す（ブラウザ・デスクトップ版の窓を読み直す。node では何もしない） */
    restart() {
      try { if (typeof location !== 'undefined' && location.reload) { location.reload(); return true; } } catch (e) { /* 読み直せない */ }
      return false;
    },
  });
  R.T = I18n.t;
  // 題名（ns.js の R.TITLE・R.SUBTITLE）は言語で変わる
  for (const [k, key] of [['TITLE', 'ui.game.title'], ['SUBTITLE', 'ui.game.subtitle']]) {
    const ja = R[k];
    Object.defineProperty(R, k, { configurable: true, enumerable: true, get: () => (tables[I18n.lang()][key] !== undefined || tables.ja[key] !== undefined ? I18n.t(key) : ja) });
  }
})(window.RPG);
