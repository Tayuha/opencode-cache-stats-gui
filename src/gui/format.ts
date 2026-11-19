import { hitPct, mergeAcc, newAcc, RECENT_LIMIT, type Acc, type RequestSample } from "./data/stats.ts"

export const VIEWS = ["summary", "models", "usage", "agents"] as const
export type StatsView = (typeof VIEWS)[number] | "help"

export const SCOPES = ["all", "main", "subagents", "project"] as const

export function nextView(view: StatsView, direction = 1): StatsView {
  const index = VIEWS.findIndex((item) => item === view)
  if (index < 0) return direction < 0 ? VIEWS[VIEWS.length - 1]! : VIEWS[0]!
  return VIEWS[(index + direction + VIEWS.length) % VIEWS.length]!
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—"
  if (value > 0 && value < 1) return value < 0.01 ? "<0.01" : value.toFixed(2)
  const rounded = Math.round(value)
  if (rounded >= 999_950) return `${(rounded / 1e6).toFixed(2)}M`
  if (rounded >= 1_000) return `${(rounded / 1e3).toFixed(1)}K`
  return String(rounded)
}

export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "—"
  if (value === 0) return "$0.00"
  if (value < 0.00001) return "<$0.00001"
  if (value < 0.01) return `$${value.toFixed(5)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatHit(value: number): string {
  return value < 0 ? "n/a" : `${value.toFixed(1)}%`
}

export type HitLevel = "muted" | "success" | "info" | "warning" | "error"

export function hitLevel(hit: number): { level: HitLevel; word: string } {
  if (hit < 0) return { level: "muted", word: "No rate" }
  if (hit >= 90) return { level: "success", word: "Excellent" }
  if (hit >= 70) return { level: "info", word: "Good" }
  if (hit >= 40) return { level: "warning", word: "Fair" }
  return { level: "error", word: "Poor" }
}

export function share(part: number, total: number): string {
  return total > 0 ? `${((100 * part) / total).toFixed(1)}%` : "—"
}

/** The trend keeps one point per request, at most RECENT_LIMIT, and never denser than the width allows. */
export function recentWindow(samples: readonly RequestSample[], limit = RECENT_LIMIT) {
  const count = Math.max(1, Math.min(RECENT_LIMIT, Math.floor(limit)))
  const visible = samples.slice(-count)
  const acc = newAcc()
  for (const sample of visible) mergeAcc(acc, sample.usage)
  return { samples: visible, hit: hitPct(acc) }
}

export function missLabel(hit: number): string {
  return hit < 0 ? "no usage" : `${formatHit(100 - hit)} miss`
}
