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
  // Prior claudeSessionIds this session has held. The SDK assigns a new id
  // every time it "forks" on resume (see GitHub claude-code#8069 — closed
  // not-planned, so this is permanent SDK behavior). Older ids point to JSONLs
  // that still hold prior turns; the messages endpoint reads the full chain.
  claudeSessionIdHistory: string[];
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
  userMessages: string[]; // accumulated user prompts (used by AI rename)
  // === streaming (in-flight assistant text) ===
  // Accumulated text of the current text content block as it arrives via
  // stream_event deltas. Reset to '' on each content_block_start of type=text;
  // cleared on message_stop or turn-complete.
  streamingText: string;
  streamingBlockIndex: number | null;
}

export interface SendTurnInput {
  sessionId: string;
  text: string; // user prompt; may contain @file mentions, attachment paths
}

// ─── Alert envelope ────────────────────────────────────────────────────────
//
// Unified shape every notification-class signal funnels into. The frontend
// routes one event (`session:alert`) by severity → toast / chime / OS notif /
// NotificationCenter entry, instead of subscribing to N bespoke events.

export type AlertSeverity = 'info' | 'success' | 'warning' | 'error' | 'attention';

export type AlertCategory =
  | 'turn'
  | 'tool'
  | 'permission'
  | 'elicitation'
  | 'rate-limit'
  | 'auth'
  | 'task'
  | 'compaction'
  | 'sync'
  | 'budget'
  | 'status';

export interface SessionAlert {
  alertId: string;
  sessionId: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  body?: string;
  needsAttention: boolean;
  persistent: boolean;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
}
