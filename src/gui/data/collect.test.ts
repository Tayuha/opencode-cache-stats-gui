import { describe, expect, it } from "vitest"
import { collect } from "./collect.ts"
import { assistant, compaction } from "./fixtures.ts"
import { FakeClient, info } from "./fake-client.ts"

function single(): FakeClient {
  const client = new FakeClient()
  client.sessions = { root: info("root") }
  client.messages = {
    root: [assistant({ id: "a1", cacheRead: 100, input: 100 })],
  }
  return client
}

describe("collect", () => {
  it("reads one session into a complete snapshot", async () => {
    const client = single()
    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.sessionID).toBe("root")
    expect(stats.sessionIDs).toEqual(["root"])
    expect(stats.title).toBe("session")
    expect(stats.acc.reqs).toBe(1)
    expect(stats.updatedAt).toBeGreaterThan(0)
  })

  it("follows every cursor page exactly once", async () => {
    const client = new FakeClient()
    client.sessions = { root: info("root") }
    client.pageSize = 2
    client.messages = {
      root: Array.from({ length: 5 }, (_, index) => assistant({ id: `a${index}`, cacheRead: 10 })),
    }
    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.acc.reqs).toBe(5)
  })

  it("rejects when the server repeats a cursor", async () => {
    const client = single()
    client.repeatCursor = true
    await expect(collect(client.asClient(), "root", new AbortController().signal)).rejects.toThrow(
      /cursor/i,
    )
  })

  it("folds subtree totals and counts descendants", async () => {
    const client = new FakeClient()
    client.sessions = {
      root: info("root"),
      c1: info("c1", "root"),
      c2: info("c2", "root"),
      g1: info("g1", "c1"),
    }
    client.children = { root: [info("c1", "root"), info("c2", "root")], c1: [info("g1", "c1")] }
    client.messages = {
      root: [assistant({ id: "r", cacheRead: 100, input: 0 })],
      c1: [assistant({ id: "c1", cacheRead: 50, input: 50 })],
      c2: [assistant({ id: "c2", cacheRead: 0, input: 100 })],
      g1: [assistant({ id: "g1", cacheRead: 10, input: 90 })],
    }

    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.subagents).toBe(3)
    expect(stats.subs).toHaveLength(3)
    expect(stats.acc.reqs).toBe(4)

    const c1 = stats.subs.find((sub) => sub.id === "c1")
    expect(c1?.reqs).toBe(2)

    expect(stats.scopes.main.acc.reqs).toBe(1)
    for (const field of ["reqs", "count", "input", "output", "cacheRead", "cacheWrite", "cost"] as const) {
      expect(stats.acc[field]).toBe(
        stats.scopes.main.acc[field] + stats.scopes.subagents.acc[field],
      )
    }
  })

  it("counts a child only once", async () => {
    const client = new FakeClient()
    client.sessions = { root: info("root"), c1: info("c1", "root") }
    client.children = { root: [info("c1", "root"), info("c1", "root")] }
    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.subagents).toBe(1)
    expect(stats.subs).toHaveLength(1)
  })

  it("fetches only assistant and compaction messages", async () => {
    const client = single()
    await collect(client.asClient(), "root", new AbortController().signal)
    expect([...client.listedTypes].sort()).toEqual(["assistant", "compaction"])
  })

  it("returns zeros for a session with no messages", async () => {
    const client = single()
    client.messages = { root: [] }
    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.acc.reqs).toBe(0)
    expect(stats.recent).toEqual([])
  })

  it("keeps compaction out of request totals", async () => {
    const client = single()
    client.messages = {
      root: [assistant({ id: "a", cacheRead: 10 }), compaction({ id: "c", status: "completed" })],
    }
    const stats = await collect(client.asClient(), "root", new AbortController().signal)
    expect(stats.acc.reqs).toBe(1)
    expect(stats.compaction.reqs).toBe(1)
  })

  it("rejects before any request when already aborted", async () => {
    const client = single()
    const controller = new AbortController()
    controller.abort()
    await expect(collect(client.asClient(), "root", controller.signal)).rejects.toThrow()
    expect(client.gets).toEqual([])
  })

  it("rejects when aborted mid-flight", async () => {
    const client = single()
    client.delayMs = 30
    const controller = new AbortController()
    const task = collect(client.asClient(), "root", controller.signal)
    setTimeout(() => controller.abort(), 5)
    await expect(task).rejects.toThrow()
  })

  it("never reads more than four sessions at once", async () => {
    const client = new FakeClient()
    const ids = ["root", "c1", "c2", "c3", "c4", "c5"]
    client.sessions = Object.fromEntries(ids.map((id) => [id, info(id, id === "root" ? undefined : "root")]))
    client.children = { root: ids.slice(1).map((id) => info(id, "root")) }
    client.messages = Object.fromEntries(ids.map((id) => [id, [assistant({ id: `a_${id}` })]]))
    client.delayMs = 4

    await collect(client.asClient(), "root", new AbortController().signal)
    expect(client.maxActive).toBeLessThanOrEqual(4)
    expect(client.maxActive).toBeGreaterThan(1)
  })
})
