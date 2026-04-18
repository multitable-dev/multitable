import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Sidebar } from './components/sidebar/Sidebar';
import { MainPane } from './components/main-pane/MainPane';
import { StatusBar } from './components/status-bar/StatusBar';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { PermissionBar } from './components/permission/PermissionBar';
import { OptionSelector } from './components/option/OptionSelector';
import { AddAgentModal } from './components/modals/AddAgentModal';
import { GlobalSettingsModal } from './components/modals/GlobalSettingsModal';
import { ProjectSettingsModal } from './components/modals/ProjectSettingsModal';
import { AddProjectModal } from './components/modals/AddProjectModal';
import { TouchToolbar } from './components/mobile/TouchToolbar';
import { useAppStore } from './stores/appStore';
import { wsClient } from './lib/ws';
import { api } from './lib/api';
import { useTheme } from './hooks/useTheme';
import { ConnectionOverlay } from './components/ConnectionOverlay';
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

  // Compute running/total counts for mobile top bar
  const activeProject = store.projects.find(p => p.id === store.activeProjectId);
  const allProcesses = [
    ...Object.values(store.sessions),
    ...Object.values(store.commands),
    ...Object.values(store.terminals),
  ].filter(p => p.projectId === store.activeProjectId);
  const runningCount = allProcesses.filter(p => p.state === 'running').length;
  const totalCount = allProcesses.length;

  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Load projects and processes for the active project.
    // Called on mount and again on WS reconnect (e.g. after server restart).
    function loadData() {
      api.projects
        .list()
        .then(projects => {
          store.setProjects(projects);
          const active = projects.find(p => p.isActive) ?? projects[0];
          if (active) {
            store.setActiveProject(active.id);
            Promise.all([
              api.sessions.list(active.id),
              api.commands.list(active.id),
              api.terminals.list(active.id),
            ]).then(([sessions, commands, terminals]) => {
              store.setSessions(sessions);
              store.setCommands(commands);
              store.setTerminals(terminals);
            });
          }
        })
        .catch(() => {
          // Daemon may not be running yet; WS reconnect will handle it
        });
    }

    loadData();

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
        store.upsertSession(msg.payload.session);
      }),
      wsClient.on('session:created', (msg: any) => {
        store.upsertSession(msg.payload.session);
      }),
      wsClient.on('session:deleted', (msg: any) => {
        store.removeSession(msg.payload.sessionId);
      }),
      wsClient.on('permission:prompt', (msg: any) => {
        store.addPermission(msg.payload.prompt);
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
      wsClient.on('session:resume-failed', (msg: any) => {
        const { processId, message } = msg.payload;
        toast.error(message || 'Failed to resume session. Start a new session instead.', {
          duration: 8000,
          style: { maxWidth: 480 },
        });
        // Update session state to errored in the store
        if (processId) store.updateProcessState(processId, 'errored');
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
    ];

    return () => {
      offs.forEach(off => off());
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
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          gap: 12,
        }}>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            style={{ background: 'none', border: 'none', fontSize: 24, color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
          >
            &#9776;
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            {activeProject?.name || 'MultiTable'}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            &#9889; {runningCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Mobile drawer overlay */}
      {isMobile && mobileDrawerOpen && (
        <>
          <div
            onClick={() => setMobileDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 900 }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: 300,
            zIndex: 901, backgroundColor: 'var(--bg-sidebar)',
            transform: 'translateX(0)', transition: 'transform 0.2s ease',
            overflowY: 'auto',
          }}>
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
      <PermissionBar />
      {!isMobile && <StatusBar />}
      {isMobile && <TouchToolbar />}
      <CommandPalette />
      <ConnectionOverlay />
      <Toaster position="top-right" />
      {store.addAgentModalOpen && store.activeProjectId && (
        <AddAgentModal
          projectId={store.activeProjectId}
          onClose={() => store.setAddAgentModalOpen(false)}
        />
      )}
      {store.globalSettingsOpen && (
        <GlobalSettingsModal
          onClose={() => store.setGlobalSettingsOpen(false)}
        />
      )}
      {store.projectSettingsOpen && (() => {
        const project = store.projects.find(p => p.id === store.activeProjectId);
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
