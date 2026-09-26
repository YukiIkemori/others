// テストの小道具（CORE、版 2。どの担当の test_<担当>*.js でも使ってよい）
//   const { ok, done, section } = require('./lib/testkit');
//   ok(name, cond, info?)   → 1 行（pass / FAIL）を出す
//   section(title)          → 見出し
//   done(label)             → 「n/m passed」を出し、失敗があれば終了コード 1
'use strict';
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, info) {
  if (cond) pass++; else { fail++; fails.push(name); }
  const extra = info === undefined || cond ? '' : '  ' + String(JSON.stringify(info)).slice(0, 400);
  console.log(`${cond ? 'pass' : 'FAIL'}  ${name}${extra}`);
  return !!cond;
}
function section(t) { console.log(`\n== ${t}`); }
function done(label) {
  console.log(`\n${label ? label + ': ' : ''}${pass}/${pass + fail} passed`);
  if (fail) { console.log('failed:\n  ' + fails.join('\n  ')); process.exitCode = 1; }
  return { pass, fail };
}
module.exports = { ok, section, done };
