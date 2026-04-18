import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const { ctrlKey, shiftKey, altKey, metaKey, key } = e;
      const mod = ctrlKey || metaKey; // support both Ctrl and Cmd
      const state = useAppStore.getState();

      // --- Command Palette (Ctrl+K) ---
      if (mod && key === 'k') {
        e.preventDefault();
        state.setCommandPaletteOpen(true);
        return;
      }

      // --- New Terminal (Ctrl+T) ---
      if (mod && !shiftKey && key === 't') {
        e.preventDefault();
        const projectId = state.activeProjectId;
        if (projectId) {
          api.terminals
            .create(projectId, {})
            .then((t) => {
              useAppStore.getState().upsertTerminal(t);
              useAppStore.getState().setSelectedProcess(t.id);
              toast.success('Terminal created');
            })
            .catch(() => toast.error('Failed to create terminal'));
        }
        return;
      }

      // --- Close Terminal (Ctrl+W) ---
      if (mod && !shiftKey && key === 'w') {
        e.preventDefault();
        const id = state.selectedProcessId;
        if (id && state.terminals[id]) {
          api.terminals
            .delete(id)
            .then(() => {
              useAppStore.getState().removeTerminal(id);
              useAppStore.getState().setSelectedProcess(null);
            })
            .catch(() => {});
        }
        return;
      }

      // --- Settings (Ctrl+,) ---
      if (mod && key === ',') {
        e.preventDefault();
        state.setGlobalSettingsOpen(true);
        return;
      }

      // --- Alt+1-9: Switch project ---
      if (altKey && !mod && !shiftKey && key >= '1' && key <= '9') {
        e.preventDefault();
        const idx = parseInt(key) - 1;
        const projects = state.projects;
        if (projects[idx]) {
          state.setActiveProject(projects[idx].id);
          state.setSelectedProcess(null);
          // Load sessions/commands/terminals for new project
          Promise.all([
            api.sessions.list(projects[idx].id),
            api.commands.list(projects[idx].id),
            api.terminals.list(projects[idx].id),
          ]).then(([sessions, commands, terminals]) => {
            const s = useAppStore.getState();
            s.setSessions(sessions);
            s.setCommands(commands);
            s.setTerminals(terminals);
          });
        }
        return;
      }

      // --- Alt+S/T/C: Jump to section ---
      if (altKey && !mod && !shiftKey) {
        if (key === 's') {
          e.preventDefault();
          const sessions = Object.values(state.sessions).filter(
            (s) => s.projectId === state.activeProjectId,
          );
          if (sessions.length > 0) state.setSelectedProcess(sessions[0].id);
          return;
        }
        if (key === 't') {
          e.preventDefault();
          const terms = Object.values(state.terminals).filter(
            (t) => t.projectId === state.activeProjectId,
          );
          if (terms.length > 0) state.setSelectedProcess(terms[0].id);
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          const cmds = Object.values(state.commands).filter(
            (c) => c.projectId === state.activeProjectId,
          );
          if (cmds.length > 0) state.setSelectedProcess(cmds[0].id);
          return;
        }
      }

      // --- Ctrl+Shift shortcuts ---
      if (mod && shiftKey) {
        switch (key.toLowerCase()) {
          case 's': // Start all
            e.preventDefault();
            if (state.activeProjectId) {
              api.projects
                .startAll(state.activeProjectId)
                .then(() => toast.success('All processes started'));
            }
            return;
          case 'x': // Stop all
            e.preventDefault();
            if (state.activeProjectId) {
              api.projects
                .stopAll(state.activeProjectId)
                .then(() => toast.success('All processes stopped'));
            }
            return;
          case 'r': // Restart selected
            e.preventDefault();
            if (state.selectedProcessId) {
              api.processes
                .restart(state.selectedProcessId)
                .then(() => toast.success('Process restarted'));
            }
            return;
          case 'l': // Clear terminal
            e.preventDefault();
            if (state.selectedProcessId) {
              api.processes.clearScrollback(state.selectedProcessId);
            }
            return;
          case 'p': // Add project
            e.preventDefault();
            state.setAddProjectModalOpen(true);
            return;
          case 'a': // Add session
            e.preventDefault();
            state.setAddAgentModalOpen(true);
            return;
          case 'f': // Files tab
            e.preventDefault();
            state.setDetailPanelOpen(true);
            state.setDetailPanelTab('files');
            return;
          case 'd': // Diff tab
            e.preventDefault();
            state.setDetailPanelOpen(true);
            state.setDetailPanelTab('diff');
            return;
          case 'n': // Notes tab
            e.preventDefault();
            state.setDetailPanelOpen(true);
            state.setDetailPanelTab('notes');
            return;
        }
      }

      // --- Alt+Up/Down: Navigate sidebar items ---
      if (altKey && !mod && (key === 'ArrowUp' || key === 'ArrowDown')) {
        e.preventDefault();
        const allProcesses = [
          ...Object.values(state.sessions).filter(
            (s) => s.projectId === state.activeProjectId,
          ),
          ...Object.values(state.terminals).filter(
            (t) => t.projectId === state.activeProjectId,
          ),
          ...Object.values(state.commands).filter(
            (c) => c.projectId === state.activeProjectId,
          ),
        ];
        if (allProcesses.length === 0) return;
        const currentIdx = allProcesses.findIndex(
          (p) => p.id === state.selectedProcessId,
        );
        let nextIdx;
        if (key === 'ArrowDown') {
          nextIdx = currentIdx < allProcesses.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : allProcesses.length - 1;
        }
        state.setSelectedProcess(allProcesses[nextIdx].id);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
