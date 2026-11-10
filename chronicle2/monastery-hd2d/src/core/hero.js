// The hero: a pixel-art sprite sheet on an upright card that lives in the 3D world. It is lit by the scene's lights,
// falls into shade under walls and trees, casts its own shadow, and carries a lantern that really lights the ground.
// The sheet is described by a small spec so the art can be swapped: { frame:[w,h], foot:[x,y], ms, lantern:[row][col][x,y] }.
(function () {
  const HD = (window.HD = window.HD || {});
  const ROWS = { '0,1': 0, '-1,0': 1, '1,0': 2, '0,-1': 3, '-1,1': 4, '1,1': 5, '-1,-1': 6, '1,-1': 7 };   // "dx,dz" -> sheet row (down, left, right, up, down-left, down-right, up-left, up-right)
  HD.Hero = { create(ctx, image, spec) {
    const TX = HD.TEXEL, fw = spec.frame[0], fh = spec.frame[1], cols = Math.round(image.width / fw), rows = Math.round(image.height / fh);
    const tex = new THREE.Texture(image); tex.encoding = THREE.sRGBEncoding; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
    tex.repeat.set(1 / cols, 1 / rows);
    // card: origin at the feet. Local x right, y up. Height is stretched by 1/cos(pitch) each frame so the sprite keeps its true proportions on screen.
    const w = fw / TX, h = fh / TX, fx = spec.foot[0] / TX, fy = (fh - spec.foot[1]) / TX;
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(w / 2 - fx, h / 2 - fy, 0);
    // flipY=false: canvas row 0 is v=0, so flip the card's v
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    // light it like the ground it stands on (normal up) rather than like a wall facing the camera
    const nr = geo.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 0.94, 0.34);
    const mat = new THREE.MeshPhongMaterial({ map: tex, specular: 0x000000, shininess: 0, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.26, color: 0xd8d8d8 });
    const card = new THREE.Mesh(geo, mat); card.receiveShadow = true; card.castShadow = false; card.renderOrder = 5;
    // shadow caster: the same card, a little further from the moon so the sprite never shadows itself
    const caster = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
    caster.castShadow = true; caster.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    caster.position.set(0.1, 0, 0.22);
    // silhouette seen through walls, so the hero is never lost behind masonry
    const ghost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: 0x9a8fd0, transparent: true, opacity: 0.4, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    ghost.renderOrder = 6; ghost.material.color.convertSRGBToLinear();
    const group = new THREE.Group(); group.add(card, caster, ghost); ctx.root.add(group);
    // lantern: if the spec does not say where it is, look for the bright warm pixels in each frame
    if (!spec.lantern) { try { const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(image, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, L = []; let found = 0;
      for (let r = 0; r < rows; r++) { L.push([]); for (let q = 0; q < cols; q++) { let sx = 0, sy = 0, n = 0; for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const k = ((r * fh + y) * c.width + q * fw + x) * 4; if (d[k + 3] > 200 && d[k] > 215 && d[k + 1] > 140 && d[k + 1] < 235 && d[k + 2] < 150 && d[k] - d[k + 2] > 90) { sx += x; sy += y; n++; } } if (n >= 4) { L[r].push([sx / n, sy / n]); found++; } else L[r].push(null); } }
      if (found >= rows * cols * 0.6) { for (const row of L) for (let q = 0; q < cols; q++) if (!row[q]) row[q] = row.find(Boolean) || [fw / 2, fh / 2]; spec.lantern = L; } } catch (e) {} }
    let lamp = null, halo = null;
    if (spec.lantern) { lamp = new THREE.PointLight('#ffb468', 1.25, 10.5, 1.5); group.add(lamp);
      halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: HD.T.glow(), color: new THREE.Color('#ffb060').convertSRGBToLinear().multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); halo.scale.setScalar(1.7); halo.renderOrder = 7; group.add(halo); }
    const H = { group, card, spec, x: 0, y: 0, z: 0, row: 0, col: 0, moving: false, t: 0, speed: spec.speed || 5.4, lamp, halo, stretch: 1 };
    H.place = function (x, z) { H.x = x; H.z = z; H.y = ctx.heightAt(x, z); };
    // advance: dir = [dx, dz] with components -1/0/1 (or null), grid = walk grid, dt seconds, pitch = camera pitch in radians
    H.update = function (dir, grid, dt, pitch, time) {
      H.moving = false;
      if (dir && (dir[0] || dir[1])) {
        const row = ROWS[dir[0] + ',' + dir[1]]; if (row !== undefined) H.row = row < rows ? row : (dir[1] > 0 ? 0 : dir[1] < 0 ? 3 : dir[0] < 0 ? 1 : 2);
        const len = Math.hypot(dir[0], dir[1]), vx = dir[0] / len * H.speed * dt, vz = dir[1] / len * H.speed * dt;
        let nx = H.x + vx, nz = H.z + vz;
        if (grid) { if (grid.step(H.x, H.z, nx, nz)) { } else if (vx && grid.step(H.x, H.z, nx, H.z)) nz = H.z; else if (vz && grid.step(H.x, H.z, H.x, nz)) nx = H.x; else { nx = H.x; nz = H.z; } }
        if (nx !== H.x || nz !== H.z) { H.moving = true; H.x = nx; H.z = nz; }
      }
      if (H.moving) { H.t += dt * 1000; H.col = Math.floor(H.t / (spec.ms || 160)) % cols; } else { H.t = (spec.ms || 160) * 0.99; H.col = 0; }
      const gy = ctx.heightAt(H.x, H.z); H.y += (gy - H.y) * Math.min(1, dt * 18);
      tex.offset.set(H.col / cols, H.row / rows);
      H.stretch = 1 / Math.max(0.5, Math.cos(pitch)); group.position.set(H.x, H.y, H.z); card.scale.y = caster.scale.y = ghost.scale.y = H.stretch;
      if (lamp) { const lp = spec.lantern[Math.min(H.row, spec.lantern.length - 1)][H.col] || spec.lantern[0][0]; const lx = (lp[0] - spec.foot[0]) / TX, ly = (spec.foot[1] - lp[1]) / TX * H.stretch;
        const fl = 1 + 0.07 * Math.sin(time * 9.1) + 0.05 * Math.sin(time * 14.7 + 1.3) + 0.04 * Math.sin(time * 5.3);
        lamp.position.set(lx, ly + 0.2, 0.75); lamp.intensity = 1.25 * fl; halo.position.set(lx, ly, 0.06); halo.scale.setScalar(1.7 * (0.94 + 0.06 * fl)); }
    };
    return H;
  } };
})();
