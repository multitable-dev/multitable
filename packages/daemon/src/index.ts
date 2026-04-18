#!/usr/bin/env node
import { loadGlobalConfig } from './config/loader.js';
import { initDb, getAllProjects, getSessionsByProject, getCommandsByProject } from './db/store.js';
import { PtyManager } from './pty/manager.js';
import { PermissionManager } from './hooks/permissionManager.js';
import { HookManager } from './hooks/installer.js';
import { FileWatcher } from './watcher/index.js';
import { createServer } from './server.js';
import { checkOrphanedPids } from './pids.js';
import { loadProjectConfig } from './config/loader.js';
import type { SpawnConfig, ProcessConfig } from './types.js';

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

async function main() {
  console.log('Starting MultiTable daemon...');

  // 1. Load global config
  const config = loadGlobalConfig();

  // 2. Check pids.json for orphaned processes
  const orphans = checkOrphanedPids();
  if (orphans.length > 0) {
    console.log(`Found ${orphans.length} orphaned process(es):`);
    for (const o of orphans) {
      console.log(`  processId=${o.processId} pid=${o.pid}`);
    }
  }

  // 3. Init db store
  initDb();
  console.log('Database initialized.');

  // 4. Create PtyManager and PermissionManager
  const manager = new PtyManager();
  const permManager = new PermissionManager();

  // Configure permission manager from project configs
  for (const projRef of config.projects) {
    const projConfig = loadProjectConfig(projRef.path);
    if (projConfig?.permissions?.auto_defer) {
      permManager.setAutoDeferTools(projConfig.permissions.auto_defer);
    }
  }

  // 5. Install hooks for each registered project (from config AND DB)
  const hookManager = new HookManager();
  const dbProjects = getAllProjects();
  const allProjectPaths = new Set<string>([
    ...config.projects.map((p: { path: string }) => p.path),
    ...dbProjects.map((p) => p.path),
  ]);
  for (const projectPath of allProjectPaths) {
    try {
      await hookManager.installForProject(projectPath, config.port);
      console.log(`Installed hooks for: ${projectPath}`);
    } catch (err) {
      console.warn(`Failed to install hooks for ${projectPath}:`, err);
    }
  }

  // 6. Create Express/WS server
  const serverInstance = createServer(config, manager, permManager);
  const { server, broadcast } = serverInstance;

  // 7. Load projects from DB, start autostart processes
  const fileWatcher = new FileWatcher();
  const projects = getAllProjects();

  for (const project of projects) {
    const sessions = getSessionsByProject(project.id);
    const commands = getCommandsByProject(project.id);

    // Watch mt.yml for changes
    fileWatcher.watchMtYml(project.path, () => {
      console.log(`mt.yml changed for project: ${project.name}`);
      broadcast('project:config-changed', { projectId: project.id });
    });

    // Start autostart sessions
    for (const session of sessions) {
      if (session.autostart) {
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
          if (session.claudeSessionId) {
            // Session has a prior Claude conversation — we can't know if it's
            // still valid. Register as stopped so the user can choose Resume
            // or Start New. Never auto-spawn stale Claude sessions.
            manager.register(spawnCfg);
            console.log(`Registered session (has prior Claude ID, needs user action): ${session.name} (${session.id})`);
          } else {
            manager.spawn(spawnCfg);
            console.log(`Autostarted session: ${session.name} (${session.id})`);
          }
        } catch (err) {
          console.error(`Failed to autostart session ${session.name}:`, err);
        }
      }

      // 8. Start file watchers for sessions with file watch patterns
      if (session.fileWatchPatterns.length > 0) {
        fileWatcher.watchPatterns(session.id, session.fileWatchPatterns, session.workingDirectory || project.path, () => {
          console.log(`File change detected, restarting session: ${session.name}`);
          manager.restart(session.id);
        });
      }
    }

    // Start autostart commands
    for (const cmd of commands) {
      if (cmd.autostart) {
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
          console.log(`Autostarted command: ${cmd.name} (${cmd.id})`);
        } catch (err) {
          console.error(`Failed to autostart command ${cmd.name}:`, err);
        }
      }

      if (cmd.fileWatchPatterns.length > 0) {
        fileWatcher.watchPatterns(cmd.id, cmd.fileWatchPatterns, cmd.workingDirectory || project.path, () => {
          console.log(`File change detected, restarting command: ${cmd.name}`);
          manager.restart(cmd.id);
        });
      }
    }
  }

  // 9. Listen on host:port
  server.listen(config.port, config.host, () => {
    console.log(`MultiTable daemon running at http://${config.host}:${config.port}`);
    console.log(`WebSocket endpoint: ws://${config.host}:${config.port}/ws`);
  });

  // 10. Graceful shutdown — idempotent, force exits within 2s
  let shuttingDown = false;
  function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down...`);
    setTimeout(() => process.exit(0), 2000);
    fileWatcher.unwatchAll();
    manager.destroy();
    serverInstance.closeAllClients();
    server.close(() => process.exit(0));
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });
}

main().catch((err) => {
  console.error('Fatal error starting daemon:', err);
  process.exit(1);
});
