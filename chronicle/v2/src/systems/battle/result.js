// BSCENE: 勝利と報酬（MODERN_UI §6.18、victory.png。Lv・経験値は出さない＝V2_PLAN §0.2）・逃げた・負け（canLose）。
// 全員の勝利のポーズ、左から暗い帯、見出し「勝利」、ゴールド、手に入れた物（レアは青い札と星、超レアは橙の札と光）、
// 仲間ごとの最大 HP/MP の増え方（緑）、熟練は「熟練が上がった：剣・弓・火」と名前だけ（数字なし、A17）、閃いた技。
// 流れ（2026-09-27 の遊びの声）: 倒れる絵が終わる → 0.4 秒 → 勝利のポーズと声 → 札 → [A] 決定で進む（点滅する ▼）。
// 自動では閉じない（倍速でも）。最初の 0.5 秒（レアの品は 0.6 秒、A12）は押しても効かない。足された札（Rs.addPage）→ scene.js が暗くして外す。
// 逃げた・負けた（canLose）も同じくボタンを待つ。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const Rs = (_.result = {});

  const PROF_JA = { sword: '剣', greatsword: '大剣', dagger: '短剣', bow: '弓', staff: '杖', fire: '火', ice: '氷', thunder: '雷', wind: '風', earth: '土', light: '光', dark: '闇', heal: '癒し', shield: '盾' };
  Rs.profName = (key) => PROF_JA[key] || (R.DB.elements && R.DB.elements[key] && R.DB.elements[key].name) || key;

  function charOf(c) {
    if (c && typeof c === 'object') return c;
    const G = R.Game;
    return (G && G.chars && G.chars[c]) || null;
  }

  function collect(st, rw) {
    rw = rw || {};
    const drops = (rw.drops || []).map((d) => ({ item: d.item, grade: _.play.gradeOf(d.item, d.grade), n: d.n || 1 }));
    // 出来事の gain（盗んだ以外）で rewards に無い物も足す
    for (const e of st.collected.gains) if (!e.stolen && !drops.some((d) => d.item === e.item)) drops.push({ item: e.item, grade: _.play.gradeOf(e.item, e.grade), n: 1 });
    // 同じ品はまとめる
    const merged = [];
    for (const d of drops) { const m = merged.find((x) => x.item === d.item); if (m) m.n += d.n; else merged.push(Object.assign({}, d)); }
    const grow = {};
    for (const gr of (rw.grow || []).concat(st.collected.grow)) {
      const c = charOf(gr.c);
      const id = c ? c.id : String(gr.c);
      const o = (grow[id] = grow[id] || { hp: 0, mp: 0 });
      o.hp = Math.max(o.hp, gr.hp || 0); o.mp = Math.max(o.mp, gr.mp || 0);
    }
    const prof = [];
    for (const p of (rw.prof || []).concat(st.collected.prof)) { const key = typeof p === 'string' ? p : p && p.key; const nm = key && Rs.profName(key); if (nm && !prof.includes(nm)) prof.push(nm); }
    const glim = [];
    const techName = (id) => { const t = (R.DB.techs && R.DB.techs[id]) || (R.DB.spells && R.DB.spells[id]); return (t && t.name) || id; };
    for (const gl of (rw.glimmers || [])) { const nm = typeof gl === 'string' ? techName(gl) : gl && (gl.name || techName(gl.id || gl.tech || gl.skill)); if (nm && !glim.includes(nm)) glim.push(nm); }
    return { gold: rw.gold || 0, drops: merged, grow, prof, glim };
  }

  /** ボタンを待つ（2026-09-27 の持ち主の決まり: 戦闘の終わりはボタンを押したときだけ。自動で進まない）。
   *  最初の minMs（既定 0.5 秒）は押しても効かない（押しっぱなしのキーで飛ばさない）。→ 押した実時間 */
  Rs.NEXT_MS = 500;
  Rs.confirm = async function (st, minMs) {
    const t0 = R.Engine.time, min = Math.max(Rs.NEXT_MS, minMs || 0);
    st.next = { t0, min };
    if (R.Input.consume) R.Input.consume();
    await R.until(() => {
      if (st.dead) return true;
      if (R.Engine.time - t0 < min) return false;
      const I = R.Input;
      return I.pressed('a') || !!(I.pointer && I.pointer.pressed);
    });
    st.next = null;
    if (!st.dead) { try { R.Audio.sfx('confirm_soft'); } catch (e) { /* ignore */ } }
    return R.Engine.time - t0;
  };
  /** 点滅する ▼（押せるようになってから）。x, y = ▼ の中心 */
  Rs.drawNext = function (g, st, x, y) {
    const n = st.next;
    if (!n) return;
    const t = R.Engine.time - n.t0;
    if (t < n.min) return;
    const k = R.uiScale || 1;
    const a = (0.55 + 0.45 * Math.cos((t - n.min) / 260)) * Math.min(1, (t - n.min) / 200);
    const bob = R.Settings.get('reduceMotion') ? 0 : Math.sin((t - n.min) / 200) * 2 * k;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = '#f2d08a'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(x - 7 * k, y - 4 * k + bob); g.lineTo(x + 7 * k, y - 4 * k + bob); g.lineTo(x, y + 5 * k + bob); g.closePath(); g.fill();
    g.restore();
  };
  const NEXT_PROMPTS = [{ btn: 'a', label: '決定で進む' }];
  Rs.NEXT_PROMPTS = NEXT_PROMPTS;

  /**
   * 勝利の後の札（ページ）の列。勝利の札（'victory'）の後に order の順で 1 枚ずつ出し、それぞれ決定を待つ。ほかの担当が足してよい:
   *   Rs.addPage({ id, order, when?(st, data, rewards) → bool, run(st, data, rewards) → Promise })
   *   run の中で st.ui = { prompts: Rs.NEXT_PROMPTS, update() {}, draw(g) {…; Rs.drawNext(g, st, x, y)} } を置き、await Rs.confirm(st) で待つ。
   *   st.result は残る（勝利の札の絵を後ろに出したくなければ run の中で st.result = null）。例外は飛ばして次の札へ（戦闘は止めない）。
   */
  Rs.pages = Rs.pages || [];
  Rs.addPage = function (p) {
    if (!p || !p.id || typeof p.run !== 'function') return;
    Rs.pages = Rs.pages.filter((x) => x.id !== p.id).concat([p]).sort((a, b) => (a.order || 0) - (b.order || 0));
  };
  Rs.removePage = function (id) { Rs.pages = Rs.pages.filter((x) => x.id !== id); };
  async function runPages(st, data, rewards) {
    for (const pg of Rs.pages.slice()) {
      if (st.dead) return;
      try {
        if (pg.when && !pg.when(st, data, rewards)) continue;
        await pg.run(st, data, rewards);
        st.log.push({ t: 'page:' + pg.id });
      } catch (e) { console.error('[battle result page ' + pg.id + ']', e); }
    }
  }

  /** 実時間（ms。音の長さと比べる記録用） */
  const rt = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  Rs.rt = rt;
  /** 最後の敵の倒れる絵が終わるまで（上限 1.6 秒） */
  function enemiesGone(st) {
    const t0 = R.Engine.time;
    return R.until(() => st.dead || R.Engine.time - t0 > 1600 || st.actors.every((a) => a.side !== 'enemy' || !st.vis[a.uid] || st.vis[a.uid].alive || st.vis[a.uid].gone >= 1));
  }

  /**
   * 勝利（2026-09-27）: 倒れる絵が終わる → 0.4 秒の間 → 生きている全員の勝利のポーズと勝利の声 → 報酬の札
   * → 決定を待つ（自動では閉じない。声は押した後も最後まで鳴る＝scene.js の finish が止めない）
   */
  Rs.victory = async function (st, rewards) {
    st.phase = 'result';
    st.ui = null; st.tele = null;
    await enemiesGone(st);
    st.head = null;
    await R.wait(400);
    if (st.dead) return;
    try { R.Audio.stopBgm(200); R.Audio.jingle('victory'); } catch (e) { /* ignore */ }
    const alive = st.partyUnits().filter((u) => st.vis[u.uid] && st.vis[u.uid].alive);
    for (const u of alive) { const v = st.vis[u.uid]; v.pose = 'victory'; v.poseT = R.Engine.time; v.dx = 0; }
    const end = (Bt.lastEnd = { result: 'win', poseAt: R.Engine.time, voice: null });
    if (alive.length) {
      const rng = R.rng('victory:' + ((R.Game && R.Game.seed) || 0) + ':' + (R.Game && R.Game.steps || 0));
      const id = _.voice.play(rng.pick(alive), 'victory', { speed: 1, force: true });
      if (id) {
        // 記録（QA）: 声の長さと、鳴り終わった時（場面を閉じた後も数える。手札を直に見る）
        const c = _.voice.current(), h = c && c.h;
        const vs = (end.voice = { id, startAt: R.Engine.time, endAt: null, durMs: null, played: !!h, startRt: rt(), endRt: null });
        R.until(() => {
          const b = h && h.src && h.src.buffer;
          if (b && !vs.durMs) vs.durMs = Math.round(b.duration * 1000);
          if (!h || h.stopped || rt() - vs.startRt > 8000) { vs.endAt = R.Engine.time; vs.endRt = rt(); vs.heardMs = Math.round(vs.endRt - vs.startRt); vs.cut = !!(h && h.src && vs.durMs && vs.heardMs < vs.durMs - 120); return true; }
          return false;
        });
      }
    }
    // ポーズを見せてから札（声はそのまま）
    await R.wait(st.speed() > 1 ? 500 : 850);
    const data = collect(st, rewards);
    const anyRare = data.drops.some((d) => d.grade === 'rare' || d.grade === 'super');
    const t0 = R.Engine.time;
    st.result = { data, t0 };
    end.panelAt = t0;
    if (anyRare) { try { R.Audio.jingle(data.drops.some((d) => d.grade === 'super') ? 'superrare' : 'rare'); } catch (e) { /* ignore */ } }
    st.ui = {
      prompts: NEXT_PROMPTS,
      update() {},
      draw(g) { Rs.drawVictory(g, st); },
    };
    await Rs.confirm(st, anyRare ? Bt.MIN.rareCardSkip : 0);
    end.pressAt = R.Engine.time; end.pressRt = rt();
    st.log.push({ t: 'victory', ms: R.Engine.time - t0 });
    // 足された札（熟練など）: それぞれ決定を待つ
    if (Rs.pages.length) { await runPages(st, data, rewards); end.pressAt = R.Engine.time; }
    st.closing = true;
  };

  Rs.drawVictory = function (g, st) {
    const res = st.result;
    if (!res) return;
    const d = res.data, k = R.uiScale || 1, Kt = _.K, t = R.Engine.time - res.t0, L = st.L;
    const ap = (i) => Math.max(0, Math.min(1, (t - 80 - i * 70) / 200));
    let x0, y, colW;
    if (L.tall) {
      Kt.band(g, { x: 0, y: L.stageH * 0.5, w: R.W, h: R.H - L.stageH * 0.5 }, 'b', 0.9);
      x0 = 20 * k; y = L.stageH - 50 * k; colW = R.W - 40 * k;
    } else {
      Kt.band(g, { x: 0, y: 0, w: Math.min(R.W * 0.66, 640 * k), h: R.H }, 'l', 0.7);
      x0 = (R.safe.l || 0) + 48 * k; y = 36 * k; colW = Math.min(300 * k, R.W * 0.32);
    }
    let i = 0;
    const row = (fn) => { g.save(); g.globalAlpha = ap(i); g.translate(-(1 - ap(i)) * 12, 0); fn(); g.restore(); i++; };
    // 見出し
    row(() => {
      g.save();
      g.font = R.Gfx.font(32 * k, 700); g.textBaseline = 'top';
      if ('letterSpacing' in g) g.letterSpacing = 6 * k + 'px';
      g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
      const gr = g.createLinearGradient(0, y, 0, y + 32 * k); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(1, '#f2d08a');
      g.fillStyle = gr; g.fillText('勝利', x0, y);
      g.restore();
      Kt.hline(g, x0 - 8 * k, x0 + colW + 200 * k, y + 46 * k, 0.5, '255,226,160');
    });
    y += 62 * k;
    row(() => {
      Kt.icon(g, 'coin', x0, y, 18 * k, Kt.COL.text2);
      Kt.text(g, 'ゴールド', x0 + 28 * k, y + 1 * k, { size: 13 * k, color: Kt.COL.text2, raw: true, shadow: true });
      Kt.text(g, '+' + d.gold.toLocaleString('en-US') + ' G', x0 + colW, y - 2 * k, { size: 18 * k, weight: 700, color: Kt.COL.gold, align: 'right', raw: true, shadow: true });
    });
    y += 34 * k;
    // 縦の余白の見積もり（16:9・横持ち）: 下の文（閃き・熟練）の上までに 手に入れた物 → 仲間 が収まるように、
    // 品の行を減らし（レア・超レアを先に、残りは「ほか N 品」）、それでも足りなければ仲間の行を詰める
    const units = st.partyUnits();
    const own = Rs.pages.some((p) => p.id === 'prof');   // 熟練・閃きは次の札（result_prof.js。誰の何がいくつ）
    const nLines = own ? 0 : (d.glim.length ? 1 : 0) + (d.prof.length ? 1 : 0);
    let rh = (L.tall ? 42 : 40) * k;
    let maxRows = L.tall ? 4 : 6;
    if (!L.tall) {
      const footTop = R.H - (R.safe.b || 0) - 40 * k - Math.max(0, nLines - 1) * 18 * k - 10 * k;
      const memberNeed = (n) => 6 * k + 18 * k + units.length * n + 4 * k;
      const dropsHead = d.drops.length ? 20 * k : 0;
      const room = footTop - y - dropsHead - memberNeed(rh);
      maxRows = Math.max(d.drops.length > 1 ? 2 : 1, Math.min(maxRows, Math.floor(room / (34 * k))));   // 一番よい品は必ず見せる
      const left = footTop - y - dropsHead - Math.min(d.drops.length, maxRows) * 34 * k - memberNeed(0);
      if (units.length && left < units.length * rh) rh = Math.max(30 * k, left / units.length);
    }
    if (d.drops.length) {
      row(() => Kt.text(g, '手に入れた物', x0, y, { size: 11.5 * k, weight: 700, color: Kt.COL.text3, raw: true, track: 2 }));
      y += 20 * k;
      const GR = { super: 0, rare: 1 };
      const drops = d.drops.slice().sort((a, b) => (GR[a.grade] != null ? GR[a.grade] : 2) - (GR[b.grade] != null ? GR[b.grade] : 2));
      const more = drops.length > maxRows ? drops.length - (maxRows - 1) : 0;
      const shown = more ? drops.slice(0, maxRows - 1) : drops;
      for (const dr of shown) {
        const ry = y;
        row(() => {
          const rr = dr.grade === 'rare' || dr.grade === 'super';
          const col = dr.grade === 'super' ? Kt.COL.superRare : dr.grade === 'rare' ? Kt.COL.rare : Kt.COL.text;
          if (rr) {
            const rgb = dr.grade === 'super' ? '255,182,94' : '134,200,255';
            Kt.box(g, { x: x0 - 8 * k, y: ry - 3 * k, w: colW + 16 * k, h: 30 * k }, { a: 0.45, r: 8 * k, edge: `rgba(${rgb},0.5)` });
            g.save(); g.globalCompositeOperation = 'lighter';
            const gl = g.createRadialGradient(x0 + 8 * k, ry + 12 * k, 1, x0 + 8 * k, ry + 12 * k, 40 * k);
            gl.addColorStop(0, `rgba(${rgb},0.35)`); gl.addColorStop(1, `rgba(${rgb},0)`);
            g.fillStyle = gl; g.fillRect(x0 - 32 * k, ry - 28 * k, 80 * k, 80 * k); g.restore();
          }
          Kt.icon(g, _.play.itemIcon(dr.item), x0, ry + 2 * k, 18 * k, rr ? col : Kt.COL.text2);
          const nm = _.play.itemName(dr.item);
          Kt.text(g, Kt.fit(nm, colW - 80 * k, { size: 14 * k, weight: rr ? 700 : 500 }), x0 + 28 * k, ry + 3 * k, { size: 14 * k, weight: rr ? 700 : 500, color: col, raw: true, shadow: true });
          if (rr) Kt.text(g, dr.grade === 'super' ? '★★' : '★', x0 + 34 * k + Kt.measure(nm, { size: 14 * k, weight: 700 }), ry + 4 * k, { size: 12 * k, weight: 700, color: col, raw: true });
          Kt.text(g, '×' + dr.n, x0 + colW, ry + 4 * k, { size: 13 * k, color: Kt.COL.text2, align: 'right', raw: true, shadow: true });
        });
        y += 34 * k;
      }
      if (more) {
        const ry = y;
        row(() => Kt.text(g, `ほか ${more} 品`, x0 + 28 * k, ry + 3 * k, { size: 13 * k, color: Kt.COL.text2, raw: true, shadow: true }));
        y += 34 * k;
      }
    }
    // 仲間
    y += 6 * k;
    row(() => Kt.text(g, '仲間', x0, y, { size: 11.5 * k, weight: 700, color: Kt.COL.text3, raw: true, track: 2 }));
    y += 18 * k;
    units.forEach((u, j) => {
      const ry = y + j * rh;
      row(() => {
        const r = { x: x0, y: ry, w: 32 * k, h: 32 * k };
        g.save();
        g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, 7); g.fillStyle = 'rgba(30,32,52,0.9)'; g.fill();
        g.clip();
        try { if (R.Portrait && R.Portrait.draw) R.Portrait.draw(g, u.look || u.id, r, { expr: st.vis[u.uid] && st.vis[u.uid].alive ? 'smile' : 'sad' }); } catch (e) { /* 顔が無い */ }
        g.restore();
        g.save(); g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, 0, 7); g.strokeStyle = 'rgba(240,228,200,0.3)'; g.lineWidth = 1; g.stroke(); g.restore();
        const alive = st.vis[u.uid] && st.vis[u.uid].alive;
        Kt.text(g, u.name, x0 + 42 * k, ry + 7 * k, { size: 13.5 * k, weight: 700, color: alive ? Kt.COL.text : Kt.COL.disabled, raw: true, shadow: true });
        const c = charOf(u.id);
        const gr = d.grow[u.id] || (c && d.grow[c.id]);
        if (gr && (gr.hp || gr.mp)) {
          if (gr.hp) Kt.text(g, '最大HP +' + gr.hp, x0 + colW, ry + (gr.mp ? 0 : 8) * k, { size: 12 * k, color: Kt.COL.up, align: 'right', raw: true, shadow: true });
          if (gr.mp) Kt.text(g, '最大MP +' + gr.mp, x0 + colW, ry + (gr.hp ? 16 : 8) * k, { size: 12 * k, color: Kt.COL.up, align: 'right', raw: true, shadow: true });
        }
      });
    });
    y += units.length * rh + 8 * k;
    const lines = [];
    if (d.glim.length && !own) lines.push(['閃いた技：' + d.glim.join('・'), Kt.COL.gold]);
    if (d.prof.length && !own) lines.push(['熟練が上がった：' + d.prof.join('・'), Kt.COL.text3]);
    lines.forEach(([s, c], j) => row(() => Kt.text(g, Kt.fit(s, colW + 180 * k, { size: 11.5 * k }), x0, (L.tall ? y : R.H - (R.safe.b || 0) - 40 * k - (lines.length - 1 - j) * 18 * k) + (L.tall ? j * 18 * k : 0), { size: 11.5 * k, color: c, raw: true, shadow: true })));
    // 決定で進む（点滅する ▼。札の右下）
    if (L.tall) Rs.drawNext(g, st, R.W - 28 * k, R.H - (R.safe.b || 0) - 70 * k);
    else Rs.drawNext(g, st, x0 + colW + 4 * k, R.H - (R.safe.b || 0) - 62 * k);
  };

  /** 見出しの後ろに ▼ を出して決定を待つ（逃げた・負けた） */
  async function headConfirm(st) {
    st.ui = {
      prompts: NEXT_PROMPTS,
      update() {},
      draw(g) {
        const k = R.uiScale || 1, h = st.head;
        if (!h) return;
        const w = _.K.measure(h.name, { size: 17 * k, weight: 700 });
        Rs.drawNext(g, st, (R.safe.l || 0) + 16 * k + 38 * k + w + 16 * k, (R.safe.t || 0) + 14 * k + 12 * k);
      },
    };
    await Rs.confirm(st, 0);
    st.ui = null;
  }
  /** 逃げた（2026-09-27）: 一行が振り返って右へ走り去る → 決定を待つ → scene.js が暗くして外す */
  Rs.escape = async function (st) {
    st.phase = 'result';
    st.ui = null; st.tele = null;
    st.head = { name: 'うまく逃げきれた！', t0: R.Engine.time };
    Bt.lastEnd = { result: 'escape', at: R.Engine.time };
    try { R.Audio.sfx('escape'); } catch (e) { /* ignore */ }
    const reduce = _.trans.reduce();
    const party = st.partyUnits().filter((u) => st.vis[u.uid] && st.vis[u.uid].alive);
    party.forEach((u, i) => {
      const v = st.vis[u.uid];
      v.pose = 'step'; v.poseT = R.Engine.time;
      if (reduce) { _.play.tween(st, v, 'appear', 0, 400); return; }
      st.pwait(i * 60).then(() => { _.play.tween(st, v, 'dx', 300, 620); st.pwait(260).then(() => _.play.tween(st, v, 'appear', 0, 360)); });
    });
    await st.pwait(reduce ? 420 : 760 + party.length * 60);
    await headConfirm(st);
  };
  Rs.lose = async function (st) {
    st.phase = 'result';
    st.ui = null; st.tele = null;
    st.head = { name: '一行は力尽きた……。', t0: R.Engine.time };
    Bt.lastEnd = { result: 'lose', at: R.Engine.time };
    await st.pwait(700);
    await headConfirm(st);
  };
})(window.RPG);
