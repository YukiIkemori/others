#!/usr/bin/env node
// QA: 文の検査（V2_PLAN §3.16 の 3「check_text」、STYLE_JA §10）。node だけ。
//
//   node v2/tools/qa/check_text.js [--warn] [--all]
//
// STYLE_JA の一覧（§7.1 部分一致・§7.2 完全一致・§7.3 src 全体・§2 常用外の字）は STYLE_JA.md から読み、文字列の切り出し・幅・空白・三点リーダーの
// 判定は今のゲームの tools/check_text.js の関数を読むだけで使う（あちらは編集しない）。対象は v2/src/**/*.js の日本語を含む文字列。
//  1 他社の名前: 技・術・敵の行動・品・魔物の名前（§7.1・§7.2）      2 §7.3 の語が src のどこかに
//  3 常用外の字（chronicle/tools/lib/joyo.txt と §2 の一覧）          4 分かち書き・許されない全角スペース
//  5 三点リーダー（2 つ組・文末）                                     6 会話の 1 行が 20 字を超える（イベント・マップ・手紙。{hero} = 5 字）
//  7 主人公の名前の直書き・{yuki} など                                8 「〇にする」「〇にならない」
// 警告（--warn で出す）: 魔法・魔力、§3 の表記ゆれ、全角数字、18 字を超える行（目安 16 字）。
'use strict';
const fs = require('fs');
const path = require('path');
const OLD = require('../../../tools/check_text.js');   // 読むだけ（strings・width・readStyle・checkSpacing・checkEllipsis）

const V2 = path.resolve(__dirname, '..', '..');
const CHRON = path.resolve(V2, '..');
const argv = process.argv.slice(2);
const WARN = argv.includes('--warn');

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    // 文の表（src/i18n）は日本語（ja）だけを見る（訳の表の中国語などは常用漢字の決まりの外）
    if (fs.statSync(p).isDirectory()) { if (!/stubs|dev/.test(f) && !(path.basename(dir) === 'i18n' && f !== 'ja')) out.push(...walk(p)); } else if (/\.js$/.test(f)) out.push(p);
  }
  return out;
}

function run() {
  const R = require('../lib/load')({ quiet: true });
  const DB = R.DB;
  const style = OLD.readStyle();
  const partial = [...new Set(style.partial.concat(['キング']))];
  const exact = new Set(style.exact);
  const srcBanned = [...new Set(style.src.concat(['スライム', 'メタル']))];
  const SRC_EXC = ['魔法都市アルカナ', '魔法学院', '魔法の天才'];
  const errors = [], warns = [];
  const E = (rule, msg) => errors.push(rule + ' ' + msg), W = (rule, msg) => warns.push(rule + ' ' + msg);
  const clip = (s) => { s = String(s).replace(/\n/g, '⏎'); return s.length > 36 ? s.slice(0, 36) + '…' : s; };

  // 1. 名前
  const named = [];
  for (const [id, a] of Object.entries(DB.actions || {})) named.push([id, a && a.name]);
  for (const [id, a] of Object.entries(DB.techs || {})) named.push([id, a && a.name]);
  for (const [id, a] of Object.entries(DB.spells || {})) named.push([id, a && a.name]);
  for (const [id, a] of Object.entries(DB.enemyActions || {})) named.push([id, a && a.name]);
  for (const [id, it] of Object.entries(DB.items || {})) named.push([id, it && it.name]);
  for (const [id, m] of Object.entries(DB.monsters || {})) { if (/^stub_/.test(id)) continue; named.push([id, m && m.name]); if (m && m.goldName) named.push([id, m.goldName]); }
  for (const [id, name] of named) {
    if (!name) continue;
    const hit = partial.find((w) => name.includes(w));
    if (hit) E('T1', `${id} '${name}' contains '${hit}' (STYLE_JA §7.1)`);
    if (exact.has(name)) E('T1', `${id} '${name}' is a banned name (§7.2)`);
  }
  // 2〜8. 文字列
  const jf = path.join(CHRON, 'tools', 'lib', 'joyo.txt');
  const joyo = fs.existsSync(jf) ? new Set([...fs.readFileSync(jf, 'utf8').replace(/\s+/g, '')]) : null;
  if (!joyo) W('T3', 'joyo.txt not found; kanji check skipped');
  const allowed = new Set([...style.allowedKanji, '毅']);   // 毅: クレジットの人名（持ち主 2026-10-02）
  const JP = /[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]/, KANJI = /[㐀-䶿一-鿿豈-﫿]/;
  const STATUS = ['眠り', 'まひ', '凍結', '気絶', '混乱', '沈黙', '暗闇', 'やけど'];
  const heroNames = [...new Set([(DB.config.defaultHero || {}).name || 'アルン', 'アルン'])];
  const seenK = {};
  // 読み物・手がかり・手紙の本文は画面の中で折り返す（会話の窓の 20 字の決まりの外）
  const READ = new Set();
  for (const k of ['lore', 'leads', 'letters', 'chronicle']) for (const v of Object.values(DB[k] || {})) for (const x of [].concat(v.text || [], (v.parts || []).map((q) => q.text))) READ.add(String(x));
  let n = 0, over18 = 0;
  const files = walk(path.join(V2, 'src'));
  for (const f of files) {
    const rel = path.relative(V2, f);
    const src = fs.readFileSync(f, 'utf8');
    const lines = src.split('\n');
    // 素材の name（src/art/terrain/materials.js）は一覧表の見出しだけで画面に出ない（地名・物の名は maps の方）
    if (/^src\/art\/terrain\/materials\.js$/.test(rel)) continue;
    // 演出の表（src/art/fx/fx_seq_table.js）の c は演出の設計のメモ（開発用の fx_gallery だけが出す。画面の文ではない）
    if (/^src\/art\/fx\/fx_seq_table(_boss)?\.js$/.test(rel)) continue;   // _boss はボスの技の演出の表（同じ設計のメモ）
    // 会話・キャプション・看板（20 字の窓）。文の表に移した物は src/i18n/ja/events_*・maps_*
    const talk = /^src\/(events|maps)\//.test(rel) || /^src\/i18n\/ja\/(events|maps)_/.test(rel);
    for (const { s, line } of OLD.strings(src)) {
      if (!JP.test(s)) continue;
      const L = lines[line - 1] || '';
      if (/check_text:ignore/.test(L) || /\bR\.warn\(|console\.(log|warn|error|info)\(|throw new Error|loadErrors\.push/.test(L)) continue;
      if ((s.match(/[ぁぃぅぇぉっゃゅょァィゥェォッャュョ]/g) || []).length >= 6) continue;   // 禁則の表・五十音表
      if (/nameentry|kana/.test(rel) && s.length > 30) continue;
      // 名前の入力の字の表（文の表 ui.js に移した。空白は空きのマス）
      if (/'ui\.nameentry\.kana/.test(L)) continue;
      n++;
      const where = `${rel}:${line}`;
      let t = s.replace(/\u0000/g, 'X');   // テンプレートの ${…} は ASCII の 1 字として数える（空白の検査で誤らない）
      // 文の表の差し込み {name}（R.T の params）も前の ${…} と同じく 1 字（{hero} など表の外で入る物はそのまま）
      if (/^src\/i18n\//.test(rel)) t = t.replace(/\{(?!hero\})[A-Za-z_$][\w$]*\}/g, 'X');
      // 他社の名前は data の名前だけでなく、画面に出す文字列（戦闘の見本の台本など）でも使わない（「かしの」などの一般の語は除く）
      if (!/^src\/core\/stubs\//.test(rel)) for (const w of partial) if (w.length >= 3 && !/^[ぁ-ゖ]+$/.test(w) && t.includes(w)) E('T1', `${where} '${w}' in a string (STYLE_JA §7.1): ${clip(t)}`);
      for (const w of srcBanned) if (t.includes(w) && !SRC_EXC.some((e) => e.includes(w) && t.includes(e))) E('T2', `${where} '${w}' (§7.3): ${clip(t)}`);
      if (joyo) for (const ch of t) {
        if (!KANJI.test(ch) || joyo.has(ch) || allowed.has(ch) || ch === '々') continue;
        if (ch === '叉' && t.includes('夜叉')) continue;
        const k = ch + '|' + rel;
        if (!seenK[k]) { seenK[k] = 1; E('T3', `${where} '${ch}' is not 常用漢字 nor in STYLE_JA §2: ${clip(t)}`); }
      }
      if (!/nameentry/.test(rel)) OLD.checkSpacing(t, (m) => E('T4', `${where} ${m}: ${clip(t)}`));
      OLD.checkEllipsis(t, (m) => E('T5', `${where} ${m}: ${clip(t)}`));
      // 会話の窓でない物: 文の表で events_ に同居する画面の文（ui.* = 終わりのクレジットの行）と、終わりの地方のカードの字幕の帯
      //   （ending.js の画面の幅いっぱいの帯。3 行まで。20 字の窓ではない）、体験版の終わりの画面に描く行（demo_end.js の draw）
      const band = /^\s*'(ui\.|ev\.final_ending\.cards\.|ev\.demo_end\.draw\.)/.test(L);
      if (talk && !band && !READ.has(s)) for (const ln of t.split(/[\n\f]/)) {
        const w = OLD.width(ln);
        if (w > 20) E('T6', `${where} a line is ${w} wide (max 20): ${clip(ln)}`);
        else if (w > 18) over18++;
      }
      // 表に移した物: companions・rules（herotypes）・misc（config）・ui（screens）・art
      if (!/^src\/data\/(config|herotypes|companions)\.js$/.test(rel) && !/^src\/(screens|art)\//.test(rel) && !/^src\/i18n\/ja\/(companions|rules|misc|ui|tips|art)\.js$/.test(rel)) for (const hn of heroNames) if (t.includes(hn) && t.trim() !== hn) E('T7', `${where} hero name '${hn}' written directly: ${clip(t)}`);
      if (/\{(yuki|non|metem)\}/.test(t)) E('T7', `${where} Crest placeholder`);
      for (const st of STATUS) if (t.includes(st + 'にする')) E('T8', `${where} '${st}にする': ${clip(t)}`);
      const nm = t.match(/(毒|眠り|まひ|凍結|気絶|混乱|沈黙|暗闇|やけど|即死)にならない/);
      if (nm) E('T8', `${where} '${nm[0]}': ${clip(t)}`);
      if (/魔法/.test(t) && !SRC_EXC.some((e) => t.includes(e))) W('T9', `${where} '魔法': ${clip(t)}`);
      if (/[０-９]/.test(t)) W('T11', `${where} full-width digits: ${clip(t)}`);
    }
  }
  if (over18) W('T6', `${over18} talk lines are 19–20 wide (the guide is 16)`);
  return { errors, warns, n, files: files.length };
}

function main() {
  const r = run();
  const show = argv.includes('--all') ? r.errors : r.errors.slice(0, 60);
  for (const e of show) console.log('ERROR ' + e);
  if (r.errors.length > show.length) console.log(`… ${r.errors.length - show.length} more`);
  if (WARN) for (const w of r.warns) console.log('WARN  ' + w);
  const by = {};
  for (const e of r.errors) { const k = e.split(' ')[0]; by[k] = (by[k] || 0) + 1; }
  console.log(`\ncheck_text: ${r.errors.length} error(s), ${r.warns.length} warning(s) in ${r.n} Japanese strings of ${r.files} files — ${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ') || 'none'}`);
  if (r.errors.length) process.exitCode = 1;
}
module.exports = { run };
if (require.main === module) main();
