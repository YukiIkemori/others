// Gemini image generation for the art tools (BRIEF Part A16). Tool-time only: nothing here runs in the game.
//
//   const GI = require('./lib/gemini_image.js');
//   const r = await GI.generate({model, prompt, refs:[file|{mime,bytes}], aspect:'1:1', size:'1K'|'2K'|'4K', out});
//   → {file, bytes, mime, text}
//
// Transport, retries and key handling come from gemini_audio.js (key only in the x-goog-api-key header, `redact()`
// on every error). Every call is appended to design/art_proto/api_log.jsonl (model, purpose, ok, ms — never the key)
// so the API budget can be audited: `GI.count()` sums it.
'use strict';
const fs = require('fs');
const path = require('path');
const GA = require('./gemini_audio.js');

const ROOT = path.resolve(__dirname, '..', '..');
const LOG = process.env.ART_API_LOG || path.join(ROOT, 'design/art_proto/api_log.jsonl');

function mimeOf(file) { return /\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png'; }
function refPart(r) {
  if (typeof r === 'string') return { inline_data: { mime_type: mimeOf(r), data: fs.readFileSync(r).toString('base64') } };
  return { inline_data: { mime_type: r.mime || 'image/png', data: Buffer.from(r.bytes).toString('base64') } };
}
function logCall(rec) {
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, JSON.stringify(rec) + '\n'); } catch (e) { /* ignore */ }
}
/** number of generateContent calls logged so far (optionally since an ISO time) */
function count(since) {
  if (!fs.existsSync(LOG)) return { calls: 0, byModel: {} };
  const byModel = {};
  let calls = 0;
  for (const l of fs.readFileSync(LOG, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const r = JSON.parse(l);
    if (since && r.t < since) continue;
    calls++; byModel[r.model] = (byModel[r.model] || 0) + 1;
  }
  return { calls, byModel };
}

/**
 * o: {model, prompt, refs, aspect, size, out, purpose, temperature}
 * Writes the first returned image to o.out (extension follows the returned mime) and returns its path.
 */
async function generate(o) {
  const model = o.model || 'gemini-3-pro-image';
  const parts = [];
  for (const r of o.refs || []) parts.push(refPart(r));
  parts.push({ text: o.prompt });
  const imageConfig = {};
  if (o.aspect) imageConfig.aspectRatio = o.aspect;
  if (o.size && !/2\.5/.test(model)) imageConfig.imageSize = o.size;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: Object.assign({ responseModalities: ['TEXT', 'IMAGE'], imageConfig }, o.temperature != null ? { temperature: o.temperature } : {}),
  };
  const t0 = Date.now();
  let json, err;
  try { json = await GA.geminiPost(model, body, { tries: 5, timeoutSec: 300, log: o.log }); } catch (e) { err = e; }
  const c = json && json.candidates && json.candidates[0];
  const ps = (c && c.content && c.content.parts) || [];
  let img = null, text = '';
  for (const p of ps) {
    if (p.text && !p.thought) text += p.text;
    const d = p.inlineData || p.inline_data;
    if (d && d.data && !p.thought) img = { mime: d.mimeType || d.mime_type, bytes: Buffer.from(d.data, 'base64') };
  }
  logCall({ t: new Date().toISOString(), model, purpose: o.purpose || path.basename(o.out || ''), refs: (o.refs || []).length, ok: !!img, ms: Date.now() - t0, err: err ? String(err.message).slice(0, 160) : undefined });
  if (err) throw err;
  if (!img) throw new Error(`no image returned (${(c && c.finishReason) || 'no candidate'}): ${GA.redact(text || JSON.stringify(json.promptFeedback || '')).slice(0, 300)}`);
  let out = o.out;
  if (out) {
    const ext = /jpeg/.test(img.mime) ? '.jpg' : /webp/.test(img.mime) ? '.webp' : '.png';
    out = out.replace(/\.(png|jpe?g|webp)$/i, '') + ext;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, img.bytes);
  }
  return { file: out, bytes: img.bytes, mime: img.mime, text };
}

module.exports = { generate, count, LOG, redact: GA.redact };
