// エンディングの画面（STORY_BIBLE §9.4 の E3・E7・E10・E12。フィールドの場面は events/final_ending.js）
//   R.Ending.titlePage(line)        E3  始まりの年代記の白い題の欄に、一行ずつ字が浮かぶ（羽ペンの音）
//   R.Ending.reading(chapters)      E7a 年代記の朗読（章の題と、選んだ版の最初の一文。1 章 3 秒ほど）
//   R.Ending.cards(cards)           E7b 朝日が差していく順の地方のカード（下絵の町の絵に朝の光。カードは地方の人物だけ）
//   R.Ending.credits(o)             E10 クレジット（キャストは主人公と物語の人物だけ。仲間 20 人は「旅の仲間たち」の一行。持ち主 2026-09-28「企画・制作 Studio Metem でいい」）
//   R.Ending.fin()                  E12 「――おしまい」（A で閉じる）
//   R.Ending.glow(o) → {to(level, ms), close()}   E6 フィールドの上にかける日の出の光（東の空が白み、金色になる）
// どの画面も R.Engine の層（opaque）。A を押し続けると早送り（クレジット）、字幕は A で次へ。node では描かずにすぐ終わる。
(function (R) {
  'use strict';
  const Ending = (R.Ending = R.Ending || {});
  const u = (v) => (R.UIK && R.UIK.u ? R.UIK.u(v) : v);
  const T = () => R.Engine.time;
  const headless = () => typeof document === 'undefined' || !R.Engine || !R.Engine.running;
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const pressA = () => { try { return R.Input.pressed('a') || (R.Input.pointer && R.Input.pointer.pressed); } catch (e) { return false; } };
  const holdA = () => { try { return R.Input.down && R.Input.down('a'); } catch (e) { return false; } };
  const sfx = (id) => { try { R.Audio.sfx(id); } catch (e) { /* */ } };
  const fill = (s) => (R.Events && R.Events.fill ? R.Events.fill(s) : s);

  // ---------------------------------------------------------------- 層
  function layer(id, draw, o) {
    const L = Object.assign({ id: 'ending_' + id, opaque: true, a: 0, t0: 0, enter() { this.t0 = T(); }, exit() {}, update() {}, draw(g) { draw.call(this, g, this); } }, o || {});
    return L;
  }
  async function run(L, body) {
    if (headless()) return;
    // 暗転（ev.fade('out')）の上では層が見えないので、層を出している間だけ暗転を外す（層は自分の a で暗い所から浮かぶ）。
    // 閉じたら暗転を戻す（続く ev.fade('in') がそこから明ける）
    const F = R.Engine.fade;
    const stop = () => { if (F && F.anim) { const r = F.anim.resolve; F.anim = null; r(); } };
    stop();
    const fa = F ? F.a : 0;
    if (F) F.a = 0;
    R.Engine.push(L);
    try { await body(L); } finally { R.Engine.remove(L); stop(); if (F) F.a = fa; }
  }
  /** ms だけ待つ（A で先へ。o.hold = 押し続けで早送り） */
  function hold(ms, o) {
    const t0 = T();
    let armed = false;
    return R.until(() => {
      const t = T() - t0;
      if (!armed && t > 250) armed = true;
      if (armed && o && o.skip && pressA()) return true;
      return t >= ms;
    });
  }
  function tween(L, key, to, ms) {
    const from = L[key], t0 = T();
    return R.until(() => { const k = ease((T() - t0) / ms); L[key] = from + (to - from) * k; return k >= 1; });
  }

  // ---------------------------------------------------------------- 描く部品
  const C = {
    night0: '#070914', night1: '#141a36', page: '#efe5cb', page2: '#e4d7b6', edge: '#b39a6a', ink: '#3a2716', ink2: '#6b5236', gold: '#e6b86a',
  };
  function bgNight(g, k) {
    const gr = g.createLinearGradient(0, 0, 0, R.H);
    gr.addColorStop(0, C.night0); gr.addColorStop(1, C.night1);
    g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
    if (k > 0) {
      // 地平の朝焼け（下から）
      const d = g.createLinearGradient(0, R.H, 0, R.H * 0.25);
      d.addColorStop(0, `rgba(255,190,120,${0.55 * k})`); d.addColorStop(0.5, `rgba(255,150,120,${0.22 * k})`); d.addColorStop(1, 'rgba(120,120,200,0)');
      g.fillStyle = d; g.fillRect(0, 0, R.W, R.H);
    }
  }
  /** 開いた本（2 ページ）。→ {lx, rx, y, pw, ph}（左右のページの内側の左上） */
  function book(g, a) {
    const pw = Math.min(u(330), R.W * 0.36), ph = Math.min(u(400), R.H * 0.76);
    const cx = R.W / 2, y = (R.H - ph) / 2;
    g.save();
    g.globalAlpha *= a;
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(cx - pw - u(10), y + u(12), pw * 2 + u(20), ph);
    g.fillStyle = '#5a3a22'; g.fillRect(cx - pw - u(8), y - u(6), pw * 2 + u(16), ph + u(12));
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? cx - pw : cx;
      const gr = g.createLinearGradient(x0, 0, x0 + pw, 0);
      if (side < 0) { gr.addColorStop(0, C.page2); gr.addColorStop(0.85, C.page); gr.addColorStop(1, '#cdbd96'); }
      else { gr.addColorStop(0, '#cdbd96'); gr.addColorStop(0.15, C.page); gr.addColorStop(1, C.page2); }
      g.fillStyle = gr; g.fillRect(x0, y, pw, ph);
    }
    g.fillStyle = 'rgba(80,50,20,0.35)'; g.fillRect(cx - 1, y, 2, ph);
    g.strokeStyle = 'rgba(120,90,50,0.35)'; g.lineWidth = 1;
    g.strokeRect(cx - pw + u(14), y + u(14), pw - u(28), ph - u(28)); g.strokeRect(cx + u(14), y + u(14), pw - u(28), ph - u(28));
    g.restore();
    return { lx: cx - pw + u(30), rx: cx + u(30), y: y + u(30), pw: pw - u(60), ph: ph - u(60), cx, cy: y + ph / 2 };
  }
  function text(g, s, x, y, o) { return R.UIK.text(g, s, x, y, o); }
  function lines(g, s, x, y, o) {
    const size = o.size || u(16), lh = o.lh || size * 1.6;
    String(s || '').split('\n').forEach((ln, i) => text(g, ln, x, y + i * lh, o));
  }
  function motes(g, t, n, col, a) {
    g.save();
    for (let i = 0; i < n; i++) {
      const s = (i * 9301 + 49297) % 233280 / 233280;
      const x = ((s * R.W * 1.3 + t * 0.012 * (0.4 + s)) % (R.W + 40)) - 20;
      const y = R.H - ((t * 0.02 * (0.3 + s * 0.7) + s * R.H * 3) % (R.H + 40)) + 20;
      const r = u(1 + s * 2);
      g.globalAlpha = a * (0.3 + 0.7 * Math.abs(Math.sin(t / 900 + i)));
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.restore();
  }

  // ================================================================ E3 題の一行
  /** 題の一行を幅 w に収める → {size, lh, rows}。1 行で 17 まで縮めて入らなければ、折り返して 2 行（さらに縮める） */
  let fitMemo = null;
  function fitTitle(line, w) {
    const key = line + '|' + w;
    if (fitMemo && fitMemo.key === key) return fitMemo.v;
    const M = (s, size) => R.UIK.measure(s, { size, weight: 700 });
    let v = null;
    for (let px = 23; px >= 17 && !v; px--) if (M(line, u(px)) <= w) v = { size: u(px), lh: u(px) * 1.3, rows: [line] };
    for (let px = 21; px >= 14 && !v; px--) {
      const rows = R.UIK.wrap(line, w, { size: u(px), weight: 700 });
      if (rows.length <= 2 && rows.every((r) => M(r, u(px)) <= w)) v = { size: u(px), lh: u(px) * 1.25, rows };
    }
    if (!v) v = { size: u(14), lh: u(14) * 1.25, rows: R.UIK.wrap(line, w, { size: u(14), weight: 700 }).slice(0, 2) };
    fitMemo = { key, v };
    return v;
  }
  Ending.titlePage = async function (line) {
    line = line || (R.Final && R.Final.ev && R.Final.ev.TITLE_LINE) || '';
    const st = { shown: 0, glow: 0 };
    const L = layer('title', function (g) {
      const a = this.a;
      bgNight(g, 0);
      const b = book(g, a);
      g.save(); g.globalAlpha *= a;
      text(g, R.T('ui.ending.titlePage.L.title.text'), b.lx + b.pw / 2, b.y + u(24), { size: u(20), weight: 700, color: C.ink2, align: 'center' });
      lines(g, R.T('ui.ending.titlePage.L.title.lines'), b.lx + b.pw / 2, b.y + u(90), { size: u(14), color: 'rgba(58,39,22,0.55)', align: 'center', lh: u(26) });
      text(g, R.T('ui.ending.titlePage.L.title.text_2'), b.rx + b.pw / 2, b.y + u(24), { size: u(18), weight: 700, color: C.ink2, align: 'center' });
      // 千年白いままの題の欄
      const fy = b.cy - u(24);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(b.rx, fy - u(10), b.pw, u(64));
      g.strokeStyle = 'rgba(120,90,50,0.5)'; g.beginPath(); g.moveTo(b.rx + u(10), fy + u(52)); g.lineTo(b.rx + b.pw - u(10), fy + u(52)); g.stroke();
      if (st.glow > 0) {
        const gr = g.createRadialGradient(b.rx + b.pw / 2, fy + u(22), 2, b.rx + b.pw / 2, fy + u(22), b.pw * 0.8);
        gr.addColorStop(0, `rgba(255,220,150,${0.45 * st.glow})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(b.rx + b.pw / 2, fy + u(22), b.pw * 0.8, 0, Math.PI * 2); g.fill();
      }
      // 題の欄の幅に収める（全文で決めてから一字ずつ出す）: 23→17 まで縮め、それでも入らなければ 2 行に
      const fit = fitTitle(line, b.pw - u(16));
      let left = Math.floor(st.shown);
      const y0 = fy + u(22) - (fit.rows.length * fit.lh) / 2 + (fit.lh - fit.size) / 2 - u(6);
      fit.rows.forEach((row, i) => {
        if (left <= 0) return;
        const rc = [...row];
        const s = rc.slice(0, left).join('');
        left -= rc.length;
        if (s) text(g, s, b.rx + b.pw / 2, y0 + i * fit.lh, { size: fit.size, weight: 700, color: C.ink, align: 'center' });
      });
      g.restore();
    });
    await run(L, async () => {
      await tween(L, 'a', 1, 900);
      await hold(1200);
      const n = [...line].length;
      // 一字の間は 170 ms（長い言語でも 3 秒ほどで書き終える）
      const step = Math.max(90, Math.min(170, 3000 / Math.max(1, n)));
      for (let i = 1; i <= n; i++) {
        st.shown = i;
        if (i % Math.max(2, Math.round(340 / step)) === 1) sfx('quill');
        await hold(step);
      }
      await tween(st, 'glow', 1, 1200);
      sfx('light');
      await hold(3200, { skip: true });
      await tween(L, 'a', 0, 900);
    });
  };

  // ================================================================ E7a 年代記の朗読
  Ending.reading = async function (chapters) {
    const st = { i: -1, fade: 0 };
    const L = layer('reading', function (g) {
      const a = this.a;
      bgNight(g, 0.35);
      const b = book(g, a);
      const c = chapters[st.i];
      if (!c) return;
      g.save(); g.globalAlpha *= a * st.fade;
      text(g, R.T('ui.ending.reading.L.reading.text', { p0: st.i + 1 }), b.lx + b.pw / 2, b.y + u(40), { size: u(16), color: C.ink2, align: 'center' });
      text(g, '『' + c.title + '』', b.lx + b.pw / 2, b.y + u(80), { size: u(24), weight: 700, color: C.ink, align: 'center', maxW: b.pw });
      if (c.region) text(g, c.region, b.lx + b.pw / 2, b.y + u(130), { size: u(14), color: C.ink2, align: 'center' });
      const tx = fill(c.text || '');
      const rows = R.UIK.wrap(tx, b.pw, { size: u(17) });
      rows.forEach((ln, k) => text(g, ln, b.rx, b.y + u(60) + k * u(30), { size: u(17), color: C.ink }));
      g.restore();
    });
    await run(L, async () => {
      await tween(L, 'a', 1, 700);
      for (let i = 0; i < chapters.length; i++) {
        st.i = i; st.fade = 0;
        sfx('page');
        await tween(st, 'fade', 1, 450);
        await hold(2800, { skip: true });
        await tween(st, 'fade', 0, 350);
      }
      await tween(L, 'a', 0, 600);
    });
  };

  // ================================================================ E7b 地方のカード（朝日が差していく）
  /** 下絵（'<theme>/under/<name>'）の @24 の画像 → Image|canvas|null（読めるまで最長 ms 待つ） */
  async function under(key, ms) {
    if (!key || !R.Media || !R.Media.image) return null;
    let rec = null;
    for (const t of [24, 32]) { try { rec = R.Media.image(key + '@' + t, 'env'); } catch (e) { rec = null; } if (rec) break; }
    if (!rec) return null;
    const t0 = T();
    await R.until(() => rec.ready || rec.failed || T() - t0 > (ms || 4000));
    return rec.ready ? rec.img : null;
  }
  Ending.cards = async function (cards) {
    const st = { i: -1, fade: 0, img: null, t0: 0 };
    const imgs = await Promise.all(cards.map((c) => under(c.image, 5000)));
    const L = layer('cards', function (g) {
      const a = this.a;
      g.fillStyle = '#000'; g.fillRect(0, 0, R.W, R.H);
      const c = cards[st.i], img = imgs[st.i];
      if (!c) return;
      g.save(); g.globalAlpha *= a * st.fade;
      const t = (T() - st.t0) / 6000;
      if (img) {
        const iw = img.width, ih = img.height;
        const f = c.focus || [0.5, 0.5];
        const sc = Math.max(R.W / iw, R.H / ih) * (1.35 + 0.08 * t);
        const w = iw * sc, h = ih * sc;
        const x = Math.min(0, Math.max(R.W - w, R.W / 2 - f[0] * w + (0.5 - t) * u(30)));
        const y = Math.min(0, Math.max(R.H - h, R.H / 2 - f[1] * h));
        g.imageSmoothingEnabled = false;
        g.drawImage(img, x, y, w, h);
        g.imageSmoothingEnabled = true;
      } else { bgNight(g, 1); }
      // 朝の光（上から金色、右上に日だまり）と、少しの暖色
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = 'rgba(255,200,140,0.55)'; g.fillRect(0, 0, R.W, R.H);
      g.globalCompositeOperation = 'source-over';
      const gr = g.createLinearGradient(0, 0, 0, R.H);
      gr.addColorStop(0, 'rgba(255,214,150,0.42)'); gr.addColorStop(0.45, 'rgba(255,214,150,0.08)'); gr.addColorStop(1, 'rgba(40,20,40,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
      const rg = g.createRadialGradient(R.W * 0.85, -u(40), 4, R.W * 0.85, -u(40), R.W * 0.7);
      rg.addColorStop(0, 'rgba(255,240,200,0.55)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.fillRect(0, 0, R.W, R.H); g.globalCompositeOperation = 'source-over';
      // 字幕の帯
      const bh = u(118);
      const bg = g.createLinearGradient(0, R.H - bh - u(30), 0, R.H);
      bg.addColorStop(0, 'rgba(10,8,20,0)'); bg.addColorStop(0.35, 'rgba(10,8,20,0.62)'); bg.addColorStop(1, 'rgba(10,8,20,0.8)');
      g.fillStyle = bg; g.fillRect(0, R.H - bh - u(30), R.W, bh + u(30));
      text(g, c.name, u(60), R.H - bh + u(4), { size: u(14), weight: 700, color: C.gold, shadow: true });
      lines(g, fill(c.text), u(60), R.H - bh + u(30), { size: u(17), color: '#fff6e6', shadow: true, lh: u(27) });
      g.restore();
    });
    await run(L, async () => {
      L.a = 1;
      for (let i = 0; i < cards.length; i++) {
        st.i = i; st.fade = 0; st.t0 = T();
        await tween(st, 'fade', 1, 700);
        await hold(4200, { skip: true });
        await tween(st, 'fade', 0, 600);
      }
    });
  };

  // ================================================================ E10 クレジット
  function logoRec() {
    if (Ending._logo) return Ending._logo;
    const rec = (Ending._logo = { img: null, ready: false });
    try {
      const e = R.Media && R.Media.entry ? R.Media.entry('title', 'logo') : null;
      if (!e || typeof Image === 'undefined') return rec;
      const im = new Image();
      im.onload = () => { rec.img = im; rec.ready = true; };
      im.src = R.Media.url('title', 'logo') || e.png;
    } catch (err) { /* 文字の題字 */ }
    return rec;
  }
  Ending.creditRows = function (o) {
    o = o || {};
    const rows = [['logo'], ['gap', 2]];
    rows.push(['head', R.T('ui.ending.creditRows.1')]);
    rows.push(['name', fill('{hero}')], ['small', R.T('ui.ending.creditRows.1_2')], ['gap', 0.6]);
    for (const [n, r] of [R.T('ui.ending.creditRows.0'), R.T('ui.ending.creditRows.1_3'), R.T('ui.ending.creditRows.2'), R.T('ui.ending.creditRows.3'), R.T('ui.ending.creditRows.4'), R.T('ui.ending.creditRows.5')]) rows.push(['name', n], ['small', r], ['gap', 0.5]);
    rows.push(['gap', 1.2], ['head', R.T('ui.ending.creditRows.1_4')]);
    for (const [reg, names] of [R.T('ui.ending.creditRows.0_2'), R.T('ui.ending.creditRows.1_5'), R.T('ui.ending.creditRows.2_2'),
      R.T('ui.ending.creditRows.3_2'), R.T('ui.ending.creditRows.4_2'), R.T('ui.ending.creditRows.5_2'), R.T('ui.ending.creditRows.6'), R.T('ui.ending.creditRows.7')]) {
      rows.push(['small', reg], ['name', names], ['gap', 0.5]);
    }
    rows.push(['gap', 1.2], ['head', R.T('ui.ending.creditRows.1_6')], ['name', R.T('ui.ending.creditRows.1_7')], ['gap', 1.2]);
    rows.push(['head', R.T('ui.ending.creditRows.1_8')], ['name', R.T('ui.ending.creditRows.1_9')], ['gap', 1.4]);
    rows.push(['head', R.T('ui.ending.creditRows.1_10')], ['small', R.T('ui.ending.creditRows.1_11')], ['gap', 2]);
    // 制作スタッフ・Special Thanks（持ち主 2026-10-02。名前の書き方は言語ごと: 日本語・中国語は漢字、ほかはローマ字）
    rows.push(['head', R.T('ui.ending.staff.role')], ['name', R.T('ui.ending.staff.name')], ['gap', 1.4]);
    rows.push(['head', 'Special Thanks'], ['name', R.T('ui.ending.staff.thanks1')], ['gap', 0.8]);
    rows.push(['small', R.T('ui.ending.staff.testers')], ['small', R.T('ui.ending.staff.testersThanks')], ['gap', 2]);
    rows.push(['head', R.T('ui.ending.creditRows.1_12')], ['name', 'Studio Metem'], ['gap', 3]);
    rows.push(['name', R.COPYRIGHT || '© Studio Metem'], ['gap', 2]);
    if (o.extra) rows.push(...o.extra);
    return rows;
  };
  Ending.credits = async function (o) {
    const rows = Ending.creditRows(o);
    const lh = u(30);
    const H = (r) => (r[0] === 'gap' ? r[1] * lh : r[0] === 'logo' ? u(170) : r[0] === 'head' ? lh * 1.3 : r[0] === 'small' ? lh * 0.8 : lh);
    const total = rows.reduce((s, r) => s + H(r), 0);
    const st = { y: R.H + u(20), dawn: 0 };
    const logo = logoRec();
    const L = layer('credits', function (g) {
      const t = T() - this.t0;
      bgNight(g, st.dawn);
      motes(g, t, 36, '#fff0c8', 0.6);
      g.save(); g.globalAlpha *= this.a;
      let y = st.y;
      for (const r of rows) {
        const h = H(r);
        if (y > -u(200) && y < R.H + u(40)) {
          if (r[0] === 'logo') {
            if (logo.ready) {
              const w = Math.min(R.W * 0.5, u(420)), hh = w * logo.img.height / logo.img.width;
              g.drawImage(logo.img, R.W / 2 - w / 2, y, w, hh);
            } else {
              text(g, R.TITLE || '', R.W / 2, y + u(40), { size: u(34), weight: 700, color: '#fff6e0', align: 'center', shadow: true });
              text(g, R.SUBTITLE || '', R.W / 2, y + u(92), { size: u(18), color: C.gold, align: 'center', shadow: true });
            }
          } else if (r[0] === 'head') text(g, r[1], R.W / 2, y, { size: u(15), weight: 700, color: C.gold, align: 'center', shadow: true });
          else if (r[0] === 'name') text(g, r[1], R.W / 2, y, { size: u(19), color: '#fff6e6', align: 'center', shadow: true });
          else if (r[0] === 'small') text(g, r[1], R.W / 2, y, { size: u(13), color: '#c8c2dc', align: 'center', shadow: true });
        }
        y += h;
      }
      g.restore();
    });
    await run(L, async () => {
      L.a = 1;
      const speed = u(34) / 1000;   // 1 秒あたり
      let last = T();
      const endY = -total + R.H * 0.42;
      await R.until(() => {
        const now = T(), dt = now - last; last = now;
        st.y -= dt * speed * (holdA() ? 4 : 1);
        st.dawn = Math.min(1, Math.max(0, (R.H - st.y) / (total + R.H * 0.5)));
        return st.y <= endY;
      });
      await hold(2500, { skip: true });
      await tween(L, 'a', 0, 1200);
    });
  };

  // ================================================================ E12 おしまい
  Ending.fin = async function () {
    const L = layer('fin', function (g) {
      g.fillStyle = '#05060c'; g.fillRect(0, 0, R.W, R.H);
      motes(g, T() - this.t0, 24, '#fff0c8', 0.5 * this.a);
      text(g, R.T('ui.ending.fin.L.fin.text'), R.W / 2, R.H / 2 - u(16), { size: u(28), weight: 700, color: '#fff6e6', align: 'center', alpha: this.a, shadow: true });
    });
    await run(L, async () => {
      await tween(L, 'a', 1, 1200);
      await hold(1500);
      await R.until(() => pressA());
      await tween(L, 'a', 0, 900);
    });
  };

  // ================================================================ E6 日の出の光（フィールドの上）
  Ending.glow = function () {
    const st = { k: 0, white: 0 };
    const L = layer('glow', function (g) {
      const k = st.k;
      if (k > 0) {
        const gr = g.createLinearGradient(0, 0, 0, R.H);
        gr.addColorStop(0, `rgba(255,236,190,${0.75 * k})`); gr.addColorStop(0.5, `rgba(255,190,140,${0.3 * k})`); gr.addColorStop(1, `rgba(255,170,130,${0.12 * k})`);
        g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
        const rg = g.createRadialGradient(R.W * 0.8, 0, 4, R.W * 0.8, 0, R.W * 0.75);
        rg.addColorStop(0, `rgba(255,245,215,${0.6 * k})`); rg.addColorStop(1, 'rgba(255,245,215,0)');
        g.fillStyle = rg; g.fillRect(0, 0, R.W, R.H);
        g.globalCompositeOperation = 'source-over';
      }
      if (st.white > 0) { g.fillStyle = `rgba(255,250,236,${st.white})`; g.fillRect(0, 0, R.W, R.H); }
    }, { opaque: false });
    if (!headless()) R.Engine.push(L);
    return {
      to(level, ms) { return headless() ? Promise.resolve() : tween(st, 'k', level, ms || 1000); },
      white(level, ms) { return headless() ? Promise.resolve() : tween(st, 'white', level, ms || 800); },
      close() { try { R.Engine.remove(L); } catch (e) { /* */ } },
      st,
    };
  };
})(window.RPG);
