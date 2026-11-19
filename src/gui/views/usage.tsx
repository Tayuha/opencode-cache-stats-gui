import { Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { ScopeStats } from "../data/collect.ts"
import { tokenTotal, type Acc } from "../data/stats.ts"
import { formatCost, formatNumber, share } from "../format.ts"
import { Metric, Section } from "../components.tsx"

const TOKEN_ROWS = [
  ["token.input", "input"],
  ["token.cacheRead", "cacheRead"],
  ["token.cacheWrite", "cacheWrite"],
  ["token.output", "output"],
  ["token.reasoning", "reasoning"],
] as const

function TokenRows(props: { acc: Acc }) {
  const ctx = usePlugin<typeof definition>()
  return (
    <>
      {TOKEN_ROWS.map(([key, field]) => (
        <Metric
          label={ctx.t(key)}
          value={formatNumber(props.acc[field])}
          suffix={share(props.acc[field], tokenTotal(props.acc))}
        />
      ))}
      <Metric
        label={ctx.t("token.total")}
        value={formatNumber(tokenTotal(props.acc))}
        suffix={share(tokenTotal(props.acc), tokenTotal(props.acc))}
      />
    </>
  )
}

export function Usage(props: { stats: ScopeStats }) {
  const ctx = usePlugin<typeof definition>()
  const acc = () => props.stats.acc
  const compaction = () => props.stats.compaction

  return (
    <div>
      <Metric
        label={ctx.t("token.title")}
        value={ctx.t("token.value")}
        suffix={ctx.t("token.share")}
      />
      <TokenRows acc={acc()} />

      <Section title={ctx.t("usage.requests")}>
        <Metric
          label={ctx.t("usage.withRead")}
          value={`${acc().reqsWithCacheRead}/${acc().reqs}`}
          suffix={share(acc().reqsWithCacheRead, acc().reqs)}
        />
        <Metric
          label={ctx.t("usage.withoutRead")}
          value={String(acc().reqs - acc().reqsWithCacheRead)}
        />
      </Section>

      <Show when={acc().reqs > 0}>
        <Section title={ctx.t("usage.average")}>
          <Metric label={ctx.t("token.input")} value={formatNumber(acc().input / acc().reqs)} />
          <Metric
            label={ctx.t("token.cacheRead")}
            value={formatNumber(acc().cacheRead / acc().reqs)}
          />
          <Metric label={ctx.t("token.output")} value={formatNumber(acc().output / acc().reqs)} />
          <Metric label={ctx.t("metric.cost")} value={formatCost(acc().cost / acc().reqs)} />
        </Section>
      </Show>

      <Section title={ctx.t("usage.cost")} detail={ctx.t("usage.costDetail")}>
        <Metric label={ctx.t("usage.assistant")} value={formatCost(acc().cost)} />
        <Show when={compaction().count > 0}>
          <Metric label={ctx.t("usage.compaction")} value={formatCost(compaction().cost)} />
          <Metric
            label={ctx.t("usage.combined")}
            value={formatCost(acc().cost + compaction().cost)}
          />
        </Show>
      </Section>

      <Show when={compaction().count > 0}>
        <Section
          title={ctx.t("usage.compaction")}
          detail={ctx.t("usage.compactionDetail", { count: compaction().reqs })}
        >
          <TokenRows acc={compaction()} />
        </Section>
      </Show>
    </div>
  )
}
