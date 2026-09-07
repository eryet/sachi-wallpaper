# Sachi layered SVG

`sachi_ai_scale.svg` reconstructs `sachi_ai_scale.png` with colored vector paths
and fill opacity. It contains **no embedded PNG, image element, external font,
or linked asset**. The 1920 × 1080 canvas, transparent background, artwork position,
and source colors are preserved.

## What kind of SVG this is

This is a **dense, pixel-derived vector reconstruction**, not a simplified
hand-drawn Bézier illustration. Adjacent identical source samples are merged
into vector regions. This approach preserves detail that conventional tracing
lost, especially the face gradients and eye outlines. Source pixel geometry
remains visible at very high zoom. The file has many paths and is substantially
larger than the PNG; it is an editing master, not a performance-optimized
wallpaper replacement.

Named groups support translations, rotations, scaling, opacity, and small
puppet-style motions. New expressions, fully rigged hair, perspective changes,
and smooth path morphing require additional artwork. Hidden regions cannot be
recovered from one reference image.

## Layers and pivots

Open the SVG in an editor supporting SVG groups, such as Inkscape. Groups carry
Inkscape layer labels, stable `id` attributes, and `data-pivot="x y"` coordinates.
Coordinates inside `#sachi` are relative to the art's occupied bounds; the parent
group places the artwork at `(130, 81)` on the original canvas. Left/right means
**screen left/right**.

| Group | Contents |
| --- | --- |
| `body` | Neck, coat, collar sections, sleeve panels, shoulder trim, clasps, strap, cord |
| `head` | Face, hair sections, hair clip, visible ear, facial features |
| `eye-left`, `eye-right` | Eye whites, irises, pupils, upper/lower lashes, reflections |
| `brow-left`, `brow-right` | Eyebrows |
| `nose`, `nose-highlight` | Nose shading and highlight |
| `mouth`, `mouth-corner`, `lip-highlight` | Separate mouth details |
| `hair-crown` | Crown and left/center/right fringe groups |
| `hair-side-left`, `hair-side-right`, `hair-face-strand` | Movable side locks |

The complete inventory is in `sachi_ai_scale.layers.json`, with each group's
parent, pivot, source-pixel count, and path count. Boundaries select visible
regions from the flattened source. They are manually approximated, not original
illustration layers; broad movement may reveal seams or carry a little adjacent
shading along with a feature.

Groups with class `underpaint` hold **approximate reconstructed fills**, hidden
by default to preserve the rest pose. Show them before moving parts. They are
intended for restrained motion and are not a complete reconstruction of the
occluded face, hair, or garment. `eyelid-left-closed` and `eyelid-right-closed` are
optional, reconstructed closed-eye guides, also hidden by default.

## Preview

Serve the repository with a local HTTP server and open `svg-preview.html`:

```sh
python -m http.server 8765 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8765/svg-preview.html`. The page compares the original
with the SVG and offers part movement, rotation, a simple blink, and a subtle
motion demonstration. Controls modify the preview only. Motion is off initially.
The demonstration is illustrative; it is not an exported animation rig.

For a tightly framed view, use `viewBox="130 81 708 970"`. The default SVG keeps
the original canvas to make alignment with the wallpaper straightforward.

For JavaScript animation, insert the SVG inline or load it in a same-origin
`<object>`. An `<img>` element does not expose its internal groups to the parent
page's JavaScript. For example, after obtaining the SVG document:

```js
const hair = svgDocument.getElementById('hair-side-right');
hair.style.transformOrigin = hair.dataset.pivot.split(' ').map(v => v + 'px').join(' ');
hair.style.transformBox = 'view-box';
hair.style.transform = 'rotate(0.3deg)';
hair.style.filter = 'url(#motion-sampling)';
```

The optional `motion-sampling` filter samples a complete part before its
transform, reducing seams between dense regions during rotation. The preview
applies it to moving groups and removes it on reset. Keep `shape-rendering`
settings on the artwork groups to prevent seams at fractional display sizes.

The wallpaper now plays a coordinated animation using cached layers rendered
from this SVG. The original PNG is retained as a fallback if the cache cannot
load. Use `animation-preview.html` to review hair, face, and shirt motion together;
see `ANIMATION.md` for runtime controls and rebuilding the cache after SVG edits.

## Rebuild

`scripts/build_sachi_svg.py` uses Python, Pillow, and NumPy. Run it from the
repository root. It recreates the SVG and the layer inventory from the original
PNG. Adjust the named polygons in `PARTS` to refine part boundaries.
The long-lock/collar junctions are refined at source-pixel resolution by
`scripts/sachi_cut_masks.py`, using the original ink and alpha boundaries.
Two hidden `hair-side-*-continuation` groups provide inferred tips for the
detailed rig; its foreground collar covers their concealed portion.
`scripts/sachi_face_cut.py` separates the left lock from the cheek and trims the
hidden face fill to prevent skin colour appearing in the opened hair gap.

`scripts/verify_sachi_svg.py` compares a rendered SVG PNG to the original and
checks that the SVG is self-contained, that group IDs are unique, and that the
layer inventory covers all visible source pixels. Render at exactly 1920 × 1080
with all animation and reconstructed fills disabled before comparing.
