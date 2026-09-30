// 生成物（design/art_ref/gen/env/_tools/under/field_star/ の areas_star.py・dng_star.py → fit.py → put_rows.py）。手で直さない。
// 描いた下絵に合わせた高原の町・ダンジョンの当たり（rows、字は field_star/lib.py と同じ）・絵（art）・建物の敷地と戸口（blds）。
// star_orbis.js・star_academy.js・star_tower.js が R.Star.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const I = (R.Star = R.Star || {});
  I.PAINTED = /*DATA*/{
 "orbis": {
  "rows": [
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXTXXXXXXXXXXXXXTTXXXXXXXXXXXXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXXXXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXXXXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXXXXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccX,,,XXXXXXXXX,,,XXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXX,,,XXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXX,,,XXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXT,XXXXXXXccccXTT,XXXXXXXXTT,XXXXXXXTTXXXXX",
   "XXXXXXXXXXXcXXXXXXT,XXXcXXXccccXTT,XXXXXXXXTT,XXXXXXXTTXXXXX",
   "XXXTT,,,,cccc,,,,TT,,,cc,,XccccX,,,XXXXXXXXTT,XXXXXXXTTXXXXX",
   "XXXTT,,,,cccc,,,,,,,,,cc,,XccccX,,,XXXXcXXXX,,XXXXXXXTTXXXXX",
   "XXXTT,,,,cccc,,,,,,,,,cc,,XccccX,,,,,,,c,,,,,,XXXcXXX,,XXXXX",
   "XXXccccccccccccccccccccccccccccccccccccccccccccccccccccXXXXX",
   "XXXccccccccccccccccccccccccccccccccccccccccccccccccccccXXXXX",
   "XXXXXXXXXX,,,cc,,TT,XXXXXX,cccc,,,,,TT,TTccTT,XXXXXXXTTXXXXX",
   "XXXXXXXXXXT,,cc,,TT,XXXXXX,cccc,,,,,TT,TTccTT,XXXXXXXTTXXXXX",
   "XXXXXXXXXXT,,cc,,TT,XXXXXX,cccc,,TT,TT,TTccTT,XXXXXXXTTXXXXX",
   "XXXXXXcXXXT,,cc,,TT,XXXcXX,cccc,,TT,TT,TTccTT,XXXcXXXTTXXXXX",
   "XXX,,,c,,,,,,cc,,,,,,,,c,,,cccc,,,,,,,,,,cc,,,,,,c,,,,,XXXXX",
   "XXXXXXXXXXXXXXcXXXXXXXXXXXXccccXXXXXXXXXXXcXXXXXXXXXXXXXXXXX",
   "XXXccccccccccccccccccccccccccccccccccccccccccccccccccccXXXXX",
   "XXXccccccccccccccccccccccccccccccccccccccccccccccccccccXXXXX",
   "XXX,,,,,,,,,,,,,,,,,,,,,,,,cccc,,,,,,,,,,,,,,,,,,,,,,,,XXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,ccccccccccccc,XXXXXXXTTXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,ccccccccccccc,XXXXXXXTTXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,ccccccccccccc,XXXXXXXTTXXXXXXXXTTXXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,ccccccccccccc,XXXXXXXTTXXXXXXXX,,XXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,cccccwwwwcccc,XXXXcXXX,XXXcXXXX,,XXXXX",
   "XXXXXXXXXXXXXXXXXXXXX,ccccwwwwwwcccccccccccccccccccccccccccc",
   "XXXXXXXXXXXXXXXXXXXXX,ccccwwwwwwcccccccccccccccccccccccccccc",
   "XXXXXXXcXXXXXXXXcXXXX,ccccwwwwwwccc,XXXXXXXX,XXXXXXXX,,XXXXX",
   "XXXTTT,c,,T,,TT,c,,T,,cccccwwwwccccTXXXXXXXX,XXXXXXXXTTXXXXX",
   "XXXTTT,c,,T,,TT,c,,T,,cccccccccccccTXXXXXXXX,XXXXXXXXTTXXXXX",
   "XXXTT,,c,,T,,TT,c,,T,,cccccccccccccTXXXXXXXX,XXXXXXXXTTXXXXX",
   "XXXccccccccccccccccccccccccccccccccTXXXXcXXX,XXXXcXXXTTXXXXX",
   "XXXcccccccccccccccccccccccccccccccc,,,,,c,,,,,,,,c,,,,,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXX,,,,T,cccc,,,,,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXX,,,,T,cccc,,TT,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXXTT,,T,cccc,,TT,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXXTT,,T,cccc,,TT,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXXTT,TT,cccc,,TT,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXXXXXX,XXXXXXXXTT,T,,cccc,,TT,XXXXXXXX,XXXXXXXXX,XXXXX",
   "XXX,XXXcXXXX,XXXXcXXXTT,T,,cccc,,TT,XXXXcXXX,XXXXXcXXX,XXXXX",
   "XXX,,,,cT,,TT,,,,c,,,TT,T,,cccc,,TT,T,,,cT,,,TT,,,cT,,,XXXXX",
   "XXX,,,,,T,,TT,,,,,,,,TT,,,,cccc,,TT,T,,,,T,,,TT,,,,T,,,XXXXX",
   "XXX,,,,,,,,,,,,,,,,,,,,,,,,cccc,,,,,,,,,,,,,,,,,,,,,,,,XXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXcccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXcccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXcccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXcccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  ],
  "art": {
   "image": "star/under/orbis",
   "painted": [],
   "overlay": "star/under/orbis_over"
  },
  "blds": [
   {
    "id": "orbis_academy",
    "x": 3,
    "y": 3,
    "w": 15,
    "h": 8,
    "door": [
     11,
     10
    ]
   },
   {
    "id": "orbis_library",
    "x": 20,
    "y": 3,
    "w": 6,
    "h": 8,
    "door": [
     23,
     10
    ]
   },
   {
    "id": "orbis_observatory",
    "x": 35,
    "y": 2,
    "w": 9,
    "h": 11,
    "door": [
     39,
     12
    ]
   },
   {
    "id": "orbis_house4",
    "x": 46,
    "y": 9,
    "w": 7,
    "h": 5,
    "door": [
     49,
     13
    ]
   },
   {
    "id": "orbis_house5",
    "x": 46,
    "y": 16,
    "w": 7,
    "h": 4,
    "door": [
     49,
     19
    ]
   },
   {
    "id": "orbis_guardroom",
    "x": 3,
    "y": 16,
    "w": 7,
    "h": 4,
    "door": [
     6,
     19
    ]
   },
   {
    "id": "orbis_records",
    "x": 20,
    "y": 16,
    "w": 6,
    "h": 4,
    "door": [
     23,
     19
    ]
   },
   {
    "id": "orbis_inn",
    "x": 3,
    "y": 25,
    "w": 9,
    "h": 8,
    "door": [
     7,
     32
    ]
   },
   {
    "id": "orbis_tavern",
    "x": 12,
    "y": 25,
    "w": 9,
    "h": 8,
    "door": [
     16,
     32
    ]
   },
   {
    "id": "orbis_tailor",
    "x": 4,
    "y": 38,
    "w": 8,
    "h": 7,
    "door": [
     7,
     44
    ]
   },
   {
    "id": "orbis_laundry",
    "x": 13,
    "y": 38,
    "w": 8,
    "h": 7,
    "door": [
     17,
     44
    ]
   },
   {
    "id": "orbis_items",
    "x": 36,
    "y": 25,
    "w": 8,
    "h": 5,
    "door": [
     40,
     29
    ]
   },
   {
    "id": "orbis_arms",
    "x": 45,
    "y": 25,
    "w": 8,
    "h": 5,
    "door": [
     48,
     29
    ]
   },
   {
    "id": "orbis_magic",
    "x": 36,
    "y": 32,
    "w": 8,
    "h": 5,
    "door": [
     40,
     36
    ]
   },
   {
    "id": "orbis_house",
    "x": 45,
    "y": 32,
    "w": 8,
    "h": 5,
    "door": [
     49,
     36
    ]
   },
   {
    "id": "orbis_house2",
    "x": 36,
    "y": 38,
    "w": 8,
    "h": 7,
    "door": [
     40,
     44
    ]
   },
   {
    "id": "orbis_house3",
    "x": 45,
    "y": 38,
    "w": 9,
    "h": 7,
    "door": [
     50,
     44
    ]
   }
  ]
 },
 "star_academy_1": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXccccccccccccXXXXXXXXXXXXXXXX~~",
   "~~XXuuXXXuuXXXXXXXcckkkkkkkkccXXXXXXXuuXXXuuXX~~",
   "~~XXuuuuuuuXXXXXXXcckkkkkkkkccXXXXXXXuuuuuuuXX~~",
   "~~XXuuuuuuucXXXXXXcckkkkkkkkccXXXXXXcuuuuuuuXX~~",
   "~~XXurrurruXXXXXXXccccccccccccXXXXXXXurrurruXX~~",
   "~~XXuuuuuuuXccccccccccccccccccccccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccccccccccccccccccccccXuuuuuuuXX~~",
   "~~XXurrurruccccccccccccccccccccccccccurrurruXX~~",
   "~~XXuuuuuuuXccccXXXXXXXccXXXXXXXccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX,\"\"\",,,,,,,,,,XccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX\"\",,,,,,,,,,,\"XccccXuuuuuuuXX~~",
   "~~XXXXXXXXXXccccX\"\"\",,,,,,,,,,\"XccccXXXXXXXXXX~~",
   "~~XXXXXXXXXXccccX\"\",,,,,,,,,,\"\"XccccXXXXXXXXXX~~",
   "~~XXuuXXXuuXccccX\"\",,,,,,,,,,\",XccccXuuXXXuuXX~~",
   "~~XXuuuuuuuXccccX\"\",,,,\",\"\"\"\",,XccccXuuuuuuuXX~~",
   "~~XXuuuuuuucccccX\"\",,,XXXX\"\"\",,XcccccuuuuuuuXX~~",
   "~~XXurrurruXccccX,,,,\"XXXX\",\",,XccccXurrurruXX~~",
   "~~XXuuuuuuuXccccX,,,,\"XXXX\",\",\"XccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX,,,\"\"XXXX,\"\"\"\"XccccXuuuuuuuXX~~",
   "~~XXurrucrucccccX,,,\"\"\",,\"\",,\",XcccccurrurruXX~~",
   "~~XXuuuuuuuXccccX,,,\"\"\",,,,\"\",,XccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX,,,\"\"\",,,,,,\"\"XccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX,,,\"\"\",,,,,,,,XccccXuuuuuuuXX~~",
   "~~XXuuuuuuuXccccX,,,,\",,,,,,,,,XccccXuuuuuuuXX~~",
   "~~XXXXXcXXXXccccXXXXXXXccXXXXXXXccccXXXXcXXXXX~~",
   "~~XXXXXcXXXXccccccccccccccccccccccccXXXXcXXXXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXcccccXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXcccccXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXcccccXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXcccccXXXXXXXXXXXXXcXXcXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXcXXXXXXXXXXXXXXXcXXcXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXcXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "star/under/star_academy_1",
   "painted": []
  },
  "blds": []
 },
 "star_academy_2": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccXXccXXXkXXXkkkXXXXkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXkXXXkkkkkkkkXkXX~~",
   "~~XXuXXXXXuuXXXXXuuXXccccccXXXkkkkkkXXXkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXXXccXXXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuXXXXXuuXXXXXuuXXccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccccckkkkkkkkkkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuXXXXXuuXXXXXuuccccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXkkkkkkkkkkkkkkXX~~",
   "~~XXuXXXXXuuXXXXXuuXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXuuuuuuXuuuuuuuXX~~",
   "~~XXuXXXXXuuXXXXXuuXkkkkkkkkXXuuuuuuuuuuuuuuXX~~",
   "~~XXuuuuuuuuuuuuuuuXkkkkkkkkXXuuXXXXXXXXXXuuXX~~",
   "~~XXuuuuuuuuuuuuuuuXkkkkkkkkXXuuuuuuuuuuuuuuXX~~",
   "~~XXuXXXXXuuXXXXXuuXXccccccXXXuuuuuuuuuuuuuuXX~~",
   "~~XXuuuuuuuuuuuuuuucccccccccccuuXXXXXXXXXXuuXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXuuuuuuuuuuuuuuXX~~",
   "~~XXuXXXXXuuXXXXXuuXXccccccXXXuuuuuuuuuuuuuuXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXuuXXXXXXXXXXuuXX~~",
   "~~XXuuuuuuuuuuuuuuuXXccccccXXXuuuuuuuuuuuuuuXX~~",
   "~~XXXXXXXXcXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXcXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXccccccccccccccccccccccccccccccccccccccccXX~~",
   "~~XXXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXXX~~",
   "~~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "star/under/star_academy_2",
   "painted": []
  },
  "blds": []
 }
}/*END*/;
})(window.RPG);
