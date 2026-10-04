// Settings（CORE）: 設定の項目・既定値・保存（V2_PLAN §2.5.18、§3.12）
// R.Settings.get(key) / set(key, v) / defaults / CHOICES / load() / reset()。変えたら R.emit('settings', {key, v})
// 画面（設定の画面）は MENUS。各担当は get で読むだけ。
(function (R) {
  'use strict';
  const DEFAULTS = {
    textSpeed: 'normal',
    battleSpeed: 1,
    alwaysDash: false,
    cursorMemory: true,
    fieldZoom: 'normal',
    fieldParty: false,   // フィールドで仲間を後ろに並べる（既定は主人公だけ。オーナーの決まり 2026-09-27、FIELD trail.js）
    fieldMap: 'mini',   // ダンジョンの地図: 小地図／大きな地図／出さない（フィールドの X で順に。FIELD hud.js）
    wipe: 'retry',
    uiSize: 1,
    panel: 'normal',
    brightness: 1,
    fx: 'high',
    prompts: 'first2h',
    'vol.bgm': 7,
    'vol.sfx': 7,
    'vol.voice': 8,
    'vol.amb': 7,   // 環境音（天気・場所の音の床。core/audio.js の ambience）
    confirmButton: 'right',
    touchPad: 'auto',
    colorAssist: false,
    lessFlash: false,
    reduceMotion: false,
    weather: false,      // 天気の絵（雨・雪・霧・砂嵐…）。持ち主 2026-10-04「天候エフェクト消してくれ」→ 既定は切る
    ruby: false,
    shake: 'on',
    battleVoice: 'on',   // 戦闘ボイス: あり／大技だけ／なし（BRIEF A37、BSCENE が読む）
    // PC 版（Steam の基本）: パッドの印・画面の出し方・拡大のしかた
    padGlyphs: 'auto',   // ボタンの印: 自動（最後に触ったパッドの名前で）／A が下（Xbox 系）／○×△□（PlayStation 系）／A が右（Nintendo 系）
    display: 'window',   // ウィンドウ／全画面（F11・Alt+Enter でも。core/display.js）
    scaleMode: 'fit',    // 拡大: 画面に合わせる（実画面の画素に 1:1 で描く）／整数倍（余りは帯）。core/fit.js
    lang: 'ja',          // 言語（core/i18n.js）。変えたら R.I18n.setLang。データの名前まで変えるには起こし直す（設定の画面が R.I18n.restart）
  };
  const VOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const CHOICES = {
    textSpeed: ['slow', 'normal', 'fast', 'instant'],
    battleSpeed: [1, 2, 3, 5],
    alwaysDash: [false, true],
    cursorMemory: [true, false],
    fieldZoom: ['near', 'normal', 'far'],
    fieldParty: [false, true],
    fieldMap: ['mini', 'big', 'off'],
    wipe: ['retry', 'inn'],
    uiSize: [1, 1.15, 1.3],
    panel: ['normal', 'dense'],
    brightness: [0.85, 1, 1.25],
    fx: ['high', 'low', 'off'],
    prompts: ['always', 'first2h', 'never'],
    'vol.bgm': VOL, 'vol.sfx': VOL, 'vol.voice': VOL, 'vol.amb': VOL,
    confirmButton: ['right', 'down'],
    touchPad: ['auto', 'on', 'off'],
    colorAssist: [false, true], lessFlash: [false, true], reduceMotion: [false, true], weather: [false, true], ruby: [false, true],
    shake: ['on', 'weak', 'off'],
    battleVoice: ['on', 'big', 'off'],
    padGlyphs: ['auto', 'xbox', 'ps', 'nintendo'],
    display: ['window', 'fullscreen'],
    scaleMode: ['fit', 'integer'],
    lang: ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko'],
  };
  const KEY = 'settings';
  let cur = Object.assign({}, DEFAULTS);
  // キーとボタンの割り当て（core/input.js が形を決める）。既定から変えた物だけ {kb:{btn:[code, code]}, pad:{btn:index}}
  let binds = null;

  const S = (R.Settings = {
    defaults: Object.freeze(Object.assign({}, DEFAULTS)),
    CHOICES,
    get(key) { return Object.prototype.hasOwnProperty.call(cur, key) ? cur[key] : DEFAULTS[key]; },
    /** 値が CHOICES に無ければ無視して false */
    set(key, v) {
      if (!Object.prototype.hasOwnProperty.call(CHOICES, key)) { R.warn('unknown setting ' + key); return false; }
      if (!CHOICES[key].includes(v)) { R.warn(`bad value for setting ${key}: ${v}`); return false; }
      if (cur[key] === v) return true;
      cur[key] = v;
      S.save();
      apply(key, v);
      R.emit('settings', { key, v });
      return true;
    },
    all() { return Object.assign({}, cur); },
    load() {
      let raw = null;
      try { raw = R.Storage ? R.Storage.get(KEY) : null; } catch (e) { raw = null; }
      cur = Object.assign({}, DEFAULTS);
      binds = null;
      if (raw) {
        try {
          const o = JSON.parse(raw) || {};
          for (const k of Object.keys(o)) if (CHOICES[k] && CHOICES[k].includes(o[k])) cur[k] = o[k];
          if (o.binds && typeof o.binds === 'object') binds = cleanBinds(o.binds);
        } catch (e) { /* 壊れた設定は既定に */ }
      }
      for (const k of ['vol.bgm']) apply(k, cur[k]);
      R.emit('settings', { key: 'binds' });
      return S.all();
    },
    save() {
      const o = Object.assign({}, cur);
      if (binds) o.binds = binds;
      try { if (R.Storage) R.Storage.set(KEY, JSON.stringify(o)); } catch (e) { /* 保存できない環境でも止まらない */ }
    },
    /** 割り当ての上書き（{kb, pad} か null）。形は input.js が確かめてから渡す */
    getBinds() { return binds ? JSON.parse(JSON.stringify(binds)) : null; },
    setBinds(b) {
      binds = b ? cleanBinds(b) : null;
      S.save();
      R.emit('settings', { key: 'binds' });
      return true;
    },
    reset() { cur = Object.assign({}, DEFAULTS); binds = null; S.save(); apply('vol.bgm'); apply('scaleMode'); R.emit('settings', { key: '*' }); },
  });

  function apply(key) {
    if (/^vol\./.test(key) && R.Audio && R.Audio.setVolumes) {
      R.Audio.setVolumes(S.get('vol.bgm') / 10, S.get('vol.sfx') / 10, S.get('vol.voice') / 10, S.get('vol.amb') / 10);
    }
    if ((key === 'uiSize' || key === 'scaleMode') && R.fit) R.fit(true);
    if (key === 'display' && R.Display && R.Display.apply) R.Display.apply();
    if (key === 'lang' && R.I18n) R.I18n.setLang(S.get('lang'));
  }
  /** 読んだ割り当ての形を整える（知らない名前・変な値は落とす） */
  function cleanBinds(b) {
    const out = {};
    const code = /^[A-Za-z0-9]{1,24}$/;
    if (b.kb && typeof b.kb === 'object') {
      const kb = {};
      for (const k of Object.keys(b.kb)) {
        const v = b.kb[k];
        if (!/^[a-z]{1,8}$/.test(k) || !Array.isArray(v)) continue;
        kb[k] = v.slice(0, 2).map((c) => (typeof c === 'string' && code.test(c) ? c : null));
      }
      out.kb = kb;
    }
    if (b.pad && typeof b.pad === 'object') {
      const pad = {};
      for (const k of Object.keys(b.pad)) {
        const v = b.pad[k];
        if (/^[a-z]{1,8}$/.test(k) && Number.isInteger(v) && v >= -1 && v <= 31) pad[k] = v;
      }
      out.pad = pad;
    }
    return out.kb || out.pad ? out : null;
  }
})(window.RPG);
