/* Twilight field engine: crisp pixel-art world, smooth light on top.
   One art pixel of the map = one dot of the hero sprite. The view is 960x540 art px.
   Everything about a map lives in map.json (see README.md). No dependencies. */
(() => {
'use strict';

// ------------------------------------------------------------------ helpers
const VW = 960, VH = 540;
const Q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(20261110);
const rr = (a, b) => a + (b - a) * rnd();
const hash1 = i => { let x = Math.imul(i | 0, 374761393) + 668265263 | 0; x = Math.imul(x ^ x >>> 13, 1274126177); return ((x ^ x >>> 16) >>> 0) / 4294967296; };
const vnoise = x => { const i = Math.floor(x), f = x - i; return lerp(hash1(i), hash1(i + 1), f * f * (3 - 2 * f)); };
function hexRgb(h) {
  if (Array.isArray(h)) return h;
  h = String(h || '#ffffff').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
const rgb = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('画像を読み込めません: ' + src)); im.src = src; });
const loadJson = src => fetch(src).then(r => { if (!r.ok) throw new Error(src + ' ' + r.status); return r.json(); });
const DIRS = ['down', 'left', 'right', 'up', 'down_left', 'down_right', 'up_left', 'up_right'];

// ------------------------------------------------------------------ defaults (map.json overrides any of this)
const MOOD_DEFAULTS = {
  gold: {
    name: '金の月の刻',
    ambient: '#efe6f1',        // colour multiplied over the whole world (white = untouched)
    lightGain: .5,             // how far light pools lift that multiply back toward white
    lightRadius: 1,            // scales every light's radius
    brighten: .5,              // second pass: pools brighten and warm what they touch
    brightenMode: 'soft-light',
    glow: .55,                 // additive halos at the light sources
    heroLight: .7,             // the hero's own lantern
    skyTint: '#ffffff',        // multiplied over the sky / far / cloud layers
    moonGlow: 1,
    mist: .3, mistColor: '#f0cdd2',
    fireflies: .3, wisps: 0, motes: .8,
    rays: .5,
    grade: '#ff9a5c', gradeAlpha: .05, gradeMode: 'soft-light',
    vignette: .42, vignetteColor: '#170d2a',
    sparkle: '#fff0d0',
  },
  shadow: {
    name: '影の月の刻',
    ambient: '#5a66ae',
    lightGain: 1.05,
    lightRadius: 1.28,
    brighten: .78,
    brightenMode: 'soft-light',
    glow: 1,
    heroLight: 1.15,
    skyTint: '#6f74c2',
    moonGlow: .8,
    mist: .9, mistColor: '#8fb2e6',
    fireflies: 1, wisps: 1, motes: .5,
    rays: 0,
    grade: '#2c4fb0', gradeAlpha: .12, gradeMode: 'soft-light',
    vignette: .62, vignetteColor: '#05061a',
    sparkle: '#bfe6ff',
  },
};
const DEFAULTS = {
  title: '鐘のならない修道院', titleEn: 'The Abbey of the Silent Bell',
  w: 1920, h: 1080, image: 'map.webp', walk: null, height: null, floor: null, heightBias: 2,
  spawn: { x: null, y: null, dir: 'down' },
  hero: { sheet: 'hero.png', spec: 'hero.json', speed: 150, run: 250, radius: 6, shadow: .34, shadowR: null,
          light: { r: 170, color: '#ffb76a', intensity: 1 } },
  party: [], partyGap: 40,                 // companions who walk the leader's trail: ['party/sword', …] (name.png, name.json)
  occluders: [], lights: [], water: [], triggers: [], emitters: [], props: [],
  layers: {},
  post: { grain: .035, mistScale: 1 },
  mood: 'gold', moodSeconds: 2.5,
  moods: {},
};

// ------------------------------------------------------------------ state
const cv = $('view'), ctx = cv.getContext('2d', { alpha: false });
const stage = $('stage');
const UI_ON = Q.get('ui') !== '0';
const DEBUG = Q.get('debug') === '1';
let showWalk = false;
const OFF = new Set((Q.get('off') || '').split(',').filter(Boolean));   // ?off=mist,rays,grain,light,glow,fg,vignette,grade,particles for diagnosis
if (!UI_ON) document.body.classList.add('noui');
let SC = 2;                         // backing pixels per art pixel (1 = 960x540, 2 = 1920x1080, 3 = 2880x1620 on very large screens)
let W, wx, TM, tx2, L, lx, G, gx, MI, mx;   // offscreen canvases: world, light mask scratch, lightmap, brighten map, mist
let M, HS, A = {};                  // map data, hero spec, assets
let walkData = null, walkW = 0, walkH = 0, walkK = 1;
let mapOpaque = true;
let fData = null, fW = 0, fH = 0, fK = 1;    // floor map (maps with several ground levels): lift of the ground under an actor's feet
let hData = null, hW = 0, hH = 0, hK = 1;   // height map: how far above its own ground line each map pixel stands
let scr = null, scx = null, lanternVis = 1;
let hdr = null;                     // HD-2D renderer (hd.js), only on maps that carry an "hd" entry
const cam = { x: 0, y: 0, lx: 0, ly: 0 };
const hero = { x: 0, y: 0, dir: 0, t: 0, moving: false, running: false, vx: 0, vy: 0 };
const lead = hero;                  // the leader is an actor like the companions: { S, img, runImg, x, y, dir, t, moving, running }
const party = [];                   // companions, in marching order
let trail = [];                     // where the leader has walked: [x, y, dir], oldest first, a point every 2 px or so
const keys = new Set();
const stick = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
let moodT = 0, moodFrom = 0, moodTo = 0, moodClock = 1, P = null, moodNames = ['gold', 'shadow'];
let dlg = null, nearTrig = null;
let T = 0, last = 0, fps = 60, frameMs = 0, slowT = 0, frames = 0;
let lights = [], occ = [], waters = [], layers = {}, props = [];
const parts = { fire: [], wisp: [], leaf: [], mote: [], puff: [], hmote: [] };
const spriteCache = new Map();

// ------------------------------------------------------------------ pre-rendered sprites
function falloff(color, stops) {            // round soft sprite in a colour
  const key = color.join(',') + '|' + stops.join(',');
  let c = spriteCache.get(key);
  if (c) return c;
  c = mk(128, 128);
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], rgb(color, stops[i + 1]));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  spriteCache.set(key, c);
  return c;
}
const POOL = [0, 1, .18, .78, .42, .42, .7, .14, 1, 0];
const HALO = [0, 1, .07, .7, .2, .26, .5, .07, 1, 0];
const SOFT = [0, 1, .5, .35, 1, 0];
let mistTile, grainTile, raysImg, vignImg, vignKey = '';

function buildMistTile() {                  // periodic fbm value noise, white with soft alpha
  const N = 256, c = mk(N, N), x = c.getContext('2d'), im = x.createImageData(N, N), r = mulberry(99);
  const oct = [[4, .55], [8, .28], [16, .17]];
  const grids = oct.map(([p]) => { const g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = r(); return g; });
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    oct.forEach(([p, amp], k) => {
      const fx = i / N * p, fy = j / N * p, ix = Math.floor(fx), iy = Math.floor(fy);
      const ux = smooth(fx - ix), uy = smooth(fy - iy), g = grids[k];
      const a = g[(iy % p) * p + ix % p], b = g[(iy % p) * p + (ix + 1) % p], c2 = g[((iy + 1) % p) * p + ix % p], d = g[((iy + 1) % p) * p + (ix + 1) % p];
      v += amp * lerp(lerp(a, b, ux), lerp(c2, d, ux), uy);
    });
    const a = clamp((v - .4) / .38, 0, 1), o = (j * N + i) * 4;
    im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = smooth(a) * 255;
  }
  x.putImageData(im, 0, 0);
  return c;
}
function buildGrain() {
  const N = 192, c = mk(N, N), x = c.getContext('2d'), im = x.createImageData(N, N), r = mulberry(5);
  for (let i = 0; i < N * N; i++) { const v = 96 + r() * 64 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0);
  return c;
}
function buildRays() {                      // soft shafts falling from the upper left
  const c = mk(640, 360), x = c.getContext('2d'), r = mulberry(31);
  x.save(); x.translate(-60, -120); x.rotate(.6);
  for (let i = 0; i < 9; i++) {
    const y0 = -260 + i * 62 + r() * 34, h = 16 + r() * 46, a = .25 + r() * .5;
    const g = x.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, 'rgba(255,214,168,0)'); g.addColorStop(.5, `rgba(255,214,168,${a})`); g.addColorStop(1, 'rgba(255,214,168,0)');
    x.fillStyle = g; x.fillRect(-100, y0, 1200, h);
  }
  x.restore();
  x.globalCompositeOperation = 'destination-in';
  const f = x.createLinearGradient(0, 0, 520, 330);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(.55, 'rgba(0,0,0,.5)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = f; x.fillRect(0, 0, 640, 360);
  return c;
}
function vignette(color) {
  const key = color.map(v => v >> 2).join(',');
  if (key === vignKey) return vignImg;
  vignKey = key;
  vignImg = vignImg || mk(320, 180);
  const x = vignImg.getContext('2d');
  x.clearRect(0, 0, 320, 180);
  x.save(); x.translate(160, 90); x.scale(1, 180 / 320);
  const g = x.createRadialGradient(0, 0, 70, 0, 0, 190);
  g.addColorStop(0, rgb(color, 0)); g.addColorStop(.55, rgb(color, .22)); g.addColorStop(1, rgb(color, 1));
  x.fillStyle = g; x.fillRect(-160, -160, 320, 320); x.restore();
  return vignImg;
}

// ------------------------------------------------------------------ canvases
function setScale(sc) {
  SC = sc;
  cv.width = VW * SC; cv.height = VH * SC;
  cv.classList.toggle('px', SC === 1);
  W = mk(VW + 2, VH + 2); wx = W.getContext('2d'); wx.imageSmoothingEnabled = false;
  TM = mk(VW + 2, VH + 2); tx2 = TM.getContext('2d');
  L = mk(VW / 2 + 1, VH / 2 + 1); lx = L.getContext('2d');
  G = mk(VW / 2 + 1, VH / 2 + 1); gx = G.getContext('2d');
  MI = mk(VW / 2 + 1, VH / 2 + 1); mx = MI.getContext('2d');
}
function layout() {
  const iw = window.innerWidth, ih = window.innerHeight;
  const portrait = ih > iw * 1.15;
  document.body.classList.toggle('portrait', portrait);
  const w = Math.floor(Math.min(iw, ih * 16 / 9)), h = Math.floor(w * 9 / 16);
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  stage.style.fontSize = Math.max(w / 100, 4.6) + 'px';
  $('below').style.top = h + 'px';
  $('stick').style.fontSize = clamp(w / 100, 7, 11) + 'px';
  const dp = w * (window.devicePixelRatio || 1);
  let want = Q.get('q') === 'low' ? 1 : Q.get('q') === 'high' ? 2 : (dp >= 2700 ? 3 : dp >= 1250 ? 2 : 1);
  if (layout.cap) want = Math.min(want, layout.cap);
  if (!W || want !== SC) setScale(want);
}

// ------------------------------------------------------------------ loading
function norm(def, v) {
  if (v == null) return JSON.parse(JSON.stringify(def));
  if (typeof def !== 'object' || def === null || Array.isArray(def)) return v;
  const o = {};
  for (const k of new Set([...Object.keys(def), ...Object.keys(v)])) o[k] = k in def ? norm(def[k], v[k]) : v[k];
  return o;
}
async function boot() {
  layout();
  const raw = await loadJson(Q.get('map') || 'map.json');
  M = norm(DEFAULTS, raw);
  M.moods = { gold: norm(MOOD_DEFAULTS.gold, raw.moods && raw.moods.gold), shadow: norm(MOOD_DEFAULTS.shadow, raw.moods && raw.moods.shadow) };
  for (const k in M.moods) for (const p in M.moods[k]) if (typeof M.moods[k][p] === 'string' && M.moods[k][p][0] === '#') M.moods[k][p] = hexRgb(M.moods[k][p]);
  const want = [loadImg(M.image), loadImg(M.hero.sheet), loadJson(M.hero.spec), M.walk ? loadImg(M.walk) : null, M.height ? loadImg(M.height).catch(e => (console.warn('height map missing, occlusion by height is off'), null)) : null];
  const lk = Object.keys(M.layers).filter(k => M.layers[k]);
  for (const k of lk) { if (typeof M.layers[k] === 'string') M.layers[k] = { src: M.layers[k] }; want.push(loadImg(M.layers[k].src)); }
  const N0 = want.length;
  const pr = (M.props || []).map(p => loadImg(p.src));
  const got = await Promise.all(want.concat(pr));
  A.map = got[0]; A.hero = got[1]; HS = got[2]; A.walk = got[3]; A.height = got[4];
  if (!raw.w) M.w = A.map.width; if (!raw.h) M.h = A.map.height;
  const LAYER_DEF = { sky: { parallax: .08 }, far: { parallax: .25 }, clouds: { parallax: .12, drift: 4, repeatX: true }, fg: { parallax: 1.2 } };
  lk.forEach((k, i) => {
    const o = Object.assign({ x: 0, y: 0, drift: 0, alpha: 1, scale: 1, anchorX: 'left', anchorY: 'top' }, LAYER_DEF[k] || {}, M.layers[k]);
    const p = o.parallax; o.px = Array.isArray(p) ? p[0] : p; o.py = Array.isArray(p) ? p[1] : p;
    if (o.repeatX == null) o.repeatX = !!o.drift;
    o.img = got[5 + i]; layers[k] = o;
  });
  props = (M.props || []).map((p, i) => Object.assign({ fw: got[N0 + i].width, fh: got[N0 + i].height, frames: 1, ms: 200, shadow: 0 }, p, { img: got[N0 + i] }));
  props.forEach(p => { p.foot = p.foot || [p.fw / 2, p.fh - 4]; });

  // hero sheet
  HS.frame = HS.frame || [96, 128]; HS.foot = HS.foot || [48, 120]; HS.ms = HS.ms || 160;
  HS.rows = Math.max(1, Math.floor(A.hero.height / HS.frame[1])); HS.cols = Math.max(1, Math.floor(A.hero.width / HS.frame[0]));
  HS.body = HS.body || Math.round(HS.frame[1] * .75);
  if (M.hero.shadowR == null) M.hero.shadowR = Math.round(HS.body * .2);
  // run sheets and companions (all optional)
  const folder = p => p.slice(0, p.lastIndexOf('/') + 1);
  const runOf = async (S, base) => (S.run && S.run.src ? loadImg(base + S.run.src).catch(() => null) : null);
  lead.S = HS; lead.img = A.hero; lead.runImg = await runOf(HS, folder(M.hero.spec));
  for (const name of M.party || []) {
    try {
      const [img, S] = await Promise.all([loadImg(name + '.png'), loadJson(name + '.json')]);
      S.frame = S.frame || [96, 128]; S.foot = S.foot || [48, 120]; S.ms = S.ms || 160; S.body = S.body || 80;
      S.rows = Math.max(1, Math.floor(img.height / S.frame[1])); S.cols = Math.max(1, Math.floor(img.width / S.frame[0]));
      party.push({ S, img, runImg: await runOf(S, folder(name)), x: 0, y: 0, dir: 0, t: party.length * .21 + .1, moving: false, running: false });
    } catch (e) { console.warn('仲間の絵を読み込めません: ' + name, e); }
  }

  // walk mask
  if (A.walk) {
    const c = mk(A.walk.width, A.walk.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(A.walk, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    walkW = c.width; walkH = c.height; walkK = M.w / walkW;
    walkData = new Uint8Array(walkW * walkH);
    for (let i = 0; i < walkData.length; i++) walkData[i] = d[i * 4] > 127 && d[i * 4 + 3] > 127 ? 1 : 0;
  }
  // height map: h = R + 256 * G, the screen-space height of each map pixel above its own ground-contact line
  if (A.height) {
    const c = mk(A.height.width, A.height.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(A.height, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    hW = c.width; hH = c.height; hK = M.w / hW;
    hData = new Uint16Array(hW * hH);
    for (let i = 0; i < hData.length; i++) hData[i] = d[i * 4] + 256 * d[i * 4 + 1];
  }
  // floor map, same packing and unit as the height map; only present when the ground has several levels (see README)
  if (M.floor && hData) {
    const im = await loadImg(M.floor), c = mk(im.width, im.height), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    fW = c.width; fH = c.height; fK = M.w / fW;
    fData = new Uint16Array(fW * fH);
    for (let i = 0; i < fData.length; i++) fData[i] = d[i * 4] + 256 * d[i * 4 + 1];
  }
  // does the map let the sky through?
  {
    const k = 8, c = mk(Math.ceil(A.map.width / k), Math.ceil(A.map.height / k)), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(A.map, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    mapOpaque = true;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { mapOpaque = false; break; }
  }
  // occluders: crisp cut-outs of the map, made once
  occ = M.occluders.map(o => {
    if (o.rect) o.poly = [[o.rect[0], o.rect[1]], [o.rect[0] + o.rect[2], o.rect[1]], [o.rect[0] + o.rect[2], o.rect[1] + o.rect[3]], [o.rect[0], o.rect[1] + o.rect[3]]];
    const xs = o.poly.map(p => p[0]), ys = o.poly.map(p => p[1]);
    const x0 = Math.floor(Math.min(...xs)), y0 = Math.floor(Math.min(...ys)), x1 = Math.ceil(Math.max(...xs)), y1 = Math.ceil(Math.max(...ys));
    const c = mk(x1 - x0, y1 - y0), x = c.getContext('2d', { willReadFrequently: true });
    x.beginPath(); o.poly.forEach((p, i) => i ? x.lineTo(p[0] - x0, p[1] - y0) : x.moveTo(p[0] - x0, p[1] - y0)); x.closePath(); x.fill();
    const im = x.getImageData(0, 0, c.width, c.height);
    for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] > 127 ? 255 : 0;       // hard edge: no half-covered pixels
    x.putImageData(im, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.drawImage(A.map, -x0, -y0);
    return { x: x0, y: y0, w: c.width, h: c.height, base: o.base == null ? y1 : o.base, img: c, poly: o.poly };
  });
  // lights
  lights = M.lights.map((l, i) => {
    const kind = l.kind || 'lantern';
    return { kind, x: l.x, y: l.y, gx: l.gx == null ? l.x : l.gx, gy: l.gy == null ? l.y : l.gy, r: l.r || 160, color: hexRgb(l.color || '#ffb060'),
      intensity: l.intensity == null ? 1 : l.intensity, flicker: l.flicker == null ? (kind === 'lantern' ? .15 : .03) : l.flicker, seed: 13.7 * (i + 1), layer: l.layer || null, f: 1 };
  });
  waters = M.water.map(w => {
    const xs = w.poly.map(p => p[0]), ys = w.poly.map(p => p[1]);
    const o = { poly: w.poly, x0: Math.floor(Math.min(...xs)), y0: Math.floor(Math.min(...ys)), x1: Math.ceil(Math.max(...xs)), y1: Math.ceil(Math.max(...ys)), pts: [] };
    const n = Math.round((o.x1 - o.x0) * (o.y1 - o.y0) / 420);
    for (let i = 0, g = 0; i < n && g < n * 20; g++) { const x = rr(o.x0, o.x1), y = rr(o.y0, o.y1); if (inPoly(x, y, w.poly)) { o.pts.push({ x: x | 0, y: y | 0, ph: rnd() * TAU, sp: rr(.7, 2.2), len: rnd() < .35 ? (2 + rnd() * 4 | 0) : 1 }); i++; } }
    return o;
  });
  setupEmitters();

  // hero start
  const qx = parseFloat(Q.get('x')), qy = parseFloat(Q.get('y'));
  hero.x = isFinite(qx) ? qx : (M.spawn.x == null ? M.w / 2 : M.spawn.x);
  hero.y = isFinite(qy) ? qy : (M.spawn.y == null ? M.h / 2 : M.spawn.y);
  hero.dir = Math.max(0, DIRS.indexOf(Q.get('dir') || M.spawn.dir || 'down'));
  if (!free(hero.x, hero.y)) nearestFree();
  const m0 = Q.get('mood') || M.mood;
  moodT = moodFrom = moodTo = m0 === 'shadow' ? 1 : 0;
  camTarget(1e9);

  mistTile = buildMistTile(); grainTile = buildGrain(); raysImg = buildRays();
  if (M.hd && hData && Q.get('hd') !== '0') {
    try {
      const js = src => new Promise((res, rej) => { const e = document.createElement('script'); e.src = src; e.onload = res; e.onerror = () => rej(new Error('読み込めません: ' + src)); document.head.appendChild(e); });
      if (!window.THREE) await js(M.hd.three || 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js');
      if (!window.HD2D) await js('hd.js');
      hdr = await HD2D.create({ M, A, HS, stage, cv, hData, hW, hH, fData, walkData, VW, VH, lights, sky: layers.sky, lift, hides, hexRgb, Q, UI_ON });
    } catch (e) { console.warn('HD-2D 表示を使えないため、2D 表示で続けます', e); hdr = null; }
  }
  setupUi();
  window.__game = api;
  last = performance.now();
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ world queries
function inPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  return c;
}
function walkable(x, y) {
  if (x < 0 || y < 0 || x >= M.w || y >= M.h) return false;
  if (!walkData) return true;
  return walkData[Math.floor(y / walkK) * walkW + Math.floor(x / walkK)] === 1;
}
function free(x, y) {
  const r = M.hero.radius, q = r * .6;
  return walkable(x, y) && walkable(x - r, y) && walkable(x + r, y) && walkable(x, y - q) && walkable(x, y + q) &&
    walkable(x - r * .7, y - q * .7) && walkable(x + r * .7, y - q * .7) && walkable(x - r * .7, y + q * .7) && walkable(x + r * .7, y + q * .7);
}
function nearestFree() {
  for (let r = 4; r < 900; r += 4) for (let a = 0; a < 24; a++) {
    const x = hero.x + Math.cos(a / 24 * TAU) * r, y = hero.y + Math.sin(a / 24 * TAU) * r;
    if (free(x, y)) { hero.x = x; hero.y = y; return; }
  }
}

// ------------------------------------------------------------------ particles
function setupEmitters() {
  const E = M.emitters, fires = E.filter(e => e.kind === 'fireflies');
  for (const e of fires) for (let i = 0; i < (e.n || 12); i++)
    parts.fire.push({ e, x: rr(e.x, e.x + e.w), y: rr(e.y, e.y + e.h), a: rnd() * TAU, sp: rr(7, 17), ph: rnd() * TAU, rate: rr(.5, 1.3), rank: rnd(), hue: rnd() });
  let wis = E.filter(e => e.kind === 'wisps');
  if (!wis.length) wis = fires.map(e => Object.assign({}, e, { n: Math.max(1, Math.round((e.n || 12) / 6)) }));
  for (const e of wis) for (let i = 0; i < (e.n || 3); i++)
    parts.wisp.push({ e, x: rr(e.x, e.x + e.w), y: rr(e.y, e.y + e.h), a: rnd() * TAU, sp: rr(5, 10), ph: rnd() * TAU, trail: [] });
  for (const e of E.filter(e => e.kind === 'leaves')) for (let i = 0; i < (e.n || 10); i++) { const l = { e }; spawnLeaf(l, true); parts.leaf.push(l); }
  for (const e of E.filter(e => e.kind === 'motes')) for (let i = 0; i < (e.n || 16); i++)
    parts.mote.push({ e, x: rr(e.x, e.x + e.w), y: rr(e.y, e.y + e.h), ph: rnd() * TAU, sp: rr(2, 7), tw: rr(.4, 1.3) });
  for (const e of E.filter(e => e.kind === 'mist')) for (let i = 0; i < (e.n || 6); i++)
    parts.puff.push({ e, x: rr(e.x, e.x + e.w), y: rr(e.y, e.y + e.h), w: rr(260, 560), h: rr(50, 110), sp: rr(3, 10) * (rnd() < .5 ? 1 : .6), ph: rnd() * TAU, a: rr(.35, .8) });
  for (let i = 0; i < 9; i++) parts.hmote.push({ x: 0, y: 0, life: 0, max: 1, vx: 0, vy: 0 });
}
const LEAF_COL = [['#c2412d', '#e8743a'], ['#a8322e', '#d85a34'], ['#d9772f', '#f2a64a'], ['#8f2a34', '#c2412d']];
const LEAF_SHAPES = [[[0, 0, 0], [1, 0, 1], [2, 0, 0], [1, 1, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0], [1, 1, 0]], [[0, 1, 0], [1, 0, 1], [2, 1, 0]], [[0, 0, 0], [1, 1, 1], [2, 1, 0]]];
function spawnLeaf(l, initial) {
  const e = l.e;
  l.x = rr(e.x, e.x + e.w); l.y = rr(e.y, e.y + e.h * .7);
  l.fall = rr(70, 210); l.fallen = initial ? rnd() * l.fall : 0; l.vy = rr(20, 34); l.sway = rr(6, 16); l.ph = rnd() * TAU; l.wind = rr(4, 13);
  l.col = rnd() * LEAF_COL.length | 0; l.rest = initial && rnd() < .3 ? rr(0, 6) : -1; l.stay = rr(4, 9); l.x0 = l.x;
  if (l.rest >= 0) { l.fallen = l.fall; }
}

// ------------------------------------------------------------------ mood
function moodParams() {
  const a = M.moods.gold, b = M.moods.shadow, t = moodT, o = {};
  for (const k in a) {
    const va = a[k], vb = b[k];
    o[k] = typeof va === 'number' ? lerp(va, vb, t) : Array.isArray(va) ? mix(va, vb, t) : (t < .5 ? va : vb);
  }
  return o;
}
function setMood(name, instant) {
  const to = name === 'shadow' ? 1 : 0;
  moodFrom = moodT; moodTo = to; moodClock = instant ? 1 : 0;
  if (instant) moodT = to;
  uiMood(to);
}
const toggleMood = () => setMood(moodTo > .5 ? 'gold' : 'shadow');

// ------------------------------------------------------------------ input
const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', Shift: 'run' };
function onKey(e, down) {
  const k = KEYMAP[e.key];
  if (k) { down ? keys.add(k) : keys.delete(k); e.preventDefault(); return; }
  if (!down || e.repeat) return;
  if (e.key === 'z' || e.key === 'Z' || e.key === 'Enter' || e.key === ' ') { interact(); e.preventDefault(); }
  else if (e.key === 'm' || e.key === 'M') toggleMood();
  else if (e.key === 'c' || e.key === 'C') showWalk = !showWalk;   // check view: where the hero cannot go
  else if (hdr) hdr.key(e.key);
}
function interact() {
  if (dlg) { advance(); return; }
  if (nearTrig) openDialog(nearTrig);
}
function setupInput() {
  addEventListener('keydown', e => onKey(e, true));
  addEventListener('keyup', e => onKey(e, false));
  addEventListener('blur', () => keys.clear());
  const st = $('stick'), knob = st.firstElementChild;
  addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest && e.target.closest('#moon, #prompt, .dialog')) return;
    if (dlg) { advance(); return; }
    if (e.pointerType === 'mouse' && !DEBUG) { /* mouse drag also steers, handy on desktop without keys */ }
    if (DEBUG && e.pointerType === 'mouse') { const r = stage.getBoundingClientRect(); console.log('map', Math.round(cam.x + (e.clientX - r.left) / r.width * VW), Math.round(cam.y + (e.clientY - r.top) / r.height * VH)); }
    stick.on = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
    st.style.left = e.clientX + 'px'; st.style.top = e.clientY + 'px'; knob.style.transform = '';
    if (e.pointerType !== 'mouse') st.classList.add('on');
    hideHint();
  });
  addEventListener('pointermove', e => {
    if (!stick.on || e.pointerId !== stick.id) return;
    const R = parseFloat(getComputedStyle(st).fontSize) * 5;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    stick.x = dx / R; stick.y = dy / R;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    if (d > 6) st.classList.add('on');
  });
  const up = e => { if (e.pointerId === stick.id) { stick.on = false; stick.x = stick.y = 0; st.classList.remove('on'); } };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('contextmenu', e => e.preventDefault());
  let moonHold = 0, moonLong = false;                       // touch: hold the moon for a second = the check view (same as the C key)
  $('moon').addEventListener('pointerdown', () => { moonLong = false; clearTimeout(moonHold); moonHold = setTimeout(() => { moonLong = true; showWalk = !showWalk; }, 800); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) $('moon').addEventListener(ev, () => clearTimeout(moonHold));
  $('moon').addEventListener('click', e => { if (!moonLong) toggleMood(); moonLong = false; e.currentTarget.blur(); });
  $('prompt').addEventListener('click', interact);
  for (const d of document.querySelectorAll('.dialog')) d.addEventListener('click', advance);
  addEventListener('resize', layout);
}

// ------------------------------------------------------------------ UI
let hintTimer = 0;
const dialogs = () => [...document.querySelectorAll('.dialog')];
function setupUi() {
  $('titleJp').textContent = M.title; $('titleEn').textContent = M.titleEn || '';
  uiMood(moodTo);
  const touch = matchMedia('(pointer: coarse)').matches;
  $('hint').innerHTML = touch ? 'ドラッグで移動（大きく倒すと走る）　　月をタップで刻を替える' : '<b>← ↑ ↓ →</b>移動<b>Shift</b>走る<b>Z</b>調べる<b>M</b>月を替える<b>C</b>当たり判定を表示';
  $('tipB').innerHTML = '画面を<b>ドラッグ</b>して歩く<br><b>月</b>をタップすると刻が替わる<br><span>横向きにすると大きく遊べます</span>';
  if (touch) $('promptKey').style.display = 'none';
  setupInput();
  $('loading').classList.add('off');
  if (!UI_ON) { $('fade').classList.add('off'); return; }
  setTimeout(() => $('fade').classList.add('off'), 120);
  setTimeout(() => $('title').classList.add('on'), 700);
  setTimeout(() => { $('title').classList.remove('on'); $('moon').classList.add('on'); $('hint').classList.add('on'); hintTimer = setTimeout(hideHint, 9000); }, 5200);
}
function hideHint() { if (hintTimer !== -1 && $('hint').classList.contains('on')) { $('hint').classList.remove('on'); clearTimeout(hintTimer); hintTimer = -1; } }
function uiMood(to) {
  const name = to > .5 ? M.moods.shadow.name : M.moods.gold.name;
  $('moon').classList.toggle('shadow', to > .5);
  $('moonName').textContent = name; $('titleSub').textContent = name;
}
function openDialog(t) {
  dlg = { t, page: 0, n: 0, clock: 0, pages: (t.pages || t.text || ['……']).map(String) };
  for (const d of dialogs()) { d.querySelector('.who').textContent = t.title || ''; d.querySelector('.who').style.display = t.title ? '' : 'none'; d.classList.add('on'); }
  showPage(); hideHint();
}
function showPage() {
  dlg.n = 0; dlg.clock = 0;
  for (const d of dialogs()) { d.classList.remove('done'); d.querySelector('.shown').textContent = ''; d.querySelector('.rest').textContent = dlg.pages[dlg.page]; }
}
function advance() {
  if (!dlg) return;
  const s = dlg.pages[dlg.page];
  if (dlg.n < s.length) { dlg.n = s.length; paintDialog(); return; }
  if (++dlg.page < dlg.pages.length) { showPage(); return; }
  const t = dlg.t; dlg = null;
  for (const d of dialogs()) d.classList.remove('on', 'done');
  if (t.action === 'mood') toggleMood();
  t.seen = true;
}
function paintDialog() {
  const s = dlg.pages[dlg.page];
  for (const d of dialogs()) { d.querySelector('.shown').textContent = s.slice(0, dlg.n); d.querySelector('.rest').textContent = s.slice(dlg.n); d.classList.toggle('done', dlg.n >= s.length); }
}

// ------------------------------------------------------------------ update
function camTarget(k) {
  const pan = dlg && dlg.t.pan ? dlg.t.pan : [0, 0];
  let tx = hero.x + cam.lx + pan[0] - VW / 2, ty = hero.y - (HS ? HS.body * .48 : 46) + cam.ly + pan[1] - VH / 2;
  tx = M.w <= VW ? (M.w - VW) / 2 : clamp(tx, 0, M.w - VW); ty = M.h <= VH ? (M.h - VH) / 2 : clamp(ty, 0, M.h - VH);
  cam.x = k >= 1 ? tx : cam.x + (tx - cam.x) * k; cam.y = k >= 1 ? ty : cam.y + (ty - cam.y) * k;
}
function update(dt) {
  // mood cross-fade
  if (moodClock < 1) { moodClock = Math.min(1, moodClock + dt / M.moodSeconds); moodT = lerp(moodFrom, moodTo, smooth(moodClock)); }
  P = moodParams();
  if (OFF.size) { if (OFF.has('mist')) P.mist = 0; if (OFF.has('rays')) P.rays = 0; if (OFF.has('glow')) P.glow = 0; if (OFF.has('vignette')) P.vignette = 0; if (OFF.has('grade')) P.gradeAlpha = 0; if (OFF.has('particles')) { P.fireflies = -1; P.wisps = 0; P.motes = 0; } if (OFF.has('brighten')) P.brighten = 0; }

  // hero
  let ix = 0, iy = 0;
  if (!dlg) {
    ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0); iy = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
    if (stick.on && Math.hypot(stick.x, stick.y) > .18) { ix = stick.x; iy = stick.y; }
  }
  const mag = Math.hypot(ix, iy);
  hero.moving = false;
  if (mag > 0) {
    let ux = ix / mag, uy = iy / mag;
    const analog = stick.on ? clamp(mag, .45, 1) : 1;
    hero.running = keys.has('run') || (stick.on && mag > .92);
    // snap the facing to 8 directions; analogue input is snapped for movement too so the sprite and the path agree
    const oct = Math.round(Math.atan2(uy, ux) / (Math.PI / 4));
    if (stick.on) { ux = Math.cos(oct * Math.PI / 4); uy = Math.sin(oct * Math.PI / 4); }
    const D8 = { '0': 2, '1': 5, '2': 0, '3': 4, '4': 1, '-4': 1, '-3': 6, '-2': 3, '-1': 7 };
    let d = D8[oct];
    if (HS.rows < 8) d = [0, 1, 2, 3, 1, 2, 1, 2][d];
    // letting go of two keys never happens in the same frame: hold a diagonal facing for a moment before it turns square
    if (d !== hero.dir && hero.dir > 3 && d < 4 && (hero.turnT = (hero.turnT || 0) + dt) < .09) d = hero.dir; else hero.turnT = 0;
    hero.dir = d;
    const total = (hero.running ? M.hero.run : M.hero.speed) * analog * dt;
    const n = Math.max(1, Math.ceil(total / 2)), st = total / n;
    const ox = hero.x, oy = hero.y;
    for (let i = 0; i < n; i++) {
      const dx = ux * st, dy = uy * st;
      if (free(hero.x + dx, hero.y + dy)) { hero.x += dx; hero.y += dy; continue; }
      if (dx && dy) {                                         // diagonal input: slide along whichever axis is open
        if (free(hero.x + dx, hero.y)) { hero.x += dx; continue; }
        if (free(hero.x, hero.y + dy)) { hero.y += dy; continue; }
      }
      let moved = false;                                      // straight into a slanted edge: slide if only one side is open
      for (const ang of [.35, .7, 1.05, 1.3]) {
        const c = Math.cos(ang), s = Math.sin(ang);
        const ax = (dx * c - dy * s) * c, ay = (dx * s + dy * c) * c, bx = (dx * c + dy * s) * c, by = (-dx * s + dy * c) * c;
        const fa = free(hero.x + ax, hero.y + ay), fb = free(hero.x + bx, hero.y + by);
        if (fa !== fb) { if (fa) { hero.x += ax; hero.y += ay; } else { hero.x += bx; hero.y += by; } moved = true; break; }
      }
      if (!moved) {                                           // corner assist: an opening a few dots to one side pulls the hero in
        const px = -uy, py = ux;
        for (const k of [4, 8, 12, 16, 20]) {
          const fa = free(hero.x + px * k + ux * 3, hero.y + py * k + uy * 3) && free(hero.x + px * st, hero.y + py * st);
          const fb = free(hero.x - px * k + ux * 3, hero.y - py * k + uy * 3) && free(hero.x - px * st, hero.y - py * st);
          if (fa !== fb) { const s = fa ? 1 : -1; hero.x += px * st * s; hero.y += py * st * s; moved = true; break; }
          if (fa && fb) break;
        }
      }
      if (!moved) break;
    }
    const mvx = hero.x - ox, mvy = hero.y - oy;
    hero.moving = Math.hypot(mvx, mvy) > total * .15;
    hero.vx = mvx / dt; hero.vy = mvy / dt;
    if (hero.moving) hideHint();
  }
  hero.t = hero.moving ? hero.t + dt * (hero.running && !hero.runImg ? 1.55 : 1) : 0;
  followTrail(dt);

  // camera: follow with a little lead in the walking direction
  const lead = hero.moving ? 34 : 0, sp = Math.hypot(hero.vx, hero.vy) || 1;
  const k = 1 - Math.exp(-dt * 2.2);
  cam.lx += ((hero.moving ? hero.vx / sp * lead : 0) - cam.lx) * k; cam.ly += ((hero.moving ? hero.vy / sp * lead * .7 : 0) - cam.ly) * k;
  camTarget(1 - Math.exp(-dt * (dlg && dlg.t.pan ? 1.6 : 5.5)));

  // triggers
  nearTrig = null;
  if (!dlg) { let best = 1e9; for (const t of M.triggers) { const d = Math.hypot(hero.x - t.x, (hero.y - t.y) * 1.25); if (d < (t.r || 44) && d < best) { best = d; nearTrig = t; } } }
  else { const s = dlg.pages[dlg.page]; if (dlg.n < s.length) { dlg.clock += dt * 30; const n = Math.min(s.length, Math.floor(dlg.clock)); if (n !== dlg.n) { dlg.n = n; paintDialog(); } } }

  // light flicker
  for (const l of lights) l.f = l.flicker ? 1 + l.flicker * ((vnoise(T * 6.5 + l.seed) - .5) * 1.3 + (vnoise(T * 21 + l.seed * 3.1) - .5) * .7) : 1;

  // fireflies and wisps wander inside their home rectangle
  for (const p of parts.fire) {
    p.a += (rnd() - .5) * dt * 4.5;
    const e = p.e; if (p.x < e.x) p.a = lerp(p.a, 0, .1); else if (p.x > e.x + e.w) p.a = lerp(p.a, Math.PI, .1);
    if (p.y < e.y) p.a = lerp(p.a, Math.PI / 2, .1); else if (p.y > e.y + e.h) p.a = lerp(p.a, -Math.PI / 2, .1);
    p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * .6 * dt + Math.sin(T * 1.7 + p.ph) * 3 * dt;
  }
  for (const p of parts.wisp) {
    p.a += Math.sin(T * .35 + p.ph) * dt * .9;
    const e = p.e; if (p.x < e.x || p.x > e.x + e.w || p.y < e.y || p.y > e.y + e.h) p.a += dt * 1.6;
    p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * .5 * dt + Math.sin(T * .9 + p.ph) * 4 * dt;
    if (!p.tt || T - p.tt > .12) { p.tt = T; p.trail.unshift([p.x, p.y]); if (p.trail.length > 9) p.trail.pop(); }
  }
  for (const l of parts.leaf) {
    if (l.fallen < l.fall) { l.fallen += l.vy * dt; l.x0 += l.wind * dt; l.x = l.x0 + Math.sin(T * 1.8 + l.ph) * l.sway; if (l.fallen >= l.fall) l.rest = 0; }
    else { l.rest += dt; if (l.rest > l.stay + 1.5) spawnLeaf(l, false); }
  }
  for (const p of parts.mote) { p.y -= p.sp * dt; p.x += Math.sin(T * .7 + p.ph) * 4 * dt; if (p.y < p.e.y) { p.y = p.e.y + p.e.h; p.x = rr(p.e.x, p.e.x + p.e.w); } }
  for (const p of parts.puff) { p.x += p.sp * dt; if (p.x - p.w / 2 > p.e.x + p.e.w) p.x = p.e.x - p.w / 2; }
  const la = lanternPos();
  for (const p of parts.hmote) {
    p.life += dt;
    if (p.life >= p.max) { p.life = 0; p.max = rr(2.2, 4.5); const a = rnd() * TAU, r = rr(8, 62); p.x = la[0] + Math.cos(a) * r; p.y = la[1] + Math.sin(a) * r * .7; p.vx = rr(-5, 5); p.vy = rr(-10, -3); }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
// Companions keep to the path the leader actually walked, a fixed distance apart, so they never get stuck on anything.
const DV = [[0, 1], [-1, 0], [1, 0], [0, -1], [-.7, .7], [.7, .7], [-.7, -.7], [.7, -.7]];
function seedTrail() {
  trail = []; if (!party.length) return;
  const a = DV[hero.dir] || DV[0], pts = [[hero.x, hero.y, hero.dir]]; let x = hero.x, y = hero.y;
  for (let d = 0; d < party.length * M.partyGap; d += 2) { const nx = x - a[0] * 2, ny = y - a[1] * 2; if (!free(nx, ny)) break; x = nx; y = ny; pts.push([x, y, hero.dir]); }
  trail = pts.reverse(); followTrail(0);
}
function followTrail(dt) {
  if (!party.length) return;
  if (!trail.length) { seedTrail(); return; }
  const last = trail[trail.length - 1], dl = Math.hypot(hero.x - last[0], hero.y - last[1]);
  if (dl > 60) { seedTrail(); return; }                       // the leader was moved by hand
  if (dl >= 2) trail.push([hero.x, hero.y, hero.dir]);
  const gap = M.partyGap;
  let px = hero.x, py = hero.y, acc = 0, i = trail.length - 1, k = 0;
  for (const f of party) {
    const want = ++k * gap; let nx = px, ny = py, nd = f.dir, found = false;
    while (i >= 0) {
      const q = trail[i], seg = Math.hypot(px - q[0], py - q[1]);
      if (acc + seg >= want) { const u = seg ? (want - acc) / seg : 0; nx = px + (q[0] - px) * u; ny = py + (q[1] - py) * u; nd = q[2]; found = true; break; }
      acc += seg; px = q[0]; py = q[1]; nd = q[2]; i--;
    }
    if (!found) { nx = px; ny = py; }                         // the trail is still short: wait at its far end
    else { px = nx; py = ny; acc = want; }
    f.moving = dt > 0 && Math.hypot(nx - f.x, ny - f.y) > dt * 20; f.running = hero.running && f.moving;
    if (f.moving || !dt) { f.dir = Math.min(nd, f.S.rows - 1); f.t += dt; }
    f.x = nx; f.y = ny;
  }
  let len = 0;
  for (let j = trail.length - 1; j > 0; j--) { len += Math.hypot(trail[j][0] - trail[j - 1][0], trail[j][1] - trail[j - 1][1]); if (len > party.length * gap + 12) { trail.splice(0, j - 1); break; } }
}
// which picture an actor shows now: [sheet image, column, row, running?]
function actorFrame(a) {
  const S = a.S, row = Math.min(a.dir, S.rows - 1);
  if (a.moving && a.running && a.runImg) return [a.runImg, Math.floor(a.t * 1000 / (S.run.ms || 105)) % (S.run.cols || 4), row, true];
  const col = a.moving ? [1, 2, 3, 0][Math.floor(a.t * 1000 / S.ms) % 4] : 0;
  return [a.img, Math.min(col, S.cols - 1), row, false];
}
function heroFrame() { const f = actorFrame(hero); return [f[1], f[2], f[3]]; }
function lanternPos() {
  const [c, r, run] = heroFrame(), tab = run && HS.runLantern ? HS.runLantern : HS.lantern, a = tab && tab[r] && tab[r][c];
  const hx = Math.round(hero.x), hy = Math.round(hero.y);
  return a ? [hx - HS.foot[0] + a[0], hy - HS.foot[1] + a[1]] : [hx, hy - Math.round(HS.body * .5)];
}

// ------------------------------------------------------------------ draw: world (art resolution, crisp)
function drawWorld(ox, oy) {
  wx.clearRect(0, 0, W.width, W.height);
  const sx0 = Math.max(0, ox), sy0 = Math.max(0, oy), sx1 = Math.min(A.map.width, ox + W.width), sy1 = Math.min(A.map.height, oy + W.height);
  if (sx1 > sx0 && sy1 > sy0) wx.drawImage(A.map, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 - ox, sy0 - oy, sx1 - sx0, sy1 - sy0);

  // water: rows of the painted water slide a pixel or two, plus sparkles
  for (const w of waters) {
    if (w.x1 < ox || w.x0 > ox + W.width || w.y1 < oy || w.y0 > oy + W.height) continue;
    wx.save(); wx.beginPath(); w.poly.forEach((p, i) => i ? wx.lineTo(p[0] - ox, p[1] - oy) : wx.moveTo(p[0] - ox, p[1] - oy)); wx.closePath(); wx.clip();
    const y0 = Math.max(w.y0, oy, 0), y1 = Math.min(w.y1, oy + W.height, A.map.height);
    for (let y = y0 - y0 % 2; y < y1; y += 2) {
      const d = Math.round(Math.sin(y * .21 + T * 1.5) * 1.3 + Math.sin(y * .083 - T * .9) * 1.2);
      if (d) wx.drawImage(A.map, Math.max(0, w.x0 - 4), y, w.x1 - w.x0 + 8, 2, Math.max(0, w.x0 - 4) - ox + d, y - oy, w.x1 - w.x0 + 8, 2);
    }
    for (const p of w.pts) {
      const b = Math.sin(T * p.sp + p.ph);
      if (b > .72) { wx.globalAlpha = (b - .72) / .28 * .85; wx.fillStyle = rgb(P.sparkle); wx.fillRect(p.x - ox, p.y - oy, p.len, 1); }
    }
    wx.restore(); wx.globalAlpha = 1;
  }

  // leaves lying on the ground
  for (const l of parts.leaf) if (l.rest >= 0) drawLeaf(l, ox, oy, clamp((l.stay + 1.5 - l.rest) / 1.5, 0, 1), 0);

  // actors and occluders, back to front
  const hx = Math.round(hero.x), hy = Math.round(hero.y), FW = HS.frame[0], FH = HS.frame[1];
  const items = [{ y: hero.y, actor: hero }];
  for (const f of party) items.push({ y: f.y - .01, actor: f });
  for (const p of props) items.push({ y: p.y, prop: p });
  const boxes = [[hx - HS.foot[0], hy - HS.foot[1], FW, FH, hero.y]];
  for (const p of props) boxes.push([p.x - p.foot[0], p.y - p.foot[1], p.fw, p.fh, p.y]);
  for (const o of occ) {
    if (o.x > ox + W.width || o.x + o.w < ox || o.y > oy + W.height || o.y + o.h < oy) continue;
    for (const b of boxes) if (b[4] < o.base && b[0] < o.x + o.w && b[0] + b[2] > o.x && b[1] < o.y + o.h && b[1] + b[3] > o.y) { items.push({ y: o.base, occ: o }); break; }
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.occ) wx.drawImage(it.occ.img, it.occ.x - ox, it.occ.y - oy);
    else if (it.prop) {
      const p = it.prop, f = p.frames > 1 ? Math.floor(T * 1000 / p.ms) % p.frames : 0;
      drawActor(p.img, f * p.fw, 0, p.fw, p.fh, Math.round(p.x), Math.round(p.y), p.foot, p.shadow, p.shadowR || p.fw * .28, ox, oy);
    } else { const a = it.actor, S = a.S, f = actorFrame(a); drawActor(f[0], f[1] * S.frame[0], f[2] * S.frame[1], S.frame[0], S.frame[1], Math.round(a.x), Math.round(a.y), S.foot, M.hero.shadow, M.hero.shadowR, ox, oy); }
  }
  // leaves in the air
  for (const l of parts.leaf) if (l.rest < 0) drawLeaf(l, ox, oy, 1, 1);
}
function shadow(c, x, y, a, rx) {             // contact shadow in three hard steps, like a hand-pixelled one
  if (!a) return;
  c.fillStyle = '#0a0618';
  for (const [k, al] of [[1, .32], [.74, .3], [.46, .3]]) {
    c.globalAlpha = a * al; c.beginPath(); c.ellipse(x, y + 1, rx * k, rx * k * .36, 0, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}
// Lift of the ground at an actor's feet (0 on single-level maps). Looks a few pixels around when the exact pixel has no floor.
let lastLift = 0;
function lift(x, y) {
  if (!fData) return 0;
  const i0 = Math.floor(x / fK), j0 = Math.floor(y / fK);
  for (const [a, b] of LIFT_SCAN) {
    const i = i0 + a, j = j0 + b;
    if (i < 0 || j < 0 || i >= fW || j >= fH) continue;
    const v = fData[j * fW + i];
    if (v) return lastLift = v * fK;
  }
  return lastLift;
}
const LIFT_SCAN = [[0, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [0, -5], [0, 5], [-5, 0], [5, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]];
// Is the map pixel (x, y) part of something that stands in front of an actor whose feet are at feetY (lift already added)?
function hides(x, y, feetY) {
  if (!hData || x < 0 || y < 0) return false;
  const i = Math.floor(x / hK), j = Math.floor(y / hK);
  if (i >= hW || j >= hH) return false;
  const h = hData[j * hW + i];
  return h > 2 && y + h * hK > feetY + M.heightBias;
}
// One sprite frame with its contact shadow. With a height map, every pixel that lies behind taller scenery is removed,
// so the hero passes behind columns, walls, arches and trees with no hand-made cut-outs.
const hidIdx = new Uint32Array(96 * 128 * 2);
function drawActor(img, sxp, syp, fw, fh, x, y, foot, sh, shR, ox, oy) {
  const dx = x - foot[0], dy = y - foot[1];
  if (!hData) {
    shadow(wx, x - ox, y - oy, sh, shR);
    wx.drawImage(img, sxp, syp, fw, fh, dx - ox, dy - oy, fw, fh);
    return;
  }
  // quick look: anything tall at all under this frame?  (rows below the feet count as the feet row: the ground there never hides)
  const base = y + lift(x, y);
  let any = false;
  const i0 = Math.max(0, Math.floor(dx / hK)), i1 = Math.min(hW - 1, Math.floor((dx + fw) / hK)), j0 = Math.max(0, Math.floor(dy / hK)), j1 = Math.min(hH - 1, Math.floor((dy + fh) / hK));
  scan: for (let j = j0; j <= j1; j += 2) for (let i = i0, o = j * hW + i0; i <= i1; i += 2, o += 2) if (hData[o] > 2 && Math.min(j * hK, y) + hData[o] * hK > base + M.heightBias) { any = true; break scan; }
  if (!any) {
    shadow(wx, x - ox, y - oy, sh, shR);
    wx.drawImage(img, sxp, syp, fw, fh, dx - ox, dy - oy, fw, fh);
    return;
  }
  if (!scr || scr.width < fw || scr.height < fh) { scr = mk(Math.max(fw, scr ? scr.width : 0), Math.max(fh, scr ? scr.height : 0)); scx = scr.getContext('2d', { willReadFrequently: true }); scx.imageSmoothingEnabled = false; }
  scx.clearRect(0, 0, scr.width, scr.height);
  shadow(scx, foot[0], foot[1], sh, shR);
  scx.drawImage(img, sxp, syp, fw, fh, 0, 0, fw, fh);
  const im = scx.getImageData(0, 0, fw, fh), d = im.data, lim = base + M.heightBias;
  let nHid = 0, nVis = 0;
  for (let j = 0; j < fh; j++) {
    const my = dy + j; if (my < 0) continue;
    const hj = Math.floor(my / hK); if (hj >= hH) break;
    const mr = Math.min(my, y);
    for (let i = 0, o = j * fw * 4 + 3; i < fw; i++, o += 4) {
      if (!d[o]) continue;
      const mxp = dx + i; if (mxp < 0) continue;
      const hi = Math.floor(mxp / hK); if (hi >= hW) break;
      const h = hData[hj * hW + hi];
      if (h > 2 && mr + h * hK > lim) { if (d[o] === 255) { if (nHid < hidIdx.length) hidIdx[nHid++] = o; } else d[o] = 0; }
      else if (d[o] === 255) nVis++;
    }
  }
  // mostly hidden behind scenery: the hidden part stays as a faint pale shape, so the player never loses the hero
  const frac = nHid / Math.max(1, nHid + nVis), sa = Math.round(255 * .36 * clamp((frac - .3) / .3, 0, 1));
  for (let q = 0; q < nHid; q++) { const o = hidIdx[q]; if (sa) { d[o - 3] = 196; d[o - 2] = 204; d[o - 1] = 255; d[o] = sa; } else d[o] = 0; }
  scx.putImageData(im, 0, 0);
  wx.drawImage(scr, 0, 0, fw, fh, dx - ox, dy - oy, fw, fh);
}
function drawLeaf(l, ox, oy, alpha, air) {
  const x = Math.round(l.x) - ox, y = Math.round(l.y + l.fallen) - oy;
  if (x < -4 || y < -4 || x > W.width + 4 || y > W.height + 4) return;
  const sh = LEAF_SHAPES[air ? (Math.floor(T * 5 + l.ph * 3) % LEAF_SHAPES.length) : (l.col % LEAF_SHAPES.length)], c = LEAF_COL[l.col];
  wx.globalAlpha = alpha * (air ? 1 : .9);
  for (const [dx, dy, hi] of sh) { wx.fillStyle = c[hi]; wx.fillRect(x + dx, y + dy, 1, 1); }
  wx.globalAlpha = 1;
}

// ------------------------------------------------------------------ draw: layers behind / in front
function drawLayer(c, o, k) {
  if (!o) return;
  const w = o.img.width * o.scale, h = o.img.height * o.scale;
  const maxX = Math.max(0, M.w - VW), maxY = Math.max(0, M.h - VH);
  let x = o.x - cam.x * o.px + o.drift * T, y = o.y - cam.y * o.py;
  if (o.anchorX === 'center') x += (VW - w) / 2 + maxX / 2 * o.px; else if (o.anchorX === 'right') x += VW - w + maxX * o.px;
  if (o.anchorY === 'bottom') y += VH - h + maxY * o.py; else if (o.anchorY === 'center') y += (VH - h) / 2 + maxY / 2 * o.py;
  c.globalAlpha = o.alpha * (k == null ? 1 : k);
  const dr = (xx, yy) => c.drawImage(o.img, Math.round(xx * SC), Math.round(yy * SC), w * SC, h * SC);
  if (o.repeatX) { x = ((x % w) + w) % w - w; for (let xx = x; xx < VW; xx += w) dr(xx, y); }
  else dr(x, y);
  c.globalAlpha = 1;
  o._x = x; o._y = y;
}

// ------------------------------------------------------------------ draw: frame
function render() {
  if (hdr && hdr.on) { hdr.render({ cam, hero, actors: [hero, ...party].map(a => { const f = actorFrame(a); return { img: f[0], fc: f[1], fr: f[2], x: a.x, y: a.y, S: a.S }; }), la: lanternPos(), P, moodT, T, showWalk }); return; }
  const snap = v => Math.round(v * SC) / SC;
  const cx = snap(cam.x), cy = snap(cam.y), ox = Math.floor(cx), oy = Math.floor(cy), fx = cx - ox, fy = cy - oy;
  const savedCam = [cam.x, cam.y]; cam.x = cx; cam.y = cy;
  const X = x => (x - cx) * SC, Y = y => (y - cy) * SC, CW = cv.width, CH = cv.height;
  drawWorld(ox, oy);

  // ---- lightmap (half art resolution; smooth when scaled up)
  const LW = L.width, LH = L.height, la = lanternPos();
  lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1; lx.fillStyle = rgb(P.ambient); lx.fillRect(0, 0, LW, LH);
  gx.globalCompositeOperation = 'source-over'; gx.globalAlpha = 1; gx.fillStyle = '#808080'; gx.fillRect(0, 0, LW, LH);
  lx.globalCompositeOperation = gx.globalCompositeOperation = 'lighter';
  const pool = (c2, x, y, r, a, col, squash) => { if (a <= .003) return; c2.globalAlpha = Math.min(1, a); c2.drawImage(falloff(col, POOL), (x - ox - r) / 2, (y - oy - r * squash) / 2, r, r * squash); };
  const seen = [];
  for (const l of lights) {
    if (l.kind === 'moon') continue;
    const r = l.r * P.lightRadius * (1 + (l.f - 1) * .35);
    if (l.gx + r < cx || l.gx - r > cx + VW || l.gy + r < cy || l.gy - r > cy + VH) continue;
    seen.push(l);
    const i = l.intensity * l.f, sq = l.kind === 'lantern' ? .78 : 1;
    pool(lx, l.gx, l.gy, r, i * P.lightGain, l.color, sq); pool(gx, l.gx, l.gy, r, i * P.brighten * .5, l.color, sq);
    if (l.gx !== l.x || l.gy !== l.y) { pool(lx, l.x, l.y, r * .45, i * P.lightGain * .8, l.color, 1); pool(gx, l.x, l.y, r * .45, i * P.brighten * .4, l.color, 1); }
  }
  if (P.heroLight > 0) {                      // the lantern the hero carries
    const hl = M.hero.light, col = hexRgb(hl.color), f = 1 + .1 * ((vnoise(T * 7) - .5) * 1.3 + (vnoise(T * 19 + 4) - .5) * .7), i = hl.intensity * P.heroLight * f;
    const r = hl.r * P.lightRadius;
    pool(lx, hero.x, hero.y - 8, r, i * P.lightGain * .9, col, .8); pool(gx, hero.x, hero.y - 8, r, i * P.brighten * .42, col, .8);
    pool(lx, la[0], la[1], r * .42, i * P.lightGain * .7, col, 1); pool(gx, la[0], la[1], r * .42, i * P.brighten * .3, col, 1);
  }
  lx.globalAlpha = gx.globalAlpha = 1;

  // ---- light the world at art resolution: multiply by the lightmap, then let the pools brighten and warm what they touch.
  // (The lightmap is cut to the world's own alpha first, so the sky behind a transparent map stays untouched.)
  const lightPass = (src, mode) => {
    let from = src;
    if (!mapOpaque) {
      tx2.globalCompositeOperation = 'copy'; tx2.imageSmoothingEnabled = true; tx2.drawImage(src, 0, 0, W.width, W.height);
      tx2.globalCompositeOperation = 'destination-in'; tx2.drawImage(W, 0, 0);
      from = TM;
    }
    wx.globalCompositeOperation = mode; wx.imageSmoothingEnabled = true;
    wx.drawImage(from, 0, 0, W.width, W.height);
    wx.globalCompositeOperation = 'source-over'; wx.imageSmoothingEnabled = false;
  };
  if (!OFF.has('light')) { lightPass(L, 'multiply'); if (P.brighten > .01) lightPass(G, P.brightenMode); }

  // ---- compose
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = rgb(mix([26, 20, 52], [8, 8, 26], moodT)); ctx.fillRect(0, 0, CW, CH);
  ctx.imageSmoothingEnabled = false;
  if (!mapOpaque || cx < 0 || cy < 0 || M.w < VW || M.h < VH) {
    drawLayer(ctx, layers.sky); drawLayer(ctx, layers.far); drawLayer(ctx, layers.clouds);
    const st = P.skyTint;
    if (st[0] < 252 || st[1] < 252 || st[2] < 252) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = rgb(st); ctx.fillRect(0, 0, CW, CH); }
    ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
    for (const l of lights) if (l.kind === 'moon') {              // moon halos live behind the map
      const ly = l.layer && layers[l.layer], mxp = ly ? ly._x + l.x * ly.scale : l.x - cx, myp = ly ? ly._y + l.y * ly.scale : l.y - cy;
      ctx.globalAlpha = Math.min(1, .5 * l.intensity * P.moonGlow * (1 + .04 * Math.sin(T * .6 + l.seed)));
      ctx.drawImage(falloff(l.color, SOFT), (mxp - l.r) * SC, (myp - l.r) * SC, l.r * 2 * SC, l.r * 2 * SC);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(W, -fx * SC, -fy * SC, W.width * SC, W.height * SC);
  ctx.imageSmoothingEnabled = true;

  // ---- halos at the light sources
  ctx.globalCompositeOperation = 'lighter';
  for (const l of seen) {
    const a = P.glow * l.intensity * l.f, hr = (l.kind === 'window' ? l.r * .5 : Math.min(l.r * .42, 86)) * (.9 + P.glow * .25);
    ctx.globalAlpha = Math.min(1, a * (l.kind === 'window' ? .45 : .8));
    ctx.drawImage(falloff(l.color, HALO), X(l.x - hr), Y(l.y - hr), hr * 2 * SC, hr * 2 * SC);
  }
  lanternVis += ((hides(la[0], Math.min(la[1], hero.y), hero.y + lift(hero.x, hero.y)) ? .12 : 1) - lanternVis) * .2;
  if (P.heroLight > 0) {
    const col = hexRgb(M.hero.light.color), hr = 34 + 12 * P.glow;
    ctx.globalAlpha = Math.min(1, .5 * P.glow * P.heroLight * lanternVis);
    ctx.drawImage(falloff(col, HALO), X(la[0] - hr), Y(la[1] - hr), hr * 2 * SC, hr * 2 * SC);
  }

  // ---- mist and shafts of dusk light: built small in one canvas, tinted, then screened over the picture in a single pass
  if (P.mist > .01 || P.rays > .01) {
    mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, 0, LW, LH); mx.imageSmoothingEnabled = true;
    const ms = M.post.mistScale * Math.min(1, P.mist);
    if (ms > .005) {
      for (const [sp, par, tw, th, al] of [[5, 1.0, 620, 250, .2], [-11, 1.15, 430, 170, .14]]) {
        mx.globalAlpha = al * ms;
        const x0 = (((-cx * par + T * sp) / 2) % tw + tw) % tw - tw, y0 = (((-cy * par) / 2) % th + th) % th - th;
        for (let y = y0; y < LH; y += th) for (let x = x0; x < LW; x += tw) mx.drawImage(mistTile, x, y, tw, th);
      }
      const sp2 = falloff([255, 255, 255], SOFT);
      for (const p of parts.puff) {
        if (p.x + p.w / 2 < cx || p.x - p.w / 2 > cx + VW || p.y + p.h < cy || p.y - p.h > cy + VH) continue;
        const e = p.e, edge = clamp(Math.min(p.x - e.x + p.w / 2, e.x + e.w + p.w / 2 - p.x) / 160, 0, 1);
        mx.globalAlpha = Math.min(1, p.a * .42 * edge * (.75 + .25 * Math.sin(T * .3 + p.ph)) * ms);
        mx.drawImage(sp2, (p.x - p.w / 2 - cx) / 2, (p.y - p.h / 2 - cy) / 2, p.w / 2, p.h / 2);
      }
      mx.globalAlpha = 1; mx.globalCompositeOperation = 'source-in'; mx.fillStyle = rgb(P.mistColor); mx.fillRect(0, 0, LW, LH);
    }
    if (P.rays > .01) {
      mx.globalCompositeOperation = 'lighter'; mx.globalAlpha = Math.min(1, P.rays * .2 * (.8 + .2 * Math.sin(T * .31)));
      const rxo = -((cx * .12) % 80), ryo = -((cy * .12) % 60);
      mx.drawImage(raysImg, rxo / 2 - 20, ryo / 2 - 15, LW * 1.25, LH * 1.25);
    }
    mx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1;
    ctx.drawImage(MI, 0, 0, LW, LH, 0, 0, LW * 4 * SC / 2, LH * 4 * SC / 2);
  }

  // ---- small lights in the air
  ctx.globalCompositeOperation = 'lighter';
  const FF = falloff([214, 255, 150], SOFT), FF2 = falloff([255, 226, 150], SOFT);
  for (const p of parts.fire) {
    if (p.rank > P.fireflies || p.x < cx - 20 || p.x > cx + VW + 20 || p.y < cy - 20 || p.y > cy + VH + 20) continue;
    const b = Math.max(0, Math.sin(T * p.rate + p.ph)); const k = b * b * b;
    if (k < .02) continue;
    const r = 8 + 5 * k;
    const ec = p.e.color;                                              // an emitter may carry its own colour (crystal blue, moon white …)
    ctx.globalAlpha = .5 * k; ctx.drawImage(ec ? falloff(hexRgb(ec), SOFT) : p.hue < .6 ? FF : FF2, X(p.x - r), Y(p.y - r), r * 2 * SC, r * 2 * SC);
    ctx.globalAlpha = Math.min(1, k * 1.6); ctx.fillStyle = ec ? '#f2fbff' : p.hue < .6 ? '#f4ffd0' : '#fff2c8';
    ctx.fillRect(Math.round(X(Math.round(p.x))), Math.round(Y(Math.round(p.y))), SC, SC);
  }
  if (P.wisps > .01) {
    const WS = falloff([120, 232, 214], SOFT);
    for (const p of parts.wisp) {
      if (p.x < cx - 60 || p.x > cx + VW + 60 || p.y < cy - 60 || p.y > cy + VH + 60) continue;
      const pulse = .7 + .3 * Math.sin(T * 1.3 + p.ph);
      p.trail.forEach((q, i) => { const r = 9 - i * .7; ctx.globalAlpha = P.wisps * .13 * (1 - i / 9) * pulse; ctx.drawImage(WS, X(q[0] - r), Y(q[1] - r), r * 2 * SC, r * 2 * SC); });
      const r = 15; ctx.globalAlpha = P.wisps * .3 * pulse; ctx.drawImage(WS, X(p.x - r), Y(p.y - r), r * 2 * SC, r * 2 * SC);
      ctx.globalAlpha = P.wisps * .9 * pulse; ctx.fillStyle = '#e4fff8'; ctx.fillRect(Math.round(X(Math.round(p.x))), Math.round(Y(Math.round(p.y))), SC, SC);
    }
  }
  if (P.motes > .01) {
    ctx.fillStyle = '#ffe2b0';
    for (const p of parts.mote) {
      if (p.x < cx || p.x > cx + VW || p.y < cy || p.y > cy + VH) continue;
      let lit = .12;
      for (const l of seen) { const d = Math.hypot(p.x - l.gx, (p.y - l.gy) * 1.2) / (l.r * .9); if (d < 1) lit = Math.max(lit, 1 - d); }
      const dh = Math.hypot(p.x - la[0], p.y - la[1]) / 130; if (dh < 1) lit = Math.max(lit, (1 - dh) * P.heroLight);
      ctx.globalAlpha = Math.min(1, P.motes * lit * (.35 + .65 * Math.max(0, Math.sin(T * p.tw + p.ph))));
      ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), 1, 1);
    }
    for (const p of parts.hmote) {
      const k = Math.sin(Math.PI * clamp(p.life / p.max, 0, 1));
      ctx.globalAlpha = Math.min(1, P.motes * P.heroLight * .8 * k); ctx.fillRect(Math.round(X(p.x)), Math.round(Y(p.y)), 1, 1);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  // ---- foreground silhouettes
  if (layers.fg && !OFF.has('fg')) { ctx.imageSmoothingEnabled = false; drawLayer(ctx, layers.fg); ctx.imageSmoothingEnabled = true; }

  // ---- post
  if (P.gradeAlpha > .003) { ctx.globalCompositeOperation = P.gradeMode; ctx.globalAlpha = P.gradeAlpha; ctx.fillStyle = rgb(P.grade); ctx.fillRect(0, 0, CW, CH); }
  ctx.globalCompositeOperation = 'source-over';
  if (P.vignette > .01) { ctx.globalAlpha = P.vignette; ctx.drawImage(vignette(P.vignetteColor), 0, 0, CW, CH); }
  if (M.post.grain > 0 && SC > 1 && !OFF.has('grain')) {
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = M.post.grain;
    const gxo = (frames * 37) % 192, gyo = (frames * 71) % 192;
    ctx.save(); ctx.translate(-gxo, -gyo); ctx.fillStyle = ctx.createPattern(grainTile, 'repeat'); ctx.fillRect(0, 0, CW + 192, CH + 192); ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (DEBUG) debugDraw(X, Y); else if (showWalk) walkDraw(X, Y);

  // ---- interaction prompt follows the hero
  const pr = $('prompt');
  if (nearTrig && !dlg && UI_ON) {
    $('promptText').textContent = nearTrig.label || '調べる';
    pr.style.left = ((hero.x - cx) / VW * 100) + '%'; pr.style.top = ((hero.y - cy - HS.body - 16) / VH * 100) + '%';
    pr.classList.add('on');
  } else pr.classList.remove('on');
  cam.x = savedCam[0]; cam.y = savedCam[1];
}
function walkDraw(X, Y) {
  if (!walkData) return;
  ctx.save(); ctx.fillStyle = 'rgba(255,40,80,.34)';
  const x0 = Math.max(0, Math.floor(cam.x / walkK)), y0 = Math.max(0, Math.floor(cam.y / walkK)), x1 = Math.min(walkW, x0 + VW / walkK + 2);
  for (let j = y0; j < Math.min(walkH, y0 + VH / walkK + 2); j++) {
    let run = -1;                                            // one rectangle per run of blocked cells
    for (let i = x0; i <= x1; i++) {
      const b = i < x1 && !walkData[j * walkW + i];
      if (b && run < 0) run = i;
      else if (!b && run >= 0) { ctx.fillRect(X(run * walkK), Y(j * walkK), (i - run) * walkK * SC, walkK * SC); run = -1; }
    }
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(X(hero.x) - 3, Y(hero.y) - 3, 6, 6);
  ctx.restore();
}
function debugDraw(X, Y) {
  ctx.save(); ctx.lineWidth = 1; ctx.font = '12px monospace';
  if (walkData) {
    ctx.fillStyle = 'rgba(255,40,80,.3)';
    const x0 = Math.max(0, Math.floor(cam.x / walkK)), y0 = Math.max(0, Math.floor(cam.y / walkK));
    for (let j = y0; j < Math.min(walkH, y0 + VH / walkK + 2); j++) for (let i = x0; i < Math.min(walkW, x0 + VW / walkK + 2); i++)
      if (!walkData[j * walkW + i]) ctx.fillRect(X(i * walkK), Y(j * walkK), walkK * SC, walkK * SC);
  }
  for (const o of occ) { ctx.strokeStyle = '#40e0ff'; ctx.beginPath(); o.poly.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = '#ff40ff'; ctx.beginPath(); ctx.moveTo(X(o.x), Y(o.base)); ctx.lineTo(X(o.x + o.w), Y(o.base)); ctx.stroke(); }
  for (const l of lights) { if (l.kind === 'moon') continue; ctx.strokeStyle = '#ffd040'; ctx.strokeRect(X(l.x) - 4, Y(l.y) - 4, 8, 8); ctx.beginPath(); ctx.ellipse(X(l.gx), Y(l.gy), l.r * SC, l.r * SC * .78, 0, 0, TAU); ctx.stroke(); }
  for (const t of M.triggers) { ctx.strokeStyle = '#60ff60'; ctx.beginPath(); ctx.ellipse(X(t.x), Y(t.y), (t.r || 44) * SC, (t.r || 44) * SC / 1.25, 0, 0, TAU); ctx.stroke(); }
  for (const e of M.emitters) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.strokeRect(X(e.x), Y(e.y), e.w * SC, e.h * SC); ctx.fillStyle = '#fff'; ctx.fillText(e.kind, X(e.x) + 4, Y(e.y) + 14); }
  for (const w of waters) { ctx.strokeStyle = '#4090ff'; ctx.beginPath(); w.poly.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath(); ctx.stroke(); }
  ctx.fillStyle = '#fff'; ctx.fillRect(X(hero.x) - 2, Y(hero.y) - 2, 4, 4);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(8, cv.height - 30, 420, 22); ctx.fillStyle = '#fff';
  ctx.fillText(`hero ${hero.x.toFixed(0)},${hero.y.toFixed(0)}  cam ${cam.x.toFixed(0)},${cam.y.toFixed(0)}  ${fps.toFixed(0)}fps ${frameMs.toFixed(1)}ms  SC${SC}`, 14, cv.height - 14);
  ctx.restore();
}

// ------------------------------------------------------------------ loop
function frame(now) {
  const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
  const t0 = performance.now();
  T += dt; frames++;
  update(dt); render();
  const ms = performance.now() - t0;
  frameMs += (ms - frameMs) * .05; fps += (1 / dt - fps) * .05;
  // a slow device drops to the 960x540 backing store once (the picture is the same, the light is just less fine)
  if (SC > 1 && Q.get('q') !== 'high' && frames > 90) { slowT = fps < 40 ? slowT + dt : 0; if (slowT > 3) { slowT = 0; layout.cap = SC - 1; setScale(SC - 1); } }
  requestAnimationFrame(frame);
}
const api = {
  get hero() { return { x: hero.x, y: hero.y, dir: DIRS[hero.dir], moving: hero.moving }; },
  get hd() { return hdr; },
  get cam() { return { x: cam.x, y: cam.y }; },
  get mood() { return moodTo > .5 ? 'shadow' : 'gold'; }, get moodT() { return moodT; },
  get fps() { return fps; }, get frameMs() { return frameMs; }, get scale() { return SC; },
  get dialog() { return dlg ? { title: dlg.t.title, page: dlg.page, pages: dlg.pages.length } : null; },
  get near() { return nearTrig ? nearTrig.title || true : null; },
  get map() { return M; },
  ready: true, setMood, toggleMood, interact, walkable, free,
  teleport(x, y, dir) { hero.x = x; hero.y = y; if (dir) hero.dir = Math.max(0, DIRS.indexOf(dir)); seedTrail(); camTarget(1); },
  get party() { return party; }, keys,
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { T += dt; update(dt); } render(); },
};

boot().catch(e => { console.error(e); $('err').textContent = '読み込みに失敗しました\n' + (e && e.message || e); $('loading').classList.add('off'); });
})();
