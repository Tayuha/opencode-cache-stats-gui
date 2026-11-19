import { selectScope, type Collected, type Scope, type ScopeStats, type Sub } from "./data/collect.ts"
import { hitPct, sanitize, type Acc } from "./data/stats.ts"

export type ModelRow = readonly [model: string, acc: Acc]

/** The scope's totals, unchanged; `all` is the collected value itself. */
export function scopeStats(stats: Collected, scope: Scope): ScopeStats {
  return selectScope(stats, scope)
}

/** Models with recorded usage, healthiest first, then busiest. */
export function modelRows(stats: ScopeStats): ModelRow[] {
  return [...stats.perModel].sort((a, b) => hitPct(b[1]) - hitPct(a[1]) || b[1].reqs - a[1].reqs)
}

/** Subagents with subtree totals, healthiest first, then busiest. */
export function subRows(stats: ScopeStats): Sub[] {
  return [...stats.subs].sort((a, b) => b.hit - a.hit || b.reqs - a.reqs)
}

export function shortModel(model: string): string {
  return sanitize(model.slice(model.indexOf("/") + 1))
}

export function providerOf(model: string): string {
  const index = model.indexOf("/")
  return index < 0 ? model : model.slice(0, index)
}
