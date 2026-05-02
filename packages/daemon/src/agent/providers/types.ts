import type { AgentSession } from '../types.js';
import type { Message } from '../../transcripts/parser.js';

// What a provider adapter calls back into when it produces output. The
// AgentSessionManager owns the EventEmitter surface and the lifecycle state
// machine; adapters only translate SDK events into this shape.
export interface AdapterCallbacks {
  // Final assistant or tool messages — drive the chat UI.
  emitAssistantMessage(messages: Message[]): void;
  emitToolEvent(messages: Message[]): void;
  emitUserMessage(messages: Message[]): void;
  // Provider learned (or re-learned) the canonical session id for this
  // conversation. Manager updates AgentSession + DB.
  onSessionIdAssigned(newId: string, history: string[]): void;
  // Snapshot of cumulative cost / token / currentTool for the live state pane.
  emitStateSnapshot(): void;
  // Append the message list to AgentSession.messages — manager owns the
  // dedupe/persistence policy.
  pushMessages(messages: Message[]): void;
  // Cumulative usage updates (tokens/cost) for the result row.
  applyUsage(input: {
    tokensIn: number;
    tokensOut: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    costUsd: number;
  }): void;
  // Surface a successful turn-result for toast / cost / `/cost`.
  emitTurnResult(input: {
    subtype: string;
    totalCostUsd: number;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
    };
    text: string | null;
  }): void;
  // Tool name shown in the live state pane while a tool is running.
  setCurrentTool(name: string | null): void;
  // Bump the activity clock — drives the "running for ___" badge.
  bumpActivity(): void;
  // First-prompt detection for AI rename.
  maybeRenameFromFirstPrompt(prompt: string): void;
}

// Adapter contract. Each provider (claude, codex, gemini, ...) implements this.
// The manager picks an adapter by AgentSession.provider and calls runTurn for
// each user turn. reset() is called when /clear nukes the conversation.
export interface ProviderAdapter {
  readonly name: 'claude' | 'codex';
  runTurn(s: AgentSession, text: string, ctrl: AbortController, cb: AdapterCallbacks): Promise<void>;
  reset?(s: AgentSession): void;
}
