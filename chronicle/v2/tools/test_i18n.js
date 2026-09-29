#!/usr/bin/env node
// i18n のテスト（node だけ）: 文の表・R.T・言語の切り替え・英語の折り返し・監査（新しい直書きを止める）
//
//   node v2/tools/test_i18n.js
//
// 監査（tools/i18n_audit.js）: src の直書きの日本語がファイルごとに tools/i18n_baseline.json より増えたら失敗。
//   画面の文を足すときは src/i18n/ja/<分野>.js に key を足して R.T('key') で引く（tools/i18n_extract.js --write でも移せる）。
'use strict';
const fs = require('fs');
const path = require('path');
const { ok, section, done } = require('./lib/testkit');
const A = require('./i18n_audit.js');

const V2 = path.resolve(__dirname, '..');
const load = require('./lib/load');

section('R.T: 引き方・差し込み・数の言い分け');
{
  const R = load({ quiet: true });
  const I = R.I18n;
  ok('default language is ja', I.lang() === 'ja');
  ok('R.T is R.I18n.t', R.T === I.t);
  ok('a UI key resolves to Japanese', R.T('ui.hub.CMDS.items.label') === '道具', R.T('ui.hub.CMDS.items.label'));
  ok('params: {name} replaced', I.format('{name}は{n}G', { name: 'A', n: 5 }) === 'Aは5G');
  ok('params: unknown {hero} kept for the event runtime', I.format('{hero}と{x}', { x: 1 }) === '{hero}と1');
  ok('params: nested braces ({flags:{FOUR}}) keep the outer and fill the inner', I.format('（{flags:{F}}/4）', { F: 'a,b' }) === '（{flags:a,b}/4）');
  ok('params: undefined stringifies like a template literal', I.format('x{a}', { a: undefined }) === 'xundefined');
  ok('plural (en): one', I.format('{n, plural, one {# item} other {# items}}', { n: 1 }, 'en') === '1 item');
  ok('plural (en): other', I.format('{n, plural, one {# item} other {# items}}', { n: 3 }, 'en') === '3 items');
  ok('plural: =0 exact case', I.format('{n, plural, =0 {none} other {#}}', { n: 0 }, 'en') === 'none');
  ok('select', I.format('{s, select, m {he} f {she} other {they}}', { s: 'f' }) === 'she');
  ok('missing key → the key itself (and listed in missing())', R.T('no.such.key') === 'no.such.key' && I.missing().includes('no.such.key'));
  const a1 = R.T('ui.screens.ask.rows'), a2 = R.T('ui.screens.ask.rows');
  ok('array values come back as a fresh copy', Array.isArray(a1) && a1 !== a2 && a1.join() === a2.join());
  ok('R.TITLE / R.SUBTITLE come from the table', R.TITLE === 'ルミナス・クロニクル' && R.SUBTITLE === '〜八つの灯火〜');
  ok('norm: Steam and browser language names', I.norm('schinese') === 'zh-Hans' && I.norm('zh-TW') === 'zh-Hant' && I.norm('koreana') === 'ko' && I.norm('en-US') === 'en' && I.norm('xx') === null);
}

section('言語の切り替え（設定の lang・英語の表・日本語へ落ちる）');
{
  const R = load({ quiet: true });
  ok('Settings has lang with the 5 languages', JSON.stringify(R.Settings.CHOICES.lang) === JSON.stringify(R.I18n.LANGS) && R.Settings.get('lang') === 'ja');
  R.Settings.set('lang', 'en');
  ok('Settings.set(lang) switches R.I18n', R.I18n.lang() === 'en');
  ok('English UI string', R.T('ui.hub.CMDS.items.label') === 'Items', R.T('ui.hub.CMDS.items.label'));
  ok('untranslated key falls back to Japanese', R.I18n.has('ui.nameentry.kanaA', 'ja') && !R.I18n.has('ui.nameentry.kanaA', 'en') && Array.isArray(R.T('ui.nameentry.kanaA')));
  ok('language is remembered for the next load (localStorage <prefix>lang)', R._localStorage[R.SAVE_PREFIX + 'lang'] === 'en');
  ok('font stack follows the language', /Nunito/.test(R.Gfx.font(16, 500)) && R.I18n.isLatin());
  R.Settings.set('lang', 'ko');
  ok('Korean uses Noto Sans KR first', /^500 16px "Noto Sans KR"/.test(R.Gfx.font(16, 500)));
  // 読み込みの時の言語（URL の ?lang=）: データの名前は読み込みの時に表を引く
  const E = load({ quiet: true, globals: { location: { search: '?lang=en' } } });
  ok('?lang=en: data names at load time (hero types) are English', E.I18n.lang() === 'en' && E.DB.heroTypes.warrior.name === 'Warrior', E.DB.heroTypes.warrior.name);
  ok('?lang=en: untranslated data (items) stays Japanese', E.DB.items.w_sword_iron.name === '鉄の剣');
  ok('?lang=en: title is English', E.TITLE === 'Luminous Chronicle');
}

section('折り返し: 英語は語で、日本語は今までどおり字で');
{
  const R = load({ quiet: true });
  const w = 16 * 20;   // node の measure は 1 字 = size（16）なので 20 字分
  const ja = '漂う霧の向こうに、灯台の灯がかすかに見える。港町ファロスは、今夜も静かだ。';
  const jaLines = R.UIK.wrap(ja, w, { size: 16 });
  ok('ja: wrap by characters, joined back equals the text', jaLines.join('') === ja && jaLines.every((l) => [...l].length <= 21), jaLines);
  R.I18n.setLang('en');
  const en = 'The lighthouse keeper sang the old song again, and the light returned to the sea.';
  const lines = R.UIK.wrap(en, w, { size: 16 });
  const words = en.split(' ');
  ok('en: no word is split across lines', lines.join(' ').split(' ').join(' ') === words.join(' ') && lines.every((l) => !/^\s|\s$/.test(l)), lines);
  ok('en: every line fits the width', lines.every((l) => R.UIK.measure(l, { size: 16 }) <= w), lines);
  const long = R.UIK.wrap('Supercalifragilisticexpialidociousness', 16 * 10, { size: 16 });
  ok('en: a word longer than the line is cut by characters', long.length > 1 && long.join('') === 'Supercalifragilisticexpialidociousness', long);
  ok('en: newlines are kept', R.UIK.wrap('One.\nTwo.', w, { size: 16 }).length === 2);
}

section('表と監査（tools/i18n_audit.js）');
{
  const r = A.audit();
  ok('every R.T key used in src exists in ja', r.missingJa.length === 0, r.missingJa.slice(0, 10));
  ok('no duplicate keys in the tables', r.dups.length === 0, r.dups.slice(0, 10));
  const grew = A.baselineCheck(r);
  ok('no new hard-coded Japanese in src (tools/i18n_baseline.json)', grew.length === 0, grew);
  ok(`coverage ≥ 99% (now ${(r.coverage * 100).toFixed(1)}%)`, r.coverage >= 0.99, { hardChars: r.hardChars });
  for (const [l, x] of Object.entries(r.langs)) {
    ok(`${l}: placeholders match Japanese`, x.badParams.length === 0, x.badParams.slice(0, 5));
    ok(`${l}: array/string shape matches Japanese`, x.badShape.length === 0, x.badShape.slice(0, 5));
    ok(`${l}: no stale keys (not in ja)`, x.stale.length === 0, x.stale.slice(0, 5));
  }
  // 英語の試し訳（UI・戦闘の画面・フィールド・仕組みの文・説明の札）は全部そろっている
  const { T } = A.readTables();
  const pilot = Object.keys(T.ja).filter((k) => /^(ui|sys|tips|goals)\./.test(k) || (/^battle\./.test(k) && !/^battle\.demo\./.test(k)))
    .filter((k) => !/^ui\.nameentry\.(kanaA|kanaB|latinA|latinB)$/.test(k));
  const miss = pilot.filter((k) => !(k in T.en));
  ok(`English pilot: UI/system keys translated (${pilot.length - miss.length}/${pilot.length})`, miss.length === 0, miss.slice(0, 10));
}

section('用語集（src/i18n/glossary.json）・書体の許諾');
{
  const g = JSON.parse(fs.readFileSync(path.join(V2, 'src', 'i18n', 'glossary.json'), 'utf8'));
  ok('glossary: every term has ja/en/zh-Hans/zh-Hant/ko', g.terms.length >= 100 && g.terms.every((t) => ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'].every((l) => typeof t[l] === 'string' && t[l])));
  ok('glossary: ids are unique', new Set(g.terms.map((t) => t.id)).size === g.terms.length);
  const F = path.join(V2, 'assets', 'fonts');
  ok('OFL license files are kept next to the fonts', ['OFL_ZenMaruGothic.txt', 'OFL_Cinzel.txt', 'OFL_Nunito.txt', 'cjk/OFL_NotoSansCJK.txt'].every((f) => fs.existsSync(path.join(F, f))));
}

done('test_i18n');
