import type { Project, Session, Command, Terminal, GlobalConfig } from './types';

const BASE = '';  // same origin

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

export const api = {
  projects: {
    list: () => get<Project[]>('/api/projects'),
    get: (id: string) => get<Project>(`/api/projects/${id}`),
    create: (data: { path: string }) => post<Project>('/api/projects', data),
    update: (id: string, data: Partial<Project>) => put<Project>(`/api/projects/${id}`, data),
    delete: (id: string) => del(`/api/projects/${id}`),
    setActive: (id: string) => put<Project>(`/api/projects/${id}/active`),
    startAll: (id: string) => post<void>(`/api/projects/${id}/start-all`),
    stopAll: (id: string) => post<void>(`/api/projects/${id}/stop-all`),
    files: (id: string, path?: string) => get<any[]>(`/api/projects/${id}/files${path ? `?path=${encodeURIComponent(path)}` : ''}`),
    openFile: (id: string, filePath: string) => post<void>(`/api/projects/${id}/open-file`, { path: filePath }),
    diff: (id: string) => get<{ diff: string }>(`/api/projects/${id}/diff`),
  },
  sessions: {
    list: (projectId: string) => get<Session[]>(`/api/projects/${projectId}/sessions`),
    create: (projectId: string, data: { name: string; command: string }) =>
      post<Session>(`/api/projects/${projectId}/sessions`, data),
    update: (id: string, data: Partial<Session>) => put<Session>(`/api/sessions/${id}`, data),
    delete: (id: string) => del(`/api/sessions/${id}`),
    spawnClaude: (id: string) => post<void>(`/api/sessions/${id}/spawn-claude`),
    resumeClaude: (id: string) => post<void>(`/api/sessions/${id}/resume-claude`),
    diff: (id: string) => get<{ diff: string }>(`/api/sessions/${id}/diff`),
    cost: (id: string) => get<{ tokensIn: number; tokensOut: number; costUsd: number }>(`/api/sessions/${id}/cost`),
  },
  commands: {
    list: (projectId: string) => get<Command[]>(`/api/projects/${projectId}/commands`),
    create: (projectId: string, data: { name: string; command: string }) =>
      post<Command>(`/api/projects/${projectId}/commands`, data),
    update: (id: string, data: Partial<Command>) => put<Command>(`/api/commands/${id}`, data),
    delete: (id: string) => del(`/api/commands/${id}`),
  },
  terminals: {
    list: (projectId: string) => get<Terminal[]>(`/api/projects/${projectId}/terminals`),
    create: (projectId: string, data: { name?: string; shell?: string; workingDirectory?: string }) =>
      post<Terminal>(`/api/projects/${projectId}/terminals`, data),
    update: (id: string, data: Partial<Terminal>) => put<Terminal>(`/api/terminals/${id}`, data),
    delete: (id: string) => del(`/api/terminals/${id}`),
  },
  processes: {
    start: (id: string) => post<void>(`/api/processes/${id}/start`),
    stop: (id: string) => post<void>(`/api/processes/${id}/stop`),
    restart: (id: string) => post<void>(`/api/processes/${id}/restart`),
    clearScrollback: (id: string) => del(`/api/processes/${id}/scrollback`),
  },
  config: {
    get: () => get<GlobalConfig>('/api/config'),
    update: (data: Partial<GlobalConfig>) => put<GlobalConfig>('/api/config', data),
  },
  search: (q: string) =>
    get<Array<{ sessionId: string; name: string; snippet: string }>>(
      `/api/search?q=${encodeURIComponent(q)}`
    ),
};
