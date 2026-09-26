// 出来事のバス（CORE）: R.on / R.off / R.once / R.emit。名前は V2_PLAN §2.5.17 の一覧を使う
(function (R) {
  'use strict';
  const L = {};
  R.EVENTS = ['layout', 'device', 'settings', 'scene:push', 'scene:pop', 'map:enter', 'map:leave', 'step', 'talk',
    'chest:open', 'spring:use', 'secret:found', 'switch', 'lamp:lit', 'encounter', 'battle:start', 'battle:end',
    'flag', 'var', 'item:gain', 'lead:add', 'lead:pin', 'lead:done', 'tier', 'region:clear', 'glimmer', 'grow',
    'save', 'autosave',
    // CORE が足した物（契約の版 1）: 起動の終わり、エラー
    'booted', 'error'];
  R.on = function (name, fn) { (L[name] = L[name] || []).push(fn); return fn; };
  R.off = function (name, fn) {
    const l = L[name]; if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  };
  R.once = function (name, fn) {
    const w = function (d) { R.off(name, w); fn(d); };
    return R.on(name, w);
  };
  R.emit = function (name, data) {
    const l = L[name]; if (!l || !l.length) return;
    for (const fn of l.slice()) {
      try { fn(data); } catch (e) { console.error('[emit ' + name + ']', e); }
    }
  };
})(window.RPG);
