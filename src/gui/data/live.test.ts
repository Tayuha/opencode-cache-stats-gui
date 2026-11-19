import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OpenCodeEvent } from "@opencode/client"
import { collect, type Collected } from "./collect.ts"
import { assistant } from "./fixtures.ts"
import { FakeClient, info } from "./fake-client.ts"
import { createLiveStats, type LiveHost, type LiveState } from "./live.ts"

function stepEnded(sessionID: string): OpenCodeEvent {
  return { type: "session.step.ended", data: { sessionID } } as OpenCodeEvent
}

function makeHost(client: FakeClient) {
  let handler: ((event: OpenCodeEvent) => void) | undefined
  let unsubscribed = false
  const host: LiveHost = {
    serverID: "sidecar",
    client: client.asClient(),
    listen: (fn) => {
      handler = fn
      return () => {
        unsubscribed = true
        handler = undefined
      }
    },
  }
  return {
    host,
    emit: (event: OpenCodeEvent) => handler?.(event),
    wasUnsubscribed: () => unsubscribed,
  }
}

function makeClient(): FakeClient {
  const client = new FakeClient()
  client.sessions = { root: info("root") }
  client.messages = { root: [assistant({ id: "a1", cacheRead: 100, input: 100 })] }
  return client
}

async function baseline(client: FakeClient): Promise<Collected> {
  return collect(client.asClient(), "root", new AbortController().signal)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("createLiveStats", () => {
  it("coalesces several step events into one refresh", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length

    emit(stepEnded("root"))
    emit(stepEnded("root"))
    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(100)
    expect(client.gets.length).toBe(base)

    await vi.advanceTimersByTimeAsync(700)
    expect(client.gets.length).toBe(base + 1)

    stop()
    live.dispose()
  })

  it("serves two listeners from a single fetch", async () => {
    const client = makeClient()
    const { host } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const states: LiveState[] = []

    const stopA = live.watch(host, "root", (state) => states.push(state))
    const stopB = live.watch(host, "root", (state) => states.push(state))
    await vi.advanceTimersByTimeAsync(10)

    expect(client.gets).toEqual(["root"])
    expect(states.some((state) => state.stats?.acc.reqs === 1)).toBe(true)

    stopA()
    stopB()
    live.dispose()
  })

  it("keeps the second listener alive after the first unsubscribes", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })

    const stopA = live.watch(host, "root", () => {}, initial)
    const seen: LiveState[] = []
    const stopB = live.watch(host, "root", (state) => seen.push(state), initial)
    stopA()

    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(800)
    expect(seen.length).toBeGreaterThan(1)

    stopB()
    live.dispose()
  })

  it("releases the entry and the server subscription with the last listener", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit, wasUnsubscribed } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })

    const stop = live.watch(host, "root", () => {}, initial)
    expect(live.peek("sidecar", "root")?.stats?.sessionID).toBe("root")
    stop()

    expect(live.peek("sidecar", "root")).toBeUndefined()
    expect(wasUnsubscribed()).toBe(true)

    const before = client.gets.length
    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(2_000)
    expect(client.gets.length).toBe(before)

    live.dispose()
  })

  it("keeps the last snapshot and marks it stale when a refresh fails", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)

    client.failFor = "root"
    await live.refresh(host, "root")

    const state = live.peek("sidecar", "root")
    expect(state?.stale).toBe(true)
    expect(state?.loading).toBe(false)
    expect(state?.stats?.acc.reqs).toBe(1)

    client.failFor = undefined
    await live.refresh(host, "root")
    expect(live.peek("sidecar", "root")?.stale).toBe(false)

    stop()
    live.dispose()
  })

  it("ignores events for unrelated sessions", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length

    emit(stepEnded("someone-else"))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(client.gets.length).toBe(base)

    stop()
    live.dispose()
  })

  it("refreshes a descendant event for a parent entry", async () => {
    const client = new FakeClient()
    client.sessions = { root: info("root"), child: info("child", "root") }
    client.children = { root: [info("child", "root")] }
    client.messages = { root: [assistant({ id: "r" })], child: [assistant({ id: "c" })] }
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length

    emit(stepEnded("child"))
    await vi.advanceTimersByTimeAsync(800)
    expect(client.gets.length).toBeGreaterThan(base)

    stop()
    live.dispose()
  })

  it("runs one follow-up refresh when an event arrives mid-flight", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length
    client.delayMs = 5

    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(760)
    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(20)
    await vi.advanceTimersByTimeAsync(760)

    expect(client.gets.length).toBe(base + 2)

    stop()
    live.dispose()
  })

  it("polls when an interval is configured", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 1_000 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length

    await vi.advanceTimersByTimeAsync(1_100)
    expect(client.gets.length).toBe(base + 1)

    stop()
    live.dispose()
  })

  it("does not poll when the interval is off", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    const stop = live.watch(host, "root", () => {}, initial)
    const base = client.gets.length

    await vi.advanceTimersByTimeAsync(120_000)
    expect(client.gets.length).toBe(base)

    stop()
    live.dispose()
  })

  it("stops everything on dispose", async () => {
    const client = makeClient()
    const initial = await baseline(client)
    const { host, emit } = makeHost(client)
    const live = createLiveStats({ debounceMs: () => 750, pollMs: () => 0 })
    live.watch(host, "root", () => {}, initial)

    live.dispose()
    expect(live.peek("sidecar", "root")).toBeUndefined()

    const base = client.gets.length
    emit(stepEnded("root"))
    await vi.advanceTimersByTimeAsync(2_000)
    expect(client.gets.length).toBe(base)
  })
})
