import { Router } from 'express';
import type { Request, Response } from 'express';
import type { PtyManager } from '../pty/manager.js';
import type { PermissionManager } from './permissionManager.js';
import {
  getSessionByClaudeId,
  updateSession,
  insertCostRecord,
  insertSessionEvent,
} from '../db/store.js';
import { generateSessionLabel } from './labeler.js';
import { detectOptions } from './optionDetector.js';
import type { ClaudeSessionState } from '../types.js';

// In-memory claude session states, keyed by multitable session ID
const claudeStates = new Map<string, ClaudeSessionState>();

export function getClaudeState(sessionId: string): ClaudeSessionState | undefined {
  return claudeStates.get(sessionId);
}

export function ensureClaudeState(sessionId: string): ClaudeSessionState {
  if (!claudeStates.has(sessionId)) {
    claudeStates.set(sessionId, {
      claudeSessionId: null,
      currentTool: null,
      toolCount: 0,
      tokenCount: 0,
      lastActivity: Date.now(),
      activeSubagents: 0,
      userMessages: [],
      label: null,
    });
  }
  return claudeStates.get(sessionId)!;
}

export function createHooksRouter(
  manager: PtyManager,
  permManager: PermissionManager,
  broadcast: (type: string, payload: any) => void
): Router {
  const router = Router();

  // Helper: find session by claude session ID
  function findSessionByClaudeId(claudeSessionId: string): string | null {
    const session = getSessionByClaudeId(claudeSessionId);
    return session?.id ?? null;
  }

  // PreToolUse — hold response open for permission gate
  router.post('/pre-tool-use', (req: Request, res: Response) => {
    const { tool_name, tool_input, session_id } = req.body || {};
    if (!tool_name) {
      res.json({ approved: true });
      return;
    }

    const sessionId = findSessionByClaudeId(session_id) || '';
    const state = ensureClaudeState(sessionId);
    state.currentTool = tool_name;
    state.lastActivity = Date.now();

    permManager.handlePreToolUse(
      { tool_name, tool_input: tool_input || {}, session_id: session_id || '' },
      res,
      sessionId
    );
  });

  // PostToolUse — update state and cost records
  router.post('/post-tool-use', (req: Request, res: Response) => {
    const { tool_name, tool_result, session_id, usage } = req.body || {};
    const sessionId = findSessionByClaudeId(session_id) || '';

    if (sessionId) {
      const state = ensureClaudeState(sessionId);
      state.toolCount++;
      state.lastActivity = Date.now();
      state.currentTool = null;

      if (usage) {
        const tokensIn = usage.input_tokens || 0;
        const tokensOut = usage.output_tokens || 0;
        const costUsd = usage.cost_usd || 0;
        state.tokenCount += tokensIn + tokensOut;

        if (tokensIn + tokensOut > 0) {
          try {
            insertCostRecord({
              sessionId,
              tokensIn,
              tokensOut,
              costUsd,
              model: usage.model,
            });
          } catch {}
        }
      }

      broadcast('session:state-updated', { sessionId, state: { ...state } });
    }

    res.json({});
  });

  // Stop — session turn complete
  router.post('/stop', async (req: Request, res: Response) => {
    const { session_id, stop_reason } = req.body || {};
    const sessionId = findSessionByClaudeId(session_id) || '';

    if (sessionId) {
      const state = ensureClaudeState(sessionId);
      state.currentTool = null;
      state.lastActivity = Date.now();

      broadcast('session:state-updated', { sessionId, state: { ...state } });

      // Detect options in last assistant message
      const session = getSessionByClaudeId(session_id);
      if (session && session.claudeSessionId) {
        detectOptions(session.workingDirectory || '', session.claudeSessionId)
          .then((result) => {
            if (result) {
              broadcast('session:options-detected', { sessionId, options: result.options });
            }
          })
          .catch(() => {});
      }

      // Trigger label generation if we have user messages and no label yet
      if (state.userMessages.length > 0 && !state.label) {
        generateSessionLabel(state.userMessages)
          .then((label) => {
            if (label) {
              state.label = label;
              broadcast('session:label-updated', { sessionId, label });
            }
          })
          .catch(() => {});
      }
    }

    res.json({});
  });

  // SessionStart
  router.post('/session-start', (req: Request, res: Response) => {
    console.log('[hooks] session-start received:', JSON.stringify(req.body));
    const { session_id } = req.body || {};
    let sessionId = findSessionByClaudeId(session_id) || '';

    // If no match by claudeSessionId (first time), find the running session
    // process that hasn't been linked to a Claude session yet.
    if (!sessionId && session_id) {
      for (const proc of manager.getAll()) {
        if (proc.type === 'session' && proc.state === 'running') {
          const existingState = claudeStates.get(proc.id);
          if (!existingState || !existingState.claudeSessionId) {
            sessionId = proc.id;
            break;
          }
        }
      }
    }

    if (sessionId && session_id) {
      // Link claude session ID to our session
      updateSession(sessionId, { claudeSessionId: session_id });
      const state = ensureClaudeState(sessionId);
      state.claudeSessionId = session_id;
      state.lastActivity = Date.now();
      broadcast('session:started', { sessionId, claudeSessionId: session_id });
    } else if (session_id) {
      // New session — just track it
      ensureClaudeState(session_id);
    }

    res.json({});
  });

  // SessionEnd
  router.post('/session-end', (req: Request, res: Response) => {
    const { session_id } = req.body || {};
    const sessionId = findSessionByClaudeId(session_id) || '';

    if (sessionId) {
      const state = ensureClaudeState(sessionId);
      state.lastActivity = Date.now();
      broadcast('session:ended', { sessionId, claudeSessionId: session_id });

      try {
        insertSessionEvent(sessionId, 'session-end', { claudeSessionId: session_id });
      } catch {}
    }

    res.json({});
  });

  // SubagentStart
  router.post('/subagent-start', (req: Request, res: Response) => {
    const { session_id, parent_session_id } = req.body || {};
    const parentSessionId = findSessionByClaudeId(parent_session_id || session_id) || '';

    if (parentSessionId) {
      const state = ensureClaudeState(parentSessionId);
      state.activeSubagents++;
      state.lastActivity = Date.now();
      broadcast('session:state-updated', { sessionId: parentSessionId, state: { ...state } });
    }

    res.json({});
  });

  // SubagentStop
  router.post('/subagent-stop', (req: Request, res: Response) => {
    const { session_id, parent_session_id } = req.body || {};
    const parentSessionId = findSessionByClaudeId(parent_session_id || session_id) || '';

    if (parentSessionId) {
      const state = ensureClaudeState(parentSessionId);
      state.activeSubagents = Math.max(0, state.activeSubagents - 1);
      state.lastActivity = Date.now();
      broadcast('session:state-updated', { sessionId: parentSessionId, state: { ...state } });
    }

    res.json({});
  });

  // UserPromptSubmit — capture user messages for labeling
  router.post('/user-prompt-submit', (req: Request, res: Response) => {
    const { session_id, prompt } = req.body || {};
    const sessionId = findSessionByClaudeId(session_id) || '';

    if (sessionId && prompt) {
      const state = ensureClaudeState(sessionId);
      state.userMessages.push(prompt);
      state.lastActivity = Date.now();
      // Limit stored messages
      if (state.userMessages.length > 20) {
        state.userMessages = state.userMessages.slice(-20);
      }
    }

    res.json({});
  });

  return router;
}
