import { create } from 'zustand';
import type {
  Project,
  Session,
  Command,
  Terminal,
  PermissionPrompt,
  OptionPrompt,
  ProcessState,
  ProcessMetrics,
  Message,
  SessionAlert,
  ElicitationPrompt,
} from '../lib/types';
import type { Theme, ThemeColors } from '../lib/themes';
import {
  BUILTIN_THEMES,
  BUILTIN_DARK,
  loadCustomThemesFromStorage,
  loadActiveThemeIdFromStorage,
  saveCustomThemesToStorage,
  saveActiveThemeIdToStorage,
} from '../lib/themes';

interface AppState {
  // Projects
  projects: Project[];
  expandedProjectIds: string[];
  focusedProjectId: string | null;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  removeProject: (id: string) => void;
  expandProject: (id: string) => void;
  collapseProject: (id: string) => void;
  toggleProjectExpanded: (id: string) => void;
  setFocusedProject: (id: string | null) => void;
  setExpandedProjects: (ids: string[]) => void;

  // Processes (sessions, commands, terminals keyed by id)
  sessions: Record<string, Session>;
  commands: Record<string, Command>;
  terminals: Record<string, Terminal>;
  setSessions: (sessions: Session[]) => void;
  setCommands: (commands: Command[]) => void;
  setTerminals: (terminals: Terminal[]) => void;
  mergeSessions: (sessions: Session[]) => void;
  mergeCommands: (commands: Command[]) => void;
  mergeTerminals: (terminals: Terminal[]) => void;
  updateProcessState: (id: string, state: ProcessState) => void;
  updateProcessMetrics: (id: string, metrics: Partial<ProcessMetrics>) => void;
  upsertSession: (session: Session) => void;
  removeSession: (id: string) => void;
  upsertCommand: (command: Command) => void;
  removeCommand: (id: string) => void;

  // Terminals upsert/remove
  upsertTerminal: (terminal: Terminal) => void;
  removeTerminal: (id: string) => void;

  // UI
  selectedProcessId: string | null;
  sidebarCollapsed: boolean;
  customThemes: Theme[];
  activeThemeId: string;
  commandPaletteOpen: boolean;
  addAgentModalOpen: boolean;
  addProcessModalOpen: boolean;
  addProjectModalOpen: boolean;
  globalSettingsOpen: boolean;
  projectSettingsOpen: boolean;
  detailPanelOpen: boolean;
  detailPanelTab: 'files' | 'diff' | 'cost' | 'prompts' | 'brainstorm' | 'tasks';
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  projectOverviewOpen: boolean;
  contextMenu: { type: string; id: string; x: number; y: number } | null;
  mobileDrawerOpen: boolean;
  setSelectedProcess: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveTheme: (id: string) => void;
  addCustomTheme: (theme: Theme) => void;
  updateCustomTheme: (id: string, patch: { name?: string; colors?: Partial<ThemeColors>; isDark?: boolean }) => void;
  deleteCustomTheme: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAddAgentModalOpen: (open: boolean) => void;
  setAddProcessModalOpen: (open: boolean) => void;
  setAddProjectModalOpen: (open: boolean) => void;
  setGlobalSettingsOpen: (open: boolean) => void;
  setProjectSettingsOpen: (open: boolean) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelTab: (tab: 'files' | 'diff' | 'cost' | 'prompts' | 'brainstorm' | 'tasks') => void;
  setConnectionState: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  setProjectOverviewOpen: (open: boolean) => void;
  setContextMenu: (menu: { type: string; id: string; x: number; y: number } | null) => void;
  setMobileDrawerOpen: (open: boolean) => void;

  // Permissions
  pendingPermissions: PermissionPrompt[];
  addPermission: (prompt: PermissionPrompt) => void;
  removePermission: (id: string) => void;

  // Options
  currentOption: OptionPrompt | null;
  setOption: (option: OptionPrompt | null) => void;

  // Session transcript messages (chat view)
  messagesBySession: Record<string, Message[]>;
  setMessages: (sessionId: string, messages: Message[]) => void;
  appendMessages: (sessionId: string, messages: Message[]) => void;
  /** Merge a fetched batch with already-stored messages; dedupes by id, sorts by ts. */
  mergeMessages: (sessionId: string, messages: Message[]) => void;
  clearMessages: (sessionId: string) => void;

  // Alerts (notification history + per-session unread counts)
  alerts: SessionAlert[];
  unreadBySession: Record<string, number>;
  notificationCenterOpen: boolean;
  addAlert: (alert: SessionAlert) => void;
  dismissAlert: (alertId: string) => void;
  markSessionRead: (sessionId: string) => void;
  /** Increment unread count for a session without going through the alert envelope. */
  bumpUnread: (sessionId: string) => void;
  clearAllAlerts: () => void;
  setNotificationCenterOpen: (open: boolean) => void;

  // Elicitations (MCP form/url prompts)
  pendingElicitations: ElicitationPrompt[];
  addElicitation: (prompt: ElicitationPrompt) => void;
  removeElicitation: (id: string) => void;

  // Per-session live task list (driven by session:task-event)
  tasksBySession: Record<string, TaskEntry[]>;
  applyTaskEvent: (sessionId: string, subtype: string, payload: Record<string, unknown>) => void;

  // Per-session tool progress (most-recent only) and status spinner
  toolProgressBySession: Record<string, ToolProgress | null>;
  setToolProgress: (sessionId: string, progress: ToolProgress | null) => void;
  statusBySession: Record<string, SessionStatus>;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
}

export type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'killed' | 'stopped' | 'unknown';

export interface TaskEntry {
  taskId: string;
  description: string;
  state: TaskState;
  taskType?: string;
  workflowName?: string;
  totalTokens?: number;
  toolUses?: number;
  durationMs?: number;
  lastToolName?: string;
  summary?: string;
  outputFile?: string;
  startedAt: number;
  endedAt?: number;
  isBackgrounded?: boolean;
  skipTranscript?: boolean;
}

export interface ToolProgress {
  toolUseId: string;
  toolName: string;
  elapsedSeconds: number;
  taskId: string | null;
  parentToolUseId: string | null;
  receivedAt: number;
}

export type SessionStatus =
  | { status: null }
  | { status: 'compacting' | 'requesting'; compactResult?: 'success' | 'failed' | null; compactError?: string | null };

// Cap alert history so an unattended user doesn't grow it indefinitely.
const MAX_ALERT_HISTORY = 200;

export const useAppStore = create<AppState>((set, get) => ({
  // Projects
  projects: [],
  expandedProjectIds: [],
  focusedProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  updateProject: (project) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === project.id ? { ...p, ...project } : p)),
    })),
  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      expandedProjectIds: s.expandedProjectIds.filter((pid) => pid !== id),
      focusedProjectId:
        s.focusedProjectId === id
          ? s.expandedProjectIds.find((pid) => pid !== id) ?? null
          : s.focusedProjectId,
    })),
  expandProject: (id) =>
    set((s) => ({
      expandedProjectIds: s.expandedProjectIds.includes(id)
        ? s.expandedProjectIds
        : [...s.expandedProjectIds, id],
      focusedProjectId: id,
    })),
  collapseProject: (id) =>
    set((s) => {
      const next = s.expandedProjectIds.filter((pid) => pid !== id);
      return {
        expandedProjectIds: next,
        focusedProjectId:
          s.focusedProjectId === id ? next[0] ?? null : s.focusedProjectId,
      };
    }),
  toggleProjectExpanded: (id) => {
    const { expandedProjectIds, expandProject, collapseProject } = get();
    if (expandedProjectIds.includes(id)) collapseProject(id);
    else expandProject(id);
  },
  setFocusedProject: (id) => set({ focusedProjectId: id }),
  setExpandedProjects: (ids) => set({ expandedProjectIds: ids }),

  // Processes
  sessions: {},
  commands: {},
  terminals: {},
  setSessions: (sessions) =>
    set({ sessions: Object.fromEntries(sessions.map(s => [s.id, s])) }),
  setCommands: (commands) =>
    set({ commands: Object.fromEntries(commands.map(c => [c.id, c])) }),
  setTerminals: (terminals) =>
    set({ terminals: Object.fromEntries(terminals.map(t => [t.id, t])) }),
  mergeSessions: (sessions) =>
    set((s) => ({
      sessions: { ...s.sessions, ...Object.fromEntries(sessions.map(x => [x.id, x])) },
    })),
  mergeCommands: (commands) =>
    set((s) => ({
      commands: { ...s.commands, ...Object.fromEntries(commands.map(x => [x.id, x])) },
    })),
  mergeTerminals: (terminals) =>
    set((s) => ({
      terminals: { ...s.terminals, ...Object.fromEntries(terminals.map(x => [x.id, x])) },
    })),
  updateProcessState: (id, state) =>
    set((s) => {
      const sessions = { ...s.sessions };
      const commands = { ...s.commands };
      const terminals = { ...s.terminals };
      if (id in sessions) sessions[id] = { ...sessions[id], state };
      if (id in commands) commands[id] = { ...commands[id], state };
      if (id in terminals) terminals[id] = { ...terminals[id], state };
      return { sessions, commands, terminals };
    }),
  updateProcessMetrics: (id, metrics) =>
    set((s) => {
      const sessions = { ...s.sessions };
      const commands = { ...s.commands };
      if (id in sessions)
        sessions[id] = { ...sessions[id], metrics: { ...sessions[id].metrics, ...metrics } };
      if (id in commands)
        commands[id] = { ...commands[id], metrics: { ...commands[id].metrics, ...metrics } };
      return { sessions, commands };
    }),
  upsertSession: (session) =>
    set((s) => ({ sessions: { ...s.sessions, [session.id]: session } })),
  removeSession: (id) =>
    set((s) => {
      const sessions = { ...s.sessions };
      delete sessions[id];
      return { sessions };
    }),
  upsertCommand: (command) =>
    set((s) => ({ commands: { ...s.commands, [command.id]: command } })),
  removeCommand: (id) =>
    set((s) => {
      const commands = { ...s.commands };
      delete commands[id];
      return { commands };
    }),
  upsertTerminal: (terminal) =>
    set((s) => ({ terminals: { ...s.terminals, [terminal.id]: terminal } })),
  removeTerminal: (id) =>
    set((s) => {
      const terminals = { ...s.terminals };
      delete terminals[id];
      return { terminals };
    }),

  // UI
  selectedProcessId: null,
  sidebarCollapsed: false,
  customThemes: loadCustomThemesFromStorage(),
  activeThemeId: (() => {
    const stored = loadActiveThemeIdFromStorage();
    const customs = loadCustomThemesFromStorage();
    const all = [...BUILTIN_THEMES, ...customs];
    if (stored && all.some((t) => t.id === stored)) return stored;
    return BUILTIN_DARK.id;
  })(),
  commandPaletteOpen: false,
  addAgentModalOpen: false,
  addProcessModalOpen: false,
  addProjectModalOpen: false,
  globalSettingsOpen: false,
  projectSettingsOpen: false,
  detailPanelOpen: false,
  detailPanelTab: 'brainstorm',
  connectionState: 'disconnected',
  projectOverviewOpen: false,
  contextMenu: null,
  mobileDrawerOpen: false,
  setSelectedProcess: (id) =>
    set((s) => {
      if (id === null) return { selectedProcessId: null };
      const proc = s.sessions[id] || s.commands[id] || s.terminals[id];
      if (!proc) return { selectedProcessId: id };
      return {
        selectedProcessId: id,
        focusedProjectId: proc.projectId,
      };
    }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setActiveTheme: (id) =>
    set(() => {
      saveActiveThemeIdToStorage(id);
      return { activeThemeId: id };
    }),
  addCustomTheme: (theme) =>
    set((s) => {
      const next = [...s.customThemes, theme];
      saveCustomThemesToStorage(next);
      return { customThemes: next };
    }),
  updateCustomTheme: (id, patch) =>
    set((s) => {
      const next = s.customThemes.map((t) =>
        t.id === id
          ? {
              ...t,
              name: patch.name ?? t.name,
              isDark: patch.isDark ?? t.isDark,
              colors: patch.colors ? { ...t.colors, ...patch.colors } : t.colors,
            }
          : t
      );
      saveCustomThemesToStorage(next);
      return { customThemes: next };
    }),
  deleteCustomTheme: (id) =>
    set((s) => {
      const next = s.customThemes.filter((t) => t.id !== id);
      saveCustomThemesToStorage(next);
      const activeId = s.activeThemeId === id ? BUILTIN_DARK.id : s.activeThemeId;
      if (activeId !== s.activeThemeId) saveActiveThemeIdToStorage(activeId);
      return { customThemes: next, activeThemeId: activeId };
    }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setAddAgentModalOpen: (open) => set({ addAgentModalOpen: open }),
  setAddProcessModalOpen: (open) => set({ addProcessModalOpen: open }),
  setAddProjectModalOpen: (open) => set({ addProjectModalOpen: open }),
  setGlobalSettingsOpen: (open) => set({ globalSettingsOpen: open }),
  setProjectSettingsOpen: (open) => set({ projectSettingsOpen: open }),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setDetailPanelTab: (tab) => set({ detailPanelTab: tab }),
  setConnectionState: (state) => set({ connectionState: state }),
  setProjectOverviewOpen: (open) => set({ projectOverviewOpen: open }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),

  // Permissions
  pendingPermissions: [],
  addPermission: (prompt) =>
    set((s) =>
      s.pendingPermissions.some(p => p.id === prompt.id)
        ? s
        : { pendingPermissions: [...s.pendingPermissions, prompt] }
    ),
  removePermission: (id) =>
    set((s) => ({ pendingPermissions: s.pendingPermissions.filter(p => p.id !== id) })),

  // Options
  currentOption: null,
  setOption: (option) => set({ currentOption: option }),

  // Messages
  messagesBySession: {},
  setMessages: (sessionId, messages) =>
    set((s) => ({ messagesBySession: { ...s.messagesBySession, [sessionId]: messages } })),
  appendMessages: (sessionId, messages) =>
    set((s) => {
      if (messages.length === 0) return s;
      const existing = s.messagesBySession[sessionId] ?? [];
      const seen = new Set(existing.map((m) => m.id));
      const additions = messages.filter((m) => !seen.has(m.id));
      if (additions.length === 0) return s;
      return {
        messagesBySession: {
          ...s.messagesBySession,
          [sessionId]: [...existing, ...additions],
        },
      };
    }),
  mergeMessages: (sessionId, messages) =>
    set((s) => {
      const existing = s.messagesBySession[sessionId] ?? [];
      if (existing.length === 0) {
        return { messagesBySession: { ...s.messagesBySession, [sessionId]: messages } };
      }
      const byId = new Map<string, Message>();
      for (const m of messages) byId.set(m.id, m);
      // Existing-store entries take precedence — they include in-flight WS
      // updates that may not have hit the JSONL yet.
      for (const m of existing) byId.set(m.id, m);
      const merged = [...byId.values()].sort((a, b) => a.ts - b.ts);
      return { messagesBySession: { ...s.messagesBySession, [sessionId]: merged } };
    }),
  clearMessages: (sessionId) =>
    set((s) => {
      if (!(sessionId in s.messagesBySession)) return s;
      const next = { ...s.messagesBySession };
      delete next[sessionId];
      return { messagesBySession: next };
    }),

  // Alerts
  alerts: [],
  unreadBySession: {},
  notificationCenterOpen: false,
  addAlert: (alert) =>
    set((s) => {
      // Dedup by alertId in case a reconnect re-delivers the same envelope.
      if (s.alerts.some((a) => a.alertId === alert.alertId)) return s;
      const persistent = alert.persistent
        ? [alert, ...s.alerts].slice(0, MAX_ALERT_HISTORY)
        : s.alerts;
      const unread = { ...s.unreadBySession };
      if (alert.needsAttention) {
        unread[alert.sessionId] = (unread[alert.sessionId] ?? 0) + 1;
      }
      return { alerts: persistent, unreadBySession: unread };
    }),
  dismissAlert: (alertId) =>
    set((s) => ({ alerts: s.alerts.filter((a) => a.alertId !== alertId) })),
  markSessionRead: (sessionId) =>
    set((s) => {
      if (!s.unreadBySession[sessionId]) return s;
      const next = { ...s.unreadBySession };
      delete next[sessionId];
      return { unreadBySession: next };
    }),
  bumpUnread: (sessionId) =>
    set((s) => ({
      unreadBySession: {
        ...s.unreadBySession,
        [sessionId]: (s.unreadBySession[sessionId] ?? 0) + 1,
      },
    })),
  clearAllAlerts: () => set({ alerts: [], unreadBySession: {} }),
  setNotificationCenterOpen: (open) => set({ notificationCenterOpen: open }),

  // Elicitations
  pendingElicitations: [],
  addElicitation: (prompt) =>
    set((s) =>
      s.pendingElicitations.some((p) => p.id === prompt.id)
        ? s
        : { pendingElicitations: [...s.pendingElicitations, prompt] }
    ),
  removeElicitation: (id) =>
    set((s) => ({ pendingElicitations: s.pendingElicitations.filter((p) => p.id !== id) })),

  // Tasks
  tasksBySession: {},
  applyTaskEvent: (sessionId, subtype, payload) =>
    set((s) => {
      const list = [...(s.tasksBySession[sessionId] ?? [])];
      const taskId = typeof payload.task_id === 'string' ? payload.task_id : '';
      if (!taskId) return s;
      const idx = list.findIndex((t) => t.taskId === taskId);

      function patch(into: TaskEntry, with_: Partial<TaskEntry>): TaskEntry {
        return { ...into, ...with_ };
      }

      const now = Date.now();

      if (subtype === 'task_started') {
        const desc = typeof payload.description === 'string' ? payload.description : 'Task';
        const taskType = typeof payload.task_type === 'string' ? payload.task_type : undefined;
        const workflowName = typeof payload.workflow_name === 'string' ? payload.workflow_name : undefined;
        const skipTranscript = payload.skip_transcript === true;
        const entry: TaskEntry = {
          taskId,
          description: desc,
          state: 'running',
          taskType,
          workflowName,
          startedAt: now,
          skipTranscript,
        };
        if (idx >= 0) list[idx] = patch(list[idx], entry);
        else list.push(entry);
      } else if (subtype === 'task_progress') {
        const usage = (payload.usage ?? {}) as Record<string, unknown>;
        const upd: Partial<TaskEntry> = {
          description: typeof payload.description === 'string' ? payload.description : undefined,
          totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
          toolUses: typeof usage.tool_uses === 'number' ? usage.tool_uses : undefined,
          durationMs: typeof usage.duration_ms === 'number' ? usage.duration_ms : undefined,
          lastToolName: typeof payload.last_tool_name === 'string' ? payload.last_tool_name : undefined,
          summary: typeof payload.summary === 'string' ? payload.summary : undefined,
        };
        if (idx >= 0) list[idx] = patch(list[idx], upd);
        else list.push({ taskId, description: upd.description ?? '…', state: 'running', startedAt: now, ...upd });
      } else if (subtype === 'task_updated') {
        const p = (payload.patch ?? {}) as Record<string, unknown>;
        const stateRaw = typeof p.status === 'string' ? p.status : undefined;
        const state: TaskState = isTaskState(stateRaw) ? (stateRaw as TaskState) : 'unknown';
        const upd: Partial<TaskEntry> = {
          description: typeof p.description === 'string' ? p.description : undefined,
          state: stateRaw ? state : undefined,
          endedAt: typeof p.end_time === 'number' ? p.end_time : undefined,
          isBackgrounded: typeof p.is_backgrounded === 'boolean' ? p.is_backgrounded : undefined,
        };
        if (idx >= 0) list[idx] = patch(list[idx], upd);
        else list.push({ taskId, description: upd.description ?? '…', state: state, startedAt: now, ...upd });
      } else if (subtype === 'task_notification') {
        const status = typeof payload.status === 'string' ? payload.status : 'completed';
        const finalState: TaskState =
          status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : status === 'stopped' ? 'stopped' : 'unknown';
        const usage = (payload.usage ?? {}) as Record<string, unknown>;
        const upd: Partial<TaskEntry> = {
          state: finalState,
          summary: typeof payload.summary === 'string' ? payload.summary : undefined,
          outputFile: typeof payload.output_file === 'string' ? payload.output_file : undefined,
          totalTokens: typeof usage.total_tokens === 'number' ? usage.total_tokens : undefined,
          toolUses: typeof usage.tool_uses === 'number' ? usage.tool_uses : undefined,
          durationMs: typeof usage.duration_ms === 'number' ? usage.duration_ms : undefined,
          endedAt: now,
        };
        if (idx >= 0) list[idx] = patch(list[idx], upd);
        else list.push({ taskId, description: upd.summary ?? 'Task', state: finalState, startedAt: now, ...upd });
      }

      return { tasksBySession: { ...s.tasksBySession, [sessionId]: list } };
    }),

  // Tool progress
  toolProgressBySession: {},
  setToolProgress: (sessionId, progress) =>
    set((s) => ({
      toolProgressBySession: { ...s.toolProgressBySession, [sessionId]: progress },
    })),

  // Status spinner
  statusBySession: {},
  setSessionStatus: (sessionId, status) =>
    set((s) => ({
      statusBySession: { ...s.statusBySession, [sessionId]: status },
    })),
}));

function isTaskState(s: string | undefined): boolean {
  return s === 'pending' || s === 'running' || s === 'completed' || s === 'failed' || s === 'killed';
}
