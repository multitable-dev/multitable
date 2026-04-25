import type { Project, Session, Command, Terminal, GlobalConfig, Note, Message } from './types';

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
    browse: () => post<{ path: string | null }>('/api/projects/browse'),
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
    diff: (id: string) => get<{ diff: string }>(`/api/sessions/${id}/diff`),
    cost: (id: string) => get<{
      tokensIn: number;
      tokensOut: number;
      cacheCreationTokens: number;
      cacheReadTokens: number;
      costUsd: number;
      model: string;
      messageCount: number;
    }>(`/api/sessions/${id}/cost`),
    prompts: (id: string) => get<{
      prompts: Array<{ text: string; timestamp: number | null }>;
      source: 'jsonl' | 'jsonl-project' | 'memory';
    }>(`/api/sessions/${id}/prompts`),
    messages: (id: string) => get<{
      messages: Message[];
      endOffset: number;
    }>(`/api/sessions/${id}/messages`),
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
  notes: {
    listForSession: (sessionId: string, projectId: string) =>
      get<{ notes: Note[] }>(`/api/notes?sessionId=${encodeURIComponent(sessionId)}&projectId=${encodeURIComponent(projectId)}`),
    listForProject: (projectId: string) =>
      get<{ notes: Note[] }>(`/api/notes?projectId=${encodeURIComponent(projectId)}`),
    create: (data: { projectId: string; sessionId?: string | null; scope: 'session' | 'project'; title?: string; content?: string }) =>
      post<Note>('/api/notes', data),
    update: (id: string, data: Partial<{ title: string; content: string; scope: 'session' | 'project'; sessionId: string | null }>) =>
      put<Note>(`/api/notes/${id}`, data),
    delete: (id: string) => del(`/api/notes/${id}`),
    refine: (id: string) => post<{ refined: string; original: string }>(`/api/notes/${id}/refine`, {}),
  },
  search: (q: string) =>
    get<Array<{ sessionId: string; name: string; snippet: string }>>(
      `/api/search?q=${encodeURIComponent(q)}`
    ),
  transcripts: {
    list: (params?: { q?: string; cwd?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.cwd) qs.set('cwd', params.cwd);
      if (params?.limit) qs.set('limit', String(params.limit));
      const tail = qs.toString() ? `?${qs.toString()}` : '';
      return get<{
        projects: { cwd: string; projectName: string; sessionCount: number }[];
        sessions: {
          sessionId: string;
          cwd: string;
          projectName: string;
          gitBranch: string | null;
          firstPrompt: string | null;
          mtime: number;
          pinnedSessionId: string | null;
        }[];
      }>(`/api/transcripts${tail}`);
    },
    resume: (sessionId: string) =>
      post<{ ok: boolean; sessionId: string; projectId: string; pid: number }>(
        `/api/transcripts/${sessionId}/resume`
      ),
  },
};
