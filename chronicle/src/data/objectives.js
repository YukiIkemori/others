// "次の目的" texts owned by world (A18a): obj_w_* and obj_regions (DESIGN §10.13.8).
// Other owners register their own prefixes elsewhere: story obj_s_* (src/events/story_objectives.js),
// regions obj_<rs>_<n> (src/events/region<N>_*.js), prologue obj_p_* (src/events/prologue*.js).
//   text: shown in the menu's objective window and the chronicle. {left} = regions not yet
//   cleared, {cleared} = regions cleared (replaced by the menu).
(function (R) {
  'use strict';
  Object.assign(R.DB.objectives, {
    obj_w_roa:        { text: '師匠ベルナの話を聞こう。' },
    obj_w_to_lute:    { text: '港町ファロスの酒場で、\n旅の仲間を探そう。' },
    obj_w_keeper:     { text: '港にいる灯台守の\nオットーを訪ねよう。' },
    obj_w_lighthouse: { text: '半島の南の岬にある、\nファロス灯台に火を取り戻そう。' },
    obj_regions:      { text: '各地の伝承を語り直そう。\n（残り{left}地方）' },
  });
})(window.RPG);
