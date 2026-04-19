import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import type { PermissionPrompt, AskQuestion } from '../types.js';

const TIMEOUT_MS = 110000;

// Tools that are always approved without prompting the user
const AUTO_DEFER_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
  'TodoRead',
  'TodoGet',
  'WebSearch',
]);

interface PendingPermission {
  prompt: PermissionPrompt;
  // Multiple held-open HTTP responses can attach to the same prompt when
  // Claude Code retries the hook (or parallel agents request the same tool).
  responders: Response[];
  timer: NodeJS.Timeout;
  sessionId: string;
  dedupKey: string;
}

function makeDedupKey(sessionId: string, toolName: string, toolInput: Record<string, any>): string {
  let inputPart: string;
  try {
    inputPart = JSON.stringify(toolInput ?? {});
  } catch {
    inputPart = String(toolInput);
  }
  return `${sessionId}|${toolName}|${inputPart}`;
}

function sendAll(entry: PendingPermission, body: Record<string, any>): void {
  for (const r of entry.responders) {
    try { r.json(body); } catch {}
  }
}

function parseAskQuestions(toolInput: Record<string, any> | undefined): AskQuestion[] {
  const raw = toolInput?.questions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options))
    .map((q) => ({
      question: String(q.question),
      header: typeof q.header === 'string' ? q.header : undefined,
      multiSelect: Boolean(q.multiSelect),
      options: q.options
        .filter((o: any) => o && typeof o.label === 'string')
        .map((o: any) => ({
          label: String(o.label),
          description: typeof o.description === 'string' ? o.description : undefined,
          preview: typeof o.preview === 'string' ? o.preview : undefined,
        })),
    }));
}

// Format the user's AskUserQuestion answers into a hook response. We use
// the PreToolUse `permissionDecision: "deny"` path with a descriptive
// reason — Claude Code cancels the native AskUserQuestion tool (we don't
// want its in-terminal UI to run) and feeds the reason back to Claude as
// text. Claude reads this as the user's answer and proceeds.
function buildAskQuestionResponse(
  prompt: PermissionPrompt,
  answers: string[][]
): Record<string, any> {
  const questions = prompt.questions || [];
  const lines: string[] = [];

  questions.forEach((q, i) => {
    const picked = answers[i] || [];
    const header = q.header ? `[${q.header}] ` : '';
    lines.push(`${header}${q.question}`);
    if (picked.length === 0) {
      lines.push('  (no answer)');
    } else {
      for (const p of picked) lines.push(`  → ${p}`);
    }
  });

  const reason = `User answered AskUserQuestion in web UI:\n${lines.join('\n')}`;

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}

export type PermissionDecision = 'allow' | 'deny' | 'always-allow';

export class PermissionManager extends EventEmitter {
  private pending = new Map<string, PendingPermission>();
  private autoDeferTools: Set<string>;
  // Per-session "always allow" rules: sessionId -> set of tool names
  private sessionAllowList = new Map<string, Set<string>>();

  constructor(extraAutoDeferTools: string[] = []) {
    super();
    this.autoDeferTools = new Set([...AUTO_DEFER_TOOLS, ...extraAutoDeferTools]);
  }

  addAutoDeferTool(toolName: string): void {
    this.autoDeferTools.add(toolName);
  }

  setAutoDeferTools(tools: string[]): void {
    this.autoDeferTools = new Set([...AUTO_DEFER_TOOLS, ...tools]);
  }

  /**
   * Handle a PreToolUse hook call. Either auto-approves or holds the response open.
   */
  handlePreToolUse(
    hookData: { tool_name: string; tool_input: Record<string, any>; session_id: string },
    res: Response,
    sessionId: string
  ): void {
    const { tool_name, tool_input, session_id: claudeSessionId } = hookData;

    // AskUserQuestion is a structured question payload, not a permission
    // gate. Don't auto-defer or auto-allow it — always surface to the web UI
    // so we can render a proper radio/checkbox interface.
    const isAskQuestion = tool_name === 'AskUserQuestion';

    // Auto-defer safe read-only tools
    if (!isAskQuestion && this.autoDeferTools.has(tool_name)) {
      res.json({ approved: true });
      return;
    }

    // Honor prior "always allow" decisions for this session + tool
    if (!isAskQuestion && this.sessionAllowList.get(sessionId)?.has(tool_name)) {
      res.json({ approved: true });
      return;
    }

    // Dedup: if an identical prompt is already pending for this session,
    // attach this HTTP response to it instead of creating a second card.
    const dedupKey = makeDedupKey(sessionId, tool_name, tool_input || {});
    for (const entry of this.pending.values()) {
      if (entry.dedupKey === dedupKey) {
        entry.responders.push(res);
        return;
      }
    }

    const id = uuidv4();
    const prompt: PermissionPrompt = {
      id,
      sessionId,
      claudeSessionId: claudeSessionId || '',
      toolName: tool_name,
      toolInput: tool_input || {},
      createdAt: Date.now(),
      timeoutMs: TIMEOUT_MS,
      ...(isAskQuestion
        ? {
            kind: 'ask-question' as const,
            questions: parseAskQuestions(tool_input),
          }
        : { kind: 'permission' as const }),
    };

    const timer = setTimeout(() => {
      this.expire(id);
    }, TIMEOUT_MS);

    this.pending.set(id, { prompt, responders: [res], timer, sessionId, dedupKey });
    this.emit('permission:prompt', prompt);
  }

  /**
   * Respond to a pending permission prompt.
   */
  respond(id: string, decision: PermissionDecision, updatedInput?: Record<string, any>): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(id);

    if (decision === 'always-allow') {
      let set = this.sessionAllowList.get(entry.sessionId);
      if (!set) {
        set = new Set<string>();
        this.sessionAllowList.set(entry.sessionId, set);
      }
      set.add(entry.prompt.toolName);
    }

    const approved = decision === 'allow' || decision === 'always-allow';
    if (approved) {
      sendAll(entry, { approved: true, ...(updatedInput ? { tool_input: updatedInput } : {}) });
    } else {
      sendAll(entry, { approved: false });
    }

    this.emit('permission:resolved', id);
  }

  /**
   * Respond to a pending AskUserQuestion prompt with the user's selections.
   * `answers` is parallel to `prompt.questions` — one string array per
   * question containing the selected option labels.
   */
  respondAskQuestion(id: string, answers: string[][]): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    if (entry.prompt.kind !== 'ask-question') {
      // Fall back to plain approve; caller used the wrong method.
      this.respond(id, 'allow');
      return;
    }

    clearTimeout(entry.timer);
    this.pending.delete(id);

    sendAll(entry, buildAskQuestionResponse(entry.prompt, answers));
    this.emit('permission:resolved', id);
  }

  private expire(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    this.pending.delete(id);
    // On timeout, auto-approve to not block Claude
    sendAll(entry, { approved: true });

    this.emit('permission:expired', id);
  }

  getPending(): PermissionPrompt[] {
    return Array.from(this.pending.values()).map(e => e.prompt);
  }

  getPendingById(id: string): PermissionPrompt | null {
    return this.pending.get(id)?.prompt ?? null;
  }

  hasPending(sessionId: string): boolean {
    for (const entry of this.pending.values()) {
      if (entry.sessionId === sessionId) return true;
    }
    return false;
  }

  clearForSession(sessionId: string): void {
    for (const [id, entry] of this.pending) {
      if (entry.sessionId === sessionId) {
        clearTimeout(entry.timer);
        sendAll(entry, { approved: true });
        this.pending.delete(id);
        this.emit('permission:resolved', id);
      }
    }
    this.sessionAllowList.delete(sessionId);
  }
}
