import React from 'react';
import { RotateCw, PanelBottom } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import { api } from '../../lib/api';
import type { Session } from '../../lib/types';

interface Props {
  session: Session;
  onToggleDetailPanel: () => void;
}

export function SessionHeaderBar({ session, onToggleDetailPanel }: Props) {
  const claudeState = session.claudeState;
  const showResume = claudeState?.claudeSessionId && session.state !== 'running';

  const handleCopySessionId = () => {
    if (claudeState?.claudeSessionId) {
      navigator.clipboard.writeText(claudeState.claudeSessionId);
    }
  };

  const formatNumber = (n: number): string => {
    return n.toLocaleString();
  };

  const cost = claudeState?.tokenCount
    ? (claudeState.tokenCount * 0.000003).toFixed(4)
    : '0.00';

  return (
    <div
      style={{
        minHeight: 40,
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 16px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <StatusDot state={session.state} size={8} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {session.name}
          </span>
          {claudeState?.label && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {claudeState.label}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {showResume && (
            <button
              onClick={() => api.sessions.resumeClaude(session.id)}
              title="Resume Claude"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RotateCw size={14} />
            </button>
          )}
          <button
            onClick={onToggleDetailPanel}
            title="Toggle detail panel"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PanelBottom size={14} />
          </button>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
        {claudeState?.claudeSessionId && (
          <span
            onClick={handleCopySessionId}
            title="Click to copy session ID"
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 180,
            }}
          >
            {claudeState.claudeSessionId}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ${cost}
        </span>
        {claudeState?.tokenCount != null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatNumber(claudeState.tokenCount)} tokens
          </span>
        )}
      </div>
    </div>
  );
}
