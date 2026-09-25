// gear-b（A10b）: tools/fixtures/gear-b/stub_gear.js を DESIGN.md の表から作る（node tools/check_gear-b.js --write-fixture）。
// stub_gear.js は、ほかの担当の装備（通常品 480・補助のアクセサリ 52・帯のレア品 130）がまだ無い間に、
// 店とプールを単独で確かめるための仮の品。**すでにある id は上書きしない**（本物が入れば本物が使われる）。
'use strict';
const fs = require('fs');
const path = require('path');
const spec = require('./spec');

module.exports = function writeStub() {
  const S = spec();
  const md = fs.readFileSync(path.join(S.ROOT, 'DESIGN.md'), 'utf8').split('\n');
  const tableAfter = (heading, nth) => {
    const i = md.findIndex((l) => l.startsWith(heading));
    let k = i + 1, seen = 0;
    for (; k < md.length; k++) if (md[k].startsWith('|') && (k === 0 || !md[k - 1].startsWith('|'))) { if (seen === nth) break; seen++; }
    const rows = [];
    for (let j = k + 2; md[j] && md[j].startsWith('|'); j++) rows.push(md[j].replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    return rows;
  };
  // §8.4.1 の攻撃/術（列 = 剣 大剣 短剣 斧 槍 弓 棍棒 杖 刀 体術 鞭 値段）
  const WCOL = ['sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow', 'club', 'staff', 'katana', 'fist', 'whip'];
  const WATK = tableAfter('#### 8.4.1', 0).map((c) => {
    const o = {};
    WCOL.forEach((w, i) => { o[w] = c[1 + i].split('/').map(Number); });
    o.price = +c[12];
    return o;
  });
  // §8.4.2 の守備/術防（列 = 体 頭 盾 手 足 × 重 軽 布）
  const ACOL = [];
  for (const p of ['body', 'head', 'shield', 'hands', 'feet']) for (const w of ['heavy', 'light', 'cloth']) ACOL.push(p + ':' + w);
  const ADEF = tableAfter('#### 8.4.2', 0).map((c) => {
    const o = {};
    ACOL.forEach((k, i) => { o[k] = c[1 + i].split('/').map(Number); });
    return o;
  });
  // §8.3.8 の防具・アクセサリの値段（列 = 体 頭 盾 手 足 アクセ）
  const PCOL = ['body', 'head', 'shield', 'hands', 'feet', 'acc'];
  const APRICE = tableAfter('#### 8.3.8', 0).map((c) => {
    const o = {};
    PCOL.forEach((k, i) => { o[k] = +c[1 + i]; });
    return o;
  });
  const KIND = {
    剣: ['weapon', 'sword'], '大剣（両手）': ['weapon', 'greatsword'], 短剣: ['weapon', 'dagger'], 斧: ['weapon', 'axe'], '槍（両手）': ['weapon', 'spear'],
    '弓（両手）': ['weapon', 'bow'], 棍棒: ['weapon', 'club'], 杖: ['weapon', 'staff'], 刀: ['weapon', 'katana'], 体術: ['weapon', 'fist'], 鞭: ['weapon', 'whip'], アクセ: ['acc'],
  };
  const PART = { 体: 'body', 頭: 'head', 盾: 'shield', 手: 'hands', 足: 'feet' }, WGT = { 重装: 'heavy', 軽装: 'light', 布: 'cloth' };
  const kindOf = (k) => {
    if (KIND[k]) return KIND[k];
    const [p, w] = k.split('・');
    return [PART[p], WGT[w]];
  };
  const LINES = S.lines.map((l) => [l.line, l.type, l.wtype || l.weight || '', l.units, l.names, l.t0id || '']);
  const CHARMS = S.charms.map((c) => [c.id, c.name, c.price, c.mods, c.desc, c.shopTier]);
  const BAND = S.bandRare.map((b) => { const [t, sub] = kindOf(b.kind); return [b.id, b.name, t, sub || '', b.tier, b.price, b.desc]; });

  const out = `// 自動生成（node tools/check_gear-b.js --write-fixture）。手で直さない。
// gear-b（A10b）の単独の確認用の仮の装備。DESIGN.md §8.4・§8.5 の表から作った（id・名前・種別・ティア・系列・grade・src・値段・数値）。
// **すでにある id は上書きしない**。作った品には _stub:true を付ける（テストが数を出す）。
(function (R) {
  'use strict';
  const LINES = ${JSON.stringify(LINES)};
  const CHARMS = ${JSON.stringify(CHARMS)};
  const BAND = ${JSON.stringify(BAND)};
  const WATK = ${JSON.stringify(WATK)};
  const ADEF = ${JSON.stringify(ADEF)};
  const APRICE = ${JSON.stringify(APRICE)};
  const U = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6];
  const SK = { s: 'str', v: 'vit', d: 'dex', a: 'agi', i: 'int', m: 'mnd' };
  const stats = (units, T, gm) => { const o = {}; for (const m of units.matchAll(/([svdaim])(\\d)/g)) o[SK[m[1]]] = Math.max(1, Math.round(+m[2] * U[T])) * gm; return o; };
  const TWO = { greatsword: 1, spear: 1, bow: 1 };
  const WDESC = { heavy: '重くて守りが固い。', light: '軽くて動きやすい。', cloth: '術から身を守る。' };
  const SN = { str: '腕力', vit: '体力', dex: '器用さ', agi: '素早さ', int: '知力', mnd: '精神' };
  const add = (id, it) => { if (R.DB.items[id]) return; it._stub = true; R.DB.items[id] = it; };
  LINES.forEach(([line, type, sub, units, names, t0], li) => {
    for (let T = 0; T <= 9; T++) {
      const id = (T === 0 && t0) || line + '_' + T;
      const it = { name: names[T], type, grade: 'normal', tier: T, src: 'shop', line, units, sort: T * 100 + li };
      it.stats = stats(units, T, 1);
      const sn = Object.keys(it.stats).map((k) => SN[k]);
      if (type === 'weapon') {
        it.wtype = sub; const [a, m] = WATK[T][sub]; it.atk = a; it.mag = m; it.price = WATK[T].price;
        if (TWO[sub]) it.twoHanded = true;
        it.desc = (R.DB.weaponTypes && R.DB.weaponTypes[sub] && R.DB.weaponTypes[sub].desc || '武器。') + '\\n' + sn.join('と') + 'が上がる。';
      } else if (type === 'acc') {
        it.price = APRICE[T].acc; it.desc = '身につける飾り。\\n' + sn.join('と') + 'が上がる。';
      } else {
        it.weight = sub; const [d, md] = ADEF[T][type + ':' + sub]; it.def = d; it.mdef = md; it.price = APRICE[T][type];
        if (type === 'shield') it.eva = { heavy: 8, light: 5, cloth: 2 }[sub];
        it.desc = WDESC[sub] + '\\n' + sn.join('と') + 'が上がる。';
      }
      add(id, it);
    }
  });
  CHARMS.forEach(([id, name, price, mods, desc, shopTier], i) =>
    add(id, { name, type: 'acc', grade: 'normal', tier: 0, src: 'shop', line: 'charm_' + id.replace(/^ac_/, '').split('_')[0], price, mods, desc, sort: 5000 + i }));
  BAND.forEach(([id, name, type, sub, tier, price, desc], i) => {
    const it = { name, type, grade: 'rare', tier, src: 'drop', price, desc, sort: tier * 100 + 50 + i };
    if (type === 'weapon') { it.wtype = sub; const [a, m] = WATK[tier][sub]; it.atk = a; it.mag = m; if (TWO[sub]) it.twoHanded = true; }
    else if (type !== 'acc') { it.weight = sub; const [d, md] = ADEF[tier][type + ':' + sub]; it.def = d; it.mdef = md; if (type === 'shield') it.eva = { heavy: 8, light: 5, cloth: 2 }[sub]; }
    add(id, it);
  });
})(window.RPG);
`;
  const file = path.join(S.ROOT, 'tools', 'fixtures', 'gear-b', 'stub_gear.js');
  fs.writeFileSync(file, out);
  return { file, lines: LINES.length, charms: CHARMS.length, band: BAND.length, bytes: out.length };
};
