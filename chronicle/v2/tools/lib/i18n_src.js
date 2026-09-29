// テスト用: ソースの R.T('key') を日本語の表（src/i18n/ja）の文に戻す（文面を正規表現で確かめるテスト・QA 用）
//   const { inline } = require('./lib/i18n_src');  inline(src) → 'R.T(\'k\')' を '文'（配列は ['文', …]）に置き換えた文字
//   差し込みのある R.T('k', { … }) は (`…${name}…`, { … }) になる（文面を正規表現で探す用。コードとしては読まない）
'use strict';
const { readTables } = require('../i18n_audit.js');
let JA = null;
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
function inline(src) {
  if (!JA) JA = readTables().T.ja;
  const tpl = (v) => '`' + String(v).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\n/g, '\\n').replace(/\{([A-Za-z_$][\w$]*)\}/g, '${$1}') + '`';
  const lit = (v) => (Array.isArray(v) ? '[' + v.map(q).join(', ') + ']' : q(v));
  return String(src)
    .replace(/R\.T\('((?:[^'\\]|\\.)*)'\)/g, (m, k) => (JA[k] === undefined ? m : lit(JA[k])))
    // 差し込みのある呼び出しは文だけ（後ろの , { … }) はそのまま残る。文面を正規表現で探す用）
    // 元がテンプレート文字列だった物は `…${name}…` の形に（元の書き方と同じ字句にして、'…' を探す検査が拾い方を変えない）
    .replace(/R\.T\('((?:[^'\\]|\\.)*)'(?=\s*,)/g, (m, k) => (JA[k] === undefined ? m : '(' + [].concat(JA[k]).map(tpl).join(', ')));
}
/** 表の日本語の文を全部（key → 文）。配列は改行でつなぐ */
function jaTexts() { if (!JA) JA = readTables().T.ja; return JA; }
module.exports = { inline, jaTexts };
