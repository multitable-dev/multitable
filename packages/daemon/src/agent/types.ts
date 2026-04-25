import type { ProcessState } from '../types.js';

// What we emit on the WS for the session view.
export type AgentMessageOut =
  | { kind: 'assistant'; text: string; model?: string; ts: number }
  | { kind: 'tool_use'; toolUseId: string; toolName: string; input: unknown; ts: number }
  | { kind: 'tool_result'; toolUseId: string; output: string; isError?: boolean; ts: number }
  | { kind: 'user'; text: string; ts: number }
  | { kind: 'system'; text: string; ts: number };

export interface AgentSession {
  // === identity ===
  id: string; // multitable session id (DB primary key)
  projectId: string;
  name: string;
  workingDir: string;
  // === claude link ===
  claudeSessionId: string | null; // mirrored to DB; learned from SDK init
  // === lifecycle ===
  state: ProcessState; // 'running' while a turn is in-flight, else 'idle'/'stopped'/'errored'
  startedAt: Date | null;
  // === current turn ===
  currentTurn: {
    abortController: AbortController;
    startedAt: number;
    promptPreview: string;
  } | null;
  // === stats (replaces the in-memory ClaudeSessionState) ===
  totalCostUsd: number;
  tokensIn: number;
  tokensOut: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  toolCount: number;
  currentTool: string | null;
  activeSubagents: number;
  lastActivity: number;
  label: string | null;
  userMessages: string[]; // for labeler input
}

export interface SendTurnInput {
  sessionId: string;
  text: string; // user prompt; may contain @file mentions, attachment paths
}
