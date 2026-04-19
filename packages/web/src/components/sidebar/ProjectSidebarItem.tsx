import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ProjectHeader } from './ProjectHeader';
import { SidebarSection } from './SidebarSection';
import { SidebarItem } from './SidebarItem';
import { AddProcessModal } from '../modals/AddProcessModal';
import { ContextMenu } from '../context-menu/ContextMenu';
import type { MenuItem } from '../context-menu/ContextMenu';
import { api } from '../../lib/api';
import { terminalManager } from '../../lib/terminalManager';
import toast from 'react-hot-toast';
import type { ManagedProcess, Project } from '../../lib/types';
import { getProjectColor } from '../../lib/projectColor';
import { useIsDark } from '../../hooks/useIsDark';

function formatMetrics(proc: ManagedProcess): string {
  const parts: string[] = [];
  if (proc.metrics?.detectedPort) parts.push(`:${proc.metrics.detectedPort}`);
  if (proc.metrics?.cpuPercent > 0) parts.push(`${proc.metrics.cpuPercent.toFixed(1)}%`);
  return parts.join(' · ');
}

interface Props {
  project: Project;
}

export function ProjectSidebarItem({ project }: Props) {
  const store = useAppStore();
  const {
    sessions,
    commands,
    terminals,
    selectedProcessId,
    expandedProjectIds,
    focusedProjectId,
    setSelectedProcess,
  } = store;

  const expanded = expandedProjectIds.includes(project.id);
  const focused = focusedProjectId === project.id;
  const dark = useIsDark();
  const color = getProjectColor(project.id, dark);

  const [showAddCommand, setShowAddCommand] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    type: string;
    id: string;
    x: number;
    y: number;
    process?: ManagedProcess;
  } | null>(null);

  const projectSessions = Object.values(sessions).filter((s) => s.projectId === project.id);
  const projectCommands = Object.values(commands).filter((c) => c.projectId === project.id);
  const projectTerminals = Object.values(terminals).filter((t) => t.projectId === project.id);
  const runningSessions = projectSessions.filter((s) => s.state === 'running').length;
  const runningCommands = projectCommands.filter((c) => c.state === 'running').length;
  const runningTerminals = projectTerminals.filter((t) => t.state === 'running').length;

  const handleSelectProject = () => {
    store.setFocusedProject(project.id);
    store.setSelectedProcess(null);
    store.setProjectOverviewOpen(true);
  };

  const handleToggleExpand = () => {
    store.toggleProjectExpanded(project.id);
  };

  const handleSelectProcess = (proc: ManagedProcess) => {
    const needsReselect = selectedProcessId === proc.id && proc.state !== 'running';
    if (needsReselect) {
      setSelectedProcess(null);
      requestAnimationFrame(() => setSelectedProcess(proc.id));
    } else {
      setSelectedProcess(proc.id);
    }

    // Auto-resume/start sessions when clicked in a non-running state.
    // Errored state means a previous resume already failed — don't auto-retry;
    // the user must explicitly start a new session.
    if (proc.type === 'session' && proc.state === 'stopped') {
      const s = proc as any;
      const hasPrior = !!(s.claudeSessionId || s.claudeState?.claudeSessionId);
      if (hasPrior) {
        // Defer resume until after TerminalView mounts and the xterm has fitted,
        // so the backend spawns the PTY at the real container size (not 80×24).
        // Double-RAF matches terminalManager.attach's own fit timing, ensuring
        // glyph measurements have settled before we read cols/rows.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const dims = terminalManager.fit(proc.id);
            api.sessions
              .resumeClaude(proc.id, dims ?? undefined)
              .catch(() => toast.error('Failed to resume session'));
          });
        });
      } else {
        api.processes.start(proc.id).catch(() => toast.error('Failed to start session'));
      }
    }
  };

  const routeAwayIfSelected = (deletedId: string) => {
    if (selectedProcessId !== deletedId) return;
    store.setSelectedProcess(null);
    store.setProjectOverviewOpen(false);
  };

  const handleAddTerminal = async () => {
    try {
      const t = await api.terminals.create(project.id, {});
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

  const getTerminalMenuItems = (process: ManagedProcess): MenuItem[] => {
    const isRunning = process.state === 'running';
    return [
      isRunning
        ? {
            label: 'Restart',
            action: () =>
              api.processes.restart(process.id).catch(() => toast.error('Failed to restart')),
          }
        : {
            label: 'Start',
            action: () =>
              api.processes.start(process.id).catch(() => toast.error('Failed to start')),
          },
      {
        label: 'Clear output',
        action: () =>
          api.processes.clearScrollback(process.id).catch(() => toast.error('Failed to clear')),
        divider: true,
      },
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
        divider: true,
        danger: true,
      },
    ];
  };

  const getProjectHeaderMenuItems = (): MenuItem[] => [
    {
      label: 'Start all',
      action: () => api.projects.startAll(project.id).catch(() => toast.error('Failed to start all')),
    },
    {
      label: 'Stop all',
      action: () => api.projects.stopAll(project.id).catch(() => toast.error('Failed to stop all')),
    },
    {
      label: 'Rename project',
      action: () => setRenaming(true),
      divider: true,
    },
    {
      label: 'Project settings',
      action: () => {
        store.setFocusedProject(project.id);
        store.setProjectSettingsOpen(true);
      },
      divider: true,
    },
    {
      label: 'Remove project',
      action: async () => {
        if (!window.confirm(`Remove project "${project.name}"? This will not delete any files.`)) return;
        try {
          await api.projects.delete(project.id);

          // Drop everything tied to the deleted project from the store
          const remainingSessions = Object.fromEntries(
            Object.entries(store.sessions).filter(([, s]) => s.projectId !== project.id)
          );
          const remainingCommands = Object.fromEntries(
            Object.entries(store.commands).filter(([, c]) => c.projectId !== project.id)
          );
          const remainingTerminals = Object.fromEntries(
            Object.entries(store.terminals).filter(([, t]) => t.projectId !== project.id)
          );
          useAppStore.setState({
            sessions: remainingSessions,
            commands: remainingCommands,
            terminals: remainingTerminals,
          });

          // removeProject also handles expandedProjectIds/focusedProjectId cleanup
          store.removeProject(project.id);

          if (selectedProcessId && !(
            remainingSessions[selectedProcessId] ||
            remainingCommands[selectedProcessId] ||
            remainingTerminals[selectedProcessId]
          )) {
            store.setSelectedProcess(null);
            store.setProjectOverviewOpen(false);
          }

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
        position: 'relative',
        margin: '14px 8px 2px',
      }}
    >
      {/* Folder tab — protruding colored chip anchoring the card to the project's color */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -5,
          left: 16,
          width: 44,
          height: 7,
          backgroundColor: color.stripe,
          borderRadius: '4px 4px 0 0',
          boxShadow: focused
            ? `0 -2px 6px color-mix(in srgb, ${color.stripe} 55%, transparent)`
            : `0 -1px 2px color-mix(in srgb, ${color.stripe} 30%, transparent)`,
          transition: 'box-shadow var(--dur-med) var(--ease-out), top var(--dur-med) var(--ease-out)',
        }}
      />
      {/* Second tab, slightly offset — adds depth like stacked folder tabs */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -3,
          left: 68,
          width: 18,
          height: 5,
          backgroundColor: `color-mix(in srgb, ${color.stripe} 55%, transparent)`,
          borderRadius: '3px 3px 0 0',
        }}
      />
      {/* Card body */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 58%, transparent)',
          boxShadow: focused
            ? `var(--shadow-md), inset 4px 0 0 ${color.stripe}, inset 0 0 0 1px color-mix(in srgb, ${color.stripe} 40%, transparent), 0 0 0 2px color-mix(in srgb, ${color.stripe} 16%, transparent)`
            : `var(--shadow-sm), inset 4px 0 0 ${color.stripe}, inset 0 0 0 1px color-mix(in srgb, ${color.stripe} 22%, var(--border))`,
          transition: 'box-shadow var(--dur-med) var(--ease-out)',
        }}
      >
      <ProjectHeader
        project={project}
        expanded={expanded}
        focused={focused}
        onSelect={handleSelectProject}
        onToggle={handleToggleExpand}
        editing={renaming}
        onEditingChange={setRenaming}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ type: 'project-header', id: project.id, x: e.clientX, y: e.clientY });
        }}
      />

      {expanded && (
        <>
          <SidebarSection
            title="SESSIONS"
            running={runningSessions}
            total={projectSessions.length}
            onAdd={() => {
              store.setFocusedProject(project.id);
              store.setAddAgentModalOpen(true);
            }}
          >
            {projectSessions.length > 0 ? (
              projectSessions.map((session) => (
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
              <div style={{ padding: '6px 16px 8px 34px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
              projectTerminals.map((term) => (
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
              <div style={{ padding: '6px 16px 8px 34px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
              projectCommands.map((cmd) => (
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
              <div style={{ padding: '6px 16px 8px 34px', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No commands yet
              </div>
            )}
          </SidebarSection>
        </>
      )}
      </div>

      {showAddCommand && (
        <AddProcessModal
          projectId={project.id}
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
