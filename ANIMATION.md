# Sachi character animation

For detailed layer animation, open **`rig-editor.html`**. It adds per-part
pivots, transforms, wind response, independent lids, and editable loop keys.
The wallpaper now loads this detailed rig from `images/sachi-rig/project.js`.
See [RIG.md](RIG.md) for editing, reusable layer exports, and wallpaper setup.
The simpler preview described below uses the same default rig with group-level
controls. The editor and wallpaper can also play your custom saved tracks.

The wallpaper now plays a deterministic **20-second loop** with independently
adjustable hair, facial, and shirt motion. Strong gusts sweep toward screen left,
followed by delayed flutter, a small rebound, and a lull. All periodic movements meet at the loop
boundary with matching positions and velocities. Four blinks, including a short
double blink, happen away from that boundary.

## Review in order

Open `animation-preview.html` using a local server. Review **01 Hair**, then
**02 Face**, then **03 Shirt**, and switch to **Whole animation** to see them
together. Scrub the timeline to inspect a pose, pause/resume, restore the source
pose, or download your motion settings as JSON. The editor's controls affect the
preview only; the wallpaper has matching settings.

- Hair: the fringe responds first, then bending waves travel into the long side
  locks. Roots stay anchored, and the bob stays held behind the ear.
- Face: a curious head tilt, lifted brows, and an acknowledging nod with full,
  brief blinks. **Review reaction at 0.5×** replays the first response with hair
  and clothing visible. Curved lids cover
  stationary irises and reflections while the original lash ink bends with them.
  **Review blink at 0.1×** isolates the face and starts just before a blink;
  press it again to replay.
- Shirt: breathing plus stronger collar lift and traveling sleeve and hem ripples.

**Replay strong gust** selects the whole animation at 1× and restarts the first
gust with hair, shirt, and wind at 100%. The wind slider ranges from 0% to 150%;
0% returns to the original gentle motion. Hair and shirt strengths still adjust
their respective response. High combined settings saturate smoothly to prevent
the artwork from folding over itself.

The default strengths are 100%. The upper limit is 150%; lowering a strength to
zero disables that category. The preview has a prominent speed slider and presets
above the artwork, from 0.1× to 2× for slow inspection. Wallpaper Engine's speed
control ranges from 25% to 200%. Wind strength changes displacement; playback
speed changes how quickly the same motion plays.

## Export a GIF

In `animation-preview.html`, choose **Export GIF** below the motion settings.
The export captures the active motion group, all movement strengths, wind,
playback speed, and current rig when you press **Export animation GIF**.
It renders a complete 20-second source loop from its beginning. At 2× the GIF
lasts 10 seconds; at 0.5× it lasts 40 seconds. It repeats indefinitely.

- **Compact:** longest edge 360 px, up to 12 fps.
- **Balanced:** longest edge 640 px, up to 20 fps.
- **Detailed:** longest edge 960 px, up to 25 fps.

The GIF follows the scene's aspect ratio and centered character placement.
**Match preview** includes the displayed wallpaper background, or the plain
blue background when that checkbox is off. **Transparent** exports the character
with GIF's binary transparency. Preview controls and labels are excluded.

Rendering takes place locally. Progress and **Cancel export** remain available;
the preview's playhead and settings are not changed. A download link stays
available after completion. Slower speeds use longer frame delays instead of
increasing frame count, keeping memory bounded. A palette sampled across the
loop stays fixed across frames to avoid color flicker, with spatial dithering
to soften color bands. Unchanged opaque background pixels are reused to reduce
file size. The vendored gifenc 1.0.3
encoder and its MIT license are under `javascript/vendor/`.

In Wallpaper Engine, use **Character animation**, **Hair movement**, **Facial
movement**, **Clothing movement**, **Wind gust strength**, and **Animation speed**. Existing character
visibility, RGB, clock, and particle options continue to work.

## Artwork and runtime

`images/sachi_ai_scale.svg` is the editable master. `svg-preview.html` remains
available for individual SVG parts. The SVG has dense source-derived paths;
motion does not imply a hand-drawn expression or perspective rig. Covered areas
are approximated, and stronger movement can reveal the original segmentation.

`images/sachi-animation/atlas.png` and `atlas.js` are generated playback assets.
The atlas is rendered from the master SVG, including its hidden underpainting.
The build also separates eye interiors and upper/lower lash masks. At runtime,
the lids close along fitted curves with matching skin shading; upper lids do
most of the closing. The open pose blends smoothly into this geometry, and
the iris and glints retain their original proportions. The SVG's separate
closed-eye guides remain available for editing but are not used by this player.
No image pixel readback is needed during playback. Static children, such as pupils and reflections, are
composited before moving their parent, avoiding seams between their partitions.
Only the character's occupied bounds, with a small motion margin, are redrawn
each frame. Its original wallpaper position is preserved.

`javascript/sachi-wind.js` bends separate body, back-hair, and front-hair passes
using continuous triangle meshes. The face and ear are drawn independently, so
wind does not stretch the eyes, mouth, or cheek. Shared cloth vertices keep seams
joined. A 64-pixel margin gives the free ends room to travel. Hidden forehead
underpainting fills areas exposed by the moving fringe; these concealed areas
remain approximations derived from the one source image.

WebGL accelerates the meshes. Static layer textures stay on the GPU; only the
face texture changes during a blink. Only triangles covering each layer's bounds
are drawn. The player presents the GPU canvas directly, avoiding a copy back to
Canvas 2D on every frame. `player.canvas` refers to the current display surface;
its DOM ID, styling, and wallpaper position stay the same when switching modes.
A Canvas 2D mesh fallback preserves wind movement
when WebGL is unavailable or a browser blocks local-file texture uploads. That
fallback can run more slowly. Neither path reads image pixels during playback.

`javascript/sachi-animation.js` contains the shared timing, transforms, and
canvas renderer. The wallpaper and preview use the same player. It loads its
local image and script without fetching JSON, so the wallpaper does not need a
web server. The original PNG stays visible if the cache fails to load.

Playback respects reduced-motion preferences, document visibility, the host's
pause event, and the host's configured FPS limit. Pause reasons are tracked
independently so, for example, unhiding the character cannot override a host
pause. The [Wallpaper Engine property listener reference](https://docs.wallpaperengine.io/en/web/api/propertylistener.html)
describes the host callbacks used by the integration.

## Rebuild after editing the SVG

Use Python 3.10+ and Node.js 22+ for the build. Install the Node development
dependency with `npm install`, then run:

```sh
npm run build:animation
npm test
```

The first command extracts the current SVG's groups with
`scripts/export_sachi_animation.py`, then packs their rendered textures with
`scripts/build-sachi-atlas.cjs`. It does not overwrite your SVG edits.

To regenerate the SVG itself from the original image and its selection polygons,
run `python scripts/build_sachi_svg.py` first (requires Pillow and NumPy). This
**overwrites SVG edits**; use it only when changing the source reconstruction.

## Validation

`npm test` checks loop positions and velocities, blink closure and reopening,
anchored eye corners, lid geometry, preserved eye proportions,
category controls, invalid input handling, visible gust displacement, root and
neck anchors, and mesh orientation at maximum strengths. Browser checks cover the actual
atlas rendering, rest-pose fidelity, stage selection, host controls, pause
reasons, reduced motion, mobile layout, and the static-image fallback. The
validation record is `images/sachi-animation/validation.json`.

The animation has been checked in Chromium. Native Wallpaper Engine runtime
behavior still needs a final check in Wallpaper Engine itself.
