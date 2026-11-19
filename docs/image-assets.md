# Image Assets Plan — for the first git push

Reference for the screenshots, GIFs, and icons this repository needs **later**, when the plugin is committed and pushed. Nothing here is generated during Build mode except the icon; the captures are taken after the plugin loads in OpenCode Desktop.

Related docs: `cache-stats-gui-test-plan.md` (§9 functional cases supply the states), `cache-stats-gui-acceptance-checklist.md` (AC-59, AC-60, AC-71).

---

## 1. Where each image is used

| Destination | Assets | Notes |
|---|---|---|
| `README.md` hero | `preview-summary.png` | First thing a visitor sees |
| README "Views" table | `preview-models.png`, `preview-usage.png`, `preview-agents.png` | Mirrors the reference repo's 3-column layout |
| README "Live indicator" section | `preview-pill.png` | Shows the composer pill + its menu |
| README "Open it" section | `preview-command.png` | Palette with `Cache stats` |
| README "Settings" section | `preview-settings.png` | Plugin row + settings page |
| README "Light and dark" | `preview-light.png`, `preview-dark.png` | Same session, both themes |
| Demo | `assets/demo.gif` | Tab switching + live refresh |
| Repo social preview | `assets/social-preview.png` | GitHub Settings → Social preview, 1280×640 |
| Plugin identity | `src/gui/icons/chart.svg` (source), `assets/logo.png` | Icon ships in the bundle; PNG for listings |

### Naming rules
- Lowercase, hyphenated, `preview-<surface>[-<variant>].png`.
- One file per state; never `screenshot1.png`.
- Theme variants use the `-light` / `-dark` suffix.
- Raw captures live in `assets/raw/` and are **gitignored**.

---

## 2. Asset inventory

| # | File | Must show | Size (px) | Format | Priority |
|---|---|---|---|---|---|
| 1 | `assets/preview-summary.png` | Side panel, Summary view, scope `All`, non-zero hit %, hero bar, trend, compaction block | 880×1600 (2×) | PNG | P0 |
| 2 | `assets/preview-models.png` | Models view with ≥2 providers, hit bars, costs | 880×1600 | PNG | P0 |
| 3 | `assets/preview-usage.png` | Usage view: five token rows, shares, averages, recorded cost | 880×1600 | PNG | P0 |
| 4 | `assets/preview-agents.png` | Agents view with ≥2 subagents, overlap note, per-agent model/cost | 880×1600 | PNG | P0 |
| 5 | `assets/preview-pill.png` | Composer pill `Cache NN%` plus its open row menu | 760×260 | PNG | P0 |
| 6 | `assets/preview-command.png` | Command palette with "Cache stats" selected | 1200×760 | PNG | P1 |
| 7 | `assets/preview-settings.png` | Settings page: pill on/off, default scope, poll interval | 1200×760 | PNG | P1 |
| 8 | `assets/preview-plugins.png` | Settings → Extensions → Plugins row for the plugin | 1200×420 | PNG | P1 |
| 9 | `assets/preview-light.png` | Full window, light theme, panel open | 1600×1000 | PNG | P0 |
| 10 | `assets/preview-dark.png` | Same session, dark theme | 1600×1000 | PNG | P0 |
| 11 | `assets/demo.gif` | 8–12 s loop: open panel → switch tabs → change scope → copy report → hit updates | 1200 wide | GIF | P1 |
| 12 | `assets/social-preview.png` | Wordmark + one sentence + hero number | 1280×640 | PNG | P2 |
| 13 | `assets/logo.png` | Plugin mark on transparent background | 512×512 | PNG | P2 |

P0 = required before first push. P1 = required before announcing. P2 = optional polish.

---

## 3. Preconditions (do once)

1. **Demo workspace**, never a real client project:
   ```bash
   mkdir -p ~/Projects/cache-stats-demo && cd ~/Projects/cache-stats-demo
   git init && npm init -y
   printf 'export const sum = (a, b) => a + b\n' > src.js
   ```
2. **Deterministic session recipe** (same as test plan §5.2):
   - Turn 1: ask about `src.js`.
   - Turn 2: ask a follow-up so cache read grows.
   - Turn 3: multi-file refactor — larger output.
   - Turn 4: spawn a subagent ("review the diff") twice — **Agents** view.
   - Turn 5: switch model once — second row in **Models**.
   - Turn 6: compact the session — **Compaction** block.
3. **Session title**: rename to `Cache stats demo`. Session titles appear in the panel header and in exports.
4. **Window**: resize to 1600×1000, zoom reset to 100%, sidebar in its normal state, no notifications, no other tabs.
5. **Numbers**: confirm the hero is not `n/a`, at least one model row exists, and at least one subagent row exists. If cache read is 0, run one more follow-up turn.
6. **Clean desktop**: hide the browser, notifications, and terminal windows behind the app.

---

## 4. Capture procedure (Linux, AppImage)

```bash
~/Applications/opencode-desktop-linux-x86_64.AppImage --no-sandbox
```

Recommended tools: `spectacle` or `flameshot` for stills, `kooha` or `peek` for GIFs, `imagemagick` for crops, `gifski`/`ffmpeg` for the GIF, `pngquant`/`oxipng` for size.

### 4.1 Stills
1. Open the session, run `/cache-stats`, select the view to capture.
2. Hide the mouse cursor and any hover tooltip unless the asset is about that control.
3. Capture **the app window only** (region capture, not full screen).
4. Save raw to `assets/raw/<name>.png`.
5. Crop and resize:
   ```bash
   # Panel only: crop the side region, keep the panel borders
   magick assets/raw/summary.png -crop 880x1600+720+0 +repage assets/raw/summary-crop.png
   # Normalize to 2x width, then optimize
   magick assets/raw/summary-crop.png -resize 880x assets/preview-summary.png
   oxipng -o 4 --strip safe assets/preview-summary.png
   # or: pngquant --quality=80-95 --force --output assets/preview-summary.png assets/raw/summary-crop.png
   ```
   Use `magick identify` first to get the real offsets; the `+720+0` above is a placeholder.
6. For full-window shots, capture at 2× and downscale to 1600 wide so text stays crisp but the file stays reasonable.

### 4.2 GIF
1. Record with `kooha` (window region, 30 fps) or `peek`.
2. Keep it 8–12 s and to a single story: open → tabs → scope → copy toast → pill tick.
3. Convert and optimize:
   ```bash
   ffmpeg -i assets/raw/demo.mkv -vf "fps=15,scale=1200:-1:flags=lanczos" -f yuv4mpegpipe - \
     | gifski --fps 15 --width 1200 -o assets/demo.gif -
   ```
   Target **< 10 MB** (GitHub's per-file recommendation is 10 MB; the repo soft limit is 1 GB).
4. Trim dead frames at the start and end; loop-friendly first and last frames.

### 4.3 Icon
- `src/gui/icons/chart.svg` is authored on a 16 px grid, drawn with `currentColor`, `viewBox="0 0 16 16"`, no `id` attributes. It is bundled through `?raw` and passed as `ctx.icons.chart`.
- `assets/logo.png` is an export at 512×512 with transparency, for listings only.

---

## 5. Redaction checklist (run before committing any image)

- [ ] No API keys, tokens, or the Providers settings screen
- [ ] No personal or client project names, file paths, or repo URLs
- [ ] No full `/home/<user>` path visible in the titlebar, tabs, or file tree
- [ ] No email addresses, avatars, or user names
- [ ] No private session titles other than `Cache stats demo`
- [ ] No terminal window or shell history behind the app
- [ ] No notification banners, toasts from other apps, or clock date leaks you care about
- [ ] Costs/dates are acceptable to publish (they are demo numbers)
- [ ] The plugin id shown in Settings matches the documented id
- [ ] Metadata stripped: `exiftool -all= assets/*.png` (screenshots can carry paths in EXIF/png tEXt chunks)

If a shot cannot be cleaned, retake it — do not blur it into unreadability.

---

## 6. README embedding (write this while capturing)

```markdown
# Cache stats for OpenCode Desktop

Cache hit rate, tokens, and recorded cost for the active session — as a side panel,
a composer pill, and `/cache-stats`.

![Cache stats panel, Summary view](assets/preview-summary.png)

## Views

| Summary | Models | Agents |
| --- | --- | --- |
| <img src="assets/preview-summary.png" width="290" alt="Summary view with cache hit rate and recent request trend" /> | <img src="assets/preview-models.png" width="290" alt="Per-model cache hit rate and cost" /> | <img src="assets/preview-agents.png" width="290" alt="Per-subagent subtree totals" /> |

## Usage breakdown

![Usage view with per-token-type shares](assets/preview-usage.png)

## Live indicator

![Composer pill showing 87% cache hit with its breakdown menu](assets/preview-pill.png)

## Open it

Run `/cache-stats`, pick **Cache stats** in the command palette, or press `mod+alt+c`.

![Command palette entry](assets/preview-command.png)

<details>
<summary>Settings and themes</summary>

![Plugin settings page](assets/preview-settings.png)
![Light theme](assets/preview-light.png)
![Dark theme](assets/preview-dark.png)

</details>

![Demo: opening the panel, switching views, copying a report](assets/demo.gif)
```

Rules:
- Alt text states **what the image proves**, not "screenshot".
- Panel images in tables use `<img width="290">`; standalone images stay full width.
- Keep the demo GIF last so the page stays fast.
- Re-check every relative path after the first commit.

---

## 7. Git workflow for the first push

```bash
cd /home/you/Projects/opencode-plugins-creation
git init -b main
```

`.gitignore` (minimum):
```gitignore
node_modules/
dist/
assets/raw/
*.local
.DS_Store
coverage/
*.tsbuildinfo
```

Decision notes:
- `dist/` stays ignored in git; the published npm package includes it through `files: ["src", "dist"]`, and `prepublishOnly` runs the build.
- If you later commit the bundle instead, remove `dist/` from `.gitignore` and document that the file is generated.
- No Git LFS needed if the GIF stays under 10 MB and PNGs under 1 MB each.

Commit order:
1. `chore: scaffold plugin package, vite gui preset, sdk pin 2.2.7`
2. `feat: port stats, collect, live, and report from the TUI plugin`
3. `feat: side panel with summary, models, usage, and agents views`
4. `feat: command, slash command, composer pill, and settings page`
5. `docs: readme, options, troubleshooting`
6. `test: unit, collect, live, and report suites`
7. `assets: previews and demo gif` (only after the redaction checklist passes)
8. `chore: release v0.1.0`

Tag and release:
```bash
git tag -a v0.1.0 -m "Cache stats GUI 0.1.0"
git push origin main --tags
gh release create v0.1.0 --title "v0.1.0" --notes-file CHANGELOG.md assets/demo.gif assets/preview-summary.png
```

Then set **Settings → Social preview** to `assets/social-preview.png`.
There is no separate image upload for npm; the README images must be absolute URLs after pushing (`https://raw.githubusercontent.com/<owner>/<repo>/main/assets/...`) if you ever publish the same README to npm.

---

## 8. Final asset acceptance

- [ ] All P0 assets exist and are referenced by `README.md`
- [ ] Every reference resolves from the repo root
- [ ] Panel shots are 880 px wide (2× of 440) and text is readable at 290 px
- [ ] GIF is < 10 MB, loops cleanly, shows the live refresh
- [ ] Light and dark shots use the **same** session and view
- [ ] No image contains anything from §5
- [ ] `exiftool -all=` applied
- [ ] `assets/raw/` is not tracked (`git status --ignored` check)
- [ ] Alt text written for every image
- [ ] Social preview uploaded and legible at thumbnail size
- [ ] `chart.svg` renders correctly at 14/16/20 px in the panel header and settings icon
