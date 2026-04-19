import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ProjectSidebarItem } from './ProjectSidebarItem';
import { PastSessions } from './PastSessions';
import { Button } from '../ui';

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
      className="mt-scroll"
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
      <div
        style={{
          padding: 8,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <Button
          variant="ghost"
          size="md"
          block
          leftIcon={<LayoutGrid size={14} />}
          onClick={goToDashboard}
          title="View all projects"
          style={{
            justifyContent: 'flex-start',
            backgroundColor: onDashboard ? 'var(--bg-hover)' : undefined,
            color: onDashboard ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          Dashboard
        </Button>
      </div>

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
