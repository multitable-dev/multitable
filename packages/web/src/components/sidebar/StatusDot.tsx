import React from 'react';
import type { ProcessState } from '../../lib/types';

interface Props {
  state: ProcessState;
  isIdle?: boolean; // for session running-but-idle state
  size?: number;
}

export function StatusDot({ state, isIdle, size = 10 }: Props) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
  };

  if (state === 'running' && isIdle) {
    return (
      <div
        style={{
          ...style,
          border: '2px solid var(--status-running)',
          backgroundColor: 'transparent',
        }}
      />
    );
  }
  if (state === 'running') {
    return <div style={{ ...style, backgroundColor: 'var(--status-running)' }} />;
  }
  if (state === 'errored') {
    return <div style={{ ...style, backgroundColor: 'var(--status-error)' }} />;
  }
  if (state === 'stopped') {
    return <div style={{ ...style, backgroundColor: 'var(--status-stopped)' }} />;
  }
  // idle (transitional)
  return (
    <div
      style={{
        ...style,
        border: '2px solid var(--status-warning)',
        backgroundColor: 'transparent',
      }}
    />
  );
}
