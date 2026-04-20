import { EventEmitter } from 'events';
import path from 'path';
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

// Tool inputs whose path argument we check against cwd before auto-deferring.
// If the path resolves outside cwd, we surface a card to the web UI instead of
// silently allowing — this is the path that attachments take, since they live
// in the multitable data dir, not under the project working directory.
const PATH_FIELDS_BY_TOOL: Record<string, string> = {
  Read: 'file_path',
  Grep: 'path',
  Glob: 'path',
  LS: 'path',
};

function pathInsideCwd(toolName: string, toolInput: Record<string, any>, cwd: string): boolean {
  const field = PATH_FIELDS_BY_TOOL[toolName];
  if (!field) return true; // tool has no path arg → nothing to gate
  const raw = toolInput?.[field];
  if (typeof raw !== 'string' || raw.length === 0) return true; // path arg absent
  if (!cwd) return true; // we don't know the cwd → fall back to auto-defer
  const abs = path.resolve(cwd, raw);
  const rel = path.relative(cwd, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

type HookEventName = 'PreToolUse' | 'PermissionRequest';

interface PendingPermission {
  prompt: PermissionPrompt;
  // Multiple held-open HTTP responses can attach to the same prompt when
  // Claude Code retries the hook (or parallel agents request the same tool).
  // Each responder carries the event name it arrived from, because PreToolUse
  // and PermissionRequest expect different response shapes — even when they
  // describe the same underlying tool call we coalesced via dedup.
  responders: Array<{ res: Response; eventName: HookEventName }>;
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

// Claude Code's PreToolUse and PermissionRequest hooks use different response
// shapes. PreToolUse expects `hookSpecificOutput.permissionDecision`, while
// PermissionRequest expects `hookSpecificOutput.decision.behavior`. Both fields
// are nested under `hookSpecificOutput.hookEventName` matching the source event.
function buildAllowBody(eventName: HookEventName, updatedInput?: Record<string, any>): Record<string, any> {
  if (eventName === 'PermissionRequest') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          ...(updatedInput ? { updatedInput } : {}),
        },
      },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      ...(updatedInput ? { updatedInput } : {}),
    },
  };
}

function buildDenyBody(eventName: HookEventName, reason?: string): Record<string, any> {
  if (eventName === 'PermissionRequest') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
          ...(reason ? { message: reason } : {}),
        },
      },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      ...(reason ? { permissionDecisionReason: reason } : {}),
    },
  };
}

function sendAll(
  entry: PendingPermission,
  build: (eventName: HookEventName) => Record<string, any>
): void {
  for (const r of entry.responders) {
    try { r.res.json(build(r.eventName)); } catch {}
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

// Format the user's AskUserQuestion answers into a hook response. We deny
// the tool call and feed the answer back as the deny reason — Claude Code
// cancels the native AskUserQuestion tool (we don't want its in-terminal UI
// to run) and Claude reads the reason as the user's answer and proceeds.
// Only PreToolUse fires for AskUserQuestion (it's a tool call, not a
// permission dialog), so we always emit the PreToolUse shape.
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
  return buildDenyBody('PreToolUse', reason);
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
    sessionId: string,
    cwd: string
  ): void {
    this.handleHook('PreToolUse', hookData, res, sessionId, cwd);
  }

  /**
   * Handle a PermissionRequest hook call. This fires when Claude Code is about
   * to show its built-in permission dialog (e.g. for paths outside cwd) —
   * sometimes for tool calls that PreToolUse already approved. We surface the
   * same Allow/Deny card to the web UI and reply with the PermissionRequest
   * response shape (`hookSpecificOutput.decision.behavior`) when the user picks.
   */
  handlePermissionRequest(
    hookData: { tool_name: string; tool_input: Record<string, any>; session_id: string },
    res: Response,
    sessionId: string,
    cwd: string
  ): void {
    this.handleHook('PermissionRequest', hookData, res, sessionId, cwd);
  }

  private handleHook(
    eventName: HookEventName,
    hookData: { tool_name: string; tool_input: Record<string, any>; session_id: string },
    res: Response,
    sessionId: string,
    cwd: string
  ): void {
    const { tool_name, tool_input, session_id: claudeSessionId } = hookData;
    const input = tool_input || {};

    // AskUserQuestion is a structured question payload, not a permission
    // gate. Don't auto-defer or auto-allow it — always surface to the web UI
    // so we can render a proper radio/checkbox interface. (Only meaningful
    // for PreToolUse; PermissionRequest never fires for AskUserQuestion.)
    const isAskQuestion = tool_name === 'AskUserQuestion';

    // Auto-defer safe read-only tools — but only when the path argument
    // (if any) resolves inside the session cwd. Paths outside cwd (e.g.
    // attachment uploads in ~/.local/share/multitable/...) get surfaced to
    // the web UI so the user can explicitly approve them.
    const insideCwd = pathInsideCwd(tool_name, input, cwd);

    if (!isAskQuestion && this.autoDeferTools.has(tool_name) && insideCwd) {
      res.json(buildAllowBody(eventName));
      return;
    }

    // Honor prior "always allow" decisions for this session + tool. These
    // ignore the cwd check — the user explicitly opted in for this tool.
    if (!isAskQuestion && this.sessionAllowList.get(sessionId)?.has(tool_name)) {
      res.json(buildAllowBody(eventName));
      return;
    }

    // Dedup: if an identical prompt is already pending for this session,
    // attach this HTTP response to it instead of creating a second card.
    const dedupKey = makeDedupKey(sessionId, tool_name, input);
    for (const entry of this.pending.values()) {
      if (entry.dedupKey === dedupKey) {
        entry.responders.push({ res, eventName });
        return;
      }
    }

    const id = uuidv4();
    const prompt: PermissionPrompt = {
      id,
      sessionId,
      claudeSessionId: claudeSessionId || '',
      toolName: tool_name,
      toolInput: input,
      createdAt: Date.now(),
      timeoutMs: TIMEOUT_MS,
      ...(isAskQuestion
        ? {
            kind: 'ask-question' as const,
            questions: parseAskQuestions(input),
          }
        : { kind: 'permission' as const }),
    };

    const timer = setTimeout(() => {
      this.expire(id);
    }, TIMEOUT_MS);

    this.pending.set(id, {
      prompt,
      responders: [{ res, eventName }],
      timer,
      sessionId,
      dedupKey,
    });
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
      sendAll(entry, (eventName) => buildAllowBody(eventName, updatedInput));
    } else {
      sendAll(entry, (eventName) => buildDenyBody(eventName));
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

    const body = buildAskQuestionResponse(entry.prompt, answers);
    sendAll(entry, () => body);
    this.emit('permission:resolved', id);
  }

  private expire(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    this.pending.delete(id);
    // On timeout, auto-approve to not block Claude
    sendAll(entry, (eventName) => buildAllowBody(eventName));

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
        sendAll(entry, (eventName) => buildAllowBody(eventName));
        this.pending.delete(id);
        this.emit('permission:resolved', id);
      }
    }
    this.sessionAllowList.delete(sessionId);
  }
}
