"""Hand repairs for single frames of the rogue's sheets (called by finish.py before the automatic passes).
Coordinates are frame coordinates (96x128) of the build in work/final (run_build.sh); they must be looked at again
if the chosen raws or the build parameters change."""
EYE_FIX = {}          # (kind, row name, col) -> {'x': [cols], 'y': row}: eye dots set by hand where the detector misreads
DOWN, DOWN_LEFT, DOWN_RIGHT = 0, 4, 5


def apply(copy_patch, erase, sheets, head_box):
    # 1. front walk: the lower bow tip pokes out right under the hand on the viewer's left and reads as a stick held in
    #    the hand ("hands empty"): take it away below the hand
    for c in (0, 2):
        erase('walk', DOWN, c, (30, 95, 37, 96)); erase('walk', DOWN, c, (30, 94, 32, 94))
    erase('walk', DOWN, 1, (30, 95, 37, 96)); erase('walk', DOWN, 1, (30, 94, 31, 94))
    erase('walk', DOWN, 3, (30, 93, 34, 93)); erase('walk', DOWN, 3, (30, 94, 37, 95))
    # 2. down-right walk, right step: the same little stick beside the hand
    erase('walk', DOWN_RIGHT, 3, (33, 95, 36, 98))
    # 3. down-left walk, right step: the generator forgot the bow tip over the left shoulder: take it from the left step
    copy_patch('walk', DOWN_LEFT, 1, 3, (59, 50, 69, 63))
