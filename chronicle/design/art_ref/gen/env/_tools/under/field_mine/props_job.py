"""Mine set props (owner 2026-09-29: props must fit the region): one sheet -> waylamp__mine (off/on), lantern__mine, signboard__mine, board__mine.
usage: python3 props_job.py   -> ../../../props/mine_b.job.json (then sh gen.sh on it, then props_cut.py)"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import jobs_props as J
j = J.sheet('mine_b', 6, 2, 3, [
    "a miners' way-lamp of the mountains: a stout square post of dark weathered TIMBER on a few piled stones, an iron arm at the top from which hangs a MINER'S LANTERN (an iron cage lantern with a small glass chimney), UNLIT (dark glass)",
    "the SAME timber post miners' way-lamp LIT: the lantern glowing warm orange",
    "a mountain signpost: a rough timber post with a plank board nailed across it (blank board, no letters), an old iron pick leaning at its foot",
    "a small MINER'S LANTERN of blackened iron and glass standing on the ground, with a ring handle (unlit, dark glass)",
    "a notice board of a mining town: a wide board of dark planks on two timber posts under a little slate roof, a few blank papers pinned to it (no letters)",
    "the SAME small miner's lantern LIT, its glass glowing warm orange"],
    "Scale: the way-lamp is about 50 art pixels tall, the signpost about 24 art pixels tall, the small lantern about 12 art pixels tall, the notice board about 30 art pixels wide; each art pixel is about 6x6 image pixels. Items 1 and 2 must be identical in size, shape and colours except that 2 is lit; items 4 and 6 likewise.",
    '\nException: in the lit variants the glass may be bright, but no light spills onto anything around them.')
j['out'] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'mine_b.png'))
p = j['out'][:-4] + '.job.json'
json.dump(j, open(p, 'w'), ensure_ascii=False, indent=1); print(p)
