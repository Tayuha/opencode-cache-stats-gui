import type { Collected, Scope } from "./data/collect.ts"
import { hitPct, sanitize, tokenTotal, type Acc } from "./data/stats.ts"

const MAX_REPORT_BYTES = 256 * 1024

function usage(acc: Acc) {
  const hit = hitPct(acc)
  return { ...acc, totalTokens: tokenTotal(acc), hitPercent: hit < 0 ? null : hit }
}

/** The exported shape: metadata and aggregates only, never prompts or tool output. */
export function buildReport(stats: Collected, scope: Scope, stale = false, scopeLabel: string = scope) {
  const selected = scope === "all" ? stats : stats.scopes[scope]
  return {
    version: 1,
    session: { id: stats.sessionID, title: stats.title },
    scope,
    scopeLabel,
    capturedAt: new Date(stats.updatedAt).toISOString(),
    stale,
    currency: "USD",
    assistant: usage(selected.acc),
    compaction: usage(selected.compaction),
    recordedCost: selected.acc.cost + selected.compaction.cost,
    models: [...selected.perModel]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([model, acc]) => ({ model, ...usage(acc) })),
    recent: selected.recent.map(({ id, sessionID, at, model, usage: acc }) => ({
      id,
      sessionID,
      at,
      model,
      ...usage(acc),
    })),
    subagents: selected.subs.map((sub) => ({ ...sub, hit: sub.hit < 0 ? null : sub.hit })),
  }
}

function cell(value: string): string {
  return sanitize(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\|`*_[\]]/g, "\\$&")
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)}%`
}

export function markdownReport(stats: Collected, scope: Scope, stale = false, scopeLabel?: string): string {
  const report = buildReport(stats, scope, stale, scopeLabel)
  const acc = report.assistant
  const compaction = report.compaction
  return [
    "# Cache stats",
    "",
    `Session: ${cell(report.session.title)} (${cell(report.session.id)})`,
    `Scope: ${report.scopeLabel} · Captured: ${report.capturedAt}${stale ? " · STALE: refresh failed" : ""}`,
    "",
    "| Metric | Assistant | Compaction |",
    "| --- | ---: | ---: |",
    `| Recorded steps | ${acc.reqs} | ${compaction.reqs} |`,
    `| Steps without usage | ${acc.count - acc.reqs} | ${compaction.count - compaction.reqs} |`,
    `| Cache hit | ${pct(acc.hitPercent)} | ${pct(compaction.hitPercent)} |`,
    `| Fresh input | ${acc.input} | ${compaction.input} |`,
    `| Cache read | ${acc.cacheRead} | ${compaction.cacheRead} |`,
    `| Cache write | ${acc.cacheWrite} | ${compaction.cacheWrite} |`,
    `| Output | ${acc.output} | ${compaction.output} |`,
    `| Reasoning | ${acc.reasoning} | ${compaction.reasoning} |`,
    `| Total tokens | ${acc.totalTokens} | ${compaction.totalTokens} |`,
    `| Recorded cost (USD) | $${acc.cost.toFixed(5)} | $${compaction.cost.toFixed(5)} |`,
    "",
    "## Assistant models",
    "",
    "| Model | Requests | Cache hit | Tokens | USD |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...report.models.map(
      (model) =>
        `| ${cell(model.model)} | ${model.reqs} | ${pct(model.hitPercent)} | ${model.totalTokens} | ${model.cost.toFixed(5)} |`,
    ),
    "",
    "## Recent assistant requests (oldest → newest)",
    "",
    "| Model | Cache hit | Tokens |",
    "| --- | ---: | ---: |",
    ...report.recent.map(
      (sample) => `| ${cell(sample.model)} | ${pct(sample.hitPercent)} | ${sample.totalTokens} |`,
    ),
    "",
    "## Subagents (subtree totals; rows may overlap)",
    "",
    "| Agent | Session | Requests | Cache hit | Tokens | USD |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...report.subagents.map(
      (sub) =>
        `| ${cell(sub.name)} | ${cell(sub.id)} | ${sub.reqs} | ${pct(sub.hit)} | ${sub.tokens} | ${sub.cost.toFixed(5)} |`,
    ),
    "",
    "Requests count recorded assistant steps, not retry attempts. Compaction is separate. Title and other auxiliary calls are excluded.",
  ].join("\n")
}

export function jsonReport(stats: Collected, scope: Scope, stale = false, scopeLabel?: string): string {
  return JSON.stringify(buildReport(stats, scope, stale, scopeLabel), null, 2)
}

export type ReportTarget = {
  copy(text: string): Promise<void>
  notify(input: { variant: "success" | "error"; description?: string }): void
}

export async function copyReport(
  target: ReportTarget,
  stats: Collected,
  scope: Scope,
  format: "markdown" | "json",
  stale = false,
  scopeLabel?: string,
): Promise<boolean> {
  try {
    const text =
      format === "json"
        ? jsonReport(stats, scope, stale, scopeLabel)
        : markdownReport(stats, scope, stale, scopeLabel)
    if (new TextEncoder().encode(text).length > MAX_REPORT_BYTES) throw new Error("Report too large")
    await target.copy(text)
    target.notify({ variant: "success", description: format === "json" ? "JSON" : "Markdown" })
    return true
  } catch {
    target.notify({ variant: "error", description: format })
    return false
  }
}
