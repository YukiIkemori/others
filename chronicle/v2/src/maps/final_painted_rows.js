// 生成物（design/art_ref/gen/env/_tools/under/finale/ の dng_finale.py → fit_biblia.py・intfit.py → put_rows.py）。手で直さない。
// 描いた下絵に合わせた終盤の町・大書庫の当たり（rows、字は finale/lib.py と同じ）・絵（art）・建物の敷地と戸口（blds）。
// final_biblia.js・final_archive.js が R.Final.PAINTED[id] を読む。
(function (R) {
  'use strict';
  const I = (R.Final = R.Final || {});
  I.PAINTED = /*DATA*/{
 "biblia": {
  "rows": [
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXX,XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXTXXXXXXXXXXXXX,XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXTXXXXXXXXXXXXX,TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXTXXXXXXXXXXXXX,TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XX,XXXXXXXXXXXXX,TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XX,XXXXXXXXXXXXX,TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XX,XXXXXXcXXXXXX,XXXXXXXXXXXcXXXXXXXX,,XXXXXXXcXXXXXXXXX",
   "XX,\"\"\"\"\"\"c\"\"\"\"\"\"\"\"\"\"\"c\"\"\"\"XcccX\"\"\"\"\"X,,\"\"\"\"\"\"\"c\"\"\"\"\"\"XXX",
   "XXTXXXXXcccXXXXTXXXXXcccccXcccXcccccXXXTTXXXXcccXXXXXXXX",
   "XXTXcccccccccccTccccccccccccccccccccccccccccccccccccXXXX",
   "XXTXcccccccccccccccccXccccccccccccccccccccccccccccccXXXX",
   "XXXXX\"\"\"\"\"\"\"\"\"\"\"\"\"\"X\"XccccccccccccccX\"\"\"\"\"\"\"\"\"\"\"\"\"\"XXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXcccccXcXccccccXXXXXXXXXXXXXXXXXXXX",
   "XXcccccccccccccccccccccccccXcXccccccccccccccccccccccccXX",
   "XX,,,,,,,,,,,,,,,,,,,ccccccccccccccc,,,,,,,,,,,,,,,,,,XX",
   "XXT,XXXXXXXXXX,,,,,,XXcccccccccccccc,,,,,,XXXXXXXXXXTTXX",
   "XXT,XXXXXXXXXX,,,,,T,ccccccccccccccT,,,,,,XXXXXXXXXXTTXX",
   "XXT,XXXXXXXXXX,XXXXT,cccccwwwwcccccT,XXXX,XXXXXXXXXXTTXX",
   "XX,,XXXXXXXXXX,XXXXT,ccccwwwwwwccccT,XXXX,XXXXXXXXXX,,XX",
   "XX,,XXXXXXXXXX,XXXX,,ccccwwwwwwwcccc,XXXX,XXXXXXXXXX,,XX",
   "XXT,XXXXXXXXXX,XXXX,,ccccwwwwwwwcccc,XXXX,XXXXXXXXXX,TXX",
   "XXT,XXXXXXXXXX,XXXX,,ccccwwwwwwccccc,XXXX,XXXXXXXXXX,TXX",
   "XXT,XXXXXXXXXX,XXXX,,ccccccwwwcccccc,XXXX,XXXXXXXXXX,TXX",
   "XX,,XXXXcXXXXX,XXcX,TccccccccccXXXXcTXXcXXXXXXXcXXXX,,XX",
   "XXT,\"\"\"ccc\"\"\"\",\"\"\"\",TccccccccccXXXXcT\"\"\"\"\"\"\"\"\"\"\"\"\"XX\"TXX",
   "XXT,\"\"\"\"\"\"\"\"\"\",\"\"\"\",,ccccccccccXccXcT\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"\"TXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXccccccccccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXT,XXXXXXXXX,,XXXXXX\"\"\"\"\"TccT\"\"\"\"\"XXXXXX,,,XXXXXXXX,TXX",
   "XXT,XXXXXXXXX,,XXXXXX\"\"\"\"\"TccT\"\"\"T\"XXXXXX,,,XXXXXXXX,TXX",
   "XXT,XXXXXXXXX,TXXXXXX\"T\"\"\"\"ccT\"\"\"T\"XXXXXXTT,XXXXXXXX,TXX",
   "XXT,XXXXXXXXX,TXXXXXX\"T\"\"\"\"cc\"\"\"\"TXXXXXXXTT,XXXXXXXXX,XX",
   "XXTTXXXXcXXXX,TXXXcXX\"T\"\"\"\"cc\"\"\"\"\"XXXcXXX,,,XXXcXXXXX,XX",
   "XXccccccccccccccccccccccccccccccccccccccccccccccccccccXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXX==XXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "XXXXXXXXXXXXXXXXXXXXXXXXXXX==XXXXXXXXXXXXXXXXXXXXXXXXXXX",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~==~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~==~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~==~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~==~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~XXXXXXXXXXXXX~~~~~~~~~~~~~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/biblia",
   "painted": [],
   "overlay": "finale/under/biblia_over"
  },
  "blds": [
   {
    "id": "biblia_archive",
    "x": 21,
    "y": 0,
    "w": 16,
    "h": 10,
    "door": [
     28,
     9
    ]
   },
   {
    "id": "biblia_records",
    "x": 3,
    "y": 2,
    "w": 13,
    "h": 8,
    "door": [
     9,
     9
    ]
   },
   {
    "id": "biblia_library",
    "x": 39,
    "y": 2,
    "w": 15,
    "h": 8,
    "door": [
     46,
     9
    ]
   },
   {
    "id": "biblia_inn",
    "x": 4,
    "y": 18,
    "w": 10,
    "h": 9,
    "door": [
     8,
     26
    ]
   },
   {
    "id": "biblia_house1",
    "x": 15,
    "y": 20,
    "w": 4,
    "h": 7,
    "door": [
     17,
     26
    ]
   },
   {
    "id": "biblia_house2",
    "x": 37,
    "y": 20,
    "w": 4,
    "h": 7,
    "door": [
     39,
     26
    ]
   },
   {
    "id": "biblia_tavern",
    "x": 42,
    "y": 18,
    "w": 10,
    "h": 9,
    "door": [
     47,
     26
    ]
   },
   {
    "id": "biblia_shop",
    "x": 4,
    "y": 31,
    "w": 9,
    "h": 5,
    "door": [
     8,
     35
    ]
   },
   {
    "id": "biblia_house3",
    "x": 15,
    "y": 31,
    "w": 6,
    "h": 5,
    "door": [
     18,
     35
    ]
   },
   {
    "id": "biblia_house4",
    "x": 35,
    "y": 31,
    "w": 6,
    "h": 5,
    "door": [
     37,
     35
    ]
   },
   {
    "id": "biblia_house5",
    "x": 44,
    "y": 31,
    "w": 8,
    "h": 5,
    "door": [
     47,
     35
    ]
   }
  ]
 },
 "archive_1": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXkkXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccccccccXkkkkkkkXcccccccccccccXXX~",
   "~XXXccccccccccccccXkkkkkkkXcccccccccccccXXX~",
   "~XXXccccccccccccccXXkkkkXXXcccccccccccccXXX~",
   "~XXXcXXXXXXXXccccccccccccccccccXXXXXXXccXXX~",
   "~XXXcccccccccXXXXXXXXXXXXXXXXXXcccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXcXXXXXXXXcccXXXXXccXXXXXccXXXXXXXXccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXcXXXXXXXXcccXXXXXccXXXXXccXXXXXXXXccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXcXXXXXXXXcccXXXXXccXXXXXccXXXXXXXXccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXcccXccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXcccccccXXccccccccccccccXcccccXXXXXXXX~",
   "~XXXXXcccccccXXccccccccccccccXcccccXXXXXXXX~",
   "~XXXXXcccccccccccccccccccccccccccccXXXXXXXX~",
   "~XXXXXcccccccXXccccccccccccccXcXXXXXXXXXXXX~",
   "~XXXXXcccccccXXccccccccccccccXcccccXXXXXXXX~",
   "~XXXXXcccccccXXccccccccccccccXcccccXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_1",
   "painted": []
  },
  "blds": []
 },
 "archive_2": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXccXXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccXXXXXXXXXXcXXXXXXXXXccccccccXXX~",
   "~XXXccccccccXXXXXXXXXXcXXXXXXXXXccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccXXXXXXXXXXcXXXXXXXXXccccccccXXX~",
   "~XXXccccccccXXXXXXXXXXcXXXXXXXXXccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXXccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXccccccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXccXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXXccXccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXXccXccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXXccXccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXXXXXccXXXXXXXXXXXXcXXXXXXXXXXXccccccXXX~",
   "~XXXXXXXccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_2",
   "painted": []
  },
  "blds": []
 },
 "archive_3": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXccccccccccccccccccccccccccccccXXXXXX~",
   "~XXXcccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXXccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXcccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXccccccXXXXXXXXXXXXXXXXXXXXXXccccccXXXX~",
   "~XXXcccccccXXXXXXXXXXXXXXXXXXXXXXccccccXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXcccccccXXXXXXXXXXXXXXXXXXXXXXccccccXXXX~",
   "~XXXXccccccXXXXXXXXXXXXXXXXXXXXXXccccccXXXX~",
   "~XXXcccccccXXXXXXXXXXXXXXXXXXXXXXccccccXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXXXXccccXXXXXXXXXXXXXXXXXXXXXXccccXXXXXX~",
   "~XXXcccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXXccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXcccccccccccccccccccccccccccccccccccXXXX~",
   "~XXXXXXccccccccccccccccccccccccccccccXXXXXX~",
   "~XXXXXXccccccccccccccccccccccccccccccXXXXXX~",
   "~XXXXXXXXcXXXXXXXXcccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXcXXXXXXXXcccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXcXXXXXXXXcccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXcccccccccXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_3",
   "painted": []
  },
  "blds": []
 },
 "archive_4": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccccccXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXccccccXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXckkkkcXXXXXXXXXXXXXXXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcXcccXcccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcXcccXcccccXcccckkkkccccccccccXccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcXcccXcccccccccXkkkkXccccccccccccccXXXX~",
   "~XXXcXcccXcccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcXcccXcccccXcccckkkkccccccccccXccccXXXX~",
   "~XXXcXcccXcccccccccckkkkcccccccccccccccXXXX~",
   "~XXXcccccccccccccccckkkkcccccccccccccccXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXccccccccXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXcccccccccXXXcccXXXccccXXXccccXXXXcccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXccccccccccccccccccccccccccccccccccccXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_4",
   "painted": []
  },
  "blds": []
 },
 "archive_5": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXccccccccccccccccccccccccccccccXXXX~",
   "~XXXXcXXXXXXXXccccXXXXccccXXXXXXXXcXXXX~",
   "~XXXXcccccccccccccXXXXcccccccccccccXXXX~",
   "~XXXXccccccccccccccccccccccccccccccXXXX~",
   "~XXXXcXXXXXXXXcccckkkkccccXXXXXXXXcXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXcXXXXXXXXcccckkkkccccXXXXXXXXcXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXcXXXXXXXXcccckkkkccccXXXXXXXXcXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXcXXXXXXXXcccckkkkccccXXXXXXXXcXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXccccccccccccckkkkcccccccccccccXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXccccccccXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXccccccccXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXccXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_5",
   "painted": []
  },
  "blds": []
 },
 "archive_6": {
  "rows": [
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXccccXXccccXXXXXXXXXXXX~",
   "~XXXXXXXXXXccccccXXcccccccXXXXXXXXX~",
   "~XXXXXXXXccccccccccccccccccXXXXXXXX~",
   "~XXXXXXccccccccccccccccccccccXXXXXX~",
   "~XXXXXccccccccccccccccccccccccXXXXX~",
   "~XXXXccccccccccccccccccccccccccXXXX~",
   "~XXXXccccccccccccccccccccccccccXXXX~",
   "~XXXccccccccccccccccccccccccccccXXX~",
   "~XXXcccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXccccccccccccccccccccccccccccccXX~",
   "~XXXccccccccccccccccccccccccccccXXX~",
   "~XXXXccccccccccccccccccccccccccXXXX~",
   "~XXXXXcccccccccccccccccccccccccXXXX~",
   "~XXXXXXccccccccccccccccccccccXXXXXX~",
   "~XXXXXXXccccccccccccccccccccXXXXXXX~",
   "~XXXXXXXXXXXccccccccccccXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXccccXXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXccccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXcccccXXXXXXXXXXXXXX~",
   "~XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX~",
   "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  ],
  "art": {
   "image": "finale/under/archive_6",
   "painted": []
  },
  "blds": []
 }
}/*END*/;
})(window.RPG);
