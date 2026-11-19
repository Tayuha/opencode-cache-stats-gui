# Security policy

## Supported versions

Only the latest commit on `main` is supported. This plugin is version-coupled to OpenCode
Desktop 2.2.7 through `@opencode/plugin` and `@opencode/client`; fixes are made against the
current pin.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private advisory form:

**https://github.com/Tayuha/opencode-cache-stats-gui/security/advisories/new**

Include:

- the commit or version affected, and your OpenCode Desktop version;
- reproduction steps, or a minimal session/workspace that triggers it;
- the impact you expect, and whether the flaw is in this plugin, its build, or an upstream
  dependency.

Expect an acknowledgement within 7 days and a status update within 30. This is a personal
project maintained in spare time; there is no bounty programme.

## Scope

In scope:

- `src/` — the GUI, the data layer, and the server part that declares the plugin id;
- `dist/gui-experimental.cjs` — the shipped bundle must match a fresh build;
- packaging and install steps (`package.json` exports, `vite.config.ts`, `opencode.json` wiring).

Out of scope:

- OpenCode Desktop or the OpenCode server — report those to the OpenCode project;
- vulnerabilities in `@opencode/plugin`, `effect`, `solid-js`, or other upstream packages —
  report them upstream; this repository will adopt the fix when it is available;
- attacks that require a local user who can already edit the checkout, the OpenCode
  configuration, or the plugin bundle.

## What the plugin can access

- Read-only server calls: `session.get`, `session.list`, `message.list`. No create, prompt,
  mutate, delete, or fork calls.
- No network egress: no `fetch`, WebSocket, HTTP client, telemetry, or external URL in the
  source or the bundle.
- No credentials of its own.
- Reports are produced only when the user asks, and are written to the clipboard. They contain
  session IDs, titles, per-model and per-subagent aggregates, token counts, and costs — never
  prompts, tool output, or compaction summaries.

## Controls in place

- GitHub secret scanning and push protection are enabled.
- Dependabot alerts are enabled.
- CI on every push and pull request runs: typecheck, tests, `npm audit --audit-level=high`, a
  build, and a `git diff --exit-code -- dist` check that the committed bundle matches `src/`.

## Handling a report

Confirmed issues are fixed on `main` with tests where practical, a new tag, and a note in the
commit message. Reporters are credited unless they ask otherwise.
