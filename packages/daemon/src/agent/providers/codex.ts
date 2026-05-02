import type { Thread, ThreadEvent, ThreadItem } from '@openai/codex-sdk';
import type { AgentSession } from '../types.js';
import type { Message } from '../../transcripts/parser.js';
import type { ProviderAdapter, AdapterCallbacks } from './types.js';

// CodexAdapter wraps @openai/codex-sdk. The SDK is a subprocess wrapper that
// spawns `codex exec --experimental-json` per turn and streams JSONL events
// back. Key constraints baked into this adapter:
//
// - approvalPolicy MUST be 'never'. The SDK closes child stdin immediately
//   after writing the prompt and exposes no host-side approval callback, so
//   any other policy will hang or auto-fail. Tool gating happens via
//   sandboxMode + additionalDirectories + networkAccessEnabled.
// - Each runStreamed() call is a fresh subprocess. We cache the Thread
//   instance per multitable session id because Thread holds the codex
//   thread_id used to resume on subsequent turns. The cache is rebuilt from
//   the DB on daemon restart.
// - Codex emits item-level events (item.started/updated/completed). For
//   agent_message updates, the item text is the current partial response; we
//   forward that through the shared assistant-delta channel and keep
//   item.completed as the canonical final message.
export class CodexAdapter implements ProviderAdapter {
  readonly name = 'codex' as const;

  private codex: {
    startThread: (options?: Record<string, unknown>) => Thread;
    resumeThread: (id: string, options?: Record<string, unknown>) => Thread;
  } | null = null;
  private codexLoad: Promise<CodexAdapter['codex']> | null = null;
  private threads = new Map<string, Thread>();

  reset(s: AgentSession): void {
    this.threads.delete(s.id);
  }

  async runTurn(
    s: AgentSession,
    text: string,
    ctrl: AbortController,
    cb: AdapterCallbacks,
  ): Promise<void> {
    if (s.userMessages.length === 1) cb.maybeRenameFromFirstPrompt(text);
    const thread = await this.getThread(s);
    const { events } = await thread.runStreamed(text, { signal: ctrl.signal });
    for await (const event of events) {
      this.handleEvent(s, event, cb);
    }
  }

  private async getClient(): Promise<NonNullable<CodexAdapter['codex']>> {
    if (this.codex) return this.codex;
    if (!this.codexLoad) {
      this.codexLoad = (async () => {
        // The daemon is compiled as CommonJS but @openai/codex-sdk is
        // ESM-only. Wrap the import in `new Function` so TypeScript doesn't
        // rewrite it to require().
        const mod = (await new Function('specifier', 'return import(specifier)')(
          '@openai/codex-sdk',
        )) as typeof import('@openai/codex-sdk');
        this.codex = new mod.Codex();
        return this.codex;
      })();
    }
    return this.codexLoad as Promise<NonNullable<CodexAdapter['codex']>>;
  }

  private async getThread(s: AgentSession): Promise<Thread> {
    const existing = this.threads.get(s.id);
    if (existing) return existing;
    const codex = await this.getClient();
    const opts: Record<string, unknown> = {
      workingDirectory: s.workingDir,
      sandboxMode: 'workspace-write' as const,
      approvalPolicy: 'never' as const,
      skipGitRepoCheck: true,
    };
    // The Codex SDK forwards unknown option keys to the spawned `codex exec`
    // child as CLI flags, and `model` is the documented flag name (-m,
    // --model). Setting it per-thread means the user's pick from the
    // AddAgentModal is honored on every turn without depending on
    // ~/.codex/config.toml.
    if (s.model) opts.model = s.model;
    const thread = s.agentSessionId
      ? codex.resumeThread(s.agentSessionId, opts)
      : codex.startThread(opts);
    this.threads.set(s.id, thread);
    return thread;
  }

  private handleEvent(s: AgentSession, event: ThreadEvent, cb: AdapterCallbacks): void {
    const now = Date.now();
    switch (event.type) {
      case 'thread.started': {
        const newId = event.thread_id;
        if (newId && newId !== s.agentSessionId) {
          const previous = s.agentSessionId;
          const nextHistory =
            previous && !s.agentSessionIdHistory.includes(previous)
              ? [...s.agentSessionIdHistory, previous]
              : s.agentSessionIdHistory;
          cb.onSessionIdAssigned(newId, nextHistory);
          cb.emitStateSnapshot();
        }
        return;
      }
      case 'item.started':
      case 'item.updated': {
        this.updateAssistantDelta(event.item, cb);
        this.updateCurrentTool(event.item, cb);
        return;
      }
      case 'item.completed': {
        const messages = this.itemToMessages(event.item, now);
        if (messages.length > 0) {
          cb.pushMessages(messages);
          if (messages.some((m) => m.kind === 'assistant')) {
            cb.emitAssistantMessage(messages);
            cb.emitAssistantDelta('');
          } else {
            cb.emitToolEvent(messages);
          }
        }
        cb.setCurrentTool(null);
        cb.bumpActivity();
        cb.emitStateSnapshot();
        return;
      }
      case 'turn.completed': {
        const u = event.usage;
        const tokensIn = u.input_tokens + u.cached_input_tokens;
        const tokensOut = u.output_tokens + u.reasoning_output_tokens;
        cb.applyUsage({
          tokensIn,
          tokensOut,
          cacheCreationTokens: 0,
          cacheReadTokens: u.cached_input_tokens,
          costUsd: 0,
        });
        cb.emitTurnResult({
          subtype: 'success',
          totalCostUsd: 0,
          usage: {
            inputTokens: u.input_tokens,
            outputTokens: u.output_tokens,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: u.cached_input_tokens,
          },
          text: null,
        });
        cb.bumpActivity();
        cb.emitStateSnapshot();
        return;
      }
      case 'turn.failed': {
        throw new Error(event.error.message || 'Codex turn failed');
      }
      case 'error': {
        throw new Error(event.message || 'Codex stream failed');
      }
      default:
        return;
    }
  }

  private updateAssistantDelta(item: ThreadItem, cb: AdapterCallbacks): void {
    if (item.type !== 'agent_message') return;
    cb.emitAssistantDelta(item.text);
    cb.bumpActivity();
  }

  private updateCurrentTool(item: ThreadItem, cb: AdapterCallbacks): void {
    let toolName: string | null = null;
    if (item.type === 'command_execution') toolName = 'Command';
    else if (item.type === 'file_change') toolName = 'Patch';
    else if (item.type === 'mcp_tool_call') toolName = `${item.server}.${item.tool}`;
    else if (item.type === 'web_search') toolName = 'WebSearch';
    if (!toolName) return;
    cb.setCurrentTool(toolName);
    cb.bumpActivity();
    cb.emitStateSnapshot();
  }

  private itemToMessages(item: ThreadItem, ts: number): Message[] {
    switch (item.type) {
      case 'agent_message':
        return [{ id: item.id, ts, kind: 'assistant', text: item.text, model: 'codex' }];
      case 'reasoning':
        return item.text.trim()
          ? [{ id: item.id, ts, kind: 'system', text: `Reasoning: ${item.text}` }]
          : [];
      case 'command_execution':
        return [
          {
            id: `${item.id}-use`,
            ts,
            kind: 'tool_use',
            parentId: item.id,
            toolUseId: item.id,
            toolName: 'Command',
            input: { command: item.command },
          },
          {
            id: `${item.id}-result`,
            ts,
            kind: 'tool_result',
            toolUseId: item.id,
            output:
              item.aggregated_output ||
              (item.exit_code === undefined ? 'Command started.' : `Exit code ${item.exit_code}`),
            isError: item.status === 'failed',
          },
        ];
      case 'file_change':
        return [
          {
            id: `${item.id}-use`,
            ts,
            kind: 'tool_use',
            parentId: item.id,
            toolUseId: item.id,
            toolName: 'Patch',
            input: { changes: item.changes },
          },
          {
            id: `${item.id}-result`,
            ts,
            kind: 'tool_result',
            toolUseId: item.id,
            output: item.changes.map((c) => `${c.kind}: ${c.path}`).join('\n'),
            isError: item.status === 'failed',
          },
        ];
      case 'mcp_tool_call': {
        const result = item.error?.message ?? (item.result ? JSON.stringify(item.result, null, 2) : '');
        return [
          {
            id: `${item.id}-use`,
            ts,
            kind: 'tool_use',
            parentId: item.id,
            toolUseId: item.id,
            toolName: `${item.server}.${item.tool}`,
            input: item.arguments ?? {},
          },
          {
            id: `${item.id}-result`,
            ts,
            kind: 'tool_result',
            toolUseId: item.id,
            output: result,
            isError: item.status === 'failed',
          },
        ];
      }
      case 'web_search':
        return [
          {
            id: `${item.id}-use`,
            ts,
            kind: 'tool_use',
            parentId: item.id,
            toolUseId: item.id,
            toolName: 'WebSearch',
            input: { query: item.query },
          },
        ];
      case 'todo_list':
        return [
          {
            id: item.id,
            ts,
            kind: 'system',
            text: item.items.map((todo) => `${todo.completed ? '[x]' : '[ ]'} ${todo.text}`).join('\n'),
          },
        ];
      case 'error':
        return [{ id: item.id, ts, kind: 'system', text: item.message }];
      default:
        return [];
    }
  }
}
