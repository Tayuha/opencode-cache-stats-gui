import { createEffect, on, onCleanup } from "solid-js"
import {
  Command,
  ComposerPill,
  createKeyed,
  MenuItem,
  Panel,
  SettingsPage,
  Style,
  usePlugin,
  type PanelTab,
  type Plugin,
  type ComposerPill as ComposerPillItem,
  type MenuItem as MenuItemEntry,
  type SessionRef,
} from "@opencode/plugin/gui"
import { definition, type Prefs } from "./definition.ts"
import { createLiveStats } from "./data/live.ts"
import { createProjectStats } from "./data/project.ts"
import { hostFor } from "./host.ts"
import { formatCost, formatHit, formatNumber, hitLevel } from "./format.ts"
import { hitPct } from "./data/stats.ts"
import { styles } from "./style.ts"
import { CacheStatsPanel } from "./panel.tsx"
import type { Scope } from "./data/collect.ts"
import type { PanelScope } from "./panel.tsx"

const TAB_ID = "stats"

function CacheStatsSettings() {
  const ctx = usePlugin<typeof definition>()
  const prefs = () => ctx.stores.prefs.value
  const save = (next: Partial<Prefs>) => ctx.stores.prefs.set({ ...ctx.stores.prefs.value, ...next })

  const scopeOptions = (): { value: PanelScope; label: string }[] => [
    { value: "all", label: ctx.t("scope.all") },
    { value: "main", label: ctx.t("scope.main") },
    { value: "subagents", label: ctx.t("scope.subagents") },
    { value: "project", label: ctx.t("scope.project") },
  ]

  const pollOptions = (): { value: string; label: string }[] => [
    { value: "0", label: ctx.t("interval.off") },
    { value: "15000", label: ctx.t("interval.15") },
    { value: "30000", label: ctx.t("interval.30") },
    { value: "60000", label: ctx.t("interval.60") },
  ]

  const debounceOptions = (): { value: string; label: string }[] => [
    { value: "250", label: ctx.t("debounce.250") },
    { value: "750", label: ctx.t("debounce.750") },
    { value: "1500", label: ctx.t("debounce.1500") },
  ]

  return (
    <ctx.ui.SettingsLayout
      title={ctx.t("settings.title")}
      description={ctx.t("settings.description")}
    >
      <ctx.ui.SettingsSection title={ctx.t("settings.section")}>
        <ctx.ui.SettingsRow
          id="cache-stats-pill"
          title={ctx.t("settings.pill")}
          description={ctx.t("settings.pill.description")}
        >
          <ctx.ui.Switch
            label={ctx.t("settings.pill")}
            hideLabel
            checked={prefs().pill}
            onChange={(checked) => save({ pill: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="cache-stats-scope"
          title={ctx.t("settings.scope")}
          description={ctx.t("settings.scope.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.scope")}
            options={scopeOptions()}
            value={prefs().defaultScope}
            onChange={(value) => save({ defaultScope: value })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="cache-stats-poll"
          title={ctx.t("settings.poll")}
          description={ctx.t("settings.poll.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.poll")}
            options={pollOptions()}
            value={String(prefs().pollMs)}
            onChange={(value) => save({ pollMs: Number(value) })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="cache-stats-debounce"
          title={ctx.t("settings.debounce")}
          description={ctx.t("settings.debounce.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.debounce")}
            options={debounceOptions()}
            value={String(prefs().debounceMs)}
            onChange={(value) => save({ debounceMs: Number(value) })}
          />
        </ctx.ui.SettingsRow>
      </ctx.ui.SettingsSection>
    </ctx.ui.SettingsLayout>
  )
}

export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const live = createLiveStats({
    debounceMs: () => ctx.stores.prefs.value.debounceMs,
    pollMs: () => ctx.stores.prefs.value.pollMs,
  })

  // `options.pill: false` in opencode.json wins over the stored preference.
  const pillEnabled = () => ctx.options.pill !== false && ctx.stores.prefs.value.pill

  const projects = createProjectStats()

  const openPanel = (session: SessionRef) => {
    ctx.layout.open(`${ctx.id}:${TAB_ID}`, session, { tab: "select", background: true })
  }

  const tab: PanelTab = {
    id: TAB_ID,
    get title() {
      return ctx.t("panel.title")
    },
    closable: "compact",
  }

  ctx.add(Panel, {
    id: TAB_ID,
    region: "side",
    width: 440,
    mobile: {
      get title() {
        return ctx.t("panel.title")
      },
      order: 55,
      kind: "menu",
      icon: "window-analytics",
    },
    list: (input) => (input.open.includes(TAB_ID) ? [tab] : []),
    render: (props) => (
      <CacheStatsPanel session={props.session} tab={props.tab} live={live} projects={projects} />
    ),
  })

  ctx.add(Command, (): Command => ({
    id: "open",
    title: ctx.t("command.open"),
    keywords: "cache stats cache hit tokens cost subagents usage",
    section: "session",
    bind: "mod+alt+c",
    slash: { name: "cache-stats" },
    run: () => {
      const session = ctx.sessions.current()
      if (!session) {
        ctx.toast.show({
          variant: "error",
          title: ctx.t("panel.title"),
          description: ctx.t("toast.noSession"),
        })
        return
      }
      openPanel(session)
    },
  }))

  ctx.add(MenuItem, (): MenuItemEntry => {
    const session = ctx.sessions.current()
    return {
      menu: "session.panel",
      id: TAB_ID,
      title: ctx.t("panel.title"),
      icon: "window-analytics",
      keybind: `${ctx.id}.open`,
      opened: !!session && ctx.layout.state(`${ctx.id}:${TAB_ID}`, session) !== "closed",
      run: () => {
        const current = ctx.sessions.current()
        if (current) openPanel(current)
      },
    }
  })

  ctx.add(Style, styles)

  ctx.add(SettingsPage, {
    id: "cache-stats",
    icon: "window-analytics",
    get title() {
      return ctx.t("settings.title")
    },
    get entries() {
      return [
        {
          id: "cache-stats-pill",
          title: ctx.t("settings.pill"),
          description: ctx.t("settings.pill.description"),
        },
        {
          id: "cache-stats-scope",
          title: ctx.t("settings.scope"),
          description: ctx.t("settings.scope.description"),
        },
        {
          id: "cache-stats-poll",
          title: ctx.t("settings.poll"),
          description: ctx.t("settings.poll.description"),
        },
        {
          id: "cache-stats-debounce",
          title: ctx.t("settings.debounce"),
          description: ctx.t("settings.debounce.description"),
        },
      ]
    },
    render: () => <CacheStatsSettings />,
  })

  // The pill reads a cached snapshot; this keeps one live entry for the routed session.
  createKeyed(
    () => (pillEnabled() ? ctx.sessions.current() : undefined),
    (session) => {
      const stop = live.watch(hostFor(session), session.id, () => {})
      onCleanup(stop)
    },
    { equals: (a, b) => a?.key === b?.key },
  )

  createEffect(
    on(
      () => ctx.stores.prefs.value.pollMs,
      () => live.applyPoll(),
      { defer: true },
    ),
  )

  ctx.add(ComposerPill, (): ComposerPillItem => ({
    id: "hit",
    order: 20,
    show: (input) => {
      if (!pillEnabled()) return undefined
      const stats = live.peek(input.session.server.id, input.session.id)?.stats
      if (!stats) return undefined

      const hit = hitPct(stats.acc)
      const level = hitLevel(hit).level
      const tone =
        level === "success" ? "success" : level === "warning" ? "warning" : level === "error" ? "danger" : undefined

      return {
        icon: "window-analytics",
        label: hit < 0 ? ctx.t("pill.noUsage") : ctx.t("pill.label", { hit: formatHit(hit) }),
        tone,
        title: ctx.t("pill.title"),
        rows: [
          { id: "read", label: ctx.t("pill.cacheRead"), detail: formatNumber(stats.acc.cacheRead) },
          { id: "write", label: ctx.t("pill.cacheWrite"), detail: formatNumber(stats.acc.cacheWrite) },
          { id: "cost", label: ctx.t("metric.cost"), detail: formatCost(stats.acc.cost) },
          {
            id: "open",
            label: ctx.t("pill.open"),
            run: () => openPanel(input.session),
          },
        ],
        run: () => openPanel(input.session),
      }
    },
  }))

  return () => {
    live.dispose()
    projects.dispose()
  }
}
