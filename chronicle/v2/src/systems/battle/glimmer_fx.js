// BSCENE: 閃きの瞬間（MODERN_UI §6.17・§3.6、glimmer.png）。画面が一瞬暗くなり（150 ms）→ 閃いた人の頭の上に電球（ピコーン）→
// 右上の一覧のその人の行が金に光り → 左上の帯に「閃き」と技名（h1、金）を 900 ms（倍速・早送りでも 0.9 秒）→ 戻る（200 ms）。
// その後の act（閃いた技をその場で繰り出す）は playback がふつうに演出する。
// 派生技（e.from がある。行動の後に出る）: 同じ帯に「〇〇から、」（小）と「△△を編み出した！」（大）。技は繰り出さないので、
// 帯は戦闘の速さに合わせて短く（DERIVE_MS ÷ battleSpeed。1 / 2 / 3 / 5 → 1.1 / 0.55 / 0.37 / 0.22 秒）出して、消えるまで待つ。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const G = (_.glimmer = {});

  G.DERIVE_MS = 1100;
  G.play = async function (st, e) {
    if (e && e.from) return G.playDerive(st, e);
    const u = st.unit(e.uid);
    const lessFlash = R.Settings.get('lessFlash');
    const t0 = R.Engine.time;
    const dimTo = lessFlash ? 0.25 : 0.45;
    // 暗く（150 ms）
    await R.until(() => { st.dim = Math.min(dimTo, dimTo * (R.Engine.time - t0) / 150); return R.Engine.time - t0 >= 150 || st.dead; });
    st.glim = { uid: e.uid, t0: R.Engine.time };
    if (u && u.side === 'party') st.glowUid = e.uid;
    try { R.Audio.sfx('glimmer'); } catch (err) { /* ignore */ }
    if (u) _.voice.play(u, 'glimmer', { speed: 1, force: true });
    // 技名の帯は実時間で 900 ms 出して 200 ms で戻る（倍速・早送りでも。G.tick が片付ける）。その間に閃いた技を繰り出す
    st.banner = { name: e.name || '', kind: e.kind, t0: R.Engine.time, dimTo };
    await R.until(() => R.Engine.time - st.banner.t0 >= 420 || st.dead);
  };
  /** 派生技: 行動の後。暗く → 電球と帯（短い）→ 戻る。速さ ×2 以上は声を出さない */
  G.playDerive = async function (st, e) {
    const u = st.unit(e.uid);
    const sp = Math.max(1, (st.speed && st.speed()) || 1);
    const lessFlash = R.Settings.get('lessFlash');
    const dimTo = lessFlash ? 0.2 : 0.35;
    const t0 = R.Engine.time, dimMs = 150 / sp;
    await R.until(() => { st.dim = Math.min(dimTo, dimTo * (R.Engine.time - t0) / dimMs); return R.Engine.time - t0 >= dimMs || st.dead; });
    st.glim = { uid: e.uid, t0: R.Engine.time };
    if (u && u.side === 'party') st.glowUid = e.uid;
    try { R.Audio.sfx('glimmer'); } catch (err) { /* ignore */ }
    if (u && sp < 2) _.voice.play(u, 'glimmer', { speed: 1, force: true });
    const hold = Math.round(G.DERIVE_MS / sp);
    st.banner = { name: (e.name || '') + 'を編み出した！', head: (e.fromName || '') + 'から、', kind: e.kind, derive: true, t0: R.Engine.time, dimTo, hold, fade: Math.max(80, Math.round(200 / sp)) };
    st.banner.release = st.banner.t0;
    await R.until(() => !st.banner || st.dead);
  };
  /** 帯と暗さの片付け（場面の update から毎フレーム） */
  G.tick = function (st) {
    const b = st.banner;
    if (!b) return;
    const t = R.Engine.time - b.t0;
    // 閃いた技を繰り出し終わる（release）まで、かつ最短 0.9 秒は出したまま
    const from = b.derive ? b.hold : Math.max(Bt.MIN.glimmerName, b.release != null ? b.release - b.t0 : Infinity);
    if (t < from) return;
    const k = Math.min(1, (t - from) / (b.fade || 200));
    b.out = k;
    st.dim = b.dimTo * (1 - k);
    if (k >= 1) {
      st.log.push({ t: b.derive ? 'derive-name' : 'glimmer-name', ms: t });
      st.banner = null; st.glim = null; st.glowUid = null; st.dim = 0;
    }
  };
  /** 演出の終わりで帯が残っていたら、出し切るまで待つ（最短 0.9 秒を守る） */
  G.settle = function (st) { if (st.banner && st.banner.release == null) st.banner.release = R.Engine.time; return R.until(() => !st.banner || st.dead); };
  /** 閃いた技の行動が終わった */
  G.release = function (st) { if (st.banner && st.banner.release == null) st.banner.release = R.Engine.time; };

  /** 電球（頭の上）。世界の上・HUD の下 */
  G.drawWorld = function (g, st) {
    const gl = st.glim;
    if (!gl) return;
    const a = st.actor(gl.uid);
    if (!a) return;
    const t = R.Engine.time - gl.t0;
    const k = Math.min(1, t / 120);
    const x = a.x + (st.vis[a.uid] ? st.vis[a.uid].dx || 0 : 0), y = a.y - _.actors.height(a) - 24;
    g.save();
    g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(x, y, 0, x, y, 60);
    gr.addColorStop(0, `rgba(255,236,170,${0.8 * k})`); gr.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr; g.fillRect(x - 60, y - 60, 120, 120);
    gr = g.createRadialGradient(x, y, 0, x, y, 22);
    gr.addColorStop(0, `rgba(255,255,235,${k})`); gr.addColorStop(1, 'rgba(255,255,235,0)');
    g.fillStyle = gr; g.fillRect(x - 22, y - 22, 44, 44);
    g.restore();
    g.save();
    g.globalAlpha = k;
    _.K.icon(g, 'bulb', x - 13, y - 15, 26, '#fff6d6');
    g.strokeStyle = 'rgba(255,240,200,0.9)'; g.lineWidth = 1.5; g.lineCap = 'round';
    const pop = Math.min(1, t / 200);
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4 - Math.PI / 2;
      g.beginPath(); g.moveTo(x + Math.cos(ang) * (16 + 4 * pop), y + Math.sin(ang) * (16 + 4 * pop)); g.lineTo(x + Math.cos(ang) * (22 + 6 * pop), y + Math.sin(ang) * (22 + 6 * pop)); g.stroke();
    }
    g.restore();
  };

  /** 技名の帯（左上寄り。縦持ちは戦場の上） */
  G.drawBanner = function (g, st) {
    const b = st.banner;
    if (!b) return;
    const k = R.uiScale || 1, Kt = _.K, t = R.Engine.time - b.t0;
    const a = Math.min(1, t / 120) * (1 - (b.out || 0));
    const tall = st.L.tall;
    const cx = tall ? R.W / 2 : Math.min(R.W * 0.3, 300 * k) + (R.safe.l || 0), cy = tall ? 150 * k : 120 * k;
    const x1 = tall ? 16 * k : 40 * k, x2 = tall ? R.W - 16 * k : Math.min(R.W * 0.62, 600 * k);
    g.save();
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, cy - 44 * k, 0, cy + 30 * k);
    gr.addColorStop(0, 'rgba(10,10,16,0)'); gr.addColorStop(0.5, 'rgba(10,10,16,0.55)'); gr.addColorStop(1, 'rgba(10,10,16,0)');
    g.fillStyle = gr; g.fillRect(0, cy - 44 * k, x2 + 40 * k, 84 * k);
    Kt.hline(g, x1, x2, cy - 36 * k, 0.7, '255,226,160');
    Kt.hline(g, x1, x2, cy + 32 * k, 0.7, '255,226,160');
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(cx, cy, 4, cx, cy, 200 * k);
    gl.addColorStop(0, 'rgba(255,214,130,0.22)'); gl.addColorStop(1, 'rgba(255,214,130,0)');
    g.fillStyle = gl; g.fillRect(cx - 200 * k, cy - 60 * k, 400 * k, 120 * k);
    g.globalCompositeOperation = 'source-over';
    Kt.text(g, b.head || '閃き', cx, cy - 30 * k, { size: (b.head ? 15 : 13) * k, weight: 700, color: Kt.COL.gold, align: 'center', raw: true, shadow: true, track: b.head ? 2 : 6 });
    // 技名（金のグラデーション）
    const size = Math.min(34 * k, (x2 - x1 - 20 * k) / Math.max(1, [...b.name].length) / 1.1);
    const sc = R.Settings.get('reduceMotion') ? 1 : 1 + 0.08 * Math.max(0, 1 - t / 180);
    g.save();
    g.translate(cx, cy + 22 * k);
    g.scale(sc, sc);
    g.font = R.Gfx.font(size, 700);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = 4 * k + 'px';
    g.lineJoin = 'round'; g.strokeStyle = 'rgba(60,30,0,0.9)'; g.lineWidth = 5 * k;
    g.shadowColor = 'rgba(60,30,0,0.9)'; g.shadowBlur = 10 * k;
    g.strokeText(b.name, 0, 0);
    g.shadowBlur = 0;
    const tg = g.createLinearGradient(0, -size, 0, 0);
    tg.addColorStop(0, '#fffdf2'); tg.addColorStop(0.5, '#ffe7a8'); tg.addColorStop(1, '#e2b35c');
    g.fillStyle = tg; g.fillText(b.name, 0, 0);
    g.restore();
    g.restore();
  };
})(window.RPG);
