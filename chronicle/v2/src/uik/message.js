// UIK: 会話（R.UIK.Message、MODERN_UI §6.3・§5.4、V2_PLAN §2.5.6・§2.11）
//   say({name, title, face, text, voice（id か、元のページごとの id の配列）, choices, cancel, index（最初のカーソル）}) → Promise<選んだ番号 | undefined>   場面 id 'message'（K.say）
//     - 羊皮紙の札（下の中央、幅 760・高さ 150）。左に顔の枠 118（顔の無い人は枠ごと出さず文を左に寄せる）、上に話者名（琥珀）と肩書き
//     - text は文字列か配列（1 つが 1 ページ）。幅で折り返し、3 行ごとに次のページへ（'\f' があればそこでも次のページへ）。{漢字|かんじ} はふりがな（設定 ruby のときだけ出す）
//     - 送り: A・B・下キー・タップ（A3）。送ったら R.Audio.stopVoice()（A9）。途中なら全部を出す
//     - 早送り R（押している間。読んだ所は一瞬、未読は速い）・ログ X（直近 100 行、話者名つき）・自動送り Y（1 字 60 ms ＋ 1.2 秒。ボイスの終わりも待つ）
//     - 選択肢の前では自動送り・早送りでも止まる。選択肢は同じ紙の札で右上に重ねる（'\t' の後ろは右寄せ＝値段）。B は o.cancel があればその番号
//     - 前の say がまだ開いているときに新しい say が来たら、前を先に undefined で解決する（A6 の固まりの原因）
//     - 文が空で選択肢だけのときは、直前の会話（0.6 秒以内に閉じた物）を読み返せるよう、その最後のページを添える
//   caption(text, {ms, voice}) → Promise   地の文を画面の中ほどに（顔も名前もなし）。場面 id 'caption'。ms があればその時間で閉じる
//     - voice（id）: 開いたときに R.Audio.voice で鳴らす（ボイスの音量 0 なら鳴らない）。ms があっても声の終わりまで待つ（最長 ms＋20 秒）。送れば声も止める
//   busy() → bool（会話かキャプションが開いている）/ close()（どちらも閉じる）/ log() → [{name, text}] / auto() → bool
//   縦持ち: 窓を画面の幅いっぱい、顔は窓の上にはみ出して置く、ボタンは窓の上の札、下に「タップで次へ・長押しで早送り」
(function (R) {
  'use strict';
  const UIK = (R.UIK = R.UIK || {});
  const M = (UIK.Message = UIK.Message || {});

  let cur = null;        // {scene, resolve}
  let cap = null;        // {scene, resolve}
  let autoOn = false;
  // 選択肢が出てから決定を受けるまでの ms（出てから min 以上、かつ決定・取り消し・クリックを離して idle ms 何も押さない）。
  //   前は「長くても max ms で受ける」があり、連打で会話を送り続けると 1.5 秒で 1 つ目に決まった（テスター 2026-10-02 P22「第3の波。どの門を守る？」）。
  //   押しっぱなし・連打の間は受けない（離して一息おけば選べる）
  const CHOICE_GUARD = { min: 450, idle: 300 };
  /**
   * 出てすぐの選択の決定よけ（会話の選択肢・画面の S.ask の guard・店の「今すぐ装備する？」で同じ決まり）。
   *   g = {t0: 出た時刻}。毎フレーム呼ぶ → 決定を受けてよければ true（一度 true になったら以後ずっと true）
   */
  UIK.choiceGuard = function (g) {
    if (g.armed) return true;
    const I = R.Input, now = R.Engine.time;
    if ((I.down && (I.down('a') || I.down('b'))) || (I.pointer && I.pointer.down)) g.at = now;
    // 連打・押しっぱなしが続いている間は待つ（離して CHOICE_GUARD.idle ms）
    if (now - g.t0 < CHOICE_GUARD.min || now - Math.max(g.t0, g.at || 0) < CHOICE_GUARD.idle) return false;
    g.armed = true;
    return true;
  };
  let lastShown = null;  // {name, title, face, page, t}
  const logs = [];       // [{name, text}]
  const readSet = new Set();
  const SPEED_LABEL = { slow: R.T('ui.message.SPEED_LABEL.slow'), normal: R.T('ui.message.SPEED_LABEL.normal'), fast: R.T('ui.message.SPEED_LABEL.fast'), instant: R.T('ui.message.SPEED_LABEL.instant') };

  // ---------------------------------------------------------------- ふりがな {漢字|かんじ}
  function parseRuby(s) {
    const rubies = [];
    let plain = '';
    const re = /\{([^{}|]+)\|([^{}]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      plain += s.slice(last, m.index);
      const a = [...plain].length;
      plain += m[1];
      rubies.push({ a, b: a + [...m[1]].length, r: m[2] });
      last = re.lastIndex;
    }
    plain += s.slice(last);
    return { plain, rubies };
  }
  M.plain = function (s) { return parseRuby(String(s == null ? '' : s)).plain; };

  function speed() { return UIK.T.textSpeed[UIK.setting('textSpeed', 'normal')] || UIK.T.textSpeed.normal; }
  function stopVoice() { try { if (R.Audio && R.Audio.stopVoice) R.Audio.stopVoice(); } catch (e) { /* */ } }
  function pushLog(name, text) {
    logs.push({ name: name || '', text: String(text).replace(/\f/g, '\n') });  // 窓の区切り '\f' はログでは改行に
    while (logs.length > UIK.T.log) logs.shift();
  }

  // ---------------------------------------------------------------- 配置
  /** 会話の窓の配置（掛けた後の論理 px）。face: 顔の枠を出すか */
  function layout(o, hasFace, nChoiceRows, choiceW) {
    const T = UIK.T, k = R.uiScale || 1, s = R.safe || { l: 0, t: 0, r: 0, b: 0 };
    const tall = R.layout === 'tall';
    const L = { tall };
    L.size = T.size.talk * k;
    L.lh = T.row.talk * k * (tall ? 1.1 : 1);
    L.lines = T.talk.lines;
    if (!tall) {
      const m = UIK.margin();
      L.w = Math.min(R.W - s.l - s.r - m * 2, T.talk.w * k);
      L.h = T.talk.h * k;
      L.x = Math.round((R.W - L.w) / 2);
      L.y = Math.round(R.H - s.b - L.h - 12 * k);
      L.face = hasFace ? { x: L.x + 14 * k, y: L.y + (L.h - T.talk.face * k) / 2, w: T.talk.face * k, h: T.talk.face * k } : null;
      L.tx = hasFace ? L.face.x + L.face.w + 22 * k : L.x + 28 * k;
      L.tw = L.x + L.w - 34 * k - L.tx;
      L.nameY = L.y + 18 * k;
      L.lineY = L.nameY + T.size.title * k + 9 * k;
      // 本文の 1 行目は名前の有る無しで変えない（名前の人 → 地の文 → 名前の人と続くと、文が上下に跳ねて「ずれた」と見える。オーナー 2026-10-01）
      L.textY = L.lineY + 10 * k;
      L.btnY = L.y - 14 * k;
    } else {
      const m = UIK.margin();
      L.x = s.l + m; L.w = R.W - s.l - s.r - m * 2;
      const fs = 96 * k;
      L.face = hasFace ? { x: L.x + 16 * k, y: 0, w: fs, h: fs } : null;
      const head = hasFace ? fs * 0.55 + 12 * k : o.name ? 18 * k + T.size.title * k + (o.title ? T.size.caption * k + 6 * k : 0) + 14 * k : 20 * k;
      L.h = Math.round(head + L.lh * L.lines + 22 * k);
      L.hintH = 30 * k;
      L.y = Math.round(R.H - s.b - L.hintH - L.h - 6 * k);
      if (L.face) L.face.y = L.y - fs * 0.45;
      L.tx = L.x + 22 * k; L.tw = L.w - 44 * k;
      L.nameX = hasFace ? L.face.x + L.face.w + 16 * k : L.tx;
      L.nameY = L.y + 14 * k;
      L.textY = L.y + head;
      L.btnY = L.y - (hasFace ? fs * 0.45 : 0) - 24 * k;
      if (hasFace) L.btnY = L.y - 22 * k;
    }
    // 選択肢の札
    if (nChoiceRows) {
      const rh = T.row.choice * k * (tall ? 1.15 : 1);
      const cw = Math.min(L.w, Math.max(T.talk.choiceW * k, choiceW + 56 * k));
      const ch = nChoiceRows * rh + 16 * k;
      const cx = L.x + L.w - cw;
      const cy = Math.max(s.t + 8 * k, Math.round((tall ? L.btnY - 22 * k : L.btnY - 22 * k) - ch));
      L.choice = { x: cx, y: cy, w: cw, h: ch, rh };
    }
    return L;
  }

  // ---------------------------------------------------------------- 会話の場面
  function msgScene(o) {
    const T = UIK.T;
    /** 元のページ src のボイスの id（o.voice は 1 つか、ページごとの配列） */
    function voiceFor(src) { return Array.isArray(o.voice) ? o.voice[src] || null : src === 0 ? o.voice || null : null; }
    let src = Array.isArray(o.text) ? o.text.map(String) : [String(o.text == null ? '' : o.text)];
    const choices = Array.isArray(o.choices) ? o.choices.map(String) : [];
    const hasChoices = choices.length > 0;
    // 文が空で選択肢だけ → 直前の会話を添える
    let context = null;
    if (hasChoices && src.join('') === '' && lastShown && R.Engine.time - lastShown.t < 600) context = lastShown;
    const name = o.name || (context && context.name) || '';
    const title = o.title || (context && context.title) || '';
    const faceKey = typeof o.face === 'string' && o.face ? o.face : context && context.face;
    const hasFace = !!faceKey && UIK.hasFace(faceKey);
    if (context) src = [context.page];
    const parsed = src.map(parseRuby);
    const st = {
      page: 0, shown: 0, choice: Math.max(0, Math.min(choices.length - 1, o.index | 0)), full: false, fullAt: 0, pages: null, key: '', log: null,
      voiceDone: !voiceFor(0), voiceSrc: -1, voiceTok: 0, press: null, t0: 0, ffHold: false, logged: {}, hover: -1,
    };
    if (context) { st.shown = 1e9; st.logged[0] = true; }
    const choiceParts = choices.map((c) => { const i = c.indexOf('\t'); return i < 0 ? [c, ''] : [c.slice(0, i), c.slice(i + 1)]; });

    function lay() {
      let cw = 0;
      for (const [a, b] of choiceParts) cw = Math.max(cw, UIK.measure(a, { size: T.size.body * (R.uiScale || 1), weight: 700 }) + (b ? UIK.measure(b, { size: T.size.body * (R.uiScale || 1) }) + 24 * (R.uiScale || 1) : 0));
      // 名前・肩書きは o のではなく、実際に出す物（選択肢だけの窓は直前の会話の名前を借りる）で配置する。
      //   前は o.name を見ていたので、借りた名前を描くのに本文は「名前なし」の高さに置かれ、名前の上に重なって上にずれた（オーナー 2026-10-01「宿で泊まろうとすると 2 個目で文章が上にずれる」）
      return layout({ name, title }, hasFace, choices.length, cw);
    }
    /** 表示のページ（折り返して 3 行ずつ）を作る。幅が変わったら作り直す */
    function pages(L) {
      const key = L.tw.toFixed(1) + '|' + L.size;
      if (st.pages && st.key === key) return st.pages;
      const out = [];
      parsed.forEach((p, si) => {
        // 行ごとに、元の文（ふりがなを除いた字）の中の位置 a を持つ。'\f' はそこで窓を改める（どの言語でも）
        let base = 0, any = false;
        for (const block of p.plain.split('\f')) {
          const withOff = [];
          for (const para of block.split('\n')) {
            let off = base;
            for (const l of UIK.wrap(para, L.tw, { size: L.size })) { const n = [...l].length; withOff.push({ s: l, a: off, n }); off += n; }
            base += [...para].length + 1;
          }
          // 空の区切り（'\f' が頭・尻・二つ続き）は窓を作らない
          if (!withOff.some((l) => l.n > 0)) continue;
          for (let i = 0; i < withOff.length; i += L.lines) {
            const chunk = withOff.slice(i, i + L.lines);
            out.push({ src: si, lines: chunk, n: chunk.reduce((a, l) => a + l.n, 0), rubies: p.rubies, text: chunk.map((l) => l.s).join('\n') });
            any = true;
          }
        }
        if (!any) out.push({ src: si, lines: [], n: 0, rubies: [], text: '' });
      });
      if (st.pages) {
        // 同じ元のページの頭へ
        const at = st.pages[st.page] ? st.pages[st.page].src : 0;
        st.page = Math.max(0, out.findIndex((x) => x.src === at));
      }
      st.pages = out; st.key = key;
      return out;
    }
    const page = () => st.pages[st.page];
    const isLast = () => st.page >= st.pages.length - 1;
    const readKey = (pg) => name + '|' + pg.text;

    /** 元のページ src に入ったら、そのボイスを鳴らす（同じ元のページの続きの窓では鳴らし直さない） */
    function playVoiceFor(src) {
      if (src === st.voiceSrc) return;
      st.voiceSrc = src;
      const id = voiceFor(src);
      const tok = ++st.voiceTok;
      if (!id || !R.Audio || !R.Audio.voice) { st.voiceDone = true; return; }
      st.voiceDone = false;
      const done = () => { if (st.voiceTok === tok) st.voiceDone = true; };
      try { Promise.resolve(R.Audio.voice(id)).then(done, done); } catch (e) { st.voiceDone = true; }
    }
    function flip() {
      const pg = page();
      const next = !isLast() ? st.pages[st.page + 1] : null;
      if (!next || !pg || next.src !== pg.src) stopVoice();
      if (pg) readSet.add(readKey(pg));
      if (!isLast()) { st.page++; st.shown = 0; st.full = false; playVoiceFor(page().src); return; }
      finish(undefined);
    }
    function complete() { st.shown = page().n; }

    const scene = {
      id: 'message',
      opaque: false,
      enter() {
        st.t0 = R.Engine.time;
        // 最初のページは開いたときにログへ（すぐ次の say に替わっても残る）
        if (!context && parsed[0] && parsed[0].plain) { st.logged[0] = true; pushLog(name, parsed[0].plain); }
        if (voiceFor(0)) playVoiceFor(0);
      },
      exit() {},
      update(dt) {
        const I = R.Input;
        const L = lay();
        pages(L);
        const pg = page();
        if (!pg) { finish(undefined); return; }
        if (!st.logged[pg.src]) {
          st.logged[pg.src] = true;
          const p = parsed[pg.src];
          if (p && p.plain) pushLog(name, p.plain);
        }
        // ログ
        if (st.log) { updateLog(L); return; }
        if (I.pressed('x')) { openLog(); return; }
        if (I.pressed('y')) { autoOn = !autoOn; UIK.sfx(autoOn ? 'confirm_soft' : 'cancel'); }
        const p = I.pointer;
        // ボタン（ログ・自動送り・早送り）のタップ
        if (p.pressed && st.btns) {
          for (const b of st.btns) if (UIK.hit(b.r, p.x, p.y)) {
            if (b.id === 'log') { openLog(); return; }
            if (b.id === 'auto') { autoOn = !autoOn; UIK.sfx('confirm_soft'); }
            st.press = { btn: true };
            return;
          }
        }
        if (p.pressed) st.press = { x: p.x, y: p.y, long: false };
        if (st.press && p.longPress) st.press.long = true;
        const ff = I.down('r') || !!(st.press && st.press.long && p.down);
        const readBefore = readSet.has(readKey(pg));
        // 文字を出す
        const last = isLast();
        const waitChoice = last && hasChoices;
        if (st.shown < pg.n) {
          const sp = ff ? (readBefore ? 1e9 : Math.max(speed() * 4, UIK.T.textSpeed.fast * 2)) : speed();
          st.shown = Math.min(pg.n, st.shown + sp * dt / 1000);
        }
        const full = st.shown >= pg.n;
        if (full && !st.full) { st.full = true; st.fullAt = R.Engine.time; }
        // 選択肢
        if (waitChoice && full) {
          updateChoice(L);
          return;
        }
        // 送る
        const tap = p.released && st.press && !st.press.long && !st.press.btn;
        if (p.released || !p.down) { if (p.released) st.press = null; }
        if (I.pressed('a') || I.pressed('b') || I.pressed('down') || tap) {
          if (!full) { complete(); return; }
          flip(); return;
        }
        if (full && !waitChoice) {
          if (ff && R.Engine.time - st.fullAt > 60) { flip(); return; }
          if (autoOn && st.voiceDone && R.Engine.time - st.fullAt > UIK.T.auto.base + pg.n * UIK.T.auto.perChar) { flip(); return; }
        }
      },
      draw(g) {
        const L = lay();
        pages(L);
        st.L = L;
        drawTalk(g, L);
        if (st.log) drawLog(g);
      },
    };

    // ---------------------------------------------------------------- 選択肢
    function updateChoice(L) {
      const I = R.Input, n = choices.length;
      if (I.repeat('down')) { st.choice = (st.choice + 1) % n; UIK.sfx('cursor'); }
      if (I.repeat('up')) { st.choice = (st.choice + n - 1) % n; UIK.sfx('cursor'); }
      // 選択肢が出てすぐの決定・取り消しは受けない（会話を連打で送っていて、選んだと気づかずに決まるのを防ぐ。テスター 2026-09-30）。
      //   カーソルは動かせる。受けるようになったら（st.armed）以後は素通り
      if (!st.armed) {
        st.guard = st.guard || { t0: st.fullAt };
        if (!UIK.choiceGuard(st.guard)) return;
        st.armed = true;
        st.press = null;   // 受ける前に押したクリックは数えない
      }
      const p = I.pointer, C = L.choice;
      let hit = -1;
      if (C && UIK.hit(C, p.x, p.y)) { const i = Math.floor((p.y - C.y - 8 * (R.uiScale || 1)) / C.rh); if (i >= 0 && i < n) hit = i; }
      if (hit >= 0 && I.lastDevice === 'mouse' && hit !== st.hover) { st.hover = hit; if (hit !== st.choice) { st.choice = hit; UIK.sfx('cursor'); } }
      if (p.pressed && hit >= 0) st.press = { choice: hit };
      if (p.released && st.press && st.press.choice === hit && hit >= 0) { st.choice = hit; UIK.sfx('confirm'); finish(hit); return; }
      if (p.released) st.press = null;
      if (I.pressed('a')) { UIK.sfx('confirm'); finish(st.choice); return; }
      if (I.pressed('b') && o.cancel != null) { UIK.sfx('cancel'); finish(o.cancel); }
    }

    // ---------------------------------------------------------------- ログ（直近 100 行）
    function openLog() { st.log = { top: null }; UIK.sfx('menu_open'); }
    function updateLog() {
      const I = R.Input, lg = st.log;
      if (I.pressed('x') || I.pressed('b') || I.pressed('a')) { st.log = null; UIK.sfx('cancel'); return; }
      const p = I.pointer;
      if (p.pressed && lg.rect && !UIK.hit(lg.rect, p.x, p.y)) { st.log = null; return; }
      if (I.repeat('up')) lg.scroll = (lg.scroll || 0) + 1;
      if (I.repeat('down')) lg.scroll = Math.max(0, (lg.scroll || 0) - 1);
      if (p.wheel) lg.scroll = Math.max(0, (lg.scroll || 0) + (p.wheel < 0 ? 1 : -1));
    }
    function drawLog(g) {
      const k = R.uiScale || 1, s = R.safe || { l: 0, t: 0, r: 0, b: 0 }, m = UIK.margin();
      UIK.dim(g, 0.5);
      const w = Math.min(R.W - s.l - s.r - m * 2, 720 * k), h = R.H - s.t - s.b - m * 2 - 30 * k;
      const x = Math.round((R.W - w) / 2), y = s.t + m;
      const rect = { x, y, w, h };
      st.log.rect = rect;
      UIK.panel(g, rect, { a: 0.9 });
      UIK.icon(g, 'log', x + 20 * k, y + 16 * k, 18 * k, T.color.gold);
      UIK.text(g, R.T('ui.message.msgScene.drawLog.text'), x + 46 * k, y + 16 * k, { size: T.size.h2 * k, weight: 700, color: T.color.gold });
      UIK.hline(g, x + 16 * k, x + w - 16 * k, y + 48 * k, 0.3);
      // 下から新しい順に積む
      const size = T.size.body * k, lh = size * 1.75, tw = w - 150 * k;
      const top = y + 58 * k, bottom = y + h - 16 * k;
      const rows = [];
      for (let i = logs.length - 1; i >= 0 && rows.length < 400; i--) {
        const e = logs[i];
        const ls = UIK.wrap(e.text, tw, { size });
        for (let j = ls.length - 1; j >= 0; j--) rows.push({ name: j === 0 ? e.name : '', s: ls[j], first: j === 0 });
      }
      const cap = Math.floor((bottom - top) / lh);
      const scroll = Math.min(st.log.scroll || 0, Math.max(0, rows.length - cap));
      st.log.scroll = scroll;
      g.save(); g.beginPath(); g.rect(x, top, w, bottom - top); g.clip();
      for (let i = scroll, yy = bottom - lh; i < rows.length && yy >= top - lh; i++, yy -= lh) {
        const r = rows[i];
        if (r.name) UIK.text(g, UIK.fit(r.name, 110 * k, { size: size * 0.9, weight: 700 }), x + 20 * k, yy + size * 0.06, { size: size * 0.9, weight: 700, color: T.color.gold });
        UIK.text(g, r.s, x + 132 * k, yy, { size, color: T.color.text });
      }
      g.restore();
      UIK.prompts(g, [{ btn: 'x', label: R.T('ui.message.msgScene.drawLog.0.label') }, { btn: 'up', label: R.T('ui.message.msgScene.drawLog.1.label') }], { x: x + w, y: y + h + 18 * k, align: 'right' });
    }

    // ---------------------------------------------------------------- 会話の札
    function drawTalk(g, L) {
      const k = R.uiScale || 1;
      const pg = page();
      if (!pg) return;
      // 紙
      UIK.paper(g, { x: L.x, y: L.y, w: L.w, h: L.h });
      // 顔
      if (L.face) {
        UIK.portraitFrame(g, L.face, faceKey, { ringColor: 'rgba(70,50,26,0.55)' });
      }
      // 名前と肩書き
      if (name) {
        const nx = L.tall ? L.nameX : L.tx;
        const nsz = T.size.title * k * (L.tall ? 1.05 : 1);
        const nw = UIK.text(g, name, nx, L.nameY, { size: nsz, weight: 700, color: T.color.inkName, maxW: L.w * 0.5 });
        if (title) {
          if (L.tall) UIK.text(g, title, nx, L.nameY + nsz + 6 * k, { size: T.size.caption * k * 1.05, color: T.color.ink3, maxW: L.x + L.w - nx - 16 * k });
          else UIK.text(g, title, nx + nw + 22 * k, L.nameY + (nsz - T.size.label * k) / 2 + 1 * k, { size: T.size.label * k, color: T.color.ink3, maxW: L.x + L.w - (nx + nw + 22 * k) - 24 * k });
        }
        if (!L.tall) UIK.rule(g, L.tx, L.x + L.w - 34 * k, L.lineY, null, T.color.inkLine);
      }
      // 本文（出ている字まで）
      let left = Math.floor(st.shown);
      const rubyOn = UIK.setting('ruby', false) && (!R.I18n || R.I18n.lang() === 'ja');   // ふりがなは日本語だけ
      for (let i = 0; i < pg.lines.length && left > 0; i++) {
        const ln = pg.lines[i];
        const n = Math.min(ln.n, left);
        left -= n;
        const s = n >= ln.n ? ln.s : [...ln.s].slice(0, n).join('');
        const ly = L.textY + i * L.lh + (L.lh - L.size) / 2;
        UIK.text(g, s, L.tx, ly, { size: L.size, color: T.color.ink });
        if (rubyOn && pg.rubies.length) drawRuby(g, pg, ln, n, L.tx, ly, L.size);
      }
      // 送りの菱形・選択肢
      const last = isLast();
      const full = st.shown >= pg.n;
      if (full && !(last && hasChoices)) {
        const bob = UIK.reduceMotion() ? 0 : Math.sin(R.Engine.time / 220) * 2 * k;
        UIK.diamond(g, L.x + L.w - 26 * k, L.y + L.h - 20 * k + bob, 5 * k, '#a8672a');
      }
      // ボタン（ログ・自動送り・早送り）と文字の速さの札
      drawButtons(g, L);
      if (last && hasChoices && full) drawChoices(g, L);
      if (L.tall) {
        const hint = R.T('ui.message.msgScene.drawTalk.hint');
        UIK.text(g, hint, R.W / 2, L.y + L.h + 8 * k, { size: T.size.caption * k, color: T.color.text2, align: 'center', shadow: true });
      }
    }
    function drawRuby(g, pg, ln, n, x, y, size) {
      const rs = size * 0.5;
      for (const rb of pg.rubies) {
        const a = Math.max(rb.a, ln.a), b = Math.min(rb.b, ln.a + n);
        if (b <= a || rb.a < ln.a) continue;
        const chars = [...ln.s];
        const x0 = x + UIK.measure(chars.slice(0, rb.a - ln.a).join(''), { size });
        const x1 = x + UIK.measure(chars.slice(0, rb.b - ln.a).join(''), { size });
        UIK.text(g, rb.r, (x0 + x1) / 2, y - rs - 1, { size: rs, color: T.color.ink2, align: 'center' });
      }
    }
    function drawButtons(g, L) {
      const k = R.uiScale || 1;
      const touch = R.Input.lastDevice === 'touch' || L.tall;
      st.btns = [];
      const spd = UIK.setting('textSpeed', 'normal');
      if (touch) {
        const defs = [{ id: 'log', icon: 'log', label: R.T('ui.message.msgScene.log.label') }, { id: 'auto', icon: 'repeat', label: R.T('ui.message.msgScene.auto.label') }, { id: 'ff', icon: 'ff', label: R.T('ui.message.msgScene.ff.label') }];
        let x = L.x + L.w;
        const y = L.tall ? L.btnY - 6 * k : L.btnY - 12 * k;
        for (let i = defs.length - 1; i >= 0; i--) {
          const d = defs[i];
          const w = UIK.measure(d.label, { size: 12 * k, weight: 700 }) + 14 * k + 16 * k;
          x -= w;
          const on = d.id === 'auto' && autoOn;
          g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 6;
          UIK.chip(g, x, y, d.label, { size: 12, icon: d.icon, kind: on ? 'gold' : 'plain', bg: on ? undefined : 'rgba(14,16,26,0.72)' });
          g.restore();
          st.btns.push({ id: d.id, r: { x, y: y - 6 * k, w, h: UIK.chipH(12) + 12 * k } });
          x -= 10 * k;
        }
      } else {
        UIK.prompts(g, [{ btn: 'x', label: R.T('ui.message.msgScene.drawButtons.0.label') }, { btn: 'y', label: autoOn ? R.T('ui.message.msgScene.drawButtons.1.label') : R.T('ui.message.msgScene.drawButtons.1.label_2') }, { btn: 'r', label: R.T('ui.message.msgScene.drawButtons.2.label') }], { x: L.x + L.w - 8 * k, y: L.btnY, align: 'right' });
        // 文字の速さ（左上）
        const lbl = autoOn ? R.T('ui.message.msgScene.drawButtons.lbl') : R.T('ui.message.msgScene.drawButtons.lbl_2', { p0: SPEED_LABEL[spd] || SPEED_LABEL.normal });
        UIK.chip(g, L.x + 2 * k, L.btnY - UIK.chipH(11) / 2, lbl, { size: 11, kind: autoOn ? 'gold' : 'plain', bg: autoOn ? undefined : 'rgba(14,16,26,0.6)', color: autoOn ? undefined : T.color.text2 });
      }
    }
    function drawChoices(g, L) {
      const C = L.choice, k = R.uiScale || 1;
      if (!C) return;
      UIK.paper(g, C);
      const size = T.size.body * k * (L.tall ? 1.1 : 1);
      choiceParts.forEach(([a, b], i) => {
        const r = { x: C.x + 8 * k, y: C.y + 8 * k + i * C.rh, w: C.w - 16 * k, h: C.rh };
        const f = i === st.choice;
        if (f) UIK.focus(g, { x: r.x, y: r.y + 2 * k, w: r.w, h: r.h - 4 * k }, R.Engine.time, { paper: true, r: 3 * k });
        UIK.text(g, a, r.x + 22 * k, r.y + (r.h - size) / 2, { size, weight: f ? 700 : 500, color: f ? T.color.ink : T.color.ink2, maxW: r.w - 30 * k - (b ? UIK.measure(b, { size }) + 16 * k : 0) });
        if (b) UIK.text(g, b, r.x + r.w - 12 * k, r.y + (r.h - size) / 2, { size, color: T.color.ink2, align: 'right' });
      });
    }

    function finish(v) {
      if (!cur || cur.scene !== scene) return;
      const c = cur; cur = null;
      const pg = st.pages && page();
      if (pg) { lastShown = { name, title, face: faceKey, page: pg.text, t: R.Engine.time }; readSet.add(readKey(pg)); }
      R.Engine.remove(scene, v);
      c.resolve(v);
    }
    scene.finish = finish;
    scene.state = st;
    scene.name = name;
    return scene;
  }

  // ---------------------------------------------------------------- キャプション
  function capScene(text, o) {
    const T = UIK.T;
    const st = { t0: 0, closing: -1, ms: o && o.ms, voiceDone: true, voiceTok: 0 };
    const plain = M.plain(text);
    const voiceId = o && o.voice;
    const scene = {
      id: 'caption',
      opaque: false,
      enter() {
        st.t0 = R.Engine.time;
        // 守り歌などの声つきの地の文（2026-09-27）: 文と同時に鳴らし、ms の後も声の終わりを待つ
        if (voiceId && R.Audio && R.Audio.voice) {
          st.voiceDone = false;
          const tok = ++st.voiceTok, done = () => { if (st.voiceTok === tok) st.voiceDone = true; };
          try { Promise.resolve(R.Audio.voice(voiceId)).then(done, done); } catch (e) { st.voiceDone = true; }
        }
      },
      exit() {},
      update() {
        const I = R.Input, now = R.Engine.time;
        if (st.closing >= 0) { if (now - st.closing >= 300 || UIK.reduceMotion()) finish(); return; }
        const age = now - st.t0;
        if (st.ms && age >= st.ms && (st.voiceDone || age >= st.ms + 20000)) { st.closing = now; return; }
        if (age > 250 && (I.pressed('a') || I.pressed('b') || I.pointer.released)) { stopVoice(); st.closing = now; }
      },
      draw(g) {
        const k = R.uiScale || 1, now = R.Engine.time;
        const kin = Math.min(1, (now - st.t0) / 400), kout = st.closing >= 0 ? Math.max(0, 1 - (now - st.closing) / 300) : 1;
        const a = Math.min(kin, kout);
        const size = T.size.talk * k * 1.1, lh = size * 1.9;
        const w = Math.min(R.W - UIK.margin() * 2, 640 * k);
        const lines = UIK.wrap(plain, w, { size });
        const h = lines.length * lh;
        const cy = R.H * 0.44;
        g.save();
        g.globalAlpha = a;
        const band = { x: 0, y: cy - h / 2 - 40 * k, w: R.W, h: h + 80 * k };
        UIK.fadePanel(g, { x: 0, y: band.y, w: R.W, h: band.h / 2 }, { side: 'b', a: 0.7 });
        UIK.fadePanel(g, { x: 0, y: band.y + band.h / 2, w: R.W, h: band.h / 2 }, { side: 't', a: 0.7 });
        lines.forEach((l, i) => UIK.text(g, l, R.W / 2, cy - h / 2 + i * lh + (lh - size) / 2, { size, color: T.color.text, align: 'center', shadow: true }));
        if (!st.ms && now - st.t0 > 400) UIK.diamond(g, R.W / 2, cy + h / 2 + 18 * k, 4 * k, 'rgba(236,201,124,0.8)');
        g.restore();
      },
    };
    function finish() {
      if (!cap || cap.scene !== scene) return;
      const c = cap; cap = null;
      pushLog('', plain);
      R.Engine.remove(scene, undefined);
      c.resolve(undefined);
    }
    scene.finish = finish;
    return scene;
  }

  // ---------------------------------------------------------------- 外への口
  M.say = function (o) {
    o = o || {};
    if (cur) cur.scene.finish(undefined);   // 前の say を先に解決する（A6）
    return new Promise((resolve) => {
      const scene = msgScene(o);
      cur = { scene, resolve };
      R.Engine.push(scene);
    });
  };
  M.caption = function (text, o) {
    if (cap) cap.scene.finish();
    return new Promise((resolve) => {
      const scene = capScene(String(text == null ? '' : text), o || {});
      cap = { scene, resolve };
      R.Engine.push(scene);
    });
  };
  M.busy = function () { return !!(cur || cap); };
  M.close = function () {
    if (cur) cur.scene.finish(undefined);
    if (cap) cap.scene.finish();
  };
  M.log = function () { return logs.slice(); };
  M.auto = function (v) { if (v != null) autoOn = !!v; return autoOn; };
  /** 今の会話の中の状態（テスト用）: {page, pages, shown, full, choice, armed（選択肢が決定を受けるか）, log, rect, face, choiceRect, name（描く名前）, textY（本文 1 行目の上）} | null */
  M.state = function () {
    if (!cur) return null;
    const st = cur.scene.state;
    return { page: st.page, pages: st.pages ? st.pages.length : 0, shown: st.shown, full: st.pages ? st.shown >= st.pages[st.page].n : false, choice: st.choice, armed: !!st.armed, log: !!st.log,
      rect: st.L ? { x: st.L.x, y: st.L.y, w: st.L.w, h: st.L.h } : null, face: st.L ? st.L.face : null, name: cur.scene.name, textY: st.L ? st.L.textY : null, choiceRect: st.L && st.L.choice ? { x: st.L.choice.x, y: st.L.choice.y, w: st.L.choice.w, h: st.L.choice.h, rh: st.L.choice.rh } : null };
  };
})(window.RPG);
