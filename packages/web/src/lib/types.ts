export type ProcessType = 'session' | 'terminal' | 'command';
export type ProcessState = 'running' | 'idle' | 'stopped' | 'errored';

export interface ProcessConfig {
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;
  autorestartDelayMs: number;
  autorestartWindowSecs: number;
  autorespawn: boolean;
  terminalAlerts: boolean;
  fileWatchPatterns: string[];
}

export interface ProcessMetrics {
  cpuPercent: number;
  memoryBytes: number;
  detectedPort: number | null;
}

export interface ManagedProcess {
  id: string;
  name: string;
  command: string;
  workingDir: string;
  type: ProcessType;
  projectId: string;
  config: ProcessConfig;
  state: ProcessState;
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  metrics: ProcessMetrics;
}

export interface ClaudeSessionState {
  claudeSessionId: string | null;
  currentTool: string | null;
  toolCount: number;
  tokenCount: number;
  costUsd: number;
  lastActivity: number;
  activeSubagents: number;
  userMessages: string[];
  label: string | null;
}

export interface Session extends ManagedProcess {
  type: 'session';
  claudeSessionId?: string | null; // from DB — persists across daemon restarts
  claudeState?: ClaudeSessionState; // in-memory — lost on daemon restart
  scratchpad?: string;
}

export interface Command extends ManagedProcess {
  type: 'command';
}

export interface Terminal extends ManagedProcess {
  type: 'terminal';
}

export interface Project {
  id: string;
  name: string;
  path: string;
  shortcut: number | null;
  icon: string | null;
  isActive: boolean;
  createdAt: number;
  sessions?: Session[];
  commands?: Command[];
  terminals?: Terminal[];
}

export type NoteScope = 'session' | 'project';

export interface Note {
  id: string;
  projectId: string;
  sessionId: string | null;
  scope: NoteScope;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface AskQuestionOption {
  label: string;
  description?: string;
  preview?: string;
}

export interface AskQuestion {
  question: string;
  header?: string;
  options: AskQuestionOption[];
  multiSelect?: boolean;
}

export interface PermissionPrompt {
  id: string;
  sessionId: string;
  claudeSessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: number;
  timeoutMs: number;
  kind?: 'permission' | 'ask-question';
  questions?: AskQuestion[];
}

export interface OptionPrompt {
  sessionId: string;
  question: string;
  options: string[];
}

export interface WsMessage<T = unknown> {
  type: string;
  processId?: string;
  payload: T;
}

/**
 * Map of WebSocket event type → payload shape, for the events the web client
 * listens to. Used by `wsClient.on` to give callers a typed `msg.payload`
 * without having to cast through `any`.
 *
 * Daemon emit sites:
 *   - `process-state-changed`, `process-metrics`, `session:resume-failed`,
 *     `permission:prompt`, `permission:resolved`, `permission:expired`
 *     → packages/daemon/src/server.ts
 *   - `session:updated`, `session:label-updated`, `hook:Notification`,
 *     `hook:Stop`
 *     → packages/daemon/src/hooks/receiver.ts
 *   - `ws:reconnected` is a synthetic client-side event fired by the WS
 *     client itself when the socket re-opens.
 */
export interface WsEventMap {
  'ws:reconnected': Record<string, never>;
  'process-state-changed': { processId: string; state: ProcessState };
  'process-metrics': { processId: string } & ProcessMetrics;
  'session:updated': { session: Session };
  'session:created': { session: Session };
  'session:deleted': { sessionId: string };
  'permission:prompt': { prompt: PermissionPrompt };
  'permission:resolved': { id: string };
  'permission:expired': { id: string };
  'option:prompt': OptionPrompt;
  'session:resume-failed': {
    processId: string;
    staleClaudeSessionId?: string | null;
    message: string;
  };
  'hook:Notification': {
    event: string;
    sessionId: string;
    claudeSessionId: string | null;
    payload: { message?: string } & Record<string, unknown>;
    receivedAt: number;
  };
  'hook:Stop': {
    event: string;
    sessionId: string;
    claudeSessionId: string | null;
    payload: Record<string, unknown>;
    receivedAt: number;
  };
  'session:label-updated': { sessionId: string; label: string };
}

export type WsEventType = keyof WsEventMap;
export type WsEventPayload<K extends WsEventType> = WsEventMap[K];

export interface GlobalConfig {
  theme: 'light' | 'dark' | 'system';
  defaultEditor: string;
  defaultShell: string;
  terminalFontSize: number;
  terminalScrollback: number;
  notifications: boolean;
  port: number;
  host: string;
}
