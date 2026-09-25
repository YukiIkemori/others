#!/usr/bin/env node
// tools/test_gear-a.js — area-named entry of gear-a (A10a). The unit tests live in tools/test_gear.js (the name
// DESIGN §8.14.1 gives them); this runs the same file, with the same flags and exit code:  node tools/test_gear-a.js [-v]
'use strict';
require('./test_gear.js');
