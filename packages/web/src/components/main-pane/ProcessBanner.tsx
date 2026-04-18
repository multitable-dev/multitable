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

  // Sessions: auto-resume/start happens on sidebar click — just show status,
  // except for errored (resume failed) where the user must explicitly start new.
  let message: string;
  let button: { label: string; onClick: () => void } | null = null;

  if (isErrored && session) {
    message = 'Prior session could not be found. You must start a new session.';
    button = {
      label: 'Start New Session',
      onClick: () => api.processes.start(process.id),
    };
  } else if (session) {
    message = `${process.name} is stopped.`;
  } else if (isStopped) {
    message = `${process.name} is not running.`;
    button = {
      label: 'Start',
      onClick: () => api.processes.start(process.id),
    };
  } else {
    message = `${process.name} exited unexpectedly.`;
    button = {
      label: 'Start',
      onClick: () => api.processes.start(process.id),
    };
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
      {button && (
        <button
          onClick={button.onClick}
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
          {button.label}
        </button>
      )}
    </div>
  );
}
