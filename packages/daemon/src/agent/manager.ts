import { EventEmitter } from 'node:events';
import type {
  HookCallback,
  HookCallbackMatcher,
  HookEvent,
} from '@anthropic-ai/claude-agent-sdk';
import type { AgentSession, SendTurnInput } from './types.js';
import type { ProcessState } from '../types.js';
import type { Message } from '../transcripts/parser.js';
import type { PermissionManager } from '../hooks/permissionManager.js';
import {
  sdkSystemInit,
  sdkAssistantToMessages,
  sdkUserToMessages,
  sdkResult,
} from './sdkAdapter.js';
import { updateSession, insertCostRecord, getSessionById } from '../db/store.js';
import { generateSessionLabel } from '../hooks/labeler.js';
import { detectOptions } from '../hooks/optionDetector.js';

// Agent-modal defaults from AddAgentModal — session.name matching one of these
// is considered unnamed and eligible for auto-rename from the first prompt.
const AGENT_DEFAULT_NAMES = new Set([
  'Claude Code',
  'Codex',
  'Gemini CLI',
  'Amp',
  'Aider',
  'Goose',
]);

function titleFromFirstPrompt(prompt: string, maxLen = 60): string {
  const firstLine = prompt.split('\n', 1)[0] ?? prompt;
  const cleaned = firstLine.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1).trimEnd() + '…';
}

type RegisterInput = Omit<
  AgentSession,
  | 'state'
  | 'currentTurn'
  | 'startedAt'
  | 'totalCostUsd'
  | 'tokensIn'
  | 'tokensOut'
  | 'cacheCreationTokens'
  | 'cacheReadTokens'
  | 'toolCount'
  | 'currentTool'
  | 'activeSubagents'
  | 'lastActivity'
  | 'label'
  | 'userMessages'
>;

export class AgentSessionManager extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private permManager: PermissionManager;

  constructor(permManager: PermissionManager) {
    super();
    this.permManager = permManager;
  }

  /**
   * Register a session with the manager. Pure bookkeeping: initializes all
   * stat fields to zero/empty defaults, sets state to 'stopped', stores the
   * session in the in-memory map, and returns it.
   */
  register(input: RegisterInput): AgentSession {
    const existing = this.sessions.get(input.id);
    if (existing) return existing;
    const session: AgentSession = {
      id: input.id,
      projectId: input.projectId,
      name: input.name,
      workingDir: input.workingDir,
      claudeSessionId: input.claudeSessionId,
      state: 'stopped',
      startedAt: null,
      currentTurn: null,
      totalCostUsd: 0,
      tokensIn: 0,
      tokensOut: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      toolCount: 0,
      currentTool: null,
      activeSubagents: 0,
      lastActivity: 0,
      label: null,
      userMessages: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  getAll(): AgentSession[] {
    return [...this.sessions.values()];
  }

  /**
   * Drive one user turn through the SDK. Serialized per session: throws if a
   * turn is already in flight. Emits state-changed/user-message/assistant-
   * message/tool-event/turn-result/turn-error/turn-complete events so
   * server.ts can broadcast to WebSocket subscribers.
   */
  async sendTurn({ sessionId, text }: SendTurnInput): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`unknown session ${sessionId}`);
    if (s.currentTurn) throw new Error('turn already in flight');

    const ctrl = new AbortController();
    s.currentTurn = {
      abortController: ctrl,
      startedAt: Date.now(),
      promptPreview: text.slice(0, 80),
    };
    s.state = 'running';
    s.lastActivity = Date.now();
    s.userMessages.push(text);
    if (!s.startedAt) s.startedAt = new Date();

    this.emit('state-changed', { sessionId, state: 'running' as ProcessState });

    // Optimistically push the user's own message so the UI can render without
    // waiting for the SDK to echo it back. Shape matches sdkAdapter output so
    // later dedupe-by-id works when the SDK-side user message arrives.
    const userTs = Date.now();
    const userMsg: Message = {
      id: `turn-${userTs}`,
      ts: userTs,
      kind: 'user',
      text,
    };
    this.emit('user-message', { sessionId, messages: [userMsg] });

    try {
      const { query } = await import('@anthropic-ai/claude-agent-sdk');
      const it = query({
        prompt: text,
        options: {
          cwd: s.workingDir,
          ...(s.claudeSessionId ? { resume: s.claudeSessionId } : {}),
          settingSources: ['project', 'user'],
          permissionMode: 'default',
          canUseTool: this.makeCanUseTool(sessionId),
          hooks: this.makeHooks(sessionId),
          includePartialMessages: false,
          // NOTE: Phase 0 correction — SDK accepts the controller, NOT just its signal.
          abortController: ctrl,
        },
      });
      for await (const msg of it) {
        try {
          this.handleSdkMessage(sessionId, msg);
        } catch (handlerErr) {
          // Don't let a handler bug abort the whole turn — log and continue.
          console.error('[agent] handler error:', handlerErr);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      s.state = 'errored';
      this.emit('turn-error', { sessionId, error: message });
      this.emit('state-changed', { sessionId, state: 'errored' as ProcessState });
    } finally {
      s.currentTurn = null;
      if (s.state === 'running') {
        s.state = 'idle';
        this.emit('state-changed', { sessionId, state: 'idle' as ProcessState });
      }
      this.emit('turn-complete', { sessionId });
    }
  }

  /**
   * Dispatch one SDK message to event consumers. Tolerates the full ~30-variant
   * SDK message union via a `default` branch that silently ignores types we
   * don't consume today. Only reacts to: system/init, assistant, user, result.
   */
  private handleSdkMessage(sessionId: string, msg: unknown): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type?: string; subtype?: string };

    switch (m.type) {
      case 'system': {
        if (m.subtype !== 'init') return;
        const info = sdkSystemInit(msg);
        if (!info) return;
        const newSid = info.claudeSessionId;
        if (newSid && newSid !== s.claudeSessionId) {
          s.claudeSessionId = newSid;
          try {
            updateSession(sessionId, { claudeSessionId: newSid });
          } catch (err) {
            console.error('[agent] failed to persist claudeSessionId:', err);
          }
          this.emit('session-updated', { sessionId, claudeSessionId: newSid });
        }
        return;
      }
      case 'assistant': {
        const messages = sdkAssistantToMessages(msg);
        if (messages.length === 0) return;
        for (const out of messages) {
          if (out.kind === 'tool_use') {
            s.toolCount += 1;
            s.currentTool = out.toolName || s.currentTool;
          }
        }
        s.lastActivity = Date.now();
        this.emit('assistant-message', { sessionId, messages });
        return;
      }
      case 'user': {
        const messages = sdkUserToMessages(msg);
        if (messages.length === 0) return;
        const toolEvents: Message[] = [];
        const userMessages: Message[] = [];
        for (const out of messages) {
          if (out.kind === 'tool_result') {
            toolEvents.push(out);
          } else if (out.kind === 'user') {
            userMessages.push(out);
          }
        }
        if (toolEvents.length > 0) {
          // Tool call completed — clear currentTool.
          s.currentTool = null;
          this.emit('tool-event', { sessionId, messages: toolEvents });
        }
        if (userMessages.length > 0) {
          this.emit('user-message', { sessionId, messages: userMessages });
        }
        s.lastActivity = Date.now();
        return;
      }
      case 'result': {
        const info = sdkResult(msg);
        if (!info) return;
        s.totalCostUsd += info.totalCostUsd;
        s.tokensIn += info.usage.inputTokens;
        s.tokensOut += info.usage.outputTokens;
        s.cacheCreationTokens += info.usage.cacheCreationInputTokens;
        s.cacheReadTokens += info.usage.cacheReadInputTokens;
        s.lastActivity = Date.now();
        try {
          insertCostRecord({
            sessionId,
            tokensIn: info.usage.inputTokens,
            tokensOut: info.usage.outputTokens,
            costUsd: info.totalCostUsd,
          });
        } catch (err) {
          console.error('[agent] failed to insert cost record:', err);
        }
        this.emit('turn-result', {
          sessionId,
          subtype: info.subtype,
          totalCostUsd: info.totalCostUsd,
          usage: info.usage,
          text: info.text,
        });
        // Phase 7: broadcast updated stats live so the cost panel refreshes
        // without waiting for JSONL re-parse. server.ts re-emits this as
        // `session:state-updated` to all clients.
        this.emit('state-snapshot', { sessionId, snapshot: this.snapshotStats(s) });
        return;
      }
      default:
        // Silently ignore every other SDK message variant (stream_event,
        // rate_limit_event, tool_progress, hook_*, task_*, compact_boundary,
        // notification, etc.). Phase 7 may revisit.
        return;
    }
  }

  /**
   * Build the canUseTool callback the SDK invokes for every tool call.
   * Delegates to PermissionManager.requestFromSdk, which mirrors the existing
   * hook-based state machine (auto-defer, allowlist, dedup, 110s timeout)
   * and resolves to an SDK PermissionResult. We pass through the Claude-
   * rendered labels (title/displayName/subtitle/blockedPath) so the UI can
   * eventually render them; today the existing PermissionBar still works
   * unchanged off toolName/toolInput.
   */
  private makeCanUseTool(sessionId: string) {
    return async (
      toolName: string,
      toolInput: Record<string, unknown>,
      opts: {
        signal: AbortSignal;
        title?: string;
        displayName?: string;
        subtitle?: string;
        blockedPath?: string;
        decisionReason?: string;
        suggestions?: unknown;
      },
    ) => {
      const s = this.sessions.get(sessionId);
      if (!s) {
        return { behavior: 'deny' as const, message: 'unknown session' };
      }
      return await this.permManager.requestFromSdk(
        sessionId,
        s.claudeSessionId ?? '',
        toolName,
        toolInput as Record<string, any>,
        opts.signal,
        {
          title: opts.title,
          displayName: opts.displayName,
          subtitle: opts.subtitle,
          blockedPath: opts.blockedPath,
        },
      );
    };
  }

  /**
   * Abort an in-flight turn. The `for await` loop in sendTurn will exit and
   * the `finally` block handles the state cleanup + turn-complete emission.
   */
  abortTurn(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    if (!s.currentTurn) return;
    try {
      s.currentTurn.abortController.abort();
    } catch (err) {
      console.error('[agent] abortTurn failed:', err);
    }
  }

  /**
   * Remove a session from the manager. Aborts any in-flight turn and clears
   * outstanding permission prompts for the session before deletion.
   */
  remove(sessionId: string): void {
    this.abortTurn(sessionId);
    try {
      this.permManager.clearForSession(sessionId);
    } catch (err) {
      console.error('[agent] clearForSession failed:', err);
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Build a plain-object stat snapshot for the `session:state-updated` payload.
   * Shape mirrors what the old HTTP receiver broadcast (`ClaudeSessionState`)
   * so the frontend store keeps interpreting it without changes.
   */
  private snapshotStats(s: AgentSession): Record<string, unknown> {
    return {
      claudeSessionId: s.claudeSessionId,
      currentTool: s.currentTool,
      toolCount: s.toolCount,
      tokenCount: s.tokensIn + s.tokensOut + s.cacheCreationTokens + s.cacheReadTokens,
      costUsd: s.totalCostUsd,
      totalCostUsd: s.totalCostUsd,
      tokensIn: s.tokensIn,
      tokensOut: s.tokensOut,
      activeSubagents: s.activeSubagents,
      lastActivity: s.lastActivity,
      label: s.label,
      userMessages: s.userMessages,
    };
  }

  /**
   * If the session still carries a default agent-modal name (e.g. "Claude
   * Code"), rename it from the first user prompt. Mirrors the auto-rename
   * branch of the old UserPromptSubmit HTTP receiver.
   */
  private maybeRenameFromFirstPrompt(sessionId: string, prompt: string): void {
    const row = getSessionById(sessionId);
    if (!row) return;
    if (!AGENT_DEFAULT_NAMES.has(row.name)) return;
    const title = titleFromFirstPrompt(prompt);
    if (!title) return;
    try {
      const updated = updateSession(sessionId, { name: title });
      if (updated) {
        // server.ts subscribes to `session-updated` and broadcasts as
        // `session:updated` with the row payload. Re-fetch to attach the
        // freshly-renamed row.
        this.emit('session-renamed', { sessionId });
      }
    } catch (err) {
      console.error('[agent] maybeRenameFromFirstPrompt failed:', err);
    }
  }

  /**
   * Fire-and-forget: run the labeler + option-detection on Stop. Mirrors the
   * /stop receiver branch — option detection reads the JSONL the SDK just
   * wrote, label generation reads in-memory userMessages.
   */
  private async runStopWork(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    // Option detection — only meaningful once we have a claudeSessionId.
    if (s.claudeSessionId) {
      try {
        const result = await detectOptions(s.workingDir, s.claudeSessionId);
        if (result) {
          this.emit('options-detected', { sessionId, options: result.options });
        }
      } catch {
        // best-effort — JSONL may not have flushed yet
      }
    }

    // Label generation — first label only, then stick.
    if (!s.label && s.userMessages.length > 0) {
      try {
        const label = await generateSessionLabel(s.userMessages);
        if (label) {
          s.label = label;
          this.emit('label-updated', { sessionId, label });
        }
      } catch {
        // best-effort
      }
    }
  }

  /**
   * Build the SDK hook map for a single session. Replaces the HTTP webhook
   * receiver wholesale: all hook-driven side effects (currentTool tracking,
   * toolCount, subagent counts, auto-rename, labeler, option detection,
   * notifications, session-end broadcast) run as in-process callbacks here.
   *
   * Every callback returns `{ continue: true }` so the SDK never gates on
   * our state-tracking — permissions still flow through canUseTool.
   */
  private makeHooks(sessionId: string): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
    const onPre: HookCallback = async (input) => {
      const s = this.sessions.get(sessionId);
      const tn = (input as { tool_name?: unknown })?.tool_name;
      if (s && typeof tn === 'string' && tn !== 'AskUserQuestion') {
        s.currentTool = tn;
        s.lastActivity = Date.now();
      }
      return { continue: true };
    };

    const onPost: HookCallback = async () => {
      const s = this.sessions.get(sessionId);
      if (!s) return { continue: true };
      s.toolCount++;
      s.currentTool = null;
      s.lastActivity = Date.now();
      // Cost from inline usage: PostToolUse arrives before the SDK's `result`
      // message; canonical totals come from `result` in handleSdkMessage.
      // Skip per-tool cost accumulation here to avoid double-counting.
      this.emit('state-snapshot', { sessionId, snapshot: this.snapshotStats(s) });
      return { continue: true };
    };

    const onUserPrompt: HookCallback = async () => {
      const s = this.sessions.get(sessionId);
      if (!s) return { continue: true };
      // sendTurn pushes the user's text into s.userMessages BEFORE query()
      // runs, so `length === 1` means "this is the first prompt of the
      // session" — the auto-rename trigger.
      if (s.userMessages.length === 1) {
        this.maybeRenameFromFirstPrompt(sessionId, s.userMessages[0]);
      }
      return { continue: true };
    };

    const onStop: HookCallback = async () => {
      void this.runStopWork(sessionId);
      return { continue: true };
    };

    const onSubStart: HookCallback = async () => {
      const s = this.sessions.get(sessionId);
      if (s) {
        s.activeSubagents++;
        s.lastActivity = Date.now();
        this.emit('state-snapshot', { sessionId, snapshot: this.snapshotStats(s) });
      }
      return { continue: true };
    };

    const onSubStop: HookCallback = async () => {
      const s = this.sessions.get(sessionId);
      if (s) {
        s.activeSubagents = Math.max(0, s.activeSubagents - 1);
        s.lastActivity = Date.now();
        this.emit('state-snapshot', { sessionId, snapshot: this.snapshotStats(s) });
      }
      return { continue: true };
    };

    const onNotification: HookCallback = async (input) => {
      this.emit('notification', { sessionId, payload: input });
      return { continue: true };
    };

    const onSessionStart: HookCallback = async () => {
      return { continue: true };
    };

    const onSessionEnd: HookCallback = async () => {
      this.emit('session-ended', { sessionId });
      return { continue: true };
    };

    return {
      PreToolUse: [{ hooks: [onPre] }],
      PostToolUse: [{ hooks: [onPost] }],
      UserPromptSubmit: [{ hooks: [onUserPrompt] }],
      Stop: [{ hooks: [onStop] }],
      SubagentStart: [{ hooks: [onSubStart] }],
      SubagentStop: [{ hooks: [onSubStop] }],
      Notification: [{ hooks: [onNotification] }],
      SessionStart: [{ hooks: [onSessionStart] }],
      SessionEnd: [{ hooks: [onSessionEnd] }],
    };
  }
}
