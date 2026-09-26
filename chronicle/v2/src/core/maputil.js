// MapUtil（CORE、契約の版 2）: マップのデータ（§2.6.1）を読む共通の道具。FIELD（当たり）・TERRAIN（焼く）・QA（tools/lib/maps.js）が
// 同じ答えを使うために 1 か所に置く。DOM に触れない（node でも使える）。R.Game が無いときは条件をすべて偽とみなす。
//
//   R.MapUtil.grid(map) → string[]                 tilePatches（cond が真の物）を当てた後の行。結果はキャッシュ（invalidate で捨てる）
//   R.MapUtil.cell(map, x, y) → legend の 1 字 | null   マップの外は null
//   R.MapUtil.spawn(map, spawn) → {x, y, dir}       spawn は名前か {x, y, dir}。無い名前は最初の spawn（警告）
//   R.MapUtil.inRect(x, y, r) → bool                r = [x, y, w, h] か {x, y, w?, h?}（w・h の既定 1）
//   R.MapUtil.objectsAt(map, x, y, lv?) → [obj]      その マスに掛かる物（泉 2×2・建物 w×h、ほかは 1×1）。cond が偽の物は除く
//   R.MapUtil.zoneAt(map, x, y) → zoneId | null     zones の上から最初に合う物（rect null は全体）
//   R.MapUtil.darkAt(map, x, y) → bool              map.dark（true／範囲の配列 [{rect, cond}]）
//   R.MapUtil.secretFound(mapId, x, y) → bool       R.Game.secrets[mapId] に 'x,y' があるか（見つけた隠し通路の書き方は 'x,y'）
//   R.MapUtil.invalidate(mapId?)                    フラグ・変数が変わったときなど（FIELD が 'flag' 'var' 'item:gain' で呼ぶ）
//
// secret のセル（legend の secret: true）は「通れる壁」: solid でも通れる。見つけるまでは mat で、見つけたら floor（無ければ隣の床）で描く。
(function (R) {
  'use strict';
  const cache = {}; // mapId → {sig, rows}

  function check(cond) {
    if (cond == null) return true;
    if (!R.Game || !R.State || !R.State.check) return false;
    try { return !!R.State.check(cond); } catch (e) { return false; }
  }
  function inRect(x, y, r) {
    if (!r) return false;
    if (Array.isArray(r)) return x >= r[0] && y >= r[1] && x < r[0] + (r[2] || 1) && y < r[1] + (r[3] || 1);
    return x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);
  }
  function footprint(o) {
    if (o.type === 'spring') return [o.x, o.y, 2, 2];
    if (o.type === 'building') return [o.x, o.y, o.w || 1, o.h || 1];
    return [o.x, o.y, o.w || 1, o.h || 1];
  }

  const MU = (R.MapUtil = {
    inRect,
    grid(map) {
      if (!map || !map.rows) return [];
      const patches = map.tilePatches || [];
      if (!patches.length) return map.rows;
      const on = patches.map((p) => check(p.cond));
      const sig = on.map((b) => (b ? 1 : 0)).join('');
      const c = cache[map.id];
      if (c && c.sig === sig && c.src === map.rows) return c.rows;
      const rows = map.rows.map((r) => [...r]);
      patches.forEach((p, i) => {
        if (!on[i]) return;
        if (p.rows && p.rect) {
          const [px, py] = p.rect;
          p.rows.forEach((r, dy) => [...r].forEach((ch, dx) => { if (ch !== ' ' && rows[py + dy] && px + dx < rows[py + dy].length) rows[py + dy][px + dx] = ch; }));
        } else if (p.ch != null && rows[p.y]) rows[p.y][p.x] = p.ch;
      });
      const out = rows.map((r) => r.join(''));
      cache[map.id] = { sig, rows: out, src: map.rows };
      return out;
    },
    cell(map, x, y) {
      if (!map || x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
      const row = MU.grid(map)[y];
      if (row == null) return null;
      const ch = row.length === map.w ? row.charAt(x) : [...row][x];
      return (map.legend && map.legend[ch]) || null;
    },
    spawn(map, sp) {
      if (sp && typeof sp === 'object') return { x: sp.x | 0, y: sp.y | 0, dir: sp.dir || 's' };
      const all = (map && map.spawns) || {};
      let s = all[sp];
      if (!s) {
        if (sp != null) R.warn && R.warn(`map ${map && map.id}: no spawn '${sp}', using the first`);
        s = all[Object.keys(all)[0]] || { x: 1, y: 1 };
      }
      return { x: s.x, y: s.y, dir: s.dir || 's' };
    },
    objectsAt(map, x, y, lv) {
      const out = [];
      for (const o of (map && map.objects) || []) {
        if (o.x == null || o.y == null) continue;
        if (lv != null && (o.lv || 0) !== lv) continue;
        if (!inRect(x, y, footprint(o))) continue;
        if (o.cond != null && o.type !== 'trail' && !check(o.cond)) continue;
        out.push(o);
      }
      return out;
    },
    zoneAt(map, x, y) {
      for (const z of (map && map.zones) || []) if (!z.rect || inRect(x, y, z.rect)) return z.zone;
      return null;
    },
    darkAt(map, x, y) {
      const d = map && map.dark;
      if (!d) return false;
      if (d === true) return true;
      return d.some((e) => (!e.rect || inRect(x, y, e.rect)) && check(e.cond));
    },
    secretFound(mapId, x, y) {
      const s = R.Game && R.Game.secrets && R.Game.secrets[mapId];
      return !!(s && s.indexOf(x + ',' + y) >= 0);
    },
    invalidate(mapId) { if (mapId) delete cache[mapId]; else for (const k of Object.keys(cache)) delete cache[k]; },
    footprint,
  });
})(window.RPG);
