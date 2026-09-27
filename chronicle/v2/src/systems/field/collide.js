// FIELD — 当たり（V2_PLAN §2.5.9・§2.11）。マスの読み方は R.MapUtil（自前で読まない）。
//   R.Field.passable(map, x, y, fromDir, lv = 0) → bool   マスだけの当たり（仮の実装と同じ。物・人は含めない。QA の到達の検査も使う）
//   R.Field._walkable(...) → マス＋物の当たり（宝箱・泉・建物…）
//     - legend の walk:false・solid（secret は「通れる壁」なので通れる）
//     - 2 つの高さ（フェルン）: lv 1 は deck と ladder のマスだけ。lv 0 は deck の下をくぐれる（deck のマスも地面として歩ける）
//     - 一方通行（E5）: map.oneway [{x, y, dir}] のマスは dir の向きに進むときだけ入れる（fromDir = 進む向き 's'|'n'|'e'|'w'。斜めは入れない）
//     - 物: 宝箱・泉（2×2）・しょく台・灯籠・看板・建物（扉のマスを除く）・R.DB.props の solid（soft は通り抜け）・レバー／穴のスイッチ
//     - 行き先のあるマス（建物の戸口・扉・階段・出口）は必ず通れる（マスの solid・建物の敷地・上の物より先。R.Field._warpAt）。
//       行き先の無い戸口は「鍵の掛かった戸」で通れない（押すと一言。move.js）
//   R.Field._blocked(x, y, lv) → 人（NPC）を含めた当たり（今のマップ）
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});

  const SOLID_TYPES = { chest: 1, spring: 1, brazier: 1, waylamp: 1, sign: 1 };

  /** (x, y, lv) が建物の戸口ならその建物（cond の偽の建物は objectsAt が除く） */
  function doorBuildingAt(map, x, y, lv) {
    const list = R.MapUtil.objectsAt(map, x, y);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.type === 'building' && o.door && o.door.x === x && o.door.y === y && (o.lv || 0) === (lv || 0)) return o;
    }
    return null;
  }
  function condOk(c) { if (c == null) return true; try { return !!(R.Game && R.State.check(c)); } catch (e) { return false; } }
  /**
   * 行き先のあるマス（戸口・扉・階段・出口）→ true。ここは必ず通れる（マスの solid・上に置いた物・建物の絵の敷地より先に決める）。
   * 行き先の無い戸口（鍵の掛かった戸）は通れない（objBlocks）。
   */
  function warpAt(map, x, y, lv) {
    const b = doorBuildingAt(map, x, y, lv);
    if (b) return !!b.door.to;
    const list = R.MapUtil.objectsAt(map, x, y, lv || 0);
    for (let i = 0; i < list.length; i++) if ((list[i].type === 'stairs' || list[i].type === 'door') && list[i].to) return true;
    if ((lv || 0) === 0) for (const e of (map && map.exits) || []) {
      if (x >= e.x && y >= e.y && x < e.x + (e.w || 1) && y < e.y + (e.h || 1) && condOk(e.cond)) return true;
    }
    return false;
  }

  /** 物の当たり（lv ごと）。建物は扉のマスだけ通れる（行き先の無い戸口は鍵の掛かった戸 = 通れない）。戸口のマスに置いた物は当たらない */
  function objBlocks(map, x, y, lv) {
    const bd = doorBuildingAt(map, x, y, lv || 0);
    if (bd) return !bd.door.to;
    const list = R.MapUtil.objectsAt(map, x, y);
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if ((o.lv || 0) !== (lv || 0)) continue;
      if (SOLID_TYPES[o.type]) return true;
      if (o.type === 'building') {
        const d = o.door;
        if (d && d.x === x && d.y === y) continue;
        return true;
      }
      if (o.type === 'switch') { if (o.look === 'lever') return true; continue; }
      if (o.type === 'prop') {
        const meta = (R.DB.props && R.DB.props[o.id]) || {};
        if (meta.solid && !meta.soft && !o.soft) return true;
      }
    }
    return false;
  }

  function onewayAt(map, x, y) {
    const ow = map && map.oneway;
    if (!ow || !ow.length) return null;
    for (let i = 0; i < ow.length; i++) if (ow[i].x === x && ow[i].y === y) return ow[i];
    return null;
  }

  /** マスだけ（物・人を除く）: lv で歩けるか */
  function cellOk(map, x, y, lv) {
    const c = R.MapUtil.cell(map, x, y);
    if (!c) return false;
    if (lv === 1) return !!(c.deck || c.ladder) && !(c.solid && !c.secret);
    if (c.walk === false) return false;
    if (c.solid && !c.secret) return false;
    return true;
  }

  F.passable = function (map, x, y, fromDir, lv) {
    if (typeof map === 'string') map = R.DB.maps[map];
    if (!map) return false;
    lv = lv || 0;
    if (!cellOk(map, x, y, lv)) return false;
    const ow = onewayAt(map, x, y);
    if (ow && fromDir != null && fromDir !== ow.dir) return false;
    return true;
  };
  /** マスと物（宝箱・泉・建物…）の当たり。人は含めない（歩く・NPC が使う） */
  F._walkable = function (map, x, y, fromDir, lv) {
    if (typeof map === 'string') map = R.DB.maps[map];
    if (!map) return false;
    // 戸口・扉・階段・出口のマスは、マスの絵（壁・木）や上の物に関わらず入れる（そこで行き先へ移る）
    if (x >= 0 && y >= 0 && x < (map.w || 0) && y < (map.h || 0) && warpAt(map, x, y, lv || 0)) return true;
    return F.passable(map, x, y, fromDir, lv) && !objBlocks(map, x, y, lv || 0);
  };

  /** 高さの移り: from（今の lv）から (x, y) に入ったあとの lv。はしご → 足場は 1、はしご → 地面は 0 */
  F._lvAfter = function (map, fx, fy, x, y, lv) {
    const c = R.MapUtil.cell(map, x, y) || {};
    if (c.ladder) return lv;
    if (c.deck) {
      if (lv === 1) return 1;
      const from = R.MapUtil.cell(map, fx, fy) || {};
      return from.ladder ? 1 : 0;
    }
    return 0;
  };
  /** 高さを考えた「入れるか」（人を除く）。lv 0 からはしごを経ずに足場へ上がれない（下をくぐるだけ）、lv 1 は足場とはしごだけ */
  F._canEnter = function (map, fx, fy, x, y, lv, dir) {
    const to = F._lvAfter(map, fx, fy, x, y, lv);
    if (!F._walkable(map, x, y, dir, to)) return false;
    // はしごの上で lv 1 → 地面（足場でない所）へは降りられない（はしごの両端から出る）
    if (lv === 1 && to === 0) {
      const from = R.MapUtil.cell(map, fx, fy) || {};
      if (!from.ladder) return false;
    }
    return true;
  };

  /** 今のマップで人（NPC）が (x, y, lv) にいるか → NPC の状態 | null */
  F._npcAt = function (x, y, lv) {
    const list = S.npcs || [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (!n.vis) continue;
      if ((n.lv || 0) !== (lv || 0)) continue;
      if ((n.x === x && n.y === y) || (n.mv && n.mv.tx === x && n.mv.ty === y)) return n;
    }
    return null;
  };
  F._blocked = function (x, y, lv) {
    return !F._walkable(S.map, x, y, null, lv || 0) || !!F._npcAt(x, y, lv || 0);
  };
  F._onewayAt = onewayAt;
  F._doorAt = doorBuildingAt;
  F._warpAt = warpAt;
  F._objBlocks = objBlocks;
})(window.RPG);
