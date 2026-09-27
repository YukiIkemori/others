// Page-side preview of v2/assets/env in the real engine, WITHOUT editing v2/src.
// It is the reference for the wiring (ENV_ASSETS.md): every hook below names the engine function the wiring should change.
//   await window.__envInstall(manifest, {theme, tiles:[32]})   manifest = {mat:{id:json}, face:{style:json}, props:{id:json}, bld:{id:json}, base:'/__env/'}
(function () {
  const R = window.RPG, T = R.Terrain;
  const imgs = {};
  function loadImg(url) {
    if (imgs[url]) return imgs[url];
    return (imgs[url] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + url)); i.src = url; }));
  }
  function canvasOf(img, sx, sy, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, sx || 0, sy || 0, w, h, 0, 0, w, h);
    return c;
  }
  const px32 = (c) => new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer.slice(0));
  function ambMul(amb) {
    const c = R.Hd.RZ.hex(amb);
    return [0.42 + (c[0] / 255) * 0.62, 0.42 + (c[1] / 255) * 0.62, 0.42 + (c[2] / 255) * 0.62].map((v) => Math.min(1, v));
  }
  function mulCanvas(src, m) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] *= m[0]; d.data[i + 1] *= m[1]; d.data[i + 2] *= m[2]; }
    g.putImageData(d, 0, 0); return c;
  }
  const S = (window.__envState = window.__envState || { bldSheets: {}, emitLayers: {} });

  window.__envInstall = async function (man, o) {
    o = o || {};
    const base = man.base || '/__env/', tiles = o.tiles || [32];
    const pick = (tab, id) => { const th = o.theme; return (tab[th + '/' + id]) || tab['common/' + id] || null; };
    const url = (j, t) => base + j.theme + '/' + j.kind_dir + '/' + j.files[t];
    // ---- materials: fill the engine's material sheet (T._sheet → {S, px, done}) with the image (period may be 256, not 4 tiles)
    for (const id of man.matIds) {
      const j = pick(man.mat, id); if (!j) continue;
      for (const t of tiles) {
        const img = await loadImg(url(j, t)); const c = canvasOf(img, 0, 0, img.width, img.height);
        const s = T._sheet(id, t); s.S = img.width; s.px = px32(c); s.done = true; s.row = s.S;
      }
    }
    // ---- rise faces: T._faceSheet(style, tile, h) → {S, H, px}; cap rows from the top of the strip + foot rows from its bottom
    for (const st of man.faceIds) {
      const j = pick(man.face, st); if (!j) continue;
      for (const t of tiles) {
        const img = await loadImg(url(j, t)); const full = canvasOf(img, 0, 0, img.width, img.height);
        for (let h = 1; h <= 3; h++) {
          const H = t * h, foot = Math.min(Math.round(j.foot32 * t / 32), H >> 1);
          const c = document.createElement('canvas'); c.width = img.width; c.height = H;
          const g = c.getContext('2d');
          g.drawImage(full, 0, 0, img.width, H - foot, 0, 0, img.width, H - foot);
          g.drawImage(full, 0, img.height - foot, img.width, foot, 0, H - foot, img.width, foot);
          const fs = T._faceSheet(j.style || st, t, h); fs.S = img.width; fs.H = H; fs.px = px32(c);
        }
      }
    }
    // ---- props: redefine hd:prop:<id> from the strip (frames side by side). opts.s = tile/32 picks the size, opts.amb multiplies like bakeProp.
    //      Variants: files <base>_v<n> (and <base> itself as v0) are chosen by opts.v; trees with opts.leaf === 'moss' use tree_moss_v*.
    const strips = {};
    async function stripOf(id) {
      if (strips[id]) return strips[id];
      const j = pick(man.props, id); if (!j) return null;
      const s = { j, img: {} };
      for (const t of [24, 32, 40]) if (j.files[t]) s.img[t] = await loadImg(url(j, t));
      return (strips[id] = s);
    }
    const groups = {};
    for (const id of man.propIds) {
      const m = /^(.*)_v(\d+)$/.exec(id);
      const base = m ? m[1] : id, v = m ? +m[2] : 0;
      (groups[base] = groups[base] || [])[v] = id;
    }
    const ALIAS = { tree_giant: 'tree_giant', pine: 'pine', tree: 'tree', bush: 'bush', roots: 'roots', rock: 'rock', dec_tuft: 'dec_tuft' };
    for (const base of Object.keys(groups)) {
      const ids = groups[base].filter(Boolean);
      for (const id of ids) await stripOf(id);
      if (groups.tree_moss && base === 'tree') for (const id of groups.tree_moss.filter(Boolean)) await stripOf(id);
      if (!R.Hd.has('hd:prop:' + base) && !ALIAS[base]) { /* new prop id: define anyway so content can use it */ }
      R.Hd.redef('hd:prop:' + base, (op) => {
        op = op || {};
        let list = ids;
        if (base === 'tree' && op.leaf === 'moss' && groups.tree_moss) list = groups.tree_moss.filter(Boolean);
        const id = list[((op.v | 0) % list.length + list.length) % list.length];
        const st = strips[id], j = st.j;
        const t = Math.round((op.s || 1) * 32), img = st.img[t] || st.img[32], cw = (j.cell[t] || j.cell[32])[0], ch = img.height;
        const feet = j.feet[t] || j.feet[32];
        const frames = [], poses = {};
        j.frames.forEach((f, i) => {
          let c = canvasOf(img, i * cw, 0, cw, ch);
          if (op.amb) c = mulCanvas(c, ambMul(op.amb));
          if (base === 'tree' && op.leaf === 'dk' && !op.amb) c = mulCanvas(c, [0.8, 0.86, 0.9]);
          frames.push({ c, ox: feet[0], oy: feet[1] }); poses[f] = [i];
        });
        if (!poses.default) poses.default = [0];
        if (j.frames.indexOf('on') >= 0) poses.on = [j.frames.indexOf('on')];
        const lt = j.light32 ? [j.light32[0] * t / 32, j.light32[1] * t / 32] : null;
        return { frames, poses, fps: {}, anchors: { feet: [0, 0], light: lt }, w: cw, h: ch, meta: Object.assign({ id: base }, R.DB.props[base] || {}, { emit: lt ? { light: lt } : null }) };
      }, R.DB.props[base] || {});
    }
    // ---- buildings: T.building(def) keeps its key; the key is redefined from the painted facade (same anchor: bottom-left of the footprint)
    if (!T.__origBuilding) T.__origBuilding = T.building;
    const bl = {};
    for (const id of man.bldIds) {
      const j = man.bld[id];
      bl[id] = { j, img: {}, emit: {} };
      for (const t of [24, 32, 40]) { bl[id].img[t] = await loadImg(url(j, t)); if (j.emitFiles && j.emitFiles[t]) bl[id].emit[t] = await loadImg(base + j.theme + '/bld/' + j.emitFiles[t]); }
    }
    T.building = function (def) {
      const key = T.__origBuilding(def);
      const b = bl[def.id];
      if (b && !S.bldSheets[key]) {
        S.bldSheets[key] = true;
        R.Hd.redef(key, (op) => {
          const t = (op && op.tile) || 32, k = t / 32, img = b.img[t] || b.img[32], j = b.j;
          const c = canvasOf(img, 0, 0, img.width, img.height);
          const ox = Math.round(j.anchor32[0] * k), oy = img.height;
          const sc = (e) => Object.assign({}, e, { x: Math.round(e.x * k), y: Math.round(e.y * k), w: e.w != null ? Math.round(e.w * k) : e.w, h: e.h != null ? Math.round(e.h * k) : e.h });
          const meta = { tile: t, footprint: j.footprint, door: j.door32 ? { x: j.door32.x * k, y: 0 } : null, emit: (j.emit32 || []).map(sc),
            roof: j.roof32.map((v) => v * k), wallTop: j.wallTop32 * k, emitLayer: b.emit[t] ? canvasOf(b.emit[t], 0, 0, b.emit[t].width, b.emit[t].height) : null, envAnchor: [ox, oy] };
          return { frames: [{ c, ox, oy }], poses: { default: [0] }, anchors: { feet: [0, 0], door: meta.door ? [meta.door.x, 0] : null }, w: c.width, h: c.height, meta };
        });
      }
      return key;
    };
    // ---- emissive: painted windows come back from the building's own emission layer instead of the synthetic pane
    if (!T.__origLightsOf) {
      T.__origLightsOf = T._lightsOf;
      T._lightsOf = function (map, env) {
        const out = T.__origLightsOf(map, env);
        const boxes = [], add = [];
        for (const o of map.objects || []) {
          if (o.type !== 'building') continue;
          const sh = env.bld(o); if (!sh || !sh.meta || !sh.meta.emitLayer) continue;
          const bx = o.x * env.tile, by = (o.y + (o.h || 3)) * env.tile, x0 = bx - sh.meta.envAnchor[0], y0 = by - sh.meta.envAnchor[1];
          boxes.push([x0, y0, x0 + sh.frames[0].c.width, y0 + sh.frames[0].c.height]);
          add.push({ kind: 'img', c: sh.meta.emitLayer, x: x0, y: y0 });
        }
        out.emissive = out.emissive.filter((e) => e.kind !== 'win' || !boxes.some((b) => e.x >= b[0] && e.x < b[2] && e.y >= b[1] && e.y < b[3])).concat(add);
        return out;
      };
      T.__origDrawEmissive = T._drawEmissive;
      T._drawEmissive = function (ctx, list, X0, Y0, s) {
        const rest = [];
        for (const e of list) if (e.kind === 'img') ctx.drawImage(e.c, Math.round(e.x - X0), Math.round(e.y - Y0)); else rest.push(e);
        return T.__origDrawEmissive(ctx, rest, X0, Y0, s);
      };
    }
    return { ok: true, mats: man.matIds.length, props: man.propIds.length, blds: man.bldIds.length };
  };
})();
