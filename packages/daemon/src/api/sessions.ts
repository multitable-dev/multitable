import { Router } from 'express';
import type { Request, Response } from 'express';
import simpleGit from 'simple-git';
import {
  getSessionById,
  createSession,
  updateSession,
  deleteSession,
  getAllSessions,
  getSessionsByProject,
  getSessionCostAggregate,
  insertSessionEvent,
} from '../db/store.js';
import { parseSessionCost } from '../hooks/costParser.js';
import { parseSessionPrompts, parseAllProjectPrompts } from '../hooks/promptsParser.js';
import { getClaudeState } from '../hooks/receiver.js';
import { createAttachmentHandler, rawAttachmentBody, removeAttachmentDir } from './attachments.js';
import type { PtyManager } from '../pty/manager.js';
import type { ProcessConfig, SpawnConfig } from '../types.js';

function defaultProcessConfig(overrides?: Partial<ProcessConfig>): ProcessConfig {
  return {
    autostart: false,
    autorestart: false,
    autorestartMax: 5,
    autorestartDelayMs: 2000,
    autorestartWindowSecs: 60,
    autorespawn: true,
    terminalAlerts: false,
    fileWatchPatterns: [],
    ...overrides,
  };
}

function buildClaudeCommand(workingDir: string, resume?: string): string {
  if (resume) {
    return `claude --resume ${resume}`;
  }
  return 'claude';
}

export function createSessionsRouter(manager: PtyManager): Router {
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
      const proc = manager.get(s.id);
      return { ...s, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // GET /api/sessions/:id
  router.get('/:id', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const proc = manager.get(session.id);
    res.json({ ...session, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null });
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

    // Stop if running
    const proc = manager.get(req.params.id);
    if (proc) manager.kill(req.params.id);

    deleteSession(req.params.id);
    removeAttachmentDir(req.params.id);
    res.status(204).send();
  });

  // GET /api/sessions/:id/cost
  router.get('/:id/cost', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Try to read cost from JSONL first (real-time, accurate)
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

    // Fallback to DB aggregate
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

    const state = getClaudeState(req.params.id);
    const fallback = (state?.userMessages ?? []).map((text) => ({ text, timestamp: null }));
    res.json({ prompts: fallback, source: 'memory' });
  });

  // POST /api/sessions/:id/start
  router.post('/:id/start', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const existing = manager.get(session.id);
    if (existing && existing.state === 'running') {
      return res.status(409).json({ error: 'Session is already running' });
    }

    const { cols, rows } = req.body || {};

    try {
      const spawnCfg: SpawnConfig = {
        id: session.id,
        name: session.name,
        command: session.command,
        workingDir: session.workingDirectory || '',
        type: 'session',
        projectId: session.projectId,
        config: defaultProcessConfig({
          autostart: session.autostart,
          autorestart: session.autorestart,
          autorestartMax: session.autorestartMax,
          autorestartDelayMs: session.autorestartDelayMs,
          autorestartWindowSecs: session.autorestartWindowSecs,
          autorespawn: session.autorespawn,
          terminalAlerts: session.terminalAlerts,
          fileWatchPatterns: session.fileWatchPatterns,
        }),
        cols: cols || 80,
        rows: rows || 24,
      };

      // Remove existing stopped process entry if present
      if (existing) manager.remove(session.id);

      const proc = manager.spawn(spawnCfg);
      res.json({ ok: true, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start session' });
    }
  });

  // POST /api/sessions/:id/stop
  router.post('/:id/stop', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    manager.kill(req.params.id);
    res.json({ ok: true });
  });

  // POST /api/sessions/:id/restart
  router.post('/:id/restart', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    manager.restart(req.params.id);
    res.json({ ok: true });
  });

  // POST /api/sessions/:id/spawn-claude
  // Spawn a new Claude Code session in the session's PTY
  router.post('/:id/spawn-claude', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { cols, rows } = req.body || {};
    const claudeCmd = buildClaudeCommand(session.workingDirectory || '');

    try {
      const existing = manager.get(session.id);
      if (existing) manager.remove(session.id);

      const spawnCfg: SpawnConfig = {
        id: session.id,
        name: session.name,
        command: claudeCmd,
        workingDir: session.workingDirectory || '',
        type: 'session',
        projectId: session.projectId,
        config: defaultProcessConfig({
          autorespawn: session.autorespawn,
        }),
        cols: cols || 80,
        rows: rows || 24,
      };

      const proc = manager.spawn(spawnCfg);
      insertSessionEvent(session.id, 'claude-spawned', { command: claudeCmd });
      res.json({ ok: true, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to spawn Claude' });
    }
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

  // POST /api/sessions/:id/resume-claude
  // Resume an existing Claude Code session
  router.post('/:id/resume-claude', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { claudeSessionId, cols, rows } = req.body || {};
    const resumeId = claudeSessionId || session.claudeSessionId;

    if (!resumeId) {
      return res.status(400).json({ error: 'No claudeSessionId to resume' });
    }

    // Persist the claudeSessionId to DB so spawnPty can pick it up for --resume
    updateSession(session.id, { claudeSessionId: resumeId });

    try {
      const existing = manager.get(session.id);
      if (existing) manager.remove(session.id);

      // Use the base command (e.g. 'claude'); spawnPty will read the
      // claudeSessionId from the DB and construct --resume with fallback.
      const spawnCfg: SpawnConfig = {
        id: session.id,
        name: session.name,
        command: session.command,
        workingDir: session.workingDirectory || '',
        type: 'session',
        projectId: session.projectId,
        config: defaultProcessConfig({
          autorespawn: session.autorespawn,
        }),
        cols: cols || 80,
        rows: rows || 24,
      };

      const proc = manager.spawn(spawnCfg);
      insertSessionEvent(session.id, 'claude-resumed', { claudeSessionId: resumeId });
      res.json({ ok: true, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to resume Claude' });
    }
  });

  return router;
}
