import { describe, expect, it } from "vitest"
import {
  dominantModel,
  hitPct,
  mergeAcc,
  mergeUsage,
  newAcc,
  recentRequests,
  safe,
  summarize,
  tokenTotal,
  type Acc,
} from "./stats.ts"
import { assistant, compaction } from "./fixtures.ts"

describe("hitPct", () => {
  it("is cache read over fresh input plus cache read", () => {
    expect(hitPct({ ...newAcc(), input: 1200, cacheRead: 4800 })).toBe(80)
  })

  it("is 100 when every prompt token came from cache", () => {
    expect(hitPct({ ...newAcc(), input: 0, cacheRead: 500 })).toBe(100)
  })

  it("is 0 when nothing was cached", () => {
    expect(hitPct({ ...newAcc(), input: 500, cacheRead: 0 })).toBe(0)
  })

  it("is -1 when nothing was recorded", () => {
    expect(hitPct(newAcc())).toBe(-1)
  })
})

describe("tokenTotal", () => {
  it("counts all five kinds", () => {
    const acc: Acc = {
      ...newAcc(),
      input: 1,
      output: 2,
      reasoning: 3,
      cacheRead: 4,
      cacheWrite: 5,
    }
    expect(tokenTotal(acc)).toBe(15)
  })
})

describe("safe", () => {
  it("clamps invalid values to zero", () => {
    expect(safe(undefined)).toBe(0)
    expect(safe(-5)).toBe(0)
    expect(safe(Number.NaN)).toBe(0)
    expect(safe(Number.POSITIVE_INFINITY)).toBe(0)
    expect(safe(0)).toBe(0)
    expect(safe(7)).toBe(7)
  })
})

describe("summarize", () => {
  it("returns zeros for no messages", () => {
    const stats = summarize([])
    expect(stats.acc.reqs).toBe(0)
    expect(stats.perModel.size).toBe(0)
    expect(stats.recent).toEqual([])
  })

  it("counts an assistant step without usage but does not record a request", () => {
    const stats = summarize([assistant({ withTokens: false })])
    expect(stats.acc.count).toBe(1)
    expect(stats.acc.reqs).toBe(0)
    expect(stats.perModel.size).toBe(0)
  })

  it("keeps compaction out of assistant totals", () => {
    const stats = summarize([
      assistant({ cacheRead: 100, input: 100, cost: 0.5 }),
      compaction({ status: "completed", cacheRead: 900, input: 100, cost: 0.25 }),
      compaction({ id: "msg_running", status: "running" }),
    ])
    expect(stats.acc.reqs).toBe(1)
    expect(stats.acc.cacheRead).toBe(100)
    expect(stats.compaction.reqs).toBe(1)
    expect(stats.compaction.cacheRead).toBe(900)
    expect(stats.compaction.count).toBe(2)
    expect(stats.compaction.cost).toBe(0.25)
  })

  it("ignores duplicate message ids", () => {
    const stats = summarize([
      assistant({ id: "dup", cacheRead: 10 }),
      assistant({ id: "dup", cacheRead: 10 }),
    ])
    expect(stats.acc.reqs).toBe(1)
    expect(stats.acc.cacheRead).toBe(10)
  })

  it("groups by provider and model, and totals match the rows", () => {
    const stats = summarize([
      assistant({ id: "a", provider: "anthropic", model: "sonnet", cacheRead: 10, input: 10 }),
      assistant({ id: "b", provider: "anthropic", model: "sonnet", cacheRead: 30, input: 10 }),
      assistant({ id: "c", provider: "openai", model: "gpt", cacheRead: 10, input: 90 }),
    ])
    expect(stats.perModel.size).toBe(2)
    expect(stats.perModel.get("anthropic/sonnet")?.reqs).toBe(2)
    expect(stats.perModel.get("openai/gpt")?.reqs).toBe(1)
    const summed = [...stats.perModel.values()].reduce((total, acc) => total + acc.reqs, 0)
    expect(summed).toBe(stats.acc.reqs)
  })

  it("keeps the 25 newest samples in ascending time order", () => {
    const messages = Array.from({ length: 40 }, (_, index) =>
      assistant({ id: `m${index}`, created: index, completed: index }),
    )
    const stats = summarize(messages)
    expect(stats.recent).toHaveLength(25)
    expect(stats.recent[0]?.at).toBe(15)
    expect(stats.recent[24]?.at).toBe(39)
  })
})

describe("recentRequests", () => {
  it("sorts by time, then session, then id", () => {
    const same = 5
    const samples = [
      { id: "b", sessionID: "s2", at: same, model: "m", usage: newAcc() },
      { id: "a", sessionID: "s2", at: same, model: "m", usage: newAcc() },
      { id: "c", sessionID: "s1", at: same, model: "m", usage: newAcc() },
      { id: "d", sessionID: "s1", at: 1, model: "m", usage: newAcc() },
    ]
    expect(recentRequests(samples).map((sample) => sample.id)).toEqual(["d", "c", "a", "b"])
  })
})

describe("mergeUsage", () => {
  it("is additive and does not alias accumulators", () => {
    const left = summarize([assistant({ id: "a", cacheRead: 10 })])
    const right = summarize([assistant({ id: "b", cacheRead: 20 })])
    mergeUsage(left, right)
    expect(left.acc.cacheRead).toBe(30)
    expect(right.acc.cacheRead).toBe(20)
  })

  it("mergeAcc adds every field", () => {
    const target: Acc = { ...newAcc(), input: 1 }
    mergeAcc(target, { ...newAcc(), input: 2, output: 3 })
    expect(target.input).toBe(3)
    expect(target.output).toBe(3)
  })
})

describe("dominantModel", () => {
  it("picks the model with the most requests", () => {
    const stats = summarize([
      assistant({ id: "a", provider: "p", model: "one" }),
      assistant({ id: "b", provider: "p", model: "two" }),
      assistant({ id: "c", provider: "p", model: "two" }),
    ])
    expect(dominantModel(stats.perModel)).toBe("p/two")
  })
})
