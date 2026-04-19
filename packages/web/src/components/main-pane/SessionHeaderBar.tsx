import React, { useState } from 'react';
import { PanelBottom, Copy, Check } from 'lucide-react';
import { StatusDot } from '../sidebar/StatusDot';
import type { Session } from '../../lib/types';
import { IconButton } from '../ui';

interface Props {
  session: Session;
  onToggleDetailPanel: () => void;
}

export function SessionHeaderBar({ session, onToggleDetailPanel }: Props) {
  const claudeState = session.claudeState;
  const [copied, setCopied] = useState(false);

  const handleCopySessionId = () => {
    if (claudeState?.claudeSessionId) {
      navigator.clipboard.writeText(claudeState.claudeSessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
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

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 10px',
    height: 20,
    fontSize: 11.5,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    lineHeight: 1,
  };

  return (
    <div
      style={{
        minHeight: 42,
        backgroundColor: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border)',
        padding: '6px 14px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <StatusDot state={session.state} size={8} />
          <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
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
          <IconButton size="sm" onClick={onToggleDetailPanel} label="Toggle detail panel">
            <PanelBottom size={14} />
          </IconButton>
        </div>
      </div>

      {/* Bottom row — chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {claudeState?.claudeSessionId && (
          <span
            onClick={handleCopySessionId}
            title="Click to copy session ID"
            style={{
              ...chipStyle,
              cursor: 'pointer',
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--accent-blue)';
              (e.currentTarget as HTMLSpanElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLSpanElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLSpanElement).style.color = 'var(--text-secondary)';
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {claudeState.claudeSessionId}
            </span>
          </span>
        )}
        {(costUsd > 0 || tokenCount > 0) && (
          <span style={chipStyle}>{formatCost(costUsd)}</span>
        )}
        {tokenCount > 0 && (
          <span style={chipStyle}>{formatTokens(tokenCount)} tokens</span>
        )}
      </div>
    </div>
  );
}
