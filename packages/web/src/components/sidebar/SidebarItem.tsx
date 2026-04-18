import React, { useState } from 'react';
import { StatusDot } from './StatusDot';
import { Square } from 'lucide-react';
import type { ManagedProcess } from '../../lib/types';
import { api } from '../../lib/api';

interface Props {
  process: ManagedProcess;
  subtitle?: string;
  metrics?: string;
  isSelected: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function SidebarItem({
  process,
  subtitle,
  metrics,
  isSelected,
  onClick,
  onContextMenu,
}: Props) {
  const [hovered, setHovered] = useState(false);

  const isIdle =
    process.type === 'session' &&
    process.state === 'running' &&
    !(process as any).claudeState?.currentTool;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '8px 16px',
        cursor: 'pointer',
        position: 'relative',
        borderLeft: isSelected
          ? '3px solid var(--accent-blue)'
          : '3px solid transparent',
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        paddingLeft: '13px',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <StatusDot state={process.state} isIdle={isIdle} />
      <div style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {process.name}
          </span>
          {metrics && !hovered && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginLeft: 8,
                flexShrink: 0,
              }}
            >
              {metrics}
            </span>
          )}
          {hovered && process.state === 'running' && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  api.processes.stop(process.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 2,
                  color: 'var(--text-muted)',
                }}
                title="Stop"
              >
                <Square size={12} />
              </button>
            </div>
          )}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
