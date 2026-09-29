"""Snow set props (owner 2026-09-29: props must fit the region): one sheet -> waylamp__snow (off/on), tent__snow, lantern__snow.
usage: python3 props_job.py   -> ../../../../props/snow_b.job.json (then sh gen.sh on it, then props_cut.py)"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
import jobs_props as J
j = J.sheet('snow_b', 4, 2, 2, [
    "a way-lamp of the snow country: a carved block of clear blue-white ICE hollowed into a lantern, standing on a short pillar of stacked grey fieldstones capped with snow, a thick candle inside, UNLIT (the ice is cool blue, the candle dark)",
    "the SAME ice way-lamp LIT: the candle burning, the ice glowing warm golden from inside",
    "a small conical HIDE TENT of the northern hunters: long wooden poles crossing at the top, brown and grey fur and hide coverings sewn together, snow on its shoulders, the door flap tied open showing a dark inside",
    "a small ground lantern made of a hollowed ICE block on the snow with a candle stub inside (unlit)"],
    "Scale: the way-lamp is about 50 art pixels tall, the tent about 32 art pixels tall, the ground lantern about 12 art pixels tall; each art pixel is about 6x6 image pixels. Items 1 and 2 must be identical in size, shape and colours except that 2 is lit.",
    '\nException: in the lit variant the ice may glow, but no light spills onto anything around it.')
j['out'] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'props', 'snow_b.png'))
p = j['out'][:-4] + '.job.json'
json.dump(j, open(p, 'w'), ensure_ascii=False, indent=1); print(p)
