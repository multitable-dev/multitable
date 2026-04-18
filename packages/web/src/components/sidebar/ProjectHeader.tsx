import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { Project } from '../../lib/types';

interface Props {
  project: Project;
  shortcut?: string;
}

export function ProjectHeader({ project, shortcut }: Props) {
  const store = useAppStore();

  const handleClick = () => {
    store.setSelectedProcess(null);
    store.setProjectOverviewOpen(true);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
      }}
    >
      <CheckCircle size={16} color="var(--status-running)" style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginLeft: 8,
          flex: 1,
        }}
      >
        {project.name}
      </span>
      {shortcut && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shortcut}</span>
      )}
    </div>
  );
}
