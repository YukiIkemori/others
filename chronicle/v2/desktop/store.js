// デスクトップ版の記録の置き場（node の fs だけ。main.js が使う。tools/test_pc.js が node で確かめる）
//   makeStore(dir) → {read(name) → 文字|null, write(name, text) → bool, list() → [name], remove(name) → bool, dir}
//   name は /^[a-z0-9_]{1,64}$/ だけ（ほかの場所に書けない）。ファイルは <dir>/<name>.json
//   書くときは <name>.json.tmp に書いてから置き換える（途中で落ちても壊れない）。前の中身は <name>.json.bak に 1 つだけ残す
//   <name>.json が読めない・空なら .bak を読む
'use strict';
const fs = require('fs');
const path = require('path');

const NAME = /^[a-z0-9_]{1,64}$/;

function makeStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = (n) => path.join(dir, n + '.json');
  const ok = (n) => typeof n === 'string' && NAME.test(n);
  function readFile(f) {
    try { const s = fs.readFileSync(f, 'utf8'); return s.length ? s : null; } catch (e) { return null; }
  }
  return {
    dir,
    read(n) {
      if (!ok(n)) return null;
      const s = readFile(file(n));
      return s != null ? s : readFile(file(n) + '.bak');
    },
    write(n, text) {
      if (!ok(n) || typeof text !== 'string') return false;
      const f = file(n), tmp = f + '.tmp';
      try {
        fs.writeFileSync(tmp, text, 'utf8');
        try { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak'); } catch (e) { /* 控えは無くてもよい */ }
        fs.renameSync(tmp, f);
        return true;
      } catch (e) {
        try { fs.unlinkSync(tmp); } catch (e2) { /* */ }
        return false;
      }
    },
    list() {
      let names = [];
      try { names = fs.readdirSync(dir); } catch (e) { return []; }
      const out = new Set();
      for (const f of names) {
        const m = /^([a-z0-9_]{1,64})\.json(\.bak)?$/.exec(f);
        if (m) out.add(m[1]);
      }
      return Array.from(out).sort();
    },
    remove(n) {
      if (!ok(n)) return false;
      for (const f of [file(n), file(n) + '.bak']) { try { fs.unlinkSync(f); } catch (e) { /* 無い */ } }
      return true;
    },
  };
}

module.exports = { makeStore, NAME };
