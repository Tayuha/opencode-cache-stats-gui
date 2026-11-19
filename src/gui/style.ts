/** Injected once while the plugin is active. Everything is scoped under `.cs`. */
export const styles = `
.cs {
  --cs-success: #157f3b;
  --cs-warning: #a35b00;
  --cs-danger: #b3261e;
  --cs-info: #1a5fb4;
  --cs-muted: color-mix(in oklab, currentColor 62%, transparent);
  --cs-border: color-mix(in oklab, currentColor 16%, transparent);
  --cs-track: color-mix(in oklab, currentColor 10%, transparent);
  --cs-surface: color-mix(in oklab, currentColor 5%, transparent);
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 10px 12px 12px;
  font-size: 12px;
  line-height: 1.45;
  box-sizing: border-box;
}
.cs[data-mode="dark"] {
  --cs-success: #4ade80;
  --cs-warning: #fbbf24;
  --cs-danger: #f87171;
  --cs-info: #60a5fa;
}
.cs-tone-success { color: var(--cs-success); }
.cs-tone-warning { color: var(--cs-warning); }
.cs-tone-danger  { color: var(--cs-danger); }
.cs-tone-info    { color: var(--cs-info); }
.cs-tone-muted   { color: var(--cs-muted); }

.cs-head { display: flex; flex-direction: column; gap: 6px; flex: none; }
.cs-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.cs-title { font-weight: 600; flex: none; }
.cs-session-title {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--cs-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-chip {
  flex: none;
  border: 1px solid var(--cs-border);
  border-radius: 999px;
  padding: 0 7px;
  font-size: 11px;
  color: var(--cs-muted);
  white-space: nowrap;
}
.cs-chip[data-stale="true"] { color: var(--cs-warning); border-color: var(--cs-warning); }
.cs-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.cs-switch { display: flex; flex-wrap: wrap; gap: 4px; }
.cs-switch button {
  all: unset;
  cursor: pointer;
  border: 1px solid var(--cs-border);
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 11px;
  color: var(--cs-muted);
  background: transparent;
}
.cs-switch button:hover { color: inherit; background: var(--cs-surface); }
.cs-switch button[data-active="true"] {
  color: inherit;
  border-color: color-mix(in oklab, currentColor 40%, transparent);
  background: var(--cs-surface);
  font-weight: 600;
}
.cs-switch button:focus-visible { outline: 2px solid var(--cs-info); outline-offset: 1px; }

.cs-hero { display: flex; flex-direction: column; gap: 4px; flex: none; }
.cs-hero-row { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.cs-hero-value { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
.cs-hero-word { font-weight: 600; }
.cs-hero-detail { color: var(--cs-muted); flex: 1 1 auto; min-width: 0; }
.cs-hero-miss { color: var(--cs-muted); white-space: nowrap; }
.cs-session-line { display: flex; align-items: baseline; gap: 5px; font-size: 11px; }
.cs-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--cs-track);
}
.cs-bar-fill { background: var(--cs-success); }
.cs-bar-miss { background: color-mix(in oklab, var(--cs-danger) 70%, transparent); }
.cs-bar[data-unknown="true"] .cs-bar-miss { background: var(--cs-track); }

.cs-divider { border: 0; border-top: 1px solid var(--cs-border); margin: 0; flex: none; }

.cs-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
.cs-body::-webkit-scrollbar { width: 8px; }
.cs-body::-webkit-scrollbar-thumb { background: var(--cs-track); border-radius: 999px; }

.cs-metric {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 8px;
}
.cs-metric-label { color: var(--cs-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-metric-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.cs-metric-suffix {
  color: var(--cs-muted);
  font-variant-numeric: tabular-nums;
  min-width: 46px;
  text-align: right;
}
.cs-metric[data-three="true"] { grid-template-columns: minmax(0, 1fr) auto 46px; }

.cs-section { display: flex; flex-direction: column; gap: 3px; margin-top: 10px; }
.cs-section:first-child { margin-top: 0; }
.cs-section-head { display: flex; align-items: baseline; gap: 6px; }
.cs-section-title { font-weight: 600; }
.cs-section-detail { color: var(--cs-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-note { color: var(--cs-muted); }

.cs-trend { display: flex; align-items: flex-end; gap: 2px; height: 30px; margin: 2px 0 1px; }
.cs-trend-bar { flex: 1 1 0; min-width: 2px; border-radius: 2px 2px 0 0; background: var(--cs-muted); opacity: 0.85; }
.cs-trend-bar[data-tone="success"] { background: var(--cs-success); }
.cs-trend-bar[data-tone="info"] { background: var(--cs-info); }
.cs-trend-bar[data-tone="warning"] { background: var(--cs-warning); }
.cs-trend-bar[data-tone="danger"] { background: var(--cs-danger); }
.cs-trend-axis { display: flex; justify-content: space-between; color: var(--cs-muted); font-size: 10px; }

.cs-rows { display: flex; flex-direction: column; gap: 10px; }
.cs-row { display: flex; flex-direction: column; gap: 1px; }
.cs-row-head { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.cs-row-name { flex: 1 1 auto; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-row-hit { flex: none; font-weight: 600; font-variant-numeric: tabular-nums; }
.cs-row-bar { height: 4px; margin-top: 3px; }
.cs-row-detail { color: var(--cs-muted); }

.cs-empty { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; }
.cs-empty-title { font-weight: 600; }
.cs-empty-body { color: var(--cs-muted); }

.cs-help { display: flex; flex-direction: column; gap: 4px; }
.cs-help-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.cs-help-row > span:first-child { color: var(--cs-muted); }
`

/** Colors are chosen to work in both themes; the host supplies the base text color. */
export function toneAttr(level: string): string {
  return level
}
