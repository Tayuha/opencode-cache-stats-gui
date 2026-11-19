import { For, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { ScopeStats } from "../data/collect.ts"
import { hitPct, tokenTotal } from "../data/stats.ts"
import { modelRows, providerOf, shortModel } from "../derive.ts"
import { formatCost, formatHit, formatNumber, hitLevel } from "../format.ts"
import { Empty, HitBar, toneClass } from "../components.tsx"

export function Models(props: { stats: ScopeStats }) {
  const ctx = usePlugin<typeof definition>()
  const rows = () => modelRows(props.stats)

  return (
    <Show
      when={rows().length > 0}
      fallback={<Empty title={ctx.t("models.empty.title")} message={ctx.t("models.empty.body")} />}
    >
      <div class="cs-rows">
        <For each={rows()}>
          {([model, acc]) => {
            const hit = () => hitPct(acc)
            const tone = () => hitLevel(hit()).level
            return (
              <div class="cs-row">
                <div class="cs-row-head">
                  <span class="cs-row-name" title={model}>
                    {shortModel(model)}
                  </span>
                  <span class={`cs-row-hit ${toneClass(tone())}`}>{formatHit(hit())}</span>
                </div>
                <HitBar hit={hit()} class="cs-row-bar" />
                <div class="cs-row-detail">
                  <span>{providerOf(model)}</span>
                  <span> · </span>
                  <span>{formatCost(acc.cost)}</span>
                </div>
                <div class="cs-row-detail">
                  {ctx.t("models.requests", {
                    reqs: acc.reqs,
                    tokens: formatNumber(tokenTotal(acc)),
                  })}
                </div>
              </div>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
