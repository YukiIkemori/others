// PV だけの声（ゲームには入れない）: つかみの一行「この世界は、朝を知らない。」をフィーネの声で 1 本作る。
//   node v2/tools/pv/pv_voice.js <出力のディレクトリ>     （GOOGLE_API_KEY が要る。声の道具 tools/voice_tts.js をそのまま使う）
//   台本（story_v2_lines.csv）には足さない: 道具の行の読み込みをこの 1 行に差し替えて、--only で作る。
'use strict';
const path = require('path');
const TOOLS = path.resolve(__dirname, '..', '..', '..', 'tools');
const SV = require(path.join(TOOLS, 'story_voice'));
const VT = require(path.join(TOOLS, 'voice_tts'));
const LINE = {
  id: 'pv_hook_01', speaker: 'fine', kind: 'story', file: 'PV', event: 'pv_hook', key: 'pv',
  text: 'この世界は、朝を知らない。',
  direction: 'the very first words of the trailer, over a dark night sea and a lighthouse: calm, quiet, slightly mysterious narration; slow, hushed, a small pause at the comma',
};
SV.loadLines = () => [LINE];
const out = path.resolve(process.argv[2] || '.');
VT.main(['--only', LINE.id, '--out', out, '--raw', out, '--direct', '--tries', '2', '--lufs', '-16'], process.env).then((c) => { process.exitCode = c; });
