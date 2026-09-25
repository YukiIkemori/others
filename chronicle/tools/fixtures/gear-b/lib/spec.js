// gear-b（A10b）の node 専用ヘルパー: DESIGN.md / STYLE_JA.md の表を読んで、テストと検査が使う形にする。
// （tools/fixtures/gear-b/ の直下の *.js だけが build --with で読まれる。このファイルは lib/ の下なので読まれない。）
//
//   const S = require('./fixtures/gear-b/lib/spec')();
//   S.consumables  … §8.9 と §8.9.2 の表の行 [{id, name, price, via, target, effects, fx, battle, field, desc, table:'8.9'|'8.9.2'}]
//   S.keys         … §8.10 の表 [{id, name, desc, use}]（desc の ／ は \n）
//   S.keys10       … §10.13.6 の表（名前と説明の正）{id: {name, desc, where}}
//   S.shopNames    … §8.11.2 の表の名前 {id: name}（<町>_item の行は展開しない）
//   S.shopCode / S.poolCode … §8.11.3 / §8.12.5 のコードの文字列（正本）
//   S.lines        … §8.4.1〜§8.4.3 の系列 [{line, type, wtype?, weight?, units, names:[T0..T9], t0id?}]
//   S.charms       … §8.4.4 の補助のアクセサリ [{id, name, shopTier, price, mods, desc}]
//   S.bandRare     … §8.5 の帯のレア品 [{id, name, kind, tier, price, desc}]
//   S.banned       … STYLE_JA §7.1（部分一致）・§7.2（完全一致）・§7.3（src 全体） {partial:[], exact:[], src:[]}
//   S.allowedKanji … STYLE_JA §2 の使ってよい常用外の字（文字列）
//   S.joyo         … tools/lib/joyo.txt（無ければ null）
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function sectionLines(md, headingStart, level) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith(headingStart));
  if (i < 0) throw new Error('DESIGN.md: section not found: ' + headingStart);
  const hashes = level || (headingStart.match(/^#+/) || ['####'])[0].length;
  let j = i + 1;
  while (j < lines.length) {
    const m = lines[j].match(/^(#+) /);
    if (m && m[1].length <= hashes) break;
    j++;
  }
  return lines.slice(i + 1, j);
}
function tables(lines) {
  // → [[row cells…]] per table (header and separator removed)
  const out = [];
  let cur = null;
  for (const l of lines) {
    if (l.startsWith('|')) {
      if (!cur) { cur = { rows: [] }; out.push(cur); }
      cur.rows.push(l);
    } else cur = null;
  }
  return out.map((t) => t.rows.slice(2).map(cells));
}
function cells(row) {
  const s = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  return s.split('|').map((c) => c.trim());
}
const unq = (s) => s.replace(/^`|`$/g, '');
const jsObj = (s) => Function('"use strict"; return (' + s + ');')();
function effectsOf(cell) {
  const m = cell.match(/`\{[^`]*\}`/g);
  return m ? m.map((x) => jsObj(unq(x))) : null;
}
const yes = (c) => c.startsWith('○');
const desc = (c) => c.replace(/<br>/g, '\n').replace(/／/g, '\n');

module.exports = function spec() {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const style = fs.readFileSync(path.join(ROOT, 'STYLE_JA.md'), 'utf8');
  const S = {};

  // ------------------------------------------------------------------ 道具
  const t89 = tables(sectionLines(md, '### 8.9 道具', 4))[0];
  const t892 = tables(sectionLines(md, '#### 8.9.2', 4))[0];
  const row = (c, table) => ({
    id: unq(c[0]), name: c[1], price: +c[2], via: c[3], target: c[4] === '—' ? null : c[4],
    effects: effectsOf(c[5]), fx: c[6] === '—' ? null : c[6], battle: yes(c[7]), field: yes(c[8]), desc: desc(c[9]), table,
  });
  S.consumables = [...t89.map((c) => row(c, '8.9')), ...t892.map((c) => row(c, '8.9.2'))];

  // ------------------------------------------------------------------ 大事なもの
  const t810 = tables(sectionLines(md, '### 8.10 大事なもの', 3))[0];
  S.keys = t810.map((c) => ({ id: unq(c[0]), name: c[1], desc: desc(c[2]), use: c[3] === '—' ? null : jsObj(unq(c[3])) }));
  const t10136 = tables(sectionLines(md, '#### 10.13.6', 4))[0];
  S.keys10 = {};
  for (const c of t10136) {
    const ids = c[0].match(/`k_[a-z_]+`/g).map(unq);
    if (ids.length === 2 && c[0].includes('…')) {
      // 「k_page_forest … k_page_star」の行: §10.2.3 の並び（森 砂 氷 霧 潮 鉄 灰 星）で展開する
      const keys = ['forest', 'desert', 'snow', 'marsh', 'isles', 'mine', 'ash', 'star'];
      const names = ['森', '砂', '氷', '霧', '潮', '鉄', '灰', '星'];
      keys.forEach((k, i) => { S.keys10['k_page_' + k] = { name: names[i] + 'のページ', desc: c[2].replace(/\\n/g, '\n'), where: c[3] }; });
    } else S.keys10[ids[0]] = { name: c[1], desc: c[2].replace(/\\n/g, '\n'), where: c[3] };
  }

  // ------------------------------------------------------------------ 店
  const t8112 = tables(sectionLines(md, '#### 8.11.2', 4))[0];
  S.shopNames = {};
  for (const c of t8112) {
    const ids = (c[0].match(/`[a-z_]+`/g) || []).map(unq), names = c[1].split(' ／ ');
    ids.forEach((id, i) => { if (!id.includes('<')) S.shopNames[id] = names.length === ids.length ? names[i] : c[1]; });
  }
  const code = (heading) => {
    const ls = sectionLines(md, heading, 4);
    const a = ls.findIndex((l) => l.startsWith('```js')), b = ls.findIndex((l, k) => k > a && l.startsWith('```'));
    return ls.slice(a + 1, b).join('\n');
  };
  S.shopCode = code('#### 8.11.3');
  S.poolCode = code('#### 8.12.5');
  // p_supply の表と宝箱のお金（§8.12.2）
  const t8122 = tables(sectionLines(md, '#### 8.12.2', 4));
  S.poolTable = t8122[0].flatMap((c) => c[0].match(/p_[a-z_]+/g) || []);
  // p_supply: [{from, to, add:[{name, w, n}]}]（「傷薬 6（2 個）」= 重み 6・個数 2）
  S.supplyTable = t8122[1].map((c) => {
    const r = c[0].match(/T(\d)(?:〜T(\d))?/);
    const add = c[1].split('、').map((x) => {
      const m = x.trim().match(/^(.+?) (\d+)(?:（(\d+) 個）)?$/);
      return { name: m[1], w: +m[2], n: m[3] ? +m[3] : 1 };
    });
    return { from: +r[1], to: r[2] ? +r[2] : +r[1], add };
  });
  const g = sectionLines(md, '#### 8.12.2', 4).join('\n').match(/GOLD\[T\] = \[([\d, ]+)\]/);
  S.gold = g ? g[1].split(',').map(Number) : null;

  // ------------------------------------------------------------------ 系列（§8.4.1〜§8.4.3）
  S.lines = [];
  const WT = { 剣: 'sword', 大剣: 'greatsword', 短剣: 'dagger', 斧: 'axe', 槍: 'spear', 弓: 'bow', 棍棒: 'club', 杖: 'staff', 刀: 'katana', 体術: 'fist', 鞭: 'whip' };
  const ST = { 腕力: 's', 体力: 'v', 器用さ: 'd', 素早さ: 'a', 知力: 'i', 精神: 'm' };
  const unitsOf = (s) => {
    if (s.includes('×2')) return ST[s.replace('×2', '')] + '2';
    if (s.includes('×1')) return ST[s.replace('×1', '')] + '1';
    return s.split('・').map((x) => ST[x] + '1').join('');
  };
  const tw = tables(sectionLines(md, '#### 8.4.1', 4))[1];
  for (const c of tw) {
    const m = c[0].match(/`(w_[a-z_]+)_<T>`(?:（T0 = `([a-z_]+)`）)?/);
    S.lines.push({ line: m[1], type: 'weapon', wtype: WT[c[1]], units: unitsOf(c[2]), names: c.slice(3, 13), t0id: m[2] || null });
  }
  const PART = { 体: 'body', 頭: 'head', 盾: 'shield', 手: 'hands', 足: 'feet' };
  const WEIGHT = { 重装: 'heavy', 軽装: 'light', 布: 'cloth' };
  const ta = tables(sectionLines(md, '#### 8.4.2', 4))[1];
  for (const c of ta) {
    const m = c[0].match(/`([a-z]+_[a-z]+)_<T>`(?:（T0 = `([a-z_]+)`）)?/);
    S.lines.push({ line: m[1], type: PART[c[1]], weight: WEIGHT[c[2]], units: unitsOf(c[3]), names: c.slice(4, 14), t0id: m[2] || null });
  }
  const tc = tables(sectionLines(md, '#### 8.4.3', 4))[0];
  for (const c of tc) {
    const m = c[0].match(/`(ac_[a-z]+)_<T>`/);
    S.lines.push({ line: m[1], type: 'acc', units: ST[c[1]] + '1', names: c.slice(2, 12), t0id: null });
  }
  const tch = tables(sectionLines(md, '#### 8.4.4', 4))[0];
  S.charms = tch.map((c) => ({
    id: unq(c[0]), name: c[1], shopTier: +c[2], price: +c[3],
    mods: Object.assign({}, ...(c[4].match(/`[^`]+`/g) || []).map((x) => jsObj('{' + unq(x) + '}'))), desc: desc(c[5]),
  }));
  // 帯のレア品（§8.5）
  S.bandRare = [];
  for (const t of tables(sectionLines(md, '### 8.5 ', 3))) {
    for (const c of t) {
      if (!/^`[a-z0-9_]+`$/.test(c[0])) continue;
      S.bandRare.push({ id: unq(c[0]), name: c[1], kind: c[2], tier: +c[3], price: +c[8], desc: desc(c[9]) });
    }
  }

  // ------------------------------------------------------------------ STYLE_JA
  const sl = style.split('\n');
  const after = (prefix) => { const l = sl.find((x) => x.startsWith(prefix)); return l ? l.slice(prefix.length) : ''; };
  const ticks = (s) => (s.match(/`[^`]+`/g) || []).map(unq);
  S.banned = { partial: [], exact: [], src: [] };
  for (const p of ['- ロマサガ・サガ系: ', '- ドラクエ: ', '- ファイナルファンタジー: ', '- ほかの作品: ']) {
    const l = sl.find((x) => x.startsWith(p));
    if (l) S.banned.partial.push(...ticks(l)[0].split(/\s+/).filter(Boolean));
  }
  const i72 = sl.findIndex((x) => x.startsWith('### 7.2'));
  S.banned.exact = ticks(sl[i72 + 1])[0].split(/\s+/).filter(Boolean);
  const i73 = sl.findIndex((x) => x.startsWith('### 7.3'));
  S.banned.src = ticks(sl[i73 + 1]);
  S.allowedKanji = after('- **使ってよい常用外の字**: ').replace(/（[^）]*）/g, '').replace(/\s/g, '');
  const jp = path.join(ROOT, 'tools', 'lib', 'joyo.txt');
  S.joyo = fs.existsSync(jp) ? fs.readFileSync(jp, 'utf8').trim() : null;
  S.ROOT = ROOT;
  return S;
};

// 表示の幅（全角 1、半角 0.5。{hero} は 5）
module.exports.width = function width(s) {
  let w = 0;
  s = String(s).replace(/\{hero\}/g, '＊＊＊＊＊');
  for (const ch of s) w += ch.codePointAt(0) < 0x100 || (ch >= '｡' && ch <= 'ﾟ') ? 0.5 : 1;
  return w;
};
