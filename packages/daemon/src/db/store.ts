import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getConfigDir } from '../config/loader.js';
import type { Project, ManagedProcess } from '../types.js';

let db: Database.Database;

export function initDb(): void {
  const dbDir = getConfigDir();
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'multitable.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema — try both compiled dist path and source path (for tsx dev mode)
  const schemaPath = fs.existsSync(path.join(__dirname, 'schema.sql'))
    ? path.join(__dirname, 'schema.sql')
    : path.join(__dirname, '../../src/db/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  shortcut: number | null;
  icon: string | null;
  is_active: number;
  created_at: number;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    shortcut: row.shortcut,
    icon: row.icon,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function getAllProjects(): Project[] {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY created_at ASC').all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function getProjectById(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function getProjectByPath(projectPath: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

export function createProject(data: { name: string; path: string; shortcut?: number | null; icon?: string | null }): Project {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO projects (id, name, path, shortcut, icon, is_active, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, data.name, data.path, data.shortcut ?? null, data.icon ?? null, now);
  return getProjectById(id)!;
}

export function updateProject(id: string, data: Partial<{ name: string; shortcut: number | null; icon: string | null }>): Project | null {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.shortcut !== undefined) { fields.push('shortcut = ?'); values.push(data.shortcut); }
  if (data.icon !== undefined) { fields.push('icon = ?'); values.push(data.icon); }
  if (fields.length === 0) return getProjectById(id);
  values.push(id);
  getDb().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getProjectById(id);
}

export function setProjectActive(id: string, isActive: boolean): void {
  getDb().prepare('UPDATE projects SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
}

export function deleteProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  project_id: string;
  name: string;
  command: string;
  working_directory: string | null;
  type: string;
  autostart: number;
  autorestart: number;
  autorestart_max: number;
  autorestart_delay_ms: number;
  autorestart_window_secs: number;
  autorespawn: number;
  terminal_alerts: number;
  file_watch_patterns: string;
  claude_session_id: string | null;
  scrollback_data: Buffer | null;
  scratchpad: string;
  created_at: number;
  last_active_at: number | null;
}

export interface SessionRecord {
  id: string;
  projectId: string;
  name: string;
  command: string;
  workingDirectory: string | null;
  type: string;
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;
  autorestartDelayMs: number;
  autorestartWindowSecs: number;
  autorespawn: boolean;
  terminalAlerts: boolean;
  fileWatchPatterns: string[];
  claudeSessionId: string | null;
  scrollbackData: Buffer | null;
  scratchpad: string;
  createdAt: number;
  lastActiveAt: number | null;
}

function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    command: row.command,
    workingDirectory: row.working_directory,
    type: row.type,
    autostart: row.autostart === 1,
    autorestart: row.autorestart === 1,
    autorestartMax: row.autorestart_max,
    autorestartDelayMs: row.autorestart_delay_ms,
    autorestartWindowSecs: row.autorestart_window_secs,
    autorespawn: row.autorespawn === 1,
    terminalAlerts: row.terminal_alerts === 1,
    fileWatchPatterns: JSON.parse(row.file_watch_patterns || '[]'),
    claudeSessionId: row.claude_session_id,
    scrollbackData: row.scrollback_data,
    scratchpad: row.scratchpad || '',
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

export function getSessionsByProject(projectId: string): SessionRecord[] {
  const rows = getDb().prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as SessionRow[];
  return rows.map(rowToSession);
}

export function getSessionById(id: string): SessionRecord | null {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

export function getAllSessions(): SessionRecord[] {
  const rows = getDb().prepare('SELECT * FROM sessions ORDER BY created_at ASC').all() as SessionRow[];
  return rows.map(rowToSession);
}

export function createSession(data: {
  projectId: string;
  name: string;
  command: string;
  workingDirectory?: string | null;
  type?: string;
  autostart?: boolean;
  autorestart?: boolean;
  autorestartMax?: number;
  autorestartDelayMs?: number;
  autorestartWindowSecs?: number;
  autorespawn?: boolean;
  terminalAlerts?: boolean;
  fileWatchPatterns?: string[];
}): SessionRecord {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO sessions (
      id, project_id, name, command, working_directory, type,
      autostart, autorestart, autorestart_max, autorestart_delay_ms,
      autorestart_window_secs, autorespawn, terminal_alerts, file_watch_patterns,
      scratchpad, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.command,
    data.workingDirectory ?? null,
    data.type ?? 'session',
    data.autostart ? 1 : 0,
    data.autorestart ? 1 : 0,
    data.autorestartMax ?? 5,
    data.autorestartDelayMs ?? 2000,
    data.autorestartWindowSecs ?? 60,
    data.autorespawn !== false ? 1 : 0,
    data.terminalAlerts ? 1 : 0,
    JSON.stringify(data.fileWatchPatterns ?? []),
    now
  );
  return getSessionById(id)!;
}

export function updateSession(id: string, data: Partial<{
  name: string;
  command: string;
  workingDirectory: string | null;
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;
  autorestartDelayMs: number;
  autorestartWindowSecs: number;
  autorespawn: boolean;
  terminalAlerts: boolean;
  fileWatchPatterns: string[];
  claudeSessionId: string | null;
  scratchpad: string;
  lastActiveAt: number;
}>): SessionRecord | null {
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    command: 'command',
    workingDirectory: 'working_directory',
    autostart: 'autostart',
    autorestart: 'autorestart',
    autorestartMax: 'autorestart_max',
    autorestartDelayMs: 'autorestart_delay_ms',
    autorestartWindowSecs: 'autorestart_window_secs',
    autorespawn: 'autorespawn',
    terminalAlerts: 'terminal_alerts',
    claudeSessionId: 'claude_session_id',
    scratchpad: 'scratchpad',
    lastActiveAt: 'last_active_at',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      fields.push(`${col} = ?`);
      const val = (data as any)[key];
      if (typeof val === 'boolean') {
        values.push(val ? 1 : 0);
      } else {
        values.push(val);
      }
    }
  }

  if (data.fileWatchPatterns !== undefined) {
    fields.push('file_watch_patterns = ?');
    values.push(JSON.stringify(data.fileWatchPatterns));
  }

  if (fields.length === 0) return getSessionById(id);
  values.push(id);
  getDb().prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getSessionById(id);
}

export function saveScrollback(sessionId: string, data: Buffer): void {
  getDb().prepare('UPDATE sessions SET scrollback_data = ? WHERE id = ?').run(data, sessionId);
}

export function deleteSession(id: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function getSessionByClaudeId(claudeSessionId: string): SessionRecord | null {
  const row = getDb().prepare('SELECT * FROM sessions WHERE claude_session_id = ?').get(claudeSessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : null;
}

// ─── Session Events ───────────────────────────────────────────────────────────

export function insertSessionEvent(sessionId: string, eventType: string, payload?: any): void {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO session_events (id, session_id, event_type, payload, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, eventType, payload ? JSON.stringify(payload) : null, now);
}

export function getSessionEvents(sessionId: string): Array<{ id: string; eventType: string; payload: any; createdAt: number }> {
  const rows = getDb().prepare(
    'SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at ASC'
  ).all(sessionId) as any[];
  return rows.map(r => ({
    id: r.id,
    eventType: r.event_type,
    payload: r.payload ? JSON.parse(r.payload) : null,
    createdAt: r.created_at,
  }));
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export interface CommandRow {
  id: string;
  project_id: string;
  name: string;
  command: string;
  working_directory: string | null;
  autostart: number;
  autorestart: number;
  autorestart_max: number;
  autorestart_delay_ms: number;
  autorestart_window_secs: number;
  terminal_alerts: number;
  file_watch_patterns: string;
  created_at: number;
}

export interface CommandRecord {
  id: string;
  projectId: string;
  name: string;
  command: string;
  workingDirectory: string | null;
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;
  autorestartDelayMs: number;
  autorestartWindowSecs: number;
  terminalAlerts: boolean;
  fileWatchPatterns: string[];
  createdAt: number;
}

function rowToCommand(row: CommandRow): CommandRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    command: row.command,
    workingDirectory: row.working_directory,
    autostart: row.autostart === 1,
    autorestart: row.autorestart === 1,
    autorestartMax: row.autorestart_max,
    autorestartDelayMs: row.autorestart_delay_ms,
    autorestartWindowSecs: row.autorestart_window_secs,
    terminalAlerts: row.terminal_alerts === 1,
    fileWatchPatterns: JSON.parse(row.file_watch_patterns || '[]'),
    createdAt: row.created_at,
  };
}

export function getCommandsByProject(projectId: string): CommandRecord[] {
  const rows = getDb().prepare('SELECT * FROM commands WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as CommandRow[];
  return rows.map(rowToCommand);
}

export function getCommandById(id: string): CommandRecord | null {
  const row = getDb().prepare('SELECT * FROM commands WHERE id = ?').get(id) as CommandRow | undefined;
  return row ? rowToCommand(row) : null;
}

export function getAllCommands(): CommandRecord[] {
  const rows = getDb().prepare('SELECT * FROM commands ORDER BY created_at ASC').all() as CommandRow[];
  return rows.map(rowToCommand);
}

export function createCommand(data: {
  projectId: string;
  name: string;
  command: string;
  workingDirectory?: string | null;
  autostart?: boolean;
  autorestart?: boolean;
  autorestartMax?: number;
  autorestartDelayMs?: number;
  autorestartWindowSecs?: number;
  terminalAlerts?: boolean;
  fileWatchPatterns?: string[];
}): CommandRecord {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO commands (
      id, project_id, name, command, working_directory,
      autostart, autorestart, autorestart_max, autorestart_delay_ms,
      autorestart_window_secs, terminal_alerts, file_watch_patterns, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.projectId,
    data.name,
    data.command,
    data.workingDirectory ?? null,
    data.autostart ? 1 : 0,
    data.autorestart ? 1 : 0,
    data.autorestartMax ?? 5,
    data.autorestartDelayMs ?? 2000,
    data.autorestartWindowSecs ?? 60,
    data.terminalAlerts ? 1 : 0,
    JSON.stringify(data.fileWatchPatterns ?? []),
    now
  );
  return getCommandById(id)!;
}

export function updateCommand(id: string, data: Partial<{
  name: string;
  command: string;
  workingDirectory: string | null;
  autostart: boolean;
  autorestart: boolean;
  autorestartMax: number;
  autorestartDelayMs: number;
  autorestartWindowSecs: number;
  terminalAlerts: boolean;
  fileWatchPatterns: string[];
}>): CommandRecord | null {
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    command: 'command',
    workingDirectory: 'working_directory',
    autostart: 'autostart',
    autorestart: 'autorestart',
    autorestartMax: 'autorestart_max',
    autorestartDelayMs: 'autorestart_delay_ms',
    autorestartWindowSecs: 'autorestart_window_secs',
    terminalAlerts: 'terminal_alerts',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      fields.push(`${col} = ?`);
      const val = (data as any)[key];
      if (typeof val === 'boolean') {
        values.push(val ? 1 : 0);
      } else {
        values.push(val);
      }
    }
  }

  if (data.fileWatchPatterns !== undefined) {
    fields.push('file_watch_patterns = ?');
    values.push(JSON.stringify(data.fileWatchPatterns));
  }

  if (fields.length === 0) return getCommandById(id);
  values.push(id);
  getDb().prepare(`UPDATE commands SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCommandById(id);
}

export function deleteCommand(id: string): void {
  getDb().prepare('DELETE FROM commands WHERE id = ?').run(id);
}

// ─── Terminals ────────────────────────────────────────────────────────────────

export interface TerminalRow {
  id: string;
  project_id: string;
  name: string;
  shell: string | null;
  working_directory: string | null;
  created_at: number;
}

export interface TerminalRecord {
  id: string;
  projectId: string;
  name: string;
  shell: string | null;
  workingDirectory: string | null;
  createdAt: number;
}

function rowToTerminal(row: TerminalRow): TerminalRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    shell: row.shell,
    workingDirectory: row.working_directory,
    createdAt: row.created_at,
  };
}

export function getTerminalsByProject(projectId: string): TerminalRecord[] {
  const rows = getDb().prepare('SELECT * FROM terminals WHERE project_id = ? ORDER BY created_at ASC').all(projectId) as TerminalRow[];
  return rows.map(rowToTerminal);
}

export function getTerminalById(id: string): TerminalRecord | null {
  const row = getDb().prepare('SELECT * FROM terminals WHERE id = ?').get(id) as TerminalRow | undefined;
  return row ? rowToTerminal(row) : null;
}

export function getAllTerminals(): TerminalRecord[] {
  const rows = getDb().prepare('SELECT * FROM terminals ORDER BY created_at ASC').all() as TerminalRow[];
  return rows.map(rowToTerminal);
}

export function createTerminal(data: {
  projectId: string;
  name: string;
  shell?: string | null;
  workingDirectory?: string | null;
}): TerminalRecord {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(
    'INSERT INTO terminals (id, project_id, name, shell, working_directory, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, data.projectId, data.name, data.shell ?? null, data.workingDirectory ?? null, now);
  return getTerminalById(id)!;
}

export function updateTerminal(id: string, data: Partial<{
  name: string;
  shell: string | null;
  workingDirectory: string | null;
}>): TerminalRecord | null {
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    shell: 'shell',
    workingDirectory: 'working_directory',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if ((data as any)[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push((data as any)[key]);
    }
  }

  if (fields.length === 0) return getTerminalById(id);
  values.push(id);
  getDb().prepare(`UPDATE terminals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTerminalById(id);
}

export function deleteTerminal(id: string): void {
  getDb().prepare('DELETE FROM terminals WHERE id = ?').run(id);
}

// ─── Cost Records ─────────────────────────────────────────────────────────────

export function insertCostRecord(data: {
  sessionId: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model?: string;
}): void {
  const id = uuidv4();
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO cost_records (id, session_id, timestamp, tokens_in, tokens_out, cost_usd, model, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.sessionId, now, data.tokensIn, data.tokensOut, data.costUsd, data.model ?? null, now);
}

export function getSessionCostAggregate(sessionId: string): { tokensIn: number; tokensOut: number; costUsd: number } {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(tokens_in), 0) as tokens_in,
           COALESCE(SUM(tokens_out), 0) as tokens_out,
           COALESCE(SUM(cost_usd), 0) as cost_usd
    FROM cost_records WHERE session_id = ?
  `).get(sessionId) as any;
  return {
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
  };
}

export function getCostRecordsBySession(sessionId: string): any[] {
  return getDb().prepare(
    'SELECT * FROM cost_records WHERE session_id = ? ORDER BY timestamp ASC'
  ).all(sessionId);
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function searchSessions(query: string): SessionRecord[] {
  const pattern = `%${query}%`;
  const rows = getDb().prepare(
    'SELECT * FROM sessions WHERE name LIKE ? OR command LIKE ? ORDER BY created_at DESC LIMIT 50'
  ).all(pattern, pattern) as SessionRow[];
  return rows.map(rowToSession);
}

export function searchCommands(query: string): CommandRecord[] {
  const pattern = `%${query}%`;
  const rows = getDb().prepare(
    'SELECT * FROM commands WHERE name LIKE ? OR command LIKE ? ORDER BY created_at DESC LIMIT 50'
  ).all(pattern, pattern) as CommandRow[];
  return rows.map(rowToCommand);
}
