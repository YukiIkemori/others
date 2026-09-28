// デスクトップ版の最小の入れ物（Electron の main）。デプロイには入れない（v2/tools/build.js・deploy とは別。手元で `npx electron v2/desktop`）
//   ・v2/dist（build.js の出力。CHRONICLE_DIST で変えられる）を app:// で出す（file:// では外に置いた媒体が読めないため）
//   ・外への通信はすべて止める（http・https・ws。ゲームは実行時に外へ通信しない）
//   ・記録と設定は <userData>/saves/<name>.json（store.js）。ゲームの側は preload.js の window.chronicleDesktop だけを使う
//   ・全画面は F11・Alt+Enter と設定から（ゲームの側が win:fullscreen を呼ぶ）。メニューの帯は出さない
'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, protocol, session, Menu } = require('electron');
const { makeStore } = require('./store');

const DIST = path.resolve(process.env.CHRONICLE_DIST || path.join(__dirname, '..', 'dist'));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

let win = null;
let store = null;

function serveApp(req) {
  const u = new URL(req.url);
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
  const f = path.resolve(DIST, rel);
  if (f !== DIST && !f.startsWith(DIST + path.sep)) return new Response('forbidden', { status: 403 });
  try {
    const buf = fs.readFileSync(f);
    return new Response(buf, { headers: { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' } });
  } catch (e) {
    return new Response('not found', { status: 404 });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1920, height: 1080, useContentSize: true, backgroundColor: '#070812', show: false,
    title: 'ルミナス・クロニクル',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  win.on('enter-full-screen', () => win.webContents.send('win:fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('win:fullscreen', false));
  // 別の窓・よそへの移動はしない
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  win.loadURL('app://game/index.html');
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  store = makeStore(path.join(app.getPath('userData'), 'saves'));
  protocol.handle('app', serveApp);
  // 外への通信を止める（app: と devtools: と data: / blob: だけ）
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ipcMain.handle('store:read', (_e, n) => store.read(n));
  ipcMain.handle('store:write', (_e, n, t) => store.write(n, t));
  ipcMain.handle('store:list', () => store.list());
  ipcMain.handle('store:remove', (_e, n) => store.remove(n));
  ipcMain.handle('win:fullscreen', (_e, v) => { if (win) win.setFullScreen(!!v); return !!v; });
  ipcMain.handle('win:isFullscreen', () => !!(win && win.isFullScreen()));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
