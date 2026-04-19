import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { Project } from '../../lib/types';

interface Props {
  project: Project;
  shortcut?: string;
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ProjectHeader({
  project,
  shortcut,
  expanded,
  focused,
  onToggle,
  onSelect,
  onContextMenu,
}: Props) {
  const [hover, setHover] = React.useState(false);
  const [toggleHover, setToggleHover] = React.useState(false);
  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        backgroundColor: focused
          ? 'var(--bg-hover)'
          : hover
            ? 'color-mix(in srgb, var(--bg-hover) 55%, transparent)'
            : 'transparent',
        transition: 'background-color var(--dur-fast) var(--ease-out)',
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onMouseEnter={() => setToggleHover(true)}
        onMouseLeave={() => setToggleHover(false)}
        title={expanded ? 'Collapse' : 'Expand'}
        aria-label={expanded ? 'Collapse project' : 'Expand project'}
        aria-expanded={expanded}
        style={{
          width: 22,
          height: 22,
          marginRight: 8,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: toggleHover ? 'var(--bg-hover)' : 'transparent',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: toggleHover ? 'var(--text-primary)' : 'var(--text-muted)',
          padding: 0,
          transition:
            'background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
        }}
      >
        <ChevronRight
          size={14}
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
          }}
        />
      </button>
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
