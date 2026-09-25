// Story objectives (menu "次の目的" window) — one per story stage.
//   text : shown in the field menu (≤ 3 short lines)
//   king : what the king of Regnas advises at this stage (event king_talk)
// R.Story.objective() (src/events/story.js) derives the current id from flags
// and key items on every map load / flag change / step.
(function (R) {
  'use strict';
  R.DB.objectives = R.DB.objectives || {};
  Object.assign(R.DB.objectives, {
    obj_start: {
      text: 'レグナス王の話を聞こう。',
      king: 'よくぞ参った。',
    },
    obj_wind: {
      text: '城のはるか北、山のふもとの\n風の洞窟で\n風の紋章を探そう。',
      king: '風の洞窟は、この城のはるか北、\n山のふもとにある。\f途中のミルトの村で\n休んでから向かうがよかろう。',
    },
    obj_gate: {
      text: '城の東の関所を抜けて、\n北東の港町ポルタへ\n向かおう。',
      king: 'おお、風の紋章を\n手に入れたか！　見事じゃ！\f東の関所の兵に\n紋章を見せるがよい。\n通してくれるはずじゃ。\f関所を抜けて北東へ進めば、\n港町ポルタがある。',
    },
    obj_bandits: {
      text: 'ポルタのはるか南、\n盗賊の砦のお頭を\n懲らしめよう。',
      king: 'ポルタの港が、盗賊どもに\nふさがれておるとな……。\f盗賊の砦は、ポルタのはるか南、\n岬の先にあるそうじゃ。\nやつらを懲らしめてまいれ！',
    },
    obj_ship: {
      text: '港町ポルタの船長に\n会いに行こう。',
      king: '盗賊どもを懲らしめたそうじゃな！\fポルタの船長が、\nそなたたちを待っておるぞ。',
    },
    obj_water: {
      text: '船で南東の森の村エルフィンへ。\n近くの水の洞窟で\n水の紋章を探そう。',
      king: '船を手に入れたか！\nこれで世界のどこへでも\n行けよう。\f南東の海に浮かぶ森の島に、\nエルフたちの住む\n森の村エルフィンがある。\f水の紋章は、その近くに\n祀られておるはずじゃ。',
    },
    obj_earth: {
      text: '南西の砂漠の町サルバへ。\nその西のピラミッドに\n大地の紋章が眠る。',
      king: '大地の紋章は、\n南西の砂漠にそびえる\nピラミッドに眠るという。\f砂漠の町サルバを訪ねよ。\n銀の鍵が役に立つはずじゃ。',
    },
    obj_frost: {
      text: '北の雪の村フロストへ。\n氷結の洞窟に\n金の鍵があるらしい。',
      king: '残る紋章は、\n金の扉の向こうに\n守られておる。\f金の鍵は、北の雪国にある\n氷結の洞窟に眠るという。\n雪の村フロストを目指せ。',
    },
    obj_fire: {
      text: '北東の炎の火山へ。\n金の扉の奥に\n炎の紋章がある。',
      king: '金の鍵を手に入れたか！\f北東の島にそびえる炎の火山。\nその奥に、炎の紋章が\n祀られておる。\f熱いぞ。心して行け。',
    },
    obj_star: {
      text: '魔法都市アルカナの北東、\n星見の塔で\n星の紋章を手に入れよう。',
      king: '最後の紋章は、\n星見の塔の頂にある。\f東の大陸にある\n魔法都市アルカナを訪ねるがよい。\n{metem}の故郷じゃな。',
    },
    obj_temple: {
      text: '五つの紋章を持って、\n海の真ん中に浮かぶ\n光の神殿へ行こう。',
      king: 'ついに五つの紋章が\nそろったか……！\f世界の真ん中の島に、\n光の神殿がある。\fそこで光の紋章を\nよみがえらせるのじゃ！',
    },
    obj_demon: {
      text: '魔の渦は消えた。\n南東の最果ての祠で支度を整え、\n魔王城へ！',
      king: '魔の渦が消えたか！\nいよいよ魔王との決戦じゃな。\f南東の海に、\n最果ての祠がある。\fそこで支度を整え、\n魔王城へ向かうのじゃ。\nそなたたちの無事を祈っておるぞ。',
    },
    obj_clear: {
      text: '世界に平和が戻った。\nおつかれさま！',
      king: 'そなたたちのおかげで、\n世界に平和が戻った。\fレグナスの誰もが、\nそなたたちを誇りに\n思っておるぞ。',
    },
  });
})(window.RPG);
