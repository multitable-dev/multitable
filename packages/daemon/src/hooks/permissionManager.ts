import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import type { PermissionPrompt } from '../types.js';

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
  res: Response;
  timer: NodeJS.Timeout;
  sessionId: string;
}

export class PermissionManager extends EventEmitter {
  private pending = new Map<string, PendingPermission>();
  private autoDeferTools: Set<string>;

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

    // Auto-defer safe read-only tools
    if (this.autoDeferTools.has(tool_name)) {
      res.json({ approved: true });
      return;
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
    };

    const timer = setTimeout(() => {
      this.expire(id);
    }, TIMEOUT_MS);

    this.pending.set(id, { prompt, res, timer, sessionId });
    this.emit('permission:prompt', prompt);
  }

  /**
   * Respond to a pending permission prompt.
   */
  respond(id: string, approved: boolean, updatedInput?: Record<string, any>): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(id);

    if (approved) {
      entry.res.json({ approved: true, ...(updatedInput ? { tool_input: updatedInput } : {}) });
    } else {
      entry.res.json({ approved: false });
    }

    this.emit('permission:resolved', id);
  }

  private expire(id: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;

    this.pending.delete(id);
    // On timeout, auto-approve to not block Claude
    try {
      entry.res.json({ approved: true });
    } catch {}

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
        try { entry.res.json({ approved: true }); } catch {}
        this.pending.delete(id);
        this.emit('permission:resolved', id);
      }
    }
  }
}
