"""Ash set props (owner 2026-09-29: props must fit the region): one sheet -> waylamp__ash (off/on), tent__ash, lantern__ash, signboard__ash.
usage: python3 props_job.py   -> ../../../props/ash_b.job.json (then sh gen.sh on it, then props_cut.py)"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import jobs_props as J
j = J.sheet('ash_b', 6, 2, 3, [
    "a way-lamp of the volcanic ash land: a short square pillar of rough black BASALT blocks, on top an open cage of blackened wrought IRON holding a bowl of coals, UNLIT (the coals dark grey, cold)",
    "the SAME basalt-and-iron way-lamp LIT: bright orange flames rising from the coals in the iron cage",
    "a low travellers' TENT of the ash land: dusty grey-brown canvas stretched over a ridge pole, the hem weighted with dark stones, a rust-red cloth tied over the entrance, a thin film of grey ash on the roof",
    "a small ground lantern: a squat black iron fire-pot with a pierced lid and a stubby handle, standing on the ground (unlit)",
    "a standing signpost: a thick charred-black wooden post with a weathered grey plank board nailed across it (blank board, no letters), a small heap of stones at its foot",
    "the SAME small black iron fire-pot lantern LIT with a small flame inside"],
    "Scale: the way-lamp is about 50 art pixels tall, the tent about 32 art pixels tall, the fire-pot lantern about 12 art pixels tall, the signpost about 24 art pixels tall; each art pixel is about 6x6 image pixels. Items 1 and 2 must be identical in size, shape and colours except that 2 is lit; items 4 and 6 likewise.",
    '\nException: in the lit variants the flames may be bright, but no light spills onto anything around them.')
j['out'] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'ash_b.png'))
p = j['out'][:-4] + '.job.json'
json.dump(j, open(p, 'w'), ensure_ascii=False, indent=1); print(p)
