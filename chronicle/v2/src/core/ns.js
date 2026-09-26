// ルミナス・クロニクル 〜八つの灯火〜 v2 — 名前空間（CORE）
// すべてのファイルは IIFE で R（window.RPG）に「登録するだけ」。読み込み時に document に触れない。
// ほかのファイルの物は関数の中でだけ読む（V2_PLAN §0.1 の 0.5、§2.4）。
// core の先頭 6 ファイル（ns util bus engine fit gfx）はこの順に読み込まれる。
(function () {
  'use strict';
  const R = (window.RPG = window.RPG || {});

  R.VERSION = '2.0.0-p0';
  R.TITLE = 'ルミナス・クロニクル';
  R.SUBTITLE = '〜八つの灯火〜';
  R.COPYRIGHT = '© Studio Metem';
  R.PARTY_MAX = 4;
  R.SAVE_PREFIX = 'luminous_chronicle_v2_';

  // 論理座標（R.fit が決め直す）。既定は 16:9 の 960×540、SCALE 2（MODERN_UI §1）
  R.W = 960;
  R.H = 540;
  R.SCALE = 2;
  R.layout = 'wide';
  R.uiScale = 1;
  R.safe = { l: 0, t: 0, r: 0, b: 0 };

  // データの登録簿。R.def(kind, id, obj) で登録すると重なりを警告する（上書きしない、§2.4）
  R.DB = R.DB || {};
  for (const k of [
    'config', 'maps', 'events', 'locations', 'regions', 'leads', 'looks', 'items', 'shops', 'pools',
    'heroTypes', 'companions', 'weaponTypes', 'elements', 'statuses', 'techs', 'spells',
    'monsters', 'lineages', 'enemyActions', 'encounters', 'troops', 'bosses', 'bossActions',
    'rare', 'rareEncounters', 'music', 'sfx',
  ]) R.DB[k] = R.DB[k] || {};

  // 読み込みの失敗（build.js が各ファイルを try/catch で包んでここへ積む）と登録の重なり
  R.loadErrors = R.loadErrors || [];

  /** R.DB[kind][id] = obj。同じ id がもうあれば警告して上書きしない（R.loadErrors に積む） */
  R.def = function (kind, id, obj) {
    const t = (R.DB[kind] = R.DB[kind] || {});
    if (Object.prototype.hasOwnProperty.call(t, id)) {
      const msg = `duplicate R.DB.${kind}.${id} (ignored)`;
      R.loadErrors.push(msg);
      console.warn('[RPG]', msg);
      return false;
    }
    t[id] = obj;
    return true;
  };
  /** 表をまとめて登録（R.def を 1 件ずつ） */
  R.defs = function (kind, table) { for (const id of Object.keys(table)) R.def(kind, id, table[id]); };

  R.warn = function (...a) { console.warn('[RPG]', ...a); };

  // 起動の手順（main.js）: 全ファイル → R.Stubs.install() → R.runDataHooks() → R.onBoot の順
  R._bootHooks = R._bootHooks || [];
  R.onBoot = function (fn) { R._bootHooks.push(fn); };
  R._dataHooks = R._dataHooks || [];
  /** データの後処理（表の展開など）。ブラウザでも node（tools/lib/load.js）でも 1 回だけ。DOM に触れない */
  R.onData = function (fn) { R._dataHooks.push(fn); };
  R.runDataHooks = function () {
    if (R._dataHooksRan) return;
    R._dataHooksRan = true;
    for (const fn of R._dataHooks) {
      try { fn(R); } catch (e) { R.loadErrors.push('onData hook: ' + (e && e.stack || e)); console.error('data hook failed', e); }
    }
  };
})();
