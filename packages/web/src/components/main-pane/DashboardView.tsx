import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { AddProjectModal } from '../modals/AddProjectModal';

export function DashboardView() {
  const { projects, sessions, commands, expandProject, setProjectOverviewOpen } = useAppStore();
  const [search, setSearch] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);

  const filteredProjects = projects.filter(p =>
    search.trim() === '' || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 32, height: '100%', overflowY: 'auto' }}>
      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
          Dashboard
        </h1>
        <button
          onClick={() => setShowAddProject(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent-blue)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          <Plus size={14} /> Add Project
        </button>
      </div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search projects..."
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: 14,
          marginBottom: 24,
          outline: 'none',
        }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {filteredProjects.map(project => {
          const projSessions = Object.values(sessions).filter(
            s => s.projectId === project.id
          );
          const projCommands = Object.values(commands).filter(
            c => c.projectId === project.id
          );
          const allProcs = [...projSessions, ...projCommands];
          const runningCount = allProcs.filter(p => p.state === 'running').length;
          const errorCount = allProcs.filter(p => p.state === 'errored').length;

          return (
            <div
              key={project.id}
              onClick={() => {
                expandProject(project.id);
                setProjectOverviewOpen(true);
              }}
              style={{
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 20,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  'var(--accent-blue)')
              }
              onMouseLeave={e =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  'var(--border)')
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {project.name}
                </span>
                {errorCount > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      backgroundColor: 'var(--status-error)',
                      color: 'white',
                      borderRadius: 999,
                      padding: '2px 6px',
                    }}
                  >
                    {errorCount} error{errorCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {projSessions.length} session{projSessions.length !== 1 ? 's' : ''} ·{' '}
                {projCommands.length} command{projCommands.length !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {runningCount} running
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 8,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {project.path}
              </div>
            </div>
          );
        })}
      </div>
      {filteredProjects.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          {projects.length === 0 ? (
            <span>
              No projects yet.{' '}
              <button onClick={() => setShowAddProject(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}>
                Add a project
              </button>{' '}
              to get started.
            </span>
          ) : 'No projects match your search.'}
        </div>
      )}
    </div>
  );
}
