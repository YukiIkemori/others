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
    if (o.type === 'spring') return [(o.x + 1) * tile, (o.y + 1.8) * tile];
    return [(o.x + 0.5) * tile, (o.y + 0.84) * tile];
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
      const [fx, fy] = T._objFeet(o, env.tile), stt = T._objState(map, o, env.st);
      switch (o.type) {
        case 'building': {
          const sh = env.bld(o);
          if (!sh) break;
          const bx = o.x * env.tile, by = (o.y + (o.h || 3)) * env.tile;
          out.moon.push([bx + sh.meta.roof[0], by + sh.meta.roof[1], sh.meta.roof[2] - sh.meta.roof[0], sh.meta.roof[3] - sh.meta.roof[1]]);
          // 描いた建物（env）: 灯った窓の画素だけの絵を光の後に描き直す（窓ごとの光と光のにじみは下の 'win' と同じ）
          const layer = sh.meta.emitLayer;
          if (layer) out.emissive.push({ kind: 'img', c: layer, x: bx - sh.meta.envAnchor[0], y: by - sh.meta.envAnchor[1], w: layer.width, h: layer.height });
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
          L(fx, fy - 4 * s, 150, S.crystalColor, 1.25, 'pool', 'spring', o.id);
          G(fx, fy - 24 * s, { r: 40 * s, core: 6 * s, halo: 40 * s, color: '#a0f0ff', k: 0.8, type: 'spring' });
          break;
        case 'brazier':
          if (stt.on) { L(fx, fy - 4 * s, S.lampR * S.fireMul, S.fireColor, 1.3, 'pool', 'fire', o.id); G(fx, fy - 22 * s, { r: 24 * s, core: 5 * s, halo: 24 * s, color: S.fireColor, k: 1, type: 'fire' }); }
          break;
        case 'waylamp':
          if (stt.on) { L(fx, fy - 4 * s, S.lampR, S.lampColor, 1.2, 'pool', 'lamp', o.id); G(fx, fy - 31 * s, { r: 20 * s, core: 4 * s, halo: 20 * s, color: S.lampColor, k: 1, type: 'lamp' }); }
          break;
        case 'switch':
          if (stt.on) G(fx, fy - 5 * s, { r: 12 * s, core: 2 * s, halo: 12 * s, color: S.crystalColor, k: 0.6, type: 'switch' });
          break;
        case 'trail':
          if (stt.on) for (const p of o.path || []) G((p[0] + 0.5) * env.tile, (p[1] + 0.7) * env.tile, { r: 10 * s, core: 2 * s, halo: 10 * s, color: '#9af0e0', k: 0.7, type: 'trail' });
          break;
        case 'stairs':
          L(fx, fy - 8 * s, 44, S.crystalColor, 0.45, 'pool', 'stairs', o.id);
          break;
        case 'prop': {
          const meta = T._PROP_META[o.id];
          if (!meta || !meta.light) break;
          const spec = T._lightSpec(meta.light, false);
          const a = anchorOf(o.id, s);
          const lx = fx + a[0], ly = fy + a[1];
          const color = /crystal|mushroom|songstone/.test(o.id) ? S.crystalColor : spec.color;
          L(lx, fy - 4 * s, spec.r, color, spec.k * 1.2, 'pool', spec.kind, o.id + '@' + o.x + ',' + o.y);
          if (/lamp|lantern|beacon|torch|crystal|stove/.test(o.id)) L(lx, ly, 24, color, 0.7, 'point', spec.kind, o.id);
          const soft = /crystal|mushroom|songstone/.test(o.id);
          G(lx, ly, { r: (o.id === 'beacon' ? 60 : soft ? 18 : 22) * s, core: (o.id === 'beacon' ? 9 : soft ? 1.5 : 3) * s, halo: (o.id === 'beacon' ? 60 : soft ? 18 : 22) * s, color, k: soft ? 0.55 : 0.9, type: spec.kind });
          break;
        }
        default: break;
      }
    }
    return out;
  };
  // 物の灯りの芯の位置（DRAW の light の値。焼かずに知るため、よく使う物は表で持つ）
  const ANCHOR = { lamp_post: [5, -46], lantern: [0, -7], table: [4, -12], stove: [0, -6], mushroom_glow: [0, -5], crystal: [0, -12], torch: [0, -13], beacon: [0, -50], songstone: [0, -18], ship: [14, -86], firefly: [0, -12], snow_lamp: [7, -32], ice_crystal: [0, -8] };
  function anchorOf(id, s) { const a = ANCHOR[id] || [0, -10]; return [a[0] * s, a[1] * s]; }

  /** 光の地図の後: 窓のガラス・開いた戸口・壁の灯りを明るく描き直す（ctx はチャンク、X0, Y0 だけずらして描く） */
  T._drawEmissive = function (ctx, list, X0, Y0, s) {
    ctx.save();
    for (const e of list) {
      const x = e.x - X0, y = e.y - Y0;
      if (e.kind === 'img') { ctx.drawImage(e.c, Math.round(x), Math.round(y)); continue; }
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
