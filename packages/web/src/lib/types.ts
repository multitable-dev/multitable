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

export interface PermissionPrompt {
  id: string;
  sessionId: string;
  claudeSessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: number;
  timeoutMs: number;
}

export interface OptionPrompt {
  sessionId: string;
  question: string;
  options: string[];
}

export interface WsMessage {
  type: string;
  processId?: string;
  payload: unknown;
}

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
