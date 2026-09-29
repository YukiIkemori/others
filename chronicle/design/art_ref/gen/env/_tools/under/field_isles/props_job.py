"""Isles set props (owner 2026-09-29: props must fit the region): one sheet -> waylamp__isles (off/on), lantern__isles, signboard__isles, board__isles.
usage: python3 props_job.py   -> ../../../props/isles_b.job.json (then sh gen.sh on it, then props_cut.py)"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import jobs_props as J
j = J.sheet('isles_b', 6, 2, 3, [
    "a harbour way-lamp of a white island port town: a short square pillar of WHITEWASHED stone blocks with a pale blue band, on top a brass-framed SHIP'S LANTERN with glass panes, UNLIT (dark glass)",
    "the SAME whitewashed pillar harbour lamp LIT: the ship's lantern glass glowing warm yellow",
    "a standing signpost of the islands: a post of grey sea-bleached DRIFTWOOD with a whitewashed plank board nailed across it (blank board, no letters), a coil of old rope and two small shells at its foot",
    "a small ship's LANTERN of brass and glass standing on the ground, with a ring handle (unlit, dark glass)",
    "a notice board of a harbour town: a wide whitewashed wooden board on two driftwood posts with a small blue roof, a few blank papers pinned to it (no letters)",
    "the SAME small brass ship's lantern LIT, its glass glowing warm yellow"],
    "Scale: the way-lamp is about 50 art pixels tall, the signpost about 24 art pixels tall, the small lantern about 12 art pixels tall, the notice board about 30 art pixels wide; each art pixel is about 6x6 image pixels. Items 1 and 2 must be identical in size, shape and colours except that 2 is lit; items 4 and 6 likewise.",
    '\nException: in the lit variants the glass may be bright, but no light spills onto anything around them.')
j['out'] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'isles_b.png'))
p = j['out'][:-4] + '.job.json'
json.dump(j, open(p, 'w'), ensure_ascii=False, indent=1); print(p)
