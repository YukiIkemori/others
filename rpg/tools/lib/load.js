// Load the game sources into node (no DOM) for data validation, balance
// simulation and logic tests.
//   const R = require('./lib/load')();          // everything except DOM-bound boot
//   const R = require('./lib/load')({quiet:true});
// Art/audio files only register factories at load time, so loading them is
// safe; calling a factory (which needs document) is not.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function load(opts) {
  opts = opts || {};
  const ROOT = path.resolve(__dirname, '..', '..');
  const SRC = path.join(ROOT, 'src');
  const DIRS = ['core', 'ui', 'data', 'art', 'audio', 'maps', 'events', 'systems'];
  const CORE_FIRST = ['ns.js', 'input.js', 'gfx.js', 'engine.js', 'save.js'];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = [];
  for (const d of DIRS) {
    const dir = path.join(SRC, d);
    if (!fs.existsSync(dir)) continue;
    const list = walk(dir).filter((f) => f.endsWith('.js')).sort((a, b) => {
      if (d === 'core') {
        const ia = CORE_FIRST.indexOf(path.basename(a)), ib = CORE_FIRST.indexOf(path.basename(b));
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }
      return a.localeCompare(b);
    });
    files.push(...list);
  }
  const noop = () => {};
  const sandbox = {
    console: opts.quiet ? { log: noop, warn: noop, error: console.error, info: noop } : console,
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, JSON, Date,
    performance: { now: () => Date.now() },
    requestAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop,
    navigator: { getGamepads: () => [] },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    TextEncoder, TextDecoder, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const errors = [];
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); }
    catch (e) { errors.push(path.relative(ROOT, f) + ': ' + (e.stack || e)); }
  }
  const R = sandbox.RPG;
  R._nodeLoadErrors = errors;
  if (errors.length && !opts.quiet) console.error('LOAD ERRORS:\n' + errors.join('\n'));
  return R;
};
