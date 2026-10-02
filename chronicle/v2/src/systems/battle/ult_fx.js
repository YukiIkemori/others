// BSCENE: ボスの必殺技の差し込み（持ち主 2026-10-02「ボスの必殺技、極め技のエフェクト…リッチにいこう」）。
//   必殺技（演出の表の行に ult: 1。src/art/fx/fx_seq_table_boss.js）を出す時、演出の前に短く:
//   画面が暗くなり（ボスの周りは明るいまま）→ ボスへ集中線・ボスが一瞬大きくなって光る・画面が揺れる →
//   斜めの帯に「必殺技」と技名 → 帯が抜けて、その技のオリジナルの演出（R.BFX.seq）へ。
//   長さ: 初めて見る技は 1.1 秒、2 回目からは 0.65 秒。戦闘の速さで割る（×2 → 半分）。くり返し（オート）中は 2 回目と同じ短さ。
//   動きを減らす設定では揺れ・大きくなる動きを出さない。閃光を減らす設定では光を弱く。
//   描くのは glimmer の帯（_.glimmer.drawBanner）の後（scene.js は変えない: 帯を描く関数を包む）。
//   戦闘の始めに、出てくるボスの必殺技・大技の画像の部品を先に読む（初めて描く時に絵が抜けない）。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const U = (_.ult = {});
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* ignore */ } };
  const SEQ = () => (R.BFX && R.BFX.seq) || null;
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  U.FULL_MS = 1100;
  U.SHORT_MS = 650;
  /** 演出の id が必殺技か */
  U.is = (sid) => { const S = SEQ(); return !!(S && S.isUlt && S.isUlt(sid)); };
  /** 差し込みの長さ（ms、実時間） */
  U.msFor = function (st, sid) {
    const S = SEQ();
    const sp = Math.max(1, (st.speed && st.speed()) || 1);
    const rep = !!(st.B && st.B.repeatOn);
    const seen = !!(S && S.seen && S.seen(sid));
    return Math.round((seen || rep ? U.SHORT_MS : U.FULL_MS) / sp);
  };

  /** 差し込みを出して、帯が抜け始めるまで待つ（e = act の出来事、ctx.seq = 演出の id） */
  U.play = async function (st, e, ctx) {
    const S = SEQ();
    const sid = ctx.seq;
    const spec = S && S.get(sid);
    const a = st.actor(e.uid), v = st.vis[e.uid];
    if (!spec || !a) return;
    const ms = U.msFor(st, sid);
    const rm = !!R.Settings.get('reduceMotion');
    const lf = !!R.Settings.get('lessFlash');
    const t0 = R.Engine.time;
    st.ult = { uid: e.uid, name: e.name || spec.name || '', t0, ms, pal: spec.pal, rm, lf, seed: (S.hs ? S.hs(String(sid)) : 7) };
    st.log.push({ t: 'ult', id: sid, ms });
    // 見た記録（2 回目からは短く。技・術と同じ R.Game.vars.fx_seen）
    if (S.markSeen) S.markSeen(sid);
    sfx('roar');
    if (v) {
      v.flash = 0.8;
      if (!rm && _.play && _.play.squash) _.play.squash(st, v, 1.1, 1.1, Math.round(ms * 0.22), 'out').then(() => _.play.unsquash && _.play.unsquash(st, v, Math.round(ms * 0.3)));
    }
    if (!rm && R.Settings.get('shake') !== 'off') st.shake = { t0: t0 + ms * 0.12, ms: Math.max(160, ms * 0.45), amp: 4 };
    setTimeout(() => sfx('magic'), Math.round(ms * 0.35));
    // 暗さは描く時に（ボスの周りを残す。HUD も少し沈む）。帯が抜け始めたら演出の表の暗さとつなぐ
    await R.until(() => R.Engine.time - t0 >= ms || st.dead);
    if (st.ult) st.ult.out = R.Engine.time;
  };

  // ---------------------------------------------------------------- 描く
  const RGBc = (s, a) => `rgba(${s},${a})`;
  function draw(g, st) {
    const u = st.ult;
    if (!u) return;
    const now = R.Engine.time;
    const fadeMs = Math.max(120, u.ms * 0.25);
    const outK = u.out ? cl((now - u.out) / fadeMs) : 0;
    if (outK >= 1) { st.ult = null; return; }
    const k = cl((now - u.t0) / u.ms);
    const a = st.actor(u.uid);
    const ks = R.uiScale || 1;
    const W = R.W, Hs = st.L && st.L.tall ? st.L.stageH : R.H;
    const pal = u.pal || ['255,220,150', '255,250,230', '200,120,40'];
    const env = (1 - outK) * Math.min(1, k / 0.12);
    g.save();
    // 1) ボスの周りを明るく残した暗さ（集中）。暗さの残り（out の間）
    if (a) {
      const h = _.actors && _.actors.height ? _.actors.height(a) : 100;
      const v = st.vis[u.uid] || {};
      const bx = a.x + (v.dx || 0), by = a.y - h * 0.5;
      const r0 = h * (0.9 - 0.25 * k);
      const gr = g.createRadialGradient(bx, by, r0 * 0.4, bx, by, Math.max(W, Hs) * 0.9);
      gr.addColorStop(0, 'rgba(6,4,14,0)');
      gr.addColorStop(0.25, `rgba(6,4,14,${0.35 * env})`);
      gr.addColorStop(1, `rgba(6,4,14,${0.6 * env})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, R.H);
      if (u.out) { g.fillStyle = `rgba(6,6,14,${0.5 * (1 - outK)})`; g.fillRect(0, 0, W, R.H); }
      // 2) ボスへの集中線（動きを減らす設定では出さない）と、ボスの後ろの光
      g.globalCompositeOperation = 'lighter';
      const gl = g.createRadialGradient(bx, by, 0, bx, by, h * 1.3);
      gl.addColorStop(0, RGBc(pal[0], (u.lf ? 0.25 : 0.45) * env * (1 - k * 0.5)));
      gl.addColorStop(1, RGBc(pal[0], 0));
      g.fillStyle = gl; g.fillRect(bx - h * 1.4, by - h * 1.4, h * 2.8, h * 2.8);
      if (!u.rm) {
        const n = 30, R0 = Math.max(W, Hs) * 0.9, flick = Math.floor((now - u.t0) / 60);
        g.fillStyle = RGBc(pal[1], 0.28 * env * (1 - k * 0.6));
        for (let i = 0; i < n; i++) {
          const s = u.seed + i * 13 + flick * 977;
          const hr = SEQ().hr;
          const ang = (i + hr(s) * 0.8) / n * Math.PI * 2, w = 0.008 + hr(s + 1) * 0.014;
          const r1 = h * (0.9 + hr(s + 2) * 0.8);
          g.beginPath();
          g.moveTo(bx + Math.cos(ang) * R0, by + Math.sin(ang) * R0);
          g.lineTo(bx + Math.cos(ang + w) * R0, by + Math.sin(ang + w) * R0);
          g.lineTo(bx + Math.cos(ang + w / 2) * r1, by + Math.sin(ang + w / 2) * r1);
          g.closePath(); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    // 3) 斜めの帯（右から入って、終わりに左へ抜ける）に「必殺技」と技名
    const inK = 1 - Math.pow(1 - cl(k / 0.16), 3);
    const slide = (1 - inK) * W * 0.7 - (outK * outK) * W * 0.9;
    const cy = st.L && st.L.tall ? Hs * 0.42 : Hs * 0.4;
    const bh = 62 * Math.min(1.3, ks);
    const sk = bh * 0.55;
    g.translate(slide, 0);
    g.globalAlpha *= 1 - outK * 0.5;
    const bg = g.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, 'rgba(10,6,18,0)'); bg.addColorStop(0.12, 'rgba(10,6,18,0.88)'); bg.addColorStop(0.88, 'rgba(10,6,18,0.88)'); bg.addColorStop(1, 'rgba(10,6,18,0)');
    g.fillStyle = bg;
    g.beginPath(); g.moveTo(-20, cy - bh / 2 + sk); g.lineTo(W + 20, cy - bh / 2 - sk); g.lineTo(W + 20, cy + bh / 2 - sk); g.lineTo(-20, cy + bh / 2 + sk); g.closePath(); g.fill();
    g.globalCompositeOperation = 'lighter';
    for (const dy of [-bh / 2, bh / 2]) {
      const lg = g.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, RGBc(pal[0], 0)); lg.addColorStop(0.5, RGBc(pal[0], 0.95)); lg.addColorStop(1, RGBc(pal[0], 0));
      g.strokeStyle = lg; g.lineWidth = 2.5 * Math.min(1.3, ks);
      g.beginPath(); g.moveTo(-20, cy + dy + sk); g.lineTo(W + 20, cy + dy - sk); g.stroke();
    }
    // 帯の上を流れる光
    const hr = SEQ().hr;
    for (let i = 0; i < 12; i++) {
      const s = u.seed + i * 17, x = ((hr(s) + k * (1.2 + hr(s + 1))) % 1) * W, y = cy + (hr(s + 2) - 0.5) * bh * 0.8 - (x / W - 0.5) * sk * 2;
      g.strokeStyle = RGBc(pal[1], 0.35); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 50 + hr(s + 3) * 90, y - 4); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    // 見出し（小）と技名（大）
    const font = (sz) => (R.Gfx && R.Gfx.font ? R.Gfx.font(sz, 700) : `700 ${sz}px sans-serif`);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const tx = W * 0.5 + (1 - inK) * 40;
    const head = R.T ? R.T('battle.ult.head') : '';
    const hs = 14 * Math.min(1.3, ks);
    g.font = font(hs);
    if ('letterSpacing' in g) g.letterSpacing = Math.round(8 * ks) + 'px';
    g.fillStyle = RGBc(pal[1], 0.95);
    g.fillText(head, tx, cy - bh * 0.34);
    const name = u.name || '';
    const size = Math.min(40 * Math.min(1.3, ks), (W * 0.72) / Math.max(1, [...name].length) / 1.05);
    const pop = u.rm ? 1 : 1 + 0.1 * Math.max(0, 1 - (now - u.t0) / 200);
    g.save();
    g.translate(tx, cy + bh * 0.1);
    g.scale(pop, pop);
    g.font = font(size);
    if ('letterSpacing' in g) g.letterSpacing = Math.round(6 * ks) + 'px';
    g.lineJoin = 'round'; g.lineWidth = 6 * Math.min(1.3, ks); g.strokeStyle = 'rgba(12,6,20,0.95)';
    g.strokeText(name, 0, 0);
    const tg = g.createLinearGradient(0, -size / 2, 0, size / 2);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.55, `rgb(${pal[1]})`); tg.addColorStop(1, `rgb(${pal[0]})`);
    g.fillStyle = tg; g.fillText(name, 0, 0);
    g.restore();
    g.restore();
  }
  U.draw = draw;

  // ---------------------------------------------------------------- 先に読む（戦闘の始めに 1 回）
  function preload(st) {
    st._ultPre = true;
    const S = SEQ(), I = R.BFX && R.BFX.img;
    if (!S || !S.partsOf || !I || !I.preload || !R.DB) return;
    const ids = new Set();
    for (const a of st.actors || []) {
      if (a.side === 'party') continue;
      const M = R.DB.monsters && R.DB.monsters[a.id];
      if (!M || !(M.flags || []).includes('boss')) continue;
      for (const x of M.actions || []) {
        const d = R.DB.bossActions && R.DB.bossActions[x.id];
        if (!d) continue;
        for (const id of [x.id, d.telegraph && d.telegraph.next]) if (id && S.table[id]) S.partsOf(id).forEach((p) => ids.add(p));
      }
    }
    for (const C of Object.values(R.DB.enemyCombos || {})) for (const s of C.steps || []) if (s.seq && /^sq:ec_b_/.test(s.seq) && (C.members || []).some((m) => m.mon && [].concat(m.mon).some((mm) => (st.actors || []).some((a) => a.id === mm)))) S.partsOf(s.seq).forEach((p) => ids.add(p));
    const list = [...ids].filter((id) => I.has(id));
    if (list.length) { try { I.preload(list); } catch (e) { /* ignore */ } }
    st._ultParts = list;
  }
  U.preload = preload;

  // 帯を描く関数を包む（scene.js の draw の、閃きの帯の後）
  const G = _.glimmer;
  if (G && G.drawBanner && !G.drawBanner._ult) {
    const db0 = G.drawBanner;
    G.drawBanner = function (g, st) {
      db0(g, st);
      if (!st._ultPre && st.actors && st.actors.length) preload(st);
      if (st.ult) draw(g, st);
    };
    G.drawBanner._ult = true;
  }
})(window.RPG);
