// Router: index.html?view=<name>&layout=wide|tall[&device=pad|kb|touch]
'use strict';
(async function () {
  const Q = new URLSearchParams(location.search);
  const view = Q.get('view') || 'battle', layout = Q.get('layout') || 'wide';
  if (Q.get('device')) K.setDevice(Q.get('device'));
  try {
    await document.fonts.load('700 20px ZenMaru', 'あア亜'); await document.fonts.load('500 20px ZenMaru', 'あア亜');
    await document.fonts.load('700 20px Cinzel', 'A'); await document.fonts.load('400 20px Cinzel', 'A');
    if (view === 'none') { document.title = 'done'; return; }
    const fn = SCREENS[view];
    if (!fn) throw new Error('no view ' + view);
    await fn({ layout, Q });
    if (Q.get('noui') && window.__art) { K.device(); K.ctx.drawImage(window.__art, 0, 0); }
    document.title = 'done';
  } catch (e) { console.error(e.stack || e); document.title = 'err'; }
})();
