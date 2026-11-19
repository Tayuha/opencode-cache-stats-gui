import { describe, expect, it } from "vitest"
import type { Collected } from "./data/collect.ts"
import { summarize, type UsageSummary } from "./data/stats.ts"
import { buildReport, jsonReport, markdownReport } from "./report.ts"
import { assistant, compaction } from "./data/fixtures.ts"

function blank(): UsageSummary {
  return summarize([])
}

function collected(options: {
  title?: string
  messages?: Parameters<typeof summarize>[0]
  subs?: Collected["subs"]
  main?: UsageSummary
  subagents?: UsageSummary
} = {}): Collected {
  const all = summarize(options.messages ?? [], "ses_root")
  const main = options.main ?? blank()
  const subagents = options.subagents ?? blank()
  return {
    ...all,
    sessionID: "ses_root",
    sessionIDs: ["ses_root"],
    title: options.title ?? "Demo session",
    updatedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
    subagents: 0,
    subs: options.subs ?? [],
    scopes: {
      main: { ...main, subagents: 0, subs: [] },
      subagents: { ...subagents, subagents: 0, subs: options.subs ?? [] },
    },
  }
}

describe("markdownReport", () => {
  it("includes totals, models, recent and subagents", () => {
    const stats = collected({
      messages: [assistant({ cacheRead: 900, input: 100, output: 50, cost: 0.01 })],
      subs: [
        {
          id: "ses_sub",
          name: "review",
          hit: 50,
          reqs: 1,
          reqsWithCacheRead: 1,
          tokens: 100,
          cost: 0.001,
          model: "anthropic/sonnet",
        },
      ],
    })
    const markdown = markdownReport(stats, "all")
    expect(markdown).toContain("# Cache stats")
    expect(markdown).toContain("| Cache hit | 90.0% |")
    expect(markdown).toContain("## Assistant models")
    expect(markdown).toContain("## Recent assistant requests")
    expect(markdown).toContain("## Subagents")
    expect(markdown).toContain("review")
  })

  it("marks a stale report", () => {
    expect(markdownReport(collected(), "all", true)).toContain("STALE")
  })

  it("escapes titles that would break a table", () => {
    const markdown = markdownReport(collected({ title: "a|b <script> *x*" }), "all")
    expect(markdown).toContain("a\\|b &lt;script&gt; \\*x\\*")
  })

  it("contains no prompts, tool output or compaction summaries", () => {
    const stats = collected({
      messages: [
        assistant({ cacheRead: 10, input: 10 }),
        compaction({ status: "completed", cacheRead: 5, input: 5 }),
      ],
    })
    const text = markdownReport(stats, "all")
    expect(text).not.toContain("summary text that must never be exported")
  })
})

describe("jsonReport", () => {
  it("parses with stable metadata", () => {
    const report = JSON.parse(jsonReport(collected(), "main")) as ReturnType<typeof buildReport>
    expect(report.version).toBe(1)
    expect(report.scope).toBe("main")
    expect(report.currency).toBe("USD")
    expect(report.capturedAt).toBe("2026-01-02T03:04:05.000Z")
    expect(report.stale).toBe(false)
  })

  it("serializes an unknown hit rate as null", () => {
    const report = JSON.parse(jsonReport(collected(), "all")) as ReturnType<typeof buildReport>
    expect(report.assistant.hitPercent).toBeNull()
  })

  it("uses the selected scope totals", () => {
    const stats = collected({ main: summarize([assistant({ cacheRead: 10, input: 10 })]) })
    const all = JSON.parse(jsonReport(stats, "all")) as ReturnType<typeof buildReport>
    const main = JSON.parse(jsonReport(stats, "main")) as ReturnType<typeof buildReport>
    expect(all.assistant.reqs).toBe(0)
    expect(main.assistant.reqs).toBe(1)
  })

  it("carries an explicit scope label for the project view", () => {
    const report = JSON.parse(jsonReport(collected(), "all", false, "project")) as ReturnType<
      typeof buildReport
    >
    expect(report.scopeLabel).toBe("project")
    expect(markdownReport(collected(), "all", false, "project")).toContain("Scope: project")
  })

  it("marks stale scope exports", () => {
    const report = JSON.parse(jsonReport(collected(), "subagents", true)) as ReturnType<typeof buildReport>
    expect(report.stale).toBe(true)
    expect(report.scope).toBe("subagents")
  })
})
