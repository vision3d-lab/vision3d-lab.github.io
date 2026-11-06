# Corner2Tag++ project page

Local source for **Revisiting Motion-Aware Checkerboard Calibration for Event Cameras**, currently submitted to IEEE TPAMI. No build dependencies are required. This revision is local only; no commit, push or deployment was performed. The sibling `../corner2tag/` CVPR page is unchanged.

## Current layout

The submission status follows the corresponding-author note with a compact 4px top margin on desktop and mobile, following the close grouping on the original CVPR page.

Two brief paragraphs below the resource links provide **TL;DR** and **Key Insight**, following the original CVPR page. They share the page content width, use left-aligned 18px body text, and retain the theoretical local-first-order qualification. Low event density is tied to corner refinement; polarity transitions are tied to recovering edges suppressed by parallel motion.

Title, authors, affiliation, submission status, and resource buttons form a centered publication header, in that order, like the CVPR page. Title uses Google Sans 56px (50px below 1150px, 38px on phones), authors 26px, affiliation 22px, and venue 26px. Paper and Video remain disabled gray controls; Code and CVPR version remain active black links with icons. No date or window number is shown to visitors.

Below the publication header, the centered **Abstract** heading and divider span the full section width. The next row places the outlined observation interaction **left of the abstract text**, sharing the same top edge and stretch-aligned grid row, with 40px column spacing (28px at narrower desktop widths). The old hero size containment and optical title offset are removed. The native-aspect viewport absorbs available height without stretching scientific images. Below 1000px these blocks stack; the interaction is capped at 600px. Header, overview, Method and footer use the same 1280px maximum width and responsive side gutters. Stage labels stay on one line; a stable caption height prevents jumps while scrubbing.

The Abstract preserves all 211 words of the supplied submission. Body text is 18px. Section headings are 38px, Method subsection headings 30px (34px/26px on phones). Method contains Checkerboard Calibration for Event Camera, AprilTag Detection, and Stereo Event Camera Calibration. The method diagram, click targets, animations, and playback controls are unchanged by this layout revision.

## Recorded observation interaction

The visible middle label is now **Warped raw event**, with related explanatory text retained below the slider. This is a copy change requested by the owner: the previous paired-event rendering and pIWE crossfade remain unchanged. Initial progress is Raw events (0), including the static fallback.

The received `corner2tag_web_observations_davis346` package supplies real DAVIS346 **GENERAL W632 / PARALLEL stereo-left-figure W256** observations. Both have all 20 final corners. All 61,648 / 54,722 actual events from their original 100ms windows are used, with exact paired raw/warped coordinates and signs. Their nominal displacement is 0.96 / 0.53 of median corner spacing, substantially clearer raw-to-aligned change than the old EVK4 examples.

Dragging the canvas or range control moves through **Raw events → pIWE → Corner detection**, in either direction. The native 346×260 event raster uses one pixel per event, original event order, and last-event-wins collisions. Raw and fully warped endpoints match the supplied native PNGs pixel-for-pixel. All stages/cases use the same [0,0,304,260) crop and nearest-neighbor enlargement, with positive blue, negative red, and zero white. Original twenty-corner coordinates and order are preserved; rows run in the same direction with diagonal links between rows.

Two lossless float32 event-pair buffers total 2,327,400 bytes. No sampling or coordinate rounding is used. Metadata remains in `static/data/motion-story.json`; original timestamps, index maps, and full numerical arrays remain in the local source package. W256 uses its own figureL recording, timestamps, logged velocity (18.0354, -201.852) px/s, and reference at the first retained event (0 microseconds from nominal start). No W13/GENERAL timing or motion is borrowed. The IWE/pIWE are native production replays using logged six-significant-digit velocity, not recovered historical full-precision buffers. No detector, motion estimator, or calibration was rerun.

Current PARALLEL installation and checks: `tpami_video/codex/results/parallel-w256-refresh/` (`install_parallel.py`, `verify_story.mjs`). W256 was selected by the data provider after reviewing corner localization; original coordinates were never moved. GENERAL data, crop, normalization and CSS are unchanged. All 116,370 event pairs, forty corner positions, exact native raster endpoints and interaction handlers passed verification. Installed native previews were inspected; no live-browser visual measurement is claimed. Earlier complete export/layout scripts remain in `davis346-web-refresh/` as historical records.

## Interactive Fig.2 and method animations

Titles and descriptions in `static/data/pipeline.json` support explicit `<em>GENERAL</em>` and `<em>PARALLEL</em>` emphasis. Only these simple emphasis tags become DOM elements; other content is inserted as text. Image alt text excludes the emphasis tags. Existing playback controls and source animation media are unchanged.

Six regions open one shared animation dialog: Motion Distinction, Patch Extraction, GENERAL initialization, PARALLEL initialization, Corner Refinement and Optimization. Raw Event Stream and Event Representation remain static parts of the original figure, with no clickable overlay. The two initialization cases are separate buttons. The six clickable stages have a synchronized5.2s soft blue breathing highlight before interaction (fill1–3%, border10–30% opacity, below the7% fill/full border used on hover). Entering or focusing the diagram settles the background cues so only the selected stage is strongly highlighted. Reduced-motion preference leaves a faint static outline. No separate playback control is added for this decorative cue. Native inline SVG triangles indicate play on hover/focus; the dialog close button uses an SVG cross, avoiding text-encoding and font issues. The figure is unchanged, with normalized clickable geometry and horizontal scrolling on small screens.

The six active animations are 1920px, 30fps lossless animated WebP. Their content and timing are unchanged, and only the selected animation loads. The dialog has one playback button: Stop animation while playing/loading, and Replay after stopping. Replay restarts from the beginning using the cached asset. There is no separate Replay button. Close/Escape/backdrop, focus return, cancelled downloads and background pause/resume are retained. Available original GIFs remain compatibility fallbacks. The prior event_alignment media and comparison assets are retained as unused historical files; Event Representation no longer opens a popup or offers an animation in the page.

Optimization shows actual 2D-to-3D correspondences, schematic collection of M windows and the reprojection objective, not numerical solver convergence. Results remain omitted. AprilTag and stereo are now included below the checkerboard pipeline at the owner's request.

## AprilTag and stereo extensions

AprilTag Detection and Stereo Event Camera Calibration are peer subsections of Checkerboard Calibration for Event Camera within Method, sharing its content width and 30px heading style (26px on mobile). AprilTag uses a wide1920x760,25fps,22-second three-panel animation based on the GENERAL initialization layout: **Quad fitting → Binarization → Decoding**. Arrows connect the actual images at their vertical centers, with the same6px shaft,21px head,13px image clearance and#182D35 color as GENERAL. The preceding panels remain visible. A selected quad travels from the left image into the center and rectifies; contrast/ternary/grid/binary transitions occur within that same middle panel; the resulting code then leads to the right-hand ID0 detection. There are no navigation arrows across the top. The source photos retain their aspect ratios and share the processing panel's height.

The source figure has no matching native homography, motion, contrast values, cell means or decoder trace. Its visible corner markers therefore supply display-coordinate anchors; the geometric motion and pooling are explanatory, as approved by the owner. No detector run, numerical averaging trace, Otsu threshold, Hamming distance or rotation decision is fabricated. Original intermediate panels and the accepted ID are preserved. The different synthetic W63 computation is not substituted. Lossless animated WebP is the web primary (all550RGBframes verified), with an actual GIF fallback. The original SVG and prior sequential figure animation remain available as historical media.

Stereo Event Camera Calibration reuses the latest approved synchronized animation: compact upper timeline, aligned left/right event arrival, motion compensation, detected corners and rectification. The actual GIF is1920x1080,480frames,16seconds and16,677,696bytes. Its contents and timing are retained. GIF palette quantization and30/40ms frame delays are documented; the lossless RGB/WebP reference stays in the workspace.

Both inline image animations use independent playback state and are displayed at 85% of the shared content width, centered; their headings and descriptions keep the normal alignment. Each animation is fetched only when its image approaches within300px of the viewport. At least25% visibility starts playback; leaving restores the static poster, and re-entry restarts the cached GIF. Manual Stop persists, hidden tabs stop playback, and reduced-motion preference requires manual play. The single inline button initially says Play animation; during playback it says Stop animation, and after stopping or a failed playback attempt it says Replay. Replay restarts from the beginning; manual Stop continues to suppress automatic restart. `static/data/extension-animations.json` and `static/js/inline-animations.js` control both inline animations separately from the six method dialogs.

Footer text is **3DVISION & ROBOTICS LAB · UNIST**. The current additions were checked for source identity, GIF dimensions/timing, HTTP MIME, unchanged hero/abstract/CVPR files, and13 mock lifecycle groups. This does not claim live-browser playback verification. Reproducible sources and reports are in `tpami_video/codex/results/method-extensions/`.

## Preview and verification

The requested LAN preview is running at **http://192.168.0.172:8765/corner2tag++/**. On this PC use **http://127.0.0.1:8765/corner2tag++/**. The custom `serve_local.py` exposes only the two research-page directories, not `.git` or directory listings. It is intentionally left running for the owner's review. No public deployment was performed. Opening `index.html` directly with `file://` does not reliably load modules or JSON.

Current verification covers source/HTTP, scientific coordinates,40corners,2,001scrub states, six active nonoverlapping regions (seven in the earlier revision), native figure rendering, original media preservation and19mockDOM/modal lifecycle checks. A tab-hide/metadata-load race was found and fixed. The actual Chrome visual check could not finish: ComputerUse stopped because it could not confidently determine the current browser URL. No UI bypass was attempted, and these state checks are not claimed as live-browser verification.

Active sources: `index.html`, `static/css/index.css`, `static/js/index.js`, `static/js/story.js`, `static/js/pipeline.js`, `static/data/pipeline.json`, `static/data/motion-story.json`, `static/data/method-animations.json`. Provenance is stored in `static/data/provenance.json`. Historical unused assets remain for reproducibility.

The earlier pipeline revision's exporters, PDF extraction, mapping, data/media/modal checks, LAN server and result note are in `tpami_video/codex/results/pipeline-interactive/`. The older files below document previous revisions.

Reproduction and audit files are in the adjacent `tpami_video/codex/results/project-page-draft/` workspace:

- `audit_frontal_examples.py`, `frontal_selection_audit.json`: observation selection.
- `export_frontal_story.py`, `export_frontal_poster.py`: historical EVK4 observation assets.
- `frontal_story_verification.json`, `frontend_story_verification.json`: exact source/corner and interaction verification.
- `verify_story_module.mjs`, `check_revisited.py`, `check_gif_lifecycle.mjs`: repeatable checks.
- `export_method_webp.py`, `method_webp_verification.json`: unchanged high-quality animation production.
- `결과.txt`: revision history and verification limits.

Current AprilTag animation rendering, source provenance, stage previews, MP4 and verification: `tpami_video/codex/results/apriltag-panel-flow/`. Previous single-view and sequential-reveal drafts remain in `apriltag-continuous/` and `apriltag-animation/`. The additional `apriltag_detection.mp4` is1920x760,H.264High,yuv420p,25fps,22seconds with faststart, encoded directly from the same RGB renderer. Stereo media content, resolution and timing are unchanged; only its CSS display width is reduced.

MP4 quality update: `apriltag_detection.mp4` now uses H.264 High, CRF8/slow, yuv420p and faststart (1,914,670bytes). `apriltag_detection_lossless.mp4` is a separate RGB-lossless H.264 master for editing/archive (9,626,739bytes; all550decodedRGBframes exactly match the renderer). Both preserve1920x760,25fps and22seconds. Reproduce with `export_hq_mp4.py`; verification is in `hq-mp4-verification.json`. The earlierCRF17file remains in `before-hq/`. Website animation media are unchanged.
