// HD-2D post-processing: scene -> HDR target (MSAA + depth texture) -> AO -> tilt-shift depth of field -> bloom ->
// grade -> sRGB canvas. No EffectComposer: every pass is a full-screen triangle with a RawShaderMaterial (GLSL ES 3.00).
//
//   const post = HD.Post.create(renderer, width, height);      // backing-store pixels
//   post.render(scene, camera, { focus: 36.5, time: t });       // focus = view distance to the hero, world units
//   post.params.dof.maxFar = 0.012;                             // every number is read each frame
//   post.setSize(w, h);  post.dispose();
//   post.params.split = 0.5;  post.params.debug = 1;            // comparison / debug views (see params below)
//   HD.Post.create(renderer, w, h, { samples: 0, forceLDR: true })   // optional: MSAA samples (default 4), 8-bit path
//   post.info -> { hdr, samples, width, height, bloomLevels }
//
// The renderer keeps outputEncoding = LinearEncoding and antialias: false. Scene materials render linear into the
// target (three always uses linear output for a render target); the last shader converts to sRGB. Perspective cameras only.
//
// Pass list (cost in full-screen equivalents: about 2.7 in total besides the scene itself):
//   scene        full   MSAA x4, HalfFloat (or sRGB8 when float targets are missing), DepthTexture
//   ao           1/2    depth only, 10 taps, normals rebuilt from depth; r = ao, gb = packed linear depth
//   aoBlur       1/2    4x4 depth-aware box
//   dofPre       1/2    colour (x AO) + signed circle of confusion in alpha; never mixes sharp and blurred pixels
//   nearMax/Dil  1/8    largest near-field CoC around each pixel (how far a blurred foreground may spread)
//   dofGather    1/2    soft disc, scatter-as-gather (5x5 grid for small discs, 1+42 ring taps for large); two outputs
//                       (MRT): far layer and near layer, premultiplied; pixels in the sharp band exit after 2 fetches
//   dofFill      1/2    3x3 tent on both layers (hides the tap pattern)
//   bloom        1/4 .. 1/128 down (13 tap), back up (9-tap tent, lerp by radius), last step to 1/2
//   composite    full   AO, far/near DoF blend, bloom, grade, sRGB, grain, dither
(function () {
  'use strict';
  const HD = (window.HD = window.HD || {});
  const T = THREE;
  const Post = (HD.Post = {});

  // ------------------------------------------------------------------------------------------------ shader text
  const VERT = 'in vec3 position; out vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const HEAD = 'precision highp float; precision highp int; precision highp sampler2D;\n';
  const G_DEPTH = `
uniform vec2 uNF;                       // camera near, far
float linZ(float d){ return uNF.x * uNF.y / (uNF.y - d * (uNF.y - uNF.x)); }
vec2 packZ(float z){ float v = clamp(z / uNF.y, 0.0, 1.0) * 65535.0; float hi = floor(v / 256.0); return vec2(hi, v - hi * 256.0) / 255.0; }
float unpackZ(vec2 p){ return (p.x * 65280.0 + p.y * 255.0) / 65535.0 * uNF.y; }
`;
  const G_COC = `
uniform vec4 uDof;                      // focus, focusRange, 1/nearRange, 1/farRange
uniform vec3 uCocPx;                    // max near radius, max far radius, max of both (full-res pixels)
// linear ramps; the soft onset comes from the blend in the composite (nothing changes below half a pixel of blur)
float farCoc(float z){ return uCocPx.y * clamp((z - uDof.x - uDof.y) * uDof.w, 0.0, 1.0); }
float nearCoc(float z){ return uCocPx.x * clamp((uDof.x - uDof.y - z) * uDof.z, 0.0, 1.0); }
`;
  // AO darkens less where the pixel is already bright (lamps, lit glass), and leans the darkening to violet.
  const G_AOMUL = `
uniform float uAoStrength;
vec3 aoMul(float ao, vec3 c){
  float prot = 1.0 - smoothstep(0.55, 1.6, max(c.r, max(c.g, c.b)));
  return 1.0 - (1.0 - ao) * uAoStrength * prot * vec3(1.0, 1.0, 0.86);
}
`;

  // ---- ambient occlusion (half res) -------------------------------------------------------------------------
  const AO_TAPS = 10;
  const FRAG_AO = HEAD + G_DEPTH + `
uniform sampler2D tDepth;
uniform vec2 uFull;                     // full-res size
uniform vec4 uProj;                     // 1/P00, 1/P11, P20, P21
uniform vec3 uAo;                       // radius (world), world->full-res px scale at z = 1, fade distance
out vec4 o;
float fetchZ(ivec2 p){ return linZ(texelFetch(tDepth, clamp(p, ivec2(0), ivec2(uFull) - 1), 0).x); }
const int BAYER[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
vec3 vpos(vec2 pix, float z){ return vec3((pix / uFull * 2.0 - 1.0 + uProj.zw) * uProj.xy * z, -z); }
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy) * 2;
  float zc = fetchZ(ip);
  float rpx = min(uAo.x * uAo.y / zc, uFull.y * 0.14);
  float fade = (1.0 - smoothstep(uAo.z * 0.6, uAo.z, zc)) * smoothstep(1.5, 4.0, rpx);
  float occ = 0.0;
  if (fade > 0.0) {
    vec2 pc = vec2(ip) + 0.5;
    vec3 P = vpos(pc, zc);
    // normal from depth, taking on each axis the neighbour that is on the same surface (smaller depth step)
    float zl = fetchZ(ip + ivec2(-1, 0)), zr = fetchZ(ip + ivec2(1, 0)), zd = fetchZ(ip + ivec2(0, -1)), zu = fetchZ(ip + ivec2(0, 1));
    vec3 dx = abs(zr - zc) < abs(zc - zl) ? vpos(pc + vec2(1.0, 0.0), zr) - P : P - vpos(pc - vec2(1.0, 0.0), zl);
    vec3 dy = abs(zu - zc) < abs(zc - zd) ? vpos(pc + vec2(0.0, 1.0), zu) - P : P - vpos(pc - vec2(0.0, 1.0), zd);
    vec3 n = normalize(cross(dx, dy));
    ivec2 bp = ivec2(gl_FragCoord.xy) & 3;                  // 4x4 ordered angles: the 4x4 blur sees each of the 16 once
    float phi = (float(BAYER[bp.y * 4 + bp.x]) + 0.5) * (6.2831853 / 16.0);
    float r2 = uAo.x * uAo.x, bias = 0.03 * uAo.x + 0.0012 * zc, sum = 0.0;
    for (int i = 0; i < ${AO_TAPS}; i++) {
      float a = (float(i) + 0.5) / ${AO_TAPS}.0;
      float ang = a * 43.9823 + phi;                       // 7 turns
      ivec2 si = clamp(ivec2(floor(pc + vec2(cos(ang), sin(ang)) * (a * rpx))), ivec2(0), ivec2(uFull) - 1);
      float zs = linZ(texelFetch(tDepth, si, 0).x);
      vec3 v = vpos(vec2(si) + 0.5, zs) - P;
      float vv = dot(v, v), f = max(1.0 - vv / r2, 0.0);   // range falloff: no halo from things far in front
      sum += f * max(dot(v, n) - bias, 0.0) * inversesqrt(vv + 1e-4);
    }
    occ = clamp(sum * (7.0 / ${AO_TAPS}.0), 0.0, 1.0) * fade;
  }
  o = vec4(1.0 - occ, packZ(zc), 1.0);
}`;
  const FRAG_AOBLUR = HEAD + G_DEPTH + `
uniform sampler2D tAO;
out vec4 o;
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy), mx = textureSize(tAO, 0) - 1;
  vec4 c = texelFetch(tAO, ip, 0);
  float zc = unpackZ(c.gb), tol = 1.0 / (0.12 + 0.012 * zc), acc = 0.0, wsum = 0.0;
  for (int y = -2; y <= 1; y++) for (int x = -2; x <= 1; x++) {
    vec4 s = texelFetch(tAO, clamp(ip + ivec2(x, y), ivec2(0), mx), 0);
    float w = max(1.0 - abs(unpackZ(s.gb) - zc) * tol, 0.0);
    acc += s.r * w; wsum += w;
  }
  o = vec4(wsum > 1e-4 ? acc / wsum : c.r, c.gb, 1.0);
}`;

  // ---- depth of field ----------------------------------------------------------------------------------------
  // Signed CoC is stored in alpha as (c / max * 127 + 128) / 255 so that 0 survives an 8-bit target exactly.
  const FRAG_DOFPRE = HEAD + G_DEPTH + G_COC + G_AOMUL + `
uniform sampler2D tScene, tDepth, tAO;
uniform vec2 uFull;
out vec4 o;
ivec2 mx;
float D(ivec2 p){ return texelFetch(tDepth, clamp(p, ivec2(0), mx), 0).x; }
// far CoC of a pixel is taken from the nearest depth among it and its 4 neighbours: a pixel that touches something
// sharper counts as sharp. MSAA edge pixels (mixed colour, one sample's depth) therefore never enter the far blur.
float sgn(float d, float a, float b, float c, float e){
  float f = farCoc(linZ(min(d, min(min(a, b), min(c, e)))));
  return f > 0.0 ? f : -nearCoc(linZ(d));
}
void main(){
  mx = ivec2(uFull) - 1;
  ivec2 b = ivec2(gl_FragCoord.xy) * 2;
  float d00 = D(b), d10 = D(b + ivec2(1, 0)), d01 = D(b + ivec2(0, 1)), d11 = D(b + ivec2(1, 1));
  float c00 = sgn(d00, d10, d01, D(b + ivec2(-1, 0)), D(b + ivec2(0, -1)));
  float c10 = sgn(d10, d00, d11, D(b + ivec2(2, 0)), D(b + ivec2(1, -1)));
  float c01 = sgn(d01, d00, d11, D(b + ivec2(-1, 1)), D(b + ivec2(0, 2)));
  float c11 = sgn(d11, d10, d01, D(b + ivec2(2, 1)), D(b + ivec2(1, 2)));
  float sel = c00;                                          // the most blurred of the four names the texel
  if (abs(c10) > abs(sel)) sel = c10;
  if (abs(c01) > abs(sel)) sel = c01;
  if (abs(c11) > abs(sel)) sel = c11;
  float tol = 1.0 / (0.25 * abs(sel) + 0.75);               // and only pixels blurred like it give it colour
  vec4 w = max(1.0 - abs(vec4(c00, c10, c01, c11) - sel) * tol, 0.0);
  vec3 col = (texelFetch(tScene, min(b, mx), 0).rgb * w.x + texelFetch(tScene, min(b + ivec2(1, 0), mx), 0).rgb * w.y +
              texelFetch(tScene, min(b + ivec2(0, 1), mx), 0).rgb * w.z + texelFetch(tScene, min(b + ivec2(1, 1), mx), 0).rgb * w.w) / (w.x + w.y + w.z + w.w);
  col = clamp(col, 0.0, 64.0);
  if (uAoStrength > 0.0) col *= aoMul(texelFetch(tAO, min(ivec2(gl_FragCoord.xy), textureSize(tAO, 0) - 1), 0).r, col);
  o = vec4(col, (sel / uCocPx.z * 127.0 + 128.0) / 255.0);
}`;
  const FRAG_NEARMAX = HEAD + `
uniform sampler2D tA;
out vec4 o;
void main(){
  ivec2 b = ivec2(gl_FragCoord.xy) * 4, mx = textureSize(tA, 0) - 1; float m = 1.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) m = min(m, texelFetch(tA, min(b + ivec2(x, y), mx), 0).a);
  o = vec4(clamp((128.0 - m * 255.0) / 127.0, 0.0, 1.0));
}`;
  const FRAG_NEARDIL = HEAD + `
uniform sampler2D tM; uniform int uN;
out vec4 o;
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy), mx = textureSize(tM, 0) - 1; float m = 0.0;
  for (int y = -3; y <= 3; y++) for (int x = -3; x <= 3; x++) {
    if (abs(x) > uN || abs(y) > uN) continue;
    m = max(m, texelFetch(tM, clamp(ip + ivec2(x, y), ivec2(0), mx), 0).r);
  }
  o = vec4(m);
}`;
  const RINGS = [7, 14, 21];
  const kernel = (function () {
    const k = []; const n = RINGS.length;
    for (let r = 0; r < n; r++) for (let i = 0; i < RINGS[r]; i++) {
      const a = (i + (r % 2 ? 0.5 : 0.0) + r * 0.21) / RINGS[r] * Math.PI * 2, l = (r + 1) / n;
      k.push('vec3(' + (Math.cos(a) * l).toFixed(5) + ',' + (Math.sin(a) * l).toFixed(5) + ',' + l.toFixed(5) + ')');
    }
    const outer = (n + 0.5) / n;                           // each tap stands for area pi R^2 * outer^2 / (taps + 1)
    return { n: k.length, text: 'const vec3 K[' + k.length + '] = vec3[' + k.length + '](' + k.join(',') + ');', invArea: (k.length + 1) / (outer * outer) };
  })();
  const FRAG_DOFGATHER = HEAD + `
uniform sampler2D tA, tDil;
uniform float uMaxR;                    // largest CoC radius in half-res pixels
in vec2 vUv;
layout(location = 0) out vec4 oFar;
layout(location = 1) out vec4 oNear;
${kernel.text}
const float SOFT = 0.35;
float far0, g0, cov;
vec4 fa, na, ba;
ivec2 ip, mx;
float dec(float a){ return (a * 255.0 - 128.0) / 127.0 * uMaxR; }
float disc(float r, float d){ return clamp(0.5 + (r - d) / (SOFT * r + 0.5), 0.0, 1.0); }   // soft-edged disc of radius r
float gate(float r){ return smoothstep(0.25, 1.5, r); }      // same onset as the far blend in the composite
vec4 A(ivec2 o){ return texelFetch(tA, clamp(ip + o, ivec2(0), mx), 0); }   // unfiltered: no colour mixing across depth edges
// far: a sample reaches this pixel if its own disc is large enough, and never further than this pixel's disc
// (a sharp or less blurred surface in front is not washed over by what lies behind it; sharp samples give nothing)
void tapF(vec4 s, float d, float w){ fa += vec4(s.rgb, 1.0) * (disc(max(min(dec(s.a), far0), 0.0), d) * w); }
// near: the energy of a foreground sample is spread over its disc (1 / r^2) and lands here if the disc reaches
void tapN(vec4 s, float d){
  float rs = max(-dec(s.a), 0.0), g = gate(rs);
  float nw = disc(rs, d) * step(0.2, rs) / max(rs * rs, 0.32);
  na += vec4(s.rgb, 1.0) * (nw * g);
  cov += nw;
  ba += vec4(s.rgb, 1.0) * (1.0 - g);                        // what lies behind the near layer, guessed from non-near neighbours
}
// near layer. c = fraction of this pixel's disc covered by foreground discs (0.5 on a straight silhouette, on both
// sides of it; 1 inside a continuous near surface). Under the layer lies the sharp source, or, where this pixel is
// foreground itself, the guessed background: the object really turns translucent at its rim instead of keeping a
// hard edge under the blur. G fades the whole thing in while the foreground discs are still under a pixel or so.
vec4 resolveN(float tapArea){                                // tapArea: area one tap stands for, / pi
  if (na.a <= 1e-7) return vec4(0.0);
  float c = clamp(1.1 * tapArea * cov, 0.0, 1.0), G = na.a / cov;
  vec3 nc = na.rgb / na.a, bg = ba.a > 1e-3 ? ba.rgb / ba.a : nc;
  return G * vec4(nc * c + bg * ((1.0 - c) * g0), c + (1.0 - c) * g0);
}
// Small discs use the 5x5 texel grid (each texel once, with its true distance), so the blur grows continuously from
// zero; larger discs use the ring kernel; in between the two are cross-faded. Far and near layers each use their own
// radius: the far one this pixel's CoC, the near one the largest foreground CoC around.
void main(){
  ip = ivec2(gl_FragCoord.xy); mx = textureSize(tA, 0) - 1;
  vec4 c0 = A(ivec2(0));
  float coc0 = dec(c0.a);
  far0 = max(coc0, 0.0); g0 = gate(max(-coc0, 0.0));
  float wf = clamp(far0 * 2.0 - 0.2, 0.0, 1.0);              // is this texel part of the far layer at all
  vec3 F = c0.rgb;
  if (far0 >= 0.3) {
    float m = smoothstep(1.75, 2.5, far0); vec3 f1 = vec3(0.0), f2 = vec3(0.0);
    if (m < 1.0) {
      fa = vec4(0.0);
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
        float d = length(vec2(x, y));
        tapF(A(ivec2(x, y)), d, 1.0 - 0.3 * min(d * d / (far0 * far0), 1.0));
      }
      f1 = fa.rgb / fa.a;
    }
    if (m > 0.0) {
      fa = vec4(0.0); tapF(c0, 0.0, 1.0);
      for (int i = 0; i < ${kernel.n}; i++) { vec3 k = K[i]; tapF(A(ivec2(floor(k.xy * far0 + 0.5))), k.z * far0, 1.0 - 0.3 * k.z * k.z); }
      f2 = fa.rgb / fa.a;
    }
    F = mix(f1, f2, m);
  }
  oFar = vec4(F * wf, wf);
  vec4 N = vec4(0.0);
  float R = texture(tDil, vUv).r * uMaxR * 1.04;
  if (R >= 0.3) {
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++)   // texels that touch foreground count as foreground,
      g0 = max(g0, gate(max(-dec(A(ivec2(x, y)).a), 0.0)));        // so no sharp foreground pixel survives the upsample
    float m = smoothstep(1.75, 2.5, R); vec4 n1 = vec4(0.0), n2 = vec4(0.0);
    if (m < 1.0) {
      na = ba = vec4(0.0); cov = 0.0;
      for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) tapN(A(ivec2(x, y)), length(vec2(x, y)));
      n1 = resolveN(0.3183);
    }
    if (m > 0.0) {
      na = ba = vec4(0.0); cov = 0.0; tapN(c0, 0.0);
      for (int i = 0; i < ${kernel.n}; i++) { vec3 k = K[i]; tapN(A(ivec2(floor(k.xy * R + 0.5))), k.z * R); }
      n2 = resolveN(R * R / ${kernel.invArea.toFixed(3)});
    }
    N = mix(n1, n2, m);
  }
  oNear = N;
}`;
  const FRAG_DOFFILL = HEAD + `
uniform sampler2D tF, tN; uniform vec2 uTexel;
in vec2 vUv;
layout(location = 0) out vec4 oFar;
layout(location = 1) out vec4 oNear;
void main(){
  vec4 t = uTexel.xyxy * vec4(0.5, 0.5, -0.5, 0.5);
  oFar = 0.25 * (texture(tF, vUv + t.xy) + texture(tF, vUv - t.xy) + texture(tF, vUv + t.zw) + texture(tF, vUv - t.zw));
  oNear = 0.25 * (texture(tN, vUv + t.xy) + texture(tN, vUv - t.xy) + texture(tN, vUv + t.zw) + texture(tN, vUv - t.zw));
}`;

  // ---- bloom ---------------------------------------------------------------------------------------------------
  const G_DOWN13 = `
uniform sampler2D tSrc; uniform vec2 uTexel;                // texel of the source
in vec2 vUv;
out vec4 o;
vec3 S(float x, float y){ return texture(tSrc, vUv + vec2(x, y) * uTexel).rgb; }
`;
  const FRAG_BLOOMPRE = HEAD + G_DOWN13 + `
uniform vec3 uThr;                      // threshold, knee (absolute), -
float kw(vec3 c){ return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
void main(){
  vec3 a = S(-2.0, -2.0), b = S(0.0, -2.0), c = S(2.0, -2.0), d = S(-2.0, 0.0), e = S(0.0, 0.0), f = S(2.0, 0.0), g = S(-2.0, 2.0), h = S(0.0, 2.0), i = S(2.0, 2.0);
  vec3 g0 = (S(-1.0, -1.0) + S(1.0, -1.0) + S(-1.0, 1.0) + S(1.0, 1.0)) * 0.25;
  vec3 g1 = (a + b + d + e) * 0.25, g2 = (b + c + e + f) * 0.25, g3 = (d + e + g + h) * 0.25, g4 = (e + f + h + i) * 0.25;
  float w0 = 0.5 * kw(g0), w1 = 0.125 * kw(g1), w2 = 0.125 * kw(g2), w3 = 0.125 * kw(g3), w4 = 0.125 * kw(g4);   // Karis: tame fireflies
  vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThr.x + uThr.y, 0.0, 2.0 * uThr.y);
  soft = soft * soft / (4.0 * uThr.y + 1e-4);
  o = vec4(min(col * (max(soft, br - uThr.x) / max(br, 1e-4)), 32.0), 1.0);
}`;
  const FRAG_BLOOMDOWN = HEAD + G_DOWN13 + `
void main(){
  vec3 a = S(-2.0, -2.0), b = S(0.0, -2.0), c = S(2.0, -2.0), d = S(-2.0, 0.0), e = S(0.0, 0.0), f = S(2.0, 0.0), g = S(-2.0, 2.0), h = S(0.0, 2.0), i = S(2.0, 2.0);
  vec3 col = (S(-1.0, -1.0) + S(1.0, -1.0) + S(-1.0, 1.0) + S(1.0, 1.0)) * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + e * 0.125;
  o = vec4(col, 1.0);
}`;
  const FRAG_BLOOMUP = HEAD + `
uniform sampler2D tLo, tHi; uniform vec2 uTexel;            // texel of tLo
uniform float uMix;                     // <0: tent of tLo only; else mix(tHi, tent(tLo), uMix)
in vec2 vUv;
out vec4 o;
void main(){
  vec4 t = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 s = texture(tLo, vUv).rgb * 4.0 +
    (texture(tLo, vUv - t.xw).rgb + texture(tLo, vUv + t.xw).rgb + texture(tLo, vUv - t.wy).rgb + texture(tLo, vUv + t.wy).rgb) * 2.0 +
    texture(tLo, vUv - t.xy).rgb + texture(tLo, vUv + t.xy).rgb + texture(tLo, vUv - t.zy).rgb + texture(tLo, vUv + t.zy).rgb;
  s *= 0.0625;
  o = vec4(uMix < 0.0 ? s : mix(texture(tHi, vUv).rgb, s, uMix), 1.0);
}`;

  // ---- composite + grade ---------------------------------------------------------------------------------------
  const FRAG_FINAL = HEAD + G_DEPTH + G_COC + G_AOMUL + `
uniform sampler2D tScene, tDepth, tAO, tFar, tNear, tBloom;
uniform vec2 uFull;
uniform float uDofOn, uBloom, uSplit;
uniform vec4 uGrade;                    // exposure, contrast, saturation, tintAmount
uniform vec3 uShadowTint, uLightTint;   // normalised to luma 1
uniform vec3 uVG;                       // vignette, grain, time
uniform int uDebug;
in vec2 vUv;
out vec4 o;
ivec2 mx;
float D(ivec2 p){ return texelFetch(tDepth, clamp(p, ivec2(0), mx), 0).x; }
uvec3 pcg3(uvec3 v){
  v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v;
}
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 shoulder(vec3 x){                  // identity below 0.8, then an exponential roll-off towards 1
  const float s = 0.8;
  return mix(x, s + (1.0 - s) * (1.0 - exp(-(x - s) / (1.0 - s))), step(vec3(s), x));
}
float scurve(float x, float k){          // fixed points 0, 0.5, 1; slope k at the pivot
  x = clamp(x, 0.0, 1.0);
  return x < 0.5 ? 0.5 * pow(2.0 * x, k) : 1.0 - 0.5 * pow(2.0 - 2.0 * x, k);
}
void main(){
  mx = ivec2(uFull) - 1;
  ivec2 ip = min(ivec2(vUv * uFull), mx);
  vec3 src = clamp(texelFetch(tScene, ip, 0).rgb, 0.0, 64.0);
  uvec3 rnd = pcg3(uvec3(uvec2(gl_FragCoord.xy), uint(floor(uVG.z * 24.0)) & 1023u));
  vec3 rn = vec3(rnd) / 4294967296.0;
  float dith = (rn.x + rn.y - 1.0) / 255.0;                 // triangular, +-1 LSB: kills banding in dark gradients
  if (uSplit > 0.0 && vUv.x < uSplit) {                     // compare: raw scene on the left
    o = vec4(toSRGB(src) * step(1.5 / uFull.x, uSplit - vUv.x) + dith, 1.0); return;
  }
  float d0 = D(ip), z = linZ(d0);
  vec3 col = src;
  float ao = 1.0;
  if (uAoStrength > 0.0) {                                  // depth-aware upsample of the half-res AO
    ivec2 hb = ip / 2, hm = textureSize(tAO, 0) - 1; vec2 f = vec2(ip - hb * 2) * 0.5;
    vec4 a00 = texelFetch(tAO, min(hb, hm), 0), a10 = texelFetch(tAO, min(hb + ivec2(1, 0), hm), 0), a01 = texelFetch(tAO, min(hb + ivec2(0, 1), hm), 0), a11 = texelFetch(tAO, min(hb + ivec2(1, 1), hm), 0);
    float tol = 1.0 / (0.12 + 0.012 * z);
    vec4 dz = (vec4(unpackZ(a00.gb), unpackZ(a10.gb), unpackZ(a01.gb), unpackZ(a11.gb)) - z) * tol;
    vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y) / (0.02 + dz * dz);
    ao = dot(w, vec4(a00.r, a10.r, a01.r, a11.r)) / (w.x + w.y + w.z + w.w);
    col *= aoMul(ao, col);
  }
  float fc = 0.0, nc = 0.0;
  if (uDofOn > 0.5) {
    float dm = min(d0, min(min(D(ip + ivec2(1, 0)), D(ip - ivec2(1, 0))), min(D(ip + ivec2(0, 1)), D(ip - ivec2(0, 1)))));
    fc = farCoc(linZ(dm)); nc = nearCoc(z);
    if (fc > 0.5) {
      vec4 F = texture(tFar, vUv);
      col = mix(col, F.rgb / max(F.a, 1e-4), smoothstep(0.5, 3.0, fc) * clamp(F.a * 6.0, 0.0, 1.0));
    }
    vec4 N = texture(tNear, vUv);
    if (N.a > 0.0) col = mix(col, N.rgb / N.a, smoothstep(0.5, 3.0, nc)) * (1.0 - N.a) + N.rgb;   // under the near layer: the source, unless it is foreground itself
  }
  vec3 bloom = uBloom > 0.0 ? texture(tBloom, vUv).rgb : vec3(0.0);
  col += bloom * uBloom;
  if (uDebug == 1) col = vec3(ao);
  else if (uDebug == 2) col = vec3(nc, fc, 0.0) / uCocPx.z;
  else if (uDebug == 3) col = vec3(fract(z * 0.25), z / 120.0, z / 600.0);
  else if (uDebug == 4) col = bloom * uBloom;
  // grade ---------------------------------------------------------------------------------------------------
  col *= uGrade.x;
  vec2 q = (vUv - vec2(0.5, 0.56)) * 2.0;                   // centre a little high: bottom corners fall off more
  col *= 1.0 - uVG.x * smoothstep(0.3, 2.3, dot(q, q));
  col = toSRGB(shoulder(col));
  if (uDebug == 0) {
    float l0 = dot(col, vec3(0.2126, 0.7152, 0.0722)), l = scurve(l0, 1.0 + uGrade.y);
    col *= l / max(l0, 1e-4);                               // contrast on luma only: it must not add saturation
    col = mix(vec3(l), col, uGrade.z);
    float t = smoothstep(0.04, 0.72, l);
    col = mix(col, col * mix(uShadowTint, uLightTint, t), uGrade.w);
    col += uShadowTint * (uGrade.w * 0.07 * (1.0 - t) * (1.0 - t));      // a breath of colour in the blacks
    col += (rn.z + rn.y - 1.0) * uVG.y * (0.35 + 2.2 * l * (1.0 - l));   // grain, strongest in the mid-tones
  }
  o = vec4(col + dith, 1.0);
}`;

  // ------------------------------------------------------------------------------------------------ create
  Post.create = function (renderer, width, height, opt) {
    opt = opt || {};
    const isGL2 = renderer.capabilities.isWebGL2;
    if (!isGL2) console.warn('HD.Post: WebGL2 is required.');
    const hdr = !opt.forceLDR && isGL2 && !!(renderer.extensions.get('EXT_color_buffer_float') || renderer.extensions.get('EXT_color_buffer_half_float'));
    const samples = Math.min(opt.samples != null ? opt.samples : 4, renderer.capabilities.maxSamples || 0);

    const params = {
      dof: { enabled: true, focusRange: 5.0, nearRange: 10, farRange: 40, maxNear: 0.012, maxFar: 0.009 },
      bloom: { enabled: true, threshold: 0.85, knee: 0.5, strength: 0.55, radius: 0.65 },
      ao: { enabled: true, strength: 0.5, radius: 1.3 },
      grade: { exposure: 1.0, contrast: 0.14, saturation: 0.80, shadowTint: [0.60, 0.55, 0.84], lightTint: [1.0, 0.93, 0.80], tintAmount: 0.14, vignette: 0.38, grain: 0.025 },
      split: 0,          // 0 = off; 0..1 = screen fraction at the left shown without post (comparison)
      debug: 0,          // 1 AO, 2 CoC (r near, g far), 3 depth, 4 bloom only
    };

    // ---- targets ----------------------------------------------------------------------------------------
    // Colour targets hold linear light. Without float targets they are sRGB8 (the GPU converts on write and read),
    // which keeps dark gradients smooth in 8 bits; values above 1 are then lost.
    const colType = hdr ? T.HalfFloatType : T.UnsignedByteType;
    function colour(tex) { tex.encoding = hdr ? T.LinearEncoding : T.sRGBEncoding; tex.generateMipmaps = false; return tex; }
    function mkColour(filter) {
      const rt = new T.WebGLRenderTarget(1, 1, { type: colType, format: T.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: false, stencilBuffer: false });
      colour(rt.texture); return rt;
    }
    function mkData() {
      const rt = new T.WebGLRenderTarget(1, 1, { type: T.UnsignedByteType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false, stencilBuffer: false });
      rt.texture.generateMipmaps = false; return rt;
    }
    function mkPair() {
      const rt = new T.WebGLMultipleRenderTargets(1, 1, 2, { type: colType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false, stencilBuffer: false });
      colour(rt.texture[0]); colour(rt.texture[1]); return rt;
    }
    const depthTex = new T.DepthTexture(1, 1, T.UnsignedIntType);
    depthTex.minFilter = depthTex.magFilter = T.NearestFilter;
    const sceneRT = new T.WebGLRenderTarget(1, 1, { type: colType, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false, samples: samples, depthTexture: depthTex });
    colour(sceneRT.texture);
    const aoRT = mkData(), aoBlurRT = mkData(), nearMaxRT = mkData(), nearDilRT = mkData();
    nearDilRT.texture.minFilter = nearDilRT.texture.magFilter = T.LinearFilter;
    const preRT = mkColour(T.LinearFilter), gatherRT = mkPair(), fillRT = mkPair(), bloomRT = mkColour(T.LinearFilter);
    const MAXLV = 6;
    const down = [], up = [];
    for (let i = 0; i < MAXLV; i++) { down.push(mkColour(T.LinearFilter)); up.push(mkColour(T.LinearFilter)); }
    let W = 0, H = 0, hw = 0, hh = 0, levels = 0;

    // ---- materials ----------------------------------------------------------------------------------------
    const mats = [];
    function mat(frag, uniforms) {
      const m = new T.RawShaderMaterial({ glslVersion: T.GLSL3, vertexShader: VERT, fragmentShader: frag, uniforms: uniforms, depthTest: false, depthWrite: false, blending: T.NoBlending, toneMapped: false, fog: false });
      mats.push(m); return m;
    }
    const U = v => ({ value: v });
    const uNF = U(new T.Vector2(1, 600)), uFull = U(new T.Vector2(1, 1)), uDof = U(new T.Vector4()), uCocPx = U(new T.Vector3()), uAoStrength = U(0);
    const mAO = mat(FRAG_AO, { tDepth: U(depthTex), uNF, uFull, uProj: U(new T.Vector4()), uAo: U(new T.Vector3()) });
    const mAOBlur = mat(FRAG_AOBLUR, { tAO: U(aoRT.texture), uNF });
    const mPre = mat(FRAG_DOFPRE, { tScene: U(sceneRT.texture), tDepth: U(depthTex), tAO: U(aoBlurRT.texture), uNF, uFull, uDof, uCocPx, uAoStrength });
    const mNearMax = mat(FRAG_NEARMAX, { tA: U(preRT.texture) });
    const mNearDil = mat(FRAG_NEARDIL, { tM: U(nearMaxRT.texture), uN: U(2) });
    const mGather = mat(FRAG_DOFGATHER, { tA: U(preRT.texture), tDil: U(nearDilRT.texture), uMaxR: U(1) });
    const mFill = mat(FRAG_DOFFILL, { tF: U(gatherRT.texture[0]), tN: U(gatherRT.texture[1]), uTexel: U(new T.Vector2()) });
    const mBloomPre = mat(FRAG_BLOOMPRE, { tSrc: U(preRT.texture), uTexel: U(new T.Vector2()), uThr: U(new T.Vector3()) });
    const mBloomDown = mat(FRAG_BLOOMDOWN, { tSrc: U(null), uTexel: U(new T.Vector2()) });
    const mBloomUp = mat(FRAG_BLOOMUP, { tLo: U(null), tHi: U(null), uTexel: U(new T.Vector2()), uMix: U(0) });
    const mFinal = mat(FRAG_FINAL, { tScene: U(sceneRT.texture), tDepth: U(depthTex), tAO: U(aoBlurRT.texture), tFar: U(fillRT.texture[0]), tNear: U(fillRT.texture[1]), tBloom: U(bloomRT.texture),
      uNF, uFull, uDof, uCocPx, uAoStrength, uDofOn: U(0), uBloom: U(0), uSplit: U(0), uGrade: U(new T.Vector4()), uShadowTint: U(new T.Vector3()), uLightTint: U(new T.Vector3()), uVG: U(new T.Vector3()), uDebug: U(0) });

    const tri = new T.BufferGeometry();
    tri.setAttribute('position', new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new T.Mesh(tri, mFinal); mesh.frustumCulled = false;
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    function pass(m, target) { mesh.material = m; renderer.setRenderTarget(target); renderer.render(mesh, cam); }

    function setSize(w, h) {
      w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      if (w === W && h === H) return;
      W = w; H = h; hw = Math.ceil(w / 2); hh = Math.ceil(h / 2);
      sceneRT.setSize(w, h);
      aoRT.setSize(hw, hh); aoBlurRT.setSize(hw, hh); preRT.setSize(hw, hh); gatherRT.setSize(hw, hh); fillRT.setSize(hw, hh); bloomRT.setSize(hw, hh);
      const ew = Math.ceil(hw / 4), eh = Math.ceil(hh / 4);
      nearMaxRT.setSize(ew, eh); nearDilRT.setSize(ew, eh);
      let lw = hw, lh = hh; levels = 0;
      for (let i = 0; i < MAXLV; i++) {
        lw = Math.ceil(lw / 2); lh = Math.ceil(lh / 2);
        if (i >= 2 && Math.min(lw, lh) < 4) { down[i].setSize(1, 1); up[i].setSize(1, 1); continue; }
        down[i].setSize(lw, lh); up[i].setSize(lw, lh); levels = i + 1;
      }
      uFull.value.set(w, h);
      mFill.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    }
    setSize(width, height);

    const tintTmp = [0, 0, 0];
    function setTint(u, a) {             // normalise to luma 1 so that tinting does not change brightness
      const r = a[0], g = a[1], b = a[2], l = Math.max(0.2126 * r + 0.7152 * g + 0.0722 * b, 1e-3);
      u.value.set(r / l, g / l, b / l);
    }

    function render(scene, camera, o) {
      const p = params, focus = o && o.focus != null ? o.focus : 36.5, time = o && o.time != null ? o.time : 0;
      const prevRT = renderer.getRenderTarget(), prevAuto = renderer.autoClear;
      // 1. the scene, linear, into the multisampled HDR target (three resolves colour and depth when the render ends)
      renderer.autoClear = true;
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      renderer.autoClear = false;

      const pe = camera.projectionMatrix.elements;
      uNF.value.set(camera.near, camera.far);
      const dofOn = !!p.dof.enabled && (p.dof.maxNear > 0 || p.dof.maxFar > 0), bloomOn = !!p.bloom.enabled && p.bloom.strength > 0, aoOn = !!p.ao.enabled && p.ao.strength > 0;
      const nearPx = Math.max(p.dof.maxNear, 0) * H, farPx = Math.max(p.dof.maxFar, 0) * H, maxPx = Math.max(nearPx, farPx, 1e-3);
      uDof.value.set(focus, Math.max(p.dof.focusRange, 0), 1 / Math.max(p.dof.nearRange, 1e-3), 1 / Math.max(p.dof.farRange, 1e-3));
      uCocPx.value.set(nearPx, farPx, maxPx);
      uAoStrength.value = aoOn ? p.ao.strength : 0;

      if (aoOn) {
        mAO.uniforms.uProj.value.set(1 / pe[0], 1 / pe[5], pe[8], pe[9]);
        mAO.uniforms.uAo.value.set(p.ao.radius, pe[5] * H * 0.5, 170);
        pass(mAO, aoRT);
        pass(mAOBlur, aoBlurRT);
      }
      if (dofOn || bloomOn) pass(mPre, preRT);
      if (dofOn) {
        mNearDil.uniforms.uN.value = Math.min(3, Math.max(1, Math.ceil(nearPx / 8)));
        mGather.uniforms.uMaxR.value = maxPx * 0.5;
        pass(mNearMax, nearMaxRT);
        pass(mNearDil, nearDilRT);
        pass(mGather, gatherRT);
        pass(mFill, fillRT);
      }
      if (bloomOn) {
        const thr = Math.max(p.bloom.threshold, 0);
        mBloomPre.uniforms.uThr.value.set(thr, Math.max(thr * p.bloom.knee, 1e-4), 0);
        mBloomPre.uniforms.uTexel.value.set(1 / hw, 1 / hh);
        pass(mBloomPre, down[0]);
        for (let i = 1; i < levels; i++) {
          mBloomDown.uniforms.tSrc.value = down[i - 1].texture;
          mBloomDown.uniforms.uTexel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height);
          pass(mBloomDown, down[i]);
        }
        const mu = mBloomUp.uniforms; let lo = down[levels - 1];
        mu.uMix.value = Math.min(Math.max(p.bloom.radius, 0), 1);
        for (let i = levels - 2; i >= 0; i--) {
          mu.tLo.value = lo.texture; mu.tHi.value = down[i].texture; mu.uTexel.value.set(1 / lo.width, 1 / lo.height);
          pass(mBloomUp, up[i]); lo = up[i];
        }
        mu.tLo.value = lo.texture; mu.tHi.value = lo.texture; mu.uTexel.value.set(1 / lo.width, 1 / lo.height); mu.uMix.value = -1;
        pass(mBloomUp, bloomRT);
      }
      const fu = mFinal.uniforms, g = p.grade;
      fu.uDofOn.value = dofOn ? 1 : 0;
      fu.uBloom.value = bloomOn ? p.bloom.strength : 0;
      fu.uSplit.value = p.split || 0;
      fu.uDebug.value = p.debug | 0;
      fu.uGrade.value.set(g.exposure, g.contrast, g.saturation, g.tintAmount);
      setTint(fu.uShadowTint, g.shadowTint || tintTmp); setTint(fu.uLightTint, g.lightTint || tintTmp);
      fu.uVG.value.set(g.vignette, g.grain, time);
      pass(mFinal, null);

      renderer.setRenderTarget(prevRT);
      renderer.autoClear = prevAuto;
    }

    function dispose() {
      [sceneRT, aoRT, aoBlurRT, nearMaxRT, nearDilRT, preRT, gatherRT, fillRT, bloomRT].concat(down, up).forEach(rt => rt.dispose());
      depthTex.dispose(); tri.dispose(); mats.forEach(m => m.dispose());
    }

    return { setSize, render, params, dispose, info: { hdr: hdr, samples: samples, get width() { return W; }, get height() { return H; }, get bloomLevels() { return levels; } } };
  };
})();
