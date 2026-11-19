# TODO

Working checklist for finishing, verifying, and shipping `opencode-cache-stats-gui`.

Status at the time of writing:

- [x] Package builds as one CommonJS bundle (`dist/gui-experimental.cjs`)
- [x] 70 unit tests pass (`npm test`)
- [x] Typecheck clean (`npm run typecheck`)
- [x] Server part loads (`opencode plugin list`)
- [x] Local install wired through `~/.config/opencode/plugins/cache-stats-gui`
- [ ] GUI verified in OpenCode Desktop
- [ ] Project scope verified against real sessions
- [ ] Images captured, commit pushed

---

## 1. Restart and smoke test

- [ ] Quit OpenCode Desktop completely and reopen it (the GUI bundle loads at window start)
- [ ] After moving the plugin directory or changing the config, run `opencode reload` and wait a
      few seconds before `opencode plugin list` (the reload is asynchronous)
- [ ] **Settings → Extensions → Plugins** lists `nmdra.cache-stats-gui`, switch on, no "not loaded"
- [ ] Open a session → `/cache-stats` opens the side panel
- [ ] Command palette shows **Cache stats**, `mod+alt+c` works, `+` menu lists it
- [ ] Pill appears above the composer with a percentage
- [ ] If anything fails: check the desktop log and `opencode plugin list`, then report the line

## 2. Project scope with a single tab

**Important:** the Project scope aggregates *sessions*, not tabs. A tab is just a view of one
session. So you can test it with one tab open by creating several sessions sequentially.

### 2.1 Sessions created from the Desktop UI (most reliable)

- [ ] Create a throwaway workspace: `~/Projects/cache-stats-demo`
- [ ] In Desktop, open that directory as a project
- [ ] Session A: run one prompt, then create a **new session** (do not close the project)
- [ ] Session B: run one prompt with a **different model**
- [ ] Session C: run one prompt, then close its tab
- [ ] Open any session → panel → **Project**
- [ ] Expect the hero line to read `3 sessions`
- [ ] Expect the totals to equal A + B + C (compare against Main Agent in each session)
- [ ] Expect **Models** to show both models across sessions

### 2.2 Sessions created from the terminal (faster)

`opencode run` creates or continues a session in the current directory. Check that a run
actually appears in Desktop's session list for that project before relying on it; if the CLI
and Desktop use separate servers, fall back to §2.1.

```bash
mkdir -p ~/Projects/cache-stats-demo && cd ~/Projects/cache-stats-demo
git init -q 2>/dev/null || true

opencode run --title "Project test A" "Explain the files here in one sentence."
opencode run --title "Project test B" "List the files here."
opencode run --title "Project test C" "Summarize the repository."
```

- [ ] Each run appears in Desktop's sidebar under `cache-stats-demo`
- [ ] Panel → **Project** counts all of them

### 2.3 Worktree inclusion

```bash
cd ~/Projects/cache-stats-demo
git worktree add ../cache-stats-demo-wt -b project-test-wt
cd ../cache-stats-demo-wt && opencode run --title "Worktree test" "What is in this worktree?"
```

- [ ] Project count increases by one (worktrees share the project id)
- [ ] Removing the worktree and refreshing lowers the count again

### 2.4 Archived sessions are excluded

```bash
cd ~/Projects/cache-stats-demo
opencode run --archived --title "Archived test" "This session must stay out of totals."
```

- [ ] Project count does **not** change
- [ ] Archiving a visible session in the sidebar and pressing refresh lowers the count

### 2.5 Subagents roll up into the project

- [ ] In one project session, run a task that spawns a subagent (e.g. "review the diff")
- [ ] **Project → Agents** lists that subagent
- [ ] **Project → Summary** subagent count increases by one
- [ ] Re-running the same subagent does not double count

### 2.6 Live refresh while the project scope is visible

- [ ] Open **Project**, note the timestamp in the status chip
- [ ] In a terminal, continue one of the project's sessions:
      `opencode run --session <session-id> "Add a short comment to the code."`
- [ ] Within a few seconds the chip updates and the totals grow
- [ ] Press refresh while a run is in flight: the button shows busy, then stale is cleared

### 2.7 Truncation notice

The live limit is 60 sessions, which is impractical to reach manually. Verify it in a scratch build:

- [ ] Temporarily set `PROJECT_SESSION_LIMIT = 1` in `src/gui/data/project.ts`
- [ ] `npm run build`, restart Desktop, open Project
- [ ] The panel shows "1 most recent sessions" and totals cover only one session
- [ ] Revert the constant and rebuild

### 2.8 Session-only counter

- [ ] Under the hero hit rate, the "This session" line shows the routed session's own rate
- [ ] It stays the same when switching Project / Main + Subagents / Subagents
- [ ] It matches **Main Agent** for the same session

## 3. Remaining functional checks

- [ ] Scope labels read **Main + Subagents / Main Agent / Subagents / Project**
- [ ] All four views render for every scope, including empty states
- [ ] Copy as Markdown and JSON: whole selected scope, `Scope:` line says `project` for Project
- [ ] Copied report contains no prompt text, tool output, or compaction summary
- [ ] Pill: label, tone thresholds (90/70/40), row menu, click opens the panel
- [ ] `options.pill: false` in `opencode.json` hides only the pill
- [ ] Settings page persists pill, default scope (now includes Project), poll, debounce
- [ ] Stale path: make the server unreachable, refresh → previous numbers kept, chip says Stale
- [ ] Light and dark themes: bars and level colors remain distinguishable
- [ ] Narrow window (< 768 px): mobile panel view usable
- [ ] Large session (100+ steps): panel scrolls, refresh under ~2 s
- [ ] Panel opens with cached numbers in under 100 ms after the first collection

## 4. Install on another computer

The repo ships `dist/gui-experimental.cjs`, so no build is needed; the server part still
needs its SDK dependency at runtime.

```bash
git clone <repo-url> ~/Projects/opencode-cache-stats-gui
cd ~/Projects/opencode-cache-stats-gui
npm ci --omit=dev            # runtime deps for the server part only (skip with --omit=dev)
```

Then:

```bash
mkdir -p ~/.config/opencode/plugins
ln -sfn ~/Projects/opencode-cache-stats-gui ~/.config/opencode/plugins/cache-stats-gui
```

`~/.config/opencode/opencode.json` — absolute path, which is the form verified on 2.2.7:

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

- [ ] Fresh-machine install verified (clone, `npm ci --omit=dev`, absolute config path, reload)
- [ ] `opencode reload`, wait, then `opencode plugin list` shows the plugin
- [ ] Desktop restart loads the GUI
- [ ] `dist/` is committed and matches the current source

Optional future simplification: drop `src/index.ts` and rename the package to
`nmdra.cache-stats-gui`, so the GUI inherits the id from the package name and the plugin needs
no runtime dependencies at all. Verify first that a GUI-only local package is accepted by
Desktop 2.2.7.

## 5. Git

- [ ] Set an identity (none is configured globally):
      `git config user.name "Your Name"` and `git config user.email "you@example.com"`
- [ ] Review `git status` and the staged diff
- [ ] Commit the staged initial tree
- [ ] Tag `v0.1.0`
- [ ] Push `main` and the tag
- [ ] Capture the images described in `docs/image-assets.md`, then commit them
- [ ] Set the GitHub social preview to `assets/social-preview.png`

## 6. Known gaps and decisions

- [ ] Confirm `SessionInfo.projectID` groups worktrees together on 2.2.7 (test §2.3)
- [ ] Confirm the desktop store lists *all* project sessions, not only mounted ones (test §2.1)
- [ ] Project refresh listens to every session event while visible; confirm it is not noisy
- [ ] Decide whether the project limit of 60 is right for large projects
- [ ] `package.json` is `private: true`; remove it if you ever publish to npm
- [ ] The GUI API is experimental: re-pin `@opencode/plugin` and `@opencode/client` after every
      Desktop update, then re-run §1–§3
- [ ] Fill the gaps in `docs/acceptance-checklist.md` (AC-19, AC-23, AC-24…AC-72)

## 7. Ideas (not scheduled)

- [ ] Trend hover tooltip with model, hit, and tokens per point
- [ ] Sort Models by cost or tokens, not only hit rate
- [ ] Per-project comparison (this project vs another)
- [ ] Export to a file through `ctx.system.save` instead of the clipboard
