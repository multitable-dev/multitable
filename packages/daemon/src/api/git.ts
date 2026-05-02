import { Router } from 'express';
import type { Request, Response } from 'express';
import { getProjectById } from '../db/store.js';
import {
  isGitRepo,
  getStatusSummary,
  getDiff,
  getStagedDiff,
  getFileDiff,
  getStructuredLog,
  getBranches,
  stageFiles,
  unstageFiles,
  commit,
  discardFiles,
  createBranch,
  switchBranch,
  stash,
  stashPop,
} from '../git/index.js';

// Mounted at /api/projects/:projectId/git. Every handler resolves the project
// path up front and short-circuits with a clear 400 if the directory isn't a
// git repo, so the UI can render an empty-state instead of a generic error.
export function createGitRouter(): Router {
  const router = Router({ mergeParams: true });

  function resolveProject(req: Request, res: Response): { path: string } | null {
    const projectId = (req.params as Record<string, string>).projectId;
    if (!projectId) {
      res.status(400).json({ error: 'Missing projectId' });
      return null;
    }
    const project = getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return null;
    }
    if (!isGitRepo(project.path)) {
      res.status(400).json({ error: 'Not a git repository', code: 'not-a-repo' });
      return null;
    }
    return { path: project.path };
  }

  function handleError(err: unknown, res: Response, fallback: string): void {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : fallback;
    res.status(500).json({ error: message });
  }

  // ── Reads ──────────────────────────────────────────────────────────────────

  router.get('/status', async (req, res) => {
    const projectId = (req.params as Record<string, string>).projectId;
    const project = projectId ? getProjectById(projectId) : null;
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    try {
      const status = await getStatusSummary(project.path);
      res.json(status);
    } catch (err) {
      handleError(err, res, 'Failed to get status');
    }
  });

  router.get('/diff', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    try {
      const staged = req.query.staged === '1' || req.query.staged === 'true';
      const diff = staged ? await getStagedDiff(ctx.path) : await getDiff(ctx.path);
      res.json({ diff });
    } catch (err) {
      handleError(err, res, 'Failed to get diff');
    }
  });

  router.get('/diff/file', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const filePath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!filePath) {
      res.status(400).json({ error: 'Missing path query param' });
      return;
    }
    try {
      const staged = req.query.staged === '1' || req.query.staged === 'true';
      const diff = await getFileDiff(ctx.path, filePath, { staged });
      res.json({ diff });
    } catch (err) {
      handleError(err, res, 'Failed to get file diff');
    }
  });

  router.get('/log', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const limit = clampInt(req.query.limit, 1, 200, 20);
    try {
      const commits = await getStructuredLog(ctx.path, limit);
      res.json({ commits });
    } catch (err) {
      handleError(err, res, 'Failed to read log');
    }
  });

  router.get('/branches', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    try {
      const branches = await getBranches(ctx.path);
      res.json(branches);
    } catch (err) {
      handleError(err, res, 'Failed to list branches');
    }
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  router.post('/stage', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const files = pickStringArray(req.body?.files);
    if (!files) {
      res.status(400).json({ error: 'files must be a string array' });
      return;
    }
    try {
      await stageFiles(ctx.path, files);
      res.json({ ok: true });
    } catch (err) {
      handleError(err, res, 'Failed to stage');
    }
  });

  router.post('/unstage', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const files = pickStringArray(req.body?.files);
    if (!files) {
      res.status(400).json({ error: 'files must be a string array' });
      return;
    }
    try {
      await unstageFiles(ctx.path, files);
      res.json({ ok: true });
    } catch (err) {
      handleError(err, res, 'Failed to unstage');
    }
  });

  router.post('/commit', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      res.status(400).json({ error: 'Commit message is required' });
      return;
    }
    try {
      const result = await commit(ctx.path, message);
      res.json(result);
    } catch (err) {
      handleError(err, res, 'Commit failed');
    }
  });

  router.post('/discard', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const files = pickStringArray(req.body?.files);
    if (!files) {
      res.status(400).json({ error: 'files must be a string array' });
      return;
    }
    try {
      await discardFiles(ctx.path, files);
      res.json({ ok: true });
    } catch (err) {
      handleError(err, res, 'Discard failed');
    }
  });

  router.post('/branches', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'Branch name is required' });
      return;
    }
    const checkout = req.body?.checkout !== false; // default true
    try {
      await createBranch(ctx.path, name, { checkout });
      res.json({ ok: true, branch: name });
    } catch (err) {
      handleError(err, res, 'Failed to create branch');
    }
  });

  router.post('/checkout', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const branch = typeof req.body?.branch === 'string' ? req.body.branch.trim() : '';
    if (!branch) {
      res.status(400).json({ error: 'Branch name is required' });
      return;
    }
    try {
      await switchBranch(ctx.path, branch);
      res.json({ ok: true, branch });
    } catch (err) {
      handleError(err, res, 'Checkout failed');
    }
  });

  router.post('/stash', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    const message = typeof req.body?.message === 'string' ? req.body.message : undefined;
    try {
      await stash(ctx.path, message);
      res.json({ ok: true });
    } catch (err) {
      handleError(err, res, 'Stash failed');
    }
  });

  router.post('/stash/pop', async (req, res) => {
    const ctx = resolveProject(req, res);
    if (!ctx) return;
    try {
      await stashPop(ctx.path);
      res.json({ ok: true });
    } catch (err) {
      handleError(err, res, 'Stash pop failed');
    }
  });

  return router;
}

function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function pickStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (!raw.every((x) => typeof x === 'string' && x.length > 0)) return null;
  return raw as string[];
}
