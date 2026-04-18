import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ProjectSidebarItem } from './ProjectSidebarItem';
import { PastSessions } from './PastSessions';

export function Sidebar() {
  const projects = useAppStore(s => s.projects);
  const selectedProcessId = useAppStore(s => s.selectedProcessId);
  const projectOverviewOpen = useAppStore(s => s.projectOverviewOpen);
  const setSelectedProcess = useAppStore(s => s.setSelectedProcess);
  const setProjectOverviewOpen = useAppStore(s => s.setProjectOverviewOpen);
  const setFocusedProject = useAppStore(s => s.setFocusedProject);

  const onDashboard = !selectedProcessId && !projectOverviewOpen;

  const goToDashboard = () => {
    setSelectedProcess(null);
    setProjectOverviewOpen(false);
    setFocusedProject(null);
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
      <button
        onClick={goToDashboard}
        title="View all projects"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          background: onDashboard ? 'var(--bg-hover, rgba(255,255,255,0.05))' : 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          color: onDashboard ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        <LayoutGrid size={14} />
        <span>Dashboard</span>
      </button>

      {projects.length === 0 ? (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
          No project registered. Add a project to get started.
        </div>
      ) : (
        projects.map((project) => (
          <ProjectSidebarItem key={project.id} project={project} />
        ))
      )}

      <div style={{ marginTop: 'auto' }}>
        <PastSessions />
      </div>
    </div>
  );
}
