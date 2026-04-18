import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getCommandById,
  createCommand,
  updateCommand,
  deleteCommand,
  getAllCommands,
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
    autorespawn: false,
    terminalAlerts: false,
    fileWatchPatterns: [],
    ...overrides,
  };
}

export function createCommandsRouter(manager: PtyManager): Router {
  const router = Router();

  // GET /api/commands
  router.get('/', (_req: Request, res: Response) => {
    const commands = getAllCommands();
    const enriched = commands.map((c) => {
      const proc = manager.get(c.id);
      return { ...c, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // GET /api/commands/:id
  router.get('/:id', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });
    const proc = manager.get(command.id);
    res.json({ ...command, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null });
  });

  // POST /api/commands
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
      terminalAlerts,
      fileWatchPatterns,
    } = req.body || {};

    if (!projectId || !name || !command) {
      return res.status(400).json({ error: 'projectId, name, and command are required' });
    }

    try {
      const record = createCommand({
        projectId,
        name,
        command,
        workingDirectory,
        autostart,
        autorestart,
        autorestartMax,
        autorestartDelayMs,
        autorestartWindowSecs,
        terminalAlerts,
        fileWatchPatterns,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create command' });
    }
  });

  // PUT /api/commands/:id
  router.put('/:id', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });
    const updated = updateCommand(req.params.id, req.body);
    res.json(updated);
  });

  // DELETE /api/commands/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });

    const proc = manager.get(req.params.id);
    if (proc) manager.kill(req.params.id);

    deleteCommand(req.params.id);
    res.status(204).send();
  });

  // POST /api/commands/:id/start
  router.post('/:id/start', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });

    const existing = manager.get(command.id);
    if (existing && existing.state === 'running') {
      return res.status(409).json({ error: 'Command is already running' });
    }

    const { cols, rows } = req.body || {};

    try {
      if (existing) manager.remove(command.id);

      const spawnCfg: SpawnConfig = {
        id: command.id,
        name: command.name,
        command: command.command,
        workingDir: command.workingDirectory || '',
        type: 'command',
        projectId: command.projectId,
        config: defaultProcessConfig({
          autostart: command.autostart,
          autorestart: command.autorestart,
          autorestartMax: command.autorestartMax,
          autorestartDelayMs: command.autorestartDelayMs,
          autorestartWindowSecs: command.autorestartWindowSecs,
          terminalAlerts: command.terminalAlerts,
          fileWatchPatterns: command.fileWatchPatterns,
        }),
        cols: cols || 80,
        rows: rows || 24,
      };

      const proc = manager.spawn(spawnCfg);
      res.json({ ok: true, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start command' });
    }
  });

  // POST /api/commands/:id/stop
  router.post('/:id/stop', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });
    manager.kill(req.params.id);
    res.json({ ok: true });
  });

  // POST /api/commands/:id/restart
  router.post('/:id/restart', (req: Request, res: Response) => {
    const command = getCommandById(req.params.id);
    if (!command) return res.status(404).json({ error: 'Command not found' });
    manager.restart(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
