import { Router } from 'express';
import type { Request, Response } from 'express';
import simpleGit from 'simple-git';
import {
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  getAllSessions,
  getSessionCostAggregate,
} from '../db/store.js';
import { parseSessionCost } from '../hooks/costParser.js';
import { parseSessionPrompts, parseAllProjectPrompts } from '../hooks/promptsParser.js';
import { parseTranscript, getSessionJsonlPath } from '../transcripts/parser.js';
import { createAttachmentHandler, rawAttachmentBody, removeAttachmentDir } from './attachments.js';
import type { AgentSessionManager } from '../agent/manager.js';

export function createSessionsRouter(agentManager: AgentSessionManager): Router {
  const router = Router();

  const attachmentHandler = createAttachmentHandler({
    resolve: (id) => (getSessionById(id) ? id : null),
  });

  // POST /api/sessions/:id/attachments — upload a single image as raw body.
  router.post('/:id/attachments', rawAttachmentBody, attachmentHandler);

  // GET /api/sessions
  router.get('/', (_req: Request, res: Response) => {
    const sessions = getAllSessions();
    const enriched = sessions.map((s) => {
      // Sessions no longer spawn a PTY; state lives in the AgentSessionManager.
      // pid is always null for sessions now.
      const agent = agentManager.get(s.id);
      return { ...s, state: agent?.state ?? 'stopped', pid: null };
    });
    res.json(enriched);
  });

  // GET /api/sessions/:id
  router.get('/:id', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const agent = agentManager.get(session.id);
    res.json({ ...session, state: agent?.state ?? 'stopped', pid: null });
  });

  // POST /api/sessions
  router.post('/', (req: Request, res: Response) => {
    const {
      projectId,
      name,
      command,
      workingDirectory,
      autostart,
      autorestart,
      autorestartMax,
      autorestartDelayMs,
      autorestartWindowSecs,
      autorespawn,
      terminalAlerts,
      fileWatchPatterns,
    } = req.body || {};

    if (!projectId || !name || !command) {
      return res.status(400).json({ error: 'projectId, name, and command are required' });
    }

    try {
      const session = createSession({
        projectId,
        name,
        command,
        workingDirectory,
        type: 'session',
        autostart,
        autorestart,
        autorestartMax,
        autorestartDelayMs,
        autorestartWindowSecs,
        autorespawn,
        terminalAlerts,
        fileWatchPatterns,
      });
      // Register immediately so the next `session:send` from the UI doesn't
      // race the DB write with the agent manager's lookup.
      agentManager.register({
        id: session.id,
        projectId: session.projectId,
        name: session.name,
        workingDir: session.workingDirectory || '',
        claudeSessionId: session.claudeSessionId ?? null,
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // PUT /api/sessions/:id
  router.put('/:id', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const updated = updateSession(req.params.id, req.body);
    res.json(updated);
  });

  // DELETE /api/sessions/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    deleteSession(req.params.id);
    // Clean up in-memory agent state + any in-flight turn.
    agentManager.remove(req.params.id);
    removeAttachmentDir(req.params.id);
    res.status(204).send();
  });

  // GET /api/sessions/:id/cost
  //
  // Phase 7 lookup order:
  //   1. In-memory AgentSessionManager totals (live; populated by SDK `result`
  //      messages within the current daemon process).
  //   2. JSONL parse (real-time on disk; covers cold-start / pre-Phase-2
  //      sessions whose totals haven't been observed by this daemon).
  //   3. DB aggregate (final fallback for sessions without a JSONL).
  router.get('/:id/cost', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // 1. In-memory totals — preferred when the daemon has observed any usage
    //    for this session this run.
    const agent = agentManager.get(req.params.id);
    if (agent && (agent.tokensIn > 0 || agent.tokensOut > 0 || agent.totalCostUsd > 0)) {
      return res.json({
        tokensIn: agent.tokensIn,
        tokensOut: agent.tokensOut,
        cacheCreationTokens: agent.cacheCreationTokens,
        cacheReadTokens: agent.cacheReadTokens,
        costUsd: agent.totalCostUsd,
        model: '', // model isn't tracked at session level today
        messageCount: 0,
      });
    }

    // 2. JSONL fallback — covers cold-start / pre-Phase-2 sessions.
    if (session.claudeSessionId && session.workingDirectory) {
      try {
        const jsonlCost = parseSessionCost(session.workingDirectory, session.claudeSessionId);
        if (jsonlCost) {
          return res.json({
            tokensIn: jsonlCost.tokensIn,
            tokensOut: jsonlCost.tokensOut,
            cacheCreationTokens: jsonlCost.cacheCreationTokens,
            cacheReadTokens: jsonlCost.cacheReadTokens,
            costUsd: jsonlCost.costUsd,
            model: jsonlCost.model,
            messageCount: jsonlCost.messageCount,
          });
        }
      } catch {}
    }

    // 3. DB aggregate.
    const cost = getSessionCostAggregate(req.params.id);
    res.json({ ...cost, cacheCreationTokens: 0, cacheReadTokens: 0, model: '', messageCount: 0 });
  });

  // GET /api/sessions/:id/prompts — all user prompts in the session.
  // Three-tier lookup:
  //   1. The session's own JSONL by claudeSessionId (exact match).
  //   2. Scan every JSONL in the project's encoded Claude projects dir,
  //      filtered to entries whose cwd matches the session's workingDir.
  //      Picks up ancestors and resumed-from sessions whose prompts live
  //      in a different file than the current claudeSessionId.
  //   3. In-memory userMessages (fallback for brand-new sessions).
  router.get('/:id/prompts', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.claudeSessionId && session.workingDirectory) {
      try {
        const prompts = parseSessionPrompts(session.workingDirectory, session.claudeSessionId);
        if (prompts.length > 0) {
          return res.json({ prompts, source: 'jsonl' });
        }
      } catch {}
    }

    if (session.workingDirectory) {
      try {
        const prompts = parseAllProjectPrompts(session.workingDirectory);
        if (prompts.length > 0) {
          return res.json({ prompts, source: 'jsonl-project' });
        }
      } catch {}
    }

    const agent = agentManager.get(req.params.id);
    const fallback = (agent?.userMessages ?? []).map((text) => ({ text, timestamp: null }));
    res.json({ prompts: fallback, source: 'memory' });
  });

  // GET /api/sessions/:id/messages — full parsed conversation from JSONL.
  // Returns an empty array if the session has no claudeSessionId yet or the
  // transcript file hasn't been created. The endOffset allows callers to tail
  // the file from that point via the WS session:transcript-delta event.
  router.get('/:id/messages', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!session.claudeSessionId || !session.workingDirectory) {
      return res.json({ messages: [], endOffset: 0 });
    }
    try {
      const jsonlPath = getSessionJsonlPath(session.workingDirectory, session.claudeSessionId);
      const { messages, endOffset } = parseTranscript(jsonlPath, 0);
      res.json({ messages, endOffset });
    } catch {
      res.json({ messages: [], endOffset: 0 });
    }
  });

  // POST /api/sessions/:id/stop
  //
  // Canonical lifecycle endpoint: aborts any in-flight turn for the session.
  // There is no PTY to kill; this is purely a cancel for the current query()
  // call. Sending a new turn (POST .../turn or ws session:send) re-engages the
  // SDK; there is no separate "start" or "restart" action.
  router.post('/:id/stop', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    agentManager.abortTurn(req.params.id);
    res.json({ ok: true });
  });

  // GET /api/sessions/:id/diff
  router.get('/:id/diff', async (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const workingDir = session.workingDirectory;
    if (!workingDir) return res.status(400).json({ error: 'Session has no working directory' });

    try {
      const git = simpleGit(workingDir);
      const diff = await git.diff();
      res.json({ diff });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get diff' });
    }
  });

  return router;
}
