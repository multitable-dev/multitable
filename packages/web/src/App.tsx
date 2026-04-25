import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Palette, Menu, Zap } from 'lucide-react';
import { BUILTIN_THEMES } from './lib/themes';
import { Sidebar } from './components/sidebar/Sidebar';
import { MainPane } from './components/main-pane/MainPane';
import { StatusBar } from './components/status-bar/StatusBar';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { OptionSelector } from './components/option/OptionSelector';
import { AddAgentModal } from './components/modals/AddAgentModal';
import { AddProcessModal } from './components/modals/AddProcessModal';
import { GlobalSettingsModal } from './components/modals/GlobalSettingsModal';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { AddProjectModal } from './components/modals/AddProjectModal';
import { TouchToolbar } from './components/mobile/TouchToolbar';
import { IconButton } from './components/ui';
import { useAppStore } from './stores/appStore';
import { wsClient } from './lib/ws';
import { api } from './lib/api';
import { playPermissionChime, playAttentionChime, playDoneChime } from './lib/sound';
import { handleSessionAlert } from './lib/notify';
import { updateTabBadge } from './lib/tabBadge';
import { loadPrefs, subscribePrefs } from './lib/notificationPrefs';
import { useTheme } from './hooks/useTheme';
import { ConnectionOverlay } from './components/ConnectionOverlay';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { ElicitationModalHost } from './components/elicitation/ElicitationModal';
import type { Session } from './lib/types';

function App() {
  const store = useAppStore();
  useTheme();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Close drawer when a process is selected on mobile
  useEffect(() => {
    if (isMobile) setMobileDrawerOpen(false);
  }, [store.selectedProcessId, isMobile]);

  // Clear per-session unread alert badge when the session becomes selected.
  useEffect(() => {
    if (store.selectedProcessId) {
      useAppStore.getState().markSessionRead(store.selectedProcessId);
    }
  }, [store.selectedProcessId]);

  // Tab title + favicon badge — driven by total unread across all sessions.
  // Cleared automatically when the user gives the tab focus, since the
  // session-select effect above zeroes out the focused session's count.
  useEffect(() => {
    function totalUnread(): number {
      const prefs = loadPrefs();
      if (!prefs.showCenterBadge) return 0;
      const map = useAppStore.getState().unreadBySession;
      let n = 0;
      for (const v of Object.values(map)) n += v;
      return n;
    }
    updateTabBadge(totalUnread());
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.unreadBySession !== prev.unreadBySession) {
        updateTabBadge(totalUnread());
      }
    });
    const unsubPrefs = subscribePrefs(() => updateTabBadge(totalUnread()));
    function onVisible() {
      if (!document.hidden) updateTabBadge(totalUnread());
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      unsubPrefs();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Compute running/total counts for mobile top bar (scoped to focused project)
  const focusedProject = store.projects.find(p => p.id === store.focusedProjectId);
  const allProcesses = [
    ...Object.values(store.sessions),
    ...Object.values(store.commands),
    ...Object.values(store.terminals),
  ].filter(p => p.projectId === store.focusedProjectId);
  const runningCount = allProcesses.filter(p => p.state === 'running').length;
  const totalCount = allProcesses.length;

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Load projects and processes for ALL projects. Expanded state is a
    // pure frontend concern — backend processes stay alive regardless.
    // Called on mount and again on WS reconnect (e.g. after server restart).
    function loadData() {
      api.projects
        .list()
        .then(async projects => {
          store.setProjects(projects);
          if (projects.length === 0) return;

          // Restore expanded state from localStorage (intersect with known ids)
          let expanded: string[] = [];
          try {
            const raw = localStorage.getItem('mt:expandedProjectIds');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                const valid = new Set(projects.map(p => p.id));
                expanded = parsed.filter((x: unknown): x is string =>
                  typeof x === 'string' && valid.has(x)
                );
              }
            }
          } catch {
            // localStorage unavailable or corrupt; fall through to default
          }
          if (expanded.length === 0) {
            const initial = projects.find(p => p.isActive) ?? projects[0];
            expanded = [initial.id];
          }
          useAppStore.setState({
            expandedProjectIds: expanded,
            focusedProjectId: expanded[0] ?? null,
          });

          // Fetch processes for every project in parallel
          const triples = await Promise.all(
            projects.map(p =>
              Promise.all([
                api.sessions.list(p.id).catch(() => []),
                api.commands.list(p.id).catch(() => []),
                api.terminals.list(p.id).catch(() => []),
              ])
            )
          );
          const allSessions = triples.flatMap(([s]) => s);
          const allCommands = triples.flatMap(([, c]) => c);
          const allTerminals = triples.flatMap(([, , t]) => t);
          store.setSessions(allSessions);
          store.setCommands(allCommands);
          store.setTerminals(allTerminals);
        })
        .catch(() => {
          // Daemon may not be running yet; WS reconnect will handle it
        });
    }

    loadData();

    // Persist expandedProjectIds to localStorage on every change
    const unsubPersist = useAppStore.subscribe((state, prev) => {
      if (state.expandedProjectIds !== prev.expandedProjectIds) {
        try {
          localStorage.setItem(
            'mt:expandedProjectIds',
            JSON.stringify(state.expandedProjectIds)
          );
        } catch {
          // ignore quota/availability errors
        }
      }
    });

    // Wire WebSocket events to store
    const offs = [
      // Re-fetch all data when WS reconnects (e.g. after server restart)
      wsClient.on('ws:reconnected', () => {
        loadData();
      }),
      wsClient.on('process-state-changed', (msg: any) => {
        const pid = msg.processId || msg.payload?.processId;
        if (pid) store.updateProcessState(pid, msg.payload.state);
      }),
      wsClient.on('process-metrics', (msg: any) => {
        const pid = msg.processId || msg.payload?.processId;
        if (pid) store.updateProcessMetrics(pid, msg.payload);
      }),
      wsClient.on('session:updated', (msg: any) => {
        // Preserve in-memory claudeState (label, tokens, etc.) since the
        // backend broadcasts the DB row which doesn't carry transient state.
        const incoming: Session = msg.payload.session;
        const existing = store.sessions[incoming.id];
        store.upsertSession(
          existing?.claudeState
            ? { ...incoming, claudeState: existing.claudeState }
            : incoming
        );
      }),
      wsClient.on('session:created', (msg: any) => {
        store.upsertSession(msg.payload.session);
      }),
      wsClient.on('session:deleted', (msg: any) => {
        store.removeSession(msg.payload.sessionId);
      }),
      wsClient.on('permission:prompt', (msg: any) => {
        store.addPermission(msg.payload.prompt);
        playPermissionChime();
      }),
      wsClient.on('permission:resolved', (msg: any) => {
        store.removePermission(msg.payload.id);
      }),
      wsClient.on('permission:expired', (msg: any) => {
        store.removePermission(msg.payload.id);
      }),
      wsClient.on('option:prompt', (msg: any) => {
        store.setOption(msg.payload);
      }),
      wsClient.on('session:notification', (msg: any) => {
        const { sessionId, payload } = msg.payload || {};
        const session = sessionId ? store.sessions[sessionId] : null;
        const name = session?.name ?? 'Claude';
        const message = payload?.message || 'Needs your attention';
        toast(`${name}: ${message}`, { duration: 5000 });
        playAttentionChime();
      }),
      wsClient.on('session:turn-complete', (msg: any) => {
        const sessionId = msg.processId;
        const live = useAppStore.getState();
        const session = sessionId ? live.sessions[sessionId] : null;
        const name = session?.name ?? 'Claude';
        toast.success(`${name} is done`, { duration: 4000 });
        playDoneChime();
        // Pulse the sidebar for sessions the user isn't currently looking at —
        // turn-complete doesn't go through the alert envelope (intentional, to
        // keep the NotificationCenter free of every routine completion), so
        // bump the unread count manually for cross-session visibility.
        if (sessionId && live.selectedProcessId !== sessionId) {
          live.bumpUnread(sessionId);
        }
      }),
      wsClient.on('session:assistant-message', (msg: any) => {
        const pid = msg.processId || msg.payload?.processId;
        const messages = msg.payload?.messages;
        if (pid && Array.isArray(messages) && messages.length > 0) {
          store.appendMessages(pid, messages);
        }
      }),
      wsClient.on('session:tool-event', (msg: any) => {
        const pid = msg.processId || msg.payload?.processId;
        const messages = msg.payload?.messages;
        if (pid && Array.isArray(messages) && messages.length > 0) {
          store.appendMessages(pid, messages);
        }
      }),
      wsClient.on('session:user-message', (msg: any) => {
        const pid = msg.processId || msg.payload?.processId;
        const messages = msg.payload?.messages;
        if (pid && Array.isArray(messages) && messages.length > 0) {
          store.appendMessages(pid, messages);
        }
      }),
      wsClient.on('session:turn-error', (msg: any) => {
        const message = msg.payload?.message || 'Turn failed';
        const pid = msg.processId;
        const session = pid ? store.sessions[pid] : null;
        const name = session?.name ?? 'Session';
        toast.error(`${name}: ${message}`, { duration: 6000, style: { maxWidth: 480 } });
      }),
      wsClient.on('session:send-error', (msg: any) => {
        const message = msg.payload?.message || 'Send failed';
        toast.error(message, { duration: 4000 });
      }),
      wsClient.on('session:label-updated', (msg: any) => {
        const { sessionId, label } = msg.payload;
        const session = store.sessions[sessionId];
        if (session) {
          store.upsertSession({
            ...session,
            claudeState: {
              ...(session.claudeState ?? {
                claudeSessionId: null,
                currentTool: null,
                toolCount: 0,
                tokenCount: 0,
                costUsd: 0,
                lastActivity: 0,
                activeSubagents: 0,
                userMessages: [],
                label: null,
              }),
              label,
            },
          } as Session);
        }
      }),
      wsClient.on('session:alert', (msg: any) => {
        const alert = msg.payload?.alert;
        if (alert && typeof alert === 'object' && alert.alertId) {
          handleSessionAlert(alert);
        }
      }),
      wsClient.on('session:elicitation:prompt', (msg: any) => {
        const prompt = msg.payload?.prompt;
        if (prompt && typeof prompt === 'object' && prompt.id) {
          useAppStore.getState().addElicitation(prompt);
        }
      }),
      wsClient.on('session:elicitation:resolved', (msg: any) => {
        const id = msg.payload?.id;
        if (typeof id === 'string') useAppStore.getState().removeElicitation(id);
      }),
      wsClient.on('session:elicitation:expired', (msg: any) => {
        const id = msg.payload?.id;
        if (typeof id === 'string') useAppStore.getState().removeElicitation(id);
      }),
      wsClient.on('session:task-event', (msg: any) => {
        const sessionId = msg.processId || msg.payload?.sessionId;
        const subtype = msg.payload?.subtype;
        const payload = msg.payload?.payload;
        if (typeof sessionId === 'string' && typeof subtype === 'string' && payload && typeof payload === 'object') {
          useAppStore.getState().applyTaskEvent(sessionId, subtype, payload);
        }
      }),
      wsClient.on('session:tool-progress', (msg: any) => {
        const sessionId = msg.processId || msg.payload?.sessionId;
        const p = msg.payload;
        if (typeof sessionId !== 'string' || !p) return;
        useAppStore.getState().setToolProgress(sessionId, {
          toolUseId: typeof p.toolUseId === 'string' ? p.toolUseId : '',
          toolName: typeof p.toolName === 'string' ? p.toolName : '',
          elapsedSeconds: typeof p.elapsedSeconds === 'number' ? p.elapsedSeconds : 0,
          taskId: typeof p.taskId === 'string' ? p.taskId : null,
          parentToolUseId: typeof p.parentToolUseId === 'string' ? p.parentToolUseId : null,
          receivedAt: Date.now(),
        });
      }),
      wsClient.on('session:status', (msg: any) => {
        const sessionId = msg.processId || msg.payload?.sessionId;
        const p = msg.payload;
        if (typeof sessionId !== 'string' || !p) return;
        const status = p.status === 'compacting' || p.status === 'requesting' ? p.status : null;
        useAppStore.getState().setSessionStatus(sessionId, status === null ? { status: null } : { status, compactResult: p.compactResult ?? null, compactError: p.compactError ?? null });
      }),
      // Clear stale tool-progress when a turn completes — the SDK doesn't send a
      // "tool stopped" event so we infer it from turn boundaries.
      wsClient.on('session:turn-complete', (msg: any) => {
        const sessionId = msg.processId;
        if (typeof sessionId === 'string') {
          useAppStore.getState().setToolProgress(sessionId, null);
          useAppStore.getState().setSessionStatus(sessionId, { status: null });
        }
      }),
      wsClient.on('session:state-updated', (msg: any) => {
        // The daemon's AgentSessionManager broadcasts a snapshot of cost,
        // tokens, currentTool, etc. on every SDK `result` and on each tool
        // hook. Mirror it onto the session's `claudeState` so SessionHeaderBar
        // and the /cost slash command see live numbers. Use getState() rather
        // than the closure's stale store snapshot.
        const { sessionId, state } = msg.payload || {};
        if (!sessionId || !state) return;
        const session = useAppStore.getState().sessions[sessionId];
        if (!session) return;
        useAppStore.getState().upsertSession({
          ...session,
          claudeState: {
            claudeSessionId: state.claudeSessionId ?? session.claudeState?.claudeSessionId ?? null,
            currentTool: state.currentTool ?? null,
            toolCount: state.toolCount ?? 0,
            tokenCount: state.tokenCount ?? 0,
            costUsd: state.costUsd ?? 0,
            lastActivity: state.lastActivity ?? Date.now(),
            activeSubagents: state.activeSubagents ?? 0,
            userMessages: state.userMessages ?? session.claudeState?.userMessages ?? [],
            label: state.label ?? session.claudeState?.label ?? null,
          },
        } as Session);
      }),
    ];

    return () => {
      offs.forEach(off => off());
      unsubPersist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Mobile top bar */}
      {isMobile && (
        <div style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          gap: 10,
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}>
          <IconButton
            size="lg"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            label="Open menu"
          >
            <Menu size={20} />
          </IconButton>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {focusedProject?.name || 'MultiTable'}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            <Zap size={10} /> {runningCount}/{totalCount}
          </span>
          {(() => {
            const allThemes = [...BUILTIN_THEMES, ...store.customThemes];
            const cycle = () => {
              const idx = allThemes.findIndex((t) => t.id === store.activeThemeId);
              const next = allThemes[(idx + 1) % allThemes.length];
              store.setActiveTheme(next.id);
            };
            const active = allThemes.find((t) => t.id === store.activeThemeId);
            return (
              <IconButton onClick={cycle} label={`Theme: ${active?.name ?? 'Light'}`} size="lg">
                <Palette size={16} />
              </IconButton>
            );
          })()}
        </div>
      )}

      {/* Mobile drawer overlay */}
      {isMobile && mobileDrawerOpen && (
        <>
          <div
            onClick={() => setMobileDrawerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'var(--bg-overlay)',
              backdropFilter: 'blur(6px) saturate(1.1)',
              WebkitBackdropFilter: 'blur(6px) saturate(1.1)',
              zIndex: 900,
              animation: 'mt-fade-in var(--dur-fast) var(--ease-out)',
            }}
          />
          <div
            className="mt-scroll"
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0, width: 300,
              zIndex: 901, backgroundColor: 'var(--bg-sidebar)',
              boxShadow: 'var(--shadow-xl)',
              transform: 'translateX(0)',
              animation: 'mt-slide-up var(--dur-med) var(--ease-out)',
              overflowY: 'auto',
            }}
          >
            <Sidebar />
          </div>
        </>
      )}

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!isMobile && <Sidebar />}
        <MainPane />
      </div>

      <OptionSelector />
      {!isMobile && <StatusBar />}
      {isMobile && <TouchToolbar />}
      <CommandPalette />
      <NotificationCenter />
      <ElicitationModalHost />
      <ConnectionOverlay />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            boxShadow: 'var(--shadow-lg)',
          },
          success: {
            iconTheme: {
              primary: 'var(--status-running)',
              secondary: 'var(--bg-elevated)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--status-error)',
              secondary: 'var(--bg-elevated)',
            },
          },
        }}
      />
      {store.addAgentModalOpen && store.focusedProjectId && (
        <AddAgentModal
          projectId={store.focusedProjectId}
          onClose={() => store.setAddAgentModalOpen(false)}
        />
      )}
      {store.addProcessModalOpen && store.focusedProjectId && (
        <AddProcessModal
          projectId={store.focusedProjectId}
          onClose={() => store.setAddProcessModalOpen(false)}
        />
      )}
      {store.globalSettingsOpen && (
        <GlobalSettingsModal
          onClose={() => store.setGlobalSettingsOpen(false)}
        />
      )}
      {store.projectSettingsOpen && (() => {
        const project = store.projects.find(p => p.id === store.focusedProjectId);
        return project ? (
          <ProjectSettingsModal
            project={project}
            onClose={() => store.setProjectSettingsOpen(false)}
          />
        ) : null;
      })()}
      {store.addProjectModalOpen && (
        <AddProjectModal
          onClose={() => store.setAddProjectModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
