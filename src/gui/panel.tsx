import { createEffect, createMemo, createSignal, on, onCleanup, Show, Switch, Match } from "solid-js"
import { usePlugin, type MountedSession, type PanelTab } from "@opencode/plugin/gui"
import type { definition } from "./definition.ts"
import type { Collected, Scope, ScopeStats } from "./data/collect.ts"
import { hitPct, summarize, tokenTotal } from "./data/stats.ts"
import { affectedSessions, type LiveStats, type LiveState } from "./data/live.ts"
import {
  limitSessions,
  projectLabel,
  projectSessions,
  PROJECT_SESSION_LIMIT,
  type ProjectStats,
  type ProjectStatsCache,
} from "./data/project.ts"
import { hostFor } from "./host.ts"
import { latestRequest, scopeStats } from "./derive.ts"
import { copyReport } from "./report.ts"
import {
  formatHit,
  hitLevel,
  missLabel,
  SCOPES,
  VIEWS,
  type StatsView,
} from "./format.ts"
import { HitBar, toneClass } from "./components.tsx"
import { Summary } from "./views/summary.tsx"
import { Models } from "./views/models.tsx"
import { Usage } from "./views/usage.tsx"
import { Agents } from "./views/agents.tsx"
import { Help } from "./views/help.tsx"

export type PanelScope = Scope | "project"

export type CacheStatsPanelProps = {
  session: MountedSession
  tab: PanelTab
  live: LiveStats
  projects: ProjectStatsCache
}

export function CacheStatsPanel(props: CacheStatsPanelProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui

  const [state, setState] = createSignal<LiveState>({ loading: false, stale: false })
  const [scope, setScope] = createSignal<PanelScope>(ctx.stores.prefs.value.defaultScope)
  const [view, setView] = createSignal<StatsView>("summary")
  const [helpReturn, setHelpReturn] = createSignal<StatsView>("summary")
  let stop: (() => void) | undefined

  // Read the server from the live session: a restarted server brings a new client and data store.
  const host = () => hostFor(props.session)

  createEffect(
    on(
      () => [props.session.server.id, props.session.id, props.session.pending] as const,
      () => {
        stop?.()
        stop = undefined
        if (props.session.pending) return
        stop = props.live.watch(host(), props.session.id, setState)
      },
    ),
  )
  onCleanup(() => stop?.())

  const project = createMemo(() => {
    if (props.session.pending) return undefined
    const reader = props.session.server.data.session
    try {
      const projectID = reader.get(props.session.id).projectID
      const limited = limitSessions(projectSessions(reader, props.session.id))
      return {
        projectID,
        ids: limited.ids,
        truncated: limited.truncated,
        name: projectLabel(
          props.session.project?.name,
          props.session.project?.worktree ?? props.session.directory,
        ),
      }
    } catch {
      return undefined
    }
  })

  const projectState = () => {
    const info = project()
    return info ? props.projects.peek(info.projectID) : undefined
  }

  // Lazy: project totals are collected the first time this scope is shown.
  createEffect(
    on(
      () => [scope(), project()?.projectID, project()?.ids.length] as const,
      () => {
        if (scope() !== "project") return
        const info = project()
        if (!info || info.ids.length === 0) return
        props.projects.ensure(
          { projectID: info.projectID, client: props.session.server.client },
          info.ids,
          info.truncated,
        )
      },
    ),
  )

  // While the project scope is visible, any step or usage event re-collects it (debounced).
  createEffect(
    on(
      () => (scope() === "project" ? props.session.server.data : undefined),
      (store) => {
        if (!store) return
        let timer: ReturnType<typeof setTimeout> | undefined
        const unsubscribe = store.listen(({ details }) => {
          if (affectedSessions(details) === undefined) return
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            timer = undefined
            const info = project()
            if (!info) return
            void props.projects.refresh(
              { projectID: info.projectID, client: props.session.server.client },
              info.ids,
              info.truncated,
            )
          }, 750)
        })
        onCleanup(() => {
          if (timer) clearTimeout(timer)
          unsubscribe()
        })
      },
    ),
  )

  const snapshot = () => state().stats
  const selected = createMemo<ScopeStats | undefined>(() => {
    if (scope() === "project") return projectState()?.stats
    const stats = snapshot()
    return stats ? scopeStats(stats, scope() as Scope) : undefined
  })

  // Reconciles this panel with the context-window readout: the newest request, against its model limit.
  const latest = createMemo(() => {
    const stats = selected()
    const sample = stats ? latestRequest(stats) : undefined
    if (!sample) return undefined
    const cut = sample.model.indexOf("/")
    const providerID = cut < 0 ? sample.model : sample.model.slice(0, cut)
    const modelID = cut < 0 ? "" : sample.model.slice(cut + 1)
    const models = props.session.server.data.location.model.list(props.session.location)
    const model = models?.find(
      (item) => item.providerID === providerID && (item.modelID === modelID || item.id === modelID),
    )
    return { tokens: tokenTotal(sample.usage), limit: model?.limit.context }
  })

  const hit = () => (selected() ? hitPct(selected()!.acc) : -1)
  const tone = () => hitLevel(hit()).level
  const sessionTitle = () => snapshot()?.title ?? ""
  const sessionHit = () => (snapshot() ? hitPct(snapshot()!.scopes.main.acc) : -1)
  const busy = () => (scope() === "project" ? !!projectState()?.loading : state().loading)

  const status = () => {
    if (scope() === "project") {
      const current = projectState()
      if (!current) return ctx.t("status.refreshing")
      if (current.loading) {
        return current.stale ? ctx.t("status.retrying") : ctx.t("status.refreshing")
      }
      if (current.stale) return ctx.t("status.stale")
      const time = new Date(current.updatedAt).toLocaleTimeString(ctx.locale.locale(), { hour12: false })
      return ctx.t("status.live", { time })
    }

    const current = state()
    if (current.loading) {
      return current.stale ? ctx.t("status.retrying") : ctx.t("status.refreshing")
    }
    if (current.stale) return ctx.t("status.stale")
    const stats = current.stats
    if (!stats) return ctx.t("status.refreshing")
    const time = new Date(stats.updatedAt).toLocaleTimeString(ctx.locale.locale(), { hour12: false })
    return ctx.t("status.live", { time })
  }

  const refresh = () => {
    if (scope() === "project") {
      const info = project()
      if (!info) return
      void props.projects.refresh(
        { projectID: info.projectID, client: props.session.server.client },
        info.ids,
        info.truncated,
      )
      return
    }
    void props.live.refresh(host(), props.session.id)
  }

  const showHelp = () => {
    if (view() === "help") {
      setView(helpReturn())
      return
    }
    setHelpReturn(view())
    setView("help")
  }

  const reportStats = (): Collected | undefined => {
    if (scope() !== "project") return snapshot()
    const stats = projectState()?.stats
    const info = project()
    if (!stats || !info) return undefined
    const empty = summarize([])
    return {
      ...stats,
      sessionID: `project:${info.projectID}`,
      sessionIDs: info.ids,
      title: info.name,
      updatedAt: projectState()?.updatedAt ?? Date.now(),
      scopes: {
        main: { ...stats, subagents: 0, subs: [] },
        subagents: { ...empty, subagents: stats.subagents, subs: stats.subs },
      },
    }
  }

  const copy = (format: "markdown" | "json") => {
    const stats = reportStats()
    if (!stats) return
    const label = format === "json" ? "JSON" : "Markdown"
    void copyReport(
      {
        copy: (text) => ctx.system.copy(text),
        notify: ({ variant }) => {
          ctx.toast.show({
            variant,
            title: ctx.t("panel.title"),
            description:
              variant === "success"
                ? ctx.t("toast.copied", { format: label })
                : ctx.t("toast.copyFailed", { format: label }),
          })
        },
      },
      stats,
      scope() === "project" ? "all" : (scope() as Scope),
      format,
      scope() === "project" ? !!projectState()?.stale : state().stale,
      scope() === "project" ? "project" : scope(),
    )
  }

  return (
    <div class="cs" data-mode={ctx.appearance.mode()}>
      <div class="cs-head">
        <div class="cs-title-row">
          <ctx.ui.Icon name="window-analytics" size="small" />
          <span class="cs-title">{ctx.t("panel.title")}</span>
          <Show when={sessionTitle()}>
            <span class="cs-session-title" title={sessionTitle()}>
              {sessionTitle()}
            </span>
          </Show>
          <span
            class="cs-chip"
            data-stale={
              (scope() === "project" ? !!projectState()?.stale : state().stale) ? "true" : undefined
            }
          >
            {status()}
          </span>
          <div class="cs-actions">
            <ui.Tooltip value={ctx.t("action.refresh")}>
              <ui.IconButton
                icon="outline-rotate-clockwise"
                label={ctx.t("action.refresh")}
                size="small"
                busy={busy()}
                onClick={refresh}
              />
            </ui.Tooltip>
            <ui.Menu
              label={ctx.t("action.copy")}
              icon="copy"
              disabled={!selected()}
              items={[
                { label: ctx.t("action.copyMarkdown"), onSelect: () => copy("markdown") },
                { label: ctx.t("action.copyJson"), onSelect: () => copy("json") },
              ]}
            />
            <ui.IconButton
              icon="help"
              label={ctx.t("action.help")}
              size="small"
              pressed={view() === "help"}
              onClick={showHelp}
            />
          </div>
        </div>

        <div class="cs-switch" role="group" aria-label={ctx.t("aria.scope")}>
          {SCOPES.map((value) => (
            <button
              type="button"
              data-active={scope() === value ? "true" : undefined}
              aria-pressed={scope() === value}
              onClick={() => setScope(value)}
            >
              {ctx.t(`scope.${value}`)}
            </button>
          ))}
        </div>

        <div class="cs-switch" role="group" aria-label={ctx.t("aria.view")}>
          {VIEWS.map((value) => (
            <button
              type="button"
              data-active={view() === value ? "true" : undefined}
              aria-pressed={view() === value}
              onClick={() => setView(value)}
            >
              {ctx.t(`view.${value}`)}
            </button>
          ))}
        </div>

        <div class="cs-hero">
          <div class="cs-hero-row">
            <span class={`cs-hero-value ${toneClass(tone())}`}>{formatHit(hit())}</span>
            <span class={`cs-hero-word ${toneClass(tone())}`}>{ctx.t(`level.${tone()}`)}</span>
            <span class="cs-hero-detail">
              {scope() === "project" && selected()
                ? ctx.t("project.sessions", { count: (selected() as ProjectStats).sessions })
                : ctx.t("hero.cached")}
            </span>
            <span class="cs-hero-miss">{missLabel(hit())}</span>
          </div>
          <HitBar hit={hit()} />
          <Show when={scope() !== "main" && snapshot()}>
            <div class="cs-session-line">
              <span class="cs-note">{ctx.t("hero.thisSession")}</span>
              <span class={toneClass(hitLevel(sessionHit()).level)}>{formatHit(sessionHit())}</span>
            </div>
          </Show>
        </div>
        <hr class="cs-divider" />
      </div>

      <div class="cs-body">
        <Show
          when={selected()}
          fallback={
            <Switch>
              <Match when={scope() === "project" && project() && project()!.ids.length === 0}>
                <div class="cs-empty">
                  <span class="cs-empty-title">{ctx.t("project.empty")}</span>
                </div>
              </Match>
              <Match when={state().stale || projectState()?.stale}>
                <div class="cs-empty">
                  <span class="cs-empty-title">{ctx.t("empty.noUsageTitle")}</span>
                  <span class="cs-empty-body">{ctx.t("status.stale")}</span>
                  <ctx.ui.Button variant="ghost" size="small" onClick={refresh}>
                    {ctx.t("action.refresh")}
                  </ctx.ui.Button>
                </div>
              </Match>
              <Match when={true}>
                <ui.Loader size="small" />
              </Match>
            </Switch>
          }
        >
          <Show when={scope() === "project" && project()?.truncated}>
            <span class="cs-note">
              {ctx.t("project.truncated", { count: PROJECT_SESSION_LIMIT })}
            </span>
          </Show>
          <Switch>
            <Match when={view() === "summary"}>
              <Summary stats={selected()!} scope={scope()} latest={latest()} />
            </Match>
            <Match when={view() === "models"}>
              <Models stats={selected()!} />
            </Match>
            <Match when={view() === "usage"}>
              <Usage stats={selected()!} />
            </Match>
            <Match when={view() === "agents"}>
              <Agents stats={selected()!} scope={scope()} onShowAll={() => setScope("all")} />
            </Match>
            <Match when={view() === "help"}>
              <Help />
            </Match>
          </Switch>
        </Show>
      </div>
    </div>
  )
}
