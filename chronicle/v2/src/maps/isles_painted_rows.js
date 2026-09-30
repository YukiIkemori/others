// 生成物（design/art_ref/gen/env/_tools/under/field_isles/ の areas_isles.py・dng_isles.py → fit.py → put_rows.py）。手で直さない。
// 描いた下絵に合わせた諸島の町・ダンジョンの当たり（rows、字は field_isles/lib.py と同じ）・絵（art）・建物の敷地と戸口（blds）。
// isles_coral.js・isles_nerei.js・isles_cave.js・isles_ghostship.js が R.Isles.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const I = (R.Isles = R.Isles || {});
  I.PAINTED = /*DATA*/{
 "coral": {
  "rows": [
   "XXXXXXXXXXXXXXXXXXXXX====XXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXX====XXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXX====XXXXXXXXXXXXXXXXXXXXXXX",
   "XXTTXXXXXXXXXTTTT,,,,cccc,,,,T,,,,,,,,T,,TT,,,XX",
   "XXTTXXXXXXXXXT,,,,,,,cccc,,,XXXXXXX,,,,,,TT,,,XX",
   "XXTTXXXXXXXXXT,,,,,,Tcccc,,TXXXXXXX,,,,,,,,,,,XX",
   "XX,TTXXXXXXXX,,T,TT,,cccc,TTXXXXXXXTT,,,,,,,,TXX",
   "XX,,TXXXXXXXXTTT,TT,,cccc,TTXXXXXXXTTTT,,,,,,,XX",
   "XX,,,XXXXXXXXTTTT,TTTcccc,,,XXXXXXXTTT,,,,,,,,XX",
   "XXT,TXXXXcXXXTT,,,,,Tcccc,,,XXcXXXXTT,,,,,,,,,XX",
   "XXccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXcXXXXXXXcXXXXccccXXXXXcXXXXXXXXcXXXXXXXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXcXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXcXXXXXcXXXXXccccXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXccXcXXcccXcXcccccXXXXXXXXcXXXXXXXXXXXXXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXccXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXccXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXccXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXccXXXXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXcccccccccccccccccccccccccccccccccXX",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~==~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~==========~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==========~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==========~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "isles/under/coral",
   "painted": [],
   "overlay": "isles/under/coral_over"
  },
  "blds": [
   {
    "id": "coral_harbormaster",
    "x": 5,
    "y": 3,
    "w": 8,
    "h": 7,
    "door": [
     9,
     9
    ]
   },
   {
    "id": "coral_house1",
    "x": 28,
    "y": 4,
    "w": 7,
    "h": 6,
    "door": [
     30,
     9
    ]
   },
   {
    "id": "coral_inn",
    "x": 3,
    "y": 16,
    "w": 9,
    "h": 9,
    "door": [
     8,
     24
    ]
   },
   {
    "id": "coral_tavern",
    "x": 13,
    "y": 16,
    "w": 7,
    "h": 9,
    "door": [
     16,
     24
    ]
   },
   {
    "id": "coral_house2",
    "x": 28,
    "y": 18,
    "w": 7,
    "h": 7,
    "door": [
     30,
     24
    ]
   },
   {
    "id": "coral_house3",
    "x": 36,
    "y": 17,
    "w": 8,
    "h": 8,
    "door": [
     39,
     24
    ]
   },
   {
    "id": "coral_items",
    "x": 3,
    "y": 30,
    "w": 8,
    "h": 8,
    "door": [
     9,
     37
    ]
   },
   {
    "id": "coral_arms",
    "x": 12,
    "y": 30,
    "w": 8,
    "h": 8,
    "door": [
     15,
     37
    ]
   },
   {
    "id": "coral_guild",
    "x": 26,
    "y": 29,
    "w": 13,
    "h": 10,
    "door": [
     33,
     38
    ]
   }
  ]
 },
 "nerei": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~XR~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~RccccXccc~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~R;ccccccccRR~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~R,,cccccccc,,R~~~~~~~~~~~~",
   "~~~~~~~~~~~~~R,,,cccccccc,,R~~~~~~==~~~~",
   "~~~~~~~~~~~~~R,,,cccccccc,,R~~~~~~==~~~~",
   "~~~~~~~~~~~~XXXXXX,,::::::::r=======~~~~",
   "~~~~~~~~~~~~XXXXXX;,:::::::::=======~~~~",
   "~~~~~~~~~~~~XXXXXX,,:,,,,,,,R~~~~~==~~~~",
   "~~~~~~~~~~~RXXXXXX,,:,,,,,,,R~~~~~==~~~~",
   "~~~~~~~~~~~RXXXcXX,,:,,,,,,,R~~~~~==~~~~",
   "~~~~~~~~~~~R,,,:,,;;:,XXXXXXRR~~~~~~~~~~",
   "~~~~~~~~~~~R,,,,,;;;:,XXXXXXRR~~~~~~~~~~",
   "~~~~~~~~~~~R,,,,;;;;:;XXXXXXRR~~~~~~~~~~",
   "~~~~~~~~~~R;;;;;;;;;:;XXXXXXRR~~~~~~~~~~",
   "~~~~~~~~~~R;;;;;;;;;:,XXXcXXrR~~~~~~~~~~",
   "~~~~~~~~~~R;;;;;;;;;:;;;,;;;;R~~~~~~~~~~",
   "~~~~~~~~~~R;XXXXXX;;:;;;,;;;;R~~~~~~~~~~",
   "~~~~~~~~~~R;XXXXXX;;:;;,,,;;;r~~~~~~~~~~",
   "~~~~~~~~~~R;XXXXXX;,:,,,,,,;rs~~~~~~~~~~",
   "~~~~~~~~~~R,XXXXXX,,:,,,,,,,ss~~~~~~~~~~",
   "~~~~~~~~~~RrXXXXcX,,:,,,,,,,ss~~~~~~~~~~",
   "~~~~~~~~~~Rrr,,,:,,,:,,,,,,,;s~~~~~~~~~~",
   "~~~~~~~~~~ssr,,,,,,,:,XXXXXX,R~~~~~~~~~~",
   "~~~~~~~~~~rssr,,,,,,:,XXXXXX,R~~~~~~~~~~",
   "~~~~~~~~~~rss,,,,,,,:,XXXXXX,R~~~~~~~~~~",
   "~~~~~~~~~~~rs,,,,,,,:,XXXXXXR~~~~~~~~~~~",
   "~~~~~~~~~~~Rr,,,,,,,:,XXXcXXR~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:,,,,:,,R~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:,,,,,,,~~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:,,,,,,R~~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:,,,,,,~~~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:,,,,,R~~~~~~~~~~~~~",
   "~~~~~~~~~~~XXXXXXX,,:;,,,,R~~~~~~~~~~~~~",
   "~~~~~~~~~~~XXXcXXX,,:;;;;,R~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~R;;;,,,:,;;;,~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~R;,,,,:,,;;R~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~,,,,,,:,,,,,~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~,,,,,:,,,,R~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~R,,,,:,,,,~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~R,,,,:,,,R~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~R,,,.:,,,R~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "isles/under/nerei",
   "painted": []
  },
  "blds": [
   {
    "id": "nerei_lampkeeper",
    "x": 12,
    "y": 8,
    "w": 6,
    "h": 5,
    "door": [
     15,
     12
    ]
   },
   {
    "id": "nerei_marina",
    "x": 22,
    "y": 13,
    "w": 6,
    "h": 5,
    "door": [
     25,
     17
    ]
   },
   {
    "id": "nerei_store",
    "x": 12,
    "y": 19,
    "w": 6,
    "h": 5,
    "door": [
     16,
     23
    ]
   },
   {
    "id": "nerei_house",
    "x": 22,
    "y": 25,
    "w": 6,
    "h": 5,
    "door": [
     25,
     29
    ]
   },
   {
    "id": "nerei_inn",
    "x": 11,
    "y": 30,
    "w": 7,
    "h": 7,
    "door": [
     14,
     36
    ]
   }
  ]
 },
 "isles_cave_1": {
  "rows": [
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRssssRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRskkkksRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRskkkkkkksRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRkkkkkkkkrRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRrkkkkkkrRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkrRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkrRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkrRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRwwwwwwwwwkkkkswwwwwwwwRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRwwwwwwwwwkkkkswwwwwwwwRRRRRRRRRRRRR",
   "RRRRRRRRRRRRssRRRRRRRRkkkksRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRsssRRRRRRRRkkkksRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRkkkkkkssRRRRRRRkkkkkkkkkkRRRRRRRRRRRRRRRRR",
   "RRRRkkkkkkkkkkRRRRkkkkkkkkkkkkkkRRRRRRRRRRRRRRRR",
   "RRRRkkkkkkkkkkkkkkkkXkkkkkkkkkkkkRRRRRRRRRRRRRRR",
   "RRRRkkkkkkkkkkkkkkkkkkkkkkrwwwkkkRRRRRRRRRRRRRRR",
   "RRRRkkkkkkkkkkkkkkkkkkkkrwwwwwkkkkkkkkkwwwkRRRRR",
   "RRRRRkkkkkkkkkkRRRkkkkkkrwwwwwkkkkkkkkkwwwkkkRRR",
   "RRRRRkkkkkkkkRRRRRRkkkkkkrwwwwkkkkkkkkkkrkkkkRRR",
   "RRRRRRRkkkkkRRRRRRRkkkkkkkkrrkkRRRkkkkkkkkkkkRRR",
   "RRRRRRRRRRRRRRRRRRRRkkkkkkkkksRRRRRskkkkkkkkkRRR",
   "RRRRRRRRRRRRRRRRRRRRRskkkrRRRRRRRRRRkkkkkskksRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkrRRRRRRRRRRRskksssRRRRR",
   "RRRRRRRRwwwwwwwwwwwwwwkkkkwwwwwwwwwwwwwRsssRRRRR",
   "RRRRRRRwwwwwwwwwwwwwwwkkkkwwwwwwwwwwwwwwwRRRRRRR",
   "RRRRRRRRwwRRRRRRRRwwwwsssswwwRRRRRRwwwwwwRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRkkkkkkRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRkkkkkkkkkkRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRkkkkkkkkkkkkRsRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRskkkkkkkkskkkkkrRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRkkkkkkkkssskkkrrRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRkkrrkkkkkskkkkrRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRrwwkkkkkkkkkrRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRwkkkkkkrRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkkRRRRRRRRRRRRRRRRRRRRRR"
  ],
  "art": {
   "image": "isles/under/isles_cave_1",
   "painted": [],
   "closed": "isles/under/isles_cave_1_closed"
  },
  "blds": []
 },
 "isles_cave_2": {
  "rows": [
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRrsssssRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRsssssssRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRkkkssskkkkRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRkkkkkkkkkkkRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRkkkkkkkkkkkkRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRkkkkkkkkkkkkkssRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRkkkkkkkkkkkkkksRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRkkkkkkkkkkkkksRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRkkkkkkkkkkkkkksRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRkkkkkkkkkkkkkkkkkswwwRRRRRRRRR",
   "RRRRRRRRRRRRrkkkkkkkkwwwwwkkkkkkssRRRRRRRRRR",
   "RRRRRRRRRRRkkkkwwwwwwwwwwwwwwwrkkksRRRRRRRRR",
   "RRRRRRRRRRrkkswwwwwwwwwwwwwwwwwwkkksRRRRRRRR",
   "RRRRRRRRkkkkkwwwwwwwwwwwwwwwwwwwwwksRRRRRRRR",
   "RRRRRRRRRkkkswwwwwwwwwwwwwwwwwwwwwkksRRRRRRR",
   "RRRRRRRRRrkkwwwwwwwwwwwwwwwwwwwwwwkksRRRRRRR",
   "RRRRRRRRRRkkwwwwwwwwwwwwwwwwwwwwwwkkksRRRRRR",
   "RRRRRRRRRRrkswwwwwwwwwwwwwwwwwwwwwkkksRRRRRR",
   "RRRRRRRRRRrkswwwwwwwwwwwwwwwwwwwwwkkksRRRRRR",
   "RRRRRRRRRRrkswwwwwwwwwwwwwwwwwwwwwkkkRRRRRRR",
   "RRRRRRRRRRrkkswwwwwwwwwwwwwwwwwwwwkksRRRRRRR",
   "RRRRRRRRRRRrkkwwwwwwwwwwwwwwwwwwrrkkssRRRRRR",
   "RRRRRRRRRRRkkkkkwwwwwrkwwwwwwwwkkkkssssRRRRR",
   "RRRRRRRRRwwwskkkkkkkkkkkwwwwwrkkkkssssssRRRR",
   "RRRRRRRRRRwRRRkkkkkkkkkkrrrrkkkkkksssssssRRR",
   "RRRRRRRRRRRRRRRrkkkkkkkkkkkkkkkRsRrssssssRRR",
   "RRRRRRRRRRRRRRRRRrkkkkkkkkkssRRRRRRrssssRRRR",
   "RRRRRRRRRRRRRRRRRRrkkkkkkkkRRRRRRRRRRssRRRRR",
   "RRRRRRRRRRRRRRRRRRrkkkkkkkkkRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRrkkkkkkkkksRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRrkkkkkkkksRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRrkkkkkkkssRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRkkkssRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRsssRRRRRRRRRRRRRRRRRR"
  ],
  "art": {
   "image": "isles/under/isles_cave_2",
   "painted": []
  },
  "blds": []
 },
 "ghost_ship_1": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~~~~~~~~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXXX~~~~~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXX~~~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXX~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXX~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXX~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuX~~~~~~",
   "~~~~~~XuuuXXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuX~~~~~~",
   "~~~~~~XuuuXXuuuuuuXXuuuuuuuuuuXXuuuuuuuuuXXuuuuuuX~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuX~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuX~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuX~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXX~~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXX~~~~~~~~~~~",
   "~~~~~~XuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXX~~~~~~~~~~~~~",
   "~~~~~~XXXXXXXXXXXXXXXXXXXXXX==XXXXXXXXXX~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "isles/under/ghost_ship_1",
   "painted": []
  },
  "blds": []
 },
 "ghost_ship_2": {
  "rows": [
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRRR",
   "RRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRR",
   "RRXXrruuuuuuXuuuuuruXrrruuuuXruuuuruXrrXRRRRRRRR",
   "RRXXuuuuuuuuXuuuuuuuXuuuuuuuXruuuuruXruuXRRRRRRR",
   "RRXXuuuuuuuuXuuuuuuuXuuuuuuuXruuuuruXruuuXRRRRRR",
   "RRXXuuuuuuuuXuuuuuuuXurruuuuXuuuuuuuXuuuuuXXRRRR",
   "RRXXuuuuuuuuXuuuuuuuXurrruuuXuuuuuuuXuuuuuuXXRRR",
   "RRXXuuuuuuuuXuuuuuuuXrrrruuuXuuuuuuuXuuuuuuuXXRR",
   "RRXXuuuuuuuuXuuuuuuuXuuuuuuuXuuuuuuuXuuuuuuuXXRR",
   "RRXXXXXXuXXXXXXXuXXXXXXXuXXXXXXXuXXXXXXXuuuuXXRR",
   "RRXXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXRR",
   "RRXXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXRR",
   "RRXXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXRR",
   "RRXXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXRR",
   "RRXXXXXXuXXXXXXXuXXXXXXXuXXXXXXXuXXXXXXXuuuuXXRR",
   "RRXXuuuuuuurXrruuuuuXruuuuruXuuuuuruXuuuuuuuXXRR",
   "RRXXuuuuuuuuXrruuuuuXuuuuuuuXuuuuuuuXuuuuuuuXXRR",
   "RRXXuruuuuuuXrruuuuuXuuuuuuuXuuuuwwuXuuuuuuXXRRR",
   "RRXXuruuuurrXuuuurruXuuuuuuuXuuuwwwwXuuuuuXXRRRR",
   "RRXXuruuuurrXuuuuuuuXuuuuuruXuuwwwwwXuuuuXRRRRRR",
   "RRXXuruuuuuuXuuuuuuuXuuuuuruXuuuwwwwXuuuXRRRRRRR",
   "RRXXuuuuuuuuXuuuuuuuXuuuuuuuXuuuuuuuXuuXRRRRRRRR",
   "RRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRR",
   "RRXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR"
  ],
  "art": {
   "image": "isles/under/ghost_ship_2",
   "painted": []
  },
  "blds": []
 },
 "ghost_ship_3": {
  "rows": [
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRrrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrRRRRRRRRRRRRRR",
   "RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRRR",
   "RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRR",
   "RXXuuXXXXXXwuuXuuuuuuuuuuuuuuuuuuuuuuuuuuuuXRRRRRRRR",
   "RXXuuuuuuuuuuuXuuurrruuuuurrrruuuuuuuuuuuuuuXRRRRRRR",
   "RXXuuuuuuuuuuuXuuurrruuuuurrrruuuurrruuuuuuuuXRRRRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuurrruwwwwuuuuXRRRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuuuuuwwwwwwuuuuXRRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuuuuuuwwwwwuuuuuXRRR",
   "RXXuccccccccuuXuuuuuuuuuuuuuuuuuuuuuuuuwwwwuuuuuuXRR",
   "RXXuccccccccuuXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuXXR",
   "RXXuccXXXcccuuXuuuuuuurruuuuuuuuuuuuuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuXuuuuuuurruuuuuuuuurruuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuuuuuuuuuuuuuuuuuuuurruuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuXuuuuuuuuuuwwwwwuuurruuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuXuuuuuuuuuwwwwwwwuuuuuuuuuuuuuuuuuuXXR",
   "RXXuccccccccuuXuuuuuuuuuuwwwwwwruuuuuuuuuuuuuuuurXXR",
   "RXXuccccccccuuXuuuuuuuuuuurrwrruuuuuuuuuuuuuuuuurXRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuurXRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuuuuuuurrruuuurXRRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuurrruuuuuuurrruuurXRRRRR",
   "RXXuuuuuuuuuuuXuuurrrruuuuuuurrruuuuuuuuuuuuuXRRRRRR",
   "RXXuuuuuuuuuuuXuuurrrruuuuuuurrruuuuuuuuuuuuXRRRRRRR",
   "RXXuuuuuuuuuuuXuuuuuuuuuuuuuuuuuuuuuuuuuuuuXRRRRRRRR",
   "RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRR",
   "RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
   "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR"
  ],
  "art": {
   "image": "isles/under/ghost_ship_3",
   "painted": []
  },
  "blds": []
 }
}/*END*/;
})(window.RPG);
