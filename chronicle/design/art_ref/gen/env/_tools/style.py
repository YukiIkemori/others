# Shared English style blocks for environment generations (no game names, no API details).
PIXEL = ("Premium modern hi-bit 2D pixel art (\"HD pixel art\" JRPG look), hand-placed pixels. Every art pixel is a crisp square "
         "of the same size across the whole image (about 8x8 image pixels per art pixel). No anti-aliasing, no blur, no soft brushes, "
         "no photographic texture, no noise, no dithering checkerboards. Clusters of 3-10 pixels with clear shapes. "
         "Hue-shifted colour ramps: shadows lean toward purple/red and are more saturated, highlights lean toward warm yellow. "
         "4-6 shades per material, rich but earthy, worn and lived-in.")
TOPDOWN = ("Camera: classic top-down RPG map view (seen from above at a steep angle, like a 16-bit era overworld/town map), "
           "orthographic, no perspective convergence.")
ALBEDO = ("Lighting: neutral, soft, even light from the upper left, like a calm overcast evening; NO cast shadows, NO night darkness, "
          "NO light sources, NO glow, NO lamp light pools, NO vignette. (The game engine adds the night lighting on top later, "
          "so this must be the clean base colours.)")
SEAMLESS = ("It must be a SEAMLESS TILEABLE texture: the left edge continues into the right edge and the top edge into the bottom edge. "
            "Fill the entire square edge to edge with the surface only: no border, no frame, no objects, no characters, no text, "
            "no single focal feature, even distribution of detail.")
