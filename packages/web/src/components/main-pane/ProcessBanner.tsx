import React from 'react';
import { StatusDot } from '../sidebar/StatusDot';
import { api } from '../../lib/api';
import type { ManagedProcess, Session } from '../../lib/types';
import { Button } from '../ui';

interface Props {
  process: ManagedProcess;
}

export function ProcessBanner({ process }: Props) {
  const isStopped = process.state === 'stopped';
  const isErrored = process.state === 'errored';

  if (!isStopped && !isErrored) return null;

  const session = process.type === 'session' ? (process as Session) : null;

  let message: string;
  let button: { label: string; onClick: () => void } | null = null;

  if (isErrored && session) {
    message = 'Prior session could not be found. Right-click this session in the sidebar to delete it.';
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

  const stripeColor = isErrored ? 'var(--status-error)' : 'var(--status-warning)';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-statusbar)',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${stripeColor}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        animation: 'mt-slide-up var(--dur-med) var(--ease-out)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusDot state={process.state} size={10} />
        <span style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>{message}</span>
      </div>
      {button && (
        <Button variant="primary" size="sm" onClick={button.onClick}>
          {button.label}
        </Button>
      )}
    </div>
  );
}
