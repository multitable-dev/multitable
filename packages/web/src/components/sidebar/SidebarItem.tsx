import React, { useState } from 'react';
import { StatusDot } from './StatusDot';
import { Bell, Square } from 'lucide-react';
import type { ManagedProcess } from '../../lib/types';
import { api } from '../../lib/api';
import { useAppStore } from '../../stores/appStore';
import { IconButton } from '../ui';

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

  const pendingCount = useAppStore(s =>
    process.type === 'session'
      ? s.pendingPermissions.reduce(
          (n, p) => (p.sessionId === process.id ? n + 1 : n),
          0,
        )
      : 0,
  );

  const isIdle =
    process.type === 'session' &&
    process.state === 'running' &&
    !(process as any).claudeState?.currentTool;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '6px 10px',
        margin: '2px 8px',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isSelected
          ? 'color-mix(in srgb, var(--accent-blue) 14%, transparent)'
          : hovered
            ? 'var(--bg-hover)'
            : 'transparent',
        boxShadow: isSelected
          ? 'inset 3px 0 0 var(--accent-blue)'
          : 'inset 0 0 0 transparent',
        transition:
          'background-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
      }}
    >
      <div style={{ marginTop: 4 }}>
        <StatusDot state={process.state} isIdle={isIdle} />
      </div>
      <div style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: isSelected ? 600 : 500,
            }}
          >
            {process.name}
          </span>
          {pendingCount > 0 && (
            <span
              title={`${pendingCount} confirmation${pendingCount === 1 ? '' : 's'} pending`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                marginLeft: 6,
                padding: '2px 7px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--accent-blue)',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
                boxShadow: 'var(--shadow-sm)',
                animation: 'mt-pulse 1.6s ease-in-out infinite',
              }}
            >
              <Bell size={9} />
              {pendingCount}
            </span>
          )}
          {metrics && !hovered && (
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--text-muted)',
                marginLeft: 8,
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {metrics}
            </span>
          )}
          {hovered && process.state === 'running' && (
            <div style={{ display: 'flex', gap: 2, marginLeft: 6 }}>
              <IconButton
                size="sm"
                label="Stop"
                onClick={(e) => {
                  e.stopPropagation();
                  api.processes.stop(process.id);
                }}
              >
                <Square size={11} />
              </IconButton>
            </div>
          )}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 11.5,
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
