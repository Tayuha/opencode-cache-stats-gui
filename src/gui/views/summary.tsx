import { Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { Scope, ScopeStats } from "../data/collect.ts"
import { hitPct, tokenTotal } from "../data/stats.ts"
import { formatCost, formatNumber } from "../format.ts"
import { Empty, Metric, Trend } from "../components.tsx"

export function Summary(props: { stats: ScopeStats; scope: Scope | "project" }) {
  const ctx = usePlugin<typeof definition>()
  const acc = () => props.stats.acc

  return (
    <Show
      when={acc().reqs > 0}
      fallback={
        <Empty
          title={acc().count > 0 ? ctx.t("empty.waitingTitle") : ctx.t("empty.noUsageTitle")}
          message={
            props.scope === "subagents" && props.stats.subagents === 0
              ? ctx.t("empty.subagentHint")
              : props.scope === "project"
                ? ctx.t("project.empty")
              : acc().count > 0
                ? ctx.t("empty.waitingBody")
                : ctx.t("empty.noUsageBody")
          }
        />
      }
    >
      <div class="cs-section">
        <span class="cs-note">{ctx.t("summary.assistant")}</span>
        <Metric label={ctx.t("metric.requests")} value={String(acc().reqs)} />
        <Metric label={ctx.t("metric.models")} value={String(props.stats.perModel.size)} />
        <Metric label={ctx.t("metric.subagents")} value={String(props.stats.subagents)} />
        <Metric
          label={ctx.t("metric.tokens")}
          value={formatNumber(tokenTotal(acc()))}
          tone="info"
        />
        <Metric
          label={ctx.t("metric.cacheRead")}
          value={formatNumber(acc().cacheRead)}
          tone="success"
        />
        <Metric label={ctx.t("metric.cost")} value={formatCost(acc().cost)} />
      </div>

      <Trend
        samples={props.stats.recent}
        oldest={ctx.t("recent.oldest")}
        newest={ctx.t("recent.newest")}
        title={(count) => ctx.t("recent.title", { count })}
        detail={(hit) => ctx.t("recent.detail", { hit })}
      />

      <Show when={props.stats.compaction.count > 0}>
        <div class="cs-section">
          <Metric
            label={ctx.t("summary.compaction")}
            value={formatCost(props.stats.compaction.cost)}
            tone="warning"
          />
        </div>
      </Show>
    </Show>
  )
}
