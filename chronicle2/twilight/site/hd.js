// HD-2D style renderer for maps made blockout-first (three.js).  Loaded by game.js only when the map has an "hd" entry.
//
// The painted map knows, for every pixel, where that pixel is in 3D (height.png, see build/blockout/vox.py).  So the picture
// is laid over a relief mesh, one vertex per pixel, and shown with a real camera: depth of field, lights that follow the
// shapes, a billboard hero hidden by the depth buffer, mist that gathers low on the cliff.
// World units: x = px / S (east), y = -(py + H) / (A S) (north), z = H / (B S) (up), all in painted-picture space.
(function () {
  'use strict';
  const NL = 14, TILE = 128, JUMP = 14;   // JUMP: two neighbouring dots whose foot lines differ by more than this belong to different things
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const MESH_VS = `
    uniform vec3 uK; varying vec2 vT; varying vec3 vW;
    vec3 wpos(vec3 p) { return vec3((p.x + .5) * uK.x, -(p.y + .5 + p.z) * uK.y, p.z * uK.z); }
    void main() {
      vec3 w = wpos(position);
      vW = w;
      vec4 cn = projectionMatrix * viewMatrix * vec4(w, 1.);
      vT = position.xy + .5;
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
    uniform sampler2D tMap, tWalk; uniform vec2 uSize, uRes; uniform vec3 uFogC; uniform vec2 uFog; uniform float uShowWalk, uGain;
    varying vec2 vT; varying vec3 vW;
    ${LIGHT_FN}
    ${SKY_FN}
    void main() {
      vec2 f = fract(vT) - .5, fw = max(fwidth(vT), vec2(1e-4));
      vec2 uv = (floor(vT) + .5 + clamp(f / fw, -.5, .5)) / uSize;
      vec4 c = texture2D(tMap, uv);
      if (c.a < .5) discard;
      vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(n, uCamDir) > 0.) n = -n;
      vec3 L = lightAt(vW, n, .35);
      vec3 col = c.rgb * (uAmb + L * uGain) + c.rgb * L * L * .25;
      #ifdef BACK
        col *= .93;                                           // ground that the picture never showed: it sits in the near thing's shade
      #endif
      vec4 wk = texture2D(tWalk, uv);
      // the cliff sinks into the cloud sea: low rock, and the cut lower edge of the picture, dissolve into the sky itself
      float lowf = smoothstep(uFog.x, uFog.y, vW.z);
      float cut = smoothstep(uSize.y - 150., uSize.y - 14., vT.y) * (1. - wk.g);
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
  const PT_VS = `attribute vec4 aSeed; uniform float uT, uPx; varying float vA;
    void main() { vec3 p = position + vec3(sin(uT * aSeed.x + aSeed.w * 6.3) * .7, cos(uT * aSeed.y * .8 + aSeed.w * 3.1) * .5, sin(uT * aSeed.z + aSeed.w) * .35);
      vA = .55 + .45 * sin(uT * (1.2 + aSeed.x) + aSeed.w * 20.); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); gl_PointSize = uPx * (1.6 + aSeed.z); }`;
  const PT_FS = `uniform vec3 uC; uniform float uI; varying float vA; void main() { float d = length(gl_PointCoord - .5) * 2.; float a = clamp(1. - d, 0., 1.); gl_FragColor = vec4(uC * a * a * vA * uI, 0.); }`;
  // depth of field: gather inside the pixel's own circle of confusion; sharp neighbours do not bleed into blurred ones
  const DOF_FS = `
    uniform sampler2D tScene; uniform vec2 uPx; uniform float uMax, uBand; varying vec2 vUv;
    float coc(float a) { return clamp((abs(a - .5) * 2. - uBand) / (1. - uBand), 0., 1.) * uMax; }
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
  const BRIGHT_FS = `uniform sampler2D tIn; varying vec2 vUv; void main() { vec3 c = texture2D(tIn, vUv).rgb; float l = dot(c, vec3(.4, .45, .15)); gl_FragColor = vec4(c * smoothstep(.62, 1.05, l), 1.); }`;
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
    const cfg = Object.assign({ S: 32, A: .75, B: .66, depth: 1, dof: 1 }, M.hd);
    const S = cfg.S, KA = 1 / (cfg.A * S), KB = 1 / (cfg.B * S);
    const canvas = document.createElement('canvas');
    canvas.id = 'viewhd'; canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    stage.insertBefore(canvas, env.cv);
    const R = new T3.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: env.Q.get('keep') === '1' });
    R.autoClear = false;
    const gl = R.getContext();
    const state = { depth: +(env.Q.get('depth') ?? cfg.depth), dof: +(env.Q.get('dof') ?? cfg.dof), on: true };
    const DEPTHS = [0, 150, 76, 44], DOFS = [0, 3, 5.5];     // camera distance per "立体感" step, blur radius (art px) per "ぼかし" step

    // ---- picture: colours under transparent pixels are filled from their neighbours so the edge never darkens
    const W = M.w, H = M.h;
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const px = pc.getContext('2d', { willReadFrequently: true }); px.drawImage(A.map, 0, 0);
    const img = px.getImageData(0, 0, W, H), d = img.data;
    const hh = new Uint16Array(hData);                         // heights, with painted-but-flat pixels filled from neighbours
    for (let pass = 0; pass < 6; pass++) {
      const todo = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const o = i * 4;
        if (d[o + 3] === 0 || (d[o + 3] && !hh[i])) {
          for (const j of [i - 1, i + 1, i - W, i + W]) {
            if (d[o + 3] === 0 && d[j * 4 + 3] === 255) { todo.push(i, j, 0); break; }
            if (d[o + 3] && !hh[i] && hh[j]) { todo.push(i, j, 1); break; }
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
    // the painter draws things a few dots fatter than the blocks: near things grow over flat ground (where the outline says
    // "this stands", when there is one) so their rim stays with them
    const flat = (src, i) => { const a = src[i] - src[i + W], b = src[i - W] - src[i]; return !(a >= 1 && a <= 3) && !(b >= 1 && b <= 3); };
    for (let pass = 0; pass < (mp ? 9 : 3); pass++) {
      const src = hh.slice();
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const v = src[i]; if (!v || (mp && !(mp[i] && flat(src, i)))) continue;
        const q = y + v; let best = 0, n;
        if ((n = src[i - 1]) && y + n - q > JUMP && y + n > best && (!mp || mp[i - 1])) best = y + n;
        if ((n = src[i + 1]) && y + n - q > JUMP && y + n > best && (!mp || mp[i + 1])) best = y + n;
        if ((n = src[i - W]) && y - 1 + n - q > JUMP && y - 1 + n > best && (!mp || mp[i - W])) best = y - 1 + n;
        if ((n = src[i + W]) && y + 1 + n - q > JUMP && y + 1 + n > best && (!mp || mp[i + W])) best = y + 1 + n;
        if (best) hh[i] = best - y;
      }
    }
    // ---- what lies behind near things.  The picture shows one surface per pixel; when the camera looks from a slightly
    // different place, a strip beside every near thing comes into view that was never painted.  That strip is made here:
    // the far surface is continued in under the near thing, ring by ring, with the colours of the far side diffused inwards.
    const RINGS = 60, hb = new Uint16Array(W * H), ring = new Uint8Array(W * H), bd = new Uint8Array(d.length), seen = new Uint8Array(W * H), upr = new Uint8Array(W * H);
    const N8 = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1], DY = [0, 0, -1, 1, -1, -1, 1, 1];
    function fill(rings) {
      hb.fill(0); ring.fill(0); seen.fill(0); bd.set(d);
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) upr[i] = hh[i] && !flat(hh, i) ? 1 : 0;
      let cur = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1, i = y * W + 1; x < W - 1; x++, i++) {
        const v = hh[i]; if (!v) continue;
        const q = y + v;
        for (let k = 0; k < 4; k++) { const n = hh[i + N8[k]]; if (n && y + DY[k] + n < q - JUMP) { cur.push(i); break; } }
      }
      const sv = new Int32Array(8);
      for (let k = 1; k <= rings && cur.length; k++) {
        const done = [];
        for (const i of cur) {
          const y = (i / W) | 0, q = y + hh[i];
          let lo = 1e9;
          for (let e = 0; e < 8; e++) {                          // what the far side would be here: an upright face keeps its foot line, flat ground keeps its height
            const j = i + N8[e]; let v = ring[j] ? hb[j] : (hh[j] && y + DY[e] + hh[j] < q - JUMP ? hh[j] : 0);
            if (v && upr[j]) v = Math.max(1, v + DY[e]);
            sv[e] = v; if (v && v < lo) lo = v;
          }
          if (lo > 1e8) continue;
          let sh = 0, r = 0, g = 0, b = 0, n = 0, nu = 0;
          for (let e = 0; e < 8; e++) {
            const v = sv[e]; if (!v || v > lo + 6) continue;
            const j = i + N8[e], wgt = e < 4 ? 2 : 1; let o = j * 4;
            if (!ring[j]) for (let t = 6; t > 0; t--) {              // painted things carry a dark outline: take the far side's colour from a few dots further out
              const jj = j + N8[e] * t;
              if (jj > W && jj < W * (H - 1) && hh[jj] && !ring[jj] && Math.abs(((jj / W) | 0) + hh[jj] - (y + DY[e] + hh[j]) - DY[e] * t * (upr[j] ? 0 : 1)) <= JUMP && Math.abs((jj % W) - (j % W)) <= t) { o = jj * 4; break; }
            }
            sh += v * wgt; r += bd[o] * wgt; g += bd[o + 1] * wgt; b += bd[o + 2] * wgt; n += wgt; if (upr[j]) nu += wgt;
          }
          const hv = Math.round(sh / n);
          if (y + hv >= q - JUMP) continue;                         // the far surface has reached the near thing's foot
          done.push(i, hv, r / n, g / n, b / n, nu * 2 > n ? 1 : 0);
        }
        const next = [];
        for (let e = 0; e < done.length; e += 6) { const i = done[e], o = i * 4; hb[i] = done[e + 1]; ring[i] = k; upr[i] = done[e + 5]; bd[o] = done[e + 2]; bd[o + 1] = done[e + 3]; bd[o + 2] = done[e + 4]; bd[o + 3] = 255; }
        for (let e = 0; e < done.length; e += 6) for (let c = 0; c < 4; c++) {
          const j = done[e] + N8[c], x = j % W;
          if (!ring[j] && hh[j] && seen[j] !== k && x > 0 && x < W - 1 && j > W && j < W * (H - 1)) { seen[j] = k; next.push(j); }
        }
        cur = next;
      }
    }
    if (mp) {
      // the blocks are also a few dots fatter than the painted thing in places (thin branches most of all): a rim that the
      // painter left as ground goes back to the ground, as long as the painted thing itself is right behind that rim
      const TRIM = 8; fill(TRIM + 4);
      const reach = new Uint8Array(W * H); let fr = [];
      for (let i = 0; i < W * H; i++) if (ring[i] && mp[i]) { reach[i] = 1; fr.push(i); }
      for (let k = 0; k < TRIM + 2; k++) { const nx = []; for (const i of fr) for (let c = 0; c < 4; c++) { const j = i + N8[c]; if (ring[j] && !reach[j]) { reach[j] = 1; nx.push(j); } } fr = nx; }
      const cut = new Uint8Array(W * H), by = Array.from({ length: TRIM + 1 }, () => []);
      for (let i = 0; i < W * H; i++) if (ring[i] && ring[i] <= TRIM && !mp[i] && reach[i]) by[ring[i]].push(i);
      for (let k = 1; k <= TRIM; k++) for (const i of by[k]) if (k === 1 || cut[i - 1] || cut[i + 1] || cut[i - W] || cut[i + W]) cut[i] = 1;
      for (let i = 0; i < W * H; i++) if (cut[i]) hh[i] = hb[i];
    }
    fill(RINGS);
    const mkTex = a => { const t = new T3.DataTexture(a, W, H, T3.RGBAFormat); t.magFilter = t.minFilter = T3.LinearFilter; t.needsUpdate = true; return t; };
    const tMap = mkTex(new Uint8Array(d.buffer)), tBack = mkTex(bd);
    // walk mask (R) and, in G, "close to where one can walk": that part of the picture's lower edge must not dissolve
    const wk = new Uint8Array(W * H * 4), Y0 = Math.max(0, H - 240), dist = new Float32Array(W * (H - Y0)).fill(1e3);
    for (let i = 0; i < W * H; i++) wk[i * 4] = walkData ? walkData[i] * 255 : 255;
    if (walkData) {
      const hgt = H - Y0, at = (x, y) => dist[y * W + x];
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) if (walkData[(Y0 + y) * W + x]) dist[y * W + x] = 0;
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) { let v = at(x, y); if (x) v = Math.min(v, at(x - 1, y) + 1); if (y) { v = Math.min(v, at(x, y - 1) + 1); if (x) v = Math.min(v, at(x - 1, y - 1) + 1.4); if (x < W - 1) v = Math.min(v, at(x + 1, y - 1) + 1.4); } dist[y * W + x] = v; }
      for (let y = hgt - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { let v = at(x, y); if (x < W - 1) v = Math.min(v, at(x + 1, y) + 1); if (y < hgt - 1) { v = Math.min(v, at(x, y + 1) + 1); if (x) v = Math.min(v, at(x - 1, y + 1) + 1.4); if (x < W - 1) v = Math.min(v, at(x + 1, y + 1) + 1.4); } dist[y * W + x] = v; }
      for (let y = 0; y < hgt; y++) for (let x = 0; x < W; x++) wk[((Y0 + y) * W + x) * 4 + 1] = 255 * clamp((70 - at(x, y)) / 40, 0, 1);
    }
    const tWalk = new T3.DataTexture(wk, W, H, T3.RGBAFormat); tWalk.magFilter = tWalk.minFilter = T3.LinearFilter; tWalk.needsUpdate = true;
    const tHero = new T3.Texture(A.hero); tHero.magFilter = tHero.minFilter = T3.NearestFilter; tHero.generateMipmaps = false; tHero.flipY = false; tHero.needsUpdate = true;

    const world = (x, y, h) => new T3.Vector3((x + .5) / S, -(y + .5 + h) * KA, h * KB);
    const hAt = (x, y) => hh[clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)];

    // ---- shared uniforms
    const U = {
      uK: { value: new T3.Vector3(1 / S, KA, KB) }, uSize: { value: new T3.Vector2(W, H) }, tMap: { value: tMap }, tWalk: { value: tWalk },
      uAmb: { value: new T3.Vector3(1, 1, 1) }, uL: { value: Array.from({ length: NL }, () => new T3.Vector4(0, 0, 0, 1)) }, uLC: { value: Array.from({ length: NL }, () => new T3.Vector3()) },
      uCamPos: { value: new T3.Vector3() }, uCamDir: { value: new T3.Vector3() }, uFocus: { value: 50 }, uRange: { value: 15 },
      uFogC: { value: new T3.Vector3(.8, .7, .8) }, uFog: { value: new T3.Vector2(11, 3) }, uShowWalk: { value: 0 }, uGain: { value: .6 },
      uRes: { value: new T3.Vector2(960, 540) }, tSky: { value: null }, uRect: { value: new T3.Vector4() }, uBack: { value: new T3.Vector3() }, uTint: { value: new T3.Vector3(1, 1, 1) }, uHas: { value: 0 },
    };
    const meshMat = back => new T3.ShaderMaterial({ uniforms: back ? Object.assign({}, U, { tMap: { value: tBack } }) : U, vertexShader: MESH_VS, fragmentShader: MESH_FS, defines: back ? { BACK: 1 } : {}, extensions: { derivatives: true }, side: T3.DoubleSide });
    const matMain = meshMat(false), matBack = meshMat(true), matNet = meshMat(true);
    matNet.depthTest = false; matNet.depthWrite = false;      // safety net under everything: the old stretched bridge between a near thing and what is behind it
    if (env.Q.get('hdshow') === 'back') matMain.visible = false; if (env.Q.get('hdshow') === 'main') matBack.visible = false;

    // ---- relief mesh, one vertex per painted pixel, in tiles
    const scene = new T3.Scene();
    let nTri = 0, nBack = 0;
    for (let ty = 0; ty < H - 1; ty += TILE) for (let tx = 0; tx < W - 1; tx += TILE) {
      const w = Math.min(TILE, W - 1 - tx) + 1, h = Math.min(TILE, H - 1 - ty) + 1;
      const pos = new Uint16Array(w * h * 3), pb = new Uint16Array(w * h * 3), fl = new Uint8Array(w * h); let any = false, zmin = 1e9, zmax = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (ty + y) * W + tx + x, v = hh[i], o = (y * w + x) * 3;
        pos[o] = pb[o] = tx + x; pos[o + 1] = pb[o + 1] = ty + y; pos[o + 2] = v; pb[o + 2] = ring[i] ? hb[i] : v; fl[y * w + x] = ring[i] ? 1 : 0;
        if (v) { any = true; if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
      }
      if (!any) continue;
      const idx = [], ib = [], inet = [];
      for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
        const a = y * w + x, b = a + 1, c = a + w, e = c + 1, Y = ty + y;
        for (let layer = 0; layer < 2; layer++) {
          const P = layer ? pb : pos;
          if (layer && !(fl[a] || fl[b] || fl[c] || fl[e])) break;
          const ha = P[a * 3 + 2], hb2 = P[b * 3 + 2], hc = P[c * 3 + 2], he = P[e * 3 + 2];
          if (!ha || !hb2 || !hc || !he) continue;
          const qa = Y + ha, qb = Y + hb2, qc = Y + 1 + hc, qe = Y + 1 + he;
          if (Math.max(qa, qb, qc, qe) - Math.min(qa, qb, qc, qe) <= JUMP) (layer ? ib : idx).push(a, c, b, b, c, e);   // a jump in depth is left open
          else if (!layer) inet.push(a, c, b, b, c, e);
        }
      }
      const c0 = world(tx, ty + h, zmin), c1 = world(tx + w, ty, zmax), bs = new T3.Sphere(c0.clone().add(c1).multiplyScalar(.5), c0.distanceTo(c1) * .5 + 3);
      const add = (P, ix, mat, order) => { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(P, 3)); g.setIndex(new T3.BufferAttribute(new Uint16Array(ix), 1)); g.boundingSphere = bs; const m = new T3.Mesh(g, mat); m.renderOrder = order; scene.add(m); };
      if (inet.length) add(pos, inet, matNet, -1);
      if (idx.length) { add(pos, idx, matMain, 0); nTri += idx.length / 3; }
      if (ib.length) { add(pb, ib, matBack, 0); nBack += ib.length / 3; }
    }

    // ---- hero: an upright card (the picture is drawn with heights squeezed by B, so the card is 1/B taller in the world)
    const FW = HS.frame[0], FH = HS.frame[1], foot = HS.foot;
    const hg = new T3.PlaneGeometry(FW / S, FH * KB); hg.rotateX(Math.PI / 2); hg.translate((FW / 2 - foot[0]) / S, 0, (foot[1] - FH / 2) * KB);
    const HU = { tHero: { value: tHero }, uFrame: { value: new T3.Vector4() }, uCut: { value: (FH - foot[1] - 1.5) / FH }, uGhost: { value: 0 } };
    const heroMat = g => new T3.ShaderMaterial({ uniforms: Object.assign({}, U, HU, { uGhost: { value: g } }), vertexShader: HERO_VS, fragmentShader: HERO_FS, side: T3.DoubleSide });
    const heroM = new T3.Mesh(hg, heroMat(0)); heroM.frustumCulled = false; heroM.renderOrder = 2;
    const ghostM = new T3.Mesh(hg, heroMat(.3)); ghostM.frustumCulled = false; ghostM.renderOrder = 3;
    Object.assign(ghostM.material, { depthFunc: T3.GreaterDepth, depthWrite: false, transparent: true, blending: T3.CustomBlending, blendSrc: T3.SrcAlphaFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor });
    const sg = new T3.PlaneGeometry(1.15, .46);
    const shadowM = new T3.Mesh(sg, new T3.ShaderMaterial({ uniforms: { uA: { value: 1 } }, vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: SHADOW_FS,
      transparent: true, depthWrite: false, blending: T3.CustomBlending, blendSrc: T3.SrcAlphaFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.ZeroFactor, blendDstAlpha: T3.OneFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 }));
    shadowM.frustumCulled = false; shadowM.renderOrder = 1;
    scene.add(heroM, ghostM, shadowM);

    // ---- fireflies
    const fp = [], fs = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const e of M.emitters || []) if (e.kind === 'fireflies') for (let i = 0; i < e.n * 2; i++) {
      const x = e.x + rnd() * e.w, y = e.y + rnd() * e.h, v = hAt(x, y); if (!v) continue;
      const p = world(x, y, v); fp.push(p.x, p.y, p.z + .4 + rnd() * 1.8); fs.push(.4 + rnd(), .4 + rnd(), .3 + rnd(), rnd());
    }
    const pg = new T3.BufferGeometry(); pg.setAttribute('position', new T3.Float32BufferAttribute(fp, 3)); pg.setAttribute('aSeed', new T3.Float32BufferAttribute(fs, 4));
    const PU = { uT: { value: 0 }, uPx: { value: 4 }, uC: { value: new T3.Vector3(1, .86, .45) }, uI: { value: 1 } };
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
    const mSky = pass(SKY_FS, { tSky: U.tSky, uRect: U.uRect, uBack: U.uBack, uTint: U.uTint, uHas: U.uHas });
    const mDof = pass(DOF_FS, { tScene: { value: null }, uPx: { value: new T3.Vector2() }, uMax: { value: 0 }, uBand: { value: .3 } });
    const mBright = pass(BRIGHT_FS, { tIn: { value: null } }), mBlur = pass(BLUR_FS, { tIn: { value: null }, uDir: { value: new T3.Vector2() } });
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
    let ghost = 0, camLift = -1, tLast = 0, pxLast = 0, pyLast = 0;

    function render(st) {
      if (auto) { const now = performance.now(), dt = now - tPrev; tPrev = now; if (dt < 500) { ema += (dt - ema) * .08; if (++nSlow > 50 && ema > 36 && scale > .5) { scale -= .25; nSlow = 0; ema = 16; } } }
      resize();
      const { cam, hero, P } = st;
      const hx = hero.x, hy = hero.y, lf = env.lift(hx, hy), hw = world(hx - .5, hy - .5, lf);
      // The camera only ever slides the way the 2D camera does.  Its distance is taken from the ground under the middle of
      // the view at the hero's floor height, and that height is followed softly: a stair step (the floor jumps) or a walk
      // while the 2D camera is stopped at the map's edge must not push the camera in and out, which reads as a zoom pulse.
      const dT = st.T - tLast; tLast = st.T;
      if (camLift < 0 || dT < 0 || dT > .5 || Math.abs(hx - pxLast) + Math.abs(hy - pyLast) > 40) camLift = lf; else camLift += (lf - camLift) * (1 - Math.exp(-dT / .32));
      pxLast = hx; pyLast = hy;
      const bo = HS.body * .48;
      tgt.copy(world(cam.x + VW / 2 - .5, cam.y + VH / 2 + bo - .5, camLift)).addScaledVector(up, bo / S);
      const D = DEPTHS[state.depth] || 0, camera = D ? persp : ortho, dist = D || 120;
      camera.position.copy(tgt).addScaledVector(dir, -dist); camera.up.copy(up); camera.lookAt(tgt);
      if (D) { persp.fov = 2 * Math.atan(halfH / D) * 180 / Math.PI; persp.near = Math.max(1, D - 70); persp.far = D + 120; } else { ortho.near = 1; ortho.far = 320; }
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      U.uCamPos.value.copy(camera.position); U.uCamDir.value.copy(dir); U.uFocus.value = tmp.copy(world(hx - .5, hy - .5, camLift)).sub(camera.position).dot(dir); U.uRange.value = cfg.range == null ? 10.5 : cfg.range;   // focus stays on the hero
      // light
      const amb = P.ambient; U.uAmb.value.set(amb[0] / 255, amb[1] / 255, amb[2] / 255); U.uGain.value = .35 + P.lightGain * .55;
      const near = L3.map(o => ({ o, d: Math.hypot(o.px - (cam.x + VW / 2), (o.py - (cam.y + VH / 2)) * 1.3) - o.l.r })).sort((a, b) => a.d - b.d);
      let n = 0;
      for (; n < Math.min(NL - 1, near.length); n++) {
        const { o } = near[n], l = o.l, i = l.intensity * l.f * (near[n].d < 700 ? 1 : 0) * 1.25;
        U.uL.value[n].set(o.p.x, o.p.y, o.p.z, o.r * P.lightRadius); U.uLC.value[n].set(l.color[0] / 255 * i, l.color[1] / 255 * i, l.color[2] / 255 * i);
      }
      for (let q = n; q < NL; q++) U.uLC.value[q].set(0, 0, 0);
      const hl = M.hero.light, la = st.la, hi = hl.intensity * P.heroLight * (1 + .08 * Math.sin(st.T * 9) * Math.sin(st.T * 23)) * 1.15, hc = env.hexRgb(hl.color);
      U.uL.value[NL - 1].set((la[0] + .5) / S, hw.y - .5, hw.z + (hy - la[1]) * KB, hl.r / S * 1.25 * P.lightRadius); U.uLC.value[NL - 1].set(hc[0] / 255 * hi, hc[1] / 255 * hi, hc[2] / 255 * hi);
      const mc = P.mistColor; U.uFogC.value.set(mc[0] / 255 * (.3 + amb[0] / 640), mc[1] / 255 * (.3 + amb[1] / 640), mc[2] / 255 * (.36 + amb[2] / 640));
      U.uFog.value.set(cfg.fogTop == null ? 11.3 : cfg.fogTop, cfg.fogBottom == null ? 3.5 : cfg.fogBottom); U.uShowWalk.value = st.showWalk ? 1 : 0;
      // hero
      const [fc, fr] = st.frame, tw = HS.cols * FW, th = HS.rows * FH;
      for (const m of [heroM, ghostM]) { m.position.set(hw.x, hw.y - .09, hw.z); m.material.uniforms.uFrame.value.set(fc * FW / tw, fr * FH / th, FW / tw, FH / th); }
      let hid = 0, tot = 0;                                   // how much of the body is behind scenery (same rule as the 2D engine)
      for (let j = 6; j < HS.body; j += 10) for (let i = -10; i <= 10; i += 5) { tot++; if (env.hides(hx + i, hy - j, hy + lf)) hid++; }
      ghost += (clamp((hid / tot - .3) / .3, 0, 1) * .36 - ghost) * .25; ghostM.material.uniforms.uGhost.value = Math.max(ghost, .001); ghostM.visible = ghost > .01;
      shadowM.position.set(hw.x, hw.y, hw.z + .03); shadowM.material.uniforms.uA.value = M.hero.shadow / .34;
      PU.uT.value = st.T; PU.uPx.value = ch / 540 * 2.2; PU.uI.value = clamp(P.fireflies, 0, 1.2); flies.visible = P.fireflies > 0;
      // sky
      if (sky) { const maxY = Math.max(0, M.h - VH); let x = sky.x - cam.x * sky.px, y = sky.y - cam.y * sky.py; if (sky.anchorY === 'bottom') y += VH - sky.img.height * sky.scale + maxY * sky.py;
        U.uRect.value.set(x, y, sky.img.width * sky.scale, sky.img.height * sky.scale); }
      const t = st.moodT; U.uBack.value.set((26 + (8 - 26) * t) / 255, (20 + (8 - 20) * t) / 255, (52 + (26 - 52) * t) / 255);
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
      for (let i = 0; i < 2; i++) { mBlur.uniforms.tIn.value = rtB1.texture; mBlur.uniforms.uDir.value.set((1 + i) / rtB1.width, 0); draw(mBlur, rtB2); mBlur.uniforms.tIn.value = rtB2.texture; mBlur.uniforms.uDir.value.set(0, (1 + i) / rtB1.height); draw(mBlur, rtB1); }
      const g = P.grade;
      mFinal.uniforms.tIn.value = src.texture; mFinal.uniforms.tBloom.value = rtB1.texture; mFinal.uniforms.uBloom.value = .35 + P.glow * .55;
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
    if (env.UI_ON) stage.appendChild(bar);
    const api = {
      render, state, info: { nTri, nBack, get scale() { return scale; } },
      get on() { return state.on; },
      toggle() { state.on = !state.on; canvas.style.display = state.on ? 'block' : 'none'; env.cv.style.display = state.on ? 'none' : ''; paint(); },
      key(k) { if (k === 'p' || k === 'P') { state.depth = (state.depth + 1) % DEPTHS.length; paint(); return true; } if (k === 'b' || k === 'B') { state.dof = (state.dof + 1) % DOFS.length; paint(); return true; } if (k === 'h' || k === 'H') { api.toggle(); return true; } return false; },
      canvas, dbg: { hh, hb, ring, camPos: U.uCamPos.value, dir },
    };
    env.cv.style.display = 'none'; paint();
    return api;
  }
  window.HD2D = { create };
})();
