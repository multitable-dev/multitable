import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import simpleGit from 'simple-git';
import {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  setProjectActive,
  getSessionsByProject,
  getCommandsByProject,
  getTerminalsByProject,
  createSession,
  createCommand,
  createTerminal,
} from '../db/store.js';
import { loadProjectConfig, loadGlobalConfig } from '../config/loader.js';
import { HookManager } from '../hooks/installer.js';
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

export function createProjectsRouter(manager: PtyManager): Router {
  const router = Router();

  // GET /api/projects
  router.get('/', (_req: Request, res: Response) => {
    try {
      const projects = getAllProjects();
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load projects' });
    }
  });

  // GET /api/projects/:id
  router.get('/:id', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  });

  // POST /api/projects
  router.post('/', async (req: Request, res: Response) => {
    const { path: projectPath, shortcut, icon } = req.body || {};
    if (!projectPath) {
      return res.status(400).json({ error: 'path is required' });
    }
    const name = req.body.name || path.basename(projectPath.replace(/\/+$/, ''));
    let project;
    try {
      project = createProject({ name, path: projectPath, shortcut, icon });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return res.status(409).json({ error: 'A project with this path already exists' });
      }
      return res.status(500).json({ error: 'Failed to create project' });
    }

    // Install Claude Code hooks before responding, so the first session
    // the user spawns in this project sees the permission UI, cost
    // tracking, labels, etc. Otherwise hooks would only land on the
    // next daemon restart. Best-effort: a hook-install failure must
    // not block project creation.
    try {
      const config = loadGlobalConfig();
      const hookManager = new HookManager();
      await hookManager.installForProject(project.path, config.port);
    } catch (err) {
      console.warn(`Failed to install hooks for new project ${project.path}:`, err);
    }

    res.status(201).json(project);
  });

  // PUT /api/projects/:id
  router.put('/:id', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { name, shortcut, icon } = req.body || {};
    const updated = updateProject(req.params.id, { name, shortcut, icon });
    res.json(updated);
  });

  // DELETE /api/projects/:id
  router.delete('/:id', async (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Tear down all child processes before the cascade deletes their rows.
    const sessions = getSessionsByProject(req.params.id);
    const commands = getCommandsByProject(req.params.id);
    const terminals = getTerminalsByProject(req.params.id);
    for (const child of [...sessions, ...commands, ...terminals]) {
      try { manager.remove(child.id); } catch { /* best effort */ }
    }

    // Uninstall claude hooks from the project's .claude/settings.json.
    try {
      const config = loadGlobalConfig();
      const hookManager = new HookManager();
      await hookManager.removeForProject(project.path, config.port);
    } catch { /* best effort — file may not exist or already cleaned */ }

    // Cascades to sessions/commands/terminals/session_events/cost_records.
    deleteProject(req.params.id);
    res.status(204).send();
  });

  // POST /api/projects/:id/active
  router.post('/:id/active', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const { active } = req.body || {};
    setProjectActive(req.params.id, active !== false);
    res.json({ ok: true });
  });

  // GET /api/projects/:id/config
  router.get('/:id/config', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const config = loadProjectConfig(project.path);
    res.json(config || {});
  });

  // GET /api/projects/:id/sessions
  router.get('/:id/sessions', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const sessions = getSessionsByProject(req.params.id);
    // Enrich with running state
    const enriched = sessions.map((s) => {
      const proc = manager.get(s.id);
      return { ...s, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // GET /api/projects/:id/commands
  router.get('/:id/commands', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const commands = getCommandsByProject(req.params.id);
    const enriched = commands.map((c) => {
      const proc = manager.get(c.id);
      return { ...c, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // GET /api/projects/:id/terminals
  router.get('/:id/terminals', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const terminals = getTerminalsByProject(req.params.id);
    const enriched = terminals.map((t) => {
      const proc = manager.get(t.id);
      return { ...t, state: proc?.state ?? 'stopped', pid: proc?.pid ?? null };
    });
    res.json(enriched);
  });

  // POST /api/projects/:id/sessions — create a session under a project
  router.post('/:id/sessions', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, command, workingDirectory, autostart, autorestart, autorespawn, terminalAlerts, fileWatchPatterns } = req.body || {};
    if (!name || !command) {
      return res.status(400).json({ error: 'name and command are required' });
    }

    try {
      const session = createSession({
        projectId: req.params.id,
        name,
        command,
        workingDirectory: workingDirectory || project.path,
        type: 'session',
        autostart,
        autorestart,
        autorespawn,
        terminalAlerts,
        fileWatchPatterns,
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // POST /api/projects/:id/commands — create a command under a project
  router.post('/:id/commands', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, command, workingDirectory, autostart, autorestart, terminalAlerts, fileWatchPatterns } = req.body || {};
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    try {
      const record = createCommand({
        projectId: req.params.id,
        name: name || command,
        command,
        workingDirectory: workingDirectory || project.path,
        autostart,
        autorestart,
        terminalAlerts,
        fileWatchPatterns,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create command' });
    }
  });

  // POST /api/projects/:id/terminals — create a terminal under a project
  router.post('/:id/terminals', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { name, shell, workingDirectory } = req.body || {};

    // Auto-name: "Terminal N"
    const existing = getTerminalsByProject(req.params.id);
    const autoName = name || `Terminal ${existing.length + 1}`;
    const termShell = shell || process.env.SHELL || 'bash';

    try {
      const record = createTerminal({
        projectId: req.params.id,
        name: autoName,
        shell: termShell,
        workingDirectory: workingDirectory || project.path,
      });

      // Spawn PTY immediately
      const spawnCfg: SpawnConfig = {
        id: record.id,
        name: autoName,
        command: termShell,
        workingDir: workingDirectory || project.path,
        type: 'terminal',
        projectId: req.params.id,
        config: defaultProcessConfig({ autorespawn: false }),
      };
      const proc = manager.spawn(spawnCfg);

      res.status(201).json({
        ...record,
        state: 'running',
        pid: proc.pid,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create terminal' });
    }
  });

  // GET /api/projects/:id/files?path=
  router.get('/:id/files', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const relPath = (req.query.path as string) || '';
    // Normalize project.path to remove any trailing slashes for consistent comparison
    const normalizedProjectPath = path.resolve(project.path);
    const resolved = path.resolve(normalizedProjectPath, relPath);

    // Prevent directory traversal
    if (!resolved.startsWith(normalizedProjectPath)) {
      return res.status(403).json({ error: 'Path is outside project directory' });
    }

    try {
      const entries = fs.readdirSync(resolved);
      const result = entries
        .filter((name) => !name.startsWith('.'))
        .map((name) => {
          try {
            const fullPath = path.join(resolved, name);
            const stat = fs.statSync(fullPath);
            const entryRelPath = relPath ? `${relPath}/${name}` : name;
            return {
              name,
              path: entryRelPath,
              type: stat.isDirectory() ? 'directory' : 'file',
              size: stat.size,
              modifiedAt: stat.mtimeMs,
            };
          } catch {
            const entryRelPath = relPath ? `${relPath}/${name}` : name;
            return { name, path: entryRelPath, type: 'file', size: 0, modifiedAt: 0 };
          }
        })
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'directory' ? -1 : 1;
        });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to read directory' });
    }
  });

  // POST /api/projects/:id/open-file
  router.post('/:id/open-file', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const { path: filePath } = req.body || {};
    if (!filePath) return res.status(400).json({ error: 'path is required' });

    const resolved = path.resolve(project.path, filePath);
    const globalConfig = loadGlobalConfig();
    const editor = globalConfig.defaultEditor || 'code';

    // Fire and forget
    const child = spawn(editor, [resolved], { detached: true, stdio: 'ignore' });
    child.unref();

    res.json({ ok: true });
  });

  // GET /api/projects/:id/diff
  router.get('/:id/diff', async (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    try {
      const git = simpleGit(project.path);
      const diff = await git.diff();
      res.json({ diff });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get diff' });
    }
  });

  // POST /api/projects/:id/start-all
  router.post('/:id/start-all', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const sessions = getSessionsByProject(req.params.id);
    const commands = getCommandsByProject(req.params.id);
    const terminals = getTerminalsByProject(req.params.id);
    const started: string[] = [];

    for (const session of sessions) {
      if (!manager.get(session.id) || manager.get(session.id)?.state === 'stopped') {
        try {
          const spawnCfg: SpawnConfig = {
            id: session.id,
            name: session.name,
            command: session.command,
            workingDir: session.workingDirectory || project.path,
            type: 'session',
            projectId: project.id,
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
          };
          manager.spawn(spawnCfg);
          started.push(session.id);
        } catch {}
      }
    }

    for (const cmd of commands) {
      if (!manager.get(cmd.id) || manager.get(cmd.id)?.state === 'stopped') {
        try {
          const spawnCfg: SpawnConfig = {
            id: cmd.id,
            name: cmd.name,
            command: cmd.command,
            workingDir: cmd.workingDirectory || project.path,
            type: 'command',
            projectId: project.id,
            config: defaultProcessConfig({
              autostart: cmd.autostart,
              autorestart: cmd.autorestart,
              autorestartMax: cmd.autorestartMax,
              autorestartDelayMs: cmd.autorestartDelayMs,
              autorestartWindowSecs: cmd.autorestartWindowSecs,
              terminalAlerts: cmd.terminalAlerts,
              fileWatchPatterns: cmd.fileWatchPatterns,
            }),
          };
          manager.spawn(spawnCfg);
          started.push(cmd.id);
        } catch {}
      }
    }

    for (const term of terminals) {
      if (!manager.get(term.id) || manager.get(term.id)?.state === 'stopped') {
        try {
          const termShell = term.shell || process.env.SHELL || 'bash';
          const spawnCfg: SpawnConfig = {
            id: term.id,
            name: term.name,
            command: termShell,
            workingDir: term.workingDirectory || project.path,
            type: 'terminal',
            projectId: project.id,
            config: defaultProcessConfig({
              autorespawn: false,
            }),
          };
          manager.spawn(spawnCfg);
          started.push(term.id);
        } catch {}
      }
    }

    res.json({ started });
  });

  // POST /api/projects/:id/stop-all
  router.post('/:id/stop-all', (req: Request, res: Response) => {
    const project = getProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const sessions = getSessionsByProject(req.params.id);
    const commands = getCommandsByProject(req.params.id);
    const terminals = getTerminalsByProject(req.params.id);
    const stopped: string[] = [];

    for (const s of [...sessions, ...commands, ...terminals]) {
      const proc = manager.get(s.id);
      if (proc && proc.state === 'running') {
        manager.kill(s.id);
        stopped.push(s.id);
      }
    }

    res.json({ stopped });
  });

  return router;
}
