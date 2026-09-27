// BSCENE: 熟練度の見せ方（2026-09-27 の持ち主の報告「誰の何がどれだけ上がったのかが分からなすぎる」）。
//   - 勝利の札の後の「熟練度」の頁: 上がった仲間ごとに 顔・名前・「剣 12→13 ▲1」（系統・属性の印つき）。
//     閃いた技・術は その人の行の下に「✦ アルンは 新技『○○』を覚えた！」を光らせて 1 行ずつ。入らなければ頁を分け、頁ごとに決定を待つ。
//   - 戦闘の中: 段階が上がったら その人の頭の上に小さく「剣+1」（止めない。playback.js の H.prof から pop）。
//   - 強さの画面の ▲: B.finish が note() で R.Game.profNew[人の id][系統か属性] = 上がる前の段階 を覚える（status.js が見たら消す）。
// result.js・playback.js・battle_core.js からは 1 行ずつ呼ぶだけ（ほかの担当が同時に直しているため、描く物はこのファイルに置く）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const PU = (_.profUI = Bt.profUI = {});

  const WT = () => (R.Rules && R.Rules.WTYPES) || ['sword', 'greatsword', 'dagger', 'bow', 'staff'];
  const EL = () => (R.Rules && R.Rules.ELEMENTS) || ['fire', 'water', 'wind', 'earth', 'light', 'dark'];
  const kindOf = (key, kind) => (kind === 'e' || kind === 'element' ? 'e' : kind === 'w' || kind === 'weapon' ? 'w' : EL().includes(key) ? 'e' : 'w');
  function charOf(c) {
    if (c && typeof c === 'object') return c;
    const G = R.Game;
    return (G && G.chars && G.chars[c]) || null;
  }
  /** 系統・属性の短い名前（剣・大剣・火…） */
  PU.name = function (key) {
    const wt = R.DB.weaponTypes && R.DB.weaponTypes[key];
    if (wt && wt.name) return wt.name;
    const el = R.DB.elements && R.DB.elements[key];
    if (el && el.name) return el.name;
    return _.result && _.result.profName ? _.result.profName(key) : key;
  };
  /** 印（R.UIK.icon の名前）。属性は DB.elements の icon（水は 'water' があればそれ） */
  PU.icon = function (key) {
    if (WT().includes(key)) return (R.DB.weaponTypes && R.DB.weaponTypes[key] && R.DB.weaponTypes[key].icon) || key;
    const icons = (R.Contract && R.Contract.ICONS) || [];
    if (icons.includes(key)) return key;
    const el = R.DB.elements && R.DB.elements[key];
    return (el && el.icon) || 'star';
  };
  const elColor = (key) => { const el = R.DB.elements && R.DB.elements[key]; return (el && el.color) || '#8fd6d8'; };

  // ---------------------------------------------------------------- 強さの画面の ▲（R.Game.profNew）
  /** B.finish から: 上がった物の「上がる前の段階」を、見るまで覚える（2 回の戦闘をまたいでも最初の段階を残す） */
  PU.note = function (G, ups) {
    if (!G || !Array.isArray(ups) || !ups.length) return;
    const all = (G.profNew = G.profNew && typeof G.profNew === 'object' ? G.profNew : {});
    for (const p of ups) {
      const cid = p.char != null ? p.char : p.c, key = p.id || p.key;
      if (cid == null || !key || p.from == null) continue;
      const m = (all[cid] = all[cid] || {});
      m[key] = m[key] == null ? p.from : Math.min(m[key], p.from);
    }
  };

  // ---------------------------------------------------------------- 集める
  /**
   * rewards（B.rewards の prof・glimmers）と戦闘の中の出来事（st.collected.prof）から、人ごとの表。
   * → {members:[{id, name, look, alive, ups:[{key, kind, from, to}], learned:[{kind, name}]}]}（何も無ければ members は空）
   */
  PU.gather = function (st, rw) {
    rw = rw || {};
    const byId = {}, order = [];
    const units = st && st.partyUnits ? st.partyUnits() : [];
    const mem = (cid) => {
      const key = cid == null ? '' : String(cid);
      if (byId[key]) return byId[key];
      const u = units.find((x) => String(x.id) === key);
      const c = charOf(cid);
      const m = (byId[key] = { id: key, name: (u && u.name) || (c && c.name) || '', look: (u && (u.look || u.id)) || (c && c.look) || key, uid: u ? u.uid : null, ups: [], learned: [] });
      order.push(m);
      return m;
    };
    const src = (rw.prof || []).concat((st && st.collected && st.collected.prof) || []);
    for (const p of src) {
      if (!p || typeof p !== 'object') continue;
      const key = p.key || p.id;
      if (!key || p.c == null) continue;
      const kind = kindOf(key, p.kind);
      const c = charOf(p.c);
      let to = p.rank != null ? +p.rank : null;
      if (to == null && c && R.Rules && R.Rules.rankOf) to = R.Rules.rankOf(c, kind, key);
      if (to == null) continue;
      const from = p.from != null ? +p.from : to - 1;
      const m = mem(p.c);
      const x = m.ups.find((y) => y.key === key);
      if (x) { x.from = Math.min(x.from, from); x.to = Math.max(x.to, to); }
      else m.ups.push({ key, kind, from, to });
    }
    const seen = {};
    for (const gl of rw.glimmers || []) {
      if (!gl) continue;
      const id = typeof gl === 'string' ? gl : gl.id;
      const a = id && ((R.DB.techs && R.DB.techs[id]) || (R.DB.spells && R.DB.spells[id]));
      const name = (gl && gl.name) || (a && a.name) || (_.names && _.names[id]) || id;
      if (!name) continue;
      const kind = (gl && gl.kind) || (a && a.kind) || 'tech';
      const cid = gl && gl.c != null ? gl.c : null;
      const sk = cid + ':' + name;
      if (seen[sk]) continue;
      seen[sk] = 1;
      mem(cid).learned.push({ kind: kind === 'spell' ? 'spell' : 'tech', name });
    }
    // 隊列の順（戦闘の人の並び）→ 残り
    const pos = (m) => { const i = units.findIndex((u) => String(u.id) === m.id); return i < 0 ? 99 : i; };
    const members = order.filter((m) => m.ups.length || m.learned.length).sort((a, b) => pos(a) - pos(b));
    const ord = WT().concat(EL());
    for (const m of members) m.ups.sort((a, b) => ord.indexOf(a.key) - ord.indexOf(b.key));
    return { members };
  };
  PU.has = (d) => !!(d && d.members && d.members.length);
  /** 覚えた行の文（名前が分からない閃きは「新技『…』を覚えた！」だけ） */
  PU.learnText = function (m, l) {
    const what = l.kind === 'spell' ? `新しい術『${l.name}』` : `新技『${l.name}』`;
    return m.name ? `✦ ${m.name}は ${what}を覚えた！` : `✦ ${what}を覚えた！`;
  };

  // ---------------------------------------------------------------- 戦闘の中の「剣+1」
  PU.pop = function (st, e) {
    if (!st || !e || !_.play || !_.play.pop) return;
    const key = e.key || e.id;
    if (!key) return;
    let uid = e.uid;
    if (uid == null && e.c != null) { const u = st.partyUnits().find((x) => String(x.id) === String(e.c)); uid = u ? u.uid : null; }
    if (uid == null || !st.actor || !st.actor(uid)) return;
    const n = e.rank != null && e.from != null ? Math.max(1, e.rank - e.from) : 1;
    _.play.pop(st, uid, `${PU.name(key)}+${n}`, kindOf(key, e.kind) === 'e' ? 'profE' : 'prof');
  };

  // ---------------------------------------------------------------- 頁（勝利の札の後）
  function geom(st) {
    const k = R.uiScale || 1, L = st.L || {};
    if (L.tall) {
      const top = (L.stageH || R.H * 0.5) * 0.5;
      return { k, tall: true, band: { x: 0, y: top, w: R.W, h: R.H - top }, x0: 20 * k, y0: Math.max(top + 24 * k, (L.stageH || R.H * 0.5) - 50 * k), colW: R.W - 40 * k, nameW: 96 * k, bottom: R.H - (R.safe.b || 0) - 86 * k };
    }
    const bw = Math.min(R.W * 0.74, 820 * k);
    return { k, tall: false, band: { x: 0, y: 0, w: bw, h: R.H }, x0: (R.safe.l || 0) + 48 * k, y0: 36 * k, colW: Math.min(600 * k, bw - 96 * k), nameW: 132 * k, bottom: R.H - (R.safe.b || 0) - 76 * k };
  }
  const CH = { h: 26, gap: 8, lh: 32 };   // 札の高さ・横の間・行の高さ（uiScale を掛ける前）
  function chipParts(u, k) {
    const Kt = _.K;
    const nm = PU.name(u.key), d = Math.max(0, u.to - u.from);
    const s1 = 13.5 * k, s2 = 13 * k, s3 = 12 * k, ic = 15 * k;
    const w1 = Kt.measure(nm, { size: s1, weight: 700 }), w2 = Kt.measure(`${u.from}→${u.to}`, { size: s2, weight: 700 }), w3 = Kt.measure('▲' + d, { size: s3, weight: 700 });
    return { nm, d, s1, s2, s3, ic, w1, w2, w3, w: 10 * k + ic + 6 * k + w1 + 8 * k + w2 + 8 * k + w3 + 10 * k };
  }
  /** 人の行: 札を折り返した並び → {h, chips:[{u, x, y, parts}]} */
  function layoutMember(m, G) {
    const k = G.k, x1 = G.x0 + G.colW;
    const cx0 = G.x0 + 44 * k + G.nameW;
    let x = cx0, y = 0;
    const chips = [];
    for (const u of m.ups) {
      const p = chipParts(u, k);
      if (x > cx0 && x + p.w > x1) { x = cx0; y += CH.lh * k; }
      chips.push({ u, x, y, p });
      x += p.w + CH.gap * k;
    }
    const lines = Math.max(1, Math.ceil((y / (CH.lh * k)) + 1));
    return { h: Math.max(44 * k, lines * CH.lh * k + 10 * k), chips };
  }
  /** 頁に分ける（人の行とその人の覚えた行を 1 つずつの「塊」にして、下の端までに入るだけ） */
  PU.pages = function (st, data) {
    const G = geom(st), k = G.k;
    const blocks = [];
    for (const m of data.members) {
      const lay = layoutMember(m, G);
      blocks.push({ t: 'm', m, lay, h: lay.h });
      for (const l of m.learned) blocks.push({ t: 'l', m, l, h: 40 * k });
    }
    const top = G.y0 + 62 * k, room = Math.max(80 * k, G.bottom - top);
    const pages = [];
    let cur = [], used = 0;
    for (const b of blocks) {
      if (cur.length && used + b.h > room) { pages.push(cur); cur = []; used = 0; }
      cur.push(b); used += b.h;
    }
    if (cur.length) pages.push(cur);
    return { G, pages };
  };

  /** 勝利の札（決定の後）から: 上がった物があれば 1 頁ずつ見せて決定を待つ */
  PU.show = async function (st, data) {
    if (!PU.has(data) || st.dead) return;
    const view = (st.prof = { data, page: 0, t0: R.Engine.time, start: R.Engine.time, played: {} });
    st.ui = {
      prompts: [{ btn: 'a', label: '決定で進む' }],
      update() {},
      draw(g) { PU.draw(g, st); },
    };
    // 最後の頁は閉じる移り（暗くなる）の間も描いたまま（勝利の札に戻さない）
    for (;;) {
      if (st.dead) return;
      const pages = PU.pages(st, data).pages;
      if (view.page >= pages.length) { view.page = pages.length - 1; break; }
      view.t0 = R.Engine.time;
      if ((pages[view.page] || []).some((b) => b.t === 'l') && !view.played[view.page]) {
        view.played[view.page] = true;
        try { R.Audio.sfx('glimmer'); } catch (e) { /* ignore */ }
      }
      await _.result.confirm(st, 0);
      if (view.page >= pages.length - 1) break;
      view.page++;
    }
    if (st.log) st.log.push({ t: 'prof-page', pages: PU.pages(st, data).pages.length, ms: R.Engine.time - view.start });
  };

  function drawFace(g, m, r, st) {
    g.save();
    g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, 7); g.fillStyle = 'rgba(30,32,52,0.9)'; g.fill();
    g.clip();
    const alive = !m.uid || !st.vis || !st.vis[m.uid] || st.vis[m.uid].alive;
    try { if (R.Portrait && R.Portrait.draw) R.Portrait.draw(g, m.look, r, { expr: alive ? 'smile' : 'sad' }); } catch (e) { /* 顔が無い */ }
    g.restore();
    g.save(); g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, 7); g.strokeStyle = 'rgba(240,228,200,0.35)'; g.lineWidth = 1; g.stroke(); g.restore();
  }
  function drawChip(g, c, y0, k) {
    const Kt = _.K, p = c.p, x = c.x, y = y0 + c.y, h = CH.h * k;
    const el = c.u.kind === 'e';
    const tint = el ? elColor(c.u.key) : Kt.COL.gold;
    g.save();
    g.beginPath(); g.roundRect ? g.roundRect(x, y, p.w, h, h / 2) : g.rect(x, y, p.w, h);
    g.fillStyle = 'rgba(14,16,28,0.72)'; g.fill();
    g.strokeStyle = el ? 'rgba(143,214,216,0.45)' : 'rgba(236,201,124,0.45)'; g.lineWidth = 1; g.stroke();
    g.restore();
    let xx = x + 10 * k;
    Kt.icon(g, PU.icon(c.u.key), xx, y + (h - p.ic) / 2, p.ic, tint);
    xx += p.ic + 6 * k;
    Kt.text(g, p.nm, xx, y + (h - p.s1) / 2 - 0.5 * k, { size: p.s1, weight: 700, color: Kt.COL.text, raw: true });
    xx += p.w1 + 8 * k;
    Kt.text(g, `${c.u.from}→${c.u.to}`, xx, y + (h - p.s2) / 2 - 0.5 * k, { size: p.s2, weight: 700, color: Kt.COL.text2, raw: true });
    xx += p.w2 + 8 * k;
    Kt.text(g, '▲' + p.d, xx, y + (h - p.s3) / 2 - 0.5 * k, { size: p.s3, weight: 700, color: Kt.COL.up, raw: true });
  }
  /** 覚えた行: 金の縁の札＋左から右へ流れる光＋✦ の瞬き（reduceMotion なら止めた光） */
  function drawLearn(g, m, l, x, y, w, t, k) {
    const Kt = _.K, h = 32 * k, reduce = R.Settings.get('reduceMotion');
    const r = { x: x + 44 * k, y, w: w - 44 * k, h };
    g.save();
    g.beginPath(); g.roundRect ? g.roundRect(r.x, r.y, r.w, r.h, 8 * k) : g.rect(r.x, r.y, r.w, r.h);
    const bg = g.createLinearGradient(r.x, 0, r.x + r.w, 0);
    bg.addColorStop(0, 'rgba(88,66,24,0.72)'); bg.addColorStop(1, 'rgba(20,18,30,0.55)');
    g.fillStyle = bg; g.fill();
    g.strokeStyle = 'rgba(255,214,130,0.75)'; g.lineWidth = 1; g.stroke();
    g.clip();
    // 流れる光
    const per = 2400, sw = 90 * k;
    const f = reduce ? 0.35 : ((t + 200) % per) / 1100;
    if (f <= 1) {
      const cx = r.x - sw + f * (r.w + sw * 2);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(cx - sw, 0, cx + sw, 0);
      gr.addColorStop(0, 'rgba(255,236,180,0)'); gr.addColorStop(0.5, `rgba(255,236,180,${reduce ? 0.12 : 0.32})`); gr.addColorStop(1, 'rgba(255,236,180,0)');
      g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    }
    g.restore();
    // ✦ の光
    const sx = r.x + 16 * k, sy = r.y + h / 2;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const tw = reduce ? 0.7 : 0.55 + 0.45 * Math.sin(t / 180);
    const gl = g.createRadialGradient(sx, sy, 1, sx, sy, 22 * k);
    gl.addColorStop(0, `rgba(255,230,160,${0.55 * tw})`); gl.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = gl; g.fillRect(sx - 24 * k, sy - 24 * k, 48 * k, 48 * k);
    if (!reduce) {
      for (let i = 0; i < 3; i++) {
        const ph = (t / 900 + i / 3) % 1;
        const px = r.x + 40 * k + ((i * 173) % 100) / 100 * (r.w - 80 * k), py = r.y + 6 * k + ((i * 57) % 20) / 20 * (h - 12 * k);
        const a = Math.sin(ph * Math.PI);
        g.fillStyle = `rgba(255,244,210,${0.8 * a})`;
        const s = (2 + 2 * a) * k;
        g.beginPath(); g.moveTo(px, py - s); g.lineTo(px + s * 0.35, py); g.lineTo(px, py + s); g.lineTo(px - s * 0.35, py); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(px - s, py); g.lineTo(px, py + s * 0.35); g.lineTo(px + s, py); g.lineTo(px, py - s * 0.35); g.closePath(); g.fill();
      }
    }
    g.restore();
    const s = PU.learnText(m, l);
    Kt.text(g, Kt.fit(s, r.w - 24 * k, { size: 14.5 * k, weight: 700 }), r.x + 10 * k, r.y + (h - 14.5 * k) / 2 - 1 * k, { size: 14.5 * k, weight: 700, color: Kt.COL.goldHi, raw: true, shadow: true });
  }

  PU.draw = function (g, st) {
    const view = st.prof;
    if (!view) return;
    const Kt = _.K, { G, pages } = PU.pages(st, view.data), k = G.k;
    const page = pages[Math.min(view.page, pages.length - 1)] || [];
    const t = R.Engine.time - view.t0;
    const ap = (i) => Math.max(0, Math.min(1, (t - 40 - i * 80) / 220));
    Kt.band(g, G.band, G.tall ? 'b' : 'l', G.tall ? 0.92 : 0.8);
    const x0 = G.x0;
    let y = G.y0;
    // 見出し
    g.save();
    g.font = R.Gfx.font(28 * k, 700); g.textBaseline = 'top';
    if ('letterSpacing' in g) g.letterSpacing = 4 * k + 'px';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
    const hg = g.createLinearGradient(0, y, 0, y + 28 * k); hg.addColorStop(0, '#fffdf2'); hg.addColorStop(1, '#f2d08a');
    g.fillStyle = hg; g.fillText('熟練度', x0, y);
    g.restore();
    Kt.text(g, '戦いで上がった熟練度', x0 + 112 * k, y + 12 * k, { size: 12 * k, color: Kt.COL.text3, raw: true, shadow: true });
    if (pages.length > 1) Kt.text(g, `${Math.min(view.page, pages.length - 1) + 1} / ${pages.length}`, x0 + G.colW, y + 10 * k, { size: 13 * k, weight: 700, color: Kt.COL.text2, align: 'right', raw: true, shadow: true });
    Kt.hline(g, x0 - 8 * k, x0 + G.colW + 60 * k, y + 42 * k, 0.5, '255,226,160');
    y += 62 * k;
    page.forEach((b, i) => {
      const by = y;
      g.save();
      g.globalAlpha = ap(i);
      g.translate(-(1 - ap(i)) * 12, 0);
      if (b.t === 'm') {
        const m = b.m, lay = b.lay;
        drawFace(g, m, { x: x0, y: by, w: 34 * k, h: 34 * k }, st);
        Kt.text(g, Kt.fit(m.name || '―', G.nameW - 8 * k, { size: 15 * k, weight: 700 }), x0 + 44 * k, by + 8 * k, { size: 15 * k, weight: 700, color: Kt.COL.text, raw: true, shadow: true });
        for (const c of lay.chips) drawChip(g, c, by + 4 * k, k);
      } else {
        drawLearn(g, b.m, b.l, x0, by + 1 * k, G.colW, t - i * 80, k);
      }
      g.restore();
      y += b.h;
    });
    if (G.tall) _.result.drawNext(g, st, R.W - 28 * k, R.H - (R.safe.b || 0) - 70 * k);
    else _.result.drawNext(g, st, x0 + G.colW + 4 * k, R.H - (R.safe.b || 0) - 62 * k);
  };
})(window.RPG);
