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
    res.status(204).send();
  });

  // GET /api/sessions/:id/cost
  router.get('/:id/cost', (req: Request, res: Response) => {
    const session = getSessionById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const cost = getSessionCostAggregate(req.params.id);
    res.json(cost);
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

    const claudeCmd = buildClaudeCommand(session.workingDirectory || '', resumeId);

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
      insertSessionEvent(session.id, 'claude-resumed', { claudeSessionId: resumeId });
      res.json({ ok: true, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to resume Claude' });
    }
  });

  return router;
}
