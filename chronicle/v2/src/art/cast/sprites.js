// CAST: 原画のスプライト（A34・A35）の取り込み。v2/assets/sprites/<look>/<kind>.png＋.json（design/sprite_pipe/tools/to_v2.py の出力）を
// ビルドが RPG_MEDIA.sprites['<look>:<kind>'] にしたものから、§2.5.7 の Sheet（hd:field・hd:btl・hd:face）を作る。
//   kind = field / battle / face / bare（武器なしの戦闘ポーズ）/ weapons（武器 5 つ、持ち手 grip と先 tip）
//   R.Art.cast.sprites.state(look, kind) → 'none'|'loading'|'ready'|'failed'
//   R.Art.cast.sprites.battle(look, wtype) / field(look, opts) / face(look) → Sheet | null（まだ読めていない）| undefined（原画なし）
// 足りない動きは画像のつなぎ（R.Art.rig.tween）で作る。武器は bare＋weapons があれば持ち手に付けて系統ごとに焼き、
// 無ければ描かれた武器（設定資料は剣）のまま（meta.weaponDrawn、meta.weaponMismatch）。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const cast = (Art.cast = Art.cast || {});
  const SP = (cast.sprites = cast.sprites || {});

  const mk = (w, h) => R.Hd.RZ.canvas(w, h);
  // 起動のときに原画を読み終えてから（§2.11）。読めなかった look は仮の絵に戻る
  R.onBoot(async function () {
    if (!R.Media || !R.Media.preload || typeof Image === 'undefined') return;
    SP.loaded = await R.Media.preload('sprites');
    // 読む前に焼こうとして null（後でまた）になった物を忘れる
    const lks = SP.looks().concat(Object.keys(R.DB.looks || {}).filter((l) => R.DB.looks[l] && R.DB.looks[l].spriteOf));
    for (const look of lks) for (const p of ['hd:btl:' + look + ':', 'hd:field:' + look, 'hd:face:' + look]) for (const k of R.Hd.keys(p)) if (R.Hd.forget) R.Hd.forget(k);
    // 読み込み待ちで null を返した印（30 フレームは積み直さない）も消す: 読み終えたらすぐ焼けるように
    const F = R.Hd._s && R.Hd._s.failed;
    if (F) for (const ck of Array.from(F.keys())) if (/^hd:(btl|field|face):/.test(ck)) F.delete(ck);
  });
  // データだけの道: 原画のフォルダ（RPG_MEDIA.sprites の '<look>:<kind>'）に look が無ければ、原画の meta から最小の K.look を足す
  // （looks_sprite.js に載っていない、後から届いたフォルダの分。絵は原画だけ。名前はフォルダの id）。読み込み時は表を読むだけ
  (function () {
    const M = typeof window !== 'undefined' && window.RPG_MEDIA && window.RPG_MEDIA.sprites;
    if (!M) return;
    const seen = {};
    for (const k of Object.keys(M)) {
      const look = k.split(':')[0];
      if (seen[look] || (R.DB.looks && R.DB.looks[look])) continue;
      seen[look] = true;
      const npc = (M[k] && M[k].meta && M[k].meta.npc) || {};
      const animal = npc.kind === 'animal' || /^ani_/.test(look);
      const f = /woman|old_f/.test(look);
      R.def('looks', look, { name: look, sprite: true, body: { sex: f ? 'f' : 'm', build: f ? 'slim' : 'normal', age: /child/.test(look) ? 'short' : /old/.test(look) ? 'old' : 'adult' },
        skin: 'fair', eyes: '#3a4a5a', hair: { style: animal ? 'bald' : f ? 'bob' : 'short', color: '#4a3424', ears: animal ? 'show' : 'hidden' },
        outfit: { type: 'tunic', main: String(npc.mainHex || '#6a5a4a').toLowerCase(), sub: '#4a4034', trim: '#a88c5c' }, extras: [], hue: 0,
        silhouette: 'sprite_' + look, face: !!M[look + ':face'], animal: animal ? look.replace(/^ani_/, '') : undefined });
    }
  })();
  // 町の人の色違い（原画の meta.npc.variants = npc_<型>_1〜4、recolor）: 色違いの look を足す（原画は元の型のフォルダ、主色 mainHex の画素だけ色相を回す）。
  // _1 は原画のまま、_2〜_4 は VAR_HUE の分だけ回す
  (function () {
    const M = typeof window !== 'undefined' && window.RPG_MEDIA && window.RPG_MEDIA.sprites;
    if (!M) return;
    for (const k of Object.keys(M)) {
      if (!/:field$/.test(k)) continue;
      const base = k.split(':')[0], npc = (M[k] && M[k].meta && M[k].meta.npc) || {};
      if (!npc.recolor || !Array.isArray(npc.variants)) continue;
      const bd = (R.DB.looks && R.DB.looks[base]) || {};
      npc.variants.forEach((vid, i) => {
        if (R.DB.looks && R.DB.looks[vid]) return;
        R.def('looks', vid, Object.assign({}, bd, { sprite: true, spriteOf: base, variant: i + 1, face: false }));
      });
    }
  })();
  const hasRaw = (look, kind) => !!(R.Media && R.Media.has && R.Media.has('sprites', look + ':' + kind));
  /** 原画のフォルダ: 自分のフォルダ、無ければ色違いの元（spriteOf）→ {look, v}（v = 色違いの番号。0・1 は原画のまま）| null */
  function src(look, kind) {
    if (!look) return null;
    if (hasRaw(look, kind)) return { look, v: 0 };
    const L = R.DB.looks && R.DB.looks[look];
    if (L && L.spriteOf && hasRaw(L.spriteOf, kind)) return { look: L.spriteOf, v: L.variant || 0 };
    return null;
  }
  SP.src = src;
  SP.has = function (look, kind) { return !!src(look, kind); };
  /** 原画の画像の状態 */
  SP.state = function (look, kind) {
    const s0 = src(look, kind);
    if (!s0) return 'none';
    const rec = R.Media.image(s0.look + ':' + kind, 'sprites');
    if (!rec) return 'failed';
    return rec.ready ? 'ready' : rec.failed ? 'failed' : 'loading';
  };

  // ------------------------------------------------------------------ 町の人の型 → 地方の原画（FIELD が人を置くときに呼ぶ）
  // 地図の look が手で描く仮の型（npc_man_1・npc_woman_2 …、looks_npc.js）で原画のフォルダが無いとき、マップの地方の原画の型
  // （序章・半島 = npc_pen_*、森 = npc_forest_*、ユラ = npc_yura_*、ほかの地方 = npc_<地方>_*）の同じ番号の色違いへ。
  // 原画のフォルダがある look（名前のある人・物語の人）はそのまま（原画が必ず先）。
  const TYPE_ALIAS = {
    man: ['man'], woman: ['woman'], old_m: ['old_m', 'man'], old_f: ['old_f', 'woman'], child: ['child'],
    sailor: ['sailor', 'man'], guard: ['guard', 'watch', 'man'], merchant: ['keeper', '=npc_traveler', 'man'], keeper: ['keeper', 'woman'],
    woodcutter: ['=npc_woodcutter', 'man'], bard: ['=npc_bard', 'man'], yura_folk: [],
  };
  function regionKeys(map) {
    const m = map || {}, reg = String(m.region || ''), out = [];
    if (m.location === 'yura') out.push('yura');
    if (reg === 'prologue' || reg === 'r_prologue' || reg === 'r_pen') out.push('pen');
    else if (reg === 'r_forest') out.push('forest');
    else if (reg) out.push(reg.replace(/^r_/, ''));
    for (const k of ['forest', 'pen']) if (!out.includes(k)) out.push(k);
    return out;
  }
  cast.fieldLook = function (look, map) {
    if (!look || SP.has(look, 'field')) return look;
    const mm = /^npc_([a-z_]+?)_(\d)$/.exec(look);
    if (!mm || !(mm[1] in TYPE_ALIAS)) return look;
    const type = mm[1], n = +mm[2];
    let cands = [];
    if (type === 'yura_folk') cands = n % 2 ? ['=npc_yura_woman', '=npc_forest_woman'] : ['=npc_yura_man', '=npc_forest_man'];
    else for (const k of regionKeys(map)) for (const t of TYPE_ALIAS[type]) cands.push(t[0] === '=' ? t : 'npc_' + k + '_' + t);
    for (let c of cands) {
      c = c.replace(/^=/, '');
      if (!hasRaw(c, 'field')) continue;
      // 色違いの look（spriteOf がこの原画）だけ。npc_bard_1・npc_woodcutter_1 など手で書いた仮の型の look と名前が同じでも、そちらは使わない
      // （オーナーの報告 2026-09-27: 潮風亭の吟遊詩人が古い仮の絵のまま）
      const v = c + '_' + n, L = R.DB.looks && R.DB.looks[v];
      return L && L.spriteOf === c ? v : c;
    }
    return look;
  };

  // ------------------------------------------------------------------ 色違い（主色の画素の色相を回す）
  const VAR_HUE = [0, 0, 125, 205, 290];
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
  }
  function rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }
  const tintCache = {};
  /** 元の画像を色違いにした canvas（主色 mainHex に近い画素だけ: 色相 ±14°（淡い主色は ±20°）・彩度と明るさが近い）。肌と髪は残す */
  function tinted(img, key, mainHex, v) {
    const ck = key + '#' + v;
    if (tintCache[ck]) return tintCache[ck];
    const c = mk(img.width, img.height), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(img, 0, 0);
    const hex = String(mainHex || '').replace('#', '');
    const shift = VAR_HUE[v] || 0;
    if (hex.length === 6 && shift) {
      const [h0, s0, l0] = hsl(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
      const dh = s0 < 0.25 ? 20 : 14, ds = Math.max(0.1, s0 * 0.6);
      // 暖色の主色（茶・黄土、色相 12〜60°）は肌と髪と同じ色の帯なので回さない（色違いは原画のまま）
      if (h0 >= 12 && h0 <= 60) return (tintCache[ck] = c);
      const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
      const memo = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        let out = memo.get(k);
        if (out === undefined) {
          const [h, s, l] = hsl(d[i], d[i + 1], d[i + 2]);
          const hd = Math.min(Math.abs(h - h0), 360 - Math.abs(h - h0));
          out = s >= 0.06 && hd <= dh && Math.abs(s - s0) <= ds && Math.abs(l - l0) <= 0.32 ? rgb((h + shift) % 360, Math.min(1, s * 1.05), l) : null;
          memo.set(k, out);
        }
        if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; }
      }
      x.putImageData(id, 0, 0);
    }
    if (R.Hd && R.Hd.track) R.Hd.track('sprite', 'cast:tint:' + ck, c.width * c.height * 4);
    return (tintCache[ck] = c);
  }
  /** 原画のある look（どれか 1 つの kind でも） */
  SP.looks = function () {
    const t = (R.Media && R.Media.table && R.Media.table().sprites) || {};
    const out = {};
    for (const k of Object.keys(t)) out[k.split(':')[0]] = true;
    return Object.keys(out).sort();
  };
  function rec(look, kind) { const s0 = src(look, kind); const r = s0 && R.Media.image(s0.look + ':' + kind, 'sprites'); return r && r.ready ? r : null; }
  function meta(look, kind) { const s0 = src(look, kind); const e = s0 && R.Media.entry('sprites', s0.look + ':' + kind); return (e && e.meta) || null; }

  /** 1 コマを切り出す → {c, ox, oy, id, points}（ox, oy = そのコマの anchor） */
  function cut(img, f, flip) {
    const c = mk(f.w, f.h), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (flip) { x.translate(f.w, 0); x.scale(-1, 1); }
    x.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
    const a = f.anchor || [f.w >> 1, f.h - 1];
    return { c, ox: flip ? f.w - 1 - a[0] : a[0], oy: a[1], id: f.id, points: f.points || {} };
  }
  function frames(look, kind) {
    const r = rec(look, kind), m = meta(look, kind);
    if (!r || !m) return null;
    const s0 = src(look, kind);
    const img = s0 && s0.v >= 2 ? tinted(r.img, s0.look + ':' + kind, m.npc && m.npc.mainHex, s0.v) : r.img;
    const out = {};
    for (const f of m.frames || []) out[f.id] = cut(img, f);
    return { by: out, meta: m, img };
  }
  /** 拡大・縮小（最近傍。フィールドの「ちかい」「ひろい」） */
  function scaleFrame(fr, k) {
    if (Math.abs(k - 1) < 0.02) return fr;
    const w = Math.max(1, Math.round(fr.c.width * k)), h = Math.max(1, Math.round(fr.c.height * k));
    const c = mk(w, h), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(fr.c, 0, 0, w, h);
    return { c, ox: Math.round(fr.ox * k), oy: Math.round(fr.oy * k), id: fr.id, points: fr.points, k };
  }
  /** 頭の中心（描く点からの相対）: 体の中心の列のまわりで一番上の不透明な行（武器を掲げても頭を拾う）から頭の半径だけ下 */
  function headAnchor(fr, headR) {
    const c = fr.c, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    const k = fr.k || 1;
    const cp = fr.points && fr.points.center;
    const cx = cp ? Math.round(cp[0] * k) : fr.ox;
    const band = Math.max(3, Math.round(headR * 0.6));
    for (let y = 0; y < h; y++) {
      let sx = 0, n = 0;
      for (let x = Math.max(0, cx - band); x <= Math.min(w - 1, cx + band); x++) if (d[(y * w + x) * 4 + 3] > 0) { sx += x; n++; }
      if (n >= 2) return [Math.round(sx / n - fr.ox), Math.round(y + headR - fr.oy)];
    }
    return null;
  }

  // ------------------------------------------------------------------ 戦闘
  // 設定資料の 8 コマ（idle_a idle_m idle_b thrust slash hit ko victory_a）と、シートの形（idle_a idle_b step guard …）の両方を読む。
  // 無いポーズは近いコマ＋つなぎ（前のめり・かがむ・跳ねる）で作る
  const BTL_PLAN = {
    idle: [['idle_a'], ['idle_a'], ['idle_m|idle_b'], ['idle_b'], ['idle_b'], ['idle_m|idle_a']],
    step: [['step', ['lean', { px: -1 }]], ['step', ['lean', { px: -2 }]]],
    windup: [['windup|victory_a']],
    slash: [['windup|thrust_ready|thrust'], ['slash'], ['slash'], ['slash']],
    thrust: [['thrust_ready|idle_a', ['lean', { px: 1 }]], ['thrust'], ['thrust'], ['thrust']],
    smash: [['windup|victory_a'], ['charge|victory_a', ['hop', -1]], ['smash|slash'], ['smash|slash']],
    shoot: [['thrust_ready|idle_a'], ['thrust|slash'], ['thrust|slash']],
    cast: [['cast_a|idle_b'], ['cast_b|victory_a'], ['cast_b|victory_a', ['hop', -1]], ['cast_a|victory_a']],
    item: [['item|idle_m|idle_a'], ['item|idle_m|idle_a', ['hop', -1]]],
    guard: [['guard|idle_a', ['crouch', { px: 2 }]]],
    hit: [['hit'], ['hit', ['lean', { px: 1 }]]],
    weak: [['weak|hit', ['crouch', { px: 4 }]], ['weak|hit', ['crouch', { px: 5 }]]],
    ko: [['hit'], ['ko']],
    victory: [['victory_a'], ['victory_b|victory_a'], ['victory_b|victory_a', ['hop', -1]]],
    evade: [['evade|idle_a', ['lean', { px: 3 }]]],
  };
  const BTL_FPS = { idle: 5, step: 10, windup: 8, slash: 11, thrust: 11, smash: 9, shoot: 9, cast: 6, item: 6, guard: 4, hit: 10, weak: 3, ko: 7, victory: 5, evade: 8 };
  SP.BTL_PLAN = BTL_PLAN;
  // 武器なしのポーズで使うコマ（シートの形。bare＋weapons がある人の、剣以外の系統）
  const BARE = { windup: 'bare_windup', slash: 'bare_slash', thrust: 'bare_thrust', cast: 'bare_cast', idle: 'bare_idle' };
  const BARE_OF = { idle_a: 'idle', idle_b: 'idle', idle_m: 'idle', step: 'idle', guard: 'idle', item: 'idle', weak: 'idle', victory_a: 'cast', victory_b: 'cast',
    windup: 'windup', charge: 'windup', slash: 'slash', smash: 'slash', thrust_ready: 'idle', thrust: 'thrust', cast_a: 'cast', cast_b: 'cast', evade: 'idle', hit: 'idle' };
  const WPN = { sword: 'wpn_sword', greatsword: 'wpn_greatsword', dagger: 'wpn_dagger', bow: 'wpn_bow', staff: 'wpn_staff' };

  /** 体のコマ（武器なし）に武器の画像を持ち手で付ける。angle は画像の座標（0 = 右、180 = 左向き） */
  function attach(body, wfr, grip, angle) {
    const pad = 40, c = mk(body.c.width + pad * 2, body.c.height + pad * 2), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(body.c, pad, pad);
    x.save();
    x.translate(pad + grip[0], pad + grip[1]);
    x.rotate(((angle - 180) * Math.PI) / 180);
    x.drawImage(wfr.c, -wfr.ox, -wfr.oy);
    x.restore();
    const t = trim({ c, ox: body.ox + pad, oy: body.oy + pad, id: body.id, points: body.points });
    const sh = t.shift || [0, 0], pts = {};
    for (const [k, p] of Object.entries(body.points || {})) pts[k] = Array.isArray(p) ? [p[0] + pad - sh[0], p[1] + pad - sh[1]] : p;
    t.points = pts;
    return t;
  }
  /** 透明な縁を切る（描く点は保つ） */
  function trim(fr) {
    const c = fr.c, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return fr;
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(w - 1, x1 + 1); y1 = Math.min(h - 1, y1 + 1);
    const n = mk(x1 - x0 + 1, y1 - y0 + 1);
    n.getContext('2d').drawImage(c, -x0, -y0);
    return { c: n, ox: fr.ox - x0, oy: fr.oy - y0, id: fr.id, points: fr.points, shift: [x0, y0] };
  }

  SP.battle = function (look, wtype) {
    if (!SP.has(look, 'battle')) return undefined;
    const st = SP.state(look, 'battle');
    if (st === 'loading') return null;
    if (st !== 'ready') return undefined;
    const B = frames(look, 'battle');
    wtype = wtype || 'sword';
    const drawn = B.meta.weapon || 'sword';
    let body = B.by, swap = false;
    // 剣以外: 武器なしの体＋武器の画像
    if (wtype !== drawn && SP.has(look, 'bare') && SP.has(look, 'weapons')) {
      const s1 = SP.state(look, 'bare'), s2 = SP.state(look, 'weapons');
      if (s1 === 'loading' || s2 === 'loading') return null;
      if (s1 === 'ready' && s2 === 'ready') {
        const BA = frames(look, 'bare'), WP = frames(look, 'weapons');
        const wfr = WP.by[WPN[wtype]];
        if (wfr) {
          body = {};
          const att = BA.meta.attach || {};
          for (const [id, fr] of Object.entries(B.by)) {
            const bk = BARE[BARE_OF[id]];
            const bf = bk && BA.by[bk];
            if (!bf || id === 'ko' || id === 'hit') { body[id] = fr; continue; }
            const p = bf.points || {}, grip = p.grip;
            if (!grip) { body[id] = bf; continue; }
            let ang = att[bk] && !att[bk].unreliable ? att[bk].angle : null;
            if (ang == null && p.tip) ang = (Math.atan2(p.tip[1] - grip[1], p.tip[0] - grip[0]) * 180) / Math.PI;
            if (wtype === 'bow') ang = 90;   // 弓は縦に持つ（描かれた向きのまま）
            body[id] = attach(Object.assign({}, bf, { id }), wfr, grip, ang == null ? 180 : ang);
          }
          swap = true;
        }
      }
    }
    const sheet = build(body, BTL_PLAN, BTL_FPS, B.meta);
    sheet.meta = Object.assign(sheet.meta, { look, wtype, facing: 'left', source: 'sprite', weaponDrawn: swap ? wtype : drawn, weaponMismatch: !swap && wtype !== drawn });
    return sheet;
  };

  /** 並びの計画（ポーズ → [[コマ名|代わり, つなぎ…]…]）からシートを組む。同じコマは 1 回だけ置く */
  function build(by, plan, fps, m) {
    const frames = [], poses = {}, memo = {};
    const geoOf = {};
    const anyKey = Object.keys(by)[0];
    const H = (m && m.target_height) || 64;
    const headR = Math.round(H * 0.16);
    for (const [pose, list] of Object.entries(plan)) {
      poses[pose] = list.map((spec) => {
        const names = spec[0].split('|');
        const id = names.find((n) => by[n]) || anyKey;
        const ops = spec.slice(1);
        const key = id + JSON.stringify(ops);
        if (memo[key] != null) return memo[key];
        let fr = by[id];
        if (ops.length) {
          const g = geoOf[id] || (geoOf[id] = R.Art.rig.geo(fr));
          fr = R.Art.rig.tween.chain(fr, ops, g);
        }
        const out = { c: fr.c, ox: fr.ox, oy: fr.oy };
        const src = by[id];
        const ha = headAnchor(Object.assign({}, src, { ox: src.ox, oy: src.oy }), headR);
        if (ha) out.anchors = { head: ha };
        frames.push(out);
        return (memo[key] = frames.length - 1);
      });
    }
    const idle = frames[(poses.idle || [0])[0]];
    const g0 = R.Art.rig.geo(idle);
    const anchors = { feet: [0, 0], head: (idle.anchors && idle.anchors.head) || [0, -(g0.bot - g0.top) + headR], center: [0, -Math.round((idle.oy - g0.top) / 2)], hand: [-Math.round(idle.c.width * 0.2), -Math.round((idle.oy - g0.top) * 0.45)] };
    anchors.fx = [anchors.hand[0] - 10, anchors.hand[1]];
    let w = 0, h = 0;
    for (const f of frames) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
    return { frames, poses, fps: Object.assign({}, fps), anchors, w, h, meta: { headR, height: g0.height, skinCheck: 'skip: the source palette shares colors between hair and skin' } };
  }
  SP._build = build;

  // ------------------------------------------------------------------ フィールド
  const DIRS = { s: 'down', n: 'up', w: 'left', e: 'right' };
  // シートの形の演技の名前 → §2.5.7 の演技
  const ACT_OF = { nod: 'act_nod', surprise: 'act_surprise', think: 'act_think', bow: 'act_bow', kneel: 'act_kneel', sit: 'act_sit', point: 'act_call', sad: 'act_sad' };
  /** 描かれたランタンの芯（明るい暖色の画素の中心）→ [x, y]（コマの中）| null */
  function findLantern(fr) {
    const c = fr.c, w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4;
      if (d[q + 3] > 127 && d[q] > 215 && d[q + 1] > 150 && d[q + 2] < 150 && d[q] - d[q + 2] > 90) { sx += x; sy += y; n++; }
    }
    return n >= 2 ? [Math.round(sx / n), Math.round(sy / n)] : null;
  }
  SP.field = function (look, o) {
    o = o || {};
    if (!SP.has(look, 'field')) return undefined;
    const st = SP.state(look, 'field');
    if (st === 'loading') return null;
    if (st !== 'ready') return undefined;
    const F = frames(look, 'field');
    const k = (o.scale || 1.15) / 1.15;
    const by = {};
    for (const [id, fr] of Object.entries(F.by)) by[id] = scaleFrame(fr, k);
    const frames_ = [], poses = {}, fps = {};
    const put = (fr) => { frames_.push({ c: fr.c, ox: fr.ox, oy: fr.oy }); return frames_.length - 1; };
    const drawn = F.meta.lanternDrawn || null;   // シートの形: 歩き・走りにランタンが描かれている
    const lant = o.lantern && !drawn ? R.Art.cast.lanternFrame(k) : null;
    const anchorsL = {};
    // 歩き・走り・待ちのコマの並びと速さは json から（データの道。art の書き出しがコマの数を決める）:
    //   meta.anims の {frames: [id…], ms: [..] | fps, stride?, mirror?}。歩きは walk8_<dir>（無ければ walk_<dir>）、走りは run8_<dir>
    //   （無ければ run_<dir>）、立ちは stand_<dir>、待ちは idle_<dir>（あれば）。anims に無ければ walk_down_0,1,2… を順に。
    //   right の 8 コマが無く left にあれば left を反転（right は left の鏡。art の決まり 2026-09-27）。
    //   昔の 3 コマの歩き（walk_*_0〜2）は [0, 1, 0, 2]、速さは FIELD の昔の値のまま（fps を置かない = 変えない）。
    //   8 コマの並び・fps を書いた物・待ちは json の速さ（ms の平均）。体の上下・走りの浮きは絵に焼いてあるので FIELD は足さない
    const mby = {};
    const frameOf = (id, mir) => (mir ? mby[id] || (mby[id] = R.Art.cast.mirror(by[id])) : by[id]);
    const first = {};
    const G = {};
    for (const [d, name] of Object.entries(DIRS)) {
      G[d] = { walk: gait(F, by, 'walk', name), run: gait(F, by, 'run', name), stand: gait(F, by, 'stand', name), idle: gait(F, by, 'idle', name) };
      const W = G[d].walk;
      first[d] = W.ids.length ? frameOf(W.ids[0], W.mirror) : null;
    }
    if (drawn) for (const d of Object.keys(DIRS)) { const f0 = first[d]; const p = f0 && findLantern(f0); if (p) anchorsL[d] = [p[0] - f0.ox, p[1] - f0.oy]; }
    const stride = {};
    for (const [d, name] of Object.entries(DIRS)) {
      if (!first[d]) continue;
      const memo = {};
      const wrap = (fr) => (lant ? withLantern(fr, lant, name, anchorsL, d) : fr);
      const idxOf = (mir) => (id) => { const k2 = (mir ? 'M:' : '') + id; return memo[k2] != null ? memo[k2] : (memo[k2] = put(wrap(frameOf(id, mir)))); };
      const { walk: W, run: Rn, stand: St, idle: Id } = G[d];
      poses['stand_' + d] = St.ids.length ? [idxOf(St.mirror)(St.ids[0])] : [idxOf(W.mirror)(W.ids[0])];
      poses['walk_' + d] = W.ids.map(idxOf(W.mirror));
      if (W.fps) fps['walk_' + d] = W.fps;
      if (W.stride) stride['walk_' + d] = W.stride;
      if (Rn.ids.length) {
        poses['run_' + d] = Rn.ids.map(idxOf(Rn.mirror));
        if (Rn.fps) fps['run_' + d] = Rn.fps;
        if (Rn.stride) stride['run_' + d] = Rn.stride;
      }
      if (Id.ids.length) { poses['idle_' + d] = Id.ids.map(idxOf(Id.mirror)); fps['idle_' + d] = Id.fps || 4; }
    }
    // 演技（南向き）: シートにあればそれ、無ければ立ちのコマのつなぎ
    const s0 = first.s;
    if (s0) {
      // 足りない演技はつなぎで: 元のコマはランタンの無い演技の立ち（シート3 のうなずき）、ランタンを掲げるは歩きの立ち
      const base = (name) => (name === 'raise_lantern' || !by.act_nod ? s0 : by.act_nod);
      for (const name of Object.keys(R.Art.rig.ACTING)) {
        const src = ACT_OF[name] && by[ACT_OF[name]];
        const b0 = base(name);
        const list = src ? [src] : R.Art.rig.act(b0, name, R.Art.rig.geo(b0));
        poses[name] = list.map((fr) => put(lant && name === 'raise_lantern' ? withLantern(fr, lant, 'down', anchorsL, 's', -6) : fr));
        fps[name] = R.Art.rig.ACTING_FPS[name] || 4;
      }
    }
    const idle = frames_[poses.stand_s ? poses.stand_s[0] : 0];
    const H = Math.round(((F.meta.target_height || 48) + 2) * k);
    const headR = Math.round(H * 0.2);
    const anchors = { feet: [0, 0], head: [0, -H + headR], center: [0, -Math.round(H / 2)] };
    if (anchorsL.s) anchors.lantern = anchorsL.s;
    let w = 0, h = 0;
    for (const f of frames_) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
    // 頭の中心はコマごと（向きで少し違う）
    const haMemo = new Map();
    for (const [pose, list] of Object.entries(poses)) for (const i of list) {
      const src = first[pose.slice(-2, -1) === '_' ? pose.slice(-1) : 's'] || first.s;
      if (src && !haMemo.has(src)) haMemo.set(src, headAnchor(src, headR));
      const ha = src && haMemo.get(src);
      if (ha && !frames_[i].anchors) frames_[i].anchors = { head: ha };
    }
    return { frames: frames_, poses, fps, stride, anchors, w, h, meta: { look, source: 'sprite', skinCheck: 'skip: shared palette', headR, lantern: anchorsL, lanternDrawn: !!drawn, scale: o.scale || 1.15 } };
  };
  // 昔の並びのコマの数（これ以下で fps を書いていなければ FIELD の昔の速さ）
  const LEGACY_N = { walk: 3, run: 4, stand: 1 };
  // 並びの名前の候補（先が新しい書き出し）
  const GAIT_KEYS = { walk: ['walk8', 'walk'], run: ['run8', 'run'], stand: ['stand'], idle: ['idle'] };
  const OPP_SIDE = { right: 'left', left: 'right' };
  /** 歩き・走り・立ち・待ちの 1 向きの並び → {ids, fps, stride, mirror}（ids は by にあるコマの名前。mirror = 反転して使う） */
  function gait(F, by, kind, name) {
    const m = F.meta || {};
    const A = m.anims || {};
    const allF = m.frames || [];
    const idsOf = (a) => (a && Array.isArray(a.frames) ? a.frames.map((q) => (typeof q === 'number' ? allF[q] && allF[q].id : q)).filter((q) => q && by[q]) : []);
    let a = null, ids = [], mirror = false, fresh = false;
    const keys = GAIT_KEYS[kind] || [kind];
    for (const pre of keys) {
      const cand = A[pre + '_' + name];
      const got = idsOf(cand);
      if (got.length) { a = cand; ids = got; fresh = pre !== kind; mirror = !!(cand.mirror || cand.flip); break; }
      // right は left の鏡（新しい並びだけ。昔の並びは右のコマがある）
      const o = OPP_SIDE[name] && pre !== kind ? A[pre + '_' + OPP_SIDE[name]] : null;
      const og = idsOf(o);
      if (og.length) { a = o; ids = og; fresh = true; mirror = !(o.mirror || o.flip); break; }
    }
    const key = kind + '_' + name;
    if (!ids.length) {
      for (let i = 0; i < 64 && by[key + '_' + i]; i++) ids.push(key + '_' + i);
      if (kind === 'walk' && ids.length === 3) ids = [ids[0], ids[1], ids[0], ids[2]];   // 昔の 3 コマ
    }
    if (kind === 'stand' && !ids.length && by[key]) ids = [key];
    const uniq = new Set(ids).size;
    let fps = 0;
    if (a && typeof a.fps === 'number' && a.fps > 0) fps = a.fps;
    else if (fresh || uniq > (LEGACY_N[kind] || 0) || kind === 'idle') {
      const ms = a && Array.isArray(a.ms) ? a.ms.filter((v) => v > 0) : [];
      if (ms.length) fps = 1000 / (ms.reduce((x, y) => x + y, 0) / ms.length);
      else if (m.fps && typeof m.fps['anim_' + key] === 'number') fps = m.fps['anim_' + key];
      else if (m.fps && typeof m.fps[key] === 'number') fps = m.fps[key];
    }
    const stride = a && typeof a.stride === 'number' && a.stride > 0 ? a.stride : 0;
    return { ids, fps: fps ? Math.round(fps * 100) / 100 : 0, stride, mirror };
  }
  SP._gait = gait;
  /** 手にランタン（原画にランタンが無いうちは焼いた小物を手の位置に重ねる）。手 = 腰の少し上の高さの、体の一番外の列 */
  function withLantern(fr, lant, dir, anchorsL, d, lift) {
    const g = R.Art.rig.geo(fr);
    const c = fr.c, w = c.width, h = c.height, dd = c.getContext('2d').getImageData(0, 0, w, h).data;
    const row = Math.round(g.top + g.height * 0.66) + (lift || 0);
    let xl = w, xr = -1;
    for (let x = 0; x < w; x++) if (dd[(Math.min(h - 1, Math.max(0, row)) * w + x) * 4 + 3] > 0) { if (x < xl) xl = x; if (x > xr) xr = x; }
    if (xr < 0) return fr;
    // 前・左向きは絵の左の手（体の右手）、後ろ・右向きは右
    const hx = dir === 'down' || dir === 'left' ? xl - 1 : xr + 1;
    const behind = dir === 'up';
    const pad = 8, n = mk(w + pad * 2, h + pad * 2), x = n.getContext('2d');
    x.imageSmoothingEnabled = false;
    const lx = pad + hx - lant.ox, ly = pad + row - lant.oy;
    if (behind) x.drawImage(lant.c, lx, ly);
    x.drawImage(c, pad, pad);
    if (!behind) x.drawImage(lant.c, lx, ly);
    const out = { c: n, ox: fr.ox + pad, oy: fr.oy + pad, anchors: fr.anchors };
    if (!anchorsL[d]) anchorsL[d] = [hx - fr.ox, row + lant.glowY - fr.oy];
    return out;
  }

  // ------------------------------------------------------------------ 顔
  SP.face = function (look) {
    if (!SP.has(look, 'face')) return undefined;
    const st = SP.state(look, 'face');
    if (st === 'loading') return null;
    if (st !== 'ready') return undefined;
    const F = frames(look, 'face'), m = F.meta;
    const list = (m.frames || []).map((f) => F.by[f.id]);
    // 顔ごとに透明な縁を切る（小さな顔も枠いっぱいに拡大できるように）
    const frames_ = list.map((fr) => { const t = trim(fr); return { c: t.c, ox: t.ox, oy: t.oy }; });
    const poses = {}, E = m.expr || {};
    for (const e of (R.Contract && R.Contract.EXPRS) || ['neutral', 'smile', 'sad', 'angry', 'surprise']) poses[e] = [E[e] != null ? E[e] : E.neutral != null ? E.neutral : 0];
    let w = 0, h = 0;
    for (const f of frames_) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
    return { frames: frames_, poses, fps: {}, anchors: { feet: [0, 0] }, w, h, meta: { look, source: 'sprite', pixel: true } };
  };
})(window.RPG);
