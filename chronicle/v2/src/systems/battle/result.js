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

  const PROF_JA = { sword: R.T('battle.result.PROF_JA.sword'), greatsword: R.T('battle.result.PROF_JA.greatsword'), dagger: R.T('battle.result.PROF_JA.dagger'), bow: R.T('battle.result.PROF_JA.bow'), staff: R.T('battle.result.PROF_JA.staff'), fire: R.T('battle.result.PROF_JA.fire'), ice: R.T('battle.result.PROF_JA.ice'), thunder: R.T('battle.result.PROF_JA.thunder'), wind: R.T('battle.result.PROF_JA.wind'), earth: R.T('battle.result.PROF_JA.earth'), light: R.T('battle.result.PROF_JA.light'), dark: R.T('battle.result.PROF_JA.dark'), heal: R.T('battle.result.PROF_JA.heal'), shield: R.T('battle.result.PROF_JA.shield') };
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
    // 盗んだ物も一覧に入れる（持ち主の決まり 2026-09-27: 手に入れた物は落とした物・盗んだ物・レアを全部見せる）
    const stolen = (rw.stolen || []).map((s) => ({ item: s.item, grade: _.play.gradeOf(s.item, s.stealOnly ? 'super' : s.grade), n: 1, stolen: true }));
    if (!stolen.length) for (const e of st.collected.gains) if (e.stolen) stolen.push({ item: e.item, grade: _.play.gradeOf(e.item, e.stealOnly ? 'super' : e.grade), n: 1, stolen: true });
    // 同じ品はまとめる（落とした物と盗んだ物は別の行）
    const merged = [];
    for (const d of drops.concat(stolen)) { const m = merged.find((x) => x.item === d.item && !!x.stolen === !!d.stolen); if (m) m.n += d.n; else merged.push(Object.assign({}, d)); }
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
    let profUI = null;
    try { if (_.profUI && _.profUI.gather) profUI = _.profUI.gather(st, rw); } catch (e) { console.error('[battle result prof]', e); }
    return { gold: rw.gold || 0, drops: merged, grow, prof, glim, profUI };
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
  const NEXT_PROMPTS = [{ btn: 'a', label: R.T('battle.result.NEXT_PROMPTS.0.label') }];
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
    // 勝利の小さな跳ね（1 人ずつ少しずらす）: 縮む → 跳ぶ（緩急）→ 着地でつぶれて戻る。reduceMotion は跳ねない
    if (!R.Settings.get('reduceMotion')) {
      const P = _.play;
      alive.forEach((u, i) => {
        const v = st.vis[u.uid];
        st.pwait(i * 90).then(() => P.squash(st, v, 1.06, 0.93, 80, 'out'))
          .then(() => { P.squash(st, v, 0.96, 1.05, 120, 'out'); return P.tween(st, v, 'dy', -12, 170, 'out3'); })
          .then(() => P.tween(st, v, 'dy', 0, 150, 'in'))
          .then(() => P.squash(st, v, 1.07, 0.93, 60, 'out')).then(() => P.unsquash(st, v, 180));
      });
    }
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
    if (data.profUI && data.profUI.members.some((m) => m.learned.length)) { try { R.Audio.sfx('glimmer'); } catch (e) { /* ignore */ } }
    await Rs.confirm(st, anyRare ? Bt.MIN.rareCardSkip : 0);
    // 縦持ちで入りきらないときだけ、仲間の続きを次の頁に（頁ごとに決定）
    while (!st.dead && (st.result.pageCount || 1) > (st.result.page || 0) + 1) {
      st.result.page = (st.result.page || 0) + 1; st.result.pageT0 = R.Engine.time;
      await Rs.confirm(st, 0);
    }
    end.pressAt = R.Engine.time; end.pressRt = rt();
    st.log.push({ t: 'victory', ms: R.Engine.time - t0 });
    // 足された札（熟練など）: それぞれ決定を待つ
    if (Rs.pages.length) { await runPages(st, data, rewards); end.pressAt = R.Engine.time; }
    st.closing = true;
  };

  // ---------------------------------------------------------------- 勝利の札（1 枚。2026-09-27 の持ち主の決まり）
  // ゴールド・手に入れた物（落とした物・盗んだ物「盗んだ」・レア ★）・仲間ごとに 最大 HP/MP の伸び・熟練の札（剣 12→13）・覚えた技「✦ …を覚えた！」。
  // 16:9 は 2 列（左: ゴールドと品、右: 仲間）。縦持ちは 1 列。入らないときは品を「ほか N 品」にまとめ、それでも入らない縦持ちだけ仲間を頁に分ける。
  const PU = () => _.profUI || null;
  function geomV(st) {
    const k = R.uiScale || 1, L = st.L;
    if (L.tall) {
      const top = L.stageH * 0.5;
      return { k, tall: true, band: { x: 0, y: top, w: R.W, h: R.H - top }, x0: 20 * k, y0: Math.max(top + 16 * k, L.stageH - 60 * k), lw: R.W - 40 * k, rx: 20 * k, rw: R.W - 40 * k, bottom: R.H - (R.safe.b || 0) - 58 * k };
    }
    const x0 = (R.safe.l || 0) + 40 * k, lw = 250 * k, rx = x0 + lw + 30 * k, rw = Math.min(330 * k, R.W * 0.62 - (rx - 0));
    return { k, tall: false, band: { x: 0, y: 0, w: rx + rw + 40 * k, h: R.H }, x0, y0: 30 * k, lw, rx, rw: Math.max(240 * k, rw), bottom: R.H - (R.safe.b || 0) - 50 * k };
  }
  /** 仲間 1 人の塊: 顔と名前と伸び（1 行目）→ 熟練の札（折り返す）→ 覚えた技の行 */
  function memberLayout(u, m, grow, G) {
    const k = G.k, ck = k * 0.82, P = PU();
    const cx0 = G.rx + 44 * k, cx1 = G.rx + G.rw;
    const chips = [];
    let x = cx0, line = 0;
    for (const up of (m && m.ups) || []) {
      const w = P ? P.chipW(up, ck) : 80 * k;
      if (x > cx0 && x + w > cx1) { x = cx0; line++; }
      chips.push({ up, x, line });
      x += w + 6 * k;
    }
    const chipLines = chips.length ? line + 1 : 0;
    const learned = (m && m.learned) || [];
    const h = 34 * k + chipLines * 24 * k + learned.length * 34 * k + 3 * k;
    return { u, m, grow, chips, chipLines, learned, h };
  }
  /** 札の組み立て（描く前に大きさを決める）→ {G, items:{shown, more}, pages:[[block]]} */
  Rs.layoutVictory = function (st) {
    const res = st.result, d = res.data, G = geomV(st), k = G.k;
    const units = st.partyUnits();
    const profBy = {};
    for (const m of (d.profUI && d.profUI.members) || []) profBy[m.id] = m;
    const blocks = units.map((u) => {
      const c = charOf(u.id);
      return memberLayout(u, profBy[String(u.id)] || null, d.grow[u.id] || (c && d.grow[c.id]) || null, G);
    });
    // 仲間の分からない閃き（まれ）: 最後の塊の後に行だけ
    const orphan = (d.profUI && d.profUI.members || []).filter((m) => !units.some((u) => String(u.id) === m.id));
    for (const m of orphan) if (m.learned.length) blocks.push({ u: null, m, grow: null, chips: [], chipLines: 0, learned: m.learned, h: m.learned.length * 34 * k + 4 * k });
    const GR = { super: 0, rare: 1 };
    const drops = d.drops.slice().sort((a, b) => (GR[a.grade] != null ? GR[a.grade] : 2) - (GR[b.grade] != null ? GR[b.grade] : 2));
    const headH = 58 * k, goldH = G.tall ? 0 : 32 * k, itemH = 30 * k, itemHead = drops.length ? 20 * k : 0, memHead = 20 * k;
    const memTotal = blocks.reduce((s, b) => s + b.h, 0);
    let maxItems, pages;
    if (!G.tall) {
      const room = G.bottom - (G.y0 + headH + goldH + itemHead);
      maxItems = Math.max(1, Math.floor(room / itemH));
      pages = [blocks];
      G.memTop = G.y0 + headH;
      G.memScale = Math.min(1, (G.bottom - G.memTop - memHead) / Math.max(1, memTotal));   // 入らないときは右の列を少し縮める
    } else {
      // 縦持ち: 見出し → ゴールド → 品（4 行まで）→ 仲間。入らなければ品をまとめ、それでも入らなければ仲間を頁に分ける
      maxItems = Math.min(4, drops.length);
      const itemsH = (n) => (drops.length ? itemHead + Math.min(drops.length, n + (drops.length > n ? 1 : 0)) * itemH : 0);
      const top0 = () => G.y0 + headH + goldH + itemsH(maxItems) + 8 * k + memHead;
      while (maxItems > 1 && top0() + memTotal > G.bottom) maxItems--;
      pages = [];
      let cur = [], used = top0();
      for (const b of blocks) {
        if (cur.length && used + b.h > G.bottom) { pages.push(cur); cur = []; used = G.y0 + headH + memHead; }
        cur.push(b); used += b.h;
      }
      pages.push(cur);
      G.memScale = 1;
    }
    const more = drops.length > maxItems ? drops.length - (maxItems - 1) : 0;
    const shown = more ? drops.slice(0, Math.max(1, maxItems - 1)) : drops;
    return { G, shown, more, pages };
  };

  function drawItem(g, dr, x0, ry, colW, k) {
    const Kt = _.K;
    const rr = dr.grade === 'rare' || dr.grade === 'super';
    const col = dr.grade === 'super' ? Kt.COL.superRare : dr.grade === 'rare' ? Kt.COL.rare : Kt.COL.text;
    if (rr) {
      const rgb = dr.grade === 'super' ? '255,182,94' : '134,200,255';
      Kt.box(g, { x: x0 - 8 * k, y: ry - 3 * k, w: colW + 16 * k, h: 27 * k }, { a: 0.45, r: 8 * k, edge: `rgba(${rgb},0.5)` });
      g.save(); g.globalCompositeOperation = 'lighter';
      const gl = g.createRadialGradient(x0 + 8 * k, ry + 11 * k, 1, x0 + 8 * k, ry + 11 * k, 36 * k);
      gl.addColorStop(0, `rgba(${rgb},0.35)`); gl.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gl; g.fillRect(x0 - 30 * k, ry - 26 * k, 76 * k, 76 * k); g.restore();
    }
    Kt.icon(g, _.play.itemIcon(dr.item), x0, ry + 1 * k, 17 * k, rr ? col : Kt.COL.text2);
    const nm = _.play.itemName(dr.item);
    const tag = (dr.stolen ? 44 : 0) * k + (rr ? (dr.grade === 'super' ? 28 : 16) * k : 0);
    const nmS = Kt.fit(nm, colW - 70 * k - tag, { size: 13.5 * k, weight: rr ? 700 : 500 });
    Kt.text(g, nmS, x0 + 26 * k, ry + 2 * k, { size: 13.5 * k, weight: rr ? 700 : 500, color: col, raw: true, shadow: true });
    let tx = x0 + 31 * k + Kt.measure(nmS, { size: 13.5 * k, weight: rr ? 700 : 500 });
    if (rr) { Kt.text(g, dr.grade === 'super' ? '★★' : '★', tx, ry + 3 * k, { size: 12 * k, weight: 700, color: col, raw: true }); tx += (dr.grade === 'super' ? 26 : 14) * k; }
    if (dr.stolen) Kt.text(g, R.T('battle.result.drawItem.text'), tx + 2 * k, ry + 4 * k, { size: 10.5 * k, weight: 700, color: Kt.COL.gold, raw: true, shadow: true });
    Kt.text(g, '×' + dr.n, x0 + colW, ry + 3 * k, { size: 12.5 * k, color: Kt.COL.text2, align: 'right', raw: true, shadow: true });
  }
  function drawMember(g, st, b, x, y, w, k, t) {
    const Kt = _.K, P = PU();
    if (b.u) {
      const u = b.u, alive = st.vis[u.uid] && st.vis[u.uid].alive;
      const r = { x, y, w: 32 * k, h: 32 * k };
      if (P && P.drawFace) P.drawFace(g, { uid: u.uid, look: u.look || u.id }, r, st);
      Kt.text(g, Kt.fit(u.name, 120 * k, { size: 13.5 * k, weight: 700 }), x + 42 * k, y + 8 * k, { size: 13.5 * k, weight: 700, color: alive ? Kt.COL.text : Kt.COL.disabled, raw: true, shadow: true });
      const gr = b.grow;
      if (gr && (gr.hp || gr.mp)) {
        const s = [gr.hp ? R.T('battle.result.drawMember.s.0', { hp: gr.hp }) : '', gr.mp ? R.T('battle.result.drawMember.s.1', { mp: gr.mp }) : ''].filter(Boolean).join('  ');
        Kt.text(g, s, x + w, y + 9 * k, { size: 12 * k, color: Kt.COL.up, align: 'right', raw: true, shadow: true });
      }
    }
    const ck = k * 0.82;
    for (const c of b.chips) if (P && P.drawChipAt) P.drawChipAt(g, c.up, c.x, y + 34 * k + c.line * 24 * k, ck);
    let ly = y + 34 * k + b.chipLines * 24 * k;
    for (const l of b.learned) { if (P && P.drawLearn) P.drawLearn(g, b.m, l, x, ly, w, t, k, 44 * k); ly += 34 * k; }
  }

  Rs.drawVictory = function (g, st) {
    const res = st.result;
    if (!res) return;
    const d = res.data, k = R.uiScale || 1, Kt = _.K, t = R.Engine.time - res.t0;
    const lay = Rs.layoutVictory(st), G = lay.G;
    res.pageCount = lay.pages.length;
    const page = Math.min(res.page || 0, lay.pages.length - 1);
    const ap = (i) => Math.max(0, Math.min(1, ((R.Engine.time - (res.pageT0 || res.t0)) - 80 - i * 60) / 200));
    Kt.band(g, G.band, G.tall ? 'b' : 'l', G.tall ? 0.92 : 0.78);
    let i = 0;
    const row = (fn) => { g.save(); g.globalAlpha = ap(i); g.translate(-(1 - ap(i)) * 12, 0); fn(); g.restore(); i++; };
    const x0 = G.x0, fullW = G.tall ? G.lw : G.rx + G.rw - x0;
    let y = G.y0;
    // 見出しとゴールド
    row(() => {
      g.save();
      g.font = R.Gfx.font(30 * k, 700); g.textBaseline = 'top';
      if ('letterSpacing' in g) g.letterSpacing = 6 * k + 'px';
      g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
      const gr = g.createLinearGradient(0, y, 0, y + 30 * k); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(1, '#f2d08a');
      g.fillStyle = gr; g.fillText(R.T('battle.result.drawVictory.fillText'), x0, y);
      g.restore();
      if (lay.pages.length > 1) Kt.text(g, `${page + 1} / ${lay.pages.length}`, x0 + fullW, y + 8 * k, { size: 13 * k, weight: 700, color: Kt.COL.text2, align: 'right', raw: true, shadow: true });
      Kt.hline(g, x0 - 8 * k, x0 + fullW + 20 * k, y + 44 * k, 0.5, '255,226,160');
    });
    y += 58 * k;
    const memTop = G.tall ? null : y;
    if (page === 0) {
      // ゴールド（縦持ちは見出しの右に並べて 1 行を詰める）
      const gy = G.tall ? y - 50 * k : y, gw = G.tall ? fullW - (lay.pages.length > 1 ? 50 * k : 0) : G.lw;
      row(() => {
        Kt.icon(g, 'coin', x0 + (G.tall ? gw - 190 * k : 0), gy, 18 * k, Kt.COL.text2);
        Kt.text(g, R.T('battle.result.drawVictory.text'), x0 + (G.tall ? gw - 162 * k : 28 * k), gy + 1 * k, { size: 13 * k, color: Kt.COL.text2, raw: true, shadow: true });
        Kt.text(g, '+' + d.gold.toLocaleString('en-US') + ' G', x0 + gw, gy - 2 * k, { size: 18 * k, weight: 700, color: Kt.COL.gold, align: 'right', raw: true, shadow: true });
      });
      if (!G.tall) y += 32 * k;
      if (d.drops.length) {
        row(() => Kt.text(g, R.T('battle.result.drawVictory.text_2'), x0, y, { size: 11.5 * k, weight: 700, color: Kt.COL.text3, raw: true, track: 2 }));
        y += 20 * k;
        for (const dr of lay.shown) { const ry = y; row(() => drawItem(g, dr, x0, ry, G.lw, k)); y += 30 * k; }
        if (lay.more) { const ry = y; row(() => Kt.text(g, R.T('battle.result.drawVictory.text_3', { more: lay.more }), x0 + 26 * k, ry + 2 * k, { size: 13 * k, color: Kt.COL.text2, raw: true, shadow: true })); y += 30 * k; }
      } else {
        row(() => Kt.text(g, R.T('battle.result.drawVictory.text_4'), x0, y, { size: 12 * k, color: Kt.COL.text3, raw: true, shadow: true }));
        y += 24 * k;
      }
      y += 8 * k;
    }
    // 仲間（16:9 は右の列）
    let my = G.tall ? y : memTop;
    const mx = G.tall ? x0 : G.rx;
    row(() => Kt.text(g, R.T('battle.result.drawVictory.text_5'), mx, my, { size: 11.5 * k, weight: 700, color: Kt.COL.text3, raw: true, track: 2 }));
    my += 20 * k;
    const sc = G.memScale || 1;
    g.save();
    if (sc < 1) { g.translate(mx, my); g.scale(sc, sc); g.translate(-mx, -my); }
    for (const b of lay.pages[page] || []) {
      const by = my;
      row(() => drawMember(g, st, b, mx, by, G.rw, k, t));
      my += b.h;
    }
    g.restore();
    // 決定で進む（点滅する ▼）
    if (G.tall) Rs.drawNext(g, st, R.W / 2, R.H - (R.safe.b || 0) - 30 * k);
    else Rs.drawNext(g, st, G.rx + G.rw - 4 * k, R.H - (R.safe.b || 0) - 40 * k);
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
    st.head = { name: R.T('battle.result.escape.head.name'), t0: R.Engine.time };
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
    st.head = { name: R.T('battle.result.lose.head.name'), t0: R.Engine.time };
    Bt.lastEnd = { result: 'lose', at: R.Engine.time };
    await st.pwait(700);
    await headConfirm(st);
  };
})(window.RPG);
