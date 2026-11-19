import type { SessionMessageInfo } from "@opencode/client"

type Tokens = { input?: number; output?: number; reasoning?: number; cacheRead?: number; cacheWrite?: number }

function tokensOf(tokens: Tokens) {
  return {
    input: tokens.input ?? 0,
    output: tokens.output ?? 0,
    reasoning: tokens.reasoning ?? 0,
    cache: { read: tokens.cacheRead ?? 0, write: tokens.cacheWrite ?? 0 },
  }
}

export function assistant(
  input: Tokens & {
    id?: string
    cost?: number
    provider?: string
    model?: string
    created?: number
    completed?: number
    withTokens?: boolean
  } = {},
): SessionMessageInfo {
  return {
    id: input.id ?? "msg_assistant",
    type: "assistant",
    agent: "build",
    model: { providerID: input.provider ?? "anthropic", id: input.model ?? "claude-sonnet-4-5" },
    time: { created: input.created ?? 1, completed: input.completed ?? 2 },
    content: [],
    cost: input.cost ?? 0,
    ...(input.withTokens === false ? {} : { tokens: tokensOf(input) }),
  } as SessionMessageInfo
}

export function compaction(
  input: Tokens & {
    id?: string
    status?: "running" | "completed"
    cost?: number
  } = {},
): SessionMessageInfo {
  const base = {
    id: input.id ?? "msg_compaction",
    type: "compaction" as const,
    time: { created: 1 },
    reason: "auto" as const,
    summary: "summary text that must never be exported",
  }
  if (input.status === "running") {
    return { ...base, status: "running" } as SessionMessageInfo
  }
  return {
    ...base,
    status: "completed",
    cost: input.cost ?? 0,
    tokens: tokensOf(input),
  } as SessionMessageInfo
}
