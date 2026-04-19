import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { AddProjectModal } from '../modals/AddProjectModal';
import { Button, Card, Input, Badge } from '../ui';
import { getProjectColor } from '../../lib/projectColor';
import { useIsDark } from '../../hooks/useIsDark';

export function DashboardView() {
  const { projects, sessions, commands, expandProject, setProjectOverviewOpen } = useAppStore();
  const [search, setSearch] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const dark = useIsDark();

  const filteredProjects = projects.filter(p =>
    search.trim() === '' || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="mt-scroll"
      style={{ padding: 32, height: '100%', overflowY: 'auto', animation: 'mt-fade-in var(--dur-med) var(--ease-out)' }}
    >
      {showAddProject && <AddProjectModal onClose={() => setShowAddProject(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, flex: 1, letterSpacing: -0.3 }}>
          Dashboard
        </h1>
        <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setShowAddProject(true)}>
          Add Project
        </Button>
      </div>
      <div style={{ marginBottom: 24, maxWidth: 420 }}>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          leftIcon={<Search size={14} />}
        />
      </div>
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
          const color = getProjectColor(project.id, dark);

          return (
            <Card
              key={project.id}
              interactive
              onClick={() => {
                expandProject(project.id);
                setProjectOverviewOpen(true);
              }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                paddingTop: 22,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${color.stripe}, color-mix(in srgb, ${color.stripe} 40%, transparent))`,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {project.name}
                </span>
                {errorCount > 0 && (
                  <Badge variant="error" solid>
                    {errorCount} error{errorCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {projSessions.length} session{projSessions.length !== 1 ? 's' : ''} ·{' '}
                {projCommands.length} command{projCommands.length !== 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {runningCount > 0 && (
                  <Badge variant="running">{runningCount} running</Badge>
                )}
                {runningCount === 0 && allProcs.length > 0 && (
                  <Badge variant="muted">Idle</Badge>
                )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 10,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={project.path}
              >
                {project.path}
              </div>
            </Card>
          );
        })}
      </div>
      {filteredProjects.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>
          {projects.length === 0 ? (
            <span>
              No projects yet.{' '}
              <button
                onClick={() => setShowAddProject(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: 14, padding: 0, textDecoration: 'underline' }}
              >
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
