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
} from '../lib/types';

interface AppState {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  setActiveProject: (id: string) => void;

  // Processes (sessions, commands, terminals keyed by id)
  sessions: Record<string, Session>;
  commands: Record<string, Command>;
  terminals: Record<string, Terminal>;
  setSessions: (sessions: Session[]) => void;
  setCommands: (commands: Command[]) => void;
  setTerminals: (terminals: Terminal[]) => void;
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
  theme: 'light' | 'dark' | 'system';
  commandPaletteOpen: boolean;
  addAgentModalOpen: boolean;
  addProcessModalOpen: boolean;
  addProjectModalOpen: boolean;
  globalSettingsOpen: boolean;
  projectSettingsOpen: boolean;
  detailPanelOpen: boolean;
  detailPanelTab: 'files' | 'diff' | 'cost' | 'notes';
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  projectOverviewOpen: boolean;
  contextMenu: { type: string; id: string; x: number; y: number } | null;
  setSelectedProcess: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setAddAgentModalOpen: (open: boolean) => void;
  setAddProcessModalOpen: (open: boolean) => void;
  setAddProjectModalOpen: (open: boolean) => void;
  setGlobalSettingsOpen: (open: boolean) => void;
  setProjectSettingsOpen: (open: boolean) => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelTab: (tab: 'files' | 'diff' | 'cost' | 'notes') => void;
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
}

export const useAppStore = create<AppState>((set) => ({
  // Projects
  projects: [],
  activeProjectId: null,
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter(p => p.id !== id) })),
  setActiveProject: (id) => set({ activeProjectId: id }),

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
  theme: 'system',
  commandPaletteOpen: false,
  addAgentModalOpen: false,
  addProcessModalOpen: false,
  addProjectModalOpen: false,
  globalSettingsOpen: false,
  projectSettingsOpen: false,
  detailPanelOpen: false,
  detailPanelTab: 'notes',
  connectionState: 'disconnected',
  projectOverviewOpen: false,
  contextMenu: null,
  setSelectedProcess: (id) => set({ selectedProcessId: id }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setTheme: (theme) => set({ theme }),
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
    set((s) => ({ pendingPermissions: [...s.pendingPermissions, prompt] })),
  removePermission: (id) =>
    set((s) => ({ pendingPermissions: s.pendingPermissions.filter(p => p.id !== id) })),

  // Options
  currentOption: null,
  setOption: (option) => set({ currentOption: option }),
}));
