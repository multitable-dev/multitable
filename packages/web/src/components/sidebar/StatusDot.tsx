import React from 'react';
import type { ProcessState } from '../../lib/types';

interface Props {
  state: ProcessState;
  isIdle?: boolean; // for session running-but-idle state
  size?: number;
}

function sheen(color: string): string {
  return `radial-gradient(circle at 30% 30%, color-mix(in srgb, white 55%, transparent) 0%, ${color} 65%)`;
}

export function StatusDot({ state, isIdle, size = 10 }: Props) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--text-primary) 10%, transparent)',
  };

  if (state === 'running' && isIdle) {
    return (
      <div
        style={{
          ...base,
          border: '2px solid var(--status-running)',
          backgroundColor: 'transparent',
          boxShadow: 'none',
        }}
      />
    );
  }
  if (state === 'running') {
    return (
      <div
        style={{
          ...base,
          background: sheen('var(--status-running)'),
        }}
      />
    );
  }
  if (state === 'errored') {
    return (
      <div
        style={{
          ...base,
          background: sheen('var(--status-error)'),
        }}
      />
    );
  }
  if (state === 'stopped') {
    return (
      <div
        style={{
          ...base,
          background: sheen('var(--status-stopped)'),
        }}
      />
    );
  }
  // idle (transitional)
  return (
    <div
      style={{
        ...base,
        border: '2px solid var(--status-warning)',
        backgroundColor: 'transparent',
        boxShadow: 'none',
      }}
    />
  );
}
