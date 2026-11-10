// Materials. World surfaces need NO UVs: the shader maps the pixel texture onto every flat face by itself at
// 32 texels per unit (walls: u along the wall, v up; slopes: v up the slope; floors: plan view), using the true face
// normal, and samples it as crisp anti-aliased pixels. So any geometry + HD.M.stone "just works" at the hero's dot size.
(function () {
  const HD = (window.HD = window.HD || {});
  const T = HD.T, M = (HD.M = {});
  const TEXEL = (HD.TEXEL = 32);
  // shared by every world material: where the hero's chest is, the radius of the see-through circle (0 = off), and the render scale
  M.shared = { hdHero: { value: new THREE.Vector3(0, -999, 0) }, hdCut: { value: 1.75 }, hdK: { value: 2 } };

  const SAMPLE = `
    vec2 hdFw = abs(hdGx) + abs(hdGy);
    vec2 hdSeam = floor(hdPx + 0.5);
    vec2 hdQ = hdSeam + clamp((hdPx - hdSeam) / max(hdFw, vec2(1e-4)), -0.5, 0.5);
    vec4 sampledDiffuseColor = textureGrad(map, hdQ / hdSize, hdGx / hdSize, hdGy / hdSize);
    diffuseColor *= sampledDiffuseColor;`;
  // see-through: anything standing between the camera and the hero is cut away in a dithered circle, so he is never lost behind masonry or a tree
  const CUT = `    {
      vec3 hdL = hdHero - cameraPosition; float hdT = dot(hdWP - cameraPosition, hdL) / dot(hdL, hdL);
      if (hdCut > 0.0 && hdT > 0.0 && hdT < 0.965 && hdWP.y > hdHero.y - 0.55) {
        float hdD = length(hdWP - (cameraPosition + hdL * hdT)); float hdA = smoothstep(hdCut * 0.55, hdCut, hdD);
        vec2 hdB = mod(floor(gl_FragCoord.xy / hdK), 4.0); int hdI = int(hdB.x) + int(hdB.y) * 4;
        float hdM[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        if (hdA < (hdM[hdI] + 0.5) / 16.0) discard;
      }
    }`;
  M.CUT = CUT; M.CUT_DECL = 'uniform vec3 hdHero;\nuniform float hdCut;\nuniform float hdK;';
  const CHUNK = {
    // world mapping from the geometric face normal
    world: `
${CUT}
    #ifdef USE_MAP
    {
      vec3 hdDx = dFdx(hdWP), hdDy = dFdy(hdWP);
      vec3 hdN = normalize(cross(hdDx, hdDy));
      vec3 hdU, hdV;
      if (abs(hdN.y) > 0.92) { hdU = vec3(1.0, 0.0, 0.0); hdV = vec3(0.0, 0.0, -1.0); }
      else { hdU = normalize(vec3(hdN.z, 0.0, -hdN.x)); hdV = cross(hdN, hdU); }
      vec2 hdPx = vec2(dot(hdWP, hdU), -dot(hdWP, hdV)) * ${TEXEL}.0 + hdOff;
      vec2 hdGx = vec2(dot(hdDx, hdU), -dot(hdDx, hdV)) * ${TEXEL}.0, hdGy = vec2(dot(hdDy, hdU), -dot(hdDy, hdV)) * ${TEXEL}.0;
      ${SAMPLE}
    }
    #endif`,
    // mesh UVs span 0..1 over the whole texture (unique textures: the ground, signs)
    uv: `#ifdef USE_MAP
    {
      vec2 hdPx = vUv * hdSize; vec2 hdGx = dFdx(hdPx), hdGy = dFdy(hdPx);
      ${SAMPLE}
    }
    #endif`,
    // mesh UVs are in world units (u,v) -> 32 texels per unit
    unit: `#ifdef USE_MAP
    {
      vec2 hdPx = vec2(vUv.x, -vUv.y) * ${TEXEL}.0 + hdOff; vec2 hdGx = dFdx(hdPx), hdGy = dFdy(hdPx);
      ${SAMPLE}
    }
    #endif`,
  };
  // patch any material that has a .map so the map is sampled the HD-2D way. mode: 'world' | 'uv' | 'unit'
  M.patch = function (mat, mode, opt) {
    opt = opt || {}; mode = mode || 'world';
    const img = mat.map.image, size = new THREE.Vector2(img.width, img.height), off = new THREE.Vector2(opt.ox || 0, opt.oy || 0);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = function (sh, r) {
      if (prev) prev.call(mat, sh, r);
      sh.uniforms.hdSize = { value: size }; sh.uniforms.hdOff = { value: off }; sh.uniforms.hdHero = M.shared.hdHero; sh.uniforms.hdCut = M.shared.hdCut; sh.uniforms.hdK = M.shared.hdK;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 hdWP;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 hdP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hdP = instanceMatrix * hdP;
        #endif
          hdWP = (modelMatrix * hdP).xyz; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 hdWP;\nuniform vec2 hdSize;\nuniform vec2 hdOff;\nuniform vec3 hdHero;\nuniform float hdCut;\nuniform float hdK;')
        .replace('#include <map_fragment>', CHUNK[mode]);
      if (opt.extra) opt.extra(sh);
    };
    const key = 'hd2d-' + mode + (opt.key || '');
    mat.customProgramCacheKey = () => key;
    mat.userData.hd = mode;
    return mat;
  };

  // make(nameOrCanvasOrTexture, opt): a lit pixel-textured world material.
  //   opt.mode 'world' (default) | 'uv' | 'unit';  opt.color (multiplier);  opt.emissive / opt.emissiveIntensity;
  //   opt.side;  opt.alphaTest;  opt.ox / opt.oy (texel offset of the pattern)
  M.make = function (src, opt) {
    opt = opt || {};
    const tex = typeof src === 'string' ? T.get(src) : src.isTexture ? src : T.fromCanvas(src, opt);
    const mat = new THREE.MeshPhongMaterial({ map: tex, specular: 0x000000, shininess: 0, vertexColors: true, color: opt.color === undefined ? 0xffffff : opt.color,
      side: opt.side === undefined ? THREE.FrontSide : opt.side, alphaTest: opt.alphaTest || 0 });
    if (opt.emissive !== undefined) { mat.emissive = new THREE.Color(opt.emissive); mat.emissiveIntensity = opt.emissiveIntensity === undefined ? 1 : opt.emissiveIntensity; }
    mat.name = typeof src === 'string' ? src : opt.name || 'custom';
    return M.patch(mat, opt.mode, opt);
  };

  // Unlit, HDR-bright surface (flames, lamp glass, glowing windows). strength > 1 feeds the bloom.
  M.emissive = function (hex, strength) { const c = new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(strength === undefined ? 2 : strength); const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }); m.color.copy(c); return m; };
  // Unlit textured surface that glows (stained glass): ordinary 0..1 UVs, crisp pixels. strength multiplies the texture.
  M.glass = function (canvas, strength) {
    const tex = T.fromCanvas(canvas, { clamp: true }); const m = new THREE.MeshBasicMaterial({ map: tex, fog: true, side: THREE.DoubleSide });
    m.color.setScalar(strength === undefined ? 1.6 : strength); return M.patch(m, 'uv', { key: 'basic' });
  };
  // Additive light shaft / haze card: pass a hex colour; UV v=1 is the bright end, fades to v=0 and toward the u edges.
  M.beam = function (hex, strength) {
    return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { col: { value: new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(strength === undefined ? 0.35 : strength) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 col; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 1.0, vUv.y) * smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x); gl_FragColor = vec4(col * a * a, 1.0); }' });
  };

  // the standard set -------------------------------------------------------------------------------------------------
  M.init = function () {
    const std = { stone: 'ashlar', stoneDark: 'ashlarDark', stoneWarm: 'ashlarWarm', rubble: 'rubble', flag: 'flag', cobble: 'cobble', paver: 'paver',
      paverChecker: 'paverChecker', slate: 'slate', wood: 'wood', woodDark: 'woodDark', sand: 'sand', sandBlock: 'sandBlock', stonePlain: 'stonePlain',
      stoneDeep: 'stoneDark', rock: 'rock', iron: 'iron', bronze: 'bronze', moss: 'moss', earth: 'earth', void: 'void' };
    for (const k in std) M[k] = M.make(std[k]);
    M.slate.side = THREE.DoubleSide;
    M.flame = M.emissive('#ffc470', 3.2);       // candle / lantern flame
    M.lampGlass = M.emissive('#ffa550', 1.7);   // lit lantern panes
    return M;
  };
})();
