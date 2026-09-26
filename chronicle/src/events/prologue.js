// Prologue (A18b): the objectives obj_p_* and the helpers shared by the prologue events
// (DESIGN §10.7, §13.1). The scripts themselves are in prologue_roa.js / prologue_lute.js /
// prologue_lighthouse.js.
//
// Objectives (「次の目的」, §10.13.8 — the prologue's own prefix obj_p_*, §13.1):
//   obj_p_roa         P1 → talk to the master           (set by roa_house_intro)
//   obj_p_to_lute     P2 → the tavern in Faros           (roa_berna)
//   obj_p_keeper      P6 → the lighthouse keeper         (lute_tavern_start)
//   obj_p_lighthouse  P7 → relight the lighthouse        (lute_otto)
//   P10 hands over to the world's obj_regions           (lute_departure)
(function (R) {
  'use strict';
  const K = (R.Prologue = R.Prologue || {});

  Object.assign(R.DB.objectives, {
    obj_p_roa:        { text: '師匠ベルナの話を聞こう。' },
    obj_p_to_lute:    { text: '港町ファロスの酒場で、\n旅の仲間を探そう。' },
    obj_p_keeper:     { text: '港にいる灯台守の\nオットーを訪ねよう。' },
    obj_p_lighthouse: { text: '半島の南の岬にある、\nファロス灯台に火を取り戻そう。' },
  });

  /** first matching {cond, text} entry's text (§3.2.4 form), for lines chosen inside scripts */
  K.pick = function (ev, list) {
    for (const e of list) if (e && ev.check(e.cond)) return e.text;
    return null;
  };

  /** the master's free lodging in roa_house (§10.9.3 「泊まる？（無料で全快）」) → bool */
  K.stay = async function (ev, stranger) {
    const yes = await ev.yesno(stranger ? '休んでいきますか？' : '泊まっていくかい？');
    if (!yes) {
      await ev.say(stranger ? 'そう。道中、気をつけてね。' : 'そうかい。気をつけてお行き。');
      return false;
    }
    await ev.say(stranger ? 'では、ゆっくりお休みなさい。' : 'ゆっくりお休み。');
    ev.closeMessage();
    await ev.fadeOut(30);
    ev.heal();
    ev.setRespawn('roa', 'berna_house');
    await ev.jingle('inn');
    await ev.wait(20);
    await ev.fadeIn(30);
    await ev.say(stranger ? 'よく眠れたかしら。\n……いってらっしゃい、旅の方。' : 'よく眠れたかい？\n……さあ、いってらっしゃい。');
    return true;
  };

  /** the three lessons of the lighthouse keeper (P7, word for word §10.7) */
  K.OTTO_TIPS = [
    '仲間は前列と後列に並ぶんじゃ。\n後列は狙われにくいが、槍・弓・鞭の\nほかは、前まで届かんぞ。',
    '武器は2つまで持てる。戦うときは、\nどちらの武器で行くかを選ぶんじゃ。',
    '戦いに慣れたら『オート』に任せてもよい。\nBを押せば、いつでも自分で指示できる。',
  ];
})(window.RPG);
