import json, sys
sys.path.insert(0, '_tools')
from style import *
D = 'test/'
BLD = ("Paint ONE building for a top-down pixel-art JRPG town map, in the classic 3/4 top-down RPG view: the roof is seen from above "
       "(it fills the upper coloured block of the guide) and the front wall is seen straight on (the lower block). "
       "The attached image is an exact layout guide drawn at the final proportions: keep the outer silhouette, the roof/wall split line, "
       "the door (dark brown rectangle, it must stay exactly there, same size, at ground level) and the windows (yellow rectangles) "
       "in exactly the same places. You may add small details (eaves, trim, drainpipe, flower boxes, a hanging shop sign next to the door, a small wall lamp, chimney poking above the roof).\n")
jobs = [
 dict(out=D+'bld_ph_inn.png', tag='env_test_bld', size='1904x1568', quality='high', background='transparent', refs=[D+'guide_ph_inn.png'],
      prompt=BLD + "This building: a two-storey harbour inn. Blue-grey slate roof with rows of overlapping slates, a ridge, a small dormer; "
             "cream plaster walls with dark timber corner posts and a stone plinth; windows with small panes glowing warm amber from inside (the only light); "
             "a hanging wooden sign with a bed icon beside the door; flower boxes under two windows. The art pixel is 7x7 image pixels (the building is 272 x 224 art pixels).\n"
             + PIXEL + "\n" + ALBEDO.replace('NO light sources, NO glow, ', '') + "\nBackground: fully transparent (the magenta in the guide is background). No ground, no shadow, no people, no text."),
 dict(out=D+'bbg_coast.png', tag='env_test_bbg', size='3840x2160', quality='high',
      prompt="A battle background for a side-on JRPG battle scene (the party stands on the right, monsters on the left; no characters are drawn), "
             "in rich high-resolution 2D pixel art. Setting: a rocky sea coast in an endless night (the sun has vanished from this world). "
             "Composition (16:9): the horizon sits at 44% of the height. Top: deep night-blue sky with stars, thin moonlit clouds and a faint teal aurora; "
             "a pale moon at upper left. Middle distance: dark calm sea with moonlight glitter, a distant headland with a lighthouse silhouette (its lamp dark), sea stacks. "
             "Lower 56%: a wide, fairly flat stretch of wet sand and flat rock shelves seen at a low 3/4 angle receding into the distance, with tide pools, shells, "
             "seaweed and pebbles at the sides; the middle area of the ground is open and empty (space for the battle). "
             "Light: cool moonlight from upper left, blue-violet shadows, soft mist on the horizon, gentle atmospheric depth (far things lighter and bluer). "
             "No lantern, no fire, no people, no monsters, no text, no UI.\n"
             "Pixel art: every art pixel is 4x4 image pixels (the image is 960 x 540 art pixels), crisp square pixels, no anti-aliasing, "
             "hue-shifted ramps, clusters with clear shapes, not a painting."),
]
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/test2.json', 'w'))
