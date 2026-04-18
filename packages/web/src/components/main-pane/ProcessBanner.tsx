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

  const session = process.type === 'session' ? (process as Session) : null;
  const hasPriorConversation = !!(
    session?.claudeSessionId || session?.claudeState?.claudeSessionId
  );

  // ── Determine message and action ────────────────────────────────────────────

  let message: string;
  let buttonLabel: string;
  let handleClick: () => void;

  if (isErrored && session) {
    // Resume was attempted and failed, or session crashed
    message = 'Prior session could not be found. You must start a new session.';
    buttonLabel = 'Start New Session';
    handleClick = () => api.processes.start(process.id);
  } else if (isStopped && hasPriorConversation) {
    // User stopped a valid session that has a resumable conversation
    message = `${process.name} is stopped.`;
    buttonLabel = 'Resume';
    handleClick = () => api.sessions.resumeClaude(process.id);
  } else if (isStopped) {
    // Stopped with no prior conversation — fresh start
    message = `${process.name} is not running.`;
    buttonLabel = 'Start';
    handleClick = () => api.processes.start(process.id);
  } else {
    // Non-session errored process
    message = `${process.name} exited unexpectedly.`;
    buttonLabel = 'Restart';
    handleClick = () => api.processes.restart(process.id);
  }

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
