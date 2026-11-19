import type { OpenCodeEvent } from "@opencode/client"
import { createSignal } from "solid-js"
import { collect, type Collected, type CollectionClient } from "./collect.ts"

export type LiveState = {
  stats?: Collected
  loading: boolean
  stale: boolean
}

export type LiveListener = (state: LiveState) => void

/** What the registry needs to read one desktop server. */
export type LiveHost = {
  readonly serverID: string
  readonly client: CollectionClient
  listen(handler: (event: OpenCodeEvent) => void): () => void
}

export type LiveOptions = {
  /** Read at schedule time, so a settings change applies to the next refresh. */
  debounceMs?: () => number
  pollMs?: () => number
}

type Entry = {
  key: string
  serverID: string
  sessionID: string
  client: CollectionClient
  state: LiveState
  listeners: Set<LiveListener>
  abort?: AbortController
  task?: Promise<void>
  timer?: ReturnType<typeof setTimeout>
  poll?: ReturnType<typeof setInterval>
  dirty: boolean
  active: boolean
}

const DEFAULT_DEBOUNCE_MS = 750
const DEFAULT_POLL_MS = 30_000

function keyOf(serverID: string, sessionID: string): string {
  return `${serverID}\n${sessionID}`
}

/** Which sessions a server event invalidates; undefined means "not a usage event". */
export function affectedSessions(event: OpenCodeEvent): string[] | undefined {
  switch (event.type) {
    case "server.connected":
      return []
    case "session.created":
      return [event.data.sessionID, ...(event.data.parentID ? [event.data.parentID] : [])]
    case "session.step.ended":
    case "session.step.failed":
    case "session.compaction.ended":
    case "session.compaction.failed":
    case "session.usage.updated":
    case "session.renamed":
    case "session.deleted":
    case "session.revert.committed":
      return [event.data.sessionID]
    default:
      return undefined
  }
}

/**
 * One live cache-stats entry per mounted session. Refreshes at step boundaries, serializes
 * requests, and keeps the last good snapshot when a refresh fails.
 */
export function createLiveStats(options: LiveOptions = {}) {
  const entries = new Map<string, Entry>()
  const serverStops = new Map<string, () => void>()
  const [version, bump] = createSignal(0)
  let disposed = false

  const debounceMs = () => options.debounceMs?.() ?? DEFAULT_DEBOUNCE_MS
  const pollMs = () => options.pollMs?.() ?? DEFAULT_POLL_MS

  const emit = (entry: Entry) => {
    for (const listener of entry.listeners) listener(entry.state)
    bump((value) => value + 1)
  }

  const stopPoll = (entry: Entry) => {
    if (entry.poll) clearInterval(entry.poll)
    entry.poll = undefined
  }

  const startPoll = (entry: Entry) => {
    stopPoll(entry)
    const ms = pollMs()
    if (ms > 0) {
      entry.poll = setInterval(() => {
        void runRefresh(entry)
      }, ms)
    }
  }

  const schedule = (entry: Entry) => {
    if (!entry.active) return
    if (entry.task) {
      entry.dirty = true
      return
    }
    if (entry.timer) return
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      void runRefresh(entry)
    }, debounceMs())
  }

  const runRefresh = (entry: Entry): Promise<void> => {
    if (!entry.active) return Promise.resolve()
    if (entry.task) return entry.task
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = undefined
    entry.dirty = false

    const abort = new AbortController()
    entry.abort = abort
    entry.state = { ...entry.state, loading: true }
    emit(entry)

    entry.task = (async () => {
      try {
        const stats = await collect(entry.client, entry.sessionID, abort.signal)
        if (!entry.active || abort.signal.aborted) return
        entry.state = { stats, loading: false, stale: false }
      } catch {
        if (!entry.active || abort.signal.aborted) return
        // Keep the last good snapshot visibly stale instead of zeroing the totals.
        entry.state = { ...entry.state, loading: false, stale: true }
      } finally {
        entry.task = undefined
        entry.abort = undefined
        if (entry.active) {
          emit(entry)
          if (entry.dirty) schedule(entry)
        }
      }
    })()

    return entry.task
  }

  const ensureServer = (host: LiveHost) => {
    if (serverStops.has(host.serverID)) return
    const stop = host.listen((event) => {
      const affected = affectedSessions(event)
      if (!affected) return
      for (const entry of entries.values()) {
        if (entry.serverID !== host.serverID) continue
        const family = entry.state.stats?.sessionIDs ?? [entry.sessionID]
        if (affected.length === 0 || affected.some((id) => family.includes(id))) {
          schedule(entry)
        }
      }
    })
    serverStops.set(host.serverID, stop)
  }

  const releaseServer = (serverID: string) => {
    for (const entry of entries.values()) {
      if (entry.serverID === serverID) return
    }
    const stop = serverStops.get(serverID)
    if (stop) stop()
    serverStops.delete(serverID)
  }

  const stopEntry = (entry: Entry) => {
    entry.active = false
    entry.abort?.abort()
    if (entry.timer) clearTimeout(entry.timer)
    stopPoll(entry)
    entries.delete(entry.key)
    releaseServer(entry.serverID)
  }

  const watch = (
    host: LiveHost,
    sessionID: string,
    listener: LiveListener,
    initial?: Collected,
  ): (() => void) => {
    if (disposed) return () => {}
    const key = keyOf(host.serverID, sessionID)
    let entry = entries.get(key)
    if (!entry) {
      entry = {
        key,
        serverID: host.serverID,
        sessionID,
        client: host.client,
        state: { stats: initial, loading: false, stale: false },
        listeners: new Set(),
        dirty: false,
        active: true,
      }
      entries.set(key, entry)
      ensureServer(host)
      startPoll(entry)
    } else {
      entry.client = host.client
      ensureServer(host)
      if (initial && (!entry.state.stats || initial.updatedAt >= entry.state.stats.updatedAt)) {
        entry.state = { stats: initial, loading: !!entry.task, stale: false }
        emit(entry)
      }
    }

    entry.listeners.add(listener)
    listener(entry.state)
    if (!entry.state.stats && !entry.task) void runRefresh(entry)

    const watched = entry
    let watching = true
    return () => {
      if (!watching) return
      watching = false
      watched.listeners.delete(listener)
      if (watched.listeners.size === 0) stopEntry(watched)
    }
  }

  const forceRefresh = (host: LiveHost, sessionID: string): Promise<void> => {
    if (disposed) return Promise.resolve()
    const entry = entries.get(keyOf(host.serverID, sessionID))
    if (!entry) return Promise.resolve()
    entry.client = host.client
    return runRefresh(entry)
  }

  return {
    /** Follows one session; the listener runs at once with the current state. */
    watch,

    /** Forces a refresh of a session the panel already follows. */
    refresh: forceRefresh,

    /** Reads the cached snapshot synchronously; reactive through the registry's revision signal. */
    peek(serverID: string, sessionID: string): LiveState | undefined {
      version()
      return entries.get(keyOf(serverID, sessionID))?.state
    },

    /** Re-arms poll intervals after the user changes the interval in settings. */
    applyPoll(): void {
      for (const entry of entries.values()) startPoll(entry)
    },

    /** Drops one session, e.g. when the panel switches away without unmounting. */
    forget(host: LiveHost, sessionID: string): void {
      const entry = entries.get(keyOf(host.serverID, sessionID))
      if (entry) stopEntry(entry)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      for (const stop of serverStops.values()) stop()
      serverStops.clear()
      for (const entry of [...entries.values()]) stopEntry(entry)
      entries.clear()
    },
  }
}

export type LiveStats = ReturnType<typeof createLiveStats>
