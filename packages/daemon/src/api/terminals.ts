import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getTerminalById,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  getAllTerminals,
  getTerminalsByProject,
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

export function createTerminalsRouter(manager: PtyManager): Router {
  const router = Router();

  // GET /api/terminals
  router.get('/', (_req: Request, res: Response) => {
    const terminals = getAllTerminals();
    const enriched = terminals.map((t) => {
      const proc = manager.get(t.id);
      return { ...t, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // GET /api/terminals/:id
  router.get('/:id', (req: Request, res: Response) => {
    const terminal = getTerminalById(req.params.id);
    if (!terminal) return res.status(404).json({ error: 'Terminal not found' });
    const proc = manager.get(terminal.id);
    res.json({ ...terminal, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null });
  });

  // POST /api/terminals
  router.post('/', (req: Request, res: Response) => {
    const {
      projectId,
      name,
      shell,
      workingDirectory,
    } = req.body || {};

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    try {
      // Auto-name if not provided
      const terminalName = name || `Terminal ${getTerminalsByProject(projectId).length + 1}`;
      const terminalShell = shell || process.env.SHELL || 'bash';

      const record = createTerminal({
        projectId,
        name: terminalName,
        shell: terminalShell,
        workingDirectory,
      });

      // Spawn PTY immediately
      const { cols, rows } = req.body || {};
      const spawnCfg: SpawnConfig = {
        id: record.id,
        name: record.name,
        command: terminalShell,
        workingDir: record.workingDirectory || '',
        type: 'terminal',
        projectId: record.projectId,
        config: defaultProcessConfig({
          autorespawn: false,
        }),
        cols: cols || 80,
        rows: rows || 24,
      };

      const proc = manager.spawn(spawnCfg);
      res.status(201).json({ ...record, state: proc.state, pid: proc.pid });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create terminal' });
    }
  });

  // PUT /api/terminals/:id
  router.put('/:id', (req: Request, res: Response) => {
    const terminal = getTerminalById(req.params.id);
    if (!terminal) return res.status(404).json({ error: 'Terminal not found' });
    const updated = updateTerminal(req.params.id, req.body);
    res.json(updated);
  });

  // DELETE /api/terminals/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const terminal = getTerminalById(req.params.id);
    if (!terminal) return res.status(404).json({ error: 'Terminal not found' });

    const proc = manager.get(req.params.id);
    if (proc) manager.kill(req.params.id);

    deleteTerminal(req.params.id);
    res.status(204).send();
  });

  return router;
}
