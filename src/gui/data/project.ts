import type { SessionInfo } from "@opencode/client"
import type { Data } from "@opencode/client/solid"
import { createSignal } from "solid-js"
import { collect, type Collected, type ScopeStats, type Sub, type CollectionClient } from "./collect.ts"
import { mergeUsage, summarize } from "./stats.ts"

/** Projects can hold hundreds of sessions; aggregate the most recent ones. */
export const PROJECT_SESSION_LIMIT = 60

export type ProjectStats = ScopeStats & {
  /** Top-level sessions aggregated into these totals. */
  sessions: number
  /** The project has more sessions than the limit. */
  truncated: boolean
}

export type ProjectState = {
  stats?: ProjectStats
  loading: boolean
  stale: boolean
  /** What the totals were built from, so the panel can label them without re-listing. */
  ids: string[]
  updatedAt: number
}

type SessionReader = Pick<Data["session"], "list" | "get">

/**
 * Top-level sessions of the routed session's project, newest first.
 * Worktrees share a project id, so they are included; subagent sessions are not,
 * because `collect` already walks each root's descendants.
 */
export function projectSessions(reader: SessionReader, sessionID: string): SessionInfo[] {
  const projectID = reader.get(sessionID).projectID
  return reader
    .list()
    .filter(
      (info) => info.projectID === projectID && !info.parentID && !info.time.archived,
    )
    .sort((a, b) => b.time.updated - a.time.updated)
}

/** A project's display name: the user's name, else the last path segment. */
export function projectLabel(name: string | undefined, directory: string): string {
  if (name) return name
  const parts = directory.split("/").filter(Boolean)
  return parts[parts.length - 1] ?? directory
}

export function limitSessions(infos: readonly SessionInfo[]): { ids: string[]; truncated: boolean } {
  const ids = infos.slice(0, PROJECT_SESSION_LIMIT).map((info) => info.id)
  return { ids, truncated: infos.length > PROJECT_SESSION_LIMIT }
}

/** Folds per-session snapshots (each including its own subagent tree) into project totals. */
export function mergeProject(results: readonly Collected[], truncated = false): ProjectStats {
  const merged = summarize([])
  const seen = new Set<string>()
  const subs: Sub[] = []
  let subagents = 0

  for (const result of results) {
    mergeUsage(merged, result)
    subagents += result.subagents
    for (const sub of result.subs) {
      if (seen.has(sub.id)) continue
      seen.add(sub.id)
      subs.push(sub)
    }
  }

  return { ...merged, subs, subagents, sessions: results.length, truncated }
}

const PROJECT_CONCURRENCY = 2

async function collectAll(
  client: CollectionClient,
  ids: readonly string[],
  signal: AbortSignal,
): Promise<Collected[]> {
  const results: Collected[] = []
  let index = 0
  const workers = Array.from({ length: Math.min(PROJECT_CONCURRENCY, ids.length) }, async () => {
    while (index < ids.length) {
      const current = ids[index++]!
      results.push(await collect(client, current, signal))
    }
  })
  await Promise.all(workers)
  return results
}

type ProjectEntry = {
  key: string
  state: ProjectState
  ids: string[]
  truncated: boolean
  abort?: AbortController
  task?: Promise<void>
  dirty: boolean
  active: boolean
}

export type ProjectHost = {
  readonly projectID: string
  readonly client: CollectionClient
}

/**
 * Lazy, cached project totals. Nothing is fetched until `ensure` or `refresh` runs,
 * and a failure keeps the previous totals marked stale.
 */
export function createProjectStats() {
  const entries = new Map<string, ProjectEntry>()
  const [version, bump] = createSignal(0)
  let disposed = false

  type ProjectEntry = {
    key: string
    state: ProjectState
    ids: string[]
    truncated: boolean
    abort?: AbortController
    task?: Promise<void>
    dirty: boolean
    active: boolean
  }

  const emit = () => bump((value) => value + 1)

  const run = (entry: ProjectEntry, host: ProjectHost): Promise<void> => {
    if (!entry.active) return Promise.resolve()
    if (entry.task) {
      entry.dirty = true
      return entry.task
    }

    const abort = new AbortController()
    entry.abort = abort
    entry.state = { ...entry.state, loading: true }
    emit()

    entry.task = (async () => {
      try {
        const results = await collectAll(host.client, entry.ids, abort.signal)
        if (!entry.active || abort.signal.aborted) return
        entry.state = {
          stats: mergeProject(results, entry.truncated),
          loading: false,
          stale: false,
          ids: entry.ids,
          updatedAt: Date.now(),
        }
      } catch {
        if (!entry.active || abort.signal.aborted) return
        entry.state = { ...entry.state, loading: false, stale: true }
      } finally {
        entry.task = undefined
        entry.abort = undefined
        if (entry.active) emit()
      }
    })()

    return entry.task
  }

  const ensureEntry = (host: ProjectHost, ids: readonly string[], truncated: boolean) => {
    let entry = entries.get(host.projectID)
    if (!entry) {
      entry = {
        key: host.projectID,
        state: { loading: false, stale: false, ids: [...ids], updatedAt: 0 },
        ids: [...ids],
        truncated,
        dirty: false,
        active: true,
      }
      entries.set(host.projectID, entry)
    } else {
      entry.ids = [...ids]
      entry.truncated = truncated
    }
    return entry
  }

  return {
    /** Starts the first collection for this project, unless one already ran. */
    ensure(host: ProjectHost, ids: readonly string[], truncated: boolean): void {
      if (disposed || ids.length === 0) return
      const existing = entries.get(host.projectID)
      if (existing && (existing.state.stats || existing.task)) return
      const entry = ensureEntry(host, ids, truncated)
      void run(entry, host)
    },

    /** Forces a new collection, discarding the cache age. */
    refresh(host: ProjectHost, ids: readonly string[], truncated: boolean): Promise<void> {
      if (disposed || ids.length === 0) return Promise.resolve()
      const entry = ensureEntry(host, ids, truncated)
      return run(entry, host)
    },

    peek(projectID: string): ProjectState | undefined {
      version()
      return entries.get(projectID)?.state
    },

    forget(projectID: string): void {
      const entry = entries.get(projectID)
      if (!entry) return
      entry.active = false
      entry.abort?.abort()
      entries.delete(projectID)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      for (const entry of [...entries.values()]) {
        entry.active = false
        entry.abort?.abort()
      }
      entries.clear()
    },
  }
}

export type ProjectStatsCache = ReturnType<typeof createProjectStats>
