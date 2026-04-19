import React from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { ProjectSidebarItem } from './ProjectSidebarItem';
import { PastSessions } from './PastSessions';
import { LogoArt } from './LogoArt';
import { Button } from '../ui';

export function Sidebar() {
  const projects = useAppStore(s => s.projects);
  const selectedProcessId = useAppStore(s => s.selectedProcessId);
  const projectOverviewOpen = useAppStore(s => s.projectOverviewOpen);
  const setSelectedProcess = useAppStore(s => s.setSelectedProcess);
  const setProjectOverviewOpen = useAppStore(s => s.setProjectOverviewOpen);
  const setFocusedProject = useAppStore(s => s.setFocusedProject);
  const setAddProjectModalOpen = useAppStore(s => s.setAddProjectModalOpen);

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
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          aria-label="MultiTable"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 14px 8px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <LogoArt />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: -0.2,
                lineHeight: 1,
              }}
            >
              MultiTable
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                letterSpacing: 0.5,
                lineHeight: 1,
              }}
            >
              v0.1
            </span>
          </div>
        </div>
        {/* Dashboard button */}
        <div style={{ padding: '0 8px 4px' }}>
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
        {/* Add Project button */}
        <div style={{ padding: '0 8px 8px' }}>
          <Button
            variant="ghost"
            size="md"
            block
            leftIcon={<Plus size={14} />}
            onClick={() => setAddProjectModalOpen(true)}
            title="Add a new project"
            style={{
              justifyContent: 'flex-start',
              color: 'var(--text-secondary)',
            }}
          >
            Add Project
          </Button>
        </div>
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
