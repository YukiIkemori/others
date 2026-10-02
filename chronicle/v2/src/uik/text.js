// UIK: 文字（MODERN_UI §3.1）。text / measure / fit / fitSize / wrap
//   o = {size, weight, color, align, baseline, shadow, family:'jp'|'en', track, grad:[色…], stroke:[色, 太さ], maxW, alpha}
//   size は掛けた後の論理 px（既定は本文 × uiScale）。baseline の既定は 'top'（y は字の上端）。
//   maxW を渡すと、はみ出すときは 0.85 倍まで縮め、それでも入らなければ末尾を「…」にする。
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  const MIN_SHRINK = 0.85;

  function size(o) { return (o && o.size) || UIK.u(UIK.T.size.body); }
  function weight(o) { return (o && o.weight) || 500; }
  // 字間（o.track）は日本語の見出し用。ラテン字の言語（英語）では 1/4 に（語の中が離れて読みにくい）。書体 'en'（Cinzel）の飾りの字間はそのまま
  function track(o) { if (!o || !o.track) return 0; return o.family !== 'en' && R.I18n && R.I18n.isLatin() ? o.track * 0.25 : o.track; }

  /** 文字の幅（論理 px。R.Gfx.measure のキャッシュを使う）。字間 o.track も数える */
  UIK.measure = function (s, o) {
    s = s == null ? '' : String(s);
    const w = R.Gfx.measure(s, { size: size(o), weight: weight(o), family: o && o.family });
    if (o && o.track) return w + track(o) * Math.max(0, [...s].length - 1);
    return w;
  };

  /** w に入るように: → {s, size}（縮める → それでも入らなければ …） */
  UIK.fitSize = function (s, w, o) {
    s = s == null ? '' : String(s);
    let sz = size(o);
    const oo = Object.assign({}, o, { size: sz });
    if (UIK.measure(s, oo) <= w) return { s, size: sz };
    const minSz = sz * MIN_SHRINK;
    const need = sz * w / UIK.measure(s, oo);
    if (need >= minSz) { sz = Math.floor(need * 4) / 4; oo.size = sz; if (UIK.measure(s, oo) <= w) return { s, size: sz }; }
    sz = minSz; oo.size = sz;
    const a = [...s];
    while (a.length && UIK.measure(a.join('') + '…', oo) > w) a.pop();
    return { s: a.join('') + '…', size: sz };
  };
  /** w に入らなければ末尾を … にした文字（大きさは変えない） */
  UIK.fit = function (s, w, o) {
    s = s == null ? '' : String(s);
    if (UIK.measure(s, o) <= w) return s;
    const a = [...s];
    while (a.length && UIK.measure(a.join('') + '…', o) > w) a.pop();
    return a.join('') + '…';
  };

  // 行頭に来てはいけない字（禁則の最小）
  const NO_HEAD = '、。，．・：；？！ー」』）】〉》〕…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ,.!?)]';   // i18n:ignore（禁則の字の表）
  /** 文を w で折り返した行の配列（\n はそのまま改行。英字の語は切らない） */
  UIK.wrap = function (s, w, o) {
    if (R.I18n && R.I18n.wrapsByWord()) return wrapWords(s, w, o);
    const out = [];
    for (const para of String(s == null ? '' : s).split(/[\n\f]/)) {  // '\f'（窓の区切り）は窓の外では改行と同じ
      const ch = [...para];
      let line = '';
      for (let i = 0; i < ch.length; i++) {
        const c = ch[i];
        const next = line + c;
        if (line && UIK.measure(next, o) > w && NO_HEAD.indexOf(c) < 0) {
          // 英字の語の途中なら語の頭まで戻す
          const m = /[A-Za-z0-9]+$/.exec(line);
          if (m && /[A-Za-z0-9]/.test(c) && m.index > 0) { out.push(line.slice(0, m.index)); line = m[0] + c; }
          else { out.push(line); line = c; }
        } else line = next;
      }
      out.push(line);
    }
    return out;
  };

  /**
   * 語で折り返す（英語・韓国語。空白で語を分け、行の頭の空白は捨てる）。1 語が w より長いときだけ字で切る。
   * 行の中の CJK の字（固有名詞の日本語が残ったときなど）は字ごとに折れる。
   */
  function wrapWords(s, w, o) {
    const out = [];
    const CJK = /[　-ヿ㐀-鿿豈-﫿＀-￯]/;
    for (const para of String(s == null ? '' : s).split(/[\n\f]/)) {  // '\f'（窓の区切り）は窓の外では改行と同じ
      // 語（空白を含まない塊）と空白に分ける。CJK の字は 1 字を 1 語に
      const toks = [];
      for (const m of para.matchAll(/\s+|[^\s]+/g)) {
        const t = m[0];
        if (!/\s/.test(t[0]) && CJK.test(t)) { let buf = ''; for (const c of t) { if (CJK.test(c)) { if (buf) toks.push(buf); buf = ''; toks.push(c); } else buf += c; } if (buf) toks.push(buf); }
        else toks.push(t);
      }
      let line = '';
      for (const t of toks) {
        if (/^\s+$/.test(t)) { if (line) line += t; continue; }
        const next = line + t;
        if (!line || UIK.measure(next, o) <= w || (t.length === 1 && NO_HEAD.indexOf(t) >= 0)) { line = next; }
        else { out.push(line.replace(/\s+$/, '')); line = t; }
        // 1 語が長すぎる: 字で切る
        while (UIK.measure(line, o) > w && [...line].length > 1) {
          const a = [...line];
          let k = a.length - 1;
          while (k > 1 && UIK.measure(a.slice(0, k).join(''), o) > w) k--;
          out.push(a.slice(0, k).join(''));
          line = a.slice(k).join('');
        }
      }
      out.push(line.replace(/\s+$/, ''));
    }
    return out;
  }

  /**
   * 説明文を n 行の箱に収める: → {lines, size, lh}。o = {size（既定の字）, min（縮める下限、既定 size × 0.82）, lh（行の高さ ÷ 字、既定 1.66）}
   *   既定の大きさで n 行に入らなければ 0.25 ずつ小さくして折り返し直す。下限でも入らなければ n 行目の末尾を「…」（途中で黙って切らない。テスト報告 P7）
   */
  UIK.wrapFit = function (s, w, n, o) {
    o = o || {};
    const base = size(o), lo = Math.min(base, o.min || base * 0.82), k = o.lh || 1.66;
    n = Math.max(1, n | 0);
    let sz = base, lines = UIK.wrap(s, w, Object.assign({}, o, { size: sz }));
    while (lines.length > n && sz - 0.25 >= lo - 1e-6) { sz -= 0.25; lines = UIK.wrap(s, w, Object.assign({}, o, { size: sz })); }
    if (lines.length > n) {
      const rest = lines.slice(n - 1).join('');
      lines = lines.slice(0, n - 1).concat([UIK.fit(rest, w, Object.assign({}, o, { size: sz }))]);
    }
    return { lines, size: sz, lh: sz * k };
  };

  /** 文字を描く。→ 描いた幅 */
  UIK.text = function (g, s, x, y, o) {
    o = o || {};
    s = s == null ? '' : String(s);
    let sz = size(o);
    if (o.maxW) { const f = UIK.fitSize(s, o.maxW, o); s = f.s; sz = f.size; }
    const fam = o.family === 'en' ? 'en' : 'jp';
    g.save();
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.font = R.Gfx.font(sz, weight(o), fam);
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'top';
    if (o.track && 'letterSpacing' in g) g.letterSpacing = track(o) + 'px';
    if (o.shadow) {
      g.shadowColor = o.shadow === true ? 'rgba(2,3,8,0.85)' : o.shadow;
      g.shadowBlur = (o.blur != null ? o.blur : 4) * (R.SCALE || 2) / 2;
      g.shadowOffsetY = (R.SCALE || 2) / 2;
    }
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.stroke[1]; g.strokeStyle = o.stroke[0]; g.strokeText(s, x, y); }
    if (o.grad) {
      const top = g.textBaseline === 'top' ? y : y - sz;
      const gr = g.createLinearGradient(0, top, 0, top + sz);
      for (let i = 0; i < o.grad.length; i++) gr.addColorStop(i / (o.grad.length - 1), o.grad[i]);
      g.fillStyle = gr;
    } else g.fillStyle = o.color || UIK.T.color.text;
    g.fillText(s, x, y);
    g.restore();
    return UIK.measure(s, { size: sz, weight: weight(o), family: o.family, track: o.track });
  };
})(window.RPG);
