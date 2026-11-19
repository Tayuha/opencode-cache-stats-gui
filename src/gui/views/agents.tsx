import { For, Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { Scope, ScopeStats } from "../data/collect.ts"
import { shortModel, subRows } from "../derive.ts"
import { formatCost, formatHit, formatNumber, hitLevel } from "../format.ts"
import { Empty, HitBar, toneClass } from "../components.tsx"

export function Agents(props: { stats: ScopeStats; scope: Scope | "project"; onShowAll(): void }) {
  const ctx = usePlugin<typeof definition>()
  const rows = () => subRows(props.stats)

  return (
    <Show
      when={rows().length > 0}
      fallback={
        <Empty
          title={
            props.scope === "main" ? ctx.t("agents.empty.mainTitle") : ctx.t("agents.empty.title")
          }
          message={
            props.scope === "main" ? ctx.t("agents.empty.mainBody") : ctx.t("agents.empty.body")
          }
          actionLabel={props.scope === "main" ? ctx.t("agents.showAll") : undefined}
          onAction={props.scope === "main" ? props.onShowAll : undefined}
        />
      }
    >
      <div class="cs-rows">
        <span class="cs-note">{ctx.t("agents.note")}</span>
        <For each={rows()}>
          {(sub) => (
            <div class="cs-row">
              <div class="cs-row-head">
                <span class="cs-row-name" title={sub.name}>
                  {sub.name}
                </span>
                <span class={`cs-row-hit ${toneClass(hitLevel(sub.hit).level)}`}>
                  {formatHit(sub.hit)}
                </span>
              </div>
              <HitBar hit={sub.hit} class="cs-row-bar" />
              <div class="cs-row-detail">
                <span>{sub.model ? shortModel(sub.model) : ctx.t("agents.noModel")}</span>
                <span> · </span>
                <span>{formatCost(sub.cost)}</span>
              </div>
              <div class="cs-row-detail">
                {ctx.t("agents.requests", {
                  cached: sub.reqsWithCacheRead,
                  total: sub.reqs,
                  tokens: formatNumber(sub.tokens),
                })}
              </div>
              <div class="cs-row-detail" title={sub.id}>
                {sub.id}
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
