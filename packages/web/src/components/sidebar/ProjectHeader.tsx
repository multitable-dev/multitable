import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Project } from '../../lib/types';
import { getProjectColor } from '../../lib/projectColor';
import { useIsDark } from '../../hooks/useIsDark';

interface Props {
  project: Project;
  shortcut?: string;
  expanded: boolean;
  focused: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ProjectHeader({
  project,
  shortcut,
  expanded,
  focused,
  onClick,
  onContextMenu,
}: Props) {
  const dark = useIsDark();
  const color = getProjectColor(project.id, dark);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${color.stripe}`,
        cursor: 'pointer',
        backgroundColor: color.tint,
        boxShadow: focused ? `inset 0 0 0 1px ${color.stripe}` : undefined,
      }}
    >
      {expanded ? (
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginRight: 6 }} />
      ) : (
        <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginRight: 6 }} />
      )}
      <span
        style={{
          fontSize: 15,
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
      {shortcut && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{shortcut}</span>
      )}
    </div>
  );
}
