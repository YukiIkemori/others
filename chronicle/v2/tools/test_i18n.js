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
  ok('?lang=en: translated data (items) is English', E.DB.items.w_sword_iron.name === 'Iron Sword', E.DB.items.w_sword_iron.name);
  {
    // 訳の無い key は日本語のまま（本物の表は全部訳してあるので、日本語だけの試しの key を足して確かめる）
    const k = 'ev.__test_i18n.ja_only.say';
    E.I18n.add('ja', { [k]: '試しの台詞（日本語だけ）。' });
    ok('?lang=en: untranslated dialogue stays Japanese', !E.I18n.has(k, 'en') && E.T(k) === '試しの台詞（日本語だけ）。', E.T(k));
  }
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
  // 表の改行（日本語の行の区切り）をほどく: 英語は空白、日本語はつなぐだけ（説明の欄の「30 HPto」を防ぐ）
  ok('unwrap (en): newline becomes a space', R.I18n.unwrap('Restores 30 HP\nto one ally.') === 'Restores 30 HP to one ally.');
  ok('unwrap (ja): newline is removed', R.I18n.unwrap('味方1人のHPを\n30回復する。', 'ja') === '味方1人のHPを30回復する。');
}

section('韓国語の助詞（받침で 은/는・이/가・을/를・과/와・(으)로・아/야・(이)라… を選ぶ）');
{
  const R = load({ quiet: true, globals: { location: { search: '?lang=ko' } } });
  const I = R.I18n;
  const f = (s, v) => I.format(s, { x: v });
  ok('ko: 이(가) after a batchim / no batchim', f('{x}이(가) 나타났다!', '더스트윙') === '더스트윙이 나타났다!' && f('{x}이(가) 나타났다!', '루카') === '루카가 나타났다!');
  ok('ko: 은(는) / 을(를) / 과(와) / 아(야)', f('{x}은(는)', '카일') === '카일은' && f('{x}은(는)', '미라') === '미라는' && f('{x}을(를)', '별') === '별을' && f('{x}을(를)', '나무') === '나무를' &&
    f('{x}과(와)', '곰') === '곰과' && f('{x}과(와)', '새') === '새와' && f('{x}아(야)', '민준') === '민준아' && f('{x}아(야)', '지우') === '지우야');
  ok('ko: (으)로 uses 로 after ㄹ and after no batchim', f('{x}(으)로', '북문') === '북문으로' && f('{x}(으)로', '마을') === '마을로' && f('{x}(으)로', '바다') === '바다로');
  ok('ko: (이)라 / (이)여 / (이)나', f('{x}(이)라고', '곰') === '곰이라고' && f('{x}(이)라고', '새') === '새라고' && f('{x}(이)여', '별') === '별이여' && f('{x}(이)나', '나무') === '나무나');
  ok('ko: closing quotes between the word and the particle are skipped', f('‘{x}’을(를) 익혔다', '빛의 화살') === '‘빛의 화살’을 익혔다' && f('‘{x}’을(를)', '해') === '‘해’를');
  ok('ko: digits and Latin names are read', f('{x}이(가)', '3') === '3이' && f('{x}이(가)', '2') === '2가' && f('{x}(으)로', '7') === '7로' && f('{x}은(는)', 'Tom') === 'Tom은' && f('{x}은(는)', 'Alice') === 'Alice는' && f('{x}(으)로', 'Paul') === 'Paul로');
  ok('ko: an unreadable last letter keeps the marker', f('{x}은(는)', 'ルカ') === 'ルカ은(는)');
  ok('ko: the older notation (은)는 / 와(과) is still resolved', f('{x}(은)는', '곰') === '곰은' && f('{x}와(과)', '새') === '새와');
  ok('ko: {hero} (filled later) keeps the marker until fillName', I.format('{hero}은(는) {x}을(를) 봤다', { x: '별' }) === '{hero}은(는) 별을 봤다' &&
    I.fillName('{hero}은(는) 떠났다', 'hero', '하늘') === '하늘은 떠났다' && I.fillName('{hero}은(는) 떠났다', 'hero', '바다') === '바다는 떠났다');
  ok('ko: R.T resolves markers after fixed nouns too', /나타났다/.test(R.T('battle.scene.intro.head.name', { join: '', p1: '슬라임' })) && R.T('battle.scene.intro.head.name', { join: '', p1: '슬라임' }) === '슬라임이 나타났다!', R.T('battle.scene.intro.head.name', { join: '', p1: '슬라임' }));
  R.State.newGame({ hero: { type: 'warrior', sex: 'm', name: '카일' } });
  const f1 = R.Events.fill('{hero}이(가) 왔다');
  R.Game.chars.hero.name = '루카';
  const f2 = R.Events.fill(['{hero}은(는) 웃었다', '{hero}(으)로']);
  ok('ko: R.Events.fill picks the particle for the hero name', f1 === '카일이 왔다' && f2[0] === '루카는 웃었다' && f2[1] === '루카로', [f1, f2]);
  ok('ja/en: markers are left alone (no Korean rules)', I.josa('{x}이(가)', 'ja') === '{x}이(가)' && I.format('A이(가)', { y: 1 }, 'en') === 'A이(가)');
  // 表の書き方はひとつ（받침の形が先の 은(는)・이(가)・을(를)・과(와)・아(야)、(으)로・(이)라…）。古い (은)는・와(과) や、差し込みの後の決め打ちの助詞は残さない
  const { T } = A.readTables();
  const bad = [];
  for (const [k, v] of Object.entries(T.ko)) {
    for (const s of [].concat(v)) {
      if (/\(은\)는|\(이\)가|\(을\)를|와\(과\)|\(와\)과|\(과\)와|는\(은\)|가\(이\)|를\(을\)|야\(아\)/.test(s)) bad.push(k);
      else if (/\{[A-Za-z_$][\w$]*\}[’”」』)]?(은|는|이|가|을|를|과|와|으로|아|야)(?![(가-힣])/.test(s)) bad.push(k);
    }
  }
  ok('ko tables: one canonical particle notation after placeholders', bad.length === 0, bad.slice(0, 10));
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
