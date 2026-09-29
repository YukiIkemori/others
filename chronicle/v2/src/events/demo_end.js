// 体験版の終わり（持ち主 2026-09-28「体験版の出口」）。R.Demo
//   R.Demo.end(ev)  story_t1（T1 の場面）の最後に呼ばれる。DB.config.slice の間だけ・1 回（フラグ world_demo_end）:
//     1. 世界の中の短い前置き（峠の向こうの七つの灯）→ 字幕「体験版は、ここまでです。」
//     2. 記録の案内（記録する／あとで。記録から再開すれば森と半島はこのまま歩ける）
//     3. 製品版へ引き継ぐ「体験版クリアの記録」を書く（R.DemoCarry.write）。オートの枠にも今を残す（再開で T1 をくり返さない）
//     4. 計測 demo_end_reached（R.Analytics）
//     5. 終わりの画面（お礼・遊んだ時間・この先の一行・ウィッシュリストのお願い・クレジット）→ A でタイトルへ
//   R.Demo.showEnd({playMs}) → Promise   終わりの画面だけ（場面 'demo_end' を直に積む。R.Screens の表には入れない）
//   R.Demo.STORE_URL  ストアのページの URL（空の間は画面に出さない）
(function (R) {
  'use strict';
  // TODO(オーナー): Steam のストアのページができたら、ここに URL を入れる（例 'https://store.steampowered.com/app/<AppID>/'）。
  //   空のままなら終わりの画面は「Steamでウィッシュリスト登録をお願いします」の一行だけを出す（仮のページは作らない）。
  const STORE_URL = '';
  const CREDIT = R.T('ev.demo_end.CREDIT');
  const TEASER = R.T('ev.demo_end.TEASER');

  const Demo = (R.Demo = R.Demo || {});
  Demo.STORE_URL = STORE_URL;
  Demo.CREDIT = CREDIT;
  Demo.TEASER = TEASER;
  const X = () => R.ContentP && R.ContentP.ev;
  const narr = (ev, t) => (X() && X().narr ? X().narr(ev, t) : ev.say(null, t, { face: false }));

  Demo.end = async function (ev) {
    if (!(R.DB.config && R.DB.config.slice) || ev.flag('world_demo_end')) return;
    ev.setFlag('world_demo_end');
    const G = R.Game;
    // 前置き（世界の中の地の文）
    await narr(ev, R.T('ev.demo_end.end.narr'));
    await narr(ev, R.T('ev.demo_end.end.narr_2'));
    await ev.caption(R.T('ev.demo_end.end.caption'));
    await narr(ev, R.T('ev.demo_end.end.narr_3'));
    // 再開で T1 をくり返さない（once の印は場面の終わりに立つので、記録の前に立てておく）
    if (G && G.flags) G.flags.ev_story_t1 = true;
    const i = await ev.choose(R.T('ev.demo_end.end.i.choose'), { text: R.T('ev.demo_end.end.i.choose.text'), cancel: 1 });
    if (i === 0) { try { await R.Screens.open('save', {}); } catch (e) { /* */ } }
    try { if (R.Save && R.Save.save) R.Save.save('auto'); } catch (e) { /* */ }
    try { if (R.DemoCarry) R.DemoCarry.write(); } catch (e) { console.error(e); }
    try { if (R.Analytics) R.Analytics.event('demo_end_reached'); } catch (e) { /* */ }
    // 終わりの画面 → タイトル（ブラウザだけ。node の通しのテストは画面を出さない）
    if (typeof document === 'undefined' || !R.Engine || !R.Engine.push) return;
    try { await ev.fade('out', 900); } catch (e) { /* */ }
    await Demo.showEnd({ playMs: G ? G.playMs : 0 });
    R.Events.after(() => { if (R.Flow && R.Flow.title) R.Flow.title(); });
  };

  // ---------------------------------------------------------------- 終わりの画面
  const u = (v) => R.UIK.u(v);
  const playTime = (ms) => {
    if (R.Screens && R.Screens.playTimeJa) return R.Screens.playTimeJa(ms);
    const m = Math.floor((ms || 0) / 60000), h = Math.floor(m / 60);
    return h ? R.T('ev.demo_end.playTime.ret', { h, padStart: String(m % 60).padStart(2, '0') }) : R.T('ev.demo_end.playTime.ret_2', { p0: m % 60 });
  };
  let scene = null;
  Demo.isOpen = () => !!scene && R.Engine.stack.includes(scene);

  Demo.showEnd = function (o) {
    o = o || {};
    return new Promise((resolve) => {
      const v = { t0: R.Engine.time, done: false, out: 0, playMs: o.playMs || 0 };
      const READY = 2600;   // 字が出そろうまで（押せるのはその後）
      const finish = async () => {
        if (v.done) return;
        v.done = true;
        R.UIK.sfx('confirm');
        try { R.Audio.stopBgm && R.Audio.stopBgm(1200); } catch (e) { /* */ }
        try { await R.Engine.fadeTo(1, 900); } catch (e) { /* */ }
        resolve();
      };
      scene = {
        id: 'demo_end', opaque: true,
        enter() { try { R.Input.touchLayout('menu'); } catch (e) { /* */ } },
        exit() {},
        update() {
          if (v.done) return;
          const I = R.Input;
          if (R.Engine.time - v.t0 < READY) { if (I.pressed('a') || I.pressed('b')) v.t0 = R.Engine.time - READY; return; }
          if (I.pressed('a') || I.pressed('start') || I.pressed('b')) finish();
        },
        draw(g) { draw(g, v); },
      };
      R.Engine.push(scene);
      try { R.Audio.bgm('fine_theme', { fade: 1400 }); } catch (e) { /* */ }
      R.Engine.fadeTo(0, 1200);
    });
  };

  function draw(g, v) {
    const W = R.W, H = R.H, t = R.Engine.time, e = t - v.t0;
    const C = R.UIK.T.color;
    const ease = (a, b) => Math.max(0, Math.min(1, (e - a) / b));
    // 夜空（深い藍 → 地平の薄明かり）
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#05071a'); bg.addColorStop(0.62, '#10163a'); bg.addColorStop(1, '#2a2240');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 星（ゆっくりまたたく）
    const rnd = R.rng('demo-end-stars');
    for (let i = 0; i < 90; i++) {
      const x = rnd.next() * W, y = rnd.next() * H * 0.7, ph = rnd.next() * 6.28, r = 0.6 + rnd.next() * 1.3;
      g.globalAlpha = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t / 1300 + ph))) * ease(0, 1500);
      g.fillStyle = '#e8ecff'; g.fillRect(x, y, u(r), u(r));
    }
    g.globalAlpha = 1;
    // 遠い峠の稜線
    g.fillStyle = '#0a0d24';
    g.beginPath(); g.moveTo(0, H);
    for (let i = 0; i <= 24; i++) { const x = (i / 24) * W; g.lineTo(x, H * (0.83 - 0.05 * Math.sin(i * 0.9) - 0.035 * Math.sin(i * 2.3 + 1))); }
    g.lineTo(W, H); g.closePath(); g.fill();
    // 八つの灯火: 一つ目だけがともり、残る七つはかすかに
    const cy = H * 0.2, gap = Math.min(u(54), W / 11), x0 = W / 2 - gap * 3.5;
    for (let i = 0; i < 8; i++) {
      const x = x0 + gap * i;
      const a = ease(300 + i * 90, 600);
      if (i === 0) {
        R.UIK.glow(g, x, cy, u(34), [255, 200, 120], 0.55 * a * (0.9 + 0.1 * Math.sin(t / 380)));
        R.UIK.glow(g, x, cy, u(9), [255, 244, 210], 0.95 * a);
      } else {
        R.UIK.glow(g, x, cy, u(12), [150, 170, 230], (0.12 + 0.06 * Math.sin(t / 900 + i)) * a);
        g.globalAlpha = 0.35 * a; g.fillStyle = '#9aa6d8'; g.beginPath(); g.arc(x, cy, u(2.2), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      }
    }
    const txt = (s, y, o, at) => R.UIK.text(g, s, W / 2, y, Object.assign({ align: 'center', shadow: true, alpha: ease(at, 700) }, o));
    let y = H * 0.29;
    txt(R.T('ev.demo_end.draw.txt'), y, { size: u(38), weight: 700, grad: [C.goldHi, C.gold, C.goldLo], track: u(2) }, 500);
    y += u(66);
    txt(R.T('ev.demo_end.draw.txt_2'), y, { size: u(18), color: C.text }, 900);
    y += u(36);
    txt(R.T('ev.demo_end.draw.txt_3', { playTime: playTime(v.playMs) }), y, { size: u(14), color: C.text2 }, 1100);
    // 区切りの線
    y += u(46);
    g.save(); g.globalAlpha = ease(1300, 700) * 0.6;
    const lg = g.createLinearGradient(W / 2 - u(180), 0, W / 2 + u(180), 0);
    lg.addColorStop(0, 'rgba(236,201,124,0)'); lg.addColorStop(0.5, 'rgba(236,201,124,1)'); lg.addColorStop(1, 'rgba(236,201,124,0)');
    g.fillStyle = lg; g.fillRect(W / 2 - u(180), y, u(360), Math.max(1, u(1)));
    g.restore();
    y += u(26);
    for (const line of TEASER.split('\n')) { txt(line, y, { size: u(17), color: C.teal }, 1500); y += u(28); }
    y += u(30);
    txt(R.T('ev.demo_end.draw.txt_4'), y, { size: u(19), weight: 700, color: C.gold }, 1900);
    y += u(34);
    if (STORE_URL) { txt(STORE_URL, y, { size: u(13), color: C.text2, family: 'en' }, 2000); y += u(26); }
    // クレジット（下）
    txt(CREDIT, H * 0.88, { size: u(14), color: C.text3 }, 2200);
    if (e > 2600 && !v.done) {
      const a = 0.55 + 0.45 * Math.sin((e - 2600) / 500);
      g.save(); g.globalAlpha = Math.min(1, (e - 2600) / 400) * (0.7 + 0.3 * a);
      if (R.Screens && R.Screens.prompts) R.Screens.prompts(g, [{ btn: 'a', label: R.T('ev.demo_end.draw.0.label') }]);
      else R.UIK.text(g, R.T('ev.demo_end.draw.text'), W - u(24), H - u(30), { align: 'right', size: u(13), color: C.text2 });
      g.restore();
    }
  }
})(window.RPG);
