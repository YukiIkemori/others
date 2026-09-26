// Scene helpers shared by the story's events (owner: story A19). Loaded first of the events
// ('final_00' sorts before final_* and story*), so both the endgame (final_*.js) and the cross-region
// scenes (story*.js) use them. R.Story:
//
//   S.who(id)                    the speaker's display name: 'fine' → 少女 until st_t3, then フィーネ (STYLE_JA §5)
//   S.said(id, text)             '名前「text」' (text already broken into ≤20-wide lines by the author)
//   S.actor(ev, id, sprite, x, y, dir)
//                                a stand-in NPC for this visit only: put on the current field map when the map
//                                has no NPC of that id (scenes on maps the story does not own, e.g. ベルナ in
//                                ロアの里 or a region town that lacks a slot). Returns the ev.npc handle, or a
//                                dummy handle in node tools (no field).
//   S.slot(ev, slot)             the §10.8.0-7 scene slots of a region town: 'st_rival' | 'st_fine' | 'st_extra'.
//                                Shows the NPC (flag st_show_*), creating a stand-in two tiles below `inn` when the
//                                town has none. → handle
//   S.hideSlot(ev, slot)         lower the flag again (the NPC is gone) — always in a finally
//   S.fineSprite()               'npc:fine_fade' from tier 3 (her feet fade, §10.3), else 'npc:fine'
//   S.tierLine(t, table)         the entry of {minTier: text} with the largest minTier ≤ t
(function (R) {
  'use strict';
  const S = (R.Story = R.Story || {});

  const NAMES = { berna: 'ベルナ', rowell: 'ロウェル', lazaro: 'ラザロ', king: '虚ろの王', nemrea: 'ネムレア', letter: '手紙', scribe: '書記' };
  S.who = function (id) {
    if (id === 'fine') return R.State.flag('st_t3') ? 'フィーネ' : '少女';
    return NAMES[id] || id;
  };
  S.said = function (id, text) { return S.who(id) + '「' + text + '」'; };

  /** a no-op npc handle for node tools (no field map) */
  function dummy() {
    const h = { x: 0, y: 0, dir: 'down', visible: false, face: () => h, walk: () => Promise.resolve(), hide: () => h, show: () => h, setPos: () => h };
    return h;
  }
  const fieldMap = () => (R.Field && R.Field.map && R.Field.map.npcs ? R.Field.map : null);

  S.actor = function (ev, id, sprite, x, y, dir) {
    const m = fieldMap();
    if (!m) return dummy();
    let n = m.npc(id);
    if (!n) {
      const spr = String(sprite || 'npc:man');
      n = {
        id, sprite: spr.includes(':') ? spr : 'npc:' + spr, x, y, dir: dir || 'down', dir0: dir || 'down', move: 'still',
        homeX: x, homeY: y, hidden: false, forced: true, present: true, mv: null, path: null, seq: m.npcs.length,
        fixed: true, actor: true, text: '……',
      };
      m.npcs.push(n);
    } else {
      if (sprite) n.sprite = String(sprite).includes(':') ? sprite : 'npc:' + sprite;
      if (x != null) { n.x = x; n.y = y; n.homeX = x; n.homeY = y; n.mv = null; }
      if (dir) n.dir = dir;
      n.hidden = false; n.forced = true; n.present = true;
    }
    return ev.npc(id);
  };
  /** remove every stand-in of this visit (they vanish; real NPCs are untouched) */
  S.dropActors = function () {
    const m = fieldMap();
    if (!m) return;
    for (let i = m.npcs.length - 1; i >= 0; i--) if (m.npcs[i].actor) m.npcs.splice(i, 1);
  };

  const SLOT = {
    st_rival: { flag: 'st_show_rival', dx: 0, sprite: 'npc:rowell' },
    st_fine: { flag: 'st_show_fine', dx: 2, sprite: 'npc:fine' },
    st_extra: { flag: 'st_show_extra', dx: -2, sprite: 'npc:scribe' },
  };
  S.SLOT = SLOT;
  S.slot = function (ev, slot, sprite) {
    const s = SLOT[slot];
    ev.setFlag(s.flag);
    const m = fieldMap();
    if (!m) return dummy();
    let n = m.npc(slot);
    if (!n) {
      const inn = m.spawns && (m.spawns.inn || m.spawns.entrance);
      const p = R.Field.pos();
      const bx = inn ? inn.x : p.x, by = inn ? inn.y : p.y;
      S.actor(ev, slot, sprite || s.sprite, bx + s.dx, by + 2, 'up');
      n = m.npc(slot);
    } else {
      if (sprite) n.sprite = sprite;
      n.x = n.homeX; n.y = n.homeY; n.mv = null; n.dir = 'up';
    }
    ev.refresh();
    if (n) { n.hidden = false; n.present = true; }
    return ev.npc(slot);
  };
  S.hideSlot = function (ev, slot) {
    const s = SLOT[slot];
    if (R.State.flag(s.flag)) ev.setFlag(s.flag, false);
    const m = fieldMap();
    if (m) {
      const n = m.npc(slot);
      if (n) {
        if (n.actor) m.npcs.splice(m.npcs.indexOf(n), 1);
        else { n.x = n.homeX; n.y = n.homeY; n.mv = null; }
      }
    }
    ev.refresh();
  };
  S.fineSprite = function () {
    const t = R.Game ? R.Game.tier || 0 : 0;
    return t >= 3 && R.Gfx.has('npc:fine_fade') ? 'npc:fine_fade' : 'npc:fine';
  };
  S.tierLine = function (t, table) {
    let best = null, bk = -1;
    for (const k of Object.keys(table)) if (+k <= t && +k > bk) { bk = +k; best = table[k]; }
    return best;
  };
  /**
   * Scenes are often staged near a map's lower edge, where the camera stops and the party stands low on the
   * screen, under the message window. autoPos(ev) makes this event's messages go to the top of the screen
   * whenever the party is in the lower half of the view (checked at each say).
   */
  S.msgPos = function () {
    try {
      const cam = R.Field && R.Field.camera && R.Field.camera(), p = R.Field && R.Field.pos && R.Field.pos();
      if (!cam || !p) return 'bottom';
      const v = R.Field.view();
      const sy = (p.y * 16 + 8 - cam.y) / v.h;
      return sy > 0.52 ? 'top' : 'bottom';
    } catch (e) { return 'bottom'; }
  };
  const posDone = new WeakSet();
  S.autoPos = function (ev) {
    if (posDone.has(ev)) return ev;
    const say = ev.say, yesno = ev.yesno;
    ev.say = (t, o) => say(t, Object.assign({ pos: S.msgPos() }, o || {}));
    ev.yesno = (t) => (R.Field && R.Field.map && R.UI && R.UI.yesno ? R.UI.yesno(t, { pos: S.msgPos() }) : yesno(t));
    posDone.add(ev);
    return ev;
  };
  /** the party stands still, looking at (x,y) */
  S.lookAt = function (ev, x, y) {
    const p = R.Field && R.Field.pos ? R.Field.pos() : null;
    if (!p) return;
    const dx = x - p.x, dy = y - p.y;
    ev.player.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
})(window.RPG);
