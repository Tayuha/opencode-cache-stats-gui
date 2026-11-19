import { describe, expect, it } from "vitest"
import type { Collected } from "./collect.ts"
import { summarize } from "./stats.ts"
import { assistant } from "./fixtures.ts"
import {
  limitSessions,
  mergeProject,
  PROJECT_SESSION_LIMIT,
  projectLabel,
  projectSessions,
} from "./project.ts"

function sessionInfo(input: { id: string; projectID?: string; parentID?: string; updated?: number; archived?: number }) {
  return {
    id: input.id,
    projectID: input.projectID ?? "project_1",
    parentID: input.parentID,
    time: { created: 1, updated: input.updated ?? 1, archived: input.archived },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    location: { directory: "/home/me/Projects/demo" },
  }
}

function readerOf(infos: readonly ReturnType<typeof sessionInfo>[]) {
  return {
    list: () => infos,
    get: (id: string) => {
      const found = infos.find((info) => info.id === id)
      if (!found) throw new Error("missing")
      return found
    },
  }
}

describe("projectSessions", () => {
  it("keeps top-level sessions of the same project, newest first", () => {
    const infos = [
      sessionInfo({ id: "old", updated: 10 }),
      sessionInfo({ id: "new", updated: 30 }),
      sessionInfo({ id: "other-project", projectID: "project_2", updated: 40 }),
      sessionInfo({ id: "child", parentID: "old", updated: 50 }),
      sessionInfo({ id: "archived", updated: 60, archived: 5 }),
    ]
    const ids = projectSessions(readerOf(infos) as never, "old").map((info) => info.id)
    expect(ids).toEqual(["new", "old"])
  })

  it("throws for an unknown routed session, so the panel can fall back", () => {
    expect(() => projectSessions(readerOf([]) as never, "nope")).toThrow()
  })
})

describe("limitSessions", () => {
  it("caps the aggregate and reports truncation", () => {
    const many = Array.from({ length: PROJECT_SESSION_LIMIT + 5 }, (_, index) =>
      sessionInfo({ id: `s${index}` }),
    )
    const limited = limitSessions(many)
    expect(limited.ids).toHaveLength(PROJECT_SESSION_LIMIT)
    expect(limited.truncated).toBe(true)

    const few = limitSessions(many.slice(0, 3))
    expect(few.ids).toHaveLength(3)
    expect(few.truncated).toBe(false)
  })
})

describe("mergeProject", () => {
  function collected(id: string, cacheRead: number, input: number, subs = 0): Collected {
    const summary = summarize([assistant({ id: `msg_${id}`, cacheRead, input })], id)
    return {
      ...summary,
      sessionID: id,
      sessionIDs: [id],
      title: id,
      updatedAt: 1,
      subagents: subs,
      subs: subs
        ? [
            {
              id: `sub_${id}`,
              name: id,
              hit: 50,
              reqs: 1,
              reqsWithCacheRead: 1,
              tokens: 10,
              cost: 0.001,
            },
          ]
        : [],
      scopes: {
        main: { ...summary, subagents: 0, subs: [] },
        subagents: { ...summarize([]), subagents: subs, subs: [] },
      },
    }
  }

  it("adds request, token and cost totals across sessions", () => {
    const merged = mergeProject([collected("a", 900, 100), collected("b", 100, 100)])
    expect(merged.sessions).toBe(2)
    expect(merged.truncated).toBe(false)
    expect(merged.acc.reqs).toBe(2)
    expect(merged.acc.cacheRead).toBe(1000)
    expect(merged.acc.input).toBe(200)
    expect(merged.perModel.size).toBe(1)
    expect(merged.perModel.get("anthropic/claude-sonnet-4-5")?.reqs).toBe(2)
  })

  it("sums subagents and keeps one row per subagent", () => {
    const merged = mergeProject([collected("a", 10, 10, 2), collected("b", 10, 10, 3)])
    expect(merged.subagents).toBe(5)
    expect(merged.subs).toHaveLength(2)
  })

  it("keeps the recent trend capped at 25 across sessions", () => {
    const many = [collected("a", 10, 10), collected("b", 10, 10)]
    const merged = mergeProject(many)
    expect(merged.recent.length).toBeLessThanOrEqual(25)
  })

  it("carries the truncation flag", () => {
    expect(mergeProject([], true).truncated).toBe(true)
  })
})

describe("projectLabel", () => {
  it("prefers the user's name, else the last path segment", () => {
    expect(projectLabel("Cache demo", "/home/me/Projects/x")).toBe("Cache demo")
    expect(projectLabel(undefined, "/home/me/Projects/x/")).toBe("x")
    expect(projectLabel(undefined, "")).toBe("")
  })
})
