import type { OpenCodeEvent } from "@opencode/client"
import type { SessionRef } from "@opencode/plugin/gui"
import type { LiveHost } from "./data/live.ts"

/**
 * Builds the registry host for a session. Read it where it is used: a restarted server
 * brings a new client and a new data store under the same id.
 */
export function hostFor(session: SessionRef): LiveHost {
  return {
    serverID: session.server.id,
    client: session.server.client,
    listen: (handler: (event: OpenCodeEvent) => void) =>
      session.server.data.listen(({ details }) => handler(details)),
  }
}
