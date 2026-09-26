// FIELD — HUD（MODERN_UI §6.2、town.png・field.png・dungeon.png・town_tall.png）
//   左上: 場所の名前（入ったときに 2.4 秒。ダンジョンは常に）＋ひとこと＋町の施設のアイコン、ダンジョンは「宝箱 開けた数/総数」、暗がりは「暗い」。
//         町では「新しい話 ◯人」（E19）。
//   右上: 目印の手がかりの札（題名・場所・方角の針）。目印が無ければ出さない。ダンジョンは下に小地図（minimap.js）。縦持ちは左上の場所の下。
//   人・物の上: 近づいたときだけ「[A] 話す」「[A] 調べる」「[A] 泉で休む」の吹き出し（R.UIK.bubble）。
//   右下: ボタン表示（設定 prompts: always／最初の 2 時間／出さない）。タッチの操作パッドが出ているときは出さない。
//   通知: R.Field.hud.toast(text, {icon, anchor}) → R.UIK.toast（入手は右上 'tr'、システムは左下 'bl'）。
//   毎フレームの文字は refresh() で作っておく（毎フレーム新しい文字列を作らない）。
(function (R) {
  'use strict';
  const F = (R.Field = R.Field || {});
  const S = (F._s = F._s || {});
  const H = (F.hud = F.hud || {});
  const TWO_H = 2 * 3600 * 1000;
  const FAC = { inn: 'inn', shop: 'shop', tavern: 'chat', item: 'bag', weapon: 'sword', armor: 'shield', church: 'light', guild: 'journal', records: 'book' };
  const PROMPTS_TOWN = [{ btn: 'y', label: 'メニュー' }, { btn: 'x', label: '地図' }, { btn: 'b', label: '走る' }];
  const PROMPTS_DUN = [{ btn: 'y', label: 'メニュー' }, { btn: 'x', label: '地図' }, { btn: 'b', label: '走る' }];
  const DIR_ANGLE = { n: 0, ne: Math.PI / 4, e: Math.PI / 2, se: Math.PI * 0.75, s: Math.PI, sw: -Math.PI * 0.75, w: -Math.PI / 2, nw: -Math.PI / 4 };
  const DIR_JA = { n: '北', ne: '北東', e: '東', se: '南東', s: '南', sw: '南西', w: '西', nw: '北西' };
  const B = [{ btn: 'a', label: '' }];

  H.toast = function (text, o) { R.UIK.toast(text, Object.assign({ anchor: 'tr' }, o || {})); };

  /** 文字と数を作り直す（入る・宝箱・手がかり・会話・フラグのあと） */
  H.refresh = function () {
    const m = S.map, G = R.Game;
    if (!m) return;
    const c = (S.hud = S.hud || {});
    c.name = m.name || m.id;
    const meta = m.meta || {};
    const loc = m.location && R.DB.locations[m.location];
    c.sub = meta.sub || meta.floor || (m.kind === 'world' && loc ? loc.name : '') || '';
    // 施設のアイコン（町）: 建物の看板から
    c.icons = [];
    if (m.kind === 'town') for (const o of m.objects || []) if (o.type === 'building' && o.sign && FAC[o.sign] && !c.icons.includes(FAC[o.sign])) c.icons.push(FAC[o.sign]);
    // 宝箱の残り（ダンジョンは常に。meta.chestsInfo で町・屋内も）
    const chests = (m.objects || []).filter((o) => o.type === 'chest');
    const showChests = chests.length && (m.kind === 'dungeon' ? meta.chestsInfo !== false : !!meta.chestsInfo);
    const opened = G ? chests.filter((o) => ((G.chests[m.id] || []).includes(o.id))).length : 0;
    c.chests = showChests ? `宝箱 ${opened}/${chests.length}` : '';
    c.chestsDone = showChests && opened === chests.length;
    // 新しい話（E19。ハッシュは EVENTS）
    let nNew = 0;
    for (const n of S.npcs || []) {
      n.isNew = false;
      if (!n.vis || !n.def.key || !n.def.talk) continue;
      try { n.isNew = !!R.Events.isNew(m, n.def); } catch (e) { n.isNew = false; }
      if (n.isNew) nNew++;
    }
    c.newTalk = m.kind === 'town' && nNew ? `新しい話 ${nNew}人` : '';
    // 目印の手がかり
    c.lead = null;
    try {
      const id = G && R.Leads.pinned();
      const L = id && R.DB.leads[id];
      if (L) c.lead = { title: L.title, where: [L.dir ? DIR_JA[L.dir] : '', L.place || ''].filter(Boolean).join('・'), ang: L.dir != null && DIR_ANGLE[L.dir] != null ? DIR_ANGLE[L.dir] : null };
    } catch (e) { c.lead = null; }
    c.showMini = m.kind === 'dungeon' && meta.minimap !== false;
  };

  /** 場所の札を出している強さ 0〜1（入ったとき 2.4 秒、ダンジョンは常に） */
  function placeAlpha() {
    if (S.map.kind === 'dungeon') return 1;
    const dt = R.Engine.time - S.placeT0;
    if (dt < 0) return 0;
    if (dt < 250) return dt / 250;
    if (dt < F.PLACE_MS) return 1;
    return Math.max(0, 1 - (dt - F.PLACE_MS) / 450);
  }
  function showPrompts() {
    const p = R.Settings.get('prompts');
    if (p === 'never') return false;
    if (R.Input.touchVisible()) return false;
    if (p === 'always') return true;
    return !R.Game || (R.Game.playMs || 0) < TWO_H;
  }
  function diamond(g, x, y, r, fill, stroke) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }

  H.draw = function (g, cam) {
    const c = S.hud;
    if (!c || !S.map) return;
    const top = R.Engine.top() === F.scene;
    const U = R.UIK.u, T = R.UIK.T, s = R.safe, tall = R.layout === 'tall';
    const gold = T.color.gold;
    // ---- 左上: 場所
    const a = placeAlpha();
    let ly = s.t + U(18);
    if (a > 0.01) {
      g.save(); g.globalAlpha = a;
      const x = s.l + U(20), y = ly;
      diamond(g, x + U(10), y + U(14), U(9), 'rgba(236,201,124,0.18)', 'rgba(236,201,124,0.85)');
      diamond(g, x + U(10), y + U(14), U(4), gold, null);
      R.UIK.text(g, c.name, x + U(28), y + U(2), { size: U(19), weight: 700, shadow: true });
      const w = R.UIK.measure(c.name, { size: U(19), weight: 700 });
      const gr = g.createLinearGradient(x + U(24), 0, x + U(84) + w, 0);
      gr.addColorStop(0, 'rgba(236,201,124,0.55)'); gr.addColorStop(1, 'rgba(236,201,124,0)');
      g.fillStyle = gr; g.fillRect(x + U(24), y + U(28), w + U(60), 0.75);
      let sy = y + U(34);
      let sx = x + U(28);
      const sub = c.sub;
      if (sub) { R.UIK.text(g, sub, sx, sy, { size: U(11.5), color: T.color.text2, shadow: true }); sx += R.UIK.measure(sub, { size: U(11.5) }) + U(14); }
      if (c.chests) { R.UIK.text(g, c.chests, sx, sy, { size: U(11.5), color: c.chestsDone ? gold : T.color.text2, shadow: true }); sx += R.UIK.measure(c.chests, { size: U(11.5) }) + U(12); }
      if (F.dark.on() && R.MapUtil.darkAt(S.map, S.x, S.y)) R.UIK.chip(g, sx, sy - U(2), '暗い', { color: '#b8b0e8', bg: 'rgba(90,80,160,0.25)' });
      if (sub || c.chests) sy += U(18);
      if (c.icons.length) { for (let i = 0; i < c.icons.length; i++) R.UIK.icon(g, c.icons[i], x + U(28) + i * U(20), sy, U(14), T.color.text2); sy += U(20); }
      if (c.newTalk) { R.UIK.chip(g, x + U(28), sy, c.newTalk, {}); sy += U(22); }
      g.restore();
      ly = sy + U(8);
    }
    // ---- 右上（縦持ちは左上の下）: 手がかりの札・小地図
    let ry = s.t + U(18);
    const cw = tall ? Math.min(R.W - s.l - s.r - U(32), U(330)) : U(244);
    // タッチの操作パッドが出ているときは、右上のメニューのボタンを避ける
    let right = R.W - s.r - U(16);
    if (!tall && R.Input.touchVisible()) { const sp = R.Input.touchSpots().y; if (sp) right = Math.min(right, sp.x - sp.r - U(12)); }
    const cx0 = tall ? s.l + U(16) : right - cw;
    if (tall) ry = Math.max(ly, s.t + U(96));
    if (c.lead) {
      leadCard(g, cx0, ry, cw, c.lead);
      ry += U(62);
    }
    if (c.showMini) F.minimap.draw(g, tall ? cx0 : right - U(138), ry + U(2), U(138), U(150));
    // ---- 吹き出し（近づいたときだけ）
    if (top && !F._locked() && !S.mv && !R.Events.busy()) {
      const f = F._front();
      if (f) {
        const t = cam.t;
        const bx = Math.round((f.x + (f.kind === 'obj' && f.obj.type === 'spring' ? 1 : 0.5)) * t - cam.cx);
        const by = Math.round(f.y * t - cam.cy - (f.kind === 'npc' ? 36 * F._charScale() * (t / 32) : 6));
        B[0].label = f.label;
        R.UIK.bubble(g, bx, by, B);
      }
    }
    // ---- 右下: ボタン表示
    if (top && showPrompts()) R.UIK.prompts(g, S.map.kind === 'dungeon' ? PROMPTS_DUN : PROMPTS_TOWN, 'br');
  };

  function leadCard(g, x, y, w, L) {
    const U = R.UIK.u, T = R.UIK.T;
    R.UIK.panel(g, { x, y, w, h: U(54) }, { r: U(10) });
    R.UIK.icon(g, 'quest', x + U(10), y + U(10), U(16), T.color.gold);
    R.UIK.text(g, '手がかり', x + U(32), y + U(10), { size: U(10), weight: 700, color: T.color.gold });
    R.UIK.text(g, R.UIK.fit(L.title, w - U(70), { size: U(13.5), weight: 700 }), x + U(32), y + U(28), { size: U(13.5), weight: 700 });
    if (L.where) R.UIK.text(g, L.where, x + w - U(12), y + U(10), { size: U(10), color: T.color.text3, align: 'right' });
    if (L.ang != null) {
      const nx = x + w - U(22), ny = y + U(36);
      g.save(); g.translate(nx, ny); g.rotate(L.ang);
      g.beginPath(); g.moveTo(0, -U(8)); g.lineTo(U(4), U(4)); g.lineTo(0, U(1.5)); g.lineTo(-U(4), U(4)); g.closePath();
      g.fillStyle = T.color.gold; g.fill(); g.restore();
    }
  }
})(window.RPG);
