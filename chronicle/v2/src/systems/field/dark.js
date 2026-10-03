// FIELD — 暗がり（E6、V2_PLAN §2.5.9、WORLD_REDESIGN §6.4）
//   map.dark（true = 全体、[{rect, cond}] = その範囲）の中は、一行の周り 4 マス・ともしたしょく台の周り 3 マス・泉の周り 3 マスの外を
//   暗い膜で覆う。膜は 1/4 の解像度の 1 枚に、焼いておいた穴の絵を destination-out で抜く（毎フレーム新しい物を作らない）。
//   宝箱と泉のきらめきは膜の上（layers.js）。範囲に入ったら場所の名前の横に「暗い」（hud.js）。
//   灯りの外で始まった戦闘は setup.dark（R.Mon.encounter の o.dark）。一行のランタンは数えない（しょく台・泉の灯りだけ）。
//   松明（i_torch、RULES の use {type:'light', r, steps}）: R.Field.light(r, steps) の間は一行の灯りが r マスになり、灯りの中として数える。
//   範囲の縁は約 2 マスかけて少しずつ暗くし、揺らぎと丸い角で四角い線に見せない（CONTENT-F・QA の依頼。膜はマップごとに 1 枚焼く）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const D = (F.dark = F.dark || {});
  D.PARTY_R = 4; D.LAMP_R = 3; D.SPRING_R = 3;
  let mask = null, mg = null, hole = null;
  const vis = { px: 0, py: 0 };

  /** 膜の濃さ（既定 0.93）。map.darkAlpha でマップごとに薄くできる（幽霊船の船倉: 床と壁の形がうっすら読める。2026-09-30 追加） */
  D.alphaOf = function (m) { return m && typeof m.darkAlpha === 'number' ? m.darkAlpha : 0.93; };
  D.on = function () { return !!(S.map && S.map.dark); };
  /** 一行の灯りの半径（マス）: 松明の間は広い */
  D.partyR = function () { return S.torch && S.torch.steps > 0 ? Math.max(D.PARTY_R, S.torch.r) : D.PARTY_R; };
  /** (x, y) がしょく台（ともした）・泉の光の中か */
  D.litAt = function (x, y) {
    const m = S.map, G = R.Game || {};
    if (!m) return false;
    const lit = (G.lit && G.lit[m.id]) || [];
    for (const o of m.objects || []) {
      if (o.type === 'brazier' && lit.includes(o.id)) { if (Math.hypot(o.x - x, o.y - y) <= D.LAMP_R + 0.01) return true; }
      else if (o.type === 'spring') { if (Math.hypot(o.x + 0.5 - x, o.y + 0.5 - y) <= D.SPRING_R + 0.72) return true; }
    }
    return false;
  };
  /** 見えるか（暗がりの外、一行の周り、灯りの中）。テスト・小地図用 */
  D.visibleAt = function (x, y) {
    if (!D.on() || !R.MapUtil.darkAt(S.map, x, y)) return true;
    if (Math.hypot(S.x - x, S.y - y) <= D.partyR() + 0.01) return true;
    return D.litAt(x, y);
  };
  /** 出現の setup.dark: 暗がりの中で、灯りの外 */
  D.battleDark = function (x, y) {
    if (S.torch && S.torch.steps > 0) return false;   // 松明を掲げている間は灯りの中
    return !!(S.map && R.MapUtil.darkAt(S.map, x, y) && !D.litAt(x, y));
  };

  function ensure() {
    const w = Math.ceil(R.W / 4) + 2, h = Math.ceil(R.H / 4) + 2;
    if (!mask || mask.width !== w || mask.height !== h) {
      mask = R.Gfx.canvas2d(w, h);
      mg = mask && mask.getContext('2d');
    }
    if (!hole) {
      hole = R.Gfx.canvas2d(64, 64);
      if (hole) {
        const g = hole.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.62, 'rgba(0,0,0,0.92)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
    }
    return !!(mask && hole);
  }
  function punch(x, y, r) {
    // x, y, r は画面の論理 px → 膜は 1/4
    const s = (r * 2) / 4;
    mg.drawImage(hole, x / 4 - s / 2 + 1, y / 4 - s / 2 + 1, s, s);
  }

  // 暗がりの範囲の膜（マップの座標、1 マス Q px）。rects の組が変わったときだけ作り直す
  let fieldCache = null;
  const Q = 4, PAD = 3;
  function vnoise(x, y, seed) {
    const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), e = h(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  }
  function darkField(m, rects, sig) {
    if (fieldCache && fieldCache.sig === sig) return fieldCache;
    const W = (m.w + PAD * 2) * Q, H = (m.h + PAD * 2) * Q;
    const c = R.Gfx.canvas2d(W, H);
    if (!c) return null;
    const g = c.getContext('2d'), img = g.createImageData(W, H), px = img.data;
    const seed = (R.U && R.U.hash ? R.U.hash(m.id) % 997 : 7);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const tx = x / Q - PAD + 0.5 / Q, ty = y / Q - PAD + 0.5 / Q;
      // 縁の揺らぎ（±0.8 マス、大きさの違う 2 つの波）
      const n = (vnoise(tx * 0.3, ty * 0.3, seed) - 0.5) * 1.7 + (vnoise(tx * 1.1, ty * 1.1, seed + 3) - 0.5) * 0.6;
      let a = 0;
      for (const r of rects) {
        // 四角からの符号つきの距離（マス。中は負）。角は丸く
        const dx = Math.max(r[0] - tx, tx - (r[0] + r[2])), dy = Math.max(r[1] - ty, ty - (r[1] + r[3]));
        const out = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)), inside = Math.min(Math.max(dx, dy), 0);
        const sd = out + inside + n;
        // sd 1.4（外）→ −0.9（中）で 0 → 1
        let k = (1.4 - sd) / 2.3; k = k < 0 ? 0 : k > 1 ? 1 : k; k = k * k * (3 - 2 * k);
        if (k > a) a = k;
      }
      const q = (y * W + x) * 4;
      px[q] = 5; px[q + 1] = 6; px[q + 2] = 18; px[q + 3] = Math.round(a * D.alphaOf(m) * 255);
    }
    g.putImageData(img, 0, 0);
    fieldCache = { sig, c, q: Q, pad: PAD };
    return fieldCache;
  }

  D.draw = function (g, cam) {
    if (!D.on()) return;
    if (!ensure()) return;
    const m = S.map, t = cam.t, cx = cam.cx, cy = cam.cy, G = R.Game || {};
    mg.globalCompositeOperation = 'source-over';
    mg.clearRect(0, 0, mask.width, mask.height);
    mg.fillStyle = 'rgba(5,6,18,' + D.alphaOf(m) + ')';
    const d = m.dark;
    if (d === true) mg.fillRect(0, 0, mask.width, mask.height);
    else {
      // 範囲の膜はマップごとに 1 枚（1 マス 4 px）に焼いておく: 縁は約 2 マスかけて暗くなり、揺らぎで直線・四角い角に見せない
      // （前は四角を 6 枚重ねていて、縁と角が四角いまま見えた。QA verda_dark）
      let sig = m.id + ':' + t;
      const act = [];
      for (let i = 0; i < d.length; i++) {
        const e = d[i];
        if (e.cond != null && !R.State.check(e.cond)) continue;
        if (!e.rect) { act.length = 0; act.push(null); break; }
        act.push(e.rect); sig += '|' + i;
      }
      if (act.length === 1 && act[0] === null) mg.fillRect(0, 0, mask.width, mask.height);
      else if (act.length) {
        const fld = darkField(m, act, sig);
        if (fld) {
          mg.imageSmoothingEnabled = true;
          mg.drawImage(fld.c, (-fld.pad * t - cx) / 4 + 1, (-fld.pad * t - cy) / 4 + 1, (fld.c.width / fld.q) * t / 4, (fld.c.height / fld.q) * t / 4);
        }
      }
    }
    mg.globalCompositeOperation = 'destination-out';
    // 一行のランタン（4 マス）: 少し揺らぐ
    F._vis(vis);
    const fl = 1 + Math.sin(R.Engine.time / 170) * 0.025;
    punch((vis.px + 0.5) * t - cx, (vis.py + 0.5) * t - cy, (D.partyR() + 0.9) * t * fl);
    const lit = (G.lit && G.lit[m.id]) || [];
    for (const o of m.objects || []) {
      if (o.type === 'brazier' && lit.includes(o.id)) punch((o.x + 0.5) * t - cx, (o.y + 0.5) * t - cy, (D.LAMP_R + 0.9) * t);
      else if (o.type === 'spring') punch((o.x + 1 + (o.dx || 0)) * t - cx, (o.y + 1) * t - cy, (D.SPRING_R + 1.4) * t);
    }
    g.save();
    g.imageSmoothingEnabled = true;
    g.drawImage(mask, -4, -4, mask.width * 4, mask.height * 4);
    g.restore();
    // 消えたしょく台は遠くからでも輪郭が見える（WORLD §6.4）
    g.save();
    g.strokeStyle = 'rgba(190,180,230,0.35)'; g.lineWidth = 1;
    for (const o of m.objects || []) {
      if (o.type !== 'brazier' || lit.includes(o.id)) continue;
      const x = (o.x + 0.5) * t - cx, y = (o.y + 1) * t - cy;
      if (x < -t || y < -t || x > R.W + t || y > R.H + t) continue;
      g.strokeRect(Math.round(x - 8 * t / 32) + 0.5, Math.round(y - 24 * t / 32) + 0.5, Math.round(16 * t / 32), Math.round(8 * t / 32));
      g.beginPath(); g.moveTo(x, y - 16 * t / 32); g.lineTo(x, y - 2); g.stroke();
    }
    g.restore();
  };
})(window.RPG);
