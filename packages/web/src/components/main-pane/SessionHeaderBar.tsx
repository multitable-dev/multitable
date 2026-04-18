import React from 'react';
import { PanelBottom, Play } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import { api } from '../../lib/api';
import type { Session } from '../../lib/types';

interface Props {
  session: Session;
  onToggleDetailPanel: () => void;
}

export function SessionHeaderBar({ session, onToggleDetailPanel }: Props) {
  const claudeState = session.claudeState;
  // Only surface "Start New" when a resume attempt already failed (errored).
  // Stopped sessions auto-resume on click from the sidebar.
  const showStartNew = session.state === 'errored';

  const handleCopySessionId = () => {
    if (claudeState?.claudeSessionId) {
      navigator.clipboard.writeText(claudeState.claudeSessionId);
    }
  };

  const formatTokens = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  const formatCost = (n: number): string => {
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.01) return `$${n.toFixed(3)}`;
    if (n > 0) return `$${n.toFixed(4)}`;
    return '$0.00';
  };

  const costUsd = claudeState?.costUsd ?? 0;
  const tokenCount = claudeState?.tokenCount ?? 0;

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
          {showStartNew && (
            <button
              onClick={() => api.processes.start(session.id)}
              title="Start new session"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
              }}
            >
              <Play size={14} />
              <span>Start New</span>
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
        {(costUsd > 0 || tokenCount > 0) && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {formatCost(costUsd)}
          </span>
        )}
        {tokenCount > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatTokens(tokenCount)} tokens
          </span>
        )}
      </div>
    </div>
  );
}
