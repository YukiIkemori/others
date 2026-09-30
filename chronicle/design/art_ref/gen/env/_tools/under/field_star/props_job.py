"""Star set props (owner 2026-09-29: props must fit the region): one sheet -> waylamp__star (off/on), lantern__star, signboard__star, board__star.
usage: python3 props_job.py   -> ../../../props/star_b.job.json (then sh gen.sh on it, then props_cut.py)"""
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
import jobs_props as J
j = J.sheet('star_b', 6, 2, 3, [
    "a STAR-LAMP way-lamp of a scholars' town on a high plateau: a slender square pillar of pale MARBLE with a carved star band, on top a small glass lantern cage of dark bronze shaped like a many-pointed star, UNLIT (dark glass)",
    "the SAME marble pillar star-lamp LIT: the star-shaped glass lantern glowing a soft cool white-blue with a warm core",
    "a standing signpost of the plateau: a post of weathered grey stone with a pale marble plaque fixed across it (blank plaque, no letters), a small carved star on the post top",
    "a small bronze STAR LANTERN standing on the ground: a little star-shaped cage of dark bronze with glass panes, a ring handle (unlit, dark glass)",
    "a notice board of a university town: a wide dark wooden board in a pale marble frame on two stone feet, a few blank papers and a star chart pinned to it (no letters)",
    "the SAME small bronze star lantern LIT, its glass glowing soft white-blue with a warm core"],
    "Scale: the way-lamp is about 50 art pixels tall, the signpost about 24 art pixels tall, the small lantern about 12 art pixels tall, the notice board about 30 art pixels wide; each art pixel is about 6x6 image pixels. Items 1 and 2 must be identical in size, shape and colours except that 2 is lit; items 4 and 6 likewise.",
    '\nException: in the lit variants the glass may be bright, but no light spills onto anything around them.')
j['out'] = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'props', 'star_b.png'))
p = j['out'][:-4] + '.job.json'
json.dump(j, open(p, 'w'), ensure_ascii=False, indent=1); print(p)
