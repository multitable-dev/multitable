import React, { useMemo } from 'react';
import { Command } from 'cmdk';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface CommandItem {
  id: string;
  name: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    projects,
    sessions,
    commands,
    terminals,
    activeProjectId,
    selectedProcessId,
    setSelectedProcess,
    setActiveProject,
    setProjectOverviewOpen,
    setAddAgentModalOpen,
    setAddProcessModalOpen,
    setAddProjectModalOpen,
    setGlobalSettingsOpen,
    setProjectSettingsOpen,
    setTheme,
    theme,
  } = useAppStore();

  const close = () => setCommandPaletteOpen(false);

  const items = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];

    // --- Processes: sessions + commands + terminals ---
    const allSessions = Object.values(sessions).filter(
      (s) => s.projectId === activeProjectId,
    );
    const allCommands = Object.values(commands).filter(
      (c) => c.projectId === activeProjectId,
    );
    const allTerminals = Object.values(terminals).filter(
      (t) => t.projectId === activeProjectId,
    );

    for (const s of allSessions) {
      result.push({
        id: s.id,
        name: s.name,
        category: 'Processes',
        action: () => {
          setSelectedProcess(s.id);
        },
      });
    }
    for (const c of allCommands) {
      result.push({
        id: c.id,
        name: c.name,
        category: 'Processes',
        action: () => {
          setSelectedProcess(c.id);
        },
      });
    }
    for (const t of allTerminals) {
      result.push({
        id: t.id,
        name: t.name || 'Terminal',
        category: 'Processes',
        action: () => {
          setSelectedProcess(t.id);
        },
      });
    }

    // --- Projects ---
    for (const p of projects) {
      result.push({
        id: `project-${p.id}`,
        name: p.name,
        category: 'Projects',
        action: () => {
          setActiveProject(p.id);
        },
      });
    }

    // --- Actions ---
    if (activeProjectId) {
      result.push({
        id: 'action-start-all',
        name: 'Start all processes',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+S',
        action: () => {
          api.projects
            .startAll(activeProjectId)
            .then(() => toast.success('All processes started'))
            .catch(() => toast.error('Failed to start all'));
        },
      });
      result.push({
        id: 'action-stop-all',
        name: 'Stop all processes',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+X',
        action: () => {
          api.projects
            .stopAll(activeProjectId)
            .then(() => toast.success('All processes stopped'))
            .catch(() => toast.error('Failed to stop all'));
        },
      });
    }
    if (selectedProcessId) {
      result.push({
        id: 'action-restart-selected',
        name: 'Restart selected process',
        category: 'Actions',
        shortcut: 'Ctrl+Shift+R',
        action: () => {
          api.processes
            .restart(selectedProcessId)
            .then(() => toast.success('Process restarted'))
            .catch(() => toast.error('Failed to restart'));
        },
      });
    }

    // --- Navigation ---
    result.push({
      id: 'nav-dashboard',
      name: 'Go to Dashboard',
      category: 'Navigation',
      action: () => {
        setSelectedProcess(null);
        setProjectOverviewOpen(false);
      },
    });

    // --- Creation ---
    if (activeProjectId) {
      result.push({
        id: 'create-terminal',
        name: 'New terminal',
        category: 'Create',
        shortcut: 'Ctrl+T',
        action: () => {
          api.terminals
            .create(activeProjectId, {})
            .then((t) => {
              const s = useAppStore.getState();
              s.upsertTerminal(t);
              s.setSelectedProcess(t.id);
              toast.success('Terminal created');
            })
            .catch(() => toast.error('Failed to create terminal'));
        },
      });
    }
    result.push({
      id: 'create-session',
      name: 'Add session...',
      category: 'Create',
      shortcut: 'Ctrl+Shift+A',
      action: () => {
        setAddAgentModalOpen(true);
      },
    });
    result.push({
      id: 'create-command',
      name: 'Add command...',
      category: 'Create',
      action: () => {
        setAddProcessModalOpen(true);
      },
    });
    result.push({
      id: 'create-project',
      name: 'Add project...',
      category: 'Create',
      shortcut: 'Ctrl+Shift+P',
      action: () => {
        setAddProjectModalOpen(true);
      },
    });

    // --- Settings ---
    result.push({
      id: 'settings-global',
      name: 'Open global settings',
      category: 'Settings',
      shortcut: 'Ctrl+,',
      action: () => {
        setGlobalSettingsOpen(true);
      },
    });
    result.push({
      id: 'settings-project',
      name: 'Open project settings',
      category: 'Settings',
      action: () => {
        setProjectSettingsOpen(true);
      },
    });
    result.push({
      id: 'settings-theme',
      name: 'Toggle theme',
      category: 'Settings',
      action: () => {
        const cycle: Record<string, 'light' | 'dark' | 'system'> = {
          light: 'dark',
          dark: 'system',
          system: 'light',
        };
        const next = cycle[theme] || 'light';
        setTheme(next);
        toast.success(`Theme: ${next}`);
      },
    });

    return result;
  }, [
    sessions,
    commands,
    terminals,
    projects,
    activeProjectId,
    selectedProcessId,
    theme,
    setSelectedProcess,
    setActiveProject,
    setProjectOverviewOpen,
    setAddAgentModalOpen,
    setAddProcessModalOpen,
    setAddProjectModalOpen,
    setGlobalSettingsOpen,
    setProjectSettingsOpen,
    setTheme,
  ]);

  // Group items by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const group = map.get(item.category) || [];
      group.push(item);
      map.set(item.category, group);
    }
    return map;
  }, [items]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 600,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <Command>
          <Command.Input
            placeholder="Search commands..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 15,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border)',
            }}
          />
          <Command.List style={{ maxHeight: 400, overflowY: 'auto', padding: 8 }}>
            <Command.Empty
              style={{
                padding: 16,
                color: 'var(--text-muted)',
                textAlign: 'center',
                fontSize: 13,
              }}
            >
              No results
            </Command.Empty>
            {Array.from(grouped.entries()).map(([category, groupItems]) => (
              <Command.Group key={category} heading={category}>
                {groupItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.name}
                    onSelect={() => {
                      item.action();
                      close();
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{item.name}</span>
                    {item.shortcut && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-secondary, rgba(128,128,128,0.15))',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                        }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
