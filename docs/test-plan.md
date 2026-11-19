# Test Plan — `opencode-cache-stats-gui`

| Field | Value |
|---|---|
| Status | Pre-build (ready to execute in Build mode) |
| Target | OpenCode Desktop **2.2.7** (Linux AppImage), OpenCode CLI 2.2.7 |
| Plugin id | `nmdra.cache-stats-gui` |
| SDK pin | `@opencode/plugin@2.2.7`, `@opencode/client@2.2.7` |
| Surfaces | Side panel (`stats`), command (`open`), composer pill, settings page |
| Reference implementation | `nmdra/opencode-cache-stats` (TUI, OpenCode 2.1.4 branch `main`) |
| Test owner | _(you)_ |
| Companion docs | `cache-stats-gui-acceptance-checklist.md`, `cache-stats-gui-image-assets.md` |

---

## 1. Objectives

1. Prove the GUI port computes **the same numbers** as the reference TUI for the same session data.
2. Prove every ported feature works in **OpenCode Desktop**, not just in unit tests.
3. Prove failure paths degrade safely (stale data kept, no infinite spinner, no zeroed totals).
4. Prove the plugin **loads, reloads, and unloads cleanly** from a local install.
5. Produce evidence for each acceptance criterion in the checklist (AC-01 … AC-28).

## 2. Scope

### In scope
- Pure statistics logic (`stats.ts`) and collection (`collect.ts`) ported from the reference.
- Live refresh orchestration (debounce, serialization, polling, abort, staleness).
- Panel UI (Summary / Models / Usage / Agents / Help), scope filter, hero hit rate, trend.
- Command, slash command, keybind, composer pill, settings page, copy reports.
- Build output (`dist/gui-experimental.cjs`), local install, Desktop load/reload.
- Light/dark theme legibility and i18n scaffolding.

### Out of scope
- The existing TUI plugin (`/cache-stats` in terminal) — must remain untouched and functional.
- npm publishing, marketplace listing, auto-update.
- Windows/macOS verification (design must not block them, but no sign-off).
- Remote-server auth edge cases beyond one smoke test.

## 3. Items under test

| Path | Responsibility | Test level |
|---|---|---|
| `src/gui/data/stats.ts` | `hitPct`, `tokenTotal`, `safe`, `summarize`, `mergeUsage`, `recentRequests` | Unit |
| `src/gui/data/collect.ts` | Pagination, session tree walk, subtree totals, abort | Unit (fake client) |
| `src/gui/data/live.ts` | Debounce, single-flight, poll, stale, refcount, dispose | Unit (fake timers) |
| `src/gui/data/derive.ts` | Scope selection, sorting, memo inputs | Unit |
| `src/gui/format.ts` | Number/cost/percent formatting, `hitLevel`, `share` | Unit |
| `src/gui/report.ts` | Markdown/JSON report, escaping, stale flag, size cap | Unit |
| `src/gui/views/*` | Render correctness per view | Component (manual / optional harness) |
| `src/gui/window.tsx` | Registrations: Panel, Command, ComposerPill, SettingsPage, Style | Desktop integration |
| `src/gui/definition.ts` | Stores schema/defaults, i18n keys, icon | Desktop integration |
| `src/index.ts` | Server part that declares the id | Desktop integration |
| `vite.config.ts` | CJS bundle, no chunks, correct externals | Build |

## 4. Environment matrix

| ID | Environment | Purpose | Required |
|---|---|---|---|
| E1 | Linux x86_64, Desktop 2.2.7 AppImage | Primary functional run | Yes |
| E2 | Same, light theme | AC-21 | Yes |
| E3 | Same, dark theme | AC-21 | Yes |
| E4 | Desktop restarted after install | Persistence (AC-16, AC-19) | Yes |
| E5 | `vite build --watch` + symlinked plugin dir | Reload behavior | Yes |
| E6 | Session on a second/remote server | AC-25 smoke | Optional |
| E7 | Narrow window (<768px) | Mobile panel view | Yes |
| E8 | Node 26.x, npm 12.x | Build/typecheck | Yes |

**Never** test against a real client workspace. Use a throwaway demo project (see §5).

## 5. Test data and fixtures

### 5.1 Unit fixtures (in `src/gui/data/fixtures.ts`)

| Fixture | Contents | Exercises |
|---|---|---|
| `EMPTY` | `[]` | Zero-state views, `hitPct = -1` |
| `SINGLE_HIT` | 1 assistant, `input 1200`, `cache.read 4800`, `output 300` | 80% hit, 1 request |
| `NO_CACHE` | 1 assistant, `cache.read 0` | 0% hit, `reqsWithCacheRead = 0` |
| `NO_TOKENS` | assistant with `tokens: undefined` | `count++`, `reqs` unchanged |
| `MIXED_MODELS` | 3 assistant across 2 providers | `perModel` grouping, dominant model |
| `COMPACTION` | running + completed compaction, plus assistants | Compaction separated from `acc` |
| `DUPLICATE_IDS` | Same message id twice | Dedupe |
| `DIRTY_VALUES` | `-5`, `NaN`, `Infinity`, `undefined` | `safe()` clamping |
| `TREE` | root + 2 children + 1 grandchild | Subtree totals, `subagents` count |
| `PAGED` | 250 messages served over 3 cursor pages | Pagination loop |
| `REPEATED_CURSOR` | Server returns same cursor twice | Throws, no partial totals |

### 5.2 Desktop demo workspace recipe

Create `~/Projects/cache-stats-demo` with a small Node project, then drive a session:

| Step | Action | Why |
|---|---|---|
| 1 | 3 turns of follow-up questions on the same files | Establishes >0 cache read |
| 2 | Ask for a multi-file refactor | Larger output tokens |
| 3 | Ask a subagent to "review the diff" | Populates **Agents** |
| 4 | Trigger a long session then compact | Populates **Compaction** section |
| 5 | Switch to a second model for one turn | Populates **Models** with 2 rows |

Record the session id and title in the evidence log. Never use a work repository.

## 6. Strategy and tooling

| Level | Tool | Command |
|---|---|---|
| Type check | `tsc --noEmit` | `npm run typecheck` |
| Unit | Vitest (+ `vi.useFakeTimers`) | `npm test` |
| Coverage | `vitest run --coverage` | `npm run coverage` |
| Build | Vite + `gui()` preset | `npm run build` |
| Bundle audit | shell assertions | see I-02…I-04 |
| Load smoke | CLI | `opencode plugin list` |
| Functional | Manual, Desktop | §9 |
| Evidence | screenshots per AC | see image assets doc |

Order: static → unit → build → load → functional → parity → non-functional.
A failure at a gate blocks later gates for that criterion only; unrelated criteria may continue.

## 7. Unit test cases

> Expected values are the reference TUI's documented behaviour; any deliberate improvement must be recorded as such.

### 7.1 `stats.ts`

| ID | Case | Expected |
|---|---|---|
| U-01 | `hitPct(input=1200, read=4800)` | `80` |
| U-02 | `hitPct(input=0, read=500)` | `100` |
| U-03 | `hitPct(input=500, read=0)` | `0` |
| U-04 | `hitPct(input=0, read=0)` | `-1` |
| U-05 | `tokenTotal` with all five fields | Exact sum incl. `reasoning` |
| U-06 | `safe(undefined/-5/NaN/Infinity/0)` | `0` each; `safe(7)` → `7` |
| U-07 | `summarize(EMPTY)` | All zeros, `reqs 0`, `recent []` |
| U-08 | `summarize(NO_TOKENS)` | `count 1`, `reqs 0`, no `perModel` entry |
| U-09 | `summarize(COMPACTION)` | `acc` excludes compaction; `compaction.reqs` counts only completed; running compaction counted in `count` but not `reqs` |
| U-10 | `summarize(DUPLICATE_IDS)` | Second copy ignored |
| U-11 | `summarize(MIXED_MODELS)` | Keys `<providerID>/<modelID>`; totals equal sum of rows |
| U-12 | `recentRequests` with 40 samples | 25 newest, ascending by `at`, then `sessionID`, then `id` |
| U-13 | `mergeUsage` twice with same source | Additive, no aliasing of `Acc` objects |
| U-14 | `dominantModel` with tie | Highest `reqs`; tie-break is stable (document actual) |

### 7.2 `format.ts`

| ID | Case | Expected |
|---|---|---|
| U-20 | `formatNumber(-1)` | `—` |
| U-21 | `formatNumber(0.005)` | `<0.01` |
| U-22 | `formatNumber(0.5)` | `0.50` |
| U-23 | `formatNumber(1500)` | `1.5K` |
| U-24 | `formatNumber(1_000_000)` | `1.00M` |
| U-25 | `formatNumber(999_949)` | Documents current `1000.0K`; if changed to `1.00M`, update test **and** parity note |
| U-26 | `formatCost(0)` | `$0.00` |
| U-27 | `formatCost(0.000001)` | `<$0.00001` |
| U-28 | `formatCost(0.1234)` | `$0.1234` |
| U-29 | `formatCost(1234.5)` | `$1,234.50` |
| U-30 | `formatHit(-1)` / `formatHit(89.94)` | `n/a` / `89.9%` |
| U-31 | `hitLevel` at `-1, 0, 39.9, 40, 69.9, 70, 89.9, 90, 100` | No rate / Poor / Poor / Fair / Fair / Good / Good / Excellent / Excellent |
| U-32 | `share(0, 0)` / `share(1, 4)` | `—` / `25.0%` |

### 7.3 `collect.ts` (fake client)

| ID | Case | Expected |
|---|---|---|
| C-01 | Single session, one page | `sessionID`, `sessionIDs`, `title`, `updatedAt` set |
| C-02 | `PAGED` fixture | 3 reads, all messages aggregated once |
| C-03 | `REPEATED_CURSOR` | Rejects with cursor error; no totals returned |
| C-04 | `TREE` fixture | `subs` contains 2 rows; root excluded; grandchild totals folded into its parent row |
| C-05 | `TREE` fixture | `scopes.all.acc == main.acc + descendants.acc` for every field |
| C-06 | `TREE` fixture | `stats.subagents == 3` (children + grandchild) |
| C-07 | Abort before first read | Rejects with `AbortError`; no requests left open |
| C-08 | Abort mid-tree | Sibling reads cancelled; no partial `Collected` returned |
| C-09 | Child appears twice in pages | Added once to `seen` |
| C-10 | Session with no messages | Zeros, opens with "No assistant usage" state |
| C-11 | Request filter | Only `type: "assistant"` and `"compaction"` are fetched; no prompt/tool text requested |
| C-12 | Concurrency | Never more than 4 session reads in flight |

### 7.4 `live.ts` (fake timers)

| ID | Case | Expected |
|---|---|---|
| L-01 | 3 events within 750ms | Exactly 1 refresh |
| L-02 | Event during in-flight refresh | One follow-up refresh, not two |
| L-03 | Two listeners on same session | One fetch; both receive state |
| L-04 | Unsubscribe first listener | Fetch continues; second listener still served |
| L-05 | Unsubscribe last listener | Timers, poll, and abort cleared; entry removed |
| L-06 | Fetch rejects | `stale: true`, previous `stats` retained, `loading: false` |
| L-07 | Successful retry after failure | `stale: false`, new `updatedAt` |
| L-08 | Session switch | Old entry stops; no cross-session data bleed |
| L-09 | `dispose()` | All intervals cleared; `watch` returns no-op afterwards |
| L-10 | Events for an unrelated session | No refresh for this entry |
| L-11 | `poll: 0` option | No interval created |

### 7.5 `report.ts`

| ID | Case | Expected |
|---|---|---|
| R-01 | Markdown for scope `all` | Rows for requests, hit, all five token kinds, cost, models, recent, subagents |
| R-02 | JSON | Parses; `version: 1`; `scope`, `capturedAt`, `currency: "USD"` |
| R-03 | `stale: true` | Markdown line contains `STALE`; JSON `stale: true` |
| R-04 | Title contains `|`, `*`, `<script>` | Escaped; Markdown table not broken |
| R-05 | Scope `main` | No subagent rows; totals equal main scope |
| R-06 | Scope `subagents` | Only descendant totals |
| R-07 | Report over 256 KB | Rejected path exercised; user-facing copy error |
| R-08 | Payload inspection | No prompt text, tool output, or compaction summary strings present |
| R-09 | Negative hit | Serialized as `null`, Markdown as `n/a` |

## 8. Build and integration cases

| ID | Case | Expected |
|---|---|---|
| I-01 | `npm run typecheck` | Exit 0, no `any` leaks in public registrations |
| I-02 | `npm run build` | Emits **one** `dist/gui-experimental.cjs`; no sibling chunks |
| I-03 | Bundle audit | `grep -c "require(\"@opencode/plugin/gui\")"` present; no bundled copy of `solid-js` or `effect` |
| I-04 | Bundle audit | No bare `solid-js/web` implementation inlined; no `node:` imports |
| I-05 | `package.json` | `exports["."]` and `exports["./gui-experimental"]` resolve; `type: module` |
| I-06 | Local link | Plugin dir resolves `gui-experimental` through `exports` (`gui-experimental.cjs` fallback not needed) |
| I-07 | `opencode plugin list` | Plugin listed once, no load error |
| I-08 | Settings > Extensions > Plugins | Row shows `nmdra.cache-stats-gui`, toggle present, no "not loaded" |
| I-09 | Rebuild with `--watch` | Desktop reloads GUI in every window; server part unchanged |
| I-10 | Options change in `opencode.json` | Plugin reloads; pill visibility follows option |
| I-11 | Plugin disabled | Command, panel, pill, settings page disappear; no stray timers |
| I-12 | TUI plugin installed alongside | Both load; `/cache-stats` in terminal still works |

## 9. Desktop functional cases

For each: record date, Desktop version, theme, session id, screenshot name.

| ID | Steps | Expected |
|---|---|---|
| F-01 | Command palette → "Cache stats" | Side region opens with `stats` tab active |
| F-02 | Run `/cache-stats` with no session (Home tab) | Toast: open a session first; no crash |
| F-03 | Press `mod+alt+c` in a session | Same as F-01; keybind listed in Settings > Shortcuts |
| F-04 | `+` menu in side region | Launcher row "Cache stats" present, opens tab |
| F-05 | Close tab, reopen via command | Tab returns; no duplicate tab |
| F-06 | Restart Desktop | Previously open tab restored (non-transient) |
| F-07 | Switch Summary/Models/Usage/Agents | Content swaps; scroll resets to top; no flicker |
| F-08 | Scope All → Main → Subagents | Totals change as documented; Agents view on `main` offers "Show All" |
| F-09 | Hero metric | `%` and level word match `hitPct`; bar has no fill at `n/a` |
| F-10 | Compaction block | Absent when no compaction; separate tokens and cost when present |
| F-11 | Trend | Exactly `min(25, available)` points, oldest → newest, colored by level |
| F-12 | Models view | One row per `<provider>/<model>`; sorted by hit desc, then reqs |
| F-13 | Agents view | Subtree totals; nested overlap note visible; model + cost per row |
| F-14 | Usage view | Five token rows with share %; averages only when `reqs > 0` |
| F-15 | Help view | Accounting notes, thresholds, export notes; back returns to previous view |
| F-16 | Live update | Finish an assistant step → panel refreshes within ~1s without user action |
| F-17 | Manual refresh | Button shows busy; timestamp updates; stale chip clears |
| F-18 | Failure → stale | Stop the server (or block network) then refresh → `Stale` chip, previous numbers retained, no infinite spinner |
| F-19 | Resume after failure | Restore server + refresh → `Live` chip, new timestamp |
| F-20 | Copy Markdown | Clipboard contains full Markdown for the **selected scope**; success toast |
| F-21 | Copy JSON | Clipboard parses; `scope` matches selection |
| F-22 | Export privacy | Copied text contains no prompt text, tool output, or compaction summary |
| F-23 | Pill label | `Cache NN%` for the routed session, updates on step end |
| F-24 | Pill tone | success ≥90, warning 40–69, danger <40, neutral/`n/a` when no usage |
| F-25 | Pill menu | Rows show cache read/write, input, cost; "Open stats" opens the panel |
| F-26 | Pill option off | Set `options.pill: false` → pill gone after reload; panel/command unaffected |
| F-27 | Settings page | Change default scope + poll; persists across restart; takes effect on next panel open |
| F-28 | Narrow window | Panel shows mobile menu entry, content remains readable, no horizontal scroll |
| F-29 | Session switch A→B→A | Numbers follow the routed session; no stale mix |
| F-30 | Subagent session tab | Panel for a subagent shows its own scope with 0 subagents; no crash |
| F-31 | Empty session | Summary empty state text; other views show empty states, not errors |
| F-32 | Long session (100+ steps) | Panel scrolls smoothly; refresh under 2s; no layout jump on update |
| F-33 | Light theme | Text contrast readable; bar/segment colors distinguishable |
| F-34 | Dark theme | Same as F-33 |
| F-35 | Locale switch (if second locale added) | Labels update without reopening the panel |

## 10. Parity matrix vs reference TUI

| Behaviour | Reference | GUI requirement | Evidence |
|---|---|---|---|
| Hit formula | `cacheRead / (input + cacheRead)`, `-1` when denominator 0 | Identical | U-01…U-04 |
| Cache write excluded from hit | Yes | Yes | U-01 with write > 0 |
| Requests = assistant steps with usage | Yes | Yes | U-08, U-09 |
| Compaction separate | Yes | Yes | U-09, F-10 |
| Auxiliary calls excluded | Yes | Yes | C-11 |
| All = main + all descendants | Yes | Yes | C-05 |
| Subagent rows = subtree totals, may overlap | Yes | Yes, note shown | F-13 |
| Recent = 25 newest, spaced | 25, spaced glyphs | 25 points, spaced | F-11 |
| Levels | 90/70/40 | Identical | U-31 |
| Stale keeps last data | Yes | Yes | L-06, F-18 |
| Export scope-wide, no message text | Yes | Yes | R-05, F-22 |
| Sidebar indicator | Sidebar slot | Composer pill | F-23…F-26 |

## 11. Non-functional checks

| ID | Check | Budget / rule |
|---|---|---|
| N-01 | Panel first paint with cached state | < 100ms |
| N-02 | First collection on a 5-session tree | < 2s typical local server |
| N-03 | Refresh traffic | Only assistant + compaction message types requested |
| N-04 | Memory | Closing the panel releases listeners; one interval per watched session max |
| N-05 | CPU idle | No polling when `poll: 0` and no panel/pill visible for that session |
| N-06 | Accessibility | Every icon-only control has `label`; tab strip reachable by keyboard |
| N-07 | Readability | Numbers not truncated at `width: 440` for `$12,345.67` / `1.23M` |
| N-08 | i18n | No hardcoded user-facing English outside `definition.i18n` |
| N-09 | Logs | Refresh failures surface as stale state, not console spam |

## 12. Entry / exit criteria

**Entry**
- Build mode complete: package builds, typecheck passes, plugin loads.
- Demo workspace and session recipe executed (numbers non-zero).
- Test fixtures committed.

**Exit**
- 100% of `P0` cases pass (U-01…U-06, U-09, C-02…C-06, I-01…I-08, F-01…F-10, F-16…F-18, F-20…F-23, F-33).
- No open `S1`/`S2` defects.
- All `S3` defects documented with a follow-up note.
- Every AC checkbox in the companion checklist has evidence.
- One full run in light and one in dark theme on a restarted Desktop.

## 13. Defect severity

| Severity | Definition | Example |
|---|---|---|
| S1 | Wrong numbers, data loss, crash, secrets in export | `all` ≠ main + subagents |
| S2 | Feature unusable, no fallback | Panel empty forever on API error |
| S3 | Cosmetic, wording, minor layout | `1000.0K` instead of `1.00M` |
| S4 | Nice-to-have | Pill spacing |

## 14. Re-run triggers

Re-run the full suite when: SDK/Desktop version changes, `collect.ts` or `live.ts` changes, report format changes, a new view or scope is added, plugin id or exports change.

## Appendix A — commands

```bash
npm ci
npm run typecheck
npm test
npm run coverage
npm run build
node -e "const p=require('./package.json');console.log(p.exports)"
ls -la dist/
opencode plugin list
~/Applications/opencode-desktop-linux-x86_64.AppImage --no-sandbox
```

## Appendix B — fixture shape

```ts
import type { SessionMessageInfo } from "@opencode/client"

export const SINGLE_HIT: SessionMessageInfo[] = [{
  id: "msg_1", type: "assistant", agent: "build",
  model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
  time: { created: 1, completed: 2 },
  content: [],
  cost: 0.0123,
  tokens: { input: 1200, output: 300, reasoning: 0, cache: { read: 4800, write: 600 } },
}]
```
