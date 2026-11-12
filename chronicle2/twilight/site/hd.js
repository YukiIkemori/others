// HD-2D style renderer for maps made blockout-first (three.js).  Loaded by game.js only when the map has an "hd" entry.
//
// The painted map knows, for every pixel, where that pixel is in 3D (height.png, see build/blockout/vox.py).  So the picture
// is laid over a relief mesh, one vertex per pixel, and shown with a real camera: depth of field, lights that follow the
// shapes, a billboard hero hidden by the depth buffer, mist that gathers low on the cliff.
// World units: x = px / S (east), y = -(py + H) / (A S) (north), z = H / (B S) (up), all in painted-picture space.
(function () {
  'use strict';
  const NL = 14, TILE = 128, JUMP0 = 14;   // JUMP: two neighbouring dots whose foot lines differ by more than this belong to different things
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const MESH_VS = `
    uniform vec3 uK; varying vec2 vT; varying vec3 vW;
    vec3 wpos(vec3 p) { return vec3((p.x + .5) * uK.x, -(p.y + .5 + p.z) * uK.y, p.z * uK.z); }
    #ifdef SOLID
      attribute vec3 aT; varying float vS;
    #endif
    void main() {
      vec3 w = wpos(position);
      vW = w;
      vec4 cn = projectionMatrix * viewMatrix * vec4(w, 1.);
      vT = position.xy + .5;
      #ifdef SOLID
        vT = aT.xy; vS = aT.z;                                 // a face the picture never showed: it borrows its neighbour's paint
      #endif
      gl_Position = cn;
    }`;
  const LIGHT_FN = `
    uniform vec3 uAmb; uniform vec4 uL[${NL}]; uniform vec3 uLC[${NL}];
    uniform vec3 uCamPos, uCamDir; uniform float uFocus, uRange;
    vec3 lightAt(vec3 w, vec3 n, float wrap) {
      vec3 s = vec3(0.);
      for (int i = 0; i < ${NL}; i++) {
        vec3 d = uL[i].xyz - w; float r = length(d) + 1e-4;
        float a = clamp(1. - r / uL[i].w, 0., 1.); a *= a;
        s += uLC[i] * a * clamp((dot(n, d / r) + wrap) / (1. + wrap), 0., 1.);
      }
      return s;
    }
    float depthCode(vec3 w) { return clamp((dot(w - uCamPos, uCamDir) - uFocus) / uRange * .5 + .5, 0., 1.); }`;
  const SKY_FN = `
    uniform sampler2D tSky; uniform vec4 uRect; uniform vec3 uBack, uTint; uniform float uHas;
    vec3 skyAt(vec2 s) {                                       // s: 0..1 across the screen, y up
      vec2 a = vec2(s.x, 1. - s.y) * vec2(960., 540.), uv = (a - uRect.xy) / uRect.zw;
      if (uHas > .5 && uv.x >= 0. && uv.x <= 1. && uv.y >= 0. && uv.y <= 1.) return texture2D(tSky, uv).rgb * uTint;
      return uBack;
    }`;
  const MESH_FS = `
    uniform sampler2D tMap, tWalk; uniform vec2 uSize, uRes, uCutB; uniform float uTS; uniform vec3 uFogC; uniform vec2 uFog; uniform float uShowWalk, uGain, uSides;
    varying vec2 vT; varying vec3 vW;
    #ifdef SOLID
      varying float vS;
    #endif
    ${LIGHT_FN}
    ${SKY_FN}
    void main() {
      vec2 tv = vT * uTS, f = fract(tv) - .5, fw = max(fwidth(tv), vec2(1e-4));          // uTS: picture dots per map dot
      vec4 c = texture2D(tMap, (floor(tv) + .5 + clamp(f / fw, -.5, .5)) / (uSize * uTS));
      vec2 uv = (floor(vT) + .5) / uSize;
      if (c.a < .5) discard;
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(n, uCamDir) > 0.) n = -n;
      vec3 L = lightAt(vW, n, .35);
      vec3 col = c.rgb * (uAmb + L * uGain) + c.rgb * L * L * .25;
      #ifdef BACK
        col *= .93;                                           // ground that the picture never showed: it sits in the near thing's shade
      #endif
      #ifdef SOLID
        col *= vS;
      #endif
      vec4 wk = texture2D(tWalk, uv);
      // the cliff sinks into the cloud sea: low rock, and the cut lower edge of the picture, dissolve into the sky itself
      float lowf = smoothstep(uFog.x, uFog.y, vW.z);
      float cut = smoothstep(uSize.y - uCutB.x, uSize.y - uCutB.y, vT.y) * (1. - wk.g);
      if (uSides > .5) cut = max(cut, 1. - smoothstep(uCutB.y, uCutB.x * .6, min(vT.x, uSize.x - vT.x)));     // a map cut out of a bigger one: its side edges dissolve too
      float fade = max(lowf, cut);
      col = mix(col, mix(skyAt(gl_FragCoord.xy / uRes), uFogC, .4 * (1. - fade)), fade);
      if (uShowWalk > .5 && wk.r < .5) col = mix(col, vec3(.9, .1, .15), .38);
      gl_FragColor = vec4(col, mix(depthCode(vW), .86, fade));
    }`;
  const HERO_VS = `varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const HERO_FS = `
    uniform sampler2D tHero; uniform vec4 uFrame; uniform float uCut, uGhost, uGain; varying vec2 vUv; varying vec3 vW;
    ${LIGHT_FN}
    void main() {
      if (vUv.y < uCut) discard;
      vec4 c = texture2D(tHero, uFrame.xy + vec2(vUv.x, 1. - vUv.y) * uFrame.zw);
      if (c.a < .5) discard;
      if (uGhost > 0.) { gl_FragColor = vec4(.77, .8, 1., uGhost); return; }
      vec3 L = lightAt(vW, normalize(vec3(0., -.75, .66)), 1.);
      gl_FragColor = vec4(c.rgb * (uAmb + L * uGain * .8), depthCode(vW));
    }`;
  const FS_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
  const SKY_FS = `
    varying vec2 vUv;
    ${SKY_FN}
    void main() { gl_FragColor = vec4(skyAt(vUv), .86); }`;
  const SHADOW_FS = `varying vec2 vUv; uniform float uA; void main() { float d = length(vUv - .5) * 2.; float a = d < .46 ? .32 : d < .74 ? .3 : d < 1. ? .3 * .5 : 0.; gl_FragColor = vec4(.05, .03, .12, a * uA); }`;
  const PT_VS = `attribute vec4 aSeed; attribute vec3 aCol; uniform float uT, uPx; varying float vA; varying vec3 vC;
    void main() { vec3 p = position + vec3(sin(uT * aSeed.x + aSeed.w * 6.3) * .7, cos(uT * aSeed.y * .8 + aSeed.w * 3.1) * .5, sin(uT * aSeed.z + aSeed.w) * .35);
      vA = .55 + .45 * sin(uT * (1.2 + aSeed.x) + aSeed.w * 20.); vC = aCol; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); gl_PointSize = uPx * (1.6 + aSeed.z); }`;
  const PT_FS = `uniform float uI; varying float vA; varying vec3 vC; void main() { float d = length(gl_PointCoord - .5) * 2.; float a = clamp(1. - d, 0., 1.); gl_FragColor = vec4(vC * a * a * vA * uI, 0.); }`;
  // depth of field: gather inside the pixel's own circle of confusion; sharp neighbours do not bleed into blurred ones
  const DOF_FS = `
    uniform sampler2D tScene; uniform vec2 uPx; uniform float uMax, uBand, uNear; varying vec2 vUv;
    float coc(float a) { return clamp((abs(a - .5) * 2. - uBand) / (1. - uBand), 0., 1.) * uMax * (a < .5 ? uNear : 1.); }      // what stands nearer than the hero (a roof beside the party) blurs less than the distance
    void main() {
      vec4 c0 = texture2D(tScene, vUv); float r0 = coc(c0.a);
      if (r0 < .35) { gl_FragColor = vec4(c0.rgb, 1.); return; }
      vec3 s = c0.rgb; float wsum = 1.;
      for (int i = 1; i <= 22; i++) {
        float fi = float(i); float rr = sqrt(fi / 22.) * r0; float th = fi * 2.39996;
        vec2 o = vec2(cos(th), sin(th)) * rr;
        vec4 c = texture2D(tScene, vUv + o * uPx);
        float w = clamp(coc(c.a) - rr + 1., 0., 1.) + .02;
        s += c.rgb * w; wsum += w;
      }
      gl_FragColor = vec4(s / wsum, 1.);
    }`;
  const BRIGHT_FS = `uniform sampler2D tIn; uniform float uTh; varying vec2 vUv; void main() { vec3 c = texture2D(tIn, vUv).rgb; float l = dot(c, vec3(.4, .45, .15)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + .43, l), 1.); }`;
  const BLUR_FS = `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
    void main() { vec3 s = texture2D(tIn, vUv).rgb * .227; s += (texture2D(tIn, vUv + uDir * 1.385).rgb + texture2D(tIn, vUv - uDir * 1.385).rgb) * .316; s += (texture2D(tIn, vUv + uDir * 3.231).rgb + texture2D(tIn, vUv - uDir * 3.231).rgb) * .07; gl_FragColor = vec4(s, 1.); }`;
  const FINAL_FS = `
    uniform sampler2D tIn, tBloom; uniform float uBloom, uVig; uniform vec3 uVigC, uGrade; uniform float uGradeA; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tIn, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
      c = mix(c, c * (1. - uGrade) + uGrade * (c * c * (3. - 2. * c)) + c * uGrade * .25, uGradeA);
      vec2 q = (vUv - .5) * vec2(1., .5625) * 2.; float v = smoothstep(.55, 1.25, length(q));
      c = mix(c, uVigC, v * uVig);
      gl_FragColor = vec4(c, 1.);
    }`;

  async function create(env) {
    const T3 = window.THREE, { M, A, HS, stage, hData, hW, hH, fData, walkData, VW, VH } = env;
    // K: map dots per dot of the usual 960x540 view (2 on a map drawn twice as finely, see map.json "view"); every distance
    // below that is counted in map dots is scaled by it
    const K = env.K || VW / 960, JUMP = Math.round(JUMP0 * K), fix = s => s.replace('vec2(960., 540.)', `vec2(${VW}., ${VH}.)`);
    const cfg = Object.assign({ S: 32, A: .75, B: .66, depth: 1, dof: 1 }, M.hd);
    const S = cfg.S, KA = 1 / (cfg.A * S), KB = 1 / (cfg.B * S);
    const canvas = document.createElement('canvas');
    canvas.id = 'viewhd'; canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    stage.insertBefore(canvas, env.cv);
    const R = new T3.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: env.Q.get('keep') === '1' });
    R.autoClear = false;
    const gl = R.getContext();
    const state = { depth: +(env.Q.get('depth') ?? cfg.depth), dof: +(env.Q.get('dof') ?? cfg.dof), on: true };
    const DEPTHS = [0, 150, 76, 44], DOFS = [0, 3, 5.5].map(v => v * (cfg.dofScale || 1));     // dofScale: stronger blur on maps that ask for it     // camera distance per "立体感" step, blur radius (art px) per "ぼかし" step

    // ---- picture: colours under transparent pixels are filled from their neighbours so the edge never darkens
    const W = M.w, H = M.h;
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const px = pc.getContext('2d', { willReadFrequently: true }); px.drawImage(A.map, 0, 0);
    const img = px.getImageData(0, 0, W, H), d = img.data;
    const hh = new Uint16Array(hData);                         // heights, with painted-but-flat pixels filled from neighbours
    // where the painter left sky there is no surface, whatever the blocks say (their rims are a few dots fatter than the painted ones);
    // one dot of rim is kept so the painted edge does not shrink
    for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++)
      if (!d[i * 4 + 3] && !d[i * 4 - 1] && !d[i * 4 + 7] && !d[(i - W) * 4 + 3] && !d[(i + W) * 4 + 3]) hh[i] = 0;
    for (let pass = 0; pass < 6; pass++) {
      const todo = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const o = i * 4;
        if (d[o + 3] === 0 || (d[o + 3] && !hh[i])) {
          for (const j of [i - 1, i + 1, i - W, i + W]) {
            if (d[o + 3] === 0 && d[j * 4 + 3] === 255) { todo.push(i, j, 0); break; }
            if (d[o + 3] === 255 && !hh[i] && hh[j]) { todo.push(i, j, 1); break; }
          }
        }
      }
      for (let q = 0; q < todo.length; q += 3) {
        const i = todo[q], j = todo[q + 1];
        if (todo[q + 2]) hh[i] = hh[j]; else { d[i * 4] = d[j * 4]; d[i * 4 + 1] = d[j * 4 + 1]; d[i * 4 + 2] = d[j * 4 + 2]; d[i * 4 + 3] = 1; }
      }
      if (!todo.length) break;
    }
    // the painter's own outline of what stands up (optional, written by build/blockout/check.py)
    let mp = null;
    if (cfg.raised) try {
      const im = new Image(); im.src = cfg.raised; await im.decode();
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, W, H);
      const md = g.getImageData(0, 0, W, H).data; mp = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) mp[i] = md[i * 4] > 127 ? 1 : 0;
    } catch (e) { mp = null; }
    // what really lies behind each near thing, baked from the blocks (optional, from vox.py; without them the far side is only
    // guessed from the thing's surroundings).  under.png: the ground behind it (0 = nothing but sky).  behind.png: the first
    // surface behind it, which is another thing where one stands between (a pillar behind a gate tower, a bough behind leaves).
    const load16 = async src => {
      if (!src) return null;
      try {
        const im = new Image(); im.src = src; await im.decode();
        const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, W, H);
        const md = g.getImageData(0, 0, W, H).data, a = new Uint16Array(W * H); for (let i = 0; i < W * H; i++) a[i] = md[i * 4] + 256 * md[i * 4 + 1];
        return a;
      } catch (e) { return null; }
    };
    const bh = await load16(cfg.behind), un = await load16(cfg.under), gb = un || bh;
    // the painter draws things a few dots fatter than the blocks: near things grow over flat ground (where the outline says
    // "this stands", when there is one) so their rim stays with them
    const flat = (src, i) => { const a = src[i] - src[i + W], b = src[i - W] - src[i]; return !(a >= 1 && a <= 3) && !(b >= 1 && b <= 3); };
    // A slope that leans away about as steeply as the picture looks down (a roof's far side, the back of a crown's top) fills
    // only a few rows of the picture, and the painter drew the near slope's last rows there.  The blocks bring the far slope
    // themselves (cfg.solid), so here those rows carry the near slope on, a little past the ridge, as the painter drew them.
    const PLANE = !!cfg.solid, on = (b, bb) => b + (bb ? clamp(b - bb, 0, 1) : 0);
    if (PLANE) for (let x = 1; x < W - 1; x++) for (let y = H - 3; y > 1; y--) {
      const i = y * W + x, v = hh[i], b = hh[i + W]; if (!v || !b) continue;
      const dq = y + v - (y + 1 + b);
      if (dq <= -4 && dq >= -JUMP) hh[i] = on(b, hh[i + 2 * W]);
    }
    // The painter's outline of a thing (and a roof's fringe) lies two or three dots outside that mask.  Left on the ground it
    // shows as a line beside the thing once the camera looks past it, so a dot next to the thing joins it when its colour is
    // clearly not the ground's a few dots further out.
    const edgeDot = (src, i, o) => {
      let r = 0, g = 0, b = 0, c = 0; const x = i % W;
      for (let t = 4; t <= 6; t++) { const j = i + o * t; if (j < W || j >= W * (H - 1) || Math.abs(j % W - x) > 6 || !src[j] || Math.abs(src[j] - src[i]) > 6) continue; r += d[j * 4]; g += d[j * 4 + 1]; b += d[j * 4 + 2]; c++; }
      return c > 0 && Math.abs(d[i * 4] - r / c) + Math.abs(d[i * 4 + 1] - g / c) + Math.abs(d[i * 4 + 2] - b / c) > 75;
    };
    for (let pass = 0; pass < (mp ? (cfg.grow || 9) : 3); pass++) {
      const src = hh.slice(), mq = mp && PLANE && pass < 4 ? mp.slice() : mp;
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const v = src[i]; if (!v) continue;
        let soft = false;
        if (mp && !(mp[i] && flat(src, i))) { if (mq === mp || mq[i] || !flat(src, i)) continue; soft = true; }
        const q = y + v; let best = 0, n, below = 0, o = 0;
        if ((n = src[i - 1]) && y + n - q > JUMP && y + n > best && (!mp || mq[i - 1])) { best = y + n; o = 1; }
        if ((n = src[i + 1]) && y + n - q > JUMP && y + n > best && (!mp || mq[i + 1])) { best = y + n; o = -1; }
        if ((n = src[i - W]) && y - 1 + n - q > JUMP && y - 1 + n > best && (!mp || mq[i - W])) { best = y - 1 + n; o = W; }
        if ((n = src[i + W]) && y + 1 + n - q > JUMP && y + 1 + n > best && (!mp || mq[i + W])) { best = y + 1 + n; below = n; o = -W; }
        if (!best) continue;
        if (soft) { if (!edgeDot(src, i, o)) continue; mp[i] = 1; }
        hh[i] = below && PLANE ? on(below, src[i + 2 * W]) : best - y;      // above a slope the rim carries the slope on; elsewhere it stands with the thing
      }
    }
    // ---- what lies behind near things.  The picture shows one surface per pixel; when the camera looks from a slightly
    // different place, a strip beside every near thing comes into view that was never painted.  That strip is made here:
    // the far surface is continued in under the near thing, ring by ring, with the colours of the far side diffused inwards.
    // Where the blocks know what is behind, the far surface is made as deep as it goes (a gatehouse hides 100 dots of floor, a
    // tree crown hides its trunk); where it is only guessed, no more than RINGS dots in from the edge.
    const RINGS = Math.round(60 * K), FAR = Math.round(400 * K), hb = new Uint16Array(W * H), ring = new Uint16Array(W * H), bd = new Uint8Array(d.length), seen = new Uint16Array(W * H);
    const upr = new Uint8Array(W * H), upb = new Uint8Array(W * H);      // upright face? (the painted surface / the far side made behind it)
    const vd = new Uint8Array(W * H);            // 1: a near thing with nothing but sky behind it (a stone that tops the island's far rim), no far surface is made; 2: the ground itself, or a thing's own foot
    const wantH = new Uint16Array(W * H);        // the far ground's height where the blocks know it
    const sp = new Int32Array(W * H);            // the visible dot of the far side that each made cell's colour came from (for the mirrored texture below)
    // a second far layer for the thing that stands between a near thing and the ground behind both
    const MID = un && bh ? { want: new Uint16Array(W * H), hb: new Uint16Array(W * H), ring: new Uint16Array(W * H), bd: new Uint8Array(d.length), up: new Uint8Array(W * H), sp: new Int32Array(W * H) } : null;
    const N8 = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1], DY = [0, 0, -1, 1, -1, -1, 1, 1];
    const sv = new Int32Array(8), su = new Uint8Array(8);
    // the far side's colour is taken some dots further out: painted things carry a dark outline and a rim the mask misses
    const outer = (j, e, y, taken) => {
      for (let t = Math.round(10 * K); t > 0; t--) {
        const jj = j + N8[e] * t;
        if (jj > W && jj < W * (H - 1) && hh[jj] && !taken[jj] && Math.abs(((jj / W) | 0) + hh[jj] - (y + DY[e] + hh[j]) - DY[e] * t * (upr[j] ? 0 : 1)) <= JUMP && Math.abs((jj % W) - (j % W)) <= t) return jj;
      }
      return j;
    };
    function fill(rings) {
      hb.fill(0); ring.fill(0); seen.fill(0); vd.fill(0); wantH.fill(0); bd.set(d); if (MID) MID.want.fill(0);
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) upr[i] = hh[i] && !flat(hh, i) ? 1 : 0;
      let cur = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const v = hh[i]; if (!v) continue;
        const q = y + v;
        if (gb && hData[i] && (Math.abs(hData[i] - v) <= JUMP || (un && y + hData[i] < q - JUMP))) {      // the blocks have this same near thing here (or what lies behind a rim the painter added): their answer is used
          const u = gb[i], m = MID ? bh[i] : 0;
          if (u && y + u < q - JUMP) { wantH[i] = u; cur.push(i); } else vd[i] = u ? 2 : 1;
          if (m && y + m < q - JUMP && (!u || m - u > JUMP)) MID.want[i] = m;
          continue;
        }
        for (let k = 0; k < 4; k++) { const n = hh[i + N8[k]]; if (!n || y + DY[k] + n < q - JUMP) { cur.push(i); break; } }
      }
      // loose: second round for what the first left over.  A dot whose known far surface has no visible continuation takes the
      // surface that does continue behind it; small holes are closed.
      const round = (kmax, loose) => {
       for (let k = 1; k <= kmax && cur.length; k++) {
        const done = [];
        for (const i of cur) {
          if (ring[i]) continue;
          const y = (i / W) | 0, q = y + hh[i], want = wantH[i], known = vd[i] || want;
          if (known && !want && !loose) continue;
          if (!known && (k > RINGS || loose)) continue;
          let lo = 1e9, sk = 0, made = 0;
          for (let e = 0; e < 8; e++) {                          // what the far side would be here: an upright face keeps its foot line, flat ground keeps its height
            const j = i + N8[e]; sv[e] = 0;
            if (!hh[j]) { sk += e < 4 ? 2 : 1; continue; }       // sky on that side
            let v;
            if (ring[j] && vd[j] !== 1) { v = hb[j]; su[e] = upb[j]; made++; }      // a far side already made
            else if (y + DY[e] + hh[j] < q - JUMP) { v = hh[j]; su[e] = upr[j]; }   // the far side itself, in plain view
            else { if (vd[j] === 1) sk += e < 4 ? 2 : 1; continue; } // the same near thing; where it stands against the sky, that counts as sky
            if (su[e]) v = Math.max(1, v + DY[e]);
            if (want && (loose ? v > want + JUMP : Math.abs(v - want) > JUMP)) continue;     // not the surface the blocks say is behind this dot
            sv[e] = v; if (v < lo) lo = v;
          }
          if (known && !want && (vd[i] === 1 || made < 5)) continue;
          if (lo > 1e8) { if (sk && !known) done.push(i, 0, 0, 0, 0, 0, 0); continue; }      // (a known cell waits until a neighbour brings a colour)
          let sh = 0, r = 0, g = 0, b = 0, n = 0, nu = 0, src = -1, sw = 0;
          for (let e = 0; e < 8; e++) {
            const v = sv[e]; if (!v || v > lo + 6 * K) continue;
            const j = i + N8[e], wgt = e < 4 ? 2 : 1; let from = sp[j];
            if (!ring[j] || vd[j] === 1) from = outer(j, e, y, ring);
            const o = (ring[j] && vd[j] !== 1 ? j : from) * 4;
            sh += v * wgt; r += bd[o] * wgt; g += bd[o + 1] * wgt; b += bd[o + 2] * wgt; n += wgt; if (su[e]) nu += wgt;
            if (wgt > sw) { sw = wgt; src = from; }
          }
          if (!known && sk > n) { done.push(i, 0, 0, 0, 0, 0, 0); continue; }      // more sky than ground around: the sky wins
          const hv = want && lo >= want - JUMP ? want : Math.round(sh / n);
          if (y + hv >= q - JUMP) continue;                         // the far surface has reached the near thing's foot
          done.push(i, hv, r / n, g / n, b / n, nu * 2 > n ? 1 : 0, src);
        }
        const next = [];
        for (let e = 0; e < done.length; e += 7) { const i = done[e], o = i * 4; hb[i] = done[e + 1]; ring[i] = k; if (!done[e + 1]) { vd[i] = 1; continue; } upb[i] = done[e + 5]; sp[i] = done[e + 6]; bd[o] = done[e + 2]; bd[o + 1] = done[e + 3]; bd[o + 2] = done[e + 4]; bd[o + 3] = 255; }
        for (let e = 0; e < done.length; e += 7) for (let c = 0; c < 4; c++) {
          const j = done[e] + N8[c], x = j % W;
          if (!ring[j] && hh[j] && seen[j] !== k && x > 0 && x < W - 1 && j > W && j < W * (H - 1)) { seen[j] = k; next.push(j); }
        }
        cur = next;
       }
      };
      round(rings, false);
      if (gb && rings > RINGS) {
        cur = []; seen.fill(0);
        for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) if (!ring[i] && (wantH[i] || vd[i] === 2)) cur.push(i);
        round(rings, true);
      }
    }
    // the thing between: it is continued from its part in plain view (same height as the blocks say), never guessed
    function fillMid(rings) {
      const L = MID; L.hb.fill(0); L.ring.fill(0); L.bd.set(d); seen.fill(0);
      let cur = [];
      for (let i = W; i < W * (H - 1); i++) if (L.want[i]) cur.push(i);
      for (let k = 1; k <= rings && cur.length; k++) {
        const done = [];
        for (const i of cur) {
          if (L.ring[i]) continue;
          const y = (i / W) | 0, q = y + hh[i], want = L.want[i];
          let r = 0, g = 0, b = 0, n = 0, nu = 0, src = -1, sw = 0;
          for (let e = 0; e < 8; e++) {
            const j = i + N8[e]; if (!hh[j]) continue;
            let v, u, from;
            if (L.ring[j]) { v = L.hb[j]; u = L.up[j]; from = L.sp[j]; }
            else if (y + DY[e] + hh[j] < q - JUMP) { v = hh[j]; u = upr[j]; from = outer(j, e, y, L.ring); }
            else continue;
            if (u) v += DY[e];
            if (Math.abs(v - want) > JUMP) continue;
            const o = (L.ring[j] ? j : from) * 4, wgt = e < 4 ? 2 : 1;
            r += L.bd[o] * wgt; g += L.bd[o + 1] * wgt; b += L.bd[o + 2] * wgt; n += wgt; if (u) nu += wgt;
            if (wgt > sw) { sw = wgt; src = from; }
          }
          if (n) done.push(i, want, r / n, g / n, b / n, nu * 2 > n ? 1 : 0, src);
        }
        const next = [];
        for (let e = 0; e < done.length; e += 7) { const i = done[e], o = i * 4; L.hb[i] = done[e + 1]; L.ring[i] = k; L.up[i] = done[e + 5]; L.sp[i] = done[e + 6]; L.bd[o] = done[e + 2]; L.bd[o + 1] = done[e + 3]; L.bd[o + 2] = done[e + 4]; L.bd[o + 3] = 255; }
        for (let e = 0; e < done.length; e += 7) for (let c = 0; c < 4; c++) {
          const j = done[e] + N8[c];
          if (!L.ring[j] && L.want[j] && seen[j] !== k) { seen[j] = k; next.push(j); }
        }
        cur = next;
      }
    }
    if (mp) {
      // the blocks are also a few dots fatter than the painted thing in places (thin branches most of all): a rim that the
      // painter left as ground goes back to the ground, as long as the painted thing itself is right behind that rim
      const TRIM = Math.round(8 * K); fill(TRIM + 4);
      const reach = new Uint8Array(W * H); let fr = [];
      for (let i = 0; i < W * H; i++) if (ring[i] && mp[i]) { reach[i] = 1; fr.push(i); }
      for (let k = 0; k < TRIM + 2; k++) { const nx = []; for (const i of fr) for (let c = 0; c < 4; c++) { const j = i + N8[c]; if (ring[j] && !reach[j]) { reach[j] = 1; nx.push(j); } } fr = nx; }
      const cut = new Uint8Array(W * H), by = Array.from({ length: TRIM + 1 }, () => []);
      const own = i => {                                    // the painter's outline or fringe: not the colour of the far side it would fall back to
        const j = sp[i]; if (!PLANE || !(j > 0)) return false;
        return Math.abs(d[i * 4] - d[j * 4]) + Math.abs(d[i * 4 + 1] - d[j * 4 + 1]) + Math.abs(d[i * 4 + 2] - d[j * 4 + 2]) > 75;
      };
      for (let i = 0; i < W * H; i++) if (ring[i] && ring[i] <= TRIM && vd[i] !== 1 && !mp[i] && reach[i] && !(ring[i] <= 4 && own(i))) by[ring[i]].push(i);
      for (let k = 1; k <= TRIM; k++) for (const i of by[k]) if (k === 1 || cut[i - 1] || cut[i + 1] || cut[i - W] || cut[i + W]) cut[i] = 1;
      for (let i = 0; i < W * H; i++) if (cut[i]) hh[i] = hb[i];
    }
    fill(gb ? FAR : RINGS);
    if (MID) fillMid(FAR);
    // The colours above are the far side's colours smeared inwards: right for a narrow strip, a blur for a wide one.  So each
    // made dot also looks at the far side's own picture, mirrored at the edge it was continued from (paving goes on as paving,
    // bark as bark), wherever that mirrored dot really is the same surface.
    const mirror = (ring, hb, up, sp, bd, skip) => {
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (!ring[i] || (skip && skip[i] === 1) || sp[i] < 0) continue;
        const s0 = sp[i], mx = 2 * (s0 % W) - x, my = 2 * ((s0 / W) | 0) - y;
        if (mx < 1 || my < 1 || mx > W - 2 || my > H - 2) continue;
        const m = my * W + mx, hm = hh[m];
        if (!hm || d[m * 4 + 3] !== 255) continue;
        const same = up[i] ? Math.abs(my + hm - (y + hb[i])) <= JUMP * 2 : Math.abs(hm - hb[i]) <= 6 * K && !upr[m];
        if (!same) continue;
        const o = i * 4, om = m * 4, w = .8;
        bd[o] += (d[om] - bd[o]) * w; bd[o + 1] += (d[om + 1] - bd[o + 1]) * w; bd[o + 2] += (d[om + 2] - bd[o + 2]) * w;
      }
    };
    mirror(ring, hb, upb, sp, bd, vd); if (MID) mirror(MID.ring, MID.hb, MID.up, MID.sp, MID.bd, null);
    // The far GROUND gets real paint.  Smeared colours are fine for a strip a few dots wide, but the camera looks under a
    // tree's crown, past a roof's corner and (low on the screen) over a house onto the ground behind it: wide pieces, and a
    // smear there reads as dirt on the screen.  So every flat far dot finds the nearest ground in plain view on its own level
    // (walking only through far dots of that level) and takes the paint that lies as far beyond that edge as it lies before
    // it: grass goes on as grass, the lane as the lane.  Where the blocks know ground that the rings never reached, it is made.
    {
      const isG = new Uint8Array(W * H), src = new Int32Array(W * H).fill(-1), LV = Math.round(6 * K);
      let forced = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (hh[i] && d[i * 4 + 3] === 255 && !upr[i] && !ring[i] && !(mp && mp[i])) isG[i] = 1;
        if (wantH[i] && !ring[i] && flat(wantH, i)) { ring[i] = 1; hb[i] = wantH[i]; upb[i] = 0; vd[i] = 0; sp[i] = -1; bd[i * 4 + 3] = 255; forced++; }
      }
      const isB = i => ring[i] && vd[i] !== 1 && hb[i] && !upb[i];
      let cur = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        if (!isB(i)) continue;
        for (let e = 0; e < 8; e++) { const j = i + N8[e]; if (isG[j] && Math.abs(hh[j] - hb[i]) <= LV) { src[i] = j; cur.push(i); break; } }
      }
      while (cur.length) {
        const next = [];
        for (const i of cur) for (let e = 0; e < 8; e++) {
          const j = i + N8[e], x = j % W;
          if (x < 1 || x > W - 2 || j < W || j >= W * (H - 1) || src[j] >= 0 || !isB(j) || Math.abs(hb[j] - hb[i]) > 3) continue;
          src[j] = src[i]; next.push(j);
        }
        cur = next;
      }
      const okG = (x, y, h) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && isG[y * W + x] && Math.abs(hh[y * W + x] - h) <= LV;
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const s0 = src[i]; if (s0 < 0) continue;
        const sx = s0 % W, sy = (s0 / W) | 0, dx = sx - x, dy = sy - y, h = hb[i]; let m = s0;
        if (okG(sx + dx, sy + dy, h)) m = (sy + dy) * W + sx + dx;                    // mirrored at the edge
        else if (okG(sx - dy, sy + dx, h)) m = (sy + dx) * W + sx - dy;               // or turned along it
        else if (okG(sx + dy, sy - dx, h)) m = (sy - dx) * W + sx + dy;
        else {                                                                         // or a small patch of that ground, laid like tiles
          const tx = x % 13 - 6, ty = y % 13 - 6;
          if (okG(sx + tx, sy + ty, h)) m = (sy + ty) * W + sx + tx; else if (okG(sx - tx, sy - ty, h)) m = (sy - ty) * W + sx - tx;
          else if (okG(sx + ty, sy + tx, h)) m = (sy + tx) * W + sx + ty; else if (okG(sx - ty, sy - tx, h)) m = (sy - tx) * W + sx - ty;
        }
        const o = i * 4, om = m * 4; bd[o] = d[om]; bd[o + 1] = d[om + 1]; bd[o + 2] = d[om + 2]; bd[o + 3] = 255;
      }
      if (env.Q.get('hdlog')) console.log('far ground: made where the rings never reached', forced);
    }
    const mkTex = a => { const t = new T3.DataTexture(a, W, H, T3.RGBAFormat); t.magFilter = t.minFilter = T3.LinearFilter; t.needsUpdate = true; return t; };
    // the picture itself, finer than the map when the map says "imageScale" (the far sides made above stay at map size)
    let tHi = null;
    if (A.mapHi) { tHi = new T3.Texture(A.mapHi); tHi.magFilter = tHi.minFilter = T3.LinearFilter; tHi.generateMipmaps = false; tHi.flipY = false; tHi.needsUpdate = true; }
    const tMap = tHi || mkTex(new Uint8Array(d.buffer)), tBack = mkTex(bd), tMid = MID ? mkTex(MID.bd) : null;
    // walk mask (R) and, in G, "close to where one can walk": that part of the picture's lower edge must not dissolve
    const wk = new Uint8Array(W * H * 4), Y0 = Math.max(0, H - 240 * K), dist = new Float32Array(W * (H - Y0)).fill(1e3);
    for (let i = 0; i < W * H; i++) wk[i * 4] = walkData ? walkData[i] * 255 : 255;
    if (walkData) {
      const hgt = H - Y0, at = (x, y) => dist[y * W + x];
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) if (walkData[(Y0 + y) * W + x]) dist[y * W + x] = 0;
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) { let v = at(x, y); if (x) v = Math.min(v, at(x - 1, y) + 1); if (y) { v = Math.min(v, at(x, y - 1) + 1); if (x) v = Math.min(v, at(x - 1, y - 1) + 1.4); if (x < W - 1) v = Math.min(v, at(x + 1, y - 1) + 1.4); } dist[y * W + x] = v; }
      for (let y = hgt - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { let v = at(x, y); if (x < W - 1) v = Math.min(v, at(x + 1, y) + 1); if (y < hgt - 1) { v = Math.min(v, at(x, y + 1) + 1); if (x) v = Math.min(v, at(x - 1, y + 1) + 1.4); if (x < W - 1) v = Math.min(v, at(x + 1, y + 1) + 1.4); } dist[y * W + x] = v; }
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) wk[((Y0 + y) * W + x) * 4 + 1] = 255 * clamp((70 * K - at(x, y)) / (40 * K), 0, 1);
    }
    const tWalk = new T3.DataTexture(wk, W, H, T3.RGBAFormat); tWalk.magFilter = tWalk.minFilter = T3.LinearFilter; tWalk.needsUpdate = true;

    const world = (x, y, h) => new T3.Vector3((x + .5) / S, -(y + .5 + h) * KA, h * KB);
    const hAt = (x, y) => hh[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];

    // ---- shared uniforms
    const U = {
      uK: { value: new T3.Vector3(1 / S, KA, KB) }, uSize: { value: new T3.Vector2(W, H) }, tMap: { value: tMap }, tWalk: { value: tWalk },
      uAmb: { value: new T3.Vector3(1, 1, 1) }, uL: { value: Array.from({ length: NL }, () => new T3.Vector4(0, 0, 0, 1)) }, uLC: { value: Array.from({ length: NL }, () => new T3.Vector3()) },
      uCamPos: { value: new T3.Vector3() }, uCamDir: { value: new T3.Vector3() }, uFocus: { value: 50 }, uRange: { value: 15 },
      uFogC: { value: new T3.Vector3(.8, .7, .8) }, uFog: { value: new T3.Vector2(11, 3) }, uShowWalk: { value: 0 }, uGain: { value: .6 },
      uRes: { value: new T3.Vector2(960, 540) }, uCutB: { value: new T3.Vector2(150 * K, 14 * K) }, uSides: { value: cfg.cutSides ? 1 : 0 }, uTS: { value: A.mapHi ? A.mapHi.width / W : 1 }, tSky: { value: null }, uRect: { value: new T3.Vector4() }, uBack: { value: new T3.Vector3() }, uTint: { value: new T3.Vector3(1, 1, 1) }, uHas: { value: 0 },
    };
    const meshMat = back => new T3.ShaderMaterial({ uniforms: back ? Object.assign({}, U, { tMap: { value: back }, uTS: { value: 1 } }) : U, vertexShader: MESH_VS, fragmentShader: fix(MESH_FS), defines: back ? { BACK: 1 } : {}, extensions: { derivatives: true }, side: T3.DoubleSide });
    const matMain = meshMat(null), matBack = meshMat(tBack), matNet = meshMat(tBack), matMid = MID ? meshMat(tMid) : null;
    matNet.depthTest = false; matNet.depthWrite = false;      // safety net under everything: the old stretched bridge between a near thing and what is behind it
    { const sh = env.Q.get('hdshow'); if (sh === 'back' || sh === 'mid') matMain.visible = false; if (sh === 'main' || sh === 'mid') matBack.visible = false; if (matMid && (sh === 'main' || sh === 'back')) matMid.visible = false; }

    // ---- relief mesh, one vertex per painted pixel, in tiles
    const scene = new T3.Scene();
    let nTri = 0, nBack = 0;
    for (let ty = 0; ty < H - 1; ty += TILE) for (let tx = 0; tx < W - 1; tx += TILE) {
      const w = Math.min(TILE, W - 1 - tx) + 1, h = Math.min(TILE, H - 1 - ty) + 1;
      const pos = new Uint16Array(w * h * 3), pb = new Uint16Array(w * h * 3), fl = new Uint8Array(w * h); let any = false, anyM = false, zmin = 1e9, zmax = 0;
      const pm = MID ? new Uint16Array(w * h * 3) : null, fm = MID ? new Uint8Array(w * h) : null;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (ty + y) * W + tx + x, v = hh[i], o = (y * w + x) * 3, far = ring[i] && vd[i] !== 1;
        pos[o] = pb[o] = tx + x; pos[o + 1] = pb[o + 1] = ty + y; pos[o + 2] = v; pb[o + 2] = far ? hb[i] : v; fl[y * w + x] = far ? 1 : 0;
        if (MID) { pm[o] = tx + x; pm[o + 1] = ty + y; pm[o + 2] = MID.ring[i] ? MID.hb[i] : v; if (MID.ring[i]) fm[y * w + x] = 1, anyM = true; }
        if (v) { any = true; if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
      }
      if (!any) continue;
      const idx = [], ib = [], im = [], inet = [];
      for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
        const a = y * w + x, b = a + 1, c = a + w, e = c + 1, Y = ty + y, G = Y * W + tx + x;
        for (let layer = 0; layer < (anyM ? 3 : 2); layer++) {
          const P = layer === 2 ? pm : layer ? pb : pos, F = layer === 2 ? fm : fl;
          if (layer && !(F[a] || F[b] || F[c] || F[e])) continue;
          const ha = P[a * 3 + 2], hb2 = P[b * 3 + 2], hc = P[c * 3 + 2], he = P[e * 3 + 2];
          if (!ha || !hb2 || !hc || !he) continue;
          const qa = Y + ha, qb = Y + hb2, qc = Y + 1 + hc, qe = Y + 1 + he;
          if (Math.max(qa, qb, qc, qe) - Math.min(qa, qb, qc, qe) <= JUMP) (layer === 2 ? im : layer ? ib : idx).push(a, c, b, b, c, e);   // a jump in depth is left open
          else if (!layer) {                                                             // the safety net: a stretched bridge from a near thing to what is beside it,
            const lim = Math.min(qa, qb, qc, qe) + JUMP, na = qa > lim, nb = qb > lim, nc = qc > lim, ne = qe > lim;      // where no far side was made for a near corner,
            if (!((na && vd[G] === 1) || (nb && vd[G + 1] === 1) || (nc && vd[G + W] === 1) || (ne && vd[G + W + 1] === 1))      // but none where only sky lies behind
              && ((na && !ring[G]) || (nb && !ring[G + 1]) || (nc && !ring[G + W]) || (ne && !ring[G + W + 1]))) inet.push(a, c, b, b, c, e);
          }
        }
      }
      const c0 = world(tx, ty + h, zmin), c1 = world(tx + w, ty, zmax), bs = new T3.Sphere(c0.clone().add(c1).multiplyScalar(.5), c0.distanceTo(c1) * .5 + 3);
      const add = (P, ix, mat, order) => { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(P, 3)); g.setIndex(new T3.BufferAttribute(new Uint16Array(ix), 1)); g.boundingSphere = bs; const m = new T3.Mesh(g, mat); m.renderOrder = order; scene.add(m); };
      if (inet.length) add(pos, inet, matNet, -1);
      if (idx.length) { add(pos, idx, matMain, 0); nTri += idx.length / 3; }
      if (ib.length) { add(pb, ib, matBack, 0); nBack += ib.length / 3; }
      if (im.length) { add(pm, im, matMid, 0); nBack += im.length / 3; }
    }

    // ---- the faces the picture cannot show (a house's side walls, a roof's far slope), taken from the blocks by
    // build/blockout/solids.py.  Without them a house is a signboard with a lid as soon as the camera stands beside it.
    let nSolid = 0;
    if (cfg.solid && env.Q.get('solid') !== '0') try {
      const buf = Uint8Array.from(atob((await (await fetch(cfg.solid)).text()).trim()), c => c.charCodeAt(0)).buffer, hd = new Uint32Array(buf, 0, 2), nv = hd[0], ni = hd[1];   // base64 text: see solids.py
      const v = new Float32Array(buf, 8, nv * 6), ix = new Uint32Array(buf, 8 + nv * 24, ni);
      const pos = new Float32Array(nv * 3), at = new Float32Array(nv * 3);
      for (let i = 0; i < nv; i++) { pos[i * 3] = v[i * 6] - .5; pos[i * 3 + 1] = v[i * 6 + 1] - .5; pos[i * 3 + 2] = v[i * 6 + 2]; at[i * 3] = v[i * 6 + 3]; at[i * 3 + 1] = v[i * 6 + 4]; at[i * 3 + 2] = v[i * 6 + 5]; }
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setAttribute('aT', new T3.BufferAttribute(at, 3)); g.setIndex(new T3.BufferAttribute(ix.slice(), 1));
      const mat = new T3.ShaderMaterial({ uniforms: U, vertexShader: MESH_VS, fragmentShader: fix(MESH_FS), defines: { SOLID: 1 }, extensions: { derivatives: true }, side: T3.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
      const m = new T3.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 0; scene.add(m); nSolid = ni / 3;
      if (env.Q.get('hdshow') === 'solid') { matMain.visible = false; matBack.visible = false; if (matMid) matMid.visible = false; }
    } catch (e) { console.warn('solid faces not loaded', e); }

    // ---- hero: an upright card (the picture is drawn with heights squeezed by B, so the card is 1/B taller in the world)
    // ---- actors (the leader and the companions): upright cards.  The picture is drawn with heights squeezed by B, so a
    // card is 1/B taller in the world.  Each gets a pale "ghost" where scenery hides it, and a small contact shadow.
    const texOf = new Map();
    const tex = img => { let t = texOf.get(img); if (!t) { t = new T3.Texture(img); t.magFilter = t.minFilter = T3.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; texOf.set(img, t); } return t; };
    const sg = new T3.PlaneGeometry(1.15 / K, .46 / K), pools = new Map();     // cards are kept per sprite size: the party, villagers, chests and crystals differ
    function card(Sp) {
      const FW = Sp.frame[0], FH = Sp.frame[1], foot = Sp.foot;
      const hg = new T3.PlaneGeometry(FW / S, FH * KB); hg.rotateX(Math.PI / 2); hg.translate((FW / 2 - foot[0]) / S, 0, (foot[1] - FH / 2) * KB);
      const mat = g => new T3.ShaderMaterial({ uniforms: Object.assign({}, U, { tHero: { value: null }, uFrame: { value: new T3.Vector4() }, uCut: { value: (FH - foot[1] - 1.5) / FH }, uGhost: { value: g } }), vertexShader: HERO_VS, fragmentShader: HERO_FS, side: T3.DoubleSide });
      const body = new T3.Mesh(hg, mat(0)); body.frustumCulled = false; body.renderOrder = 2;
      const gh = new T3.Mesh(hg, mat(.3)); gh.frustumCulled = false; gh.renderOrder = 3;
      Object.assign(gh.material, { depthFunc: T3.GreaterDepth, depthWrite: false, transparent: true, blending: T3.CustomBlending, blendSrc: T3.SrcAlphaFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor });
      const sh = new T3.Mesh(sg, new T3.ShaderMaterial({ uniforms: { uA: { value: 1 } }, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: SHADOW_FS,
      transparent: true, depthWrite: false, blending: T3.CustomBlending, blendSrc: T3.SrcAlphaFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
      sh.frustumCulled = false; sh.renderOrder = 1;
      scene.add(body, gh, sh);
      return { body, gh, sh, ghost: 0 };
    }

    // ---- glow of the things a player must not walk past (a save crystal, a chest still shut): a soft halo that is added
    // to the picture, with sparks (1: motes that rise, 2: a glint now and then).  The bloom pass spreads it further.
    const GLOW_FS = `uniform vec3 uC; uniform vec4 uP; varying vec2 vUv;
      void main() { vec2 q = vUv * 2. - 1.; float d = length(q), t = uP.x, s = uP.z;
        float v = (pow(max(0., 1. - d), 2.2) * .58 + pow(max(0., 1. - d * 2.6), 2.) * .22) * (.8 + .2 * sin(t * 2.2 + s));
        if (uP.w > .5 && uP.w < 1.5) for (int i = 0; i < 7; i++) { float f = float(i), ph = fract(t * (.16 + .03 * f) + f * .37 + s); vec2 c = vec2(sin(f * 2.4 + s + ph * 2.) * (.14 + .1 * fract(f * .61)), -.4 + ph * 1.2);
          v += smoothstep(.045, 0., length(q - c)) * sin(ph * 3.1416) * 1.4; }
        if (uP.w > 1.5) { float e = pow(max(0., sin(t * 1.5 + s)), 14.); vec2 c = q - vec2(.2, .22); v += (exp(-abs(c.x) * 55.) * exp(-abs(c.y) * 6.) + exp(-abs(c.y) * 55.) * exp(-abs(c.x) * 6.)) * e * 2.4; }
        gl_FragColor = vec4(uC * v * uP.y, 1.); }`;
    const gg = new T3.PlaneGeometry(1, 1); gg.rotateX(Math.PI / 2); const glows = [];
    function glowCard() {
      const m = new T3.Mesh(gg, new T3.ShaderMaterial({ uniforms: { uC: { value: new T3.Vector3() }, uP: { value: new T3.Vector4() } }, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: GLOW_FS,
        side: T3.DoubleSide, transparent: true, depthWrite: false, blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor }));
      m.frustumCulled = false; m.renderOrder = 4; scene.add(m); return m;
    }

    // ---- fireflies
    const fp = [], fs = [], fc = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const e of M.emitters || []) if (e.kind === 'fireflies') for (let i = 0, ec = e.color ? env.hexRgb(e.color).map(v => v / 255) : [1, .86, .45]; i < e.n * 2; i++) {   // an emitter may carry its own colour
      const x = e.x + rnd() * e.w, y = e.y + rnd() * e.h, v = hAt(x, y); if (!v) continue;
      const p = world(x, y, v); fp.push(p.x, p.y, p.z + .4 + rnd() * 1.8); fs.push(.4 + rnd(), .4 + rnd(), .3 + rnd(), rnd()); fc.push(ec[0], ec[1], ec[2]);
    }
    const pg = new T3.BufferGeometry(); pg.setAttribute('position', new T3.Float32BufferAttribute(fp, 3)); pg.setAttribute('aSeed', new T3.Float32BufferAttribute(fs, 4)); pg.setAttribute('aCol', new T3.Float32BufferAttribute(fc, 3));
    const PU = { uT: { value: 0 }, uPx: { value: 4 }, uI: { value: 1 } };
    const flies = new T3.Points(pg, new T3.ShaderMaterial({ uniforms: PU, vertexShader: PT_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor }));
    flies.frustumCulled = false; flies.renderOrder = 4; scene.add(flies);

    // ---- lights in the world
    const L3 = env.lights.filter(l => l.kind !== 'moon').map(l => {
      const p = world(l.x, l.y, hAt(l.x, l.y) || hAt(l.gx, l.gy)); p.y -= l.kind === 'window' ? .9 : .45;
      return { l, p, r: l.r / S * (l.kind === 'window' ? 1.5 : 1.35), px: l.x, py: l.y };
    });

    // ---- full-screen passes
    const fsGeo = new T3.PlaneGeometry(2, 2), fsCam = new T3.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsScene = new T3.Scene(), fsMesh = new T3.Mesh(fsGeo, null); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
    const pass = (fs, uniforms) => new T3.ShaderMaterial({ uniforms, vertexShader: FS_VS, fragmentShader: fs, depthTest: false, depthWrite: false });
    const sky = env.sky, tSky = sky ? new T3.Texture(sky.img) : null; if (tSky) { tSky.magFilter = tSky.minFilter = T3.LinearFilter; tSky.generateMipmaps = false; tSky.flipY = false; tSky.needsUpdate = true; }
    U.tSky.value = tSky; U.uHas.value = tSky ? 1 : 0;
    const mSky = pass(fix(SKY_FS), { tSky: U.tSky, uRect: U.uRect, uBack: U.uBack, uTint: U.uTint, uHas: U.uHas });
    const mDof = pass(DOF_FS, { tScene: { value: null }, uPx: { value: new T3.Vector2() }, uMax: { value: 0 }, uBand: { value: .3 }, uNear: { value: cfg.dofNear == null ? .55 : cfg.dofNear } });
    const mBright = pass(BRIGHT_FS, { tIn: { value: null }, uTh: { value: cfg.bloomTh == null ? .62 : cfg.bloomTh } }), mBlur = pass(BLUR_FS, { tIn: { value: null }, uDir: { value: new T3.Vector2() } });
    const mFinal = pass(FINAL_FS, { tIn: { value: null }, tBloom: { value: null }, uBloom: { value: .6 }, uVig: { value: .4 }, uVigC: { value: new T3.Vector3() }, uGrade: { value: new T3.Vector3() }, uGradeA: { value: 0 } });
    let rtScene, rtDof, rtB1, rtB2, cw = 0, ch = 0;
    // picture size: ?q=high keeps full size, ?q=low half; otherwise it steps down by itself when the device cannot keep up
    const qp = env.Q.get('q'), auto = !qp && env.Q.get('keep') !== '1'; let scale = qp === 'low' ? .5 : 1, tPrev = 0, ema = 16, nSlow = 0;
    const mkRT = (w, h, depth) => new T3.WebGLRenderTarget(w, h, { minFilter: T3.LinearFilter, magFilter: T3.LinearFilter, format: T3.RGBAFormat, depthBuffer: !!depth, stencilBuffer: false });
    function resize() {
      const r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = Math.round(clamp(r.width * dpr, 640, 1920) * scale), h = Math.round(w * 9 / 16);
      if (w === cw && h === ch) return;
      cw = w; ch = h; R.setSize(w, h, false); U.uRes.value.set(w, h);
      for (const t of [rtScene, rtDof, rtB1, rtB2]) if (t) t.dispose();
      rtScene = mkRT(w, h, true); rtDof = mkRT(w, h, false); rtB1 = mkRT(w >> 2, h >> 2, false); rtB2 = mkRT(w >> 2, h >> 2, false);
    }
    const draw = (mat, target) => { fsMesh.material = mat; R.setRenderTarget(target); R.render(fsScene, fsCam); };

    // ---- cameras
    const up = new T3.Vector3(0, cfg.A, cfg.B).normalize(), dir = new T3.Vector3(0, cfg.B, -cfg.A).normalize(), right = new T3.Vector3(1, 0, 0);
    const halfH = VH / 2 / S, halfW = VW / 2 / S;
    const ortho = new T3.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, 400), persp = new T3.PerspectiveCamera(20, 16 / 9, 1, 400);
    const tmp = new T3.Vector3(), tgt = new T3.Vector3(), v3 = c => new T3.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);
    let camLift = -1, tLast = 0, pxLast = 0, pyLast = 0, focLift = -1;
    // The height the camera keeps its distance from is the height of the walkable ground averaged over a wide area around
    // the middle of the view, not the height under the hero's feet.  Following the hero's own floor pushed the camera in and
    // out along its line of sight on every stair step and whenever the 2D camera stood still at the map's edge (walking up
    // to an exit on high ground): the whole picture shrank and grew, which reads as a zoom.  The wide average only changes
    // while the view itself slides, and slowly, so the camera glides over the land; a hero on a rise is a little nearer.
    const RG = 32 * K, rW = Math.ceil(W / RG) + 1, rH = Math.ceil(H / RG) + 1, region = new Float32Array(rW * rH);
    {
      let v = new Float32Array(rW * rH), m = new Float32Array(rW * rH);
      for (let j = 0; j < rH; j++) for (let i = 0; i < rW; i++) { const x = Math.min(W - 1, i * RG), y = Math.min(H - 1, j * RG); if (env.walkable ? env.walkable(x, y) : true) { v[j * rW + i] = env.lift(x, y); m[j * rW + i] = 1; } }
      const box = (src, r) => { const t = new Float32Array(rW * rH), o = new Float32Array(rW * rH);
        for (let j = 0; j < rH; j++) for (let i = 0; i < rW; i++) { let a = 0; for (let k = -r; k <= r; k++) a += src[j * rW + clamp(i + k, 0, rW - 1)]; t[j * rW + i] = a; }
        for (let j = 0; j < rH; j++) for (let i = 0; i < rW; i++) { let a = 0; for (let k = -r; k <= r; k++) a += t[clamp(j + k, 0, rH - 1) * rW + i]; o[j * rW + i] = a; }
        return o; };
      const R0 = cfg.camArea == null ? 9 : cfg.camArea;
      for (let n = 0; n < 2; n++) { v = box(v, R0); m = box(m, R0); }
      let all = 0, an = 0; for (let i = 0; i < v.length; i++) if (m[i] > 0) { all += v[i] / m[i]; an++; }
      for (let i = 0; i < v.length; i++) region[i] = m[i] > 1e-6 ? v[i] / m[i] : an ? all / an : 0;
    }
    const regionAt = (x, y) => { const fx = clamp(x / RG, 0, rW - 1.001), fy = clamp(y / RG, 0, rH - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j, q = j * rW + i;
      return (region[q] * (1 - u) + region[q + 1] * u) * (1 - w) + (region[q + rW] * (1 - u) + region[q + rW + 1] * u) * w; };
    const bk = cfg.back ? env.hexRgb(cfg.back) : null;         // what lies beyond the picture (default: the night sky of the first maps)

    function render(st) {
      if (auto) { const now = performance.now(), dt = now - tPrev; tPrev = now; if (dt < 500) { ema += (dt - ema) * .08; if (++nSlow > 50 && ema > 36 && scale > .5) { scale -= .25; nSlow = 0; ema = 16; } } }
      resize();
      const { cam, hero, P } = st;
      const hx = hero.x, hy = hero.y, lf = env.lift(hx, hy), hw = world(hx - .5, hy - .5, lf);
      // The camera only ever slides the way the 2D camera does.  Its distance is taken from the ground under the middle of
      // the view at the hero's floor height, and that height is followed softly: a stair step (the floor jumps) or a walk
      // while the 2D camera is stopped at the map's edge must not push the camera in and out, which reads as a zoom pulse.
      const dT = st.T - tLast; tLast = st.T;
      const bo = HS.body * .48, rl = regionAt(cam.x + VW / 2, cam.y + VH / 2 + bo);
      if (camLift < 0 || dT < 0 || dT > .5 || Math.abs(hx - pxLast) + Math.abs(hy - pyLast) > 40 * K) { camLift = rl; focLift = lf; } else { camLift += (rl - camLift) * (1 - Math.exp(-dT / .4)); focLift += (lf - focLift) * (1 - Math.exp(-dT / .32)); }
      pxLast = hx; pyLast = hy;
      tgt.copy(world(cam.x + VW / 2 - .5, cam.y + VH / 2 + bo - .5, camLift)).addScaledVector(up, bo / S);
      const D = (DEPTHS[state.depth] || 0) * (env.pull || 1), camera = D ? persp : ortho, dist = D || 120;
      camera.position.copy(tgt).addScaledVector(dir, -dist); camera.up.copy(up); camera.lookAt(tgt);
      if (D) { persp.fov = 2 * Math.atan(halfH / D) * 180 / Math.PI; persp.near = Math.max(1, D - 70); persp.far = D + 120; } else { ortho.near = 1; ortho.far = 320; }
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      U.uCamPos.value.copy(camera.position); U.uCamDir.value.copy(dir); U.uFocus.value = tmp.copy(world(hx - .5, hy - .5, focLift)).sub(camera.position).dot(dir); U.uRange.value = cfg.range == null ? 10.5 : cfg.range;   // focus stays on the hero
      // light
      const amb = P.ambient; U.uAmb.value.set(amb[0] / 255, amb[1] / 255, amb[2] / 255); U.uGain.value = .35 + P.lightGain * .55;
      const near = L3.map(o => ({ o, d: Math.hypot(o.px - (cam.x + VW / 2), (o.py - (cam.y + VH / 2)) * 1.3) - o.l.r })).sort((a, b) => a.d - b.d);
      let n = 0;
      for (; n < Math.min(NL - 1, near.length); n++) {
        const { o } = near[n], l = o.l, i = l.intensity * l.f * (near[n].d < 700 * K ? 1 : 0) * 1.25;
        U.uL.value[n].set(o.p.x, o.p.y, o.p.z, o.r * P.lightRadius); U.uLC.value[n].set(l.color[0] / 255 * i, l.color[1] / 255 * i, l.color[2] / 255 * i);
      }
      for (let q = n; q < NL; q++) U.uLC.value[q].set(0, 0, 0);
      const hl = M.hero.light, la = st.la, hi = hl.intensity * P.heroLight * (1 + .08 * Math.sin(st.T * 9) * Math.sin(st.T * 23)) * 1.15, hc = env.hexRgb(hl.color);
      U.uL.value[NL - 1].set((la[0] + .5) / S, hw.y - .5, hw.z + (hy - la[1]) * KB, hl.r / S * 1.25 * P.lightRadius); U.uLC.value[NL - 1].set(hc[0] / 255 * hi, hc[1] / 255 * hi, hc[2] / 255 * hi);
      const mc = P.mistColor; U.uFogC.value.set(mc[0] / 255 * (.3 + amb[0] / 640), mc[1] / 255 * (.3 + amb[1] / 640), mc[2] / 255 * (.36 + amb[2] / 640));
      U.uFog.value.set(cfg.fogTop == null ? 11.3 : cfg.fogTop, cfg.fogBottom == null ? 3.5 : cfg.fogBottom); U.uShowWalk.value = st.showWalk ? 1 : 0;
      // hero
      const acts = st.actors || [];
      for (const pl of pools.values()) pl.n = 0;
      let ng = 0;
      for (const a of acts) {
        const key = a.S.frame[0] + 'x' + a.S.frame[1] + ':' + a.S.foot[0] + ',' + a.S.foot[1];
        let pl = pools.get(key); if (!pl) pools.set(key, pl = { n: 0, list: [] });
        const c = pl.list[pl.n] || (pl.list[pl.n] = card(a.S)); pl.n++;
        c.body.visible = true; c.sh.visible = !a.noShadow;
        const Sp = a.S, FW = Sp.frame[0], FH = Sp.frame[1], lfa = env.lift(a.x, a.y), p = world(a.x - .5, a.y - .5, lfa), t = tex(a.img);
        const bob = a.bob ? (Math.sin(st.T * 1.7 + a.x) * .5 + .5) * a.bob * KB : 0;
        if (a.glow) {
          const g = glows[ng] || (glows[ng] = glowCard()), G = a.glow, c = G.rgb || (G.rgb = env.hexRgb(G.c || '#ffd27a').map(v => v / 255)); ng++;
          g.visible = true; g.scale.set(2 * G.r / S, 1, 2 * G.r * KB); g.position.set(p.x, p.y - .14, p.z + bob + (Sp.body * .5 + (G.up || 0)) * KB);
          g.material.uniforms.uC.value.set(c[0], c[1], c[2]); g.material.uniforms.uP.value.set(st.T, G.a == null ? 1 : G.a, a.x * .37 + a.y * .11, G.sparks || 0);
        }
        for (const m of [c.body, c.gh]) { m.position.set(p.x, p.y - .09, p.z + bob); m.material.uniforms.tHero.value = t; m.material.uniforms.uFrame.value.set(a.fc * FW / a.img.width, a.fr * FH / a.img.height, FW / a.img.width, FH / a.img.height); }
        let hid = 0, tot = 0;                                 // how much of the body is behind scenery (same rule as the 2D engine)
        for (let j = 6; j < Sp.body; j += 10) for (let i = -10; i <= 10; i += 5) { tot++; if (env.hides(a.x + i, a.y - j, a.y + lfa)) hid++; }
        c.ghost += (clamp((hid / tot - .3) / .3, 0, 1) * .36 - c.ghost) * .25; c.gh.material.uniforms.uGhost.value = Math.max(c.ghost, .001); c.gh.visible = c.ghost > .01;
        c.sh.position.set(p.x, p.y, p.z + .03); c.sh.material.uniforms.uA.value = M.hero.shadow / .34;
      }
      for (const pl of pools.values()) for (let n = pl.n; n < pl.list.length; n++) { const c = pl.list[n]; c.body.visible = c.sh.visible = c.gh.visible = false; }
      for (let n = ng; n < glows.length; n++) glows[n].visible = false;
      PU.uT.value = st.T; PU.uPx.value = ch / 540 * 2.2; PU.uI.value = clamp(P.fireflies, 0, 1.2); flies.visible = P.fireflies > 0;
      // sky
      if (sky) { const maxY = Math.max(0, M.h - VH); let x = sky.x - cam.x * sky.px, y = sky.y - cam.y * sky.py; if (sky.anchorY === 'bottom') y += VH - sky.img.height * sky.scale + maxY * sky.py;
        U.uRect.value.set(x, y, sky.img.width * sky.scale, sky.img.height * sky.scale); }
      const t = st.moodT; if (bk) U.uBack.value.set(bk[0] / 255, bk[1] / 255, bk[2] / 255); else U.uBack.value.set((26 + (8 - 26) * t) / 255, (20 + (8 - 20) * t) / 255, (52 + (26 - 52) * t) / 255);
      const sk = P.skyTint; U.uTint.value.set(sk[0] / 255, sk[1] / 255, sk[2] / 255);
      // scene
      R.setRenderTarget(rtScene); R.setClearColor(0x000000, 1); R.clear(true, true, false);
      draw(mSky, rtScene);
      R.setRenderTarget(rtScene); R.render(scene, camera);
      // depth of field
      const maxR = DOFS[state.dof] || 0; let src = rtScene;
      if (maxR > 0) { mDof.uniforms.tScene.value = rtScene.texture; mDof.uniforms.uPx.value.set(ch / 540 / cw, ch / 540 / ch); mDof.uniforms.uMax.value = maxR; mDof.uniforms.uBand.value = cfg.band == null ? .18 : cfg.band; draw(mDof, rtDof); src = rtDof; }
      // bloom
      mBright.uniforms.tIn.value = src.texture; draw(mBright, rtB1);
      for (let i = 0; i < (cfg.bloomWide ? 3 : 2); i++) { mBlur.uniforms.tIn.value = rtB1.texture; mBlur.uniforms.uDir.value.set((1 + i) / rtB1.width, 0); draw(mBlur, rtB2); mBlur.uniforms.tIn.value = rtB2.texture; mBlur.uniforms.uDir.value.set(0, (1 + i) / rtB1.height); draw(mBlur, rtB1); }
      const g = P.grade;
      mFinal.uniforms.tIn.value = src.texture; mFinal.uniforms.tBloom.value = rtB1.texture; mFinal.uniforms.uBloom.value = (.35 + P.glow * .55) * (cfg.bloom || 1);
      mFinal.uniforms.uVig.value = P.vignette; mFinal.uniforms.uVigC.value.copy(v3(P.vignetteColor)); mFinal.uniforms.uGrade.value.copy(v3(g)); mFinal.uniforms.uGradeA.value = P.gradeAlpha;
      draw(mFinal, null);
    }

    // ---- small switches (also keys P and B)
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;right:1.2em;top:1.2em;display:flex;gap:.5em;z-index:6;font-size:1.25em';
    const DN = ['切', '弱', '中', '強'], BN = ['切', '弱', '強'];
    const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.style.cssText = 'font:inherit;color:#f3e7d0;background:rgba(14,10,34,.62);border:1px solid rgba(226,196,138,.55);border-radius:.4em;padding:.35em .7em;cursor:pointer'; b.onclick = e => { fn(); paint(); e.currentTarget.blur(); }; b.onpointerdown = e => e.stopPropagation(); bar.appendChild(b); b._l = label; return b; };
    const bH = btn(() => 'HD-2D ' + (state.on ? '入' : '切'), () => api.toggle()), bD = btn(() => '立体感 ' + DN[state.depth], () => { state.depth = (state.depth + 1) % DEPTHS.length; }), bB = btn(() => 'ぼかし ' + BN[state.dof], () => { state.dof = (state.dof + 1) % DOFS.length; });
    function paint() { for (const b of [bH, bD, bB]) b.textContent = b._l(); bD.style.display = bB.style.display = state.on ? '' : 'none'; }
    if (env.UI_ON && !cfg.noBar) stage.appendChild(bar);
    const api = {
      render, state, info: { nTri, nBack, get scale() { return scale; } },
      get on() { return state.on; },
      toggle() { state.on = !state.on; canvas.style.display = state.on ? 'block' : 'none'; env.cv.style.display = state.on ? 'none' : ''; paint(); },
      key(k) { if (k === 'p' || k === 'P') { state.depth = (state.depth + 1) % DEPTHS.length; paint(); return true; } if (k === 'b' || k === 'B') { state.dof = (state.dof + 1) % DOFS.length; paint(); return true; } if (k === 'h' || k === 'H') { api.toggle(); return true; } return false; },
      // a change of map: everything this view made is given back
      dispose() {
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        for (const t of [rtScene, rtDof, rtB1, rtB2]) if (t) t.dispose();
        for (const t of [tMap, tBack, tMid, tWalk, tSky, ...texOf.values()]) if (t) t.dispose();
        R.dispose(); try { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (e) {}
        canvas.remove(); bar.remove(); env.cv.style.display = '';
      },
      canvas, dbg: { hh, hb, ring, vd, bh, un, hData, mid: MID, camPos: U.uCamPos.value, dir },
    };
    env.cv.style.display = 'none'; paint();
    return api;
  }
  window.HD2D = { create };
})();
