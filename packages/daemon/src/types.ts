export type ProcessType = 'session' | 'terminal' | 'command';
export type ProcessState = 'running' | 'idle' | 'stopped' | 'errored';

export interface ProcessConfig {
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;        // default 5
  autorestartDelayMs: number;    // default 2000
  autorestartWindowSecs: number; // reset restartCount after this (default 60)
  autorespawn: boolean;          // respawn PTY on subscribe if dead
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
  pty: any | null;  // IPty from node-pty
  pid: number | null;
  startedAt: Date | null;
  restartCount: number;
  lastRestartAt: number; // unix ms
  outputBuffer: any;  // RingBuffer
  metrics: ProcessMetrics;
}

export interface WsMessage {
  type: string;
  processId?: string;
  payload: any;
}

export interface WsClientState {
  subscribedProcess: string | null;
  cleanups: Array<() => void>;
  alive: boolean;
}

export interface PermissionPrompt {
  id: string;
  sessionId: string;
  claudeSessionId: string;
  toolName: string;
  toolInput: Record<string, any>;
  createdAt: number;
  timeoutMs: number;
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

export interface Project {
  id: string;
  name: string;
  path: string;
  shortcut: number | null;
  icon: string | null;
  isActive: boolean;
  createdAt: number;
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
  projects: Array<{ path: string; shortcut?: number }>;
}

export interface ProjectConfig {
  name?: string;
  sessions?: Array<{
    name: string;
    command: string;
    autostart?: boolean;
    working_directory?: string;
  }>;
  commands?: Array<{
    name: string;
    command: string;
    autostart?: boolean;
    autorestart?: boolean;
    terminal_alerts?: boolean;
    file_watching?: string[];
    working_directory?: string;
  }>;
  permissions?: {
    auto_defer?: string[];
  };
}

export interface SpawnConfig {
  id: string;
  name: string;
  command: string;
  workingDir: string;
  type: ProcessType;
  projectId: string;
  config: ProcessConfig;
  cols?: number;
  rows?: number;
}
