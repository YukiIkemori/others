// Shared by the dev server and the build: assemble the page from src/page.html and the scripts.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = ['pal', 'tex', 'mat', 'kit', 'light', 'world', 'ground', 'hero', 'fx', 'veg', 'sky', 'post'];   // main.js goes last, after the areas
export const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js';
const HERO = { png: 'assets/hero_hd8.png', json: 'assets/hero_hd8.json' };   // the first 96-dot hero, 8 directions (ユウキ, 2026-11-10: use this one for the HD-2D trial)

export function scripts(dev) {
  const core = CORE.map(n => 'src/core/' + n + '.js').filter(f => fs.existsSync(path.join(root, f)));
  const areas = fs.existsSync(path.join(root, 'src/areas')) ? fs.readdirSync(path.join(root, 'src/areas')).filter(f => f.endsWith('.js') && (dev || !f.startsWith('_'))).sort().map(f => 'src/areas/' + f) : [];
  return [...core, ...areas, 'src/core/main.js'];
}
function heroSpec() { return fs.readFileSync(path.join(root, HERO.json), 'utf8').trim(); }

// full HTML document for local testing: scripts loaded one by one so errors point at real files
export function devPage() {
  const page = fs.readFileSync(path.join(root, 'src/page.html'), 'utf8');
  const tags = ['<script src="/vendor/three.min.js"></script>', ...scripts(true).map(s => `<script src="/${s}"></script>`),
    `<script>HD.HERO_SPEC = ${heroSpec()}; HD.HERO_SRC = '/${HERO.png}';</script>`].join('\n');
  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>\n' + page.replace('<!--SCRIPTS-->', tags) + '\n</body></html>';
}
// the published page: a fragment (the host adds the skeleton), three.js from the CDN, everything else inline
export function distPage() {
  const page = fs.readFileSync(path.join(root, 'src/page.html'), 'utf8');
  const js = scripts().map(s => '// ---- ' + s + '\n' + fs.readFileSync(path.join(root, s), 'utf8')).join('\n');
  const png = fs.readFileSync(path.join(root, HERO.png)).toString('base64');
  const tags = `<script src="${THREE_CDN}"></script>\n<script>\n${js.replace(/<\/script/gi, '<\\/script')}\nHD.HERO_SPEC = ${heroSpec()}; HD.HERO_SRC = 'data:image/png;base64,${png}';\n</script>`;
  return page.replace('<!--SCRIPTS-->', () => tags);
}
