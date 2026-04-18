import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { ProjectSidebarItem } from './ProjectSidebarItem';
import { PastSessions } from './PastSessions';

export function Sidebar() {
  const { projects } = useAppStore();

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
