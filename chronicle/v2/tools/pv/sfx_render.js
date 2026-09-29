// PV の音: ゲームの効果音とジングル（Web Audio で作る音）を OfflineAudioContext で WAV に書き出す（R.Audio.renderSfx / renderTrack）。
//   node v2/tools/pv/sfx_render.js --site <dist の写し> --out <dir> [id ...]   （ジングルは jingle:<id>）
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./cap');

const DEF = ['bell', 'light', 'glimmer', 'confirm', 'cursor', 'warp', 'chest', 'page', 'quill', 'roar', 'golden', 'steal', 'magic', 'fire', 'wind',
  'boss_die', 'enemy_die', 'hit', 'crit', 'attack', 'secret', 'unlock', 'teleport', 'holy', 'shake', 'menu_open', 'item', 'gold', 'encounter',
  'jingle:victory', 'jingle:chapter', 'jingle:keyitem', 'jingle:rare'];

async function main() {
  const a = process.argv.slice(2);
  let site = null, out = null;
  const ids = [];
  for (let i = 0; i < a.length; i++) { if (a[i] === '--site') site = a[++i]; else if (a[i] === '--out') out = a[++i]; else ids.push(a[i]); }
  fs.mkdirSync(out, { recursive: true });
  const S = await C.start({ site });
  try {
    const P = await C.open(S, 'dev.html?fixture=content_p_roa');
    // 戦闘に入る音（encounter）は戦闘の移りのファイルが初めて使う時に足す: ここで一度呼んで登録させる
    await P.page.evaluate(`(() => { try { const T = RPG.Battle._.trans; if (T && T.cover) { /* cover は画面を使うので呼ばない */ } } catch (e) {} return 1; })()`);
    for (const id of ids.length ? ids : DEF) {
      const b64 = await P.page.evaluate(async (id) => {
        const R = window.RPG, A = R.Audio;
        const SR = 48000;
        const jingle = id.startsWith('jingle:');
        const key = jingle ? id.slice(7) : id;
        if (!jingle && !(R.DB.sfx && R.DB.sfx[key])) return null;
        const len = jingle ? 12 : 4;
        const octx = new OfflineAudioContext(2, SR * len, SR);
        let end;
        if (jingle) { const r = A.renderTrack(octx, key, { passes: 1 }); end = r.end; } else { const r = A.renderSfx(octx, key); end = r.end; }
        const buf = await octx.startRendering();
        const n = Math.min(buf.length, Math.ceil((Math.min(len, (end || len) + 0.6)) * SR));
        const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
        // 16 bit の WAV
        const ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
        const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
        dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
        for (let i = 0; i < n; i++) {
          dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
          dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, Rr[i])) * 32767, true);
        }
        let s = ''; const u8 = new Uint8Array(ab);
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, id);
      if (!b64) { console.log('[sfx] no', id); continue; }
      const f = path.join(out, id.replace(':', '_') + '.wav');
      fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      console.log('[sfx]', id, '→', path.basename(f));
    }
    if (P.errors.length) console.log(P.errors.slice(0, 5));
  } finally { await C.stop(S); }
}
main().catch((e) => { console.error(e); process.exit(1); });
