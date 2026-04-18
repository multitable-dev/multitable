import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { TerminalView } from './TerminalView';
import { DashboardView } from './DashboardView';
import { ProjectOverview } from './ProjectOverview';

export function MainPane() {
  const store = useAppStore();
  const { selectedProcessId } = store;

  if (!selectedProcessId && store.projectOverviewOpen && store.activeProjectId) {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ProjectOverview projectId={store.activeProjectId} />
      </div>
    );
  }

  if (!selectedProcessId) {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DashboardView />
      </div>
    );
  }

  const process =
    store.sessions[selectedProcessId] ||
    store.commands[selectedProcessId] ||
    store.terminals[selectedProcessId];

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <TerminalView processId={selectedProcessId} process={process} />
    </div>
  );
}
