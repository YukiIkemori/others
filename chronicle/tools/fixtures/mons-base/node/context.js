// Node-side helper for the context mode of tools/sheet_monsters_a.js / _b.js / _c.js (area A14b).
// (Kept in a sub-folder so `node tools/build.js --with tools/fixtures/mons-base` does not bundle it.)
//
//   const CTX = require('./fixtures/mons-base/node/context');
//   CTX.head()      → <style> for the sheet page's <head>: the game font (DotGothic16 from
//                     assets/fonts, which the build embeds the same way)
//   CTX.script()    → <script> tag for the shared battle-screen mock tools/fixtures/mons-base/
//                     battle_screen.js (real R.Gfx windows and text); load it after the sources
//   CTX.FONT_READY  → page expression that resolves once the font has loaded
//   CTX.compose()   → { spriteId: [base, hsb, filter?] } parsed from the compose tables of DESIGN.md
//                     (§9.4.6 mobs, §9.11.6 bosses): the fallback when mon:<spriteId> is not built
//   CTX.PAGE        → page code defining window.CONTEXT(bg, groups, scale, compose) → PNG data URL:
//                     one full 256×224 battle screen per group, stacked with an 8 px gap
//                     (RPG.MonsBaseScreen.sheet; group entries as in battle_screen.js)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../..');
const FONT = path.join(ROOT, 'assets/fonts/DotGothic16-Regular.ttf');
const SCREEN = path.join(ROOT, 'tools/fixtures/mons-base/battle_screen.js');

function head() {
  return fs.existsSync(FONT) ? `<style>@font-face{font-family:"DotGothic16";src:url("file://${FONT}") format("truetype");font-display:block}</style>` : '';
}
/** script tag for the screen mock: load it after the sources */
const script = () => `<script src="file://${SCREEN}"></script>`;
/** wait (in the page) until the game font is ready, so the first screen is not drawn in a fallback face */
const FONT_READY = `document.fonts && document.fonts.load('10px "DotGothic16"').then(() => true, () => false)`;

function compose() {
  const md = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const out = {};
  for (const m of md.matchAll(/^\s+([a-z0-9_]+): \['([a-z_]+)', (\{[^}]*\}), \[.*\](?:, '([a-z]+)')?\],?\s*$/gm)) {
    out[m[1]] = [m[2], Function('return (' + m[3] + ')')(), m[4] || null];
  }
  return out;
}

const PAGE = 'window.CONTEXT = (bg, groups, s, table) => window.RPG.MonsBaseScreen.sheet(bg, groups, s, table);\n';

module.exports = { head, script, compose, PAGE, FONT_READY, ROOT };
