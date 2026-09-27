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
    wipe: 'retry',
    uiSize: 1,
    panel: 'normal',
    brightness: 1,
    fx: 'high',
    prompts: 'first2h',
    'vol.bgm': 7,
    'vol.sfx': 7,
    'vol.voice': 8,
    confirmButton: 'right',
    touchPad: 'auto',
    colorAssist: false,
    lessFlash: false,
    reduceMotion: false,
    ruby: false,
    shake: 'on',
    battleVoice: 'on',   // 戦闘ボイス: あり／大技だけ／なし（BRIEF A37、BSCENE が読む）
  };
  const VOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const CHOICES = {
    textSpeed: ['slow', 'normal', 'fast', 'instant'],
    battleSpeed: [1, 2, 3],
    alwaysDash: [false, true],
    cursorMemory: [true, false],
    fieldZoom: ['near', 'normal', 'far'],
    wipe: ['retry', 'inn'],
    uiSize: [1, 1.15, 1.3],
    panel: ['normal', 'dense'],
    brightness: [0.85, 1, 1.25],
    fx: ['high', 'low', 'off'],
    prompts: ['always', 'first2h', 'never'],
    'vol.bgm': VOL, 'vol.sfx': VOL, 'vol.voice': VOL,
    confirmButton: ['right', 'down'],
    touchPad: ['auto', 'on', 'off'],
    colorAssist: [false, true], lessFlash: [false, true], reduceMotion: [false, true], ruby: [false, true],
    shake: ['on', 'weak', 'off'],
    battleVoice: ['on', 'big', 'off'],
  };
  const KEY = 'settings';
  let cur = Object.assign({}, DEFAULTS);

  function store() {
    try { return window.localStorage || null; } catch (e) { return null; }
  }

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
      const ls = store();
      let raw = null;
      try { raw = ls && ls.getItem(R.SAVE_PREFIX + KEY); } catch (e) { raw = null; }
      cur = Object.assign({}, DEFAULTS);
      if (raw) {
        try {
          const o = JSON.parse(raw) || {};
          for (const k of Object.keys(o)) if (CHOICES[k] && CHOICES[k].includes(o[k])) cur[k] = o[k];
        } catch (e) { /* 壊れた設定は既定に */ }
      }
      for (const k of ['vol.bgm']) apply(k, cur[k]);
      return S.all();
    },
    save() {
      const ls = store();
      try { if (ls) ls.setItem(R.SAVE_PREFIX + KEY, JSON.stringify(cur)); } catch (e) { /* 保存できない環境でも止まらない */ }
    },
    reset() { cur = Object.assign({}, DEFAULTS); S.save(); apply('vol.bgm'); R.emit('settings', { key: '*' }); },
  });

  function apply(key) {
    if (/^vol\./.test(key) && R.Audio && R.Audio.setVolumes) {
      R.Audio.setVolumes(S.get('vol.bgm') / 10, S.get('vol.sfx') / 10, S.get('vol.voice') / 10);
    }
    if (key === 'uiSize' && R.fit) R.fit(true);
  }
})(window.RPG);
