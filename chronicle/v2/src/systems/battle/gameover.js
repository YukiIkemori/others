// BSCENE: 全滅（MODERN_UI §6.19・V2_PLAN §2.5.3）。画面がゆっくり暗くなり、一行のランタンの灯が消える →「灯が消えた……」→
// 直前の戦闘からやり直す（既定・全快で始める・失う物なし）／最後に泊まった宿から（所持金が半分）／タイトルへ。カーソルは毎回「やり直す」（設定 wipe は見ない。2026-10-04）。
//   _.gameover.run(st) → 'retry' | 'inn' | 'title'（片付けは scene.js の finish と R.Flow.wipe）
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});
  const Go = (_.gameover = {});

  Go.CHOICES = [
    { key: 'retry', label: R.T('battle.gameover.CHOICES.retry.label'), sub: R.T('battle.gameover.CHOICES.retry.sub') },
    { key: 'inn', label: R.T('battle.gameover.CHOICES.inn.label'), sub: R.T('battle.gameover.CHOICES.inn.sub') },
    { key: 'title', label: R.T('battle.gameover.CHOICES.title.label'), sub: '' },
  ];
  Go.SAFE = { label: R.T('battle.gameover.CHOICES.safe.label'), sub: R.T('battle.gameover.CHOICES.safe.sub') };

  Go.run = async function (st) {
    st.phase = 'gameover';
    st.ui = null; st.head = null; st.tele = null; st.card = null;
    try { R.Audio.stopBgm(900); } catch (e) { /* ignore */ }
    const go = (st.go = { t0: R.Engine.time, dark: 0, flame: 1, text: 0, menu: 0 });
    // 暗くなる → 灯が揺れて消える → 文字
    const t0 = R.Engine.time;
    await R.until(() => {
      const t = R.Engine.time - t0;
      go.dark = Math.min(1, t / 1400);
      go.flame = t < 900 ? 1 : Math.max(0, 1 - (t - 900) / 700);
      go.text = Math.max(0, Math.min(1, (t - 1500) / 500));
      return t >= 2000 || st.dead || (t > 400 && R.Input.pressed('a') && (go.fast = true));
    });
    if (go.fast) { go.dark = 1; go.flame = 0; go.text = 1; }
    try { R.Audio.jingle('gameover'); } catch (e) { /* ignore */ }
    // カーソルは毎回「直前の戦闘からやり直す」（持ち主 2026-10-04。テスター R12: 前の選び方を覚えていて、意図せず「宿から」〈所持金が半分〉を選んだ）
    const def = 0;
    const t1 = R.Engine.time;
    // 出られない場面（籠城の夜など。R.State.wipeSafe）: 「宿から」の代わりに、その場で全快して立て直す（所持金はそのまま）
    const safe = R.State && R.State.wipeSafe ? R.State.wipeSafe() : null;
    const rows = safe ? Go.CHOICES.map((c) => (c.key === 'inn' ? Object.assign({}, c, Go.SAFE) : c)) : Go.CHOICES;
    const i = await _.cmd.menu(st, {
      rows, sel: def, cancel: false, t0: R.Engine.time,
      prompts: [{ btn: 'a', label: R.T('battle.gameover.run.i.prompts.0.label') }],
      desc: (j) => ({ text: rows[j].sub }),
      draw(g, w) { go.menu = Math.min(1, (R.Engine.time - t1) / 200); Go.drawMenu(g, st, w); },
    });
    st.go = null;
    return rows[typeof i === 'number' ? i : def].key;
  };

  /** 画面の暗さとランタン（場面の draw の HUD の前に scene.js が呼ぶ） */
  Go.draw = function (g, st) {
    const go = st.go;
    if (!go) return;
    const k = R.uiScale || 1, Kt = _.K;
    g.save();
    g.fillStyle = `rgba(6,6,14,${0.82 * go.dark})`; g.fillRect(0, 0, R.W, R.H);
    // ランタン（画面の中ほど）
    const x = R.W / 2, y = (st.L.tall ? R.H * 0.34 : R.H * 0.38);
    const fl = go.flame * (1 + Math.sin(R.Engine.time / 60) * 0.08 * go.flame);
    if (fl > 0.01) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 1, x, y, 90 * k * fl);
      gr.addColorStop(0, `rgba(255,200,120,${0.55 * fl})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr; g.fillRect(x - 100 * k, y - 100 * k, 200 * k, 200 * k);
      g.globalCompositeOperation = 'source-over';
    }
    g.fillStyle = '#2a2230'; g.fillRect(x - 9 * k, y - 20 * k, 18 * k, 3 * k); g.fillRect(x - 10 * k, y + 14 * k, 20 * k, 3 * k);
    g.strokeStyle = 'rgba(200,180,150,0.6)'; g.lineWidth = 1.2; g.strokeRect(x - 8 * k, y - 17 * k, 16 * k, 31 * k);
    g.beginPath(); g.arc(x, y - 24 * k, 5 * k, Math.PI, 0); g.stroke();
    g.fillStyle = `rgba(255,226,160,${0.9 * fl})`;
    g.beginPath(); g.ellipse(x, y + 2 * k, 3 * k * (0.5 + fl * 0.5), 7 * k * fl + 0.5, 0, 0, 7); g.fill();
    if (fl < 0.2 && go.dark >= 1) {
      // 消えた後の細い煙
      g.strokeStyle = `rgba(160,150,170,${0.3 * (1 - fl * 5)})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y - 2 * k);
      for (let i = 1; i < 8; i++) g.lineTo(x + Math.sin(R.Engine.time / 400 + i) * 3 * k, y - 2 * k - i * 5 * k);
      g.stroke();
    }
    if (go.text > 0) {
      Kt.text(g, R.T('battle.gameover.draw.text'), x, y + 40 * k, { size: 22 * k, weight: 700, color: `rgba(236,226,206,${go.text})`, align: 'center', raw: true, shadow: true, track: 4 });
    }
    g.restore();
  };

  Go.drawMenu = function (g, st, w) {
    const k = R.uiScale || 1, Kt = _.K, t = R.Engine.time;
    const go = st.go || { menu: 1 };
    const rows = w.o.rows;
    const rw = Math.min(R.W - 40 * k, 340 * k), rh = 44 * k;
    const x = (R.W - rw) / 2, y0 = (st.L.tall ? R.H * 0.34 : R.H * 0.38) + 84 * k;
    g.save();
    g.globalAlpha = go.menu;
    w.rects = [];
    rows.forEach((r, i) => {
      const rr = { x, y: y0 + i * (rh + 6 * k), w: rw, h: rh, i };
      w.rects.push(rr);
      const f = i === w.sel;
      Kt.box(g, rr, { a: f ? 0.6 : 0.5, r: 10 * k, edge: f ? 'rgba(236,201,124,0.7)' : 'rgba(240,228,200,0.18)' });
      if (f) Kt.focus(g, rr, t);
      Kt.text(g, r.label, rr.x + 22 * k, rr.y + (r.sub ? 6 : 13) * k, { size: 15 * k, weight: f ? 700 : 500, color: f ? '#fff8e6' : Kt.COL.text, raw: true });
      if (r.sub) Kt.text(g, r.sub, rr.x + 22 * k, rr.y + 26 * k, { size: 11 * k, color: Kt.COL.text3, raw: true });
    });
    g.restore();
  };
})(window.RPG);
