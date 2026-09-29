// MENUS: 冒険の合言葉（A2、V2_PLAN §2.5.3 R.Save.passphrase / fromPassphrase）。params {mode:'show'|'enter'} → bool
//   show: 今の旅を 1 行の文字にして見せる（「写す」で写し取り）。enter: 貼り付けた合言葉から読み込む（読めたら true）。
//   長い文字を打つ手段として、開いている間だけ画面の上に文字の欄（textarea）を置く（閉じたら外す）。
(function (R) {
  'use strict';
  const S = (R.Screens = R.Screens || {});
  if (!S.def) S.def = function (id, v) { (S._defs = S._defs || {})[id] = v; };
  const u = (v) => R.UIK.u(v);
  const T = () => R.UIK.T;

  function makeArea(readOnly, value) {
    if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
    const ta = document.createElement('textarea');
    ta.readOnly = !!readOnly;
    ta.value = value || '';
    ta.spellcheck = false;
    ta.setAttribute('aria-label', R.T('ui.passphrase.makeArea.aria-label'));
    ta.style.cssText = 'position:fixed;z-index:10;resize:none;border:1px solid rgba(236,201,124,0.5);border-radius:8px;background:rgba(10,11,20,0.92);color:#f6f0e3;font:14px/1.5 monospace;padding:8px;box-sizing:border-box;word-break:break-all;outline:none;';
    document.body.appendChild(ta);
    return ta;
  }

  S.def('passphrase', {
    init(p) {
      this.mode = p.mode === 'enter' ? 'enter' : 'show';
      this.code = '';
      if (this.mode === 'show') { try { this.code = R.Save.passphrase(); } catch (e) { this.code = ''; } }
      this.ta = makeArea(this.mode === 'show', this.code);
      const rows = this.mode === 'show' ? [{ label: R.T('ui.passphrase.copy.label'), value: 'copy' }, { label: R.T('ui.passphrase.close.label'), value: 'close' }] : [{ label: R.T('ui.passphrase.load.label'), value: 'load' }, { label: R.T('ui.passphrase.paste.label'), value: 'paste' }, { label: R.T('ui.passphrase.close.label_2'), value: 'close' }];
      this.list = new R.UIK.List({ rows, rowH: 40 });
      this.list.onSelect = (row) => this.act(row.value);
      this.list.onCancel = () => this.close(false);
      this.msg = '';
    },
    exit() { if (this.ta && this.ta.parentNode) this.ta.parentNode.removeChild(this.ta); this.ta = null; },
    async act(v) {
      if (v === 'close') { this.close(false); return; }
      if (v === 'copy') {
        let ok = false;
        try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(this.code); ok = true; } } catch (e) { ok = false; }
        if (!ok && this.ta) { try { this.ta.select(); ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } }
        this.msg = ok ? R.T('ui.passphrase.act.msg') : R.T('ui.passphrase.act.msg_2');
        return;
      }
      if (v === 'paste') {
        try { if (navigator.clipboard && navigator.clipboard.readText) { const s = await navigator.clipboard.readText(); if (this.ta) this.ta.value = s; this.msg = R.T('ui.passphrase.act.msg_3'); } } catch (e) { this.msg = R.T('ui.passphrase.act.msg_4'); }
        return;
      }
      if (v === 'load') {
        const s = this.ta ? this.ta.value : '';
        if (R.Save.fromPassphrase(s)) { R.UIK.sfx('confirm'); this.close(true); }
        else { R.UIK.sfx('buzzer'); this.msg = R.T('ui.passphrase.act.msg_5'); }
      }
    },
    update() { this.list.update(); },
    draw(g) {
      const b = S.box(), C = T().color;
      const w = Math.min(b.w, u(620)), x = b.x + (b.w - w) / 2;
      S.heading(g, R.T('ui.passphrase.draw.heading'), x + u(8), b.y + u(6), 0, { size: 15, track: 3 });
      const p = { x, y: b.y + u(44), w, h: Math.min(b.h - u(44), u(96) + R.UIK.wrap(this.mode === 'show' ? 'x'.repeat(40) : 'x', w - u(48), { size: u(14.5) }).length * u(24) + u(150) + this.list.rows.length * this.list.rowPx() + u(50)) };
      R.UIK.panel(g, p, { frost: true });
      const info = this.mode === 'show' ? R.T('ui.passphrase.draw.info') : R.T('ui.passphrase.draw.info_2');
      let y = p.y + u(20);
      for (const l of R.UIK.wrap(info, w - u(48), { size: u(14.5) })) { R.UIK.text(g, l, x + u(24), y, { size: u(14.5), color: C.text2 }); y += u(24); }
      const box = { x: x + u(24), y: y + u(8), w: w - u(48), h: u(130) };
      if (this.ta && R.Gfx && R.Gfx.canvas) {
        const cr = R.Gfx.canvas.getBoundingClientRect(), kx = cr.width / R.W, ky = cr.height / R.H;
        Object.assign(this.ta.style, { left: cr.left + box.x * kx + 'px', top: cr.top + box.y * ky + 'px', width: box.w * kx + 'px', height: box.h * ky + 'px', opacity: String(this.layer.alpha()) });
      } else {
        R.UIK.card(g, box, {});
        R.UIK.text(g, this.code ? this.code.slice(0, 60) + '…' : '', box.x + u(10), box.y + u(10), { size: u(13), color: C.text, maxW: box.w - u(20) });
      }
      if (this.mode === 'show') R.UIK.text(g, R.T('ui.passphrase.draw.text', { length: this.code.length }), box.x + box.w, box.y + box.h + u(6), { size: u(12), color: C.text3, align: 'right' });
      y = box.y + box.h + u(28);
      this.list.draw(g, { x: x + u(14), y, w: w - u(28), h: this.list.rows.length * this.list.rowPx() });
      if (this.msg) R.UIK.text(g, this.msg, x + u(24), p.y + p.h - u(30), { size: u(13.5), color: C.teal });
      S.prompts(g, [{ btn: 'a', label: R.T('ui.passphrase.draw.0.label') }, { btn: 'b', label: R.T('ui.passphrase.draw.1.label') }]);
    },
  });
})(window.RPG);
