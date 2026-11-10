// Sky and far scenery: dusk dome (gradient, stars, cloud bands, the white moon and the black moon), three rings of far
// mountains and the sea of clouds below the plateau.
//
//   const sky = HD.Sky.create(opts);  scene.add(sky.group);  ...each frame: sky.update(timeSeconds, camera);
//   sky.whiteMoonDir / sky.blackMoonDir : unit Vector3 from the plateau toward each moon.
//   sky.uniforms : shared uniform objects, safe to change at run time (uMoonGain, uCoronaGain, uStarGain,
//                  uCloudLight, uMountLight, uWind).
//
// How it is drawn. Everything here is one indexed-colour picture: each shader works on a screen-space pixel grid
// (cells of `uPx` buffer pixels: 2 px at 720p, 3 px at 1080p), builds the view ray through the CENTRE of its cell,
// evaluates a scalar "tone" along the `sky` ramp of HD.P for that ray and outputs one ramp colour, ordered-dithered
// between neighbouring ramp steps. So dome, ridges and cloud sea share one pixel grid and one palette, whatever the
// geometry. The rays come from `viewMatrix` / `projectionMatrix` of whatever camera is rendering, and the grid from the
// current viewport (read in onBeforeRender), so nothing here depends on the caller's resolution or render target.
//   dome      : 1 draw call. Gradient + halo + stars + cloud bands + both moons, all in the fragment shader.
//   mountains : 1 draw call. Three cylinders around the plateau; each samples a pre-rendered panorama of a fractal
//               range (built once on the CPU: light / snow / depth / coverage), found by ray-cylinder intersection, so
//               the layers show true parallax when the camera moves. Their feet end at the cloud surface.
//   cloud sea : 1 draw call. A disc at the top of a 12 unit thick slab; the shader ray-marches a drifting height field
//               inside the slab (relief, self-occlusion) and writes gl_FragDepth, so cliffs sink into the billows.
// All materials: fog off (haze is baked in), no shadows, negative renderOrder (dome -1000, mountains -900, sea -800).
(function () {
  'use strict';
  const HD = (window.HD = window.HD || {});
  const DEG = Math.PI / 180;

  // ---- the fixed design of the vista ------------------------------------------------------------------------------
  const AZ_W = -18, EL_W = 2.0, R_W = 3.0;        // white moon: azimuth (deg east of north), centre elevation, angular radius
  const AZ_B = 14, EL_B = 7.0, R_B = 2.4;         // black moon
  const CEN_X = 0, CEN_Z = -36;                   // plateau centre: axis of the mountain rings and of the cloud disc
  const CLOUD_Y = -26, CLOUD_H = 12;              // cloud slab: mean height and thickness (surface lies in [Y-H/2, Y+H/2])
  const EYE_Y = 9;                                // eye height the mountain panoramas are composed for
  const LOOKOUT = [18, -28.5];                    // camera x,z of the lookout vista: ridge profiles are composed for it
  const TILE_DEG = 120;                           // one panorama tile spans 120 degrees of azimuth, repeated 3 times

  // Ridge envelopes: [azimuth as seen from the lookout camera, peak elevation in degrees]. The far ridge has a notch
  // where the white moon sinks; the mid and near ranges stay low there and rise to frame the black moon on the right.
  const LAYERS = [
    { name: 'far', R: 470, depth: 170, shift: 0, f0: 9, fs: 2.1, rough: 0.40, seed: 31, H: 192, NV: 110, E0: -6.5, snow: 2.6,
      pts: [[-70, 3.0], [-58, 3.6], [-48, 2.6], [-40, 3.3], [-31.5, 3.9], [-25.5, 3.0], [-21.5, 2.0], [-17.5, 1.45], [-14, 1.9],
            [-9.5, 3.5], [-4, 2.6], [1, 3.2], [6, 2.3], [11, 2.9], [17, 2.2], [23, 3.4], [30, 2.6], [38, 3.7], [47, 2.8]] },
    { name: 'mid', R: 380, depth: 150, shift: 5, f0: 8, fs: 2.3, rough: 0.44, seed: 57, H: 192, NV: 120, E0: -8.5, snow: 2.3,
      pts: [[-70, 2.6], [-56, 3.0], [-45, 2.2], [-37, 2.8], [-33, 1.9], [-30, 0.6], [-27.5, -0.8], [-25, -3.0], [-22.5, -7], [-16.5, -7],
            [-14, -4.8], [-12, -3.0], [-10, -0.8], [-8, 0.8], [-3, 2.2], [2.5, 2.9], [8, 1.9], [13, 1.2], [19, 2.0], [26, 3.0], [34, 2.2], [42, 2.9]] },
    { name: 'near', R: 290, depth: 140, shift: 7, f0: 7, fs: 2.4, rough: 0.48, seed: 83, H: 256, NV: 160, E0: -11, snow: 1.9,
      pts: [[-70, 2.8], [-57, 3.4], [-47, 2.4], [-39, 3.0], [-35, 2.0], [-32, 0.6], [-29.5, -1.2], [-27, -3.4], [-24.5, -6.2], [-22, -9.5],
            [-16, -9.5], [-13, -7.7], [-10.5, -6.1], [-8.5, -3.8], [-6.5, -1.6], [-4.5, 0.2], [-2, -0.5], [0.5, -1.6], [3.5, -2.2], [6, -1.2], [8.5, -0.6],
            [11, 0.7], [13, 1.6], [15.5, 2.7], [19.5, 3.5], [25, 2.6], [31, 3.3], [40, 2.5]] },
  ];

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const s2l = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const fl = x => { const s = String(+(+x).toFixed(5)); return /[.e]/.test(s) ? s : s + '.0'; };   // number -> GLSL float literal

  function dirAzEl(az, el) {
    const c = Math.cos(el * DEG);
    return new THREE.Vector3(Math.sin(az * DEG) * c, Math.sin(el * DEG), -Math.cos(az * DEG) * c).normalize();
  }
  // value noise on a precomputed w x h lattice (rows start at lattice row y0); wraps in x and y. Same values as
  // HD.vnoise for the same seed, but tileable and without hashing per sample.
  function lattice(w, h, seed, y0) {
    y0 = y0 || 0;
    const t = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[y * w + x] = HD.hash2(x, y + y0, seed);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const xa = ((xi % w) + w) % w, xb = (xa + 1) % w, ya = (((yi - y0) % h) + h) % h, yb = (ya + 1) % h;
      const a = t[ya * w + xa], b = t[ya * w + xb], c = t[yb * w + xa], d = t[yb * w + xb];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  function normalise(a, lo, hi) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < a.length; i++) { if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]; }
    const k = (hi - lo) / (mx - mn || 1);
    for (let i = 0; i < a.length; i++) a[i] = lo + (a[i] - mn) * k;
  }

  // ---- tileable noise texture: R fbm (coarse), G fbm, B fbm (finer), A billow detail -------------------
  function buildNoise() {
    const N = 256, n = N * N, ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    const oct = (f0, count, seed, step) => { const a = []; for (let o = 0, f = f0; o < count; o++, f *= 2) a.push([f, lattice(f, f, seed + o * step)]); return a; };
    const sets = [oct(2, 4, 11, 7), oct(4, 5, 101, 3), oct(8, 4, 211, 3), oct(8, 3, 307, 5)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x;
      for (let c = 0; c < 4; c++) {
        let s = 0, amp = 0.5;
        for (const o of sets[c]) { const q = o[1](u * o[0], v * o[0]); s += amp * (c === 3 ? Math.abs(2 * q - 1) : q); amp *= 0.5; }
        ch[c][i] = s;
      }
    }
    normalise(ch[0], 0, 1); normalise(ch[1], 0, 1); normalise(ch[2], 0, 1); normalise(ch[3], 0, 1);
    const d = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) d[i * 4 + c] = Math.round(ch[c][i] * 255);
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  // ---- cloud-sea height field, tileable: cumulus heaps made of round caps at three sizes (puffs on puffs) -----------
  function buildCloudHeight() {
    const N = 512, h = new Float32Array(N * N);
    const caps = function (cells, seed) {            // one round cap per cell: centre x, y, 1 / radius^2, height
      const t = new Float32Array(cells * cells * 4);
      for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
        const o = (y * cells + x) * 4, r = 0.55 + 0.5 * HD.hash2(x, y, seed + 2);
        t[o] = 0.5 + (HD.hash2(x, y, seed) - 0.5) * 0.8; t[o + 1] = 0.5 + (HD.hash2(x, y, seed + 1) - 0.5) * 0.8;
        t[o + 2] = 1 / (r * r); t[o + 3] = 0.55 + 0.45 * HD.hash2(x, y, seed + 3);
      }
      return function (x, y) {
        x *= cells; y *= cells;
        const xi = Math.floor(x), yi = Math.floor(y); let m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const cx = xi + dx, cy = yi + dy, o = ((((cy % cells) + cells) % cells) * cells + ((cx % cells) + cells) % cells) * 4;
          const ex = x - cx - t[o], ey = y - cy - t[o + 1], d2 = (ex * ex + ey * ey) * t[o + 2];
          if (d2 < 1) { const v = Math.pow(1 - d2, 0.8) * t[o + 3]; if (v > m) m = v; }
        }
        return m;
      };
    };
    const c1 = caps(7, 21), c2 = caps(15, 22), c3 = caps(34, 23), g1 = lattice(2, 2, 5), g2 = lattice(4, 4, 6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const g = 0.6 * g1(u * 2, v * 2) + 0.4 * g2(u * 4, v * 4);
      const b1 = c1(u, v), b2 = c2(u, v), b3 = c3(u, v);
      const cov = 0.30 + 0.70 * smooth(0.30, 0.70, g);
      h[y * N + x] = cov * (0.52 * b1 + 0.34 * b2 * (0.45 + 0.55 * b1) + 0.14 * b3 * (0.3 + 0.7 * b2)) + 0.22 * g;
    }
    normalise(h, 0.12, 1);
    const d = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) d[i] = Math.round(h[i] * 255);
    const t = new THREE.DataTexture(d, N, N, THREE.RedFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  // ---- white moon surface: R = maria (smooth field, thresholded on the pixel grid by the shader) ---------------------
  function buildMoonMap() {
    const N = 96, d = new Uint8Array(N * N * 4);
    const seas = [[-0.34, 0.40, 0.36, 1.0], [0.06, 0.56, 0.20, 0.8], [0.40, 0.26, 0.27, 0.95], [0.26, -0.06, 0.19, 0.7],
                  [-0.56, -0.02, 0.24, 0.75], [-0.14, -0.38, 0.30, 0.7], [0.56, -0.38, 0.17, 0.6], [-0.05, 0.12, 0.13, 0.5]];
    const pits = [[0.16, 0.20, 0.055], [-0.62, 0.42, 0.045], [0.62, 0.52, 0.04], [-0.10, 0.74, 0.04], [0.02, -0.12, 0.05]];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1;
      let m = 0;
      for (const s of seas) { const dx = u - s[0], dy = v - s[1]; m += s[3] * Math.exp(-(dx * dx + dy * dy) / (s[2] * s[2]) * 1.3); }
      m += (HD.fbm(u * 3.1 + 9, v * 3.1 + 4, 77, 4) - 0.5) * 0.7;
      let c = 0;
      for (const p of pits) { const dx = u - p[0], dy = v - p[1]; c = Math.max(c, Math.exp(-(dx * dx + dy * dy) / (p[2] * p[2]))); }
      const i = (y * N + x) * 4;
      d[i] = Math.round(clamp(m, 0, 1) * 255); d[i + 1] = Math.round(c * 255); d[i + 2] = 0; d[i + 3] = 255;
    }
    const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }

  // azimuth seen from the lookout camera -> azimuth around the plateau centre of the point on a ring of radius R
  function lookAzToTheta(az, R) {
    const dx = Math.sin(az * DEG), dz = -Math.cos(az * DEG), ox = LOOKOUT[0] - CEN_X, oz = LOOKOUT[1] - CEN_Z;
    const b = ox * dx + oz * dz, c = ox * ox + oz * oz - R * R, t = -b + Math.sqrt(b * b - c);
    return Math.atan2(ox + dx * t, -(oz + dz * t)) / DEG;
  }
  // smooth periodic curve through control points
  function makeProfile(pts, period) {
    const p = pts.map(q => [((q[0] + period / 2) % period + period) % period - period / 2, q[1]]).sort((a, b) => a[0] - b[0]);
    const n = p.length;
    return function (x) {
      x = ((x + period / 2) % period + period) % period - period / 2;
      let i = 0; while (i < n && p[i][0] <= x) i++;
      const a = p[(i - 1 + n) % n], b = p[i % n];
      let x0 = a[0], x1 = b[0]; if (i === 0) x0 -= period; if (i === n) x1 += period;
      const t = (x - x0) / (x1 - x0 || 1), s = t * t * (3 - 2 * t);
      return a[1] + (b[1] - a[1]) * s;
    };
  }

  // ---- far mountains: pre-render one 120 degree panorama of a fractal range as seen from the plateau ----------------
  // Output RGBA: R = light caught from the moon side, G = snow, B = depth inside the range (aerial perspective),
  // A = coverage. Rows run from y0 (bottom) to y1 (top) on a cylinder of radius R.
  function buildRange(L) {
    const W = 2048, Hp = L.H, NU = 1024, NV = L.NV, E0 = L.E0;
    const prof0 = makeProfile(L.pts.map(q => [lookAzToTheta(q[0], L.R), q[1]]), TILE_DEG);
    const PT = new Float32Array(4096); for (let i = 0; i < 4096; i++) PT[i] = prof0(-TILE_DEG / 2 + TILE_DEG * i / 4096);
    const prof = az => { const x = ((az / TILE_DEG + 0.5) % 1 + 1) % 1 * 4096, i = Math.floor(x), f = x - i; return PT[i & 4095] + (PT[(i + 1) & 4095] - PT[i & 4095]) * f; };
    const thMoon = lookAzToTheta(AZ_W, L.R);
    const y0 = -34, y1 = EYE_Y + L.R * Math.tan((Math.max.apply(null, L.pts.map(q => q[1])) + 0.5) * DEG);
    const E = new Float32Array(NU * NV), P = new Float32Array(NU);
    // ridged multifractal, periodic in azimuth
    const octs = [];
    for (let o = 0, f = L.f0, fy = L.fs; o < 6; o++, f *= 2, fy *= 2) {
      const yo = Math.floor(o * 7.3);
      octs.push([f, fy, o * 7.3, lattice(f, Math.ceil(fy) + 3, L.seed + o * 5, yo)]);
    }
    for (let j = 0; j < NV; j++) {
      const s = j / (NV - 1);
      for (let i = 0; i < NU; i++) {
        let r = 0, amp = 1, w = 1;
        for (let o = 0; o < 6; o++) {
          const q = octs[o];
          let v = 1 - Math.abs(2 * q[3](i / NU * q[0], s * q[1] + q[2]) - 1);
          v *= v; r += v * amp * w; w = clamp(v * 1.7, 0, 1); amp *= 0.5;
        }
        E[j * NU + i] = r;
      }
    }
    normalise(E, 0, 1);
    // deeper ridges are slid sideways (L.shift degrees over the depth of the range), so where a massif runs down into
    // the cloud sea its ridgelines overlap and recede instead of all ending at one azimuth
    for (let j = 0; j < NV; j++) {
      const s = j / (NV - 1), env = 0.2 + 0.8 * Math.pow(smooth(0, 0.72, s), 0.62);
      for (let i = 0; i < NU; i++) {
        const rise = (prof(-TILE_DEG / 2 + TILE_DEG * i / NU + L.shift * (s - 0.35)) - E0) * env;
        P[i] = Math.max(j ? P[i] : -99, E0 + rise);                       // noise-free silhouette = the composed envelope
        E[j * NU + i] = E0 + rise * (1 - L.rough + L.rough * E[j * NU + i]);
      }
    }
    // make the (smoothed) silhouette follow the composed envelope exactly, keeping the crags
    let S = new Float32Array(NU);
    for (let i = 0; i < NU; i++) { let m = -99; for (let j = 0; j < NV; j++) m = Math.max(m, E[j * NU + i]); S[i] = m; }
    for (let pass = 0; pass < 3; pass++) {
      const S2 = new Float32Array(NU), wd = 14;
      for (let i = 0; i < NU; i++) { let a = 0; for (let k = -wd; k <= wd; k++) a += S[(i + k + NU) % NU]; S2[i] = a / (2 * wd + 1); }
      S = S2;
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const k = j * NU + i; E[k] = E0 + (E[k] - E0) * (P[i] - E0) / Math.max(S[i] - E0, 0.05);
    }
    // world positions -> normals -> shade and snow
    const PX = new Float32Array(NU * NV), PY = new Float32Array(NU * NV), PZ = new Float32Array(NU * NV);
    for (let j = 0; j < NV; j++) {
      const rho = L.R + (j / (NV - 1)) * L.depth;
      for (let i = 0; i < NU; i++) {
        const th = (-TILE_DEG / 2 + TILE_DEG * i / NU) * DEG, k = j * NU + i;
        PX[k] = rho * Math.sin(th); PZ[k] = -rho * Math.cos(th); PY[k] = EYE_Y + rho * Math.tan(E[k] * DEG);
      }
    }
    const SH = new Float32Array(NU * NV), SN = new Float32Array(NU * NV);
    const nA = lattice(12, 12, L.seed + 3), nB = lattice(24, 24, L.seed + 4), nC = lattice(96, 96, L.seed + 9);
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const k = j * NU + i, il = j * NU + (i + NU - 1) % NU, ir = j * NU + (i + 1) % NU;
      const jd = Math.max(j - 1, 0) * NU + i, ju = Math.min(j + 1, NV - 1) * NU + i;
      const ax = PX[ir] - PX[il], ay = PY[ir] - PY[il], az = PZ[ir] - PZ[il];
      const bx = PX[ju] - PX[jd], by = PY[ju] - PY[jd], bz = PZ[ju] - PZ[jd];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      // art light: from the moon's side of each massif, raised, slightly from behind (the range is backlit)
      const thd = -TILE_DEG / 2 + TILE_DEG * i / NU, th = thd * DEG;
      const sg = clamp((thd - thMoon) / 12, -1, 1);
      const tx = Math.cos(th), tz = Math.sin(th), rx = Math.sin(th), rz = -Math.cos(th);
      let lx = -sg * 0.8 * tx + 0.36 * rx, ly = 0.44, lz = -sg * 0.8 * tz + 0.36 * rz;
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      SH[k] = smooth(0.32, 0.80, nx * lx + ny * ly + nz * lz);
      const u = i / NU, line = L.snow + 1.3 * (0.65 * nA(u * 12, j * 0.02) + 0.35 * nB(u * 24, j * 0.04) - 0.5);
      SN[k] = smooth(line - 0.3, line + 0.3, E[k]) * smooth(0.50, 0.72, ny + 0.25 * (nC(u * 96, j * 0.2) - 0.5));
    }
    // "voxel space" panorama: march each column front to back, keeping the highest projected row
    const d = new Uint8Array(W * Hp * 4), ky = Hp / (y1 - y0);
    for (let c = 0; c < W; c++) {
      const gi = c * NU / W, i0 = Math.floor(gi) % NU, i1 = (i0 + 1) % NU, fi = gi - Math.floor(gi);
      let maxRow = -1, prevVis = false, psh = 0, psn = 0, ps = 0;
      for (let j = 0; j < NV; j++) {
        const k0 = j * NU + i0, k1 = j * NU + i1;
        const e = E[k0] + (E[k1] - E[k0]) * fi, sh = SH[k0] + (SH[k1] - SH[k0]) * fi, sn = SN[k0] + (SN[k1] - SN[k0]) * fi;
        const s = j / (NV - 1);
        const row = Math.min(Hp - 1, Math.floor((EYE_Y + L.R * Math.tan(e * DEG) - y0) * ky));
        if (row > maxRow) {
          for (let r = maxRow + 1; r <= row; r++) {
            const t = prevVis ? (r - maxRow) / (row - maxRow) : 1, o = (r * W + c) * 4;
            d[o] = Math.round((psh + (sh - psh) * t) * 255); d[o + 1] = Math.round((psn + (sn - psn) * t) * 255);
            d[o + 2] = Math.round((ps + (s - ps) * t) * 255); d[o + 3] = 255;
          }
          maxRow = row; prevVis = true;
        } else prevVis = false;
        psh = sh; psn = sn; ps = s;
      }
      const top = (Math.max(maxRow, 0) * W + c) * 4;      // bleed colour upward so filtering at the silhouette stays clean
      for (let r = maxRow + 1; r < Hp; r++) { const o = (r * W + c) * 4; d[o] = d[top]; d[o + 1] = d[top + 1]; d[o + 2] = d[top + 2]; d[o + 3] = 0; }
    }
    const t = new THREE.DataTexture(d, W, Hp, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return { tex: t, y0, y1 };
  }

  // ---- GLSL shared by the three shaders ---------------------------------------------------------------------------
  function commonGLSL(nramp, rsub) {
    return /* glsl */`
#define DEG 57.2957795
#define NRAMP ${nramp}
#define RSUB ${fl(rsub)}
#define AZW ${fl(AZ_W)}
#define RW ${fl(R_W)}
#define RB ${fl(R_B)}
uniform mat4 projectionMatrix;
uniform vec4 uVP;            // viewport x, y, w, h in buffer pixels
uniform float uPx;           // size of one sky pixel in buffer pixels
uniform float uTime;
uniform vec3 uRamp[NRAMP];   // the sky ramp, linear RGB
uniform vec3 uMw;            // direction to the white moon
uniform vec3 uMb;            // direction to the black moon
uniform sampler2D uNoise;
vec2 gCell;
const float B4[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
float bayer() { ivec2 i = ivec2(gCell) & 3; return (B4[i.x + i.y * 4] + 0.5) / 16.0; }
// view ray through the centre of this fragment's pixel-art cell
vec3 cellRay() {
  gCell = floor((gl_FragCoord.xy - uVP.xy) / uPx);
  vec2 ndc = (gCell + 0.5) * uPx / uVP.zw * 2.0 - 1.0;
  vec3 v = vec3((ndc.x + projectionMatrix[2][0]) / projectionMatrix[0][0], (ndc.y + projectionMatrix[2][1]) / projectionMatrix[1][1], -1.0);
  return normalize(v * mat3(viewMatrix));
}
// tone (0 = zenith indigo .. 9 = horizon cream) -> one ramp colour, ordered-dithered. sharp > 1 flattens the bands.
vec3 rampDither(float t, float sharp) {
  t = clamp(t, 0.0, 9.0) * RSUB;
  float i = floor(t), f = t - i;
  f = clamp((f - 0.5) * sharp + 0.5, 0.0, 1.0);
  int k = int(i) + (f > bayer() ? 1 : 0);
  return uRamp[min(k, NRAMP - 1)];
}
float azd(float a, float r) { return mod(a - r + 180.0, 360.0) - 180.0; }
// the dusk gradient: glow strongest at the white moon's azimuth, colder and lower toward the east
float skyTone(float az, float el) {
  float da = azd(az, AZW);
  float g = exp(-da * da / (22.0 * 22.0)), g2 = exp(-da * da / (95.0 * 95.0));
  float hor = 3.5 + 0.8 * g2 + 2.7 * g;
  float hs = 3.8 + 4.5 * g;
  return 0.5 + (hor - 0.5) * exp(-max(el, 0.0) / hs);
}
// cloud-sea height field: surface y = YB + HH * hmap(xz), drifting with the wind
uniform sampler2D uCloud; uniform vec2 uWind;
const float YB = ${fl(CLOUD_Y - CLOUD_H / 2)};
const float YT = ${fl(CLOUD_Y + CLOUD_H / 2)};
const float HH = ${fl(CLOUD_H)};
float hmap(vec2 xz) {
  vec2 t = (xz + uTime * uWind) * 2.0 + 0.5, i = floor(t), f = t - i;
  f = f * f * (3.0 - 2.0 * f);
  return textureLod(uCloud, (i + f - 0.5) / 512.0, 0.0).r;
}
// how far the cloud sea has dissolved into the horizon haze at a given distance
float seaFade(float d) { return smoothstep(190.0, 520.0, d); }
float whiteHalo(vec3 rd) {
  float d = max(acos(clamp(dot(rd, uMw), -1.0, 1.0)) * DEG - RW, 0.0);
  return 1.9 * exp(-d / 1.4) + 1.0 * exp(-d / 5.0);
}
`;
  }

  const DOME_VS = /* glsl */`
void main() {
  gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);   // centred on the camera
}`;

  const DOME_FS = /* glsl */`
uniform sampler2D uMoon;
uniform vec3 uMwX; uniform vec3 uMwY; uniform vec3 uMbX; uniform vec3 uMbY;
uniform float uMoonGain; uniform float uCoronaGain; uniform float uStarGain;
const float BAND_E[5] = float[5](1.8, 3.1, 4.6, 6.3, 8.7);
const float BAND_W[5] = float[5](0.20, 0.24, 0.19, 0.26, 0.22);
// corona: two long streamers on one axis (the longer one reaches toward the white moon) and three short plumes.
// direction (rad, 0 = east, counter-clockwise), length (deg), curl, base half-width (rad), strength
const float WA[5] = float[5](3.30, 0.22, 1.30, 1.85, -1.50);
const float WL[5] = float[5](4.4, 3.0, 1.2, 0.9, 1.1);
const float WC[5] = float[5](0.035, -0.05, 0.10, -0.12, 0.08);
const float WW[5] = float[5](0.20, 0.17, 0.05, 0.04, 0.05);
const float WS[5] = float[5](0.58, 0.50, 0.42, 0.36, 0.40);
vec3 hash3(vec2 p, float s) {
  uvec3 v = uvec3(ivec3(int(p.x) + 8192, int(p.y) + 8192, int(s)));
  v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return vec3(v) * (1.0 / 4294967295.0);
}
// one star per grid cell at most; it lights exactly the sky pixel its direction projects into
float starLayer(float az, float el, float S, float dens, float seed, float big) {
  vec2 id = floor(vec2(az, el) / S);
  vec3 h = hash3(id, seed);
  if (h.x > dens) return 0.0;
  vec3 h2 = hash3(id, seed + 7.0);
  vec2 pos = (id + 0.2 + 0.6 * h.yz) * S / DEG;
  float ce = cos(pos.y);
  vec3 sv = mat3(viewMatrix) * vec3(sin(pos.x) * ce, sin(pos.y), -cos(pos.x) * ce);
  if (sv.z > -0.01) return 0.0;
  vec2 ndc = vec2(sv.x * projectionMatrix[0][0], sv.y * projectionMatrix[1][1]) / (-sv.z) - vec2(projectionMatrix[2][0], projectionMatrix[2][1]);
  vec2 dc = abs(gCell - floor((ndc * 0.5 + 0.5) * uVP.zw / uPx));
  float mag = h2.x;
  float tw = 0.70 + 0.30 * sin(uTime * (0.5 + 2.2 * h2.y) + 40.0 * h2.z);
  float m = dc.x + dc.y;
  if (m < 0.5) return (0.40 + 0.60 * mag) * tw;
  if (big > 0.5 && mag > 0.5 && m < 1.5) return 0.40 * mag * tw * tw;
  return 0.0;
}
// thin stratus streaks; rel = -1 at the underside .. +1 at the top
float bandAt(float az, float el, int k, out float rel) {
  rel = 0.0;
  float E = BAND_E[k], fk = float(k);
  if (abs(el - E) > 1.7) return 0.0;
  float a = (az + uTime * (0.010 + 0.004 * fk)) / 360.0;
  float c = E + 1.5 * (textureLod(uNoise, vec2(a * 2.0 + fk * 0.31, 0.21 + fk * 0.17), 0.0).g - 0.5);
  float pres = textureLod(uNoise, vec2(a * 3.0 + fk * 0.53, 0.63 + fk * 0.11), 0.0).b;
  float w = BAND_W[k] * smoothstep(0.40, 0.64, pres);
  w *= 0.45 + 1.1 * textureLod(uNoise, vec2(a * 24.0, el * 0.11 + fk * 0.4), 0.0).g;
  rel = (el - c) / max(w, 1e-4);
  return step(abs(rel), 1.0) * step(0.03, w);
}
void main() {
  vec3 rd = cellRay();
  float el = asin(clamp(rd.y, -1.0, 1.0)) * DEG, az = atan(rd.x, -rd.z) * DEG;
  float tone = skyTone(az, el);
  vec3 col;
  if (el < -2.5) {
    col = rampDither(tone, 1.0);                       // below the horizon: plain haze (normally hidden)
  } else {
    float cellDeg = uPx * 2.0 / (projectionMatrix[1][1] * uVP.w) * DEG;
    float dW = acos(clamp(dot(rd, uMw), -1.0, 1.0)) * DEG, hW = max(dW - RW, 0.0);
    float dB = acos(clamp(dot(rd, uMb), -1.0, 1.0)) * DEG, hB = dB - RB;
    float daz = azd(az, AZW), side = exp(-daz * daz / (40.0 * 40.0));
    float skyT = tone + 1.9 * exp(-hW / 1.4) + 1.0 * exp(-hW / 5.0) - 0.9 * exp(-max(hB, 0.0) / 3.0);
    tone = skyT;
    float gain = 1.0 + (uMoonGain - 1.0) * 0.6 * exp(-hW / 0.9), sharp = 1.0;
    // stars: only where the sky is dark, the dim ones go first
    float star = 0.0, vis = smoothstep(3.7, 1.7, skyT) * smoothstep(0.3, 1.6, hB);
    if (vis > 0.02) {
      star = max(starLayer(az, el, 0.9, 0.36, 3.0, 0.0) * 0.8, starLayer(az, el, 2.6, 0.5, 17.0, 1.0) * 1.25);
      star *= step(1.0 - vis, star + 0.25) * (0.5 + 0.5 * vis);
    }
    // white moon
    bool inW = dW < RW;
    if (inW) {
      vec2 q = vec2(dot(rd, uMwX), dot(rd, uMwY)) / sin(RW / DEG);
      vec4 mm = texture2D(uMoon, q * 0.5 + 0.5);
      tone = 9.0 - 0.60 * smoothstep(0.30, 0.46, mm.r) - 0.75 * smoothstep(0.56, 0.72, mm.r) + 0.5 * smoothstep(0.5, 0.8, mm.g);
      tone = max(tone, 8.0) - 0.45 * smoothstep(0.92, 1.0, length(q));
      tone -= 0.9 * smoothstep(2.8, 0.2, el);            // reddened and dimmed by the haze near the horizon
      gain = uMoonGain; sharp = 2.6; star = 0.0;
    }
    // cloud bands: dark violet above, lit from below on the moon side
    float rel = 0.0, band = 0.0;
    for (int k = 0; k < 5; k++) { float r; if (bandAt(az, el, k, r) > 0.5) { band = 1.0; rel = r; } }
    if (band > 0.5) {
      float under = smoothstep(-0.10, -0.55, rel);
      float dark = min(skyT - 1.2, 3.0 + 0.8 * side), lit = min(skyT + 0.4 + 1.4 * side, 9.0);
      tone = mix(dark, lit, under);
      if (inW) tone = mix(6.4, 8.7, under);
      gain = 1.0 + (gain - 1.0) * under; sharp = 3.0; star = 0.0;
    }
    col = rampDither(tone, sharp) * gain;
    if (star > 0.0) {
      float sq = floor(star * 3.0 + 0.5) / 3.0;
      col = max(col, mix(uRamp[NRAMP - 1 - 3 * int(RSUB)], uRamp[NRAMP - 1], clamp(sq, 0.0, 1.0)) * sq * uStarGain);
    }
    // black moon: corona first, then the disc over everything
    if (hB < 7.0) {
      vec2 q = vec2(dot(rd, uMbX), dot(rd, uMbY));
      float ang = atan(q.y, q.x), d = max(hB, 0.0);
      float stream = 0.0;
      for (int i = 0; i < 5; i++) {
        float fi = float(i), len = WL[i] * (0.9 + 0.1 * sin(uTime * 0.11 + fi * 2.1)), u = d / len;
        if (u < 1.0) {
          float a = WA[i] + 0.05 * sin(uTime * 0.07 + fi * 1.7) + WC[i] * d;
          float da = abs(mod(ang - a + 3.14159265, 6.2831853) - 3.14159265);
          float w = (WW[i] * (1.0 - u) + 0.006) * RB / (RB + d);
          stream = max(stream, WS[i] * pow(1.0 - u, 1.3) * smoothstep(w, w * 0.2, da));
        }
      }
      float lop = 0.5 + 0.5 * cos(ang - 3.6);                      // the rim is fuller on the side of the white moon
      float I = (0.42 + 0.20 * lop) * exp(-d / 0.26) + 0.07 * exp(-d / 1.1) + stream;
      float arc = textureLod(uNoise, vec2(ang / 6.2831853 * 2.0 + uTime * 0.002, 0.71), 0.0).b;
      if (abs(d - 1.0) < 0.55 * cellDeg && arc > 0.56) I += 0.13;    // a hairline echo of the rim, in broken arcs
      float Iq = floor(min(I, 1.0) * 4.0 + 0.5 + (bayer() - 0.5) * 0.6) / 4.0;
      col += vec3(0.44, 0.28, 0.46) * Iq * 0.9;
      float rimW = cellDeg * (1.15 + 1.1 * lop);
      if (d < rimW) col = mix(vec3(0.56, 0.36, 0.54), vec3(0.70, 0.52, 0.66), step(d, rimW * 0.45) * lop) * uCoronaGain;
      if (hB < 0.0) col = vec3(0.0);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <encodings_fragment>
}`;

  const MOUNT_VS = /* glsl */`
attribute float aLayer;
varying float vLayer;
void main() {
  vLayer = aLayer;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

  function mountFS(ranges) {
    const arr = f => LAYERS.map((L, i) => fl(f(L, i))).join(', ');
    return /* glsl */`
uniform sampler2D uMap0; uniform sampler2D uMap1; uniform sampler2D uMap2;
uniform float uMountLight;
varying float vLayer;
const vec2 CEN = vec2(${fl(CEN_X)}, ${fl(CEN_Z)});
const float LR[3] = float[3](${arr(L => L.R)});
const float LY0[3] = float[3](${arr((L, i) => ranges[i].y0)});
const float LY1[3] = float[3](${arr((L, i) => ranges[i].y1)});
const float LBASE[3] = float[3](2.8, 2.2, 1.45);      // tone of the unlit rock, far -> near
const float LDEPTH[3] = float[3](0.7, 1.0, 1.5);       // ridges deeper inside a range are lighter
const float LLIT[3] = float[3](0.8, 1.3, 2.2);         // moon-side light on facets
const float LSNOW[3] = float[3](0.7, 1.1, 1.9);
const float LHAZE[3] = float[3](0.50, 0.30, 0.10);     // how far each layer has sunk into the sky colour
void main() {
  vec3 rd = cellRay();
  vec3 ro = cameraPosition;
  int k = int(vLayer + 0.5);
  float R = LR[k];
  vec2 o = ro.xz - CEN;
  float a = max(dot(rd.xz, rd.xz), 1e-6), b = dot(o, rd.xz), c = dot(o, o) - R * R;
  vec3 p = ro + rd * ((-b + sqrt(max(b * b - a * c, 0.0))) / a);
  float v = (p.y - LY0[k]) / (LY1[k] - LY0[k]);
  if (v > 0.998) discard;
  if (p.y < YT && p.y < YB + HH * hmap(p.xz)) discard;      // the foot of the range is sunk in the cloud sea
  float th = atan(p.x - CEN.x, -(p.z - CEN.y));
  vec2 uv = vec2(th * DEG / ${fl(TILE_DEG)} + 0.5, clamp(v, 0.003, 0.997));
  vec4 m = k == 0 ? textureLod(uMap0, uv, 0.0) : (k == 1 ? textureLod(uMap1, uv, 0.0) : textureLod(uMap2, uv, 0.0));
  if (m.a < 0.5) discard;
  float el = asin(clamp(rd.y, -1.0, 1.0)) * DEG, az = atan(rd.x, -rd.z) * DEG;
  float daz = azd(az, AZW), side = exp(-daz * daz / (55.0 * 55.0));
  float sky = skyTone(az, el) + 0.45 * whiteHalo(rd);
  float lit = m.r * LLIT[k] * (0.30 + 0.70 * side) * uMountLight;
  float tone = LBASE[k] + LDEPTH[k] * m.b + lit;
  tone += m.g * LSNOW[k] * (0.45 + 0.55 * m.r) * (0.5 + 0.5 * side);
  // haze: each layer and each deeper ridge sinks toward the sky colour; mist gathers above the cloud sea
  vec4 nq = textureLod(uNoise, vec2(th * 1.9 + uTime * 0.0006, p.y * 0.012 + float(k) * 0.37), 0.0);
  float nz = 0.55 * nq.g + 0.45 * nq.a;
  tone = mix(tone, sky, clamp(LHAZE[k] + 0.22 * m.b, 0.0, 1.0));
  float mist = smoothstep(YT + 9.0, YT - 4.0, p.y + (nz - 0.5) * 10.0);
  float hz = 0.55 * mist;
  tone = mix(tone, mix(3.4 + 0.5 * side, skyTone(az, 0.0), seaFade(R)), hz);      // the mist has the colour of the cloud sea at that distance
  gl_FragColor = vec4(rampDither(tone, 2.4 - 1.2 * max(hz, LHAZE[k])), 1.0);
  #include <encodings_fragment>
}`;
  }

  const CLOUD_VS = /* glsl */`
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

  function cloudFS(steps) {
    return /* glsl */`
#define MAXS ${steps}
uniform float uMoonGain; uniform float uCloudLight;
void main() {
  vec3 rd = cellRay();
  vec3 ro = cameraPosition;
  float az = atan(rd.x, -rd.z) * DEG;
  float hor = skyTone(az, 0.0);
  float ry = min(rd.y, -1e-3);
  float t0 = max((YT - ro.y) / ry, 0.0), t1 = max((YB - ro.y) / ry, 0.0);
  float fade = seaFade(t0);
  float tone = hor, sharp = 1.0, gain = 1.0;
  vec3 hit = ro + rd * t0;
  if (fade < 0.995) {
    float len = t1 - t0;
    float fn = clamp(ceil(len * length(rd.xz) / 2.6), 5.0, float(MAXS));
    float dt = len / fn, ta = t0, tb = t1;
    for (int i = 1; i <= MAXS; i++) {
      float t = t0 + dt * float(i);
      vec3 p = ro + rd * t;
      if (p.y < YB + HH * hmap(p.xz)) { tb = t; break; }
      ta = t;
      if (float(i) >= fn) break;
    }
    for (int i = 0; i < 4; i++) {
      float tm = 0.5 * (ta + tb);
      vec3 p = ro + rd * tm;
      if (p.y < YB + HH * hmap(p.xz)) tb = tm; else ta = tm;
    }
    hit = ro + rd * tb;
    float h = hmap(hit.xz);
    const float e = 1.2;
    vec3 n = normalize(vec3((h - hmap(hit.xz + vec2(e, 0.0))) * HH * 1.5, e, (h - hmap(hit.xz + vec2(0.0, e))) * HH * 1.5));
    float det = textureLod(uNoise, (hit.xz + uTime * uWind * 1.7) / 57.0, 0.0).a;
    float hh = clamp(h + (det - 0.5) * 0.10, 0.0, 1.0);
    vec3 L = normalize(vec3(uMw.x, 0.55, uMw.z));
    // three flat steps like a painted cloud: faces turned to the camera in shade, tops in half light, the slopes and
    // rims turned to the moon lit
    float ndl = dot(n, L) + (det - 0.5) * 0.22;
    float mid = smoothstep(0.14, 0.36, ndl), top = smoothstep(0.52, 0.66, ndl);
    float daz = azd(az, AZW);
    float side = exp(-daz * daz / (35.0 * 35.0));
    float graz = smoothstep(0.55, 0.14, -rd.y);
    float path = exp(-daz * daz / (8.0 * 8.0)) * graz * mix(0.4, 1.0, smoothstep(90.0, 300.0, tb));
    tone = mix(1.3, 2.7, smoothstep(0.12, 0.85, hh));
    tone += uCloudLight * (mid * (0.7 + 0.4 * side + 2.0 * path) + top * (0.5 + 0.8 * side + 2.2 * path));
    tone = min(tone, 9.0);
    fade = seaFade(tb);
    gain = 1.0 + (uMoonGain - 1.0) * 0.6 * smoothstep(7.6, 9.0, tone) * (1.0 - fade);
    tone = mix(tone, hor, fade);
    sharp = 3.2 - 2.0 * fade;
  }
  gl_FragColor = vec4(rampDither(tone, sharp) * gain, 1.0);
  vec4 clip = projectionMatrix * (viewMatrix * vec4(hit, 1.0));
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  #include <encodings_fragment>
}`;
  }

  // ---- public ----------------------------------------------------------------------------------------------------
  HD.Sky = {
    // opts: texel (sky pixel size in screen px at 1080p, default 2.5), rampSub (1 = the ten ramp colours only,
    //       2 = one blended step between each pair, default 2), moonGain (HDR brightness of the white moon, default
    //       1.35), coronaGain (default 2.0), starGain (default 1.3), cloudSteps (ray-march steps at grazing angles,
    //       default 20), wind [x, z] in units per second (default [0.85, 0.3]).
    create(opts) {
      opts = opts || {};
      const texel = opts.texel || 2.5, rsub = opts.rampSub || 2, nramp = 9 * rsub + 1;
      const whiteMoonDir = dirAzEl(AZ_W, EL_W), blackMoonDir = dirAzEl(AZ_B, EL_B);
      const up = new THREE.Vector3(0, 1, 0);
      const frame = m => { const x = new THREE.Vector3().crossVectors(m, up).normalize(); return [x, new THREE.Vector3().crossVectors(x, m).normalize()]; };
      const fw = frame(whiteMoonDir), fb = frame(blackMoonDir);
      const base = HD.P.sky.map(HD.P.rgb).map(c => new THREE.Vector3(s2l(c[0]), s2l(c[1]), s2l(c[2])));
      const ramp = [];
      for (let i = 0; i < nramp; i++) { const t = i / rsub, a = Math.floor(t), b = Math.min(a + 1, 9); ramp.push(base[a].clone().lerp(base[b], t - a)); }
      const noise = buildNoise(), cloudH = buildCloudHeight(), moonMap = buildMoonMap(), ranges = LAYERS.map(buildRange);

      // shared uniform objects: one update serves all three materials
      const U = {
        uVP: { value: new THREE.Vector4(0, 0, 1920, 1080) }, uPx: { value: 3 }, uTime: { value: 0 },
        uRamp: { value: ramp }, uMw: { value: whiteMoonDir }, uMb: { value: blackMoonDir }, uNoise: { value: noise }, uCloud: { value: cloudH },
        uMoonGain: { value: opts.moonGain || 1.35 }, uCoronaGain: { value: opts.coronaGain || 2.0 }, uStarGain: { value: opts.starGain || 1.3 },
        uCloudLight: { value: 1 }, uMountLight: { value: 1 },
        uWind: { value: new THREE.Vector2().fromArray(opts.wind || [0.85, 0.3]) },
      };
      const common = commonGLSL(nramp, rsub);
      const mat = (vs, fs, extra, o) => new THREE.ShaderMaterial(Object.assign({
        uniforms: Object.assign({}, U, extra), vertexShader: vs, fragmentShader: common + fs,
        fog: false, lights: false, toneMapped: false, transparent: false,
      }, o));

      const group = new THREE.Group(); group.name = 'sky';
      const vp = new THREE.Vector4();
      const hook = function (renderer) {            // the pixel grid follows the actual render target
        renderer.getCurrentViewport(vp);
        U.uVP.value.copy(vp);
        U.uPx.value = Math.max(1, Math.round(texel * vp.w / 1080));
      };
      const add = (mesh, order) => {
        mesh.renderOrder = order; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
        mesh.matrixAutoUpdate = false; mesh.onBeforeRender = hook; group.add(mesh); return mesh;
      };

      // dome
      const dome = add(new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), mat(DOME_VS, DOME_FS, {
        uMoon: { value: moonMap }, uMwX: { value: fw[0] }, uMwY: { value: fw[1] }, uMbX: { value: fb[0] }, uMbY: { value: fb[1] },
      }, { side: THREE.BackSide, depthTest: false, depthWrite: false })), -1000);
      dome.name = 'sky-dome';

      // mountains: three open cylinders in one geometry, far to near
      const SEG = 64, pos = [], lay = [], idx = [];
      LAYERS.forEach((L, k) => {
        const b = pos.length / 3;
        for (let i = 0; i <= SEG; i++) {
          const a = i / SEG * Math.PI * 2, x = CEN_X + Math.sin(a) * L.R * 1.004, z = CEN_Z - Math.cos(a) * L.R * 1.004;
          pos.push(x, ranges[k].y0, z, x, ranges[k].y1, z); lay.push(k, k);
        }
        for (let i = 0; i < SEG; i++) { const p = b + i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
      });
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      mg.setAttribute('aLayer', new THREE.Float32BufferAttribute(lay, 1));
      mg.setIndex(idx);
      const mountains = add(new THREE.Mesh(mg, mat(MOUNT_VS, mountFS(ranges), {
        uMap0: { value: ranges[0].tex }, uMap1: { value: ranges[1].tex }, uMap2: { value: ranges[2].tex },
      }, { side: THREE.DoubleSide })), -900);
      mountains.name = 'sky-mountains';

      // cloud sea: disc at the top of the slab
      const cg = new THREE.CircleGeometry(585, 48); cg.rotateX(-Math.PI / 2); cg.translate(CEN_X, CLOUD_Y + CLOUD_H / 2, CEN_Z);
      const clouds = add(new THREE.Mesh(cg, mat(CLOUD_VS, cloudFS(opts.cloudSteps || 20), {}, { side: THREE.DoubleSide })), -800);
      clouds.name = 'sky-clouds';

      return {
        group, whiteMoonDir, blackMoonDir, uniforms: U, dome, mountains, clouds,
        update(time, camera) {
          U.uTime.value = time;
          if (camera) { dome.position.copy(camera.position); dome.updateMatrix(); }
        },
        dispose() {
          noise.dispose(); cloudH.dispose(); moonMap.dispose(); ranges.forEach(r => r.tex.dispose());
          [dome, mountains, clouds].forEach(m => { m.geometry.dispose(); m.material.dispose(); });
        },
      };
    },
  };
})();
