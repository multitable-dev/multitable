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
  detailPanelTab: 'files' | 'diff' | 'cost' | 'prompts' | 'brainstorm';
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  projectOverviewOpen: boolean;
  contextMenu: { type: string; id: string; x: number; y: number } | null;
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
  setDetailPanelTab: (tab: 'files' | 'diff' | 'cost' | 'prompts' | 'brainstorm') => void;
  setConnectionState: (state: 'connected' | 'reconnecting' | 'disconnected') => void;
  setProjectOverviewOpen: (open: boolean) => void;
  setContextMenu: (menu: { type: string; id: string; x: number; y: number } | null) => void;

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
  clearMessages: (sessionId: string) => void;
}

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
  clearMessages: (sessionId) =>
    set((s) => {
      if (!(sessionId in s.messagesBySession)) return s;
      const next = { ...s.messagesBySession };
      delete next[sessionId];
      return { messagesBySession: next };
    }),
}));
