// Game loop, camera, input and the debug switches used while building.
//   ?only=gate,nave   build only these areas          ?noground=1 ?nosky=1 ?nopost=1 ?noveg=1
//   ?at=x,z           put the hero there (walk rules ignored)        ?walk=1   show the walkable cells
//   ?pitch=36&dist=36.5&fov=26&lift=1.6    camera overrides          ?free=x,y,z,tx,ty,tz   free camera (position, target)
//   ?msaa=0|2|4       anti-aliasing samples of the post pipeline
//   ?t=12.5           freeze time                                     ?k=1|1.5|2  render scale (540p x k)
(function () {
  const HD = (window.HD = window.HD || {});
  HD.areas = HD.areas || {};        // name -> function(ctx): each area file registers itself here
  HD.AREA_ORDER = ['gate', 'graveyard', 'nave', 'tower', 'cloister', 'lookout', 'woods', 'dressing'];
  const Q = new URLSearchParams(location.search), qn = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
  const DEG = Math.PI / 180;

  HD.Game = { start(opts) {
    const canvas = opts.canvas, usePost = !!HD.Post && !Q.has('nopost');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !usePost, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(1); if (!usePost) renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(HD.Light.FOG_COLOR).convertSRGBToLinear();
    const rig = HD.Light.setup(scene, renderer, { shadowSize: Q.has('shadow') ? qn('shadow', 2048) : 2048 });
    HD.M.init();
    const ctx = HD.World.create(scene); HD.ctx = ctx; ctx.renderer = renderer; ctx.query = Q;
    // vegetation kit, if present, is shared by all areas
    if (HD.Veg && !Q.has('noveg')) { try { ctx.V = HD.Veg.create(); } catch (e) { console.error('veg', e); } }
    // areas
    const only = Q.get('only') ? Q.get('only').split(',') : null, names = HD.AREA_ORDER.concat(Object.keys(HD.areas).filter(n => !HD.AREA_ORDER.includes(n)));
    for (const n of names) { if (!HD.areas[n] || (only && !only.includes(n))) continue; const t0 = performance.now(); try { HD.areas[n](ctx); } catch (e) { console.error('area ' + n + ' failed:', e && e.stack || e); } ctx['ms_' + n] = performance.now() - t0; }
    if (!Q.has('noground')) HD.Ground.build(ctx);
    const grid = HD.Ground.walkGrid(ctx); HD.grid = grid; if (Q.has('walk')) HD.Ground.walkOverlay(ctx, grid);
    let sky = null; if (HD.Sky && !Q.has('nosky')) { try { sky = HD.Sky.create(); scene.add(sky.group); } catch (e) { console.error('sky', e); } }
    let fx = null; if (HD.Fx && !Q.has('nofx')) { try { fx = HD.Fx.create(ctx); } catch (e) { console.error('fx', e); } }
    // hero
    const hero = HD.Hero.create(ctx, opts.heroImage, opts.heroSpec); HD.hero = hero;
    if (Q.has('at')) { const a = Q.get('at').split(',').map(Number); hero.place(a[0], a[1]); } else hero.place(grid.start[0], grid.start[1]);
    hero.row = 3;
    // camera
    const cam = new THREE.PerspectiveCamera(qn('fov', 26), 16 / 9, 2, 620); HD.camera = cam;
    const C = { pitch: qn('pitch', 36), dist: qn('dist', 36.5), lift: qn('lift', 1.6), tx: hero.x, ty: hero.y, tz: hero.z, pan: 0 }, base = { pitch: C.pitch, dist: C.dist, lift: C.lift };
    const free = Q.get('free') ? Q.get('free').split(',').map(Number) : null;
    // render size: the frame is always 16:9 at 540p x k, so that one hero dot is exactly k screen pixels
    let K = 0, post = null;
    function resize() { const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2); let k = Q.has('k') ? qn('k', 2) : Math.round((r.height * dpr) / 540 * 2) / 2; k = Math.max(1, Math.min(HD.maxK || 2, k || 1)); if (k === K) return; K = k;
      const w = 960 * k, h = 540 * k; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); if (post) post.setSize(w, h); }
    if (usePost) { try { post = HD.Post.create(renderer, 960, 540, { samples: Q.has('msaa') ? qn('msaa', 4) : 4 }); HD.post = post; } catch (e) { console.error('post', e); post = null; renderer.outputEncoding = THREE.sRGBEncoding; } }
    resize(); addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
    // input ---------------------------------------------------------------------------------------------------------
    const keys = new Set(), KEY = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    addEventListener('keydown', e => { const k = KEY[e.code]; if (k) { keys.add(k); e.preventDefault(); } else if ((e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') && opts.onAction) { opts.onAction(); e.preventDefault(); } });
    addEventListener('keyup', e => { const k = KEY[e.code]; if (k) keys.delete(k); }); addEventListener('blur', () => keys.clear());
    let stick = null;      // touch / mouse drag: direction from where the finger went down
    canvas.addEventListener('pointerdown', e => { stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} if (opts.onStick) opts.onStick(stick); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { stick.dx = e.clientX - stick.x0; stick.dy = e.clientY - stick.y0; if (opts.onStick) opts.onStick(stick); } });
    const up = e => { if (stick && e.pointerId === stick.id) { stick = null; if (opts.onStick) opts.onStick(null); } }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    function direction() { let dx = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), dz = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
      if (!dx && !dz && stick && Math.hypot(stick.dx, stick.dy) > 14) { const a = Math.round(Math.atan2(stick.dy, stick.dx) / (Math.PI / 4)); dx = Math.round(Math.cos(a * Math.PI / 4)); dz = Math.round(Math.sin(a * Math.PI / 4)); }
      return [dx, dz]; }
    if (Q.has('auto')) { /* test hook: ?auto=u,800;l,400 */ }
    // loop ----------------------------------------------------------------------------------------------------------
    const fixedT = Q.has('t') ? qn('t', 0) : null; let last = performance.now(), time = 0, frames = 0, spot = null, slow = 0, fpsT = 0, fpsN = 0;
    const tmp = new THREE.Vector3();
    let freeCam = free;
    function update(dt) {
      time = fixedT !== null ? fixedT : time + dt;
      hero.update(HD.frozen ? null : direction(), Q.has('at') && Q.has('noclip') ? null : grid, dt, C.pitch * DEG, time);
      // camera zones
      let wp = base.pitch, wd = base.dist, wl = base.lift, wpan = 0;
      for (const z of ctx.zones) { const d = Math.hypot(hero.x - z.x, hero.z - z.z), f = z.fall || 3, k = Math.max(0, Math.min(1, (z.r + f - d) / f)), s = k * k * (3 - 2 * k); if (s > 0) { if (z.pitch !== undefined) wp += (z.pitch - wp) * s; if (z.dist !== undefined) wd += (z.dist - wd) * s; if (z.lift !== undefined) wl += (z.lift - wl) * s; if (z.pan !== undefined) wpan += (z.pan - wpan) * s; } }
      const e = 1 - Math.exp(-dt * 2.2); C.pitch += (wp - C.pitch) * e; C.dist += (wd - C.dist) * e; C.lift += (wl - C.lift) * e; C.pan += (wpan - C.pan) * e;
      C.tx = hero.x; C.tz = hero.z; C.ty += (hero.y - C.ty) * Math.min(1, dt * 6);
      if (freeCam) { cam.position.set(freeCam[0], freeCam[1], freeCam[2]); cam.lookAt(freeCam[3], freeCam[4], freeCam[5]); }
      else { const p = C.pitch * DEG; cam.position.set(C.tx, C.ty + C.lift + Math.sin(p) * C.dist, C.tz + Math.cos(p) * C.dist); cam.lookAt(C.tx, C.ty + C.lift, C.tz + C.pan); }
      rig.follow(hero.x, hero.z);
      HD.M.shared.hdHero.value.set(hero.x, hero.y + 1.5, hero.z); HD.M.shared.hdK.value = K; HD.M.shared.hdCut.value = freeCam || Q.has('nocut') ? 0 : 1.75;
      // flicker
      for (const l of ctx.lights) { const f = l.userData.flicker; if (f) l.intensity = l.userData.base * (1 + f * (0.6 * Math.sin(time * 8.3 + l.userData.phase) + 0.4 * Math.sin(time * 13.1 + l.userData.phase * 2.1))); }
      for (const s of ctx.glows) { const f = s.userData.flicker; if (f) s.material.color.copy(s.userData.base).multiplyScalar(1 + f * (0.6 * Math.sin(time * 8.3 + s.userData.phase) + 0.4 * Math.sin(time * 13.1 + s.userData.phase * 2.1))); }
      for (const u of ctx.updaters) u(time, dt);
      if (ctx.V && ctx.V.update) ctx.V.update(time);
      if (sky) sky.update(time, cam);
      if (fx) fx.update(time, hero, K);
      // interaction prompt
      let sp = null; for (const s of ctx.spots) if (Math.hypot(hero.x - s.x, hero.z - s.z) < s.r) sp = s; if (sp !== spot) { spot = sp; if (opts.onSpot) opts.onSpot(sp); }
    }
    function draw() {
      const focus = freeCam ? tmp.set(freeCam[3], freeCam[4], freeCam[5]).distanceTo(cam.position) : tmp.set(hero.x, hero.y + 1.5, hero.z).distanceTo(cam.position);
      if (post) post.render(scene, cam, { focus, time }); else renderer.render(scene, cam);
    }
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; HD.frameMs = now - (HD._pf || now); HD._pf = now;
      update(dt); draw();
      frames++; if (frames === 3) { window.HD_READY = true; if (opts.onReady) opts.onReady(); }
      // if the machine cannot keep up, step the render scale down once or twice
      fpsT += dt; fpsN++; if (fpsT > 2.5) { const fps = fpsN / fpsT; HD.fps = fps; fpsT = 0; fpsN = 0; if (!Q.has('k') && frames > 200 && fps < 40 && (HD.maxK || 2) > 1 && ++slow >= 2) { slow = 0; HD.maxK = Math.max(1, K - 0.5); K = 0; resize(); } else if (fps >= 40) slow = 0; }
      if (!HD.paused) requestAnimationFrame(frame); else HD.resume = () => { HD.paused = false; last = performance.now(); requestAnimationFrame(frame); };
    }
    requestAnimationFrame(frame);
    // snap({at:[x,z], row, free:[px,py,pz,tx,ty,tz], fov, k, t}) -> PNG data URL of one frame drawn right now (for headless screenshots: stops the loop).
    HD.snap = function (o) { o = o || {}; HD.paused = true;
      if (o.k && o.k !== K) { K = o.k; const w = 960 * K, h = 540 * K; renderer.setSize(w, h, false); cam.aspect = w / h; if (post) post.setSize(w, h); }
      cam.fov = o.fov || qn('fov', 26); cam.updateProjectionMatrix(); freeCam = o.free || null;
      if (o.at) { hero.place(o.at[0], o.at[1]); if (o.row !== undefined) hero.row = o.row; }
      if (o.t !== undefined) time = o.t;
      for (let i = 0; i < 14; i++) update(0.3);
      draw(); return canvas.toDataURL('image/png'); };
    HD.game = { renderer, scene, ctx, hero, cam, C, grid, rig, get post() { return post; } };
    return HD.game;
  } };
})();
