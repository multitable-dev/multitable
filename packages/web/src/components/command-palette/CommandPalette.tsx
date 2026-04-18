import React, { useMemo } from 'react';
import { Command } from 'cmdk';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { BUILTIN_THEMES } from '../../lib/themes';

interface CommandItem {
  id: string;
  name: string;
  subtitle?: string;
  category: string;
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
    focusedProjectId,
    selectedProcessId,
    setSelectedProcess,
    toggleProjectExpanded,
    setFocusedProject,
    setProjectOverviewOpen,
    setAddAgentModalOpen,
    setAddProcessModalOpen,
    setAddProjectModalOpen,
    setGlobalSettingsOpen,
    setProjectSettingsOpen,
    setActiveTheme,
    activeThemeId,
    customThemes,
  } = useAppStore();

  const close = () => setCommandPaletteOpen(false);

  const requireFocused = (): string | null => {
    if (!focusedProjectId) {
      toast.error('Select a project first');
      return null;
    }
    return focusedProjectId;
  };

  const items = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];
    const projectName = (pid: string) =>
      projects.find((p) => p.id === pid)?.name ?? '';

    // --- Processes: sessions + commands + terminals from ALL projects ---
    for (const s of Object.values(sessions)) {
      result.push({
        id: s.id,
        name: s.name,
        subtitle: projectName(s.projectId),
        category: 'Processes',
        action: () => {
          setSelectedProcess(s.id);
        },
      });
    }
    for (const c of Object.values(commands)) {
      result.push({
        id: c.id,
        name: c.name,
        subtitle: projectName(c.projectId),
        category: 'Processes',
        action: () => {
          setSelectedProcess(c.id);
        },
      });
    }
    for (const t of Object.values(terminals)) {
      result.push({
        id: t.id,
        name: t.name || 'Terminal',
        subtitle: projectName(t.projectId),
        category: 'Processes',
        action: () => {
          setSelectedProcess(t.id);
        },
      });
    }

    // --- Projects: toggle expand + focus ---
    for (const p of projects) {
      result.push({
        id: `project-${p.id}`,
        name: p.name,
        category: 'Projects',
        action: () => {
          toggleProjectExpanded(p.id);
          setFocusedProject(p.id);
          setSelectedProcess(null);
          setProjectOverviewOpen(true);
        },
      });
    }

    // --- Actions ---
    if (focusedProjectId) {
      result.push({
        id: 'action-start-all',
        name: 'Start all processes',
        subtitle: projectName(focusedProjectId),
        category: 'Actions',
        action: () => {
          api.projects
            .startAll(focusedProjectId)
            .then(() => toast.success('All processes started'))
            .catch(() => toast.error('Failed to start all'));
        },
      });
      result.push({
        id: 'action-stop-all',
        name: 'Stop all processes',
        subtitle: projectName(focusedProjectId),
        category: 'Actions',
        action: () => {
          api.projects
            .stopAll(focusedProjectId)
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
    result.push({
      id: 'create-terminal',
      name: 'New terminal',
      subtitle: focusedProjectId ? projectName(focusedProjectId) : '(select a project first)',
      category: 'Create',
      action: () => {
        const pid = requireFocused();
        if (!pid) return;
        api.terminals
          .create(pid, {})
          .then((t) => {
            const s = useAppStore.getState();
            s.upsertTerminal(t);
            s.setSelectedProcess(t.id);
            toast.success('Terminal created');
          })
          .catch(() => toast.error('Failed to create terminal'));
      },
    });
    result.push({
      id: 'create-session',
      name: 'Add session...',
      subtitle: focusedProjectId ? projectName(focusedProjectId) : '(select a project first)',
      category: 'Create',
      action: () => {
        if (!requireFocused()) return;
        setAddAgentModalOpen(true);
      },
    });
    result.push({
      id: 'create-command',
      name: 'Add command...',
      subtitle: focusedProjectId ? projectName(focusedProjectId) : '(select a project first)',
      category: 'Create',
      action: () => {
        if (!requireFocused()) return;
        setAddProcessModalOpen(true);
      },
    });
    result.push({
      id: 'create-project',
      name: 'Add project...',
      category: 'Create',
      action: () => {
        setAddProjectModalOpen(true);
      },
    });

    // --- Settings ---
    result.push({
      id: 'settings-global',
      name: 'Open global settings',
      category: 'Settings',
      action: () => {
        setGlobalSettingsOpen(true);
      },
    });
    result.push({
      id: 'settings-project',
      name: 'Open project settings',
      subtitle: focusedProjectId ? projectName(focusedProjectId) : '(select a project first)',
      category: 'Settings',
      action: () => {
        if (!requireFocused()) return;
        setProjectSettingsOpen(true);
      },
    });
    const allThemes = [...BUILTIN_THEMES, ...customThemes];
    for (const t of allThemes) {
      result.push({
        id: `theme-${t.id}`,
        name: `Theme: ${t.name}`,
        subtitle: activeThemeId === t.id ? '(active)' : undefined,
        category: 'Themes',
        action: () => {
          setActiveTheme(t.id);
          toast.success(`Theme: ${t.name}`);
        },
      });
    }

    return result;
  }, [
    sessions,
    commands,
    terminals,
    projects,
    focusedProjectId,
    selectedProcessId,
    activeThemeId,
    customThemes,
    setSelectedProcess,
    toggleProjectExpanded,
    setFocusedProject,
    setProjectOverviewOpen,
    setAddAgentModalOpen,
    setAddProcessModalOpen,
    setAddProjectModalOpen,
    setGlobalSettingsOpen,
    setProjectSettingsOpen,
    setActiveTheme,
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
                    value={`${item.name} ${item.subtitle ?? ''}`}
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
                    {item.subtitle && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {item.subtitle}
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
