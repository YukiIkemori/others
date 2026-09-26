// v2 のゲームのソースを node に読み込む（DOM なし。CORE、V2_PLAN §2.8）
//
//   const R = require('./v2/tools/lib/load')();                 // 全部（dev/ を除く）＋仮の実装の穴埋め＋データの後処理
//   const R = require('./v2/tools/lib/load')({quiet: true});    // 警告を黙らせる（エラーは出す）
//   const R = require('./v2/tools/lib/load')({dev: true});      // src/dev/*（R.Dev・フィクスチャ）も読む
//   const R = require('./v2/tools/lib/load')({stubs: false});   // 仮の実装を埋めない（本物だけの形を調べる）
//   const R = require('./v2/tools/lib/load')({extra: ['path/to/x.js']});   // 最後に足すファイル（テスト用）
//   const R = require('./v2/tools/lib/load')({fixtures: true}); // window.RPG_FIXTURES に tools/fixtures/**.json を入れる
//
// 読む順番はビルドと同じ（tools/build.js の order()）。読み込み時に document に触れないのが約束（§2.4）なので、
// 絵のファイルも「登録だけ」で読める。焼く（factory を呼ぶ）には canvas が要るので node ではしない。
// 読めなかったファイルは R._nodeLoadErrors と R.loadErrors に積む。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const V2 = path.resolve(__dirname, '..', '..');

module.exports = function load(opts) {
  opts = opts || {};
  const { order, fixtures } = require('../build.js');
  const files = order({ dev: !!opts.dev });
  const noop = () => {};
  const store = {};
  const sandbox = {
    console: opts.quiet ? { log: noop, warn: noop, info: noop, error: (...a) => console.error(...a) } : console,
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, JSON, Date,
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop,
    navigator: { getGamepads: () => [] },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
    },
    TextEncoder, TextDecoder, URLSearchParams,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  };
  sandbox.window = sandbox;
  if (opts.fixtures) sandbox.RPG_FIXTURES = fixtures(opts.fixtureDirs);
  vm.createContext(sandbox);
  const errors = [];
  const run = (f) => {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
    catch (e) { errors.push(path.relative(V2, f) + ': ' + (e.stack || e)); }
  };
  for (const f of files) run(f);
  for (const f of opts.extra || []) run(path.resolve(f));
  const R = sandbox.RPG;
  if (!R) throw new Error('v2 load: window.RPG is missing\n' + errors.join('\n'));
  if (opts.stubs !== false && R.Stubs) R.Stubs.install();
  if (opts.dataHooks !== false && R.runDataHooks) R.runDataHooks();
  R._nodeLoadErrors = errors;
  for (const e of errors) R.loadErrors.push(e);
  R._localStorage = store;
  R._sandbox = sandbox;
  if (errors.length && !opts.quiet) console.error('LOAD ERRORS:\n' + errors.join('\n'));
  return R;
};
