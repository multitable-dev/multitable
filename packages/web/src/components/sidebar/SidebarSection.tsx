import React, { useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { IconButton } from '../ui';

interface Props {
  title: string;
  running: number;
  total: number;
  shortcut?: string;
  onAdd?: () => void;
  children: React.ReactNode;
}

export function SidebarSection({ title, running, total, shortcut, onAdd, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px 4px',
          cursor: 'pointer',
          marginTop: 12,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          transition: 'background-color var(--dur-fast) var(--ease-out)',
        }}
        onClick={() => setCollapsed(!collapsed)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <ChevronRight
          size={12}
          style={{
            color: 'var(--text-muted)',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform var(--dur-fast) var(--ease-out)',
          }}
        />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            marginLeft: 6,
          }}
        >
          {title}
        </span>
        <div
          style={{
            flex: 1,
            height: 1,
            backgroundColor: 'var(--border)',
            margin: '0 8px',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {running}/{total}
        </span>
        {onAdd && (
          <IconButton
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            label={`Add ${title.toLowerCase()}`}
            style={{
              marginLeft: 4,
              opacity: hovered ? 1 : 0,
              pointerEvents: hovered ? 'auto' : 'none',
              transition: 'opacity var(--dur-fast) var(--ease-out)',
            }}
          >
            <Plus size={12} />
          </IconButton>
        )}
        {shortcut && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
            {shortcut}
          </span>
        )}
      </div>
      <div
        style={{
          maxHeight: collapsed ? 0 : undefined,
          overflow: 'hidden',
          transition: 'max-height var(--dur-med) var(--ease-out)',
        }}
      >
        {!collapsed && children}
      </div>
    </div>
  );
}
