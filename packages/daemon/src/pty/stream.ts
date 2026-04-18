import type { WsClientState, WsMessage, ProcessConfig, SpawnConfig } from '../types.js';
import type { WebSocket } from 'ws';
import type { PtyManager } from './manager.js';
import type { PermissionManager } from '../hooks/permissionManager.js';
import { getSessionById, getCommandById, getTerminalById } from '../db/store.js';

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

export function handleWsMessage(
  clientState: WsClientState,
  msg: WsMessage,
  ws: WebSocket,
  manager: PtyManager,
  permManager: PermissionManager
): void {
  switch (msg.type) {
    case 'subscribe':
      handleSubscribe(clientState, msg, ws, manager);
      break;
    case 'unsubscribe':
      handleUnsubscribe(clientState);
      break;
    case 'pty-input':
      handlePtyInput(msg, manager);
      break;
    case 'pty-resize':
      handlePtyResize(msg, manager);
      break;
    case 'permission:respond':
      handlePermissionRespond(msg, permManager);
      break;
    case 'option:dismiss':
      // handled at server level
      break;
    default:
      // Unknown message type — ignore
      break;
  }
}

function handleSubscribe(
  clientState: WsClientState,
  msg: WsMessage,
  ws: WebSocket,
  manager: PtyManager
): void {
  // Clean up any existing subscriptions
  for (const cleanup of clientState.cleanups) {
    try { cleanup(); } catch {}
  }
  clientState.cleanups = [];

  const processId = msg.processId || (msg.payload && msg.payload.processId);
  if (!processId) return;

  clientState.subscribedProcess = processId;

  const cols = msg.payload?.cols ?? 80;
  const rows = msg.payload?.rows ?? 24;

  // Try to respawn if dead and autorespawn is enabled
  let proc = manager.respawnIfDead(processId, cols, rows);

  // If not in PtyManager at all, look up in DB and spawn
  if (!proc) {
    const session = getSessionById(processId);
    if (session) {
      // Use --resume if this session has a known Claude session ID
      const command = session.claudeSessionId
        ? `claude --resume ${session.claudeSessionId}`
        : session.command;
      const spawnCfg: SpawnConfig = {
        id: session.id,
        name: session.name,
        command,
        workingDir: session.workingDirectory || '',
        type: 'session',
        projectId: session.projectId,
        config: defaultProcessConfig({ autorespawn: session.autorespawn ?? true }),
        cols,
        rows,
      };
      try {
        proc = manager.spawn(spawnCfg);
      } catch { /* spawn failed */ }
    }
    if (!proc) {
      const cmd = getCommandById(processId);
      if (cmd) {
        const spawnCfg: SpawnConfig = {
          id: cmd.id,
          name: cmd.name,
          command: cmd.command,
          workingDir: cmd.workingDirectory || '',
          type: 'command',
          projectId: cmd.projectId,
          config: defaultProcessConfig({ autorestart: cmd.autorestart }),
          cols,
          rows,
        };
        try {
          proc = manager.spawn(spawnCfg);
        } catch { /* spawn failed */ }
      }
    }
    if (!proc) {
      const term = getTerminalById(processId);
      if (term) {
        const termShell = term.shell || process.env.SHELL || 'bash';
        const spawnCfg: SpawnConfig = {
          id: term.id,
          name: term.name,
          command: termShell,
          workingDir: term.workingDirectory || '',
          type: 'terminal',
          projectId: term.projectId,
          config: defaultProcessConfig({ autorespawn: false }),
          cols,
          rows,
        };
        try {
          proc = manager.spawn(spawnCfg);
        } catch { /* spawn failed */ }
      }
    }
  }

  if (!proc) {
    ws.send(JSON.stringify({ type: 'error', payload: { message: `Process ${processId} not found` } }));
    return;
  }

  // Resize PTY to match client dimensions (process may have been spawned at different size)
  if (proc.state === 'running' && proc.pty) {
    manager.resize(processId, cols, rows);
  }

  // Send scrollback
  try {
    const scrollback = proc.outputBuffer.read();
    ws.send(JSON.stringify({
      type: 'scrollback',
      processId,
      payload: { data: scrollback },
    }));
  } catch {}

  // Send current state
  ws.send(JSON.stringify({
    type: 'process-state-changed',
    processId,
    payload: { state: proc.state },
  }));

  // Register data listener
  const onData = ({ processId: pid, data }: { processId: string; data: string }) => {
    if (pid !== processId) return;
    if (ws.readyState !== 1 /* OPEN */) return;
    try {
      ws.send(JSON.stringify({ type: 'pty-output', processId, payload: { data } }));
    } catch {}
  };

  // NOTE: exit/state-changed events are already broadcast to ALL clients by
  // server.ts via manager.on('state-changed') and manager.on('exit').
  // A previous version sent a duplicate process-state-changed here with
  // { exitCode, signal } but no `state` field, which clobbered the frontend
  // process state to undefined — causing blank-screen bugs after stop/restart.

  manager.on('data', onData);

  clientState.cleanups.push(() => {
    manager.off('data', onData);
  });
}

function handleUnsubscribe(clientState: WsClientState): void {
  for (const cleanup of clientState.cleanups) {
    try { cleanup(); } catch {}
  }
  clientState.cleanups = [];
  clientState.subscribedProcess = null;
}

function handlePtyInput(msg: WsMessage, manager: PtyManager): void {
  const processId = msg.processId || msg.payload?.processId;
  const data = msg.payload?.data;
  if (!processId || data === undefined) return;
  manager.write(processId, data);
}

function handlePtyResize(msg: WsMessage, manager: PtyManager): void {
  const processId = msg.processId || msg.payload?.processId;
  const { cols, rows } = msg.payload || {};
  if (!processId || !cols || !rows) return;
  manager.resize(processId, cols, rows);
}

function handlePermissionRespond(msg: WsMessage, permManager: PermissionManager): void {
  const { id, approved, updatedInput } = msg.payload || {};
  if (!id) return;
  permManager.respond(id, approved === true, updatedInput);
}
