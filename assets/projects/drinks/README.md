The showcase reads `<drink>/manifest.json` and displays `<drink>/poster.webp`
immediately. Frames are numbered `000.webp` onwards, with no duplicate end frame.
Only the selected drink is loaded, every fourth frame before the fill pass.

Temporary development sequences were converted from the complete 72-frame PNG
turns in `outputs/drinks-blender/renders`, at 1200×900 and WebP quality 82. The
drink remains centred at the original height; the teal edge pixels extend the
backdrop to 4:3. This uses the existing FFmpeg/libwebp without Blender or a GPU:

    python3 scripts/prepare-drink-frames.py

For the final Blender delivery, replace each sequence and poster together and use:

```json
{"frameCount":120,"width":1200,"height":900,"dragDirection":-1,"temporary":false}
```

Frame zero must face front. Increasing indices in the supplied clockwise turn
move the front label left, so `dragDirection: -1` makes the label follow the hand.
If the final render direction reverses, use `1`. Frame counts are independent of
the 16-second rotation speed. The preparation script refuses production manifests.
Legacy JPG posters and video files remain on disk; the viewer never requests video.

Both showcase locations use centred `object-fit: cover` and a teal loading
background. The switch is a compact vertical menu of cream pills on the left,
aligned with the top-right card's 8px inset. The selected pill has a dark teal
fill and cream text. The native buttons retain `aria-pressed` and Tab/Space/Enter
access and receive their own pointer input, outside the drag button. There is
no drag hint. The card and pills use the existing hero colour tokens in both
themes, and the card retains the exact approved words and ignores pointer input.
Cells up to 520px wide reserve an 84px header band for the card. On phone
(viewport up to 760px), the menu becomes a compact row below the card and above
the image, with a fixed 122px header so switching designs causes no layout shift.

Claude: serve **this worktree** with `python3 -m http.server 4206 --bind 127.0.0.1`,
then run `BASE_URL=http://127.0.0.1:4206 bash scripts/check-shared-showcase.sh`.
Source-only checks: `bash scripts/check-shared-showcase.sh --source-only`.
Browser/GPU validation and the final 120-frame render remain review steps.
Browser checks cover both routes at 1440×750, 1280×720 and 390×844, using system
light/dark preferences: image coverage and teal fallback, absent hint, vertical
left menu aligned with the card on desktop, compact phone row, selected-pill
contrast, keyboard selection, no central drink overlap and mouse/touch dragging.

Uncommitted files for the menu/hint follow-up, based on `d9d653b`:

- `drink-spin.js`; `project-showcase.js`; `project-showcase.css`
- `index.html`; `children.html` (asset versions)
- `assets/projects/drinks/README.md`
- `tests/drink-spin-source.mjs`; `tests/drink-spin-browser.mjs`;
  `tests/project-showcase-source.mjs`; `tests/project-showcase.mjs`

`bash scripts/check-shared-showcase.sh --source-only` passes. Browser checks have
not been run here. Their screenshots/reports go under `outputs/drink-spin-20261028`
(the existing standalone piano-toggle check retains its own output directory).
This follow-up has not been committed, pushed or deployed.
