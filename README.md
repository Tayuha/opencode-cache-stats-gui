# Cache stats for OpenCode Desktop

A cache-performance panel for the session you are working in. It shows the cached-token hit
rate, request counts, token breakdown, recorded cost, and a per-model and per-subagent
breakdown — as a side panel, a composer pill, and `/cache-stats`.

This is a GUI port of [`nmdra/opencode-cache-stats`](https://github.com/nmdra/opencode-cache-stats),
which targets the OpenCode terminal UI. The statistics, collection strategy, scope semantics,
and export format are kept in parity with that plugin.

## Requirements

- **OpenCode Desktop 2.2.7** (the GUI plugin API is experimental and version-coupled).
- A local checkout of this repository. The GUI bundle is committed; no build is needed to install.
- The GUI is desktop-only. The terminal UI does not load GUI plugin parts.

The SDK pin is deliberate: `@opencode/plugin@2.2.7` and `@opencode/client@2.2.7` match the
Desktop release. Re-pin both when you update OpenCode, then re-run the checks.

## Install

```bash
git clone <this repo> ~/Projects/opencode-cache-stats-gui
cd ~/Projects/opencode-cache-stats-gui
npm ci          # runtime deps for the server part
```

`dist/gui-experimental.cjs` is committed, so a clone is usable without building. Run
`npm run build` only after changing the source.

Link it where Desktop looks for local plugins:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sfn ~/Projects/opencode-cache-stats-gui ~/.config/opencode/plugins/cache-stats-gui
```

Adjust both paths if you cloned somewhere else.

Add it to the **global** `~/.config/opencode/opencode.json` (Desktop reads `opencode.json`,
not `cli.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/home/you/Projects/opencode-cache-stats-gui",
      "options": { "pill": true }
    }
  ]
}
```

Use the **absolute path** to the checkout. On OpenCode 2.2.7 a relative `./plugins/...` entry did
not resolve, so keep the absolute form (it is per-machine configuration).

Restart OpenCode Desktop. **Settings → Extensions → Plugins** should list
`nmdra.cache-stats-gui` with its switch enabled.

For development, keep the bundle rebuilding:

```bash
npm run dev   # vite build --watch, reloads the GUI in every window
```

## Usage

| Surface | How to open |
|---|---|
| Side panel | Command palette → **Cache stats**, `mod+alt+c`, `/cache-stats`, or the **+** menu in a session's side region |
| Composer pill | Shown above the composer while a session has recorded usage; click it for the breakdown, or open the panel |
| Settings | **Settings → Extensions → Cache stats** (or search "cache stats") |

The panel opens on **Summary**. The scope switch picks what the totals cover, and the view
switch picks what is shown. The hit-rate hero, session-only counter, status chip, refresh button,
and report menu stay visible while the view scrolls.

| Scope | Covers |
|---|---|
| **Main + Subagents** | The routed session and every descendant session (subagents), including history from before compaction |
| **Main Agent** | The routed session only, subagents excluded |
| **Subagents** | The descendant sessions only |
| **Project** | Every top-level session in the project, worktrees included, each with its subagent tree |

**Project** is collected lazily the first time you select it and then cached. It aggregates the
60 most recent sessions (the panel says so when it truncates) and refreshes on step events while
visible, on its own poll interval, and on the refresh button. Closing OpenCode does not end a
session: totals are read from the server's stored history, so they are complete when you reopen.

### Views

| View | Shows |
|---|---|
| **Summary** | Hit rate and level, requests, models, subagents, tokens, cache read, cost, the last 25 requests as a trend, and compaction cost when present |
| **Models** | One row per provider/model with hit rate, a hit bar, requests, tokens, and recorded cost; healthiest first |
| **Usage** | The five token kinds with their share of the total, requests with and without cache reads, per-request averages, recorded cost, and a separate compaction breakdown |
| **Agents** | One row per subagent with its subtree hit rate, model, requests, tokens, and cost; nested rows overlap on purpose |

The small line under the hit rate is the **session-only counter**: it always reports the routed
session's own usage, even while you are looking at **Main + Subagents** or **Project**.

### What it counts

```
hit = cache read / (fresh input + cache read)
```

- Cache writes are a one-time priming cost and are excluded from the hit rate.
- Requests are assistant steps with recorded usage, not individual retry attempts.
- **Main + Subagents** covers the session and every descendant, including history before compaction.
- Compaction is reported separately and never enters the request totals.
- Title generation and other auxiliary calls are excluded.
- A cache write is reported in tokens and cost, not in the hit rate.
- Levels: **Excellent** ≥ 90%, **Good** 70–89%, **Fair** 40–69%, **Poor** < 40%.

### Reports

**Copy → Copy as Markdown / Copy as JSON** copies the whole selected scope, not just the
visible view. Reports contain session metadata and aggregates: no prompts, tool output, or
compaction summaries.

### Settings

| Setting | Default | Effect |
|---|---|---|
| Composer pill | on | Show the live hit-rate pill above the composer |
| Default scope | Main + Subagents | Scope a new panel tab opens with (all four scopes are offered) |
| Refresh interval | 30 s | Safety poll on top of step-boundary refreshes; **Off** disables it |
| Refresh debounce | 0.75 s | Wait after a step ends before refreshing |

`options.pill: false` in `opencode.json` hides the pill regardless of the stored setting.

## Behaviour and limits

- Refreshes at step boundaries (`session.step.ended` / `failed`, compaction, usage, rename,
  revert) with a debounce, one in-flight request per session, and a periodic safety poll.
- A failed refresh keeps the last good numbers and marks them **Stale**; it never zeroes totals.
- First open of a large session tree performs real API reads (assistant and compaction messages
  only) and may take a moment on a slow server.
- Numbers can differ from the composer's own context indicator: this plugin reports recorded
  usage for the whole session tree, not the current context window.
- The pill and panel share one collection per session, so they always agree.
- The Project scope aggregates the 60 most recent top-level sessions; a notice appears when it truncates.

## Troubleshooting

| Symptom | Check |
|---|---|
| Plugin absent from Settings | It must be in the global `opencode.json`; Desktop ignores `cli.json` for GUI parts |
| Listed as "not loaded" | The server part failed to load. Run `opencode plugin list` and the Desktop log |
| Command does nothing | Open a session first; the command reports a toast when no session is routed |
| No numbers | The session has no recorded assistant usage yet; run a turn |
| Stale forever | The server is unreachable or the request failed; use the refresh button once it recovers |
| Panel blank after an OpenCode update | The GUI API changed. Re-pin `@opencode/plugin` to the new Desktop version and rebuild |
| Plugin absent after moving the folder or editing config | Run `opencode reload`, wait a few seconds, then `opencode plugin list` |

## Security and privacy

- **Read-only.** The plugin calls only `session.get`, `session.list`, and `message.list`. It never
  creates, prompts, mutates, deletes, or forks a session.
- **No egress.** There is no `fetch`, WebSocket, HTTP client, telemetry, or external URL in the
  source or the bundle.
- **No message content.** Totals come from assistant and compaction usage records. Exports contain
  session IDs, titles, and aggregates — never prompts, tool output, or compaction summaries
  (enforced by test `R-08`).
- **No injected HTML.** Text renders through Solid text nodes; report cells are escaped and
  control characters are stripped.
- **Reproducible bundle.** A fresh `npm run build` is byte-identical to the committed
  `dist/gui-experimental.cjs`, so the shipped file matches `src/`.
- **Dependencies.** Installed only from `registry.npmjs.org`. `npm audit` reports no critical or
  high advisories; the remaining moderate ones come from `@opencode/plugin`'s own tree and have no
  published fix.

Re-run the checks after any dependency or source change:

```bash
npm audit --audit-level=high
npm test
npm run build && git diff --exit-code -- dist
```

This repository is public. Keep credentials out of it: `.env`, `.env.*`, `*.pem`, and `*.key` are
ignored, and the plugin needs no credentials of its own.

Found a problem? Report it privately through GitHub Security Advisories — see
[`SECURITY.md`](SECURITY.md). Do not open a public issue for a vulnerability.

## Documentation

- [`TODO.md`](TODO.md) — remaining verification tasks, including how to test the Project scope
- [`docs/test-plan.md`](docs/test-plan.md) — test cases and fixtures
- [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) — acceptance criteria and run log
- [`docs/image-assets.md`](docs/image-assets.md) — screenshots and GIFs needed for release
- [`SECURITY.md`](SECURITY.md) — how to report a vulnerability and what is in scope

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest (stats, collect, live, project, format, derive, report)
npm run build       # dist/gui-experimental.cjs
```

Layout:

```
src/index.ts             server part: declares the plugin id
src/gui.tsx              ./gui-experimental entry
src/gui/definition.ts    stores, i18n
src/gui/window.tsx       panel, command, pill, settings registrations
src/gui/panel.tsx        panel shell: scope, views, status, reports
src/gui/views/           summary, models, usage, agents, help
src/gui/data/stats.ts    pure accounting (ported verbatim)
src/gui/data/collect.ts  paginated session-tree collection
src/gui/data/live.ts     debounce, single-flight, polling, staleness
src/gui/data/project.ts  lazy project-wide aggregation
src/gui/report.ts        Markdown and JSON exports
```

The build must stay one CommonJS file that requires only `@opencode/plugin/gui`, `solid-js`,
`solid-js/web`, and `effect`.

## Attribution

The statistics model, collection algorithm, presentation thresholds, and report format derive
from [`nmdra/opencode-cache-stats`](https://github.com/nmdra/opencode-cache-stats), MIT licensed.
The GUI layer, desktop data flow, settings, and composer pill are new work.

## License

MIT. See [LICENSE](LICENSE).
