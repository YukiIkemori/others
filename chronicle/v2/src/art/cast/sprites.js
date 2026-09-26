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
    for (const look of SP.looks()) for (const p of ['hd:btl:' + look + ':', 'hd:field:' + look, 'hd:face:' + look]) for (const k of R.Hd.keys(p)) if (R.Hd.forget) R.Hd.forget(k);
  });
  SP.has = function (look, kind) { return !!(R.Media && R.Media.has && R.Media.has('sprites', look + ':' + kind)); };
  /** 原画の画像の状態 */
  SP.state = function (look, kind) {
    if (!SP.has(look, kind)) return 'none';
    const rec = R.Media.image(look + ':' + kind, 'sprites');
    if (!rec) return 'failed';
    return rec.ready ? 'ready' : rec.failed ? 'failed' : 'loading';
  };
  /** 原画のある look（どれか 1 つの kind でも） */
  SP.looks = function () {
    const t = (R.Media && R.Media.table && R.Media.table().sprites) || {};
    const out = {};
    for (const k of Object.keys(t)) out[k.split(':')[0]] = true;
    return Object.keys(out).sort();
  };
  function rec(look, kind) { const r = R.Media.image(look + ':' + kind, 'sprites'); return r && r.ready ? r : null; }
  function meta(look, kind) { const e = R.Media.entry('sprites', look + ':' + kind); return (e && e.meta) || null; }

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
    const out = {};
    for (const f of m.frames || []) out[f.id] = cut(r.img, f);
    return { by: out, meta: m, img: r.img };
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
  /** 絵の中の肌の色（hd_check_hair 用。原画のパレットから肌らしい色） */
  function skinOf(m) {
    const pal = (m && m.palette) || [];
    return pal.filter((h) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16); return r > 190 && g > 140 && b > 100 && r > g && g > b && r - b > 40 && r - b < 110; }).slice(0, 6);
  }
  /** 頭の中心（描く点からの相対）: points.head は頭のてっぺん → 頭の半径だけ下 */
  function headAnchor(fr, headR) {
    const p = fr.points && fr.points.head;
    if (!p) return null;
    const k = fr.k || 1;
    const a = fr.flipX ? -1 : 1;
    return [Math.round((p[0] * k - fr.ox) * a), Math.round(p[1] * k + headR - fr.oy)];
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
    return { frames, poses, fps: Object.assign({}, fps), anchors, w, h, meta: { skin: skinOf(m), headR, height: g0.height } };
  }
  SP._build = build;

  // ------------------------------------------------------------------ フィールド
  const DIRS = { s: 'down', n: 'up', w: 'left', e: 'right' };
  // シートの形の演技の名前 → §2.5.7 の演技
  const ACT_OF = { nod: 'act_nod', surprise: 'act_surprise', think: 'act_think', bow: 'act_bow', kneel: 'act_kneel', sit: 'act_sit', point: 'act_call', raise_lantern: 'act_resolve' };
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
    const lant = o.lantern ? R.Art.cast.lanternFrame(k) : null;
    const anchorsL = {};
    for (const [d, name] of Object.entries(DIRS)) {
      const f0 = by[`walk_${name}_0`], f1 = by[`walk_${name}_1`], f2 = by[`walk_${name}_2`];
      if (!f0) continue;
      const wrap = (fr) => (lant ? withLantern(fr, lant, name, anchorsL, d) : fr);
      const i0 = put(wrap(f0)), i1 = f1 ? put(wrap(f1)) : i0, i2 = f2 ? put(wrap(f2)) : i0;
      poses['stand_' + d] = [i0];
      poses['walk_' + d] = [i0, i1, i0, i2];
      if (by[`run_${name}_0`]) poses['run_' + d] = [0, 1, 2, 3].filter((i) => by[`run_${name}_${i}`]).map((i) => put(wrap(by[`run_${name}_${i}`])));
    }
    // 演技（南向き）: シートにあればそれ、無ければ立ちのコマのつなぎ
    const s0 = by.walk_down_0;
    if (s0) {
      const g = R.Art.rig.geo(s0);
      for (const name of Object.keys(R.Art.rig.ACTING)) {
        const src = ACT_OF[name] && by[ACT_OF[name]];
        const list = src ? [src] : R.Art.rig.act(s0, name, g);
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
    for (const [pose, list] of Object.entries(poses)) for (const i of list) {
      const src = by[`walk_${DIRS[pose.slice(-1)] || 'down'}_0`];
      const ha = src && headAnchor(src, headR);
      if (ha && !frames_[i].anchors) frames_[i].anchors = { head: ha };
    }
    return { frames: frames_, poses, fps, anchors, w, h, meta: { look, source: 'sprite', skin: skinOf(F.meta), headR, lantern: anchorsL, scale: o.scale || 1.15 } };
  };
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
    const frames_ = list.map((fr) => ({ c: fr.c, ox: fr.ox, oy: fr.oy }));
    const poses = {}, E = m.expr || {};
    for (const e of (R.Contract && R.Contract.EXPRS) || ['neutral', 'smile', 'sad', 'angry', 'surprise']) poses[e] = [E[e] != null ? E[e] : E.neutral != null ? E.neutral : 0];
    let w = 0, h = 0;
    for (const f of frames_) { w = Math.max(w, f.c.width); h = Math.max(h, f.c.height); }
    return { frames: frames_, poses, fps: {}, anchors: { feet: [0, 0] }, w, h, meta: { look, source: 'sprite', pixel: true } };
  };
})(window.RPG);
