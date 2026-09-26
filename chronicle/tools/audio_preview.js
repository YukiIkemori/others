#!/usr/bin/env node
// design/audio_preview.html — a plain listening page for the owner: every BGM file (assets/bgm) and every
// voice line (assets/voice) with <audio> players, grouped by track / speaker, relative paths ../assets/…
//   node tools/audio_preview.js
// BGM rows have a "loop seam" button that plays the 6 s before loopEnd and then jumps to loopStart (the
// same jump the game makes), so the seam can be judged by ear.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EXT = ['ogg', 'm4a', 'mp3', 'wav'];
const fileOf = (dir, id) => { for (const e of EXT) if (fs.existsSync(path.join(ROOT, 'assets', dir, id + '.' + e))) return id + '.' + e; return null; };
const kb = (dir, f) => Math.round(fs.statSync(path.join(ROOT, 'assets', dir, f)).size / 1024);

function main() {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'bgm', 'prompts.json'), 'utf8'));
  const C = JSON.parse(fs.readFileSync(path.join(ROOT, 'design', 'voice', 'casting.json'), 'utf8'));
  const VS = require('./voice_script');
  const { lines } = VS.collect();
  let bgmBytes = 0, voiceBytes = 0, bgmN = 0, voiceN = 0;

  const bgmRows = P.tracks.map((t) => {
    const f = fileOf('bgm', t.id);
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'bgm', t.id + '.json'), 'utf8')); } catch (e) { /* none */ }
    if (f) { bgmBytes += kb('bgm', f); bgmN++; }
    const a = meta.analysis || {};
    return `<tr id="bgm-${t.id}"><td><b>${esc(t.id)}</b><br><small>${esc(t.scene)}</small></td>
<td>${f ? `<audio controls preload="none" src="../assets/bgm/${esc(f)}"></audio><br><button data-seam="../assets/bgm/${esc(f)}" data-ls="${meta.loopStart || 0}" data-le="${meta.loopEnd || 0}">loop seam</button> <small>loop ${(+meta.loopStart || 0).toFixed(2)}–${(+meta.loopEnd || 0).toFixed(2)} s · ${a.loudnessLUFS != null ? a.loudnessLUFS + ' LUFS · ' : ''}${kb('bgm', f)} KB${a.loopScore != null ? ' · match ' + a.loopScore : ''}</small>` : '<i>not generated (synth track plays)</i>'}</td>
<td><small>${esc(t.desc || t.mood)}</small></td></tr>`;
  }).join('\n');

  const heroRows = [];
  if (C.hero) {
    for (const g of Object.keys(C.hero.voices)) {
      const v = C.hero.voices[g];
      const cells = [];
      for (const kind of Object.keys(C.hero.lines)) {
        C.hero.lines[kind].forEach((ln, i) => {
          const id = `v_hero_${g}_${kind}_${i + 1}`, f = fileOf('voice', id);
          if (f) { voiceBytes += kb('voice', f); voiceN++; }
          cells.push(`<tr><td><code>${id}</code></td><td>${esc(kind)}</td><td>${esc(ln.text)}</td><td>${f ? `<audio controls preload="none" src="../assets/voice/${esc(f)}"></audio>` : '<i>missing</i>'}</td></tr>`);
        });
      }
      heroRows.push(`<h3>主人公（${g === 'm' ? '男' : '女'}）— ${esc(v.name)} <code>${esc(v.voice)}</code></h3><table>${cells.join('\n')}</table>`);
    }
  }
  const by = {};
  for (const l of lines) (by[l.speaker] = by[l.speaker] || []).push(l);
  const spk = Object.keys(by).map((sp) => {
    const cs = C.speakers[sp] || {};
    const rows = by[sp].map((l) => {
      const f = fileOf('voice', l.id);
      if (f) { voiceBytes += kb('voice', f); voiceN++; }
      return `<tr><td><code>${esc(l.id)}</code></td><td>${esc(l.text)}</td><td>${f ? `<audio controls preload="none" src="../assets/voice/${esc(f)}"></audio>` : '<i>missing</i>'}</td><td><small>${esc((C.lines || {})[l.id] || '')}</small></td></tr>`;
    }).join('\n');
    return `<h3 id="sp-${sp}">${esc(by[sp][0].name)} <small><code>${esc(sp)}</code> · voice <code>${esc(cs.voice)}</code>${cs.fx ? ' · fx ' + esc(cs.fx) : ''}</small></h3><p><small>${esc(cs.profile)}</small></p><table>${rows}</table>`;
  }).join('\n');

  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audio Preview</title>
<style>
:root{--bg:#fbfaf7;--fg:#222;--mute:#666;--line:#ddd;--acc:#2b5d9b}
@media (prefers-color-scheme: dark){:root{--bg:#16171a;--fg:#e6e6e6;--mute:#9a9a9a;--line:#333;--acc:#8db4ea}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1100px;padding:16px}
h1{font-size:20px}h2{margin-top:32px;border-bottom:2px solid var(--line)}h3{margin:24px 0 4px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top}
small,i{color:var(--mute)}audio{height:32px;max-width:100%}code{font-size:12px}a{color:var(--acc)}
button{font-size:12px;margin-top:2px}
</style></head><body>
<h1>ルミナス・クロニクル — 音の試聴</h1>
<p>BGM ${bgmN} 曲（${(bgmBytes / 1024).toFixed(1)} MB）、ボイス ${voiceN} 本（${(voiceBytes / 1024).toFixed(1)} MB）。ファイルは <code>assets/bgm/</code> <code>assets/voice/</code>。
「loop seam」はループの継ぎ目（終わり6秒 → ループ先頭）を試聴します。作り直し: <code>node tools/lyria_bgm.js --only &lt;id&gt; --force</code> / <code>node tools/voice_tts.js --only &lt;id&gt; --force</code>。</p>
<p><a href="#bgm">BGM</a> · <a href="#hero">主人公の戦闘ボイス</a> · <a href="#voice">台詞</a></p>
<h2 id="bgm">BGM</h2>
<table>${bgmRows}</table>
<h2 id="hero">主人公の戦闘ボイス</h2>
${heroRows.join('\n')}
<h2 id="voice">台詞（${lines.length} 行）</h2>
${spk}
<script>
let ac, cur;
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-seam]'); if (!b) return;
  ac = ac || new AudioContext(); if (cur) { try { cur.stop(); } catch (x) {} }
  const buf = await ac.decodeAudioData(await (await fetch(b.dataset.seam)).arrayBuffer());
  const ls = +b.dataset.ls, le = +b.dataset.le || buf.duration;
  const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = ls; s.loopEnd = le; s.connect(ac.destination);
  s.start(0, Math.max(0, le - 6)); s.stop(ac.currentTime + 14); cur = s;
});
</script>
</body></html>
`;
  const out = path.join(ROOT, 'design', 'audio_preview.html');
  fs.writeFileSync(out, html);
  console.log(`audio_preview: ${bgmN} BGM, ${voiceN} voice → ${path.relative(ROOT, out)}`);
}
main();
