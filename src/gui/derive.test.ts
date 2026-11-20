import { describe, expect, it } from "vitest"
import { latestRequest, modelRows, providerOf, scopeStats, shortModel, subRows } from "./derive.ts"
import type { Collected, Sub } from "./data/collect.ts"
import { hitPct, summarize } from "./data/stats.ts"
import { assistant } from "./data/fixtures.ts"

function stats() {
  const messages = [
    assistant({ id: "a", provider: "anthropic", model: "sonnet", cacheRead: 90, input: 10 }),
    assistant({ id: "b", provider: "openai", model: "gpt", cacheRead: 10, input: 90 }),
    assistant({ id: "c", provider: "anthropic", model: "sonnet", cacheRead: 90, input: 10 }),
  ]
  const summary = summarize(messages, "root")
  const sub: Sub = {
    id: "ses_sub",
    name: "review",
    hit: 75,
    reqs: 2,
    reqsWithCacheRead: 2,
    tokens: 100,
    cost: 0.01,
  }
  const collected: Collected = {
    ...summary,
    sessionID: "root",
    sessionIDs: ["root", "ses_sub"],
    title: "Demo",
    updatedAt: 1,
    subagents: 1,
    subs: [sub],
    scopes: {
      main: { ...summarize(messages, "root"), subagents: 0, subs: [] },
      subagents: { ...summarize([], "ses_sub"), subagents: 1, subs: [sub] },
    },
  }
  return collected
}

describe("scopeStats", () => {
  it("returns all stats verbatim and the sub-scopes from the snapshot", () => {
    const collected = stats()
    expect(scopeStats(collected, "all")).toBe(collected)
    expect(scopeStats(collected, "main").subs).toEqual([])
    expect(scopeStats(collected, "subagents").subs).toHaveLength(1)
  })
})

describe("modelRows", () => {
  it("sorts by hit rate then requests", () => {
    const rows = modelRows(stats())
    expect(rows[0]?.[0]).toBe("anthropic/sonnet")
    expect(rows.map(([model]) => model)).toEqual(["anthropic/sonnet", "openai/gpt"])
    expect(hitPct(rows[0]![1])).toBe(90)
  })
})

describe("subRows", () => {
  it("sorts by hit rate then requests", () => {
    const collected = stats()
    collected.subs.push({ ...collected.subs[0]!, id: "ses_other", hit: 10, reqs: 9 })
    expect(subRows(collected).map((sub) => sub.id)).toEqual(["ses_sub", "ses_other"])
  })
})

describe("latestRequest", () => {
  it("returns nothing without samples", () => {
    expect(latestRequest({ ...summarize([], "root"), subagents: 0, subs: [] })).toBeUndefined()
  })

  it("returns the newest request in scope", () => {
    const summary = summarize(
      [
        assistant({ id: "old", created: 1, completed: 2 }),
        assistant({ id: "new", created: 5, completed: 6 }),
      ],
      "root",
    )
    expect(latestRequest({ ...summary, subagents: 0, subs: [] })?.id).toBe("new")
  })
})

describe("model names", () => {
  it("splits provider and model, and strips control characters", () => {
    expect(shortModel("anthropic/claude-sonnet-4-5")).toBe("claude-sonnet-4-5")
    expect(providerOf("anthropic/claude-sonnet-4-5")).toBe("anthropic")
    expect(shortModel("local/\u0007model")).toBe("model")
  })
})
