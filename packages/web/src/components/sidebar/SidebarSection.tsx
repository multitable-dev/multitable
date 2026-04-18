import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface Props {
  title: string;
  running: number;
  total: number;
  shortcut: string;
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
          padding: '8px 16px 4px',
          cursor: 'pointer',
          marginTop: 16,
        }}
        onClick={() => setCollapsed(!collapsed)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            marginLeft: 4,
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
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {running}/{total}
        </span>
        {onAdd && hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            style={{
              width: 16,
              height: 16,
              padding: 0,
              border: 'none',
              background: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
          >
            <Plus size={14} />
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
          {shortcut}
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}
