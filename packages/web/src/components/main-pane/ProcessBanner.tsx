import React from 'react';
import { StatusDot } from '../sidebar/StatusDot';
import { api } from '../../lib/api';
import type { ManagedProcess, Session } from '../../lib/types';

interface Props {
  process: ManagedProcess;
}

export function ProcessBanner({ process }: Props) {
  const isStopped = process.state === 'stopped';
  const isErrored = process.state === 'errored';

  if (!isStopped && !isErrored) return null;

  const message = isStopped
    ? `${process.name} is not running.`
    : `${process.name} exited unexpectedly.`;

  // For sessions with a known Claude session ID, use resume so Claude Code
  // restores the prior conversation via --resume.
  const claudeSessionId =
    process.type === 'session'
      ? (process as Session).claudeState?.claudeSessionId
      : null;

  const canResume = !!claudeSessionId;
  const buttonLabel = canResume ? 'Resume' : isStopped ? 'Start' : 'Restart';
  const handleClick = canResume
    ? () => api.sessions.resumeClaude(process.id)
    : isStopped
      ? () => api.processes.start(process.id)
      : () => api.processes.restart(process.id);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-statusbar)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StatusDot state={process.state} size={10} />
        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{message}</span>
      </div>
      <button
        onClick={handleClick}
        style={{
          padding: '6px 12px',
          borderRadius: 6,
          border: 'none',
          backgroundColor: 'var(--accent-blue)',
          color: 'white',
          fontSize: 13,
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
