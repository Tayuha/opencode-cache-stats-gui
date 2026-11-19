import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import { Metric, Section } from "../components.tsx"

export function Help() {
  const ctx = usePlugin<typeof definition>()

  return (
    <div class="cs-help">
      <Section title={ctx.t("help.scopes")}>
        <span class="cs-note">{ctx.t("help.scope.all")}</span>
        <span class="cs-note">{ctx.t("help.scope.main")}</span>
        <span class="cs-note">{ctx.t("help.scope.subagents")}</span>
        <span class="cs-note">{ctx.t("help.scope.project")}</span>
      </Section>

      <Section title={ctx.t("help.views")}>
        <span class="cs-note">{ctx.t("help.view.summary")}</span>
        <span class="cs-note">{ctx.t("help.view.models")}</span>
        <span class="cs-note">{ctx.t("help.view.usage")}</span>
        <span class="cs-note">{ctx.t("help.view.agents")}</span>
      </Section>

      <span class="cs-section-title">{ctx.t("help.hit")}</span>
      <span class="cs-note">{ctx.t("help.hit.formula")}</span>
      <span class="cs-note">{ctx.t("help.hit.bar")}</span>
      <span class="cs-note">{ctx.t("help.hit.requests")}</span>
      <span class="cs-note">{ctx.t("help.hit.cost")}</span>
      <span class="cs-note">{ctx.t("help.hit.missing")}</span>
      <span class="cs-note">{ctx.t("help.hit.compaction")}</span>

      <Section title={ctx.t("help.levels")}>
        <Metric label={ctx.t("help.level.excellent")} value={ctx.t("level.excellent")} tone="success" />
        <Metric label={ctx.t("help.level.good")} value={ctx.t("level.good")} tone="info" />
        <Metric label={ctx.t("help.level.fair")} value={ctx.t("level.fair")} tone="warning" />
        <Metric label={ctx.t("help.level.poor")} value={ctx.t("level.poor")} tone="error" />
      </Section>

      <Section title={ctx.t("help.reports")}>
        <span class="cs-note">{ctx.t("help.reports.scope")}</span>
        <span class="cs-note">{ctx.t("help.reports.content")}</span>
      </Section>
    </div>
  )
}
