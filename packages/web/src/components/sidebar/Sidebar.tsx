import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ProjectHeader } from './ProjectHeader';
import { SidebarSection } from './SidebarSection';
import { SidebarItem } from './SidebarItem';
import { PastSessions } from './PastSessions';
import { AddProcessModal } from '../modals/AddProcessModal';
import { ContextMenu } from '../context-menu/ContextMenu';
import type { MenuItem } from '../context-menu/ContextMenu';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import type { ManagedProcess } from '../../lib/types';

function formatMetrics(proc: ManagedProcess): string {
  const parts: string[] = [];
  if (proc.metrics?.detectedPort) parts.push(`:${proc.metrics.detectedPort}`);
  if (proc.metrics?.cpuPercent > 0) parts.push(`${proc.metrics.cpuPercent.toFixed(1)}%`);
  return parts.join(' · ');
}

export function Sidebar() {
  const store = useAppStore();
  const {
    projects,
    activeProjectId,
    sessions,
    commands,
    terminals,
    selectedProcessId,
    setSelectedProcess,
  } = store;

  const [showAddCommand, setShowAddCommand] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    type: string;
    id: string;
    x: number;
    y: number;
    process?: ManagedProcess;
  } | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectSessions = Object.values(sessions).filter(
    s => s.projectId === activeProjectId
  );
  const projectCommands = Object.values(commands).filter(
    c => c.projectId === activeProjectId
  );
  const projectTerminals = Object.values(terminals).filter(
    t => t.projectId === activeProjectId
  );
  const otherProjects = projects.filter(p => p.id !== activeProjectId);

  const runningSessions = projectSessions.filter(s => s.state === 'running').length;
  const runningCommands = projectCommands.filter(c => c.state === 'running').length;
  const runningTerminals = projectTerminals.filter(t => t.state === 'running').length;

  // When clicking an already-selected stopped/errored process, cycle through
  // null to force useTerminal to re-mount, re-subscribe, and trigger respawn.
  const handleSelectProcess = (proc: ManagedProcess) => {
    if (selectedProcessId === proc.id && proc.state !== 'running') {
      setSelectedProcess(null);
      requestAnimationFrame(() => setSelectedProcess(proc.id));
    } else {
      setSelectedProcess(proc.id);
    }
  };

  // After deleting a process, if it was the one currently selected, route the
  // user back to the all-projects dashboard so the main pane doesn't dangle on
  // a now-missing tab.
  const routeAwayIfSelected = (deletedId: string) => {
    if (selectedProcessId !== deletedId) return;
    store.setSelectedProcess(null);
    store.setProjectOverviewOpen(false);
  };

  const handleAddTerminal = async () => {
    if (!activeProjectId) return;
    try {
      const t = await api.terminals.create(activeProjectId, {});
      store.upsertTerminal(t);
      store.setSelectedProcess(t.id);
    } catch {
      toast.error('Failed to create terminal');
    }
  };

  const getSessionMenuItems = (process: ManagedProcess): MenuItem[] => {
    const isRunning = process.state === 'running';
    return [
      {
        label: isRunning ? 'Stop' : 'Start',
        action: () => {
          if (isRunning) api.processes.stop(process.id).catch(() => toast.error('Failed to stop'));
          else api.processes.start(process.id).catch(() => toast.error('Failed to start'));
        },
      },
      {
        label: 'Restart',
        action: () => api.processes.restart(process.id).catch(() => toast.error('Failed to restart')),
      },
      {
        label: 'Clear output',
        action: () => api.processes.clearScrollback(process.id).catch(() => toast.error('Failed to clear')),
        divider: true,
      },
      {
        label: 'Delete session',
        action: async () => {
          try {
            await api.sessions.delete(process.id);
            store.removeSession(process.id);
            routeAwayIfSelected(process.id);
            window.dispatchEvent(new Event('mt:past-sessions-refresh'));
            toast.success('Session deleted');
          } catch {
            toast.error('Failed to delete session');
          }
        },
        divider: true,
        danger: true,
      },
    ];
  };

  const getCommandMenuItems = (process: ManagedProcess): MenuItem[] => {
    const isRunning = process.state === 'running';
    return [
      {
        label: isRunning ? 'Stop' : 'Start',
        action: () => {
          if (isRunning) api.processes.stop(process.id).catch(() => toast.error('Failed to stop'));
          else api.processes.start(process.id).catch(() => toast.error('Failed to start'));
        },
      },
      {
        label: 'Restart',
        action: () => api.processes.restart(process.id).catch(() => toast.error('Failed to restart')),
      },
      {
        label: 'Copy command',
        action: () => {
          navigator.clipboard.writeText(process.command);
          toast.success('Command copied');
        },
        divider: true,
      },
      {
        label: 'Clear output',
        action: () => api.processes.clearScrollback(process.id).catch(() => toast.error('Failed to clear')),
      },
      {
        label: 'Delete command',
        action: async () => {
          try {
            await api.commands.delete(process.id);
            store.removeCommand(process.id);
            routeAwayIfSelected(process.id);
            toast.success('Command deleted');
          } catch {
            toast.error('Failed to delete command');
          }
        },
        divider: true,
        danger: true,
      },
    ];
  };

  const getTerminalMenuItems = (process: ManagedProcess): MenuItem[] => [
    {
      label: 'Close terminal',
      action: async () => {
        try {
          await api.terminals.delete(process.id);
          store.removeTerminal(process.id);
          routeAwayIfSelected(process.id);
          toast.success('Terminal closed');
        } catch {
          toast.error('Failed to close terminal');
        }
      },
    },
    {
      label: 'Clear output',
      action: () => api.processes.clearScrollback(process.id).catch(() => toast.error('Failed to clear')),
      divider: true,
    },
  ];

  const getProjectHeaderMenuItems = (): MenuItem[] => {
    if (!activeProjectId || !activeProject) return [];
    return [
      {
        label: 'Start all',
        action: () => api.projects.startAll(activeProjectId).catch(() => toast.error('Failed to start all')),
      },
      {
        label: 'Stop all',
        action: () => api.projects.stopAll(activeProjectId).catch(() => toast.error('Failed to stop all')),
      },
      {
        label: 'Project settings',
        action: () => store.setProjectSettingsOpen(true),
        divider: true,
      },
      {
        label: 'Remove project',
        action: async () => {
          if (!window.confirm(`Remove project "${activeProject.name}"? This will not delete any files.`)) return;
          const removedId = activeProjectId;
          try {
            await api.projects.delete(removedId);

            // Drop everything tied to the deleted project from the store
            const remainingSessions = Object.fromEntries(
              Object.entries(store.sessions).filter(([, s]) => s.projectId !== removedId)
            );
            const remainingCommands = Object.fromEntries(
              Object.entries(store.commands).filter(([, c]) => c.projectId !== removedId)
            );
            const remainingTerminals = Object.fromEntries(
              Object.entries(store.terminals).filter(([, t]) => t.projectId !== removedId)
            );
            useAppStore.setState({
              sessions: remainingSessions,
              commands: remainingCommands,
              terminals: remainingTerminals,
            });

            store.removeProject(removedId);
            store.setSelectedProcess(null);
            store.setProjectOverviewOpen(false);

            // Switch active project to the next available one (or none)
            const nextProject = store.projects.find((p) => p.id !== removedId);
            if (nextProject) {
              store.setActiveProject(nextProject.id);
              try {
                const [s, c, t] = await Promise.all([
                  api.sessions.list(nextProject.id),
                  api.commands.list(nextProject.id),
                  api.terminals.list(nextProject.id),
                ]);
                store.setSessions(s);
                store.setCommands(c);
                store.setTerminals(t);
              } catch { /* daemon may be unreachable; non-fatal */ }
            } else {
              useAppStore.setState({ activeProjectId: null });
            }

            // Past Sessions: prior pinned rows just became unpinned
            window.dispatchEvent(new Event('mt:past-sessions-refresh'));

            toast.success('Project removed');
          } catch {
            toast.error('Failed to remove project');
          }
        },
        divider: true,
        danger: true,
      },
    ];
  };

  const getContextMenuItems = (): MenuItem[] => {
    if (!contextMenu) return [];
    const { type, process } = contextMenu;
    if (!process) {
      if (type === 'project-header') return getProjectHeaderMenuItems();
      return [];
    }
    switch (type) {
      case 'session': return getSessionMenuItems(process);
      case 'command': return getCommandMenuItems(process);
      case 'terminal': return getTerminalMenuItems(process);
      default: return [];
    }
  };

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {activeProject && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 16px 4px',
              backgroundColor: 'var(--bg-sidebar)',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}
            >
              ACTIVE PROJECT
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                backgroundColor: 'var(--border)',
                margin: '0 8px',
              }}
            />
          </div>

          <div
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ type: 'project-header', id: activeProject.id, x: e.clientX, y: e.clientY });
            }}
          >
            <ProjectHeader project={activeProject} />
          </div>

          <SidebarSection
            title="SESSIONS"
            running={runningSessions}
            total={projectSessions.length}
            onAdd={() => store.setAddAgentModalOpen(true)}
          >
            {projectSessions.length > 0 ? (
              projectSessions.map(session => (
                <SidebarItem
                  key={session.id}
                  process={session}
                  subtitle={(session as any).claudeState?.label || undefined}
                  isSelected={selectedProcessId === session.id}
                  onClick={() => handleSelectProcess(session)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ type: 'session', id: session.id, x: e.clientX, y: e.clientY, process: session });
                  }}
                />
              ))
            ) : (
              <div style={{ padding: '4px 16px 4px 42px', fontSize: 12, color: 'var(--text-muted)' }}>
                No sessions yet
              </div>
            )}
          </SidebarSection>

          <SidebarSection
            title="TERMINALS"
            running={runningTerminals}
            total={projectTerminals.length}
            onAdd={handleAddTerminal}
          >
            {projectTerminals.length > 0 ? (
              projectTerminals.map(term => (
                <SidebarItem
                  key={term.id}
                  process={term}
                  isSelected={selectedProcessId === term.id}
                  onClick={() => handleSelectProcess(term)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ type: 'terminal', id: term.id, x: e.clientX, y: e.clientY, process: term });
                  }}
                />
              ))
            ) : (
              <div style={{ padding: '4px 16px 4px 42px', fontSize: 12, color: 'var(--text-muted)' }}>
                No terminals yet
              </div>
            )}
          </SidebarSection>

          <SidebarSection
            title="COMMANDS"
            running={runningCommands}
            total={projectCommands.length}
            onAdd={() => setShowAddCommand(true)}
          >
            {projectCommands.length > 0 ? (
              projectCommands.map(cmd => (
                <SidebarItem
                  key={cmd.id}
                  process={cmd}
                  metrics={formatMetrics(cmd)}
                  isSelected={selectedProcessId === cmd.id}
                  onClick={() => handleSelectProcess(cmd)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ type: 'command', id: cmd.id, x: e.clientX, y: e.clientY, process: cmd });
                  }}
                />
              ))
            ) : (
              <div style={{ padding: '4px 16px 4px 42px', fontSize: 12, color: 'var(--text-muted)' }}>
                No commands yet
              </div>
            )}
          </SidebarSection>
        </>
      )}

      {otherProjects.length > 0 && (
        <div
          style={{
            marginTop: 16,
            borderTop: '1px solid var(--border)',
            paddingTop: 8,
          }}
        >
          {otherProjects.map((proj) => (
            <div
              key={proj.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
              onClick={() => useAppStore.getState().setActiveProject(proj.id)}
            >
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                {proj.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {!activeProject && (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
          No project registered. Add a project to get started.
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <PastSessions />
      </div>

      {showAddCommand && activeProjectId && (
        <AddProcessModal
          projectId={activeProjectId}
          onClose={() => setShowAddCommand(false)}
        />
      )}

      {contextMenu && (
        <ContextMenu
          items={getContextMenuItems()}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
