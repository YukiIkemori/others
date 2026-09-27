const B = require('/home/user/others/chronicle/v2/tools/lib/browser');
const st = B.start; B.start = (o) => st(Object.assign({ dist: process.env.DIST }, o || {}));
let first = true; const op = B.open;
B.open = async (S, pg, o) => { const P = await op(S, pg, Object.assign({}, o, { timeout: 240000 })); if (first) { first = false; P.close = async () => {}; } return P; };   // the QA reads the first page after closing it
process.argv = [process.argv[0], '/home/user/others/chronicle/v2/tools/qa/check_doors.js', '--map', 'roa', '--jobs', '1'];
require('/home/user/others/chronicle/v2/tools/qa/check_doors.js');
