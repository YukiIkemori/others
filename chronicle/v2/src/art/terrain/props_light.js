// TERRAIN: 光の出どころ（MODERN_UI §4.1〜4.2・§7.2 F3・F5・F6、STYLE_REFERENCE §5.3・§6.3）
// マップの物（建物の窓・戸口・壁の灯り、街灯、かがり火、道しるべの灯籠、泉、宝箱、結晶…）から
//   lights（K.light: 地面の光だまり。チャンクの光の地図に焼き込み、FIELD にも渡す）
//   glows（毎フレームの発光の描き直し。R.Light.glow(g, x, y, {r, color, core, halo, k}, t) にそのまま渡せる形）
//   emissive（光の地図を掛けた後にチャンクへ焼き直す窓のガラス・開いた戸口）
// を集める。座標はマップの論理 px。影（落ち影の絵）もここで作る（R.Hd.blur でぼかした絵を焼いた絵ごとに 1 回）。
(function (R) {
  'use strict';
  const T = (R.Terrain = R.Terrain || {});
  const SL = () => (R.Hd && R.Hd.STYLE && R.Hd.STYLE.light) || { lampColor: '#ffc27a', windowColor: '#ffcf86', crystalColor: '#bfe6ff', fireColor: '#ff9c4a', lampR: 110, fireMul: 1.3, coreR: 6, haloMul: 3 };

  // 火のゆらぎ [振れ幅, Hz]（R.Light.glow の o.flick。灯籠の既定 STYLE.flicker.lamp より強く速い）
  const FIRE_FLICK = [0.2, 4.5];

  /** 仕掛けの物の今の状態（state は chunks.js の stateOf の結果） */
  T._objState = function (map, o, st) {
    switch (o.type) {
      case 'chest': return { open: st.chests.indexOf(o.id) >= 0, rare: o.pool === 'p_rare' || !!o.rare };
      case 'brazier': return { on: st.lit.indexOf(o.id) >= 0 || !!o.on };
      case 'waylamp': return { on: !!st.lamps[o.id] || (o.lit != null && check(o.lit)) };
      case 'switch': return { on: !!(R.Game && R.Game.flags && R.Game.flags[o.flag]) };
      case 'trail': return { on: o.cond == null || check(o.cond) };
      default: return {};
    }
  };
  function check(c) { try { return !!(R.State && R.State.check && R.Game && R.State.check(c)); } catch (e) { return false; } }

  /** 物の描く点（足もと、マップの論理 px） */
  T._objFeet = function (o, tile) {
    // 泉の dx = 絵だけを横へずらすマス（当たりは 2×2 のまま。奇数の幅の部屋のまん中に置く時の半マス。王墓 3 階の控えの間）
    if (o.type === 'spring') return [(o.x + 1 + (o.dx || 0)) * tile, (o.y + 1.8) * tile];
    // lift = 下絵の柱・台の上に載せる物の持ち上げ（32 の論理 px。灰の町の崖の上の灯籠の柱に載るかがり火など）
    return [(o.x + 0.5) * tile, (o.y + 0.84) * tile - (o.lift ? o.lift * tile / 32 : 0)];
  };

  /**
   * マップの光の一覧（チャンクの外の物も含む。呼ぶ側が範囲で絞る）
   * env = {tile, st, bld(o) → Sheet|null}
   */
  T._lightsOf = function (map, env) {
    const S = SL(), s = env.tile / 32, out = { lights: [], glows: [], emissive: [], moon: [] };
    const L = (x, y, r, color, k, kind, type, src) => out.lights.push({ x, y, r: r * s, color, k, kind: kind || 'pool', type, src });
    const G = (x, y, o) => out.glows.push(Object.assign({ x, y }, o));
    for (const o of map.objects || []) {
      if (o.x == null || o.y == null) continue;
      if (o.cond != null && o.type !== 'trail' && !check(o.cond)) continue;
      if (env.st && R.MapUtil.secretHidden && R.MapUtil.secretHidden(map, o.x, o.y, env.st.secrets)) continue;   // 見つける前の隠し通路の先は灯りも漏らさない
      const [fx, fy] = T._objFeet(o, env.tile), stt = T._objState(map, o, env.st);
      switch (o.type) {
        case 'building': {
          const sh = env.bld(o);
          if (!sh) break;
          const bx = o.x * env.tile, by = (o.y + (o.h || 3)) * env.tile;
          out.moon.push([bx + sh.meta.roof[0], by + sh.meta.roof[1], sh.meta.roof[2] - sh.meta.roof[0], sh.meta.roof[3] - sh.meta.roof[1]]);
          // 描いた建物（env）: 灯った窓の画素だけの絵を光の後に描き直す（窓ごとの光と光のにじみは下の 'win' と同じ）
          const layer = sh.meta.emitLayer;
          // o.lit = 灯る条件（灯台: 灯を取り戻すまでは灯室が弱い残り火。emit の 'beacon'）
          const lit = o.lit == null || check(o.lit);
          if (layer) out.emissive.push({ kind: 'img', c: layer, x: bx - sh.meta.envAnchor[0], y: by - sh.meta.envAnchor[1], w: layer.width, h: layer.height, a: lit ? 1 : 0.3 });
          for (const e of sh.meta.emit) {
            const ex = bx + e.x, ey = by + e.y;
            if (e.kind === 'win') {
              L(ex + e.w / 2, by + 12 * s, 40, S.windowColor, 0.8, 'window', 'window', o.id);
              L(ex + e.w / 2, ey + e.h / 2, 18, S.windowColor, 0.5, 'point', 'window', o.id);
              if (!layer) out.emissive.push({ kind: 'win', x: ex, y: ey, w: e.w, h: e.h });
              G(ex + e.w / 2, ey + e.h / 2, { r: 22 * s, core: 2 * s, halo: 22 * s, color: S.windowColor, k: 0.32, type: 'window' });
            } else if (e.kind === 'door') {
              L(ex + e.w / 2, by + 18 * s, 66, S.windowColor, 1.3, 'wide', 'door', o.id);
              if (!layer) out.emissive.push({ kind: 'door', x: ex, y: ey, w: e.w, h: e.h });
              G(ex + e.w / 2, ey + e.h / 2, { r: 30 * s, core: 3 * s, halo: 30 * s, color: S.windowColor, k: 0.5, type: 'door' });
            } else if (e.kind === 'beacon') {
              // 灯台の灯室: 岬を照らす大きな光だまり・灯室の芯・回る光の帯（R.Light.glow の beam）。灯る前は小さく息づく残り火
              if (lit) {
                L(ex, by + 8 * s, 210, S.lampColor, 0.95, 'pool', 'beacon', o.id);
                L(ex, ey + 30 * s, 60, '#ffe2a8', 0.9, 'point', 'beacon', o.id);
                G(ex, ey, { r: 64 * s, core: 7 * s, halo: 64 * s, color: '#ffe2a8', k: 0.95, type: 'beacon', beam: { len: 420 * s, period: 9000, width: 0.12, squash: 0.5, k: 0.7 } });
              } else {
                L(ex, ey + 20 * s, 34, S.fireColor, 0.4, 'point', 'beacon', o.id);
                G(ex, ey, { r: 16 * s, core: 2 * s, halo: 16 * s, color: S.fireColor, k: 0.45, type: 'ember', pulse: 3200 });
              }
            } else if (e.kind === 'lamp') {
              L(ex, by + 10 * s, 70, S.lampColor, 1.1, 'pool', 'lamp', o.id);
              L(ex, ey, 22, S.lampColor, 0.8, 'point', 'lamp', o.id);
              out.emissive.push({ kind: 'lamp', x: ex, y: ey });
              G(ex, ey, { r: 20 * s, core: 3 * s, halo: 20 * s, color: S.lampColor, k: 0.9, type: 'lamp' });
            }
          }
          break;
        }
        case 'chest':
          if (!stt.open) { L(fx, fy - 6 * s, 36, S.windowColor, 0.7, 'pool', 'chest', o.id); G(fx + 7 * s, fy - 19 * s, { r: 16 * s, core: 2 * s, halo: 16 * s, color: '#fff0c0', k: 0.7, type: 'sparkle' }); }
          break;
        case 'spring':
          if (R.MapUtil.springLook(map, o) === 'goddess') {
            // 女神の像: 手の小さなランタン（描いた絵の light32 = 足もとから 90 px 上）の淡い金の光と、水盤のほのかな青。夜でも遠くから見つかる
            L(fx, fy - 4 * s, 150, '#ffe2b0', 1.2, 'pool', 'spring', o.id);
            L(fx, fy - 14 * s, 46, S.crystalColor, 0.6, 'pool', 'spring', o.id);
            L(fx, fy - 90 * s, 30, '#fff0c8', 0.8, 'point', 'spring', o.id);
            G(fx, fy - 90 * s, { r: 30 * s, core: 4 * s, halo: 30 * s, color: '#ffe6b0', k: 0.9, type: 'lamp' });
            G(fx, fy - 70 * s, { r: 56 * s, core: 1 * s, halo: 56 * s, color: '#fff2d8', k: 0.35, pulse: 2600, type: 'spring' });
            G(fx, fy - 15 * s, { r: 20 * s, core: 3 * s, halo: 20 * s, color: '#a0f0ff', k: 0.5, type: 'spring' });
            // 像のまわりの光の粒（絵の粒の上で、ゆっくり瞬く）
            for (const [dx, dy, p] of [[-21, -96, 1900], [22, -104, 2300], [-24, -62, 2700], [21, -70, 2100]]) G(fx + dx * s, fy + dy * s, { r: 7 * s, core: 1.2 * s, halo: 7 * s, color: '#ffe8b8', k: 0.8, pulse: p, type: 'sparkle' });
            break;
          }
          L(fx, fy - 4 * s, 150, S.crystalColor, 1.25, 'pool', 'spring', o.id);
          G(fx, fy - 24 * s, { r: 40 * s, core: 6 * s, halo: 40 * s, color: '#a0f0ff', k: 0.8, type: 'spring' });
          break;
        case 'brazier':
          if (stt.on) { L(fx, fy - 4 * s, S.lampR * S.fireMul, S.fireColor, 1.3, 'pool', 'fire', o.id); G(fx, fy - 22 * s, { r: 24 * s, core: 5 * s, halo: 24 * s, color: S.fireColor, k: 1, type: 'fire' }); }
          break;
        case 'waylamp':
          if (stt.on && T._setFire && T._setFire(map, 'waylamp')) {
            // 砂漠のかがり火（waylamp__desert）: 火の色の大きめの光だまりと、絵の炎の芯でゆらぐ火の光（FIRE_FLICK）
            const fa = (T._setAnchor && T._setAnchor(map, 'waylamp', s)) || [0, -36 * s];
            L(fx, fy - 4 * s, Math.round(S.lampR * 1.15), S.fireColor, 1, 'pool', 'fire', o.id);
            G(fx + fa[0], fy + fa[1], { r: 26 * s, core: 2.5 * s, halo: 26 * s, color: S.fireColor, k: 0.85, type: 'fire', flick: FIRE_FLICK });   // 芯は小さく（絵の炎を消さない）
          } else if (stt.on) {
            const wa = T._setAnchor && T._setAnchor(map, 'waylamp', s);   // 地方の描き直した灯籠（湿原の鉤の灯など）は絵の灯りの芯
            L(fx, fy - 4 * s, S.lampR, S.lampColor, 1.2, 'pool', 'lamp', o.id); G(wa ? fx + wa[0] : fx, wa ? fy + wa[1] : fy - 31 * s, { r: 20 * s, core: 4 * s, halo: 20 * s, color: S.lampColor, k: 1, type: 'lamp' });
          }
          break;
        case 'switch':
          if (stt.on) G(fx, fy - 5 * s, { r: 12 * s, core: 2 * s, halo: 12 * s, color: S.crystalColor, k: 0.6, type: 'switch' });
          break;
        case 'trail':
          if (stt.on) for (const p of o.path || []) G((p[0] + 0.5) * env.tile, (p[1] + 0.7) * env.tile, { r: 10 * s, core: 2 * s, halo: 10 * s, color: '#9af0e0', k: 0.7, type: 'trail' });
          break;
        case 'stairs':
          if (o.look === 'none') break;   // 描いた下絵の戸口（階段の絵を出さない物。chunks.js）には階段の光も置かない
          L(fx, fy - 8 * s, 44, S.crystalColor, 0.45, 'pool', 'stairs', o.id);
          break;
        case 'prop': {
          const meta = T._propLightMeta(o.id);
          if (!meta || !meta.light) break;
          const spec = T._lightSpec(meta.light, false);
          const a = (T._setAnchor && T._setAnchor(map, o.id, s)) || anchorOf(o.id, s);   // テーマの描き直した物は絵の灯りの芯（props.js）
          const lx = fx + a[0], ly = fy + a[1];
          const fire = !!(T._setFire && T._setFire(map, o.id));   // テーマの描き直しが火（砂漠の置きかがり火 lantern__desert）
          // meta.light.colors = 色の一覧（位置で選ぶ。山地の鉱石の脈の青・紫）、meta.light.k = 濃さの倍率、meta.light.glow = 芯のにじみの半径（32 の px）
          const LC = meta.light.colors;
          const color = LC && LC.length ? LC[(o.x * 7 + o.y * 13) % LC.length] : /crystal|mushroom|songstone/.test(o.id) ? S.crystalColor : fire ? S.fireColor : spec.color;
          const km = meta.light.k != null ? meta.light.k : 1;
          // 火の描き直し（砂漠の置きかがり火）は光だまりを控えめに・芯の点の光は無し（足もとに焼いた小さな絵が白く飛ばない）
          L(lx, fy - 4 * s, spec.r, color, spec.k * (fire ? 0.6 : 1.2) * km, 'pool', spec.kind, o.id + '@' + o.x + ',' + o.y);
          if (!fire && meta.light.point !== false && /lamp|lantern|beacon|torch|crystal|stove|fireplace|candelabra|sconce/.test(o.id)) L(lx, ly, 24, color, 0.7, 'point', spec.kind, o.id);
          const soft = /crystal|mushroom|songstone/.test(o.id);
          if (fire) { G(lx, ly, { r: 14 * s, core: 1.5 * s, halo: 14 * s, color, k: 0.6, type: 'fire', flick: FIRE_FLICK }); break; }   // 小さな火: にじみは炎のまわりだけ（鉢と脚の絵を白く飛ばさない）
          const gr = meta.light.glow != null ? meta.light.glow : o.id === 'beacon' ? 60 : soft ? 18 : 22;
          if (gr > 0) G(lx, ly, { r: gr * s, core: (o.id === 'beacon' ? 9 : soft ? 1.5 : 3) * s, halo: gr * s, color, k: (soft ? 0.55 : 0.9) * Math.min(1, km), type: spec.kind });
          break;
        }
        default: break;
      }
    }
    return out;
  };
  // 地方の描いた物（env）と光だけの物（*_glow）の灯り（2026-09-30）: 地方の kit は R.DB.props に light を書くが、灯りの一覧は META の light を見る。
  //   META に light が無い物は R.DB.props の light を写す。ただし kit の半径そのままでは諸島・高原・湿原が白く飛んだので、物ごとの値をここに持つ
  //   （r = 光だまりの半径 32 の px、k = 濃さの倍率、glow = 芯のにじみの半径、colors = 色、point: false = 芯の点の光なし。描いた柱が白く飛ぶ）。表に無い物は半径を半分・濃さ 0.5 の控えめな値
  const ENV_LIGHT = {
    star_lamp: { r: 50, k: 0.35, glow: 6, point: false, colors: ['#c4dcff'] },                        // 高原の星灯（柱の上の星形のガラス）
    star_glow: { r: 40, k: 0.16, glow: 0, point: false, colors: ['#9fb4ff'] },                         // 学院・塔の淡い星明かり（絵の無い光）
    star_fire: { r: 96, k: 0.5, glow: 0, point: false },                                             // 塔の頂の火
    wisp_lamp: { r: 50, k: 0.4, glow: 6, point: false, colors: ['#d4f4d0'] },                         // 湿原の鬼火のカンテラ
    lamp_pillar: { r: 46, k: 0.3, glow: 6, point: false },                                           // 諸島の石の灯籠
    glow_plankton: { r: 46, k: 0.45, glow: 0, point: false, colors: ['#62e0e8', '#7ad0ff'] },         // 洞窟の水の光る夜光虫
    beacon_glow: { r: 120, k: 0.6, glow: 0, point: false },                                           // 灯台の灯室
    lighthouse_glow: { r: 110, k: 0.6, glow: 0, point: false },                                       // 岬の灯台の灯
    lava_glow: { r: 56, k: 0.35, glow: 0, point: false, colors: ['#ff7a3a'] },                        // 溶岩の照り返し（段が四角く浮かないよう、小さく淡く）
  };
  const envMeta = {};
  /** 灯りを見る META（META に light が無ければ R.DB.props の light に ENV_LIGHT を重ねた物。1 回だけ作る） */
  T._propLightMeta = function (id) {
    const m = T._PROP_META[id];
    if (m && m.light) return m;
    if (envMeta[id] !== undefined) return envMeta[id];
    const d = R.DB.props && R.DB.props[id];
    if (!d || !d.light) return (envMeta[id] = m || null);
    const tune = ENV_LIGHT[id] || { r: Math.round((+d.light.r || 60) * 0.5), k: 0.5, glow: 8 };
    return (envMeta[id] = Object.assign({}, m || {}, { light: Object.assign({}, d.light, tune) }));
  };
  // 物の灯りの芯の位置（DRAW の light の値。焼かずに知るため、よく使う物は表で持つ）
  const ANCHOR = { lamp_post: [5, -46], lantern: [0, -7], table: [4, -12], stove: [0, -6], mushroom_glow: [0, -5], crystal: [0, -12], torch: [0, -13], beacon: [0, -50], songstone: [0, -18], ship: [14, -86], firefly: [0, -12], snow_lamp: [7, -32], ice_crystal: [0, -8],
    candelabra: [0, -35], fireplace: [16, -10], wall_sconce: [-3, -27],
    star_lamp: [0, -35], wisp_lamp: [7, -28], lamp_pillar: [0, -29], glow_plankton: [0, -4], lava_glow: [0, -4] };
  function anchorOf(id, s) { const a = ANCHOR[id] || [0, -10]; return [a[0] * s, a[1] * s]; }

  /** 光の地図の後: 窓のガラス・開いた戸口・壁の灯りを明るく描き直す（ctx はチャンク、X0, Y0 だけずらして描く） */
  T._drawEmissive = function (ctx, list, X0, Y0, s) {
    ctx.save();
    for (const e of list) {
      const x = e.x - X0, y = e.y - Y0;
      if (e.kind === 'img') { ctx.globalAlpha = e.a != null ? e.a : 1; ctx.drawImage(e.c, Math.round(x), Math.round(y)); ctx.globalAlpha = 1; continue; }
      if (e.kind === 'win') {
        const g = ctx.createLinearGradient(0, y, 0, y + e.h);
        g.addColorStop(0, 'rgba(255,244,210,1)'); g.addColorStop(1, 'rgba(255,190,104,1)');
        ctx.fillStyle = g; ctx.fillRect(x, y, e.w, e.h);
        ctx.fillStyle = 'rgba(70,40,20,0.85)';
        ctx.fillRect(x + Math.floor(e.w / 2), y, Math.max(1, Math.round(s)), e.h); ctx.fillRect(x, y + Math.floor(e.h * 0.45), e.w, Math.max(1, Math.round(s)));
      } else if (e.kind === 'door') {
        const g = ctx.createLinearGradient(0, y, 0, y + e.h);
        g.addColorStop(0, 'rgba(255,250,232,1)'); g.addColorStop(1, 'rgba(255,204,124,1)');
        ctx.fillStyle = g; ctx.fillRect(x + s, y + 4 * s, e.w - 2 * s, e.h - 4 * s);
      } else if (e.kind === 'lamp') {
        ctx.fillStyle = '#fff2c8'; ctx.fillRect(Math.round(x - s), Math.round(y - s), Math.max(2, Math.round(3 * s)), Math.max(2, Math.round(3 * s)));
      }
    }
    ctx.restore();
  };

  // ------------------------------------------------------------------ 落ち影（月は左上 → 右下へ。MODERN_UI §4.1-6・§7.2 F3）
  const shadows = new WeakMap(); // frame.c → {c, ox, oy}
  /** 焼いた絵の影の絵（形を右下へずらして潰し、ぼかす）。kind 'tall'（木・街灯）| 'block'（建物: 右と下へ少しずらすだけ） */
  T._shadowOf = function (fr, kind, s) {
    let m = shadows.get(fr.c);
    if (m && m[kind]) return m[kind];
    if (!m) { m = {}; shadows.set(fr.c, m); }
    const U = T._u, w = fr.c.width, h = fr.c.height, pad = Math.ceil(10 * s);
    let out;
    if (kind === 'block') {
      const dx = Math.round(20 * s), dy = Math.round(9 * s);
      const c = U.canvas(w + dx + pad * 2, h + dy + pad * 2); if (!c) return null;
      const g = c.getContext('2d');
      g.drawImage(fr.c, pad + dx, pad + dy);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(10,8,26)'; g.fillRect(0, 0, c.width, c.height);
      out = soft(c, 4, fr.ox + pad, fr.oy + pad);
    } else {
      // 足もとを軸に: (px, py) → (px − 0.45 py, −0.22 py)（py < 0 が上 → 右下へ伸びる）
      const H = fr.oy, below = Math.ceil((h - fr.oy) * 0.22), W2 = w + Math.ceil(H * 0.45) + pad * 2, H2 = Math.ceil(H * 0.22) + below + pad * 2;
      const c = U.canvas(W2, H2); if (!c) return null;
      const g = c.getContext('2d');
      g.setTransform(1, 0, -0.45, -0.22, pad + fr.ox, pad + below);
      g.drawImage(fr.c, -fr.ox, -fr.oy);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgb(10,8,26)'; g.fillRect(0, 0, c.width, c.height);
      out = soft(c, 2, pad + fr.ox, pad + below);
    }
    m[kind] = out;
    return out;
  };
  /** ぼかしの代わりに 1/k に縮めた絵（描くときに k 倍へ滑らかに広げる = 柔らかい縁。R.Hd.blur より十分速い） */
  function soft(c, k, ox, oy) {
    const w = Math.max(1, Math.ceil(c.width / k)), h = Math.max(1, Math.ceil(c.height / k)), d = T._u.canvas(w, h);
    if (!d) return { c, ox, oy, k: 1 };
    const g = d.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w * k, h * k, 0, 0, w, h);
    return { c: d, ox, oy, k };
  }
})(window.RPG);
