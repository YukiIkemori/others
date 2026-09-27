import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
D = '/home/user/others/chronicle/design/art_ref/gen/env/bbg/'
HEAD = ("A battle background for a side-on JRPG battle scene (the party will stand on the right, monsters on the left; no characters are drawn), "
        "in rich high-resolution 2D pixel art. The world is in an endless night: the sun has vanished and people live by lamplight. ")
TAIL = ("\nNo lantern, no fire in the middle, no people, no monsters, no text, no UI.\n"
        "Pixel art: every art pixel is 4x4 image pixels (the image is 960 x 540 art pixels), crisp square pixels, no anti-aliasing, "
        "hue-shifted colour ramps (shadows toward violet, lights toward warm yellow), clusters with clear shapes, not a painting.")
GROUND = ("The ground plane recedes from the bottom edge up to the horizon line at a low 3/4 angle; the middle of the ground (from 55% to 90% of the height, "
          "centre and right) is open, fairly flat and uncluttered: space for the battle. Details (rocks, plants, debris) sit at the sides and far away. ")
def bbg(id_, scene):
    return dict(out=D + id_ + '.png', tag='env_bbg_' + id_, size='3840x2160', quality='high', prompt=HEAD + scene + ' ' + GROUND + TAIL)
def front(id_, what):
    return dict(out=D + id_ + '_front.png', tag='env_bbgfront_' + id_, size='1920x1088', quality='high', background='transparent',
                prompt=("A FOREGROUND OVERLAY layer for a side-on JRPG battle background (16:9), 2D pixel art: only close-up foreground elements hugging the "
                        "bottom edge and the two bottom corners, silhouetted dark against the night (deep violet-blue, slight rim of moonlight on top edges): " + what +
                        " They cover at most the bottom 18% in the centre and rise to about 35% of the height in the left and right corners. "
                        "Everything else is fully transparent (the middle and top of the image are empty). No characters, no text. Crisp square pixels (4x4 image px each)."))
jobs = [
 bbg('tower', "Setting: inside a tall old stone lighthouse. The back wall (top 42% of the image) is the curved inner wall of rough grey-blue stone blocks "
     "with a spiral stone staircase climbing along it, a tall narrow arched window showing the moonlit sea and stars, iron wall sconces (unlit), hanging ropes and a pulley. "
     "The floor (lower 58%) is old wooden planks with a large faded circular compass-rose inlay in the middle, oil barrels, crates, coiled rope and scattered old books and loose pages at the sides. "
     "Light: cold moonlight through the window falling as a pale shaft across the floor, blue-violet shadows, dust in the air."),
 bbg('forest', "Setting: a clearing deep in a mossy old forest at night. Back (top 42%): starry night sky with a moon glimpse through a gap in the canopy, "
     "layered walls of tall dark conifers and broadleaf trees receding into blue mist, the far trees paler and bluer. "
     "Ground (lower 58%): soft mossy earth with patches of short grass, ferns, roots and fallen leaves at the sides, a few pale glowing mushrooms and "
     "blue-green glowing moss at the edges. Light: cool moonlight from the upper left, deep blue-violet shadows, layered atmospheric mist."),
 bbg('tree', "Setting: at the foot of an immense thousand-year-old tree. Back (top 45%): the colossal gnarled trunk fills most of the upper background, "
     "its bark covered in softly glowing blue-green moss and lichen, a dark hollow opening, huge roots arching down into the ground, "
     "the night sky and distant canopy visible at the edges. Ground (lower 55%): packed earth and moss crossed by thick roots at the sides and back, "
     "small glowing fungi. Light: dim moonlight, the moss giving a faint teal glow, deep shadows between the roots."),
 bbg('cave', "Setting: inside a natural cave below an old well. Back (top 42%): layered cave walls of violet-grey rock with stalactites, "
     "clusters of pale blue glowing crystals in the rock, a narrow shaft of moonlight falling from a round opening high above (the old well) onto the floor at the back left. "
     "Ground (lower 58%): uneven stone floor with gravel, a shallow still pool reflecting the crystals at one side, stalagmites and rubble at the sides. "
     "Light: cold blue crystal light and moonlight, deep violet shadows."),
 front('coast', "wet dark rocks, seaweed strands and a few shells."),
 front('tower', "the edge of a wooden crate, a coil of rope, a stack of old books and a cracked stone step."),
 front('forest', "ferns, tall grass blades and a mossy root."),
 front('tree', "thick gnarled roots curling in from the corners, moss and small mushrooms."),
 front('cave', "jagged rocks and small stalagmites with a few tiny crystals."),
]
json.dump(jobs, open('/tmp/claude-0/-home-user-others/00503990-4adc-574c-b37a-87d13f1cb58c/scratchpad/jobs_bbg.json', 'w'))
print(len(jobs))
