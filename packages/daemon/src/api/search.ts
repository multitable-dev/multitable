import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchSessions, searchCommands, getAllProjects } from '../db/store.js';
import type { PtyManager } from '../pty/manager.js';

export function createSearchRouter(manager: PtyManager): Router {
  const router = Router();

  // GET /api/search?q=<query>
  router.get('/', (req: Request, res: Response) => {
    const q = (req.query.q as string || '').trim();

    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    if (q.length < 1) {
      return res.json({ sessions: [], commands: [], projects: [] });
    }

    try {
      const sessions = searchSessions(q).map((s) => {
        const proc = manager.get(s.id);
        return { ...s, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
      });

      const commands = searchCommands(q).map((c) => {
        const proc = manager.get(c.id);
        return { ...c, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
      });

      // Search projects by name or path
      const lowerQ = q.toLowerCase();
      const projects = getAllProjects().filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQ) ||
          p.path.toLowerCase().includes(lowerQ)
      );

      res.json({ sessions, commands, projects });
    } catch (err) {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  return router;
}
