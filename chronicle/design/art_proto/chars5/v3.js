// V3 — "Bold": the strongest silhouette. Spiky dark hair, ink-navy long coat flaring to the shins,
// a long crimson scarf streaming behind, gloves, tall boots; lamp-lit version with a hard warm rim
// and a bright moon rim. 40 px.
'use strict';
(function (G) {
  const C = G.C5, R = C.ramp;
  const pal = {};
  const put = (keys, list) => keys.split('').forEach((k, i) => (pal[k] = list[i]));
  put('X', ['#0e0b16']);
  put('Z', ['#220e14']);
  put('1234', R([[10, 0.62, 0.45], [17, 0.48, 0.74], [24, 0.30, 0.94], [33, 0.14, 1.0]]));
  put('5', ['#ee9a86']);
  put('abcde', R([[348, 0.52, 0.16], [356, 0.56, 0.26], [8, 0.60, 0.39], [18, 0.58, 0.55], [30, 0.50, 0.74]]));
  put('ABCDEF', R([[254, 0.55, 0.11], [242, 0.50, 0.19], [232, 0.46, 0.28], [223, 0.42, 0.39], [214, 0.36, 0.53], [200, 0.26, 0.72]]));
  put('qrst', R([[348, 0.80, 0.38], [356, 0.78, 0.60], [8, 0.72, 0.82], [22, 0.58, 0.97]]));
  put('ghij', R([[335, 0.30, 0.14], [5, 0.26, 0.23], [18, 0.24, 0.33], [28, 0.22, 0.45]]));
  put('KLMN', R([[350, 0.50, 0.14], [4, 0.52, 0.24], [16, 0.52, 0.37], [28, 0.46, 0.52]]));
  put('OPRSW', R([[245, 0.28, 0.24], [228, 0.18, 0.46], [212, 0.12, 0.68], [200, 0.06, 0.88], [50, 0.05, 1.0]]));
  put('GHJ', R([[22, 0.72, 0.46], [36, 0.64, 0.74], [48, 0.40, 0.96]]));
  put('yY', R([[204, 0.72, 0.50], [184, 0.52, 0.82]]));
  put('TUV', ['#fff8dc', '#ffc85a', '#e0802a']);

  const LANTERN = ['..X..', '.XPX.', 'XPRPX', 'XUTUX', 'XTTUX', 'XUTUX', 'XVUUX', 'XPPPX', '.XXX.'];
  const TAIL_R = ['...XX...', '..XssX..', '.XrsstX.', 'XqrrsstX', '.XqrrssX', '..XqrrX.', '...XqrX.', '....XX..'];
  const TAIL_L = TAIL_R.map((r) => r.split('').reverse().join(''));

  // ---------------------------------------------------------------- front
  const head = [
    '............XX..........',
    '.........XXXdcX.........',
    '.......XXcddedcXX.......',
    '......XcddeedcccbXX.....',
    '.....XcddeddccccbcbX....',
    '....XbcdddcccbcccbbbbX..',
    '....XbcddcccbbccccbbbX..',
    '...XbbcccbbcccbbccbbbX..',
    '...Xbbcc3ZZb3ZZ3ccbbX...',
    '...Xbbc33Wy33Wy33cbbX...',
    '..Xbbbc33YY33YY32cbbX...',
    '..Xabbb3533333352bbaX...',
    '...XabX2333333332XbaX...',
    '....XaX.XX1111XX.XaX....',
  ];
  const down = C.compose(24, 40, [
    { x: 2, y: 12, rows: ['XX...', 'XRX..', '.XKX.', 'XPRPX'] },
    { x: 0, y: 0, rows: head.concat([
      '......XrsstssrrX........',
      '....XqrssttsssrrqX......',
      '...XDEqrrsssrrqqCBX.....',
      '..XEDADEDDCBDCCBBACBX...',
      '..XEDADEDDCHDCCBBACBX...',
      '..XEDADEDDCBDCCBAACBX...',
      '..XEDADEDDCHDCBBAACBX...',
      '..XEDADDDCCBCCBBAABAX...',
      '..XKLADDCCCHCBBAAAKLX...',
      '..XLMKKLMNGHJNMLKKMLX...',
      '....XDEDDCCAACCBBBAX....',
      '....XDEDDCAhhACBBBAX....',
      '...XDEEDDCAhiACBBBBAX...',
      '...XDEEDDCAhiACCBBBAX...',
      '..XDEEDDCBAhiABCCBBBAX..',
      '..XDEEDDCBAihABCCBBBAX..',
      '.XDEEDDCCBAhiABCCBBBAAX.',
      '.XDEEDDCCBAihABCCBBBAAX.',
      'XCDEEDDCBAXhhXABCCBBBAAX',
      'XBCDDCCBAXXghXXABCBBAAAX',
      '.XXXXXXNMLX..XLMNXXXXXX.',
      '......XMLKX..XKLMX......',
      '......XNMKX..XKMNX......',
      '......XMLKX..XKLMX......',
      '.....XNMLKX..XKLMNX.....',
      '.....XXXXXX..XXXXXX.....',
    ]) },
    { x: 6, y: 16, rows: ['XrsX.', 'XrstX', 'XqrsX', 'XqrsX', '.XqrX', '.XqrX', '..XqX', '..XX.'] },
    { x: 16, y: 24, rows: LANTERN },
  ], 'v3 down');
  const downWalk = { y: 34, rows: [
    '.XXXXXXNMLX..XLMNXXXXXX.',
    '......XMLKX..XKLMX......',
    '......XNMKX..XKMNX......',
    '......XMLKX.XNMLKX......',
    '.....XNMLKX.XXXXXX......',
    '.....XXXXXX.............',
  ] };

  // ---------------------------------------------------------------- side (facing right)
  const side = C.compose(24, 40, [
    { x: 0, y: 13, rows: ['....XXXX.', '.XXXqrrsX', 'XqrrsstX.', '.XqrssX..', '..XqrX...', '...XX....'] },
    { x: 0, y: 0, rows: [
      '..........XXX...........',
      '........XXcdeX..........',
      '......XXccddeeXX........',
      '.....XbccddeedccX.......',
      '....XbccdddddcccbX......',
      '....XbcccdddccccbbX.....',
      '...XbbccccccccbcbbX.....',
      '...Xabcbccbcbbc3b3X.....',
      '...Xabcbcbbc33ZZ33X.....',
      '...Xabcbcbbc33yW333X....',
      '...Xabcbcbbc33YY33X.....',
      '....Xabcbbab33353X......',
      '.....XabaX23332X........',
      '......XXXXX111XX........',
      '........XqrrsX..........',
      '.......XCDEDsrX.........',
      '.......XDEEDCCBX........',
      '......XCCAEDACBX........',
      '......XDCCAEDABX........',
      '......XDCCBAEDAX........',
      '......XDCCBBANMLX.......',
      '......XDCBBBAXMLKX......',
      '......XLMNMLKXLKX.......',
      '......XDCCBBBCX.........',
      '.....XDDCCBBBCX.........',
      '.....XDDCCBBBCBX........',
      '....XDDCCBBABCBX........',
      '....XDDCCBAABCBX........',
      '...XDDDCCBBAABCBX.......',
      '..XDDDCCBBBAABCBX.......',
      '..XDDCCBBBAAABCBX.......',
      '.XDDDCCBBBAAXABCX.......',
      'XCDDCCBBAAXXXABX........',
      '.XXXXXXXghhiXXX.........',
      '.......XKLMNX...........',
      '.......XKLMNX...........',
      '.......XKLMNNX..........',
      '.......XKLMMNNX.........',
      '.......XKLLMMMNX........',
      '.......XXXXXXXXX........',
    ] },
    { x: 13, y: 23, rows: LANTERN },
  ], 'v3 side');
  const sideWalk = { y: 33, rows: [
    '.XXXXXXghXhiXX..........',
    '.....XKLX.XKLMNX........',
    '....XKLMX..XKLMNX.......',
    '...XKLMX...XKLMNNX......',
    '...XKLMX...XKLMMNNX.....',
    '..XKLLX....XKLLMMMX.....',
    '..XXXX.....XXXXXXXX.....',
  ] };
  const sideWalkB = { y: 33, rows: [
    '.XXXXXXhiXghXX..........',
    '.....XLMX.XKLKX.........',
    '....XKLMX..XKLMNX.......',
    '...XKLMX...XKLMNNX......',
    '...XKLMX...XKLMMNNX.....',
    '..XKLLX....XKLLMMMX.....',
    '..XXXX.....XXXXXXXX.....',
  ] };

  // ---------------------------------------------------------------- back
  const up = C.compose(24, 40, [
    { x: 2, y: 24, rows: LANTERN },
    { x: 0, y: 0, rows: head.slice(0, 8).concat([
      '...XbbcbcbbcbbcbcbbbX...',
      '...XbbbcbcbbcbbcbbbbX...',
      '..XbbabbcbbabbcbbbabX...',
      '..XabbabbabbabbabbaaX...',
      '...XabXaabbbbaaXbaX.....',
      '....XaX.XX1111XX.XaX....',
      '......XqrrrrrrrX........',
      '....XqrrssssrrrqX.......',
      '...XDEqrrsssrrqqCBX.....',
      '..XEDADEDDCBCCCBBACBX...',
      '..XEDADEDDCBCCCBBACBX...',
      '..XEDADEDDCBCCBBAACBX...',
      '..XEDADEDDCBCCBBAACBX...',
      '..XEDADDDCCBCCBBAABAX...',
      '..XKLADDCCCBCBBAAAKLX...',
      '..XLMKKLMLKKLMLKKKMLX...',
      '....XDEDDCCCCCBBBBAX....',
      '....XDEDDCCCCCBBBBAX....',
      '...XDEEDDCCCCCBBBBBAX...',
      '...XDEEDDCCACCBBBBBAX...',
      '..XDEEDDCCCAACCBBBBBAX..',
      '..XDEEDDCCCAACCBBBBBAX..',
      '.XDEEDDCCCBAABCCBBBBAAX.',
      '.XDEEDDCCCBAABCCBBBBAAX.',
      'XCDEEDDCCBAXXABCCBBBBAAX',
      'XBCDDDCCBAX..XABCBBBAAAX',
      '.XXXXXXKLMX..XMLKXXXXXX.',
      '......XKLKX..XKLKX......',
      '......XKLKX..XKLKX......',
      '......XKLKX..XKLKX......',
      '......XKLKX..XKLKX......',
      '......XXXXX..XXXXX......',
    ]) },
    { x: 7, y: 16, rows: ['XqrX.', 'XqrsX', 'XqrsX', '.XqrX', '.XqrX', '..XqX', '..XX.'] },
    { x: 0, y: 12, rows: [
      '...................X....',
      '..................XRX...',
      '.................XKX....',
      '................XPRPX...',
      '...............XLKX.....',
      '..............XLKX......',
      '.............XLKX.......',
      '.............XLKX.......',
      '............XLKX........',
      '...........XLKX.........',
      '..........XLKX..........',
      '..........XLKX..........',
      '.........XLKX...........',
      '........XLKX............',
      '........XLKX............',
      '.......XMKX.............',
      '......XMKX..............',
      '......XXX...............',
    ] },
    { x: 2, y: 24, rows: LANTERN.slice(0, 1) },
  ], 'v3 up');
  const upWalk = { y: 34, rows: [
    '.XXXXXXKLMX..XMLKXXXXXX.',
    '......XKLKX..XKLKX......',
    '......XKLKX..XKLKX......',
    '......XKLKX.XKLKX.......',
    '......XKLKX.XXXXX.......',
    '......XXXXX.............',
  ] };

  // ---------------------------------------------------------------- battle (3/4 left)
  const battle = C.compose(36, 40, [
    { x: 23, y: 12, rows: ['XqrX.......', 'XqrrsX.....', '.XqrrssXX..', '..XqrrsstXX', '...XXqrrssX', '.....XXqrX.', '.......XX..'] },
    { x: 21, y: 16, rows: ['XCBX', 'XCBX', 'XBAX', 'XLKX', '.XX.'] },
    { x: 9, y: 0, rows: [
      '........X.XX......',
      '......XXXXdcX..XX.',
      '....XXcddeeccXXcX.',
      '...XcdeeddcccbbX..',
      '..XcdedccccbcbbbX.',
      '.XbcdcccbccbbcbbbX',
      '.XbccbccbcbcbbbbbX',
      '.Xc3cb3cbcbcbbbbbX',
      '.X3Z33ZZ3bcbcbbbaX',
      '.X3y33Wy3bcbcbbbaX',
      '.X3Y33YY3bbcbbbaX.',
      '..X3533353abbbbaX.',
      '..X2333332XaabaX..',
      '...X11111XXXXaX...',
    ] },
    { x: 10, y: 14, rows: [
      '...XrsstsrX...',
      '..XDqrsstrCBX.',
      '.XDEDqrrsqCCBX',
      '.XEDDqrsBDCCBX',
      '.XEDDqrsHDCCBX',
      '.XEDDDqrBDCBAX',
      '.XDDDDqrHCCBAX',
      '.XDDCCBqCCBBAX',
      '.XKMNMGHJMLKKX',
    ] },
    { x: 5, y: 23, rows: [
      '.....XDEDCCBCCBBBX....',
      '....XDEDDCCBCCBBBBX...',
      '....XDEDDCCABCCBBBBX..',
      '...XDEEDCCAhABCCBBBBX.',
      '...XDEDDCAhhhACCBBBBX.',
      '..XDEEDCCAhhhACCBBBBBX',
      '..XDEDDCAXhhhXACCBBBBX',
      '.XDEEDCCAX...XACCBBBAX',
      '.XCDDDCBAX...XACBBBAAX',
      'XCDDDCBAX.....XACBBAAX',
    ] },
    { x: 5, y: 33, rows: [
      '.XNMLX.....XNMLX......',
      'XNMLKX.....XMLKX......',
      'XMLKX......XMLKX......',
      'XNMLKX....XNMLKX......',
      'XMLKX.....XMLKX.......',
      'XNMLKX....XNMLKX......',
      'XXXXXX....XXXXXX......',
    ] },
    { x: 2, y: 0, rows: [
      '..X.....',
      '.XWX....',
      '.XSPX...',
      '.XSPX...',
      '.XSPX...',
      '..XSPX..',
      '..XSPX..',
      '..XSPX..',
      '..XSRX..',
      '...XSPX.',
      '...XSPX.',
      '...XSPX.',
      '...XRPX.',
      '....XSPX',
      '....XSPX',
      '....XSPX',
      '..XGHJJHX',
      '....XLX.',
      '....XLX.',
      '....XJX.',
      '.....X..',
    ] },
    { x: 5, y: 15, rows: [
      '.....XEE',
      '....XEDC',
      '...XEDCA',
      'XMLKNDCA',
      'XLKKXCAX',
      '.XXX.XX.',
    ] },
  ], 'v3 battle');

  G.VARIANTS.v3 = {
    id: 'v3', short: 'bold coat', name: '強いシルエット（長いコート＋なびく襟巻き）',
    desc: 'とがった髪、脛まで広がる墨紺のロングコート、後ろへなびく真紅の長い襟巻き、手袋と長靴。灯りの版は強い暖色のリムと月の青いリム。',
    pal,
    mats: { skin: '1234', hair: 'abcde', coat: 'ABCDEF', scarf: 'qrst', pants: 'ghij', leather: 'KLMN', steel: 'OPRSW', brass: 'GHJ', eye: 'yY' },
    emissive: 'TUV', noLit: 'ZWyY', outlineKeys: 'X',
    lit: { half: 0.66, rimK: 0.62, moonK: 0.75, moon: [0.8, 0.95, 1.3], amb: [0.38, 0.40, 0.64] },
    battleZoom: 4,
    views: {
      down: { rows: down, walk: downWalk, neck: 14, waist: 23, lightSide: 1, lamp: [18, 29] },
      side: { rows: side, walk: sideWalk, walkB: sideWalkB, neck: 14, waist: 22, lightSide: 1, lamp: [15, 28] },
      up: { rows: up, walk: upWalk, neck: 14, waist: 23, lightSide: -1, lamp: [4, 29] },
      battle: { rows: battle, neck: 14, waist: 22, lightSide: -1, anchor: [16, 40] },
    },
  };
})(window);
