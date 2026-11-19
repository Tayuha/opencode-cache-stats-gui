import { describe, expect, it } from "vitest"
import {
  formatCost,
  formatHit,
  formatNumber,
  hitLevel,
  missLabel,
  nextView,
  share,
  recentWindow,
} from "./format.ts"
import { assistant } from "./data/fixtures.ts"

describe("formatNumber", () => {
  it("renders invalid values as a dash", () => {
    expect(formatNumber(-1)).toBe("—")
    expect(formatNumber(Number.NaN)).toBe("—")
  })

  it("keeps small values informative", () => {
    expect(formatNumber(0.005)).toBe("<0.01")
    expect(formatNumber(0.5)).toBe("0.50")
  })

  it("uses K and M suffixes", () => {
    expect(formatNumber(1500)).toBe("1.5K")
    expect(formatNumber(1_000_000)).toBe("1.00M")
  })

  it("keeps K just below the M boundary", () => {
    expect(formatNumber(999_949)).toBe("999.9K")
    expect(formatNumber(999_950)).toBe("1.00M")
  })
})

describe("formatCost", () => {
  it("handles zero, tiny, fractional and large values", () => {
    expect(formatCost(0)).toBe("$0.00")
    expect(formatCost(0.000001)).toBe("<$0.00001")
    expect(formatCost(0.1234)).toBe("$0.1234")
    expect(formatCost(1234.5)).toBe("$1,234.50")
    expect(formatCost(-1)).toBe("—")
  })
})

describe("formatHit", () => {
  it("renders unknown rates and one decimal", () => {
    expect(formatHit(-1)).toBe("n/a")
    expect(formatHit(89.94)).toBe("89.9%")
  })
})

describe("hitLevel", () => {
  it("uses the documented thresholds", () => {
    expect(hitLevel(-1).level).toBe("muted")
    expect(hitLevel(0).level).toBe("error")
    expect(hitLevel(39.9).level).toBe("error")
    expect(hitLevel(40).level).toBe("warning")
    expect(hitLevel(69.9).level).toBe("warning")
    expect(hitLevel(70).level).toBe("info")
    expect(hitLevel(89.9).level).toBe("info")
    expect(hitLevel(90).level).toBe("success")
    expect(hitLevel(100).level).toBe("success")
  })
})

describe("share", () => {
  it("renders a percentage or a dash", () => {
    expect(share(0, 0)).toBe("—")
    expect(share(1, 4)).toBe("25.0%")
  })
})

describe("missLabel", () => {
  it("describes the miss side", () => {
    expect(missLabel(-1)).toBe("no usage")
    expect(missLabel(80)).toBe("20.0% miss")
  })
})

describe("nextView", () => {
  it("cycles and handles help", () => {
    expect(nextView("summary")).toBe("models")
    expect(nextView("agents")).toBe("summary")
    expect(nextView("summary", -1)).toBe("agents")
    expect(nextView("help")).toBe("summary")
    expect(nextView("help", -1)).toBe("agents")
  })
})

describe("recentWindow", () => {
  it("keeps the newest samples and their combined hit rate", () => {
    const samples = [
      { id: "a", sessionID: "s", at: 1, model: "m", usage: { ...assistantUsage(10, 30) } },
      { id: "b", sessionID: "s", at: 2, model: "m", usage: { ...assistantUsage(50, 50) } },
    ]
    const view = recentWindow(samples, 1)
    expect(view.samples).toHaveLength(1)
    expect(view.samples[0]?.id).toBe("b")
    expect(view.hit).toBe(50)
  })
})

function assistantUsage(input: number, cacheRead: number) {
  const stats = assistant({ input, cacheRead })
  return stats.type === "assistant" && stats.tokens
    ? {
        input: stats.tokens.input,
        output: 0,
        reasoning: 0,
        cacheRead: stats.tokens.cache.read,
        cacheWrite: 0,
        cost: 0,
        count: 1,
        reqs: 1,
        reqsWithCacheRead: stats.tokens.cache.read > 0 ? 1 : 0,
      }
    : undefined!
}
