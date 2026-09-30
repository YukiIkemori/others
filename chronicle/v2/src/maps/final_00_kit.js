// CONTENT（終盤）: 書の都ビブリアと白の大書庫の共通の小道具（凡例・光・下絵の当たりから組み立てる）。STORY_BIBLE §9.3、WORLD_REDESIGN §5.13
//   R.Final.kit.TOWN(extra)   町の凡例（字は design/.../under/finale/lib.py と同じ。'c' 白い石畳・'X' 白い家と壁（描いた物）・'=' 桟橋・'~' 内海・'w' 噴水）
//   R.Final.kit.INT(extra)    大書庫の凡例（'c' 象牙色の大理石の床・'u' 木の床・'k' 赤い敷物・'X' 青灰色の石の壁・'r' 書架と机・'~' 建物の外）
//   R.Final.kit.ROOM(wall, floor) 屋内（R.ContentF.kit.ROOM_LEGEND）
//   R.Final.kit.painted(id)   下絵に合わせた当たり（maps/final_painted_rows.js の R.Final.PAINTED[id]）→ {rows, art, blds}
//   R.Final.kit.blds(id, dest) 描いた建物の敷地と戸口 → 建物の物（dest[建物の id] = {map, spawn?, sign?}。無い物は入れない家として当たりだけ）
//   R.Final.kit.LIGHT_*       光（白い町の夜・屋内・大書庫・虚ろの間）と、エンディングの朝の光 LIGHT_DAWN（明るさ k 1 に近い = 夜の暗さを掛けない）
//   R.Final.kit.dawnCopy(src, id, o)  エンディングの朝の写し（同じ当たりと絵で、光だけ朝。人と物は o で差し替え）
// 大書庫の灯（持ち主 2026-09-29「地方に合う小道具」）: 白い紙の笠の灯（paper_lamp）はまだ描いていないので、灯りは共通の燭台（candelabra）と
// 光だけの物（page_glow = 白紙の淡い光・altar_glow = 始まりの年代記の光）で足りるようにしてある。
(function (R) {
  'use strict';
  const I = (R.Final = R.Final || {});
  const K = (I.kit = I.kit || {});
  const PROPS = {
    // 光だけの物（絵を持たない）: 舞う白紙の淡い光（大書庫）・祭壇の年代記の光（虚ろの間）・朝日の差す窓（エンディング）
    page_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 80 } },
    altar_glow: { soft: true, glow: true, light: { kind: 'lamp', r: 150 } },
  };
  for (const id of Object.keys(PROPS)) if (!R.DB.props[id]) R.def('props', id, PROPS[id]);

  const BASE = {
    ',': { mat: 'grass' }, ';': { mat: 'tall_grass' }, '"': { mat: 'flowers' }, '.': { mat: 'road' }, ':': { mat: 'dirt' },
    c: { mat: 'white_paving' }, '=': { mat: 'pier' }, u: { mat: 'wood_floor' }, k: { mat: 'carpet' },
    '~': { mat: 'sea', walk: false }, w: { mat: 'water', walk: false },
    T: { mat: 'tree', solid: true }, F: { mat: 'forest_dark', solid: true }, b: { mat: 'bush', solid: true }, r: { mat: 'rock', solid: true },
  };
  K.TOWN = function (extra) {
    return Object.assign({}, BASE, {
      R: { mat: 'cliff', solid: true, rise: 1 },
      X: { mat: 'wall_marble', solid: true, name: 'painted' },
    }, extra || {});
  };
  K.INT = function (extra) {
    return Object.assign({}, BASE, {
      c: { mat: 'marble_floor' },
      r: { mat: 'wood_floor', solid: true, name: 'furniture' },
      R: { mat: 'wall_stone', solid: true, rise: 2 },
      X: { mat: 'wall_stone', solid: true, name: 'painted' },
      '~': { mat: 'wall_stone', solid: true, name: 'outside' },
      w: { mat: 'water', walk: false },
    }, extra || {});
  };
  K.ROOM = function (wall, floor) { return R.ContentF.kit.ROOM_LEGEND(wall || 'wall_stone', floor || 'wood_floor'); };
  // 白い町は灯が細く、町じゅうが白紙になりかけている（STORY_BIBLE §9.3 の 2）。大書庫の中は白紙の淡い光だけ
  K.LIGHT_TOWN = { ambient: '#5a60a2', k: 0.5, poolK: 1.4, spillR: 1.4, mood: 'town_night' };
  K.LIGHT_ROOM = { ambient: '#8a8298', k: 0.8, mood: 'interior' };
  K.LIGHT_ARCHIVE = { ambient: '#5c66a0', k: 0.58, poolK: 1.25, spillR: 1.2, mood: 'tower' };
  K.LIGHT_VOID = { ambient: '#6a72b0', k: 0.62, poolK: 1.2, spillR: 1.2, mood: 'tower' };
  // エンディングの朝（生まれて初めての日の出）: 夜の暗さをほぼ掛けない。暖かい朝の色
  K.LIGHT_DAWN = { ambient: '#fff0dc', k: 0.97, mood: 'town_night', vignette: 0.18 };
  K.LIGHT_DAWN_ROOM = { ambient: '#ffe6cc', k: 0.95, mood: 'interior', vignette: 0.2 };

  /** 下絵に合わせた当たり（final_painted_rows.js）。無ければ小さな四角（node の読み込みの順が崩れても落ちない） */
  K.painted = function (id) {
    const p = I.PAINTED && I.PAINTED[id];
    if (p) return { rows: p.rows.slice(), art: Object.assign({}, p.art), blds: (p.blds || []).map((b) => Object.assign({}, b)) };
    R.warn && R.warn('Final.kit.painted: no painted rows for ' + id);
    return { rows: ['XXX', 'XcX', 'XXX'], art: null, blds: [] };
  };
  /** 描いた建物 → 建物の物（当たりは下絵の 'X'。戸口は 1 マス、出て着くのはその真下）。dest に無い建物は入れない家 */
  K.blds = function (id, dest) {
    const out = [];
    for (const b of K.painted(id).blds) {
      const o = { type: 'building', id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, wall: 2, roof: 'flat', mat: 'plaster', windows: 2, lamp: false };
      const d = dest[b.id];
      if (d) {
        o.door = { x: b.door[0], y: b.door[1], to: { map: d.map, spawn: d.spawn || 'door' } };
        if (d.sign) o.sign = d.sign;
        if (d.cond) o.door.cond = d.cond;
      }
      out.push(o);
    }
    return out;
  };
  /** 建物の戸口の前（door.y + 1）の spawn */
  K.doorSpawn = function (id, bid, dir) {
    const b = K.painted(id).blds.find((q) => q.id === bid);
    return b ? { x: b.door[0], y: b.door[1] + 1, dir: dir || 's' } : { x: 1, y: 1, dir: 's' };
  };
  /**
   * エンディングの朝の写し: src のマップ（登録済み）と同じ当たり・絵・戸口で、光だけ朝にした id のマップ。
   * o.npcs（人の差し替え。無ければ人なし）・o.objects（足す物）・o.light・o.name・o.spawns（足す spawn）。町の端の出口は無く、戸口と屋内の出口は写しの中に戻る（場面の間だけ使う）
   */
  K.dawnCopy = function (src, id, o) {
    o = o || {};
    const m = R.DB.maps[src];
    if (!m) { R.warn && R.warn('Final.kit.dawnCopy: no map ' + src); return null; }
    const selfSp = {};
    const keep = (m.objects || []).filter((ob) => ob.type === 'building' || ob.type === 'prop').map((ob) => {
      const c = Object.assign({}, ob);
      delete c.cond;
      // 戸口は写しの中だけで閉じる（ほかの地方の家へはつながない。押すと戸の前に戻るだけ = 場面の間だけの写し）
      if (c.door) {
        const sp = 'dawn_' + (c.id || (c.door.x + '_' + c.door.y));
        selfSp[sp] = { x: c.door.x, y: c.door.y + 1, dir: 's' };
        c.door = { x: c.door.x, y: c.door.y, to: { map: id, spawn: sp } };
      }
      return c;
    });
    // 屋内の出口は写しの中に戻す（出口の戸口の絵を残すため。外へはつながない）。町・エリアの端の出口は無い
    const back = (m.spawns && (m.spawns.door ? 'door' : Object.keys(m.spawns)[0])) || null;
    const selfExits = m.kind === 'interior' && back ? (m.exits || []).map((e) => Object.assign({}, e, { to: { map: id, spawn: back } })) : [];
    const def = {
      id, name: o.name || m.name, kind: m.kind, region: 'finale', location: m.location, theme: m.theme, propSet: m.propSet, propSetBase: m.propSetBase,
      legend: m.legend, rows: m.rows.slice(), outside: m.outside, objects: keep.concat(o.objects || []), npcs: o.npcs || [],
      spawns: Object.assign({}, m.spawns, selfSp, o.spawns || {}), exits: selfExits, triggers: [], zones: [],
      light: o.light || K.LIGHT_DAWN, dark: false, bgm: o.bgm || 'dawn', bbg: m.bbg,
      meta: Object.assign({}, m.meta || {}, { sub: o.sub || (m.meta && m.meta.sub), minimap: false, dawn: true, chestsInfo: false }),
      art: m.art ? Object.assign({}, m.art) : undefined,
    };
    if (m.w) { def.w = m.w; def.h = m.h; }
    R.def('maps', id, def);
    return def;
  };
})(window.RPG);
