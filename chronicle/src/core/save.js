// Settings + save storage. The game-state (de)serialisation lives in
// systems/state.js (R.State.serialize / R.State.deserialize); this module only
// stores opaque JSON-able objects in slots.
//
// Storage backends are pluggable: localStorage by default (always wrapped in
// try/catch), an in-memory fallback, and main.js may install the claude.ai
// artifact `db` backend when available. All slot APIs are async.
(function (R) {
  'use strict';
  const SLOTS = 3;
  const PREFIX = 'luminous_chronicle_';

  // ------------------------------------------------------------ settings
  const DEFAULT_SETTINGS = {
    msgSpeed: 2, // 0 slow, 1 normal, 2 fast, 3 instant
    battleSpeed: 1, // 0 normal, 1 fast, 2 fastest
    bgmVolume: 0.6,
    sfxVolume: 0.7,
    alwaysDash: false, // dash = hold B (or Shift) while moving; this makes running the default
    fieldZoom: 'wide', // field view: 'normal' (16×14 tiles) | 'wide' (≈21×19) | 'wider' (32×28); see field.js VIEW
    windowColor: 'ink', // ink | black | blue | green | red
    touchPad: 'auto', // auto | on | off
    cursorMemory: true, // battle command cursor remembers last choice
    padConfirm: 'right', // gamepad confirm button: 'right' (○/Nintendo A) or 'bottom' (×/Xbox A)
    autoKeep: true, // auto battle carries over to the next random encounter
    settingsVer: 3, // bumped when a default changes for existing players (see migrateSettings)
  };
  /** bring settings stored by an older version up to date (in place) */
  function migrateSettings(s) {
    const v = +s.settingsVer || 1;
    // v2: dash moved to "hold B"; always-dash is now off by default
    if (v < 2) s.alwaysDash = false;
    if (v < 3 && (!s.windowColor || s.windowColor === 'black')) s.windowColor = 'ink';
    s.settingsVer = DEFAULT_SETTINGS.settingsVer;
    return v < DEFAULT_SETTINGS.settingsVer;
  }
  R.Settings = Object.assign({}, DEFAULT_SETTINGS);
  R.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  function lsGet(k) { try { return window.localStorage.getItem(PREFIX + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(PREFIX + k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ } }

  const memory = {};
  const LocalBackend = {
    name: 'local',
    async get(key) {
      const v = lsGet(key);
      if (v != null) { try { return JSON.parse(v); } catch (e) { return null; } }
      return key in memory ? R.U.clone(memory[key]) : null;
    },
    async set(key, obj) { memory[key] = R.U.clone(obj); lsSet(key, JSON.stringify(obj)); return true; },
    async del(key) { delete memory[key]; lsDel(key); },
  };

  const Save = (R.Save = {
    SLOTS,
    backend: LocalBackend,
    LocalBackend,
    loadSettings() {
      const v = lsGet('settings');
      if (v) {
        try {
          const stored = JSON.parse(v) || {};
          const changed = migrateSettings(stored);
          Object.assign(R.Settings, stored);
          if (changed) Save.saveSettings();
        } catch (e) { /* ignore */ }
      }
      return R.Settings;
    },
    migrateSettings,
    saveSettings() { lsSet('settings', JSON.stringify(R.Settings)); },

    /** [{slot, summary}|null, ...] summary = data.summary (set by State.serialize) */
    async list() {
      const out = [];
      for (let i = 0; i < SLOTS; i++) {
        let d = null;
        try { d = await Save.backend.get('slot' + i); } catch (e) { console.error(e); }
        out.push(d ? { slot: i, summary: d.summary || {} } : null);
      }
      return out;
    },
    async load(slot) {
      try { return await Save.backend.get('slot' + slot); } catch (e) { console.error(e); return null; }
    },
    async save(slot, data) {
      try { await Save.backend.set('slot' + slot, data); } catch (e) { console.error(e); return false; }
      // mirror to local as a safety net when using a remote backend
      if (Save.backend !== LocalBackend) LocalBackend.set('slot' + slot, data);
      Save.lastSlot = slot; lsSet('lastSlot', String(slot));
      return true;
    },
    async remove(slot) { try { await Save.backend.del('slot' + slot); } catch (e) { console.error(e); } },
    get lastSlot() { const v = lsGet('lastSlot'); return v == null ? 0 : +v; },
    set lastSlot(v) { lsSet('lastSlot', String(v)); },

    /** ふっかつのじゅもん: portable text code for a save object */
    async exportCode(data) {
      const json = JSON.stringify(data);
      const bytes = new TextEncoder().encode(json);
      if (typeof CompressionStream !== 'undefined') {
        const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        const buf = new Uint8Array(await new Response(cs).arrayBuffer());
        return 'CH1:' + b64(buf);
      }
      return 'CH0:' + b64(bytes);
    },
    async importCode(code) {
      code = String(code || '').trim().replace(/\s+/g, '');
      try {
        if (code.startsWith('CH1:')) {
          const buf = unb64(code.slice(4));
          const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return JSON.parse(await new Response(ds).text());
        }
        if (code.startsWith('CH0:')) return JSON.parse(new TextDecoder().decode(unb64(code.slice(4))));
      } catch (e) { console.error(e); }
      return null;
    },
  });

  function b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str), out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
})(window.RPG);
