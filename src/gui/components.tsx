import { For, Show, type JSX } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition.ts"
import type { RequestSample } from "./data/stats.ts"
import { formatHit, hitLevel, recentWindow, type HitLevel } from "./format.ts"

export function toneClass(level: HitLevel): string {
  return `cs-tone-${level}`
}

export function Metric(props: {
  label: string
  value: string
  suffix?: string
  tone?: HitLevel
}) {
  return (
    <div class="cs-metric" data-three={props.suffix !== undefined ? "true" : undefined}>
      <span class="cs-metric-label">{props.label}</span>
      <span class="cs-metric-value" classList={{ [toneClass(props.tone ?? "muted")]: !!props.tone }}>
        {props.value}
      </span>
      <Show when={props.suffix !== undefined}>
        <span class="cs-metric-suffix">{props.suffix}</span>
      </Show>
    </div>
  )
}

export function Section(props: { title: string; detail?: string; children: JSX.Element }) {
  return (
    <div class="cs-section">
      <div class="cs-section-head">
        <span class="cs-section-title">{props.title}</span>
        <Show when={props.detail}>
          <span class="cs-section-detail">· {props.detail}</span>
        </Show>
      </div>
      {props.children}
    </div>
  )
}

export function HitBar(props: { hit: number; class?: string }) {
  const width = () => (props.hit < 0 ? 0 : Math.max(0, Math.min(100, props.hit)))
  return (
    <div
      class={`cs-bar ${props.class ?? ""}`}
      data-unknown={props.hit < 0 ? "true" : undefined}
      role="img"
      aria-label={formatHit(props.hit)}
    >
      <div class="cs-bar-fill" style={{ width: `${width()}%` }} />
      <div class="cs-bar-miss" style={{ "flex-grow": 1 }} />
    </div>
  )
}

export function Empty(props: {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const ctx = usePlugin<typeof definition>()
  return (
    <div class="cs-empty">
      <span class="cs-empty-title">{props.title}</span>
      <span class="cs-empty-body">{props.message}</span>
      <Show when={props.actionLabel && props.onAction}>
        <ctx.ui.Button
          variant="ghost"
          size="small"
          class="cs-empty-action"
          onClick={() => props.onAction?.()}
        >
          {props.actionLabel}
        </ctx.ui.Button>
      </Show>
    </div>
  )
}

export function Trend(props: {
  samples: readonly RequestSample[]
  oldest: string
  newest: string
  title(count: number): string
  detail(hit: string): string
}) {
  const window = () => recentWindow(props.samples)
  return (
    <div class="cs-section">
      <div class="cs-section-head">
        <span class="cs-section-title">{props.title(window().samples.length)}</span>
        <span class="cs-section-detail">· {props.detail(formatHit(window().hit))}</span>
      </div>
      <div class="cs-trend" role="img" aria-label={`${formatHit(window().hit)} across the last ${window().samples.length} requests`}>
        <For each={window().samples}>
          {(sample) => {
            const hit = () => (sample.usage.input + sample.usage.cacheRead > 0
              ? (100 * sample.usage.cacheRead) / (sample.usage.input + sample.usage.cacheRead)
              : -1)
            return (
              <div
                class="cs-trend-bar"
                data-tone={hitLevel(hit()).level}
                title={`${formatHit(hit())} · ${sample.model}`}
                style={{ height: `${Math.max(8, hit() < 0 ? 8 : hit())}%` }}
              />
            )
          }}
        </For>
      </div>
      <div class="cs-trend-axis">
        <span>{props.oldest}</span>
        <span>{props.newest}</span>
      </div>
    </div>
  )
}
