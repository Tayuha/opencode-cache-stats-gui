import type { SessionInfo, SessionMessageInfo } from "@opencode/client"
import type { CollectionClient } from "./collect.ts"

/** Minimal in-memory server used by the collection and live tests. */
export class FakeClient {
  gets: string[] = []
  listedTypes = new Set<string>()
  active = 0
  maxActive = 0
  failFor?: string
  delayMs = 0
  pageSize = 2
  repeatCursor = false

  sessions: Record<string, SessionInfo> = {}
  children: Record<string, SessionInfo[]> = {}
  messages: Record<string, SessionMessageInfo[]> = {}

  session = {
    get: async ({ sessionID }: { sessionID: string }) => {
      this.gets.push(sessionID)
      if (this.failFor === sessionID) throw new Error("boom")
      const info = this.sessions[sessionID]
      if (!info) throw new Error(`unknown session ${sessionID}`)
      return info
    },
    list: async (input: { parentID?: string | null }) => ({
      data: this.children[input.parentID ?? ""] ?? [],
      cursor: { next: null },
    }),
  }

  message = {
    list: async (input: { sessionID: string; type?: string; cursor?: string }) => {
      this.listedTypes.add(input.type ?? "")
      if (input.type === "assistant") {
        this.active += 1
        this.maxActive = Math.max(this.maxActive, this.active)
        try {
          await this.wait()
        } finally {
          this.active -= 1
        }
      } else {
        await this.wait()
      }

      if (this.repeatCursor) return { data: [], cursor: { next: input.cursor ?? "rep:0" } }

      const all = (this.messages[input.sessionID] ?? []).filter((message) => message.type === input.type)
      const offset = input.cursor ? Number(input.cursor.split(":")[1]) : 0
      const data = all.slice(offset, offset + this.pageSize)
      const next = offset + this.pageSize
      return {
        data,
        cursor: { next: next < all.length ? `${input.type}:${next}` : null },
      }
    },
  }

  private async wait() {
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs))
  }

  asClient(): CollectionClient {
    return this as unknown as CollectionClient
  }
}

export function info(id: string, parentID?: string): SessionInfo {
  return {
    id,
    parentID,
    projectID: "project",
    time: { created: 1, updated: 2 },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    location: {},
  } as SessionInfo
}
