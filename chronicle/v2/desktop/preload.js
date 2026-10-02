// デスクトップ版の橋（preload）: ゲームの側に window.chronicleDesktop を出す（src/core/storage.js・src/core/display.js が使う）
//   read(name) / write(name, text) / list() / remove(name)  → Promise（記録と設定のファイル。main.js の store:*）
//   setFullscreen(bool) / isFullscreen() → Promise、onFullscreen(cb)  ウィンドウの全画面
//   readClipboard() / writeClipboard(text) → Promise  写し取り（冒険の合言葉。許可の要る navigator.clipboard の代わり）
// ゲームの側からは node にも fs にも触れない（contextIsolation。渡すのはこの関数だけ）
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chronicleDesktop', {
  kind: 'desktop',
  read: (name) => ipcRenderer.invoke('store:read', String(name)),
  write: (name, text) => ipcRenderer.invoke('store:write', String(name), String(text)),
  list: () => ipcRenderer.invoke('store:list'),
  remove: (name) => ipcRenderer.invoke('store:remove', String(name)),
  setFullscreen: (v) => ipcRenderer.invoke('win:fullscreen', !!v),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  readClipboard: () => ipcRenderer.invoke('clip:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clip:write', String(text)),
  onFullscreen: (cb) => { ipcRenderer.on('win:fullscreen', (_e, v) => { try { cb(!!v); } catch (err) { /* */ } }); },
});
