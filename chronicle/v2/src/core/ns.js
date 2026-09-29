// ルミナス・クロニクル 〜八つの灯火〜 v2 — 名前空間（CORE）
// すべてのファイルは IIFE で R（window.RPG）に「登録するだけ」。読み込み時に document に触れない。
// ほかのファイルの物は関数の中でだけ読む（V2_PLAN §0.1 の 0.5、§2.4）。
// core の先頭 6 ファイル（ns util bus engine fit gfx）はこの順に読み込まれる。
(function () {
  'use strict';
  const R = (window.RPG = window.RPG || {});

  R.VERSION = '2.0.0-p0';
  R.TITLE = 'ルミナス・クロニクル';   // i18n:ignore（core/i18n.js が R.T('ui.game.title') を返す getter に置き換える）
  R.SUBTITLE = '〜八つの灯火〜';   // i18n:ignore（同じく R.T('ui.game.subtitle')）
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
    // 版 2（V2_PLAN §2.11）: 手紙（CONTENT）・説明の札（MENUS）・素材と物の一覧（TERRAIN。node で id を確かめる用）
    'letters', 'tips', 'materials', 'props',
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

  // ---------------------------------------------------------------- 仮の実装（core/stubs/*.js）
  // 各担当の契約（§2.5）の仮の実装。読み込み時は登録するだけで、全ファイルを読んだ後の R.Stubs.install() が
  // 「まだ無い関数・値」だけを埋める（本物のファイルがあればそちらが勝つ。一部だけ本物でも残りを埋める）。
  // 呼ばれた回数は R.Stubs.calls に数える（QA の check_stubs が「仮の実装が 1 回も呼ばれない」を確かめる）。
  R.Stubs = R.Stubs || { ns: {}, data: [], calls: {}, installed: {}, claimed: {} };
  /**
   * 本物の担当が「この名前空間は全部自分が持つ。仮の実装で穴を埋めないで」と言う（版 2）。
   * 仮の実装の関数どうしは中の状態（例: 仮の FIELD の st）を共有するので、本物と仮が混ざると食い違う。
   * 名前空間を丸ごと本物にしたら、そのファイルの先頭で R.Stubs.claim('Field') を呼ぶ（子の 'Field.camera' なども含む）。
   * 途中までの間は claim しなくてよい（足りない関数だけ仮が埋める。R.Stubs.installed で何が埋まったか見られる）。
   */
  R.Stubs.claim = function (path) { (R.Stubs.claimed = R.Stubs.claimed || {})[path] = true; };
  const isClaimed = (path) => Object.keys(R.Stubs.claimed || {}).some((c) => path === c || path.indexOf(c + '.') === 0);
  /** 名前空間の仮の実装を登録（path は 'Hd'・'UIK.Message' など） */
  R.Stubs.define = function (path, obj) { R.Stubs.ns[path] = Object.defineProperties(R.Stubs.ns[path] || {}, Object.getOwnPropertyDescriptors(obj)); };
  /** データの仮の登録（R.DB[kind][id] が無いときだけ入る） */
  R.Stubs.defineData = function (kind, id, obj) { R.Stubs.data.push({ kind, id, obj }); };
  R.Stubs.install = function () {
    if (R.Stubs._done) return R.Stubs.installed;
    R.Stubs._done = true;
    const paths = Object.keys(R.Stubs.ns).sort((a, b) => a.split('.').length - b.split('.').length);
    for (const path of paths) {
      if (isClaimed(path)) continue;
      const keys = path.split('.');
      let parent = R;
      for (let i = 0; i < keys.length - 1; i++) parent = parent[keys[i]] = parent[keys[i]] || {};
      const last = keys[keys.length - 1];
      const target = parent[last] = parent[last] || {};
      const stub = R.Stubs.ns[path];
      const filled = [];
      for (const k of Object.keys(stub)) {
        if (Object.prototype.hasOwnProperty.call(target, k) || target[k] !== undefined) continue;
        const desc = Object.getOwnPropertyDescriptor(stub, k);
        if (desc.get || desc.set) { Object.defineProperty(target, k, desc); filled.push(k); continue; }
        const v = stub[k];
        if (typeof v === 'function' && !/^class\s/.test(Function.prototype.toString.call(v)) && !/^[A-Z]/.test(k)) {
          const name = path + '.' + k;
          target[k] = function () { R.Stubs.calls[name] = (R.Stubs.calls[name] || 0) + 1; return v.apply(this, arguments); };
        } else target[k] = v;
        filled.push(k);
      }
      if (filled.length) R.Stubs.installed[path] = filled;
    }
    for (const d of R.Stubs.data) {
      const t = (R.DB[d.kind] = R.DB[d.kind] || {});
      if (d.id === '*') { for (const k of Object.keys(d.obj)) if (t[k] === undefined) t[k] = d.obj[k]; continue; }
      if (t[d.id] === undefined) { t[d.id] = d.obj; (R.Stubs.installed['DB.' + d.kind] = R.Stubs.installed['DB.' + d.kind] || []).push(d.id); }
    }
    return R.Stubs.installed;
  };
  /** 呼ばれた仮の実装の一覧 [[name, n]…] */
  R.Stubs.report = function () { return Object.keys(R.Stubs.calls).sort().map((k) => [k, R.Stubs.calls[k]]); };

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
