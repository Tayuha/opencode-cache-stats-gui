# Acceptance Criteria Checklist — `opencode-cache-stats-gui`

Use one copy per test run. Record `Run` = date + Desktop version + theme. Evidence = screenshot name or test command output.

Legend: `[ ]` not run · `[x]` pass · `[!]` fail (link defect) · `[-]` N/A (state why)

---

## Gate G0 — Before build (design readiness)

- [ ] **AC-00a** SDK pinned to `@opencode/plugin@2.2.7` and `@opencode/client@2.2.7`
- [ ] **AC-00b** Plugin id `nmdra.cache-stats-gui` declared by the server part and not in the reserved namespace
- [ ] **AC-00c** Package has `name`, `type: module`, and `exports` for `.` and `./gui-experimental`
- [ ] **AC-00d** Vite `gui()` preset configured with `entry: src/gui.tsx`, `outFile: dist/gui-experimental.cjs`
- [ ] **AC-00e** Test fixtures and demo workspace recipe prepared
- [ ] **AC-00f** Image asset plan approved (see image assets doc)

## Gate G1 — Static and unit quality

| ID | Criterion | Test | Evidence | Run | Status |
|---|---|---|---|---|---|
| AC-01 | Typecheck clean | `npm run typecheck` | terminal output | | [ ] |
| AC-02 | Hit formula matches reference | U-01…U-04 | `npm test` | | [ ] |
| AC-03 | Token totals include all five kinds | U-05 | | | [ ] |
| AC-04 | Missing/invalid usage excluded, never zero-filled | U-06, U-08 | | | [ ] |
| AC-05 | Only assistant messages count as requests | U-08, U-09 | | | [ ] |
| AC-06 | Compaction kept separate from request totals | U-09 | | | [ ] |
| AC-07 | Pagination is complete and repeat-cursor safe | C-01…C-03 | | | [ ] |
| AC-08 | Subagent subtree totals and counts correct | C-04…C-06 | | | [ ] |
| AC-09 | Abort leaves no partial totals | C-07, C-08 | | | [ ] |
| AC-10 | Only assistant/compaction types fetched | C-11 | spy assertions | | [ ] |
| AC-11 | Live refresh debounced and single-flight | L-01…L-03 | fake timers | | [ ] |
| AC-12 | Stale failure keeps previous data | L-06, L-07 | | | [ ] |
| AC-13 | Listeners/timers released | L-05, L-09 | | | [ ] |
| AC-14 | Formatters match reference output | U-20…U-32 | | | [ ] |
| AC-15 | Reports escape titles and carry scope + stale | R-01…R-05, R-09 | | | [ ] |
| AC-16 | Reports contain no prompts/tool text/summaries | R-08 | | | [ ] |

## Gate G2 — Build and load

| ID | Criterion | Test | Evidence | Run | Status |
|---|---|---|---|---|---|
| AC-17 | One CJS bundle, no chunks | `npm run build`; `ls dist/` | | | [ ] |
| AC-18 | App-provided modules remain external | I-03, I-04 | bundle grep | | [ ] |
| AC-19 | Plugin appears in Settings > Extensions > Plugins | I-08 | screenshot | | [ ] |
| AC-20 | `opencode plugin list` shows it with no error | I-07 | CLI output | | [ ] |
| AC-21 | Rebuild reloads GUI without restarting Desktop | I-09 | screen recording | | [ ] |
| AC-22 | Disable removes every surface cleanly | I-11 | | | [ ] |
| AC-23 | TUI `/cache-stats` still works alongside | I-12 | screenshot | | [ ] |

## Gate G3 — Functional (Desktop)

| ID | Criterion | Test | Evidence | Run | Status |
|---|---|---|---|---|---|
| AC-24 | Panel opens from command palette | F-01 | `preview-command.png` | | [ ] |
| AC-25 | `/cache-stats` slash command works | F-02 | | | [ ] |
| AC-26 | Keybind opens the panel | F-03 | | | [ ] |
| AC-27 | Panel listed as launcher in `+` menu | F-04 | | | [ ] |
| AC-28 | Tab closes and reopens without duplicates | F-05 | | | [ ] |
| AC-29 | Tab restores after Desktop restart | F-06 | | | [ ] |
| AC-30 | Four views + help render correct content | F-07, F-14, F-15 | `preview-*.png` | | [ ] |
| AC-31 | Scope filter changes totals correctly | F-08 | | | [ ] |
| AC-32 | Hero hit rate and level match data | F-09 | | | [ ] |
| AC-33 | Compaction section only when present, separate | F-10 | | | [ ] |
| AC-34 | Trend shows up to 25 requests, oldest→newest | F-11 | | | [ ] |
| AC-35 | Models view grouping and ordering | F-12 | `preview-models.png` | | [ ] |
| AC-36 | Agents view subtree totals with overlap note | F-13 | `preview-agents.png` | | [ ] |
| AC-37 | Live refresh after a completed step | F-16 | GIF | | [ ] |
| AC-38 | Manual refresh updates timestamp | F-17 | | | [ ] |
| AC-39 | Failure shows stale, keeps last numbers | F-18 | | | [ ] |
| AC-40 | Recovery clears stale | F-19 | | | [ ] |
| AC-41 | Copy Markdown works for selected scope | F-20 | clipboard dump | | [ ] |
| AC-42 | Copy JSON parses and matches scope | F-21 | | | [ ] |
| AC-43 | Export contains no private content | F-22 | | | [ ] |
| AC-44 | Composer pill shows live hit % | F-23 | `preview-pill.png` | | [ ] |
| AC-45 | Pill tone thresholds correct | F-24 | | | [ ] |
| AC-46 | Pill menu opens panel, shows breakdown | F-25 | | | [ ] |
| AC-47 | `options.pill: false` hides pill only | F-26 | | | [ ] |
| AC-48 | Settings page persists choices | F-27 | `preview-settings.png` | | [ ] |
| AC-49 | Narrow window usable | F-28 | | | [ ] |
| AC-50 | Session switching shows correct session | F-29 | | | [ ] |
| AC-51 | Empty session shows empty states, no errors | F-31 | | | [ ] |
| AC-52 | Large session scrolls and refreshes within budget | F-32, N-02 | timing note | | [ ] |

## Gate G4 — Parity with reference TUI

- [ ] **AC-53** Same numbers as the TUI for the same session (side-by-side screenshot)
- [ ] **AC-54** Same level thresholds and words (Excellent/Good/Fair/Poor)
- [ ] **AC-55** Same accounting notes available in Help
- [ ] **AC-56** Same scope semantics (All/Main/Subagents)
- [ ] **AC-57** Cache writes still excluded from hit rate
- [ ] **AC-58** No feature regression without a documented decision

## Gate G5 — Quality attributes

| ID | Criterion | Evidence | Status |
|---|---|---|---|
| AC-59 | Light theme readable and distinguishable | `preview-light.png` | [ ] |
| AC-60 | Dark theme readable and distinguishable | `preview-dark.png` | [ ] |
| AC-61 | Icon-only controls have accessible labels | code review | [ ] |
| AC-62 | No user-facing string outside i18n | grep review | [ ] |
| AC-63 | No console error spam during normal use | Desktop log | [ ] |
| AC-64 | Panel first paint < 100ms with cached data | timing note | [ ] |
| AC-65 | No polling while nothing is visible and poll is off | code review | [ ] |

## Gate G6 — Install and documentation

- [ ] **AC-66** Symlinked local install works (`~/.config/opencode/plugins/cache-stats-gui`)
- [ ] **AC-67** `opencode.json` entry documented and applied
- [ ] **AC-68** README states Desktop-only and version pin
- [ ] **AC-69** README has install, usage, options, troubleshooting sections
- [ ] **AC-70** Known limitation documented (experimental GUI API, re-pin on Desktop update)
- [ ] **AC-71** Release images captured and committed per image assets doc
- [ ] **AC-72** Final full pass in light and dark on a restarted Desktop

---

## Automated run — Build mode

Evidence captured 2026-11-19 on the local machine (Desktop 2.2.7 installed, not restarted).

| ID | Result | Evidence |
|---|---|---|
| AC-00a | PASS | `package.json` pins `@opencode/plugin@2.2.7`, `@opencode/client@2.2.7`, `effect@4.1.0` |
| AC-00b | PASS | `src/index.ts` declares `id: "nmdra.cache-stats-gui"`; `opencode plugin list` shows it |
| AC-00c | PASS | `exports: { ".": "./src/index.ts", "./gui-experimental": "./dist/gui-experimental.cjs" }` |
| AC-00d | PASS | `vite.config.ts` uses `gui()`; build emits `dist/gui-experimental.cjs` |
| AC-00e | PASS | `src/gui/data/fixtures.ts`, `fake-client.ts`, demo recipe in the test plan |
| AC-01 | PASS | `tsc --noEmit` exit 0 |
| AC-02 | PASS | U-01…U-04 in `stats.test.ts` |
| AC-03 | PASS | `tokenTotal` sums all five kinds |
| AC-04 | PASS | `safe()` clamps; `summarize` skips steps without usage |
| AC-05 | PASS | assistant-only request counting |
| AC-06 | PASS | compaction totals isolated |
| AC-07 | PASS | pagination + repeated-cursor rejection |
| AC-08 | PASS | subtree totals, descendant count, no double count |
| AC-09 | PASS | aborted-before and aborted-mid-flight reject |
| AC-10 | PASS | only `assistant` + `compaction` requested |
| AC-11 | PASS | debounce coalescing, single-flight follow-up |
| AC-12 | PASS | failure keeps last snapshot, marks stale, recovery clears it |
| AC-13 | PASS | unsubscribe releases entry, timers and server subscription |
| AC-14 | PASS | formatters and thresholds |
| AC-15 | PASS | Markdown/JSON scope, stale flag, escaping |
| AC-16 | PASS | no prompt/tool/summary text in the report |
| AC-17 | PASS | one 44.55 kB CJS bundle, no chunks |
| AC-18 | PASS | requires only `@opencode/plugin/gui`, `solid-js`, `solid-js/web`, `effect`; 0 dynamic imports |
| AC-20 | PASS | `opencode plugin list` → `nmdra.cache-stats-gui  local  …/plugins/cache-stats-gui` |
| AC-19 | PENDING | needs a Desktop restart, then Settings → Extensions → Plugins |
| AC-23 | PENDING | TUI plugin not installed here; manual check |
| AC-24…AC-52 | PENDING | manual Desktop run (G3) |
| AC-53…AC-58 | PENDING | side-by-side comparison with the TUI |
| AC-59…AC-65 | PENDING | light/dark captures and timing notes |
| AC-66…AC-72 | PARTIAL | symlink + `opencode.json` done; README and images pending |

Test totals: 6 files, 61 tests, all passing.

## Run log

| Run | Date | Desktop | Theme | Gates | Failures | Notes |
|---|---|---|---|---|---|---|
| R1 | | 2.2.7 | dark | | | |
| R2 | | 2.2.7 | light | | | |

## Defects

| ID | AC | Severity | Summary | Status |
|---|---|---|---|---|
| | | | | |

## Sign-off

- [ ] All P0 criteria pass
- [ ] No open S1/S2
- [ ] Images captured
- [ ] Ready to commit and tag `v0.1.0`

Signed: __________________ Date: __________
