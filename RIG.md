# Sachi layer rig

Open **[rig-editor.html](rig-editor.html)** to work on individual parts and compose
the wallpaper loop. This is a custom browser rig with Live2D-style layer controls,
mesh deformation, and parameter tracks. It is not a native Cubism project.

The model contains **52 paint layers**, five hierarchy groups, and eight inferred
hidden fills. Start with Hair, then Face, then Shirt using the layer filters.
The default 20-second loop adds local hair and collar follow-through, small head
rotation, and brow motion to the strong gust, breathing, and curved blinks.

Preset revision 5 adds a more visible character response: the eyebrows lift
before a curious head tilt, followed by a blink and small acknowledging nod.
A softer second response and quiet intervals keep the wallpaper from feeling
constantly busy. The upper neck follows while its shirt attachment stays fixed.
Existing default head and brow tracks upgrade; authored facial edits stay intact.
The simple preview now plays the same default rig and offers **Review reaction
at 0.5×**. Its Face movement slider controls the head, brows, and blinks together.

The refined head and hair preset gives the head a gentle lean, a small drift,
and a settling motion. The upper neck follows the jaw and blends back to the
fixed collar attachment. The fringe responds first; the longer side locks and
the cheek strand recoil later. Local bending starts below the roots, and shared
root pixels cover small sampling seams between the separated hair pieces.
The head's curves carry motion through intermediate keys without overshooting.
Saved drafts upgrade unchanged default head/hair parts while preserving edited
parts, visibility, and clothing settings.

The right fringe and face-framing lock now bend through their middle, with a
small contact retained beside the ear. The fringe catches the gust first; the
long lock and cheek strand follow later, recoil gently, and settle without
stopping at every intermediate key.

Preset revision 4 carries that flowing motion through the left bangs and long
lock as well. Broad wind motion makes one smooth sweep, with smaller ripples
along the hair and heavier, slower fabric flutter. Collar tips and the cord
settle at different times. Breaths vary slightly in depth and duration, with a
longer exhale; blinks have a quick close and softer, varied reopening. Automatic
blinks still close fully when face movement is reduced. Saved rigs update only
untouched default parts and retain custom tracks, pivots, visibility, and wind
strength.

The back bob uses its own damped wind response. The outer edge bends around a
small ear attachment instead of being fixed across the whole ear height. Longer
inner strands respond later than the shorter outer edge, and arc bending keeps
the ends from flattening upward. The crown and clip retain their shared motion;
the back hair and its concealed fill use the same deformation. The response is
deterministic when scrubbing and closes the same 20-second loop.

The right bang and cheek strand now follow the source ink and cyan rim at
native pixel resolution. Skin and neck pixels stay behind the hair, including
the transparent edge below the neck contact. The concealed back-hair surface
uses nearby bob shading; a rounded ear extension joins the visible ear's colors.
These concealed surfaces remain inferred and hidden in the source SVG.

The top fringe reveals a fitted forehead surface instead of a generic skin
gradient. Clean source skin samples determine its shading. Crown backing also
preserves the source's blue tones and highlight band while filling removed ink
with nearby hair colors. Both fills stay inside their existing hidden contours.

The two long hair locks use source-guided pixel cuts where they meet the shirt.
Their thin outlines stay with the hair, while the collar's top ink stays with
the fabric. Two concealed, tapered tip fills extend behind the collar, which
renders in front of the hair ends. Those hidden extensions are inferred; the
visible source pixels and original transparency remain unchanged.
The simple animation preview uses the same depth order, including when wind is
disabled: neck behind hair, concealed tips joined to their locks, and shirt in
front. The tips share the hair's mesh so the old shirt-shaped cut cannot float
above the collar during a gust.
The head and costume sheets in `reference/` guide the concealed silhouette:
the left lock has a slimmer, oblique taper. Its blue highlight and dark inner
stripe continue from the wallpaper's own hair samples; skin beyond the source
hair boundary is excluded. The references guide shape, not the scene lighting.

The left hair/face junction also follows the original ink contour. Skin samples
stay on the face instead of following the lock, and the hidden face fill stops
at the cheek edge. Eyelid fills render only inside the curved eye opening, so
the gap exposed by swaying hair remains transparent through the blink cycle.

Behind the thin right cheek strand, skin shading and the angled cyan neck
highlight continue from nearby source colours. The hidden face and neck fills
share this local colour field. Dark edge antialiasing belongs to the moving
strand, preventing a stationary dotted outline when it swings aside.

## Edit a motion

1. Select a layer. **Solo layer** isolates its artwork and children; **Mesh** shows
   the triangles used to deform it. Solo is a review setting and is not exported.
2. Pause and scrub to a time. Choose horizontal/vertical movement or rotation.
   Hair and clothing also have tip bend, wind response, and wind delay controls.
   Select Eye Left or Eye Right for independent lid closure.
3. Adjust a value and press **Add / update key**. A first key away from zero also
   keeps the preceding base value at 0 seconds. Once a parameter has a track,
   adjusting its value automatically records a key at the playhead.
4. Click a key's time to revisit it, or its × to delete it. **Clear track** holds
   the current value throughout the loop. **Undo / Redo** covers project edits.
5. Review at **0.1×**, **0.25×**, or **0.5×**. The curve wraps automatically:
   20 seconds and 0 seconds are one key, with matching position and velocity.

Untracked values edit the base pose. The X/Y anchor determines the pivot for
rotation and tip bend. Visibility is saved with the rig. **Compare original**
shows the reconstructed source pose without applying the rig.

Layer parents carry their children: rotating the head carries its hair, face,
and eyes; rotating the collar carries its clasp. Wind response and delay apply
to the selected paint layer. Shared fabric edges should usually use the same
wind settings, with additional bend on free ends such as collar tips and cords.
Children inherit their parent's wind response and delay unless overridden.

## Save and use the loop

- **Save rig** downloads `sachi-rig-project.json` with all pivots, visibility,
  values, parameter tracks, and category strengths. **Load rig** restores it.
  Invalid files and files for a different artwork revision are rejected.
- Draft changes save automatically in this browser's local storage. Saving a
  JSON file keeps a portable copy independent of browser data.
- **Use in browser wallpaper** applies the project to `index.html` on the same
  browser origin. An already open wallpaper receives the change. This does not
  transfer local storage to Wallpaper Engine's separate browser environment.
- **Export wallpaper rig** downloads `project.js`. Replace
  `images/sachi-rig/project.js` with that file to bundle the motion with the
  wallpaper, including local-file playback. Wallpaper Engine's category,
  wind, speed, and pause controls continue to apply.

The simple `animation-preview.html` reviews the current default rig with group
controls. The layer editor and wallpaper also support your saved custom rig.

## Reusable artwork

`images/sachi_ai_scale.svg` remains the vector master. These exports come from
its existing atlas and do not change the original PNG or SVG:

- `images/sachi-rig/sachi-layers.ora`: OpenRaster document with 52 visible
  artwork layers and eight hidden fills. Its layer stack is flat for portability.
- `images/sachi-rig/layers/`: aligned transparent PNG layers, each 708 × 970.
- `images/sachi-rig/layers.json`: identifiers, parent hierarchy, pivots, source
  hash, and original canvas placement. Stack order is bottom to top; the crop
  begins at (130, 81) in the original 1920 × 1080 image.

Reassembling the visible exported layers preserves source alpha exactly. On
dark and white backgrounds, visible artwork differs by about 0.022 channel
levels on average, with a maximum of 3 on the 0–255 scale. Tiny differences come
from SVG rasterization and premultiplied alpha conversions.

The separation comes from one flattened image. Concealed hair roots, skin,
fabric, and eye interiors are only partially reconstructed. Moving cut edges
far apart can expose gaps or patches; large gaze shifts, head turns, mouth
opening, and new expressions need additional painted artwork and deformers.
The present eye controls are intended for modest refinements. Lid warping uses
the original fitted lash masks, so substantially reshaping lashes also requires
updating the eye geometry and rebuilding the atlas.

## Build and validation

`npm run build:animation` rebuilds the atlas, aligned PNG layers, and OpenRaster
package. It needs Node with Sharp and Python with Pillow. It preserves an
existing `images/sachi-rig/project.js` so an exported project is not overwritten.
The reviewed hair/collar mask revision migrates old saved rigs while preserving
their controls and keys. Other SVG changes require re-exporting the rig against
the new atlas. The exact compatible hashes are in `scripts/sachi-art-revisions.json`.

`npm test` runs 39 checks, including GIF timing and encoding, cyclic parameter interpolation, import
validation, source binding, key replacement, and independent eyelid controls.
The head/hair checks cover fixed roots, connected neck motion, continuous head
velocity, and preserving custom edits when upgrading the default preset.
The front and back hair have separate wind fields; checks cover movement through
the right bang, stable scalp/ear contacts, and both fields at maximum strength.
`images/sachi-rig/validation.json` records browser checks for layer isolation,
key editing, undo/redo, save/load, live wallpaper application, mobile layout,
WebGL context loss, local-file fallback, and artwork reassembly.
`python scripts/verify_sachi_cutoffs.py` independently reads the saved SVG paths
and verifies exact source RGBA, single ownership of all 540,425 visible pixels,
reviewed cut landmarks, dark hair shading behind the right bang, and reassembly
of the exported OpenRaster layers.
`python scripts/verify_sachi_forehead.py` compares exported hidden fills with
source skin and crown swatches and checks the forehead fit on held-out samples.

The renderer joins adjacent parts with identical motion into cached textures
before warping them. Editing a part gives it an independent mesh, while other
parts keep their shared edges. Only eye textures update during a normal blink;
static layer textures remain cached. Wind fields are shared across parts.
WebGL is preferred; Canvas 2D provides a slower local-file/context-loss fallback.
Checks used Chromium; native Wallpaper Engine still needs its own visual review.
