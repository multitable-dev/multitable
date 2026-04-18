import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import type { GlobalConfig, WsClientState, WsMessage } from './types.js';
import type { PtyManager } from './pty/manager.js';
import type { PermissionManager } from './hooks/permissionManager.js';
import { handleWsMessage } from './pty/stream.js';
import { createProjectsRouter } from './api/projects.js';
import { createSessionsRouter } from './api/sessions.js';
import { createCommandsRouter } from './api/commands.js';
import { createProcessesRouter } from './api/processes.js';
import { createTerminalsRouter } from './api/terminals.js';
import { createConfigRouter } from './api/config.js';
import { createSearchRouter } from './api/search.js';
import { createHooksRouter } from './hooks/receiver.js';

export interface ServerInstance {
  app: express.Application;
  server: http.Server;
  wss: WebSocketServer;
  broadcast: (type: string, payload: any) => void;
  sendToSubscribers: (processId: string, type: string, payload: any) => void;
  closeAllClients: () => void;
}

export function createServer(
  config: GlobalConfig,
  manager: PtyManager,
  permManager: PermissionManager
): ServerInstance {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Serve built React app if it exists
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // ─── Broadcast helpers ──────────────────────────────────────────────────────

  const clients = new Set<{ ws: WebSocket; state: WsClientState }>();

  function broadcast(type: string, payload: any): void {
    const msg = JSON.stringify({ type, payload });
    for (const { ws } of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch {}
      }
    }
  }

  function sendToSubscribers(processId: string, type: string, payload: any): void {
    const msg = JSON.stringify({ type, processId, payload });
    for (const { ws, state } of clients) {
      if (state.subscribedProcess === processId && ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch {}
      }
    }
  }

  // ─── Mount API routes ───────────────────────────────────────────────────────

  app.use('/api/projects', createProjectsRouter(manager));
  app.use('/api/sessions', createSessionsRouter(manager));
  app.use('/api/commands', createCommandsRouter(manager));
  app.use('/api/processes', createProcessesRouter(manager));
  app.use('/api/terminals', createTerminalsRouter(manager));
  app.use('/api/hooks', createHooksRouter(manager, permManager, broadcast));
  app.use('/api/config', createConfigRouter());
  app.use('/api/search', createSearchRouter(manager));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, pid: process.pid, uptime: process.uptime() });
  });

  // SPA fallback — only if public dir exists
  if (fs.existsSync(publicDir)) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  // ─── HTTP + WebSocket server ────────────────────────────────────────────────

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const state: WsClientState = {
      subscribedProcess: null,
      cleanups: [],
      alive: true,
    };

    const clientEntry = { ws, state };
    clients.add(clientEntry);

    // Heartbeat ping/pong
    const pingInterval = setInterval(() => {
      if (!state.alive) {
        ws.terminate();
        return;
      }
      state.alive = false;
      try { ws.ping(); } catch {}
    }, 30000);

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleWsMessage(state, msg, ws, manager, permManager);
      } catch {}
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      for (const cleanup of state.cleanups) {
        try { cleanup(); } catch {}
      }
      clients.delete(clientEntry);
    });

    ws.on('error', () => {
      // ws error — will trigger close
    });
  });

  // ─── Wire manager events to WebSocket ──────────────────────────────────────

  // NOTE: pty-output is sent directly to the subscribed client in stream.ts's
  // handleSubscribe onData listener. Do NOT also broadcast here — that causes
  // every data event to be delivered twice.

  manager.on('state-changed', ({ processId, state: procState }: { processId: string; state: string }) => {
    broadcast('process-state-changed', { processId, state: procState });
  });

  manager.on('metrics', ({ processId, metrics }: { processId: string; metrics: any }) => {
    broadcast('process-metrics', { processId, ...metrics });
  });

  manager.on('exit', ({ processId, exitCode, signal }: { processId: string; exitCode: number; signal: number }) => {
    broadcast('process-exited', { processId, exitCode, signal });
  });

  // ─── Wire permission events ─────────────────────────────────────────────────

  permManager.on('permission:prompt', (prompt: any) => {
    broadcast('permission:prompt', { prompt });
  });

  permManager.on('permission:resolved', (id: string) => {
    broadcast('permission:resolved', { id });
  });

  permManager.on('permission:expired', (id: string) => {
    broadcast('permission:expired', { id });
  });

  function closeAllClients(): void {
    for (const { ws } of clients) {
      try { ws.terminate(); } catch {}
    }
    clients.clear();
  }

  return { app, server, wss, broadcast, sendToSubscribers, closeAllClients };
}
