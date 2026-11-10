// node tools/build.mjs  -> dist/index.html (the page to publish: one file, three.js from the CDN)
import fs from 'node:fs'; import path from 'node:path'; import { root, distPage, scripts } from './pagegen.mjs';
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const html = distPage(); fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB', 'from', scripts().length, 'scripts');
