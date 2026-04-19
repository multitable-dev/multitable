import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { wsClient } from '../../lib/ws';

const KEYS = [
  { label: '\u2303C', input: '\x03' },
  { label: 'Tab', input: '\t' },
  { label: 'Esc', input: '\x1b' },
  { label: '\u2191', input: '\x1b[A' },
  { label: '\u2193', input: '\x1b[B' },
  { label: '\u2190', input: '\x1b[D' },
  { label: '\u2192', input: '\x1b[C' },
  { label: '\u2303Z', input: '\x1a' },
  { label: 'PgUp', input: '\x1b[5~' },
  { label: 'PgDn', input: '\x1b[6~' },
];

export function TouchToolbar() {
  const selectedProcessId = useAppStore(s => s.selectedProcessId);

  if (!selectedProcessId) return null;

  const sendKey = (input: string) => {
    wsClient.sendInput(selectedProcessId, input);
  };

  return (
    <div
      className="mt-scroll"
      style={{
        display: 'flex',
        height: 52,
        backgroundColor: 'var(--bg-statusbar)',
        borderTop: '1px solid var(--border)',
        alignItems: 'center',
        gap: 4,
        padding: '0 6px',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {KEYS.map(k => (
        <button
          key={k.label}
          onClick={() => sendKey(k.input)}
          style={{
            minWidth: 44,
            height: 40,
            padding: '0 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            touchAction: 'manipulation',
            boxShadow: 'var(--shadow-sm), var(--shadow-inset)',
            transition: 'background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
          }}
          onTouchStart={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(1px)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
          }}
          onTouchEnd={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-elevated)';
          }}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
