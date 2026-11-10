// Small life in the air: dust motes drifting through the moonlight around the hero, and a few fireflies over the
// graves and the pool. Square pixel-sized points (they are dots of the same size as the world's texels), additive.
(function () {
  const HD = (window.HD = window.HD || {});
  const VS = `
    attribute vec3 seed; attribute vec3 home; attribute float kind;
    uniform float time, scale; uniform vec3 center, box;
    varying float vA; varying float vK;
    void main() {
      vec3 p; float a;
      if (kind < 0.5) {               // dust: fills a box that travels with the hero
        p = seed * box;
        p.x += sin(time * 0.11 + seed.y * 40.0) * 1.5 + time * 0.22;
        p.y += sin(time * 0.17 + seed.x * 30.0) * 0.5 + time * 0.04;
        p.z += cos(time * 0.13 + seed.z * 50.0) * 1.2;
        p = mod(p - center + box * 0.5, box) - box * 0.5 + center;
        vec3 e = abs(p - center) / (box * 0.5);
        a = (0.25 + 0.75 * (0.5 + 0.5 * sin(time * (0.5 + seed.z) + seed.x * 60.0))) * (1.0 - smoothstep(0.75, 1.0, max(e.x, max(e.y, e.z))));
        a *= 0.5;
      } else {                        // firefly: wanders round its home, glows and goes dark
        float t = time * (0.25 + seed.x * 0.2);
        p = home + vec3(sin(t + seed.y * 20.0) * 1.6 + sin(t * 2.3 + seed.z * 9.0) * 0.5, sin(t * 1.7 + seed.x * 11.0) * 0.5, cos(t * 0.9 + seed.z * 17.0) * 1.4);
        float b = sin(time * (0.9 + seed.y * 0.8) + seed.z * 40.0);
        a = smoothstep(0.1, 0.9, b) * 1.6;
      }
      vA = a; vK = kind;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = max(1.0, floor((kind < 0.5 ? 1.0 + step(0.7, seed.y) : 2.0) * scale * 36.5 / -mv.z + 0.5));
    }`;
  const FS = `
    uniform vec3 dust, fly; varying float vA; varying float vK;
    void main() { if (vA < 0.02) discard; gl_FragColor = vec4((vK < 0.5 ? dust : fly) * vA, 1.0); }`;
  HD.Fx = { create(ctx) {
    const L = ctx.L, r = HD.rng(404), seed = [], home = [], kind = [], pos = [];
    const add = (k, h) => { seed.push(r(), r(), r()); home.push(h[0], h[1], h[2]); kind.push(k); pos.push(0, 0, 0); };
    for (let i = 0; i < 260; i++) add(0, [0, 0, 0]);
    // fireflies: among the graves, over the cloister garth
    const spots = [];
    for (let i = 0; i < 26; i++) { const west = r() < 0.4; const x = west ? r.range(-25, -4) : r.range(4, 25), z = west ? r.range(-27, -12) : r.range(-54, -12); if (L.pathDist(x, z) > 1.2 && !ctx.onFloor(x, z)) spots.push([x, r.range(0.5, 1.9), z]); }
    for (let i = 0; i < 9; i++) { const a = r.range(0, 6.283), d = r.range(3.6, 7); spots.push([L.POOL.x + Math.cos(a) * d, r.range(0.6, 1.7), L.POOL.z + Math.sin(a) * d * 0.8]); }
    for (const s of spots) add(1, s);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 3));
    g.setAttribute('home', new THREE.Float32BufferAttribute(home, 3)); g.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
    const lin = (hex, k) => new THREE.Color(hex).convertSRGBToLinear().multiplyScalar(k);
    const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { time: { value: 0 }, scale: { value: 2 }, center: { value: new THREE.Vector3() }, box: { value: new THREE.Vector3(44, 9, 34) }, dust: { value: lin('#ffd9a8', 0.55) }, fly: { value: lin('#dfe6a4', 1.5) } } });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 8; ctx.root.add(pts);
    return { points: pts, update(time, hero, k) { mat.uniforms.time.value = time; mat.uniforms.scale.value = k; mat.uniforms.center.value.set(hero.x, hero.y + 3.5, hero.z - 3); } };
  } };
})();
